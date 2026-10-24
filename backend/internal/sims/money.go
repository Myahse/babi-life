package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The day's limits on what's earned by playing (game/money.go), per account:
// read with the Sim (mutateWith), counted as the Sim earns, saved with it. The
// offline sync (sync.go) plays its steps through the same Sim, so they count
// the same. Djai credited to another player's Sim (a transfer, a stake won, a
// Dodo booking) goes through takeFor, on that account's own tallies.

// purseSQL: the account's tallies since $4 (a day), as [[day, kind, amount, times], …].
const purseSQL = `(SELECT COALESCE(json_agg(json_build_array(e.day, e.kind, e.amount, e.times)), '[]') FROM earnings e WHERE e.user_id = sims.user_id AND e.day >= $4)`

// purseFrom: the first day read: yesterday (the Sim's time may still be there, an activity
// ending after midnight, an offline replay).
func purseFrom(now time.Time) int64 { return game.DayOf(game.MinuteOf(now)) - 1 }

// readPurse: the tallies read with the Sim.
func readPurse(raw []byte) *game.Purse {
	p := game.NewPurse()
	var rows [][4]json.RawMessage
	if json.Unmarshal(raw, &rows) != nil {
		return p
	}
	for _, r := range rows {
		var day int64
		var kind string
		var t game.Tally
		if json.Unmarshal(r[0], &day) == nil && json.Unmarshal(r[1], &kind) == nil && json.Unmarshal(r[2], &t.Djai) == nil && json.Unmarshal(r[3], &t.Times) == nil {
			p.Seed(day, game.Income(kind), t)
		}
	}
	return p
}

const purseUpsert = `INSERT INTO earnings (user_id, day, kind, amount, times) VALUES ($1, $2, $3, $4, $5)
	ON CONFLICT (user_id, day, kind) DO UPDATE SET amount = earnings.amount + EXCLUDED.amount, times = earnings.times + EXCLUDED.times`

// queuePurse: the tallies changed, to save in the batch; how many statements it added.
func queuePurse(b *pgx.Batch, user string, p *game.Purse) int {
	if p == nil {
		return 0
	}
	changes := p.Changes()
	for _, c := range changes {
		b.Queue(purseUpsert, user, c.Day, string(c.Src), c.Djai, c.Times)
	}
	p.Saved()
	return len(changes)
}

// wallet: the account's tallies (a fresh one for a Sim not read from the database, in tests).
func (s *Sim) wallet() *game.Purse {
	if s.purse == nil {
		s.purse = game.NewPurse()
	}
	return s.purse
}

// today: the Sim's day, for its tallies.
func (s *Sim) today() int64 { return game.DayOf(s.GameMinutes) }

// earn: of `amount` from a source, what the account may still get today goes
// into the Sim's pocket (all of it, or what's left of the day's limit); it
// returns what it got.
func (s *Sim) earn(src game.Income, amount int) int {
	if amount <= 0 {
		return 0
	}
	got := s.wallet().Take(s.today(), src, amount, s.passOn())
	s.Money += got
	return got
}

// left: what a source can still bring today.
func (s *Sim) left(src game.Income) int { return s.wallet().Left(s.today(), src, s.passOn()) }

// capNote: a journal line, with the day's limit said when a source paid less than it would have.
func capNote(text string, src game.Income, got, would int) string {
	if got >= would {
		return text
	}
	if !strings.HasSuffix(text, ".") && !strings.HasSuffix(text, "!") && !strings.HasSuffix(text, "?") {
		text += "."
	}
	return text + " " + game.Full(src)
}

