package sims

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"slices"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Les défis (web components/Defi.tsx): while doing some things, the player can
// take them on as a little game with an action button: the tea made at the
// grin (poured from high for the foam, three glasses), water-skiing round the
// buoys off Île Boulay, the shopping list at the supermarket or the boutique.
// The phone plays it and sends the score (0–100). What it earns is small, a
// bonus on the activity (a better mood, some money saved on the shopping), so
// a score made up buys little. Once each time; the best score of each défi is
// kept, a record to beat.

// defiFor: each défi, and the interactions it's played during.
var defiFor = map[string][]string{
	// The tea one makes oneself, with the boys at the grin (the pousse-pousse's is served: no défi).
	"the":     {"street-grin", "chat-grin"},
	"ski":     {"ski-boulay"},
	"courses": {"supermarche", "courses"},
}

var (
	errDefiKind = errors.New("défi inconnu")
	errDefiNot  = errors.New("ce défi se joue pendant l'activité")
	errDefiDone = errors.New("défi déjà joué cette fois-ci")
)

// defiOf: the défi of an interaction, or "".
func defiOf(interaction string) string {
	for k, ids := range defiFor {
		if slices.Contains(ids, interaction) {
			return k
		}
	}
	return ""
}

// defiReward: what a score earns (the needs, the money back on what was paid) and the line said.
func defiReward(kind string, score, cost int) (game.Needs, int, string) {
	k := float64(score) / 100
	tier := 0
	switch {
	case score >= 85:
		tier = 2
	case score >= 50:
		tier = 1
	}
	switch kind {
	case "the":
		lines := []string{"Ton thé n'a pas de mousse : les gars rigolent, on recommence.", "Ton thé mousse bien : les gars en redemandent.", "Ton thé mousse comme celui des vieux du grin : respect !"}
		return game.Needs{Social: math.Round(12 * k), Fun: math.Round(6 * k), Energy: 3}, 0, lines[tier]
	case "ski":
		lines := []string{"Quelques bouées ratées et un plongeon : la lagune est bonne !", "Belle sortie : les bouées passées, un saut ou deux.", "Slalom parfait et des sauts de champion : le pilote te filme !"}
		return game.Needs{Fun: math.Round(16 * k)}, 0, lines[tier]
	default:
		// Good shopping: the right things, quickly, nothing silly bought: up to a fifth saved.
		back := int(math.Round(float64(cost)*0.2*k/50)) * 50
		lines := []string{"Des oublis et des achats en trop : la liste, c'est la liste.", "Presque toute la liste, sans traîner.", "Toute la liste, vite et bien : tu es fort aux courses !"}
		text := lines[tier]
		if back > 0 {
			text += fmt.Sprintf(" %s économisés.", game.FCFA(back))
		}
		return game.Needs{Hunger: math.Round(5 * k)}, back, text
	}
}

// defi: POST {kind, score}: the défi played during the activity, its bonus, the record.
func (h *Handler) defi(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind  string `json:"kind"`
		Score int    `json:"score"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if _, ok := defiFor[req.Kind]; !ok {
		httpx.Error(w, http.StatusUnprocessableEntity, errDefiKind.Error())
		return
	}
	score := max(0, min(100, req.Score))
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		a := s.Activity
		if a == nil || a.Kind != "do" || defiOf(a.Interaction.ID) != req.Kind {
			return game.Outcome{}, nil, errDefiNot
		}
		if a.Defi > 0 {
			return game.Outcome{}, nil, errDefiDone
		}
		a.Defi = max(1, score)
		needs, back, text := defiReward(req.Kind, score, a.Interaction.Cost)
		s.Needs = s.Needs.Add(needs)
		s.Money += back
		var before int
		if err := tx.QueryRow(ctx, `SELECT best FROM defis WHERE sim_id = $1 AND kind = $2`, s.ID, req.Kind).Scan(&before); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return game.Outcome{}, nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO defis (sim_id, kind, best, played) VALUES ($1, $2, $3, 1)
			ON CONFLICT (sim_id, kind) DO UPDATE SET best = GREATEST(defis.best, EXCLUDED.best), played = defis.played + 1, updated_at = now()`, s.ID, req.Kind, score); err != nil {
			return game.Outcome{}, nil, err
		}
		if score > before && before > 0 {
			text += fmt.Sprintf(" Nouveau record : %d (avant : %d) !", score, before)
		}
		return game.Outcome{Text: fmt.Sprintf("Défi %d/100. %s", score, text), Money: back}, nil, nil
	})
}

// defis: GET: the Sim's best score at each défi (none played: not there).
func (h *Handler) defis(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	rows, err := h.DB.Query(r.Context(), `SELECT kind, best FROM defis WHERE sim_id = $1`, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	best := map[string]int{}
	for rows.Next() {
		var k string
		var b int
		if err := rows.Scan(&k, &b); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		best[k] = b
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"best": best})
}
