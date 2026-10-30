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
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"log"
	"math"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/court"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/i18n"
	"github.com/myahse/babi-life/backend/internal/kart"
)

const (
	// Tick: how often the players of a room are sent to everyone in it
	// (twice as often in a kart race: KartTick).
	Tick     = 150 * time.Millisecond
	KartTick = 75 * time.Millisecond
	// Stale: a player not heard from for this long is no longer shown.
	Stale = 10 * time.Second
	// MaxRoom: players per commune and mode; more simply aren't sent. Each
	// tick only sends the states heard since the last one, and the far ones
	// only now and then (see broadcast), so a full room costs about what its
	// moving players send to those around them, not its square.
	MaxRoom = 300
	// Near: in the streets, the players this close (metres) are sent every
	// Tick, the closest MaxNear of them in a crowd; the others, too small or
	// too hidden to see move, every FarEvery, which keeps them inside Stale.
	Near     = 80.0
	MaxNear  = 50
	FarEvery = 2 * time.Second
)

// Poses a player may say it is in (what avatar/Human.tsx can show).
var poses = map[string]bool{"idle": true, "walk": true, "run": true, "busy": true, "talk": true, "sit": true, "dance": true, "wave": true, "cheer": true, "kart": true, "sitground": true, "lean": true}

// The postures, an update (features: postures): while it's closed, the others see the Sim standing.
var postures = map[string]bool{"sitground": true, "lean": true}

// And the emotes (game/emotes.go): the others see the Sim play them.
func init() {
	for _, e := range game.Emotes {
		poses[e.ID] = true
	}
}

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
	// At Babi Karting: the kart (speed, steering, drift, boost, spin, how far round, finish…),
	// and from the first player on the grid, the quarter's drivers it drives.
	K []float64   `json:"k,omitempty"`
	B [][]float64 `json:"b,omitempty"`
}

type client struct {
	sim  string
	room string
	send chan []byte
	// farSent: when this phone was last sent the far players of its street (ms).
	farSent int64
	// The session (the device) it was opened from, and how to close it when that device is signed out.
	sid  string
	kick context.CancelFunc
	// lang: the language the phone plays in (its hello's), "en" only while English is open:
	// what the server says over the socket is said in it.
	lang string
}

type Hub struct {
	DB *pgxpool.Pool
	// Karts: who races on which grid at Babi Karting (the "kart" rooms).
	Karts *kart.Lobby
	// Courts: who plays in which match at the pitches and courts (the "match" rooms).
	Courts *court.Lobby
	// Duels: who fights whom, player against player (the "fight" rooms, sims/duel.go).
	Duels interface{ Has(duel, sim string) bool }
	// Pvp: who plays whom at the games against real players (the "pvp" rooms, sims/pvp.go).
	Pvp     interface{ Has(match, sim string) bool }
	Tokens  auth.Tokens
	Origins []string

	mu     sync.Mutex
	rooms  map[string]map[*client]bool
	states map[string]map[string]State // room → sim → state
	// sent: when each street room was last sent (ms), to send only what's new since.
	sent map[string]int64
}

// Online: how many Sims are connected right now, in any room (the game open on a screen).
func (h *Hub) Online() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	seen := map[string]bool{}
	for _, clients := range h.rooms {
		for c := range clients {
			seen[c.sim] = true
		}
	}
	return len(seen)
}

// Connected: whether that Sim has the game open on a screen right now.
func (h *Hub) Connected(sim string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, clients := range h.rooms {
		for c := range clients {
			if c.sim == sim {
				return true
			}
		}
	}
	return false
}

func NewHub(db *pgxpool.Pool, tokens auth.Tokens, origins []string) *Hub {
	return &Hub{DB: db, Tokens: tokens, Origins: origins, rooms: map[string]map[*client]bool{}, states: map[string]map[string]State{}, sent: map[string]int64{}}
}

// Run sends each room its players, every Tick, until ctx ends.
func (h *Hub) Run(ctx context.Context) {
	t := time.NewTicker(KartTick)
	defer t.Stop()
	n := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			n++
			h.broadcast(time.Now(), n%2 == 0)
		}
	}
}

