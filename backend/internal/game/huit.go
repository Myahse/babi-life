package game

import (
	"errors"
	"math/rand/v2"
)

// 8 américain as it's played in Abidjan: 54 cards (two jokers), 7 each, the
// first to have no cards left wins. A card goes on one of the same suit or
// the same value. The specials:
//   - the 8 goes on anything, and its player says the suit to follow (not to finish on);
//   - the 2 makes the next one draw 3, unless they put down a 2 or a joker (it adds up);
//   - the joker goes on anything and makes the next one draw 6, unless they put down a joker
//     (the cards after it go on the card under it; not to finish on);
//   - the ace: the next one puts down an ace, or draws a card and lets the others play;
//   - the 7: the next one misses their turn; the 10: its player plays again;
//   - the jack turns the way round (between two, its player plays again).
// Who can't play draws a card, and may put it down if it goes. Going down to
// one card, you say « carte » or draw 2.

// Card: 0..51 is suit*13 + value-1 (1 the ace … 13 the king); 52 and 53 are the jokers.
type Card int8

const (
	HuitDeal = 7
	// What the specials make the next one draw, and what forgetting « carte » costs.
	HuitTwoDraw    = 3
	HuitJokerDraw  = 6
	HuitCarteDraw  = 2
	HuitMaxPlayers = 4
	huitCards      = 54
)

func (c Card) Joker() bool { return c >= 52 }

// Rank: 1 the ace … 13 the king, 0 a joker.
func (c Card) Rank() int {
	if c.Joker() {
		return 0
	}
	return int(c)%13 + 1
}

// Suit: 0 trèfle, 1 carreau, 2 cœur, 3 pique; -1 a joker.
func (c Card) Suit() int {
	if c.Joker() {
		return -1
	}
	return int(c) / 13
}

// special: a card that does something (not to be turned up to start).
func (c Card) special() bool {
	switch c.Rank() {
	case 0, 1, 2, 7, 8, 10, 11:
		return true
	}
	return false
}

// wild: the cards one may not finish on.
func (c Card) wild() bool { return c.Joker() || c.Rank() == 8 }

// HuitStep: one thing done at the table, for the phones to show one after the other.
type HuitStep struct {
	Seat int    `json:"seat"`
	Kind string `json:"kind"` // play, draw, pass
	Card Card   `json:"card"` // put down (play)
	Suit int    `json:"suit"` // asked with an 8, -1 else
	// Drawn: how many; Cards: which (only ever shown to the one who drew them).
	Drawn  int    `json:"drawn,omitempty"`
	Cards  []Card `json:"cards,omitempty"`
	Carte  bool   `json:"carte,omitempty"`  // « carte ! » said
	Forgot bool   `json:"forgot,omitempty"` // down to one card without saying it: drew 2
	Won    bool   `json:"won,omitempty"`
}

// Huit: a game, as kept between moves.
type Huit struct {
	Deck  []Card   `json:"deck"` // to draw from (the top at the end)
	Pile  []Card   `json:"pile"` // played (the top at the end)
	Hands [][]Card `json:"hands"`
	Turn  int      `json:"turn"`
	Dir   int      `json:"dir"`
	// Suit asked by an 8 (-1 none); Owed: the cards the one to play draws unless
	// they answer, put down by 2s (By 2) or jokers (By 0); Ace: an ace to answer.
	Suit int  `json:"suit"`
	Owed int  `json:"owed"`
	By   int  `json:"by"`
	Ace  bool `json:"ace"`
	// Drawn: the card the one to play has just drawn, which goes: play it or pass (-1 none).
	Drawn  int        `json:"drawn"`
	Winner int        `json:"winner"` // -1 while it goes on
	Steps  []HuitStep `json:"steps"`  // what was done last (for the phones)
}

var (
	ErrHuitTurn    = errors.New("ce n'est pas à toi de jouer")
	ErrHuitCard    = errors.New("cette carte ne va pas ici")
	ErrHuitSuit    = errors.New("choisis la couleur demandée avec ton 8")
	ErrHuitDrawn   = errors.New("tu as déjà pioché : pose la carte piochée ou passe")
	ErrHuitNoPass  = errors.New("pioche d'abord")
	ErrHuitOver    = errors.New("la partie est finie")
	ErrHuitPlayers = errors.New("on joue de 2 à 4")
)

