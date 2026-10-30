package sims

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// A soirée with its room and its entry (« soiree-deco »), against a fresh
// database (TEST_DATABASE_URL): refused while the update is closed; open, the
// price checked, the guest paying the host coming in (once), the host's
// friend free, a guest without the money kept out, the host's day's limit,
// and only the host arranging the room.
func TestSoireeDeco(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	host, guest, friend, poor, young := replySim(t, pool, "Awa"), replySim(t, pool, "Koffi"), replySim(t, pool, "Ama"), replySim(t, pool, "Yao"), replySim(t, pool, "Bintou")
	// Old enough accounts to pass Djai on, but Bintou's.
	if _, err := pool.Exec(ctx, `UPDATE users SET created_at = now() - interval '30 days' WHERE id IN (SELECT user_id FROM sims WHERE id <> $1)`, young); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO bonds (sim_a, sim_b, friendship, friends) VALUES ($1, $2, 60, true)`, host, friend); err != nil {
		t.Fatal(err)
	}
	old := features.Default
	features.Default = &features.Store{DB: pool}
	t.Cleanup(func() { features.Default = old })
	h := &Handler{DB: pool}

	in := func(f func(tx pgx.Tx)) {
		t.Helper()
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		f(tx)
		if err := tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
	}
	money := func(id string) int {
		var m int
		_ = pool.QueryRow(ctx, `SELECT money FROM sims WHERE id = $1`, id).Scan(&m)
		return m
	}

	// Closed (as it ships): no price, no room; a soirée as before.
	in(func(tx pgx.Tx) {
		if _, _, err := partyDeco(ctx, tx, host, 1000, nil); !errors.Is(err, errDecoClosed) {
			t.Errorf("a price, closed: %v", err)
		}
		if _, _, err := partyDeco(ctx, tx, host, 0, &game.PartyStart); !errors.Is(err, errDecoClosed) {
			t.Errorf("a room, closed: %v", err)
		}
		if price, layout, err := partyDeco(ctx, tx, host, 0, nil); err != nil || price != 0 || layout != nil {
			t.Errorf("a plain soirée, closed: %d %v %v", price, layout, err)
		}
	})
	if decoOpen(ctx) {
		t.Fatal("soiree-deco should ship closed")
	}
	if err := features.Default.Set(ctx, game.SoireeDecoKey, true, nil); err != nil {
		t.Fatal(err)
	}

	// Open: the price within its bounds; no room sent, the starting one.
	var id string
	in(func(tx pgx.Tx) {
		if _, _, err := partyDeco(ctx, tx, host, 750, nil); !errors.Is(err, game.ErrEntryPrice) {
			t.Errorf("750 Djai: %v", err)
		}
		bad := []game.Piece{{X: 6, Z: 4, ID: "table"}}
		if _, _, err := partyDeco(ctx, tx, host, 0, &bad); !errors.Is(err, game.ErrPartyKept) {
			t.Errorf("a table on the dance floor: %v", err)
		}
		price, layout, err := partyDeco(ctx, tx, host, 2000, nil)
		if err != nil || price != 2000 || len(layout) != len(game.PartyStart) {
			t.Fatalf("2 000 Djai: %d %d %v", price, len(layout), err)
		}
		if err := tx.QueryRow(ctx, `INSERT INTO soirees (host_sim, city, commune, theme, ends_at, price) VALUES ($1, 'abidjan', 'cocody', 'zouglou', now() + interval '3 hours', $2) RETURNING id`, host, price).Scan(&id); err != nil {
			t.Fatal(err)
		}
	})
	place := game.SoireePrefix + id

	// Only the host arranges the room, within the rules.
	room := []game.Piece{{X: 0, Z: 0, R: 1, ID: "comptoir"}, {X: 2, Z: 3, ID: "canape"}, {X: 2, Z: 5, ID: "table"}, {X: 3, Z: 5, ID: "chaises"}}
	in(func(tx pgx.Tx) {
		if err := setLayout(ctx, tx, guest, room); !errors.Is(err, errPartyNoneOn) {
			t.Errorf("a guest arranging the host's room: %v", err)
		}
		if err := setLayout(ctx, tx, host, append(room, game.Piece{X: 0, Z: 1, ID: "sono"})); !errors.Is(err, game.ErrPartyOverlap) {
			t.Errorf("a speaker on the counter: %v", err)
		}
		if err := setLayout(ctx, tx, host, room); err != nil {
			t.Errorf("the host's room: %v", err)
		}
	})

	// enter: the Sim comes to the soirée (an action there); what it paid, or why not.
	enter := func(id string, purse int) (int, *Sim, error) {
		t.Helper()
		if _, err := pool.Exec(ctx, `UPDATE sims SET money = $2 WHERE id = $1`, id, purse); err != nil {
			t.Fatal(err)
		}
		s := &Sim{ID: id, FirstName: "Invité", Money: purse}
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		if err := loadParty(ctx, tx, s, place); err != nil {
			t.Fatal(err)
		}
		paid, err := h.arrive(ctx, tx, s)
		if err != nil {
			return 0, s, err
		}
		if _, err := tx.Exec(ctx, `UPDATE sims SET money = $2 WHERE id = $1`, id, s.Money); err != nil {
			t.Fatal(err)
		}
		return paid, s, tx.Commit(ctx)
	}

	// The guest pays coming in, to the host; once.
	before := money(host)
	paid, s, err := enter(guest, 5000)
	if err != nil || paid != 2000 || s.Money != 3000 {
		t.Fatalf("Koffi comes in: paid %d, left %d, %v", paid, s.Money, err)
	}
	if len(s.party.Layout) != len(room) || s.party.Price != 2000 {
		t.Errorf("the room the guest sees: %+v", s.party)
	}
	if money(host) != before+2000 {
		t.Errorf("the host got %d", money(host)-before)
	}
	in(func(tx pgx.Tx) {
		if left, _ := leftFor(ctx, tx, host, game.FromEntry); left != game.Caps[game.FromEntry].Djai-2000 {
			t.Errorf("the host's day's entries: %d left", left)
		}
	})
	if paid, _, err := enter(guest, 3000); err != nil || paid != 0 {
		t.Errorf("Koffi again: %d %v", paid, err)
	}

	// The host's friend comes in free; one without the money doesn't come in; nor a new account.
	if paid, s, err := enter(friend, 100); err != nil || paid != 0 || !s.party.Free {
		t.Errorf("Ama, Awa's friend: %d %v", paid, err)
	}
	if _, _, err := enter(poor, 1500); err == nil {
		t.Error("Yao came in without the 2 000")
	}
	if _, _, err := enter(young, 5000); !errors.Is(err, errNewAccount) {
		t.Errorf("Bintou's new account: %v", err)
	}

	// The host's day's limit reached: the entry is offered.
	day := game.DayOf(game.MinuteOf(time.Now()))
	if _, err := pool.Exec(ctx, `INSERT INTO earnings (user_id, day, kind, amount) SELECT user_id, $2, $3, $4 FROM sims WHERE id = $1
		ON CONFLICT (user_id, day, kind) DO UPDATE SET amount = $4`, host, day, string(game.FromEntry), game.Caps[game.FromEntry].Djai); err != nil {
		t.Fatal(err)
	}
	if paid, _, err := enter(poor, 1500); err != nil || paid != 0 {
		t.Errorf("Yao, the host's day full: %d %v", paid, err)
	}

	// Closed again: free, the club's own room.
	if err := features.Default.Set(ctx, game.SoireeDecoKey, false, nil); err != nil {
		t.Fatal(err)
	}
	other := replySim(t, pool, "Moussa")
	if _, err := pool.Exec(ctx, `UPDATE users SET created_at = now() - interval '30 days' WHERE id = (SELECT user_id FROM sims WHERE id = $1)`, other); err != nil {
		t.Fatal(err)
	}
	if paid, s, err := enter(other, 0); err != nil || paid != 0 || s.party.Price != 0 || s.party.Layout != nil {
		t.Errorf("closed: %d %+v %v", paid, s.party, err)
	}
}
