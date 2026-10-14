package world

import "testing"

func TestHKBToll(t *testing.T) {
	abj, _ := FindCity("abidjan")
	cocody, _ := abj.Commune("cocody")
	marcory, _ := abj.Commune("marcory")
	treich, _ := abj.Commune("treichville")
	plateau, _ := abj.Commune("plateau")

	// Over the 3e pont: the seat carries a share, the compteur and the apps the whole toll.
	_, seat, path := TripPath(abj, cocody, abj, marcory)
	if TollOf(path.Bridges) != HKBToll {
		t.Fatalf("cocody → marcory should cross the 3e pont: %v", path.Bridges)
	}
	base := seat - HKBToll/TollSeats
	if want := 300 + 50*int(path.Km/3); base != want {
		t.Errorf("seat %d: base %d, want %d", seat, base, want)
	}
	if _, f, _ := CompteurQuote(abj, cocody, marcory); f != max(500, roundTo(float64(base)*2, 50))+HKBToll {
		t.Errorf("compteur %d", f)
	}
	yango, _ := FindRideApp(RideApps[0].ID)
	if _, f, ok := RideQuote(yango, abj, cocody, marcory); ok && f != max(1000, roundTo(float64(base)*3, 100))+HKBToll {
		t.Errorf("app %d", f)
	}
	// Not over it: no toll.
	_, _, p2 := TripPath(abj, plateau, abj, treich)
	if TollOf(p2.Bridges) != 0 {
		t.Errorf("plateau → treichville pays a toll: %v", p2.Bridges)
	}
}
