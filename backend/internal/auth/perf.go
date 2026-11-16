package auth

import (
	"context"
	"errors"
	"log"
	"math/rand/v2"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/throttle"
)

// The update « mesures-chargement » (migration 127, web lib/mesures.ts): the game's loading times as the players'
// own phones see them, and whether they left while it loaded. The game keeps them and sends a few small batches a
// session (POST /me/perf); the admin's « Chargement » reads them (admin/chargement.go). Closed: nothing is sent,
// and anything sent anyway is dropped. Cheap on purpose: one row per loading, one INSERT per batch, the old rows
// pruned now and then as new ones come (no job of its own: the database still sleeps when nobody plays).

const (
	// PerfFeature: the update that turns the measurements on.
	PerfFeature = "mesures-chargement"
	// perfKeepDays: how long the rows are kept.
	perfKeepDays = 30
	// perfMaxSamples: the most samples in one batch (the game sends at most a handful a session).
	perfMaxSamples = 8
	// perfMaxMS: a time past this (ten minutes) is not a loading time.
	perfMaxMS = 600_000
)

// perfLimit: batches per account and hour (a session sends three or four; more is a loop gone wrong).
var perfLimit = throttle.New(20, time.Hour)

// PerfDevice: the device, the same for the batch's samples.
type PerfDevice struct {
	Class string  `json:"class"`
	Cores int     `json:"cores"`
	Mem   float64 `json:"mem"`
	DPR   float64 `json:"dpr"`
	Tier  string  `json:"tier"`
	Light bool    `json:"light"`
	Net   string  `json:"net"`
	App   bool    `json:"app"`
}

// PerfSample: one loading. Times in ms (0: not reached).
type PerfSample struct {
	Kind      string `json:"kind"`
	Commune   string `json:"commune"`
	HUD       int    `json:"hud"`
	Chunk     int    `json:"chunk"`
	Ready     int    `json:"ready"`
	Tap       int    `json:"tap"`
	Total     int    `json:"total"`
	Quit      bool   `json:"quit"`
	Screen    string `json:"screen"`
	ChunkHit  int    `json:"chunkHit"`
	ChunkMiss int    `json:"chunkMiss"`
	MemHit    int    `json:"memHit"`
	TileHit   int    `json:"tileHit"`
	TileMiss  int    `json:"tileMiss"`
	TileKB    int    `json:"tileKB"`
	NetKB     int    `json:"netKB"`
	FPS       int    `json:"fps"`
}

// PerfBatch: what the game sends.
type PerfBatch struct {
	Device  PerfDevice   `json:"device"`
	Samples []PerfSample `json:"samples"`
}

var (
	perfClasses = map[string]bool{"faible": true, "normal": true, "fort": true}
	perfTiers   = map[string]bool{"": true, "off": true, "simple": true, "normal": true, "haute": true}
	perfNets    = map[string]bool{"": true, "slow-2g": true, "2g": true, "3g": true, "4g": true}
	perfCommune = regexp.MustCompile(`^[a-z0-9-]{0,40}$`)
)

var errPerf = errors.New("mesure invalide")

// Check: the batch as the game may send it, nothing else (out of bounds is refused, not clipped: a client sending
// that is broken, and its numbers would only blur the medians).
func (b *PerfBatch) Check() error {
	d := b.Device
	if len(b.Samples) == 0 || len(b.Samples) > perfMaxSamples || !perfClasses[d.Class] || !perfTiers[d.Tier] || !perfNets[d.Net] ||
		d.Cores < 0 || d.Cores > 256 || d.Mem < 0 || d.Mem > 64 || d.DPR < 0 || d.DPR > 8 {
		return errPerf
	}
	ms := func(v int) bool { return v >= 0 && v <= perfMaxMS }
	count := func(v int) bool { return v >= 0 && v <= 2000 }
	for _, s := range b.Samples {
		if (s.Kind != "start" && s.Kind != "trip") || !perfCommune.MatchString(s.Commune) || (s.Screen != "" && !screenName.MatchString(s.Screen)) ||
			!ms(s.HUD) || !ms(s.Chunk) || !ms(s.Ready) || !ms(s.Tap) || !ms(s.Total) ||
			!count(s.ChunkHit) || !count(s.ChunkMiss) || !count(s.MemHit) || !count(s.TileHit) || !count(s.TileMiss) ||
			s.TileKB < 0 || s.TileKB > 500_000 || s.NetKB < 0 || s.NetKB > 500_000 || s.FPS < 0 || s.FPS > 240 {
			return errPerf
		}
	}
	return nil
}

type perfExec interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}

// nz: 0 (not reached, not known) as NULL.
func nz[T int | float64](v T) any {
	if v == 0 {
		return nil
	}
	return v
}

// StorePerf writes a checked batch: one INSERT for all its samples.
func StorePerf(ctx context.Context, db perfExec, user string, b PerfBatch) error {
	d := b.Device
	q := `INSERT INTO perf_samples (user_id, kind, commune, hud_ms, chunk_ms, ready_ms, tap_ms, total_ms, quit, screen,
		chunk_hit, chunk_miss, mem_hit, tile_hit, tile_miss, tile_kb, net_kb, fps, class, cores, mem_gb, dpr, tier, light, net, app) VALUES `
	const cols = 26
	args := make([]any, 0, cols*len(b.Samples))
	for i, s := range b.Samples {
		if i > 0 {
			q += ", "
		}
		q += "("
		for c := range cols {
			if c > 0 {
				q += ", "
			}
			q += "$" + strconv.Itoa(i*cols+c+1)
		}
		q += ")"
		args = append(args, user, s.Kind, s.Commune, nz(s.HUD), nz(s.Chunk), nz(s.Ready), nz(s.Tap), nz(s.Total), s.Quit, s.Screen,
			s.ChunkHit, s.ChunkMiss, s.MemHit, s.TileHit, s.TileMiss, nz(s.TileKB), nz(s.NetKB), nz(s.FPS), d.Class, nz(d.Cores), nz(d.Mem), nz(d.DPR), d.Tier, d.Light, d.Net, d.App)
	}
	_, err := db.Exec(ctx, q, args...)
	return err
}

// PrunePerf deletes the rows past perfKeepDays, a batch at a time (called now and then from Perf, never on its own).
func PrunePerf(ctx context.Context, db perfExec) (int64, error) {
	tag, err := db.Exec(ctx, `DELETE FROM perf_samples WHERE id IN (SELECT id FROM perf_samples WHERE at < now() - make_interval(days => $1) LIMIT 5000)`, perfKeepDays)
	return tag.RowsAffected(), err
}

// Perf: POST /me/perf {device, samples}: a batch of loadings (the update closed: taken and dropped).
func (h *Handler) Perf(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !features.Default.Open(ctx, PerfFeature) {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
	var b PerfBatch
	if err := httpx.Decode(r, &b); err != nil || b.Check() != nil {
		httpx.Error(w, http.StatusBadRequest, "mesure invalide")
		return
	}
	id := UserID(ctx)
	if !perfLimit.Allow(id) {
		httpx.Error(w, http.StatusTooManyRequests, "trop de mesures")
		return
	}
	if err := StorePerf(ctx, h.DB, id, b); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	// Now and then, the old rows go (a batch comes only while someone plays: the database is awake anyway).
	if rand.IntN(100) == 0 {
		if n, err := PrunePerf(ctx, h.DB); err != nil {
			log.Printf("perf: prune: %v", err)
		} else if n > 0 {
			log.Printf("perf: %d old samples deleted", n)
		}
	}
	w.WriteHeader(http.StatusNoContent)
}
