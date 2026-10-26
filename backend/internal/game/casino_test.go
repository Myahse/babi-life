package game

import (
	"math/rand/v2"
	"testing"
)

// Every bet of the roulette gives back 36 for 37 staked: the zero is the house's.
func TestRouletteReturn(t *testing.T) {
	bets := []RouletteBet{{Kind: "plein", Number: 17}, {Kind: "plein", Number: 0}, {Kind: "rouge"}, {Kind: "noir"}, {Kind: "pair"}, {Kind: "impair"}, {Kind: "manque"}, {Kind: "passe"}, {Kind: "douzaine", Number: 2}, {Kind: "colonne", Number: 3}}
	for _, b := range bets {
		b.Stake = 100
		if err := RouletteCheck(b); err != nil {
			t.Fatalf("%+v: %v", b, err)
		}
		back := 0
		for n := 0; n <= 36; n++ {
			back += RoulettePays(b, n)
		}
		if back != 3600 {
			t.Errorf("%s %d: %d back over the 37 numbers for 3 700 staked, want 3 600", b.Kind, b.Number, back)
		}
	}
	if RouletteColour(0) != "vert" || RouletteColour(32) != "rouge" || RouletteColour(15) != "noir" {
		t.Error("the wheel's colours")
	}
	for _, b := range []RouletteBet{{Kind: "plein", Number: 37, Stake: 100}, {Kind: "douzaine", Number: 4, Stake: 100}, {Kind: "rouge", Stake: 50}, {Kind: "noir", Stake: 6000}, {Kind: "cheval", Stake: 100}} {
		if RouletteCheck(b) == nil {
			t.Errorf("%+v accepted", b)
		}
	}
	if err := RouletteCheck(RouletteBet{Kind: "rouge", Stake: 750}); err != nil {
		t.Errorf("750 typed on rouge: %v", err)
	}
}

// Le 21 played sensibly gives back a little less than is staked; the hands are counted right.
func TestBlackjack(t *testing.T) {
	if tot, soft := HandTotal([]int{0, 12}); tot != 21 || !soft || !IsBlackjack([]int{0, 12}) {
		t.Errorf("as + roi: %d %v", tot, soft)
	}
	if tot, _ := HandTotal([]int{0, 0, 8}); tot != 21 {
		t.Errorf("as, as, 9: %d", tot)
	}
	if tot, soft := HandTotal([]int{0, 5, 8}); tot != 16 || soft {
		t.Errorf("as, 6, 9: %d %v", tot, soft)
	}
	rng := rand.New(rand.NewPCG(5, 8))
	staked, back := 0, 0
	for range 200_000 {
		h := DealBlackjack(100, rng)
		for !h.Done {
			p, soft := HandTotal(h.Player)
			up := CardPoints(h.Dealer[0])
			if up == 1 {
				up = 11
			}
			switch {
			case len(h.Player) == 2 && (p == 10 || p == 11) && up < 10:
				_ = h.Play("doubler")
			case p >= 17 && !(soft && p == 17), p >= 13 && up <= 6, p == 12 && up >= 4 && up <= 6:
				_ = h.Play("rester")
			default:
				_ = h.Play("tirer")
			}
		}
		staked += h.Stake
		back += h.Paid
	}
	k := float64(back) / float64(staked)
	t.Logf("le 21 gives back %.4f", k)
	if k < 0.9 || k > 1 {
		t.Errorf("le 21 gives back %.3f for 1 staked", k)
	}
	h := DealBlackjack(100, rand.New(rand.NewPCG(1, 1)))
	if v := h.View(); !h.Done && len(v.Dealer) != 1 {
		t.Error("the dealer's hidden card shown")
	}
}

// The tickets give back about two thirds of their price, one in three or so wins, and their cells say what they win.
func TestScratch(t *testing.T) {
	rng := rand.New(rand.NewPCG(2, 3))
	for _, tk := range ScratchTickets {
		if k := ScratchReturn(tk); k < 0.55 || k > 0.72 {
			t.Errorf("%s gives back %.3f for 1 paid", tk.ID, k)
		}
		if w := ScratchWinChance(tk); w < 0.25 || w > 0.4 {
			t.Errorf("%s wins %.0f %% of the time", tk.ID, w*100)
		}
		for range 5000 {
			grid, prize := Scratch(tk, rng)
			count := map[int]int{}
			for _, a := range grid {
				count[a]++
			}
			threes := 0
			for a, n := range count {
				if n >= 3 {
					threes++
					if n != 3 || a != prize {
						t.Fatalf("%s: %v pays %d", tk.ID, grid, prize)
					}
				}
			}
			if (prize > 0) != (threes == 1) || threes > 1 {
				t.Fatalf("%s: %v pays %d", tk.ID, grid, prize)
			}
		}
	}
}
