package sims

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Babi Bingo (game/bingo.go, web screens/BingoApp.tsx): four rooms whose
// draws follow one another all day, the same for every player. Cards are
// bought for a room's next draw; the app shows the balls as they come out
// and marks the cards; once its last ball is out, a card is settled with the
// bets and the loto (settle, loto.go) on the Sim's next refresh, paid its
// best prize. Adults only (the Sim grown up, the account 18 or over), the
// game's money only, BingoCardsPerDraw cards a draw, BingoPerDay a day.

var (
	errBingoGame  = errors.New("salle de bingo inconnue")
	errBingoStake = fmt.Errorf("une carte coûte de %s à %s Djai", money(game.BingoStakes[0]), money(game.BingoStakes[len(game.BingoStakes)-1]))
	errBingoCards = fmt.Errorf("de 1 à %d cartons par partie", game.BingoCardsPerDraw)
	errBingoMinor = errors.New("le bingo, c'est à partir de 18 ans")
)

// bingoCard: a card as the app shows it.
type bingoCard struct {
	ID      int64  `json:"id"`
	Game    string `json:"game"`
	Draw    int64  `json:"draw"`
	Numbers []int  `json:"numbers"`
	Stake   int    `json:"stake"`
	// Status: open (its draw to come or running), won or lost (its draw over: known
	// even before the card is settled and paid).
	Status string `json:"status"`
	Prize  string `json:"prize,omitempty"`
	Payout int    `json:"payout,omitempty"`
}

// bingoRoom: a room now: its draw (running, or just over), its balls out, the next one.
type bingoRoom struct {
	Game  string `json:"game"`
	Draw  int64  `json:"draw"`
	Start int64  `json:"start"` // Unix ms
	Balls []int  `json:"balls"`
	Over  bool   `json:"over"`
	Next  int64  `json:"next"`
	// NextAt: when the next draw starts (Unix ms); cards are bought for it.
	NextAt int64 `json:"nextAt"`
	// Players: the players with cards on the draw; Waiting: on the next one.
	Players int `json:"players"`
	Waiting int `json:"waiting"`
}

// bingoWinner: a card that won on a room's last draw over.
type bingoWinner struct {
	Name   string `json:"name"`
	Game   string `json:"game"`
	Prize  string `json:"prize"`
	Payout int    `json:"payout"`
	Mine   bool   `json:"mine,omitempty"`
}

// bingoState: GET /sims/{id}/bingo — the four rooms, the Sim's cards, the last winners.
func (h *Handler) bingoState(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	nowMs := time.Now().UnixMilli()
	now := nowMs / 1000
	rooms := make([]bingoRoom, len(game.BingoGames))
	// The last draw over in each room (the running one if it's over, else the one before): its winners.
	last := map[string]int64{}
	for i, g := range game.BingoGames {
		n, _ := g.DrawAt(now)
		out := g.Out(n, nowMs)
		balls := game.BingoBalls(g, n)[:out]
		over := now >= g.End(n)
		rooms[i] = bingoRoom{Game: g.ID, Draw: n, Start: g.Start(n) * 1000, Balls: balls, Over: over, Next: n + 1, NextAt: g.Start(n+1) * 1000}
		last[g.ID] = n - 1
		if over {
			last[g.ID] = n
		}
	}
	// How many play each draw.
	rows, err := h.DB.Query(ctx, `SELECT game, draw, count(DISTINCT sim) FROM bingo_cards WHERE created_at > now() - interval '20 minutes' GROUP BY game, draw`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	for rows.Next() {
		var g string
		var d int64
		var n int
		if err := rows.Scan(&g, &d, &n); err != nil {
			rows.Close()
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		for i := range rooms {
			switch {
			case rooms[i].Game == g && rooms[i].Draw == d:
				rooms[i].Players = n
			case rooms[i].Game == g && rooms[i].Next == d:
				rooms[i].Waiting = n
			}
		}
	}
	rows.Close()
	// The Sim's cards of these last minutes, and every card of each room's last draw over (its winners).
	mine := []bingoCard{}
	winners := []bingoWinner{}
	rows, err = h.DB.Query(ctx, `
		SELECT c.id, c.sim = $1, s.first_name, c.game, c.draw, c.numbers, c.stake
		FROM bingo_cards c JOIN sims s ON s.id = c.sim
		WHERE c.created_at > now() - interval '20 minutes' AND (c.sim = $1 OR (c.game, c.draw) IN (($2, $3), ($4, $5), ($6, $7), ($8, $9)))
		ORDER BY c.id LIMIT 2000`, id,
		game.Bingo75, last[game.Bingo75], game.Loto90, last[game.Loto90], game.Bingo80, last[game.Bingo80], game.Eclair, last[game.Eclair])
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	for rows.Next() {
		var c bingoCard
		var own bool
		var name string
		var nums []int32
		if err := rows.Scan(&c.ID, &own, &name, &c.Game, &c.Draw, &nums, &c.Stake); err != nil {
			rows.Close()
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		c.Numbers = ints(nums)
		g, ok := game.FindBingo(c.Game)
		if !ok {
			continue
		}
		c.Status = "open"
		if now >= g.End(c.Draw) {
			c.Status = "lost"
			if p, won := game.BingoBest(g, c.Numbers, game.BingoBalls(g, c.Draw)); won {
				c.Status, c.Prize, c.Payout = "won", p.Label, c.Stake*p.Times
			}
		}
		if own {
			mine = append(mine, c)
		}
		if c.Draw == last[c.Game] && c.Status == "won" {
			winners = append(winners, bingoWinner{Name: name, Game: c.Game, Prize: c.Prize, Payout: c.Payout, Mine: own})
		}
	}
	rows.Close()
	sort.SliceStable(winners, func(i, j int) bool { return winners[i].Payout > winners[j].Payout })
	if len(winners) > 12 {
		winners = winners[:12]
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"now": nowMs, "rooms": rooms, "mine": mine, "winners": winners})
}

// buyBingo: POST /sims/{id}/bingo {game, cards, stake} — cards for a room's next draw.
func (h *Handler) buyBingo(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Game  string `json:"game"`
		Cards int    `json:"cards"`
		Stake int    `json:"stake"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if err := needApp(s, "bingo"); err != nil {
			return game.Outcome{}, nil, err
		}
		if adult, err := accountAdult(ctx, tx); err != nil || !adult {
			return game.Outcome{}, nil, errNotAdult
		}
		g, ok := game.FindBingo(req.Game)
		if !ok {
			return game.Outcome{}, nil, errBingoGame
		}
		// The draw running (or just over): the cards are for the next one.
		n, _ := g.DrawAt(time.Now().Unix())
		var held int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM bingo_cards WHERE sim = $1 AND game = $2 AND draw = $3`, s.ID, g.ID, n+1).Scan(&held); err != nil {
			return game.Outcome{}, nil, err
		}
		// Seeded from the system's own randomness: no card can be foreseen.
		cards, err := s.bingoCards(g.ID, req.Cards, req.Stake, held, rand.New(rand.NewPCG(rand.Uint64(), rand.Uint64())))
		if err != nil {
			return game.Outcome{}, nil, err
		}
		for _, c := range cards {
			if _, err := tx.Exec(ctx, `INSERT INTO bingo_cards (sim, game, draw, numbers, stake, settles_at) VALUES ($1, $2, $3, $4, $5, $6)`, s.ID, g.ID, n+1, c, req.Stake, g.End(n+1)); err != nil {
				return game.Outcome{}, nil, err
			}
		}
		total := req.Stake * len(cards)
		carton := "carton"
		if len(cards) > 1 {
			carton += "s"
		}
		at := time.Unix(g.Start(n+1), 0).UTC().Format("15h04")
		return game.Outcome{Text: fmt.Sprintf("%d %s pour le %s de %s.", len(cards), carton, g.Name, at), Money: -total}, nil, nil
	})
}