func isKart(room string) bool { return strings.HasPrefix(room, "kart:") }

// isMatch: a football or basketball match at a court, run by its first player
// (streetball/online.ts): sent as fast as a race, everything each time.
func isMatch(room string) bool { return strings.HasPrefix(room, "match:") }

// isFight: two players' street fight (sims/duel.go), run by the one who
// challenged (web components/defi/combat/net.ts): as fast as a match.
func isFight(room string) bool { return strings.HasPrefix(room, "fight:") }

// isPvp: a game between real players (sims/pvp.go: the console's foot, the
// race, the fight, the arcade…), run by its first player (web components/pvp): as fast as a match.
func isPvp(room string) bool { return strings.HasPrefix(room, "pvp:") }

// isFast: the rooms sent every KartTick, whole.
func isFast(room string) bool { return isKart(room) || isMatch(room) || isFight(room) || isPvp(room) }

// broadcast: the kart rooms every KartTick, the streets every other one (Tick).
func (h *Hub) broadcast(now time.Time, streets bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for room, clients := range h.rooms {
		if !streets && !isFast(room) {
			continue
		}
		// In the streets, only the states heard since the last send: a player
		// standing still says so once a second, and the phones keep the last
		// one they had (web/src/lib/live.ts). A kart race sends them all, its
		// grid driven by the first player's states.
		since := h.sent[room]
		if isFast(room) {
			since = 0
		}
		ms := now.UnixMilli()
		for id, s := range h.states[room] {
			if ms-s.At > Stale.Milliseconds() {
				delete(h.states[room], id)
			}
		}
		h.sent[room] = ms
		if len(clients) < 2 || len(h.states[room]) == 0 {
			continue
		}
		if isFast(room) {
			players := make([]State, 0, len(h.states[room]))
			for _, s := range h.states[room] {
				players = append(players, s)
			}
			msg, _ := json.Marshal(map[string]any{"t": "states", "now": ms, "players": players})
			for c := range clients {
				select {
				case c.send <- msg:
				default: // a slow phone misses this one: the next comes 75 ms later
				}
			}
			continue
		}
		// The streets: each phone its own list, the new states of those near
		// it, and every FarEvery the far ones' (all heard since it last had
		// them). Each state is written out once for all of them.
		type one struct {
			s    State
			enc  []byte
			d    float64 // squared, from the phone being served
			near bool
		}
		all := make([]one, 0, len(h.states[room]))
		for _, s := range h.states[room] {
			enc, _ := json.Marshal(s)
			all = append(all, one{s: s, enc: enc})
		}
		head := `{"t":"states","now":` + strconv.FormatInt(ms, 10) + `,"players":[`
		nearest := make([]int, 0, len(all))
		for c := range clients {
			me, placed := h.states[room][c.sim]
			far := ms-c.farSent >= FarEvery.Milliseconds()
			nearest = nearest[:0]
			for i := range all {
				o := &all[i]
				o.d = (o.s.X-me.X)*(o.s.X-me.X) + (o.s.Z-me.Z)*(o.s.Z-me.Z)
				o.near = !placed
				if placed && o.s.ID != c.sim && o.d <= Near*Near {
					nearest = append(nearest, i)
				}
			}
			// A crowd: only the closest MaxNear are near.
			if len(nearest) > MaxNear {
				slices.SortFunc(nearest, func(a, b int) int { return cmp.Compare(all[a].d, all[b].d) })
				nearest = nearest[:MaxNear]
			}
			for _, i := range nearest {
				all[i].near = true
			}
			var b []byte
			for i := range all {
				o := &all[i]
				if o.s.ID == c.sim || o.near && o.s.At <= since || !o.near && (!far || o.s.At <= c.farSent) {
					continue
				}
				if b == nil {
					b = append(b, head...)
				} else {
					b = append(b, ',')
				}
				b = append(b, o.enc...)
			}
			if far {
				c.farSent = ms
			}
			if b == nil {
				continue
			}
			b = append(b, "]}"...)
			select {
			case c.send <- b:
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
		delete(h.sent, c.room)
	}
}

// Changed: something about the Sim changed (an action started or stopped,
// money, a bet, a message…). Every device it's open on hears it and loads it
// again: the same account on a phone and a computer stays the same.
func (h *Hub) Changed(sims ...string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, sim := range sims {
		if sim == "" {
			continue
		}
		msg, _ := json.Marshal(map[string]any{"t": "sim", "id": sim})
		for _, clients := range h.rooms {
			for c := range clients {
				if c.sim != sim {
					continue
				}
				select {
				case c.send <- msg:
				default:
				}
			}
		}
	}
}

// Message: a Gbairai message for this Sim, from that one: every device it's
// open on hears it at once (the ring, the phone button that shakes). ours:
// the text is the game's words (« a envoyé un sticker »), said in each
// device's language; else a player's own, as written.
func (h *Hub) Message(to, from, name, text string, ours bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	said := map[string][]byte{}
	for _, clients := range h.rooms {
		for c := range clients {
			if c.sim != to {
				continue
			}
			lang := "fr"
			if ours {
				lang = c.lang
			}
			msg, ok := said[lang]
			if !ok {
				msg, _ = json.Marshal(map[string]any{"t": "msg", "id": to, "from": from, "name": name, "text": i18n.In(lang, text)})
				said[lang] = msg
			}
			select {
			case c.send <- msg:
			default:
			}
		}
	}
}

// Notify: something for this Sim's devices at once (a challenge to a fight, its answer: sims/duel.go).
func (h *Hub) Notify(to string, v map[string]any) {
	msg, _ := json.Marshal(v)
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, clients := range h.rooms {
		for c := range clients {
			if c.sim != to {
				continue
			}
			select {
			case c.send <- msg:
			default:
			}
		}
	}
}

// Kick: these sessions were signed out (auth.Sessions): their live connections close now.
func (h *Hub) Kick(sids ...string) {
	gone := map[string]bool{}
	for _, s := range sids {
		gone[s] = true
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, clients := range h.rooms {
		for c := range clients {
			if c.sid != "" && gone[c.sid] && c.kick != nil {
				c.kick()
			}
		}
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
	T     string          `json:"t"`
	Token string          `json:"token"` // hello: the session token (not in the URL, which ends up in logs)
	Sim   string          `json:"sim"`   // hello
	Mode  string          `json:"mode"`  // hello: "open" (the real map) or "street"
	X     float64         `json:"x"`
	Y     float64         `json:"y"`
	Z     float64         `json:"z"`
	H     float64         `json:"h"`
	P     string          `json:"p"`
	C     float64         `json:"c"`    // ping: the phone's clock, sent back as is
	Race  string          `json:"race"` // hello, mode "kart": the race's grid (package kart)
	K     []float64       `json:"k"`
	B     [][]float64     `json:"b"`
	D     json.RawMessage `json:"d"`    // drop: an item left on the track or thrown (relayed as is)
	Lang  string          `json:"lang"` // hello: the language the phone plays in ("fr", "en")
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
	c.kick = cancel
	c.lang = i18n.For(ctx, c.lang)
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

	last, lastDrop := time.Time{}, time.Time{}
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
			if postures[m.P] && features.Default.BlocksKey(context.Background(), "postures") != "" {
				m.P = "idle"
			}
			st := State{ID: c.sim, X: m.X, Y: m.Y, Z: m.Z, H: m.H, P: m.P}
			if isKart(c.room) {
				if !kartOK(m.K, m.B) {
					continue
				}
				st.K, st.B = m.K, m.B
			} else if isMatch(c.room) || isFight(c.room) || isPvp(c.room) {
				if !matchOK(m.K, m.B, isFight(c.room) || isPvp(c.room)) {
					continue
				}
				st.K, st.B = m.K, m.B
			}
			last = time.Now()
			st.At = last.UnixMilli()
			h.update(c, st)
		case "drop":
			// An item on the track: to the others in the race straight away (a few a second at most).
			if !isFast(c.room) || len(m.D) == 0 || len(m.D) > 512 || time.Since(lastDrop) < 150*time.Millisecond {
				continue
			}
			lastDrop = time.Now()
			h.relay(c, m.D)
		}
	}
}

// kartOK: a kart's numbers (and the drivers it drives), sane and not too many.
func kartOK(k []float64, b [][]float64) bool {
	if len(k) > 16 || len(b) > kart.Max || !finite(k...) {
		return false
	}
	for _, x := range b {
		if len(x) > 16 || !finite(x...) {
			return false
		}
	}
	return true
}

// matchOK: a player's hands, or the match as its first player runs it (ten
// players, or twenty-two at the stadium; the ball and the clock, the set
// piece and the referee), sane and not too many.
func matchOK(k []float64, b [][]float64, fight bool) bool {
	if len(k) > 16 || len(b) > 26 || !finite(k...) {
		return false
	}
	// A fight's fighters say a little more each (web combat/net.ts).
	row := 16
	if fight {
		row = 24
	}
	for _, x := range b {
		if len(x) > row || !finite(x...) {
			return false
		}
	}
	return true
}

// relay: something one player did in a race, to the others in it.
func (h *Hub) relay(from *client, d json.RawMessage) {
	msg, _ := json.Marshal(map[string]any{"t": "drop", "id": from.sim, "d": d})
	h.mu.Lock()
	defer h.mu.Unlock()
	for o := range h.rooms[from.room] {
		if o == from {
			continue
		}
		select {
		case o.send <- msg:
		default:
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
	user, sid, err := h.Tokens.ParseSession(ctx, m.Token)
	if err != nil {
		return nil, errors.New("session invalide")
	}
	c, err := h.room(ctx, m, user, sid)
	if c != nil {
		c.lang = m.Lang
	}
	return c, err
}

// room: the room the hello asks for, if the Sim may be in it.
func (h *Hub) room(ctx context.Context, m message, user, sid string) (*client, error) {
	var city, commune string
	if err := h.DB.QueryRow(ctx, `SELECT city, commune FROM sims WHERE id = $1 AND user_id = $2`, m.Sim, user).Scan(&city, &commune); err != nil {
		return nil, errors.New("sim introuvable")
	}
	// A kart race: its own room, for the players on its grid.
	if m.Mode == "kart" {
		if h.Karts == nil || !h.Karts.Has(m.Race, m.Sim) {
			return nil, errors.New("pas sur cette grille")
		}
		log.Printf("live: %s joins kart race %s", m.Sim, m.Race)
		return &client{sim: m.Sim, room: "kart:" + m.Race, send: make(chan []byte, 32), sid: sid}, nil
	}
	// A match at a court: its own room, for the players in it.
	if m.Mode == "match" {
		if h.Courts == nil || !h.Courts.Has(m.Race, m.Sim) {
			return nil, errors.New("pas dans ce match")
		}
		log.Printf("live: %s joins match %s", m.Sim, m.Race)
		return &client{sim: m.Sim, room: "match:" + m.Race, send: make(chan []byte, 32), sid: sid}, nil
	}
	// A fight between two players: its own room, for the two of them.
	if m.Mode == "fight" {
		if h.Duels == nil || !h.Duels.Has(m.Race, m.Sim) {
			return nil, errors.New("pas dans ce combat")
		}
		return &client{sim: m.Sim, room: "fight:" + m.Race, send: make(chan []byte, 32), sid: sid}, nil
	}
	// A game between real players: its own room, for them.
	if m.Mode == "pvp" {
		if h.Pvp == nil || !h.Pvp.Has(m.Race, m.Sim) {
			return nil, errors.New("pas dans cette partie")
		}
		return &client{sim: m.Sim, room: "pvp:" + m.Race, send: make(chan []byte, 32), sid: sid}, nil
	}
	mode := "street"
	if m.Mode == "open" {
		mode = "open"
	}
	log.Printf("live: %s joins %s/%s (%s)", m.Sim, city, commune, mode)
	return &client{sim: m.Sim, room: city + "|" + commune + "|" + mode, send: make(chan []byte, 16), sid: sid}, nil
}
