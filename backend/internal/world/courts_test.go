package world

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The courts football and basketball are limited to are places of the world.
func TestCourtsExist(t *testing.T) {
	for id := range game.Courts {
		_, _, p, ok := FindPlace(id)
		if !ok || p.Kind != "sport" {
			t.Fatalf("court %s isn't a sports place of the world", id)
		}
	}
}
