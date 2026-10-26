package game

import (
	"errors"
	"fmt"
	"math/rand/v2"
	"slices"
)

// Babi Casino (sims/casino.go, web screens/CasinoApp.tsx): the roulette, le
// 21 (blackjack) and the tickets à gratter, played in the phone. The rules
// are the usual ones, played fair: the roulette has its one zero, le 21 the
// table rules of the casinos, the tickets their printed odds. Like every
// game of money here, they take back more than they give (their returns are
// checked by their tests). The game's money only, adults only, CasinoPerDay
// rounds a day an account, the three games together (game.Casino).

// CasinoPerDay: the rounds (a spin, a hand, a ticket) an account may play in a real day.
const CasinoPerDay = 300

/* ---------- La roulette ---------- */

// RouletteBet: a stake on the cloth. Kind: plein (Number 0–36), rouge, noir, pair,
// impair, manque (1–18), passe (19–36), douzaine and colonne (Number 1–3); and the
// numbers together on their lines (Numbers): cheval (2 side by side), transversale
// (a row of 3, or the zero with 1-2 or 2-3), carre (4 at a corner, or 0-1-2-3),
// sixain (two rows): each pays 36 for 1 divided among its numbers.
type RouletteBet struct {
	Kind    string `json:"kind"`
	Number  int    `json:"number,omitempty"`
	Numbers []int  `json:"numbers,omitempty"`
	Stake   int    `json:"stake"`
}

// rouletteGroups: the numbers one may bet together, by kind, keyed by their sorted list.
var rouletteGroups = func() map[string]map[string]bool {
	g := map[string]map[string]bool{"cheval": {}, "transversale": {}, "carre": {}, "sixain": {}}
	add := func(kind string, ns ...int) {
		slices.Sort(ns)
		g[kind][fmt.Sprint(ns)] = true
	}
	for n := 1; n <= 36; n++ {
		if n%3 != 0 {
			add("cheval", n, n+1) // side by side in a row
		}
		if n <= 33 {
			add("cheval", n, n+3) // one above the other
		}
	}
	add("cheval", 0, 1)
	add("cheval", 0, 2)
	add("cheval", 0, 3)
	for r := 1; r <= 34; r += 3 {
		add("transversale", r, r+1, r+2)
		if r <= 31 {
			add("sixain", r, r+1, r+2, r+3, r+4, r+5)
		}
	}
	add("transversale", 0, 1, 2)
	add("transversale", 0, 2, 3)
	for n := 1; n <= 32; n++ {
		if n%3 != 0 {
			add("carre", n, n+1, n+3, n+4)
		}
	}
	add("carre", 0, 1, 2, 3)
	return g
}()

// StakeIn: whether a stake typed by the player is one a game takes: any whole amount
// from its least usual stake to its most (the usual ones are offered in a tap).
func StakeIn(stake int, usual []int) bool {
	return len(usual) > 0 && stake >= usual[0] && stake <= usual[len(usual)-1]
}

// The chips, the most on the cloth at a spin, the most bets at once. A chip of
// any other amount (RouletteChips[0] at least) may be typed.
var RouletteChips = []int{100, 500, 1000, 2000}

const (
	RouletteMaxTotal = 5000
	RouletteMaxBets  = 20
)

// rouletteRed: the red numbers of the wheel.
var rouletteRed = map[int]bool{1: true, 3: true, 5: true, 7: true, 9: true, 12: true, 14: true, 16: true, 18: true, 19: true, 21: true, 23: true, 25: true, 27: true, 30: true, 32: true, 34: true, 36: true}

// RouletteColour: rouge, noir, or vert for the zero.
func RouletteColour(n int) string {
	switch {
	case n == 0:
		return "vert"
	case rouletteRed[n]:
		return "rouge"
	}
	return "noir"
}

var errRouletteBet = fmt.Errorf("mise de roulette inconnue (%d Djai au moins par case)", RouletteChips[0])

