package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func TestAllocoTantie(t *testing.T) {
	s := newSim() // at noon
	// Some stalls have plantain this hour, some don't; the answer holds.
	var had, out string
	for i := 0; i < 50 && (had == "" || out == ""); i++ {
		v := string(rune('a'+i%26)) + string(rune('a'+i/26))
		if hasBanana(v, s.GameMinutes) {
			had = v
		} else {
			out = v
		}
	}
	if had == "" || out == "" {
		t.Fatal("expected stalls with and without plantain")
	}
	if hasBanana(out, s.GameMinutes) {
		t.Error("her answer changes within the hour")
	}
	said, err := s.buyAlloco(out)
	if err != nil || said != NoBanana || s.Activity != nil {
		t.Fatalf("no banana: %q %v %v", said, err, s.Activity)
	}
	money := s.Money
	if said, err := s.buyAlloco(had); err != nil || said == NoBanana || s.Activity == nil {
		t.Fatalf("buy: %q %v", said, err)
	}
	if s.Money != money-300 {
		t.Errorf("paid %d", money-s.Money)
	}
	if _, err := s.buyAlloco(had); err != game.ErrBusy {
		t.Errorf("busy: %v", err)
	}
	// At night the stall is closed.
	if hasBanana(had, game.MinuteOf(noon)-12*60+2*60) {
		t.Error("open at 2 a.m.")
	}
}

func TestStreetSellers(t *testing.T) {
	for _, c := range []struct {
		prefix string
		cost   int
	}{{"porc", 1500}, {"cafe", 150}, {"the", 100}, {"foot", 0}, {"basket", 0}, {"causerie", 0}, {"preche", 0}, {"traverser", 0}, {"oranges", 200}, {"eau", 50}, {"credit", 500}, {"pain", 150}} {
		s := newSim() // at noon
		var had string
		for i := 0; i < 80 && had == ""; i++ {
			v := c.prefix + ":" + string(rune('a'+i%26)) + string(rune('a'+i/26))
			if hasStock(v, s.GameMinutes) {
				had = v
			}
		}
		if had == "" {
			t.Fatalf("%s: never in stock at noon", c.prefix)
		}
		money := s.Money
		said, err := s.buyStreet(had)
		if err != nil || said == sellerOf(had).soldOut || s.Activity == nil {
			t.Fatalf("%s: %q %v", c.prefix, said, err)
		}
		if s.Activity.Interaction.ID != "street-"+c.prefix {
			t.Errorf("%s: doing %s", c.prefix, s.Activity.Interaction.ID)
		}
		if s.Money != money-c.cost {
			t.Errorf("%s: paid %d", c.prefix, money-s.Money)
		}
	}
	// The pain brochette is for the evening: none at noon, some at 20 h.
	if hasStock("brochette:x", game.MinuteOf(noon)) {
		t.Error("pain brochette at noon")
	}
	s := newSim()
	s.GameMinutes += 8 * 60
	var had string
	for i := 0; i < 80 && had == ""; i++ {
		if v := "brochette:" + string(rune('a'+i%26)) + string(rune('a'+i/26)); hasStock(v, s.GameMinutes) {
			had = v
		}
	}
	if said, err := s.buyStreet(had); err != nil || s.Activity == nil || s.Activity.Interaction.ID != "street-brochette" {
		t.Fatalf("brochette at 20 h: %q %v", said, err)
	}
	// The street's scenes are there or not: never « sold out » in their hours.
	for h := 0; h < 30; h++ {
		if !hasStock("causerie:"+string(rune('a'+h%26)), game.MinuteOf(noon)+int64(h)) {
			t.Fatal("a causerie with no room")
		}
	}
	// The party and the draughts are for the evening.
	if hasStock("travail:x", game.MinuteOf(noon)) || !hasStock("travail:x", game.MinuteOf(noon)+8*60) || !hasStock("dames:x", game.MinuteOf(noon)+8*60) {
		t.Error("the travaillement and the draughts: from the evening")
	}
	// After the lights go off, no more game on the street's pitch.
	if hasStock("foot:x", game.MinuteOf(noon)+11*60+30) {
		t.Error("street football at 23 h 30")
	}
	// Porc au four isn't sold in the morning.
	if hasStock("porc:x", game.MinuteOf(noon)-12*60+9*60) {
		t.Error("porc au four at 9 a.m.")
	}
}

func TestStreetActivities(t *testing.T) {
	seen := map[string]bool{}
	for _, a := range StreetActivities() {
		if a.Interaction.ID == "" || a.Place == "" || seen[a.Interaction.ID] {
			t.Errorf("street activity %+v", a)
		}
		seen[a.Interaction.ID] = true
	}
	// Every seller and scene is listed (and the garbadrome).
	if len(seen) != len(streetSellers)+1 {
		t.Errorf("%d listed for %d sellers", len(seen), len(streetSellers))
	}
}
