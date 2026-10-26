package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/rand/v2"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/odds"
)

// Babi Casino (game/casino.go, web screens/CasinoApp.tsx): the roulette, le
// 21 and the tickets à gratter, in the phone. Every round is drawn here
// (seeded from the system's own randomness: none can be foreseen), paid at
// once, counted in the day's rounds (game.Casino). Adults only (the Sim
// grown up, the account 18 or over), the game's money only. A big win goes
// in the journal; the rest is told in the app.

var (
	errCasinoMinor  = errors.New("le casino, c'est à partir de 18 ans")
	errNoBets       = fmt.Errorf("pose de 1 à %d mises", game.RouletteMaxBets)
	errTooMuchCloth = fmt.Errorf("%d Djai au plus sur le tapis à chaque tour", game.RouletteMaxTotal)
	errBJStake      = fmt.Errorf("à cette table, on mise de %s à %s Djai", money(game.BlackjackStakes[0]), money(game.BlackjackStakes[len(game.BlackjackStakes)-1]))
	errHandOpen     = errors.New("finis d'abord ta main en cours")
	errNoHand       = errors.New("pas de main en cours : distribue")
	errTicket       = errors.New("ticket inconnu")
)

// casinoRng: a round's draw, unforeseeable.
func casinoRng() *rand.Rand { return rand.New(rand.NewPCG(rand.Uint64(), rand.Uint64())) }

// casinoOpen: whether the Sim may play: the app, its age, the account's, the day's rounds.
func casinoOpen(ctx context.Context, tx pgx.Tx, s *Sim) error {
	if err := needApp(s, "casino"); err != nil {
		return err
	}
	if s.stage().ID != game.StageAdulte {
		return errCasinoMinor
	}
	if adult, err := accountAdult(ctx, tx); err != nil || !adult {
		return errNotAdult
	}
	if !s.wallet().Can(s.today(), game.Casino) {
		return game.ErrFull(game.Casino)
	}
	return nil
}

// bigWin: a win worth the journal (twenty times the stake, or 50 000 and more).
func bigWin(s *Sim, label string, staked, back int) []Event {
	if back < 20*staked && back < 50_000 {
		return nil
	}
	return []Event{{Kind: "money", Text: fmt.Sprintf("Babi Casino · %s : +%s Djai !", label, money(back)), Money: back - staked, GameTime: s.GameMinutes}}
}

/* ---------- La roulette ---------- */

// roulette: POST /sims/{id}/casino/roulette {bets} — the bets on the cloth, the wheel spun.
func (h *Handler) roulette(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Bets []game.RouletteBet `json:"bets"`
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
		out, events, err := s.spinRoulette(req.Bets, casinoRng())
		if err != nil {
			return out, events, err
		}
		staked := 0
		for _, b := range req.Bets {
			staked += b.Stake
		}
		d, _ := out.Data.(map[string]any)
		return out, events, recordRound(ctx, tx, s.ID, game.OddsRoulette, staked, staked+out.Money, fmt.Sprintf("le %v %v", d["number"], d["colour"]))
	})
}

func (s *Sim) spinRoulette(bets []game.RouletteBet, rng *rand.Rand) (game.Outcome, []Event, error) {
	if len(bets) == 0 || len(bets) > game.RouletteMaxBets {
		return game.Outcome{}, nil, errNoBets
	}
	total := 0
	for _, b := range bets {
		if err := game.RouletteCheck(b); err != nil {
			return game.Outcome{}, nil, err
		}
		total += b.Stake
	}
	if total > game.RouletteMaxTotal {
		return game.Outcome{}, nil, errTooMuchCloth
	}
	if s.Money < total {
		return game.Outcome{}, nil, game.ErrNotEnoughMoney
	}
	s.wallet().Use(s.today(), game.Casino)
	n := game.SpinRoulette(rng)
	back, kept := 0, 0
	wins := make([]int, len(bets))
	// The classic payouts; at a rate the team set (odds), the house's commission on each winning bet's net winnings.
	rate, _ := odds.Default.Now(game.OddsRoulette)
	for i, b := range bets {
		wins[i] = game.RoulettePays(b, n)
		if net := wins[i] - b.Stake; wins[i] > 0 && net > 0 {
			k := int(math.Floor(float64(net) * game.RouletteCommission(rate, net/b.Stake)))
			wins[i] -= k
			kept += k
		}
		back += wins[i]
	}
	s.Money += back - total
	colour := game.RouletteColour(n)
	text := fmt.Sprintf("Le %d %s. Rien pour toi ce tour-ci.", n, colour)
	if back > 0 {
		text = fmt.Sprintf("Le %d %s ! Tu récupères %s Djai.", n, colour, money(back))
	}
	if kept > 0 {
		text += fmt.Sprintf(" (Commission de la maison : %s Djai.)", money(kept))
	}
	data := map[string]any{"number": n, "colour": colour, "wins": wins, "back": back, "commission": kept}
	return game.Outcome{Text: text, Money: back - total, Data: data}, bigWin(s, fmt.Sprintf("roulette, le %d", n), total, back), nil
}

/* ---------- Le 21 ---------- */

// blackjackHand: the hand the Sim is playing, if any.
func blackjackHand(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, sim string) (*game.BlackjackHand, error) {
	var raw []byte
	err := q.QueryRow(ctx, `SELECT hand FROM blackjack_hands WHERE sim = $1`, sim).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var hand game.BlackjackHand
	if err := json.Unmarshal(raw, &hand); err != nil {
		return nil, err
	}
	hand.Normalize()
	return &hand, nil
}

// blackjackState: GET /sims/{id}/casino/21 — the hand going on (or the last one), as the player sees it.
func (h *Handler) blackjackState(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	hand, err := blackjackHand(r.Context(), h.DB, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if hand == nil {
		httpx.JSON(w, http.StatusOK, map[string]any{"hand": nil})
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"hand": hand.View()})
}

