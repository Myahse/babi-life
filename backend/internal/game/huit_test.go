package game

import (
	"math/rand/v2"
	"testing"
)

// cd: a card by value (1 the ace … 13 the king) and suit (0 trèfle … 3 pique).
func cd(rank, suit int) Card { return Card(suit*13 + rank - 1) }

const joker = Card(52)

// table: a game set by hand, the pile ending with top, seat 0 to play.
func table(top Card, hands ...[]Card) *Huit {
	deck := []Card{}
	used := map[Card]bool{top: true}
	for _, h := range hands {
		for _, c := range h {
			used[c] = true
		}
	}
	for c := Card(0); c < huitCards; c++ {
		if !used[c] {
			deck = append(deck, c)
		}
	}
	return &Huit{Deck: deck, Pile: []Card{top}, Hands: hands, Dir: 1, Suit: -1, Drawn: -1, Winner: -1}
}

func count(g *Huit) int {
	n := len(g.Deck) + len(g.Pile)
	for _, h := range g.Hands {
		n += len(h)
	}
	return n
}

var r0 = rand.New(rand.NewPCG(1, 2))

func TestHuitDeal(t *testing.T) {
	for n := 2; n <= HuitMaxPlayers; n++ {
		for k := 0; k < 200; k++ {
			g, err := NewHuit(n, rand.New(rand.NewPCG(uint64(k), uint64(n))))
			if err != nil {
				t.Fatal(err)
			}
			for _, h := range g.Hands {
				if len(h) != HuitDeal {
					t.Fatalf("%d cards dealt", len(h))
				}
			}
			if len(g.Pile) != 1 || g.Pile[0].special() {
				t.Fatalf("turned up %v", g.Pile)
			}
			if count(g) != huitCards {
				t.Fatalf("%d cards in the game", count(g))
			}
		}
	}
	if _, err := NewHuit(5, r0); err == nil {
		t.Fatal("5 players dealt")
	}
}

func TestHuitMatch(t *testing.T) {
	g := table(cd(5, 2), []Card{cd(5, 0), cd(9, 2), cd(9, 0), cd(8, 3), joker}, []Card{cd(3, 1)})
	for c, ok := range map[Card]bool{cd(5, 0): true, cd(9, 2): true, cd(9, 0): false, cd(8, 3): true, joker: true} {
		if g.CanPlay(0, c) != ok {
			t.Errorf("%v on 5♥: %v", c, !ok)
		}
	}
	if g.CanPlay(1, cd(3, 1)) {
		t.Error("played out of turn")
	}
}

func TestHuitEight(t *testing.T) {
	g := table(cd(5, 2), []Card{cd(8, 3), cd(9, 2), cd(4, 0)}, []Card{cd(9, 0), cd(4, 1), cd(6, 0)})
	if _, err := g.Play(0, cd(8, 3), -1, false, r0); err != ErrHuitSuit {
		t.Fatalf("an 8 without a suit: %v", err)
	}
	if _, err := g.Play(0, cd(8, 3), 0, false, r0); err != nil {
		t.Fatal(err)
	}
	// Trèfle asked: the 9♣ goes, the 4♦ doesn't (not even on value).
	if !g.CanPlay(1, cd(9, 0)) || g.CanPlay(1, cd(4, 1)) {
		t.Error("the suit asked not followed")
	}
	if _, err := g.Play(1, cd(9, 0), 0, false, r0); err != nil {
		t.Fatal(err)
	}
	if g.Suit != -1 {
		t.Error("the suit asked stays after a card of it")
	}
}

func TestHuitNoFinishOnWild(t *testing.T) {
	g := table(cd(5, 2), []Card{cd(8, 3)}, []Card{cd(9, 0)})
	if g.CanPlay(0, cd(8, 3)) {
		t.Error("finished on an 8")
	}
	g = table(cd(5, 2), []Card{joker}, []Card{cd(9, 0)})
	if g.CanPlay(0, joker) {
		t.Error("finished on a joker")
	}
}

