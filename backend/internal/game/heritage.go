package game

import (
	"fmt"
	"math/rand/v2"
	"os"
	"time"
)

// L'héritage (the update « heritage », sims/heritage.go; web game/heritage.ts, screens/FamilleApp.tsx,
// components/heritage/): the lineage played on, generation after generation, in the same sims row. It
// hardens and extends le mode vie's generations (famille.go): ages go by in hours played only (a pause
// holds them), the heir can be a child, an adopted child or a nephew/niece, the passation pays succession
// duties and gives a quarter to the elder (paid back as weekly blessings), the family earns renom, and the
// « Ma famille » app shows the tree, the jalons, the elders and the great families' ranking.

// HeritageKey: the update; HeritageAppKey: its phone app « Ma famille ».
const (
	HeritageKey    = "heritage"
	HeritageAppKey = "app:famille"
)

// HeirSpans: the parts of life in played time, as LifeSpans (in days, so famille.go's maths serve both):
// jeune 18→30 10 h, adulte 30→60 20 h, senior 60→80 10 h (then no forced end), a baby on its way or an
// adoption 1 h, bébé 1 h, enfant 3 h, ado 3 h. The team sets them in hours (HERITAGE_DUREES, e.g.
// "jeune=10,adulte=20,senior=10,grossesse=1,bebe=1,enfant=3,ado=3").
var HeirSpans = ParseHeirSpans(os.Getenv("HERITAGE_DUREES"))

// heirHours: the default durations, in played hours.
var heirHours = LifeSpans{Jeune: 10, Adulte: 20, Senior: 10, Bebe: 1, Enfant: 3, Ado: 3, Grossesse: 1}

// ParseHeirSpans: "jeune=10,adulte=20" in hours over the defaults, as LifeSpans in days.
func ParseHeirSpans(s string) LifeSpans {
	h := ParseSpans(s, heirHours)
	d := func(x float64) float64 { return x / 24 }
	return LifeSpans{Jeune: d(h.Jeune), Adulte: d(h.Adulte), Senior: d(h.Senior), Bebe: d(h.Bebe), Enfant: d(h.Enfant), Ado: d(h.Ado), Grossesse: d(h.Grossesse)}
}

// The passation's rules.
const (
	// PassationAge: the age from which the house is handed down; PassationEarly with JalonsEarly of the jalons.
	PassationAge   = 60
	PassationEarly = 50
	JalonsEarly    = 3
	// GenerationFloor: real time at least between two passations (against chaining heirs).
	GenerationFloor = 21 * 24 * time.Hour
	// AdoptAge: the youngest age to adopt; AdoptFee: the dossier.
	AdoptAge = 25
	AdoptFee = 50_000
	// BlessingMax: the most a blessing gives (from the elder's pot only), once a BlessingEvery.
	BlessingMax   = 5000
	BlessingEvery = 7 * 24 * time.Hour
	// HeirShare, NeveuShare: of the estate after duties, the heir's share (percent); the rest goes to the elder's pot.
	HeirShare  = 75
	NeveuShare = 60
	// FirstJobRenom: from this renom the heir's first job starts a rung up.
	FirstJobRenom = 500
	// VeteranMinutes: a veteran (an adult before the update) is a year older for each 40 minutes played, VeteranMaxAge at most.
	VeteranMinutes = 40
	VeteranMaxAge  = 40
	// AdoptID: the orphanage's new action.
	AdoptID = "adopter-orphelinat"
)

// HeritageInteractions: what the update brings to the places (features.go).
var HeritageInteractions = []string{AdoptID}

// SuccessionFee: the duties on an estate: nothing up to 250 000, 10 % from there to 2 000 000, 20 % above.
func SuccessionFee(estate int) int {
	if estate <= 250_000 {
		return 0
	}
	fee := (min(estate, 2_000_000) - 250_000) / 10
	if estate > 2_000_000 {
		fee += (estate - 2_000_000) / 5
	}
	return fee
}

