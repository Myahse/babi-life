package game

import "math/rand/v2"

// Les voisins vivants (the update « voisins-vivants », sims/voisins.go; web components/VoisinsApp.tsx):
// the Sim's cour has its neighbours, the same three families who stay (until one moves out and another
// moves in), each with its name, its trade, its character, its children, and a life that goes on with
// the days: a baby is born, a wedding, a new job, a quarrel heard through the wall, a party. They come to
// the Sim too: to borrow some money, to invite it to the baptism, to ask a hand with the wardrobe, to keep
// the children an afternoon; the music too loud on a Saturday night; a death in the family. What the Sim
// does (a greeting each day, a dish brought, a yes or a no) makes the bond (Lien, 0 to 100): close, they
// bring a plate of alloco now and then and pay back what they borrowed; cold, they don't greet any more.

// VoisinsKey: the update.
const VoisinsKey = "voisins-vivants"

// FromVoisins: what the neighbours pay (keeping their children), within the day's cap (money.go).
const FromVoisins Income = "voisins"

// The neighbours' rules.
const (
	VoisinsCount = 3
	// VoisinEventChance: a neighbour family's chance a game day of something happening (to it, or to ask).
	VoisinEventChance = 0.3
	// VoisinCatchUp: the game days counted at most at once (the game left a month isn't a month of news).
	VoisinCatchUp = 3
	// VoisinAskDays: an ask waits so long (game days), then it's too late.
	VoisinAskDays = 1
	// The Sim's own things: a greeting (once a game day), a dish brought (its price).
	GreetLien = 3
	DishCost  = 1000
	DishLien  = 8
	// LienStart: a new family's bond; LienClose: from here they're « comme la famille ».
	LienStart = 30
	LienClose = 80
	// VoisinNews: the last things known of a family.
	VoisinNews = 5
	// VoisinMoveChance: a family's chance, on one of its events, of moving out (another moves in).
	VoisinMoveChance = 0.04
)

// LienLabel: what the bond is.
func LienLabel(l int) string {
	switch {
	case l >= LienClose:
		return "Comme la famille"
	case l >= 50:
		return "Bons voisins"
	case l >= 20:
		return "Voisins"
	}
	return "En froid"
}

// VoisinNames: the families of the cour.
var VoisinNames = []string{"Kouassi", "Traoré", "Koné", "Bamba", "Yao", "Ouattara", "Coulibaly", "Diabaté", "N'Guessan", "Konan", "Touré", "Aka", "Assi", "Kouadio", "Cissé", "Dosso", "Koffi", "Sangaré"}

// VoisinJobs: what the head of the family does.
var VoisinJobs = []string{"couturière", "mécanicien", "instituteur", "commerçante au marché", "chauffeur de gbaka", "infirmière", "tailleur", "vendeuse d'attiéké", "gardien", "électricien", "coiffeuse", "comptable"}

// VoisinTraits: their character (what they ask, how they take a no).
var VoisinTraits = []string{"bavard", "serviable", "fetard", "pieux", "discret", "curieux"}

// AskKind: what a neighbour can come and ask, its answers and what each does.
type AskKind struct {
	ID string
	// Text: the ask (« %s » the neighbour's name), Yes and No the answers' labels.
	Text, Yes, No string
	// Cost: paid on yes (an envelope, a gift; the loan's amount is drawn: Loan); Pay: earned on yes (FromVoisins).
	Cost, Pay int
	Loan      bool
	// On yes / no: the bond, the Sim's needs.
	YesLien, NoLien   int
	YesNeeds, NoNeeds Needs
	// YesText, NoText: what is said after (« %s » the neighbour).
	YesText, NoText string
	// Traits: only asked by these (none: by anyone).
	Traits []string
}

