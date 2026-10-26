// Package features holds the game's updates: the features that ship closed
// and that the team opens one by one from the admin (web screens/Admin.tsx,
// « Mises à jour »), now or at a set moment, so the game seems to grow as the
// weeks go by. A closed feature is hidden on the phone (GET /features says
// what to hide) and refused by the server (sims: Blocks).
package features

import (
	"context"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Feature is one update: its name and what it is for the team, the place
// activities it opens (catalog interaction IDs, refused while closed), and the
// phone's keys it shows (apps, modes: web lib/features.ts).
type Feature struct {
	ID           string   `json:"id"`
	Label        string   `json:"label"`
	About        string   `json:"about"`
	Interactions []string `json:"interactions,omitempty"`
	Keys         []string `json:"keys,omitempty"`
}

// List is every update, in the order they're meant to come (each new feature is added here, closed).
var List = []Feature{
	{ID: "foot11", Label: "Le foot au stade, 11 contre 11", About: "Le 11 contre 11 à la console et le match entre amis au stade (22 places).", Interactions: []string{"play-foot11"}, Keys: []string{"foot11"}},
	{ID: "foot-coupe", Label: "La Coupe de foot", About: "Huit équipes, tirs au but ou but en or, à la console de la salle de jeux.", Keys: []string{"foot-coupe"}},
	{ID: "foot-carriere", Label: "La carrière foot", About: "Le club du quartier, son championnat de 7 journées et le marché des joueurs (payés en Djai).", Keys: []string{"foot-carriere"}},
	{ID: "combat", Label: "Le combat de rue en 3D", About: "Le jeu de combat de la salle de jeux, contre Petit Yao, la Go de Yop et le Boss d'Adjamé.", Interactions: []string{"console-combat"}},
	{ID: "course", Label: "La course à deux", About: "La course de voitures de la salle de jeux, dans la ville au crépuscule.", Interactions: []string{"console-course"}},
	{ID: "kart", Label: "Babi Karting", About: "Les courses de kart à Marcory : sept objets, les pièces, les tremplins, entre joueurs.", Interactions: []string{"course-kart", "regarder-kart"}},
	{ID: "arcade", Label: "La borne d'arcade", About: "« Moustiques ! » à la borne de la salle de jeux.", Interactions: []string{"borne-arcade"}},
	{ID: "tikitoko", Label: "Tikitoko", About: "L'appli des vidéos courtes dans le téléphone du perso.", Keys: []string{"app:tikitoko"}},
	{ID: "babigram", Label: "Babigram", About: "L'appli des photos dans le téléphone du perso.", Keys: []string{"app:babigram"}},
}

// Find is the update of that ID.
func Find(id string) (Feature, bool) {
	i := slices.IndexFunc(List, func(f Feature) bool { return f.ID == id })
	if i < 0 {
		return Feature{}, false
	}
	return List[i], true
}

// State is an update's switch as the team set it.
type State struct {
	Open     bool       `json:"open"`
	OpensAt  *time.Time `json:"opensAt"`
	OpenedAt *time.Time `json:"openedAt"`
}

// Live reports whether the update is with the players now (opened by hand, or its time has come).
func (s State) Live(now time.Time) bool {
	return s.Open || (s.OpensAt != nil && !now.Before(*s.OpensAt))
}

// Store keeps the switches, read again from the database every little while.
type Store struct {
	DB *pgxpool.Pool

	mu     sync.RWMutex
	state  map[string]State
	loaded time.Time
}

// Default is the store the game asks (set in main): nil opens everything (tests, a database-less run).
var Default *Store

const fresh = 15 * time.Second

func (s *Store) states(ctx context.Context) map[string]State {
	s.mu.RLock()
	st, at := s.state, s.loaded
	s.mu.RUnlock()
	if st != nil && time.Since(at) < fresh {
		return st
	}
	next := map[string]State{}
	rows, err := s.DB.Query(ctx, `SELECT id, open, opens_at, opened_at FROM features`)
	if err != nil {
		if st != nil {
			return st
		}
		return next
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var v State
		if rows.Scan(&id, &v.Open, &v.OpensAt, &v.OpenedAt) == nil {
			next[id] = v
		}
	}
	s.mu.Lock()
	s.state, s.loaded = next, time.Now()
	s.mu.Unlock()
	return next
}

// Open reports whether the update is with the players.
func (s *Store) Open(ctx context.Context, id string) bool {
	if s == nil {
		return true
	}
	return s.states(ctx)[id].Live(time.Now())
}

// Blocks is the update a place activity waits for, "" when it's there to do.
func (s *Store) Blocks(ctx context.Context, interactionID string) string {
	if s == nil {
		return ""
	}
	st := s.states(ctx)
	now := time.Now()
	for _, f := range List {
		if slices.Contains(f.Interactions, interactionID) && !st[f.ID].Live(now) {
			return f.ID
		}
	}
	return ""
}

// BlocksKey is the update a phone key ('app:tikitoko', 'foot11'…) waits for, "" when it's there.
func (s *Store) BlocksKey(ctx context.Context, key string) string {
	if s == nil {
		return ""
	}
	st := s.states(ctx)
	now := time.Now()
	for _, f := range List {
		if slices.Contains(f.Keys, key) && !st[f.ID].Live(now) {
			return f.ID
		}
	}
	return ""
}

// Set switches an update: open or closed now, and when it opens by itself (nil: by hand).
func (s *Store) Set(ctx context.Context, id string, open bool, opensAt *time.Time) error {
	_, err := s.DB.Exec(ctx, `INSERT INTO features (id, open, opens_at, opened_at, updated_at)
		VALUES ($1, $2, $3, CASE WHEN $2 THEN now() END, now())
		ON CONFLICT (id) DO UPDATE SET open = $2, opens_at = $3,
			opened_at = CASE WHEN $2 AND features.opened_at IS NULL THEN now() ELSE features.opened_at END, updated_at = now()`, id, open, opensAt)
	s.mu.Lock()
	s.state = nil
	s.mu.Unlock()
	return err
}

// Row is an update as the admin lists it.
type Row struct {
	Feature
	State
	Live bool `json:"live"`
}

// All is every update with its switch.
func (s *Store) All(ctx context.Context) []Row {
	st := s.states(ctx)
	now := time.Now()
	out := make([]Row, 0, len(List))
	for _, f := range List {
		v := st[f.ID]
		out = append(out, Row{Feature: f, State: v, Live: v.Live(now)})
	}
	return out
}

// News is an update the players got lately, for the « Nouveau » card on the phone.
type News struct {
	ID    string    `json:"id"`
	Label string    `json:"label"`
	About string    `json:"about"`
	At    time.Time `json:"at"`
}

// Public serves GET /features: what the phone hides (the closed updates' activities and keys), and what's new.
func (s *Store) Public(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	st := s.states(r.Context())
	now := time.Now()
	out := struct {
		Closed       []string `json:"closed"`
		Interactions []string `json:"interactions"`
		Keys         []string `json:"keys"`
		New          []News   `json:"new"`
	}{Closed: []string{}, Interactions: []string{}, Keys: []string{}, New: []News{}}
	for _, f := range List {
		v := st[f.ID]
		if !v.Live(now) {
			out.Closed = append(out.Closed, f.ID)
			out.Interactions = append(out.Interactions, f.Interactions...)
			out.Keys = append(out.Keys, f.Keys...)
			continue
		}
		// Opened in the last two weeks: shown as new (the moment it came, by hand or at its set time).
		at := v.OpenedAt
		if at == nil {
			at = v.OpensAt
		}
		if at != nil && now.Sub(*at) < 14*24*time.Hour {
			out.New = append(out.New, News{ID: f.ID, Label: f.Label, About: f.About, At: *at})
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}
