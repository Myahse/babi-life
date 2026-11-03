package game

import "strings"

// Les épreuves (the update « histoires »): each story has a game of its own, seen nowhere else, played
// at its key moment: an extra step at the end of one of its chapters (after the steps there, so where a
// player already is in that chapter stays right), done at the same kind of place, in the same city, as
// the chapter's last step. The step is done by playing it (sims/defi.go « epreuve »: played, the action is
// over), and it's only offered while the story is at it (sims: interact refuses it otherwise; the phone
// hides it). The game itself: web components/defi/epreuves/<story>.tsx.

// EpreuvePrefix: the épreuves' interactions, « epreuve-<story> ».
const EpreuvePrefix = "epreuve-"

// Epreuve: a story's game: the chapter it ends (0 the first), what it's called, its icon.
type Epreuve struct {
	Story   string
	Chapter int
	Label   string
	Icon    string
	// Text: the step as the phone shows it.
	Text string
}

// Epreuves: the stories' games written so far.
var Epreuves = []Epreuve{
	{Story: "cour-hantee", Chapter: 2, Label: "Suivre le bruit sur le toit", Icon: "eye", Text: "L'épreuve : suivre les pas sur la tôle, à la lampe torche"},
	{Story: "chimpanze", Chapter: 1, Label: "Coincer Zézé dans la boutique", Icon: "banana", Text: "L'épreuve : coincer Zézé entre les cartons de la boutique"},
	{Story: "toile-korhogo", Chapter: 0, Label: "Démasquer la fausse toile", Icon: "palette", Text: "L'épreuve : trouver les erreurs de la fausse toile"},
	{Story: "voix-bouake", Chapter: 2, Label: "Retrouver la voix dans la foule", Icon: "music", Text: "L'épreuve : retrouver la chanteuse dans la foule, à l'oreille"},
	{Story: "dent-de-man", Chapter: 2, Label: "Grimper la Dent de Man", Icon: "mountain", Text: "L'épreuve : grimper la Dent de Man jusqu'au sommet"},
}

// EpreuveID: a story's épreuve's interaction.
func EpreuveID(story string) string { return EpreuvePrefix + story }

// IsEpreuve: whether an interaction is a story's épreuve.
func IsEpreuve(id string) bool { return strings.HasPrefix(id, EpreuvePrefix) }

// EpreuveIDs: every épreuve's interaction (the défi « epreuve » is played during them).
func EpreuveIDs() []string {
	ids := make([]string, len(Epreuves))
	for i, e := range Epreuves {
		ids[i] = EpreuveID(e.Story)
	}
	return ids
}

func init() {
	for _, e := range Epreuves {
		i := storyIndex(e.Story)
		if i < 0 || e.Chapter >= len(Stories[i].Chapters) {
			panic("épreuve sans histoire : " + e.Story)
		}
		ch := &Stories[i].Chapters[e.Chapter]
		last := ch.Steps[len(ch.Steps)-1]
		id := EpreuveID(e.Story)
		ch.Steps = append(slicesClone(ch.Steps), ErrandStep{Kind: last.Kind, City: last.City, Do: []string{id}, Text: e.Text, Epreuve: id})
		k := Kinds[last.Kind]
		k.Interactions = append(k.Interactions, Interaction{ID: id, Label: e.Label, Icon: e.Icon, Minutes: 20, Effect: Needs{Fun: 20, Social: 5}, Ages: KidsUp})
		Kinds[last.Kind] = k
	}
}

func storyIndex(id string) int {
	for i, s := range Stories {
		if s.ID == id {
			return i
		}
	}
	return -1
}

func slicesClone(s []ErrandStep) []ErrandStep { return append([]ErrandStep(nil), s...) }
