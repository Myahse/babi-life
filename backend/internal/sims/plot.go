package sims

import (
	"context"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

var errTooYoungToBuild = errors.New("trop petit pour construire : attends d'être ado")

// The Sim's plot: the house the player builds, block by block (game/build.go).
// Others in the commune see it where the Sim lives.

type Plot struct {
	SimID     string       `json:"simId"`
	FirstName string       `json:"firstName,omitempty"`
	Blocks    []game.Block `json:"blocks"`
	Built     int          `json:"built"`
}

func loadPlot(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, simID string, lock bool) (Plot, error) {
	p := Plot{SimID: simID, Blocks: []game.Block{}}
	query := `SELECT blocks, built FROM plots WHERE sim_id = $1`
	if lock {
		query += ` FOR UPDATE`
	}
	err := q.QueryRow(ctx, query, simID).Scan(&p.Blocks, &p.Built)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, nil
	}
	return p, err
}

// plot: GET /sims/{id}/plot — the player's own plot.
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
	httpx.JSON(w, http.StatusOK, p)
}

// build: PUT /sims/{id}/plot — blocks placed and taken down, paid from the Sim's money.
func (h *Handler) build(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Place  []game.Block `json:"place"`
		Remove []game.Block `json:"remove"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if st := s.stage().ID; st == game.StageBebe || st == game.StageEnfant {
			return game.Outcome{}, nil, errTooYoungToBuild
		}
		ctx := r.Context()
		p, err := loadPlot(ctx, tx, s.ID, true)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		blocks, placed, cost, err := game.Edit(p.Blocks, p.Built, req.Place, req.Remove)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if cost > s.Money {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		s.Money -= cost
		if _, err := tx.Exec(ctx, `
			INSERT INTO plots (sim_id, blocks, built, updated_at) VALUES ($1, $2, $3, now())
			ON CONFLICT (sim_id) DO UPDATE SET blocks = $2, built = $3, updated_at = now()`, s.ID, blocks, p.Built+placed); err != nil {
			return game.Outcome{}, nil, err
		}
		text := "Le chantier avance."
		if placed == 0 {
			text = "Démoli : la moitié des matériaux revendue."
		}
		return game.Outcome{Text: text, Money: -cost}, nil, nil
	})
}

// plots: GET /sims/{id}/plots — the houses built by the Sims who live in the
// commune where this Sim is now (the player's own included).
func (h *Handler) plots(w http.ResponseWriter, r *http.Request) {
	_, city, commune, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	rows, err := h.DB.Query(r.Context(), `
		SELECT p.sim_id, s.first_name, p.blocks, p.built FROM plots p JOIN sims s ON s.id = p.sim_id
		WHERE s.home_city = $1 AND s.home_commune = $2 AND jsonb_array_length(p.blocks) > 0
		ORDER BY p.updated_at DESC LIMIT 40`, city, commune)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	out := []Plot{}
	for rows.Next() {
		var p Plot
		if rows.Scan(&p.SimID, &p.FirstName, &p.Blocks, &p.Built) == nil {
			out = append(out, p)
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}
