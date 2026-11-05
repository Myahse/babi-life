package sims

import (
	"math"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func shower(start int64) *game.Activity {
	it := game.Interaction{ID: "shower", Label: "Prendre une douche", Minutes: game.Length(20), Effect: game.Needs{Hygiene: 60, Energy: -2}}
	// As start() leaves a played action (the update « gestes-maison »): held a day for its game.
	return &game.Activity{Kind: "do", PlaceID: HomePlaceID, PlaceKind: "home", Interaction: it, Start: start, End: start + playedHold}
}

// Not played (gestes-maison closed): the action keeps its clock and all its good.
func TestAutoPlayTimedUnchanged(t *testing.T) {
	a := shower(100)
	a.End = 101
	autoPlay(a, false)
	if a.Auto != nil || a.End != 101 || a.Interaction.Effect.Hygiene != 60 {
		t.Fatalf("a timed action must stay as it is: %+v", a)
	}
}

// Played: its clock back (never faster than game.Length), its good scaled to AutoScore, costs kept whole.
func TestAutoPlayPlayed(t *testing.T) {
	a := shower(100)
	autoPlay(a, true)
	if a.Auto == nil || a.Auto.Score != AutoScore {
		t.Fatalf("no auto: %+v", a)
	}
	if a.End != 100+game.Length(20) {
		t.Fatalf("end %d, want the clock's %d", a.End, 100+game.Length(20))
	}
	want := math.Round(60*playedWell(AutoScore)*10) / 10
	if a.Interaction.Effect.Hygiene != want || a.Interaction.Effect.Energy != -2 {
		t.Fatalf("effect %+v, want hygiene %v and the cost whole", a.Interaction.Effect, want)
	}
	if a.Interaction.Effect.Hygiene >= 60 {
		t.Fatal("auto must give less than a perfect game")
	}
	// Twice: no double scaling.
	autoPlay(a, true)
	if a.Interaction.Effect.Hygiene != want {
		t.Fatal("scaled twice")
	}
	// Played after all: the whole good back for the game's score.
	unAuto(a)
	if a.Auto != nil || a.Interaction.Effect.Hygiene != 60 {
		t.Fatalf("unAuto: %+v", a)
	}
	n := homeDone(game.Needs{}, a, 100)
	if math.Abs(n.Hygiene-60) > 1e-9 {
		t.Fatalf("a perfect game after auto gives %v, want 60", n.Hygiene)
	}
}

// A paid gig scaled the same way; a défi's own action (an épreuve, a console match) untouched.
func TestAutoPlayPayAndDefis(t *testing.T) {
	gig := &game.Activity{Kind: "do", PlaceKind: "market", Interaction: game.Interaction{ID: "sell-goods", Minutes: 6, Cost: -1200, Effect: game.Needs{Social: 15}}, Start: 0, End: playedHold}
	autoPlay(gig, true)
	if gig.Interaction.Cost != int(math.Round(-1200*playedWell(AutoScore))) {
		t.Fatalf("pay %d", gig.Interaction.Cost)
	}
	match := &game.Activity{Kind: "do", PlaceKind: "home", Interaction: game.Interaction{ID: "maison-foot", Minutes: 1, Effect: game.Needs{Fun: 22}}, Start: 0, End: 1}
	autoPlay(match, true)
	if match.Auto != nil || match.Interaction.Effect.Fun != 22 {
		t.Fatal("a console match is its own défi, not auto-played")
	}
	done := shower(0)
	done.Defi = 80
	autoPlay(done, true)
	if done.Auto != nil {
		t.Fatal("a défi already played can't be auto-played")
	}
}
