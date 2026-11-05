package auth

import (
	"net/http"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// NewsSeen: the « NOUVEAU » cards (the admin's opened updates) this account has already seen.
func (h *Handler) NewsSeen(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := h.DB.Query(ctx, `SELECT feature_id FROM user_news_seen WHERE user_id = $1`, UserID(ctx))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	seen := []string{}
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			seen = append(seen, id)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"seen": seen})
}

// MarkNewsSeen: cards seen (one, or all of them at once with « Passer »), kept with the account.
func (h *Handler) MarkNewsSeen(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := httpx.Decode(r, &req); err != nil || len(req.IDs) == 0 || len(req.IDs) > 200 {
		httpx.Error(w, http.StatusBadRequest, "liste invalide")
		return
	}
	ids := make([]string, 0, len(req.IDs))
	for _, id := range req.IDs {
		if id != "" && len(id) <= 64 {
			ids = append(ids, id)
		}
	}
	ctx := r.Context()
	if _, err := h.DB.Exec(ctx, `INSERT INTO user_news_seen (user_id, feature_id) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`, UserID(ctx), ids); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
