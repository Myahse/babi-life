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
	}{{"porc", 1500}, {"cafe", 150}, {"the", 100}, {"foot", 0}, {"basket", 0}} {
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
	// After the lights go off, no more game on the street's pitch.
	if hasStock("foot:x", game.MinuteOf(noon)+11*60+30) {
		t.Error("street football at 23 h 30")
	}
	// Porc au four isn't sold in the morning.
	if hasStock("porc:x", game.MinuteOf(noon)-12*60+9*60) {
		t.Error("porc au four at 9 a.m.")
	}
}
