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
