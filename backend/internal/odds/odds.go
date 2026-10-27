// Package odds keeps the casino's « taux de retour » as the team sets them
// from the admin (« Casino »): a level for every game and one for any game,
// each change kept with its moment, so a round is played at the rate of when
// it began (game/odds.go says how each game applies it). The same for every
// player; told in each game's « Règles » (GET /casino/taux), never hidden.
package odds

import (
	"context"
	"errors"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// All: the level set for every game at once (a game's own beats it).
const All = "*"

// Change is one setting: for a game (or All), a rate (nil: back to the level for all, or untouched), its moment.
type Change struct {
	Game string    `json:"game"`
	Rate *float64  `json:"rate"`
	At   time.Time `json:"at"`
}

// Store keeps the changes, read again from the database every little while.
type Store struct {
	DB *pgxpool.Pool

	mu     sync.RWMutex
	log    []Change
	loaded time.Time
}

// Default is the store the games ask (set in main): nil leaves every game untouched (tests, no database).
var Default *Store

const fresh = 15 * time.Second

func (s *Store) changes(ctx context.Context) []Change {
	s.mu.RLock()
	log, at := s.log, s.loaded
	s.mu.RUnlock()
	if log != nil && time.Since(at) < fresh {
		return log
	}
	next := []Change{}
	rows, err := s.DB.Query(ctx, `SELECT game, rate, at FROM casino_odds ORDER BY at, id`)
	if err != nil {
		return log
	}
	defer rows.Close()
	for rows.Next() {
		var c Change
		if rows.Scan(&c.Game, &c.Rate, &c.At) == nil {
			next = append(next, c)
		}
	}
	s.mu.Lock()
	s.log, s.loaded = next, time.Now()
	s.mu.Unlock()
	return next
}

// RateAt is the rate a game was set to at a moment (its own, else the level for all), and false when untouched then.
func (s *Store) RateAt(id string, t time.Time) (float64, bool) {
	if s == nil {
		return 0, false
	}
	var own, all *float64
	for _, c := range s.changes(context.Background()) {
		if c.At.After(t) {
			break
		}
		switch c.Game {
		case id:
			own = c.Rate
		case All:
			all = c.Rate
		}
	}
	switch {
	case own != nil:
		return *own, true
	case all != nil:
		return *all, true
	}
	return 0, false
}

// Now is RateAt this moment.
func (s *Store) Now(id string) (float64, bool) { return s.RateAt(id, time.Now()) }

// ErrRange: a rate outside what the casino allows.
var ErrRange = errors.New("le taux de retour va de 55 % à 97 %")

// Set records a change from now (nil rate: back to the level for all, or untouched for All).
func (s *Store) Set(ctx context.Context, id string, rate *float64) error {
	if rate != nil && (*rate < game.OddsMin || *rate > game.OddsMax) {
		return ErrRange
	}
	_, err := s.DB.Exec(ctx, `INSERT INTO casino_odds (game, rate) VALUES ($1, $2)`, id, rate)
	s.mu.Lock()
	s.log = nil
	s.mu.Unlock()
	return err
}

// Known: a game id the admin may set (or All).
func Known(id string) bool {
	if id == All {
		return true
	}
	for _, g := range game.OddsGames {
		if g.ID == id {
			return true
		}
	}
	return false
}

// Rate is a game's rate now, as told to the players and the team.
type Rate struct {
	ID      string  `json:"id"`
	Label   string  `json:"label"`
	Rate    float64 `json:"rate"`
	Natural float64 `json:"natural"`
	// Set: by the team (its own or the level for all); Own: its own.
	Set bool `json:"set"`
	Own bool `json:"own"`
	// Variants: the tickets' and the bingo rooms' own untouched rates (their prizes are scaled by rate / theirs).
	Variants map[string]float64 `json:"variants,omitempty"`
}

// Rates is every game's rate now.
func (s *Store) Rates() []Rate {
	out := make([]Rate, 0, len(game.OddsGames))
	now := time.Now()
	ownSet := map[string]bool{}
	if s != nil {
		for _, c := range s.changes(context.Background()) {
			if !c.At.After(now) {
				ownSet[c.Game] = c.Rate != nil
			}
		}
	}
	for _, g := range game.OddsGames {
		nat := game.Natural(g.ID)
		r, set := s.RateAt(g.ID, now)
		if !set {
			r = nat
		}
		x := Rate{ID: g.ID, Label: g.Label, Rate: r, Natural: nat, Set: set, Own: ownSet[g.ID]}
		switch g.ID {
		case game.OddsBingo:
			x.Variants = game.BingoNatural
		case game.OddsTickets:
			x.Variants = map[string]float64{}
			for _, t := range game.ScratchTickets {
				x.Variants[t.ID] = game.ScratchReturn(t)
			}
		}
		out = append(out, x)
	}
	return out
}

// Level is the level for all now (nil: none).
func (s *Store) Level() *float64 {
	if s == nil {
		return nil
	}
	var all *float64
	now := time.Now()
	for _, c := range s.changes(context.Background()) {
		if c.Game == All && !c.At.After(now) {
			all = c.Rate
		}
	}
	return all
}

// History is the changes, the latest first.
func (s *Store) History(ctx context.Context, n int) []Change {
	log := s.changes(ctx)
	out := make([]Change, len(log))
	copy(out, log)
	sort.SliceStable(out, func(i, j int) bool { return out[i].At.After(out[j].At) })
	if len(out) > n {
		out = out[:n]
	}
	return out
}

// Public serves GET /casino/taux: each game's rate now, for its « Règles ».
func (s *Store) Public(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, map[string]any{"games": s.Rates()})
}
