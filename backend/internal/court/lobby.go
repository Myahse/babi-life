// Package court puts the players at the same court in the same match. The
// football pitches and basketball courts are fixed places (game.Courts); each
// holds one match at a time, with room for so many players by sport (Cap):
// ten on a five-a-side pitch, six on a three-against-three court. The first
// player opens a match that waits a little for friends (Wait); others join
// it, even once it's under way, taking an AI player's place, until it's
// full. The match itself goes over the live WebSocket (package live, mode
// "match"): the first player there runs it, the others send their hands.
//
// It lives in this process's memory, like the live hub and the kart grids.
package court

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"slices"
	"sync"
	"time"
)

const (
	// Wait: how long a new match waits for others before the whistle.
	Wait = 20 * time.Second
	// Length: from the whistle to the end, with the countdown and the stops (streetball/game.ts: 180 s of play).
	Length = 4 * time.Minute
)

// Cap: players a match takes, by sport.
var Cap = map[string]int{"foot": 10, "basket": 6}

// order: the places in the teams the players take, in turn, as streetball/game.ts
// numbers them: both teams kept even, the keepers last.
var order = map[string][]int{
	"foot":   {2, 7, 1, 6, 3, 8, 4, 9, 0, 5},
	"basket": {0, 3, 1, 4, 2, 5},
}

// Entry is a player in a match, and the place it holds (game.ts's player index).
type Entry struct {
	Sim    string          `json:"sim"`
	Name   string          `json:"name"`
	Gender string          `json:"gender"`
	Look   json.RawMessage `json:"look"`
	Slot   int             `json:"slot"`
}

// Match: at which court, which sport, when the whistle goes (unix ms) and who plays.
type Match struct {
	ID      string  `json:"id"`
	Place   string  `json:"place"`
	Sport   string  `json:"sport"`
	Start   int64   `json:"start"`
	End     int64   `json:"end"`
	Cap     int     `json:"cap"`
	Entries []Entry `json:"entries"`
}

// Full: the court has all the players it takes; the next match after this one ends (unix ms).
type Full struct{ Until int64 }

func (f Full) Error() string { return "terrain complet" }

var ErrSport = errors.New("pas ce sport ici")

type Lobby struct {
	mu      sync.Mutex
	matches map[string]*Match
	// at: the match going on (or waiting) at each court.
	at map[string]*Match
}

func NewLobby() *Lobby { return &Lobby{matches: map[string]*Match{}, at: map[string]*Match{}} }

func newID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// Join puts a player in the match at this court: the one it's already in,
// the one waiting or under way if there's room, else a new one.
func (l *Lobby) Join(place, sport string, e Entry, now time.Time) (Match, error) {
	slots, ok := order[sport]
	if !ok {
		return Match{}, ErrSport
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	l.sweep(now)
	// Playing here means not holding a place at another court any more.
	for p, o := range l.at {
		if p != place {
			o.Entries = slices.DeleteFunc(o.Entries, func(x Entry) bool { return x.Sim == e.Sim })
		}
	}
	m := l.at[place]
	if m != nil && m.Sport != sport {
		// The court is taken by the other game: wait for it to end.
		return Match{}, Full{Until: m.End}
	}
	if m != nil {
		for _, x := range m.Entries {
			if x.Sim == e.Sim {
				return copyMatch(m), nil
			}
		}
		if len(m.Entries) >= m.Cap {
			return Match{}, Full{Until: m.End}
		}
	} else {
		start := now.Add(Wait)
		m = &Match{ID: newID(), Place: place, Sport: sport, Start: start.UnixMilli(), End: start.Add(Length).UnixMilli(), Cap: Cap[sport]}
		l.matches[m.ID] = m
		l.at[place] = m
	}
	// The first place in the order no one holds yet.
	taken := map[int]bool{}
	for _, x := range m.Entries {
		taken[x.Slot] = true
	}
	for _, s := range slots {
		if !taken[s] {
			e.Slot = s
			break
		}
	}
	m.Entries = append(m.Entries, e)
	return copyMatch(m), nil
}

// Leave: a player walks off; its place goes back to the AI (and to whoever comes next).
func (l *Lobby) Leave(id, sim string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	m, ok := l.matches[id]
	if !ok {
		return
	}
	for i, x := range m.Entries {
		if x.Sim == sim {
			m.Entries = append(m.Entries[:i], m.Entries[i+1:]...)
			break
		}
	}
}

// Get: a match as it stands (it fills while it waits, and during play).
func (l *Lobby) Get(id string) (Match, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	m, ok := l.matches[id]
	if !ok {
		return Match{}, false
	}
	return copyMatch(m), true
}

// At: the match at a court now, if any (how many play there).
func (l *Lobby) At(place string, now time.Time) (Match, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.sweep(now)
	m, ok := l.at[place]
	if !ok {
		return Match{}, false
	}
	return copyMatch(m), true
}

// Has: whether a Sim plays in a match (the live room checks it).
func (l *Lobby) Has(id, sim string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	m, ok := l.matches[id]
	if !ok {
		return false
	}
	for _, e := range m.Entries {
		if e.Sim == sim {
			return true
		}
	}
	return false
}

// sweep: a match over frees its court; it's forgotten a while later.
func (l *Lobby) sweep(now time.Time) {
	ms := now.UnixMilli()
	for place, m := range l.at {
		if ms >= m.End || len(m.Entries) == 0 {
			delete(l.at, place)
		}
	}
	for id, m := range l.matches {
		if ms-m.End > (10 * time.Minute).Milliseconds() {
			delete(l.matches, id)
		}
	}
}

func copyMatch(m *Match) Match {
	c := *m
	c.Entries = append([]Entry(nil), m.Entries...)
	return c
}
