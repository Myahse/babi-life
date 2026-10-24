package sims

import (
	"context"
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
// buoys off Île Boulay, the shopping list at the supermarket or the boutique,
// the games of the salle de jeux vidéo (foot, the car race, the fighting game,
// the arcade's mosquitoes).
// The challenge where the loser pays is played for its stake (won: the other's
// stake too), the Saturday tournament for its prizes; a made-up score there buys
// a few thousand francs at most, once a game paid for (the tournament once a week).
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
	"foot":    {"console-foot", "console-defi", "tournoi-console"},
	"course":  {"console-course"},
	"combat":  {"console-combat"},
	"arcade":  {"borne-arcade"},
}

// The tournament's prizes: the cup, the final lost (the entry is 1 000).
const (
	tournamentWin   = 4000
	tournamentFinal = 1500
)

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
// interaction: the activity it's played during (the foot's match, challenge or tournament).
func defiReward(kind, interaction string, score, cost int) (game.Needs, int, string) {
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
	case "foot":
		fun := game.Needs{Fun: math.Round(14 * k), Social: math.Round(6 * k)}
		switch interaction {
		case "console-defi":
			// The loser pays: won, the stake back and the other's; level, each keeps his own.
			switch {
			case score > 50:
				return fun, 2 * cost, fmt.Sprintf("Tu gagnes le défi : le gars du quartier te paie %s.", game.FCFA(cost))
			case score == 50:
				return fun, cost, "Match nul : chacun reprend sa mise."
			}
			return fun, 0, "Perdu : c'est toi qui paies. La revanche, c'est quand tu veux."
		case "tournoi-console":
			switch {
			case score >= 100:
				return game.Needs{Fun: 20, Social: 15}, tournamentWin, fmt.Sprintf("Champion du tournoi du samedi ! La coupe et %s.", game.FCFA(tournamentWin))
			case score >= 66:
				return fun, tournamentFinal, fmt.Sprintf("Finaliste du tournoi : %s pour la deuxième place.", game.FCFA(tournamentFinal))
			case score >= 33:
				return fun, 0, "Éliminé·e en demi-finale : pas mal du tout."
			}
			return fun, 0, "Éliminé·e en quart de finale : samedi prochain, ce sera la bonne."
		}
		lines := []string{"Défaite : les gars du quartier rigolent, tu veux ta revanche.", "Un bon match, serré jusqu'au bout.", "Victoire nette : tu es le roi de la manette !"}
		return fun, 0, lines[tier]
	case "course":
		lines := []string{"Le woro-woro t'a coupé la route : deuxième, de loin.", "Une belle course, au coude-à-coude.", "Premier avec de l'avance : tu pilotes comme un chauffeur de gbaka !"}
		return game.Needs{Fun: math.Round(14 * k), Social: math.Round(4 * k)}, 0, lines[tier]
	case "combat":
		lines := []string{"Le Boss d'Adjamé t'a mis K.O. : entraîne-toi.", "Un combat accroché, round après round.", "Le Boss d'Adjamé à terre : la salle crie ton nom !"}
		return game.Needs{Fun: math.Round(14 * k), Social: math.Round(4 * k)}, 0, lines[tier]
	case "arcade":
		lines := []string{"Les moustiques ont gagné cette nuit.", "Pas mal de moustiques au tapis.", "Un massacre de moustiques : ton nom tout en haut de la borne !"}
		return game.Needs{Fun: math.Round(14 * k)}, 0, lines[tier]
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
		text, back, err := playDefi(ctx, tx, s, req.Kind, score)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: text, Money: back}, nil, nil
	})
}

// playDefi: the défi played during the Sim's activity (once): its bonus, the record; the line said and the money back.
func playDefi(ctx context.Context, tx pgx.Tx, s *Sim, kind string, score int) (string, int, error) {
	a := s.Activity
	if a == nil || a.Kind != "do" || defiOf(a.Interaction.ID) != kind {
		return "", 0, errDefiNot
	}
	if a.Defi > 0 {
		return "", 0, errDefiDone
	}
	a.Defi = max(1, score)
	needs, back, text := defiReward(kind, a.Interaction.ID, score, a.Interaction.Cost)
	back = s.withPass(back)
	s.Needs = s.Needs.Add(needs)
	s.Money += back
	var before int
	if err := tx.QueryRow(ctx, `SELECT best FROM defis WHERE sim_id = $1 AND kind = $2`, s.ID, kind).Scan(&before); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", 0, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO defis (sim_id, kind, best, played) VALUES ($1, $2, $3, 1)
		ON CONFLICT (sim_id, kind) DO UPDATE SET best = GREATEST(defis.best, EXCLUDED.best), played = defis.played + 1, updated_at = now()`, s.ID, kind, score); err != nil {
		return "", 0, err
	}
	if score > before && before > 0 {
		text += fmt.Sprintf(" Nouveau record : %d (avant : %d) !", score, before)
	}
	return fmt.Sprintf("Défi %d/100. %s", score, text), back, nil
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
