package sims

import (
	"strings"
	"testing"
)

func TestGarba(t *testing.T) {
	noon := int64(12 * 60)
	s := &Sim{Money: 5000, GameMinutes: noon}
	said, cost, err := s.buyGarba("garba:x:1:2", "petit-huile")
	if err != nil || cost != 500 || !strings.Contains(said, "huile") || s.Activity == nil || s.Activity.End-s.Activity.Start != 2 {
		t.Fatalf("petit-huile: %q %d %v %+v", said, cost, err, s.Activity)
	}
	if _, _, err := (&Sim{Money: 5000, GameMinutes: noon}).buyGarba("garba:x", "poulet"); err == nil {
		t.Fatal("an unknown piece was sold")
	}
	if said, cost, _ := (&Sim{Money: 5000, GameMinutes: 5 * 60}).buyGarba("garba:x", "milieu"); cost != 0 || !strings.Contains(said, "9 h") {
		t.Fatalf("open at 5 h: %q %d", said, cost)
	}
	// The big tails run out some hours, never the small pieces.
	out := 0
	for h := int64(0); h < 200; h++ {
		if !garbaLeft("garba:y", "queue", h*60) {
			out++
		}
		if !garbaLeft("garba:y", "petit", h*60) {
			t.Fatal("small pieces ran out")
		}
	}
	if out == 0 || out > 120 {
		t.Fatalf("big tails ran out %d hours in 200", out)
	}
}
