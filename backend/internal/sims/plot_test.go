package sims

import (
	"fmt"
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
	small, big := game.LotSizes[0], game.LotSizes[1]
	o := offers(nil, "abidjan", "cocody")
	if o[0].Commune != "cocody" || o[0].City != "abidjan" || o[0].Price != game.LotPrice("cocody", small) || !o[0].Possible {
		t.Fatalf("Cocody's prices: %+v", o[0])
	}
	lot := func(id int64, commune string) Plot {
		return Plot{ID: id, Lot: &Lot{W: small.W, D: small.D, Area: small.Area(), City: "abidjan", Commune: commune, Paid: game.LotPrice(commune, small)}}
	}
	// One lot in Cocody: a second one there, and that one made bigger (for the difference).
	one := offers([]Plot{lot(7, "cocody")}, "abidjan", "cocody")
	var grow *LotOffer
	for i, x := range one {
		if x.Upgrade == 7 && x.ID == big.ID {
			grow = &one[i]
		}
	}
	if !one[0].Possible || grow == nil || grow.Payable != game.LotPrice("cocody", big)-game.LotPrice("cocody", small) {
		t.Fatalf("a second lot, or the first bigger: %+v", one)
	}
	// Two in Cocody: no third there, but Marcory is open.
	two := []Plot{lot(7, "cocody"), lot(8, "cocody")}
	if offers(two, "abidjan", "cocody")[0].Possible {
		t.Fatal("a third lot in the same commune")
	}
	if !offers(two, "abidjan", "marcory")[0].Possible {
		t.Fatal("another commune is open")
	}
	full := make([]Plot, MaxLots)
	for i := range full {
		full[i] = lot(int64(i+1), fmt.Sprint("c", i))
	}
	if offers(full, "abidjan", "marcory")[0].Possible {
		t.Fatal("past MaxLots")
	}
}
