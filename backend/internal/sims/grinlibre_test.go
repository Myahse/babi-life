package sims

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/npcchat"
)

// Against a database: a player answering a PNJ in « Tout Babi » gets the PNJ's own words, once, in the
// background; shut, the banks answer as before.
func TestGrinLibre(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	old := features.Default
	features.Default = &features.Store{DB: pool}
	t.Cleanup(func() { features.Default = old })
	for _, k := range []string{PnjVivantsKey, GrinLibreKey} {
		if err := features.Default.Set(ctx, k, true, nil); err != nil {
			t.Fatal(err)
		}
	}
	awa := replySim(t, pool, "Awa")
	var mu sync.Mutex
	var asked []string
	h := &Handler{DB: pool, Talk: npcchat.FromFunc(func(_ context.Context, _, user string) (string, error) {
		mu.Lock()
		asked = append(asked, user)
		mu.Unlock()
		return `{"text": "Mdrr ok ok : pourquoi le gbaka ne dort jamais ? Parce qu'il a toujours un apprenti 😂", "mood": "good"}`, nil
	})}
	now := time.Now()
	who := pnjSpeakers(ctx, "babi", now)
	if len(who) == 0 {
		t.Fatal("no PNJ")
	}
	var pid, mid int64
	if err := pool.QueryRow(ctx, `INSERT INTO grin (room, pnj, pnj_name, body, pnj_key) VALUES ('babi', $1, $2, 'on dit quoi le quartier', 'test:1') RETURNING id`, who[0].ID, who[0].FirstName).Scan(&pid); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO grin (room, sim, body, reply_to, created_at) VALUES ('babi', $1, 'slt raconte nous une blague stp', $2, now() - interval '10 seconds') RETURNING id`, awa, pid).Scan(&mid); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		pnjGrinLooked.Delete("babi")
		h.pnjGrin(ctx, "babi", time.Now())
	}
	var body string
	for range 50 {
		if pool.QueryRow(ctx, `SELECT body FROM grin WHERE reply_to = $1 AND pnj = $2`, mid, who[0].ID).Scan(&body) == nil {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if !strings.Contains(body, "gbaka") {
		t.Fatalf("no answer: %q", body)
	}
	time.Sleep(100 * time.Millisecond)
	pnjGrinLooked.Delete("babi")
	h.pnjGrin(ctx, "babi", time.Now())
	var n int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM grin WHERE reply_to = $1`, mid).Scan(&n)
	mu.Lock()
	defer mu.Unlock()
	if n != 1 || len(asked) != 1 {
		t.Fatalf("%d answers, %d calls", n, len(asked))
	}
	if !strings.Contains(asked[0], "slt raconte nous une blague stp") || !strings.Contains(asked[0], "Awa t'écrit") {
		t.Errorf("prompt: %s", asked[0])
	}
}
