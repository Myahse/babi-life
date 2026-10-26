package game

import "testing"

// Every court is a real place of the world, of the sports kind, and football
// and basketball are played nowhere else.
func TestCourtsArePlaces(t *testing.T) {
	for _, c := range [][2]string{{"sport", "play-football"}, {"sport", "play-basket"}, {StadiumKind, Foot11ID}} {
		id := c[1]
		it, _ := Kinds[c[0]].Interaction(id)
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
