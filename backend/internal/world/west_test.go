package world

import (
	"slices"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Over the ocean, nothing of the Ivorian carte nor of its streets; their own activities there; Abidjan keeps its own.
func TestWestNotIvorian(t *testing.T) {
	at := func(kind, id, city string) bool {
		it, ok := game.Kinds[kind].Interaction(id)
		if !ok {
			t.Fatalf("%s: no %s", kind, id)
		}
		return len(it.Cities) == 0 || slices.Contains(it.Cities, city)
	}
	for _, c := range []struct {
		kind, id, city string
		want           bool
	}{
		{"restaurant", "plat-kedjenou", "new-york", false},
		{"restaurant", "plat-kedjenou", "abidjan", true},
		{"club", "atalaku", "montreal", false},
		{"rue", "gbairai", "new-york", false},
		{"restaurant", "burger", "new-york", true},
		{"restaurant", "nyc-pizza-part", "new-york", true},
		{"club", "party", "montreal", true},
		{"restaurant", "plat-kedjenou", "paris", false},
		{"rue", "gbairai", "marseille", false},
		{"restaurant", "paris-cafe-terrasse", "paris", true},
		{"maquis", "paris-maquis-garba", "paris", true},
	} {
		if got := at(c.kind, c.id, c.city); got != c.want {
			t.Errorf("%s at %s: %v, want %v", c.id, c.city, got, c.want)
		}
	}
	for _, h := range game.Happenings {
		if h.ID == "concert" && (len(h.Cities) == 0 || slices.Contains(h.Cities, "new-york")) {
			t.Error("the coupé-décalé concert happens in New York")
		}
		if h.ID == "pluie" && len(h.Cities) > 0 {
			t.Error("no rain in New York?")
		}
	}
	// No maquis over there: the places are the cities' own.
	for _, c := range Cities {
		if !InAmerica(c.ID) {
			continue
		}
		for _, cm := range c.Communes {
			for _, p := range cm.Places {
				if p.Kind == "maquis" {
					t.Errorf("%s: a maquis in %s", p.Name, c.Name)
				}
			}
		}
	}
}
