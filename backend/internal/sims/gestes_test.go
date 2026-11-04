package sims

import (
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// A street gesture: paid for what's bought, once per cooldown, within its hours, the free ones rewarded
// a number of times a day and then played without the reward.
func TestGestes(t *testing.T) {
	s := newSim()
	s.ID = "geste-test"
	now := time.Now()
	money, hunger := s.Money, s.Needs.Hunger
	if _, cost, err := s.doGeste("alloco", now); err != nil || cost != 300 || s.Money != money-300 || s.Needs.Hunger <= hunger {
		t.Fatalf("alloco: cost %d, err %v, money %d", cost, err, s.Money)
	}
	if _, _, err := s.doGeste("alloco", now.Add(time.Second)); err != errGesteSoon {
		t.Fatalf("alloco again at once: %v", err)
	}
	if _, _, err := s.doGeste("alloco", now.Add(time.Minute)); err != nil {
		t.Fatalf("alloco a minute later: %v", err)
	}
	if _, _, err := s.doGeste("danser-sur-le-toit", now); err != errGesteUnknown {
		t.Fatalf("unknown: %v", err)
	}
	// Brochettes are an evening's (from 16 h): at noon, no.
	if _, _, err := s.doGeste("brochette", now); err == nil {
		t.Fatal("brochettes at noon")
	}
	poor := newSim()
	poor.ID, poor.Money = "geste-poor", 20
	if _, _, err := poor.doGeste("talibe", now); err != game.ErrNotEnoughMoney {
		t.Fatalf("a coin without one: %v", err)
	}
	busy := newSim()
	busy.ID = "geste-busy"
	busy.Activity = &game.Activity{}
	if _, _, err := busy.doGeste("saluer", now); err != game.ErrBusy {
		t.Fatalf("busy: %v", err)
	}
	// The free ones: rewarded GestesDone times, then just played.
	f := newSim()
	f.ID = "geste-free"
	f.Needs.Social = 0
	n := game.Caps[game.GestesDone].Times
	for i := 0; i < n+5; i++ {
		if _, cost, err := f.doGeste("saluer", now.Add(time.Duration(i)*time.Minute)); err != nil || cost != 0 {
			t.Fatalf("greeting %d: %v", i, err)
		}
	}
	f.Needs.Social = 0
	if _, _, err := f.doGeste("saluer", now.Add(2*time.Hour)); err != nil || f.Needs.Social != 0 || f.wallet().Can(f.today(), game.GestesDone) {
		t.Fatalf("past the day's number: %v, social %v", err, f.Needs.Social)
	}
}
