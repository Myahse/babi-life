package sims

import (
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

func TestFlashStreak(t *testing.T) {
	now := time.Date(2026, 10, 24, 15, 0, 0, 0, time.UTC)
	day := func(back int) string { return now.AddDate(0, 0, -back).Format("2006-01-02") }
	set := func(backs ...int) map[string]bool {
		m := map[string]bool{}
		for _, b := range backs {
			m[day(b)] = true
		}
		return m
	}
	cases := []struct {
		name         string
		mine, theirs map[string]bool
		want         int
	}{
		{"nothing", set(), set(), 0},
		{"only mine", set(0, 1, 2), set(), 0},
		{"three days to today", set(0, 1, 2), set(0, 1, 2), 3},
		// Not snapped yet today: the flame still burns from yesterday.
		{"up to yesterday", set(1, 2, 3, 4), set(1, 2, 3, 4), 4},
		{"a day missed", set(0, 1, 3), set(0, 1, 3), 2},
		{"gone two days ago", set(2, 3), set(2, 3), 0},
		{"one side missed a day", set(0, 1, 2), set(0, 2), 1},
	}
	for _, c := range cases {
		if got := flashStreak(c.mine, c.theirs, now); got != c.want {
			t.Errorf("%s: %d days, want %d", c.name, got, c.want)
		}
	}
}

func TestFlashNames(t *testing.T) {
	for n, want := range map[int]string{1: "Awa", 2: "Awa et Koffi", 3: "Awa, Koffi et Yao", 5: "Awa, Koffi et 3 autres"} {
		if got := flashNames([]string{"Awa", "Koffi", "Yao", "Aya", "Ali"}[:n]); got != want {
			t.Errorf("%d names: %q, want %q", n, got, want)
		}
	}
}

func TestFlashFriendSnaps(t *testing.T) {
	f := game.Friend{ID: "p-1", Name: "Awa", Seed: 7, Friendship: 60}
	night := time.Date(2026, 10, 24, 22, 0, 0, 0, time.UTC)
	for i := range 50 {
		rng := flashRand("s", f.ID, string(rune('a'+i)))
		if sc := flashScene(f, night, rng); sc != "nuit" && sc != "maquis" && sc != "studio" {
			t.Fatalf("at night, a snap of the %s", sc)
		}
	}
	// Back to one taken at a maquis: about it, often.
	about := 0
	for i := range 300 {
		c := flashCaption("maquis", true, flashRand("m", string(rune(i))))
		for _, x := range flashBack["maquis"] {
			if c == x {
				about++
			}
		}
	}
	if about < 120 || about > 280 {
		t.Errorf("%d replies in 300 about the maquis", about)
	}
	// The bande isn't snapped.
	s := &Sim{Friends: []game.Friend{f, {ID: "g-1", Gang: true}}}
	if got := flashFriends(s); len(got) != 1 || got[0].ID != "p-1" {
		t.Errorf("friends to snap: %+v", got)
	}
}
