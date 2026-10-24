package game

import (
	"math"
	"testing"
)

func TestPairing(t *testing.T) {
	p := Pairing(12345)
	if len(p) != 6 {
		t.Fatalf("%d matches", len(p))
	}
	seen := map[string]bool{}
	for _, m := range p {
		for _, c := range m {
			if seen[c] {
				t.Errorf("%s plays twice", c)
			}
			seen[c] = true
		}
	}
	if Pairing(12345)[0] != p[0] || Pairing(12346)[0] == p[0] && Pairing(12346)[1] == p[1] {
		t.Error("pairing not stable, or the same every round")
	}
}

func TestOddsMakeSense(t *testing.T) {
	o := OddsFor("Babi Sporting", "Bingerville Athletic", Margin)
	if o.Home >= o.Away {
		t.Errorf("the strong club at home pays more than the weak one: %+v", o)
	}
	// The margin: the implied probabilities add up to a little over 1.
	book := 1/o.Home + 1/o.Draw + 1/o.Away
	if book < 1.04 || book > 1.1 {
		t.Errorf("1N2 book %.3f", book)
	}
	if b := 1/o.Over + 1/o.Under; b < 1.04 || b > 1.1 {
		t.Errorf("goals book %.3f", b)
	}
}

func TestResultsFollowTheOdds(t *testing.T) {
	// Over many rounds, the favourites win about as often as their odds say.
	var expected, won float64
	n := 0
	for round := int64(1000); round < 3000; round++ {
		for i, pair := range Pairing(round) {
			m, _ := Match(round, i, roundStart(round)+3600, 0)
			if w, ok := Won(m, "1", roundStart(round)+3600); ok {
				expected += 1 / OddsFor(pair[0], pair[1], 0).Home
				if w {
					won++
				}
				n++
			}
		}
	}
	if math.Abs(won-expected)/float64(n) > 0.02 {
		t.Errorf("home wins %.0f, odds say %.0f over %d matches", won, expected, n)
	}
}

func TestNoScoreBeforeKickoff(t *testing.T) {
	r := int64(5000)
	m, _ := Match(r, 0, roundStart(r)+60, Margin)
	if m.Score != nil || m.Minute != 0 {
		t.Errorf("score before kickoff: %+v", m)
	}
	if _, ok := Won(m, "1", roundStart(r)+60); ok {
		t.Error("settled before the end")
	}
	end := roundStart(r) + (OpenMinutes+PlayMinutes)*60
	m, _ = Match(r, 0, end, Margin)
	if _, ok := Won(m, "1", end); !ok || m.Minute != 90 {
		t.Errorf("not over at the end: %+v", m)
	}
	// The secret changes the results.
	keep := BetSecret
	defer func() { BetSecret = keep }()
	differ := 0
	for i := 0; i < 50; i++ {
		BetSecret = keep
		a, _ := Match(r+int64(i), 0, end+int64(i)*900, 0)
		BetSecret = "another"
		b, _ := Match(r+int64(i), 0, end+int64(i)*900, 0)
		if *a.Score != *b.Score {
			differ++
		}
	}
	if differ < 10 {
		t.Errorf("the secret barely matters: %d/50", differ)
	}
}

func TestLeaguesDiffer(t *testing.T) {
	for r := int64(1000); r < 1010; r++ {
		a, b := PairingIn("babi", r), PairingIn("regions", r)
		for i := range a {
			for _, c := range b[i] {
				if c == a[i][0] || c == a[i][1] {
					t.Fatalf("round %d: the two leagues share a club (%v vs %v)", r, a[i], b[i])
				}
			}
		}
		if len(b) != 6 {
			t.Fatalf("regions: %d matches", len(b))
		}
		if PairingIn("babi", r)[0] != Pairing(r)[0] {
			t.Fatal("the Babi league must not change (bets already placed)")
		}
	}
}

func TestBasketAndTennis(t *testing.T) {
	r := RoundAt(1_800_000_000)
	end := roundStart(r) + (OpenMinutes+PlayMinutes)*60 + 1
	for _, league := range []string{"basket-babi", "basket-regions", "tennis-abidjan", "tennis-regions"} {
		sport := SportOf(league)
		for i := range PairingIn(league, r) {
			before, _ := MatchIn(league, r, i, roundStart(r), Margin)
			if before.Sport != sport || before.Score != nil || before.Odds.Draw != 0 || before.Odds.Home < 1 || before.Odds.Away < 1 {
				t.Fatalf("%s before kickoff: %+v", league, before)
			}
			m, _ := MatchIn(league, r, i, end, Margin)
			again, _ := MatchIn(league, r, i, end, Margin)
			if m.Score == nil || *m.Score != *again.Score {
				t.Fatalf("%s: no score, or not the same twice", league)
			}
			h, a := m.Score[0], m.Score[1]
			if h == a {
				t.Fatalf("%s: a draw %d-%d (none in %s)", league, h, a, sport)
			}
			won1, ok := Won(m, "1", end)
			won2, _ := Won(m, "2", end)
			if !ok || won1 == won2 {
				t.Fatalf("%s: exactly one side wins", league)
			}
			if _, ok := PickOdds(m.Odds, "N"); ok {
				t.Fatalf("%s: no draw to bet on", league)
			}
			switch sport {
			case SportBasket:
				if h < 40 || a < 40 || m.Line < 100 || len(m.Goals) != 4 {
					t.Fatalf("basketball: %d-%d line %.1f quarters %v", h, a, m.Line, m.Goals)
				}
			case SportTennis:
				if (h != 2 && a != 2) || h+a < 2 || h+a > 3 || len(m.Goals) != h+a {
					t.Fatalf("tennis: sets %d-%d %v", h, a, m.Goals)
				}
				three, _ := Won(m, "btsOui", end)
				if three != (h+a == 3) {
					t.Fatal("tennis: three sets")
				}
			}
		}
	}
}
