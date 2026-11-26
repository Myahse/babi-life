package world

import (
	"slices"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The Americas' roads: Canada to Panama by road (the Mexican border too), South America apart (the Darién
// Gap), Hispaniola shared, the other islands by plane; every city an airport; nothing Ivorian there.
func TestAmeriquesRoads(t *testing.T) {
	city := func(id string) City {
		c, ok := FindCity(id)
		if !ok {
			t.Fatalf("no %s", id)
		}
		return c
	}
	for _, c := range []struct {
		a, b string
		road bool
	}{
		{"mexico", "houston", true}, {"toronto", "new-york", true}, {"panama", "mexico", true},
		{"panama", "bogota", false}, {"bogota", "buenos-aires", true}, {"sao-paulo", "lima", true},
		{"port-au-prince", "saint-domingue", true}, {"port-au-prince", "mexico", false},
		{"la-havane", "mexico", false}, {"kingston", "miami", false}, {"fort-de-france", "pointe-a-pitre", false},
		{"rio-de-janeiro", "abidjan", false},
	} {
		if got := SameLand(city(c.a), city(c.b)); got != c.road {
			t.Errorf("road %s – %s: %v, want %v", c.a, c.b, got, c.road)
		}
	}
	for _, c := range ameriques {
		if _, ok := game.Airports[c.ID]; !ok {
			t.Errorf("%s: no airport", c.ID)
		}
		if !InAmerica(c.ID) {
			t.Errorf("%s: not in America", c.ID)
		}
	}
	// Hidden while closed: Canada's new cities with Montréal, the rest with « pays-ameriques ».
	if ca := CountryCommunes("ca"); !slices.Contains(ca, "toronto-centre") || !slices.Contains(ca, "mtl-dorval") {
		t.Error("Toronto not under pays-canada")
	}
	if am := AmeriquesCommunes(); !slices.Contains(am, "rio-copacabana") || !slices.Contains(am, "pap-centre") || slices.Contains(am, "toronto-centre") {
		t.Error("pays-ameriques communes wrong")
	}
}
