package game

import (
	"hash/fnv"
	"math/rand/v2"
	"slices"
	"strconv"
)

// The quartier's demandes (the update « demandes »): every real day, the
// people of the Sim's commune ask it for a few services, each a step or two
// at a place of the commune (taste the garba of the maquis next door, read
// the orphanage's children a story, pray for an old man's health). A step is
// done by finishing an activity there; the last one done, the one who asked
// says thanks and gives a little something. The game had plenty to do but
// nothing asking for it: these give a reason to go somewhere, every day.

// ErrandsKey: the update that opens them (features.go).
const ErrandsKey = "demandes"

// ErrandsADay: how many demandes a Sim gets a day.
const ErrandsADay = 3

// ErrandStep: something to go and do: an activity at a kind of place.
type ErrandStep struct {
	// Kind: the kind of place (Kinds) it's done at; the phone's « Y aller » walks to the nearest.
	Kind string `json:"kind"`
	// Do: the activities there that count (catalog IDs); one of them, finished, is the step done.
	Do   []string `json:"-"`
	Text string   `json:"text"`
}

// Errand: one demande, who asks it and what for.
type Errand struct {
	ID string `json:"id"`
	// Giver: who asks, and who they are in the quartier.
	Giver  string `json:"giver"`
	Role   string `json:"role"`
	Gender string `json:"gender"`
	// Ask: what they say asking; Thanks: what they say when it's done.
	Ask    string       `json:"ask"`
	Thanks string       `json:"thanks"`
	Steps  []ErrandStep `json:"steps"`
	// Reward: the Djai given for it (within the day's FromErrand), more than its steps cost.
	Reward int `json:"reward"`
	// Effect: how the Sim feels for having helped.
	Effect Needs `json:"-"`
}

