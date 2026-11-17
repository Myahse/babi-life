package game

import (
	"math"
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

// The street's draw is the phone's (numbers from web world3d/themes.ts rng, run in node), and the home it
// draws stands 120 to 380 m from the commune's centre.
func TestStreetHome(t *testing.T) {
	r := spotRng("home4e3fa4e5-f299-4a31-98cb-63c36ca2e672")
	if a, b := r(), r(); math.Abs(a-0.24123518262058496) > 1e-12 || math.Abs(b-0.9651781769935042) > 1e-12 {
		t.Fatalf("rng: %v %v", a, b)
	}
	q := spotRng("lotabc")
	if a, b := q(), q(); math.Abs(a-0.5304995214100927) > 1e-12 || math.Abs(b-0.8871699026785791) > 1e-12 {
		t.Fatalf("rng lot: %v %v", a, b)
	}
	lat, lng := StreetHome("4e3fa4e5-f299-4a31-98cb-63c36ca2e672", false, 5.34, -4.07)
	if e, n := MetresFrom(5.34, -4.07, lat, lng); math.Hypot(e, n) < 119 || math.Hypot(e, n) > 381 {
		t.Fatalf("home at %.0f m", math.Hypot(e, n))
	}
}

// The lots are apart from one another, in the quartier, within reach of a street front, and the v1 slots
// (0 to 17) are all lots.
func TestQuartierLots(t *testing.T) {
	for i := range QuartierLots {
		e, n, _ := QuartierLotSpot(i)
		if e*e+n*n > QuartierRadius*QuartierRadius || e*e+n*n < 40*40 {
			t.Errorf("lot %d at %.0f m", i, math.Hypot(e, n))
		}
		for j := range i {
			e2, n2, _ := QuartierLotSpot(j)
			if d := math.Hypot(e-e2, n-n2); d < 45 {
				t.Errorf("lots %d and %d %.0f m apart", i, j, d)
			}
		}
		if !LotNear(i, e+30, n-30) || LotNear(i, e+80, n) {
			t.Errorf("lot %d snap", i)
		}
	}
	if QuartierLots < 18 {
		t.Error("a v1 slot without its lot")
	}
	lat, lng := OffsetLatLng(5.35, -4.0, 120, -80)
	if e, n := MetresFrom(5.35, -4.0, lat, lng); math.Abs(e-120) > 0.01 || math.Abs(n+80) > 0.01 {
		t.Errorf("metres back: %f %f", e, n)
	}
}

// The buildings one goes into run a place of the street (its menu, its prices); the visitors' purchases
// wait in them beyond the week's takings.
func TestQuartierPlaces(t *testing.T) {
	for kind, place := range map[string]string{"boutique": "boutique", "maquis": "maquis", "salon": "salon", "pharmacie": "pharmacie", "marche": "market"} {
		if k, ok := QuartierPlaceKind(kind); !ok || k.ID != place || len(k.Interactions) == 0 {
			t.Errorf("%s: %q %v", kind, k.ID, ok)
		}
	}
	if _, ok := QuartierPlaceKind("maison"); ok {
		t.Error("a rented house is no place to go into")
	}
	if QuartierSale(2500) != 1250 || QuartierSale(0) != 0 || QuartierSale(-500) != 0 || QuartierSale(1_000_000) != QuartierSaleMax {
		t.Error("the owner's share")
	}
	// A boutique nobody works in makes nothing, but keeps what visitors paid.
	now := time.Now()
	b := QBuilding{Kind: "boutique", Staff: 0, Pending: 1250, Last: now.Add(-3 * time.Hour)}
	b.Settle("cocody", now)
	if b.Pending != 1250 {
		t.Errorf("a sale lost: %d", b.Pending)
	}
}
