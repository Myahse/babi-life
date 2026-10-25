package game

import (
	"errors"
	"math/rand/v2"
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
// impair, manque (1–18), passe (19–36), douzaine and colonne (Number 1–3).
type RouletteBet struct {
	Kind   string `json:"kind"`
	Number int    `json:"number,omitempty"`
	Stake  int    `json:"stake"`
}

// The chips, the most on the cloth at a spin, the most bets at once.
var RouletteChips = []int{100, 500, 1000, 2000}

const (
	RouletteMaxTotal = 5000
	RouletteMaxBets  = 10
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

var errRouletteBet = errors.New("mise de roulette inconnue")

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
	default:
		return errRouletteBet
	}
	if b.Stake <= 0 || b.Stake%100 != 0 {
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

// BlackjackHand: a hand being played. The shoe (six decks, shuffled for each hand)
// and the dealer's hidden card stay on the server.
type BlackjackHand struct {
	Stake   int   `json:"stake"`
	Player  []int `json:"player"`
	Dealer  []int `json:"dealer"`
	Shoe    []int `json:"shoe"`
	Doubled bool  `json:"doubled,omitempty"`
	Done    bool  `json:"done,omitempty"`
	// Result: blackjack, gagne, egalite, perdu, saute (over 21); Paid: what came back.
	Result string `json:"result,omitempty"`
	Paid   int    `json:"paid,omitempty"`
}

// DealBlackjack: a new hand: two cards each; a blackjack on either side ends it at once.
func DealBlackjack(stake int, rng *rand.Rand) *BlackjackHand {
	shoe := make([]int, 0, 6*52)
	for range 6 {
		for c := range 52 {
			shoe = append(shoe, c)
		}
	}
	rng.Shuffle(len(shoe), func(i, j int) { shoe[i], shoe[j] = shoe[j], shoe[i] })
	h := &BlackjackHand{Stake: stake, Shoe: shoe}
	h.Player = []int{h.draw(), h.draw()}
	h.Dealer = []int{h.draw(), h.draw()}
	if IsBlackjack(h.Player) || IsBlackjack(h.Dealer) {
		h.settle()
	}
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
	errUnknownBJMove = errors.New("coup inconnu")
)

// Play: tirer (a card), rester (the dealer plays), doubler (the stake doubled, one card, then the dealer).
func (h *BlackjackHand) Play(move string) error {
	if h.Done {
		return ErrHandOver
	}
	switch move {
	case "tirer":
		h.Player = append(h.Player, h.draw())
		if t, _ := HandTotal(h.Player); t >= 21 {
			h.settle()
		}
	case "rester":
		h.settle()
	case "doubler":
		if len(h.Player) != 2 {
			return ErrCantDouble
		}
		h.Doubled = true
		h.Stake *= 2
		h.Player = append(h.Player, h.draw())
		h.settle()
	default:
		return errUnknownBJMove
	}
	return nil
}

// settle: the dealer draws to 17 (standing on a soft 17), the hands are compared,
// the hand paid: 2,5 times the stake for a blackjack, 2 times for a win, the stake back on a tie.
func (h *BlackjackHand) settle() {
	h.Done = true
	p, _ := HandTotal(h.Player)
	switch {
	case IsBlackjack(h.Player) && IsBlackjack(h.Dealer):
		h.Result, h.Paid = "egalite", h.Stake
		return
	case IsBlackjack(h.Player):
		h.Result, h.Paid = "blackjack", h.Stake*5/2
		return
	case IsBlackjack(h.Dealer):
		h.Result = "perdu"
		return
	case p > 21:
		h.Result = "saute"
		return
	}
	for {
		d, _ := HandTotal(h.Dealer)
		if d >= 17 {
			break
		}
		h.Dealer = append(h.Dealer, h.draw())
	}
	d, _ := HandTotal(h.Dealer)
	switch {
	case d > 21 || p > d:
		h.Result, h.Paid = "gagne", h.Stake*2
	case p == d:
		h.Result, h.Paid = "egalite", h.Stake
	default:
		h.Result = "perdu"
	}
}

// BlackjackView: a hand as the player sees it: the dealer's second card hidden till the end.
type BlackjackView struct {
	Stake   int    `json:"stake"`
	Player  []int  `json:"player"`
	Dealer  []int  `json:"dealer"`
	Total   int    `json:"total"`
	Shown   int    `json:"shown"`
	Doubled bool   `json:"doubled,omitempty"`
	Done    bool   `json:"done"`
	Result  string `json:"result,omitempty"`
	Paid    int    `json:"paid,omitempty"`
}

func (h *BlackjackHand) View() BlackjackView {
	v := BlackjackView{Stake: h.Stake, Player: h.Player, Dealer: h.Dealer, Doubled: h.Doubled, Done: h.Done, Result: h.Result, Paid: h.Paid}
	v.Total, _ = HandTotal(h.Player)
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
