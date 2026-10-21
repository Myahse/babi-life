package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

var (
	errTooYoungForLot = errors.New("on achète un terrain à 18 ans : d'ici là, tu vis chez tes parents")
	errLotNotBigger   = errors.New("choisis un terrain plus grand que le tien")
	errNoSuchLot      = errors.New("terrain inconnu")
	errMoveInArrears  = errors.New("règle d'abord tes arriérés de loyer avant de déménager")
	errAlreadyHome    = errors.New("tu habites déjà ta maison")
	errNoSuchPlan     = errors.New("plan inconnu")
	errLivesThere     = errors.New("tu habites cette maison : déménage d'abord pour la démolir")
	errNoSuchCommune  = errors.New("commune inconnue")
)

// One's own house (game/house.go): from 18 the Sim buys a lot in any commune
// of any town (from the phone, without going there first: one buys land from
// afar), builds on it block by block, furnishes it, and moves in. Others in
// the commune see the house on its lot.

// Lot is the land a Sim owns.
type Lot struct {
	W       int    `json:"w"`
	D       int    `json:"d"`
	Area    int    `json:"area"`
	City    string `json:"city"`
	Commune string `json:"commune"`
	Paid    int    `json:"paid"`
}

type Plot struct {
	SimID     string       `json:"simId"`
	FirstName string       `json:"firstName,omitempty"`
	Blocks    []game.Block `json:"blocks"`
	Furniture []game.Piece `json:"furniture"`
	Zones     []game.Zone  `json:"zones"`
	Built     int          `json:"built"`
	Lot       *Lot         `json:"lot"`
	// Livable: a covered bed and toilets; Home: the Sim lives there.
	Livable bool `json:"livable"`
	Home    bool `json:"home"`
}

func (p Plot) house() game.House {
	h := game.House{Blocks: p.Blocks, Furniture: p.Furniture, Zones: p.Zones, Built: p.Built}
	if p.Lot != nil {
		h.W, h.D = p.Lot.W, p.Lot.D
	}
	return h
}

const plotColumns = `p.sim_id, p.blocks, p.built, p.furniture, p.zones, p.lot_w, p.lot_d, p.lot_city, p.lot_commune, p.lot_paid`

func scanPlot(row pgx.Row, extra ...any) (Plot, error) {
	var p Plot
	var l Lot
	err := row.Scan(append([]any{&p.SimID, &p.Blocks, &p.Built, &p.Furniture, &p.Zones, &l.W, &l.D, &l.City, &l.Commune, &l.Paid}, extra...)...)
	if err == nil && l.W > 0 {
		l.Area = l.W * l.D
		p.Lot = &l
	}
	p.Livable = p.house().Livable()
	return p, err
}

func loadPlot(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, simID string, lock bool) (Plot, error) {
	query := `SELECT ` + plotColumns + ` FROM plots p WHERE p.sim_id = $1`
	if lock {
		query += ` FOR UPDATE`
	}
	p, err := scanPlot(q.QueryRow(ctx, query, simID))
	if errors.Is(err, pgx.ErrNoRows) {
		return Plot{SimID: simID, Blocks: []game.Block{}, Furniture: []game.Piece{}, Zones: []game.Zone{}}, nil
	}
	return p, err
}

