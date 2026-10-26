package sims

import (
	"errors"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The roulette: the cloth's limits, the money taken and paid back.
func TestRouletteSpin(t *testing.T) {
	s := adultSim(game.Families[0], "")
	s.Money = 100_000
	if _, _, err := s.spinRoulette(nil, noLuck()); !errors.Is(err, errNoBets) {
		t.Errorf("no bet: %v", err)
	}
	if _, _, err := s.spinRoulette([]game.RouletteBet{{Kind: "rouge", Stake: 3000}, {Kind: "noir", Stake: 3000}}, noLuck()); !errors.Is(err, errTooMuchCloth) {
		t.Errorf("6 000 on the cloth: %v", err)
	}
	before := s.Money
	out, _, err := s.spinRoulette([]game.RouletteBet{{Kind: "rouge", Stake: 1000}, {Kind: "plein", Number: 7, Stake: 100}}, noLuck())
	if err != nil {
		t.Fatal(err)
	}
	data := out.Data.(map[string]any)
	n := data["number"].(int)
	want := game.RoulettePays(game.RouletteBet{Kind: "rouge", Stake: 1000}, n) + game.RoulettePays(game.RouletteBet{Kind: "plein", Number: 7, Stake: 100}, n) - 1100
	if s.Money-before != want || out.Money != want {
		t.Errorf("the %d: money %+d, outcome %+d, want %+d", n, s.Money-before, out.Money, want)
	}
}

// Le 21: one hand at a time, the stake taken at the deal and on a double, paid at the end.
func TestBlackjackHand(t *testing.T) {
	s := adultSim(game.Families[0], "")
	s.Money = 100_000
	if _, _, _, err := s.playBlackjack(nil, "tirer", 0, noLuck()); !errors.Is(err, errNoHand) {
		t.Errorf("a card with no hand: %v", err)
	}
	if _, _, _, err := s.playBlackjack(nil, "distribuer", 50, noLuck()); !errors.Is(err, errBJStake) {
		t.Errorf("50 at the table: %v", err)
	}
	if _, _, _, err := s.playBlackjack(nil, "distribuer", 6000, noLuck()); !errors.Is(err, errBJStake) {
		t.Errorf("6 000 at the table: %v", err)
	}
	rng := noLuck()
	for range 50 {
		before := s.Money
		_, _, hand, err := s.playBlackjack(nil, "distribuer", 1000, rng)
		if err != nil {
			t.Fatal(err)
		}
		if !hand.Done {
			if _, _, _, err := s.playBlackjack(hand, "distribuer", 1000, rng); !errors.Is(err, errHandOpen) {
				t.Errorf("a second hand: %v", err)
			}
			if _, _, _, err := s.playBlackjack(hand, "doubler", 0, rng); err != nil {
				t.Fatal(err)
			}
		}
		if !hand.Done || s.Money-before != hand.Paid-hand.Stake {
			t.Fatalf("hand %+v: money %+d", hand.View(), s.Money-before)
		}
	}
}

// A ticket: its price taken, what it wins paid at once.
func TestScratchTicket(t *testing.T) {
	s := adultSim(game.Families[0], "")
	s.Money = 50_000
	if _, _, err := s.buyScratch("loto", noLuck()); !errors.Is(err, errTicket) {
		t.Errorf("unknown ticket: %v", err)
	}
	rng := noLuck()
	for range 40 {
		before := s.Money
		out, _, err := s.buyScratch("akwaba", rng)
		if err != nil {
			t.Fatal(err)
		}
		prize := out.Data.(map[string]any)["prize"].(int)
		if s.Money-before != prize-500 {
			t.Fatalf("money %+d for a prize of %d", s.Money-before, prize)
		}
	}
}
