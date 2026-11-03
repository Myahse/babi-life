package sims

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Against a database (TEST_DATABASE_URL): a till once a day; a bank only scouted, prepared and with a
// crew; then its game played: got away (the loot, wanted) or caught (prison one can't leave, the fine,
// the record), over many tries both happen.
func TestBraquage(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	id := replySim(t, pool, "Awa")
	now := game.MinuteOf(time.Now())
	newSim := func() *Sim {
		return &Sim{ID: id, FirstName: "Awa", Needs: game.FreshNeeds(), Money: 50000, GameMinutes: now, City: "abidjan", Commune: "plateau", HomeCity: "abidjan", HomeCommune: "plateau", BornAt: now - 40*365*24*60}
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)

	// The till: once a day.
	s := newSim()
	till := game.Interaction{ID: game.BraquerID("pharmacie")}
	if _, err := braquageStart(ctx, tx, s, "plateau-pharmacie", till); err != nil {
		t.Fatal(err)
	}
	if _, err := braquageStart(ctx, tx, s, "plateau-pharmacie", till); err == nil {
		t.Fatal("two tills the same day")
	}

	// The bank: not without scouting, the gear, a crew.
	bank := game.Interaction{ID: game.BraquerBanque}
	const where = "plateau-pharmacie" // (any place: the plan is checked, not the kind)
	if _, err := braquageStart(ctx, tx, s, where, bank); err == nil || !strings.Contains(err.Error(), "repère") {
		t.Fatalf("a bank without scouting: %v", err)
	}
	if _, err := braquageStart(ctx, tx, s, where, game.Interaction{ID: game.PreparationID}); err == nil {
		t.Fatal("gear for a bank never scouted")
	}
	if _, err := braquageStart(ctx, tx, s, where, game.Interaction{ID: game.ReperageID}); err != nil {
		t.Fatal(err)
	}
	if _, err := braquageStart(ctx, tx, s, where, bank); err == nil || !strings.Contains(err.Error(), "matériel") {
		t.Fatalf("a bank without the gear: %v", err)
	}
	if _, err := braquageStart(ctx, tx, s, where, game.Interaction{ID: game.PreparationID}); err != nil {
		t.Fatal(err)
	}
	if _, err := braquageStart(ctx, tx, s, where, bank); err == nil || !strings.Contains(err.Error(), "équipe") {
		t.Fatalf("a bank without a crew: %v", err)
	}
	s.Friends = []game.Friend{{ID: "a", Name: "Yao", Gang: true}, {ID: "b", Name: "Koffi", Friendship: 80}}
	if _, err := braquageStart(ctx, tx, s, where, bank); err != nil {
		t.Fatalf("a bank ready: %v", err)
	}

	// The till's game played, many times: some got away, some caught.
	got, caught := 0, 0
	for i := range 40 {
		s := newSim()
		s.GameMinutes = now + int64(i)*24*60 // a new day each time (the day's limit)
		if err := s.start(game.Interaction{ID: game.BraquerID("pharmacie"), Label: "x", Minutes: 20, Ages: game.Adults}, "plateau-pharmacie", "pharmacie", "Pharmacie", nil, ""); err != nil {
			t.Fatal(err)
		}
		text, money, err := braquageDone(ctx, tx, s, s.Activity, 50)
		if err != nil {
			t.Fatal(err)
		}
		switch {
		case money > 0:
			got++
			plan, _ := loadBraquage(ctx, tx, id)
			if plan.WantedUntil <= s.GameMinutes || !strings.Contains(text, "recherché") {
				t.Fatalf("got away and not wanted: %q %+v", text, plan)
			}
		default:
			caught++
			if s.Record != 1 || s.Activity == nil || s.Activity.PlaceID != custodyPlace || !strings.Contains(text, "MACA") || s.Money >= 50000 {
				t.Fatalf("caught: %q record %d money %d %+v", text, s.Record, s.Money, s.Activity)
			}
			if _, err := s.stop(); err == nil {
				t.Fatal("left prison")
			}
		}
	}
	if got == 0 || caught == 0 {
		t.Fatalf("40 tills: %d got away, %d caught", got, caught)
	}
}
