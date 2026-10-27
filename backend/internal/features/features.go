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
	{ID: "historique", Label: "L'historique des jeux d'argent", About: "Dans chaque jeu du casino, au bingo, aux paris et au loto : tes dernières parties, ce que tu as misé et récupéré aujourd'hui et sur 7 jours.", Keys: []string{"historique"}},
	// The phone's apps (each one hidden in the Store and on the phone, and refused by the server, until opened).
	{ID: "app-waye", Label: "Waye", About: "Envoyer et recevoir de l'argent entre amis, depuis le téléphone du perso.", Keys: []string{"app:waye"}},
	{ID: "app-gbairai", Label: "Gbairai", About: "La messagerie des amis et des groupes.", Keys: []string{"app:gbairai"}},
	{ID: "app-flashe", Label: "Flashé", About: "Payer en flashant le code des commerçants.", Keys: []string{"app:flashe"}},
	{ID: "app-golvo", Label: "Golvo", About: "La livraison de repas à domicile, le livreur qui arrive en moto.", Keys: []string{"app:golvo"}},
	{ID: "app-dodo", Label: "Dodo", About: "Réserver une maison ou un appartement pour quelques nuits.", Keys: []string{"app:dodo"}},
	{ID: "app-kineo", Label: "Kinéo", About: "Le cinéma : les films à l'affiche et les places.", Keys: []string{"app:kineo"}},
	{ID: "app-bolide", Label: "Bolide", About: "Acheter son vélo, sa moto ou sa voiture, et la conduire en ville.", Keys: []string{"app:bolide"}},
	{ID: "app-gnango", Label: "Gnango", About: "Commander un taxi et faire le trajet dedans.", Keys: []string{"app:gnango"}},
	{ID: "app-idrive", Label: "iDrive", About: "Les VTC : une voiture avec chauffeur jusqu'à ta destination.", Keys: []string{"app:idrive"}},
	{ID: "app-dames", Label: "Dames 225", About: "Le jeu de dames contre les gens du quartier ou un ami.", Keys: []string{"app:dames"}},
	{ID: "app-huit", Label: "8 américain", About: "Le jeu de cartes, contre le quartier ou entre amis.", Keys: []string{"app:huit"}},
	{ID: "app-bet225", Label: "Bet225", About: "Les paris sur les matchs du jeu (18 ans et plus).", Keys: []string{"app:bet225"}},
	{ID: "app-parisfoot", Label: "ParisFoot", About: "L'autre appli de paris, ses cotes et ses combinés (18 ans et plus).", Keys: []string{"app:parisfoot"}},
	{ID: "app-bingo", Label: "Babi Bingo", About: "Quatre salles de bingo, une partie toutes les quelques minutes (18 ans et plus).", Keys: []string{"app:bingo"}},
	{ID: "app-casino", Label: "Babi Casino", About: "La roulette, le 21, les tickets à gratter, L'Envol et Babi Trade (18 ans et plus).", Keys: []string{"app:casino"}},
	// What isn't an app.
	{ID: "soirees", Label: "Organiser une soirée", About: "Inviter ses amis chez soi ou dans un lieu, la musique, à boire, la soirée qui dure.", Keys: []string{"soiree"}},
	{ID: "politique", Label: "La politique", About: "Les élections du quartier et du pays, les campagnes, la présidence.", Keys: []string{"app:politique"}},
	{ID: "loto", Label: "Le loto", About: "Les kiosques Loto Chance dans les rues et leurs tirages.", Keys: []string{"loto"}},
	{ID: "machines", Label: "Les machines à sous", About: "Aux maquis et au casino de l'Hôtel Ivoire (18 ans et plus).", Interactions: []string{"machine-maquis", "machine-casino"}},
	{ID: "casino-ivoire", Label: "La soirée au casino de l'Hôtel Ivoire", About: "Passer la soirée au casino du grand hôtel.", Interactions: []string{"casino-ivoire"}},
	{ID: "tournoi-console", Label: "Le tournoi console du samedi", About: "Quart, demie et finale à la salle de jeux, la coupe à gagner.", Interactions: []string{"tournoi-console"}},
	{ID: "console-defi", Label: "Le défi console « le perdant paie »", About: "Défier un gars du quartier à la console, le perdant paie.", Interactions: []string{"console-defi"}},
	{ID: "table", Label: "« Je peux m'asseoir à ta table ? »", About: "Au resto, au maquis ou au bar des lieux, quelqu'un vient demander à s'asseoir avec toi : tu acceptes et vous causez, ou tu refuses poliment.", Keys: []string{"table"}},
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
