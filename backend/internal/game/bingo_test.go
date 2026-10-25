package game

import (
	"math/rand/v2"
	"slices"
	"testing"
)

// Every game takes back more than it gives (about 85 for 100 staked), and a
// card in four or five wins something.
func TestBingoReturn(t *testing.T) {
	for _, g := range BingoGames {
		back, hits := BingoReturn(g, 200_000)
		if back < 0.8 || back > 0.9 {
			t.Errorf("%s gives back %.3f for 1 staked: should stay between 0.80 and 0.90", g.ID, back)
		}
		if hits < 0.15 || hits > 0.4 {
			t.Errorf("%s: a card wins %.0f %% of the time", g.ID, hits*100)
		}
	}
}

// The cards are drawn as the real ones are: the columns' numbers, the free middle, the loto's 15 numbers.
func TestBingoCards(t *testing.T) {
	rng := rand.New(rand.NewPCG(1, 1))
	for _, g := range BingoGames {
		for range 200 {
			card := NewCard(g, rng)
			nums := []int{}
			for i, n := range card {
				if n == 0 {
					continue
				}
				nums = append(nums, n)
				lo, hi := g.colRange(i % g.Cols)
				if n < lo || n > hi {
					t.Fatalf("%s: %d in column %d", g.ID, n, i%g.Cols)
				}
			}
			slices.Sort(nums)
			if len(slices.Compact(slices.Clone(nums))) != len(nums) {
				t.Fatalf("%s: a number twice: %v", g.ID, card)
			}
			want := g.Rows * g.Cols
			switch {
			case g.ID == Loto90:
				want = 15
			case g.Free:
				want--
			}
			if len(nums) != want {
				t.Fatalf("%s: %d numbers, want %d", g.ID, len(nums), want)
			}
		}
	}
}

// The same draw always gives the same balls, all different, and they come out one by one.
func TestBingoDraws(t *testing.T) {
	for _, g := range BingoGames {
		if (g.Drawn-1)*g.Every/1000+1 >= g.Period {
			t.Errorf("%s: its balls take longer than the time between draws", g.ID)
		}
		a, b := BingoBalls(g, 42), BingoBalls(g, 42)
		if !slices.Equal(a, b) || slices.Equal(a, BingoBalls(g, 43)) {
			t.Errorf("%s: draws not fixed by their number", g.ID)
		}
		s := slices.Clone(a)
		slices.Sort(s)
		if len(slices.Compact(s)) != g.Drawn || s[0] < 1 || s[len(s)-1] > g.Balls {
			t.Errorf("%s: balls %v", g.ID, a)
		}
		start := g.Start(10) * 1000
		if g.Out(10, start-1) != 0 || g.Out(10, start) != 1 || g.Out(10, start+int64(g.Every)) != 2 || g.Out(10, start+1_000_000) != g.Drawn {
			t.Errorf("%s: balls out over time", g.ID)
		}
	}
}

// What a card wins: its best prize, each counted within its own number of balls.
func TestBingoBest(t *testing.T) {
	g, _ := FindBingo(Eclair)
	card := []int{1, 11, 21, 2, 12, 22, 3, 13, 23}
	// The first row in the first ten balls.
	if p, ok := BingoBest(g, card, []int{1, 11, 21, 30, 29, 28, 27, 26, 25, 24}); !ok || p.ID != "ligne" {
		t.Errorf("a row: %+v %v", p, ok)
	}
	// The same row done at the 11th ball only: too late for « une ligne ».
	if _, ok := BingoBest(g, card, []int{1, 11, 30, 29, 28, 27, 26, 25, 24, 19, 21}); ok {
		t.Error("a line after its tenth ball paid")
	}
	// Every number by the 15th ball: the full card.
	if p, ok := BingoBest(g, card, []int{1, 11, 21, 2, 12, 22, 3, 13, 23, 30, 29, 28, 27, 26, 25}); !ok || p.ID != "plein" {
		t.Errorf("full card: %+v %v", p, ok)
	}
	// Bingo 75's free middle counts as marked: the middle row with four balls.
	g75, _ := FindBingo(Bingo75)
	c := make([]int, 25)
	for i := range c {
		c[i] = i + 1
	}
	c[12] = 0
	if p, ok := BingoBest(g75, c, []int{11, 12, 14, 15}); !ok || p.ID != "ligne" {
		t.Errorf("the middle row with the free cell: %+v %v", p, ok)
	}
}
