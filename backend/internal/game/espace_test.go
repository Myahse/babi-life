package game

import (
	"encoding/json"
	"os"
	"regexp"
	"testing"
)

// launchGolden: one case of the timetable, the same in the phone's lib/espace.ts (LAUNCH_GOLDEN): if either side
// changes how it hashes or counts, this fails.
type launchGolden struct {
	At          int64            `json:"at"`
	Offsets     map[string]int64 `json:"offsets"`
	CargoOffset map[string]int64 `json:"cargoOffsets"`
	Next        map[string]int64 `json:"next"`
	Hash        uint32           `json:"hash"`
	Scrubbed    []int64          `json:"scrubbed"`
}

var golden = launchGolden{
	At:          1528560, // 27 November 2026, 12:00 in Abidjan
	Offsets:     map[string]int64{"sassandra": 101, "kourou": 0, "cap-canaveral": 61, "baikonour": 177},
	CargoOffset: map[string]int64{"sassandra": 65, "kourou": 20, "cap-canaveral": 73, "baikonour": 51},
	Next:        map[string]int64{"sassandra": 1528661, "kourou": 1528560, "cap-canaveral": 1528801, "baikonour": 1528737},
	Hash:        1115043221, // launchHash("sassandra")
	Scrubbed:    []int64{5}, // Sassandra's crewed launches 0…11 « reportés »
}

func checkGolden(t *testing.T, g launchGolden) {
	t.Helper()
	if h := launchHash("sassandra"); h != g.Hash {
		t.Errorf("hash %d, golden %d", h, g.Hash)
	}
	for _, id := range SpaceportIDs {
		if o := LaunchOffset(id, true); o != g.Offsets[id] {
			t.Errorf("%s: offset %d, golden %d", id, o, g.Offsets[id])
		}
		if o := LaunchOffset(id, false); o != g.CargoOffset[id] {
			t.Errorf("%s: cargo offset %d, golden %d", id, o, g.CargoOffset[id])
		}
		if l := NextLaunch(id, g.At); l.At != g.Next[id] {
			t.Errorf("%s: next launch %d, golden %d", id, l.At, g.Next[id])
		}
	}
	var scrubbed []int64
	for n := int64(0); n < 12; n++ {
		if Scrubbed("sassandra", true, n) {
			scrubbed = append(scrubbed, n)
		}
	}
	if len(scrubbed) != len(g.Scrubbed) || (len(scrubbed) > 0 && scrubbed[0] != g.Scrubbed[0]) {
		t.Errorf("scrubbed %v, golden %v", scrubbed, g.Scrubbed)
	}
}

// The timetable is deterministic: the same launches every time, a crewed one every 3 hours and a cargo every 90
// minutes from each spaceport, about one in ten « reporté », never the one NextLaunch gives.
func TestLaunchTimetable(t *testing.T) {
	checkGolden(t, golden)
	from := golden.At
	a, b := LaunchTimetable("sassandra", from, from+24*60), LaunchTimetable("sassandra", from, from+24*60)
	if len(a) != 24*60/LaunchEvery+24*60/CargoEvery || len(a) != len(b) {
		t.Fatalf("%d launches in a day", len(a))
	}
	crewed := 0
	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("not deterministic: %+v vs %+v", a[i], b[i])
		}
		if i > 0 && a[i].At < a[i-1].At {
			t.Fatalf("out of order at %d", i)
		}
		if a[i].At < from || a[i].At >= from+24*60 {
			t.Fatalf("out of the day: %+v", a[i])
		}
		if a[i].Crewed {
			crewed++
		}
	}
	if crewed != 24*60/LaunchEvery {
		t.Errorf("%d crewed launches a day", crewed)
	}
	scrubs := 0
	for n := int64(0); n < 2000; n++ {
		if Scrubbed("kourou", true, n) {
			scrubs++
		}
	}
	if scrubs < 150 || scrubs > 250 {
		t.Errorf("%d scrubs in 2000", scrubs)
	}
	for _, id := range SpaceportIDs {
		for m := from; m < from+3*24*60; m += 37 {
			l := NextLaunch(id, m)
			if l.Scrub || !l.Crewed || l.At < m || l.At-m > 3*LaunchEvery {
				t.Fatalf("%s at %d: %+v", id, m, l)
			}
		}
	}
	// Before the epoch too (negative minutes).
	if l := NextLaunch("sassandra", -1000); l.At < -1000 {
		t.Errorf("before the epoch: %+v", l)
	}
}

// The phone's copy of the golden case (web/src/lib/espace.ts) is the same, and its numbers hold here.
func TestLaunchGoldenShared(t *testing.T) {
	src, err := os.ReadFile("../../../web/src/lib/espace.ts")
	if err != nil {
		t.Skip("no web checkout")
	}
	m := regexp.MustCompile(`(?s)export const LAUNCH_GOLDEN = (\{.*?\})\n`).FindSubmatch(src)
	if m == nil {
		t.Fatal("no LAUNCH_GOLDEN in lib/espace.ts")
	}
	var g launchGolden
	if err := json.Unmarshal(m[1], &g); err != nil {
		t.Fatalf("LAUNCH_GOLDEN isn't JSON: %v", err)
	}
	checkGolden(t, g)
}

// Prices: the dearest thing in the game is Mars; every destination has its ticket and its update.
func TestEspacePrices(t *testing.T) {
	if !(PriceSuborbital < PriceStation && PriceStation < PriceLune && PriceLune < PriceMars) {
		t.Error("prices out of order")
	}
	for _, d := range Destinations {
		if got, ok := DestinationOfTicket(d.Ticket); !ok || got.ID != d.ID || d.Key == "" || d.Price <= 0 {
			t.Errorf("%s: ticket %q", d.ID, d.Ticket)
		}
		k := Kinds[SpatioportKind]
		if it, ok := k.Interaction(d.Ticket); !ok || it.Cost != d.Price {
			t.Errorf("%s: the pad sells it at %d", d.ID, it.Cost)
		}
		for _, step := range d.Steps {
			if _, ok := Kinds[EspaceCapsuleK].Interaction(step); !ok {
				t.Errorf("%s: no step %s in the capsule", d.ID, step)
			}
		}
	}
	// Nothing up there pays (no negative cost, no money by chance in the kinds' events).
	for id, k := range Kinds {
		if !IsSpaceKind(id) {
			continue
		}
		for _, it := range k.Interactions {
			if it.Cost < 0 {
				t.Errorf("%s pays (%s)", it.ID, id)
			}
		}
		for _, ev := range k.Events {
			if ev.Money != 0 {
				t.Errorf("%s: money by chance up there", id)
			}
		}
	}
	if ExtraNights(StationNights) != 0 || ExtraNights(StationNights+2) != 2*StationNight {
		t.Error("the station's nights")
	}
}
