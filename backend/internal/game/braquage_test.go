package game

import (
	"math/rand/v2"
	"slices"
	"strings"
	"testing"
)

// The police's chance: never certain either way, higher by day, near a commissariat, with a record
// and when wanted, lower played well; a bank well prepared, with its crew, is far less risky than
// without, and still riskier than a boutique.
func TestCaughtChance(t *testing.T) {
	base := BraquageOdds{Kind: "boutique", Hour: 23, Score: 50}
	p := CaughtChance(base)
	more := func(o BraquageOdds, why string) {
		t.Helper()
		if q := CaughtChance(o); q <= p {
			t.Errorf("%s: %.2f, not more than %.2f", why, q, p)
		}
	}
	day := base
	day.Hour = 11
	more(day, "by day")
	near := base
	near.PoliceMetres = 300
	more(near, "300 m from the commissariat")
	rec := base
	rec.Record = 3
	more(rec, "with a record")
	wanted := base
	wanted.Wanted = true
	more(wanted, "already wanted")
	good := base
	good.Score = 100
	if CaughtChance(good) >= p {
		t.Error("played well isn't safer")
	}
	for _, o := range []BraquageOdds{{Kind: "boutique", Hour: 23, Score: 100}, {Kind: BanqueKind, Hour: 12, Record: 9, Wanted: true, PoliceMetres: 100}} {
		if c := CaughtChance(o); c < 0.08 || c > 0.92 {
			t.Errorf("%+v: %.2f out of bounds", o, c)
		}
	}
	bare := BraquageOdds{Kind: BanqueKind, Hour: 23, Score: 70}
	ready := bare
	ready.Scouted, ready.Prepared, ready.Crew = true, true, 3
	if CaughtChance(ready) >= CaughtChance(bare)-0.25 {
		t.Errorf("a bank prepared (%.2f) isn't much safer than unprepared (%.2f)", CaughtChance(ready), CaughtChance(bare))
	}
	if CaughtChance(ready) <= CaughtChance(BraquageOdds{Kind: "boutique", Hour: 23, Score: 70}) {
		t.Error("a bank, even prepared, is safer than a boutique")
	}
	if CaughtChance(BraquageOdds{Kind: "school"}) != 1 {
		t.Error("a school can be robbed")
	}
}

// The loot stays within the place's range (a bank's, less the crew's share), more played well; it
// never passes the day's limit for its source.
func TestBraquageLoot(t *testing.T) {
	rng := rand.New(rand.NewPCG(1, 2))
	for kind, tg := range BraquageTargets {
		for range 50 {
			o := BraquageOdds{Kind: kind, Hour: 23, Score: rng.IntN(101)}
			l := BraquageLoot(o, rng)
			if l < tg.Loot[0]*6/10-50 || l > tg.Loot[1]+50 {
				t.Fatalf("%s: %d out of %v", kind, l, tg.Loot)
			}
		}
	}
	solo := BraquageOdds{Kind: BanqueKind, Hour: 23, Score: 100}
	crew := solo
	crew.Crew = 3
	if a, b := BraquageLoot(solo, rand.New(rand.NewPCG(3, 4))), BraquageLoot(crew, rand.New(rand.NewPCG(3, 4))); b >= a {
		t.Errorf("the crew took no share: %d alone, %d with three", a, b)
	}
	if BraquageTargets[BanqueKind].Loot[1]*125/100 > Caps[FromBanque].Djai+Caps[FromBanque].Djai/4 {
		t.Error("a bank's loot is far over its day's limit")
	}
}

// Only shops and banks; every robbery is for adults and shut with the update; prison grows with the
// record and stops at half a day; the fine never takes more than there is.
func TestBraquageRules(t *testing.T) {
	for _, never := range []string{"school", "worship", "health", "creche", "orphelinat", "home", "police", "mairie", "tribunal", "presidence", "universite"} {
		if _, ok := BraquageTargets[never]; ok {
			t.Errorf("%s can be robbed", never)
		}
		if k, ok := Kinds[never]; ok && slices.ContainsFunc(k.Interactions, func(it Interaction) bool { return IsBraquage(it.ID) }) {
			t.Errorf("%s has a robbery", never)
		}
	}
	for kind := range BraquageTargets {
		k, ok := Kinds[kind]
		if !ok {
			t.Fatalf("no kind %s", kind)
		}
		n := 0
		for _, it := range k.Interactions {
			if strings.HasPrefix(it.ID, BraquerPrefix) {
				n++
				if !slices.Equal(it.Ages, Adults) {
					t.Errorf("%s: %s not adults only", kind, it.ID)
				}
			}
		}
		if n != 1 {
			t.Errorf("%s: %d robberies", kind, n)
		}
	}
	if PrisonMinutes(0, false) >= PrisonMinutes(3, false) || PrisonMinutes(50, true) != 12*60 || PrisonMinutes(1, true) <= PrisonMinutes(1, false) {
		t.Error("prison doesn't grow with the record, or isn't capped")
	}
	if Fine(1000, true) != 1000 || Fine(100000, false) != 2000+25000 {
		t.Errorf("fines: %d, %d", Fine(1000, true), Fine(100000, false))
	}
}