// RouletteCheck: a bet that can be placed.
func RouletteCheck(b RouletteBet) error {
	switch b.Kind {
	case "plein":
		if b.Number < 0 || b.Number > 36 {
			return errRouletteBet
		}
	case "rouge", "noir", "pair", "impair", "manque", "passe":
	case "douzaine", "colonne":
		if b.Number < 1 || b.Number > 3 {
			return errRouletteBet
		}
	case "cheval", "transversale", "carre", "sixain":
		ns := slices.Sorted(slices.Values(b.Numbers))
		if !rouletteGroups[b.Kind][fmt.Sprint(ns)] {
			return errRouletteBet
		}
	default:
		return errRouletteBet
	}
	if b.Stake < RouletteChips[0] || b.Stake > RouletteMaxTotal {
		return errRouletteBet
	}
	return nil
}

// RoulettePays: what a bet gets back when the ball stops on n (its stake and its
// winnings; 0 when lost). The zero loses every bet but the plein on it.
func RoulettePays(b RouletteBet, n int) int {
	win := false
	times := 1
	switch b.Kind {
	case "plein":
		win, times = n == b.Number, 35
	case "rouge", "noir":
		win = n != 0 && RouletteColour(n) == b.Kind
	case "pair":
		win = n != 0 && n%2 == 0
	case "impair":
		win = n%2 == 1
	case "manque":
		win = n >= 1 && n <= 18
	case "passe":
		win = n >= 19
	case "douzaine":
		win, times = n != 0 && (n-1)/12+1 == b.Number, 2
	case "colonne":
		win, times = n != 0 && (n-1)%3+1 == b.Number, 2
	case "cheval", "transversale", "carre", "sixain":
		// 36 for 1 among its numbers: 17 to 1, 11 to 1, 8 to 1, 5 to 1.
		win, times = slices.Contains(b.Numbers, n), 36/max(len(b.Numbers), 1)-1
	}
	if !win {
		return 0
	}
	return b.Stake * (times + 1)
}

// SpinRoulette: where the ball stops.
func SpinRoulette(rng *rand.Rand) int { return rng.IntN(37) }

/* ---------- Le 21 (blackjack) ---------- */

// The stakes of a hand.
var BlackjackStakes = []int{100, 500, 1000, 2000, 5000}

// CardPoints: a card's points (0–51: suit × 13 + value − 1): the ace 1 (or 11), the figures 10.
func CardPoints(c int) int { return min(10, c%13+1) }

// HandTotal: a hand's best total, and whether an ace counts 11 in it (soft).
func HandTotal(cards []int) (int, bool) {
	t, aces := 0, 0
	for _, c := range cards {
		t += CardPoints(c)
		if c%13 == 0 {
			aces++
		}
	}
	if aces > 0 && t+10 <= 21 {
		return t + 10, true
	}
	return t, false
}

// IsBlackjack: 21 with the first two cards.
func IsBlackjack(cards []int) bool {
	t, _ := HandTotal(cards)
	return len(cards) == 2 && t == 21
}

// BlackjackHand: a round at the table: the player's hand (or two, once split), the
// dealer's, and the shoe (six decks, shuffled for each round); the shoe and the
// dealer's hidden card stay on the server. When the dealer shows an ace, the
// insurance is offered first (half the stake, paid 2 to 1 if the dealer has a
// blackjack); then the dealer looks at the hidden card (a blackjack ends the round).
// A pair may be split once into two hands, each with the stake again (split aces
// take one card each); a hand of two cards may be doubled.
type BlackjackHand struct {
	// Stake: what was put down at the deal; each hand of a split takes as much again.
	Stake int      `json:"stake"`
	Hands []BJHand `json:"hands"`
	// At: the hand being played.
	At     int   `json:"at"`
	Dealer []int `json:"dealer"`
	Shoe   []int `json:"shoe"`
	// Offer: the insurance offered, not answered yet; Insurance: what was staked on it.
	Offer     bool `json:"offer,omitempty"`
	Insurance int  `json:"insurance,omitempty"`
	Done      bool `json:"done,omitempty"`
	// Result: blackjack, gagne, egalite, perdu, saute (one hand), or the round's
	// over all its hands; Paid: what came back, the insurance's included.
	Result string `json:"result,omitempty"`
	Paid   int    `json:"paid,omitempty"`
	// A hand saved before the split came in (one hand: its cards here).
	Player  []int `json:"player,omitempty"`
	Doubled bool  `json:"doubled,omitempty"`
}

