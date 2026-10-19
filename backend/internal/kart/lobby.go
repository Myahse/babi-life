// Package kart puts the players racing at Babi Karting on the same grid.
// Whoever starts a race joins the next one leaving: it waits a little for
// others (Wait), up to six karts; the empty places on the grid are the
// quarter's drivers (the AI, driven by the first player on the grid). The
// race itself goes over the live WebSocket (package live, mode "kart"): each
// phone drives its own kart and sends it; this only says who races when.
//
// It lives in this process's memory, like the live hub.
package kart

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"sync"
	"time"
)

const (
	// Wait: how long a new race waits on the grid for other players.
	Wait = 20 * time.Second
	// Closing: no one joins in the last seconds before the lights.
	Closing = 4 * time.Second
	// Max: karts on the grid (players and the quarter's drivers together).
	Max = 6
	// Keep: a race is forgotten this long after it started.
	Keep = 15 * time.Minute
)

// Entry is a player on the grid.
type Entry struct {
	Sim    string          `json:"sim"`
	Name   string          `json:"name"`
	Gender string          `json:"gender"`
	Look   json.RawMessage `json:"look"`
	Slot   int             `json:"slot"`
}

// Race: when the lights go green (unix ms) and who's on the grid.
type Race struct {
	ID      string  `json:"id"`
	Start   int64   `json:"start"`
	Entries []Entry `json:"entries"`
}

type Lobby struct {
	mu    sync.Mutex
	races map[string]*Race
	open  *Race
}

func NewLobby() *Lobby { return &Lobby{races: map[string]*Race{}} }

func newID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// Join puts a player on the next race's grid (or the one it's already on).
func (l *Lobby) Join(e Entry, now time.Time) Race {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.sweep(now)
	ms := now.UnixMilli()
	// Already on a grid that hasn't left: the same race.
	for _, r := range l.races {
		if r.Start > ms {
			for _, x := range r.Entries {
				if x.Sim == e.Sim {
					return copyRace(r)
				}
			}
		}
	}
	r := l.open
	if r == nil || r.Start-ms < Closing.Milliseconds() || len(r.Entries) >= Max {
		r = &Race{ID: newID(), Start: now.Add(Wait).UnixMilli()}
		l.races[r.ID] = r
		l.open = r
	}
	e.Slot = len(r.Entries)
	r.Entries = append(r.Entries, e)
	return copyRace(r)
}

// Get: a race as it stands (the grid fills during the wait).
func (l *Lobby) Get(id string) (Race, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	r, ok := l.races[id]
	if !ok {
		return Race{}, false
	}
	return copyRace(r), true
}

// Has: whether a Sim is on a race's grid (the live room checks it).
func (l *Lobby) Has(id, sim string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	r, ok := l.races[id]
	if !ok {
		return false
	}
	for _, e := range r.Entries {
		if e.Sim == sim {
			return true
		}
	}
	return false
}

func (l *Lobby) sweep(now time.Time) {
	for id, r := range l.races {
		if now.UnixMilli()-r.Start > Keep.Milliseconds() {
			delete(l.races, id)
			if l.open == r {
				l.open = nil
			}
		}
	}
}

func copyRace(r *Race) Race {
	c := *r
	c.Entries = append([]Entry(nil), r.Entries...)
	return c
}
