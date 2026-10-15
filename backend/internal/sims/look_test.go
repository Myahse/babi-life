package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func TestChangeLook(t *testing.T) {
	base := Look{Skin: "#5a3a22", Hair: "short", HairColor: "#111111", Outfit: "tshirt", OutfitColor: "#ff0000", Body: "mince", Height: 1, Eyes: "#222222", Marks: "pansement"}
	s := &Sim{Gender: "homme", Look: base, Money: 5000}

	// Clothes are free; the body and bruises stay.
	nl := base
	nl.Outfit, nl.OutfitColor, nl.Skin, nl.Height, nl.Marks = "jogging", "#00ff00", "#ffffff", 1.3, ""
	cost, err := s.changeLook(nl)
	if err != nil || cost != 0 || s.Money != 5000 {
		t.Fatalf("outfit change: cost %d money %d err %v", cost, s.Money, err)
	}
	if s.Look.Outfit != "jogging" || s.Look.Skin != base.Skin || s.Look.Height != 1 || s.Look.Marks != "pansement" {
		t.Fatalf("look %+v", s.Look)
	}

	// A haircut costs.
	nl = s.Look
	nl.Hair = "degrade"
	if cost, err = s.changeLook(nl); err != nil || cost != HairPrice || s.Money != 5000-HairPrice {
		t.Fatalf("haircut: cost %d money %d err %v", cost, s.Money, err)
	}

	// Too poor for the barber.
	s.Money = 100
	nl.Beard = "bouc"
	if _, err = s.changeLook(nl); err != game.ErrNotEnoughMoney || s.Look.Beard != "" {
		t.Fatalf("poor: %v %+v", err, s.Look)
	}

	// Bad colour, busy Sim.
	nl = s.Look
	nl.OutfitColor = "red"
	if _, err = s.changeLook(nl); err == nil {
		t.Fatal("bad colour accepted")
	}
	s.Activity = &game.Activity{}
	if _, err = s.changeLook(s.Look); err != game.ErrBusy {
		t.Fatalf("busy: %v", err)
	}
}
