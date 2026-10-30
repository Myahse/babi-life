package sims

import (
	"context"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// withEvents: the update « evenements-joues » open or closed for the test.
func withEvents(t *testing.T, open bool) {
	t.Helper()
	old := eventsOpen
	eventsOpen = func(context.Context) bool { return open }
	t.Cleanup(func() { eventsOpen = old })
}

// Open, every happening has two choices or more; closed, its single join as before (and no choices).
func TestHappeningChoices(t *testing.T) {
	seen := map[string]bool{}
	for _, h := range game.Happenings {
		open := h.Played(true)
		if open.Join != nil || len(open.Offer()) < 2 {
			t.Errorf("%s open: join %v, %d choices", h.ID, open.Join, len(open.Offer()))
		}
		closed := h.Played(false)
		if len(closed.Choices) != 0 || h.Join == nil || len(closed.Offer()) != 1 || !reflect.DeepEqual(closed.Offer()[0], *h.Join) {
			t.Errorf("%s closed: %+v", h.ID, closed.Offer())
		}
		for _, c := range h.Choices {
			if seen[c.ID] && c.ID != game.JoinHappeningID {
				t.Errorf("%s: %s twice", h.ID, c.ID)
			}
			seen[c.ID] = true
			if c.Label == "" || c.Icon == "" || c.Minutes <= 0 {
				t.Errorf("%s: %+v", h.ID, c.Interaction)
			}
			if c.Mishap != nil && c.Mishap.Text == "" {
				t.Errorf("%s: a mishap without its words", c.ID)
			}
			// What the happening asks (the residents), its choices ask too.
			if h.Join.Requires != nil && c.Requires != h.Join.Requires {
				t.Errorf("%s: asks nothing, the happening asks %+v", c.ID, h.Join.Requires)
			}
		}
	}
	// The ones the owner asked for, as asked.
	pluie, _ := game.FindHappening("pluie")
	for _, id := range []string{"evt-pluie-courir", "evt-pluie-sachets", "evt-pluie-danser"} {
		if !slices.ContainsFunc(pluie.Choices, func(c game.EventChoice) bool { return c.ID == id }) {
			t.Errorf("la grosse pluie without %s", id)
		}
	}
	if c, _, _ := game.FindEventChoice("evt-pluie-sachets"); c.Cost >= 0 {
		t.Errorf("the rain hats sold earn nothing: %d", c.Cost)
	}
	if c, _, _ := game.FindEventChoice("evt-pluie-danser"); c.Effect.Fun <= 0 || c.Effect.Hygiene >= 0 {
		t.Errorf("dancing in the rain: %+v", c.Effect)
	}
}

// Each choice is played as a défi; the kept joins as they were: the jam's junction, the real matches.
func TestHappeningChoicesPlayed(t *testing.T) {
	for _, h := range game.Happenings {
		for _, c := range h.Choices {
			switch {
			case c.ID == game.RegulateTrafficID:
				if defiOf(c.ID) != "circulation" {
					t.Errorf("%s: %q", c.ID, defiOf(c.ID))
				}
			case c.ID == game.JoinHappeningID:
				// The neighbourhood foot and the basket tournament: their own 3D match, no défi, no arrows.
				a := &game.Activity{Kind: "do", Interaction: c.Interaction}
				if !slices.Contains(gesteNotLabels, c.Label) || gesteOK(a) {
					t.Errorf("%s keeps %q: not its own match", h.ID, c.Label)
				}
			default:
				if !strings.HasPrefix(c.ID, game.EventChoicePrefix) || defiOf(c.ID) != "evenement" {
					t.Errorf("%s: défi %q", c.ID, defiOf(c.ID))
				}
			}
		}
	}
	// The update lists every choice made for it, never a join (closed, the old joins still work).
	f, ok := features.Find(game.EventsKey)
	if !ok || !slices.Equal(f.Interactions, game.HappeningChoiceIDs()) || !slices.Contains(f.Keys, game.EventsKey) || slices.Contains(f.Interactions, game.JoinHappeningID) || slices.Contains(f.Interactions, game.RegulateTrafficID) {
		t.Errorf("the update: %+v", f)
	}
}

// pluieSlot: a game minute in a slot where a commune has its big rain.
func pluieSlot(t *testing.T) (string, string, int64) {
	t.Helper()
	for _, cm := range []string{"cocody", "yopougon", "plateau", "adjame", "treichville", "marcory", "abobo", "koumassi"} {
		for slot := int64(20000); slot < 26000; slot++ {
			if h, start, ok := game.HappeningAt("abidjan", cm, slot*game.HappeningMinutes+5); ok && h.ID == "pluie" {
				return "abidjan", cm, start + 5
			}
		}
	}
	t.Fatal("no rain found")
	return "", "", 0
}

// The server refuses the choices while the update is closed (the old join then), and the old join once open.
func TestHappeningChoicesGate(t *testing.T) {
	city, commune, at := pluieSlot(t)
	sim := func() *Sim {
		s := adultSim(game.Families[0], "")
		s.City, s.Commune, s.GameMinutes = city, commune, at
		s.Money = 50_000
		return &s
	}
	withEvents(t, false)
	if _, err := sim().interactAt(HappeningPlaceID, "evt-pluie-courir"); err == nil {
		t.Error("a choice played, closed")
	}
	if _, err := sim().interactAt(HappeningPlaceID, game.JoinHappeningID); err != nil {
		t.Errorf("the old join, closed: %v", err)
	}
	// The défi itself refused, before anything is read.
	r := chi.NewRouter()
	(&Handler{}).Routes(r)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/sims/x/defi", strings.NewReader(`{"kind":"evenement","score":100}`)))
	if w.Code != http.StatusForbidden {
		t.Errorf("the défi played, closed: %d", w.Code)
	}

	withEvents(t, true)
	if _, err := sim().interactAt(HappeningPlaceID, game.JoinHappeningID); err == nil {
		t.Error("the old join, open")
	}
	s := sim()
	it, err := s.interactAt(HappeningPlaceID, "evt-pluie-danser")
	if err != nil || defiOf(it.ID) != "evenement" {
		t.Fatalf("a choice, open: %v", err)
	}
	// Played, not waited for: no clock ends it before the happening does.
	if s.Activity.End-s.Activity.Start < it.Minutes {
		t.Errorf("ends at %d, started %d", s.Activity.End, s.Activity.Start)
	}
}

// Played well, all of its good at once; badly, a little less, and its mishap (the gbaka's splash).
func TestHappeningChoiceScore(t *testing.T) {
	c, _, _ := game.FindEventChoice("evt-pluie-courir")
	good := &game.Activity{Kind: "do", Interaction: c.Interaction}
	bad := &game.Activity{Kind: "do", Interaction: c.Interaction}
	if hi, lo := homeDone(game.Needs{}, good, 100), homeDone(game.Needs{}, bad, 10); hi.Fun <= lo.Fun || hi.Energy != lo.Energy {
		t.Errorf("played well %+v, badly %+v", hi, lo)
	}
	s := &Sim{Needs: game.FreshNeeds()}
	if text, _ := eventMishap(s, c.ID, 90, "Bien."); text != "Bien." {
		t.Errorf("a mishap played well: %q", text)
	}
	before := s.Needs.Hygiene
	if text, _ := eventMishap(s, c.ID, 10, "Bof."); !strings.Contains(text, "gbaka") || s.Needs.Hygiene >= before {
		t.Errorf("played badly: %q, hygiene %.0f → %.0f", text, before, s.Needs.Hygiene)
	}
	// What a mishap costs, as far as the money goes.
	s = &Sim{Money: 300, Needs: game.FreshNeeds()}
	s.BornAt = -game.MinutesToAge(30)
	if _, paid := eventMishap(s, "evt-controle-papiers", 0, ""); paid != 300 || s.Money != 0 {
		t.Errorf("the « café »: %d paid, %d left", paid, s.Money)
	}
	// The line names what was done.
	if _, _, text := defiReward("evenement", "evt-mariage-riz", 90, 0); !strings.Contains(text, "riz") {
		t.Errorf("the line: %q", text)
	}
}
