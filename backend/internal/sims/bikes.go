package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Vélo Babi (world/bikes.go): a bike hired at a station of one's commune, paid with Waye for a while; past
// its time it locks, until it's paid again (extend); returned at a station or anywhere (it goes back to
// its own by itself); left alone, it's back at its station half an hour after its time ran out.

// bikeGrace: how long after its time a locked bike stays where it was left before going back by itself.
const bikeGrace = 30 * time.Minute

var (
	errBikeNoDock    = errors.New("pas de station Vélo Babi ici")
	errBikeElsewhere = errors.New("la station est dans une autre commune : vas-y d'abord")
	errBikePlan      = errors.New("forfait inconnu")
	errBikeHas       = errors.New("tu as déjà un vélo")
	errBikeNone      = errors.New("aucun vélo à toi en ce moment")
	errBikeEmpty     = errors.New("plus de vélo à cette station : essaie plus tard ou dans une autre commune")
)

// BikeRental is the bike a Sim has: from which station, paid until when (then locked).
type BikeRental struct {
	Dock    string    `json:"dock"`
	Until   time.Time `json:"until"`
	Started time.Time `json:"started"`
	Locked  bool      `json:"locked"`
}

// BikeDockState is a station with the bikes in its racks now.
type BikeDockState struct {
	world.BikeDock
	Free int `json:"free"`
}

// rentalOf: the Sim's bike, nil when none (one whose time ran out over half an hour ago is back at its station).
func rentalOf(ctx context.Context, q pgx.Tx, sim string, now time.Time) (*BikeRental, error) {
	var r BikeRental
	err := q.QueryRow(ctx, `SELECT dock, until, started_at FROM bike_rentals WHERE sim_id = $1 AND until > $2`, sim, now.Add(-bikeGrace)).Scan(&r.Dock, &r.Until, &r.Started)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	r.Locked = !r.Until.After(now)
	return &r, nil
}

// bikePay: the hire's price taken with Waye, a line in the Sim's journal.
func bikePay(s *Sim, p world.BikePlan, what string) (Event, error) {
	if err := needApp(s, "waye"); err != nil {
		return Event{}, err
	}
	if s.Money < p.Price {
		return Event{}, game.ErrNotEnoughMoney
	}
	s.Money -= p.Price
	text := fmt.Sprintf("Waye : %s, %s, %d min (%s).", world.BikeBrand, what, p.Minutes, game.FCFA(p.Price))
	return Event{Kind: "transfer", Text: text, Money: -p.Price, GameTime: s.GameMinutes}, nil
}

// bikeState: GET /sims/{id}/bike, the Sim's bike and the stations with their bikes.
func (h *Handler) bikeState(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	now := time.Now()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	rental, err := rentalOf(ctx, tx, id, now)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	out := []BikeDockState{}
	taken := map[string]int{}
	rows, err := tx.Query(ctx, `SELECT dock, count(*) FROM bike_rentals WHERE until > $1 GROUP BY dock`, now.Add(-bikeGrace))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	for rows.Next() {
		var d string
		var n int
		if rows.Scan(&d, &n) == nil {
			taken[d] = n
		}
	}
	rows.Close()
	for _, d := range world.BikeDocks() {
		out = append(out, BikeDockState{BikeDock: d, Free: max(0, d.Bikes-taken[d.ID])})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"rental": rental, "docks": out, "plans": world.BikePlans, "now": now})
}

// bikeRent: POST /sims/{id}/bike/rent {dock, plan}, a bike taken at the station of the Sim's commune.
func (h *Handler) bikeRent(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Dock string `json:"dock"`
		Plan string `json:"plan"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		ctx := r.Context()
		d, ok := world.FindBikeDock(req.Dock)
		if !ok {
			return game.Outcome{}, nil, errBikeNoDock
		}
		if s.City != d.City || s.Commune != d.Commune {
			return game.Outcome{}, nil, errBikeElsewhere
		}
		p, ok := world.FindBikePlan(req.Plan)
		if !ok {
			return game.Outcome{}, nil, errBikePlan
		}
		now := time.Now()
		if had, err := rentalOf(ctx, tx, s.ID, now); err != nil {
			return game.Outcome{}, nil, err
		} else if had != nil {
			return game.Outcome{}, nil, errBikeHas
		}
		var taken int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM bike_rentals WHERE dock = $1 AND until > $2`, d.ID, now.Add(-bikeGrace)).Scan(&taken); err != nil {
			return game.Outcome{}, nil, err
		}
		if taken >= d.Bikes {
			return game.Outcome{}, nil, errBikeEmpty
		}
		ev, err := bikePay(s, p, "vélo pris")
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO bike_rentals (sim_id, dock, until, started_at) VALUES ($1, $2, $3, $4)
			ON CONFLICT (sim_id) DO UPDATE SET dock = EXCLUDED.dock, until = EXCLUDED.until, started_at = EXCLUDED.started_at`,
			s.ID, d.ID, now.Add(time.Duration(p.Minutes)*time.Minute), now); err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: ev.Text, Money: ev.Money}, []Event{ev}, nil
	})
}

// bikeExtend: POST /sims/{id}/bike/extend {plan}, more time on the bike (paid again with Waye); locked, it unlocks.
func (h *Handler) bikeExtend(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Plan string `json:"plan"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		ctx := r.Context()
		p, ok := world.FindBikePlan(req.Plan)
		if !ok {
			return game.Outcome{}, nil, errBikePlan
		}
		now := time.Now()
		had, err := rentalOf(ctx, tx, s.ID, now)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if had == nil {
			return game.Outcome{}, nil, errBikeNone
		}
		ev, err := bikePay(s, p, "vélo rechargé")
		if err != nil {
			return game.Outcome{}, nil, err
		}
		from := had.Until
		if from.Before(now) {
			from = now
		}
		if _, err := tx.Exec(ctx, `UPDATE bike_rentals SET until = $2 WHERE sim_id = $1`, s.ID, from.Add(time.Duration(p.Minutes)*time.Minute)); err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: ev.Text, Money: ev.Money}, []Event{ev}, nil
	})
}

// bikeReturn: POST /sims/{id}/bike/return, the bike given back (at a station, or left: it goes back by itself).
func (h *Handler) bikeReturn(w http.ResponseWriter, r *http.Request) {
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if _, err := tx.Exec(r.Context(), `DELETE FROM bike_rentals WHERE sim_id = $1`, s.ID); err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: fmt.Sprintf("%s rendu.", world.BikeBrand)}, nil, nil
	})
}