// Split: an estate (money less the loan and the arrears) shared at the passation: the duties, the heir's
// share (pct of what's left), the elder's pot. heir + pot + fee == max(0, estate): no Djai made or lost.
func Split(estate, pct int) (heir, pot, fee int) {
	if estate <= 0 {
		return 0, 0, 0
	}
	fee = SuccessionFee(estate)
	left := estate - fee
	heir = left * pct / 100
	return heir, left - heir, fee
}

// tierOrder: the families from the poorest to the richest.
var tierOrder = []string{"gnambro", "coule", "poignon", "lagnon", "late", "debout"}

// TierAfter: the heir's family tier: the richest whose Start ×10 the net worth reaches, one step at most
// from the parent's (up or down).
func TierAfter(old string, netWorth int) string {
	cur := 0
	for i, id := range tierOrder {
		if id == old {
			cur = i
		}
	}
	want := 0
	for i, id := range tierOrder {
		if f, ok := FindFamily(id); ok && netWorth >= f.Start*10 {
			want = i
		}
	}
	switch {
	case want > cur:
		cur++
	case want < cur:
		cur--
	}
	return tierOrder[cur]
}

// Jalon: one of the five goals of a generation (three let the house be handed down from 50).
type Jalon struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Hint  string `json:"hint"`
	Done  bool   `json:"done"`
}

// JalonsIn: what the jalons are read from.
type JalonsIn struct {
	Lots, Estates, QuartierBuildings2, CareerLevel int
	OwnHouse                                       bool
	NetWorth, Start                                int
	Office                                         bool
	CloseFriends                                   int
	Married, PartnerHome                           bool
	Kids                                           int
}

// Jalons: the five, each done or not.
func Jalons(in JalonsIn) []Jalon {
	return []Jalon{
		{ID: "proprietaire", Label: "Propriétaire", Hint: "Un terrain, ou ta propre maison.", Done: in.Lots > 0 || in.OwnHouse},
		{ID: "patron", Label: "Patron", Hint: "Un immeuble, un bâtiment de ton quartier au niveau 2, ou le niveau 4 dans ton métier.", Done: in.Estates > 0 || in.QuartierBuildings2 > 0 || in.CareerLevel >= 4},
		{ID: "fortune", Label: "Fortune", Hint: fmt.Sprintf("Un patrimoine d'au moins %s (trois fois le départ de ta famille).", FCFA(3*in.Start)), Done: in.NetWorth >= 3*in.Start},
		{ID: "respecte", Label: "Respecté·e", Hint: "Un mandat, ou 5 amis proches (amitié 60 et plus).", Done: in.Office || in.CloseFriends >= 5},
		{ID: "famille", Label: "Famille", Hint: "Marié·e ou en couple à la maison, et 2 enfants.", Done: (in.Married || in.PartnerHome) && in.Kids >= 2},
	}
}

// JalonsDone: how many are done.
func JalonsDone(js []Jalon) int {
	n := 0
	for _, j := range js {
		if j.Done {
			n++
		}
	}
	return n
}

// RenomIn: what a generation leaves behind, for its renom.
type RenomIn struct {
	NetWorth, Lots, Buildings, CareerLevel, Kids, QuartierLevel, Years int
	Office                                                             string // maire | depute | ministre | president | ""
	Bac, Sup, Married, Neveu                                           bool
}

// OfficeRenom: what an office held brings.
var OfficeRenom = map[string]int{"maire": 80, "depute": 100, "ministre": 150, "president": 300}

// Renom: what the generation adds to the family's renom: +100 for the generation, then its works (net worth,
// lots, buildings, career, office, diplomas, children, marriage, quartier), halved past 61 and quartered from
// 70 (a nudge to hand down, never forced), ×0.8 through a nephew.
func Renom(in RenomIn) int {
	w := min(400, max(0, in.NetWorth)/50_000) + 30*min(5, in.Lots) + min(200, 40*in.Buildings) + 10*in.CareerLevel + OfficeRenom[in.Office] + 15*in.Kids + 20*in.QuartierLevel
	if in.Sup {
		w += 40
	} else if in.Bac {
		w += 20
	}
	if in.Married {
		w += 30
	}
	switch {
	case in.Years >= 70:
		w /= 4
	case in.Years > PassationAge+1:
		w /= 2
	}
	total := 100 + w
	if in.Neveu {
		total = total * 4 / 5
	}
	return total
}

