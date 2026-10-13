package game

import (
	"math/rand/v2"
	"slices"
	"strings"
)

// A Route is what the trip rules need to know about a journey.
type Route struct {
	FromCity, FromCommune string
	ToCity, ToCommune     string
	// Lagoon banks of Abidjan communes ("nord", "sud"); empty elsewhere.
	FromBank, ToBank string
	// Bridges the trip crosses, from the road network.
	Bridges []string
	// Mode: "woro", "compteur", "taxi", "car" or a ride app's ID.
	Mode string
}

func (r Route) intercity() bool { return r.FromCity != r.ToCity }

// crossesLagoon: the trip goes over one of Abidjan's bridges.
func (r Route) crossesLagoon() bool {
	return !r.intercity() && (len(r.Bridges) > 0 || r.FromBank != "" && r.ToBank != "" && r.FromBank != r.ToBank)
}

// A TripIncident can hit a trip whose route matches its rule; it makes the
// trip longer and tells the Sim why.
type TripIncident struct {
	ID    string `json:"id"`
	Text  string `json:"text"`
	Extra int64  `json:"extra"` // minutes added to the trip
	// Rule: all set conditions must hold.
	CrossesLagoon bool     `json:"crossesLagoon,omitempty"`
	Intercity     bool     `json:"intercity,omitempty"`
	WithinCity    bool     `json:"withinCity,omitempty"`
	Ends          []string `json:"ends,omitempty"`  // a commune the trip starts or ends in
	Modes         []string `json:"modes,omitempty"` // only on these kinds of ride
	// Hours in which it can happen ([MinHour, MaxHour), 0, 0 = any time).
	MinHour int     `json:"minHour,omitempty"`
	MaxHour int     `json:"maxHour,omitempty"`
	Chance  float64 `json:"chance"`
	Effect  Needs   `json:"effect"`
	Source  *Source `json:"source"`
}

var TripIncidents = []TripIncident{
	{ID: "bouchon-pont", Text: "Bouchon sur le {pont} : la lagune se traverse au pas.", Extra: 8, CrossesLagoon: true, MinHour: 6, MaxHour: 21, Chance: 0.35,
		Effect: Needs{Fun: -10, Energy: -5},
		Source: Partial("Les ponts Félix-Houphouët-Boigny et Charles-de-Gaulle relient le Plateau à Treichville, le pont HKB la Riviera à Marcory ; les embouteillages y sont documentés. La fréquence et la durée (raccourcie pour le jeu) sont simulées.", SrcBridges, SrcBridgeHKB)},
	{ID: "route-aeroport", Text: "Travaux sur la route de l'aéroport : ça roule au ralenti.", Extra: 6, Ends: []string{"port-bouet"}, Chance: 0.3,
		Effect: Needs{Fun: -10},
		Source: Partial("Bouchons signalés en novembre 2024 sur la route de l'aéroport à cause de travaux simultanés ; à revoir quand les travaux seront finis.", SrcAirportRoad2024)},
	{ID: "woro-plein", Text: "Le woro-woro attend d'être plein avant de partir.", Extra: 3, WithinCity: true, Modes: []string{"woro", "taxi"}, Chance: 0.25,
		Effect: Needs{Fun: -5}, Source: Fictional},
	{ID: "controle-route", Text: "Contrôle routier : tout le car descend pour montrer ses papiers.", Extra: 6, Intercity: true, Chance: 0.3,
		Effect: Needs{Fun: -10, Energy: -5}, Source: Fictional},
	{ID: "panne-car", Text: "Le car est tombé en panne au bord de la route. On attend le mécanicien.", Extra: 15, Intercity: true, Chance: 0.12,
		Effect: Needs{Fun: -15, Energy: -10, Hunger: -10}, Source: Fictional},
}

func (t TripIncident) applies(r Route, hour int) bool {
	switch {
	case t.CrossesLagoon && !r.crossesLagoon(),
		t.Intercity && !r.intercity(),
		t.WithinCity && r.intercity(),
		len(t.Ends) > 0 && !slices.Contains(t.Ends, r.FromCommune) && !slices.Contains(t.Ends, r.ToCommune),
		len(t.Modes) > 0 && !slices.Contains(t.Modes, r.Mode):
		return false
	}
	return (Interaction{MinHour: t.MinHour, MaxHour: t.MaxHour}).Available(hour)
}

// IncidentFor draws at most one incident for a trip leaving at a game minute.
// Only incidents whose rule matches the route can happen.
func IncidentFor(r Route, gameMinutes int64, rng *rand.Rand) *TripIncident {
	hour := HourOf(gameMinutes)
	for _, t := range TripIncidents {
		if t.applies(r, hour) && rng.Float64() < t.Chance {
			// The jam is on the bridge this trip actually takes.
			pont := "pont"
			if len(r.Bridges) > 0 {
				pont = r.Bridges[rng.IntN(len(r.Bridges))]
			}
			t.Text = strings.ReplaceAll(t.Text, "{pont}", pont)
			return &t
		}
	}
	return nil
}
