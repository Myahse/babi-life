package sims

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// recordRound keeps a round of a money game that has no table of its own (the slots, the roulette, le 21, the
// tickets: game_rounds), for its « Historique »: what was staked, what came back, what it was.
func recordRound(ctx context.Context, tx pgx.Tx, sim, jeu string, stake, payout int, detail string) error {
	_, err := tx.Exec(ctx, `INSERT INTO game_rounds (sim, game, stake, payout, detail) VALUES ($1, $2, $3, $4, $5)`, sim, jeu, stake, payout, detail)
	return err
}
