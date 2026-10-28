package sims

import (
	"math/rand/v2"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The first day at the crèche makes the friend from childhood, once; at 18 they're grown up too.
// The mentor helps once a game week at most, within the day's limits.
func TestChildhoodFriendAndMentor(t *testing.T) {
	s := newSimPtr()
	s.GameMinutes = 200000
	s.BornAt = s.GameMinutes - 2
	s.Friends = nil
	if ev := s.toSchool(game.Interaction{ID: "creche"}); ev == nil || s.childhoodFriend() == nil {
		t.Fatal("no friend from the crèche")
	}
	if ev := s.toSchool(game.Interaction{ID: "aller-ecole"}); ev != nil || len(s.Friends) != 1 {
		t.Fatalf("a second friend from childhood: %v %d", ev, len(s.Friends))
	}
	s.comeOfAge(s.GameMinutes)
	if !s.childhoodFriend().Adult {
		t.Fatal("the friend from childhood didn't grow up")
	}
	s.BornAt = s.GameMinutes - game.MinutesToAge(20)
	rng := rand.New(rand.NewPCG(3, 4))
	got, last := 0, int64(0)
	for i := 0; i < 20 && got == 0; i++ {
		_, got, last = s.mentorHelp(0, rand.New(rand.NewPCG(uint64(i), 9)))
	}
	if got <= 0 || last != s.GameMinutes {
		t.Fatalf("the mentor never helped: %d %d", got, last)
	}
	if _, again, _ := s.mentorHelp(last, rng); again != 0 {
		t.Fatal("helped twice the same week")
	}
	if s.mentorAdvice(rng) == "" {
		t.Fatal("no advice")
	}
}
