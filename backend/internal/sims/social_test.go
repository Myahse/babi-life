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
		return func() *Sim { x := newBaby(family); x.GameMinutes = x.BornAt + game.MinutesToAge(14); return &x }
	}
	foot, _ := game.Kinds["sport"].Interaction("play-football")
	s := until(t, teen("coule"), func(s *Sim, r *rand.Rand) { s.socialize(foot, r) }, func(s *Sim) bool { return s.Gang == "invited" })
	// Any family can be approached, but struggling ones far more often.
	invited := func(family string) (n int) {
		for seed := uint64(1); seed < 2000; seed++ {
			x := teen(family)()
			x.socialize(foot, rand.New(rand.NewPCG(seed, 3)))
			if x.Gang == "invited" {
				n++
			}
		}
		return n
	}
	poor, rich := invited("gnambro"), invited("debout")
	if rich == 0 || poor < 5*rich {
		t.Errorf("the bande recruits everywhere, mostly among the poor: gnambro %d, debout %d", poor, rich)
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
	// One coup a day for the account.
	if _, _, err := s.gangAction("coup", lucky()); err == nil {
		t.Fatal("a second coup the same day")
	}
	s.GameMinutes += 24 * 60
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

func TestHairdos(t *testing.T) {
	s := newSim()
	s.Look.Hair, s.Look.Beard = "afro", "none"
	s.restyle("degrade")
	if s.Look.Hair != "degrade" || s.Look.Beard != "none" {
		t.Errorf("a dégradé, with its line: %+v", s.Look)
	}
	s.restyle("coupe-courte")
	if s.Look.Hair != "short" {
		t.Errorf("a short cut: %+v", s.Look)
	}
	for id, hair := range map[string]string{"iroquoise": "mohawk", "nattes": "cornrows", "vanilles": "twists", "macarons": "puffs", "carre": "bob"} {
		s.restyle(id)
		if s.Look.Hair != hair {
			t.Errorf("%s gives %s, not %s", id, s.Look.Hair, hair)
		}
	}
	s.restyle("tresses")
	s.restyle("taille-barbe")
	if s.Look.Hair != "braids" || s.Look.Beard != "bouc" {
		t.Errorf("braids and a trimmed beard: %+v", s.Look)
	}
	s.restyle("play-football")
	if s.Look.Hair != "braids" {
		t.Error("only the barbier and the salon change the look")
	}
	// Every hairdo is one the barbier or the salon offers.
	for id := range game.Hairdos {
		if _, ok := game.Kinds["barbier"].Interaction(id); !ok {
			if _, ok := game.Kinds["salon"].Interaction(id); !ok {
				t.Errorf("hairdo %s is offered nowhere", id)
			}
		}
	}
	// Anyone can sit at the barbier or the salon.
	for _, k := range []string{"barbier", "salon"} {
		if _, ok := game.Kinds[k].Interaction("gbairai"); !ok {
			t.Errorf("gbairai at the %s", k)
		}
	}
}
