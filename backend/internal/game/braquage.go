package game

import (
	"math"
	"math/rand/v2"
	"sort"
	"strings"
)

// Les braquages (the update « braquages », closed at first): an adult Sim can rob the till of almost
// any shop (« Braquer la caisse »), on its own, and a bank, with a crew and a plan: the place scouted,
// the gear got ready, then the job itself. Each is played as its little game on the phone (the getaway;
// at a bank the vault first), and the score counts: played well, the police are less likely to catch
// the Sim. Chance stays: the police catch it or not depending on the place (a bank is guarded, a
// boutique isn't), the hour (night is quieter), how near the commissariat is, the Sim's record, whether
// it's already wanted, and for a bank how well the job was prepared.
//
// Caught: prison at the MACA (longer the heavier the record), a fine, a line on the record (which
// closes some careers, social.go). Got away: the loot, within the day's limits (money.go: Djai is sold
// for real money, what play brings stays scarce), and wanted for some hours.
// Never at a school, a church, a mosque, a hospital, a crèche, an orphanage, a home, a police station
// or a public building: only shops, and banks.

// The bank's interactions (catalog.go « banque ») and the till's.
const (
	// BraquerPrefix: the till's robbery at a kind of place is « braquer-<kind> » (one id, one meaning).
	BraquerPrefix  = "braquer-"
	ReperageID     = "reperer-banque"
	PreparationID  = "preparer-braquage"
	BraquerBanque  = "braquer-banque"
	BraquagesKey   = "braquages"
	BanqueKind     = "banque"
	PrisonLabel    = "En prison à la MACA"
	PrisonPlace    = "Maison d'arrêt et de correction d'Abidjan (MACA)"
	WantedMinutes  = 6 * 60
	ScoutValidDays = 3
)

// BraquageTarget: what robbing a kind of place brings and risks.
type BraquageTarget struct {
	// Label: the action's name there.
	Label string
	// Loot: the most and least taken (Djai), before the game's score and the crew's share.
	Loot [2]int
	// Risk: how likely the police are to catch the Sim, before everything else (0–1).
	Risk float64
}

// BraquageTargets: the places that can be robbed, by kind. The others never.
var BraquageTargets = map[string]BraquageTarget{
	"boutique":   {Label: "Braquer la caisse de la boutique", Loot: [2]int{1500, 3500}, Risk: 0.30},
	"station":    {Label: "Braquer la caisse de la station", Loot: [2]int{2000, 4000}, Risk: 0.35},
	"pharmacie":  {Label: "Braquer la caisse de la pharmacie", Loot: [2]int{1500, 3000}, Risk: 0.35},
	"maquis":     {Label: "Braquer la caisse du maquis", Loot: [2]int{1000, 2500}, Risk: 0.25},
	"restaurant": {Label: "Braquer la caisse du restaurant", Loot: [2]int{1500, 3500}, Risk: 0.30},
	"market":     {Label: "Arracher la recette d'une commerçante", Loot: [2]int{800, 2000}, Risk: 0.20},
	"mall":       {Label: "Braquer une caisse du centre commercial", Loot: [2]int{3000, 6000}, Risk: 0.45},
	"cinema":     {Label: "Braquer la billetterie", Loot: [2]int{1500, 3000}, Risk: 0.30},
	"club":       {Label: "Braquer la caisse de la boîte", Loot: [2]int{2000, 4000}, Risk: 0.35},
	"hotel":      {Label: "Braquer la réception de l'hôtel", Loot: [2]int{3000, 6000}, Risk: 0.45},
	"barbier":    {Label: "Braquer la caisse du barbier", Loot: [2]int{700, 1500}, Risk: 0.20},
	"salon":      {Label: "Braquer la caisse du salon", Loot: [2]int{700, 1500}, Risk: 0.20},
	"couture":    {Label: "Braquer la caisse de l'atelier", Loot: [2]int{700, 1500}, Risk: 0.20},
	"gaming":     {Label: "Braquer la caisse de la salle de jeux", Loot: [2]int{1000, 2500}, Risk: 0.25},
	"karting":    {Label: "Braquer la caisse du karting", Loot: [2]int{1500, 3000}, Risk: 0.30},
	// The bank: the big job, with a crew and a plan (the score, the plan and the crew cut the risk).
	BanqueKind: {Label: "Le gros coup : braquer la banque", Loot: [2]int{10000, 15000}, Risk: 0.75},
}

// IsBraquage: an interaction that is a robbery or its preparation.
func IsBraquage(id string) bool {
	return strings.HasPrefix(id, BraquerPrefix) || id == ReperageID || id == PreparationID
}

// BraquerID: the till's robbery at a kind of place.
func BraquerID(kind string) string { return BraquerPrefix + kind }

// BraquageIDs: every robbery and preparation interaction (the update's, features.go; the défi's, sims/defi.go).
func BraquageIDs() []string {
	out := []string{ReperageID, PreparationID, BraquerBanque}
	for kind := range BraquageTargets {
		if kind != BanqueKind {
			out = append(out, BraquerID(kind))
		}
	}
	sort.Strings(out)
	return out
}

// BraquageInteraction: the till's robbery at a kind of place (added to every target's interactions).
func BraquageInteraction(kind string) Interaction {
	t := BraquageTargets[kind]
	return Interaction{ID: BraquerID(kind), Ages: Adults, Label: t.Label, Icon: "siren", Minutes: 20, Effect: Needs{Fun: 10, Energy: -15}}
}

