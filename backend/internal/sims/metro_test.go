package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/world"
)

func TestMetro(t *testing.T) {
	s := newSim()
	s.City, s.Commune = "abidjan", "plateau"
	city, _ := world.FindCity("abidjan")
	to, _ := city.Commune("port-bouet")
	money := s.Money
	if err := s.leaveWith(city, to, Ride{App: "metro"}, newRand()); err != nil {
		t.Fatal(err)
	}
	tr := s.Activity.Trip
	if tr.Mode != "metro" || tr.Fare != world.Metro.Fare || s.Money != money-world.Metro.Fare || len(tr.Path) != 5 {
		t.Fatalf("%+v %d", tr, s.Money)
	}
	s.Activity = nil
	if off, _ := city.Commune("cocody"); s.leaveWith(city, off, Ride{App: "metro"}, newRand()) != errNoMetro {
		t.Error("Cocody has no station")
	}
}
