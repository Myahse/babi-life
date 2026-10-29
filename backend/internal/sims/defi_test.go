package sims

import (
	"math"
	"slices"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Each défi is played during its own activities only.
func TestDefiOf(t *testing.T) {
	for id, want := range map[string]string{"street-grin": "the", "street-the": "", "chat-grin": "the", "ski-boulay": "ski", "supermarche": "courses", "courses": "courses", "shower": "douche", "sleep": "dodo", "nap": "dodo", "cook-attieke": "cuisine", "jouer-cour": "cour", "frigo-garba": "repas", "eat-garba": "garba", "eat-alloco": "alloco", "caca": "caca", "bain-bebe": "bain", "calin": "calin", "jouets": "", "watch-tv": "", "chat-dance": "",
		"console-foot": "foot", "console-defi": "foot", "tournoi-console": "foot", "console-course": "course", "console-combat": "combat", "borne-arcade": "arcade", "regarder-console": ""} {
		if got := defiOf(id); got != want {
			t.Errorf("%s: %q, want %q", id, got, want)
		}
	}
}

// A better score earns more, and never much: a made-up score buys little.
func TestDefiReward(t *testing.T) {
	for _, kind := range []string{"the", "ski", "courses", "foot", "course", "combat", "arcade"} {
		low, lowBack, _ := defiReward(kind, "", 10, 8000)
		high, highBack, _ := defiReward(kind, "", 100, 8000)
		if low.Social+low.Fun+low.Hunger > high.Social+high.Fun+high.Hunger || lowBack > highBack {
			t.Errorf("%s: 10 earns more than 100", kind)
		}
		if high.Social > 15 || high.Fun > 20 || highBack > 8000/5 {
			t.Errorf("%s: too much for a perfect score: %+v, %d back", kind, high, highBack)
		}
	}
	// The money back on the shopping is a round sum, and only on the shopping.
	if _, back, _ := defiReward("courses", "", 87, 8000); back%50 != 0 || back == 0 {
		t.Errorf("courses: %d back", back)
	}
	if _, back, _ := defiReward("the", "", 100, 100); back != 0 {
		t.Errorf("the: %d back", back)
	}
}

// The challenge where the loser pays: won, both stakes; level, one's own back; lost, nothing.
// The tournament: the cup and the final paid, the rest not; a plain match pays nothing.
func TestDefiStakes(t *testing.T) {
	for _, c := range []struct {
		id          string
		score, back int
	}{
		{"console-defi", 75, 800}, {"console-defi", 50, 400}, {"console-defi", 30, 0},
		{"tournoi-console", 100, tournamentWin}, {"tournoi-console", 70, tournamentFinal}, {"tournoi-console", 40, 0}, {"tournoi-console", 5, 0},
		{"console-foot", 100, 0},
	} {
		cost := 400
		if c.id == "tournoi-console" {
			cost = 1000
		}
		if _, back, text := defiReward("foot", c.id, c.score, cost); back != c.back || text == "" {
			t.Errorf("%s at %d: %d back (%q), want %d", c.id, c.score, back, text, c.back)
		}
	}
}

// The home's gestures are the action itself: played, all its good is there at once (a little less
// played badly), and nothing more comes after.
func TestHomeGestures(t *testing.T) {
	sleep := game.Interaction{ID: "sleep", Effect: game.Needs{Energy: 100}}
	for _, c := range []struct {
		score   int
		applied float64
		want    float64
	}{{100, 0, 100}, {0, 0, 60}, {100, 0.5, 50}, {50, 1, 0}} {
		a := &game.Activity{Kind: "do", Interaction: sleep, Applied: c.applied}
		got := homeDone(game.Needs{}, a, c.score)
		if math.Abs(got.Energy-c.want) > 0.01 || a.Applied != 1 {
			t.Errorf("score %d, %.1f done: energy %.1f (want %.1f), applied %.2f", c.score, c.applied, got.Energy, c.want, a.Applied)
		}
	}
}

// What an action costs (the tummy emptied by caca) is all there however it's played.
func TestHomeGestureCost(t *testing.T) {
	a := &game.Activity{Kind: "do", Interaction: game.Interaction{ID: "caca", Effect: game.Needs{Hunger: -30, Fun: 10}}}
	got := homeDone(game.Needs{Hunger: 80}, a, 0)
	if got.Hunger != 50 || math.Abs(got.Fun-6) > 0.01 {
		t.Errorf("caca played badly: %+v", got)
	}
	for kind := range homeLines {
		if kind == "geste" {
			continue
		}
		if _, ok := defiFor[kind]; !ok || !slices.Contains(homeDefis, kind) {
			t.Errorf("%s: lines but no défi", kind)
		}
	}
}

// Any action can be played as gestures, but never paid work, a talk, a day at school or what has its own game.
func TestGesteOK(t *testing.T) {
	do := func(it game.Interaction) *game.Activity { return &game.Activity{Kind: "do", Interaction: it} }
	if !gesteOK(do(game.Interaction{ID: "eat-poulet-braise", Minutes: 45, Cost: 3500})) {
		t.Error("eating a poulet braisé: not played")
	}
	work := do(game.Interaction{ID: "work-shift", Minutes: 60})
	work.Career = "vendeur"
	chat := do(game.Interaction{ID: "chat-salut", Minutes: 5})
	chat.PlaceKind = "chat"
	for name, a := range map[string]*game.Activity{
		"paid":   do(game.Interaction{ID: "odd-job", Minutes: 60, Cost: -2000}),
		"work":   work,
		"chat":   chat,
		"school": do(game.Interaction{ID: "aller-ecole", Minutes: 300}),
		"long":   do(game.Interaction{ID: "visit-long", Minutes: 240}),
		"slots":  do(game.Interaction{ID: game.SlotsMaquisID, Minutes: 60}),
		"tea":    do(game.Interaction{ID: "street-grin", Minutes: 30}),
	} {
		if gesteOK(a) {
			t.Errorf("%s: played as gestures", name)
		}
	}
}

// The alloco's egg: paid and eaten, or not when the money's not there.
func TestAllocoEgg(t *testing.T) {
	s := &Sim{}
	s.Money = 500
	if allocoWithEgg(s, "Bon."); s.Money != 400 || s.Needs.Hunger != allocoEggFill {
		t.Errorf("with 500: %d left, hunger %.0f", s.Money, s.Needs.Hunger)
	}
	poor := &Sim{}
	poor.Money = 50
	if allocoWithEgg(poor, "Bon."); poor.Money != 50 {
		t.Errorf("with 50: %d left", poor.Money)
	}
}

// The bar: the rounds and the banknotes paid as far as the money goes, too many rounds not counted, being drunk costs.
func TestBarNight(t *testing.T) {
	s := &Sim{}
	s.Money = 3000
	_, spent := barNight(s, "tournees:2;billets:1500", "Bon.")
	if spent != 2500 || s.Money != 500 {
		t.Errorf("2 rounds + 1500: spent %d, %d left", spent, s.Money)
	}
	poor := &Sim{}
	poor.Money = 700
	if _, spent := barNight(poor, "tournees:99;billets:99999;soul", "Bon."); spent != 700 || poor.Money != 0 || poor.Needs.Energy != 0 {
		t.Errorf("poor and drunk: spent %d, %d left, %+v", spent, poor.Money, poor.Needs)
	}
}

// A ride in town over at once: the Sim is there, in the trip's commune; the plane and one's own car are not.
func TestArriveNow(t *testing.T) {
	now := time.Now()
	s := &Sim{}
	s.GameMinutes = game.MinuteOf(now)
	s.City, s.Commune = "abidjan", "cocody"
	s.Activity = &game.Activity{Kind: "travel", Start: s.GameMinutes, End: s.GameMinutes + 40, Trip: &game.Trip{City: "abidjan", Commune: "yopougon", Mode: "gbaka"}}
	s.Activity.End = min(s.Activity.End, s.GameMinutes)
	s.lastTick = now
	s.advance(now, newRand())
	if s.Activity != nil || s.Commune != "yopougon" {
		t.Errorf("after the quick ride: %+v in %s", s.Activity, s.Commune)
	}
	if quickRide("avion") || quickRide("perso") || !quickRide("taxi") {
		t.Error("quickRide: the plane or one's own car can be skipped")
	}
}

// A défi played ends its activity at once: the Sim is free in the answer itself.
func TestDefiEndsActivity(t *testing.T) {
	s := &Sim{}
	s.GameMinutes = game.MinuteOf(time.Now())
	s.Activity = &game.Activity{Kind: "do", PlaceID: "home", PlaceKind: "home", Interaction: game.Interaction{ID: "shower", Minutes: 20, Effect: game.Needs{Hygiene: 60}}, Start: s.GameMinutes, End: s.GameMinutes + 20}
	s.Needs = homeDone(s.Needs, s.Activity, 100)
	s.Activity.End = min(s.Activity.End, s.GameMinutes)
	s.advanceTo(s.GameMinutes, newRand())
	if s.Activity != nil || s.Needs.Hygiene != 60 {
		t.Errorf("after the shower played: %+v, hygiene %.0f", s.Activity, s.Needs.Hygiene)
	}
}
