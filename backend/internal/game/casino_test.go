package game

import (
	"math/rand/v2"
	"testing"
)

// Every bet of the roulette gives back 36 for 37 staked: the zero is the house's.
func TestRouletteReturn(t *testing.T) {
	bets := []RouletteBet{{Kind: "plein", Number: 17}, {Kind: "plein", Number: 0}, {Kind: "rouge"}, {Kind: "noir"}, {Kind: "pair"}, {Kind: "impair"}, {Kind: "manque"}, {Kind: "passe"}, {Kind: "douzaine", Number: 2}, {Kind: "colonne", Number: 3},
		{Kind: "cheval", Numbers: []int{17, 20}}, {Kind: "cheval", Numbers: []int{0, 2}}, {Kind: "transversale", Numbers: []int{34, 35, 36}}, {Kind: "transversale", Numbers: []int{2, 0, 3}},
		{Kind: "carre", Numbers: []int{25, 26, 28, 29}}, {Kind: "carre", Numbers: []int{0, 1, 2, 3}}, {Kind: "sixain", Numbers: []int{1, 2, 3, 4, 5, 6}}}
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
	for _, b := range []RouletteBet{{Kind: "plein", Number: 37, Stake: 100}, {Kind: "douzaine", Number: 4, Stake: 100}, {Kind: "rouge", Stake: 50}, {Kind: "noir", Stake: 6000}, {Kind: "cheval", Stake: 100},
		{Kind: "cheval", Numbers: []int{3, 4}, Stake: 100}, {Kind: "carre", Numbers: []int{3, 4, 6, 7}, Stake: 100}, {Kind: "sixain", Numbers: []int{2, 3, 4, 5, 6, 7}, Stake: 100}, {Kind: "transversale", Numbers: []int{0, 1, 3}, Stake: 100}} {
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
	staked, back, splits, insured := 0, 0, 0, 0
	for i := range 200_000 {
		h := DealBlackjack(100, rng)
		for !h.Done {
			// The insurance: never (as the basic strategy says), but taken on one round in ten to check it pays.
			if h.Offer {
				if i%10 == 0 {
					insured++
					_ = h.Play("assurance")
				} else {
					_ = h.Play("non")
				}
				continue
			}
			cards := h.Hands[h.At].Cards
			p, soft := HandTotal(cards)
			up := CardPoints(h.Dealer[0])
			if up == 1 {
				up = 11
			}
			switch {
			case h.CanSplit() && (cards[0]%13 == 0 || cards[0]%13 == 7):
				splits++
				_ = h.Play("separer")
			case len(cards) == 2 && (p == 10 || p == 11) && up < 10:
				_ = h.Play("doubler")
			case p >= 17 && !(soft && p == 17), p >= 13 && up <= 6, p == 12 && up >= 4 && up <= 6:
				_ = h.Play("rester")
			default:
				_ = h.Play("tirer")
			}
		}
		staked += h.Staked()
		back += h.Paid
		if h.Paid > 3*h.Staked() {
			t.Fatalf("paid %d for %d staked: %+v", h.Paid, h.Staked(), h.View())
		}
	}
	if splits < 1000 || insured < 300 {
		t.Errorf("%d splits, %d insurances", splits, insured)
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
	// A round saved before the split came in reads as one hand.
	old := &BlackjackHand{Stake: 200, Player: []int{0, 9, 4}, Dealer: []int{5, 6}, Doubled: true, Done: true, Result: "gagne", Paid: 400}
	if v := old.View(); len(v.Hands) != 1 || v.Hands[0].Stake != 200 || v.Staked != 200 || v.Total != 16 {
		t.Errorf("an old round: %+v", v)
	}
}

// Split and insurance: what they cost, when they're open.
func TestBlackjackSplit(t *testing.T) {
	h := &BlackjackHand{Stake: 100, Hands: []BJHand{{Cards: []int{7, 20}, Stake: 100}}, Dealer: []int{4, 9}, Shoe: []int{1, 2, 3, 4, 5, 6, 7, 8}}
	if !h.CanSplit() || h.Cost("separer") != 100 {
		t.Fatal("a pair of 8 to split")
	}
	if err := h.Play("separer"); err != nil || len(h.Hands) != 2 || h.Staked() != 200 {
		t.Fatalf("split: %v %+v", err, h.Hands)
	}
	if h.CanSplit() || h.Play("separer") == nil {
		t.Error("a second split")
	}
	_ = h.Play("rester")
	if h.At != 1 || h.Done {
		t.Fatalf("on to the second hand: %+v", h)
	}
	_ = h.Play("rester")
	if !h.Done {
		t.Error("the round over after the second hand")
	}
	ins := &BlackjackHand{Stake: 100, Hands: []BJHand{{Cards: []int{4, 5}, Stake: 100}}, Dealer: []int{0, 12}, Offer: true}
	if ins.Play("tirer") == nil {
		t.Error("a card before answering the insurance")
	}
	if err := ins.Play("assurance"); err != nil || !ins.Done || ins.Paid != 150 || ins.Staked() != 150 {
		t.Errorf("insured against a blackjack: %v paid %d of %d", err, ins.Paid, ins.Staked())
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
