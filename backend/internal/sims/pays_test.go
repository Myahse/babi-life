package sims

import (
	"math/rand/v2"
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// The countries abroad (world/pays.go): Abidjan to New York by plane from the airport, never by road; to
// Ouagadougou by plane too; a player in New York is born there, not while the country is closed; drawn at
// random, always in Côte d'Ivoire.
func TestPays(t *testing.T) {
	ny, ok := world.FindCity("new-york")
	if !ok {
		t.Fatal("no New York")
	}
	queens, _ := ny.Commune("nyc-queens")
	manhattan, _ := ny.Commune("nyc-manhattan")
	s := newSim()
	s.Commune, s.Money = "port-bouet", 5_000_000
	if err := s.leaveWith(ny, manhattan, Ride{}, rand.New(rand.NewPCG(1, 1))); err == nil || !strings.Contains(err.Error(), "avion") {
		t.Fatalf("by road to New York: %v", err)
	}
	if err := s.leaveWith(ny, manhattan, Ride{App: "avion"}, rand.New(rand.NewPCG(1, 1))); err != nil {
		t.Fatal(err)
	}
	trip := s.Activity.Trip
	km, _, _, _ := world.FlightPath("abidjan", "new-york")
	_, fare := game.FlightQuote(km)
	if trip.Mode != "avion" || trip.City != "new-york" || trip.Commune != queens.ID || trip.Fare != fare || km < 7000 {
		t.Fatalf("flight to New York: %+v (%.0f km)", trip, km)
	}
	// Ouagadougou, by plane.
	ouaga, _ := world.FindCity("ouagadougou")
	centre, _ := ouaga.Commune("ouaga-centre")
	b := newSim()
	b.Commune, b.Money = "port-bouet", 1_000_000
	if err := b.leaveWith(ouaga, centre, Ride{App: "avion"}, rand.New(rand.NewPCG(1, 1))); err != nil || b.Activity.Trip.City != "ouagadougou" {
		t.Fatalf("flight to Ouaga: %v", err)
	}
	// Born where one lives: Harlem gives Manhattan; closed, not there.
	lat, lng := 40.8116, -73.9465
	if c, cm := birthplace(&lat, &lng, "", "", newRand(), nil); c != "new-york" || cm != "nyc-manhattan" {
		t.Errorf("born in Harlem: %s %s", c, cm)
	}
	hidden := map[string]bool{}
	for _, id := range world.CountryCommunes("us") {
		hidden[id] = true
	}
	if c, _ := birthplace(&lat, &lng, "new-york", "nyc-bronx", newRand(), hidden); c == "new-york" {
		t.Error("born in New York while it's closed")
	}
	for range 200 {
		if c, _ := birthplace(nil, nil, "", "", newRand(), nil); world.CountryOf(mustCity(t, c)).ID != "ci" {
			t.Fatalf("drawn abroad: %s", c)
		}
	}
	// The world sent while closed: no New York at all.
	for _, c := range world.Without(hidden) {
		if c.ID == "new-york" {
			t.Error("New York sent while closed")
		}
	}
}

func mustCity(t *testing.T, id string) world.City {
	c, ok := world.FindCity(id)
	if !ok {
		t.Fatalf("no city %s", id)
	}
	return c
}
