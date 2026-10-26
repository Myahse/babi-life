package sims

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Loto Chance (game/loto.go), at the street kiosks (world3d/open/stalls.tsx,
// kind « loto »): a ticket of 1 to 3 numbers on one of the next draws. The
// stake is paid at the kiosk; a winning ticket pays stake × LotoPays when its
// draw is past, with the bets (settle, below), on the Sim's next refresh.

var (
	errLotoKiosk   = errors.New("le loto se joue au kiosque, dans la rue")
	errLotoNumbers = errors.New("choisis de 1 à 3 numéros, de 1 à 90, sans doublon")
	errLotoDraw    = errors.New("ce tirage est passé : choisis le prochain")
	errLotoStake   = fmt.Errorf("mise entre %d et %d Djai", game.LotoMinStake, game.LotoMaxStake)
	errLotoTooMany = fmt.Errorf("%d tickets aujourd'hui, c'est assez : reviens demain", game.LotoPerDay)
)

// lotoDraws: yesterday's results, today's and tomorrow's draws.
func (h *Handler) lotoDraws(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, map[string]any{"now": time.Now().Unix(), "pays": game.LotoPays, "draws": game.LotoDraws(time.Now())})
}

// buyLoto: a ticket at the kiosk.
func (h *Handler) buyLoto(w http.ResponseWriter, r *http.Request) {
	// An update the team opens from the admin (features).
	if features.Default.BlocksKey(r.Context(), "loto") != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	var req struct {
		Kiosk   string `json:"kiosk"`
		Draw    int64  `json:"draw"`
		Numbers []int  `json:"numbers"`
		Stake   int    `json:"stake"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if !strings.HasPrefix(req.Kiosk, "loto:") {
			return game.Outcome{}, nil, errLotoKiosk
		}
		if s.stage().ID != game.StageAdulte {
			return game.Outcome{}, nil, errors.New("le loto, c'est à partir de 18 ans")
		}
		nums := slices.Clone(req.Numbers)
		slices.Sort(nums)
		if len(nums) < 1 || len(nums) > 3 || len(slices.Compact(slices.Clone(nums))) != len(nums) || nums[0] < 1 || nums[len(nums)-1] > 90 {
			return game.Outcome{}, nil, errLotoNumbers
		}
		d, ok := game.LotoDrawAt(req.Draw)
		now := time.Now().Unix()
		if !ok || d.At <= now || d.At > now+26*3600 {
			return game.Outcome{}, nil, errLotoDraw
		}
		if req.Stake < game.LotoMinStake || req.Stake > game.LotoMaxStake {
			return game.Outcome{}, nil, errLotoStake
		}
		if s.Money < req.Stake {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		var today int
		_ = tx.QueryRow(ctx, `SELECT count(*) FROM loto_tickets WHERE sim = $1 AND created_at > now() - interval '24 hours'`, s.ID).Scan(&today)
		if today >= game.LotoPerDay {
			return game.Outcome{}, nil, errLotoTooMany
		}
		if _, err := tx.Exec(ctx, `INSERT INTO loto_tickets (sim, draw, numbers, stake) VALUES ($1, $2, $3, $4)`, s.ID, d.ID, nums, req.Stake); err != nil {
			return game.Outcome{}, nil, err
		}
		s.Money -= req.Stake
		text := fmt.Sprintf("Ticket Loto Chance : %s au tirage « %s » de %s, %s Djai. Si ça sort : %s Djai !", joinNums(nums), d.Name, time.Unix(d.At, 0).UTC().Format("15h04"), money(req.Stake), money(req.Stake*game.LotoPays[len(nums)]))
		return game.Outcome{Text: text, Money: -req.Stake}, []Event{{Kind: "money", Text: text, Money: -req.Stake, GameTime: s.GameMinutes}}, nil
	})
}

func joinNums(n []int) string {
	s := make([]string, len(n))
	for i, x := range n {
		s[i] = fmt.Sprint(x)
	}
	return strings.Join(s, "-")
}

// myLoto: the Sim's last 20 tickets.
func (h *Handler) myLoto(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	rows, err := h.DB.Query(r.Context(), `SELECT id, draw, numbers, stake, status, payout FROM loto_tickets WHERE sim = $1 ORDER BY id DESC LIMIT 20`, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	out := []LotoView{}
	now := time.Now().Unix()
	for rows.Next() {
		var t LotoView
		var nums []int32
		if err := rows.Scan(&t.ID, &t.Draw, &nums, &t.Stake, &t.Status, &t.Payout); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		out = append(out, lotoView(t, nums, now))
	}
	httpx.JSON(w, http.StatusOK, out)
}

// dueSQL: whether the Sim ($1) has bets, loto tickets, bingo cards, Envol bets
// and Babi Trade calls due at $3 (Unix seconds); selected along with the Sim in mutateTx.
const dueSQL = `EXISTS(SELECT 1 FROM bets WHERE sim = $1 AND status = 'open' AND settles_at <= $3),
	EXISTS(SELECT 1 FROM loto_tickets WHERE sim = $1 AND status = 'open' AND draw <= $3),
	EXISTS(SELECT 1 FROM bingo_cards WHERE sim = $1 AND status = 'open' AND settles_at <= $3),
	EXISTS(SELECT 1 FROM envol_bets WHERE sim = $1 AND status = 'open' AND settles_at <= $3),
	EXISTS(SELECT 1 FROM trade_bets WHERE sim = $1 AND status = 'open' AND expiry_at <= $3)`

type dueTickets struct{ bets, tickets, bingo, envol, trade bool }

// settle: the bets, loto tickets and bingo cards whose matches or draw are over
// are won or lost; the winnings are paid. Run on every refresh of the Sim (mutateTx).
// Most refreshes have nothing due: mutateTx looks for both (dueSQL) as it
// reads the Sim, and neither is read here unless due.
func settle(ctx context.Context, tx pgx.Tx, s *Sim, due dueTickets) ([]Event, error) {
	now := time.Now().Unix()
	var events []Event
	if due.bets {
		var err error
		if events, err = settleBetsTx(ctx, tx, s); err != nil {
			return nil, err
		}
	}
	if due.bingo {
		won, err := settleBingo(ctx, tx, s, now)
		if err != nil {
			return nil, err
		}
		events = append(events, won...)
	}
	if due.envol {
		won, err := settleEnvol(ctx, tx, s, now)
		if err != nil {
			return nil, err
		}
		events = append(events, won...)
	}
	if due.trade {
		if err := settleTrade(ctx, tx, s, now); err != nil {
			return nil, err
		}
	}
	if !due.tickets {
		return events, nil
	}
	rows, err := tx.Query(ctx, `SELECT id, draw, numbers, stake FROM loto_tickets WHERE sim = $1 AND status = 'open' AND draw <= $2`, s.ID, now)
	if err != nil {
		return nil, err
	}
	type t struct {
		id, draw int64
		nums     []int32
		stake    int
	}
	var tickets []t
	for rows.Next() {
		var x t
		if err := rows.Scan(&x.id, &x.draw, &x.nums, &x.stake); err != nil {
			rows.Close()
			return nil, err
		}
		tickets = append(tickets, x)
	}
	rows.Close()
	for _, x := range tickets {
		picked := make([]int, len(x.nums))
		for i, n := range x.nums {
			picked[i] = int(n)
		}
		drawn := game.LotoNumbers(x.draw)
		name := ""
		if d, ok := game.LotoDrawAt(x.draw); ok {
			name = d.Name
		}
		if !game.LotoWins(picked, drawn) {
			if _, err := tx.Exec(ctx, `UPDATE loto_tickets SET status = 'lost' WHERE id = $1`, x.id); err != nil {
				return nil, err
			}
			events = append(events, Event{Kind: "money", Text: fmt.Sprintf("Loto « %s » : %s. Ton %s n'est pas sorti. La prochaine fois !", name, joinNums(drawn), joinNums(picked)), GameTime: s.GameMinutes})
			continue
		}
		pay := int(math.Min(float64(x.stake*game.LotoPays[len(picked)]), 50_000_000))
		if _, err := tx.Exec(ctx, `UPDATE loto_tickets SET status = 'won', payout = $2 WHERE id = $1`, x.id, pay); err != nil {
			return nil, err
		}
		s.Money += pay
		events = append(events, Event{Kind: "money", Text: fmt.Sprintf("Loto « %s » : %s. Ton %s est sorti ! +%s Djai !", name, joinNums(drawn), joinNums(picked), money(pay)), Money: pay, GameTime: s.GameMinutes})
	}
	return events, nil
}
