package sims

import "testing"

func TestClubOpen(t *testing.T) {
	for h, want := range map[int64]bool{20: false, 21: true, 23: true, 0: true, 3: true, 4: false, 13: false} {
		if got := clubOpen(5*24*60 + h*60); got != want {
			t.Errorf("%d h: %v", h, got)
		}
	}
}
