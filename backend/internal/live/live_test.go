package live

import (
	"encoding/json"
	"fmt"
	"github.com/myahse/babi-life/backend/internal/auth"
	"testing"
	"time"
)

func TestRoomSeesItsPlayers(t *testing.T) {
	h := NewHub(nil, auth.Tokens{}, nil)
	a := &client{sim: "a", room: "abidjan|cocody|open", send: make(chan []byte, 4)}
	b := &client{sim: "b", room: "abidjan|cocody|open", send: make(chan []byte, 4)}
	other := &client{sim: "c", room: "abidjan|yopougon|open", send: make(chan []byte, 4)}
	for _, c := range []*client{a, b, other} {
		if !h.join(c) {
			t.Fatal("join refused")
		}
	}
	now := time.Now()
	h.update(a, State{ID: "a", X: 1, Z: 2, P: "walk", At: now.UnixMilli()})
	h.update(other, State{ID: "c", X: 9, P: "idle", At: now.UnixMilli()})
	h.broadcast(now, true)

	var got struct {
		T       string  `json:"t"`
		Players []State `json:"players"`
	}
	if err := json.Unmarshal(<-b.send, &got); err != nil {
		t.Fatal(err)
	}
	if got.T != "states" || len(got.Players) != 1 || got.Players[0].ID != "a" || got.Players[0].P != "walk" {
		t.Fatalf("b should see only a walking, got %+v", got)
	}
	// Alone in its commune, c gets nothing.
	if len(other.send) != 0 {
		t.Fatal("a lone player was sent states")
	}

	// a leaves: b is told, and a is no longer sent.
	h.leave(a)
	var bye struct{ T, ID string }
	_ = json.Unmarshal(<-b.send, &bye)
	if bye.T != "leave" || bye.ID != "a" {
		t.Fatalf("expected a leave for a, got %+v", bye)
	}
}

func TestStalePlayersDrop(t *testing.T) {
	h := NewHub(nil, auth.Tokens{}, nil)
	a := &client{sim: "a", room: "r", send: make(chan []byte, 4)}
	b := &client{sim: "b", room: "r", send: make(chan []byte, 4)}
	h.join(a)
	h.join(b)
	old := time.Now().Add(-2 * Stale)
	h.update(a, State{ID: "a", P: "idle", At: old.UnixMilli()})
	h.broadcast(time.Now(), true)
	if len(b.send) != 0 || len(h.states["r"]) != 0 {
		t.Fatal("a stale player should be dropped, not sent")
	}
}

func TestOnlyNewStatesAreResent(t *testing.T) {
	h := NewHub(nil, auth.Tokens{}, nil)
	a := &client{sim: "a", room: "r", send: make(chan []byte, 4)}
	b := &client{sim: "b", room: "r", send: make(chan []byte, 4)}
	h.join(a)
	h.join(b)
	now := time.Now()
	h.update(a, State{ID: "a", P: "idle", At: now.UnixMilli() - 10})
	h.broadcast(now, true)
	if len(b.send) != 1 {
		t.Fatal("b should get a's first state")
	}
	<-b.send
	// Nothing new heard: the next tick sends nothing, b keeps the state it has.
	h.broadcast(now.Add(Tick), true)
	if len(b.send) != 0 {
		t.Fatal("an unchanged state was sent again")
	}
	h.update(a, State{ID: "a", P: "walk", At: now.Add(Tick).UnixMilli() + 10})
	h.broadcast(now.Add(2*Tick), true)
	if len(b.send) != 1 {
		t.Fatal("a's new state should be sent")
	}
}

