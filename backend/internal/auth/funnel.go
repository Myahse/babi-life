package auth

import (
	"context"
	"net/http"
	"regexp"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The tutorial's funnel (migration 113): where new players drop off. The game says when the tutorial
// starts and when it's finished or skipped (POST /me/funnel); the server notes the first activity
// finished after it (sims), and counts the sessions (Playing); the admin reads it with the days played
// (admin/retention.go funnel).

// FunnelSteps: the steps the game itself may say. With the admin's « Nouveaux joueurs » (admin/nouveaux.go,
// migration 125): in the 3D street at last (rue), the Sim walked or did something there (bouge).
var FunnelSteps = map[string]bool{"tuto_start": true, "tuto_done": true, "tuto_skip": true, "rue": true, "bouge": true}

// Funnel: POST /me/funnel {step}: a step passed, kept once (the first time).
func (h *Handler) Funnel(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Step string `json:"step"`
	}
	if err := httpx.Decode(r, &req); err != nil || !FunnelSteps[req.Step] {
		httpx.Error(w, http.StatusBadRequest, "étape inconnue")
		return
	}
	ctx := r.Context()
	id := UserID(ctx)
	// Finished or skipped: one or the other, the first said.
	if req.Step == "tuto_done" || req.Step == "tuto_skip" {
		var ended bool
		_ = h.DB.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM user_funnel WHERE user_id = $1 AND step IN ('tuto_done', 'tuto_skip'))`, id).Scan(&ended)
		if ended {
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}
	if _, err := h.DB.Exec(ctx, `INSERT INTO user_funnel (user_id, step) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, req.Step); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// FunnelActivity: an activity finished: the first after the tutorial (finished or skipped), noted.
func FunnelActivity(ctx context.Context, tx pgx.Tx, userID string) error {
	_, err := tx.Exec(ctx, `INSERT INTO user_funnel (user_id, step)
		SELECT $1, 'first_activity' WHERE EXISTS (SELECT 1 FROM user_funnel WHERE user_id = $1 AND step IN ('tuto_done', 'tuto_skip'))
		ON CONFLICT DO NOTHING`, userID)
	return err
}

// screenName: what the game may call a screen (« rue », « tel:gbairai », « defi:awale »…), nothing else.
var screenName = regexp.MustCompile(`^[a-z0-9][a-z0-9:_.-]{0,47}$`)

// Screen: POST /me/screen {screen}: the screen a new account is on (migration 125), kept in its first two
// days only, the last one replacing the one before: where the ones who never came back left the game.
func (h *Handler) Screen(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Screen string `json:"screen"`
	}
	if err := httpx.Decode(r, &req); err != nil || !screenName.MatchString(req.Screen) {
		httpx.Error(w, http.StatusBadRequest, "écran inconnu")
		return
	}
	ctx := r.Context()
	if _, err := h.DB.Exec(ctx, `INSERT INTO user_last_screen (user_id, screen)
		SELECT id, $2 FROM users WHERE id = $1 AND created_at > now() - interval '2 days'
		ON CONFLICT (user_id) DO UPDATE SET screen = EXCLUDED.screen, at = now()`, UserID(ctx), req.Screen); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
