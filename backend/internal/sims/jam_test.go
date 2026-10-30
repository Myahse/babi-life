package sims

import (
	"context"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The jam's own join is played as its défi; a weak score earns no tip, a good one some, never much.
func TestCirculationDefi(t *testing.T) {
	if defiOf(game.RegulateTrafficID) != "circulation" {
		t.Errorf("regler-circulation: %q", defiOf(game.RegulateTrafficID))
	}
	h, ok := game.FindHappening("embouteillage")
	if !ok || h.Join == nil || h.Join.ID != game.RegulateTrafficID {
		t.Fatalf("the jam's join: %+v", h.Join)
	}
	if _, back, _ := defiReward("circulation", game.RegulateTrafficID, JamClearScore-1, 0); back != 0 {
		t.Errorf("under the threshold: %d tipped", back)
	}
	low, lowBack, _ := defiReward("circulation", game.RegulateTrafficID, JamClearScore, 0)
	high, highBack, _ := defiReward("circulation", game.RegulateTrafficID, 100, 0)
	if lowBack == 0 || highBack <= lowBack || high.Social+high.Fun <= low.Social+low.Fun || highBack > 2000 || high.Social > 15 {
		t.Errorf("tips %d then %d, needs %+v then %+v", lowBack, highBack, low, high)
	}
}

// jamSlot: a game minute in a slot where a commune has its jam (the happening a pure function of the clock).
func jamSlot(t *testing.T) (string, string, int64) {
	t.Helper()
	for _, cm := range []string{"cocody", "yopougon", "plateau", "adjame", "treichville", "marcory", "abobo", "koumassi"} {
		for slot := int64(20000); slot < 26000; slot++ {
			if h, start, ok := game.HappeningAt("abidjan", cm, slot*game.HappeningMinutes+5); ok && h.ID == "embouteillage" {
				return "abidjan", cm, start + 5
			}
		}
	}
	t.Fatal("no jam found")
	return "", "", 0
}

// A good score at the junction clears the jam for the whole commune, once; a weak one leaves it.
func TestClearJam(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	id := replySim(t, pool, "Koffi")
	city, commune, at := jamSlot(t)
	s := &Sim{}
	s.ID, s.City, s.Commune, s.GameMinutes = id, city, commune, at
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	if ok, err := clearJam(ctx, tx, s, JamClearScore-5); ok || err != nil {
		t.Fatalf("weak score cleared it: %v %v", ok, err)
	}
	if _, ok, _ := JamCleared(ctx, tx, city, commune, at); ok {
		t.Fatal("cleared after a weak score")
	}
	if ok, err := clearJam(ctx, tx, s, 90); !ok || err != nil {
		t.Fatalf("good score: %v %v", ok, err)
	}
	if ok, _ := clearJam(ctx, tx, s, 95); ok {
		t.Error("cleared twice")
	}
	// Seen by anyone in the commune, later in the slot too; not next door.
	if when, ok, _ := JamCleared(ctx, tx, city, commune, at+30); !ok || when != at {
		t.Errorf("for the street: %v at %d", ok, when)
	}
	if _, ok, _ := JamCleared(ctx, tx, city, commune+"x", at); ok {
		t.Error("cleared in another commune")
	}
	// Joining it again: nothing left to regulate.
	s.jamCleared = true
	if _, err := s.interactAt(HappeningPlaceID, game.RegulateTrafficID); err == nil {
		t.Error("joined a cleared jam")
	}
}