// AdultAgeAt, KidAgeAt, Childhood, LifeEnd: the same as the package's, on these spans.
func (sp LifeSpans) AdultAgeAt(lived int64) (string, int) {
	lived = max(0, lived)
	j, a, s := Days(sp.Jeune), Days(sp.Adulte), max(1, Days(sp.Senior))
	switch {
	case lived < j:
		return AgeJeune, 18 + int(lived*12/max(1, j))
	case lived < j+a:
		return AgeAdulte, 30 + int((lived-j)*30/max(1, a))
	}
	return AgeSenior, min(99, 60+int((lived-j-a)*20/s))
}

// LivedFor: how long after adult life began one is `years` old (the inverse of AdultAgeAt).
func (sp LifeSpans) LivedFor(years int) int64 {
	j, a, s := Days(sp.Jeune), Days(sp.Adulte), Days(sp.Senior)
	switch {
	case years <= 18:
		return 0
	case years < 30:
		return int64(years-18) * j / 12
	case years < 60:
		return j + int64(years-30)*a/30
	}
	return j + a + int64(min(years, 99)-60)*s/20
}

func (sp LifeSpans) LifeEnd() int64   { return Days(sp.Jeune + sp.Adulte + sp.Senior) }
func (sp LifeSpans) Childhood() int64 { return Days(sp.Bebe + sp.Enfant + sp.Ado) }

func (sp LifeSpans) KidAgeAt(lived int64) (string, int) {
	lived = max(0, lived)
	b, e, a := max(1, Days(sp.Bebe)), max(1, Days(sp.Enfant)), max(1, Days(sp.Ado))
	switch {
	case lived < b:
		return StageBebe, int(lived * 3 / b)
	case lived < b+e:
		return StageEnfant, 3 + int((lived-b)*9/e)
	case lived < b+e+a:
		return StageAdo, 12 + int((lived-b-e)*6/a)
	}
	_, y := sp.AdultAgeAt(lived - b - e - a)
	return StageAdulte, y
}

// VeteranAge: a Sim adult before the update: its age from the time played (seconds), 18 to VeteranMaxAge.
func VeteranAge(playSeconds int64) int {
	return min(VeteranMaxAge, 18+int(playSeconds/60/VeteranMinutes))
}

// ElderWords: what an elder of the house says when asked for advice (in their own voice).
func ElderWords(rng *rand.Rand) string {
	words := []string{
		"Mon enfant, l'argent se garde comme l'eau dans la main : serre trop, il file ; ouvre trop, il coule.",
		"La maison que je t'ai laissée, entretiens-la. Un toit, c'est la paix de toute la famille.",
		"Ne laisse jamais une dette dormir. Moi j'ai payé les miennes avant de te passer la main.",
		"Le nom de la famille, on le porte haut. Les gens se souviennent de comment tu les as traités.",
		"Trouve-toi de vrais amis, pas ceux du maquis seulement. Le jour où ça va mal, ce sont eux qui viennent.",
		"Mets un peu de côté chaque semaine, même peu. C'est comme ça que j'ai construit ce que tu as.",
		"Fais des enfants, ou adopte : une maison sans rire d'enfants, c'est trop calme.",
		"Les diplômes, c'est à toi de les gagner. Repasse ton BEPC, ton bac : personne ne peut le faire pour toi.",
	}
	return words[rng.IntN(len(words))]
}

// NeveuName: the nephew or niece who carries the family name when there's no child: drawn from the seed.
func NeveuName(seed uint64) (name, gender string) {
	rng := rand.New(rand.NewPCG(seed, 7))
	gender = "femme"
	if rng.IntN(2) == 0 {
		gender = "homme"
	}
	return BabyName(gender, rng), gender
}

// HeirKind: who takes the house over.
const (
	HeirEnfant = "enfant"
	HeirAdopte = "adopte"
	HeirNeveu  = "neveu"
	// HeirFilleul: the childhood friend's child (phase 2), when there's no child of one's own: takes the
	// family name, the friend becomes its « tonton » or « tata ».
	HeirFilleul = "filleul"
	// HeirCouple: a child of two players (phase 2, couple_kids): a child of one's own, shared.
	HeirCouple = "couple"
)

