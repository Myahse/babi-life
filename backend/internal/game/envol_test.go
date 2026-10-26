package game

import (
	"math"
	"testing"
)

// Whatever one aims for, L'Envol gives back about 95 for 100 staked; a plane
// flies off at once now and then; never past EnvolMax; always the same for a round.
func TestEnvolCrash(t *testing.T) {
	const N = 200_000
	at := map[float64]int{}
	targets := []float64{1.5, 2, 5, 10, 50}
	instant := 0
	for n := int64(0); n < N; n++ {
		c := EnvolCrash(n, 0)
		if c < 1 || c > EnvolMax {
			t.Fatalf("round %d flies off at %.2f", n, c)
		}
		if c < 1.01 {
			instant++
		}
		for _, x := range targets {
			if c >= x {
				at[x]++
			}
		}
	}
	for _, x := range targets {
		if k := x * float64(at[x]) / N; math.Abs(k-EnvolReturn) > 0.03 {
			t.Errorf("cashing in at ×%.1f gives back %.3f", x, k)
		}
	}
	if f := float64(instant) / N; f < 0.03 || f > 0.08 {
		t.Errorf("%.1f %% of planes fly off at once", f*100)
	}
	if EnvolCrash(7, 0) != EnvolCrash(7, 0) {
		t.Error("a round's plane changes")
	}
}

// The plane climbs from ×1 and flies off within the round.
func TestEnvolFlight(t *testing.T) {
	if EnvolAt(0) != 1 || EnvolAt(-5) != 1 {
		t.Error("before take-off")
	}
	if m := EnvolAt(int64(math.Log(2) / envolRate * 1000)); m < 1.98 || m > 2 {
		t.Errorf("×2 at its time: %.2f", m)
	}
	for n := int64(100); n < 2100; n++ {
		took, flown := EnvolTakeoff(n), EnvolFlown(n, 0)
		if flown < took || flown-took > EnvolMaxFlight*1000+1 || flown > (n+1)*EnvolPeriod*1000 {
			t.Fatalf("round %d: off at %d, flies off at %d", n, took, flown)
		}
		if m := EnvolAt(flown - took); m+0.011 < EnvolCrash(n, 0) {
			t.Fatalf("round %d: ×%.2f when it flies off at ×%.2f", n, m, EnvolCrash(n, 0))
		}
	}
}

// Babi Trade's prices walk at random: as many up as down, whatever the length,
// so a right call paying TradePays gives back about 92,5 for 100.
func TestTradePrices(t *testing.T) {
	for _, a := range TradeAssets {
		up, down := 0, 0
		for i := int64(0); i < 20_000; i++ {
			t0 := 1_800_000_000 + i*37
			for _, d := range TradeSecs {
				p0, p1 := TradePrice(a, t0), TradePrice(a, t0+int64(d))
				switch {
				case p1 > p0:
					up++
				case p1 < p0:
					down++
				}
			}
		}
		if k := float64(up) / float64(up+down); k < 0.48 || k > 0.52 {
			t.Errorf("%s goes up %.3f of the time", a.ID, k)
		}
		// A second's move stays small (within an hour).
		p0, p1 := TradePrice(a, 1_800_000_100), TradePrice(a, 1_800_000_101)
		if math.Abs(math.Log(p1/p0)) > 10*a.Vol || TradePrice(a, 1_800_000_100) != p0 {
			t.Errorf("%s jumps or changes: %.2f → %.2f", a.ID, p0, p1)
		}
	}
	if w, tie := TradeWins("hausse", 10, 11); !w || tie {
		t.Error("up, and it went up")
	}
	if w, tie := TradeWins("baisse", 10, 11); w || tie {
		t.Error("down, and it went up")
	}
	if _, tie := TradeWins("baisse", 10, 10); !tie {
		t.Error("no move: a tie")
	}
}

// A call ends in its session: never on the next one's opening price.
func TestTradeSession(t *testing.T) {
	h := int64(480_000) * 3600
	if TradeCloses(h) != h+3600 || TradeCloses(h+3599) != h+3600 {
		t.Errorf("closes: %d %d", TradeCloses(h), TradeCloses(h+3599))
	}
	if !TradeFits(h, 120) || !TradeFits(h+3600-121, 120) || TradeFits(h+3600-120, 120) || TradeFits(h+3599, 30) {
		t.Error("a call over the close")
	}
}
