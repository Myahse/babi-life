package sims

import (
	"math/rand/v2"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// lucky: a seeded generator whose first draw is high, so the risky thing
// (the police) doesn't happen.
func lucky() *rand.Rand { return seeded(func(f float64) bool { return f > 0.9 }) }

// unlucky: the first draw is low, so the risky thing happens.
func unlucky() *rand.Rand { return seeded(func(f float64) bool { return f < 0.1 }) }

func seeded(first func(float64) bool) *rand.Rand {
	for seed := uint64(1); ; seed++ {
		if first(rand.New(rand.NewPCG(seed, 7)).Float64()) {
			return rand.New(rand.NewPCG(seed, 7))
		}
	}
}

// until finds a seed for which happened() is true after f ran (fresh Sim each time).
func until(t *testing.T, make func() *Sim, f func(*Sim, *rand.Rand), happened func(*Sim) bool) *Sim {
	for seed := uint64(1); seed < 500; seed++ {
		s := make()
		f(s, rand.New(rand.NewPCG(seed, 3)))
		if happened(s) {
			return s
		}
	}
	t.Fatal("never happened")
	return nil
}

func TestMeetingFriends(t *testing.T) {
	foot, _ := game.Kinds["sport"].Interaction("play-football")
	s := until(t, func() *Sim { x := newSim(); return &x }, func(s *Sim, r *rand.Rand) { s.socialize(foot, r) }, func(s *Sim) bool { return len(s.Friends) == 1 })
	f := s.Friends[0].Friendship
	if _, err := s.meetFriend(s.Friends[0].ID, "trainer"); err != nil || s.Friends[0].Friendship <= f {
		t.Errorf("hanging out grows friendship: %v %d", err, s.Friends[0].Friendship)
	}
	if _, err := s.meetFriend("nobody", "appeler"); err != errNoFriend {
		t.Errorf("unknown friend: %v", err)
	}
	// A month apart, friendship fades.
	before := s.Friends[0].Friendship
	game.FadeFriends(s.Friends, s.GameMinutes+30*24*60)
	if s.Friends[0].Friendship >= before {
		t.Error("friends fade when not seen")
	}
}

func TestTheStreetGang(t *testing.T) {
	// A teenager from a poor family, hanging around.
	teen := func(family string) func() *Sim {
		return func() *Sim { x := newBaby(family); x.GameMinutes = x.BornAt + 14*game.YearMinutes; return &x }
	}
	foot, _ := game.Kinds["sport"].Interaction("play-football")
	s := until(t, teen("coule"), func(s *Sim, r *rand.Rand) { s.socialize(foot, r) }, func(s *Sim) bool { return s.Gang == "invited" })
	for seed := uint64(1); seed < 300; seed++ {
		rich := teen("late")()
		rich.socialize(foot, rand.New(rand.NewPCG(seed, 3)))
		if rich.Gang != "" {
			t.Fatal("a laté kid isn't recruited by the bande")
		}
	}

	if _, _, err := s.gangAction("accepter", lucky()); err != nil || s.Gang != "member" {
		t.Fatalf("join: %v %q", err, s.Gang)
	}
	// A coup that works: money.
	money := s.Money
	if _, got, err := s.gangAction("coup", lucky()); err != nil || got <= 0 || s.Money != money+got {
		t.Fatalf("a coup pays: %v %d", err, got)
	}
	s.Activity = nil
	// A coup that goes wrong: custody, a record, no way out early.
	if _, _, err := s.gangAction("coup", unlucky()); err != nil || s.Record != 1 || s.Activity == nil || s.Activity.PlaceID != custodyPlace {
		t.Fatalf("caught: %v record %d act %+v", err, s.Record, s.Activity)
	}
	if _, err := s.stop(); err != errInCustody {
		t.Errorf("can't walk out of custody: %v", err)
	}
	s.Activity = nil
	if _, _, err := s.gangAction("quitter", nil); err != nil || s.Gang != "left" {
		t.Errorf("leaving the bande: %v %q", err, s.Gang)
	}
	for _, f := range s.Friends {
		if f.Gang {
			t.Error("the bande's boys are gone with it")
		}
	}
}
