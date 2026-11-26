package sims

import (
	"math/rand/v2"
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/world"
)

// Europe (world/europe.go): Abidjan to Brussels by plane only; Brussels to Berlin on Velora from the station,
// at its next departure, landing at Berlin's; no train to Reykjavik; a player in Matonge is born there.
func TestEuropeTravel(t *testing.T) {
	brux := mustCity(t, "bruxelles")
	centre, _ := brux.Commune("brux-centre")
	matonge, _ := brux.Commune("brux-matonge")
	s := newSim()
	s.Commune, s.Money = "port-bouet", 5_000_000
	if err := s.leaveWith(brux, centre, Ride{}, rand.New(rand.NewPCG(1, 1))); err == nil || !strings.Contains(err.Error(), "avion") {
		t.Fatalf("by road to Brussels: %v", err)
	}
	if err := s.leaveWith(brux, matonge, Ride{App: "avion"}, rand.New(rand.NewPCG(1, 1))); err != nil || s.Activity.Trip.Commune != "brux-zaventem" {
		t.Fatalf("flight to Brussels: %v %+v", err, s.Activity.Trip)
	}
	b := newSim()
	b.City, b.Commune, b.Money, b.GameMinutes = "bruxelles", "brux-matonge", 1_000_000, 8*60
	berlin := mustCity(t, "berlin")
	mitte, _ := berlin.Commune("ber-mitte")
	if err := b.leaveWith(berlin, mitte, Ride{App: world.RailApp}, rand.New(rand.NewPCG(1, 1))); err == nil {
		t.Fatal("Velora from Matonge, not the station")
	}
	b.Commune = "brux-centre"
	if err := b.leaveWith(berlin, mitte, Ride{App: world.RailApp}, rand.New(rand.NewPCG(1, 1))); err != nil {
		t.Fatal(err)
	}
	if tr := b.Activity.Trip; tr.Mode != "train" || tr.Company != world.RailCompany || tr.Place != "ber-hauptbahnhof" || tr.Fare < 20000 {
		t.Fatalf("Velora to Berlin: %+v", tr)
	}
	c := newSim()
	c.City, c.Commune, c.Money, c.GameMinutes = "londres", "ldn-westminster", 1_000_000, 8*60
	rk := mustCity(t, "reykjavik")
	if err := c.leaveWith(rk, rk.Communes[0], Ride{App: world.RailApp}, rand.New(rand.NewPCG(1, 1))); err == nil {
		t.Fatal("a train to Reykjavik")
	}
	lat, lng := 50.8387, 4.3630 // Porte de Namur
	if city, cm := birthplace(&lat, &lng, "", "", newRand(), nil); city != "bruxelles" || cm != "brux-matonge" {
		t.Errorf("born in Matonge: %s %s", city, cm)
	}
}
