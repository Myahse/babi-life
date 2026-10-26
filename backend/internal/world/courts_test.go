package world

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The courts football and basketball are limited to are places of the world
// (the sports grounds; the stadium for eleven against eleven).
func TestCourtsExist(t *testing.T) {
	for id, sport := range game.Courts {
		kind := "sport"
		if sport == "foot11" {
			kind = game.StadiumKind
		}
		_, _, p, ok := FindPlace(id)
		if !ok || p.Kind != kind {
			t.Fatalf("court %s isn't a %s place of the world", id, kind)
		}
	}
}
