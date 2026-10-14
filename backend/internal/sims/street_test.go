package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func TestAllocoTantie(t *testing.T) {
	s := newSim() // at noon
	// Some stalls have plantain this hour, some don't; the answer holds.
	var had, out string
	for i := 0; i < 50 && (had == "" || out == ""); i++ {
		v := string(rune('a'+i%26)) + string(rune('a'+i/26))
		if hasBanana(v, s.GameMinutes) {
			had = v
		} else {
			out = v
		}
	}
	if had == "" || out == "" {
		t.Fatal("expected stalls with and without plantain")
	}
	if hasBanana(out, s.GameMinutes) {
		t.Error("her answer changes within the hour")
	}
	said, err := s.buyAlloco(out)
	if err != nil || said != NoBanana || s.Activity != nil {
		t.Fatalf("no banana: %q %v %v", said, err, s.Activity)
	}
	money := s.Money
	if said, err := s.buyAlloco(had); err != nil || said == NoBanana || s.Activity == nil {
		t.Fatalf("buy: %q %v", said, err)
	}
	if s.Money != money-300 {
		t.Errorf("paid %d", money-s.Money)
	}
	if _, err := s.buyAlloco(had); err != game.ErrBusy {
		t.Errorf("busy: %v", err)
	}
	// At night the stall is closed.
	if hasBanana(had, game.MinuteOf(noon)-12*60+2*60) {
		t.Error("open at 2 a.m.")
	}
}
