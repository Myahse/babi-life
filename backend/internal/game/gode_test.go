package game

import (
	"math/rand/v2"
	"testing"
)

func TestGodeBeats(t *testing.T) {
	for _, c := range []struct {
		call string
		a, b int
		want int
	}{{GodeGrand, 6, 5, 1}, {GodeGrand, 5, 6, -1}, {GodePetit, 2, 5, 1}, {GodePetit, 5, 2, -1}, {GodePetit, 3, 3, 0}} {
		if got := GodeBeats(c.call, c.a, c.b); got != c.want {
			t.Errorf("%s %d-%d: %d", c.call, c.a, c.b, got)
		}
	}
}

// The first to throw, calling after seeing his die, wins about three rounds in four; taking turns, nobody has the edge.
func TestGodeFair(t *testing.T) {
	r := rand.New(rand.NewPCG(1, 2))
	firstWins := 0
	const n = 200000
	for i := 0; i < n; i++ {
		a := GodeRoll(r)
		call := GodeCallFor(a)
		for {
			b := GodeRoll(r)
			if w := GodeBeats(call, a, b); w != 0 {
				if w > 0 {
					firstWins++
				}
				break
			}
			a = GodeRoll(r)
		}
	}
	share := float64(firstWins) / n
	if share < 0.72 || share > 0.78 {
		t.Errorf("the first throw wins %.3f of rounds", share)
	}
}
