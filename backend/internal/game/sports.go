package game

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math"
	"math/rand/v2"
)

// Not only football: the betting apps take bets on virtual basketball and
// tennis too, each app with its own leagues (like the real sites' « sports
// virtuels »). Same rhythm as the football (a round every quarter of an
// hour, bets open ten minutes, the match played in three), the same secret
// draw, odds from the levels. Basketball: who wins (overtime if needed, no
// draw), and more or fewer points than the line. Tennis, best of three sets:
// who wins, and whether it goes to three sets.

// Sports a league can be.
const (
	SportFoot   = "foot"
	SportBasket = "basket"
	SportTennis = "tennis"
)

// LeagueInfo is one league of the betting apps.
type LeagueInfo struct {
	ID    string   `json:"id"`
	Sport string   `json:"sport"`
	Name  string   `json:"name"`
	Clubs []string `json:"-"`
}

var (
	// The basketball clubs (made up) and the tennis players (made up), each with their level.
	BasketClubs       = []string{"Abidjan Lions BC", "Treichville Hoops", "Cocody Stars", "Yopougon Ballers", "Plateau Eagles", "Marcory Thunder", "Port-Bouët Sharks", "Abobo Kings", "Adjamé Flash", "Koumassi Rockets", "Bingerville Titans", "Riviera Warriors"}
	BasketRegionClubs = []string{"Bouaké Basket", "Yakro Panthers", "San-Pédro Waves", "Korhogo Falcons", "Daloa Bulls", "Man Mountain BC", "Gagnoa Giants", "Abengourou Royals", "Odienné Hawks", "Divo Spurs", "Sassandra Surf", "Bondoukou Jets"}
	TennisPlayers     = []string{"A. Koné", "M. Traoré", "Y. Kouassi", "F. Bamba", "S. Diabaté", "K. N'Guessan", "I. Coulibaly", "P. Yao", "D. Ouattara", "L. Touré", "E. Kouamé", "B. Gnagne"}
	TennisPlayers2    = []string{"R. Konan", "H. Cissé", "J. Assi", "N. Fofana", "C. Aka", "T. Dosso", "G. Koffi", "V. Sanogo", "O. Kra", "Z. Doumbia", "A. Tanoh", "M. Kanga"}
)

// LeagueList: every league, by app (game.Leagues has their clubs).
var LeagueList = []LeagueInfo{
	{"babi", SportFoot, "Championnat virtuel de Babi", Clubs},
	{"regions", SportFoot, "Ligue des Régions", RegionClubs},
	{"basket-babi", SportBasket, "Babi Basket League", BasketClubs},
	{"basket-regions", SportBasket, "Coupe des Régions de basket", BasketRegionClubs},
	{"tennis-abidjan", SportTennis, "Open virtuel d'Abidjan", TennisPlayers},
	{"tennis-regions", SportTennis, "Tournoi des Régions", TennisPlayers2},
}

// SportOf: a league's sport (football for an unknown one).
func SportOf(league string) string {
	for _, l := range LeagueList {
		if l.ID == league {
			return l.Sport
		}
	}
	return SportFoot
}

func init() {
	levels := []float64{86, 82, 80, 77, 74, 72, 79, 70, 66, 68, 75, 71}
	for _, list := range [][]string{BasketClubs, BasketRegionClubs, TennisPlayers, TennisPlayers2} {
		for i, c := range list {
			ClubLevel[c] = levels[i%len(levels)]
		}
	}
	for _, l := range LeagueList {
		Leagues[l.ID] = l.Clubs
	}
}

// matchDraw: the secret, fixed random of one match (the same every time it's asked).
func matchDraw(league string, round int64, i int, home, away string) *rand.Rand {
	m := hmac.New(sha256.New, []byte(BetSecret))
	fmt.Fprintf(m, "%s:%d:%d:%s:%s", league, round, i, home, away)
	sum := m.Sum(nil)
	return rand.New(rand.NewPCG(binary.BigEndian.Uint64(sum[:8]), binary.BigEndian.Uint64(sum[8:16])))
}

func level(c string) float64 {
	if l := ClubLevel[c]; l > 0 {
		return l
	}
	return 70
}

// phi: the normal distribution's cumulative.
func phi(x float64) float64 { return 0.5 * (1 + math.Erf(x/math.Sqrt2)) }

/* ---------- Basketball ---------- */

const basketSD = 11 // points: how far a team's score strays from what's expected

func basketMeans(home, away string) (float64, float64) {
	// Better teams score more (the pace of the game), the stronger one more still; a little more at home.
	lh, la := level(home), level(away)
	base := 80 + 0.35*((lh+la)/2-72)
	d := lh - la
	return base + 0.6*d + 2.5, base - 0.6*d
}

