package game

import (
	"testing"
	"time"
)

func TestHappeningsAreStableAndRespectHours(t *testing.T) {
	seen := map[string]bool{}
	on := 0
	for m := int64(0); m < 30*24*60; m += HappeningMinutes {
		h, start, ok := HappeningAt("abidjan", "yopougon", m+17)
		h2, _, ok2 := HappeningAt("abidjan", "yopougon", m+17)
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
		if !(Interaction{MinHour: h.MinHour, MaxHour: h.MaxHour, Days: h.Days}).OpenAt(start) {
			t.Errorf("%s started at %dh on day %d, outside its hours", h.ID, HourOf(start), WeekdayOf(start))
		}
	}
	slots := 30 * 24 * 60 / HappeningMinutes
	if on < slots*4/10 || on > slots*9/10 {
		t.Errorf("%d of %d slots have a happening, expected about %.0f%%", on, slots, HappeningChance*100)
	}
	for _, id := range []string{"mariage", "concert", "bapteme", "funerailles", "tontine"} {
		if !seen[id] {
			t.Errorf("never saw %s in a month in Yopougon", id)
		}
	}
}

func TestCommunesDiffer(t *testing.T) {
	same := 0
	for m := int64(0); m < 10*24*60; m += HappeningMinutes {
		a, _, okA := HappeningAt("abidjan", "yopougon", m)
		b, _, okB := HappeningAt("abidjan", "cocody", m)
		if okA == okB && a.ID == b.ID {
			same++
		}
	}
	if same > 10*24*60/HappeningMinutes*3/4 {
		t.Errorf("Yopougon and Cocody look too alike: %d identical slots", same)
	}
}

// Every happening stays where, when and on the days it is allowed.
func TestHappeningsRespectPlaceSeasonAndDays(t *testing.T) {
	communes := map[string]string{"marcory": "abidjan", "yopougon": "abidjan", "plateau": "abidjan", "bassam-france": "grand-bassam", "bouake-centre": "bouake", "man-centre": "man"}
	from := MinuteOf(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
	for m := from; m < from+366*24*60; m += HappeningMinutes {
		for cm, city := range communes {
			h, start, ok := HappeningAt(city, cm, m)
			if !ok {
				continue
			}
			month := int(DateOf(start).Month())
			if len(h.Communes) > 0 && !contains(h.Communes, cm) || len(h.Cities) > 0 && !contains(h.Cities, city) {
				t.Fatalf("%s happened in %s/%s", h.ID, city, cm)
			}
			if len(h.Months) > 0 && !contains(h.Months, month) {
				t.Fatalf("%s happened in month %d", h.ID, month)
			}
			if len(h.Days) > 0 && !contains(h.Days, WeekdayOf(start)) {
				t.Fatalf("%s happened on day %d", h.ID, WeekdayOf(start))
			}
			if h.Holiday != "" {
				if hd, ok := HolidayOn(start); !ok || hd.ID != h.Holiday {
					t.Fatalf("%s happened outside its holiday on %s", h.ID, DateOf(start).Format("2006-01-02"))
				}
			}
		}
	}
}

func TestFestivalsAndHolidaysShowUp(t *testing.T) {
	saw := func(city, commune string, day time.Time, id string) bool {
		for m := MinuteOf(day); m < MinuteOf(day)+24*60; m += HappeningMinutes {
			if h, _, ok := HappeningAt(city, commune, m); ok && h.ID == id {
				return true
			}
		}
		return false
	}
	femua := false
	for d := 1; d <= 30 && !femua; d++ {
		femua = saw("abidjan", "marcory", time.Date(2026, 4, d, 0, 0, 0, 0, time.UTC), "femua")
	}
	if !femua {
		t.Error("FEMUA never happens in Marcory in April")
	}
	if !saw("abidjan", "cocody", time.Date(2026, 8, 7, 0, 0, 0, 0, time.UTC), "fete-independance") {
		t.Error("no Independence Day in Cocody on 7 August")
	}
	if saw("abidjan", "cocody", time.Date(2026, 8, 8, 0, 0, 0, 0, time.UTC), "fete-independance") {
		t.Error("Independence Day leaked to 8 August")
	}
}

func TestNoHappeningTwiceInARow(t *testing.T) {
	prev := ""
	for m := int64(0); m < 20*24*60; m += HappeningMinutes {
		h, _, ok := HappeningAt("abidjan", "yopougon", m)
		if !ok {
			prev = ""
			continue
		}
		if h.ID == prev {
			t.Fatalf("%s twice in a row at %d", h.ID, m)
		}
		prev = h.ID
	}
}

func contains[T comparable](xs []T, x T) bool {
	for _, y := range xs {
		if y == x {
			return true
		}
	}
	return false
}
