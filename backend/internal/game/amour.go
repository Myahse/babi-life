package game

import (
	"errors"
	"hash/fnv"
	"strings"
	"time"
)

// La vie amoureuse (the update « vie-amoureuse », sims/amour.go; web game/amour.ts, screens/CoeurApp.tsx,
// components/amour/RendezVous.tsx): being with someone is lived, not just a flag. The love between two
// (0..100) is the romance gauge, tended by the dates, the mots doux, the câlins; left untended it fades
// on read (never by a ticker). The anniversaries come once each. The dates are played: four moments, the
// partner says something, the player answers (a mot doux, a joke, a gift, listening), and the partner
// reacts by what touches them (their love language). The server scores the answers itself.

// AmourKey: the update; CoeurKey: its phone app (« Mon cœur »).
const (
	AmourKey = "vie-amoureuse"
	CoeurKey = "app:coeur"
	// RdvPrefix: the dates' catalog interactions (rdv-maquis…), at the places they're had.
	RdvPrefix = "rdv-"
)

// IsRdv: a date's interaction.
func IsRdv(id string) bool { return strings.HasPrefix(id, RdvPrefix) }

// The stages of a couple (phase 1: « ensemble » only; the others come with consent, phase 2).
const (
	LoveEnsemble = "ensemble"
	LoveOfficiel = "officiel"
	LoveFiances  = "fiances"
	LoveMaries   = "maries"
)

// LoveStage: a stage and what it's called.
type LoveStage struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

var LoveStages = []LoveStage{
	{LoveEnsemble, "Ensemble"},
	{LoveOfficiel, "Officiel"},
	{LoveFiances, "Fiancés"},
	{LoveMaries, "Mariés"},
}

// LoveStageLabel: what a stage is called ("" for none).
func LoveStageLabel(id string) string {
	for _, s := range LoveStages {
		if s.ID == id {
			return s.Label
		}
	}
	return ""
}

const (
	// LoveFloor: a couple's love never reads lower than this, however long it was left.
	LoveFloor = 25
	// LoveGrace: days left untended before the love fades; LoveFade: how much a day after that.
	LoveGrace = 3
	LoveFade  = 3
)

// daysSince: whole days from then to now (0 when then is zero or later).
func daysSince(then, now time.Time) int {
	if then.IsZero() || !now.After(then) {
		return 0
	}
	return int(now.Sub(then).Hours() / 24)
}

// LoveNow: the love as it reads now: the romance gauge, less LoveFade a day once LoveGrace days went by
// untended; a couple's never under LoveFloor. Nothing is written: tending it (a date, a mot doux) sets
// the gauge afresh.
func LoveNow(romance int, tended, now time.Time, couple bool) int {
	v := romance - LoveFade*max(0, daysSince(tended, now)-LoveGrace)
	if couple {
		v = max(v, LoveFloor)
	}
	return Clamp100(v)
}

// Missing: left untended long enough to miss each other (the moodlet « manque »).
func Missing(tended, now time.Time) bool {
	return !tended.IsZero() && daysSince(tended, now) > LoveGrace
}

// LoveDays: days together since then (the first day is day 1).
func LoveDays(since, now time.Time) int {
	if since.IsZero() {
		return 0
	}
	return daysSince(since, now) + 1
}

// Anniversaries of a couple: a week, a month, three months, a year. Each said once.
var Annivs = []struct {
	Label string
	add   func(time.Time) time.Time
}{
	{"1 semaine ensemble", func(t time.Time) time.Time { return t.AddDate(0, 0, 7) }},
	{"1 mois ensemble", func(t time.Time) time.Time { return t.AddDate(0, 1, 0) }},
	{"3 mois ensemble", func(t time.Time) time.Time { return t.AddDate(0, 3, 0) }},
	{"1 an ensemble", func(t time.Time) time.Time { return t.AddDate(1, 0, 0) }},
}

// AnnivAt: when the i-th anniversary falls for a couple together since then.
func AnnivAt(since time.Time, i int) time.Time { return Annivs[i].add(since) }

// AnnivDue: the anniversary come since the last one said (seen: how many were said), and how many are
// said once it is (the ones missed while away are passed over: only the latest is celebrated).
func AnnivDue(since time.Time, seen int, now time.Time) (idx int, newSeen int, ok bool) {
	if since.IsZero() {
		return 0, seen, false
	}
	idx = -1
	for i := seen; i < len(Annivs); i++ {
		if !AnnivAt(since, i).After(now) {
			idx = i
		}
	}
	if idx < 0 {
		return 0, seen, false
	}
	return idx, idx + 1, true
}

