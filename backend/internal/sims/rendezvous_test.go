package sims

import (
	"context"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Babi Infos tells a rendez-vous an hour before and as it starts, each once whatever the window read.
func TestRendezPosts(t *testing.T) {
	sat := time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)
	occs := game.OccurrencesBetween(game.RendezVousList, sat, sat.AddDate(0, 0, 1), []string{"cocody"})
	at := func(h, m int) time.Time { return sat.Add(time.Duration(h)*time.Hour + time.Duration(m)*time.Minute) }
	keys := map[string]bool{}
	for _, w := range [][2]time.Time{{at(14, 0), at(15, 0)}, {at(15, 0), at(15, 1)}, {at(15, 1), at(16, 0)}, {at(16, 0), at(16, 1)}, {at(16, 1), at(17, 0)}} {
		for _, p := range rendezPosts(occs, w[0], w[1]) {
			if keys[p.Key] {
				t.Fatalf("posted twice: %s", p.Key)
			}
			keys[p.Key] = true
		}
	}
	if !keys["rdv:dames-samedi:20261114:avant"] || !keys["rdv:dames-samedi:20261114:debut"] {
		t.Fatalf("the tournament not told: %v", keys)
	}
	// Read after it's over: nothing told late.
	if len(rendezPosts(occs, at(17, 0), at(19, 0))) != 0 {
		t.Fatal("told after the start")
	}
}

