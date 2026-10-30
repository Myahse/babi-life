package sims

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The jam regulated (the update « circulation »): the street's « Embouteillage » (game.Happenings) is
// joined as the traffic cop's mini-game at the junction (web components/defi/Circulation.tsx, the défi
// « circulation »). Played well, the jam ends early for everyone in the commune: the cars drive off, the
// traffic flows again (web world3d/open/OpenWorld.tsx), and nobody else can regulate it.

// JamClearScore is the score from which the junction is cleared.
const JamClearScore = 60

// rowQuerier: a pool or a transaction.
type rowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// JamCleared: whether the jam on in a commune at a game minute was cleared, and when (the game minute).
func JamCleared(ctx context.Context, db rowQuerier, city, commune string, gameMinutes int64) (int64, bool, error) {
	h, start, ok := game.HappeningAt(city, commune, gameMinutes)
	if !ok || h.ID != "embouteillage" {
		return 0, false, nil
	}
	var at int64
	err := db.QueryRow(ctx, `SELECT cleared_at FROM jams_cleared WHERE city = $1 AND commune = $2 AND start = $3`, city, commune, start).Scan(&at)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	return at, true, nil
}

// clearJam: the jam the Sim regulated, cleared for its commune (a score under JamClearScore: still jammed).
// Whether it was this Sim that cleared it.
func clearJam(ctx context.Context, tx pgx.Tx, s *Sim, score int) (bool, error) {
	if score < JamClearScore {
		return false, nil
	}
	h, start, ok := game.HappeningAt(s.City, s.Commune, s.GameMinutes)
	if !ok || h.ID != "embouteillage" {
		return false, nil
	}
	tag, err := tx.Exec(ctx, `INSERT INTO jams_cleared (city, commune, start, cleared_at, sim_id, score) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`, s.City, s.Commune, start, s.GameMinutes, s.ID, score)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}
