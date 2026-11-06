package game

import "slices"

// Le mode vie's wishes (« envies », the update « mode-vie », sims/envies.go; web components/Envies.tsx):
// small wants a Sim has for a while, up to three at a time, drawn from who it is (its traits, its
// aspiration, its age), how it feels (its mood, its needs), what it's good at and whom it knows. One
// fulfilled brings « points de bonheur » and a short good mood; the points buy perks for good (needs that
// hold better, skills learned faster, a cheaper taxi, a longer queue). All of it is the server's.

// Wish: one want: what it's called (Label, Icon), what fulfils it (Goal: "do:<action>", "place:<kind>",
// "train:<skill>", "skill:<skill>" (a level, Level), "chat:<friend id>", "excuse:<friend id>",
// "flirt:<friend id>", "kin" (a word with papa or maman), "player" (a word with another player),
// "mood:<moodlet>", "buy:<furniture>", "win:dames", "fun"), what it brings (Points) and until when
// (game minute; it goes by itself after).
type Wish struct {
	Goal   string `json:"goal"`
	Label  string `json:"label"`
	Icon   string `json:"icon"`
	Points int    `json:"points"`
	Until  int64  `json:"until"`
	Level  int    `json:"level,omitempty"`
	// Weight: how much it's wanted among the others offered (not kept).
	Weight float64 `json:"-"`
}

const (
	// MaxWishes: at most this many at once.
	MaxWishes = 3
	// WishLife: a wish lasts this long (game minutes) if not fulfilled, then another comes.
	WishLife = 8 * 60
	// WishGap: a slot left empty (fulfilled, gone) fills again this long after.
	WishGap = 12
	// WishSwaps: the wishes that can be changed a game day.
	WishSwaps = 3
)

// Perk: a lasting reward bought with points de bonheur.
type Perk struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Hint  string `json:"hint"`
	Icon  string `json:"icon"`
	Cost  int    `json:"cost"`
}

// Perks: the rewards shop, cheapest first.
var Perks = []Perk{
	{ID: "envie-plus", Label: "Envies au choix", Hint: "Deux envies de plus à changer chaque jour", Icon: "refresh-cw", Cost: 80},
	{ID: "file-plus", Label: "Une file plus longue", Hint: "Un ordre de plus dans la file du mode vie", Icon: "list-plus", Cost: 120},
	{ID: "taxi-ami", Label: "Taxi moins cher", Hint: "Taxi, woro-woro, gbaka et moto : 20 % de moins", Icon: "car-taxi-front", Cost: 180},
	{ID: "apprenti", Label: "Apprend vite", Hint: "Les compétences montent 25 % plus vite", Icon: "graduation-cap", Cost: 240},
	{ID: "besoins-lents", Label: "Besoins solides", Hint: "Les besoins baissent 15 % moins vite", Icon: "shield", Cost: 300},
}

// PerkOf: the perk `id`, false for none.
func PerkOf(id string) (Perk, bool) {
	i := slices.IndexFunc(Perks, func(p Perk) bool { return p.ID == id })
	if i < 0 {
		return Perk{}, false
	}
	return Perks[i], true
}

// Perk effects.
const (
	// SlowNeeds: with « besoins-lents », the share of the needs' decay that's felt.
	SlowNeeds = 0.85
	// FastSkills: with « apprenti », the skills' points multiplied.
	FastSkills = 1.25
	// TaxiOff: with « taxi-ami », the percent off a ride.
	TaxiOff = 20
	// SwapsPlus: with « envie-plus », the extra wishes changed a day.
	SwapsPlus = 2
)

// PickWish: one of the wishes offered, by their weights (r in [0,1)); -1 when there's none.
func PickWish(offer []Wish, r float64) int {
	total := 0.0
	for _, w := range offer {
		total += max(0, w.Weight)
	}
	if total <= 0 {
		return -1
	}
	r *= total
	for i, w := range offer {
		if r -= max(0, w.Weight); r < 0 {
			return i
		}
	}
	return len(offer) - 1
}
