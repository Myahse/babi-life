package game

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math"
	"math/rand/v2"
)

// The Babi virtual football league, which the betting apps of the phone
// (Bet225, ParisFoot) take bets on, like the « foot virtuel » of the real
// betting sites: a round of six matches every quarter of an hour, all day.
// Bets are open for the first ten minutes; the matches are then played in
// three (the 90 minutes go by, the goals come), and the results are known.
// The clubs are the game's own (Clubs, stadium.go), each with its level;
// goals follow the levels (a Poisson draw), with home advantage, so the odds
// mean something. The draw is keyed by a secret of the server (BetSecret):
// nobody can work a result out in advance. Odds carry the bookmaker's margin.
// It's the game's money only: nothing to pay in, nothing to take out.

const (
	RoundMinutes = 15 // a round every quarter of an hour (real minutes)
	OpenMinutes  = 10 // betting open from the round's start
	PlayMinutes  = 3  // then the 90 minutes are played in 3
)

// BetSecret keys the results (BET_SECRET, else the JWT secret: set at start).
var BetSecret = "babi-life-dev"

// ClubLevel: each club's level (out of 100), the same all season.
var ClubLevel = map[string]float64{
	"Babi Sporting": 86, "Yop City FC": 82, "Étoile de Treichville": 80, "Lagune FC": 74, "Racing d'Adjamé": 77, "Koumassi Lions": 71,
	"Abobo Warriors": 73, "Cocody Olympique": 84, "Plateau United": 78, "Bingerville Athletic": 66, "Marcory Espoir": 69, "Port-Bouët Marine": 68,
}

// RegionClubs: the second league, ParisFoot's (« Ligue des Régions »): made-up
// clubs from the country's towns, so the two apps don't show the same matches.
var RegionClubs = []string{"Bouaké Racing", "Yakro Lions", "San-Pédro Marine", "Korhogo Étoile", "Daloa Sport", "Man Montagne FC", "Gagnoa United", "Abengourou Espoir", "Odienné Savane", "Sassandra Port FC", "Divo Olympique", "Bondoukou Athletic"}

func init() {
	for i, c := range RegionClubs {
		ClubLevel[c] = []float64{84, 80, 78, 76, 74, 72, 79, 70, 66, 68, 73, 69}[i]
	}
}

// Leagues: which clubs each league plays with ("babi": the Babi league, Bet225's; "regions": ParisFoot's).
var Leagues = map[string][]string{"babi": Clubs, "regions": RegionClubs}

// VirtualMatch is one match of a round, as the apps show it.
type VirtualMatch struct {
	Key     string   `json:"key"` // "round:i"
	Round   int64    `json:"round"`
	Home    string   `json:"home"`
	Away    string   `json:"away"`
	Kickoff int64    `json:"kickoff"` // unix seconds
	End     int64    `json:"end"`
	Odds    Odds     `json:"odds"`
	Minute  int      `json:"minute"`          // 0 before kickoff, 90 at the end
	Score   *[2]int  `json:"score,omitempty"` // from kickoff
	Goals   []string `json:"goals,omitempty"` // « 23' H », as they come
}

// Odds: the prices of each market (decimal odds).
type Odds struct {
	Home, Draw, Away float64
	Over, Under      float64 // 2.5 goals
	BothYes, BothNo  float64 // both teams score
}

// MarshalJSON keeps the keys short and lower-case for the app.
func (o Odds) MarshalJSON() ([]byte, error) {
	return []byte(fmt.Sprintf(`{"1":%.2f,"N":%.2f,"2":%.2f,"plus":%.2f,"moins":%.2f,"btsOui":%.2f,"btsNon":%.2f}`, o.Home, o.Draw, o.Away, o.Over, o.Under, o.BothYes, o.BothNo)), nil
}

// Picks a leg can bet on, by market.
var Picks = map[string][]string{"1N2": {"1", "N", "2"}, "buts": {"plus", "moins"}, "bts": {"btsOui", "btsNon"}}

// RoundAt: the round under way at a unix second.
func RoundAt(unix int64) int64 { return unix / (RoundMinutes * 60) }

func roundStart(round int64) int64 { return round * RoundMinutes * 60 }

// Pairing: the six matches of a round of the Babi league, every club once, shuffled by the round.
func Pairing(round int64) [][2]string { return PairingIn("babi", round) }

// PairingIn: the same in a league (each its own shuffle).
func PairingIn(league string, round int64) [][2]string {
	clubs := append([]string(nil), Leagues[league]...)
	seed := uint64(0x9e3779b97f4a7c15)
	if league != "babi" {
		seed ^= 0x5bd1e995
	}
	r := rand.New(rand.NewPCG(uint64(round), seed))
	r.Shuffle(len(clubs), func(i, j int) { clubs[i], clubs[j] = clubs[j], clubs[i] })
	out := make([][2]string, 0, len(clubs)/2)
	for i := 0; i+1 < len(clubs); i += 2 {
		out = append(out, [2]string{clubs[i], clubs[i+1]})
	}
	return out
}

// rates: the expected goals of each side.
func rates(home, away string) (float64, float64) {
	h, a := ClubLevel[home], ClubLevel[away]
	if h == 0 {
		h = 70
	}
	if a == 0 {
		a = 70
	}
	return 1.45 * math.Pow(h/a, 2.2), 1.15 * math.Pow(a/h, 2.2)
}

func poisson(l float64, k int) float64 {
	p := math.Exp(-l)
	for i := 1; i <= k; i++ {
		p *= l / float64(i)
	}
	return p
}

