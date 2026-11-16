package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/throttle"
)

func perfOK() PerfBatch {
	return PerfBatch{
		Device:  PerfDevice{Class: "faible", Cores: 4, Mem: 2, DPR: 2.75, Tier: "simple", Light: true, Net: "3g", App: true},
		Samples: []PerfSample{{Kind: "start", Commune: "yopougon", HUD: 2100, Chunk: 6400, Ready: 11800, Tap: 9000, Screen: "rue", ChunkHit: 2, ChunkMiss: 7, TileMiss: 9, TileKB: 1400, NetKB: 2300, FPS: 31}},
	}
}

// The batch as the game sends it, nothing else: out of bounds is refused whole.
func TestPerfCheck(t *testing.T) {
	ok := perfOK()
	if err := ok.Check(); err != nil {
		t.Fatalf("a good batch refused: %v", err)
	}
	for name, spoil := range map[string]func(b *PerfBatch){
		"no samples":     func(b *PerfBatch) { b.Samples = nil },
		"too many":       func(b *PerfBatch) { b.Samples = make([]PerfSample, perfMaxSamples+1) },
		"kind":           func(b *PerfBatch) { b.Samples[0].Kind = "boot" },
		"class":          func(b *PerfBatch) { b.Device.Class = "" },
		"tier":           func(b *PerfBatch) { b.Device.Tier = "ultra" },
		"net":            func(b *PerfBatch) { b.Device.Net = "5g" },
		"cores":          func(b *PerfBatch) { b.Device.Cores = -1 },
		"memory":         func(b *PerfBatch) { b.Device.Mem = 1000 },
		"dpr":            func(b *PerfBatch) { b.Device.DPR = 20 },
		"negative time":  func(b *PerfBatch) { b.Samples[0].Ready = -5 },
		"ten minutes+":   func(b *PerfBatch) { b.Samples[0].Total = perfMaxMS + 1 },
		"commune":        func(b *PerfBatch) { b.Samples[0].Commune = "Cocody; DROP" },
		"screen":         func(b *PerfBatch) { b.Samples[0].Screen = "Rue Principale" },
		"chunks":         func(b *PerfBatch) { b.Samples[0].ChunkMiss = 5000 },
		"fps":            func(b *PerfBatch) { b.Samples[0].FPS = 1000 },
		"kilobytes":      func(b *PerfBatch) { b.Samples[0].TileKB = -1 },
		"page kilobytes": func(b *PerfBatch) { b.Samples[0].NetKB = 600_000 },
	} {
		b := perfOK()
		b.Samples = append([]PerfSample(nil), b.Samples...)
		spoil(&b)
		if b.Check() == nil {
			t.Errorf("%s: accepted", name)
		}
	}
	// Edges: zero is « not reached », ten minutes still a time, an empty commune (the street not known).
	b := perfOK()
	b.Samples[0] = PerfSample{Kind: "trip", Total: perfMaxMS, Quit: true}
	b.Device.Net, b.Device.Tier = "", ""
	if err := b.Check(); err != nil {
		t.Fatalf("edges refused: %v", err)
	}
}

// POST /me/perf: unknown fields and bad batches refused before the database, then the account's batches
// limited per hour (the limit is checked before writing, so no row is written past it).
func TestPerfHandlerRefusesAndLimits(t *testing.T) {
	was := perfLimit
	perfLimit = throttle.New(2, time.Hour)
	defer func() { perfLimit = was }()
	h := &Handler{} // no database: a request that reaches it would panic
	post := func(body string) int {
		r := httptest.NewRequest(http.MethodPost, "/me/perf", strings.NewReader(body)).WithContext(WithUserID(context.Background(), "u1"))
		w := httptest.NewRecorder()
		func() {
			defer func() {
				if recover() != nil {
					w.Code = 599 // reached the database
				}
			}()
			h.Perf(w, r)
		}()
		return w.Code
	}
	if c := post(`{"device":{"class":"fort"},"samples":[{"kind":"start","extra":1}]}`); c != http.StatusBadRequest {
		t.Fatalf("unknown field: %d", c)
	}
	if c := post(`{"device":{"class":"fort"},"samples":[{"kind":"start","hud":-1}]}`); c != http.StatusBadRequest {
		t.Fatalf("negative time: %d", c)
	}
	if c := post(`{"device":{"class":"fort"},"samples":[` + strings.Repeat(`{"kind":"start","commune":"`+strings.Repeat("a", 40)+`"},`, 200) + `{"kind":"start"}]}`); c != http.StatusBadRequest {
		t.Fatalf("too big: %d", c)
	}
	good := `{"device":{"class":"fort","cores":8},"samples":[{"kind":"start","hud":900}]}`
	for i := range 2 {
		if c := post(good); c != 599 {
			t.Fatalf("batch %d: %d, want it to reach the database", i, c)
		}
	}
	if c := post(good); c != http.StatusTooManyRequests {
		t.Fatalf("past the limit: %d", c)
	}
}
