package sims

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/odds"
)

// Babi Trade (game/envol.go, web screens/casino/Trade.tsx): a call that a
// made-up price will be higher (hausse) or lower (baisse) at the end of 30 s,
// 1 or 2 min, inside the market's session (an hour). Taken at the price of the server's second, settled at the
// price of its last second (on the Sim's next refresh): right, TradePays the
// stake; the same price, the stake back; wrong, nothing. A game of chance:
// the prices are drawn, they tell nothing of what comes. The prices the app
// gets stop at the present second.

var (
	errTradeAsset = errors.New("ce cours n'existe pas")
	errTradeStake = fmt.Errorf("mise de %s à %s Djai", money(game.TradeStakes[0]), money(game.TradeStakes[len(game.TradeStakes)-1]))
	errTradeSecs  = errors.New("cette durée n'est pas proposée")
	errTradeDir   = errors.New("hausse ou baisse ?")
	errTradeOpen  = fmt.Errorf("%d paris ouverts au plus : attends qu'un se termine", game.TradeOpen)
	errTradeClose = errors.New("la séance ferme avant la fin de ce pari : prends une durée plus courte, ou attends la prochaine séance")
)

// tradeWindow: the seconds of price the app's chart shows.
const tradeWindow = 180

type tradeCall struct {
	ID         int64    `json:"id"`
	Asset      string   `json:"asset"`
	Dir        string   `json:"dir"`
	Stake      int      `json:"stake"`
	EntryAt    int64    `json:"entryAt"`
	EntryPrice float64  `json:"entryPrice"`
	ExpiryAt   int64    `json:"expiryAt"`
	ExitPrice  *float64 `json:"exitPrice,omitempty"`
	Status     string   `json:"status"`
	Payout     int      `json:"payout,omitempty"`
}

// tradeState: GET /sims/{id}/casino/trade?asset= — the last minutes of a price (to now), each price's last, the Sim's calls.
func (h *Handler) tradeState(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	a, ok := game.FindAsset(r.URL.Query().Get("asset"))
	if !ok {
		a = game.TradeAssets[0]
	}
	now := time.Now().Unix()
	prices := make([]float64, tradeWindow)
	for i := range prices {
		prices[i] = game.TradePrice(a, now-tradeWindow+1+int64(i))
	}
	last := map[string]float64{}
	for _, x := range game.TradeAssets {
		last[x.ID] = game.TradePrice(x, now)
	}
	rows, err := h.DB.Query(r.Context(), `
		SELECT id, asset, dir, stake, entry_at, entry_price, expiry_at, exit_price, status, payout FROM trade_bets
		WHERE sim = $1 AND (status = 'open' OR created_at > now() - interval '1 hour') ORDER BY id DESC LIMIT 12`, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	calls := []tradeCall{}
	for rows.Next() {
		var c tradeCall
		if err := rows.Scan(&c.ID, &c.Asset, &c.Dir, &c.Stake, &c.EntryAt, &c.EntryPrice, &c.ExpiryAt, &c.ExitPrice, &c.Status, &c.Payout); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		// Over but not yet settled (the next refresh does it): its end told already.
		if c.Status == "open" && c.ExpiryAt <= now {
			x, _ := game.FindAsset(c.Asset)
			exit := game.TradePrice(x, c.ExpiryAt)
			c.ExitPrice = &exit
		}
		calls = append(calls, c)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"now": now, "asset": a.ID, "from": now - tradeWindow + 1, "prices": prices, "last": last, "calls": calls, "closes": game.TradeCloses(now)})
}

