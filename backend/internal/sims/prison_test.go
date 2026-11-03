package sims

import (
	"slices"
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// In prison: nowhere else, no taxi, nothing stopped; the étapes come as their interactions start, the
// juge only once the rest is done; his hearing over, let out.
func TestPrison(t *testing.T) {
	s := &Sim{ID: "x", FirstName: "Awa", Needs: game.FreshNeeds(), Money: 1000, City: "abidjan", Commune: "plateau", HomeCity: "abidjan", HomeCommune: "plateau", Record: 1}
	s.jail(false)
	if s.Prison == nil || !slices.Equal(s.Prison.Steps, []string{"cantine", "promenade", "atelier", "parloir", "juge"}) {
		t.Fatalf("sentence: %+v", s.Prison)
	}
	if _, err := s.interactAt(HomePlaceID, "sleep"); err != errInPrison {
		t.Fatalf("home from prison: %v", err)
	}
	city, cm, _ := world.FindCommune("abidjan", "cocody")
	if err := s.leave(city, cm); err != errInPrison {
		t.Fatalf("a taxi from prison: %v", err)
	}
	if _, err := s.interactAt(PrisonPlaceID, game.JugeID); err == nil {
		t.Fatal("the juge before the rest")
	}
	finish := func() {
		s.GameMinutes = s.Activity.End
		s.Activity = nil
	}
	for i, id := range []string{"prison-cantine", "prison-promenade", "prison-atelier", "prison-parloir"} {
		if _, err := s.interactAt(PrisonPlaceID, id); err != nil {
			t.Fatalf("%s: %v", id, err)
		}
		if _, err := s.stop(); err != errInPrison {
			t.Fatalf("stopped in prison: %v", err)
		}
		if len(s.Prison.Done) != i+1 || len(s.pending) != i+1 || !strings.Contains(s.pending[i].Text, "Étape de prison") {
			t.Fatalf("%s: done %v", id, s.Prison.Done)
		}
		if ev := s.settlePrison(); ev != nil {
			t.Fatal("let out too soon")
		}
		finish()
	}
	if _, err := s.interactAt(PrisonPlaceID, game.JugeID); err != nil {
		t.Fatalf("the juge: %v", err)
	}
	if s.settlePrison() != nil {
		t.Fatal("let out during the hearing")
	}
	finish()
	if ev := s.settlePrison(); len(ev) != 1 || s.Prison != nil || !strings.Contains(ev[0].Text, "Libéré") {
		t.Fatalf("not let out: %+v %+v", ev, s.Prison)
	}
	if _, err := s.interactAt(PrisonPlaceID, "prison-cantine"); err == nil {
		t.Fatal("the cantine, free")
	}
}
