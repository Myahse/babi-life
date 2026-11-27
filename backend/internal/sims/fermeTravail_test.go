package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The farm's work at the plot: started as a timed action (nothing done nor paid yet), done once when it ends;
// stopped before, nothing at all; refused at the start when it couldn't be done.
func TestFermeWorkTimed(t *testing.T) {
	s := fermeSim(500000)
	if _, _, err := s.fermeAct("acheter", fermeReq{Offre: "gonate"}, openAll); err != nil {
		t.Fatal(err)
	}
	p := s.ferme().Plots[0]
	if _, ok, err := s.fermeWorkStart("labourer", fermeReq{Plot: p.ID}, openAll); !ok || err != errFermeStage {
		t.Fatalf("ploughing the bush: %v %v", ok, err)
	}
	if s.Activity != nil {
		t.Fatal("started all the same")
	}
	money := s.Money
	if label, ok, err := s.fermeWorkStart("defricher", fermeReq{Plot: p.ID, Hire: true}, openAll); !ok || err != nil || label == "" {
		t.Fatalf("clear: %v %v", ok, err)
	}
	if !isFermeWork(s.Activity) || s.Activity.PlaceID != "ferme-gonate" || p.Champ.Stage != game.StageFriche || s.Money != money {
		t.Fatalf("done or paid at the start: %+v %s %d", s.Activity, p.Champ.Stage, s.Money)
	}
	if _, ok, err := s.fermeWorkStart("defricher", fermeReq{Plot: p.ID}, openAll); !ok || err != game.ErrBusy {
		t.Fatalf("twice at once: %v", err)
	}
	// Stopped: nothing.
	if _, err := s.stop(); err != nil {
		t.Fatal(err)
	}
	if p.Champ.Stage != game.StageFriche || s.Money != money {
		t.Fatalf("stopped, yet done: %s %d", p.Champ.Stage, s.Money)
	}
	// To its end: done, paid once.
	if _, _, err := s.fermeWorkStart("defricher", fermeReq{Plot: p.ID, Hire: true}, openAll); err != nil {
		t.Fatal(err)
	}
	s.GameMinutes = s.Activity.End
	s.finish(newRand())
	if p.Champ.Stage != game.StageDefriche || s.Money != money-game.ClearCost || s.Activity != nil {
		t.Fatalf("not done at the end: %s %d", p.Champ.Stage, s.Money)
	}
	// A plot away can't be worked by the Sim.
	s.City = "abidjan"
	if _, ok, err := s.fermeWorkStart("labourer", fermeReq{Plot: p.ID}, openAll); !ok || err != errFermeAway {
		t.Fatalf("away: %v", err)
	}
}

// Milking: once a day, never money.
func TestFermeMilk(t *testing.T) {
	s := fermeSim(500000)
	if _, _, err := s.fermeAct("acheter", fermeReq{Offre: "gonate"}, openAll); err != nil {
		t.Fatal(err)
	}
	p := s.ferme().Plots[0]
	p.Pens = []*Enclos{{Kind: "chevres", Adults: 2, Condition: 80}, {Kind: "poules", Adults: 3, Condition: 80}}
	money := s.Money
	if _, m, err := s.fermeAct("traire", fermeReq{Plot: p.ID, Kind: "chevres"}, openAll); err != nil || m != 0 || s.Money != money {
		t.Fatalf("milk: %v %d", err, m)
	}
	if _, _, err := s.fermeAct("traire", fermeReq{Plot: p.ID, Kind: "chevres"}, openAll); err != errFermeDone {
		t.Fatalf("twice: %v", err)
	}
	if _, _, err := s.fermeAct("traire", fermeReq{Plot: p.ID, Kind: "poules"}, openAll); err != errFermeNoMilk {
		t.Fatalf("hens: %v", err)
	}
}

// The yard at home: worked there, where the Sim stands (no place of its own).
func TestFermeWorkYard(t *testing.T) {
	s := fermeSim(500000)
	s.City, s.Commune = s.HomeCity, s.HomeCommune
	if _, _, err := s.fermeAct("acheter", fermeReq{Offre: "cour"}, openAll); err != nil {
		t.Fatal(err)
	}
	p := s.ferme().Plots[0]
	if _, _, err := s.fermeWorkStart("labourer", fermeReq{Plot: p.ID}, openAll); err != nil {
		t.Fatal(err)
	}
	if s.Activity.PlaceID != "" {
		t.Fatalf("the yard's work at a place: %q", s.Activity.PlaceID)
	}
	s.GameMinutes = s.Activity.End
	s.finish(newRand())
	if p.Champ.Stage != game.StageLaboure {
		t.Fatalf("yard not ploughed: %s", p.Champ.Stage)
	}
}
