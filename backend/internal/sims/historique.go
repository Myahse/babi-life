package sims

import (
	"net/http"
	"time"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The « Historique » of each money game (web components/GameHistory.tsx): the
// Sim's last rounds there, and what it staked and got back today and over
// seven days. The games with a table of their own are read from it; the
// others from game_rounds (rounds.go).

// histSources: each game's rounds as (moment, stake, payout, status, detail).
var histSources = map[string]string{
	"machines":  `SELECT created_at, stake, payout, CASE WHEN payout > stake THEN 'won' WHEN payout = stake AND payout > 0 THEN 'tie' ELSE 'lost' END, detail FROM game_rounds WHERE sim = $1 AND game = 'machines'`,
	"roulette":  `SELECT created_at, stake, payout, CASE WHEN payout > stake THEN 'won' WHEN payout = stake AND payout > 0 THEN 'tie' ELSE 'lost' END, detail FROM game_rounds WHERE sim = $1 AND game = 'roulette'`,
	"21":        `SELECT created_at, stake, payout, CASE WHEN payout > stake THEN 'won' WHEN payout = stake AND payout > 0 THEN 'tie' ELSE 'lost' END, detail FROM game_rounds WHERE sim = $1 AND game = '21'`,
	"tickets":   `SELECT created_at, stake, payout, CASE WHEN payout > 0 THEN 'won' ELSE 'lost' END, detail FROM game_rounds WHERE sim = $1 AND game = 'tickets'`,
	"bingo":     `SELECT created_at, stake, payout, status, game || CASE WHEN prize <> '' THEN ' · ' || prize ELSE '' END FROM bingo_cards WHERE sim = $1`,
	"envol":     `SELECT created_at, stake, payout, status, CASE WHEN cashed > 0 THEN '×' || to_char(cashed / 100.0, 'FM990.00') ELSE '' END FROM envol_bets WHERE sim = $1`,
	"trade":     `SELECT created_at, stake, payout, status, asset || ' · ' || dir FROM trade_bets WHERE sim = $1`,
	"loto":      `SELECT created_at, stake, payout, status, array_to_string(numbers, ' ') FROM loto_tickets WHERE sim = $1`,
	"bet225":    `SELECT created_at, stake, payout, status, 'cote ' || to_char(odds, 'FM990.00') FROM bets WHERE sim = $1 AND app = 'bet225'`,
	"parisfoot": `SELECT created_at, stake, payout, status, 'cote ' || to_char(odds, 'FM990.00') FROM bets WHERE sim = $1 AND app = 'parisfoot'`,
}

// HistRound is a round as the « Historique » shows it.
type HistRound struct {
	At     time.Time `json:"at"`
	Stake  int       `json:"stake"`
	Payout int       `json:"payout"`
	// Status: open, won, lost or tie.
	Status string `json:"status"`
	Detail string `json:"detail"`
}

// HistTotal is what was staked and got back over a while (the rounds settled).
type HistTotal struct {
	Rounds int `json:"rounds"`
	Staked int `json:"staked"`
	Back   int `json:"back"`
}

// historique: GET /sims/{id}/historique?jeu=&avant= — the last 50 rounds of a game (before `avant`, RFC 3339: the next page), today's and the week's totals.
func (h *Handler) historique(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	// An update the team opens from the admin (features).
	if !features.Default.Open(r.Context(), "historique") {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	src, ok := histSources[r.URL.Query().Get("jeu")]
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "jeu inconnu")
		return
	}
	before := time.Now().Add(time.Minute)
	if a := r.URL.Query().Get("avant"); a != "" {
		if t, err := time.Parse(time.RFC3339Nano, a); err == nil {
			before = t
		}
	}
	ctx := r.Context()
	rows, err := h.DB.Query(ctx, `SELECT * FROM (`+src+`) AS r(created_at, stake, payout, status, detail) WHERE created_at < $2 ORDER BY created_at DESC LIMIT 50`, id, before)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	out := []HistRound{}
	for rows.Next() {
		var x HistRound
		if err := rows.Scan(&x.At, &x.Stake, &x.Payout, &x.Status, &x.Detail); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		out = append(out, x)
	}
	rows.Close()
	// The totals: today (the day in Abidjan, UTC) and the last seven days, the rounds over.
	total := func(since time.Time) (HistTotal, error) {
		var t HistTotal
		err := h.DB.QueryRow(ctx, `SELECT count(*), coalesce(sum(stake), 0), coalesce(sum(payout), 0) FROM (`+src+`) AS r(created_at, stake, payout, status, detail) WHERE created_at >= $2 AND status <> 'open'`, id, since).Scan(&t.Rounds, &t.Staked, &t.Back)
		return t, err
	}
	now := time.Now().UTC()
	today, err := total(time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	week, err := total(now.AddDate(0, 0, -7))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"rounds": out, "today": today, "week": week})
}
