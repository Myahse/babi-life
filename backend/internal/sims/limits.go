package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// « Mes limites » (web components/CasinoLimits.tsx): what a player allows themselves at the money games
// (the machines, the roulette and the table de l'Ivoire, le 21, the tickets, the bingo, L'Envol, Babi Trade), for the whole account:
//   - a most to stake a day, over all of them: lowered at once; raised (or taken off) only 24 hours on, so
//     it isn't undone in the heat of a game;
//   - a pause (24 hours, 7 days, 30 days): no money game until it's over, and it can't be cut short.
// The day is Abidjan's (UTC).

// LimitWait is how long a higher limit (or none) waits before it counts.
const LimitWait = 24 * time.Hour

// LimitPauses are the pauses one can take, by their name.
var LimitPauses = map[string]time.Duration{"24h": 24 * time.Hour, "7j": 7 * 24 * time.Hour, "30j": 30 * 24 * time.Hour}

// CasinoLimits is a player's limits as the app shows them.
type CasinoLimits struct {
	// Daily: the most staked a day (0: none).
	Daily int `json:"daily"`
	// Pending: the limit asked for that counts from PendingAt (0: none), when there's one waiting.
	Pending   *int       `json:"pending,omitempty"`
	PendingAt *time.Time `json:"pendingAt,omitempty"`
	// PauseUntil: no money game until then.
	PauseUntil *time.Time `json:"pauseUntil,omitempty"`
	// Today: what was staked today over the money games.
	Today int `json:"today"`
}

var errPaused = errors.New("tu as fait une pause du casino (« Mes limites ») : les jeux d'argent reviennent à la fin de ta pause")

// casinoMoneyToday: what the account staked today (Abidjan's day) over the money games.
const casinoMoneyToday = `SELECT COALESCE(SUM(stake), 0) FROM (
	SELECT stake, created_at FROM game_rounds WHERE game IN ('machines', 'roulette', '21', 'tickets') AND sim IN (SELECT id FROM sims WHERE user_id = $1)
	UNION ALL SELECT stake, created_at FROM bingo_cards WHERE sim IN (SELECT id FROM sims WHERE user_id = $1)
	UNION ALL SELECT stake, created_at FROM envol_bets WHERE sim IN (SELECT id FROM sims WHERE user_id = $1)
	UNION ALL SELECT stake, created_at FROM trade_bets WHERE sim IN (SELECT id FROM sims WHERE user_id = $1)
	UNION ALL SELECT stake, created_at FROM table_bets WHERE sim IN (SELECT id FROM sims WHERE user_id = $1)
) AS m WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`

// readLimits: the account's limits now (a waiting limit whose time has come counts), and today's stakes.
func readLimits(ctx context.Context, tx pgx.Tx, user string) (CasinoLimits, error) {
	var l CasinoLimits
	var pending *int
	var pendingAt, pause *time.Time
	err := tx.QueryRow(ctx, `SELECT daily, pending, pending_at, pause_until FROM casino_limits WHERE user_id = $1`, user).Scan(&l.Daily, &pending, &pendingAt, &pause)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return l, err
	}
	now := time.Now()
	if pending != nil && pendingAt != nil {
		if !now.Before(*pendingAt) {
			// Its 24 hours are over: the new limit counts.
			l.Daily = *pending
			if _, err := tx.Exec(ctx, `UPDATE casino_limits SET daily = pending, pending = NULL, pending_at = NULL WHERE user_id = $1`, user); err != nil {
				return l, err
			}
		} else {
			l.Pending, l.PendingAt = pending, pendingAt
		}
	}
	if pause != nil && now.Before(*pause) {
		l.PauseUntil = pause
	}
	if err := tx.QueryRow(ctx, casinoMoneyToday, user).Scan(&l.Today); err != nil {
		return l, err
	}
	return l, nil
}

// casinoLimit: may the player stake this much more now, by their own limits?
func casinoLimit(ctx context.Context, tx pgx.Tx, stake int) error {
	l, err := readLimits(ctx, tx, auth.UserID(ctx))
	if err != nil {
		return err
	}
	if l.PauseUntil != nil {
		return errPaused
	}
	if l.Daily > 0 && l.Today+stake > l.Daily {
		return fmt.Errorf("ta limite du jour (« Mes limites ») : %s Djai misés au plus, et tu en es à %s", money(l.Daily), money(l.Today))
	}
	return nil
}

// limits: GET /me/casino-limits — the player's limits and today's stakes.
func (h *Handler) limits(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	l, err := readLimits(ctx, tx, auth.UserID(ctx))
	if err != nil || tx.Commit(ctx) != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, l)
}

// setLimits: POST /me/casino-limits {daily?, pause?} — a new most a day (0: none) and/or a pause (24h, 7j, 30j).
func (h *Handler) setLimits(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Daily *int   `json:"daily"`
		Pause string `json:"pause"`
	}
	if err := httpx.Decode(r, &req); err != nil || (req.Daily != nil && (*req.Daily < 0 || *req.Daily > 100_000_000)) {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	pause, okPause := LimitPauses[req.Pause]
	if req.Pause != "" && !okPause {
		httpx.Error(w, http.StatusBadRequest, "pause inconnue")
		return
	}
	ctx := r.Context()
	user := auth.UserID(ctx)
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	l, err := readLimits(ctx, tx, user)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if _, err := tx.Exec(ctx, `INSERT INTO casino_limits (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, user); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if req.Daily != nil {
		d := *req.Daily
		if tighter(d, l.Daily) {
			// Lower (or a first limit): at once, and nothing higher waiting any more.
			_, err = tx.Exec(ctx, `UPDATE casino_limits SET daily = $2, pending = NULL, pending_at = NULL, updated_at = now() WHERE user_id = $1`, user, d)
		} else if d != l.Daily {
			_, err = tx.Exec(ctx, `UPDATE casino_limits SET pending = $2, pending_at = now() + $3::interval, updated_at = now() WHERE user_id = $1`, user, d, fmt.Sprintf("%d seconds", int(LimitWait.Seconds())))
		}
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
	}
	if okPause {
		// A pause only ever lengthens one already going.
		if _, err := tx.Exec(ctx, `UPDATE casino_limits SET pause_until = GREATEST(COALESCE(pause_until, now()), now() + $2::interval), updated_at = now() WHERE user_id = $1`, user, fmt.Sprintf("%d seconds", int(pause.Seconds()))); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
	}
	l, err = readLimits(ctx, tx, user)
	if err != nil || tx.Commit(ctx) != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, l)
}

// tighter: is the limit `to` stricter than `from` (0 is none: the loosest)?
func tighter(to, from int) bool {
	if to == 0 {
		return false
	}
	return from == 0 || to < from
}