// BJHand: one of the player's hands.
type BJHand struct {
	Cards   []int  `json:"cards"`
	Stake   int    `json:"stake"`
	Doubled bool   `json:"doubled,omitempty"`
	Done    bool   `json:"done,omitempty"`
	Result  string `json:"result,omitempty"`
	Paid    int    `json:"paid,omitempty"`
}

// Normalize: a round saved before the split came in, as one hand.
func (h *BlackjackHand) Normalize() {
	if len(h.Hands) == 0 && len(h.Player) > 0 {
		h.Hands = []BJHand{{Cards: h.Player, Stake: h.Stake, Doubled: h.Doubled, Done: h.Done, Result: h.Result, Paid: h.Paid}}
		if h.Doubled {
			h.Stake /= 2
		}
		h.Player, h.Doubled = nil, false
	}
}

// Staked: all that was put on the table this round (the doubles, the split, the insurance).
func (h *BlackjackHand) Staked() int {
	t := h.Insurance
	for _, x := range h.Hands {
		t += x.Stake
	}
	return t
}

// DealBlackjack: a new round: two cards each. The dealer showing an ace: the insurance
// is offered first; else the dealer looks, and a blackjack on either side ends it at once.
func DealBlackjack(stake int, rng *rand.Rand) *BlackjackHand {
	shoe := make([]int, 0, 6*52)
	for range 6 {
		for c := range 52 {
			shoe = append(shoe, c)
		}
	}
	rng.Shuffle(len(shoe), func(i, j int) { shoe[i], shoe[j] = shoe[j], shoe[i] })
	h := &BlackjackHand{Stake: stake, Shoe: shoe}
	p := []int{h.draw()}
	h.Dealer = []int{h.draw()}
	p = append(p, h.draw())
	h.Dealer = append(h.Dealer, h.draw())
	h.Hands = []BJHand{{Cards: p, Stake: stake}}
	if h.Dealer[0]%13 == 0 && !IsBlackjack(p) {
		h.Offer = true
		return h
	}
	h.peek()
	return h
}

func (h *BlackjackHand) draw() int {
	c := h.Shoe[0]
	h.Shoe = h.Shoe[1:]
	return c
}

var (
	ErrHandOver      = errors.New("cette main est finie : distribue une nouvelle main")
	ErrCantDouble    = errors.New("on ne double que sur les deux premières cartes")
	ErrCantSplit     = errors.New("on ne sépare qu'une paire, une seule fois")
	ErrAnswerFirst   = errors.New("l'assurance d'abord : la prendre ou non ?")
	errUnknownBJMove = errors.New("coup inconnu")
)

// Cost: what a move puts on the table besides what's there (a double, a split, the insurance).
func (h *BlackjackHand) Cost(move string) int {
	switch move {
	case "doubler":
		if h.At < len(h.Hands) {
			return h.Hands[h.At].Stake
		}
	case "separer":
		return h.Stake
	case "assurance":
		return h.Stake / 2
	}
	return 0
}

// Play: assurance or non (the insurance offered), tirer (a card), rester, doubler (the
// stake doubled, one card), separer (a pair split into two hands).
func (h *BlackjackHand) Play(move string) error {
	if h.Done {
		return ErrHandOver
	}
	if h.Offer {
		switch move {
		case "assurance":
			h.Insurance = h.Stake / 2
		case "non":
		default:
			return ErrAnswerFirst
		}
		h.Offer = false
		h.peek()
		return nil
	}
	x := &h.Hands[h.At]
	switch move {
	case "tirer":
		x.Cards = append(x.Cards, h.draw())
		if t, _ := HandTotal(x.Cards); t >= 21 {
			h.next()
		}
	case "rester":
		h.next()
	case "doubler":
		if len(x.Cards) != 2 || (len(h.Hands) > 1 && x.Cards[0]%13 == 0) {
			return ErrCantDouble
		}
		x.Doubled = true
		x.Stake *= 2
		x.Cards = append(x.Cards, h.draw())
		h.next()
	case "separer":
		if !h.CanSplit() {
			return ErrCantSplit
		}
		a, b := x.Cards[0], x.Cards[1]
		h.Hands = []BJHand{{Cards: []int{a, h.draw()}, Stake: h.Stake}, {Cards: []int{b, h.draw()}, Stake: h.Stake}}
		// Split aces: one card each, and that's all.
		if a%13 == 0 {
			h.Hands[0].Done, h.Hands[1].Done = true, true
			h.finish()
		}
	default:
		return errUnknownBJMove
	}
	return nil
}

