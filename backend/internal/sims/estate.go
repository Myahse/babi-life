package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The buildings that pay (game/estate.go, the update « immobilier »): built from a building's plan on a
// big lot (plot.go buildPlan makes its row here), they're managed from the phone (web components/Immo.tsx):
// the money waiting collected, the building kept up, a shop opened on its ground floor and its staff hired
// or let go. Each visit moves the building on to now (game.Estate.Settle), from the end of its building
// site: nothing comes in while the masons are still at it.

// EstateKey: the update.
const EstateKey = "immobilier"

var (
	errNoEstate    = errors.New("ce terrain n'a pas d'immeuble qui rapporte")
	errNoShop      = errors.New("cet immeuble n'a pas de local commercial")
	errNoSuchShop  = errors.New("commerce inconnu")
	errShopOpen    = errors.New("le commerce est déjà ouvert : il garde son enseigne")
	errShopFirst   = errors.New("ouvre d'abord un commerce au rez-de-chaussée")
	errStaffFull   = errors.New("il y a déjà assez de monde dans ce commerce")
	errNoSuchStaff = errors.New("personne de ce nom ne travaille ici")
	errNothingDue  = errors.New("rien à encaisser pour l'instant : les loyers arrivent au fil des jours")
	errLikeNew     = errors.New("l'immeuble est comme neuf")
	errEstateHome  = errors.New("on n'habite pas un immeuble de rapport : ses logements sont loués")
)

// estateRow is a building as the phone shows it.
type estateRow struct {
	game.Estate
	Lot     int64  `json:"lot"`
	Plan    string `json:"plan"`
	Label   string `json:"label"`
	City    string `json:"city"`
	Commune string `json:"commune"`
	Name    string `json:"name"`
	// Rent: a day's rent for one unit; Gross: what the building brings a day as it stands; Repair: what
	// getting it like new costs; Building: the minutes the masons still need (0: done).
	Rent     int `json:"rent"`
	Gross    int `json:"gross"`
	Repair   int `json:"repair"`
	Building int `json:"building"`
	// HasShop: a ground floor for a shop; Sales: its takings a day as staffed now.
	HasShop bool `json:"hasShop"`
	Sales   int  `json:"sales"`
}

// loadEstates: a Sim's buildings, moved on to now (and saved so), locked when changing them.
func loadEstates(ctx context.Context, tx pgx.Tx, simID string, now time.Time) ([]estateRow, error) {
	rows, err := tx.Query(ctx, `
		SELECT e.plot_id, e.plan, e.kind, e.units, e.tenants, e.upkeep, e.shop, e.staff, e.pending, e.hours, e.last, p.lot_city, p.lot_commune, p.build_until
		FROM estates e JOIN plots p ON p.id = e.plot_id WHERE e.sim_id = $1 ORDER BY e.plot_id FOR UPDATE OF e`, simID)
	if err != nil {
		return nil, err
	}
	var out []estateRow
	for rows.Next() {
		var r estateRow
		var staff []byte
		var until *time.Time
		var upkeep float32
		if err := rows.Scan(&r.Lot, &r.Plan, &r.Kind, &r.Units, &r.Tenants, &upkeep, &r.Shop, &staff, &r.Pending, &r.Hours, &r.Last, &r.City, &r.Commune, &until); err != nil {
			rows.Close()
			return nil, err
		}
		r.Upkeep = float64(upkeep)
		_ = json.Unmarshal(staff, &r.Staff)
		if r.Staff == nil {
			r.Staff = []game.Staff{}
		}
		if until != nil && now.Before(*until) {
			r.Building = int(until.Sub(now).Minutes()) + 1
		}
		out = append(out, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range out {
		r := &out[i]
		if r.Building == 0 {
			r.Settle(r.Commune, now)
		}
		if err := saveEstate(ctx, tx, r); err != nil {
			return nil, err
		}
		r.fill()
	}
	return out, nil
}

// fill: what the phone reads off the building's state.
func (r *estateRow) fill() {
	r.Name = communeName(r.City, r.Commune)
	if pl, ok := game.FindLotPlan(r.Plan); ok {
		r.Label = pl.Label
	}
	ep := game.EstatePlans[r.Plan]
	r.HasShop = ep.Shop
	r.Rent = game.UnitRent(r.Commune, r.Kind)
	r.Gross = r.DayGross(r.Commune)
	r.Repair = r.RepairCost()
	if k, ok := game.FindShopKind(r.Shop); ok {
		r.Sales = game.ShopSales(k, len(r.Staff), r.Commune, r.Upkeep)
	}
}

func saveEstate(ctx context.Context, tx pgx.Tx, r *estateRow) error {
	staff, err := json.Marshal(r.Staff)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE estates SET tenants = $2, upkeep = $3, shop = $4, staff = $5, pending = $6, hours = $7, last = $8 WHERE plot_id = $1`,
		r.Lot, r.Tenants, r.Upkeep, r.Shop, staff, r.Pending, r.Hours, r.Last)
	return err
}

// startEstate: a building's plan just begun on a lot: its row, counting from the end of the building site.
func startEstate(ctx context.Context, tx pgx.Tx, simID string, lot int64, plan string, until time.Time) error {
	ep, ok := game.EstatePlans[plan]
	if !ok {
		_, err := tx.Exec(ctx, `DELETE FROM estates WHERE plot_id = $1`, lot)
		return err
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO estates (plot_id, sim_id, plan, kind, units, last) VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (plot_id) DO UPDATE SET plan = $3, kind = $4, units = $5, tenants = 0, upkeep = 100, shop = '', staff = '[]', pending = 0, hours = 0, last = $6`,
		lot, simID, plan, ep.Kind, ep.Units, until)
	return err
}

// estateOpen: the update is open.
func estateOpen(ctx context.Context) bool {
	return features.Default == nil || features.Default.BlocksKey(ctx, EstateKey) == ""
}

// estates: GET /sims/{id}/estates — the Sim's buildings (moved on to now), the shops one can open, and what
// can still be collected today.
func (h *Handler) estates(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !estateOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	list, err := loadEstates(ctx, tx, id, time.Now())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	left, err := leftFor(ctx, tx, id, game.FromEstate)
	if err != nil || tx.Commit(ctx) != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if list == nil {
		list = []estateRow{}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"estates": list, "shops": game.ShopKinds, "wage": game.Wage, "tax": game.EstateTax, "left": left, "days": game.PendingDays})
}