// bingoCards: the cards the Sim buys (held: those it already has on the draw), paid and counted.
func (s *Sim) bingoCards(gameID string, n, stake, held int, rng *rand.Rand) ([][]int, error) {
	g, ok := game.FindBingo(gameID)
	switch {
	case !ok:
		return nil, errBingoGame
	case s.stage().ID != game.StageAdulte:
		return nil, errBingoMinor
	case !game.StakeIn(stake, game.BingoStakes):
		return nil, errBingoStake
	case n < 1 || held+n > game.BingoCardsPerDraw:
		return nil, errBingoCards
	case s.wallet().Got(s.today(), game.Bingo).Times+n > game.BingoPerDay:
		return nil, game.ErrFull(game.Bingo)
	case s.Money < n*stake:
		return nil, game.ErrNotEnoughMoney
	}
	out := make([][]int, n)
	for i := range out {
		out[i] = game.NewCard(g, rng)
		s.wallet().Use(s.today(), game.Bingo)
	}
	s.Money -= n * stake
	return out, nil
}

// settleBingo: the Sim's cards whose draw is over are won or lost; the winnings are paid.
func settleBingo(ctx context.Context, tx pgx.Tx, s *Sim, now int64) ([]Event, error) {
	rows, err := tx.Query(ctx, `SELECT id, game, draw, numbers, stake FROM bingo_cards WHERE sim = $1 AND status = 'open' AND settles_at <= $2`, s.ID, now)
	if err != nil {
		return nil, err
	}
	type card struct {
		id, draw int64
		game     string
		nums     []int32
		stake    int
	}
	var cards []card
	for rows.Next() {
		var c card
		if err := rows.Scan(&c.id, &c.game, &c.draw, &c.nums, &c.stake); err != nil {
			rows.Close()
			return nil, err
		}
		cards = append(cards, c)
	}
	rows.Close()
	var events []Event
	for _, c := range cards {
		g, ok := game.FindBingo(c.game)
		status, prize, pay := "lost", "", 0
		if ok {
			if p, won := game.BingoBest(g, ints(c.nums), game.BingoBalls(g, c.draw)); won {
				status, prize, pay = "won", p.Label, c.stake*p.Times
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE bingo_cards SET status = $2, prize = $3, payout = $4 WHERE id = $1`, c.id, status, prize, pay); err != nil {
			return nil, err
		}
		if pay > 0 {
			s.Money += pay
			at := time.Unix(g.Start(c.draw), 0).UTC().Format("15h04")
			events = append(events, Event{Kind: "money", Text: fmt.Sprintf("Babi Bingo · %s de %s : %s ! +%s Djai", g.Name, at, prize, money(pay)), Money: pay, GameTime: s.GameMinutes})
		}
	}
	return events, nil
}

func ints(n []int32) []int {
	out := make([]int, len(n))
	for i, x := range n {
		out[i] = int(x)
	}
	return out
}
