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

// PlayerSim is one of a player's persos as the admin sees it: its age now, what it did lately, and
// everything it has done since it was made (sim_tally: counted from the update that brought it).
type PlayerSim struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Gender   string    `json:"gender"`
	Age      int       `json:"age"`
	Stage    string    `json:"stage"`
	City     string    `json:"city"`
	Commune  string    `json:"commune"`
	Money    int       `json:"money"`
	Career   string    `json:"career"`
	Level    int       `json:"level"`
	Created  time.Time `json:"created"`
	LastSeen time.Time `json:"lastSeen"`
	Online   bool      `json:"online"`
	// Born: the first line of its journal (« Awa est née à Cocody… »).
	Born string `json:"born"`
	// Doing: what it's doing right now (its activity's label), if anything.
	Doing string `json:"doing"`
	// Lately: the last lines of its journal, the newest first.
	Lately []Entry `json:"lately"`
	// Since: its activities since the start, the most done first; Totals over all of them.
	Since  []Tally `json:"since"`
	Totals Tally   `json:"totals"`
	// Journal: how many lines its journal has had, by kind (the ones still kept).
	Kinds map[string]int `json:"kinds"`
}

// Tally is an activity done since the start: how many times, the game minutes, the money.
type Tally struct {
	ID      string    `json:"id"`
	Label   string    `json:"label"`
	Times   int       `json:"times"`
	Minutes int64     `json:"minutes"`
	Money   int64     `json:"money"`
	First   time.Time `json:"first"`
	Last    time.Time `json:"last"`
}

// players: GET /admin/users/{id}/players — the player's persos: their age now, what they did lately,
// and everything since the start.
func (h *Handler) players(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	rows, err := h.DB.Query(ctx, `SELECT s.id, s.first_name || ' ' || s.last_name, s.gender, s.born_at, s.game_minutes, s.city, s.commune, s.money,
			COALESCE(s.career, ''), COALESCE(s.career_level, 0), s.created_at, s.last_tick, COALESCE(s.activity->'interaction'->>'label', ''),
			COALESCE((SELECT text FROM sim_events e WHERE e.sim_id = s.id ORDER BY e.id LIMIT 1), '')
		FROM sims s WHERE s.user_id = $1 ORDER BY s.created_at`, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	out := []PlayerSim{}
	for rows.Next() {
		var p PlayerSim
		var born, minutes int64
		if err := rows.Scan(&p.ID, &p.Name, &p.Gender, &born, &minutes, &p.City, &p.Commune, &p.Money, &p.Career, &p.Level, &p.Created, &p.LastSeen, &p.Doing, &p.Born); err != nil {
			rows.Close()
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		p.Age = game.AgeAt(born, minutes)
		p.Stage = game.StageOf(p.Age).Label
		p.Online = time.Since(p.LastSeen) < 5*time.Minute
		out = append(out, p)
	}
	rows.Close()
	for i := range out {
		p := &out[i]
		p.Lately, p.Since, p.Kinds = []Entry{}, []Tally{}, map[string]int{}
		if rs, err := h.DB.Query(ctx, `SELECT kind, text, created_at FROM sim_events WHERE sim_id = $1 ORDER BY id DESC LIMIT 60`, p.ID); err == nil {
			for rs.Next() {
				var e Entry
				if rs.Scan(&e.Kind, &e.Text, &e.At) == nil {
					p.Lately = append(p.Lately, e)
				}
			}
			rs.Close()
		}
		if rs, err := h.DB.Query(ctx, `SELECT min(interaction_id), label, sum(times)::int, sum(minutes), sum(money), min(first_at), max(last_at) FROM sim_tally WHERE sim_id = $1 GROUP BY label ORDER BY 3 DESC, 4 DESC`, p.ID); err == nil {
			for rs.Next() {
				var t Tally
				if rs.Scan(&t.ID, &t.Label, &t.Times, &t.Minutes, &t.Money, &t.First, &t.Last) == nil {
					p.Since = append(p.Since, t)
					p.Totals.Times += t.Times
					p.Totals.Minutes += t.Minutes
					p.Totals.Money += t.Money
				}
			}
			rs.Close()
		}
		if rs, err := h.DB.Query(ctx, `SELECT kind, count(*) FROM sim_events WHERE sim_id = $1 GROUP BY kind`, p.ID); err == nil {
			for rs.Next() {
				var k string
				var n int
				if rs.Scan(&k, &n) == nil {
					p.Kinds[k] = n
				}
			}
			rs.Close()
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}
