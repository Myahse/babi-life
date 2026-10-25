package game

import (
	"math/rand/v2"
	"testing"
)

// The machines take back more than they give (about 89 for 100 staked),
// and a spin in three or so wins something.
func TestSlotsReturn(t *testing.T) {
	back, hits := SlotsReturn()
	if back < 0.85 || back > 0.92 {
		t.Errorf("the machines give back %.3f for 1 staked: should stay between 0.85 and 0.92", back)
	}
	if hits < 0.25 || hits > 0.4 {
		t.Errorf("a spin wins %.0f %% of the time", hits*100)
	}
	// Played for real, a long while: the house keeps its edge.
	rng := rand.New(rand.NewPCG(7, 7))
	staked, won := 0, 0
	for range 200_000 {
		staked++
		won += Spin(rng).Times
	}
	if k := float64(won) / float64(staked); k > 0.95 {
		t.Errorf("200 000 spins gave back %.3f", k)
	}
}

func TestSlotPays(t *testing.T) {
	for _, c := range []struct {
		reels [3]string
		times int
		line  string
	}{
		{[3]string{"sept", "sept", "sept"}, 200, "777 : JACKPOT !"},
		{[3]string{"cacao", "cacao", "cacao"}, 30, "Trois cabosses de cacao !"},
		{[3]string{"mangue", "mangue", "coco"}, 1, "Deux mangues"},
		{[3]string{"coco", "banane", "sept"}, 1, "Un 7 : ta mise revient"},
		{[3]string{"coco", "banane", "mangue"}, 0, ""},
		{[3]string{"banane", "coco", "coco"}, 0, ""},
	} {
		if times, line := SlotPays(c.reels); times != c.times || line != c.line {
			t.Errorf("%v: %d %q, want %d %q", c.reels, times, line, c.times, c.line)
		}
	}
}
