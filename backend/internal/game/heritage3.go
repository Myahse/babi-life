package game

import (
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// L'héritage, phase 3 (the update « heritage », sims/heritage3.go; web components/heritage/Crest*.tsx,
// screens/FamilleApp.tsx « Héritage »): the family's heirlooms, its crest and devise, and the weekly
// « Fête des grandes familles ».
//   - An heirloom (« objet de famille »): at the passation the parent picks one thing to hand down, a piece of
//     furniture from the house, a piece of clothing or an accessory, or a vehicle. It carries the badge
//     « Objet de famille · Génération N » (N: the times it was handed down), a line engraved each time
//     (« De Awa à Lassina »), and a little renom at each passation that grows with N. It can't be sold.
//   - The crest (« blason »): a shape, two colours, an emblem, a devise (40 characters, moderated like the
//     chat), chosen once a generation; shown on the house, in the ranking, on the profile, on the summary card.
//   - The fête: a rendez-vous of the week (rendezvous.go) at the Palais de la Culture, on Sunday evening.
//     Coming gives a little renom (once a week) and the good mood; the three families that gained the most
//     renom that week are told in Babi Direct with their crests.

// Heirloom kinds.
const (
	HeirloomMeuble   = "meuble"
	HeirloomVetement = "vetement"
	HeirloomVehicule = "vehicule"
)

// HeirloomKinds: what can be handed down.
var HeirloomKinds = []string{HeirloomMeuble, HeirloomVetement, HeirloomVehicule}

// HeirloomRenomEach, HeirloomRenomMax: an heirloom's renom at a passation: this much for each time it was
// handed down (counting this one), this much at most.
const (
	HeirloomRenomEach = 5
	HeirloomRenomMax  = 30
	// HeirloomsMax: the heirlooms a family keeps at most (a new one past that is refused: hand one down again).
	HeirloomsMax = 6
)

// HeirloomRenom: what an heirloom handed down for the n-th time adds to the generation's renom.
func HeirloomRenom(n int) int { return min(HeirloomRenomMax, HeirloomRenomEach*max(1, n)) }

// HeirloomLine: the line engraved on it at a passation.
func HeirloomLine(from, to string) string { return fmt.Sprintf("De %s à %s", from, to) }

// ErrHeirloomLocked: what is said when one tries to sell or throw away an heirloom.
var ErrHeirloomLocked = errors.New("c'est un objet de famille : il ne se vend pas et ne quitte pas la famille")

// CrestShapes: the crest's outline.
var CrestShapes = []string{"bouclier", "rond"}

// CrestEmblems: the emblems, each drawn in blocks on the crest (web components/heritage/crestArt.ts).
var CrestEmblems = []string{"elephant", "baobab", "pirogue", "tamtam", "etoile", "lion", "masque", "cauri"}

// CrestColors: the crest's colours (the field is shared between two of them).
var CrestColors = []string{"#f77f00", "#009e60", "#ffffff", "#c92a2a", "#1c5d99", "#ffd36e", "#5f3dc4", "#2b2b2b", "#8a5a32", "#e64980"}

// DeviseMax: a devise's length at most (characters).
const DeviseMax = 40

// Crest: a family's crest.
type Crest struct {
	Shape  string    `json:"shape"`
	Colors [2]string `json:"colors"`
	Emblem string    `json:"emblem"`
	Devise string    `json:"devise"`
}

var (
	errCrestShape  = errors.New("forme inconnue")
	errCrestColor  = errors.New("couleur inconnue")
	errCrestEmblem = errors.New("emblème inconnu")
	errDeviseLong  = errors.New("la devise fait 40 caractères au plus")
)

// Check: a crest's parts from the lists, the devise trimmed and on one line (its words are checked by the
// server's moderation, sims/heritage3.go).
func (c Crest) Check() (Crest, error) {
	switch {
	case !slices.Contains(CrestShapes, c.Shape):
		return c, errCrestShape
	case !slices.Contains(CrestColors, c.Colors[0]) || !slices.Contains(CrestColors, c.Colors[1]):
		return c, errCrestColor
	case !slices.Contains(CrestEmblems, c.Emblem):
		return c, errCrestEmblem
	}
	d := strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return ' '
		}
		return r
	}, c.Devise)
	c.Devise = strings.Join(strings.Fields(d), " ")
	if utf8.RuneCountInString(c.Devise) > DeviseMax {
		return c, errDeviseLong
	}
	return c, nil
}

// The fête des grandes familles.
const (
	// FamillesFeteID: its rendez-vous (rendezvous.go) and FamillesFeteActID the Palais de la Culture's interaction, come to it.
	FamillesFeteID    = "fete-familles"
	FamillesFeteActID = "fete-grandes-familles"
	// FeteRenom: the renom of coming, once a week; FetePodium: the families told.
	FeteRenom  = 15
	FetePodium = 3
	// FeteStart, FeteLength: Sunday from 19 h, three hours.
	FeteStart  = 19 * 60
	FeteLength = 3 * 60
)

// FeteRendezVous: the fête as a rendez-vous of the week (it waits for « heritage »).
var FeteRendezVous = RendezVous{ID: FamillesFeteID, Label: "La Fête des grandes familles", Emoji: "👑", Mode: "familles", Needs: HeritageKey,
	About: "Le dimanche de 19 h à 22 h, au Palais de la Culture de Treichville : les familles se retrouvent, on danse, on se montre. Les trois familles qui ont gagné le plus de renommée dans la semaine sont annoncées sur Babi Direct.",
	Bonus: "+15 de renommée (une fois par semaine) et la bonne humeur", Days: []time.Weekday{time.Sunday}, Start: FeteStart, Length: FeteLength}

// FeteInteraction: coming to the fête, at the Palais de la Culture, Sunday evening.
var FeteInteraction = Interaction{ID: FamillesFeteActID, Ages: Adults, Label: "La Fête des grandes familles", Icon: "crown", Minutes: 90, Effect: Needs{Fun: 35, Social: 35, Energy: -8}, MinHour: 19, MaxHour: 22, Days: []int{Dimanche}, Places: []string{PalaisCultureID}}

func init() {
	RendezVousList = append(RendezVousList, FeteRendezVous)
	HeritageInteractions = append(HeritageInteractions, FamillesFeteActID)
	k := Kinds["culture"]
	k.Interactions = append(k.Interactions, FeteInteraction)
	Kinds["culture"] = k
	Moodlets["fete-familles"] = MoodletDef{"La fête des grandes familles", "crown", 2, 360}
}

// FeteAllDay: the local bench only (DEV_LOGIN with DEV_FETE_TOUJOURS, cmd/api): the fête on every day, all
// day, so it can be tried and filmed whatever the day.
func FeteAllDay() {
	for i, r := range RendezVousList {
		if r.ID == FamillesFeteID {
			RendezVousList[i].Days = []time.Weekday{time.Sunday, time.Monday, time.Tuesday, time.Wednesday, time.Thursday, time.Friday, time.Saturday}
			RendezVousList[i].Start, RendezVousList[i].Length = 0, 24*60
		}
	}
	k := Kinds["culture"]
	for i, it := range k.Interactions {
		if it.ID == FamillesFeteActID {
			k.Interactions[i].Days, k.Interactions[i].MinHour, k.Interactions[i].MaxHour = nil, 0, 0
		}
	}
	Kinds["culture"] = k
}
