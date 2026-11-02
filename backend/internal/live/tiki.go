package live

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Tikitoko Live (web screens/TikiLive.tsx): a player goes live from the Tikitoko app and the others
// come and watch: the streamer's Sim as it is right now (what it does, where), the streamer's voice,
// the comments, the hearts. The voice is the streamer's phone's microphone, coded small (Opus, a voice
// call's rate) and sent over this same WebSocket to the server, which hands each packet on to every
// viewer of the live: no video, no media server. A live is a room of its own, "tiki:<the streamer's
// Sim>": the streamer's phone opens a second connection to it (mode "tikilive", host) beside its
// street one, the viewers theirs (mode "tikilive"). Kept in memory, like the rooms: a live ends when
// its streamer stops it, or when the streamer's connection to it has been gone a minute.

// TikiMax: viewers in one live (more are told it's full).
const TikiMax = 120

// TikiLive is one live, as the list shows it.
type TikiLive struct {
	ID      string          `json:"id"` // the streamer's Sim
	Name    string          `json:"name"`
	Title   string          `json:"title"`
	Gender  string          `json:"gender"`
	Look    json.RawMessage `json:"look"`
	Stage   string          `json:"stage"`
	Commune string          `json:"commune"`
	Started int64           `json:"started"`
	Viewers int             `json:"viewers"`
	Hearts  int             `json:"hearts"`
	// Doing: what the Sim is doing now and where, as its streamer's phone says it (a few words).
	Doing string `json:"doing"`
	// Mic: the streamer speaking (its microphone open).
	Mic bool `json:"mic"`
	// gone: when the streamer's connection to the live went (ms; 0 while it's there).
	gone int64
}

// TikiGone: how long a live waits for its streamer to come back before it ends.
const TikiGone = time.Minute

func tikiRoom(id string) string { return "tiki:" + id }

func isTiki(room string) bool { return strings.HasPrefix(room, "tiki:") }

// TikiOpen: whether the update is open (set by cmd/api from the features; nil: open).
var TikiOpen func(ctx context.Context) bool