func TestHuitTwo(t *testing.T) {
	g := table(cd(5, 2), []Card{cd(2, 2), cd(9, 0), cd(3, 3)}, []Card{cd(2, 0), cd(9, 1), cd(3, 1)}, []Card{joker, cd(4, 1), cd(4, 3)})
	mustPlay(t, g, 0, cd(2, 2))
	if g.Owed != HuitTwoDraw {
		t.Fatalf("owed %d after a 2", g.Owed)
	}
	// Only a 2 or a joker answers.
	if g.CanPlay(1, cd(9, 1)) {
		t.Error("answered a 2 with a 9")
	}
	mustPlay(t, g, 1, cd(2, 0))
	mustPlay(t, g, 2, joker)
	if g.Owed != 2*HuitTwoDraw+HuitJokerDraw {
		t.Fatalf("owed %d after 2, 2, joker", g.Owed)
	}
	// After a joker, a 2 doesn't answer.
	if g.CanPlay(0, cd(3, 3)) || g.CanPlay(0, cd(2, 0)) {
		t.Error("answered a joker without a joker")
	}
	before := len(g.Hands[0])
	if _, err := g.Draw(0, r0); err != nil {
		t.Fatal(err)
	}
	if len(g.Hands[0]) != before+12 || g.Owed != 0 || g.Turn != 1 {
		t.Fatalf("drew %d, owed %d, turn %d", len(g.Hands[0])-before, g.Owed, g.Turn)
	}
	// The card under the joker is played on (the 2♣: clubs or a 2).
	if g.Top() != cd(2, 0) {
		t.Errorf("top %v", g.Top())
	}
}

func TestHuitJoker(t *testing.T) {
	g := table(cd(5, 2), []Card{joker, cd(9, 0), cd(3, 3)}, []Card{cd(9, 1), cd(5, 1), cd(4, 0)})
	mustPlay(t, g, 0, joker)
	if g.Owed != HuitJokerDraw || g.Turn != 1 {
		t.Fatalf("owed %d turn %d", g.Owed, g.Turn)
	}
	if _, err := g.Draw(1, r0); err != nil {
		t.Fatal(err)
	}
	if len(g.Hands[1]) != 3+HuitJokerDraw || g.Turn != 0 {
		t.Fatalf("hand %d turn %d", len(g.Hands[1]), g.Turn)
	}
	// The cards go on the 5♥ under the joker: the 9♣ doesn't.
	if g.Top() != cd(5, 2) || g.CanPlay(0, cd(9, 0)) {
		t.Errorf("top %v", g.Top())
	}
}

func TestHuitAce(t *testing.T) {
	g := table(cd(5, 2), []Card{cd(1, 2), cd(9, 2), cd(3, 3)}, []Card{cd(9, 1), cd(5, 1), cd(1, 0)})
	mustPlay(t, g, 0, cd(1, 2))
	if !g.Ace || g.CanPlay(1, cd(9, 1)) {
		t.Fatal("an ace not to be answered")
	}
	// Answered by an ace: back to the first, who has none: draws one and passes.
	mustPlay(t, g, 1, cd(1, 0))
	if g.Turn != 0 || !g.Ace {
		t.Fatalf("turn %d ace %v", g.Turn, g.Ace)
	}
	if _, err := g.Draw(0, r0); err != nil {
		t.Fatal(err)
	}
	if len(g.Hands[0]) != 3 || g.Ace || g.Turn != 1 {
		t.Fatalf("hand %d ace %v turn %d", len(g.Hands[0]), g.Ace, g.Turn)
	}
}

func TestHuitSevenTenJack(t *testing.T) {
	// Three at the table: the 7 misses the next one.
	g := table(cd(5, 2), []Card{cd(7, 2), cd(10, 2), cd(11, 2), cd(4, 3)}, []Card{cd(9, 1), cd(4, 1)}, []Card{cd(9, 0), cd(4, 0)})
	mustPlay(t, g, 0, cd(7, 2))
	if g.Turn != 2 {
		t.Fatalf("after a 7: turn %d", g.Turn)
	}
	// The 10: its player again.
	g.Turn = 0
	mustPlay(t, g, 0, cd(10, 2))
	if g.Turn != 0 {
		t.Fatalf("after a 10: turn %d", g.Turn)
	}
	// The jack: the other way round.
	mustPlay(t, g, 0, cd(11, 2))
	if g.Dir != -1 || g.Turn != 2 {
		t.Fatalf("after a jack: dir %d turn %d", g.Dir, g.Turn)
	}
	// Between two, the jack's player plays again.
	g = table(cd(5, 2), []Card{cd(11, 2), cd(4, 3)}, []Card{cd(9, 1)})
	mustPlay(t, g, 0, cd(11, 2))
	if g.Turn != 0 {
		t.Fatalf("jack between two: turn %d", g.Turn)
	}
}

