package sims

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/odds"
)

// L'Envol (game/envol.go, web screens/casino/Envol.tsx): a bet before the plane
// takes off, cashed in by hand while it flies (at the multiplier the server
// reads at that moment), or by itself at its target; lost if the plane flies
// off first. One bet a round. Where a plane flies off is told only once it has.

var (
	errEnvolStake = fmt.Errorf("mise de %s à %s Djai", money(game.EnvolStakes[0]), money(game.EnvolStakes[len(game.EnvolStakes)-1]))
	errEnvolAuto  = fmt.Errorf("encaissement automatique entre ×1,01 et ×%.0f", game.EnvolMax)
	errEnvolTwice = errors.New("tu as déjà misé sur cet envol")
	errEnvolNoBet = errors.New("pas de mise sur cet envol")
	errEnvolWait  = errors.New("l'avion n'a pas encore décollé")
	errEnvolGone  = errors.New("trop tard : l'avion est parti")
	errEnvolDone  = errors.New("déjà encaissé")
)

type envolBet struct {
	ID     int64   `json:"id"`
	Round  int64   `json:"round"`
	Stake  int     `json:"stake"`
	Auto   float64 `json:"auto,omitempty"`
	Cashed float64 `json:"cashed,omitempty"`
	Status string  `json:"status"`
	Payout int     `json:"payout,omitempty"`
}

// envolNow: the round going on and where it is: attente (bets taken), vol, parti.
func envolNow(nowMs int64) (n int64, phase string) {
	n = game.EnvolRound(nowMs)
	switch {
	case nowMs < game.EnvolTakeoff(n):
		return n, "attente"
	case nowMs < envolFlown(n):
		return n, "vol"
	}
	return n, "parti"
}

// envolWait: the longest a ?attendre=1 read is held (the app asks again at once).
const envolWait = 2 * time.Second

// envolState: GET /sims/{id}/casino/envol — the round, the last planes, the Sim's bets, the others' on this round.
// With ?attendre=1 the answer is held till the next thing happens (the take-off, the plane gone, the
// bets open again), envolWait at most: the app hears that the plane is gone as it goes.
func (h *Handler) envolState(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	if r.URL.Query().Get("attendre") == "1" {
		nowMs := time.Now().UnixMilli()
		n, phase := envolNow(nowMs)
		next := map[string]int64{"attente": game.EnvolTakeoff(n), "vol": envolFlown(n), "parti": (n + 1) * game.EnvolPeriod * 1000}[phase]
		if d := min(time.Duration(next-nowMs)*time.Millisecond, envolWait); d > 0 {
			select {
			case <-ctx.Done():
				return
			case <-time.After(d):
			}
		}
	}
	nowMs := time.Now().UnixMilli()
	n, phase := envolNow(nowMs)
	round := map[string]any{"n": n, "phase": phase, "takeoff": game.EnvolTakeoff(n), "next": game.EnvolTakeoff(n + 1)}
	if phase == "parti" {
		round["crash"] = envolCrash(n)
		round["flown"] = envolFlown(n)
	}
	// The planes gone before (never the one in the air).
	last := n - 1
	if phase == "parti" {
		last = n
	}
	history := make([]float64, 0, 14)
	for k := last; k > last-14; k-- {
		history = append(history, envolCrash(k))
	}
	mine := []envolBet{}
	players := []map[string]any{}
	rows, err := h.DB.Query(ctx, `
		SELECT b.id, b.sim = $1, s.first_name, b.round, b.stake, b.auto, b.cashed, b.status, b.payout
		FROM envol_bets b JOIN sims s ON s.id = b.sim
		WHERE (b.sim = $1 AND b.round >= $2 - 1) OR b.round = $2 ORDER BY b.id LIMIT 200`, id, n)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	took := game.EnvolTakeoff(n)
	for rows.Next() {
		var b envolBet
		var own bool
		var name string
		var auto, cashed int
		if err := rows.Scan(&b.ID, &own, &name, &b.Round, &b.Stake, &auto, &cashed, &b.Status, &b.Payout); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		b.Auto, b.Cashed = float64(auto)/100, float64(cashed)/100
		// Cashed in by itself already (the multiplier past its target): said, paid when the plane is gone.
		if b.Cashed == 0 && b.Auto > 0 && b.Round == n && phase != "attente" && game.EnvolAt(min(nowMs, envolFlown(n))-took) >= b.Auto && b.Auto <= envolCrash(n) {
			b.Cashed = b.Auto
		}
		if own {
			mine = append(mine, b)
		}
		if b.Round == n {
			p := map[string]any{"name": name, "stake": b.Stake, "mine": own}
			if b.Cashed > 0 {
				p["cashed"] = b.Cashed
			}
			players = append(players, p)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"now": nowMs, "round": round, "history": history, "mine": mine, "players": players, "stakes": game.EnvolStakes})
}

