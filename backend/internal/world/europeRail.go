package world

import (
	"errors"
	"fmt"
	"math"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Velora, the high-speed train of Europe (the update « pays-europe »; an invented brand): from a city's great
// station (game.RailStations) to another's, wherever a road joins their countries (roadLinked: the Channel
// tunnel to London through France, the Øresund bridge to Stockholm; never to Dublin nor Reykjavik). A train
// every hour and a half from 6 h to 21 h; the time and the fare on the distance (the rails a little longer
// than the crow flies), shortened for the game like the coach's road. France's stations join it as they come.

const (
	// RailCompany: the trains' brand; RailApp: the ride's app (sims leaveWith, web TravelCTA).
	RailCompany = "Velora"
	RailApp     = "velora"
	railEvery   = 90
	railFirst   = 6 * 60
	railLast    = 21 * 60
)

// RailTrip: one journey on Velora.
type RailTrip struct {
	Minutes            int64 // game minutes, the wait on the platform included
	Fare               int   // a seat
	Departs            int64
	Path               Path
	LandIn             Commune
	FromPlace, ToPlace string
}

var (
	errNoRail    = errors.New("pas de train Velora entre ces deux villes")
	errNoRailNow = errors.New("plus de train Velora aujourd'hui : le premier part à 6 h")
)

// RailQuote: the time on the rails (game minutes) and a seat's fare for a distance in km.
func RailQuote(km float64) (minutes int64, fare int) {
	rails := km * 1.15
	return 15 + int64(rails/14), max(5000, roundTo(rails*55, 500))
}

// RailTripFrom: the next Velora from fromCity's station (one must be in its commune) to toCity's, at game time now.
func RailTripFrom(fromCity City, fromCommune Commune, toCity City, now int64) (RailTrip, error) {
	a, okA := game.RailStations[fromCity.ID]
	b, okB := game.RailStations[toCity.ID]
	if !okA || !okB || fromCity.ID == toCity.ID || fromCity.Island || toCity.Island || !roadLinked(CountryOf(fromCity).ID, CountryOf(toCity).ID) {
		return RailTrip{}, errNoRail
	}
	if fromCommune.ID != a.Commune {
		return RailTrip{}, fmt.Errorf("le train Velora se prend à la gare de %s", fromCity.Name)
	}
	_, _, pa, ok1 := FindPlace(a.Place)
	_, cm, pb, ok2 := FindPlace(b.Place)
	if !ok1 || !ok2 {
		return RailTrip{}, errNoRail
	}
	day, at := now-now%(24*60), now%(24*60)
	next := int64(railFirst)
	if at > railFirst {
		next = railFirst + int64(math.Ceil(float64(at-railFirst)/railEvery))*railEvery
	}
	if next > railLast {
		return RailTrip{}, errNoRailNow
	}
	km := distanceKm(pa.Lat, pa.Lng, pb.Lat, pb.Lng)
	m, fare := RailQuote(km)
	return RailTrip{
		Minutes: m + (next - at), Fare: fare, Departs: day + next, LandIn: cm, FromPlace: a.Place, ToPlace: b.Place,
		Path: Path{Points: [][2]float64{{pa.Lng, pa.Lat}, {pb.Lng, pb.Lat}}, Km: math.Round(km*1.15*10) / 10},
	}, nil
}
