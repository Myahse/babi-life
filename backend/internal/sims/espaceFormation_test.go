package sims

import (
	"slices"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// astroRecruit: an adult at the Centre d'entraînement Astrélia, bac D, a Master in sciences, untrained.
func astroRecruit() *Sim {
	s := astronaut()
	s.Life.Espace = nil
	s.Commune = "sassandra-spatioport"
	s.Life.Etudes = &game.Etudes{BAC: &game.Exam{Note: 13, Serie: game.SerieD}, Diplomes: []game.Diplome{{Degree: game.DegreeMaster, Filiere: "sciences"}}}
	return s
}

// The six jobs sit on the game's pay scale, ask for the bac (WorkExams) and their diplomas past the first rung.
func TestEspaceCareersGates(t *testing.T) {
	for _, id := range game.EspaceCareers {
		c, ok := game.FindCareer(id)
		if !ok {
			t.Fatalf("no career %s", id)
		}
		if c.Levels[0].Pay < 2500 || c.Levels[len(c.Levels)-1].Pay > 10500 {
			t.Errorf("%s pays %d..%d, off the scale", id, c.Levels[0].Pay, c.Levels[len(c.Levels)-1].Pay)
		}
		if !slices.Contains(game.WorkExams(id), game.ExamBAC) {
			t.Errorf("%s doesn't ask for the bac", id)
		}
		if len(c.Tasks) == 0 {
			t.Errorf("%s has no tasks", id)
		}
	}
	astro := game.DiplomaGates[game.AstronauteCareer]
	if !astro.Meets([]game.Diplome{{Degree: game.DegreeMaster, Filiere: "sciences"}}) || !astro.Meets([]game.Diplome{{Degree: game.DegreeMedecine, Filiere: "medecine"}}) {
		t.Error("a Master in sciences or a doctorate in medicine doesn't open the astronaut's rung")
	}
	if astro.Meets([]game.Diplome{{Degree: game.DegreeMaster, Filiere: "droit"}}) || astro.Meets([]game.Diplome{{Degree: game.DegreeLicence, Filiere: "sciences"}}) {
		t.Error("a Master in law, or a Licence, opens the astronaut's rung")
	}
	if game.DiplomaGates[game.IngenieurCareer].Meets([]game.Diplome{{Degree: game.DegreeMaster, Filiere: "genie"}}) {
		t.Error("the launch engineer without the engineer's diploma")
	}
	if !game.DiplomaGates[game.PasDeTirCareer].Meets([]game.Diplome{{Degree: game.DegreeBTS, Filiere: "info"}}) {
		t.Error("the pad technician with a BTS")
	}

	// The concours asks for a bac C or D; the drills, the written passed; the hire, the selection.
	s := astroRecruit()
	if err := s.espaceHire(game.AstronauteCareer); err != errAstroHire {
		t.Fatalf("hired without the selection: %v", err)
	}
	a := astroRecruit()
	a.Life.Etudes.BAC.Serie = game.SerieA
	if _, err := a.interactAt(game.EntrainementID, game.ConcoursEcritID); err != errAstroBac {
		t.Fatalf("the concours with a bac A: %v", err)
	}
	if _, err := s.interactAt(game.EntrainementID, game.SelCentriID); err != errAstroNeedEcrit {
		t.Fatalf("a drill before the written: %v", err)
	}
	if line := s.formationPlayed(game.ConcoursEcritID, 40); s.formation().Ecrit != 40 || line == "" {
		t.Fatalf("written at 40: %q", line)
	}
	if _, err := s.interactAt(game.EntrainementID, game.SelCentriID); err != errAstroNeedEcrit {
		t.Fatalf("a drill after a failed written: %v", err)
	}
	s.formationPlayed(game.ConcoursEcritID, 70)
	for _, d := range game.SelectionDrills {
		if d == game.SelMedicaleID {
			continue
		}
		s.formationPlayed(d, 30) // under DrillPass: again
		if s.formation().Drills[d] >= game.DrillPass {
			t.Fatalf("%s passed at 30", d)
		}
		s.formationPlayed(d, 75)
	}
	// The medical: every need at 50, and not sick.
	s.Needs.Hunger = 20
	if _, err := s.interactAt(game.EntrainementID, game.SelMedicaleID); err == nil {
		t.Fatal("the medical, hungry")
	}
	s.Needs = game.FreshNeeds()
	s.sick = true
	if _, err := s.interactAt(game.EntrainementID, game.SelMedicaleID); err != errSpaceSick {
		t.Fatalf("the medical, sick: %v", err)
	}
	s.sick = false
	if _, err := s.interactAt(game.EntrainementID, game.SelMedicaleID); err != nil {
		t.Fatal(err)
	}
	if !s.formation().Selected {
		t.Fatalf("not selected after every drill: %+v", s.formation())
	}
	if err := s.espaceHire(game.AstronauteCareer); err != nil {
		t.Fatal(err)
	}
	s.Activity = nil
	s.Career, s.CareerLevel = game.AstronauteCareer, 0
	s.espaceJoined()
	if st := s.formation().Stay; st == nil || st.Modules != len(game.FormationModules) || s.CareerLevel != 0 {
		t.Fatalf("the stay didn't start: %+v level %d", st, s.CareerLevel)
	}
	// A candidate isn't promoted, nor flies free, without the brevet.
	if g, held := s.promotionGate(game.Career{ID: game.AstronauteCareer}); !held || g.Level != 1 {
		t.Fatal("promoted without the brevet")
	}
	if s.missionAllowed("station") {
		t.Fatal("a candidate flies free")
	}
	// A stay's drill out of its module: no.
	if _, err := s.interactAt(game.EntrainementID, game.ModSurvieID); err != errAstroNotModule {
		t.Fatalf("module 3's drill in module 1: %v", err)
	}
}

// The stay's three modules, each its drills (under 50: again), then the brevet, the paper, the rung Astronaute.
func TestBrevetAstronaute(t *testing.T) {
	s := astroRecruit()
	f := s.formation()
	f.Ecrit, f.Selected = 80, true
	s.Career = game.AstronauteCareer
	s.espaceJoined()
	for m, mod := range game.FormationModules {
		for _, id := range mod.Steps {
			if s.formationPlayed(id, 20); slices.Contains(f.Stay.Done, id) {
				t.Fatalf("%s counted at 20", id)
			}
			s.formationPlayed(id, 85)
		}
		if m < len(game.FormationModules)-1 && (f.Stay == nil || f.Stay.Module != m+1) {
			t.Fatalf("module %d not passed: %+v", m+1, f.Stay)
		}
	}
	if !f.Brevet || f.Stay != nil {
		t.Fatalf("no brevet: %+v", f)
	}
	if !slices.ContainsFunc(s.papers, func(p paperIssue) bool { return p.kind == game.DocBrevetAstro }) {
		t.Fatal("the brevet isn't in the papers")
	}
	if s.CareerLevel != 1 {
		t.Fatalf("not promoted Astronaute: level %d", s.CareerLevel)
	}
	if !s.missionAllowed("station") || s.missionAllowed("lune") {
		t.Fatal("an Astronaute flies free to the station only")
	}
}

// The tourists' express training (with a ticket), the boarding's medical: not sick, trained.
func TestBoardingTrainedNotSick(t *testing.T) {
	station, cm := spaceCity(t, "station-akwaba")
	s := astroRecruit()
	if _, err := s.interactAt("sassandra-pas-de-tir", game.TourCentriID); err != errAstroNoTicket {
		t.Fatalf("the express training without a ticket: %v", err)
	}
	s.space().Ticket = &SpaceTicket{Dest: "station", Paid: 1}
	s.space().LaunchNow = true
	if err := s.leaveWith(station, cm, Ride{App: game.RocketApp}, rocketRng()); err != errSpaceTraining {
		t.Fatalf("boarded untrained: %v", err)
	}
	for _, id := range game.TouristDrills {
		if _, err := s.interactAt("sassandra-pas-de-tir", id); err != nil {
			t.Fatal(err)
		}
		s.Activity = nil
	}
	if !s.space().Training {
		t.Fatalf("the express training not done: %+v", s.formation())
	}
	s.sick = true
	if err := s.leaveWith(station, cm, Ride{App: game.RocketApp}, rocketRng()); err != errSpaceSick {
		t.Fatalf("boarded sick: %v", err)
	}
	s.sick = false
	if err := s.leaveWith(station, cm, Ride{App: game.RocketApp}, rocketRng()); err != nil {
		t.Fatal(err)
	}
}

// An astronaut flies free; a mission is MissionShifts shifts aboard, one a day (the cap holds), never more pay.
func TestMissionShiftsInCap(t *testing.T) {
	station, cm := spaceCity(t, "station-akwaba")
	s := astroRecruit()
	f := s.formation()
	f.Selected, f.Brevet = true, true
	s.Career, s.CareerLevel = game.AstronauteCareer, 1
	s.space().LaunchNow = true
	money := s.Money
	if err := s.leaveWith(station, cm, Ride{App: game.RocketApp}, rocketRng()); err != nil {
		t.Fatalf("a mission without a ticket: %v", err)
	}
	if v := s.voyage(); v == nil || !v.Mission || v.Paid != 0 || s.Money != money {
		t.Fatalf("not a free mission: %+v", v)
	}
	arrive(s)
	s.GameMinutes = (s.GameMinutes/(24*60)+1)*24*60 + 8*60
	if _, err := s.interactAt("akwaba-module-vie", game.WorkInteractionID); err != nil {
		t.Fatal(err)
	}
	s.GameMinutes = s.Activity.End
	evs := s.finish(rocketRng())
	if m := f.Mission; m == nil || m.Shifts != 1 || m.Need != game.MissionShifts["station"] {
		t.Fatalf("the shift aboard didn't count: %+v %v", m, evs)
	}
	if _, err := s.interactAt("akwaba-module-vie", game.WorkInteractionID); err == nil {
		t.Fatal("a second paid shift the same day, on a mission")
	}
	// The next day's shift: the mission accomplished.
	for f.Mission.Shifts < f.Mission.Need {
		s.missionShift(&game.Activity{Kind: "do", Career: s.Career, Interaction: game.Interaction{ID: game.WorkInteractionID}})
	}
	if !f.Mission.Done || f.MissionsDone != 1 {
		t.Fatalf("mission not accomplished: %+v", f)
	}
	// Not twice.
	if evs := s.missionShift(&game.Activity{Kind: "do", Career: s.Career, Interaction: game.Interaction{ID: game.WorkInteractionID}}); evs != nil || f.MissionsDone != 1 {
		t.Fatal("a mission accomplished twice")
	}
}
