package admin

import (
	"context"
	"testing"

	"github.com/myahse/babi-life/backend/internal/auth"
)

// « Chargement »: the batches written as the game sends them (auth.StorePerf), then the medians and the slow tenth
// by class, connection and day; who left while it loaded and where; the caches; the slowest communes; the old rows
// pruned, and the window leaving out what's older.
func TestLoadingStats(t *testing.T) {
	pool := notifyDB(t)
	ctx := context.Background()
	const (
		a = "00000000-0000-0000-0000-0000000000c1"
		b = "00000000-0000-0000-0000-0000000000c2"
	)
	if _, err := pool.Exec(ctx, `INSERT INTO users (id, email, name, created_at) VALUES ('`+a+`', 'a@x.ci', 'A', now()), ('`+b+`', 'b@x.ci', 'B', now())`); err != nil {
		t.Fatal(err)
	}
	weak := auth.PerfDevice{Class: "faible", Cores: 4, Mem: 2, DPR: 2, Tier: "simple", Light: true, Net: "3g", App: true}
	strong := auth.PerfDevice{Class: "fort", Cores: 12, Mem: 8, DPR: 1, Tier: "haute", Net: "4g"}
	for _, x := range []struct {
		user string
		b    auth.PerfBatch
	}{
		{a, auth.PerfBatch{Device: weak, Samples: []auth.PerfSample{
			{Kind: "start", Commune: "yopougon", HUD: 3000, Chunk: 9000, Ready: 20000, Tap: 15000, FPS: 24, ChunkMiss: 9, TileMiss: 12, TileKB: 1500, NetKB: 2500, Screen: "rue"},
			{Kind: "trip", Commune: "abobo", Chunk: 4000, Ready: 9000, Total: 14000, ChunkMiss: 6},
			{Kind: "trip", Commune: "plateau", Total: 30000, Quit: true, Screen: "chargement"},
		}}},
		{b, auth.PerfBatch{Device: strong, Samples: []auth.PerfSample{
			{Kind: "start", Commune: "cocody", HUD: 1000, Chunk: 2000, Ready: 4000, FPS: 60, ChunkHit: 9, TileHit: 12, NetKB: 300},
			{Kind: "start", Commune: "cocody", HUD: 1200, Quit: true, Screen: "chargement"},
			{Kind: "trip", Commune: "abobo", Chunk: 1000, Ready: 3000, Total: 6000, MemHit: 4},
		}}},
	} {
		if err := x.b.Check(); err != nil {
			t.Fatal(err)
		}
		if err := auth.StorePerf(ctx, pool, x.user, x.b); err != nil {
			t.Fatal(err)
		}
	}
	// An old row: out of the 7 days' window, and pruned (past 30 days).
	if _, err := pool.Exec(ctx, `INSERT INTO perf_samples (user_id, kind, hud_ms, at, class) VALUES ('`+a+`', 'start', 99999, now() - interval '40 days', 'normal')`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO user_last_screen (user_id, screen) VALUES ('`+a+`', 'chargement'), ('`+b+`', 'rue')`); err != nil {
		t.Fatal(err)
	}

	out, err := loadingStats(ctx, pool, 7)
	if err != nil {
		t.Fatal(err)
	}
	all := out.All
	if all.Starts != 3 || all.StartQuits != 1 || all.Trips != 3 || all.TripQuits != 1 {
		t.Fatalf("counts: %+v", all)
	}
	// hud 1000, 1200, 3000: median 1200, p90 between 1200 and 3000 (2640).
	if m := all.Metrics["hud"]; m.N != 3 || m.P50 != 1200 || m.P90 != 2640 {
		t.Fatalf("hud: %+v", m)
	}
	if m := all.Metrics["ready"]; m.N != 2 || m.P50 != 12000 {
		t.Fatalf("ready: %+v (the one who left has none)", m)
	}
	if m := all.Metrics["tripTotal"]; m.N != 3 || m.P50 != 14000 {
		t.Fatalf("trip total: %+v", m)
	}
	if m := all.Metrics["fps"]; m.N != 2 || m.P50 != 42 {
		t.Fatalf("fps: %+v", m)
	}
	if len(out.Classes) != 2 || out.Classes[0].Key != "faible" || out.Classes[0].Metrics["ready"].P50 != 20000 || out.Classes[1].Key != "fort" || out.Classes[1].Starts != 2 {
		t.Fatalf("classes: %+v", out.Classes)
	}
	if len(out.Nets) != 2 || out.Nets[0].Key != "3g" || out.Nets[1].Key != "4g" {
		t.Fatalf("nets: %+v", out.Nets)
	}
	if len(out.Light) != 2 || out.Light[0].Key != "léger" || out.Light[0].Starts != 1 {
		t.Fatalf("light: %+v", out.Light)
	}
	if len(out.ByDay) != 1 || out.ByDay[0].Starts != 3 {
		t.Fatalf("by day: %+v", out.ByDay)
	}
	// Plateau (30 s, left) slowest, then Abobo (median of 6 and 14 s: 10 s).
	if len(out.Communes) != 2 || out.Communes[0].Commune != "plateau" || out.Communes[0].Quits != 1 || out.Communes[1].Commune != "abobo" || out.Communes[1].P50 != 10000 || out.Communes[1].N != 2 {
		t.Fatalf("communes: %+v", out.Communes)
	}
	if c := out.Cache; c.ChunkHit != 9 || c.ChunkMiss != 15 || c.MemHit != 4 || c.TileHit != 12 || c.TileMiss != 12 || c.TileKB != 1500 || c.NetKB != 1400 {
		t.Fatalf("cache: %+v", c)
	}
	if len(out.QuitScreens) != 1 || out.QuitScreens[0] != (ScreenCount{Screen: "chargement", N: 2}) || out.LastOnLoading != 1 {
		t.Fatalf("quit screens: %+v, last on loading %d", out.QuitScreens, out.LastOnLoading)
	}

	n, err := auth.PrunePerf(ctx, pool)
	if err != nil || n != 1 {
		t.Fatalf("pruned %d, %v", n, err)
	}
	// Empty window: no rows, no error, zeros.
	if _, err := pool.Exec(ctx, `DELETE FROM perf_samples`); err != nil {
		t.Fatal(err)
	}
	if out, err = loadingStats(ctx, pool, 1); err != nil || out.All.Starts != 0 || len(out.Classes) != 0 {
		t.Fatalf("empty: %+v, %v", out, err)
	}
}
