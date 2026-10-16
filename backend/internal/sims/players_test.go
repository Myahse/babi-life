package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

func TestJoinable(t *testing.T) {
	act := func(place, career string, end int64) *game.Activity {
		return &game.Activity{Kind: "do", PlaceID: place, Career: career, End: end, Interaction: game.Interaction{ID: "eat-garba"}}
	}
	for _, c := range []struct {
		a    *game.Activity
		want bool
	}{
		{act("yop-maquis", "", 100), true},
		{act("yop-maquis", "", 50), false}, // over
		{act("yop-maquis", "maquis", 100), false},
		{act(HomePlaceID, "", 100), false},
		{act(custodyPlace, "", 100), false},
		{&game.Activity{Kind: "travel", End: 100}, false},
		{nil, false},
	} {
		if got := joinable(c.a, 60); got != c.want {
			t.Errorf("%+v: %v", c.a, got)
		}
	}
	if a, b := pair("b", "a"); a != "a" || b != "b" {
		t.Error("bonds keep the smaller ID first")
	}
}

func TestBirthplace(t *testing.T) {
	lat, lng := 5.3950, -3.9850 // Angré
	if city, cm := birthplace(&lat, &lng, "", "", newRand()); city != "abidjan" || cm != "cocody" {
		t.Errorf("born near the player: %s %s", city, cm)
	}
	// In the country, the position wins over what the player says.
	if _, cm := birthplace(&lat, &lng, "abidjan", "yopougon", newRand()); cm != "cocody" {
		t.Errorf("in the country, born where the player is, got %s", cm)
	}
	// From abroad: the commune the player comes from.
	lat, lng = 48.85, 2.35 // Paris
	if city, cm := birthplace(&lat, &lng, "abidjan", "yopougon", newRand()); city != "abidjan" || cm != "yopougon" {
		t.Errorf("from abroad, born in the chosen commune: %s %s", city, cm)
	}
	if city, cm := birthplace(nil, nil, "bouake", "bouake-centre", newRand()); city != "bouake" || cm != "bouake-centre" {
		t.Errorf("no position, chosen Bouaké: %s %s", city, cm)
	}
	// Unknown or nothing chosen: any commune of the game.
	for range 50 {
		city, cm := birthplace(&lat, &lng, "paris", "marais", newRand())
		c, ok := world.FindCity(city)
		if !ok {
			t.Fatalf("unknown city %s", city)
		}
		if _, ok := c.Commune(cm); !ok {
			t.Fatalf("unknown commune %s in %s", cm, city)
		}
	}
	cities := map[string]bool{}
	for range 300 {
		city, _ := birthplace(nil, nil, "", "", newRand())
		cities[city] = true
	}
	if len(cities) < 2 {
		t.Errorf("at random, always the same city: %v", cities)
	}
}
