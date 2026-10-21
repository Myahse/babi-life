package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Land is bought anywhere, not only where the Sim stands.
func TestLotsElsewhere(t *testing.T) {
	s := &Sim{City: "abidjan", Commune: "yopougon"}
	if c, cm, err := lotsWhere(s, "", ""); err != nil || c != "abidjan" || cm != "yopougon" {
		t.Fatalf("by default, where the Sim is: %s %s %v", c, cm, err)
	}
	if c, cm, err := lotsWhere(s, "bouake", "bouake-centre"); err != nil || c != "bouake" || cm != "bouake-centre" {
		t.Fatalf("another town: %s %s %v", c, cm, err)
	}
	if _, _, err := lotsWhere(s, "abidjan", "nulle-part"); err == nil {
		t.Fatal("an unknown commune is refused")
	}
	small := game.LotSizes[0]
	o := offers(Plot{}, "abidjan", "cocody")
	if o[0].Commune != "cocody" || o[0].City != "abidjan" || o[0].Price != game.LotPrice("cocody", small) || !o[0].Possible {
		t.Fatalf("Cocody's prices: %+v", o[0])
	}
	// A lot in Cocody already: there, only bigger ones; in Marcory, any (the old one sold back).
	p := Plot{Lot: &Lot{W: small.W, D: small.D, Area: small.Area(), City: "abidjan", Commune: "cocody", Paid: game.LotPrice("cocody", small)}}
	if offers(p, "abidjan", "cocody")[0].Possible {
		t.Fatal("the same size where one has it already")
	}
	if m := offers(p, "abidjan", "marcory")[0]; !m.Possible || m.Upgrade {
		t.Fatalf("elsewhere: %+v", m)
	}
}
