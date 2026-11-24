package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func TestFamilleJouable(t *testing.T) {
	s := lifeSim()
	s.lifeOn, s.familleOn = true, true
	f := s.fam()
	f.Kids = []Kid{{ID: "k1", Name: "Ange", Stage: game.StageEnfant}, {ID: "k2", Name: "Bébé", Stage: game.StageBebe}}
	f.Elders = []Elder{{ID: "e1", Name: "Mamie", Kin: "maman"}}
	s.houseSync()
	if s.memberRole("kid:k1") != game.RoleEnfant || s.memberRole("elder:e1") != game.RoleAncien {
		t.Fatal("rôles")
	}
	// Homework: the average up, at most NoteDayGain a day.
	for range 5 {
		if err := s.houseDo("kid:k1", "devoirs"); err != nil {
			t.Fatal(err)
		}
	}
	if got := f.kid("k1").Note; got != game.NoteStart+game.NoteDayGain {
		t.Errorf("moyenne %v", got)
	}
	// Not the child's: the elder's tale; with another: the hug, not with someone not there.
	if err := s.houseDo("kid:k1", "conter"); err != errNotForRole {
		t.Errorf("conte par l'enfant : %v", err)
	}
	s.Needs = game.Needs{Fun: 10, Social: 10}
	if err := s.houseDo("elder:e1", "conter"); err != nil || s.Needs.Fun != 20 {
		t.Errorf("conte : %v %v", err, s.Needs)
	}
	if err := s.houseDo("elder:e1", "calin@kid:k9"); err != errPairWho {
		t.Errorf("câlin à personne : %v", err)
	}
	if err := s.houseDo("elder:e1", "calin@self"); err != nil || s.Needs.Social != 20+25 {
		t.Errorf("câlin au Sim : %v %v", err, s.Needs)
	}
	if err := s.houseDo("elder:e1", "aider-devoirs@elder:e1"); err != errPairWho {
		t.Errorf("avec soi-même : %v", err)
	}
	// Neglected a day: the average falls.
	s.Life.House["kid:k1"] = game.Needs{Hunger: 10, Energy: 10, Hygiene: 10, Social: 10, Fun: 10}
	before := f.kid("k1").Note
	s.kidsNeglect(game.DayMinutes)
	if f.kid("k1").Note >= before {
		t.Error("négligé, la moyenne ne baisse pas")
	}
	// Grown up with a good average: the mention, the renom.
	k := f.kid("k1")
	k.Note = 15
	s.kidBac(k)
	if k.Mention == "" || len(s.renomDue) != 1 {
		t.Errorf("mention : %q %v", k.Mention, s.renomDue)
	}
	// Closed: only the house's pieces.
	s.familleOn = false
	if err := s.houseDo("elder:e1", "conter"); err == nil {
		t.Error("fermée, le conte passe")
	}
}
