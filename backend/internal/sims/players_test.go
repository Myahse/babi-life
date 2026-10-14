package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
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
	if city, cm := birthplace(&lat, &lng, newRand()); city != "abidjan" || cm != "cocody" {
		t.Errorf("born near the player: %s %s", city, cm)
	}
	lat, lng = 48.85, 2.35
	if city, _ := birthplace(&lat, &lng, newRand()); city != "abidjan" {
		t.Errorf("far away: somewhere in Abidjan, got %s", city)
	}
	if city, _ := birthplace(nil, nil, newRand()); city != "abidjan" {
		t.Error("no position: somewhere in Abidjan")
	}
}
