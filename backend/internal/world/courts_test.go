package world

import (
	"slices"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The courts the ball games are limited to are places of the world (the sports grounds; the stadium for
// eleven against eleven; the Hôtel Ivoire's tennis; the beaches' beach-volley), and each game at one of them
// has the place's activity that starts it.
func TestCourtsExist(t *testing.T) {
	kinds := map[string]string{"foot11": game.StadiumKind, "beach": "beach"}
	check := func(id, sport string) {
		kind := kinds[sport]
		if kind == "" {
			kind = "sport"
		}
		if id == game.HotelIvoireID {
			kind = "hotel"
		}
		_, _, p, ok := FindPlace(id)
		if !ok || p.Kind != kind {
			t.Fatalf("court %s isn't a %s place of the world", id, kind)
		}
		found := false
		for _, it := range game.Kinds[kind].Interactions {
			if game.CourtSport(it.ID) == sport && slices.Contains(it.Places, id) {
				found = true
			}
		}
		if !found {
			t.Fatalf("no activity plays %s at %s", sport, id)
		}
	}
	for id, sport := range game.Courts {
		check(id, sport)
	}
	for id, more := range game.MoreCourts {
		for _, sport := range more {
			check(id, sport)
		}
	}
}
