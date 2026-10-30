// Package account deletes a player's account and everything tied to it, the
// way Google Play and the privacy policy promise (web /confidentialite): from
// the game (« Réglages » › « Supprimer mon compte », auth.Handler.DeleteMe)
// or by the team after a request on the public page /suppression-compte
// (requests.go, handled on /admin).
//
// What goes, in one transaction:
//   - the account (users) and with it, by the foreign keys, its sessions,
//     push tokens, password resets, idempotency keys, ideas, votes, ratings,
//     earnings and the referral gifts it received;
//   - its Sims (sims), and with them everything a Sim owns or wrote: the
//     journal, friends and couples (bonds, requests), Gbairai messages (both
//     ways: a conversation with the deleted Sim goes for the other player too),
//     blocks and reports (made and received), stories, Tikitoko, Babigram,
//     Flashe, photos, lots, vehicles, bets and games, parties and crews it was
//     in, soirées, politics…; the files of its photos and videos in the bucket
//     are removed after (Result.Files);
//   - its wish-list entry and the news e-mails sent to it (by its e-mail).
//
// What stays, anonymised:
//   - purchases (accounting): user and Sim cleared; one not paid yet is
//     closed (« account-deleted »), it will never be given;
//   - a referral gift another player got when this one joined: its name
//     becomes « Compte supprimé »;
//   - a party or a crew this Sim led: the oldest member takes the lead (else it's dissolved);
//   - an election it won, a post it named someone to: the Sim cleared (the foreign keys).
//
// The e-mail's « ne plus recevoir » (mail_optout) stays as it is: it's what keeps
// the address from being written to again.
package account

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Deleted is what's shown where another player's data must keep a name.
const Deleted = "Compte supprimé"

// The journal's line of the one who takes the lead after the deleted Sim.
const (
	partyNote = "Politique : tu prends la tête du parti, son fondateur est parti."
	crewNote  = "Gang : le chef est parti, le gang est à toi maintenant."
)

// ErrNoUser: no such account (already deleted).
var ErrNoUser = errors.New("account: no such user")

// Result: what the caller still has to do outside the database.
type Result struct {
	// Sessions signed out (their tokens stop working at once).
	Sessions []string
	// Files in the bucket (photos, Tikitoko videos) to remove.
	Files []string
	// Other players' Sims touched (a party or crew they now lead).
	Changed []string
}