func TestHuitCarte(t *testing.T) {
	g := table(cd(5, 2), []Card{cd(6, 2), cd(4, 3)}, []Card{cd(9, 1)})
	s, err := g.Play(0, cd(6, 2), -1, false, r0)
	if err != nil {
		t.Fatal(err)
	}
	if !s.Forgot || len(g.Hands[0]) != 1+HuitCarteDraw {
		t.Fatalf("forgot %v, hand %d", s.Forgot, len(g.Hands[0]))
	}
	g = table(cd(5, 2), []Card{cd(6, 2), cd(4, 3)}, []Card{cd(9, 1)})
	s, _ = g.Play(0, cd(6, 2), -1, true, r0)
	if s.Forgot || !s.Carte || len(g.Hands[0]) != 1 {
		t.Fatal("« carte » said and still drew")
	}
}

func TestHuitDrawThenPlay(t *testing.T) {
	g := table(cd(5, 2), []Card{cd(9, 0), cd(3, 3)}, []Card{cd(9, 1)})
	g.Deck = append(g.Deck, cd(12, 2)) // a queen of hearts on top: it goes
	s, err := g.Draw(0, r0)
	if err != nil || s.Drawn != 1 {
		t.Fatal(err)
	}
	if g.Drawn != int(cd(12, 2)) || g.Turn != 0 {
		t.Fatalf("drawn %d turn %d", g.Drawn, g.Turn)
	}
	if _, err := g.Draw(0, r0); err != ErrHuitDrawn {
		t.Fatal("drew twice")
	}
	if _, err := g.Pass(0); err != nil || g.Turn != 1 {
		t.Fatal("passing", err)
	}
	// A card that doesn't go: the turn goes at once.
	g = table(cd(5, 2), []Card{cd(9, 0), cd(3, 3)}, []Card{cd(9, 1)})
	g.Deck = append(g.Deck, cd(12, 0))
	_, _ = g.Draw(0, r0)
	if g.Drawn != -1 || g.Turn != 1 {
		t.Fatalf("drawn %d turn %d", g.Drawn, g.Turn)
	}
}

func TestHuitDeckRefill(t *testing.T) {
	g := table(cd(5, 2), []Card{cd(9, 0)}, []Card{cd(9, 1)})
	g.Pile = []Card{cd(3, 0), cd(4, 0), cd(5, 2), joker}
	g.Deck = nil
	got := g.draw(0, 2, r0)
	if len(got) != 2 {
		t.Fatalf("drew %d", len(got))
	}
	// Kept: the 5♥ played on, and the joker on it.
	if len(g.Pile) != 2 || g.Pile[0] != cd(5, 2) || g.Top() != cd(5, 2) {
		t.Fatalf("pile %v", g.Pile)
	}
}

// Thousands of games between the game's players: each ends, no card is lost, nothing illegal.
func TestHuitBots(t *testing.T) {
	for k := 0; k < 3000; k++ {
		r := rand.New(rand.NewPCG(uint64(k), 7))
		g, _ := NewHuit(2+k%3, r)
		steps := 0
		for g.Winner < 0 {
			if steps++; steps > 2000 {
				t.Fatalf("game %d: no end after %d steps", k, steps)
			}
			if _, err := g.HuitBot(g.Turn, r); err != nil {
				t.Fatalf("game %d: %v", k, err)
			}
			if count(g) != huitCards {
				t.Fatalf("game %d: %d cards", k, count(g))
			}
		}
		if len(g.Hands[g.Winner]) != 0 {
			t.Fatalf("game %d: the winner has cards", k)
		}
	}
}

func mustPlay(t *testing.T, g *Huit, seat int, c Card) {
	t.Helper()
	if _, err := g.Play(seat, c, -1, true, r0); err != nil {
		t.Fatalf("seat %d playing %v: %v", seat, c, err)
	}
}
