package game

import "math/rand/v2"

// Les machines à sous (sims/machine.go): three reels, one line, the game's
// money only. Like the bets and the loto, they take back more than they give
// over time (SlotsReturn, checked by its test): a sink with a little luck in
// it, never a way to earn. Adults only, a few hundred spins a day at most.

// SlotSymbol: a picture on the reels, how often it comes up, what three of
// it and two of it (on the first two reels) pay, times the stake.
type SlotSymbol struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Weight int    `json:"-"`
	Three  int    `json:"three"`
	Two    int    `json:"two"`
}

// SlotSymbols: from the commonest to the jackpot. The same on each reel.
var SlotSymbols = []SlotSymbol{
	{ID: "mangue", Label: "Mangue", Weight: 10, Three: 5, Two: 1},
	{ID: "banane", Label: "Banane", Weight: 8, Three: 8, Two: 2},
	{ID: "coco", Label: "Coco", Weight: 6, Three: 15, Two: 2},
	{ID: "cacao", Label: "Cabosse de cacao", Weight: 4, Three: 30, Two: 3},
	{ID: "elephant", Label: "Éléphant", Weight: 3, Three: 60, Two: 5},
	{ID: "sept", Label: "7", Weight: 1, Three: 200, Two: 20},
}

// SlotSeven: a single 7 anywhere (no pair, no three) gives the stake back.
const SlotSeven = "sept"

// SlotsPerDay: the spins an account may make in a real day (game.Slots).
const SlotsPerDay = 200

// Where the machines are, and the stakes each takes: small ones at the
// maquis, bigger ones at the Hôtel Ivoire's casino.
const (
	SlotsMaquisID = "machine-maquis"
	SlotsCasinoID = "machine-casino"
)

// SlotStakes: the stakes a machine takes, by interaction.
var SlotStakes = map[string][]int{
	SlotsMaquisID: {100, 200, 500},
	SlotsCasinoID: {500, 1000, 2000},
}

// IsSlots: whether an interaction is playing a slot machine.
func IsSlots(id string) bool {
	_, ok := SlotStakes[id]
	return ok
}

// SlotSession: at a machine (Activity.Machine), the session so far: the
// last spin, its stake, the spins, what was staked and won.
type SlotSession struct {
	Last   *SlotSpin `json:"last,omitempty"`
	Stake  int       `json:"stake"`
	Spins  int       `json:"spins"`
	Staked int       `json:"staked"`
	Won    int       `json:"won"`
}

// SlotSpin: what the reels show, and the multiple of the stake won (0: lost).
type SlotSpin struct {
	Reels [3]string `json:"reels"`
	Times int       `json:"times"`
	// Line: what was won, said (« Trois cabosses de cacao ! »), or "".
	Line string `json:"line,omitempty"`
}

// slotTotal: the weights together.
func slotTotal() int {
	t := 0
	for _, s := range SlotSymbols {
		t += s.Weight
	}
	return t
}

// slotDraw: one reel's picture.
func slotDraw(rng *rand.Rand) string {
	n := rng.IntN(slotTotal())
	for _, s := range SlotSymbols {
		if n < s.Weight {
			return s.ID
		}
		n -= s.Weight
	}
	return SlotSymbols[0].ID
}

// Spin: the three reels turned.
func Spin(rng *rand.Rand) SlotSpin {
	r := [3]string{slotDraw(rng), slotDraw(rng), slotDraw(rng)}
	times, line := SlotPays(r)
	return SlotSpin{Reels: r, Times: times, Line: line}
}

// SlotPays: what three pictures pay, times the stake, and the line said.
func SlotPays(r [3]string) (int, string) {
	sym := func(id string) SlotSymbol {
		for _, s := range SlotSymbols {
			if s.ID == id {
				return s
			}
		}
		return SlotSymbol{}
	}
	a := sym(r[0])
	switch {
	case r[0] == r[1] && r[1] == r[2]:
		if a.ID == SlotSeven {
			return a.Three, "777 : JACKPOT !"
		}
		return a.Three, "Trois " + plural(a) + " !"
	case r[0] == r[1]:
		return a.Two, "Deux " + plural(a)
	case r[0] == SlotSeven || r[1] == SlotSeven || r[2] == SlotSeven:
		return 1, "Un 7 : ta mise revient"
	}
	return 0, ""
}

// plural: a symbol's name, several of it.
func plural(s SlotSymbol) string {
	switch s.ID {
	case "cacao":
		return "cabosses de cacao"
	case "elephant":
		return "éléphants"
	case SlotSeven:
		return "7"
	}
	return LowerFirst(s.Label) + "s"
}

// SlotsReturn: what the machines give back for 1 staked, on average (every
// combination of the reels, weighed), and how often a spin wins something.
func SlotsReturn() (float64, float64) {
	total := float64(slotTotal())
	var back, hits float64
	for _, a := range SlotSymbols {
		for _, b := range SlotSymbols {
			for _, c := range SlotSymbols {
				p := float64(a.Weight) * float64(b.Weight) * float64(c.Weight) / (total * total * total)
				times, _ := SlotPays([3]string{a.ID, b.ID, c.ID})
				back += p * float64(times)
				if times > 0 {
					hits += p
				}
			}
		}
	}
	return back, hits
}
