package game

import (
	"errors"
	"fmt"
	"math/rand/v2"
	"slices"
)

// A Sim is born a baby and grows up: baby, child, teenager, adult. A year of
// game life lasts YearMinutes real minutes, so a childhood is a few days of
// play. Sims created before this have no birth date and are adults.
const YearMinutes = 8 * 60

const (
	StageBebe   = "bebe"
	StageEnfant = "enfant"
	StageAdo    = "ado"
	StageAdulte = "adulte"
)

type Stage struct {
	ID    string  `json:"id"`
	Label string  `json:"label"`
	From  int     `json:"from"`  // age in years
	Scale float64 `json:"scale"` // body size against an adult
}

var Stages = []Stage{
	{ID: StageBebe, Label: "Bébé", From: 0, Scale: 0.42},
	{ID: StageEnfant, Label: "Enfant", From: 3, Scale: 0.64},
	{ID: StageAdo, Label: "Ado", From: 12, Scale: 0.9},
	{ID: StageAdulte, Label: "Adulte", From: 18, Scale: 1},
}

// AdultAge: when childhood ends and the Sim leaves the family home.
const AdultAge = 18

// legacyAge: the age shown for Sims made before birth dates.
const legacyAge = 25

// AgeAt is a Sim's age in years at a game minute; born 0 = an adult from
// before birth dates.
func AgeAt(born, now int64) int {
	if born == 0 {
		return legacyAge
	}
	return int(max(0, now-born) / YearMinutes)
}

func StageOf(age int) Stage {
	s := Stages[0]
	for _, st := range Stages {
		if age >= st.From {
			s = st
		}
	}
	return s
}

// Who may do an interaction, by stage. Empty Ages: anyone from childhood up.
var (
	Everyone = []string{StageBebe, StageEnfant, StageAdo, StageAdulte}
	Babies   = []string{StageBebe}
	Kids     = []string{StageEnfant, StageAdo}
	KidsUp   = []string{StageEnfant, StageAdo, StageAdulte}
	TeensUp  = []string{StageAdo, StageAdulte}
	Adults   = []string{StageAdulte}
)

var (
	ErrTooYoung = errors.New("trop jeune pour ça")
	ErrTooOld   = errors.New("ce n'est plus de ton âge")
)

// AllowedFor explains why a Sim at this stage can't do it, or returns nil.
func (it Interaction) AllowedFor(stage string) error {
	ages := it.Ages
	if len(ages) == 0 {
		ages = KidsUp
	}
	if slices.Contains(ages, stage) {
		return nil
	}
	if i, j := slices.Index(Everyone, stage), slices.Index(Everyone, ages[0]); i < j {
		return ErrTooYoung
	}
	return ErrTooOld
}

// A Family is where a Sim is born. It sets the neighbourhood, the family home,
// the pocket money while growing up and the start in adult life. The six
// words are the game's names for the family's means, from the richest down:
// debout, laté, lagnon, poignon, coulé, gnambro. The odds are game rules,
// not statistics.
type Family struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	Hint  string `json:"hint"`
	// Sector: the kind of neighbourhood. Every commune has all of them, from
	// the big villas to the precarious quarters.
	Sector  string  `json:"sector"`
	Housing string  `json:"housing"` // the family home
	Pocket  int     `json:"pocket"`  // FCFA every Saturday, from childhood
	Start   int     `json:"start"`   // FCFA the family gives at 18
	Leave   string  `json:"leave"`   // the first home of one's own
	BacGift int     `json:"bacGift"` // for passing the bac
	Weight  float64 `json:"weight"`  // how often a Sim is born into it
	Source  *Source `json:"source"`
}

var Families = []Family{
	{ID: "debout", Label: "Debout", Icon: "crown", Housing: "villa", Pocket: 30000, Start: 500000, Leave: "villa", BacGift: 200000, Weight: 0.04,
		Sector: "le secteur des grandes villas",
		Hint:   "Famille qui a beaucoup d'argent : villa avec piscine, gardiens, voitures. Rien n'est hors de portée.", Source: Fictional},
	{ID: "late", Label: "Laté", Icon: "gem", Housing: "villa", Pocket: 15000, Start: 200000, Leave: "appart", BacGift: 100000, Weight: 0.08,
		Sector: "le secteur résidentiel",
		Hint:   "Famille riche : villa, chauffeur, vacances à l'étranger. Tout est facile… tant que papa paie.", Source: Fictional},
	{ID: "lagnon", Label: "Lagnon", Icon: "sparkles", Housing: "appart", Pocket: 8000, Start: 100000, Leave: "appart", BacGift: 50000, Weight: 0.15,
		Sector: "un quartier aisé",
		Hint:   "Entre poignon et laté : un bel appartement, l'école privée, une voiture. On vit bien.", Source: Fictional},
	{ID: "poignon", Label: "Poignon", Icon: "briefcase", Housing: "appart", Pocket: 5000, Start: 60000, Leave: "studio", BacGift: 30000, Weight: 0.33,
		Sector: "un quartier moyen",
		Hint:   "Famille moyenne : papa fonctionnaire, maman commerçante. On s'en sort, sans folies.", Source: Fictional},
	{ID: "coule", Label: "Coulé", Icon: "hand-coins", Housing: "entrer-coucher", Pocket: 1000, Start: 20000, Leave: "entrer-coucher", BacGift: 10000, Weight: 0.25,
		Sector: "un quartier populaire",
		Hint:   "Famille pauvre : la cour commune, les fins de mois difficiles, la débrouille.", Source: Fictional},
	{ID: "gnambro", Label: "Gnambro", Icon: "footprints", Housing: "entrer-coucher", Pocket: 0, Start: 5000, Leave: "entrer-coucher", BacGift: 0, Weight: 0.15,
		Sector: "un quartier précaire",
		Hint:   "Famille très pauvre : rien de côté, pas toujours l'école. La rue n'est jamais loin.", Source: Fictional},
}

func FindFamily(id string) (Family, bool) {
	for _, f := range Families {
		if f.ID == id {
			return f, true
		}
	}
	return Family{}, false
}

// BornInto draws the family, like in real life: nobody chooses.
func BornInto(rng *rand.Rand) Family {
	r := rng.Float64() * 1
	for _, f := range Families {
		if r -= f.Weight; r < 0 {
			return f
		}
	}
	return Families[len(Families)-1]
}

// School: going to class and doing homework count towards the bac.
var Schoolwork = []string{"aller-ecole", "devoirs"}

// BacMarks: the schoolwork needed by 18 to pass the bac.
const BacMarks = 20

// Birthday says what changes when a Sim reaches a new stage.
func Birthday(firstName string, st Stage) string {
	switch st.ID {
	case StageEnfant:
		return fmt.Sprintf("%s a 3 ans : fini les couches, place à l'école !", firstName)
	case StageAdo:
		return fmt.Sprintf("%s a 12 ans : bienvenue au collège, et dans l'adolescence.", firstName)
	}
	return ""
}