// AskKinds: what can be asked.
var AskKinds = []AskKind{
	{ID: "emprunt", Text: "%s frappe, un peu gêné·e : « Tu peux me dépanner jusqu'à la fin du mois ? »", Yes: "Prêter", No: "Pas cette fois", Loan: true, YesLien: 12, NoLien: -5, YesText: "%s te remercie mille fois : « Je te rends ça vite, vraiment. »", NoText: "%s comprend… mais repart déçu·e."},
	{ID: "bapteme", Text: "%s t'invite au baptême du petit dernier, samedi dans la cour.", Yes: "J'y vais (cadeau 2 000 F)", No: "Je ne peux pas", Cost: 2000, YesLien: 10, NoLien: -3, YesNeeds: Needs{Social: 30, Fun: 20, Hunger: 25}, YesText: "Le baptême chez %s : le riz gras, la musique, toute la cour. Une belle fête.", NoText: "%s regrette que tu ne sois pas venu·e."},
	{ID: "bruit", Text: "La musique de chez %s fait trembler les murs, en pleine nuit…", Yes: "Laisser faire", No: "Aller se plaindre", YesLien: 3, NoLien: -8, YesNeeds: Needs{Energy: -15}, NoNeeds: Needs{Energy: 5}, YesText: "Tu mets l'oreiller sur ta tête. %s ne saura jamais.", NoText: "%s baisse le son en râlant : « Ah, on ne peut plus s'amuser ! »", Traits: []string{"fetard", "bavard"}},
	{ID: "garde", Text: "%s doit courir au marché : « Tu peux garder les enfants cet après-midi ? »", Yes: "Les garder", No: "Je suis occupé·e", Pay: 2000, YesLien: 10, NoLien: -3, YesNeeds: Needs{Energy: -10, Social: 20, Fun: 10}, YesText: "Les enfants de %s ont joué tout l'après-midi. Au retour, un petit billet pour te remercier.", NoText: "%s trouvera quelqu'un d'autre."},
	{ID: "coup-de-main", Text: "%s n'arrive pas à monter l'armoire neuve : « Tu as cinq minutes ? »", Yes: "Donner un coup de main", No: "Pas le temps", YesLien: 12, NoLien: -4, YesNeeds: Needs{Energy: -15, Social: 15}, YesText: "L'armoire de %s est montée. « Toi, tu es un vrai voisin ! »", NoText: "%s soupire et appelle un cousin."},
	{ID: "condoleances", Text: "Un deuil chez %s : un oncle au village. La cour vient présenter ses condoléances.", Yes: "Présenter ses condoléances (enveloppe 2 000 F)", No: "Ne pas y aller", Cost: 2000, YesLien: 15, NoLien: -10, YesNeeds: Needs{Social: 10}, YesText: "%s te serre les mains longtemps : « Merci d'être venu·e. »", NoText: "Toute la cour est passée chez %s… sauf toi. Ça a été remarqué."},
	{ID: "priere", Text: "%s organise une veillée de prière dans la cour ce soir. Tu viens ?", Yes: "J'y vais", No: "Une autre fois", YesLien: 8, NoLien: -2, YesNeeds: Needs{Social: 20, Fun: 10}, YesText: "La veillée chez %s : les chants, les mains levées. Tu repars apaisé·e.", NoText: "%s prie pour toi quand même.", Traits: []string{"pieux"}},
}

// FindAsk: an ask by its id.
func FindAsk(id string) (AskKind, bool) {
	for _, a := range AskKinds {
		if a.ID == id {
			return a, true
		}
	}
	return AskKind{}, false
}

// AskFor: an ask drawn for a neighbour of this character.
func AskFor(trait string, rng *rand.Rand) AskKind {
	var cands []AskKind
	for _, a := range AskKinds {
		if len(a.Traits) == 0 || roleIn(a.Traits, trait) {
			cands = append(cands, a)
		}
	}
	return cands[rng.IntN(len(cands))]
}

// LoanAmount: what a neighbour asks to borrow.
func LoanAmount(rng *rand.Rand) int { return 2000 + 1000*rng.IntN(7) }

// VoisinNewsKinds: what happens in a family's own life (« %s » the family's name).
var VoisinNewsKinds = []struct {
	ID, Text string
}{
	{"naissance", "Un bébé est né chez les %s ! Toute la cour est passée le voir."},
	{"boulot", "Chez les %s, on fête : le travail a repris, un nouveau contrat."},
	{"dispute", "On a entendu crier chez les %s hier soir… ça s'est calmé au matin."},
	{"fete", "Les %s ont fait griller du poulet dans la cour : l'odeur est arrivée jusque chez toi."},
	{"examen", "Le grand des %s a eu son examen : ses parents en parlent à tout le monde."},
	{"voiture", "Les %s ont acheté une voiture d'occasion : ils la lavent tous les dimanches."},
	{"malade", "Le père des %s est au lit avec le palu. Ça va aller, paraît-il."},
	{"village", "Les %s sont rentrés du village avec des sacs d'ignames."},
}
