package admin

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// growOne: POST /admin/users/{id}/grow {stage}: this player's persos grow to that age (enfant, ado,
// adulte: 18 ans) on their next turn, as growAll does for everyone. Never younger.
func (h *Handler) growOne(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Stage string `json:"stage"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	st := game.StageByID(req.Stage)
	if st.ID != req.Stage || st.ID == game.StageBebe {
		httpx.Error(w, http.StatusUnprocessableEntity, "âge inconnu")
		return
	}
	id := chi.URLParam(r, "id")
	var name string
	_ = h.DB.QueryRow(r.Context(), `SELECT name FROM users WHERE id = $1`, id).Scan(&name)
	tag, err := h.DB.Exec(r.Context(), `UPDATE sims SET grow_to = $2 WHERE user_id = $1 AND born_at <> 0`, id, st.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	n := int(tag.RowsAffected())
	if n == 0 {
		httpx.Error(w, http.StatusNotFound, "ce joueur n'a pas de perso né")
		return
	}
	h.Log(r.Context(), "Un joueur grandit", name+" · "+st.Label)
	httpx.JSON(w, http.StatusOK, map[string]int{"sims": n})
}

// Chat is one of a player's Gbairai conversations, with whom, how many messages, the last one.
type Chat struct {
	Sim      string    `json:"sim"`
	SimName  string    `json:"simName"`
	With     string    `json:"with"`
	WithName string    `json:"withName"`
	WithUser string    `json:"withUser"`
	Messages int       `json:"messages"`
	Last     string    `json:"last"`
	LastAt   time.Time `json:"lastAt"`
	Reported bool      `json:"reported"`
}

// gbairaiChats: GET /admin/users/{id}/gbairai: the player's conversations (each of their Sims with each
// friend), newest first. Reading players' messages is for moderation and safety: each look is logged.
func (h *Handler) gbairaiChats(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := h.DB.Query(r.Context(), `
		WITH mine AS (SELECT id FROM sims WHERE user_id = $1),
		pairs AS (
			SELECT CASE WHEN m.from_sim IN (SELECT id FROM mine) THEN m.from_sim ELSE m.to_sim END AS sim,
				CASE WHEN m.from_sim IN (SELECT id FROM mine) THEN m.to_sim ELSE m.from_sim END AS other,
				m.id, m.body, m.created_at
			FROM messages m WHERE m.from_sim IN (SELECT id FROM mine) OR m.to_sim IN (SELECT id FROM mine)
		)
		SELECT p.sim, s.first_name || ' ' || s.last_name, p.other, o.first_name || ' ' || o.last_name, COALESCE(ou.name, ''),
			count(*), (array_agg(p.body ORDER BY p.id DESC))[1], max(p.created_at),
			EXISTS (SELECT 1 FROM reports rp WHERE (rp.reporter = p.sim AND rp.reported = p.other) OR (rp.reporter = p.other AND rp.reported = p.sim))
		FROM pairs p JOIN sims s ON s.id = p.sim JOIN sims o ON o.id = p.other LEFT JOIN users ou ON ou.id = o.user_id
		GROUP BY p.sim, s.first_name, s.last_name, p.other, o.first_name, o.last_name, ou.name
		ORDER BY max(p.created_at) DESC LIMIT 200`, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	out := []Chat{}
	for rows.Next() {
		var c Chat
		if err := rows.Scan(&c.Sim, &c.SimName, &c.With, &c.WithName, &c.WithUser, &c.Messages, &c.Last, &c.LastAt, &c.Reported); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		out = append(out, c)
	}
	var name string
	_ = h.DB.QueryRow(r.Context(), `SELECT name FROM users WHERE id = $1`, id).Scan(&name)
	h.Log(r.Context(), "Gbairai consulté", name+" · "+strconv.Itoa(len(out))+" discussions")
	httpx.JSON(w, http.StatusOK, map[string]any{"chats": out})
}

// Line is one Gbairai message as the admin reads it.
type Line struct {
	ID     int64     `json:"id"`
	From   string    `json:"from"`
	Name   string    `json:"name"`
	Body   string    `json:"body"`
	At     time.Time `json:"at"`
	Read   bool      `json:"read"`
	Report string    `json:"report,omitempty"`
}

// gbairaiThread: GET /admin/gbairai/{a}/{b}?before=: the messages between two Sims, 100 at a time,
// oldest first in the page (before: an id, for the page before). Logged as each look is.
func (h *Handler) gbairaiThread(w http.ResponseWriter, r *http.Request) {
	a, b := chi.URLParam(r, "a"), chi.URLParam(r, "b")
	before, _ := strconv.ParseInt(r.URL.Query().Get("before"), 10, 64)
	if before <= 0 {
		before = 1 << 62
	}
	rows, err := h.DB.Query(r.Context(), `
		SELECT * FROM (
			SELECT m.id, m.from_sim, s.first_name || ' ' || s.last_name, m.body, m.created_at, m.read_at IS NOT NULL,
				COALESCE((SELECT rp.reason FROM reports rp WHERE rp.message_id = m.id LIMIT 1), '')
			FROM messages m JOIN sims s ON s.id = m.from_sim
			WHERE LEAST(m.from_sim, m.to_sim) = LEAST($1::uuid, $2::uuid) AND GREATEST(m.from_sim, m.to_sim) = GREATEST($1::uuid, $2::uuid) AND m.id < $3
			ORDER BY m.id DESC LIMIT 100
		) t ORDER BY id`, a, b, before)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	out := []Line{}
	for rows.Next() {
		var l Line
		if err := rows.Scan(&l.ID, &l.From, &l.Name, &l.Body, &l.At, &l.Read, &l.Report); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		out = append(out, l)
	}
	var who string
	_ = h.DB.QueryRow(r.Context(), `SELECT (SELECT first_name FROM sims WHERE id = $1) || ' et ' || (SELECT first_name FROM sims WHERE id = $2)`, a, b).Scan(&who)
	h.Log(r.Context(), "Gbairai lu", who)
	httpx.JSON(w, http.StatusOK, map[string]any{"messages": out})
}