func savePlot(ctx context.Context, tx pgx.Tx, p Plot) error {
	l := p.Lot
	if l == nil {
		l = &Lot{}
	}
	if p.Blocks == nil {
		p.Blocks = []game.Block{}
	}
	if p.Furniture == nil {
		p.Furniture = []game.Piece{}
	}
	if p.Zones == nil {
		p.Zones = []game.Zone{}
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO plots (sim_id, blocks, built, furniture, zones, lot_w, lot_d, lot_city, lot_commune, lot_paid, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
		ON CONFLICT (sim_id) DO UPDATE SET blocks = $2, built = $3, furniture = $4, zones = $5, lot_w = $6, lot_d = $7,
			lot_city = $8, lot_commune = $9, lot_paid = $10, updated_at = now()`,
		p.SimID, p.Blocks, p.Built, p.Furniture, p.Zones, l.W, l.D, l.City, l.Commune, l.Paid)
	return err
}

// plot: GET /sims/{id}/plot — the player's own lot and house.
func (h *Handler) plot(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	p, err := loadPlot(r.Context(), h.DB, id, false)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	var housing string
	_ = h.DB.QueryRow(r.Context(), `SELECT housing FROM sims WHERE id = $1`, id).Scan(&housing)
	p.Home = housing == game.OwnHouse
	httpx.JSON(w, http.StatusOK, p)
}

// LotOffer is a lot for sale in a commune.
type LotOffer struct {
	game.LotSize
	Area     int    `json:"area"`
	Price    int    `json:"price"`
	PerM2    int    `json:"perM2"`
	City     string `json:"city"`
	Commune  string `json:"commune"`
	Name     string `json:"name"`
	Upgrade  bool   `json:"upgrade"` // bigger than the lot one has, here
	Payable  int    `json:"payable"` // what it costs now (the old lot counted)
	Possible bool   `json:"possible"`
}

// lotsWhere: the commune a lot is looked for in (?city=&commune=, or the body's): where the Sim is when none is given.
func lotsWhere(s *Sim, city, commune string) (string, string, error) {
	if city == "" && commune == "" {
		return s.City, s.Commune, nil
	}
	if _, _, ok := world.FindCommune(city, commune); !ok {
		return "", "", errNoSuchCommune
	}
	return city, commune, nil
}

func offers(p Plot, city, commune string) []LotOffer {
	name := commune
	if _, cm, ok := world.FindCommune(city, commune); ok {
		name = cm.Name
	}
	perM2, ok := game.LotPricePerM2[commune]
	if !ok {
		perM2 = game.DefaultLotPrice
	}
	out := make([]LotOffer, 0, len(game.LotSizes))
	for _, l := range game.LotSizes {
		o := LotOffer{LotSize: l, Area: l.Area(), Price: game.LotPrice(commune, l), PerM2: perM2, City: city, Commune: commune, Name: name}
		o.Payable, o.Possible = o.Price, true
		if p.Lot != nil {
			here := p.Lot.City == city && p.Lot.Commune == commune
			o.Upgrade = here && l.Area() > p.Lot.Area
			switch {
			case here && !o.Upgrade:
				o.Possible = false
			case here:
				o.Payable = max(0, o.Price-p.Lot.Paid)
			}
		}
		out = append(out, o)
	}
	return out
}

// lotOffers: GET /sims/{id}/lots[?city=&commune=] — the lots for sale in a commune (where the Sim is by default), and its own.
func (h *Handler) lotOffers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	s, err := scanSim(h.DB.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1`, id))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	p, err := loadPlot(ctx, h.DB, id, false)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	city, commune, err := lotsWhere(&s, r.URL.Query().Get("city"), r.URL.Query().Get("commune"))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"offers": offers(p, city, commune), "lot": p.Lot, "fees": game.LotFees, "adult": !s.minor()})
}

// buyLot: POST /sims/{id}/lot {size, city, commune} — buys a lot in a commune (where the Sim is by default). A bigger lot in
// the same commune keeps the house (what was paid counts); a lot elsewhere
// needs the old one cleared, and the old one is sold back at 90 %.
func (h *Handler) buyLot(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Size    string `json:"size"`
		City    string `json:"city"`
		Commune string `json:"commune"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	size, ok := game.FindLotSize(req.Size)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, errNoSuchLot.Error())
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if s.minor() {
			return game.Outcome{}, nil, errTooYoungForLot
		}
		p, err := loadPlot(ctx, tx, s.ID, true)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		city, commune, err := lotsWhere(s, req.City, req.Commune)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		var offer LotOffer
		for _, o := range offers(p, city, commune) {
			if o.ID == size.ID {
				offer = o
			}
		}
		if !offer.Possible {
			return game.Outcome{}, nil, errLotNotBigger
		}
		cost, refund := offer.Payable, 0
		if p.Lot != nil && !offer.Upgrade {
			// Elsewhere: the old lot must be bare, and is sold back.
			if len(p.Blocks) > 0 || len(p.Furniture) > 0 || len(p.Zones) > 0 || s.Housing == game.OwnHouse {
				return game.Outcome{}, nil, game.ErrLotElsewhere
			}
			refund = p.Lot.Paid * 9 / 10
		}
		if cost > s.Money+refund {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		if offer.Upgrade && !p.house().Fits(size.W, size.D) {
			return game.Outcome{}, nil, game.ErrLotTooSmall
		}
		s.Money += refund - cost
		paid := offer.Price
		p.Lot = &Lot{W: size.W, D: size.D, Area: size.Area(), City: city, Commune: commune, Paid: paid}
		if err := savePlot(ctx, tx, p); err != nil {
			return game.Outcome{}, nil, err
		}
		text := fmt.Sprintf("Terrain acheté %s : %s de %d m² (%d × %d m), ACD et notaire compris. À toi de bâtir !", inCommune(offer.Name), game.LowerFirst(size.Label), size.Area(), size.W, size.D)
		if offer.Upgrade {
			text = fmt.Sprintf("Ton terrain s'agrandit : %d m² %s. Ta maison reste debout.", size.Area(), inCommune(offer.Name))
		}
		if refund > 0 {
			text += fmt.Sprintf(" L'ancien terrain est revendu %s.", game.FCFA(refund))
		}
		return game.Outcome{Text: text, Money: refund - cost}, []Event{{Kind: "bill", Text: text, Money: refund - cost, GameTime: s.GameMinutes}}, nil
	})
}

// build: PUT /sims/{id}/plot — blocks and furniture put in and taken out, paid from the Sim's money.
func (h *Handler) build(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Place     []game.Block `json:"place"`
		Remove    []game.Block `json:"remove"`
		Furnish   []game.Piece `json:"furnish"`
		Unfurnish []game.Piece `json:"unfurnish"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if s.minor() {
			return game.Outcome{}, nil, errTooYoungForLot
		}
		ctx := r.Context()
		p, err := loadPlot(ctx, tx, s.ID, true)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		house, placed, cost, err := p.house().Edit(req.Place, req.Remove, req.Furnish, req.Unfurnish)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if cost > s.Money {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		s.Money -= cost
		p.Blocks, p.Furniture, p.Built = house.Blocks, house.Furniture, house.Built
		if err := savePlot(ctx, tx, p); err != nil {
			return game.Outcome{}, nil, err
		}
		s.Furnished = house.Has()
		text := "Le chantier avance."
		switch {
		case len(req.Furnish) > 0 && placed == 0:
			text = "Les meubles sont installés."
		case placed == 0 && cost < 0:
			text = "Démoli : la moitié revendue."
		}
		return game.Outcome{Text: text, Money: -cost}, nil, nil
	})
}

