package sims

import (
	"math/rand/v2"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

func TestJobTask(t *testing.T) {
	rng := rand.New(rand.NewPCG(1, 2))
	s := &Sim{Career: "caisse", GameMinutes: 600}
	if _, err := s.jobTask("encaisser", rng); err != errNotAtWork {
		t.Fatalf("off shift: %v, want errNotAtWork", err)
	}
	s.Activity = &game.Activity{Kind: "do", Career: "caisse", Start: 540, End: 960}
	if _, err := s.jobTask("cloture", rng); err != errNotYours {
		t.Errorf("a task of a higher rung: %v, want errNotYours", err)
	}
	if _, err := s.jobTask("encaisser", rng); err != nil {
		t.Fatalf("on shift: %v", err)
	}
	if s.Performance != 1 {
		t.Errorf("performance %d after the first time, want 1", s.Performance)
	}
	if _, err := s.jobTask("encaisser", rng); err != errNotYet {
		t.Errorf("again at once: %v, want errNotYet", err)
	}
	s.GameMinutes += game.TaskCooldown
	if _, err := s.jobTask("encaisser", rng); err != nil {
		t.Fatalf("an hour later: %v", err)
	}
	if s.Performance != 1 {
		t.Errorf("performance %d after doing it again, want 1 (once a shift)", s.Performance)
	}
}

// With the switch on, free in its hours and in a commune with its workplace, the Sim starts its shift.
func TestGoToWork(t *testing.T) {
	s := &Sim{Career: "pharmacie", City: "abidjan", Commune: "koumassi", HomeCity: "abidjan", HomeCommune: "koumassi", GameMinutes: 8 * 60, Needs: game.Needs{Hunger: 80, Energy: 80, Hygiene: 80, Social: 80, Fun: 80}}
	if !s.goToWork() {
		t.Fatal("at 8 h, a pharmacy in the commune: no shift started")
	}
	if s.Activity == nil || s.Activity.Career != "pharmacie" || s.Activity.PlaceID != "koumassi-pharmacie" {
		t.Errorf("activity %+v, want the shift at koumassi-pharmacie", s.Activity)
	}
	late := &Sim{Career: "pharmacie", City: "abidjan", Commune: "koumassi", GameMinutes: 20 * 60, Needs: s.Needs}
	if late.goToWork() {
		t.Error("at 20 h, past the shift's hours: started all the same")
	}
	// Yamoussoukro's pharmacies are the map's.
	yakro := &Sim{Career: "pharmacie", City: "yamoussoukro", Commune: "yakro-centre", HomeCity: "yamoussoukro", HomeCommune: "yakro-centre", GameMinutes: 8 * 60, Needs: s.Needs}
	if !yakro.goToWork() {
		t.Fatal("at 8 h in Yamoussoukro: no shift started at a pharmacy of the map")
	}
	if _, cm, p, ok := world.FindPlace(yakro.Activity.PlaceID); !ok || p.Kind != "pharmacie" || cm.ID != "yakro-centre" {
		t.Errorf("shift at %q (%s in %s), want a pharmacy of Yamoussoukro", yakro.Activity.PlaceID, p.Kind, cm.ID)
	}
}
