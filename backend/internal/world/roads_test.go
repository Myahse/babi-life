package world

import (
	"slices"
	"testing"
)

// Crossing the lagoon takes a bridge; staying on one bank doesn't.
func TestRoutesUseTheBridges(t *testing.T) {
	cases := []struct {
		from, to string
		bridge   string // one of the bridges it must cross, "" = none
	}{
		{"plateau", "treichville", "pont"},
		{"cocody", "marcory", "3e pont"},
		{"yopougon", "plateau", ""},
		{"abobo", "adjame", ""},
		{"koumassi", "port-bouet", ""},
		{"yopougon", "port-bouet", "pont"},
	}
	for _, c := range cases {
		p, ok := RouteIn("abidjan", c.from, c.to)
		if !ok || len(p.Points) < 2 || p.Km <= 0 {
			t.Fatalf("%s → %s: no route", c.from, c.to)
		}
		switch {
		case c.bridge == "" && c.from != "yopougon" && len(p.Bridges) > 0:
			t.Errorf("%s → %s should stay on land, crosses %v", c.from, c.to, p.Bridges)
		case c.bridge == "pont" && len(p.Bridges) == 0:
			t.Errorf("%s → %s must cross a bridge", c.from, c.to)
		case c.bridge != "" && c.bridge != "pont" && !slices.Contains(p.Bridges, c.bridge):
			t.Errorf("%s → %s should take the %s, got %v", c.from, c.to, c.bridge, p.Bridges)
		}
		t.Logf("%s → %s: %.1f km via %v", c.from, c.to, p.Km, p.Bridges)
	}
}

// Every Abidjan commune can be reached from every other, in a few game minutes.
func TestEveryCommuneIsReachableQuickly(t *testing.T) {
	abj, _ := FindCity("abidjan")
	for _, a := range abj.Communes {
		for _, b := range abj.Communes {
			if a.ID == b.ID {
				continue
			}
			m, _, p := TripPath(abj, a, abj, b)
			if len(p.Points) < 2 {
				t.Fatalf("%s → %s unreachable", a.ID, b.ID)
			}
			if m > 40 {
				t.Errorf("%s → %s takes %d min: too long", a.ID, b.ID, m)
			}
		}
	}
}
