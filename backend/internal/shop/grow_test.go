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
		{game.StageBebe, game.StageEnfant, 2500},
		{game.StageEnfant, game.StageAdo, 2500},
		{game.StageAdo, game.StageAdulte, 2500},
		{game.StageBebe, game.StageAdo, 5000},
		{game.StageBebe, game.StageAdulte, 10_000},
		{game.StageEnfant, game.StageAdulte, 0}, // not sold: a step at a time
		{game.StageAdulte, game.StageAdulte, 0},
	} {
		if got := GrowPrice(c.from, c.to); got != c.price {
			t.Errorf("%s → %s: %d F, want %d", c.from, c.to, got, c.price)
		}
	}
}
