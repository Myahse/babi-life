package game

import "slices"

// The quartier's stories (the update « histoires », with the demandes): the
// same person comes back day after day with what happened next. A story is a
// few chapters, one a real day at most, each a demande of its own (steps at a
// place of the commune, a thanks, a reward); its last chapter's thanks
// introduces the one whose story comes next. Only free or cheap activities
// with no fixed days, as for the demandes, so a chapter can always be done.

// StoriesKey: the update that opens them (features.go).
const StoriesKey = "histoires"

// StoryChapter: one day's part of a story.
type StoryChapter struct {
	Ask    string       `json:"ask"`
	Thanks string       `json:"thanks"`
	Steps  []ErrandStep `json:"steps"`
	Reward int          `json:"reward"`
}

// Story: who it's about and its chapters, in order.
type Story struct {
	ID       string         `json:"id"`
	Title    string         `json:"title"`
	Giver    string         `json:"giver"`
	Role     string         `json:"role"`
	Gender   string         `json:"gender"`
	Chapters []StoryChapter `json:"-"`
	// Effect: how the Sim feels after each chapter.
	Effect Needs `json:"-"`
}

// Stories: in the order they come; each one's end leads to the next. A story
// a Sim can't do (its age, its commune's places) is passed over.
var Stories = []Story{
	{ID: "kone-petit-fils", Title: "Le petit-fils du vieux Koné", Giver: "Le vieux Koné", Role: "Doyen du grin", Gender: "homme", Effect: Needs{Social: 8},
		Chapters: []StoryChapter{
			{Ask: "Mes yeux ne voient plus bien. Mon petit-fils arrive de France et je veux revoir ses photos : demande au pharmacien s'il a quelque chose pour mes yeux.",
				Thanks: "Des gouttes ? Je vois déjà mieux ! Reviens demain, j'aurai encore besoin de toi.",
				Steps:  []ErrandStep{{Kind: "pharmacie", Do: []string{"conseil"}, Text: "Demander conseil au pharmacien"}}, Reward: 500},
			{Ask: "Il arrive demain ! Va te faire beau chez le barbier, je veux te présenter à lui. C'est moi qui paie.",
				Thanks: "Te voilà tout propre ! Il va voir qu'à Babi on a la classe.",
				Steps:  []ErrandStep{{Kind: "barbier", Do: []string{"coupe-courte", "degrade", "boule-a-zero"}, Text: "Se faire couper les cheveux chez le barbier"}}, Reward: 1300},
			{Ask: "Il est arrivé, mais il ne connaît rien ici. Emmène-le manger un garba au maquis, montre-lui Babi !",
				Thanks: "Il a mangé avec les doigts comme un vrai enfant de Babi ! Il ne parle que de toi.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Manger un garba au maquis avec lui"}}, Reward: 800},
			{Ask: "Il repart demain, mon cœur est lourd. Va prier pour son voyage, qu'il revienne vite.",
				Thanks: "Il a promis de revenir chaque année. Tu fais partie de la famille maintenant. Ah, Tantie Bintou cherche quelqu'un de confiance : passe la voir de ma part.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour son voyage au lieu de culte"}}, Reward: 1000},
		}},
	{ID: "bintou-maquis", Title: "Le maquis de Tantie Bintou", Giver: "Tantie Bintou", Role: "Vendeuse de garba", Gender: "femme", Effect: Needs{Social: 6, Fun: 4},
		Chapters: []StoryChapter{
			{Ask: "Le vieux Koné m'a parlé de toi. Je veux ouvrir mon propre maquis ! Va manger chez la concurrence et regarde bien comment ils font.",
				Thanks: "Leur attiéké est sec ? Je savais ! Le mien sera meilleur. Reviens demain.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Manger un garba au maquis du coin"}}, Reward: 700},
			{Ask: "Un maquis sans clients, c'est rien. Va au marché faire le gbairai et dis à tout le monde que Tantie Bintou ouvre bientôt !",
				Thanks: "Tout le marché ne parle que de ça ! Toi-là, tu es ma meilleure publicité.",
				Steps:  []ErrandStep{{Kind: "market", Do: []string{"gbairai"}, Text: "Faire le gbairai au marché"}}, Reward: 600},
			{Ask: "Aïe, mon dos ! J'ai porté trop de marmites pour préparer l'ouverture. Va demander au pharmacien ce qu'il faut.",
				Thanks: "La pommade fait du bien. Demain c'est le grand jour, ne rate pas ça !",
				Steps:  []ErrandStep{{Kind: "pharmacie", Do: []string{"conseil"}, Text: "Demander conseil au pharmacien"}}, Reward: 500},
			{Ask: "C'est l'ouverture ! Viens manger au maquis, je veux voir du monde à mes tables.",
				Thanks: "Mon maquis est plein ! Je n'oublierai jamais ce que tu as fait. Serge, le voisin de cour, a un gros souci de cœur : il a besoin de toi.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Manger au maquis le jour de l'ouverture"}}, Reward: 1500},
		}},
	{ID: "serge-fatou", Title: "Serge et Fatou", Giver: "Serge", Role: "Voisin de cour", Gender: "homme", Effect: Needs{Social: 8, Fun: 2},
		Chapters: []StoryChapter{
			{Ask: "Fatou, ma go, ne me parle plus et je ne sais même pas pourquoi. Va au maquis faire le gbairai : je veux savoir ce qu'on dit sur moi.",
				Thanks: "J'ai oublié son anniversaire ?! Je suis mort. Reviens demain, il faut un plan.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"gbairai"}, Text: "Faire le gbairai au maquis"}}, Reward: 600},
			{Ask: "Je dois l'appeler pour m'excuser, mais mon crédit est fini. Va m'en acheter à la boutique, je te rembourse.",
				Thanks: "Elle a décroché ! Elle veut bien me revoir… si je deviens sérieux.",
				Steps:  []ErrandStep{{Kind: "boutique", Do: []string{"credit"}, Text: "Acheter du crédit à la boutique"}}, Reward: 900},
			{Ask: "Être sérieux, c'est demander sa main. J'ai peur ! Va prier pour moi, que Dieu me donne le courage.",
				Thanks: "Je me sens fort comme un lion. Demain, on prépare la dot !",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour lui au lieu de culte"}}, Reward: 600},
			{Ask: "Pour la dot, il faut des pagnes, et les tanties du marché me font toujours le prix fort. Va marchander pour moi !",
				Thanks: "Elle a dit oui ! Le mariage est à la fin du mois, et c'est toi mon témoin. Tout le quartier te connaît maintenant.",
				Steps:  []ErrandStep{{Kind: "market", Do: []string{"bargain"}, Text: "Marchander les pagnes au marché"}}, Reward: 1200},
		}},
}

// FindStory: a story by its ID.
func FindStory(id string) (Story, bool) {
	i := slices.IndexFunc(Stories, func(s Story) bool { return s.ID == id })
	if i < 0 {
		return Story{}, false
	}
	return Stories[i], true
}

// For: whether a Sim at this stage can do every chapter, with its commune's kinds of place.
func (st Story) For(stage string, kinds map[string]bool) bool {
	if stage == StageBebe {
		return false
	}
	for _, c := range st.Chapters {
		if !errandFor(Errand{Steps: c.Steps}, stage, kinds) {
			return false
		}
	}
	return true
}

// NextStory: the first story not yet seen (done or passed over) that the Sim can do.
func NextStory(seen map[string]bool, stage string, kinds map[string]bool) (Story, bool) {
	for _, st := range Stories {
		if !seen[st.ID] && st.For(stage, kinds) {
			return st, true
		}
	}
	return Story{}, false
}
