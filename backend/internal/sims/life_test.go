package sims

import (
	"math/rand/v2"
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

func newBaby(family string) Sim {
	s := newSim()
	s.BornAt, s.Family, s.Money, s.Housing, s.Apps = s.GameMinutes, family, 0, "appart", nil
	return s
}

// The time it takes, in real time, to reach n years old (from birth).
func years(n float64) time.Duration {
	return time.Duration(game.MinutesToAge(n)) * time.Minute
}

func TestABabyStaysABaby(t *testing.T) {
	s := newBaby("poignon")
	if s.stage().ID != game.StageBebe {
		t.Fatalf("stage %s", s.stage().ID)
	}
	garba, _ := game.Kinds["maquis"].Interaction("eat-garba")
	if err := garba.AllowedFor(s.stage().ID); err != game.ErrTooYoung {
		t.Errorf("a baby can't eat garba at the maquis: %v", err)
	}
	biberon, _ := game.Kinds["home"].Interaction("biberon")
	if err := biberon.AllowedFor(s.stage().ID); err != nil {
		t.Errorf("a baby drinks the biberon: %v", err)
	}
	abj, _ := world.FindCity("abidjan")
	cocody, _ := abj.Commune("cocody")
	if err := s.leaveWith(abj, cocody, Ride{}, rand.New(alwaysSource{})); err != errTooSmallToTravel {
		t.Errorf("a baby doesn't take the woro-woro: %v", err)
	}
	if err := s.install("golvo", true); err != errNoPhoneYet {
		t.Errorf("no phone for a baby: %v", err)
	}
	if biberon.AllowedFor(game.StageAdulte) != game.ErrTooOld {
		t.Error("adults don't drink the biberon")
	}
}

func TestChildhoodLastsRealDays(t *testing.T) {
	// A baby for a day, a child for half a day, a teenager for the other half; then a year is YearMinutes.
	const h = 60
	for _, c := range []struct {
		min int64
		age int
	}{{0, 0}, {16 * h, 2}, {24 * h, 3}, {28 * h, 6}, {36 * h, 12}, {48*h - 1, 17}, {48 * h, 18}, {48*h + game.YearMinutes, 19}} {
		if got := game.AgeAt(1, 1+c.min); got != c.age {
			t.Errorf("after %d minutes: %d years old, want %d", c.min, got, c.age)
		}
	}
	for _, age := range []float64{0, 3, 7.5, 12, 18, 25} {
		if back := game.AgeAt(1, 1+game.MinutesToAge(age)); back != int(age) {
			t.Errorf("MinutesToAge(%v) gives back %d", age, back)
		}
	}
}

func TestGrowingUp(t *testing.T) {
	s := newBaby("poignon")
	ev := played(&s, noon.Add(years(3.2)))
	if s.stage().ID != game.StageEnfant || !hasText(ev, "3 ans") {
		t.Fatalf("at 3: stage %s, events %v", s.stage().ID, ev)
	}
	ev = played(&s, noon.Add(years(8))) // birthdays 3 to 8 (3 came with the first step)
	if f, _ := game.FindFamily("poignon"); s.Money != 6*(f.Pocket/birthdayShare/100*100) || !hasText(ev, "Argent de poche") {
		t.Errorf("a child gets pocket money on its birthdays: %d", s.Money)
	}
	// Class counts for the bac.
	school, _ := game.Kinds["home"].Interaction("devoirs")
	s.schoolMark(school)
	if s.Performance != 1 {
		t.Errorf("homework mark: %d", s.Performance)
	}
	played(&s, noon.Add(years(12.1)))
	if s.stage().ID != game.StageAdo || !s.hasApp("waye") {
		t.Errorf("at 12: stage %s, apps %v", s.stage().ID, s.Apps)
	}
	s.Performance = game.BacMarks
	before := s.Money
	ev = played(&s, noon.Add(years(18.05)))
	f, _ := game.FindFamily("poignon")
	if s.stage().ID != game.StageAdulte || s.Housing != f.Leave || s.Money < before+f.Start+f.BacGift || !hasText(ev, "Bac en poche") {
		t.Errorf("at 18: stage %s housing %s money %d (+%d) events %v", s.stage().ID, s.Housing, s.Money, s.Money-before, ev)
	}
}

func TestFamiliesAreWellFormed(t *testing.T) {
	total := 0.0
	for _, f := range game.Families {
		total += f.Weight
		for _, h := range []string{f.Housing, f.Leave} {
			if _, ok := game.FindHousing(h); !ok {
				t.Errorf("%s: housing %s", f.ID, h)
			}
		}
		if f.Sector == "" {
			t.Errorf("%s: no sector", f.ID)
		}
	}
	if total < 0.99 || total > 1.01 {
		t.Errorf("weights add up to %.2f", total)
	}
}

func hasText(ev []Event, s string) bool {
	for _, e := range ev {
		if strings.Contains(e.Text, s) {
			return true
		}
	}
	return false
}

func TestChildhoodRunsOnWhileAway(t *testing.T) {
	// Away 30 hours as a newborn: a child on coming back, its birthday said.
	s := Sim{FirstName: "Awa", GameMinutes: 1000, BornAt: 1000, Family: "poignon"}
	events := s.hold(30 * 60)
	if got := s.stage().ID; got != game.StageEnfant {
		t.Fatalf("after 30 h away: %s, want enfant", got)
	}
	if len(events) == 0 {
		t.Error("the birthday wasn't said")
	}
	// Away three days as a teenager: 18 on the way, then the adult's time waits.
	s = Sim{FirstName: "Awa", GameMinutes: 10000, BornAt: 10000 - 40*60, Family: "poignon"}
	s.hold(72 * 60)
	if got := s.age(); got != game.AdultAge {
		t.Fatalf("after 3 days away from 15: %d years old, want 18", got)
	}
	// An adult away: nothing moves.
	s.hold(24 * 60)
	if got := s.age(); got != game.AdultAge {
		t.Errorf("an adult aged while away: %d", got)
	}
}

func TestGrowBought(t *testing.T) {
	s := Sim{FirstName: "Awa", GameMinutes: 5000, BornAt: 5000, Family: "poignon", growing: game.StageAdulte}
	events := s.grow()
	if s.age() != game.AdultAge || s.growing != "" {
		t.Fatalf("bought « adulte tout de suite »: %d years old, still growing %q", s.age(), s.growing)
	}
	if len(events) < 3 {
		t.Errorf("birthdays and leaving home not said: %v", events)
	}
	// Bought again by mistake: never younger.
	s.growing = game.StageEnfant
	s.grow()
	if s.age() != game.AdultAge {
		t.Errorf("made younger: %d", s.age())
	}
}
