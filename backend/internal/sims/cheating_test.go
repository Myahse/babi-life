package sims

import (
	"math/rand/v2"
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Together with two: found out, the one cheated on leaves or forgives (and
// the lover may go too); with only one, nothing to find out.
func TestCaught(t *testing.T) {
	two := func() Sim {
		s := newSim()
		s.Friends = []game.Friend{
			{ID: "p-a", Name: "Awa", Gender: "femme", Friendship: 80, Partner: true, Home: true, Adult: true, Met: 10},
			{ID: "p-b", Name: "Koffi", Gender: "homme", Friendship: 60, Partner: true, Adult: true, Met: 50},
		}
		return s
	}
	left, forgave, loverLeft := 0, 0, 0
	for seed := uint64(0); seed < 200; seed++ {
		s := two()
		text := s.caught(s.findFriend("p-b"), 1, rand.New(rand.NewPCG(seed, 3)))
		if text == "" || !strings.Contains(text, "Awa") || strings.Contains(text, "{") {
			t.Fatalf("caught: %q", text)
		}
		awa := s.findFriend("p-a")
		switch {
		case !awa.Partner && !awa.Home && awa.Friendship == 35:
			left++
		case awa.Partner && awa.Friendship == 50:
			forgave++
		default:
			t.Fatalf("Awa after: %+v", awa)
		}
		if !s.findFriend("p-b").Partner {
			loverLeft++
		}
	}
	if left == 0 || forgave == 0 || loverLeft == 0 || loverLeft == 200 {
		t.Errorf("left %d, forgave %d, lover left %d of 200", left, forgave, loverLeft)
	}
	// Only one partner: nobody to find out.
	s := newSim()
	s.Friends = []game.Friend{{ID: "p-a", Name: "Awa", Partner: true}}
	if text := s.caught(s.findFriend("p-a"), 1, rand.New(rand.NewPCG(1, 1))); text != "" {
		t.Errorf("caught alone: %q", text)
	}
}

// Asking someone out while together with someone: sometimes they know and
// refuse, sometimes it's yes, and then it's two at once. Only one can move in.
func TestSecondPartner(t *testing.T) {
	p := Passerby{ID: "x-2", Name: "Koffi", Gender: "homme", Seed: 3}
	refused, two := 0, 0
	for seed := uint64(0); seed < 60; seed++ {
		s := newSim()
		s.Friends = []game.Friend{
			{ID: "p-a", Name: "Awa", Gender: "femme", Friendship: 70, Partner: true, Home: true, Adult: true},
			{ID: "p-x-2", Name: "Koffi", Gender: "homme", Friendship: 95, Adult: true},
		}
		ans, err := s.chat(p, "sortir", "", true, rand.New(rand.NewPCG(seed, 7)))
		if err != nil {
			t.Fatal(err)
		}
		if ans.Mood == "bad" {
			refused++
		}
		if len(s.partners()) == 2 {
			two++
			s.Activity = nil
			if ans, _ := s.chat(p, "emmenager", "", true, rand.New(rand.NewPCG(seed, 8))); s.findFriend("p-x-2").Home || ans.Mood != "bad" {
				t.Errorf("moved in with Awa still there: %+v", ans)
			}
		}
	}
	if refused == 0 || two == 0 {
		t.Errorf("refused %d, two at once %d of 60", refused, two)
	}
}
