// Package live keeps the players of a commune in step: where each Sim is,
// which way it faces and what it's doing, a few times a second, over a
// WebSocket. Everything else in the street is worked out by every phone from
// the shared clock (web/src/lib/worldClock.ts); only real people, who go
// where they like, need to be sent.
//
// The hub lives in this one process's memory: run a single API instance (or
// pin a commune to one) for players to see each other.
package live

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"math"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/auth"
)

const (
	// Tick: how often the players of a room are sent to everyone in it.
	Tick = 150 * time.Millisecond
	// Stale: a player not heard from for this long is no longer shown.
	Stale = 10 * time.Second
	// MaxRoom: players per commune and mode; more simply aren't sent.
	MaxRoom = 60
)

// Poses a player may say it is in (what avatar/Human.tsx can show).
var poses = map[string]bool{"idle": true, "walk": true, "run": true, "busy": true, "talk": true, "sit": true, "dance": true, "wave": true, "cheer": true}

// State is one player's Sim: position (metres, in the commune's frame),
// heading (radians), pose, and when the server heard it (ms).
type State struct {
	ID string  `json:"id"`
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
	Z  float64 `json:"z"`
	H  float64 `json:"h"`
	P  string  `json:"p"`
	At int64   `json:"at"`
}

type client struct {
	sim  string
	room string
	send chan []byte
}

type Hub struct {
	DB      *pgxpool.Pool
	Tokens  auth.Tokens
	Origins []string

	mu     sync.Mutex
	rooms  map[string]map[*client]bool
	states map[string]map[string]State // room → sim → state
}

func NewHub(db *pgxpool.Pool, tokens auth.Tokens, origins []string) *Hub {
	return &Hub{DB: db, Tokens: tokens, Origins: origins, rooms: map[string]map[*client]bool{}, states: map[string]map[string]State{}}
}

// Run sends each room its players, every Tick, until ctx ends.
func (h *Hub) Run(ctx context.Context) {
	t := time.NewTicker(Tick)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			h.broadcast(time.Now())
		}
	}
}

func (h *Hub) broadcast(now time.Time) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for room, clients := range h.rooms {
		players := make([]State, 0, len(h.states[room]))
		for id, s := range h.states[room] {
			if now.UnixMilli()-s.At > Stale.Milliseconds() {
				delete(h.states[room], id)
				continue
			}
			players = append(players, s)
		}
		if len(clients) < 2 || len(players) == 0 {
			continue
		}
		msg, _ := json.Marshal(map[string]any{"t": "states", "now": now.UnixMilli(), "players": players})
		for c := range clients {
			select {
			case c.send <- msg:
			default: // a slow phone misses this one: the next comes 150 ms later
			}
		}
	}
}

func (h *Hub) join(c *client) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if len(h.rooms[c.room]) >= MaxRoom {
		return false
	}
	if h.rooms[c.room] == nil {
		h.rooms[c.room] = map[*client]bool{}
		h.states[c.room] = map[string]State{}
	}
	h.rooms[c.room][c] = true
	return true
}

func (h *Hub) leave(c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.rooms[c.room], c)
	// The same Sim may still be connected from another tab: keep it then.
	for o := range h.rooms[c.room] {
		if o.sim == c.sim {
			return
		}
	}
	delete(h.states[c.room], c.sim)
	msg, _ := json.Marshal(map[string]any{"t": "leave", "id": c.sim})
	for o := range h.rooms[c.room] {
		select {
		case o.send <- msg:
		default:
		}
	}
	if len(h.rooms[c.room]) == 0 {
		delete(h.rooms, c.room)
		delete(h.states, c.room)
	}
}

func (h *Hub) update(c *client, s State) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.states[c.room] != nil {
		h.states[c.room][c.sim] = s
	}
}

// What a phone sends.
type message struct {
	T     string  `json:"t"`
	Token string  `json:"token"` // hello: the session token (not in the URL, which ends up in logs)
	Sim   string  `json:"sim"`   // hello
	Mode  string  `json:"mode"`  // hello: "open" (the real map) or "street"
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Z     float64 `json:"z"`
	H     float64 `json:"h"`
	P     string  `json:"p"`
	C     float64 `json:"c"` // ping: the phone's clock, sent back as is
}

func finite(v ...float64) bool {
	for _, x := range v {
		if math.IsNaN(x) || math.IsInf(x, 0) || math.Abs(x) > 1e6 {
			return false
		}
	}
	return true
}

// ServeHTTP: GET /api/v1/live, upgraded to a WebSocket. The first message
// must be a hello with the session token and the Sim; the room is the
// Sim's commune, as the server has it.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	patterns := make([]string, 0, len(h.Origins))
	for _, o := range h.Origins {
		if u, err := url.Parse(o); err == nil && u.Host != "" {
			patterns = append(patterns, u.Host)
		}
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: patterns})
	if err != nil {
		return
	}
	conn.SetReadLimit(4096)
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	defer conn.CloseNow()

	c, err := h.hello(ctx, conn)
	if err != nil {
		conn.Close(websocket.StatusPolicyViolation, err.Error())
		return
	}
	if !h.join(c) {
		conn.Close(websocket.StatusTryAgainLater, "commune pleine")
		return
	}
	defer h.leave(c)

	// Writer: everything for this phone goes through one goroutine.
	go func() {
		defer cancel()
		for {
			select {
			case <-ctx.Done():
				return
			case msg := <-c.send:
				wctx, done := context.WithTimeout(ctx, 5*time.Second)
				err := conn.Write(wctx, websocket.MessageText, msg)
				done()
				if err != nil {
					return
				}
			}
		}
	}()
	welcome, _ := json.Marshal(map[string]any{"t": "welcome", "now": time.Now().UnixMilli()})
	c.send <- welcome

	last := time.Time{}
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		var m message
		if json.Unmarshal(data, &m) != nil {
			continue
		}
		switch m.T {
		case "ping":
			pong, _ := json.Marshal(map[string]any{"t": "pong", "c": m.C, "s": time.Now().UnixMilli()})
			select {
			case c.send <- pong:
			default:
			}
		case "state":
			// At most 20 a second, sane numbers, a known pose.
			if time.Since(last) < 50*time.Millisecond || !finite(m.X, m.Y, m.Z, m.H) || !poses[m.P] {
				continue
			}
			last = time.Now()
			h.update(c, State{ID: c.sim, X: m.X, Y: m.Y, Z: m.Z, H: m.H, P: m.P, At: last.UnixMilli()})
		}
	}
}

var errHello = errors.New("dis bonjour d'abord")

func (h *Hub) hello(ctx context.Context, conn *websocket.Conn) (*client, error) {
	hctx, done := context.WithTimeout(ctx, 10*time.Second)
	defer done()
	_, data, err := conn.Read(hctx)
	if err != nil {
		return nil, err
	}
	var m message
	if json.Unmarshal(data, &m) != nil || m.T != "hello" {
		return nil, errHello
	}
	user, err := h.Tokens.Parse(m.Token)
	if err != nil {
		return nil, errors.New("session invalide")
	}
	var city, commune string
	if err := h.DB.QueryRow(ctx, `SELECT city, commune FROM sims WHERE id = $1 AND user_id = $2`, m.Sim, user).Scan(&city, &commune); err != nil {
		return nil, errors.New("sim introuvable")
	}
	mode := "street"
	if m.Mode == "open" {
		mode = "open"
	}
	log.Printf("live: %s joins %s/%s (%s)", m.Sim, city, commune, mode)
	return &client{sim: m.Sim, room: city + "|" + commune + "|" + mode, send: make(chan []byte, 16)}, nil
}
