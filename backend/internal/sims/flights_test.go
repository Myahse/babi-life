package sims

import (
	"math/rand/v2"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Abidjan to Bouaké by plane: from the airport's commune, landing at
// Bouaké's, much faster than the car and dearer; not from elsewhere, not to
// a town without an airport.
func TestFlight(t *testing.T) {
	bouake, _ := world.FindCity("bouake")
	centre, _ := bouake.Commune("bouake-centre")
	s := newSim()
	s.Commune, s.Money = "yopougon", 500000
	if err := s.leaveWith(bouake, centre, Ride{App: "avion"}, rand.New(rand.NewPCG(1, 1))); err != errNotAtAirport {
		t.Fatalf("from Yopougon: %v", err)
	}
	s.Commune = "port-bouet"
	if err := s.leaveWith(bouake, centre, Ride{App: "avion", Party: 2}, rand.New(rand.NewPCG(1, 1))); err != nil {
		t.Fatal(err)
	}
	trip := s.Activity.Trip
	km, _, _, _ := world.FlightPath("abidjan", "bouake")
	minutes, fare := game.FlightQuote(km)
	if trip.Mode != "avion" || trip.City != "bouake" || trip.Commune != "bouake-centre" || trip.Fare != 2*fare || s.Money != 500000-2*fare {
		t.Fatalf("flight: %+v, money %d", trip, s.Money)
	}
	// By car the same way: hours more.
	car := newSim()
	car.Commune, car.Money = "port-bouet", 500000
	_ = car.leaveWith(bouake, centre, Ride{}, rand.New(rand.NewPCG(1, 1)))
	if car.Activity.End-car.Activity.Start < s.Activity.End-s.Activity.Start || minutes > 60 {
		t.Errorf("the plane is slower: plane %d min, car %d", s.Activity.End-s.Activity.Start, car.Activity.End-car.Activity.Start)
	}
	if s.Needs.Fun <= car.Needs.Fun || s.Needs.Energy <= car.Needs.Energy {
		t.Errorf("the plane should leave you happier and less tired than the road: %+v vs %+v", s.Needs, car.Needs)
	}
	bassam, _ := world.FindCity("grand-bassam")
	s = newSim()
	s.Commune, s.Money = "port-bouet", 500000
	if err := s.leaveWith(bassam, bassam.Communes[0], Ride{App: "avion"}, rand.New(rand.NewPCG(1, 1))); err != errNoFlight {
		t.Errorf("to Bassam: %v", err)
	}
}
