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

// years later, in real time.
func years(n float64) time.Duration {
	return time.Duration(n * game.YearMinutes * float64(time.Minute))
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

func TestGrowingUp(t *testing.T) {
	s := newBaby("poignon")
	ev := s.advance(noon.Add(years(3.2)), noLuck())
	if s.stage().ID != game.StageEnfant || !hasText(ev, "3 ans") {
		t.Fatalf("at 3: stage %s, events %v", s.stage().ID, ev)
	}
	ev = s.advance(noon.Add(years(8)), noLuck()) // past Saturday
	if s.Money <= 0 || !hasText(ev, "Argent de poche") {
		t.Errorf("a child gets pocket money on Saturdays: %d", s.Money)
	}
	// Class counts for the bac.
	school, _ := game.Kinds["home"].Interaction("devoirs")
	s.schoolMark(school)
	if s.Performance != 1 {
		t.Errorf("homework mark: %d", s.Performance)
	}
	s.advance(noon.Add(years(12.1)), noLuck())
	if s.stage().ID != game.StageAdo || !s.hasApp("waye") {
		t.Errorf("at 12: stage %s, apps %v", s.stage().ID, s.Apps)
	}
	s.Performance = game.BacMarks
	before := s.Money
	ev = s.advance(noon.Add(years(18.05)), noLuck())
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