// CanSplit: a pair of the same card, before anything else is played (and no second split).
func (h *BlackjackHand) CanSplit() bool {
	if h.Done || h.Offer || len(h.Hands) != 1 {
		return false
	}
	c := h.Hands[0].Cards
	return len(c) == 2 && c[0]%13 == c[1]%13
}

// peek: the dealer looks at the hidden card: a blackjack (or the player's) ends the round.
func (h *BlackjackHand) peek() {
	if IsBlackjack(h.Dealer) || IsBlackjack(h.Hands[0].Cards) {
		for i := range h.Hands {
			h.Hands[i].Done = true
		}
		h.finish()
	}
}

// next: this hand is over; on to the next, or the dealer's turn.
func (h *BlackjackHand) next() {
	h.Hands[h.At].Done = true
	for h.At < len(h.Hands) && h.Hands[h.At].Done {
		h.At++
	}
	if h.At >= len(h.Hands) {
		h.finish()
	}
}

// finish: the dealer draws to 17 (standing on a soft 17) unless every hand has gone
// over, each hand is compared and paid (2,5 times for a blackjack, 2 times for a win,
// the stake back on a tie), the insurance paid 3 times if the dealer had a blackjack.
func (h *BlackjackHand) finish() {
	h.Done, h.At = true, max(0, len(h.Hands)-1)
	dealerBJ := IsBlackjack(h.Dealer)
	alive := false
	for _, x := range h.Hands {
		if t, _ := HandTotal(x.Cards); t <= 21 {
			alive = true
		}
	}
	split := len(h.Hands) > 1
	if alive && !dealerBJ && !(len(h.Hands) == 1 && IsBlackjack(h.Hands[0].Cards)) {
		for {
			d, _ := HandTotal(h.Dealer)
			if d >= 17 {
				break
			}
			h.Dealer = append(h.Dealer, h.draw())
		}
	}
	d, _ := HandTotal(h.Dealer)
	h.Paid = 0
	for i := range h.Hands {
		x := &h.Hands[i]
		p, _ := HandTotal(x.Cards)
		bj := !split && IsBlackjack(x.Cards)
		switch {
		case bj && dealerBJ:
			x.Result, x.Paid = "egalite", x.Stake
		case bj:
			x.Result, x.Paid = "blackjack", x.Stake*5/2
		case dealerBJ:
			x.Result = "perdu"
		case p > 21:
			x.Result = "saute"
		case d > 21 || p > d:
			x.Result, x.Paid = "gagne", x.Stake*2
		case p == d:
			x.Result, x.Paid = "egalite", x.Stake
		default:
			x.Result = "perdu"
		}
		h.Paid += x.Paid
	}
	if dealerBJ && h.Insurance > 0 {
		h.Paid += h.Insurance * 3
	}
	// The round's word: one hand's own; over two, how the whole came out.
	staked := h.Staked()
	switch {
	case !split && h.Insurance == 0:
		h.Result = h.Hands[0].Result
	case h.Paid > staked:
		h.Result = "gagne"
	case h.Paid == staked:
		h.Result = "egalite"
	default:
		h.Result = "perdu"
	}
}

// BlackjackView: a round as the player sees it: the dealer's second card hidden till the end.
type BlackjackView struct {
	Stake int      `json:"stake"`
	Hands []BJHand `json:"hands"`
	At    int      `json:"at"`
	// Player, Total: the hand being played (the last, after the round).
	Player    []int  `json:"player"`
	Total     int    `json:"total"`
	Dealer    []int  `json:"dealer"`
	Shown     int    `json:"shown"`
	Doubled   bool   `json:"doubled,omitempty"`
	Offer     bool   `json:"offer,omitempty"`
	Insurance int    `json:"insurance,omitempty"`
	CanSplit  bool   `json:"canSplit,omitempty"`
	Staked    int    `json:"staked"`
	Done      bool   `json:"done"`
	Result    string `json:"result,omitempty"`
	Paid      int    `json:"paid,omitempty"`
}

