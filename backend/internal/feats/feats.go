// Package feats: what a generation of a family did, written as it happens (the update « heritage », phase 2;
// table generation_feats, migration 139): an office won, a diploma, a career's rung, a marriage. The
// passation's renom (sims/heritage.go) reads them, so it counts the generation's history, not only what it
// holds on its last day. Any package can write one (politics, sims) without the Sim's row in hand.
package feats

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/myahse/babi-life/backend/internal/features"
)

// The kinds of feats.
const (
	Office   = "mandat"   // detail: maire | depute | ministre | president
	Diploma  = "diplome"  // detail: bac | sup
	Career   = "carriere" // detail: the career and its rung, « commerce:4 »
	Marriage = "mariage"
)

// HeritageKey: the update (game.HeritageKey; repeated here so politics needn't import game's heritage).
const HeritageKey = "heritage"

type execer interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}

// Open: the update is with the players (closed, nothing is written).
func Open(ctx context.Context) bool {
	return features.Default != nil && features.Default.BlocksKey(ctx, HeritageKey) == ""
}

// Record: the feat written for the Sim's generation now, once (the same one again is nothing). Never fails
// the caller's work: an error is only the feat lost.
func Record(ctx context.Context, q execer, sim, kind, detail string) {
	if sim == "" || !Open(ctx) {
		return
	}
	_, _ = q.Exec(ctx, `INSERT INTO generation_feats (sim_id, gen, kind, detail) SELECT id, generation, $2, $3 FROM sims WHERE id = $1 ON CONFLICT DO NOTHING`, sim, kind, detail)
}

// OfficeOf: « maire:cocody », « ministre:sante » → « maire », « ministre ».
func OfficeOf(office string) string {
	o, _, _ := strings.Cut(office, ":")
	return o
}
