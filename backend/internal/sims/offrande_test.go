package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Every service one can give at is a real activity of the places of worship, and every faith holding one has its words for the gift.
func TestOffrandes(t *testing.T) {
	kind := game.Kinds["worship"]
	for _, id := range services {
		it, ok := kind.Interaction(id)
		if !ok {
			t.Fatalf("%s: no such activity", id)
		}
		for _, f := range it.Faiths {
			if o, ok := offrandeOf[f]; !ok || len(o.lines) == 0 {
				t.Errorf("%s at a %s place: nothing to say when giving", id, f)
			}
		}
	}
}
