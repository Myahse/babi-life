package game

import (
	"testing"
	"time"
)

// The levels follow the reputation, a pioneer starts at 2, and each level unlocks its own buildings.
func TestQuartierLevels(t *testing.T) {
	cases := []struct {
		rep      int
		pionnier bool
		want     int
	}{{0, false, 1}, {99, false, 1}, {100, false, 2}, {299, false, 2}, {300, false, 3}, {700, false, 4}, {1500, false, 5}, {99999, false, 5}, {0, true, 2}, {700, true, 4}}
	for _, c := range cases {
		if got := QuartierLevel(c.rep, c.pionnier); got != c.want {
			t.Errorf("rep %d pionnier %v: level %d, want %d", c.rep, c.pionnier, got, c.want)
		}
	}
	if l, rep := NextQuartierLevel(1); l != 2 || rep != 100 {
		t.Errorf("after 1: %d %d", l, rep)
	}
	if l, _ := NextQuartierLevel(5); l != 0 {
		t.Errorf("after 5: %d", l)
	}
	byLevel := map[int][]string{}
	for _, k := range QuartierKinds {
		byLevel[k.Level] = append(byLevel[k.Level], k.ID)
		if k.Price <= 0 || k.Max <= 0 || k.Label == "" {
			t.Errorf("%s: incomplete %+v", k.ID, k)
		}
		if k.Shop != "" {
			if _, ok := FindShopKind(k.Shop); !ok {
				t.Errorf("%s: unknown shop %q", k.ID, k.Shop)
			}
		}
	}
	want := map[int]int{1: 3, 2: 3, 3: 3, 4: 3, 5: 2}
	for l, n := range want {
		if len(byLevel[l]) != n {
			t.Errorf("level %d unlocks %v", l, byLevel[l])
		}
	}
}

// The money comes in by whole hours when read, stops at a week, and a shop with nobody working sells nothing.
func TestQuartierLazyIncome(t *testing.T) {
	start := time.Date(2026, 11, 1, 8, 0, 0, 0, time.UTC)
	b := QBuilding{Kind: "boutique", Staff: 1, Last: start}
	day := QuartierPerDay(QuartierKinds[1], 1, "yopougon")
	if day <= 0 {
		t.Fatalf("a boutique with one seller makes %d", day)
	}
	b.Settle("yopougon", start.Add(30*time.Minute))
	if b.Pending != 0 || !b.Last.Equal(start) {
		t.Fatalf("half an hour: %+v", b)
	}
	b.Settle("yopougon", start.Add(24*time.Hour+30*time.Minute))
	if b.Pending != day || !b.Last.Equal(start.Add(24*time.Hour)) {
		t.Fatalf("a day: %d, want %d (%v)", b.Pending, day, b.Last)
	}
	b.Settle("yopougon", start.Add(60*24*time.Hour))
	if b.Pending != day*PendingDays {
		t.Fatalf("two months away: %d, want a week %d", b.Pending, day*PendingDays)
	}
	if QuartierPerDay(QuartierKinds[1], 0, "yopougon") != 0 {
		t.Error("a boutique with nobody sells")
	}
	if g, _ := FindQuartierKind("grin"); QuartierPerDay(g, 0, "cocody") != 0 {
		t.Error("a grin pays")
	}
	if c, _ := FindQuartierKind("cabine"); QuartierPerDay(c, 0, "cocody") <= QuartierPerDay(c, 0, "abobo") {
		t.Error("a cabine at Cocody makes no more than at Abobo")
	}
}

// Collecting takes the tax off and stops at the day's limit; the rest waits.
func TestQuartierCollectCap(t *testing.T) {
	b := QBuilding{Pending: 50000}
	got, tax := b.Collect(1000000)
	if got != 45000 || tax != 5000 || b.Pending != 0 {
		t.Fatalf("all: %d %d %d", got, tax, b.Pending)
	}
	b = QBuilding{Pending: 50000}
	got, _ = b.Collect(9000)
	if got != 9000 || b.Pending != 40000 {
		t.Fatalf("capped: %d, left %d", got, b.Pending)
	}
	b = QBuilding{Pending: 100}
	if got, _ = b.Collect(0); got != 0 || b.Pending != 100 {
		t.Fatalf("limit reached: %d %d", got, b.Pending)
	}
}

// The customers' reputation loses no fraction between reads, and stops at a week for an owner away.
func TestQuartierRepGain(t *testing.T) {
	start := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	last, total := start, 0
	for h := 1; h <= 24; h++ {
		g, at := QuartierRepGain(6, last, start.Add(time.Duration(h)*time.Hour))
		total, last = total+g, at
	}
	if total != 6 {
		t.Fatalf("read every hour for a day at 6 a day: %d", total)
	}
	g, _ := QuartierRepGain(10, start, start.Add(90*24*time.Hour))
	if g != 10*PendingDays {
		t.Fatalf("three months away: %d", g)
	}
	if g, _ := QuartierRepGain(0, start, start.Add(time.Hour)); g != 0 {
		t.Fatal("no buildings, reputation")
	}
}

// The slots are distinct, in the quartier's radius, and face its centre.
func TestQuartierSlots(t *testing.T) {
	seen := map[[2]int]bool{}
	for i := range QuartierSlots {
		e, n, _ := QuartierSlotSpot(i)
		k := [2]int{int(e), int(n)}
		if seen[k] {
			t.Errorf("slot %d on another", i)
		}
		seen[k] = true
		if e*e+n*n > QuartierRadius*QuartierRadius {
			t.Errorf("slot %d out of the quartier", i)
		}
	}
}
