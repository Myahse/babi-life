package game

import (
	"fmt"
	"math/rand/v2"
	"os"
	"strconv"
	"strings"
)

// Le mode vie's generations (the update « mode-vie », sims/famille.go; web game/famille.ts): adults go on
// ageing, young adult, adult, senior; a couple has children who grow up at home; one day a grown child takes
// over the house. The game's clock is the real one, so these are real days: a whole adult life lasts weeks,
// childhood at home a little over a week. The team sets them on the server (VIE_DUREES, e.g.
// "jeune=14,adulte=28,senior=14,bebe=2,enfant=4,ado=3,grossesse=3").

// LifeSpans: how many real days each part of life lasts.
type LifeSpans struct {
	Jeune, Adulte, Senior float64
	Bebe, Enfant, Ado     float64
	Grossesse             float64
}

// Spans: the durations in force (VIE_DUREES overrides them at start).
var Spans = LifeSpans{Jeune: 14, Adulte: 28, Senior: 14, Bebe: 2, Enfant: 4, Ado: 3, Grossesse: 3}

func init() { Spans = ParseSpans(os.Getenv("VIE_DUREES"), Spans) }

// ParseSpans: "jeune=14,senior=10" over the defaults (a bad or missing value keeps the default).
func ParseSpans(s string, d LifeSpans) LifeSpans {
	for _, kv := range strings.Split(s, ",") {
		k, v, ok := strings.Cut(strings.TrimSpace(kv), "=")
		f, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
		if !ok || err != nil || f <= 0 || f > 3650 {
			continue
		}
		switch strings.TrimSpace(k) {
		case "jeune":
			d.Jeune = f
		case "adulte":
			d.Adulte = f
		case "senior":
			d.Senior = f
		case "bebe":
			d.Bebe = f
		case "enfant":
			d.Enfant = f
		case "ado":
			d.Ado = f
		case "grossesse":
			d.Grossesse = f
		}
	}
	return d
}

// DayMinutes: a game day (a real one).
const DayMinutes = 24 * 60

// Days: so many days in game minutes.
func Days(d float64) int64 { return int64(d * DayMinutes) }

// The parts of adult life.
const (
	AgeJeune  = "jeune"
	AgeAdulte = "adulte"
	AgeSenior = "senior"
)

// AdultStageLabel: what a part of adult life is called.
func AdultStageLabel(id string) string {
	switch id {
	case AgeJeune:
		return "Jeune adulte"
	case AgeSenior:
		return "Senior"
	}
	return "Adulte"
}

// AdultAgeAt: the part of adult life and the age in years, so long (game minutes) after adult life began:
// 18 to 30 as a young adult, 30 to 60 as an adult, 60 and over as a senior.
func AdultAgeAt(lived int64) (string, int) {
	lived = max(0, lived)
	j, a, s := Days(Spans.Jeune), Days(Spans.Adulte), max(1, Days(Spans.Senior))
	switch {
	case lived < j:
		return AgeJeune, 18 + int(lived*12/j)
	case lived < j+a:
		return AgeAdulte, 30 + int((lived-j)*30/a)
	}
	return AgeSenior, min(99, 60+int((lived-j-a)*20/s))
}

// LifeEnd: how long after adult life began an old person may pass (the senior years over).
func LifeEnd() int64 { return Days(Spans.Jeune + Spans.Adulte + Spans.Senior) }

// Childhood: how long a child of the house takes to be 18 (game minutes).
func Childhood() int64 { return Days(Spans.Bebe + Spans.Enfant + Spans.Ado) }

// KidAgeAt: a child of the house's stage (game.Stage ids) and age, so long after its birth; once 18, the
// part of adult life it is in is AdultAgeAt(lived - Childhood()).
func KidAgeAt(lived int64) (string, int) {
	lived = max(0, lived)
	b, e, a := max(1, Days(Spans.Bebe)), max(1, Days(Spans.Enfant)), max(1, Days(Spans.Ado))
	switch {
	case lived < b:
		return StageBebe, int(lived * 3 / b)
	case lived < b+e:
		return StageEnfant, 3 + int((lived-b)*9/e)
	case lived < b+e+a:
		return StageAdo, 12 + int((lived-b-e)*6/a)
	}
	_, y := AdultAgeAt(lived - b - e - a)
	return StageAdulte, y
}

