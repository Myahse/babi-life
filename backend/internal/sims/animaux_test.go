package sims

import (
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Feeding costs and fills; the acts wait their time; the eggs sell; a runaway is searched for; the sheep sells.
func TestPetActs(t *testing.T) {
	now := time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)
	s := &Sim{ID: "x", FirstName: "Awa", Needs: game.FreshNeeds(), Money: 10000}
	dog := game.Pet{Kind: "chien", Name: "Rex", Hunger: 30, Spirits: 30, Bond: 10, Updated: now}
	if _, money, _, err := s.petAct(&dog, "nourrir", now, 0); err != nil || money != -500 || s.Money != 9500 || dog.Hunger != 100 || dog.FedDays != 1 {
		t.Fatalf("feed: %v %d %d %v", err, money, s.Money, dog.Hunger)
	}
	if _, _, _, err := s.petAct(&dog, "nourrir", now, 0); err != errPetFull {
		t.Fatalf("fed twice: %v", err)
	}
	if _, _, _, err := s.petAct(&dog, "promener", now, 0); err != nil || dog.Spirits != 75 {
		t.Fatalf("walk: %v %v", err, dog.Spirits)
	}
	if _, _, _, err := s.petAct(&dog, "promener", now.Add(time.Hour), 0); err != errPetSoon {
		t.Fatalf("walked again too soon: %v", err)
	}
	if _, _, _, err := s.petAct(&dog, "oeufs", now, 0); err != errPetAct {
		t.Fatalf("a dog's eggs: %v", err)
	}
	// Ran off: nothing but the search, which finds it or not.
	away := now
	dog.Away = &away
	if _, _, _, err := s.petAct(&dog, "caresser", now, 0); err != errPetAway {
		t.Fatalf("petting a runaway: %v", err)
	}
	if text, _, _, err := s.petAct(&dog, "chercher", now, 0.9); err != nil || dog.Away == nil || !strings.Contains(text, "pas de Rex") {
		t.Fatalf("search, not found: %v %q", err, text)
	}
	if _, _, _, err := s.petAct(&dog, "chercher", now.Add(30*time.Minute), 0.1); err != nil || dog.Away != nil {
		t.Fatalf("search, found: %v", err)
	}
	// The hens' eggs.
	hens := game.Pet{Kind: "poules", Name: "Les cocottes", Eggs: 3, Hunger: 80, Spirits: 50, Updated: now}
	before := s.Money
	if _, money, _, err := s.petAct(&hens, "oeufs", now, 0); err != nil || money != 450 || s.Money != before+450 || hens.Eggs != 0 {
		t.Fatalf("eggs: %v %d", err, money)
	}
	if _, _, _, err := s.petAct(&hens, "oeufs", now, 0); err != errPetNoEggs {
		t.Fatalf("no eggs: %v", err)
	}
	// The sheep: sold (gone), never the feast off the Tabaski.
	sheep := game.Pet{Kind: "mouton", Name: "Kabou", FedDays: 2, Hunger: 80, Spirits: 50, Updated: now}
	if _, _, _, err := s.petAct(&sheep, "tabaski", now, 0); err != errPetTabaski {
		t.Fatalf("tabaski off the day: %v", err)
	}
	if _, money, gone, err := s.petAct(&sheep, "vendre", now, 0); err != nil || !gone || money != game.SheepWorth(sheep) {
		t.Fatalf("sell: %v %d %v", err, money, gone)
	}
}
