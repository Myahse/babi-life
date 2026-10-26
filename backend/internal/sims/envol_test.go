package sims

import (
	"errors"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// L'Envol: cashed in at the plane's multiplier, or at the target reached first; not before take-off, not once gone.
func TestEnvolCashAt(t *testing.T) {
	n := int64(1000)
	for game.EnvolCrash(n) < 3 {
		n++
	}
	took, flown := game.EnvolTakeoff(n), game.EnvolFlown(n)
	if _, err := envolCashAt(n, took-1, 0); !errors.Is(err, errEnvolWait) {
		t.Errorf("before take-off: %v", err)
	}
	if _, err := envolCashAt(n, flown, 0); !errors.Is(err, errEnvolGone) {
		t.Errorf("the plane gone: %v", err)
	}
	// ×2 is reached after ln 2 / rate seconds.
	at := took + 4_600
	m, err := envolCashAt(n, at, 0)
	if err != nil || m != game.EnvolAt(at-took) || m < 1.5 {
		t.Errorf("by hand at +4,6 s: ×%v, %v", m, err)
	}
	if m, _ := envolCashAt(n, flown-1, 1.2); m != 1.2 {
		t.Errorf("past its target ×1,2: ×%v", m)
	}
	if m, _ := envolCashAt(n, flown-1, 0); m > game.EnvolCrash(n) {
		t.Errorf("above where it flies off: ×%v > ×%v", m, game.EnvolCrash(n))
	}
	s := adultSim(game.Families[0], "")
	s.Money = 1000
	for _, c := range []struct {
		stake int
		auto  float64
		err   error
	}{{50, 0, errEnvolStake}, {6000, 0, errEnvolStake}, {100, 1, errEnvolAuto}, {100, 150, errEnvolAuto}, {2000, 0, game.ErrNotEnoughMoney}} {
		if _, err := s.envolStake(c.stake, c.auto); !errors.Is(err, c.err) {
			t.Errorf("stake %d auto %v: %v", c.stake, c.auto, err)
		}
	}
	if a, err := s.envolStake(350, 2.5); err != nil || a != 250 {
		t.Errorf("350 typed, at ×2,5: %d, %v", a, err)
	}
	if times(2.5) != "2,50" || times(100) != "100,00" {
		t.Errorf("times: %s %s", times(2.5), times(100))
	}
}

// Babi Trade: what is offered, and what a call pays back.
func TestTradeCall(t *testing.T) {
	for _, c := range []struct {
		asset, dir  string
		stake, secs int
		err         error
	}{{"bitcoin", "hausse", 100, 30, errTradeAsset}, {"or", "monte", 100, 30, errTradeDir}, {"or", "hausse", 50, 30, errTradeStake}, {"or", "hausse", 5001, 30, errTradeStake}, {"or", "baisse", 100, 45, errTradeSecs}} {
		if _, err := tradeCheck(c.asset, c.dir, c.stake, c.secs); !errors.Is(err, c.err) {
			t.Errorf("%+v: %v", c, err)
		}
	}
	if a, err := tradeCheck("cacao", "hausse", 1250, 60); err != nil || a.ID != "cacao" {
		t.Errorf("cacao: %v", err)
	}
	for _, c := range []struct {
		dir         string
		entry, exit float64
		pay         int
		status      string
	}{{"hausse", 100, 101, 1850, "won"}, {"hausse", 100, 99, 0, "lost"}, {"baisse", 100, 99, 1850, "won"}, {"baisse", 100, 100, 1000, "tie"}} {
		if pay, status := tradePayout(c.dir, 1000, c.entry, c.exit); pay != c.pay || status != c.status {
			t.Errorf("%s %v→%v: %d %s", c.dir, c.entry, c.exit, pay, status)
		}
	}
	if p := priceText(1812.4); p != "1 812,40 F" {
		t.Errorf("price: %q", p)
	}
}