// trade: POST /sims/{id}/casino/trade {asset, dir, stake, secs} — a call taken at this second's price.
func (h *Handler) trade(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Asset string `json:"asset"`
		Dir   string `json:"dir"`
		Stake int    `json:"stake"`
		Secs  int    `json:"secs"`
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
		a, err := tradeCheck(req.Asset, req.Dir, req.Stake, req.Secs)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if s.Money < req.Stake {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		var open int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM trade_bets WHERE sim = $1 AND status = 'open'`, s.ID).Scan(&open); err != nil {
			return game.Outcome{}, nil, err
		}
		if open >= game.TradeOpen {
			return game.Outcome{}, nil, errTradeOpen
		}
		at := time.Now().Unix()
		if !game.TradeFits(at, req.Secs) {
			return game.Outcome{}, nil, errTradeClose
		}
		price := game.TradePrice(a, at)
		var id int64
		if err := tx.QueryRow(ctx, `INSERT INTO trade_bets (sim, asset, dir, stake, entry_at, entry_price, expiry_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
			s.ID, a.ID, req.Dir, req.Stake, at, price, at+int64(req.Secs)).Scan(&id); err != nil {
			return game.Outcome{}, nil, err
		}
		s.Money -= req.Stake
		s.wallet().Use(s.today(), game.Casino)
		way := map[string]string{"hausse": "à la hausse", "baisse": "à la baisse"}[req.Dir]
		data := tradeCall{ID: id, Asset: a.ID, Dir: req.Dir, Stake: req.Stake, EntryAt: at, EntryPrice: price, ExpiryAt: at + int64(req.Secs), Status: "open"}
		return game.Outcome{Text: fmt.Sprintf("%s %s pris à %s, pour %d s.", a.Label, way, priceText(price), req.Secs), Money: -req.Stake, Data: data}, nil, nil
	})
}

// tradeCheck: the asset of a call the Sim may take, or why not.
func tradeCheck(asset, dir string, stake, secs int) (game.TradeAsset, error) {
	a, ok := game.FindAsset(asset)
	switch {
	case !ok:
		return a, errTradeAsset
	case dir != "hausse" && dir != "baisse":
		return a, errTradeDir
	case !game.StakeIn(stake, game.TradeStakes):
		return a, errTradeStake
	case !slices.Contains(game.TradeSecs, secs):
		return a, errTradeSecs
	}
	return a, nil
}

// settleTrade: the Sim's calls whose time is up: won, tie or lost, paid.
func settleTrade(ctx context.Context, tx pgx.Tx, s *Sim, now int64) error {
	rows, err := tx.Query(ctx, `SELECT id, asset, dir, stake, entry_price, entry_at, expiry_at FROM trade_bets WHERE sim = $1 AND status = 'open' AND expiry_at <= $2`, s.ID, now)
	if err != nil {
		return err
	}
	type call struct {
		id         int64
		asset, dir string
		stake      int
		entry      float64
		at, expiry int64
	}
	var calls []call
	for rows.Next() {
		var c call
		if err := rows.Scan(&c.id, &c.asset, &c.dir, &c.stake, &c.entry, &c.at, &c.expiry); err != nil {
			rows.Close()
			return err
		}
		calls = append(calls, c)
	}
	rows.Close()
	for _, c := range calls {
		a, ok := game.FindAsset(c.asset)
		if !ok {
			continue
		}
		exit := game.TradePrice(a, c.expiry)
		// At the rate of when the call was taken (odds).
		rate, _ := odds.Default.RateAt(game.OddsTrade, time.Unix(c.at, 0))
		pay, status := tradePayout(c.dir, c.stake, c.entry, exit, game.TradePaysAt(rate))
		if _, err := tx.Exec(ctx, `UPDATE trade_bets SET status = $2, exit_price = $3, payout = $4 WHERE id = $1`, c.id, status, exit, pay); err != nil {
			return err
		}
		s.Money += pay
	}
	return nil
}

// tradePayout: what a call gives back, and how it ended.
func tradePayout(dir string, stake int, entry, exit, pays float64) (int, string) {
	won, tie := game.TradeWins(dir, entry, exit)
	switch {
	case tie:
		return stake, "tie"
	case won:
		return int(math.Floor(float64(stake) * pays)), "won"
	}
	return 0, "lost"
}

// priceText: a price as it's written (1 812,40 F).
func priceText(p float64) string {
	whole := int(p)
	cents := int(math.Round((p - float64(whole)) * 100))
	if cents == 100 {
		whole, cents = whole+1, 0
	}
	return fmt.Sprintf("%s,%02d F", money(whole), cents)
}
