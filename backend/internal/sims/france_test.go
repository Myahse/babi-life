package sims

import (
	"math/rand/v2"
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// La France (world/france.go): Abidjan to Paris by plane, landing at Roissy (Charles-de-Gaulle), never by road;
// the long-haul fare (about 290 000 F); Paris to Marseille by road too; a player in Château-Rouge is born there,
// not while « pays-france » is closed; no palu over there.
func TestFrance(t *testing.T) {
	paris := mustCity(t, "paris")
	barbes, ok := paris.Commune("paris-barbes")
	if !ok {
		t.Fatal("no Barbès")
	}
	s := newSim()
	s.Commune, s.Money = "port-bouet", 5_000_000
	if err := s.leaveWith(paris, barbes, Ride{}, rand.New(rand.NewPCG(1, 1))); err == nil || !strings.Contains(err.Error(), "avion") {
		t.Fatalf("by road to Paris: %v", err)
	}
	if err := s.leaveWith(paris, barbes, Ride{App: "avion"}, rand.New(rand.NewPCG(1, 1))); err != nil {
		t.Fatal(err)
	}
	km, _, _, _ := world.FlightPath("abidjan", "paris")
	_, fare := game.FlightQuote(km)
	if tr := s.Activity.Trip; tr.Mode != "avion" || tr.Commune != "paris-roissy" || tr.Fare != fare || km < 4500 || fare < 250_000 || fare > 330_000 {
		t.Fatalf("flight to Paris: %+v (%.0f km, %d F)", tr, km, fare)
	}
	// Between the cities of France, the road.
	if !world.SameLand(paris, mustCity(t, "marseille")) || world.SameLand(paris, mustCity(t, "abidjan")) {
		t.Error("roads of France")
	}
	// Born in Château-Rouge; closed, not in France.
	lat, lng := 48.8873, 2.3496
	if c, cm := birthplace(&lat, &lng, "", "", newRand(), nil); c != "paris" || cm != "paris-barbes" {
		t.Errorf("born in Château-Rouge: %s %s", c, cm)
	}
	hidden := map[string]bool{}
	for _, id := range world.CountryCommunes("fr") {
		hidden[id] = true
	}
	if len(hidden) < 15 {
		t.Errorf("France hides only %d communes", len(hidden))
	}
	if c, _ := birthplace(&lat, &lng, "paris", "paris-centre", newRand(), hidden); world.CountryOf(mustCity(t, c)).ID == "fr" {
		t.Error("born in France while it's closed")
	}
	for _, c := range world.Without(hidden) {
		if c.Country == "fr" {
			t.Errorf("%s sent while closed", c.Name)
		}
	}
	if !world.InEurope("paris") || world.InEurope("abidjan") || world.InEurope("ouagadougou") {
		t.Error("InEurope")
	}
	// Every city of France has its airport, on a place of its own.
	for _, c := range world.Cities {
		if c.Country != "fr" {
			continue
		}
		a, ok := game.Airports[c.ID]
		if !ok || a.Key != game.FranceKey {
			t.Errorf("%s: no airport", c.Name)
			continue
		}
		cm, _ := c.Commune(a.Commune)
		found := false
		for _, p := range cm.Places {
			found = found || (p.ID == a.Place && p.Kind == "aeroport")
		}
		if !found {
			t.Errorf("%s: airport %s not in %s", c.Name, a.Place, a.Commune)
		}
	}
}

// The Velora from Paris to Brussels (world/europeRail.go), from the Gare du Nord.
func TestFranceVelora(t *testing.T) {
	paris, brux := mustCity(t, "paris"), mustCity(t, "bruxelles")
	nord, _ := paris.Commune("paris-barbes")
	if _, err := world.RailTripFrom(paris, nord, brux, 0); err != nil {
		t.Fatalf("Velora Paris – Bruxelles: %v", err)
	}
}
