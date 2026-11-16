package shop

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func TestGrowPrice(t *testing.T) {
	for _, c := range []struct {
		from, to string
		price    int
	}{
		{game.StageBebe, game.StageEnfant, 1000},
		{game.StageEnfant, game.StageAdo, 2000},
		{game.StageAdo, game.StageAdulte, 2000},
		{game.StageBebe, game.StageAdo, 3000},
		{game.StageBebe, game.StageAdulte, 5000},
		{game.StageEnfant, game.StageAdulte, 0}, // not sold: a step at a time
		{game.StageAdulte, game.StageAdulte, 0},
	} {
		if got := GrowPrice(c.from, c.to); got != c.price {
			t.Errorf("%s → %s: %d F, want %d", c.from, c.to, got, c.price)
		}
	}
}

// The Pionniers' Djai (game.PionnierDjai, the update « naitre-adulte ») are counted at the shop's best rate.
func TestPionnierRate(t *testing.T) {
	best := 0
	for _, p := range Packs {
		best = max(best, p.Djai/p.Price)
	}
	if best != game.PionnierRate {
		t.Fatalf("the best pack gives %d Djai a franc, the Pionniers %d", best, game.PionnierRate)
	}
}
