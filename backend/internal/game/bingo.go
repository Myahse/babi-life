package game

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math/rand/v2"
	"slices"
)

// Le bingo (sims/bingo.go, web screens/BingoApp.tsx), in the Babi Bingo app:
// the four games played round the world, each in its own room, one draw
// after another all day long, the same balls for every player at the same
// time. Cards are bought for the next draw; while it runs the balls come out
// one by one and the cards are marked as they do. What a card completes
// within the balls drawn pays its stake times the best prize it reached.
// The balls are keyed by the server's secret (BetSecret): nobody can know
// them in advance. Like the bets, the loto and the slot machines, bingo
// takes back more than it gives (BingoReturn, checked by its test). The
// game's money only, adults only, BingoPerDay cards a day an account.

// BingoPrize: a pattern a card can complete within so many balls, and what it pays, times the stake.
type BingoPrize struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Within int    `json:"within"`
	Times  int    `json:"times"`
}

// BingoGame: one of the games, its card and its draws.
type BingoGame struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	About string `json:"about"`
	// Balls: numbered 1 to Balls; Drawn of them come out in a draw.
	Balls int `json:"balls"`
	Drawn int `json:"drawn"`
	// Rows × Cols: the card. Free: its middle cell is free (marked from the start).
	Rows int  `json:"rows"`
	Cols int  `json:"cols"`
	Free bool `json:"free,omitempty"`
	// Every: the milliseconds between two balls; Period: the seconds from one draw to the next.
	Every  int `json:"every"`
	Period int `json:"period"`
	// Prizes: from the smallest to the biggest; a card is paid its best one.
	Prizes []BingoPrize `json:"prizes"`
}

// The games' ids.
const (
	Bingo75 = "bingo75"
	Loto90  = "loto90"
	Bingo80 = "bingo80"
	Eclair  = "eclair30"
)

// BingoGames: the four rooms of Babi Bingo.
var BingoGames = []BingoGame{
	{ID: Bingo75, Name: "Bingo 75", About: "Le bingo américain : un carton de 5 × 5, B-I-N-G-O, la case du milieu offerte.",
		Balls: 75, Drawn: 55, Rows: 5, Cols: 5, Free: true, Every: 2500, Period: 180,
		Prizes: []BingoPrize{{"ligne", "Une ligne", 32, 2}, {"coins", "Les 4 coins", 40, 3}, {"x", "Le X", 50, 10}, {"plein", "Carton plein", 55, 500}}},
	{ID: Loto90, Name: "Loto 90", About: "Le loto des kermesses : 15 numéros sur 3 lignes. La quine, la double quine, le carton plein.",
		Balls: 90, Drawn: 72, Rows: 3, Cols: 9, Every: 2000, Period: 180,
		Prizes: []BingoPrize{{"quine", "Quine", 52, 2}, {"double", "Double quine", 65, 4}, {"plein", "Carton plein", 72, 13}}},
	{ID: Bingo80, Name: "Bingo 80", About: "Le carton de 4 × 4, de 1 à 80 : une ligne, les coins, le carré du milieu.",
		Balls: 80, Drawn: 60, Rows: 4, Cols: 4, Every: 2000, Period: 150,
		Prizes: []BingoPrize{{"ligne", "Une ligne", 30, 2}, {"coins", "Les 4 coins", 40, 4}, {"carre", "Le carré du milieu", 40, 4}, {"plein", "Carton plein", 60, 35}}},
	{ID: Eclair, Name: "Bingo éclair", About: "Une partie par minute : un petit carton de 3 × 3, de 1 à 30.",
		Balls: 30, Drawn: 15, Rows: 3, Cols: 3, Every: 1800, Period: 60,
		Prizes: []BingoPrize{{"ligne", "Une ligne", 10, 2}, {"deux", "Deux lignes", 14, 3}, {"plein", "Carton plein", 15, 400}}},
}

// The stakes a card costs, the cards a player may hold on a draw, the cards an account may buy in a real day.
var BingoStakes = []int{100, 200, 500, 1000}

const (
	BingoCardsPerDraw = 4
	BingoPerDay       = 120
)

// FindBingo: a game by its id.
func FindBingo(id string) (BingoGame, bool) {
	for _, g := range BingoGames {
		if g.ID == id {
			return g, true
		}
	}
	return BingoGame{}, false
}

// DrawAt: the draw running or next at a moment (Unix seconds), and when it starts.
func (g BingoGame) DrawAt(now int64) (int64, int64) {
	n := now / int64(g.Period)
	return n, n * int64(g.Period)
}

// Start: when a draw starts; End: when its last ball is out.
func (g BingoGame) Start(n int64) int64 { return n * int64(g.Period) }
func (g BingoGame) End(n int64) int64 {
	return g.Start(n) + int64((g.Drawn-1)*g.Every/1000) + 1
}

// Out: how many balls of a draw are out at a moment.
func (g BingoGame) Out(n, nowMs int64) int {
	since := nowMs - g.Start(n)*1000
	if since < 0 {
		return 0
	}
	return min(g.Drawn, int(since/int64(g.Every))+1)
}

// BingoBalls: a draw's balls, in the order they come out (keyed by the secret).
func BingoBalls(g BingoGame, n int64) []int {
	m := hmac.New(sha256.New, []byte(BetSecret))
	fmt.Fprintf(m, "bingo:%s:%d", g.ID, n)
	sum := m.Sum(nil)
	r := rand.New(rand.NewPCG(binary.BigEndian.Uint64(sum[:8]), binary.BigEndian.Uint64(sum[8:16])))
	out := make([]int, g.Drawn)
	for i, b := range r.Perm(g.Balls)[:g.Drawn] {
		out[i] = b + 1
	}
	return out
}