// GreyHair: the hair as the years make it: salt and pepper as an adult, white as a senior.
func GreyHair(color, stage string) string {
	switch stage {
	case AgeSenior:
		return "#d9d6d0"
	case AgeAdulte:
		// Only dark hair goes grey at the temples (dyed hair stays the colour it was dyed).
		if strings.HasPrefix(color, "#1") || strings.HasPrefix(color, "#0") || strings.HasPrefix(color, "#2") || color == "" {
			return "#56524e"
		}
	}
	return color
}

// BabyName: a first name for a newborn.
func BabyName(gender string, rng *rand.Rand) string {
	if gender == "homme" {
		return boys[rng.IntN(len(boys))]
	}
	return girls[rng.IntN(len(girls))]
}

// BabyTraits: what a newborn will be like: one of a parent's traits, one of its own.
func BabyTraits(parent []string, rng *rand.Rand) []string {
	var out []string
	if len(parent) > 0 {
		out = append(out, parent[rng.IntN(len(parent))])
	}
	for len(out) < 2 {
		t := Traits[rng.IntN(len(Traits))].ID
		if len(out) == 0 || out[0] != t {
			out = append(out, t)
		}
	}
	return out
}

// Inheritance: what the heir gets of an estate (the money less the debts): three quarters; the rest is
// the retired parent's for their old age, or the funeral's and the family's.
func Inheritance(money, debts int) (heir, rest int) {
	estate := max(0, money-debts)
	heir = estate * 3 / 4
	return heir, estate - heir
}

// HostAct: a way of looking after a visitor at home: what it costs, does to the Sim's needs and to the friendship.
type HostAct struct {
	ID, Label, Icon string
	Cost            int
	Effect          Needs
	Friendship      int
}

// HostActs: what can be done for a visitor (each once a visit).
var HostActs = []HostAct{
	{ID: "manger", Label: "Servir à manger", Icon: "utensils", Cost: 1500, Effect: Needs{Hunger: 30, Social: 15}, Friendship: 8},
	{ID: "boire", Label: "Servir à boire", Icon: "cup-soda", Cost: 500, Effect: Needs{Social: 10, Fun: 5}, Friendship: 5},
	{ID: "visite", Label: "Faire visiter la maison", Icon: "house", Effect: Needs{Social: 12, Fun: 6}, Friendship: 6},
	{ID: "dames", Label: "Jouer aux dames", Icon: "grid-3x3", Effect: Needs{Social: 12, Fun: 25}, Friendship: 7},
}

// FindHostAct: the hosting act of that id.
func FindHostAct(id string) (HostAct, bool) {
	for _, a := range HostActs {
		if a.ID == id {
			return a, true
		}
	}
	return HostAct{}, false
}

// Majeur: a child of the house turning 18 (its birthday's key: "adulte" is the part of adult life).
const Majeur = "majeur"

// BirthdayLine: what the journal says on a birthday that starts a new part of life.
func BirthdayLine(name, stage string, years int) string {
	switch stage {
	case AgeAdulte:
		return fmt.Sprintf("Joyeux anniversaire ! %s a %d ans : place à la vie d'adulte, la vraie.", name, years)
	case AgeSenior:
		return fmt.Sprintf("Joyeux anniversaire ! %s a %d ans : les cheveux blancs, la sagesse, et toute la famille autour.", name, years)
	case StageEnfant:
		return fmt.Sprintf("Joyeux anniversaire ! %s a %d ans : le bébé de la maison devient un enfant.", name, years)
	case StageAdo:
		return fmt.Sprintf("Joyeux anniversaire ! %s a %d ans : bienvenue dans l'adolescence.", name, years)
	case Majeur:
		return fmt.Sprintf("Joyeux anniversaire ! %s a %d ans : un adulte maintenant, qui pourra un jour reprendre la maison.", name, years)
	}
	return fmt.Sprintf("Joyeux anniversaire ! %s a %d ans.", name, years)
}
