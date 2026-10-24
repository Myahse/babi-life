package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Dodo, homes let by the night (game/dodo.go). Booked from anywhere, paid at
// once; once in its commune, the home is the Sim's for the nights booked
// (the « logement » interactions, at StayPlaceID). Players let the houses
// they built on their other lots (not the one they live in): a guest's
// nights are paid to them, Dodo keeping its share. One guest at a time in a
// player's house.

// StayPlaceID: where the things done in a home booked on Dodo happen.
const StayPlaceID = "logement"

var (
	errNoListing    = errors.New("logement introuvable sur Dodo")
	errListingFull  = errors.New("ce logement est déjà réservé : choisis-en un autre")
	errOwnListing   = errors.New("c'est ta propre maison : tu n'as pas besoin de la louer")
	errNotLettable  = errors.New("pour la mettre en location, il faut une maison habitable (un lit sous un toit, des toilettes) où tu n'habites pas")
	errBadNight     = errors.New("le prix de la nuit va de 5 000 à 60 000 Djai")
	errTooYoungDodo = errors.New("louer un logement, c'est à partir de 18 ans")
	errNoDodoStay   = errors.New("réserve d'abord un logement (appli Dodo)")
)

// Nights one books on Dodo (a few hours is a hotel's thing).
func dodoLengths() []game.StayLength { return game.StayLengths[1:] }

