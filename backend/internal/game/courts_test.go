package game

import "testing"

// Every court is a real place of the world, of the sports kind, and football
// and basketball are played nowhere else.
func TestCourtsArePlaces(t *testing.T) {
	for _, id := range []string{"play-football", "play-basket"} {
		it, _ := Kinds["sport"].Interaction(id)
		if len(it.Places) == 0 {
			t.Fatalf("%s should be limited to the courts", id)
		}
		for _, p := range it.Places {
			if Courts[p] != CourtSport(id) {
				t.Fatalf("%s listed at %s, a court for %q", id, p, Courts[p])
			}
		}
	}
}
