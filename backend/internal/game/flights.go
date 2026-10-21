package game

import "math"

// Flights inside the country, on the game's airline (an invented one, like
// every brand in the game). From a city's airport to another's: never slower
// than the road (already quick in the game: world.TripPath), much dearer, and
// one lands rested and happy where the road tires (FlightEffect, RoadEffect).

// Airline: the game's own.
const Airline = "Air Lagune"

// Airport: where a city's flights leave from and land (world/world.go).
type Airport struct{ City, Commune, Place string }

// Airports: the cities one can fly to, and from.
var Airports = map[string]Airport{
	"abidjan":      {"abidjan", "port-bouet", "pb-aeroport"},
	"yamoussoukro": {"yamoussoukro", "yakro-centre", "yakro-aeroport"},
	"bouake":       {"bouake", "bouake-centre", "bouake-aeroport"},
	"san-pedro":    {"san-pedro", "sp-centre", "sp-aeroport"},
	"man":          {"man", "man-centre", "man-aeroport"},
	"korhogo":      {"korhogo", "korhogo-centre", "korhogo-aeroport"},
	"daloa":        {"daloa", "daloa-centre", "daloa-aeroport"},
}

const (
	// flightBoarding: game minutes from the gate to the wheels up, and from the landing out.
	flightBoarding = 10
	// flightKmPerMin: the game's cruise (the road's car does 12, world.busKmPerMin).
	flightKmPerMin = 30
	flightBaseFare = 30000
	flightPerKm    = 100
)

// FlightEffect: the view over the clouds, a seat to rest in. RoadEffect: hours of road between towns.
var (
	FlightEffect = Needs{Fun: 10}
	RoadEffect   = Needs{Energy: -10, Hygiene: -5}
)

// FlightQuote: how long (game minutes, door to door from the airport) and how
// much a seat costs between two cities' airports, km apart as the crow flies.
func FlightQuote(km float64) (minutes int64, fare int) {
	minutes = flightBoarding + int64(math.Ceil(km/flightKmPerMin))
	fare = int(math.Round((flightBaseFare+flightPerKm*km)/500)) * 500
	return minutes, fare
}
