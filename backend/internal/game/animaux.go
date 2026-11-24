package game

import (
	"math"
	"time"
)

// Les animaux (the update « animaux », sims/animaux.go; web components/AnimauxApp.tsx, world3d/pets.tsx):
// a Sim's own animals, as in a life game: the dog (a guard, the walk), the cat (the purr on the bed), the
// hens of the yard (their eggs), the Tabaski sheep (fattened for the feast, or sold before it). Each has
// its hunger and its spirits that go down with the real hours, a bond with its owner that grows with the
// care given, and a name. Left hungry a whole day, it runs off: it's searched for in the quartier.
// Everything here is the catalogue and the rules; the server keeps the animals.

// AnimauxKey: the update that brings them (features.go).
const AnimauxKey = "animaux"

// FromAnimaux: what the animals bring in (the eggs sold, the sheep sold), within the day's cap (money.go).
const FromAnimaux Income = "animaux"

// PetKind: an animal one can have.
type PetKind struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	// Price: to adopt it (the dog and the cat from a litter, the hens and the sheep at the market).
	Price int `json:"price"`
	// Food: what a meal costs, and what it's called.
	Food      int    `json:"food"`
	FoodLabel string `json:"foodLabel"`
	// Hunger, Spirits: what they lose an hour (out of 100).
	Hunger  float64 `json:"-"`
	Spirits float64 `json:"-"`
	About   string  `json:"about"`
	// Names: a few to pick from (or one's own).
	Names []string `json:"names"`
	// Acts: what's done with it, beyond feeding.
	Acts []PetAct `json:"acts"`
}

// PetAct: something done with an animal: what it does to it and to the Sim.
type PetAct struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	// Spirits, Bond: what it does to the animal; Sim: to its owner.
	Spirits float64 `json:"-"`
	Bond    int     `json:"-"`
	Sim     Needs   `json:"-"`
	// Every: at most once in so many real minutes (0: whenever).
	Every int `json:"every,omitempty"`
}

// The animals.
var PetKinds = []PetKind{
	{ID: "chien", Label: "Chien", Icon: "dog", Price: 25000, Food: 500, FoodLabel: "Les croquettes", Hunger: 6, Spirits: 5,
		About: "Il garde la maison, il te suit dans la rue et il fait la fête quand tu rentres. Il lui faut sa promenade.",
		Names: []string{"Rex", "Bobi", "Tiger", "Major", "Simba", "Lucky"},
		Acts: []PetAct{
			{ID: "caresser", Label: "Le caresser", Icon: "hand-heart", Spirits: 20, Bond: 3, Sim: Needs{Fun: 6, Social: 4}, Every: 20},
			{ID: "promener", Label: "Le promener dans le quartier", Icon: "footprints", Spirits: 45, Bond: 6, Sim: Needs{Fun: 10, Social: 6, Energy: -6}, Every: 120},
			{ID: "jouer", Label: "Lui lancer la balle", Icon: "volleyball", Spirits: 30, Bond: 4, Sim: Needs{Fun: 12, Energy: -3}, Every: 40},
		}},
	{ID: "chat", Label: "Chat", Icon: "cat", Price: 10000, Food: 300, FoodLabel: "Le poisson", Hunger: 5, Spirits: 3,
		About: "Il chasse les souris et les cafards, il ronronne sur le lit. Il est câlin… quand il a envie.",
		Names: []string{"Grigri", "Minou", "Pacha", "Moustache", "Kiki", "Zouzou"},
		Acts: []PetAct{
			{ID: "caresser", Label: "Le caresser (il ronronne)", Icon: "hand-heart", Spirits: 25, Bond: 4, Sim: Needs{Fun: 6, Energy: 3}, Every: 20},
			{ID: "jouer", Label: "Jouer avec la ficelle", Icon: "sparkles", Spirits: 30, Bond: 3, Sim: Needs{Fun: 10}, Every: 40},
		}},
	{ID: "poules", Label: "Poules", Icon: "egg", Price: 6000, Food: 200, FoodLabel: "Le maïs", Hunger: 5, Spirits: 2,
		About: "Trois poules et leur coq dans la cour. Bien nourries, elles pondent : les œufs se vendent au marché.",
		Names: []string{"Les cocottes", "Les poulettes", "La basse-cour"},
		Acts: []PetAct{
			{ID: "oeufs", Label: "Ramasser les œufs", Icon: "egg", Spirits: 5, Bond: 2, Sim: Needs{Fun: 3}},
		}},
	{ID: "mouton", Label: "Mouton de Tabaski", Icon: "sheep", Price: 60000, Food: 800, FoodLabel: "L'herbe et le son", Hunger: 4, Spirits: 2,
		About: "Acheté maigre, engraissé dans la cour jusqu'à la Tabaski : le jour de la fête, la famille et les voisins mangent ensemble. Ou revendu plus cher avant.",
		Names: []string{"Le bélier", "Gros mouton", "Kabou", "Le boss"},
		Acts: []PetAct{
			{ID: "brosser", Label: "Le brosser", Icon: "sparkles", Spirits: 20, Bond: 2, Sim: Needs{Fun: 4}, Every: 60},
		}},
}

