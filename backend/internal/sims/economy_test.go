package sims

import (
	"fmt"
	"math"
	"math/rand/v2"
	"slices"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/shop"
)

// The economy as the player lives it (game/money.go, docs/economie.md): a
// casual hour a day pays a modest rent and food and not much more; a whole
// day of trying everything never brings more than half the smallest pack on
// top of the shift; the first week is playable from the family's money.

// A Monday, midnight, Abidjan time.
var monday = time.Date(2026, 10, 12, 0, 0, 0, 0, time.UTC)

// adultSim: a Sim of 18 who has just left its family's home, with what the family gave.
func adultSim(f game.Family, career string) Sim {
	at := monday
	s := Sim{FirstName: "Aya", Gender: "femme", City: "abidjan", Commune: "yopougon", HomeCity: "abidjan", HomeCommune: "yopougon",
		Housing: f.Leave, Money: f.Start, Family: f.ID, Career: career, Needs: game.FreshNeeds(),
		GameMinutes: game.MinuteOf(at), lastTick: at}
	s.BornAt = s.GameMinutes - game.MinutesToAge(18)
	return s
}

// session: the player back at `from`, playing until every step is done (each
// one started, played to its end), then putting the game away. What the
// steps paid, and the journal lines.
func session(t *testing.T, s *Sim, from time.Time, steps [][2]string) (earned int, ev []Event) {
	t.Helper()
	ev = append(ev, s.advance(from, noLuck())...)
	at := from
	for _, st := range steps {
		if _, err := s.interactAt(st[0], st[1]); err != nil {
			ev = append(ev, Event{Kind: "refused", Text: st[1] + " : " + err.Error()})
			continue
		}
		at = game.TimeOf(s.Activity.End).Add(time.Second)
		ev = append(ev, played(s, at)...)
	}
	paused := at
	s.pausedAt = &paused
	for _, e := range ev {
		if e.Kind != "bill" && e.Money > 0 {
			earned += e.Money
		}
	}
	return earned, ev
}

// A casual hour a day for a week, the first week out of the family home: a
// shift, a petit boulot, a garba. Rent paid on Saturday, never broke, and
// what's earned is about a modest rent and food (a studio and a garba a day).
func TestFirstWeek(t *testing.T) {
	studio, _ := game.FindHousing("studio")
	modest := studio.Rent + 7*500
	for _, id := range []string{"gnambro", "coule", "poignon"} {
		f, _ := game.FindFamily(id)
		s := adultSim(f, "commerce")
		total := 0
		for d := range 7 {
			earned, ev := session(t, &s, monday.AddDate(0, 0, d).Add(9*time.Hour), [][2]string{{"yop-marche", "work"}, {"yop-marche", "sell-goods"}, {"yop-maquis", "eat-garba"}})
			for _, e := range ev {
				if e.Kind == "refused" {
					t.Errorf("%s, day %d: %s", id, d+1, e.Text)
				}
			}
			total += earned
			if earned > game.DailyTotal {
				t.Errorf("%s, day %d: %d earned in an hour", id, d+1, earned)
			}
			if s.Money < 0 {
				t.Errorf("%s, day %d: broke (%d)", id, d+1, s.Money)
			}
		}
		t.Logf("%-8s start %6d, a week of casual hours: %6d earned (%d a day), money %6d, arrears %d", id, f.Start, total, total/7, s.Money, s.RentArrears)
		if s.RentArrears != 0 {
			t.Errorf("%s: rent unpaid after the first week: %d owed", id, s.RentArrears)
		}
		if r := float64(total) / float64(modest); r < 0.8 || r > 1.5 {
			t.Errorf("%s: a casual week earns %d, %.2f times a modest rent and food (%d)", id, total, r, modest)
		}
	}
}

// Every family's money pays the first rent and food with a couple of shifts
// of the worst-paid job.
func TestEveryFamilyPaysTheFirstRent(t *testing.T) {
	worst := math.MaxInt
	for _, c := range game.Careers {
		worst = min(worst, c.Levels[0].Pay)
	}
	for _, f := range game.Families {
		h, _ := game.FindHousing(f.Leave)
		if f.Start+2*worst < h.Rent+2*500 {
			t.Errorf("%s: %d and two shifts of %d don't pay the first rent (%d) and two meals", f.ID, f.Start, worst, h.Rent)
		}
	}
}

