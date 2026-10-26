package game

import "math"

// The casino's « taux de retour » (backend odds/, the admin's « Casino » tab):
// what the money games give back, on average, for 1 staked. Untouched, each
// game gives back its own (Natural); the team may set a level for all of them
// and one for any game, between OddsMin and OddsMax, the same for every
// player, from the next round. Each game's « Règles » says it, never hidden:
// the slots, the tickets and bingo pay their prizes scaled (Scaled), L'Envol
// flies off sooner or later (P(≥ x) = rate / x), Babi Trade pays 2 × rate,
// the roulette and le 21 keep their classic payouts and take a commission on
// the net winnings, said with the result.

const (
	OddsMin = 0.70
	OddsMax = 0.97
)

// The games a rate is set for (the admin's ids).
const (
	OddsMachines = "machines"
	OddsTickets  = "tickets"
	OddsBingo    = "bingo"
	OddsEnvol    = "envol"
	OddsTrade    = "trade"
	OddsRoulette = "roulette"
	Odds21       = "21"
)

// OddsGames: the games, in the casino's order, and their names.
var OddsGames = []struct{ ID, Label string }{
	{OddsMachines, "Machines à sous"},
	{OddsTickets, "Tickets à gratter"},
	{OddsBingo, "Babi Bingo"},
	{OddsEnvol, "L'Envol"},
	{OddsTrade, "Babi Trade"},
	{OddsRoulette, "Roulette"},
	{Odds21, "Le 21"},
}

// BingoNatural: what each bingo room gives back untouched (BingoReturn over 200 000 cards: too slow
// to work out on a request, checked by the test).
var BingoNatural = map[string]float64{Bingo75: 0.8485, Loto90: 0.8539, Bingo80: 0.8651, Eclair: 0.8618}

// Blackjack21: le 21 untouched, played by the basic strategy (the test's): what it gives back, and the share of
// the staked that comes back as net winnings (what the commission is taken on).
const (
	Blackjack21Return = 0.985
	Blackjack21Gains  = 0.4577
)

// RouletteNatural: the roulette's, any bet (36 for 37 numbers).
const RouletteNatural = 36.0 / 37

// Natural: what a game gives back untouched, on the whole (the tickets and the rooms each have their own: NaturalOf).
func Natural(game string) float64 {
	switch game {
	case OddsMachines:
		r, _ := SlotsReturn()
		return r
	case OddsTickets:
		t := 0.0
		for _, x := range ScratchTickets {
			t += ScratchReturn(x)
		}
		return t / float64(len(ScratchTickets))
	case OddsBingo:
		t := 0.0
		for _, v := range BingoNatural {
			t += v
		}
		return t / float64(len(BingoNatural))
	case OddsEnvol:
		return EnvolReturn
	case OddsTrade:
		return TradePays / 2
	case OddsRoulette:
		return RouletteNatural
	case Odds21:
		return Blackjack21Return
	}
	return 1
}

// Scaled: a prize paid at a rate, for a game (or a ticket, a room) whose own is `natural`: the same untouched.
func Scaled(amount int, rate, natural float64) int {
	if rate <= 0 || natural <= 0 || math.Abs(rate-natural) < 1e-9 {
		return amount
	}
	return int(math.Floor(float64(amount) * rate / natural))
}

// RouletteCommission: the share of a winning bet's net winnings the house keeps at a rate, for a bet paying
// `times` to 1 (0 untouched or above the roulette's own).
func RouletteCommission(rate float64, times int) float64 {
	if rate <= 0 || rate >= RouletteNatural || times <= 0 {
		return 0
	}
	c := 1 - ((rate/RouletteNatural)*float64(times+1)-1)/float64(times)
	return math.Max(0, math.Min(1, c))
}

// Commission21: the share of le 21's net winnings the house keeps at a rate (0 untouched or above its own).
func Commission21(rate float64) float64 {
	if rate <= 0 || rate >= Blackjack21Return {
		return 0
	}
	return math.Min(1, (Blackjack21Return-rate)/Blackjack21Gains)
}

// TradePaysAt: what a right call pays, times the stake, at a rate (untouched: TradePays).
func TradePaysAt(rate float64) float64 {
	if rate <= 0 {
		return TradePays
	}
	return 2 * rate
}

// ScratchAt: a ticket with its prizes at a rate (rounded down to 10 Djai; untouched: as printed).
func ScratchAt(t ScratchTicket, rate float64) ScratchTicket {
	nat := ScratchReturn(t)
	if rate <= 0 || math.Abs(rate-nat) < 1e-9 {
		return t
	}
	out := t
	out.Prizes = make([]ScratchPrize, len(t.Prizes))
	for i, p := range t.Prizes {
		out.Prizes[i] = ScratchPrize{Amount: Scaled(p.Amount, rate, nat) / 10 * 10, Odds: p.Odds}
	}
	return out
}