// FindPetKind: an animal by its id.
func FindPetKind(id string) (PetKind, bool) {
	for _, k := range PetKinds {
		if k.ID == id {
			return k, true
		}
	}
	return PetKind{}, false
}

// The rules.
const (
	// PetsMax: animals a Sim keeps (one of each kind).
	PetsMax = 4
	// PetRunsAfter: hours left at no hunger before it runs off.
	PetRunsAfter = 24
	// EggEvery: real hours between two eggs (the hens fed); EggsMax laid before they're picked up.
	EggEvery = 4
	EggsMax  = 6
	// EggPrice: an egg sold at the market.
	EggPrice = 150
	// SheepGain: what the sheep's price grows by for each day it's been fed well (up to SheepMax).
	SheepGain = 2500
	SheepMax  = 120000
	// PetFindChance: a search in the quartier finds it.
	PetFindChance = 0.45
)

// Pet: an animal as the server keeps it and the phone shows it.
type Pet struct {
	ID      int64   `json:"id"`
	Kind    string  `json:"kind"`
	Name    string  `json:"name"`
	Hunger  float64 `json:"hunger"`
	Spirits float64 `json:"spirits"`
	Bond    int     `json:"bond"`
	// Away: it ran off (since when); Eggs: laid, not yet picked up; Worth: what it would sell for (the sheep).
	Away    *time.Time `json:"away,omitempty"`
	Eggs    int        `json:"eggs,omitempty"`
	Worth   int        `json:"worth,omitempty"`
	FedDays int        `json:"fedDays,omitempty"`
	Since   time.Time  `json:"since"`
	// Updated: when its gauges were last brought up to date; Hungry0: since when its hunger is at 0.
	Updated time.Time  `json:"-"`
	Hungry0 *time.Time `json:"-"`
	// EggAt: when the hens' last egg was laid (the next one EggEvery hours after).
	EggAt time.Time `json:"-"`
	// Done: when each act was last done (cooldowns).
	Done map[string]time.Time `json:"done,omitempty"`
}

// Decay: the pet brought up to now (its gauges down with the hours, the eggs laid, running off left
// hungry too long). Returns true when it has just run off.
func (p *Pet) Decay(now time.Time) bool {
	k, ok := FindPetKind(p.Kind)
	if !ok || p.Away != nil {
		p.Updated = now
		return false
	}
	h := now.Sub(p.Updated).Hours()
	if h <= 0 {
		return false
	}
	// Eggs: one every EggEvery hours while the hens aren't starving (counted from the last one laid).
	if p.Kind == "poules" {
		if p.EggAt.IsZero() || p.Hunger <= 25 || p.Eggs >= EggsMax {
			p.EggAt = now
		} else if n := int(now.Sub(p.EggAt).Hours() / EggEvery); n > 0 {
			p.Eggs = min(EggsMax, p.Eggs+n)
			p.EggAt = p.EggAt.Add(time.Duration(n*EggEvery) * time.Hour)
		}
	}
	p.Hunger = math.Max(0, p.Hunger-k.Hunger*h)
	p.Spirits = math.Max(0, p.Spirits-k.Spirits*h)
	p.Updated = now
	if p.Hunger <= 0 {
		if p.Hungry0 == nil {
			t := now
			p.Hungry0 = &t
		}
		if now.Sub(*p.Hungry0).Hours() >= PetRunsAfter {
			t := now
			p.Away = &t
			p.Bond = max(0, p.Bond-20)
			return true
		}
	} else {
		p.Hungry0 = nil
	}
	return false
}

// SheepWorth: what the sheep sells for now (its price, and what it's put on).
func SheepWorth(p Pet) int {
	k, _ := FindPetKind("mouton")
	return min(SheepMax, k.Price/2+p.FedDays*SheepGain)
}

// Mood: how the animal is, in a word, for the phone.
func (p Pet) Mood() string {
	switch {
	case p.Away != nil:
		return "parti"
	case p.Hunger < 20:
		return "affame"
	case p.Spirits < 25:
		return "triste"
	case p.Hunger > 60 && p.Spirits > 60:
		return "heureux"
	}
	return "ok"
}
