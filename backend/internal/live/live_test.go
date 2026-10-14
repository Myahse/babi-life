package live

import (
	"encoding/json"
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
	h.broadcast(now)

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
	h.broadcast(time.Now())
	if len(b.send) != 0 || len(h.states["r"]) != 0 {
		t.Fatal("a stale player should be dropped, not sent")
	}
}