// envolBet: POST /sims/{id}/casino/envol {stake, auto} — a bet on the next plane (the one waiting, else the one after).
func (h *Handler) envolBet(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Stake int     `json:"stake"`
		Auto  float64 `json:"auto"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if err := casinoOpen(ctx, tx, s); err != nil {
			return game.Outcome{}, nil, err
		}
		nowMs := time.Now().UnixMilli()
		n, phase := envolNow(nowMs)
		if phase != "attente" {
			n++
		}
		auto, err := s.envolStake(req.Stake, req.Auto)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		tag, err := tx.Exec(ctx, `INSERT INTO envol_bets (sim, round, stake, auto, settles_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (sim, round) DO NOTHING`,
			s.ID, n, req.Stake, auto, (envolFlown(n)+999)/1000)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if tag.RowsAffected() == 0 {
			return game.Outcome{}, nil, errEnvolTwice
		}
		s.Money -= req.Stake
		s.wallet().Use(s.today(), game.Casino)
		return game.Outcome{Text: fmt.Sprintf("Mise de %s Djai sur l'envol.", money(req.Stake)), Money: -req.Stake}, nil, nil
	})
}

// envolStake: a stake and an automatic cash-out (× 100; 0: by hand) the Sim can take.
func (s *Sim) envolStake(stake int, auto float64) (int, error) {
	if !game.StakeIn(stake, game.EnvolStakes) {
		return 0, errEnvolStake
	}
	if auto != 0 && (auto < 1.01 || auto > game.EnvolMax) {
		return 0, errEnvolAuto
	}
	if s.Money < stake {
		return 0, game.ErrNotEnoughMoney
	}
	return int(math.Round(auto * 100)), nil
}

// envolCash: POST /sims/{id}/casino/envol/encaisser — cashed in now, at the multiplier the plane is at.
func (h *Handler) envolCash(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		nowMs := time.Now().UnixMilli()
		n := game.EnvolRound(nowMs)
		var id int64
		var stake, auto int
		var status string
		err := tx.QueryRow(ctx, `SELECT id, stake, auto, status FROM envol_bets WHERE sim = $1 AND round = $2 FOR UPDATE`, s.ID, n).Scan(&id, &stake, &auto, &status)
		if errors.Is(err, pgx.ErrNoRows) {
			return game.Outcome{}, nil, errEnvolNoBet
		}
		if err != nil {
			return game.Outcome{}, nil, err
		}
		// Settled already (the refresh before this found the plane gone): said as it is.
		switch status {
		case "lost":
			return game.Outcome{}, nil, errEnvolGone
		case "won":
			return game.Outcome{}, nil, errEnvolDone
		}
		m, err := envolCashAt(n, nowMs, float64(auto)/100)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		pay := int(math.Floor(float64(stake) * m))
		if _, err := tx.Exec(ctx, `UPDATE envol_bets SET status = 'won', cashed = $2, payout = $3 WHERE id = $1`, id, int(math.Round(m*100)), pay); err != nil {
			return game.Outcome{}, nil, err
		}
		s.Money += pay
		return game.Outcome{Text: fmt.Sprintf("Encaissé à ×%s : %s Djai.", times(m), money(pay)), Money: pay}, bigWin(s, fmt.Sprintf("l'Envol à ×%s", times(m)), stake, pay), nil
	})
}

// envolRate: a round's « taux de retour »: the one set when its plane took off (odds; 0: untouched).
func envolRate(n int64) float64 {
	r, _ := odds.Default.RateAt(game.OddsEnvol, time.UnixMilli(game.EnvolTakeoff(n)))
	return r
}

// envolCrash, envolFlown: where and when a round's plane flies off, at its rate.
func envolCrash(n int64) float64 { return game.EnvolCrash(n, envolRate(n)) }
func envolFlown(n int64) int64   { return game.EnvolFlown(n, envolRate(n)) }

// envolCashAt: the multiplier a bet is cashed in at now: the plane's, or its target if
// it got there first; an error before take-off or once the plane is gone.
func envolCashAt(n, nowMs int64, auto float64) (float64, error) {
	took, flown := game.EnvolTakeoff(n), envolFlown(n)
	switch {
	case nowMs < took:
		return 0, errEnvolWait
	case nowMs >= flown:
		return 0, errEnvolGone
	}
	m := game.EnvolAt(nowMs - took)
	if auto > 0 && m >= auto {
		m = auto
	}
	return math.Min(m, envolCrash(n)), nil
}

// settleEnvol: the Sim's bets on planes gone: cashed in by themselves at their target if it
// came before the plane flew off, else lost.
func settleEnvol(ctx context.Context, tx pgx.Tx, s *Sim, now int64) ([]Event, error) {
	rows, err := tx.Query(ctx, `SELECT id, round, stake, auto FROM envol_bets WHERE sim = $1 AND status = 'open' AND settles_at <= $2`, s.ID, now)
	if err != nil {
		return nil, err
	}
	type bet struct {
		id, round   int64
		stake, auto int
	}
	var bets []bet
	for rows.Next() {
		var b bet
		if err := rows.Scan(&b.id, &b.round, &b.stake, &b.auto); err != nil {
			rows.Close()
			return nil, err
		}
		bets = append(bets, b)
	}
	rows.Close()
	var events []Event
	for _, b := range bets {
		target := float64(b.auto) / 100
		if b.auto > 0 && target <= envolCrash(b.round) {
			pay := int(math.Floor(float64(b.stake) * target))
			if _, err := tx.Exec(ctx, `UPDATE envol_bets SET status = 'won', cashed = $2, payout = $3 WHERE id = $1`, b.id, b.auto, pay); err != nil {
				return nil, err
			}
			s.Money += pay
			events = append(events, bigWin(s, fmt.Sprintf("l'Envol à ×%s", times(target)), b.stake, pay)...)
			continue
		}
		if _, err := tx.Exec(ctx, `UPDATE envol_bets SET status = 'lost' WHERE id = $1`, b.id); err != nil {
			return nil, err
		}
	}
	return events, nil
}

// times: a multiplier as it's said (2,35).
func times(m float64) string { return strings.Replace(fmt.Sprintf("%.2f", m), ".", ",", 1) }
