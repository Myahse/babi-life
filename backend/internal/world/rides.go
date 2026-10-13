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
}

var RideApps = []RideApp{
	{ID: "yango", Name: "Yango", Model: "fixed", Cities: []string{"abidjan", "bouake"},
		Source: game.Verified("VTC lancé en Côte d'Ivoire en octobre 2018 ; prix fixé à la réservation, sans négocier avec le chauffeur ; présent à Bouaké.",
			"https://www.afrique-sur7.fr/489400-yango-geant-du-vtc-abidjan", "https://www.fratmat.info/article/222214/societe/transports-le-covoitureur-yango-desormais-a-bouake")},
	{ID: "indrive", Name: "inDrive", Model: "offer", Cities: []string{"abidjan"},
		Source: game.Verified("Le passager propose son prix et un chauffeur l'accepte ou non.",
			"https://logistafrica.com/en/highlights/indrive-launches-in-abidjan-a-new-ridesharing-service-with-fair-negotiation-and-zero-commission/", "https://digitalmag.ci/comparatifs-des-applications-de-vtc-en-cote-divoire-prix-disponibilite-confort-et-securite/")},
}

func FindRideApp(id string) (RideApp, bool) {
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
	m, f := Trip(city, from, city, to)
	return int64(math.Round(float64(m) * 0.7)), max(1000, roundTo(float64(f)*3, 100)), true
}

// OfferAccepted: on an "offer" app, how likely a driver takes a proposed
// price, against the fixed-price quote. Below 60% of it, nobody comes.
func OfferChance(offer, quote int) float64 {
	r := float64(offer) / float64(quote)
	return math.Max(0, math.Min(1, (r-0.6)/0.4))
}
