package game

import (
	"math"
	"math/rand/v2"
	"testing"
)

// Untouched, every game pays as it always did; at a rate, each gives back about that rate.
func TestScaled(t *testing.T) {
	if Scaled(1000, 0, 0.89) != 1000 || Scaled(1000, 0.89, 0.89) != 1000 {
		t.Fatal("untouched must pay as before")
	}
	if got := Scaled(1000, 0.8, 0.9); got != 888 {
		t.Fatalf("1000 at 0.80 of 0.90: %d", got)
	}
}

// The roulette's commission brings every kind of bet to the rate.
func TestRouletteCommission(t *testing.T) {
	for _, rate := range []float64{0.7, 0.85, 0.95} {
		for _, times := range []int{1, 2, 5, 8, 11, 17, 35} {
			c := RouletteCommission(rate, times)
			p := float64(36/(times+1)) / 37
			back := p * (1 + float64(times)*(1-c))
			if math.Abs(back-rate) > 0.002 {
				t.Errorf("rate %.2f, %d to 1: commission %.3f gives back %.4f", rate, times, c, back)
			}
		}
	}
	if RouletteCommission(0, 35) != 0 || RouletteCommission(RouletteNatural, 1) != 0 {
		t.Error("untouched (or at the roulette's own), no commission")
	}
}

// Le 21's commission on the net winnings brings it near the rate (played by the basic strategy).
func TestCommission21(t *testing.T) {
	for _, rate := range []float64{0.75, 0.9} {
		c := Commission21(rate)
		rng := rand.New(rand.NewPCG(3, 4))
		staked, back := 0, 0
		for range 100_000 {
			h := DealBlackjack(100, rng)
			for !h.Done {
				if h.Offer {
					_ = h.Play("non")
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
					_ = h.Play("separer")
				case len(cards) == 2 && (p == 10 || p == 11) && up < 10:
					_ = h.Play("doubler")
				case p >= 17 && !(soft && p == 17), p >= 13 && up <= 6, p == 12 && up >= 4 && up <= 6:
					_ = h.Play("rester")
				default:
					_ = h.Play("tirer")
				}
			}
			paid := h.Paid
			if net := paid - h.Staked(); net > 0 {
				paid -= int(math.Floor(float64(net) * c))
			}
			staked += h.Staked()
			back += paid
		}
		if k := float64(back) / float64(staked); math.Abs(k-rate) > 0.015 {
			t.Errorf("le 21 at %.2f gives back %.4f (commission %.3f)", rate, k, c)
		}
	}
}

// The tickets at a rate: their printed odds, prizes scaled.
func TestScratchAt(t *testing.T) {
	for _, tk := range ScratchTickets {
		if ScratchAt(tk, 0).Prizes[0] != tk.Prizes[0] {
			t.Fatal("untouched must print as before")
		}
		for _, rate := range []float64{0.7, 0.9} {
			if k := ScratchReturn(ScratchAt(tk, rate)); math.Abs(k-rate) > 0.01 {
				t.Errorf("%s at %.2f gives back %.4f", tk.ID, rate, k)
			}
		}
	}
}

// L'Envol at a rate: P(≥ x) = rate / x.
func TestEnvolAtRate(t *testing.T) {
	for _, rate := range []float64{0.8, 0.95} {
		over := 0
		const n = 100_000
		for i := int64(1); i <= n; i++ {
			if EnvolCrash(i, rate) >= 2 {
				over++
			}
		}
		if p := float64(over) / n; math.Abs(p-rate/2) > 0.01 {
			t.Errorf("rate %.2f: ×2 reached %.3f of the time, want %.3f", rate, p, rate/2)
		}
	}
}
