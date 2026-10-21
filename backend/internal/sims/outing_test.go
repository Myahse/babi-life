package sims

import (
	"math/rand/v2"
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Out to the maquis with friends: those who come are along the whole time,
// closer after, and the Sim pays for them.
func TestOuting(t *testing.T) {
	friends := func() []game.Friend {
		return []game.Friend{
			{ID: "p-in-yop-maquis-6", Name: "Ibrahim", Gender: "homme", Friendship: 100},
			{ID: "p-x-2", Name: "Affoué", Gender: "femme", Friendship: 20, Partner: true, Adult: true},
			{ID: "p-x-3", Name: "Yao", Gender: "homme", Friendship: 0},
		}
	}
	poulet, _ := game.Kinds["maquis"].Interaction("eat-poulet-braise")
	sawRefusal := false
	for seed := uint64(0); seed < 40; seed++ {
		s := newSim()
		s.Money = 50000
		s.Friends = friends()
		came, refused, _, err := s.goOut("yop-maquis", "eat-poulet-braise", []string{"p-in-yop-maquis-6", "p-x-2", "p-x-3", "p-x-3", "nobody"}, rand.New(rand.NewPCG(seed, 1)))
		if err != nil {
			t.Fatal(err)
		}
		if len(came)+len(refused) != 3 {
			t.Fatalf("asked three (one twice, one unknown): %d came, %d refused", len(came), len(refused))
		}
		sawRefusal = sawRefusal || len(refused) > 0
		a := s.Activity
		if len(a.With) != len(came) {
			t.Fatalf("along: %v, came %d", a.With, len(came))
		}
		if want := 50000 - poulet.Cost*(1+len(came)); s.Money != want {
			t.Errorf("money %d, want %d (the Sim pays for everyone)", s.Money, want)
		}
		if len(came) > 0 {
			if !strings.Contains(a.Interaction.Label, came[0].Name) || a.Interaction.Effect.Social <= poulet.Effect.Social {
				t.Errorf("an outing with friends: %q %+v", a.Interaction.Label, a.Interaction.Effect)
			}
			for _, before := range friends() {
				if f := s.findFriend(before.ID); f.ID == came[0].ID && f.Friendship != min(100, before.Friendship+map[bool]int{false: outingFriendship, true: outingDate}[before.Partner]) {
					t.Errorf("not closer: %d → %d", before.Friendship, f.Friendship)
				}
			}
		}
	}
	if !sawRefusal {
		t.Error("a friend at 0 never said no in 40 outings")
	}
	// Not an outing: home, work.
	s := newSim()
	s.Friends = friends()
	if _, _, _, err := s.goOut(HomePlaceID, "sleep", []string{"p-x-2"}, rand.New(rand.NewPCG(1, 1))); err != errOutingWhere {
		t.Errorf("home: %v", err)
	}
	// Not enough for everyone's bill: nothing starts.
	s = newSim()
	s.Money = poulet.Cost + 10
	s.Friends = []game.Friend{{ID: "p-a", Name: "Awa", Friendship: 100, Partner: true}}
	var err error
	for seed := uint64(0); seed < 10 && err == nil; seed++ {
		t2 := newSim()
		t2.Money, t2.Friends = s.Money, s.Friends
		_, _, _, err = t2.goOut("yop-maquis", "eat-poulet-braise", []string{"p-a"}, rand.New(rand.NewPCG(seed, 1)))
	}
	if err != errOutingBill {
		t.Errorf("short of money: %v", err)
	}
}
