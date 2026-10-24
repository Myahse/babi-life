// Package ideas is the phone's « Idées » app (web/src/screens/IdeasApp.tsx):
// every player can send Babi Life an idea or a suggestion (an activity, a
// place to add, a bug, anything), see the ones they sent, and read what the
// team answered. The team reads and answers them on /admin (admin.Handler).
package ideas

import (
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Topics: what an idea is about.
var Topics = map[string]bool{"jeu": true, "lieu": true, "bug": true, "autre": true}

// Statuses: where an idea stands: new (just sent), read, kept (the team will
// do it), done, no (not for now).
var Statuses = map[string]bool{"new": true, "read": true, "kept": true, "done": true, "no": true}

const (
	MinLen   = 10
	MaxLen   = 600
	MaxReply = 400
	// Not a flood: this many a day each.
	PerDay = 20
)

type Handler struct {
	DB *pgxpool.Pool
}

// Idea is one as the player sees it.
type Idea struct {
	ID         int64      `json:"id"`
	Topic      string     `json:"topic"`
	Text       string     `json:"text"`
	Status     string     `json:"status"`
	Reply      string     `json:"reply"`
	At         time.Time  `json:"at"`
	AnsweredAt *time.Time `json:"answeredAt,omitempty"`
	// For the team: who sent it.
	User    string `json:"user,omitempty"`
	SimName string `json:"simName,omitempty"`
}

// Routes: the player's side (signed in).
func (h *Handler) Routes(r chi.Router) {
	r.Get("/me/ideas", h.mine)
	r.Post("/me/ideas", h.send)
}

// Admin: the team's side, inside the /admin group (its key checked there).
func (h *Handler) Admin(r chi.Router) {
	r.Get("/ideas", h.list)
	r.Post("/ideas/{idea}", h.answer)
}

// mine: the ideas the player sent, newest first.
func (h *Handler) mine(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `SELECT id, topic, text, status, reply, created_at, answered_at FROM ideas WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, auth.UserID(r.Context()))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	out := []Idea{}
	for rows.Next() {
		var i Idea
		if err := rows.Scan(&i.ID, &i.Topic, &i.Text, &i.Status, &i.Reply, &i.At, &i.AnsweredAt); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		out = append(out, i)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ideas": out})
}

// send: a new idea. {topic, text, simId}.
func (h *Handler) send(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Topic string `json:"topic"`
		Text  string `json:"text"`
		SimID string `json:"simId"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête illisible")
		return
	}
	text := strings.TrimSpace(req.Text)
	if n := utf8.RuneCountInString(text); n < MinLen {
		httpx.Error(w, http.StatusBadRequest, "Dis-en un peu plus : au moins dix lettres.")
		return
	} else if n > MaxLen {
		httpx.Error(w, http.StatusBadRequest, "Trop long : 600 lettres au plus. Envoie une deuxième idée s'il le faut.")
		return
	}
	if !Topics[req.Topic] {
		req.Topic = "autre"
	}
	ctx := r.Context()
	user := auth.UserID(ctx)
	var today int
	if err := h.DB.QueryRow(ctx, `SELECT count(*) FROM ideas WHERE user_id = $1 AND created_at > now() - interval '24 hours'`, user).Scan(&today); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if today >= PerDay {
		httpx.Error(w, http.StatusTooManyRequests, "Tu as déjà envoyé beaucoup d'idées aujourd'hui, merci ! Reviens demain pour les suivantes.")
		return
	}
	// The Sim it comes from, when it's the player's (its name kept: the Sim may go).
	var simID *string
	var simName string
	if req.SimID != "" {
		if err := h.DB.QueryRow(ctx, `SELECT first_name FROM sims WHERE id = $1 AND user_id = $2`, req.SimID, user).Scan(&simName); err == nil {
			simID = &req.SimID
		}
	}
	var i Idea
	if err := h.DB.QueryRow(ctx, `INSERT INTO ideas (user_id, sim_id, sim_name, topic, text) VALUES ($1, $2, $3, $4, $5) RETURNING id, topic, text, status, reply, created_at, answered_at`, user, simID, simName, req.Topic, text).
		Scan(&i.ID, &i.Topic, &i.Text, &i.Status, &i.Reply, &i.At, &i.AnsweredAt); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"idea": i, "text": "Merci ! Ton idée est partie chez Babi Life. Tu verras ici ce qu'on en fait."})
}

// list: for the team. ?status=new|read|kept|done|no|open (the default: not done, not refused) |all.
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	var where string
	switch {
	case status == "all":
		where = "TRUE"
	case Statuses[status]:
		where = "i.status = '" + status + "'"
	default:
		where = "i.status IN ('new', 'read', 'kept')"
	}
	rows, err := h.DB.Query(r.Context(), `SELECT i.id, i.topic, i.text, i.status, i.reply, i.created_at, i.answered_at, u.name, i.sim_name
		FROM ideas i JOIN users u ON u.id = i.user_id WHERE `+where+` ORDER BY i.created_at DESC LIMIT 300`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	out := []Idea{}
	for rows.Next() {
		var i Idea
		if err := rows.Scan(&i.ID, &i.Topic, &i.Text, &i.Status, &i.Reply, &i.At, &i.AnsweredAt, &i.User, &i.SimName); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		out = append(out, i)
	}
	httpx.JSON(w, http.StatusOK, out)
}

// answer: the team moves an idea on ({status}) and/or answers it ({reply}).
func (h *Handler) answer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Status string  `json:"status"`
		Reply  *string `json:"reply"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête illisible")
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "idea"), 10, 64)
	if req.Status != "" && !Statuses[req.Status] {
		httpx.Error(w, http.StatusBadRequest, "statut inconnu")
		return
	}
	reply := ""
	if req.Reply != nil {
		reply = strings.TrimSpace(*req.Reply)
		if utf8.RuneCountInString(reply) > MaxReply {
			httpx.Error(w, http.StatusBadRequest, "réponse trop longue (400 lettres)")
			return
		}
	}
	// A reply, or a step on from « new »: answered now (the player sees it's been looked at).
	var i Idea
	if err := h.DB.QueryRow(r.Context(), `UPDATE ideas SET
			status = CASE WHEN $2 <> '' THEN $2 WHEN status = 'new' AND $3 THEN 'read' ELSE status END,
			reply = CASE WHEN $3 THEN $4 ELSE reply END,
			answered_at = CASE WHEN $3 OR ($2 <> '' AND $2 <> 'new') THEN now() ELSE answered_at END
		WHERE id = $1 RETURNING id, topic, text, status, reply, created_at, answered_at, sim_name`, id, req.Status, req.Reply != nil, reply).
		Scan(&i.ID, &i.Topic, &i.Text, &i.Status, &i.Reply, &i.At, &i.AnsweredAt, &i.SimName); err != nil {
		httpx.Error(w, http.StatusNotFound, "idée introuvable")
		return
	}
	httpx.JSON(w, http.StatusOK, i)
}