func TestFarPlayersNowAndThen(t *testing.T) {
	h := NewHub(nil, auth.Tokens{}, nil)
	me := &client{sim: "me", room: "r", send: make(chan []byte, 8)}
	near := &client{sim: "near", room: "r", send: make(chan []byte, 8)}
	far := &client{sim: "far", room: "r", send: make(chan []byte, 8)}
	for _, c := range []*client{me, near, far} {
		h.join(c)
	}
	ids := func() map[string]bool {
		got := map[string]bool{}
		for len(me.send) > 0 {
			var m struct{ Players []State }
			_ = json.Unmarshal(<-me.send, &m)
			for _, p := range m.Players {
				got[p.ID] = true
			}
		}
		return got
	}
	now := time.Now()
	walk := func(at time.Time) {
		h.update(me, State{ID: "me", P: "idle", At: at.UnixMilli() - 1})
		h.update(near, State{ID: "near", X: 10, P: "walk", At: at.UnixMilli() - 1})
		h.update(far, State{ID: "far", X: 500, P: "walk", At: at.UnixMilli() - 1})
	}
	// The first tick: everyone, the far one too.
	walk(now)
	h.broadcast(now, true)
	if got := ids(); !got["near"] || !got["far"] || got["me"] {
		t.Fatalf("first tick should send near and far, not me: %v", got)
	}
	// The next: only the near one, though the far one moved.
	walk(now.Add(Tick))
	h.broadcast(now.Add(Tick), true)
	if got := ids(); !got["near"] || got["far"] {
		t.Fatalf("a far player was sent before FarEvery: %v", got)
	}
	// FarEvery later: the far one again.
	later := now.Add(FarEvery)
	walk(later)
	h.broadcast(later, true)
	if got := ids(); !got["near"] || !got["far"] {
		t.Fatalf("the far player should come back after FarEvery: %v", got)
	}
}

func TestACrowdSendsTheClosest(t *testing.T) {
	h := NewHub(nil, auth.Tokens{}, nil)
	me := &client{sim: "me", room: "r", send: make(chan []byte, 8)}
	h.join(me)
	now := time.Now()
	h.update(me, State{ID: "me", P: "idle", At: now.UnixMilli() - 1})
	for i := range MaxNear + 20 {
		c := &client{sim: fmt.Sprint(i), room: "r", send: make(chan []byte, 8)}
		h.join(c)
		h.update(c, State{ID: c.sim, X: float64(i) / 2, P: "walk", At: now.UnixMilli() - 1})
	}
	h.broadcast(now, true) // the first: everyone
	<-me.send
	next := now.Add(Tick)
	for id := range h.states["r"] {
		s := h.states["r"][id]
		s.At = next.UnixMilli() - 1
		h.states["r"][id] = s
	}
	h.broadcast(next, true)
	var m struct{ Players []State }
	_ = json.Unmarshal(<-me.send, &m)
	if len(m.Players) != MaxNear {
		t.Fatalf("a crowd should send the %d closest, got %d", MaxNear, len(m.Players))
	}
	for _, p := range m.Players {
		if p.X >= float64(MaxNear)/2 {
			t.Fatalf("%s at %.1f m was sent before a closer one", p.ID, p.X)
		}
	}
}

// A Gbairai ring: the game's words in each device's language, a player's own as written.
func TestMessageInTheDevicesLanguage(t *testing.T) {
	h := NewHub(nil, auth.Tokens{}, nil)
	en := &client{sim: "a", room: "abidjan|cocody|open", send: make(chan []byte, 4), lang: "en"}
	fr := &client{sim: "a", room: "abidjan|cocody|street", send: make(chan []byte, 4), lang: "fr"}
	h.join(en)
	h.join(fr)
	text := func(c *client) string {
		var m struct{ Text string }
		_ = json.Unmarshal(<-c.send, &m)
		return m.Text
	}
	h.Message("a", "b", "Awa", "a envoyé un sticker", true)
	if got := text(en); got != "sent a sticker" {
		t.Errorf("en: %q", got)
	}
	if got := text(fr); got != "a envoyé un sticker" {
		t.Errorf("fr: %q", got)
	}
	h.Message("a", "b", "Awa", "Bonjour", false)
	if got := text(en); got != "Bonjour" {
		t.Errorf("a player's words: %q", got)
	}
}