// Errands: every demande the quartier may ask. Only free or cheap activities,
// with no fixed days and no update of their own, so any day can have them.
var Errands = []Errand{
	{ID: "garba-bintou", Giver: "Tantie Bintou", Role: "Vendeuse de garba", Gender: "femme",
		Ask:    "Mon enfant, va goûter le garba du maquis d'à côté et dis-moi s'il est meilleur que le mien !",
		Thanks: "Il met trop de piment, non ? Le mien reste le meilleur ! Tiens, pour ta peine.",
		Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Manger un garba au maquis"}}, Reward: 700, Effect: Needs{Social: 6}},
	{ID: "priere-kone", Giver: "Le vieux Koné", Role: "Doyen du grin", Gender: "homme",
		Ask:    "Mes jambes ne me portent plus jusqu'au lieu de prière. Va prier pour ma santé, que Dieu te bénisse.",
		Thanks: "Je me sens déjà mieux. Que Dieu te le rende, mon enfant !",
		Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier au lieu de culte"}}, Reward: 400, Effect: Needs{Social: 8, Fun: 2}},
	{ID: "tension-akissi", Giver: "Maman Akissi", Role: "Voisine", Gender: "femme",
		Ask:    "Ma tension monte encore. Va demander au pharmacien ce qu'il me faut, moi je ne comprends rien à ses papiers.",
		Thanks: "Ah, il a dit ça ? Merci, tu m'as sauvé la journée.",
		Steps:  []ErrandStep{{Kind: "pharmacie", Do: []string{"conseil"}, Text: "Demander conseil au pharmacien"}}, Reward: 500, Effect: Needs{Social: 6}},
	{ID: "histoire-odile", Giver: "Sœur Odile", Role: "Responsable de l'orphelinat", Gender: "femme",
		Ask:    "Les petits s'ennuient cet après-midi. Viens leur lire une histoire ou jouer un peu avec eux.",
		Thanks: "Ils n'arrêtent pas de parler de toi ! Reviens quand tu veux.",
		Steps:  []ErrandStep{{Kind: "orphelinat", Do: []string{"lire-enfants", "jouer-enfants", "repas-enfants"}, Text: "Lire une histoire ou jouer avec les enfants de l'orphelinat"}}, Reward: 600, Effect: Needs{Social: 10, Fun: 4}},
	{ID: "odile-priere", Giver: "Sœur Odile", Role: "Responsable de l'orphelinat", Gender: "femme",
		Ask:    "Lis une histoire aux enfants, puis va prier pour eux. Ils ont besoin qu'on pense à eux.",
		Thanks: "Tu as un bon cœur. Les enfants t'ont fait un dessin.",
		Steps: []ErrandStep{
			{Kind: "orphelinat", Do: []string{"lire-enfants", "jouer-enfants", "repas-enfants"}, Text: "Lire une histoire ou jouer avec les enfants de l'orphelinat"},
			{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour eux au lieu de culte"},
		}, Reward: 900, Effect: Needs{Social: 12, Fun: 4}},
	{ID: "marchander-yaya", Giver: "Yaya", Role: "Apprenti gbaka", Gender: "homme",
		Ask:    "Les tanties du marché me font toujours le prix fort. Toi tu sais parler : va marchander pour moi !",
		Thanks: "Eh, c'est toi le boss du marché ! Prends ça, c'est mérité.",
		Steps:  []ErrandStep{{Kind: "market", Do: []string{"bargain"}, Text: "Marchander avec les tanties du marché"}}, Reward: 500, Effect: Needs{Fun: 4}},
	{ID: "credit-serge", Giver: "Serge", Role: "Voisin de cour", Gender: "homme",
		Ask:    "Mon crédit est fini et ma go attend mon appel ! Va à la boutique m'acheter du crédit, je te rembourse avec un petit plus.",
		Thanks: "Tu m'as sauvé ! Voilà ton argent, et le petit plus.",
		Steps:  []ErrandStep{{Kind: "boutique", Do: []string{"credit"}, Text: "Acheter du crédit à la boutique"}}, Reward: 900, Effect: Needs{Social: 4}},
	{ID: "coiffure-didier", Giver: "Le grand-frère Didier", Role: "Vendeur de pièces auto", Gender: "homme",
		Ask:    "Tes cheveux là, c'est la brousse ! Va chez le barbier, c'est moi qui paie.",
		Thanks: "Voilà ! Maintenant tu es propre. Tiens, la coupe et un petit plus.",
		Steps:  []ErrandStep{{Kind: "barbier", Do: []string{"coupe-courte", "degrade", "boule-a-zero"}, Text: "Se faire couper les cheveux chez le barbier"}}, Reward: 1300, Effect: Needs{Fun: 3}},
	{ID: "photo-ange", Giver: "Ange", Role: "Photographe de rue", Gender: "homme",
		Ask:    "Mon appareil est en panne et un client veut une photo des tours du Plateau depuis la lagune. Tu peux la prendre pour moi ?",
		Thanks: "Belle photo ! Le client va être content. Voilà ta part.",
		Steps:  []ErrandStep{{Kind: "lagune", Do: []string{"photo-plateau"}, Text: "Prendre le Plateau en photo au bord de la lagune"}}, Reward: 500, Effect: Needs{Fun: 4}},
	{ID: "pneus-moussa", Giver: "Moussa", Role: "Livreur à vélo", Gender: "homme",
		Ask:    "Je suis en retard pour mes livraisons et mon vélo est à plat. Va le faire gonfler à la station, s'il te plaît !",
		Thanks: "Ça roule ! Merci, vraiment. Pour ta peine.",
		Steps:  []ErrandStep{{Kind: "station", Do: []string{"gonfler-pneus"}, Text: "Faire gonfler les pneus à la station-service"}}, Reward: 500, Effect: Needs{Social: 4}},
	{ID: "malade-rose", Giver: "Tonton Paul", Role: "Mécanicien", Gender: "homme",
		Ask:    "Ma femme Rose est à l'hôpital et je ne peux pas quitter le garage. Va lui rendre visite, ça lui fera plaisir.",
		Thanks: "Elle m'a appelé pour me dire que tu es passé. Merci du fond du cœur.",
		Steps:  []ErrandStep{{Kind: "health", Do: []string{"visite-malade"}, Text: "Rendre visite à un malade à l'hôpital"}}, Reward: 600, Effect: Needs{Social: 10}},
	{ID: "ambiance-kader", Giver: "DJ Kader", Role: "DJ du quartier", Gender: "homme",
		Ask:    "Je prépare ma soirée : va faire un tour dans la rue d'ambiance et dis-moi où il y a du monde ce soir.",
		Thanks: "D'accord, je vais installer mon son là-bas. T'es mon informateur officiel !",
		Steps:  []ErrandStep{{Kind: "rue", Do: []string{"flaner-rue"}, Text: "Flâner dans la rue d'ambiance"}}, Reward: 400, Effect: Needs{Fun: 4}},
	{ID: "goute-adjoua", Giver: "Maman Adjoua", Role: "Grand-mère du quartier", Gender: "femme",
		Ask:    "Mes petits-enfants viennent ce soir. Va goûter l'alloco du marché, puis prends une sucrerie bien fraîche à la boutique, pour voir si c'est bon pour eux.",
		Thanks: "Tu es un amour. Les enfants vont se régaler !",
		Steps: []ErrandStep{
			{Kind: "market", Do: []string{"eat-alloco"}, Text: "Manger un alloco au marché"},
			{Kind: "boutique", Do: []string{"sucrerie"}, Text: "Prendre une sucrerie à la boutique"},
		}, Reward: 1000, Effect: Needs{Social: 8}},
	{ID: "gbairai-mariam", Giver: "Tantie Mariam", Role: "Couturière", Gender: "femme",
		Ask:    "Je suis coincée à l'atelier toute la journée. Va au maquis écouter le gbairai, et viens tout me raconter !",
		Thanks: "Quoi ? Il a fait ça ? Je savais ! Merci pour les nouvelles.",
		Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"gbairai"}, Text: "Faire le gbairai au maquis"}}, Reward: 400, Effect: Needs{Social: 6, Fun: 4}},
	{ID: "plage-junior", Giver: "Junior", Role: "Maître-nageur", Gender: "homme",
		Ask:    "Le drapeau est rouge aujourd'hui. Va marcher au bord de l'eau et dis aux gens de ne pas trop s'avancer.",
		Thanks: "Grâce à toi, personne n'a bu la tasse aujourd'hui. Merci !",
		Steps:  []ErrandStep{{Kind: "beach", Do: []string{"balade-plage"}, Text: "Marcher au bord de l'eau à la plage"}}, Reward: 400, Effect: Needs{Fun: 4}},
	{ID: "lagune-aminata", Giver: "Aminata", Role: "Étudiante", Gender: "femme",
		Ask:    "J'ai un exposé sur la lagune Ébrié. Va te promener au bord de l'eau et dis-moi ce que tu as vu !",
		Thanks: "Super, j'ai tout noté. Mon exposé va être le meilleur !",
		Steps:  []ErrandStep{{Kind: "lagune", Do: []string{"balade-lagune", "coucher-soleil"}, Text: "Se promener au bord de la lagune"}}, Reward: 400, Effect: Needs{Fun: 4}},
	{ID: "medicament-awa", Giver: "Awa", Role: "Maman du quartier", Gender: "femme",
		Ask:    "Mon petit a de la fièvre. Va demander au pharmacien quoi lui donner, puis prie pour qu'il guérisse vite.",
		Thanks: "La fièvre est tombée ! Merci, que Dieu te garde.",
		Steps: []ErrandStep{
			{Kind: "pharmacie", Do: []string{"conseil"}, Text: "Demander conseil au pharmacien"},
			{Kind: "worship", Do: []string{"pray"}, Text: "Prier au lieu de culte"},
		}, Reward: 800, Effect: Needs{Social: 8}},
}