// blackjack: POST /sims/{id}/casino/21 {move, stake} — distribuer (a new hand for the stake), tirer, rester,
// doubler, separer (a pair), assurance or non (the dealer showing an ace).
func (h *Handler) blackjack(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Move  string `json:"move"`
		Stake int    `json:"stake"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		hand, err := blackjackHand(ctx, tx, s.ID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if req.Move == "distribuer" {
			// A new hand: open like any round of the casino; the one before must be over.
			if err := casinoOpen(ctx, tx, s); err != nil {
				return game.Outcome{}, nil, err
			}
		} else if err := needApp(s, "casino"); err != nil {
			return game.Outcome{}, nil, err
		}
		out, events, next, err := s.playBlackjack(hand, req.Move, req.Stake, casinoRng())
		if err != nil {
			return game.Outcome{}, nil, err
		}
		// A hand just over: kept for the « Historique ».
		if next.Done && (hand == nil || !hand.Done || req.Move == "distribuer") {
			if err := recordRound(ctx, tx, s.ID, game.Odds21, next.Staked(), next.Paid, next.Result); err != nil {
				return game.Outcome{}, nil, err
			}
		}
		raw, _ := json.Marshal(next)
		if _, err := tx.Exec(ctx, `INSERT INTO blackjack_hands (sim, hand) VALUES ($1, $2) ON CONFLICT (sim) DO UPDATE SET hand = $2, updated_at = now()`, s.ID, raw); err != nil {
			return game.Outcome{}, nil, err
		}
		return out, events, nil
	})
}

// playBlackjack: a move on the hand (nil: none yet); the stake taken at the deal (and
// again on a double), what comes back paid when the hand is over.
func (s *Sim) playBlackjack(hand *game.BlackjackHand, move string, stake int, rng *rand.Rand) (game.Outcome, []Event, *game.BlackjackHand, error) {
	var taken int
	switch move {
	case "distribuer":
		if hand != nil && !hand.Done {
			return game.Outcome{}, nil, nil, errHandOpen
		}
		if !game.StakeIn(stake, game.BlackjackStakes) {
			return game.Outcome{}, nil, nil, errBJStake
		}
		if s.Money < stake {
			return game.Outcome{}, nil, nil, game.ErrNotEnoughMoney
		}
		s.wallet().Use(s.today(), game.Casino)
		hand = game.DealBlackjack(stake, rng)
		taken = stake
	default:
		if hand == nil || hand.Done {
			return game.Outcome{}, nil, nil, errNoHand
		}
		// A double, a split, the insurance: as much again on the table (or half, the insurance).
		taken = hand.Cost(move)
		if s.Money < taken {
			return game.Outcome{}, nil, nil, game.ErrNotEnoughMoney
		}
		if err := hand.Play(move); err != nil {
			return game.Outcome{}, nil, nil, err
		}
	}
	s.Money -= taken
	out := game.Outcome{Money: -taken}
	var events []Event
	kept := 0
	if hand.Done {
		// At a rate the team set (odds), the house's commission on the net winnings.
		if net := hand.Paid - hand.Staked(); net > 0 {
			rate, _ := odds.Default.Now(game.Odds21)
			kept = int(math.Floor(float64(net) * game.Commission21(rate)))
			hand.Paid -= kept
		}
		s.Money += hand.Paid
		out.Money += hand.Paid
		out.Text = map[string]string{
			"blackjack": fmt.Sprintf("Blackjack ! Tu gagnes %s Djai.", money(hand.Paid)),
			"gagne":     fmt.Sprintf("Gagné ! %s Djai pour toi.", money(hand.Paid)),
			"egalite":   "Égalité : ta mise revient.",
			"perdu":     "La banque gagne.",
			"saute":     "Plus de 21 : tu as sauté.",
		}[hand.Result]
		if kept > 0 {
			out.Text += fmt.Sprintf(" (Commission de la maison : %s Djai.)", money(kept))
		}
		events = bigWin(s, "le 21", hand.Staked(), hand.Paid)
	}
	out.Data = hand.View()
	return out, events, hand, nil
}

/* ---------- Les tickets à gratter ---------- */

// scratch: POST /sims/{id}/casino/grattage {ticket} — a ticket bought; what it wins is paid at
// once, the app shows its cells under the silver to scratch.
func (h *Handler) scratch(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Ticket string `json:"ticket"`
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
		out, events, err := s.buyScratch(req.Ticket, casinoRng())
		if err != nil {
			return out, events, err
		}
		t, _ := game.FindScratch(req.Ticket)
		return out, events, recordRound(ctx, tx, s.ID, game.OddsTickets, t.Price, t.Price+out.Money, t.Name)
	})
}

func (s *Sim) buyScratch(id string, rng *rand.Rand) (game.Outcome, []Event, error) {
	t, ok := game.FindScratch(id)
	if !ok {
		return game.Outcome{}, nil, errTicket
	}
	if s.Money < t.Price {
		return game.Outcome{}, nil, game.ErrNotEnoughMoney
	}
	s.wallet().Use(s.today(), game.Casino)
	// Its prizes at the casino's rate (odds: untouched, as printed).
	rate, _ := odds.Default.Now(game.OddsTickets)
	grid, prize := game.Scratch(game.ScratchAt(t, rate), rng)
	s.Money += prize - t.Price
	data := map[string]any{"ticket": t.ID, "cells": grid, "prize": prize}
	// The result is told by the app once the ticket is scratched: no text here.
	return game.Outcome{Money: prize - t.Price, Data: data}, bigWin(s, "ticket "+t.Name, t.Price, prize), nil
}