// NewHuit: the cards shuffled and dealt, one turned up (not a special: those
// go back in), the first seat to play.
func NewHuit(players int, r *rand.Rand) (*Huit, error) {
	if players < 2 || players > HuitMaxPlayers {
		return nil, ErrHuitPlayers
	}
	deck := make([]Card, huitCards)
	for i := range deck {
		deck[i] = Card(i)
	}
	r.Shuffle(len(deck), func(i, j int) { deck[i], deck[j] = deck[j], deck[i] })
	g := &Huit{Dir: 1, Suit: -1, Drawn: -1, Winner: -1, Hands: make([][]Card, players)}
	for k := 0; k < HuitDeal; k++ {
		for p := range g.Hands {
			g.Hands[p] = append(g.Hands[p], deck[len(deck)-1])
			deck = deck[:len(deck)-1]
		}
	}
	// The first card that does nothing turned up; the specials met on the way go to the bottom.
	var under []Card
	for len(deck) > 0 {
		c := deck[len(deck)-1]
		deck = deck[:len(deck)-1]
		if !c.special() {
			g.Pile = []Card{c}
			break
		}
		under = append(under, c)
	}
	g.Deck = append(under, deck...)
	return g, nil
}

// Top: the card one plays on (the last one that isn't a joker).
func (g *Huit) Top() Card {
	for i := len(g.Pile) - 1; i >= 0; i-- {
		if !g.Pile[i].Joker() {
			return g.Pile[i]
		}
	}
	return g.Pile[0]
}

func (g *Huit) has(seat int, c Card) int {
	for i, x := range g.Hands[seat] {
		if x == c {
			return i
		}
	}
	return -1
}

// CanPlay: whether seat may put card c down now.
func (g *Huit) CanPlay(seat int, c Card) bool {
	if g.Winner >= 0 || seat != g.Turn || g.has(seat, c) < 0 {
		return false
	}
	if g.Drawn >= 0 && int(c) != g.Drawn {
		return false
	}
	if len(g.Hands[seat]) == 1 && c.wild() {
		return false
	}
	switch {
	case g.Owed > 0 && g.By == 2:
		return c.Rank() == 2 || c.Joker()
	case g.Owed > 0:
		return c.Joker()
	case g.Ace:
		return c.Rank() == 1
	case c.wild():
		return true
	case g.Suit >= 0:
		return c.Suit() == g.Suit
	}
	t := g.Top()
	return c.Suit() == t.Suit() || c.Rank() == t.Rank()
}

// Legal: the cards seat may put down now.
func (g *Huit) Legal(seat int) []Card {
	var out []Card
	if seat < 0 || seat >= len(g.Hands) {
		return out
	}
	for _, c := range g.Hands[seat] {
		if g.CanPlay(seat, c) {
			out = append(out, c)
		}
	}
	return out
}

// draw: n cards for seat, the pile shuffled back in under its top when the deck is out.
func (g *Huit) draw(seat, n int, r *rand.Rand) []Card {
	var got []Card
	for k := 0; k < n; k++ {
		if len(g.Deck) == 0 {
			// Everything but the card played on (and the jokers on it) goes back, shuffled.
			keep := len(g.Pile) - 1
			for keep > 0 && g.Pile[keep].Joker() {
				keep--
			}
			back := append([]Card{}, g.Pile[:keep]...)
			g.Pile = append([]Card{}, g.Pile[keep:]...)
			r.Shuffle(len(back), func(i, j int) { back[i], back[j] = back[j], back[i] })
			g.Deck = back
			if len(g.Deck) == 0 {
				break // every card is in a hand
			}
		}
		c := g.Deck[len(g.Deck)-1]
		g.Deck = g.Deck[:len(g.Deck)-1]
		g.Hands[seat] = append(g.Hands[seat], c)
		got = append(got, c)
	}
	return got
}

// next: the seat after seat, the way round, missing `skip` players.
func (g *Huit) next(seat, skip int) int {
	n := len(g.Hands)
	return ((seat+g.Dir*(1+skip))%n + n) % n
}