// FilleulFriendship: how close the childhood friend must be (friendship) for their child to take over;
// FilleulShare: the heir's share then (as a nephew's); TontonBond: the friend's friendship once tonton.
const (
	FilleulFriendship = 60
	FilleulShare      = NeveuShare
	TontonBond        = 85
)

// Distant: an heir who isn't one's child (a nephew, the friend's child): the share and the renom are less.
func Distant(kind string) bool { return kind == HeirNeveu || kind == HeirFilleul }

// HeirKindLabel: what the kind is called.
func HeirKindLabel(kind, gender string) string {
	switch kind {
	case HeirAdopte:
		if gender == "femme" {
			return "Fille adoptive"
		}
		return "Fils adoptif"
	case HeirNeveu:
		if gender == "femme" {
			return "Nièce"
		}
		return "Neveu"
	case HeirFilleul:
		if gender == "femme" {
			return "Filleule"
		}
		return "Filleul"
	}
	if gender == "femme" {
		return "Fille"
	}
	return "Fils"
}

// GenerationLabel: « 1re génération », « 2e génération »…
func GenerationLabel(n int) string {
	if n <= 1 {
		return "1re génération"
	}
	return fmt.Sprintf("%de génération", n)
}

// FilleulName: the childhood friend's child, drawn from the friend and the generation.
func FilleulName(seed uint64) (name, gender string) {
	rng := rand.New(rand.NewPCG(seed, 11))
	gender = "femme"
	if rng.IntN(2) == 0 {
		gender = "homme"
	}
	return BabyName(gender, rng), gender
}

// ElderGrinWords: what an elder of a family says in the commune's grin, now and then (phase 2): the wisdom
// of the old.
var ElderGrinWords = []string{
	"Les enfants, doucement le matin, pas trop vite le soir. La vie, c'est pas une course de gbaka.",
	"Celui qui a des amis n'est jamais pauvre. Allez dire bonjour à vos voisins, ça coûte rien.",
	"De mon temps, on mangeait le garba à 50 francs. Gardez votre argent pour vos enfants !",
	"Un bon nom vaut mieux que beaucoup d'argent. Ce que vous faites aujourd'hui, vos petits-enfants le porteront.",
	"Il faut respecter les anciens, mais il faut aussi écouter les jeunes : eux ils connaissent le téléphone.",
	"Le bois qui reste dans l'eau ne devient jamais caïman. Travaillez, ça va payer un jour.",
	"Mangez ensemble, riez ensemble. Une famille qui mange ensemble reste ensemble.",
	"Moi j'ai passé la main à mes enfants, et je dors tranquille. Préparez votre maison pour ceux qui viennent.",
	"Quand la pluie tombe, on ne court pas sous le manguier : on rentre à la maison. Prudence sur la route !",
	"Bonne journée à toute la commune. Que Dieu garde nos enfants.",
}

// ElderGreetings: an elder met in one's quartier, greeted.
var ElderGreetings = []string{
	"« Ah, c'est toi ! Viens que je te regarde… Tu as bonne mine, mon enfant. »",
	"« Bonne arrivée ! Je prenais l'air devant la maison. Tu as mangé ? »",
	"« Le quartier a bien changé depuis mon temps. C'est toi qui fais tout ça ? Je suis fier·e de toi. »",
	"« Dis bonjour à tes voisins de ma part. Et ne rentre pas trop tard, hein ! »",
}

// FeatLabel: what a feat of the generation is called (feats package's kinds).
func FeatLabel(kind, detail string) string {
	switch kind {
	case "mandat":
		return map[string]string{"maire": "Élu·e maire", "depute": "Député·e", "ministre": "Ministre", "president": "Président·e de la République"}[detail]
	case "diplome":
		if detail == "sup" {
			return "Diplôme du supérieur"
		}
		return "Bac en poche"
	case "carriere":
		return "Promotion au travail"
	case "mariage":
		return "Mariage"
	}
	return ""
}
