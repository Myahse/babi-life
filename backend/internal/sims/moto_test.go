package sims

import "testing"

// The fare goes with the distance, the same as the phone shows (web world3d/moto.ts).
func TestMotoFare(t *testing.T) {
	for _, c := range [][2]int{{220, 300}, {500, 300}, {501, 400}, {1200, 500}, {20000, 4200}} {
		if got := motoFare(c[0]); got != c[1] {
			t.Errorf("%d m: %d, want %d", c[0], got, c[1])
		}
	}
}

// Each ride in the commune, its fare; the woro-woro only where the commune has one.
func TestRidesInTheCommune(t *testing.T) {
	if rideFare("taxi", 1200) <= rideFare("moto", 1200) || rideFare("gbaka", 1200) >= rideFare("woro", 1200) || rideFare("woro", 1200) >= rideFare("moto", 1200) {
		t.Errorf("fares: taxi %d, moto %d, woro %d, gbaka %d", rideFare("taxi", 1200), rideFare("moto", 1200), rideFare("woro", 1200), rideFare("gbaka", 1200))
	}
	if !rideHere("woro", "abidjan", "yopougon") || rideHere("woro", "abidjan", "plateau") {
		t.Error("the woro-woro: Yopougon's yes, none at the Plateau")
	}
	if !rideHere("gbaka", "abidjan", "abobo") || rideHere("gbaka", "bouake", "") || !rideHere("moto", "bouake", "") || rideHere("avion", "abidjan", "yopougon") {
		t.Error("the gbaka in Abidjan; the moto-taxi anywhere; no plane in the street")
	}
}
