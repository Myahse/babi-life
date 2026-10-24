package game

import (
	"math/rand/v2"
	"testing"
)

func TestPurseLimits(t *testing.T) {
	p := NewPurse()
	day := int64(1000)
	// A source's own limit: what's asked beyond it isn't given.
	if got := p.Take(day, FromGig, 1500, false); got != 1500 {
		t.Fatalf("first gig: %d", got)
	}
	if got := p.Take(day, FromGig, 1500, false); got != Caps[FromGig].Djai-1500 {
		t.Fatalf("second gig, cut at the limit: %d", got)
	}
	if got := p.Take(day, FromGig, 1500, false); got != 0 || p.Left(day, FromGig, false) != 0 {
		t.Fatalf("third gig: %d", got)
	}
	// The next day starts afresh.
	if p.Left(day+1, FromGig, false) != Caps[FromGig].Djai {
		t.Error("a new day, a new limit")
	}
	// The Pass raises the limits in Djai by its share.
	if got := p.Left(day+1, FromGig, true); got != Caps[FromGig].Djai+Caps[FromGig].Djai/4 {
		t.Errorf("with the Pass: %d", got)
	}
	// Work is never cut, and counts in the day's total: once it's full, the others give nothing.
	if got := p.Take(day, FromWork, 50000, false); got != 50000 {
		t.Fatalf("a shift is paid in full: %d", got)
	}
	if got := p.Take(day, FromLuck, 500, false); got != 0 {
		t.Errorf("the day's total is reached: luck gives %d", got)
	}
	// What other players send isn't earned: the total doesn't stop it, its own limit does.
	if got := p.Take(day, FromPlayers, 5000, false); got != 5000 {
		t.Errorf("received: %d", got)
	}
	if p.Got(day, EarnedTotal).Djai != 50000+Caps[FromGig].Djai {
		t.Errorf("the total counts the shift and the gigs: %d", p.Got(day, EarnedTotal).Djai)
	}
	// One shift a day.
	if !p.Can(day, FromWork) {
		t.Fatal("no shift yet")
	}
	p.Use(day, FromWork)
	if p.Can(day, FromWork) || !p.Can(day+1, FromWork) {
		t.Error("one shift a day")
	}
	// What changed is what's saved, once.
	saved := map[Income]Tally{}
	for _, c := range p.Changes() {
		if c.Day == day {
			saved[c.Src] = c.Tally
		}
	}
	if saved[FromGig].Djai != Caps[FromGig].Djai || saved[FromWork].Times != 1 || saved[FromWork].Djai != 50000 {
		t.Errorf("changes: %+v", saved)
	}
	p.Saved()
	if len(p.Changes()) != 0 || p.Got(day, FromGig).Djai != Caps[FromGig].Djai {
		t.Error("saved: no change left, the tallies kept")
	}
}

// Every limit in Djai, together, stays at the day's total (half the smallest pack).
func TestDailyTotalIsHalfThePiece(t *testing.T) {
	if DailyTotal > 40_000/2 {
		t.Errorf("the day's total, %d, over half the smallest pack", DailyTotal)
	}
	p := NewPurse()
	all := 0
	for src := range Caps {
		if inTotal(src) && src != FromWork {
			all += p.Take(7, src, 1_000_000, false)
		}
	}
	if all != DailyTotal {
		t.Errorf("everything but work, as much as possible: %d, not the total %d", all, DailyTotal)
	}
}

// Money come by chance is rare: over many activities ended, what it brings is a few Djai each.
func TestWindfallsAreRare(t *testing.T) {
	rng := rand.New(rand.NewPCG(3, 4))
	a := Activity{Kind: "do"}
	n, gained, times := 200000, 0, 0
	for range n {
		if ev := a.Surprise(rng); ev != nil && ev.Money > 0 {
			gained += ev.Money
			times++
		}
	}
	share := float64(times) / float64(n)
	if share > 0.04 {
		t.Errorf("a money surprise after %.1f %% of activities", share*100)
	}
	if avg := float64(gained) / float64(n); avg > 25 {
		t.Errorf("%.0f Djai of luck per activity on average", avg)
	}
}

// The loto keeps the house's share on every kind of ticket: over time, it takes.
func TestLotoIsASink(t *testing.T) {
	choose := func(n, k int) float64 {
		r := 1.0
		for i := range k {
			r = r * float64(n-i) / float64(i+1)
		}
		return r
	}
	for k, pays := range LotoPays {
		p := choose(5, k) / choose(90, k)
		if ev := p * float64(pays); ev >= 1 {
			t.Errorf("%d numbers: %.2f back for 1 played", k, ev)
		}
	}
}

// Single bets keep the bookmaker's margin, on every sport and market: over
// thousands of matches, a Djai bet brings back less than a Djai.
func TestBetsAreASink(t *testing.T) {
	picks := map[string][]string{SportFoot: {"1", "N", "2", "plus", "moins", "btsOui", "btsNon"}, SportBasket: {"1", "2", "plus", "moins"}, SportTennis: {"1", "2", "btsOui", "btsNon"}}
	start := RoundAt(1_800_000_000)
	for _, league := range []string{"babi", "regions", "basket-babi", "basket-regions", "tennis-abidjan", "tennis-regions"} {
		sport := SportOf(league)
		staked, back := map[string]float64{}, map[string]float64{}
		// The near-certain picks alone (what a bettor who knows would choose): never more back than bet.
		var sureStaked, sureBack float64
		for r := start; r < start+1500; r++ {
			end := roundStart(r) + (OpenMinutes+PlayMinutes)*60 + 1
			for i := range PairingIn(league, r) {
				before, _ := MatchIn(league, r, i, roundStart(r), 0.06)
				after, _ := MatchIn(league, r, i, end, 0.06)
				for _, pick := range picks[sport] {
					o, ok := PickOdds(before.Odds, pick)
					if !ok {
						continue
					}
					staked[pick]++
					won, _ := Won(after, pick, end)
					if won {
						back[pick] += o
					}
					if o <= 1.1 {
						sureStaked++
						if won {
							sureBack += o
						}
					}
				}
			}
		}
		for pick, n := range staked {
			if ratio := back[pick] / n; ratio >= 1 {
				t.Errorf("%s, %q: %.3f back for 1 bet over %.0f bets", league, pick, ratio, n)
			}
		}
		if sureStaked > 0 && sureBack/sureStaked > 1 {
			t.Errorf("%s, the near-certain picks (odds 1,10 or less): %.3f back for 1 over %.0f bets", league, sureBack/sureStaked, sureStaked)
		}
	}
}
