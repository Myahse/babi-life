package world

import (
	"slices"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// L'Europe: the roads go through land borders (through France to London, never to Reykjavik nor from Abidjan),
// every city has its airport and its city hall, nothing Ivorian in its streets, Matonge and Peckham are there.
func TestEurope(t *testing.T) {
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
		{"bruxelles", "berlin", true},
		{"londres", "berlin", true},
		{"londres", "dublin", true},
		{"lisbonne", "moscou", true},
		{"istanbul", "ankara", true},
		{"madrid", "monaco", true},
		{"reykjavik", "londres", false},
		{"abidjan", "madrid", false},
		{"new-york", "londres", false},
		{"abidjan", "ouagadougou", true},
	} {
		if got := SameLand(city(c.a), city(c.b)); got != c.road {
			t.Errorf("road %s → %s: %v, want %v", c.a, c.b, got, c.road)
		}
	}
	n := 0
	for _, c := range Cities {
		if CountryOf(c).Land != "europe" {
			continue
		}
		n++
		// (France has its own update, « pays-france »: france.go.)
		if k := CountryOf(c).Key; k != game.EuropeKey && !(c.Country == "fr" && k == game.FranceKey) {
			t.Errorf("%s: key %q", c.ID, CountryOf(c).Key)
		}
		if _, ok := game.Airports[c.ID]; !ok {
			t.Errorf("%s: no airport", c.ID)
		}
		for _, cm := range c.Communes {
			if !slices.ContainsFunc(cm.Places, func(p Place) bool { return p.ID == cm.Admin.Mairie }) {
				t.Errorf("%s: no city hall", cm.ID)
			}
		}
	}
	if n < 30 {
		t.Errorf("%d cities in Europe", n)
	}
	if _, cm, ok := FindCommune("bruxelles", "brux-matonge"); !ok || len(cm.Places) < 8 {
		t.Error("no Matonge")
	}
	if _, cm, ok := FindCommune("londres", "ldn-peckham"); !ok || len(cm.Places) < 8 {
		t.Error("no Peckham")
	}
	it, _ := game.Kinds["restaurant"].Interaction("plat-kedjenou")
	if len(it.Cities) == 0 || slices.Contains(it.Cities, "bruxelles") {
		t.Error("the kedjenou of the carte in Brussels")
	}
	if !InEurope("rome") || InEurope("abidjan") {
		t.Error("InEurope")
	}
	if len(EuropeCommunes()) < 40 {
		t.Errorf("%d communes hidden", len(EuropeCommunes()))
	}
}
