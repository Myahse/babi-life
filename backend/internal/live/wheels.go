package live

import (
	"encoding/json"
	"regexp"
	"time"
)

// What a player rides, and where it left its own vehicle: the others draw that
// very vehicle (web world3d/Players.tsx, world3d/ownVehicle.tsx), not a car of
// their own choosing, and the one parked stays in the street for them.

// Ride: what the Sim is on, sent with its state. Its own (a bike, a moto, a car
// of the Bolide app: its body and colour) or a ride as a passenger (the
// moto-taxi, the taxi, the woro-woro, the gbaka, in their colours).
type Ride struct {
	K string `json:"k"`
	B string `json:"b,omitempty"`
	C string `json:"c,omitempty"`
	T string `json:"t,omitempty"`
	P bool   `json:"p,omitempty"`
}

// Parked: one's own vehicle left in the street of this commune (web drive.ts
// Parked): where (the commune's frame), the way it faces, and which.
type Parked struct {
	X  float64 `json:"x"`
	Z  float64 `json:"z"`
	H  float64 `json:"h"`
	K  string  `json:"k"`
	B  string  `json:"b,omitempty"`
	C  string  `json:"c,omitempty"`
	at int64
}

// ParkedFor: how long a vehicle left in the street is still shown once its
// owner is gone (the hub forgets it on a restart anyway).
const ParkedFor = 12 * time.Hour

var (
	hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
	bodyID   = regexp.MustCompile(`^[a-z0-9-]{1,16}$`)
	// The kinds one owns, and the rides one takes.
	ownKinds  = map[string]bool{"velo": true, "moto": true, "voiture": true}
	rideKinds = map[string]bool{"moto": true, "taxi": true, "woro": true, "gbaka": true}
)

func colorOK(c string) bool { return c == "" || hexColor.MatchString(c) }

// ok: a ride the phones can draw, nothing else.
func (r *Ride) ok() bool {
	if r == nil {
		return true
	}
	if r.P && !rideKinds[r.K] || !r.P && !ownKinds[r.K] {
		return false
	}
	return (r.B == "" || bodyID.MatchString(r.B)) && colorOK(r.C) && colorOK(r.T)
}

func (p *Parked) ok() bool {
	return p != nil && ownKinds[p.K] && finite(p.X, p.Z, p.H) && (p.B == "" || bodyID.MatchString(p.B)) && colorOK(p.C)
}

// park: the Sim's vehicle left in its room's street (nil: got back in, or
// gone). The others in the room are told at once.
func (h *Hub) park(c *client, p *Parked, now time.Time) {
	h.mu.Lock()
	defer h.mu.Unlock()
	room := h.parked[c.room]
	was, had := room[c.sim]
	if p == nil {
		if !had {
			return
		}
		delete(room, c.sim)
	} else {
		p.at = now.UnixMilli()
		if had && was.X == p.X && was.Z == p.Z && was.H == p.H && was.K == p.K && was.B == p.B && was.C == p.C {
			room[c.sim] = *p // still there: kept longer, nobody told
			return
		}
		if room == nil {
			room = map[string]Parked{}
			h.parked[c.room] = room
		}
		if !had && len(room) >= MaxRoom {
			return
		}
		room[c.sim] = *p
	}
	msg, _ := json.Marshal(map[string]any{"t": "parked", "id": c.sim, "pk": p})
	for o := range h.rooms[c.room] {
		if o == c {
			continue
		}
		select {
		case o.send <- msg:
		default:
		}
	}
}

// parkedIn: the vehicles left in a room's street (the ones too old forgotten),
// for a phone just come in. Called with h.mu held.
func (h *Hub) parkedIn(room string, now time.Time) []byte {
	list := map[string]Parked{}
	for id, p := range h.parked[room] {
		if now.UnixMilli()-p.at > ParkedFor.Milliseconds() {
			delete(h.parked[room], id)
			continue
		}
		list[id] = p
	}
	if len(h.parked[room]) == 0 {
		delete(h.parked, room)
	}
	if len(list) == 0 {
		return nil
	}
	msg, _ := json.Marshal(map[string]any{"t": "parkeds", "list": list})
	return msg
}