// The bank's own interactions: the everyday ones, the plan's, the job.
var bankInteractions = []Interaction{
	{ID: "banque-guichet", Ages: TeensUp, Label: "Faire la queue au guichet", Icon: "landmark", Minutes: 40, Effect: Needs{Fun: -10, Energy: -5}, MinHour: 8, MaxHour: 16, Days: []int{0, 1, 2, 3, 4, 5}},
	{ID: "banque-gab", Ages: TeensUp, Label: "Retirer au distributeur", Icon: "credit-card", Minutes: 5},
	{ID: "banque-conseiller", Ages: Adults, Label: "Rendez-vous avec le conseiller", Icon: "briefcase", Minutes: 45, Effect: Needs{Social: 5, Fun: -5}, MinHour: 8, MaxHour: 16, Days: []int{0, 1, 2, 3, 4}},
	{ID: ReperageID, Ages: Adults, Label: "Repérer les lieux (les gardes, les caméras, le coffre)", Icon: "eye", Minutes: 60, Effect: Needs{Energy: -10}, MinHour: 8, MaxHour: 16},
	{ID: PreparationID, Ages: Adults, Label: "Préparer le matériel (masques, sacs, la moto de la fuite)", Icon: "package", Minutes: 90, Cost: 4000, Effect: Needs{Energy: -15}},
	{ID: BraquerBanque, Ages: Adults, Label: "Le gros coup : braquer la banque", Icon: "siren", Minutes: 30, Effect: Needs{Fun: 20, Energy: -25}},
}

// BraquageOdds: what goes into the police's chance, and what comes out.
type BraquageOdds struct {
	Kind  string
	Hour  int
	Score int
	// Record: the Sim's arrests so far; Wanted: already wanted for another job.
	Record int
	Wanted bool
	// PoliceMetres: how far the nearest commissariat is (0: none known).
	PoliceMetres float64
	// The bank's plan: scouted, the gear ready, the crew (how many came along).
	Scouted, Prepared bool
	Crew              int
}

// Night: from 22 h to 5 h, quieter (fewer people, fewer patrols).
func Night(hour int) bool { return hour >= 22 || hour < 5 }

// CaughtChance: how likely the police are to catch the Sim (0.08 to 0.92).
func CaughtChance(o BraquageOdds) float64 {
	t, ok := BraquageTargets[o.Kind]
	if !ok {
		return 1
	}
	p := t.Risk + 0.08*float64(o.Record)
	if o.Wanted {
		p += 0.15
	}
	if Night(o.Hour) {
		p -= 0.08
	} else if o.Hour >= 8 && o.Hour < 18 {
		p += 0.05 // broad daylight, the street full
	}
	switch {
	case o.PoliceMetres > 0 && o.PoliceMetres < 400:
		p += 0.15
	case o.PoliceMetres > 0 && o.PoliceMetres < 1000:
		p += 0.05
	}
	// The game, played well: up to a quarter less.
	p -= 0.25 * float64(min(max(o.Score, 0), 100)) / 100
	if o.Kind == BanqueKind {
		if o.Scouted {
			p -= 0.08
		}
		if o.Prepared {
			p -= 0.08
		}
		p -= 0.04 * float64(min(o.Crew, 3))
	}
	return math.Max(0.08, math.Min(0.92, p))
}

// BraquageLoot: what's taken, from the place's range, the more the better it was played; at a bank,
// the crew's share (a sixth each) comes off; by day at a bank (by force) a quarter more.
func BraquageLoot(o BraquageOdds, rng *rand.Rand) int {
	t := BraquageTargets[o.Kind]
	loot := float64(t.Loot[0]+rng.IntN(t.Loot[1]-t.Loot[0]+1)) * (0.6 + 0.4*float64(min(max(o.Score, 0), 100))/100)
	if o.Kind == BanqueKind {
		if !Night(o.Hour) {
			loot *= 1.25
		}
		loot *= 1 - float64(min(o.Crew, 3))/6
	}
	return int(math.Round(loot/50) * 50)
}

// PrisonMinutes: the sentence, longer the heavier the record (two hours, an hour more an arrest, half
// a day at most); a bank's is doubled.
func PrisonMinutes(record int, bank bool) int64 {
	m := int64(120 + 60*record)
	if bank {
		m *= 2
	}
	return min(m, 12*60)
}

// Fine: what the court takes: a part of the money (a quarter, a bank's a third) and a fixed part.
func Fine(money int, bank bool) int {
	if bank {
		return min(money, 5000+money/3)
	}
	return min(money, 2000+money/4)
}

// CrewSize: who comes along on a bank job: the Sim's friends of the bande, and its close friends
// (friendship 60 or more), three at most.
func CrewSize(friends []Friend) int {
	n := 0
	for _, f := range friends {
		if f.Gang || f.Friendship >= 60 {
			n++
		}
	}
	return min(n, 3)
}

func init() {
	// The banks (world.go places of the kind « banque »).
	Kinds[BanqueKind] = PlaceKind{
		ID: BanqueKind, Label: "Banque", Icon: "landmark",
		Interactions: bankInteractions,
		Events: []RandomEvent{
			{Text: "Le vigile te fait passer par le sas, un par un. La file avance doucement.", Effect: Needs{Fun: -5}},
			{Text: "« Le système est en panne, revenez dans une heure. » Tout le monde soupire.", Effect: Needs{Fun: -10, Energy: -5}},
		},
	}
	// Every target's till, added to its interactions (the bank's are its own).
	for kind := range BraquageTargets {
		if kind == BanqueKind {
			continue
		}
		k, ok := Kinds[kind]
		if !ok {
			continue
		}
		k.Interactions = append(k.Interactions, BraquageInteraction(kind))
		Kinds[kind] = k
	}
}