// NextAnniv: the next anniversary to come (its label and when), ok false once the year is passed.
func NextAnniv(since time.Time, seen int, now time.Time) (label string, at time.Time, ok bool) {
	if since.IsZero() {
		return "", time.Time{}, false
	}
	for i := seen; i < len(Annivs); i++ {
		if at := AnnivAt(since, i); at.After(now) {
			return Annivs[i].Label, at, true
		}
	}
	return "", time.Time{}, false
}

// The love languages: what touches a partner most (drawn once from who they are).
const (
	LangMots     = "mots"
	LangCadeaux  = "cadeaux"
	LangTemps    = "temps"
	LangServices = "services"
	LangRire     = "rire"
)

var LoveLangs = []string{LangMots, LangCadeaux, LangTemps, LangServices, LangRire}

// LangLabel: what touches them, said to the player (« Ce qui le touche : … »).
var LangLabel = map[string]string{
	LangMots:     "les mots doux",
	LangCadeaux:  "les petits cadeaux",
	LangTemps:    "le temps passé ensemble, être écouté·e",
	LangServices: "qu'on prenne soin de lui ou d'elle",
	LangRire:     "rire ensemble",
}

// LangOf: the love language of someone, the same every time for them.
func LangOf(who string) string {
	h := fnv.New32a()
	_, _ = h.Write([]byte("amour:" + who))
	return LoveLangs[h.Sum32()%uint32(len(LoveLangs))]
}

// The answers at a date's moment.
const (
	ChoiceMot     = "mot"
	ChoiceBlague  = "blague"
	ChoiceCadeau  = "cadeau"
	ChoiceEcouter = "ecouter"
)

var Choices = []string{ChoiceMot, ChoiceBlague, ChoiceCadeau, ChoiceEcouter}

// langChoice: the answer a love language loves at any moment ("" none: « services » waits for phase 2's).
func langChoice(lang string) string {
	switch lang {
	case LangMots:
		return ChoiceMot
	case LangCadeaux:
		return ChoiceCadeau
	case LangTemps:
		return ChoiceEcouter
	case LangRire:
		return ChoiceBlague
	}
	return ""
}

// Beat: a moment of a date: the answer it calls for (Best) and the one that falls flat (Bad).
// What the partner says is the phone's (web game/amour.ts, by the same order).
type Beat struct {
	Best string
	Bad  string
}

// DateKind: a date: where it's had (the place kind), its four moments, the selfie's words.
type DateKind struct {
	ID    string
	Place string
	Title string
	Beats [4]Beat
}

var DateKinds = map[string]DateKind{
	// The dinner at the maquis: the garba praised, a story from work, the bill teased, the music.
	"rdv-maquis": {ID: "rdv-maquis", Place: "maquis", Title: "Notre soirée au maquis", Beats: [4]Beat{
		{Best: ChoiceBlague, Bad: ChoiceEcouter},
		{Best: ChoiceEcouter, Bad: ChoiceBlague},
		{Best: ChoiceMot, Bad: ChoiceEcouter},
		{Best: ChoiceMot, Bad: ChoiceBlague},
	}},
	// The walk by the lagoon at sunset: the light on the water, a secret, the pirogues, the moment.
	"rdv-lagune": {ID: "rdv-lagune", Place: "lagune", Title: "Notre coucher de soleil sur la lagune", Beats: [4]Beat{
		{Best: ChoiceMot, Bad: ChoiceBlague},
		{Best: ChoiceEcouter, Bad: ChoiceBlague},
		{Best: ChoiceBlague, Bad: ChoiceEcouter},
		{Best: ChoiceMot, Bad: ChoiceBlague},
	}},
	// The ice cream at the mall: the flavour picked, a drip on the chin, the shop windows, the last spoon.
	"rdv-glace": {ID: "rdv-glace", Place: "mall", Title: "Notre glace au centre commercial", Beats: [4]Beat{
		{Best: ChoiceBlague, Bad: ChoiceEcouter},
		{Best: ChoiceBlague, Bad: ChoiceMot},
		{Best: ChoiceEcouter, Bad: ChoiceBlague},
		{Best: ChoiceMot, Bad: ChoiceBlague},
	}},
}

// The partner's reactions.
const (
	ReactMatch = "match"
	ReactFine  = "fine"
	ReactWrong = "wrong"
)