// Margin: the bookmaker's share in the odds (each app may add its own).
const Margin = 0.07

func price(p, margin float64) float64 {
	if p <= 0 {
		return 50
	}
	o := 1 / (p * (1 + margin))
	return math.Max(1.05, math.Min(50, math.Round(o*100)/100))
}

// OddsFor: the prices of a match, from the probabilities of each score.
func OddsFor(home, away string, margin float64) Odds {
	lh, la := rates(home, away)
	var pH, pD, pA, pOver, pBoth float64
	for i := 0; i <= 10; i++ {
		for j := 0; j <= 10; j++ {
			p := poisson(lh, i) * poisson(la, j)
			switch {
			case i > j:
				pH += p
			case i == j:
				pD += p
			default:
				pA += p
			}
			if i+j > 2 {
				pOver += p
			}
			if i > 0 && j > 0 {
				pBoth += p
			}
		}
	}
	return Odds{price(pH, margin), price(pD, margin), price(pA, margin), price(pOver, margin), price(1-pOver, margin), price(pBoth, margin), price(1-pBoth, margin)}
}

// goal: one goal of a match, the minute and the side ('H' or 'A').
type goal struct {
	Minute int
	Side   byte
}

// result: the match's goals, keyed by the secret (the same every time it's asked).
func result(league string, round int64, i int, home, away string) []goal {
	m := hmac.New(sha256.New, []byte(BetSecret))
	if league != "babi" {
		fmt.Fprintf(m, "%s:", league)
	}
	fmt.Fprintf(m, "%d:%d:%s:%s", round, i, home, away)
	sum := m.Sum(nil)
	r := rand.New(rand.NewPCG(binary.BigEndian.Uint64(sum[:8]), binary.BigEndian.Uint64(sum[8:16])))
	lh, la := rates(home, away)
	draw := func(l float64) int {
		// Knuth's Poisson draw.
		L, k, p := math.Exp(-l), 0, 1.0
		for {
			p *= r.Float64()
			if p <= L {
				return k
			}
			k++
		}
	}
	var out []goal
	for n := draw(lh); n > 0; n-- {
		out = append(out, goal{1 + r.IntN(90), 'H'})
	}
	for n := draw(la); n > 0; n-- {
		out = append(out, goal{1 + r.IntN(90), 'A'})
	}
	// In the order they come.
	for a := 1; a < len(out); a++ {
		for b := a; b > 0 && out[b].Minute < out[b-1].Minute; b-- {
			out[b], out[b-1] = out[b-1], out[b]
		}
	}
	return out
}

// Match: one match of the Babi league as it stands at a unix second (no score before kickoff).
func Match(round int64, i int, now int64, margin float64) (VirtualMatch, bool) {
	return MatchIn("babi", round, i, now, margin)
}

// MatchIn: the same in a league.
func MatchIn(league string, round int64, i int, now int64, margin float64) (VirtualMatch, bool) {
	pairs := PairingIn(league, round)
	if i < 0 || i >= len(pairs) {
		return VirtualMatch{}, false
	}
	home, away := pairs[i][0], pairs[i][1]
	kick := roundStart(round) + OpenMinutes*60
	m := VirtualMatch{Key: fmt.Sprintf("%d:%d", round, i), Round: round, Home: home, Away: away, Kickoff: kick, End: kick + PlayMinutes*60, Odds: OddsFor(home, away, margin)}
	if now < kick {
		return m, true
	}
	m.Minute = min(90, int(float64(now-kick)/float64(PlayMinutes*60)*90))
	score := [2]int{}
	for _, g := range result(league, round, i, home, away) {
		if g.Minute > m.Minute {
			break
		}
		if g.Side == 'H' {
			score[0]++
			m.Goals = append(m.Goals, fmt.Sprintf("%d' %s", g.Minute, home))
		} else {
			score[1]++
			m.Goals = append(m.Goals, fmt.Sprintf("%d' %s", g.Minute, away))
		}
	}
	m.Score = &score
	return m, true
}

// Round: the round's six matches at a unix second, in a league.
func Round(league string, round, now int64, margin float64) []VirtualMatch {
	out := []VirtualMatch{}
	for i := range PairingIn(league, round) {
		m, _ := MatchIn(league, round, i, now, margin)
		out = append(out, m)
	}
	return out
}

// Won: does a pick win on a finished match? (ok=false while it isn't over)
func Won(m VirtualMatch, pick string, now int64) (won, ok bool) {
	if now < m.End || m.Score == nil || m.Minute < 90 {
		return false, false
	}
	h, a := m.Score[0], m.Score[1]
	switch pick {
	case "1":
		return h > a, true
	case "N":
		return h == a, true
	case "2":
		return h < a, true
	case "plus":
		return h+a > 2, true
	case "moins":
		return h+a <= 2, true
	case "btsOui":
		return h > 0 && a > 0, true
	case "btsNon":
		return h == 0 || a == 0, true
	}
	return false, true
}

// PickOdds: a pick's price on a match.
func PickOdds(o Odds, pick string) (float64, bool) {
	switch pick {
	case "1":
		return o.Home, true
	case "N":
		return o.Draw, true
	case "2":
		return o.Away, true
	case "plus":
		return o.Over, true
	case "moins":
		return o.Under, true
	case "btsOui":
		return o.BothYes, true
	case "btsNon":
		return o.BothNo, true
	}
	return 0, false
}