// dodoPlayers: the houses players let in a commune.
func dodoPlayers(ctx context.Context, q queryer, city, commune string, me string, now int64) ([]game.DodoListing, error) {
	rows, err := q.Query(ctx, `
		SELECT d.id, d.title, d.night, d.sim_id, s.first_name, d.stays, p.lot_w * p.lot_d,
			EXISTS (SELECT 1 FROM sims g WHERE g.stay->>'kind' = 'dodo' AND (g.stay->>'listing')::bigint = d.id AND (g.stay->>'until')::bigint > $3)
		FROM dodo_listings d JOIN plots p ON p.id = d.plot_id JOIN sims s ON s.id = d.sim_id
		WHERE p.lot_city = $1 AND p.lot_commune = $2 ORDER BY d.created_at DESC LIMIT 30`, city, commune, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []game.DodoListing{}
	for rows.Next() {
		var l game.DodoListing
		var id int64
		var stays, area int
		if err := rows.Scan(&id, &l.Title, &l.Night, &l.HostSim, &l.Host, &stays, &area, &l.Full); err != nil {
			return nil, err
		}
		l.ID, l.City, l.Commune, l.Mine = fmt.Sprintf("p:%d", id), city, commune, l.HostSim == me
		l.Type, l.TypeName, l.Guests = "maison", fmt.Sprintf("Maison de joueur · terrain de %d m²", area), 4
		l.Has, l.Reviews, l.Rating, l.Seed = []string{"Maison bâtie par son hôte", "Meublée"}, stays, 0, int(id)
		out = append(out, l)
	}
	return out, rows.Err()
}

// DodoMine: a house the player lets, and what it has brought in.
type DodoMine struct {
	ID      int64  `json:"id"`
	Lot     int64  `json:"lot"`
	Title   string `json:"title"`
	Night   int    `json:"night"`
	Stays   int    `json:"stays"`
	Earned  int    `json:"earned"`
	City    string `json:"city"`
	Commune string `json:"commune"`
	Busy    bool   `json:"busy"`
}

// dodo: GET /sims/{id}/dodo[?city=&commune=] — the homes for rent in a commune (where the Sim is by
// default), the Sim's stay, the houses it lets and the ones it could.
func (h *Handler) dodo(w http.ResponseWriter, r *http.Request) {
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
	s.GameMinutes = game.MinuteOf(nowTime())
	city, commune, err := lotsWhere(&s, r.URL.Query().Get("city"), r.URL.Query().Get("commune"))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	players, err := dodoPlayers(ctx, h.DB, city, commune, id, s.GameMinutes)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	listings := append(players, game.DodoListings(city, commune, s.GameMinutes/(24*60))...)
	mine := []DodoMine{}
	rows, err := h.DB.Query(ctx, `
		SELECT d.id, d.plot_id, d.title, d.night, d.stays, d.earned, p.lot_city, p.lot_commune,
			EXISTS (SELECT 1 FROM sims g WHERE g.stay->>'kind' = 'dodo' AND (g.stay->>'listing')::bigint = d.id AND (g.stay->>'until')::bigint > $2)
		FROM dodo_listings d JOIN plots p ON p.id = d.plot_id WHERE d.sim_id = $1 ORDER BY d.id`, id, s.GameMinutes)
	if err == nil {
		for rows.Next() {
			var m DodoMine
			if rows.Scan(&m.ID, &m.Lot, &m.Title, &m.Night, &m.Stays, &m.Earned, &m.City, &m.Commune, &m.Busy) == nil {
				mine = append(mine, m)
			}
		}
		rows.Close()
	}
	// The houses it could let: built, livable, not lived in, not let yet.
	lots, _ := loadLots(ctx, h.DB, id)
	lettable := []Plot{}
	for _, p := range lots {
		listed := false
		for _, m := range mine {
			listed = listed || m.Lot == p.ID
		}
		if p.Livable && !p.Home && !listed {
			lettable = append(lettable, p)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"listings": listings, "stay": s.stay(), "mine": mine, "lettable": lettable, "lengths": dodoLengths(),
		"fee": game.DodoFee, "studio": game.DodoNight(commune), "adult": s.stage().ID == game.StageAdulte})
}

// dodoBook: POST /sims/{id}/dodo/book {listing, length} — a home booked and paid; a player's house pays its host.
func (h *Handler) dodoBook(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Listing string `json:"listing"`
		Length  string `json:"length"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if s.stage().ID != game.StageAdulte {
			return game.Outcome{}, nil, errTooYoungDodo
		}
		var length game.StayLength
		for _, l := range dodoLengths() {
			if l.ID == req.Length {
				length = l
			}
		}
		if length.ID == "" {
			return game.Outcome{}, nil, errNoSuchLength
		}
		if st := s.stay(); st != nil {
			return game.Outcome{}, nil, fmt.Errorf("tu as déjà %s %s : libère-la d'abord", stayName(st), untilLabel(st.Until))
		}
		var l game.DodoListing
		var listing, lot int64
		switch {
		case strings.HasPrefix(req.Listing, "g:"):
			parts := strings.Split(req.Listing, ":")
			if len(parts) != 4 {
				return game.Outcome{}, nil, errNoListing
			}
			for _, x := range game.DodoListings(parts[1], parts[2], s.GameMinutes/(24*60)) {
				if x.ID == req.Listing {
					l = x
				}
			}
		case strings.HasPrefix(req.Listing, "p:"):
			listing, _ = strconv.ParseInt(strings.TrimPrefix(req.Listing, "p:"), 10, 64)
			err := tx.QueryRow(ctx, `SELECT d.title, d.night, d.sim_id, s.first_name, p.lot_city, p.lot_commune, d.plot_id,
				EXISTS (SELECT 1 FROM sims g WHERE g.stay->>'kind' = 'dodo' AND (g.stay->>'listing')::bigint = d.id AND (g.stay->>'until')::bigint > $2)
				FROM dodo_listings d JOIN plots p ON p.id = d.plot_id JOIN sims s ON s.id = d.sim_id WHERE d.id = $1 FOR UPDATE OF d`, listing, s.GameMinutes).
				Scan(&l.Title, &l.Night, &l.HostSim, &l.Host, &l.City, &l.Commune, &lot, &l.Full)
			if err != nil {
				return game.Outcome{}, nil, errNoListing
			}
			l.ID, l.Type = req.Listing, "maison"
		}
		switch {
		case l.ID == "":
			return game.Outcome{}, nil, errNoListing
		case l.HostSim == s.ID:
			return game.Outcome{}, nil, errOwnListing
		case l.Full:
			return game.Outcome{}, nil, errListingFull
		}
		price := int(float64(l.Night)*length.Rate/500+0.5) * 500
		if price > s.Money {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		// A player's house: Djai going from one account to another, within the day's limits (money.go).
		gain := price - int(float64(price)*game.DodoFee)
		if l.HostSim != "" {
			if err := heldBack(ctx, tx, s.ID); err != nil {
				return game.Outcome{}, nil, err
			}
			if left, err := leftFor(ctx, tx, l.HostSim, game.FromRental); err != nil {
				return game.Outcome{}, nil, err
			} else if left < gain {
				return game.Outcome{}, nil, game.ErrFull(game.FromRental)
			}
		}
		s.Money -= price
		s.Stay = &Stay{Kind: "dodo", Place: StayPlaceID, Name: l.Title, Room: l.ID, City: l.City, Commune: l.Commune, From: s.GameMinutes, Until: s.GameMinutes + length.Minutes, Paid: price, Listing: listing, Host: l.HostSim, Type: l.Type, Lot: lot, Seed: l.Seed}
		where := inCommune(communeName(l.City, l.Commune))
		if l.HostSim != "" {
			// The host is paid, Dodo keeps its share.
			if _, err := takeFor(ctx, tx, l.HostSim, game.FromRental, gain); err != nil {
				return game.Outcome{}, nil, err
			}
			_, _ = tx.Exec(ctx, `UPDATE dodo_listings SET stays = stays + 1, earned = earned + $2 WHERE id = $1`, listing, gain)
			_ = insertEvent(ctx, tx, l.HostSim, "bill", fmt.Sprintf("Dodo : %s a réservé ta maison %s pour %s. Tu reçois %s.", s.FirstName, where, strings.ToLower(length.Label), game.FCFA(gain)), gain, s.GameMinutes)
		}
		text := fmt.Sprintf("Réservé sur Dodo : « %s » %s, %s (%s). Les clés t'attendent là-bas.", l.Title, where, strings.ToLower(length.Label), untilLabel(s.Stay.Until))
		return game.Outcome{Text: text, Money: -price}, []Event{{Kind: "bill", Text: text, Money: -price, GameTime: s.GameMinutes}}, nil
	})
}

// dodoList: POST /sims/{id}/dodo/list {lot, night, title} — a house of one's other lots let on Dodo (or its price changed).
func (h *Handler) dodoList(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Lot   int64  `json:"lot"`
		Night int    `json:"night"`
		Title string `json:"title"`
	}
	if err := httpx.Decode(r, &req); err != nil || req.Lot == 0 {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		p, err := loadPlot(ctx, tx, s.ID, req.Lot, false)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if !p.Livable || p.Home {
			return game.Outcome{}, nil, errNotLettable
		}
		if req.Night < 5000 || req.Night > 60000 {
			return game.Outcome{}, nil, errBadNight
		}
		where := communeName(p.Lot.City, p.Lot.Commune)
		title := strings.TrimSpace(req.Title)
		if title == "" {
			title = fmt.Sprintf("La maison de %s %s", s.FirstName, inCommune(where))
		}
		if utf8.RuneCountInString(title) > 60 {
			title = string([]rune(title)[:60])
		}
		if _, err := tx.Exec(ctx, `INSERT INTO dodo_listings (sim_id, plot_id, title, night) VALUES ($1, $2, $3, $4)
			ON CONFLICT (plot_id) DO UPDATE SET title = $3, night = $4`, s.ID, p.ID, title, req.Night); err != nil {
			return game.Outcome{}, nil, err
		}
		text := fmt.Sprintf("Ta maison %s est sur Dodo à %s la nuit. Les voyageurs vont arriver !", inCommune(where), game.FCFA(req.Night))
		return game.Outcome{Text: text}, nil, nil
	})
}

// dodoUnlist: POST /sims/{id}/dodo/unlist {lot} — a house taken off Dodo (a guest already there stays till the end).
func (h *Handler) dodoUnlist(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Lot int64 `json:"lot"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if _, err := tx.Exec(r.Context(), `DELETE FROM dodo_listings WHERE sim_id = $1 AND plot_id = $2`, s.ID, req.Lot); err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: "Ta maison n'est plus sur Dodo."}, nil, nil
	})
}

// atStay: the things done in a home booked on Dodo, once in its commune.
func (s *Sim) atStay() (game.PlaceKind, string, error) {
	st := s.stay()
	if st == nil || st.Kind != "dodo" {
		return game.PlaceKind{}, "", errNoDodoStay
	}
	if s.City != st.City || s.Commune != st.Commune {
		_, cm, _ := world.FindCommune(st.City, st.Commune)
		return game.PlaceKind{}, "", fmt.Errorf("ta location est %s : vas-y d'abord", inCommune(cm.Name))
	}
	return game.Kinds[game.DodoKind], st.Name, nil
}
