package world

import (
	"slices"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// L'Afrique: every country has its cities, each its airport and (on the mainland) its gare; the roads between
// neighbours and along the corridor, none to an island nor across the Moroccan–Algerian border; the
// activities at their places; West Africa shares Abidjan's street, not its Éléphants nor its état civil.
func TestAfrique(t *testing.T) {
	byCountry := map[string][]City{}
	for _, c := range Cities {
		if CountryOf(c).Key == AfriqueKey {
			byCountry[c.Country] = append(byCountry[c.Country], c)
		}
	}
	for id := range afriqueCountries {
		if len(byCountry[id]) == 0 {
			t.Errorf("%s: no city", id)
		}
	}
	for _, cs := range byCountry {
		for _, c := range cs {
			if _, ok := game.Airports[c.ID]; !ok {
				t.Errorf("%s: no airport", c.ID)
			}
			if _, ok := game.Gares[c.ID]; !ok && !c.Island {
				t.Errorf("%s: no gare routière", c.ID)
			}
		}
	}
	city := func(id string) City {
		c, ok := FindCity(id)
		if !ok {
			t.Fatalf("no %s", id)
		}
		return c
	}
	for _, r := range []struct {
		a, b string
		road bool
	}{
		{"abidjan", "accra", true},
		{"abidjan", "lagos", true},  // the corridor
		{"accra", "lagos", true},    // the corridor
		{"abidjan", "dakar", true},  // the road of Bamako
		{"abidjan", "niamey", true}, // the road of Ouaga
		{"kumasi", "lagos", false},  // off the corridor, no common border
		{"dakar", "bamako", true},
		{"dakar", "banjul", true},
		{"lagos", "kano", true},
		{"dakar", "praia", false}, // Cabo Verde, islands
		{"praia", "mindelo", false},
		{"casablanca", "alger", false}, // the closed border
		{"rabat", "marrakech", true},
		{"nairobi", "kampala", true},
		{"dar-es-salaam", "zanzibar", false},
		{"johannesburg", "harare", true},
		{"abidjan", "new-york", false},
		{"le-caire", "gizeh", true},
	} {
		if got := SameLand(city(r.a), city(r.b)); got != r.road {
			t.Errorf("road %s – %s: %v, want %v", r.a, r.b, got, r.road)
		}
	}
	// The coaches run where the road does, run by Africa's companies.
	lines := map[string]bool{}
	for _, r := range CoachRoutes() {
		lines[r.From+">"+r.To] = true
		if !SameLand(city(r.From), city(r.To)) {
			t.Errorf("a coach %s → %s with no road", r.From, r.To)
		}
	}
	for _, l := range []string{"abidjan>lagos", "lagos>abidjan", "lome>cotonou", "accra>kumasi", "dakar>bamako"} {
		if !lines[l] {
			t.Errorf("no coach %s", l)
		}
	}
	if co := game.CoachCompanyOf("abidjan", "accra"); co.ID != "corridor" {
		t.Errorf("Abidjan–Accra run by %s", co.Name)
	}
	if co := game.CoachCompanyOf("abidjan", "bouake"); co.ID == "corridor" {
		t.Errorf("Abidjan–Bouaké run by %s", co.Name)
	}
	// The activities at their places, each place of Africa.
	places := map[string]bool{}
	for _, cs := range byCountry {
		for _, c := range cs {
			for _, cm := range c.Communes {
				for _, p := range cm.Places {
					places[p.ID] = true
				}
			}
		}
	}
	for kind, acts := range game.AfriqueActs {
		for _, it := range acts {
			for _, p := range it.Places {
				if !places[p] {
					t.Errorf("%s (%s): no place %s", it.ID, kind, p)
				}
			}
		}
	}
	// The street: West Africa's bargaining and brochettes; the gbairai, the état civil, the Éléphants' match stay home.
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
		{"rue", "gbairai", "dakar", false},
		{"rue", "gbairai", "abidjan", true},
		{"rue", "gbairai", "ouagadougou", true},
		{"restaurant", "plat-kedjenou", "lagos", false},
		{"club", "atalaku", "accra", false},
		{"restaurant", "ng-jollof", "lagos", true},
	} {
		if got := at(c.kind, c.id, c.city); got != c.want {
			t.Errorf("%s at %s: %v, want %v", c.id, c.city, got, c.want)
		}
	}
	for _, h := range game.Happenings {
		switch h.ID {
		case "match", "concert":
			if len(h.Cities) == 0 || slices.Contains(h.Cities, "dakar") {
				t.Errorf("%s in Dakar", h.ID)
			}
		case "tontine":
			if len(h.Cities) > 0 && (!slices.Contains(h.Cities, "dakar") || slices.Contains(h.Cities, "le-caire")) {
				t.Errorf("the tontine: %v", h.Cities)
			}
		}
	}
	// Hidden while closed.
	if !slices.Contains(KeyCommunes(AfriqueKey), "dakar-plateau") || slices.Contains(KeyCommunes(AfriqueKey), "cocody") {
		t.Error("KeyCommunes")
	}
}