// tikiStart: POST /sims/{id}/tikilive {title, stage} — go live.
func (h *Hub) TikiStart(w http.ResponseWriter, r *http.Request) {
	if TikiOpen != nil && !TikiOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, "les lives Tikitoko arrivent bientôt")
		return
	}
	var req struct {
		Title string `json:"title"`
		Stage string `json:"stage"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	sim := chi.URLParam(r, "id")
	var name, gender, commune string
	var look json.RawMessage
	if err := h.DB.QueryRow(r.Context(), `SELECT first_name, gender, look, commune FROM sims WHERE id = $1 AND user_id = $2`, sim, auth.UserID(r.Context())).Scan(&name, &gender, &look, &commune); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	title := clean(req.Title, 60)
	if title == "" {
		title = name + " en live"
	}
	stage := req.Stage
	if stage != "enfant" && stage != "ado" && stage != "bebe" {
		stage = "adulte"
	}
	h.mu.Lock()
	if h.lives == nil {
		h.lives = map[string]*TikiLive{}
	}
	l := h.lives[sim]
	if l == nil {
		l = &TikiLive{ID: sim, Started: time.Now().UnixMilli()}
		h.lives[sim] = l
	}
	l.Name, l.Title, l.Gender, l.Look, l.Stage, l.Commune, l.gone = name, title, gender, look, stage, commune, 0
	out := *l
	h.mu.Unlock()
	httpx.JSON(w, http.StatusOK, out)
}

// TikiStop: DELETE /sims/{id}/tikilive — the live is over; its viewers are told.
func (h *Hub) TikiStop(w http.ResponseWriter, r *http.Request) {
	sim := chi.URLParam(r, "id")
	var one int
	if err := h.DB.QueryRow(r.Context(), `SELECT 1 FROM sims WHERE id = $1 AND user_id = $2`, sim, auth.UserID(r.Context())).Scan(&one); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	h.mu.Lock()
	h.endLive(sim)
	h.mu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

// endLive: the live is gone; everyone in it is told (h.mu held).
func (h *Hub) endLive(sim string) {
	delete(h.lives, sim)
	msg, _ := json.Marshal(map[string]any{"t": "tikiend", "id": sim})
	for c := range h.rooms[tikiRoom(sim)] {
		select {
		case c.send <- msg:
		default:
		}
	}
}

// TikiList: GET /tikilive — the lives now, the most watched first.
func (h *Hub) TikiList(w http.ResponseWriter, r *http.Request) {
	h.mu.Lock()
	now := time.Now().UnixMilli()
	out := []TikiLive{}
	for id, l := range h.lives {
		if l.gone > 0 && now-l.gone > TikiGone.Milliseconds() {
			h.endLive(id)
			continue
		}
		v := *l
		v.Viewers = h.viewers(id)
		out = append(out, v)
	}
	h.mu.Unlock()
	sort.Slice(out, func(i, j int) bool {
		if out[i].Viewers != out[j].Viewers {
			return out[i].Viewers > out[j].Viewers
		}
		return out[i].Started > out[j].Started
	})
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, out)
}

// viewers: how many are watching (not counting the streamer) (h.mu held).
func (h *Hub) viewers(id string) int {
	n := 0
	for c := range h.rooms[tikiRoom(id)] {
		if c.sim != id {
			n++
		}
	}
	return n
}

var errNoLive = errors.New("ce live est terminé")

// tikiClient: a connection to a live (the hello's mode "tikilive", race = the streamer's Sim).
func (h *Hub) tikiClient(m message, sid, name string) (*client, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	l := h.lives[m.Race]
	if l == nil {
		return nil, errNoLive
	}
	if m.Sim != m.Race && h.viewers(m.Race) >= TikiMax {
		return nil, errors.New("ce live est plein")
	}
	if m.Sim == m.Race {
		l.gone = 0
	}
	return &client{sim: m.Sim, name: name, room: tikiRoom(m.Race), send: make(chan []byte, 64), sid: sid}, nil
}

// tikiLeft: a connection to a live closed; the streamer's: the live waits for it a minute (h.mu held).
func (h *Hub) tikiLeft(c *client) {
	id := strings.TrimPrefix(c.room, "tiki:")
	if l := h.lives[id]; l != nil && c.sim == id {
		l.gone = time.Now().UnixMilli()
		l.Mic = false
	}
}

// tikiSay: a comment, a heart, what the Sim does now: to everyone in the live.
func (h *Hub) tikiSend(room string, v map[string]any) {
	msg, _ := json.Marshal(v)
	for o := range h.rooms[room] {
		select {
		case o.send <- msg:
		default:
		}
	}
}

// tikiVoice: a packet of the streamer's voice, to the viewers (binary: a 0 first, then the bytes).
func (h *Hub) tikiVoice(from *client, data []byte) {
	msg := append([]byte{0}, data...)
	h.mu.Lock()
	defer h.mu.Unlock()
	for o := range h.rooms[from.room] {
		if o == from {
			continue
		}
		select {
		case o.send <- msg:
		default:
			// A slow phone misses a packet rather than holding the others up.
		}
	}
}

// tikiText: what a phone in a live says (a comment, a heart, the streamer's doing and mic).
func (h *Hub) tikiText(c *client, m message, last, lastHeart *time.Time) {
	id := strings.TrimPrefix(c.room, "tiki:")
	host := c.sim == id
	h.mu.Lock()
	defer h.mu.Unlock()
	l := h.lives[id]
	if l == nil {
		return
	}
	switch m.T {
	case "say":
		s := clean(m.S, 120)
		if s == "" || time.Since(*last) < 900*time.Millisecond {
			return
		}
		*last = time.Now()
		h.tikiSend(c.room, map[string]any{"t": "say", "id": c.sim, "n": c.name, "s": s, "host": host})
	case "heart":
		if time.Since(*lastHeart) < 150*time.Millisecond {
			return
		}
		*lastHeart = time.Now()
		l.Hearts++
		h.tikiSend(c.room, map[string]any{"t": "heart", "id": c.sim, "hearts": l.Hearts})
	case "doing":
		if !host {
			return
		}
		l.Doing = clean(m.S, 80)
		l.Mic = m.Mic
		// Its pose as the viewers' phones can draw it (a name of letters and dashes, short), else standing.
		p := m.P
		if len(p) > 24 || strings.Trim(p, "abcdefghijklmnopqrstuvwxyz-") != "" {
			p = "idle"
		}
		h.tikiSend(c.room, map[string]any{"t": "doing", "s": l.Doing, "p": p, "mic": l.Mic, "viewers": h.viewers(id), "hearts": l.Hearts})
	}
}

// clean: a line of text from a player: no control characters, trimmed, at most n characters.
func clean(s string, n int) string {
	s = strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return ' '
		}
		return r
	}, s)
	s = strings.TrimSpace(s)
	if utf8.RuneCountInString(s) > n {
		s = string([]rune(s)[:n])
	}
	return s
}
