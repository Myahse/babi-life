package game

import (
	"math/rand/v2"
	"slices"
)

// Born, then played grown up (the update « naitre-adulte », sims/naitre.go; web components/Souvenirs.tsx):
// childhood is no longer played. After the birth, the player answers « Souvenirs d'enfance » (where they
// grew up, their school, their friend from childhood, what they were like as a child) and the Sim starts
// at 18 through the usual coming of age (sims comeOfAge). The family stays drawn at birth (BornInto); the
// first souvenir only nudges it a little (NudgeFamily).

// NaitreKey: the update.
const NaitreKey = "naitre-adulte"

// Where one grew up (the first souvenir).
const (
	GrewCour    = "cour"    // a cour commune: the quarter's network
	GrewVilla   = "villa"   // a villa: a family a little better off, more money to start
	GrewVillage = "village" // the village, then Abidjan: one more language, a little savings
)

// GrewUp: the three answers, in the order they're shown.
var GrewUp = []string{GrewCour, GrewVilla, GrewVillage}

// NudgeChance: how often the first souvenir moves the family one step: the draw stays a draw.
const NudgeChance = 1.0 / 3

// NudgeFamily: the family drawn at birth, nudged by where the Sim grew up. A villa may lift it one step
// (« papa's business took off »); a cour commune may lift a family of the precarious quarters (gnambro)
// to coulé (the cour's solidarity), never lowers anyone; the village leaves it as it is. Two times in three
// nothing moves. Returns the family and whether it moved.
func NudgeFamily(f Family, grew string, rng *rand.Rand) (Family, bool) {
	i := slices.IndexFunc(Families, func(x Family) bool { return x.ID == f.ID })
	if i < 0 || rng.Float64() >= NudgeChance {
		return f, false
	}
	switch {
	case grew == GrewVilla && i > 0:
		return Families[i-1], true
	case grew == GrewCour && f.ID == "gnambro":
		return Families[i-1], true
	}
	return f, false
}

// Schooling (the second souvenir): where one stopped.
const (
	SchoolCM2  = "cm2"  // stopped after primary school: worked young, the most savings
	SchoolBEPC = "bepc" // the BEPC: some savings
	SchoolBac  = "bac"  // the bac: the diplomas and the family's gift for it (Family.BacGift)
)

var Schoolings = []string{SchoolCM2, SchoolBEPC, SchoolBac}

// SchoolSavings: what years of small jobs instead of school put aside, at 18: half the family's start
// after the CM2, a quarter after the BEPC, nothing with the bac (the bac brings the family's gift and the
// diplomas instead, and the bac is what the university asks for).
func SchoolSavings(f Family, school string) int {
	switch school {
	case SchoolCM2:
		return f.Start / 2 / 100 * 100
	case SchoolBEPC:
		return f.Start / 4 / 100 * 100
	}
	return 0
}

// VillaBonus: a villa childhood not nudged (or already at the top): a little more to start, a tenth of the
// family's start. VillageSavings: the village child's débrouille.
func VillaBonus(f Family) int { return f.Start / 10 / 100 * 100 }

const VillageSavings = 3000

// VillageLanguages: the languages a village childhood may bring (not English).
func VillageLanguages() []string {
	var out []string
	for _, l := range Languages {
		if l.ID != "anglais" {
			out = append(out, l.ID)
		}
	}
	return out
}

// CourNeighbours: the friends of the cour commune (the quarter's network), grown up beside the Sim.
const CourNeighbours = 2

// Neighbour: one of the cour's people, a friend already (sims/naitre.go).
func Neighbour(simID, commune string, i int, now int64, rng *rand.Rand) Friend {
	g, names := "femme", girls
	if rng.IntN(2) == 0 {
		g, names = "homme", boys
	}
	id := simID
	if len(id) > 8 {
		id = id[:8]
	}
	return Friend{ID: "p-voisin-" + id + "-" + string(rune('a'+i)), Name: names[rng.IntN(len(names))], Gender: g, Seed: rng.IntN(1 << 20), Commune: commune, Friendship: 40, Met: now, Seen: now, Adult: true}
}

// FriendChoices: the three friends from childhood offered (the third souvenir), the same each time for a Sim.
func FriendChoices(simID, commune string, now int64) []Friend {
	seed := uint64(0)
	for _, c := range simID {
		seed = seed*131 + uint64(c)
	}
	out := make([]Friend, 0, 3)
	for i := range 3 {
		f := ChildhoodFriend(simID, commune, now, rand.New(rand.NewPCG(seed, uint64(i+1))))
		// Three different names.
		for k := 2; slices.ContainsFunc(out, func(o Friend) bool { return o.Name == f.Name }); k++ {
			f = ChildhoodFriend(simID, commune, now, rand.New(rand.NewPCG(seed, uint64(i+1+10*k))))
		}
		// Each its own id (the app draws the face from it: web game/childhood.ts).
		f.ID += "-" + string(rune('a'+i))
		out = append(out, f)
	}
	return out
}

// ChildTraits: « Petit, tu étais… » (the fourth souvenir): the toy one went for (sims.Talents' ids) and the
// trait it leaves the adult. The book, which gave the baby marks ahead for the bac, makes a worker.
var ChildTraits = map[string]string{"ballon": "sportif", "tamtam": "artiste", "livre": "travailleur", "telephone": "dragueur"}

// PionnierRate: Djai per F CFA, the shop's best pack's rate (shop.Packs, le grotto: 1 120 000 Djai for
// 10 000 F); PionnierStep: the gift rounded up to it.
const (
	PionnierRate = 112
	PionnierStep = 50_000
)

// PionnierDjai: what a player who paid `paid` F CFA to grow up at once (« grandir vite », gone with this
// update) is given back in Djai: the paid sum at the shop's best rate, rounded up to the next 50 000.
func PionnierDjai(paid int) int {
	if paid <= 0 {
		return 0
	}
	return (paid*PionnierRate + PionnierStep - 1) / PionnierStep * PionnierStep
}

// PionnierAccessory: the accessory only the pionniers wear (never sold).
const PionnierAccessory = "pin-pionnier"
