package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Every Earth space activity is offered at its places, and each place is real in the world.
func TestEspaceTerrePlaces(t *testing.T) {
	for kind, acts := range game.EspaceTerreActs {
		for _, it := range acts {
			if len(it.Places) == 0 && kind != game.SpatioportKind && kind != game.VisiteursKind {
				t.Errorf("%s: no places", it.ID)
			}
			for _, p := range it.Places {
				_, _, place, ok := world.FindPlace(p)
				if !ok || place.Kind != kind {
					t.Errorf("%s: place %s missing or not a %s", it.ID, p, kind)
				}
			}
			if it.Cost < 0 {
				t.Errorf("%s pays: nothing on Earth's space side pays", it.ID)
			}
		}
	}
	for p := range game.WatchFrom {
		if _, _, _, ok := world.FindPlace(p); !ok {
			t.Errorf("watch place %s missing", p)
		}
	}
}

// The visitor centre, the Albatros 0G and the hop: they cost, they give mood (and skills), never money back.
func TestEspaceTerreNeverPays(t *testing.T) {
	cases := []struct{ commune, place, act string }{
		{"sassandra-spatioport", "sassandra-visiteurs", game.ActVisiteurs},
		{"sassandra-spatioport", "sassandra-visiteurs", game.ActCentrifuge},
		{"sassandra-centre", "sassandra-aeroport", game.ActAlbatros},
		{"sassandra-spatioport", "sassandra-pas-de-tir", game.ActSuborbital},
		{"sassandra-spatioport", "sassandra-plage-lancements", game.ActPlage},
	}
	for _, c := range cases {
		s := astronaut()
		s.Money = 2_000_000
		s.Commune = c.commune
		s.GameMinutes = s.GameMinutes - s.GameMinutes%(24*60) + 10*60
		it, err := s.interactAt(c.place, c.act)
		if err != nil {
			t.Fatalf("%s: %v", c.act, err)
		}
		before := s.Money
		s.Activity = &game.Activity{Kind: "do", Interaction: it, PlaceID: c.place, PlaceKind: "x", Start: s.GameMinutes, End: s.GameMinutes + it.Minutes}
		s.GameMinutes = s.Activity.End
		for _, ev := range s.finish(rocketRng()) {
			if ev.Money > 0 {
				t.Errorf("%s gave %d", c.act, ev.Money)
			}
		}
		if s.Money > before {
			t.Errorf("%s: money went up", c.act)
		}
	}
	if c, ok := game.FindCareer(game.GuideCareer); !ok || !c.WorksAt(game.VisiteursKind) {
		t.Error("the guide doesn't work at the visitor centre")
	}
	if sk, _ := game.SkillOf(game.ActAlbatros); sk != "forme" {
		t.Errorf("Albatros trains %q", sk)
	}
}

// The app's cancel: 80 % back before boarding, nothing once boarding, never more than paid.
func TestEspaceCancelFromApp(t *testing.T) {
	s := astronaut()
	if _, err := s.ticketCancelApp(); err != errNoTicketHeld {
		t.Fatalf("no ticket: %v", err)
	}
	s.space().Ticket = &SpaceTicket{Dest: "station", Paid: game.PriceStation}
	before := s.Money
	ev, err := s.ticketCancelApp()
	if err != nil || s.Money-before != game.PriceStation*80/100 || ev.Money != game.PriceStation*80/100 || s.space().Ticket != nil {
		t.Fatalf("cancel: %v %d", err, s.Money-before)
	}
	s.space().Ticket = &SpaceTicket{Dest: "station"}
	s.Activity = &game.Activity{Kind: "travel", Trip: &game.Trip{Mode: game.RocketApp}}
	if _, err := s.ticketCancelApp(); err != errBoarding {
		t.Fatalf("boarding: %v", err)
	}
	s.Activity = nil
	before = s.Money
	if _, err := s.ticketCancelApp(); err != nil || s.Money != before {
		t.Fatal("a given ticket gave money back")
	}
}

// Watching from the beach: a launch in the window says so (and the moodlet), else the next one.
func TestWatchLaunch(t *testing.T) {
	l := game.NextLaunch("sassandra", 600_000)
	s := astronaut()
	s.Commune = "sassandra-spatioport"
	a := &game.Activity{Kind: "do", Interaction: game.Interaction{ID: game.ActPlage}, PlaceID: "sassandra-plage-lancements", Start: l.At - 10, End: l.At + 30}
	if ev := s.spaceEarthDone(a); len(ev) != 1 || ev[0].Money != 0 {
		t.Fatalf("watched: %v", ev)
	}
}