// basketOdds: who wins (no draw: overtime), and the points line.
func basketOdds(home, away string, margin float64) (Odds, float64) {
	mh, ma := basketMeans(home, away)
	pHome := phi((mh - ma) / (basketSD * math.Sqrt2))
	line := math.Round(mh+ma) + 0.5
	return Odds{Home: price(pHome, margin), Away: price(1-pHome, margin), Over: price(0.5, margin), Under: price(0.5, margin)}, line
}

// basketScore: the four quarters of a match (overtime added to the winner if tied).
func basketScore(league string, round int64, i int, home, away string) [][2]int {
	r := matchDraw(league, round, i, home, away)
	mh, ma := basketMeans(home, away)
	h := int(math.Round(mh + r.NormFloat64()*basketSD))
	a := int(math.Round(ma + r.NormFloat64()*basketSD))
	if h == a {
		if r.Float64() < 0.5 {
			h += 3 + r.IntN(8)
		} else {
			a += 3 + r.IntN(8)
		}
	}
	split := func(total int) [4]int {
		var q [4]int
		left := total
		for k := 0; k < 3; k++ {
			q[k] = int(float64(total)*(0.21+r.Float64()*0.08) + 0.5)
			left -= q[k]
		}
		q[3] = left
		return q
	}
	qh, qa := split(h), split(a)
	out := make([][2]int, 4)
	for k := range out {
		out[k] = [2]int{qh[k], qa[k]}
	}
	return out
}

/* ---------- Tennis ---------- */

// tennisSet: the chance the first player wins a set.
func tennisSet(home, away string) float64 {
	return 1 / (1 + math.Exp(-(level(home)-level(away))/11))
}

// tennisOdds: who wins, and whether it goes to three sets.
func tennisOdds(home, away string, margin float64) Odds {
	p := tennisSet(home, away)
	win := p*p + 2*p*p*(1-p)
	three := 2 * p * (1 - p)
	return Odds{Home: price(win, margin), Away: price(1-win, margin), BothYes: price(three, margin), BothNo: price(1-three, margin)}
}

// tennisSets: the sets of a match, each [games of the first, games of the second].
func tennisSets(league string, round int64, i int, home, away string) [][2]int {
	r := matchDraw(league, round, i, home, away)
	p := tennisSet(home, away)
	var sets [][2]int
	won := [2]int{}
	for won[0] < 2 && won[1] < 2 {
		w := 1
		if r.Float64() < p {
			w = 0
		}
		loser := []int{0, 1, 2, 3, 4, 2, 3, 4, 5, 6}[r.IntN(10)]
		top := 6
		if loser >= 5 {
			top = 7
		}
		s := [2]int{loser, loser}
		s[w] = top
		sets = append(sets, s)
		won[w]++
	}
	return sets
}

// matchSport: a basketball or tennis match as it stands at a unix second
// (MatchIn does football): the score so far, the quarters or the sets in Goals.
func matchSport(sport, league string, round int64, i int, home, away string, now int64, margin float64) VirtualMatch {
	kick := roundStart(round) + OpenMinutes*60
	m := VirtualMatch{Key: fmt.Sprintf("%s:%d:%d", league, round, i), Round: round, Home: home, Away: away, Kickoff: kick, End: kick + PlayMinutes*60, Sport: sport}
	if sport == SportBasket {
		m.Odds, m.Line = basketOdds(home, away, margin)
	} else {
		m.Odds = tennisOdds(home, away, margin)
	}
	if now < kick {
		return m
	}
	m.Minute = min(90, int(float64(now-kick)/float64(PlayMinutes*60)*90))
	score := [2]int{}
	if sport == SportBasket {
		// Four quarters of the 90 « minutes » the match lasts on the clock: the points come as it goes.
		for k, q := range basketScore(league, round, i, home, away) {
			from := k * 90 / 4
			part := math.Max(0, math.Min(1, float64(m.Minute-from)/(90.0/4)))
			score[0] += int(float64(q[0]) * part)
			score[1] += int(float64(q[1]) * part)
			if part >= 1 {
				m.Goals = append(m.Goals, fmt.Sprintf("Q%d %d-%d", k+1, q[0], q[1]))
			}
		}
	} else {
		// The sets one after the other: the score is the sets won, each set's games in Goals.
		sets := tennisSets(league, round, i, home, away)
		each := 90 / len(sets)
		for k, s := range sets {
			if m.Minute < (k+1)*each && m.Minute < 90 {
				break
			}
			if s[0] > s[1] {
				score[0]++
			} else {
				score[1]++
			}
			m.Goals = append(m.Goals, fmt.Sprintf("%d-%d", s[0], s[1]))
		}
	}
	m.Score = &score
	return m
}
