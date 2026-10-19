package game

import "testing"

func TestLength(t *testing.T) {
	for m, want := range map[int64]int64{0: 1, 15: 2, 20: 2, 30: 3, 60: 4, 120: 6, 240: 10, 7 * 60: 15, 8 * 60: 15, 24 * 60: 15} {
		if got := Length(m); got != want {
			t.Errorf("Length(%d) = %d, want %d", m, got, want)
		}
	}
	for m := int64(1); m < 2000; m++ {
		if Length(m) < Length(m-1) || Length(m) > MaxAction {
			t.Fatalf("Length must grow and stay under %d min (at %d)", MaxAction, m)
		}
	}
}
