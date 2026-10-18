package game

import (
	"testing"
	"time"
)

func TestLotoDraws(t *testing.T) {
	now := time.Date(2026, 10, 18, 14, 30, 0, 0, time.UTC)
	ds := LotoDraws(now)
	if len(ds) != 21 {
		t.Fatalf("%d draws over three days", len(ds))
	}
	drawn, waiting := 0, 0
	for _, d := range ds {
		if d.At <= now.Unix() {
			drawn++
			if len(d.Numbers) != 5 {
				t.Errorf("%s: %v", d.Name, d.Numbers)
			}
			seen := map[int]bool{}
			for _, n := range d.Numbers {
				if n < 1 || n > 90 || seen[n] {
					t.Errorf("%s: bad numbers %v", d.Name, d.Numbers)
				}
				seen[n] = true
			}
		} else {
			waiting++
			if d.Numbers != nil {
				t.Errorf("%s shows its numbers before the draw", d.Name)
			}
		}
	}
	// Yesterday's 7, today's 9 h, 11 h and 13 h.
	if drawn != 10 || waiting != 11 {
		t.Errorf("%d drawn, %d waiting", drawn, waiting)
	}
	if _, ok := LotoDrawAt(time.Date(2026, 10, 18, 15, 0, 0, 0, time.UTC).Unix()); !ok {
		t.Error("15 h is a draw")
	}
	if _, ok := LotoDrawAt(time.Date(2026, 10, 18, 16, 0, 0, 0, time.UTC).Unix()); ok {
		t.Error("16 h is not a draw")
	}
}

func TestLotoOddsAreFair(t *testing.T) {
	// One number: it comes out about 5 times in 90.
	hits, n := 0, 20000
	for i := 0; i < n; i++ {
		if LotoWins([]int{7}, LotoNumbers(int64(i)*7200)) {
			hits++
		}
	}
	if p := float64(hits) / float64(n); p < 0.045 || p > 0.066 {
		t.Errorf("one number comes out %.3f of the time, want ~0.056", p)
	}
	if LotoWins([]int{1, 2}, []int{1, 3, 4, 5, 6}) || !LotoWins([]int{1, 3}, []int{1, 3, 4, 5, 6}) || LotoWins(nil, []int{1}) {
		t.Error("LotoWins")
	}
}
