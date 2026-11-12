package live

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/auth"
)

func TestRidesAndParkedVehicles(t *testing.T) {
	if !(&Ride{K: "voiture", B: "berline", C: "#c92a2a"}).ok() || !(&Ride{K: "taxi", C: "#ff7a00", P: true}).ok() {
		t.Fatal("a car and a taxi ride should pass")
	}
	if (&Ride{K: "taxi"}).ok() || (&Ride{K: "voiture", C: "red"}).ok() || (&Ride{K: "voiture", B: "<script>"}).ok() {
		t.Fatal("a bad ride passed")
	}
	h := NewHub(nil, auth.Tokens{}, nil)
	a := &client{sim: "a", room: "r", send: make(chan []byte, 4)}
	b := &client{sim: "b", room: "r", send: make(chan []byte, 4)}
	h.join(a)
	h.join(b)
	now := time.Now()
	h.park(a, &Parked{X: 3, Z: 4, H: 1, K: "voiture", B: "suv", C: "#123456"}, now)
	var got struct {
		T  string  `json:"t"`
		ID string  `json:"id"`
		Pk *Parked `json:"pk"`
	}
	if err := json.Unmarshal(<-b.send, &got); err != nil || got.T != "parked" || got.ID != "a" || got.Pk == nil || got.Pk.B != "suv" {
		t.Fatalf("b should be told a parked, got %+v", got)
	}
	if len(a.send) != 0 {
		t.Fatal("the owner was told of its own car")
	}
	// a goes: its car stays, and a phone coming in is told of it.
	h.leave(a)
	<-b.send
	if msg := h.parkedIn("r", now); msg == nil {
		t.Fatal("the parked car was forgotten when its owner left")
	}
	// Long after, it's gone.
	if msg := h.parkedIn("r", now.Add(ParkedFor+time.Minute)); msg != nil {
		t.Fatal("an old parked car was kept")
	}
	// Got back in: the others are told it's gone from the kerb.
	h.join(a)
	h.park(a, &Parked{X: 3, Z: 4, H: 1, K: "moto", C: "#123456"}, now)
	<-b.send
	h.park(a, nil, now)
	_ = json.Unmarshal(<-b.send, &got)
	if got.T != "parked" || got.Pk != nil {
		t.Fatalf("b should be told a's moto is gone, got %+v", got)
	}
}
