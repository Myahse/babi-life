package world

import (
	"math"
	"slices"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Ride-hailing apps a Sim can book from the map, inside a city. How they work
// (fixed price vs. proposing your own) is sourced; prices and times are game
// rules derived from the shared-taxi fare, not the apps' real tariffs.
type RideApp struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Model string `json:"model"` // "fixed": the app sets the price; "offer": you propose it
	// Cities where it runs.
	Cities []string     `json:"cities"`
	Source *game.Source `json:"source"`
	// Classes: the kinds of car you can order, from the cheapest up (none: just one).
	Classes []RideClass `json:"classes,omitempty"`
}

// RideClass is a kind of car on an app, as in the real apps' menus: the
// higher up, the newer and roomier the car, the dearer the ride and the
// longer the wait (there are fewer of them).
type RideClass struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Factor float64 `json:"factor"` // the fare, against the cheapest class
	// Wait: the extra minutes before a car of this class reaches you.
	Wait  int    `json:"wait"`
	Cars  string `json:"cars"`  // what kind of car comes
	Perks string `json:"perks"` // what you get in it
	// Effect: how the Sim feels on arrival (hot and cramped, or rested).
	Effect game.Needs `json:"effect"`
}

// Gnango's classes, like Yango's Économie, Confort and Confort+. The fares
// against each other and the cars are the game's.
var gnangoClasses = []RideClass{
	{ID: "eco", Name: "Éco", Factor: 1, Wait: 0, Cars: "Petite berline, souvent un peu usée", Perks: "Le moins cher", Effect: game.Needs{Energy: -2, Hygiene: -3}},
	{ID: "confort", Name: "Confort", Factor: 1.3, Wait: 2, Cars: "Berline récente et propre", Perks: "Clim garantie, plus de place", Effect: game.Needs{Energy: 3}},
	{ID: "confortplus", Name: "Confort+", Factor: 1.75, Wait: 5, Cars: "Grande berline ou SUV haut de gamme", Perks: "Chauffeurs les mieux notés, eau offerte, silence", Effect: game.Needs{Energy: 6, Fun: 4}},
}

// The in-game apps carry their own names; they work like the real apps
// they are modelled on (sources in the notes).
var RideApps = []RideApp{
	{ID: "gnango", Name: "Gnango", Model: "fixed", Cities: []string{"abidjan", "bouake"}, Classes: gnangoClasses,
		Source: inspired("Appli du jeu inspirée de Yango : VTC lancé en Côte d'Ivoire en octobre 2018 ; prix fixé à la réservation, sans négocier ; présent à Bouaké.",
			"https://www.afrique-sur7.fr/489400-yango-geant-du-vtc-abidjan", "https://www.fratmat.info/article/222214/societe/transports-le-covoitureur-yango-desormais-a-bouake")},
	{ID: "idrive", Name: "iDrive", Model: "offer", Cities: []string{"abidjan"},
		Source: inspired("Appli du jeu inspirée d'inDrive : le passager propose son prix et un chauffeur l'accepte ou non.",
			"https://logistafrica.com/en/highlights/indrive-launches-in-abidjan-a-new-ridesharing-service-with-fair-negotiation-and-zero-commission/", "https://digitalmag.ci/comparatifs-des-applications-de-vtc-en-cote-divoire-prix-disponibilite-confort-et-securite/")},
}

// Older clients and trips still say "yango" / "indrive".
var rideAliases = map[string]string{"yango": "gnango", "indrive": "idrive"}

// inspired: an invented brand whose way of working is sourced.
func inspired(note string, urls ...string) *game.Source {
	return &game.Source{Status: game.StatusFictional, URLs: urls, Checked: game.Checked, Note: note}
}

func FindRideApp(id string) (RideApp, bool) {
	if to, ok := rideAliases[id]; ok {
		id = to
	}
	for _, a := range RideApps {
		if a.ID == id {
			return a, true
		}
	}
	return RideApp{}, false
}

// RideQuote is the price and time of a private ride inside a city: dearer
// than the shared taxi, quicker because it goes straight there.
func RideQuote(app RideApp, city City, from, to Commune) (minutes int64, fare int, ok bool) {
	if !slices.Contains(app.Cities, city.ID) || from.ID == to.ID {
		return 0, 0, false
	}
	m, f, path := TripPath(city, from, city, to)
	return int64(math.Round(float64(m) * 0.7)), withToll(f, path.Bridges, 3, 1000, 100), true
}

// OfferAccepted: on an "offer" app, how likely a driver takes a proposed
// price, against the fixed-price quote. Below 60% of it, nobody comes.
func OfferChance(offer, quote int) float64 {
	r := float64(offer) / float64(quote)
	return math.Max(0, math.Min(1, (r-0.6)/0.4))
}

// Class finds one of the app's classes; empty or unknown gives its first (the cheapest).
func (a RideApp) Class(id string) (RideClass, bool) {
	for _, c := range a.Classes {
		if c.ID == id {
			return c, true
		}
	}
	if len(a.Classes) > 0 {
		return a.Classes[0], id == ""
	}
	return RideClass{}, false
}

// ClassFare: the fare of a ride in that class, rounded to 50 Djai.
func ClassFare(fare int, c RideClass) int {
	if c.Factor <= 0 {
		return fare
	}
	return int(math.Round(float64(fare)*c.Factor/50)) * 50
}
