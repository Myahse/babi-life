package world

import (
	"errors"
	"fmt"
	"math"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Lumio, the high-speed train of China and Japan (the update « pays-asie »; an invented brand): from a city's great
// station (game.AsiaRailStations) to another's, wherever a road joins their countries (roadLinked): Pékin, the Great
// Wall at Badaling, Shanghai, Canton and Hong Kong on the Chinese lines; Tokyo, Kyoto and Osaka on the Japanese one;
// never from one to the other, the sea between. A train every hour from 6 h to 22 h, faster than Velora; the time
// and the fare on the distance like Velora's (RailQuote), the rails a little longer than the crow flies.

const (
	// AsiaRailCompany: the trains' brand; AsiaRailApp: the ride's app (sims leaveWith, web TravelCTA).
	AsiaRailCompany = "Lumio"
	AsiaRailApp     = "lumio"
	asiaRailEvery   = 60
	asiaRailFirst   = 6 * 60
	asiaRailLast    = 22 * 60
)

var (
	errNoAsiaRail    = errors.New("pas de train Lumio entre ces deux villes")
	errNoAsiaRailNow = errors.New("plus de train Lumio aujourd'hui : le premier part à 6 h")
)

// AsiaRailTripFrom: the next Lumio from fromCity's station (one must be in its commune) to toCity's, at game time now.
func AsiaRailTripFrom(fromCity City, fromCommune Commune, toCity City, now int64) (RailTrip, error) {
	a, okA := game.AsiaRailStations[fromCity.ID]
	b, okB := game.AsiaRailStations[toCity.ID]
	if !okA || !okB || fromCity.ID == toCity.ID || fromCity.Island || toCity.Island || !roadLinked(CountryOf(fromCity).ID, CountryOf(toCity).ID) {
		return RailTrip{}, errNoAsiaRail
	}
	if fromCommune.ID != a.Commune {
		return RailTrip{}, fmt.Errorf("le train Lumio se prend à la gare de %s", fromCity.Name)
	}
	_, _, pa, ok1 := FindPlace(a.Place)
	_, cm, pb, ok2 := FindPlace(b.Place)
	if !ok1 || !ok2 {
		return RailTrip{}, errNoAsiaRail
	}
	day, at := now-now%(24*60), now%(24*60)
	next := int64(asiaRailFirst)
	if at > asiaRailFirst {
		next = asiaRailFirst + int64(math.Ceil(float64(at-asiaRailFirst)/asiaRailEvery))*asiaRailEvery
	}
	if next > asiaRailLast {
		return RailTrip{}, errNoAsiaRailNow
	}
	km := distanceKm(pa.Lat, pa.Lng, pb.Lat, pb.Lng)
	m, fare := RailQuote(km)
	return RailTrip{
		Minutes: m*4/5 + (next - at), Fare: fare, Departs: day + next, LandIn: cm, FromPlace: a.Place, ToPlace: b.Place,
		Path: Path{Points: [][2]float64{{pa.Lng, pa.Lat}, {pb.Lng, pb.Lat}}, Km: math.Round(km*1.15*10) / 10},
	}, nil
}