// FindErrand: a demande by its ID.
func FindErrand(id string) (Errand, bool) {
	i := slices.IndexFunc(Errands, func(e Errand) bool { return e.ID == id })
	if i < 0 {
		return Errand{}, false
	}
	return Errands[i], true
}

// Counts: whether finishing this activity at this kind of place does the step.
func (st ErrandStep) Counts(kind, interaction string) bool {
	return st.Kind == kind && slices.Contains(st.Do, interaction)
}

// errandFor: whether a Sim at this stage can do every step, with the kinds of place its commune has.
func errandFor(e Errand, stage string, kinds map[string]bool) bool {
	for _, st := range e.Steps {
		if !kinds[st.Kind] {
			return false
		}
		k, ok := Kinds[st.Kind]
		if !ok {
			return false
		}
		can := false
		for _, it := range k.Interactions {
			if slices.Contains(st.Do, it.ID) && it.AllowedFor(stage) == nil {
				can = true
				break
			}
		}
		if !can {
			return false
		}
	}
	return true
}

// ErrandsOfDay: the demandes a Sim gets on a real day: ErrandsADay of those it
// can do, drawn from the Sim and the day, so they're the same all day long, and
// never two from the same person. A baby gets none.
func ErrandsOfDay(sim string, day int64, stage string, kinds map[string]bool) []string {
	if stage == StageBebe {
		return nil
	}
	h := fnv.New64a()
	h.Write([]byte(sim + "|" + strconv.FormatInt(day, 10)))
	rng := rand.New(rand.NewPCG(h.Sum64(), 0))
	pool := make([]Errand, 0, len(Errands))
	for _, e := range Errands {
		if errandFor(e, stage, kinds) {
			pool = append(pool, e)
		}
	}
	rng.Shuffle(len(pool), func(i, j int) { pool[i], pool[j] = pool[j], pool[i] })
	var out []string
	givers := map[string]bool{}
	for _, e := range pool {
		if len(out) == ErrandsADay {
			break
		}
		if givers[e.Giver] {
			continue
		}
		givers[e.Giver] = true
		out = append(out, e.ID)
	}
	return out
}
