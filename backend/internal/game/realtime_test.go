package game

import "testing"

func TestLength(t *testing.T) {
	for m, want := range map[int64]int64{0: 1, 15: 1, 20: 1, 30: 2, 60: 3, 120: 4, 240: 6, 7 * 60: 8, 8 * 60: 8, 24 * 60: 8} {
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