// colRange: the numbers a column of a card takes.
func (g BingoGame) colRange(c int) (int, int) {
	if g.ID == Loto90 {
		// 1–9, 10–19 … 70–79, 80–90.
		switch c {
		case 0:
			return 1, 9
		case 8:
			return 80, 90
		}
		return 10 * c, 10*c + 9
	}
	per := g.Balls / g.Cols
	return c*per + 1, (c + 1) * per
}

// NewCard: a card of the game, row by row (0: a blank cell, or the free middle).
func NewCard(g BingoGame, rng *rand.Rand) []int {
	card := make([]int, g.Rows*g.Cols)
	if g.ID == Loto90 {
		// Five numbers a row, every column used at least once.
		var used [][]bool
		for {
			used = make([][]bool, g.Rows)
			cols := make([]int, g.Cols)
			for r := range used {
				used[r] = make([]bool, g.Cols)
				for _, c := range rng.Perm(g.Cols)[:5] {
					used[r][c] = true
					cols[c]++
				}
			}
			if !slices.Contains(cols, 0) {
				break
			}
		}
		for c := 0; c < g.Cols; c++ {
			lo, hi := g.colRange(c)
			var rows []int
			for r := 0; r < g.Rows; r++ {
				if used[r][c] {
					rows = append(rows, r)
				}
			}
			nums := pick(rng, lo, hi, len(rows))
			for i, r := range rows {
				card[r*g.Cols+c] = nums[i]
			}
		}
		return card
	}
	for c := 0; c < g.Cols; c++ {
		lo, hi := g.colRange(c)
		for r, n := range pick(rng, lo, hi, g.Rows) {
			card[r*g.Cols+c] = n
		}
	}
	if g.Free {
		card[(g.Rows/2)*g.Cols+g.Cols/2] = 0
	}
	return card
}

// pick: k numbers from lo to hi, sorted.
func pick(rng *rand.Rand, lo, hi, k int) []int {
	out := make([]int, k)
	for i, x := range rng.Perm(hi - lo + 1)[:k] {
		out[i] = lo + x
	}
	slices.Sort(out)
	return out
}

// BingoBest: the best prize a card reaches with these balls out, in order (each
// prize counts the balls within its own limit), and whether it reached one.
func BingoBest(g BingoGame, card, balls []int) (BingoPrize, bool) {
	for i := len(g.Prizes) - 1; i >= 0; i-- {
		p := g.Prizes[i]
		within := balls
		if p.Within > 0 && p.Within < len(within) {
			within = within[:p.Within]
		}
		if bingoReached(g, card, within, p.ID) {
			return p, true
		}
	}
	return BingoPrize{}, false
}

// bingoReached: whether a card has a pattern done with these balls out.
func bingoReached(g BingoGame, card, balls []int, id string) bool {
	out := map[int]bool{}
	for _, b := range balls {
		out[b] = true
	}
	marked := func(i int) bool { return card[i] == 0 || out[card[i]] }
	all := func(cells ...int) bool {
		for _, i := range cells {
			if !marked(i) {
				return false
			}
		}
		return true
	}
	at := func(r, c int) int { return r*g.Cols + c }
	// The rows done, the columns and the two diagonals (on a square card).
	rows, lines := 0, 0
	for r := 0; r < g.Rows; r++ {
		cells := make([]int, g.Cols)
		for c := range cells {
			cells[c] = at(r, c)
		}
		if all(cells...) {
			rows++
		}
	}
	lines = rows
	var diag1, diag2 bool
	if g.Rows == g.Cols {
		for c := 0; c < g.Cols; c++ {
			cells := make([]int, g.Rows)
			for r := range cells {
				cells[r] = at(r, c)
			}
			if all(cells...) {
				lines++
			}
		}
		d1, d2 := make([]int, g.Rows), make([]int, g.Rows)
		for i := 0; i < g.Rows; i++ {
			d1[i], d2[i] = at(i, i), at(i, g.Cols-1-i)
		}
		diag1, diag2 = all(d1...), all(d2...)
		for _, d := range []bool{diag1, diag2} {
			if d {
				lines++
			}
		}
	}
	full := true
	for i := range card {
		full = full && marked(i)
	}
	switch id {
	case "ligne":
		return lines > 0
	case "deux":
		return lines > 1
	case "quine":
		return rows > 0
	case "double":
		return rows > 1
	case "coins":
		return all(at(0, 0), at(0, g.Cols-1), at(g.Rows-1, 0), at(g.Rows-1, g.Cols-1))
	case "x":
		return diag1 && diag2
	case "carre":
		m := g.Rows / 2
		return all(at(m-1, m-1), at(m-1, m), at(m, m-1), at(m, m))
	case "plein":
		return full
	}
	return false
}

// BingoReturn: what a game gives back for 1 staked and how often a card wins,
// over many cards and draws played out (seeded: the same every time).
func BingoReturn(g BingoGame, cards int) (float64, float64) {
	rng := rand.New(rand.NewPCG(11, 13))
	var back, hits float64
	for range cards {
		card := NewCard(g, rng)
		balls := make([]int, g.Drawn)
		for i, b := range rng.Perm(g.Balls)[:g.Drawn] {
			balls[i] = b + 1
		}
		if p, ok := BingoBest(g, card, balls); ok {
			back += float64(p.Times)
			hits++
		}
	}
	return back / float64(cards), hits / float64(cards)
}
