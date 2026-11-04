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
	{Story: "mami-wata", Chapter: 2, Label: "Le filet sur la lagune", Icon: "waves", Text: "L'épreuve : ramasser les plastiques au filet, sans prendre les poissons"},
	{Story: "bac-fanta", Chapter: 1, Label: "Réviser la philo avec Fanta", Icon: "graduation-cap", Text: "L'épreuve : réviser la philo avec Fanta (chaque philosophe et son idée)"},
	{Story: "roi-manette", Chapter: 1, Label: "La combo de Seydou", Icon: "gamepad-2", Text: "L'épreuve : refaire la combo secrète de Seydou"},
	{Story: "telephone-vole", Chapter: 2, Label: "Repérer Kevin dans la gare", Icon: "smartphone", Text: "L'épreuve : repérer le garçon dans la foule de la gare, d'après les coxers"},
	{Story: "chat-grigri", Chapter: 0, Label: "Trouver Grigri au marché", Icon: "eye", Text: "L'épreuve : repérer Grigri entre les paniers du marché"},
	{Story: "recette-ahou", Chapter: 0, Label: "Assaisonner comme Mémé Ahou", Icon: "drumstick", Text: "L'épreuve : assaisonner la sauce comme Mémé Ahou, ni trop ni trop peu"},
	{Story: "grand-match", Chapter: 0, Label: "Espionner l'équipe d'en face", Icon: "eye", Text: "L'épreuve : suivre le ballon de l'équipe d'en face, passe après passe"},
	{Story: "avion-gilbert", Chapter: 1, Label: "Les bagages de Tonton Gilbert", Icon: "briefcase", Text: "L'épreuve : attraper les bagages de Tonton Gilbert sur le tapis"},
	{Story: "brouteur", Chapter: 3, Label: "Le vrai du faux avec Jojo", Icon: "newspaper", Text: "L'épreuve : trier les vraies offres d'emploi et les arnaques avec Jojo"},
	{Story: "kone-petit-fils", Chapter: 1, Label: "Le dégradé du barbier", Icon: "scissors", Text: "L'épreuve : suivre le trait du dégradé avec la tondeuse"},
	{Story: "bintou-maquis", Chapter: 3, Label: "Le service de l'ouverture", Icon: "drumstick", Text: "L'épreuve : servir les tables de Tantie Bintou le jour de l'ouverture"},
	{Story: "serge-fatou", Chapter: 3, Label: "Marchander les pagnes", Icon: "banknote", Text: "L'épreuve : marchander les pagnes de la dot avec les tanties"},
	{Story: "maquis-maudit", Chapter: 3, Label: "Le braisé de Tantie Bintou", Icon: "fish", Text: "L'épreuve : braiser le poisson frais, retourné au bon moment"},
	{Story: "caimans", Chapter: 2, Label: "Les mots justes", Icon: "heart-handshake", Text: "L'épreuve : trouver les mots justes devant l'oncle de Tonton Kouassi"},
	{Story: "mariage-attache", Chapter: 3, Label: "La danse de la fête", Icon: "music", Text: "L'épreuve : danser au maquis, pas après pas, en rythme"},
	{Story: "revenant-port", Chapter: 0, Label: "Les bougies pour Daniel", Icon: "church", Text: "L'épreuve : garder les bougies allumées pour Daniel malgré le vent"},
	{Story: "cacao-daloa", Chapter: 1, Label: "Juste ou truqué", Icon: "calculator", Text: "L'épreuve : lire les pesées des planteurs, juste ou truqué"},
	{Story: "pretendant-accra", Chapter: 1, Label: "Le vrai kente", Icon: "palette", Text: "L'épreuve : reconnaître le motif d'un vrai kente tissé main"},
	{Story: "partir-rester", Chapter: 3, Label: "La grue du port", Icon: "briefcase", Text: "L'épreuve : empiler les conteneurs à la grue, au port de San-Pédro"},
	{Story: "marathon-yao", Chapter: 0, Label: "Courir au rythme de Pépé Yao", Icon: "footprints", Text: "L'épreuve : courir au rythme de Pépé Yao, foulée après foulée"},
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
