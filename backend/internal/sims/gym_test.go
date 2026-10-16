package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func TestAtGym(t *testing.T) {
	gym := game.Kinds["gym"]
	session, _ := gym.Interaction("musculation")
	month, _ := gym.Interaction(game.GymMembershipID)

	s := &Sim{GameMinutes: 10 * 24 * 60}
	if it, err := s.atGym(session); err != nil || it.Cost != game.GymSession {
		t.Fatalf("no membership: %+v %v", it, err)
	}
	if _, err := s.atGym(month); err != nil {
		t.Fatalf("buying the month: %v", err)
	}
	s.gymUntil = s.GameMinutes + gymMonth
	if it, err := s.atGym(session); err != nil || it.Cost != 0 {
		t.Fatalf("member pays %d (%v)", it.Cost, err)
	}
	if _, err := s.atGym(month); err == nil {
		t.Fatal("bought the month twice")
	}
	if ev := gymEvents(s, month); len(ev) != 1 || ev[0].Kind != "abonnement" || ev[0].Money != -game.GymMonth {
		t.Fatalf("journal: %+v", ev)
	}
	s.GameMinutes = s.gymUntil + 1
	if it, _ := s.atGym(session); it.Cost != game.GymSession {
		t.Fatal("membership never ran out")
	}
}