// Play: seat puts card c down (suit: the one asked, with an 8; carte: « carte ! » said).
func (g *Huit) Play(seat int, c Card, suit int, carte bool, r *rand.Rand) (HuitStep, error) {
	if g.Winner >= 0 {
		return HuitStep{}, ErrHuitOver
	}
	if seat != g.Turn {
		return HuitStep{}, ErrHuitTurn
	}
	if !g.CanPlay(seat, c) {
		return HuitStep{}, ErrHuitCard
	}
	if c.Rank() == 8 && (suit < 0 || suit > 3) {
		return HuitStep{}, ErrHuitSuit
	}
	i := g.has(seat, c)
	g.Hands[seat] = append(g.Hands[seat][:i], g.Hands[seat][i+1:]...)
	g.Pile = append(g.Pile, c)
	g.Drawn = -1
	step := HuitStep{Seat: seat, Kind: "play", Card: c, Suit: -1, Carte: carte && len(g.Hands[seat]) == 1}
	if len(g.Hands[seat]) == 0 {
		g.Winner = seat
		step.Won = true
		return step, nil
	}
	if len(g.Hands[seat]) == 1 && !carte {
		step.Forgot = true
		step.Cards = g.draw(seat, HuitCarteDraw, r)
		step.Drawn = len(step.Cards)
	}
	skip, again := 0, false
	switch {
	case c.Joker():
		g.Owed, g.By = g.Owed+HuitJokerDraw, 0
	case c.Rank() == 8:
		g.Suit, step.Suit = suit, suit
	default:
		g.Suit = -1
	}
	switch c.Rank() {
	case 2:
		g.Owed, g.By = g.Owed+HuitTwoDraw, 2
	case 1:
		g.Ace = true
	case 7:
		skip = 1
	case 10:
		again = true
	case 11:
		g.Dir = -g.Dir
		again = len(g.Hands) == 2
	}
	if !again {
		g.Turn = g.next(seat, skip)
	}
	return step, nil
}

// Draw: seat draws: what they owe (and their turn goes), or one card, which
// they may put down if it goes (else their turn goes).
func (g *Huit) Draw(seat int, r *rand.Rand) (HuitStep, error) {
	if g.Winner >= 0 {
		return HuitStep{}, ErrHuitOver
	}
	if seat != g.Turn {
		return HuitStep{}, ErrHuitTurn
	}
	if g.Drawn >= 0 {
		return HuitStep{}, ErrHuitDrawn
	}
	step := HuitStep{Seat: seat, Kind: "draw", Suit: -1}
	switch {
	case g.Owed > 0:
		step.Cards = g.draw(seat, g.Owed, r)
		g.Owed = 0
		g.Turn = g.next(seat, 0)
	case g.Ace:
		step.Cards = g.draw(seat, 1, r)
		g.Ace = false
		g.Turn = g.next(seat, 0)
	default:
		step.Cards = g.draw(seat, 1, r)
		if len(step.Cards) == 1 && g.CanPlay(seat, step.Cards[0]) {
			g.Drawn = int(step.Cards[0])
		} else {
			g.Turn = g.next(seat, 0)
		}
	}
	step.Drawn = len(step.Cards)
	return step, nil
}

// Pass: seat keeps the card just drawn.
func (g *Huit) Pass(seat int) (HuitStep, error) {
	if g.Winner >= 0 {
		return HuitStep{}, ErrHuitOver
	}
	if seat != g.Turn {
		return HuitStep{}, ErrHuitTurn
	}
	if g.Drawn < 0 {
		return HuitStep{}, ErrHuitNoPass
	}
	g.Drawn = -1
	g.Turn = g.next(seat, 0)
	return HuitStep{Seat: seat, Kind: "pass", Suit: -1}, nil
}

// HuitBot: what a player of the game does in seat's place: answer an
// attack if it can, else get rid of its cards, keeping its 8s and jokers for
// later, and hitting hard when the next one is close to finishing.
func (g *Huit) HuitBot(seat int, r *rand.Rand) (HuitStep, error) {
	legal := g.Legal(seat)
	if len(legal) == 0 {
		if g.Drawn >= 0 {
			return g.Pass(seat)
		}
		return g.Draw(seat, r)
	}
	hand := g.Hands[seat]
	suits := [4]int{}
	for _, c := range hand {
		if !c.wild() {
			suits[c.Suit()]++
		}
	}
	near := len(g.Hands[g.next(seat, 0)]) <= 2
	best, bestScore := legal[0], -1.0
	for _, c := range legal {
		score := 10.0
		if s := c.Suit(); s >= 0 {
			score += float64(suits[s])
		}
		switch {
		case c.Joker():
			score = 1
			if near || g.Owed > 0 {
				score = 30
			}
		case c.Rank() == 8:
			score = 2
		case c.Rank() == 2, c.Rank() == 7, c.Rank() == 1:
			if near {
				score += 15
			}
			if g.Owed > 0 && c.Rank() == 2 {
				score = 40 // a 2 rather than the joker
			}
		case c.Rank() == 10, c.Rank() == 11:
			score += 2
		}
		score += r.Float64()
		if score > bestScore {
			best, bestScore = c, score
		}
	}
	suit := -1
	if best.Rank() == 8 {
		suit = r.IntN(4)
		for s, n := range suits {
			if n > suits[suit] {
				suit = s
			}
		}
	}
	// « Carte ! », almost always.
	carte := len(hand) != 2 || r.IntN(10) > 0
	return g.Play(seat, best, suit, carte, r)
}
