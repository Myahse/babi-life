package sims

import (
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// recruit: an adult in Cocody, by the caserne.
func recruit() *Sim {
	return &Sim{ID: "r", FirstName: "Koffi", LastName: "Yao", Needs: game.FreshNeeds(), Money: 5000, City: "abidjan", Commune: "cocody", HomeCity: "abidjan", HomeCommune: "cocody", GameMinutes: 600_000}
}

// armyFree: the activity over, the Sim free again.
func armyFree(s *Sim) {
	s.GameMinutes = max(s.GameMinutes, s.Activity.End) + 1
	s.Activity = nil
}

// Signing up: from 18, at the caserne; the drills are the recruits' only; living there, nowhere else.
func TestServiceSignUp(t *testing.T) {
	s := recruit()
	if _, err := s.interactAt(game.CaserneID, "caserne-couleurs"); err != errNotRecruit {
		t.Fatalf("a drill before signing up: %v", err)
	}
	young := recruit()
	young.BornAt = young.GameMinutes - game.MinutesToAge(15)
	if _, err := young.interactAt(game.CaserneID, game.ServiceSignID); err == nil {
		t.Fatal("a 15-year-old signed up")
	}
	if _, err := s.interactAt(game.CaserneID, game.ServiceSignID); err != nil {
		t.Fatal(err)
	}
	st := s.armyStay()
	if st == nil || st.Program != "service" || st.Rounds != 3 || len(st.Steps) != 4 || len(s.pending) != 1 {
		t.Fatalf("not in service: %+v %v", st, s.pending)
	}
	armyFree(s)
	if _, err := s.interactAt(HomePlaceID, "sleep"); err != errInService {
		t.Fatalf("home during the service: %v", err)
	}
	city, cm, _ := world.FindCommune("abidjan", "plateau")
	if err := s.leave(city, cm); err != errInService {
		t.Fatalf("a taxi during the service: %v", err)
	}
	if _, err := s.interactAt(game.CaserneID, game.ServiceSignID); err != errBusyArmy {
		t.Fatalf("signed twice: %v", err)
	}
	if _, err := s.interactAt(game.CaserneID, "caserne-dortoir"); err != nil {
		t.Fatalf("the dormitory: %v", err)
	}
}

// The service: each round's drills passed (a bad score doesn't count), the attestation, the career at caporal.
func TestServiceCompletion(t *testing.T) {
	s := recruit()
	s.armyBegin(game.ServiceProgram)
	if line := s.armyPlayed("caserne-couleurs", 30); !strings.Contains(line, "Pas validé") || len(s.armyStay().Done) != 0 {
		t.Fatalf("a bad score counted: %q", line)
	}
	for r := range 3 {
		for _, id := range game.ServiceProgram.Steps {
			s.armyPlayed(id, 80)
		}
		if r < 2 && (s.armyStay() == nil || s.armyStay().Round != r+1) {
			t.Fatalf("round %d: %+v", r, s.armyStay())
		}
	}
	if s.armyStay() != nil || !s.Life.Armee.Service {
		t.Fatalf("not done: %+v", s.Life.Armee)
	}
	if len(s.papers) != 1 || s.papers[0].kind != game.DocService || s.papers[0].data["mention"] != "Bien" || s.papers[0].data["unit"] != game.ArmeeUnit {
		t.Fatalf("attestation: %+v", s.papers)
	}
	if _, err := s.interactAt(game.CaserneID, game.ServiceSignID); err != errServiceDone {
		t.Fatalf("a second service: %v", err)
	}
	if _, err := s.interactAt(game.CaserneID, game.ArmeeJoinID); err != nil {
		t.Fatal(err)
	}
	if s.Career != game.ArmeeCareer || s.CareerLevel != 1 {
		t.Fatalf("career %s at %d", s.Career, s.CareerLevel)
	}
}

// The EMPT: the concours' two épreuves passed (the age asked), the internat, its brevet, the career at sergent.
func TestEmptEntry(t *testing.T) {
	s := recruit()
	s.Commune, s.HomeCommune = "bingerville", "bingerville"
	s.BornAt = s.GameMinutes - game.MinutesToAge(19)
	old := recruit()
	old.Commune = "bingerville"
	if _, err := old.interactAt(game.EmptID, game.EmptEcritID); err != errEmptAge {
		t.Fatalf("a 25-year-old at the concours: %v", err)
	}
	if _, err := s.interactAt(game.EmptID, "empt-cours"); err != errNotPupil {
		t.Fatalf("a class before the concours: %v", err)
	}
	if line := s.armyPlayed(game.EmptEcritID, 40); !strings.Contains(line, "pas réussi") || s.armyStay() != nil {
		t.Fatalf("failed written: %q", line)
	}
	s.armyPlayed(game.EmptEcritID, 70)
	if _, err := s.interactAt(game.EmptID, game.EmptEcritID); err != errEpreuveDone {
		t.Fatalf("the written again: %v", err)
	}
	if line := s.armyPlayed(game.EmptPhysiqueID, 65); !strings.Contains(line, "Admis") || s.armyStay() == nil || s.armyStay().Program != "empt" {
		t.Fatalf("not admitted: %q", line)
	}
	if _, err := s.interactAt(game.EmptID, "empt-cours"); err != nil {
		t.Fatalf("a pupil's class: %v", err)
	}
	armyFree(s)
	for range 3 {
		for _, id := range game.EmptProgram.Steps {
			s.armyPlayed(id, 95)
		}
	}
	if !s.Life.Armee.Empt || s.armyStay() != nil || len(s.papers) != 1 || s.papers[0].kind != game.DocEMPT || s.papers[0].data["mention"] != "Très bien" {
		t.Fatalf("brevet: %+v %+v", s.Life.Armee, s.papers)
	}
	if txt := s.armyJoin(); s.CareerLevel != 2 || !strings.Contains(txt, "sergent") {
		t.Fatalf("join after the EMPT: %d %q", s.CareerLevel, txt)
	}
}

// Promotion: the army's ladder, soldat to capitaine, by performance like every career; its missions by rung.
func TestArmeePromotion(t *testing.T) {
	c, ok := game.FindCareer(game.ArmeeCareer)
	if !ok || len(c.Levels) != 6 || c.Levels[0].Title != "Soldat" || c.Levels[5].Title != "Capitaine" {
		t.Fatalf("career: %+v", c)
	}
	for i := 1; i < len(c.Levels); i++ {
		if c.Levels[i].Pay <= c.Levels[i-1].Pay {
			t.Fatalf("pay doesn't rise at %s", c.Levels[i].Title)
		}
	}
	for _, id := range []string{"patrouille", "garde", "defile", "inondation"} {
		if _, ok := c.TaskOf(id, 0); !ok {
			t.Fatalf("a soldat's mission: %s", id)
		}
	}
	if _, ok := c.TaskOf("planifier", 0); ok {
		t.Fatal("a soldat plans the missions")
	}
	s := recruit()
	s.Career = game.ArmeeCareer
	s.Performance = game.NeededToPromote(0)
	if line := s.work(c, 100); s.CareerLevel != 1 || !strings.Contains(line, "Caporal") {
		t.Fatalf("not promoted: %q %d", line, s.CareerLevel)
	}
	s.CareerLevel = 5
	s.Performance = 1000
	if s.work(c, 100) != "" || s.CareerLevel != 5 {
		t.Fatal("promoted past capitaine")
	}
}