// Delete erases the account userID; by says who for the team's log (« le joueur, depuis le jeu »).
func Delete(ctx context.Context, db *pgxpool.Pool, userID, by string) (Result, error) {
	var out Result
	tx, err := db.Begin(ctx)
	if err != nil {
		return out, err
	}
	defer tx.Rollback(ctx)

	var email, username string
	err = tx.QueryRow(ctx, `SELECT email, COALESCE(username, '') FROM users WHERE id = $1 FOR UPDATE`, userID).Scan(&email, &username)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, ErrNoUser
	}
	if err != nil {
		return out, err
	}

	if out.Sessions, err = column(ctx, tx, `SELECT id::text FROM sessions WHERE user_id = $1`, userID); err != nil {
		return out, err
	}
	if out.Files, err = column(ctx, tx, `
		SELECT p.key FROM photos p JOIN sims s ON s.id = p.sim WHERE s.user_id = $1 AND p.key <> ''
		UNION SELECT t.video_key FROM tiki_posts t JOIN sims s ON s.id = t.sim WHERE s.user_id = $1 AND t.video_key <> ''`, userID); err != nil {
		return out, err
	}

	// Purchases: kept for the accounts, nobody's any more.
	if _, err := tx.Exec(ctx, `
		UPDATE purchases SET user_id = NULL, sim_id = NULL, updated_at = now(),
			status = CASE WHEN credited_at IS NULL AND status IN ('created', 'pending', 'processing') THEN 'account-deleted' ELSE status END
		WHERE user_id = $1 OR sim_id IN (SELECT id FROM sims WHERE user_id = $1)`, userID); err != nil {
		return out, err
	}
	// The gift a friend got for bringing this player: it stays theirs, without the name.
	if _, err := tx.Exec(ctx, `UPDATE referral_gifts SET friend_name = $2 WHERE friend_id = $1`, userID, Deleted); err != nil {
		return out, err
	}

	// A party or a crew this Sim led goes on with its oldest member (as when the leader leaves, politics.go).
	now := game.MinuteOf(time.Now())
	rows, err := tx.Query(ctx, `
		SELECT p.id, (SELECT m.sim_id FROM party_members m JOIN sims o ON o.id = m.sim_id WHERE m.party_id = p.id AND o.user_id <> $1 ORDER BY m.joined_at LIMIT 1)
		FROM parties p JOIN sims s ON s.id = p.leader WHERE s.user_id = $1`, userID)
	if err != nil {
		return out, err
	}
	parties := map[int64]*string{}
	for rows.Next() {
		var id int64
		var next *string
		if err := rows.Scan(&id, &next); err != nil {
			rows.Close()
			return out, err
		}
		parties[id] = next
	}
	rows.Close()
	for id, next := range parties {
		if next == nil {
			continue // dissolved with its leader (the foreign key)
		}
		if _, err := tx.Exec(ctx, `UPDATE parties SET leader = $1 WHERE id = $2`, *next, id); err != nil {
			return out, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) VALUES ($1, 'politique', $2, 0, $3)`, *next, partyNote, now); err != nil {
			return out, err
		}
		out.Changed = append(out.Changed, *next)
	}
	rows, err = tx.Query(ctx, `
		SELECT c.id, (SELECT m.sim_id FROM crew_members m JOIN sims o ON o.id = m.sim_id WHERE m.crew_id = c.id AND o.user_id <> $1 ORDER BY m.role = 'bras-droit' DESC, m.joined_at LIMIT 1)
		FROM crews c JOIN sims s ON s.id = c.leader WHERE s.user_id = $1`, userID)
	if err != nil {
		return out, err
	}
	crews := map[int64]*string{}
	for rows.Next() {
		var id int64
		var next *string
		if err := rows.Scan(&id, &next); err != nil {
			rows.Close()
			return out, err
		}
		crews[id] = next
	}
	rows.Close()
	for id, next := range crews {
		if next == nil {
			continue
		}
		if _, err := tx.Exec(ctx, `UPDATE crews SET leader = $1 WHERE id = $2`, *next, id); err != nil {
			return out, err
		}
		if _, err := tx.Exec(ctx, `UPDATE crew_members SET role = 'chef' WHERE sim_id = $1`, *next); err != nil {
			return out, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) VALUES ($1, 'politique', $2, 0, $3)`, *next, crewNote, now); err != nil {
			return out, err
		}
		out.Changed = append(out.Changed, *next)
	}

	// What was kept by the e-mail, apart from the account.
	if email != "" {
		if _, err := tx.Exec(ctx, `DELETE FROM waitlist WHERE kind = 'email' AND lower(contact) = lower($1)`, email); err != nil {
			return out, err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM mail_sends WHERE lower(email) = lower($1)`, email); err != nil {
			return out, err
		}
	}
	// A request from the public page for this account: done.
	if _, err := tx.Exec(ctx, `UPDATE deletion_requests SET status = 'done', done_at = now()
		WHERE status = 'open' AND (lower(email) = lower($1) OR ($2 <> '' AND lower(username) = lower($2)))`, email, username); err != nil {
		return out, err
	}

	// The Sims, and the account: everything else goes with them (the foreign keys, ON DELETE CASCADE / SET NULL).
	if _, err := tx.Exec(ctx, `DELETE FROM sims WHERE user_id = $1`, userID); err != nil {
		return out, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID); err != nil {
		return out, err
	}
	// The team's log: that it happened, not who.
	if _, err := tx.Exec(ctx, `INSERT INTO admin_log (action, detail) VALUES ('Compte supprimé', $1)`, by); err != nil {
		return out, err
	}
	return out, tx.Commit(ctx)
}

func column(ctx context.Context, tx pgx.Tx, sql string, args ...any) ([]string, error) {
	rows, err := tx.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}