func (h *BlackjackHand) View() BlackjackView {
	h.Normalize()
	at := min(h.At, len(h.Hands)-1)
	x := h.Hands[at]
	v := BlackjackView{Stake: h.Stake, Hands: h.Hands, At: at, Player: x.Cards, Dealer: h.Dealer, Doubled: x.Doubled, Offer: h.Offer, Insurance: h.Insurance, CanSplit: h.CanSplit(), Staked: h.Staked(), Done: h.Done, Result: h.Result, Paid: h.Paid}
	v.Total, _ = HandTotal(x.Cards)
	if !h.Done {
		v.Dealer = h.Dealer[:1]
	}
	v.Shown, _ = HandTotal(v.Dealer)
	return v
}

/* ---------- Les tickets à gratter ---------- */

// ScratchPrize: an amount on a ticket, and its odds: one ticket in Odds wins it.
type ScratchPrize struct {
	Amount int `json:"amount"`
	Odds   int `json:"odds"`
}

// ScratchTicket: a kind of ticket. Three times the same amount among its nine cells wins it.
type ScratchTicket struct {
	ID     string         `json:"id"`
	Name   string         `json:"name"`
	About  string         `json:"about"`
	Price  int            `json:"price"`
	Prizes []ScratchPrize `json:"prizes"`
}

// ScratchTickets: from the cheapest to the dearest.
var ScratchTickets = []ScratchTicket{
	{ID: "pinda", Name: "Pinda", About: "Le petit ticket : trois fois la même somme, tu la gagnes.", Price: 200,
		Prizes: []ScratchPrize{{200, 5}, {400, 10}, {1000, 40}, {2000, 150}, {10000, 2500}, {50000, 50000}}},
	{ID: "akwaba", Name: "Akwaba", About: "Le ticket du milieu : jusqu'à 250 000 Djai.", Price: 500,
		Prizes: []ScratchPrize{{500, 5}, {1000, 9}, {2500, 40}, {5000, 120}, {25000, 2500}, {250000, 250000}}},
	{ID: "banco", Name: "Super Banco", About: "Le grand ticket : jusqu'à 500 000 Djai.", Price: 1000,
		Prizes: []ScratchPrize{{1000, 5}, {2000, 9}, {5000, 35}, {10000, 120}, {50000, 4000}, {500000, 400000}}},
}

// FindScratch: a ticket by its id.
func FindScratch(id string) (ScratchTicket, bool) {
	for _, t := range ScratchTickets {
		if t.ID == id {
			return t, true
		}
	}
	return ScratchTicket{}, false
}

// Scratch: a ticket's nine cells, row by row, and what it wins (0: nothing). A
// winning ticket shows its amount three times and no other amount three times; a
// losing one shows no amount three times.
func Scratch(t ScratchTicket, rng *rand.Rand) ([9]int, int) {
	prize := 0
	u := rng.Float64()
	for i := len(t.Prizes) - 1; i >= 0; i-- {
		p := 1 / float64(t.Prizes[i].Odds)
		if u < p {
			prize = t.Prizes[i].Amount
			break
		}
		u -= p
	}
	amounts := make([]int, len(t.Prizes))
	for i, p := range t.Prizes {
		amounts[i] = p.Amount
	}
	var cells []int
	if prize > 0 {
		cells = []int{prize, prize, prize}
	}
	// The rest: other amounts, never three of a kind (the prize itself no more).
	count := map[int]int{prize: len(cells)}
	for len(cells) < 9 {
		a := amounts[rng.IntN(len(amounts))]
		if a == prize && prize > 0 || count[a] >= 2 {
			continue
		}
		count[a]++
		cells = append(cells, a)
	}
	rng.Shuffle(len(cells), func(i, j int) { cells[i], cells[j] = cells[j], cells[i] })
	var grid [9]int
	copy(grid[:], cells)
	return grid, prize
}

// ScratchReturn: what a ticket gives back for 1 paid, on average (from its printed odds).
func ScratchReturn(t ScratchTicket) float64 {
	back := 0.0
	for _, p := range t.Prizes {
		back += float64(p.Amount) / float64(p.Odds)
	}
	return back / float64(t.Price)
}

// ScratchWinChance: how often a ticket wins something.
func ScratchWinChance(t ScratchTicket) float64 {
	k := 0.0
	for _, p := range t.Prizes {
		k += 1 / float64(p.Odds)
	}
	return k
}