// A whole day trying everything, at the top of the best-paid job: the shift
// once, petits boulots until refused, a hundred people asked for money or a
// job, the gang's coup, the luck of every activity. What it brings: the shift
// and at most the day's total; the Pass a quarter more.
func TestGrinderDay(t *testing.T) {
	for _, pass := range []bool{false, true} {
		f, _ := game.FindFamily("poignon")
		s := adultSim(f, "droit")
		s.CareerLevel = 4
		s.Gang = "member"
		if pass {
			until := monday.AddDate(0, 1, 0)
			s.PassUntil = &until
		}
		shift := s.withSect(s.withPass(game.Careers[slices.IndexFunc(game.Careers, func(c game.Career) bool { return c.ID == "droit" })].Levels[4].Pay), "travail")
		start := s.Money
		day := monday.Add(8 * time.Hour)
		steps := [][2]string{{"yop-zone-industrielle", "work"}, {"yop-zone-industrielle", "work"}}
		for range 12 {
			steps = append(steps, [2]string{"yop-marche", "sell-goods"}, [2]string{"yop-koute", "preparer-attieke"}, [2]string{"yop-zone-industrielle", "read-ads"})
		}
		_, ev := session(t, &s, day, steps)
		refusedWork, refusedGig := 0, 0
		for _, e := range ev {
			if e.Kind == "refused" {
				switch {
				case e.Text == "work : "+game.Full(game.FromWork):
					refusedWork++
				case e.Text == "sell-goods : "+game.Full(game.FromGig) || e.Text == "preparer-attieke : "+game.Full(game.FromGig):
					refusedGig++
				}
			}
		}
		if refusedWork != 1 || refusedGig == 0 {
			t.Errorf("a second shift and the gigs past the limit are refused: %d, %d", refusedWork, refusedGig)
		}
		// A hundred people asked, a coup each hour.
		rng := rand.New(rand.NewPCG(9, 9))
		for i := range 100 {
			s.Activity = nil
			p := Passerby{ID: fmt.Sprintf("x%d", i), Name: "Koffi", Gender: "homme", Seed: i}
			_, _ = s.chat(p, []string{"djai", "boulot", "aide"}[i%3], "", true, rng)
		}
		for range 10 {
			s.Activity = nil
			_, _, _ = s.gangAction("coup", lucky())
		}
		s.Activity = nil
		got := s.Money - start
		limit := shift + game.DailyTotal
		if pass {
			limit = shift + game.DailyTotal + game.DailyTotal/4
		}
		t.Logf("pass %-5v: a day of everything: %6d earned (the shift %d, the rest %d); at most %d", pass, got, shift, got-shift, limit)
		if got > limit {
			t.Errorf("a grinder's day: %d, over the shift and the day's total (%d)", got, limit)
		}
		if biggest := shop.Packs[0].Djai; got-shift > biggest/2+biggest/8 {
			t.Errorf("past the shift, %d: more than half the smallest pack", got-shift)
		}
	}
}

// Going to work by oneself (the Boulot app's switch) all day long: one shift.
func TestAutoWorkOncePerDay(t *testing.T) {
	f, _ := game.FindFamily("poignon")
	s := adultSim(f, "commerce")
	s.AutoWork = true
	from := monday.Add(5 * time.Hour)
	s.lastTick = from
	s.GameMinutes = game.MinuteOf(from)
	ev := played(&s, monday.Add(13*time.Hour))
	shifts := 0
	for _, e := range ev {
		if e.Kind == "interaction" && e.Money > 0 {
			shifts++
		}
	}
	if shifts != 1 {
		t.Errorf("a day at work by itself: %d shifts paid", shifts)
	}
	// The next morning, again one.
	ev = played(&s, monday.Add(37*time.Hour))
	shifts = 0
	for _, e := range ev {
		if e.Kind == "interaction" && e.Money > 0 {
			shifts++
		}
	}
	if shifts != 1 {
		t.Errorf("the next day: %d shifts paid", shifts)
	}
}

// Combined bets, the boost included, take more than they give, even made of
// the shortest odds a bettor could stack (Bet225's boost, its margin).
func TestBoostedCombosAreASink(t *testing.T) {
	a := betApps["bet225"]
	start := game.RoundAt(1_800_000_000)
	for _, league := range []string{"babi", "basket-babi", "tennis-abidjan"} {
		var staked, back float64
		for r := start; r < start+3000; r++ {
			kick := r * game.RoundMinutes * 60
			end := kick + (game.OpenMinutes+game.PlayMinutes)*60 + 1
			before := game.Round(league, r, kick, a.Margin)
			if len(before) < 3 {
				continue
			}
			// The shortest price of each match, the eight shortest of the round.
			type leg struct {
				i    int
				pick string
				odds float64
			}
			var legs []leg
			for i, m := range before {
				best := leg{i, "", math.MaxFloat64}
				for _, pick := range []string{"1", "N", "2", "plus", "moins", "btsOui", "btsNon"} {
					if o, ok := game.PickOdds(m.Odds, pick); ok && o < best.odds {
						best = leg{i, pick, o}
					}
				}
				if best.pick != "" {
					legs = append(legs, best)
				}
			}
			slices.SortFunc(legs, func(x, y leg) int { return int(math.Copysign(1, x.odds-y.odds)) })
			legs = legs[:min(len(legs), MaxLegs)]
			odds, each, won := 1.0, []float64{}, true
			for _, l := range legs {
				odds *= l.odds
				each = append(each, l.odds)
				m, _ := game.MatchIn(league, r, l.i, end, a.Margin)
				if w, _ := game.Won(m, l.pick, end); !w {
					won = false
				}
			}
			odds = math.Min(MaxOdds, math.Round(odds*boostOf(a, each)*100)/100)
			staked++
			if won {
				back += odds
			}
		}
		t.Logf("%s: the shortest combined bets bring back %.3f for 1", league, back/staked)
		if back/staked >= 1 {
			t.Errorf("%s: combined bets of the shortest odds bring back %.3f for 1", league, back/staked)
		}
	}
}