// takeFor: Djai credited to another player's Sim from a source, within its
// account's limit for today: what it gets (its money is raised by that).
func takeFor(ctx context.Context, tx pgx.Tx, simID string, src game.Income, amount int) (int, error) {
	if amount <= 0 {
		return 0, nil
	}
	day := game.DayOf(game.MinuteOf(time.Now()))
	var user string
	var pass bool
	var got, total int
	// The tallies locked: two transfers at once can't both pass the limit.
	if err := tx.QueryRow(ctx, `SELECT s.user_id, s.pass_until IS NOT NULL AND s.pass_until > now() FROM sims s WHERE s.id = $1`, simID).Scan(&user, &pass); err != nil {
		return 0, err
	}
	for _, k := range []game.Income{src, game.EarnedTotal} {
		if _, err := tx.Exec(ctx, `INSERT INTO earnings (user_id, day, kind) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, user, day, string(k)); err != nil {
			return 0, err
		}
	}
	if err := tx.QueryRow(ctx, `SELECT amount FROM earnings WHERE user_id = $1 AND day = $2 AND kind = $3 FOR UPDATE`, user, day, string(src)).Scan(&got); err != nil {
		return 0, err
	}
	if err := tx.QueryRow(ctx, `SELECT amount FROM earnings WHERE user_id = $1 AND day = $2 AND kind = $3 FOR UPDATE`, user, day, string(game.EarnedTotal)).Scan(&total); err != nil {
		return 0, err
	}
	p := game.NewPurse()
	p.Seed(day, src, game.Tally{Djai: got})
	p.Seed(day, game.EarnedTotal, game.Tally{Djai: total})
	take := p.Take(day, src, amount, pass)
	if take == 0 {
		return 0, nil
	}
	for _, c := range p.Changes() {
		if _, err := tx.Exec(ctx, purseUpsert, user, c.Day, string(c.Src), c.Djai, c.Times); err != nil {
			return 0, err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE sims SET money = money + $1 WHERE id = $2`, take, simID); err != nil {
		return 0, err
	}
	return take, nil
}

// leftFor: what another player's Sim can still get today from a source (without taking it).
func leftFor(ctx context.Context, tx pgx.Tx, simID string, src game.Income) (int, error) {
	day := game.DayOf(game.MinuteOf(time.Now()))
	var pass bool
	var got, total int
	err := tx.QueryRow(ctx, `SELECT s.pass_until IS NOT NULL AND s.pass_until > now(),
		COALESCE((SELECT amount FROM earnings e WHERE e.user_id = s.user_id AND e.day = $2 AND e.kind = $3), 0),
		COALESCE((SELECT amount FROM earnings e WHERE e.user_id = s.user_id AND e.day = $2 AND e.kind = 'total'), 0)
		FROM sims s WHERE s.id = $1`, simID, day, string(src)).Scan(&pass, &got, &total)
	if err != nil {
		return 0, err
	}
	p := game.NewPurse()
	p.Seed(day, src, game.Tally{Djai: got})
	p.Seed(day, game.EarnedTotal, game.Tally{Djai: total})
	return p.Left(day, src, pass), nil
}

var (
	errNewAccount = fmt.Errorf("ton compte est trop récent : envoyer des Djai, miser contre un joueur ou réserver chez lui, c'est après %d jours de jeu", game.NewAccountHold/(24*60))
	errTestDjai   = errors.New("les Djai du compte testeur ne passent pas aux autres joueurs")
)

// heldBack: a Sim whose account can't pass Djai on to other players yet (too
// young, or given money by the testers' toolbox): why, or nil.
func heldBack(ctx context.Context, tx pgx.Tx, simID string) error {
	var since time.Time
	var tested bool
	if err := tx.QueryRow(ctx, `SELECT u.created_at, s.tested FROM sims s JOIN users u ON u.id = s.user_id WHERE s.id = $1`, simID).Scan(&since, &tested); err != nil {
		return err
	}
	switch {
	case tested:
		return errTestDjai
	case time.Since(since) < game.NewAccountHold*time.Minute:
		return errNewAccount
	}
	return nil
}

// payWinner: a game's pot to its winner (a Sim not loaded: SQL): its own stake
// back, and what it won over it within its account's limit for the day
// (against the game's players: game.FromGames; against players:
// game.FromPlayers). What it got in all.
func payWinner(ctx context.Context, tx pgx.Tx, simID string, stake, pot int, src game.Income) (int, error) {
	if _, err := tx.Exec(ctx, `UPDATE sims SET money = money + $1 WHERE id = $2`, stake, simID); err != nil {
		return 0, err
	}
	won, err := takeFor(ctx, tx, simID, src, pot-stake)
	return stake + won, err
}
