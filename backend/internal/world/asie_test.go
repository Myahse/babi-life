package world

import (
	"slices"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// L'Asie: the roads go through land borders (Pékin to Hanoi, Bangkok, Singapore, Delhi, Moscow; never to Tokyo from
// the mainland, nor to Manila, Bali or Colombo; Tokyo to Kyoto yes; never across the Korean border), every city has
// its airport and its city hall, nothing Ivorian in its streets, Xiaobei is there.
func TestAsie(t *testing.T) {
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
		{"pekin", "shanghai", true},
		{"pekin", "hanoi", true},
		{"canton", "hong-kong", true},
		{"bangkok", "singapour", true},
		{"kuala-lumpur", "singapour", true},
		{"new-delhi", "katmandou", true},
		{"karachi", "dacca", true},
		{"tachkent", "almaty", true},
		{"pekin", "moscou", true},
		{"astana", "berlin", true},
		{"tokyo", "kyoto", true},
		{"tokyo", "pekin", false},
		{"seoul", "pekin", false},
		{"manille", "pekin", false},
		{"denpasar", "jakarta", false},
		{"colombo", "new-delhi", false},
		{"jakarta", "singapour", false},
		{"bandar-seri-begawan", "kuala-lumpur", false},
		{"abidjan", "pekin", false},
		{"new-york", "tokyo", false},
	} {
		if got := SameLand(city(c.a), city(c.b)); got != c.road {
			t.Errorf("road %s → %s: %v, want %v", c.a, c.b, got, c.road)
		}
	}
	n := 0
	for _, c := range Cities {
		if CountryOf(c).Land != "asie" {
			continue
		}
		n++
		if CountryOf(c).Key != game.AsieKey {
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
	if n < 35 {
		t.Errorf("%d cities in Asia", n)
	}
	if _, cm, ok := FindCommune("canton", "gz-xiaobei"); !ok || len(cm.Places) < 8 {
		t.Error("no Xiaobei")
	}
	it, _ := game.Kinds["restaurant"].Interaction("plat-kedjenou")
	if len(it.Cities) == 0 || slices.Contains(it.Cities, "tokyo") {
		t.Error("the kedjenou of the carte in Tokyo")
	}
	if !InAsia("hanoi") || InAsia("abidjan") || InAsia("moscou") {
		t.Error("InAsia")
	}
	if len(AsieCommunes()) < 70 {
		t.Errorf("%d communes hidden", len(AsieCommunes()))
	}
	// Lumio: Pékin to Shanghai from the station, not to Tokyo.
	pk := city("pekin")
	dc, _ := pk.Commune("pekin-dongcheng")
	if r, err := AsiaRailTripFrom(pk, dc, city("shanghai"), 8*60); err != nil || r.Fare < 20000 {
		t.Errorf("Lumio Pékin → Shanghai: %v %+v", err, r)
	}
	if _, err := AsiaRailTripFrom(pk, dc, city("tokyo"), 8*60); err == nil {
		t.Error("a Lumio across the sea")
	}
}