// estateReq: the building (its lot), and what's asked of it.
type estateReq struct {
	Lot  int64  `json:"lot"`
	Shop string `json:"shop"`
	Name string `json:"name"`
}

// onEstate: a change to one of the Sim's buildings (lot 0, for collect: all of them), moved on to now first, saved after.
func (h *Handler) onEstate(w http.ResponseWriter, r *http.Request, fn func(s *Sim, e *estateRow, all []estateRow, req estateReq) (string, int, error)) {
	if !estateOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	var req estateReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		all, err := loadEstates(ctx, tx, s.ID, time.Now())
		if err != nil {
			return game.Outcome{}, nil, err
		}
		var e *estateRow
		for i := range all {
			if all[i].Lot == req.Lot {
				e = &all[i]
			}
		}
		if e == nil && req.Lot != 0 {
			return game.Outcome{}, nil, errNoEstate
		}
		text, money, err := fn(s, e, all, req)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		for i := range all {
			if err := saveEstate(ctx, tx, &all[i]); err != nil {
				return game.Outcome{}, nil, err
			}
		}
		kind := "life"
		if money != 0 {
			kind = "bill"
		}
		return game.Outcome{Text: text, Money: money}, []Event{{Kind: kind, Text: text, Money: money, GameTime: s.GameMinutes}}, nil
	})
}

// estateCollect: POST /sims/{id}/estate/collect {lot} — the money waiting in a building (lot 0: in all of them)
// taken, the tax off, up to the day's limit (the rest waits till tomorrow).
func (h *Handler) estateCollect(w http.ResponseWriter, r *http.Request) {
	h.onEstate(w, r, func(s *Sim, e *estateRow, all []estateRow, _ estateReq) (string, int, error) {
		targets := all
		if e != nil {
			targets = []estateRow{*e}
		}
		got, tax, losses := 0, 0, 0
		for _, t := range targets {
			i := slices.IndexFunc(all, func(x estateRow) bool { return x.Lot == t.Lot })
			x := &all[i]
			if x.Pending < 0 {
				// A shop that lost money: its owner pays the wages owed.
				losses -= x.Pending
				x.Pending = 0
				continue
			}
			net, tx := x.Collect(s.left(game.FromEstate))
			if net > 0 {
				net = s.earn(game.FromEstate, net)
			}
			got, tax = got+net, tax+tx
		}
		s.Money -= losses
		switch {
		case got == 0 && losses == 0 && s.left(game.FromEstate) == 0:
			return "", 0, game.ErrFull(game.FromEstate)
		case got == 0 && losses == 0:
			return "", 0, errNothingDue
		}
		text := fmt.Sprintf("Loyers encaissés : %s pour toi, %s d'impôts payés.", game.FCFA(got), game.FCFA(tax))
		if losses > 0 {
			text += fmt.Sprintf(" Ton commerce a perdu de l'argent : %s de salaires payés de ta poche.", game.FCFA(losses))
		}
		if s.left(game.FromEstate) == 0 {
			text = capNote(text, game.FromEstate, 0, 1)
		}
		return text, got - losses, nil
	})
}