// buildPlan: POST /sims/{id}/plot/plan — a whole house from a plan on the
// empty lot ({"plan": id}), paid in one go; or everything on the lot taken
// down ({"clear": true}): half the blocks and furniture sold back.
func (h *Handler) buildPlan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Plan  string `json:"plan"`
		Clear bool   `json:"clear"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if s.minor() {
			return game.Outcome{}, nil, errTooYoungForLot
		}
		ctx := r.Context()
		p, err := loadPlot(ctx, tx, s.ID, true)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if req.Clear {
			if s.Housing == game.OwnHouse {
				return game.Outcome{}, nil, errLivesThere
			}
			back := game.PlanRefund(p.house())
			s.Money += back
			p.Blocks, p.Furniture, p.Zones = nil, nil, nil
			if err := savePlot(ctx, tx, p); err != nil {
				return game.Outcome{}, nil, err
			}
			s.Furnished = nil
			text := "Tout est démoli : le terrain est nu, la moitié des matériaux et des meubles revendue."
			return game.Outcome{Text: text, Money: back}, nil, nil
		}
		pl, ok := game.FindLotPlan(req.Plan)
		if !ok {
			return game.Outcome{}, nil, errNoSuchPlan
		}
		house, err := p.house().BuildPlan(pl)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if pl.Cost > s.Money {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		s.Money -= pl.Cost
		p.Blocks, p.Furniture, p.Zones, p.Built = house.Blocks, house.Furniture, house.Zones, house.Built
		if err := savePlot(ctx, tx, p); err != nil {
			return game.Outcome{}, nil, err
		}
		text := fmt.Sprintf("%s : les maçons ont tout bâti, les meubles sont posés. Tu peux emménager !", pl.Label)
		m := houseMoment(s, false, p.Lot.City, p.Lot.Commune)
		return game.Outcome{Text: text, Money: -pl.Cost}, []Event{{Kind: "bill", Text: text, Money: -pl.Cost, GameTime: s.GameMinutes, moment: &m}}, nil
	})
}

// moveIn: POST /sims/{id}/plot/movein — the Sim leaves its rented room for the house it built.
func (h *Handler) moveIn(w http.ResponseWriter, r *http.Request) {
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		p, err := loadPlot(r.Context(), tx, s.ID, false)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		switch {
		case p.Lot == nil:
			return game.Outcome{}, nil, game.ErrNoLot
		case s.Housing == game.OwnHouse:
			return game.Outcome{}, nil, errAlreadyHome
		case !p.house().Livable():
			return game.Outcome{}, nil, game.ErrNotLivable
		case s.RentArrears > 0:
			return game.Outcome{}, nil, errMoveInArrears
		case s.Activity != nil:
			return game.Outcome{}, nil, game.ErrBusy
		}
		s.Housing, s.HomeCity, s.HomeCommune = game.OwnHouse, p.Lot.City, p.Lot.Commune
		s.Furnished = p.house().Has()
		name := p.Lot.Commune
		if _, cm, ok := world.FindCommune(p.Lot.City, p.Lot.Commune); ok {
			name = cm.Name
		}
		text := fmt.Sprintf("Tu emménages dans ta maison %s ! Plus de loyer : tu es chez toi.", inCommune(name))
		m := houseMoment(s, true, p.Lot.City, p.Lot.Commune)
		return game.Outcome{Text: text}, []Event{{Kind: "life", Text: text, GameTime: s.GameMinutes, moment: &m}}, nil
	})
}

// plots: GET /sims/{id}/plots — the houses on the lots of the commune where
// this Sim is now (the player's own included).
func (h *Handler) plots(w http.ResponseWriter, r *http.Request) {
	_, city, commune, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	rows, err := h.DB.Query(r.Context(), `
		SELECT `+plotColumns+`, s.first_name FROM plots p JOIN sims s ON s.id = p.sim_id
		WHERE p.lot_city = $1 AND p.lot_commune = $2 AND p.lot_w > 0
		ORDER BY p.updated_at DESC LIMIT 40`, city, commune)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	out := []Plot{}
	for rows.Next() {
		var name string
		if p, err := scanPlot(rows, &name); err == nil {
			p.FirstName = name
			out = append(out, p)
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}
