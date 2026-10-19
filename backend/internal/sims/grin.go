package sims

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Le grin, in Gbairai: the public chat, where people sit and talk. One room
// for all of Babi (« Tout Babi ») and one for the commune the Sim is in
// (« Ma commune »). Anyone with a phone and Gbairai can read and write. The
// same rules as the messages (links and numbers masked, 500 characters),
// slower: one message every 5 seconds, 8 a minute. A blocked player's
// messages don't show, either way; a message can be reported (its author is
// blocked for the reporter, the report goes to the moderation, which can hide
// it). Messages older than a week go.

const (
	GrinBurst = 8 // a minute
	GrinGap   = 5 * time.Second
	GrinPage  = 60
)

var (
	errGrinTooFast = errors.New("doucement ! Le grin va vite : attends quelques secondes")
	errNoGrinMsg   = errors.New("message introuvable")
)

// GrinMessage is a message of the grin, as the app gets it.
type GrinMessage struct {
	ID        int64     `json:"id"`
	Sim       string    `json:"sim"`
	FirstName string    `json:"firstName"`
	Gender    string    `json:"gender"`
	Look      Look      `json:"look"`
	Commune   string    `json:"commune"`
	Mine      bool      `json:"mine"`
	Friend    bool      `json:"friend"`
	Body      string    `json:"body"`
	At        time.Time `json:"at"`
}

// grinRoom: « babi », or the commune the Sim is in.
func (h *Handler) grinRoom(r *http.Request, me, room string) (string, error) {
	if room == "babi" || room == "" {
		return "babi", nil
	}
	var commune string
	if err := h.DB.QueryRow(r.Context(), `SELECT commune FROM sims WHERE id = $1`, me).Scan(&commune); err != nil {
		return "", err
	}
	return commune, nil
}

// grin: the room's last messages (or those after ?after=), oldest first.
func (h *Handler) grin(w http.ResponseWriter, r *http.Request) {
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	room, err := h.grinRoom(r, me, r.URL.Query().Get("room"))
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	after, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
	ctx := r.Context()
	_, _ = h.DB.Exec(ctx, `DELETE FROM grin WHERE created_at < now() - interval '7 days'`)
	rows, err := h.DB.Query(ctx, `SELECT * FROM (
		SELECT g.id, g.sim, s.first_name, s.gender, s.look, s.commune, g.body, g.created_at,
			EXISTS(SELECT 1 FROM bonds b WHERE b.sim_a = LEAST(g.sim, $1::uuid) AND b.sim_b = GREATEST(g.sim, $1::uuid) AND b.friends)
		FROM grin g JOIN sims s ON s.id = g.sim
		WHERE g.room = $2 AND g.id > $3 AND NOT g.hidden
			AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $1 AND k.blocked = g.sim) OR (k.sim = g.sim AND k.blocked = $1))
		ORDER BY g.id DESC LIMIT $4) x ORDER BY id`, me, room, after, GrinPage)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	defer rows.Close()
	out := []GrinMessage{}
	for rows.Next() {
		var m GrinMessage
		if err := rows.Scan(&m.ID, &m.Sim, &m.FirstName, &m.Gender, &m.Look, &m.Commune, &m.Body, &m.At, &m.Friend); err != nil {
			h.gbairaiFail(w, err)
			return
		}
		m.Mine = m.Sim == me
		out = append(out, m)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"room": room, "messages": out})
}

// sayGrin: write in the room.
func (h *Handler) sayGrin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Room string `json:"room"`
		Body string `json:"body"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	body, err := cleanMessage(req.Body)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	room, err := h.grinRoom(r, me, req.Room)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	var recent int
	var last *time.Time
	_ = h.DB.QueryRow(ctx, `SELECT count(*), max(created_at) FROM grin WHERE sim = $1 AND created_at > now() - interval '1 minute'`, me).Scan(&recent, &last)
	if recent >= GrinBurst || (last != nil && time.Since(*last) < GrinGap) {
		httpx.Error(w, http.StatusTooManyRequests, errGrinTooFast.Error())
		return
	}
	var id int64
	if err := h.DB.QueryRow(ctx, `INSERT INTO grin (room, sim, body) VALUES ($1, $2, $3) RETURNING id`, room, me, body).Scan(&id); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"id": id, "body": body})
}

// reportGrin: flag a message of the grin; its author is blocked for the reporter.
func (h *Handler) reportGrin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Reason string `json:"reason"`
	}
	if err := httpx.Decode(r, &req); err != nil || !validReason(req.Reason) {
		h.gbairaiFail(w, errNoReason)
		return
	}
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	id, _ := strconv.ParseInt(chi.URLParam(r, "msg"), 10, 64)
	var author, body string
	if err := h.DB.QueryRow(ctx, `SELECT sim, body FROM grin WHERE id = $1`, id).Scan(&author, &body); err != nil || author == me {
		httpx.Error(w, http.StatusNotFound, errNoGrinMsg.Error())
		return
	}
	if _, err := h.DB.Exec(ctx, `INSERT INTO reports (reporter, reported, grin_id, excerpt, reason) VALUES ($1, $2, $3, $4, $5)`, me, author, id, body, req.Reason); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	_, _ = h.DB.Exec(ctx, `INSERT INTO blocks (sim, blocked) VALUES ($1, $2) ON CONFLICT DO NOTHING`, me, author)
	httpx.JSON(w, http.StatusOK, map[string]string{"text": "Merci. C'est signalé : on va regarder. Tu ne verras plus ses messages."})
}
