package sims

import (
	"math"
	"testing"
)

// The distances the map's spots are checked with: a degree of latitude is about 111 km, a little less in longitude at Abidjan.
func TestMetres(t *testing.T) {
	if d := metres(5.35, -4.0, 5.36, -4.0); math.Abs(d-1112) > 5 {
		t.Errorf("0.01° of latitude: %.0f m", d)
	}
	if d := metres(5.35, -4.0, 5.35, -3.99); math.Abs(d-1107) > 5 {
		t.Errorf("0.01° of longitude: %.0f m", d)
	}
	if metres(5.35, -4.0, 5.35, -4.0) != 0 {
		t.Error("the same point")
	}
}
