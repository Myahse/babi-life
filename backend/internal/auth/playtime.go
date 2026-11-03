package auth

import (
	"net/http"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Playing: POST /me/playing, sent by the game every minute while it's on screen. The time since the
// last ping is added to the account's play time, at most two minutes of it (a ping late by a slow
// network still counts), nothing after more than three (the game was closed in between).
func (h *Handler) Playing(w http.ResponseWriter, r *http.Request) {
	id := UserID(r.Context())
	var secs int64
	err := h.DB.QueryRow(r.Context(), `
		UPDATE users SET
			play_seconds = play_seconds + CASE WHEN play_seen_at > now() - interval '3 minutes'
				THEN LEAST(120, EXTRACT(EPOCH FROM now() - play_seen_at)::bigint) ELSE 0 END,
			-- A new session after half an hour away (the tutorial's funnel, funnel.go).
			play_sessions = play_sessions + CASE WHEN play_seen_at IS NULL OR play_seen_at < now() - interval '30 minutes' THEN 1 ELSE 0 END,
			play_seen_at = now()
		WHERE id = $1 RETURNING play_seconds`, id).Scan(&secs)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]int64{"playSeconds": secs})
}