// React: how the partner takes an answer at a moment: what it called for, or what touches them most
// (unless it falls flat there), lights them up; the wrong one at the wrong moment, a pout (never a fail).
func React(b Beat, choice, lang string) string {
	switch {
	case choice == b.Best:
		return ReactMatch
	case choice == b.Bad:
		return ReactWrong
	case choice == langChoice(lang):
		return ReactMatch
	}
	return ReactFine
}

// DateScore: a date scored from its answers: their points (-4..12), the score (1..100), the love it brings (3..12).
type DateScore struct {
	Points    int      `json:"points"`
	Score     int      `json:"score"`
	Love      int      `json:"love"`
	Reactions []string `json:"reactions"`
}

var (
	ErrDateKind    = errors.New("ce n'est pas un rendez-vous")
	ErrDateChoices = errors.New("un rendez-vous, c'est quatre moments")
	ErrDateGift    = errors.New("pas de cadeau dans ton sac")
)

// ScoreDate: the date's answers scored, the same for the same answers (the phone's score is never taken).
func ScoreDate(kind string, choices []string, lang string, gift bool) (DateScore, error) {
	k, ok := DateKinds[kind]
	if !ok {
		return DateScore{}, ErrDateKind
	}
	if len(choices) != len(k.Beats) {
		return DateScore{}, ErrDateChoices
	}
	out := DateScore{Reactions: make([]string, len(choices))}
	for i, c := range choices {
		known := false
		for _, x := range Choices {
			known = known || x == c
		}
		if !known {
			return DateScore{}, ErrDateChoices
		}
		if c == ChoiceCadeau && !gift {
			return DateScore{}, ErrDateGift
		}
		r := React(k.Beats[i], c, lang)
		out.Reactions[i] = r
		switch r {
		case ReactMatch:
			out.Points += 3
		case ReactFine:
			out.Points++
		default:
			out.Points--
		}
	}
	span := out.Points + 4 // 0..16
	out.Score = 1 + span*99/16
	out.Love = 3 + (span*9+8)/16
	return out, nil
}

// MaxDateMemos: the dates remembered (« Mon cœur »'s last outings).
const MaxDateMemos = 6

// MotDoux: a sweet word sent (an id only: nothing typed travels).
type MotDoux struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

var MotsDoux = []MotDoux{
	{"bonjour", "Bonjour mon cœur ☀️"},
	{"pense", "Je pense à toi"},
	{"manque", "Tu me manques déjà"},
	{"bebe", "Mon bébé d'amour ❤️"},
	{"sourire", "Ton sourire, c'est mon soleil"},
	{"ce-soir", "On se voit ce soir ?"},
	{"bonne-nuit", "Bonne nuit, fais de beaux rêves"},
	{"fier", "Je suis fier·e de toi"},
	{"chocolat", "Mon chocolat 🍫"},
	{"pour-toujours", "Toi et moi, c'est pour longtemps"},
}

// FindMot: a mot doux by its id.
func FindMot(id string) (MotDoux, bool) {
	for _, m := range MotsDoux {
		if m.ID == id {
			return m, true
		}
	}
	return MotDoux{}, false
}

// MotsPerDay: mots doux sent in a day, at most.
const MotsPerDay = 6

// Hellos: the partner's « Bonjour mon cœur » of the morning ({toi}: the player's name).
var Hellos = []string{
	"Bonjour mon cœur ☀️ Bien dormi ? Je pense à toi dèh.",
	"Coucou {toi} ! Passe une belle journée, mon amour.",
	"Mon cœur, tu me manques déjà. On se voit quand ?",
	"Bonjour bébé ! N'oublie pas de manger, hein. Bisous.",
	"Réveillé·e ? Je t'envoie plein d'amour pour ta journée ❤️",
	"Bonjour mon chocolat ! Aujourd'hui sera doux, je le sens.",
	"Hé {toi}, j'ai rêvé de toi cette nuit… Bonne journée !",
}

// MotReplies: what the partner answers to a mot doux.
var MotReplies = []string{
	"Awww ❤️ Toi aussi tu me manques !",
	"Mon cœur ! Tu veux me faire fondre ou bien ?",
	"Hihi, tu es trop chou. Bisous bisous.",
	"Ça m'a fait sourire tout·e seul·e au bureau 😄",
	"Je t'aime fort, tu sais ça ?",
	"Wêh ! Tu sais parler aux gens toi.",
}
