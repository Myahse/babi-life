package admin

import (
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// postInfo: POST /admin/infos {body, emoji}: the team's own news in Gbairai's « Babi Infos », the
// read-only group where Babi Direct tells what happens in the game. Players read and react; nobody
// writes there but the game and the team.
func (h *Handler) postInfo(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Body  string `json:"body"`
		Emoji string `json:"emoji"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	body := strings.TrimSpace(req.Body)
	if body == "" || utf8.RuneCountInString(body) > 500 {
		httpx.Error(w, http.StatusUnprocessableEntity, "le message doit faire de 1 à 500 caractères")
		return
	}
	emoji := strings.TrimSpace(req.Emoji)
	if emoji == "" || utf8.RuneCountInString(emoji) > 4 {
		emoji = "📢"
	}
	key := "annonce-" + strconv.FormatInt(time.Now().UnixNano(), 10)
	var id int64
	if err := h.DB.QueryRow(r.Context(), `INSERT INTO babi_direct (key, kind, emoji, body) VALUES ($1, 'annonce', $2, $3) RETURNING id`, key, emoji, body).Scan(&id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	h.Log(r.Context(), "Babi Infos", body)
	httpx.JSON(w, http.StatusOK, map[string]int64{"id": id})
}