// Against a database (TEST_DATABASE_URL): the Saturday tournament counts wins (a pair a few times at
// most, a win against the grin only with a stake, not from a fresh account), pays its fixed pot once
// to the first three; the Sunday match pays once per account; the happy hour lowers the maquis' prices
// in its commune only; nothing while the update is closed or the rendez-vous off.
func TestRendezVousDB(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	h := &Handler{DB: pool}
	awa, koffi, yao, bebe := replySim(t, pool, "Awa"), replySim(t, pool, "Koffi"), replySim(t, pool, "Yao"), replySim(t, pool, "Bebe")
	// Old accounts (Bebe's is fresh: made to farm, it neither counts nor gets paid).
	if _, err := pool.Exec(ctx, `UPDATE users SET created_at = now() - interval '30 days' WHERE first_name <> 'Bebe'`); err != nil {
		t.Fatal(err)
	}
	defer func() { rendezNow = time.Now }()
	RendezForget()
	// Saturday 16:30: the tournament is on.
	rendezNow = func() time.Time { return time.Date(2026, 11, 14, 16, 30, 0, 0, time.UTC) }
	occ := "dames-samedi:20261114"
	win := func(white, black string, winner int8, stake int) {
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		d := &dameRow{White: white, Stake: stake}
		if black != "" {
			d.Black = &black
		}
		rendezDames(ctx, tx, d, winner)
		if err := tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
	}
	for range 4 {
		win(awa, koffi, 1, 0) // Awa beats Koffi four times: two count
	}
	win(koffi, awa, 1, 0)  // Koffi beats Awa once
	win(yao, "", 1, 1000)  // Yao beats the grin with a stake
	win(yao, "", 1, 100)   // too small a stake: not counted
	win(bebe, koffi, 1, 0) // a fresh account: not counted
	win(awa, koffi, 0, 0)  // a draw: nothing
	lines, err := ranking(ctx, pool, occ, 10)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]int{}
	for _, l := range lines {
		got[l.Sim] = l.Points
	}
	if got[awa] != 6 || got[koffi] != 3 || got[yao] != 1 || got[bebe] != 0 || len(lines) != 3 || lines[0].Sim != awa {
		t.Fatalf("ranking: %+v", lines)
	}

	// Paid once, after it ends, whichever server.
	before := map[string]int{}
	for _, id := range []string{awa, koffi, yao} {
		var m int
		_ = pool.QueryRow(ctx, `SELECT money FROM sims WHERE id = $1`, id).Scan(&m)
		before[id] = m
	}
	o := game.OccurrencesBetween(game.RendezVousList[2:3], rendezNow(), rendezNow().Add(time.Minute), nil)[0]
	for range 2 {
		if err := h.payDames(ctx, o); err != nil {
			t.Fatal(err)
		}
	}
	for i, id := range []string{awa, koffi, yao} {
		var m int
		_ = pool.QueryRow(ctx, `SELECT money FROM sims WHERE id = $1`, id).Scan(&m)
		if m-before[id] != game.DamesPrizes[i] {
			t.Errorf("place %d paid %d, want %d", i+1, m-before[id], game.DamesPrizes[i])
		}
	}
	var podium string
	if err := pool.QueryRow(ctx, `SELECT body FROM babi_direct WHERE key = $1`, "rdv:"+occ+":podium").Scan(&podium); err != nil || !strings.Contains(podium, "1. Awa (6 pts)") {
		t.Fatalf("podium: %q %v", podium, err)
	}

	// Sunday 17:10: the first street match pays once per account (not a fresh one).
	rendezNow = func() time.Time { return time.Date(2026, 11, 15, 17, 10, 0, 0, time.UTC) }
	var user string
	_ = pool.QueryRow(ctx, `SELECT user_id FROM sims WHERE id = $1`, awa).Scan(&user)
	uctx := auth.WithUserID(ctx, user)
	paid := 0
	for range 2 {
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		s := &Sim{ID: awa, GameMinutes: game.MinuteOf(time.Now())}
		if said := rendezFoot(uctx, tx, s, "street-foot"); said != "" {
			paid += s.Money
		}
		if err := tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if paid != game.FootBonus {
		t.Fatalf("the Sunday match paid %d in two matches", paid)
	}
	if said := rendezFoot(uctx, nil, &Sim{ID: awa}, "street-basket"); said != "" {
		t.Fatal("basket isn't the foot")
	}

	// Monday 18:30: the happy hour in its commune only.
	rendezNow = func() time.Time { return time.Date(2026, 11, 16, 18, 30, 0, 0, time.UTC) }
	live, ok := rendezLive(ctx, pool, "happy-hour", rendezNow())
	if !ok || live.Commune == "" {
		t.Fatal("no happy hour on Monday at 18:30")
	}
	// Held where there's a maquis to go to.
	if _, cm, _ := world.FindCommune("abidjan", live.Commune); !slices.ContainsFunc(cm.Places, func(p world.Place) bool { return p.Kind == "maquis" }) {
		t.Fatalf("happy hour in %s, without a maquis", live.Commune)
	}
	in := &Sim{City: "abidjan", Commune: live.Commune}
	rendezMeasures(ctx, pool, in)
	out := &Sim{City: "abidjan", Commune: "nowhere"}
	rendezMeasures(ctx, pool, out)
	if game.MeasureOff(in.Measures, "maquis") != game.HappyHourOff || len(out.Measures) != 0 {
		t.Fatalf("happy hour: %v %v", in.Measures, out.Measures)
	}
	// Friday 23:30 (and Saturday 00:30): the soirée night halves the cost of a host of its commune only.
	for _, at := range []time.Time{time.Date(2026, 11, 13, 23, 30, 0, 0, time.UTC), time.Date(2026, 11, 14, 0, 30, 0, 0, time.UTC)} {
		rendezNow = func() time.Time { return at }
		night, ok := rendezLive(ctx, pool, "soiree-vendredi", at)
		if !ok {
			t.Fatalf("no soirée night at %v", at)
		}
		host, away := &Sim{City: "abidjan", Commune: night.Commune}, &Sim{City: "abidjan", Commune: "nowhere"}
		rendezMeasures(ctx, pool, host)
		rendezMeasures(ctx, pool, away)
		if soireeCost(host) != game.SoireeCost/2 || soireeCost(away) != game.SoireeCost {
			t.Fatalf("soirée night: %d, %d", soireeCost(host), soireeCost(away))
		}
	}
	rendezNow = func() time.Time { return time.Date(2026, 11, 16, 18, 30, 0, 0, time.UTC) }

	// Turned off by the team: not held.
	if _, err := pool.Exec(ctx, `INSERT INTO rendezvous_settings (id, off) VALUES ('happy-hour', true)`); err != nil {
		t.Fatal(err)
	}
	RendezForget()
	if _, ok := rendezLive(ctx, pool, "happy-hour", rendezNow()); ok {
		t.Fatal("held while off")
	}
	// The update closed: nothing.
	open := rendezOpen
	rendezOpen = func(context.Context) bool { return false }
	defer func() { rendezOpen = open; RendezForget() }()
	if _, ok := rendezLive(ctx, pool, "vote-dimanche", time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)); ok {
		t.Fatal("held while the update is closed")
	}
}
