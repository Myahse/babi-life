package game

import (
	"testing"
	"time"
)

// The gauges go down with the hours; a whole day at no hunger and it runs off; the hens lay; the sheep's worth grows.
func TestPets(t *testing.T) {
	t0 := time.Date(2026, 11, 24, 8, 0, 0, 0, time.UTC)
	p := Pet{Kind: "chien", Hunger: 60, Spirits: 60, Bond: 30, Updated: t0}
	if p.Decay(t0.Add(2 * time.Hour)); p.Hunger != 48 || p.Spirits != 50 {
		t.Fatalf("2 h later: hunger %v spirits %v", p.Hunger, p.Spirits)
	}
	// Ten more hours: empty; then a day of it and it's gone.
	if gone := p.Decay(t0.Add(12 * time.Hour)); gone || p.Hunger != 0 || p.Away != nil {
		t.Fatalf("12 h: gone %v hunger %v", gone, p.Hunger)
	}
	if gone := p.Decay(t0.Add(30 * time.Hour)); gone {
		t.Fatal("ran off before a full day hungry")
	}
	if gone := p.Decay(t0.Add(37 * time.Hour)); !gone || p.Away == nil || p.Bond != 10 {
		t.Fatalf("a day hungry: gone %v bond %d", gone, p.Bond)
	}
	if p.Mood() != "parti" {
		t.Fatal("mood of a runaway")
	}
	// The hens: an egg every 4 h while fed, up to 6.
	h := Pet{Kind: "poules", Hunger: 100, Spirits: 100, Updated: t0, EggAt: t0}
	h.Decay(t0.Add(9 * time.Hour))
	if h.Eggs != 2 {
		t.Fatalf("eggs after 9 h: %d", h.Eggs)
	}
	h.Hunger = 100
	h.Decay(t0.Add(13 * time.Hour))
	if h.Eggs != 3 {
		t.Fatalf("eggs after 13 h: %d", h.Eggs)
	}
	// The sheep: half its price lean, more each day fed, never past the most.
	if w := SheepWorth(Pet{Kind: "mouton", FedDays: 4}); w != 30000+4*SheepGain {
		t.Fatalf("sheep worth %d", w)
	}
	if w := SheepWorth(Pet{Kind: "mouton", FedDays: 500}); w != SheepMax {
		t.Fatalf("sheep worth capped %d", w)
	}
	for _, k := range PetKinds {
		if len(k.Names) == 0 || k.Price <= 0 || k.Food <= 0 {
			t.Fatalf("%s: incomplete", k.ID)
		}
	}
}
