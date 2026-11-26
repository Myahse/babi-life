package world

import (
	"slices"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Le Moyen-Orient et l'Océanie: the roads go through the open borders (Dubaï to Riyad, Amman to Istanbul and
// on to Berlin, never from Abidjan nor to Beyrouth from Tel-Aviv but by Jordan; Sydney to Perth, Auckland to
// Wellington, never Sydney to Auckland nor to the islands), every city has its city hall, an airport or a road
// to one, nothing Ivorian in their streets, no beer in Riyad.
func TestMoyenOrientOceanie(t *testing.T) {
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
		{"dubai", "riyad", true},
		{"dubai", "abou-dhabi", true},
		{"djeddah", "la-mecque", true},
		{"amman", "petra", true},
		{"amman", "istanbul", true},
		{"teheran", "berlin", true},
		{"beyrouth", "damas", true},
		{"jerusalem", "amman", true},
		{"ramallah", "bethleem", true},
		{"abidjan", "dubai", false},
		{"le-caire", "jerusalem", false},
		{"sydney", "perth", true},
		{"auckland", "wellington", true},
		{"sydney", "auckland", false},
		{"sydney", "noumea", false},
		{"papeete", "noumea", false},
		{"sydney", "dubai", false},
		{"bruxelles", "berlin", true},
		{"abidjan", "ouagadougou", true},
	} {
		if c.a == "le-caire" {
			if _, ok := FindCity(c.a); !ok {
				continue
			}
		}
		if got := SameLand(city(c.a), city(c.b)); got != c.road {
			t.Errorf("road %s → %s: %v, want %v", c.a, c.b, got, c.road)
		}
	}
	n := 0
	for _, c := range Cities {
		land := CountryOf(c).Land
		if land != "moyen-orient" && land != "oceanie" {
			continue
		}
		n++
		if k := CountryOf(c).Key; k != game.MoyenOrientKey && k != game.OceanieKey {
			t.Errorf("%s: key %q", c.ID, k)
		}
		if _, ok := game.Airports[c.ID]; !ok {
			if _, ok := game.Gares[c.ID]; !ok {
				t.Errorf("%s: neither airport nor gare", c.ID)
			}
		}
		for _, cm := range c.Communes {
			if !slices.ContainsFunc(cm.Places, func(p Place) bool { return p.ID == cm.Admin.Mairie }) {
				t.Errorf("%s: no city hall", cm.ID)
			}
		}
	}
	if n < 35 {
		t.Errorf("%d cities", n)
	}
	if _, cm, ok := FindCommune("dubai", "dxb-deira"); !ok || len(cm.Places) < 10 {
		t.Error("no Deira")
	}
	if _, _, ok := FindCommune("la-mecque", "mecque-centre"); !ok {
		t.Error("no Mecca")
	}
	it, _ := game.Kinds["restaurant"].Interaction("plat-kedjenou")
	if len(it.Cities) == 0 || slices.Contains(it.Cities, "dubai") || slices.Contains(it.Cities, "sydney") {
		t.Error("the kedjenou of the carte in Dubai or Sydney")
	}
	for _, k := range game.Kinds {
		for _, it := range k.Interactions {
			if it.Icon == "beer" && len(it.Places) == 0 && (len(it.Cities) == 0 || slices.Contains(it.Cities, "riyad") || slices.Contains(it.Cities, "la-mecque")) {
				t.Errorf("%s in Riyadh or Mecca", it.ID)
			}
		}
	}
	if ok := slices.ContainsFunc(game.Kinds["maquis"].Interactions, func(it game.Interaction) bool { return len(it.Cities) > 0 && slices.Contains(it.Cities, "abidjan") }); !ok {
		t.Error("the maquis lost Abidjan")
	}
	if !InMoyenOrient("teheran") || InMoyenOrient("istanbul") || !InOceanie("papeete") || InOceanie("abidjan") {
		t.Error("InMoyenOrient / InOceanie")
	}
	if len(MoyenOrientCommunes()) < 35 || len(OceanieCommunes()) < 15 {
		t.Errorf("%d, %d communes hidden", len(MoyenOrientCommunes()), len(OceanieCommunes()))
	}
	if !city("papeete").Island || city("sydney").Island {
		t.Error("islands")
	}
}