// estateRepair: POST /sims/{id}/estate/repair {lot} — the building made like new (the painters, the plumber, the lift).
func (h *Handler) estateRepair(w http.ResponseWriter, r *http.Request) {
	h.onEstate(w, r, func(s *Sim, e *estateRow, _ []estateRow, req estateReq) (string, int, error) {
		if e == nil {
			return "", 0, errNoEstate
		}
		cost := e.RepairCost()
		if cost == 0 || e.Upkeep >= 99.5 {
			return "", 0, errLikeNew
		}
		if cost > s.Money {
			return "", 0, game.ErrNotEnoughMoney
		}
		s.Money -= cost
		e.Upkeep = 100
		return fmt.Sprintf("Travaux finis %s : peinture, plomberie, ascenseur. L'immeuble est comme neuf, les locataires restent.", inCommune(communeName(e.City, e.Commune))), -cost, nil
	})
}

// estateShop: POST /sims/{id}/estate/shop {lot, shop} — a business opened on the ground floor (its fitting out paid).
func (h *Handler) estateShop(w http.ResponseWriter, r *http.Request) {
	h.onEstate(w, r, func(s *Sim, e *estateRow, _ []estateRow, req estateReq) (string, int, error) {
		if e == nil {
			return "", 0, errNoEstate
		}
		if !game.EstatePlans[e.Plan].Shop {
			return "", 0, errNoShop
		}
		if e.Shop != "" {
			return "", 0, errShopOpen
		}
		k, ok := game.FindShopKind(req.Shop)
		if !ok {
			return "", 0, errNoSuchShop
		}
		if k.FitOut > s.Money {
			return "", 0, game.ErrNotEnoughMoney
		}
		s.Money -= k.FitOut
		e.Shop = k.ID
		return fmt.Sprintf("%s ouvert au rez-de-chaussée ! Embauche du monde pour le faire tourner.", k.Label), -k.FitOut, nil
	})
}

// estateHire: POST /sims/{id}/estate/hire {lot} — one more person working in the shop (paid a wage a day).
func (h *Handler) estateHire(w http.ResponseWriter, r *http.Request) {
	h.onEstate(w, r, func(s *Sim, e *estateRow, _ []estateRow, req estateReq) (string, int, error) {
		if e == nil {
			return "", 0, errNoEstate
		}
		k, ok := game.FindShopKind(e.Shop)
		if !ok {
			return "", 0, errShopFirst
		}
		if len(e.Staff) >= k.Staff {
			return "", 0, errStaffFull
		}
		names := slices.DeleteFunc(slices.Clone(game.StaffNames), func(n string) bool {
			return slices.ContainsFunc(e.Staff, func(x game.Staff) bool { return x.Name == n })
		})
		name := names[rand.IntN(len(names))]
		e.Staff = append(e.Staff, game.Staff{Name: name, Since: time.Now()})
		return fmt.Sprintf("%s commence demain matin à ton %s : %s par jour.", name, game.LowerFirst(k.Label), game.FCFA(game.Wage)), 0, nil
	})
}

// estateFire: POST /sims/{id}/estate/fire {lot, name} — someone let go from the shop.
func (h *Handler) estateFire(w http.ResponseWriter, r *http.Request) {
	h.onEstate(w, r, func(s *Sim, e *estateRow, _ []estateRow, req estateReq) (string, int, error) {
		if e == nil {
			return "", 0, errNoEstate
		}
		name := req.Name
		i := slices.IndexFunc(e.Staff, func(x game.Staff) bool { return x.Name == name })
		if i < 0 {
			return "", 0, errNoSuchStaff
		}
		e.Staff = slices.Delete(e.Staff, i, i+1)
		return fmt.Sprintf("%s ne travaille plus à ton commerce.", name), 0, nil
	})
}
