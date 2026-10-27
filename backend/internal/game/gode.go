package game

import "math/rand/v2"

// Le godé, as it's played at the maquis: two players, one die each, shaken
// in the godet. The first throws, sees his die, and says « mon grand » or
// « mon petit » for both: with « grand » the higher die wins, with « petit »
// the lower. Then the other throws. The same: both throw again (the call
// stays). They stake every round.
//
// The one who throws first, choosing after seeing his die, wins three times
// in four; so against the game's players the first throw goes to each in
// turn, round after round, and over two rounds neither has the edge.

const (
	GodeGrand = "grand"
	GodePetit = "petit"
	// GodeMax: the most put on a round against the game's players; GodePerDay: rounds a day.
	GodeMax    = 2000
	GodePerDay = 120
)

// GodeRoll: a die, 1 to 6.
func GodeRoll(r *rand.Rand) int { return 1 + r.IntN(6) }

// GodeCallFor: the best call on a die (what the game's players say): « grand » from 4, « petit » under.
func GodeCallFor(die int) string {
	if die >= 4 {
		return GodeGrand
	}
	return GodePetit
}

// GodeBeats: 1 when die a wins under the call, -1 when b does, 0 the same (they throw again).
func GodeBeats(call string, a, b int) int {
	switch {
	case a == b:
		return 0
	case (a > b) == (call == GodeGrand):
		return 1
	default:
		return -1
	}
}
