package world

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func TestIDsAreUniqueAndKindsExist(t *testing.T) {
	seen := map[string]bool{}
	for _, c := range Cities {
		for _, cm := range c.Communes {
			for _, p := range cm.Places {
				if seen[p.ID] {
					t.Errorf("duplicate place id %q", p.ID)
				}
				seen[p.ID] = true
				if _, ok := game.Kinds[p.Kind]; !ok {
					t.Errorf("place %q uses unknown kind %q", p.ID, p.Kind)
				}
			}
		}
	}
}

func TestTripPrices(t *testing.T) {
	abj, _ := FindCity("abidjan")
	yop, _ := abj.Commune("yopougon")
	coc, _ := abj.Commune("cocody")
	if m, f := Trip(abj, yop, abj, yop); m != 0 || f != 0 {
		t.Errorf("staying put should be free, got %d min %dF", m, f)
	}
	if _, f := Trip(abj, yop, abj, coc); f < 300 || f > 1000 {
		t.Errorf("Yop → Cocody fare looks wrong: %dF", f)
	}
	bke, _ := FindCity("bouake")
	if m, f := Trip(abj, coc, bke, bke.Communes[0]); m < 240 || f < 5000 {
		t.Errorf("Abidjan → Bouaké looks too cheap: %d min %dF", m, f)
	}
}
