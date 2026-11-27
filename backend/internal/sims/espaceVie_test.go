package sims

import (
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// aboard: an adult at a commune up there, already arrived.
func aboard(city, commune string) *Sim {
	s := astronaut()
	s.City, s.Commune = city, commune
	s.space().Voyage = &SpaceVoyage{Dest: "station", From: "sassandra", Done: []string{}, Launched: s.GameMinutes - 60, Arrived: s.GameMinutes - 30}
	return s
}

// doneAt: the action started at the place, played to its end; its journal.
func doneAt(t *testing.T, s *Sim, place, id string, play func()) []Event {
	t.Helper()
	if _, err := s.interactAt(place, id); err != nil {
		t.Fatalf("%s: %v", id, err)
	}
	if play != nil {
		play()
	}
	s.GameMinutes = s.Activity.End
	return s.finish(rocketRng())
}

// The spacewalk: a good mini-game gives more skill points than none; never money; the oxygen out means
// « retour au sas », nobody hurt.
func TestSpacewalkScore(t *testing.T) {
	plain := aboard("station-akwaba", "akwaba-noeud")
	money := plain.Money
	doneAt(t, plain, "akwaba-sas", game.SpacewalkID, nil)
	played := aboard("station-akwaba", "akwaba-noeud")
	doneAt(t, played, "akwaba-sas", game.SpacewalkID, func() {
		if _, err := played.spacePlayed("eva", 95, false); err != nil {
			t.Fatal(err)
		}
		// Once each time.
		if text, _ := played.spacePlayed("eva", 10, false); !strings.Contains(text, "Déjà") {
			t.Fatalf("played twice: %s", text)
		}
	})
	if played.Life.Skills["bricolage"] <= plain.Life.Skills["bricolage"] || plain.Life.Skills["bricolage"] == 0 {
		t.Fatalf("skills: played %d, plain %d", played.Life.Skills["bricolage"], plain.Life.Skills["bricolage"])
	}
	if plain.Money != money || played.Money != money {
		t.Fatalf("money moved: %d %d (was %d)", plain.Money, played.Money, money)
	}
	if played.Life.Espace.Vie.BestEVA != 95 {
		t.Fatalf("best %d", played.Life.Espace.Vie.BestEVA)
	}
	air := aboard("station-akwaba", "akwaba-noeud")
	events := doneAt(t, air, "akwaba-sas", game.SpacewalkID, func() {
		text, err := air.spacePlayed("eva", 30, true)
		if err != nil || !strings.Contains(text, "retour au sas") {
			t.Fatalf("out of air: %q %v", text, err)
		}
	})
	if !slicesHas(events, "Retour au sas") {
		t.Fatalf("no airlock line: %+v", events)
	}
	// Not during another action, nor on Earth.
	if _, err := astronaut().spacePlayed("eva", 80, false); err == nil {
		t.Fatal("a spacewalk scored on Earth")
	}
	// No spacewalk from the Moon's airlock.
	if _, err := aboard("lune", "lune-base").interactAt("lune-base-sas", game.SpacewalkID); err == nil {
		t.Fatal("the station's spacewalk at the Moon")
	}
}

func slicesHas(events []Event, text string) bool {
	for _, e := range events {
		if strings.Contains(e.Text, text) {
			return true
		}
	}
	return false
}

// The lab's experiments give skill points, never Djai.
func TestExperimentsSkills(t *testing.T) {
	s := aboard("station-akwaba", "akwaba-labo")
	money := s.Money
	doneAt(t, s, "akwaba-labo-module", "labo-cristaux", func() { _, _ = s.spacePlayed("labo", 80, false) })
	if s.Life.Skills["logique"] == 0 || s.Money != money || s.Life.Espace.Vie.Experiments != 1 {
		t.Fatalf("logique %d, money %d (was %d), %+v", s.Life.Skills["logique"], s.Money, money, s.Life.Espace.Vie)
	}
	// The cupola's photo.
	c := aboard("station-akwaba", "akwaba-coupole")
	doneAt(t, c, "akwaba-coupole-hublots", game.PhotoTerreID, nil)
	if c.Life.Espace.Vie.Photos != 1 || c.Money != money {
		t.Fatalf("photo: %+v", c.Life.Espace.Vie)
	}
}

// A message from Mars reaches the Earth 12 minutes later, the family's answer 12 more after that.
func TestMarsMessageLag(t *testing.T) {
	s := aboard("mars", "mars-colonie")
	s.space().Voyage.Dest = "mars"
	doneAt(t, s, "mars-colonie-dome", game.MarsMessageID, nil)
	sent := s.GameMinutes
	if n := len(s.Life.Espace.Vie.Mail); n != 2 {
		t.Fatalf("mail %d", n)
	}
	if evs := s.advanceTo(sent+game.MarsLag-1, rocketRng()); slicesHas(evs, "arrivé à la maison") {
		t.Fatal("arrived too early")
	}
	if evs := s.advanceTo(sent+game.MarsLag, rocketRng()); !slicesHas(evs, "arrivé à la maison") {
		t.Fatalf("not arrived at +12: %+v", evs)
	}
	if evs := s.advanceTo(sent+2*game.MarsLag, rocketRng()); !slicesHas(evs, "Réponse de la maison") {
		t.Fatalf("no answer at +24: %+v", evs)
	}
	if len(s.Life.Espace.Vie.Mail) != 0 {
		t.Fatal("mail left")
	}
}

// The places up there each have their kind's actions; Mars's dust storm is a happening there only.
func TestSpacePlacesAndStorm(t *testing.T) {
	for _, c := range world.Espace {
		for _, cm := range c.Communes {
			for _, p := range cm.Places {
				if _, ok := game.Kinds[p.Kind]; !ok {
					t.Errorf("%s: no kind %s", p.ID, p.Kind)
				}
			}
		}
	}
	storms := 0
	for m := int64(0); m < 200*game.HappeningMinutes; m += game.HappeningMinutes {
		if h, _, ok := game.HappeningAt("mars", "mars-colonie", m); ok {
			storms++
			if h.ID != game.DustStormID {
				t.Fatalf("on Mars: %s", h.ID)
			}
		}
		if _, _, ok := game.HappeningAt("station-akwaba", "akwaba-noeud", m); ok {
			t.Fatal("a happening aboard the station")
		}
	}
	if storms == 0 || storms > 100 {
		t.Fatalf("storms %d in 200 slots", storms)
	}
}
