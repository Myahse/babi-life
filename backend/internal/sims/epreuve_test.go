package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// A story's épreuve: played as the défi « epreuve », no clock ends it (its game does), its reward said.
func TestEpreuveDefi(t *testing.T) {
	for _, id := range game.EpreuveIDs() {
		if defiOf(id) != "epreuve" {
			t.Fatalf("%s: défi %q", id, defiOf(id))
		}
	}
	if _, _, text := defiReward("epreuve", game.EpreuveID("chimpanze"), 90, 0); text == "" {
		t.Fatal("no line for the épreuve")
	}
	if !game.IsEpreuve(game.EpreuveID("dent-de-man")) || game.IsEpreuve("eat-garba") {
		t.Fatal("IsEpreuve")
	}
}
