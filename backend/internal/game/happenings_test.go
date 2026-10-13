package game

import "testing"

func TestHappeningsAreStableAndRespectHours(t *testing.T) {
	seen := map[string]bool{}
	on := 0
	for m := int64(0); m < 30*24*60; m += HappeningMinutes {
		h, start, ok := HappeningAt("yopougon", m+17)
		h2, _, ok2 := HappeningAt("yopougon", m+17)
		if ok != ok2 || h.ID != h2.ID {
			t.Fatal("same commune and time must give the same happening")
		}
		if start != m {
			t.Fatalf("slot start: got %d want %d", start, m)
		}
		if !ok {
			continue
		}
		on++
		seen[h.ID] = true
		if !(Interaction{MinHour: h.MinHour, MaxHour: h.MaxHour}).Available(HourOf(start)) {
			t.Errorf("%s started at %dh, outside its hours", h.ID, HourOf(start))
		}
	}
	slots := 30 * 24 * 60 / HappeningMinutes
	if on < slots*4/10 || on > slots*8/10 {
		t.Errorf("%d of %d slots have a happening, expected about %.0f%%", on, slots, HappeningChance*100)
	}
	if len(seen) < len(Happenings)-1 {
		t.Errorf("only saw %v in a month", seen)
	}
}

func TestCommunesDiffer(t *testing.T) {
	same := 0
	for m := int64(0); m < 10*24*60; m += HappeningMinutes {
		a, _, okA := HappeningAt("yopougon", m)
		b, _, okB := HappeningAt("cocody", m)
		if okA == okB && a.ID == b.ID {
			same++
		}
	}
	if same > 10*24*60/HappeningMinutes*3/4 {
		t.Errorf("Yopougon and Cocody look too alike: %d identical slots", same)
	}
}
