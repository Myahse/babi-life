package sims

import (
	"math/rand/v2"
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Papa and maman answer their child at home: a baby babbles and hugs, a child asks for
// pocket money; no flirting with them, and no parents once grown up.
func TestTalkingToParents(t *testing.T) {
	s := newSimPtr()
	s.City, s.Commune, s.HomeCity, s.HomeCommune = "abidjan", "cocody", "abidjan", "cocody"
	s.Housing = "appart"
	s.GameMinutes = 100000
	s.BornAt = s.GameMinutes - 2 // a baby
	maman := Passerby{ID: ParentPrefix + "maman", Name: "Maman", Gender: "femme", Seed: 2}
	rng := rand.New(rand.NewPCG(1, 1))
	if _, err := s.chat(maman, "parent-babiller", "", false, rng); err != nil {
		t.Fatalf("a baby babbling: %v", err)
	}
	if _, err := s.chat(maman, "parent-poche", "", false, rng); err == nil {
		t.Fatal("a baby asking for pocket money")
	}
	s.BornAt = s.GameMinutes - game.MinutesToAge(10) // a child
	if _, err := s.chat(maman, "drague", "", true, rng); err != errNotParents {
		t.Fatalf("flirting with maman: %v", err)
	}
	got := 0
	for i := 0; i < 30; i++ {
		s.Activity = nil
		a, err := s.chat(maman, "parent-poche", "", false, rand.New(rand.NewPCG(uint64(i), 3)))
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(a.Text, "{") {
			t.Fatalf("a placeholder left: %s", a.Text)
		}
		got += a.Money
	}
	if got <= 0 {
		t.Fatal("never any pocket money")
	}
	s.BornAt = s.GameMinutes - game.MinutesToAge(20) // grown up: left home
	if _, err := s.chat(maman, "parent-calin", "", false, rng); err != errNoParents {
		t.Fatalf("parents after 18: %v", err)
	}
}
