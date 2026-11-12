package world

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Man's and Daloa's town halls are places of the street (politics: each commune its mairie), where the map has them.
func TestVilles3Mairies(t *testing.T) {
	for _, cm := range []string{"man-centre", "daloa-centre"} {
		_, _, p, ok := FindPlace("mairie-" + cm)
		if !ok || p.Kind != "mairie" {
			t.Fatalf("%s: no mairie", cm)
		}
		if at := townHalls[cm]; distanceKm(p.Lat, p.Lng, at.Lat, at.Lng) > 0.05 {
			t.Errorf("%s: mairie not at the map's town hall", cm)
		}
	}
}

// Man's and Daloa's activities (game/villes3.go): each is tied to a place of the game, of the kind it's
// listed under, in its own city, with hours that make sense.
func TestVilles3ActsHaveTheirPlace(t *testing.T) {
	for city, acts := range map[string]map[string][]game.Interaction{"man": game.ManActs, "daloa": game.DaloaActs} {
		for kind, list := range acts {
			for _, it := range list {
				if len(it.Places) == 0 {
					t.Errorf("%s: tied to no place", it.ID)
				}
				for _, id := range it.Places {
					c, _, p, ok := FindPlace(id)
					if !ok {
						t.Errorf("%s: place %s missing", it.ID, id)
						continue
					}
					if c.ID != city {
						t.Errorf("%s: place %s is in %s", it.ID, id, c.ID)
					}
					if p.Kind != kind {
						t.Errorf("%s: listed under %s, its place %s is a %s", it.ID, kind, id, p.Kind)
					}
				}
				if it.MinHour == it.MaxHour {
					t.Errorf("%s: no hours", it.ID)
				}
			}
		}
	}
}
