package game

import "slices"

// The happenings played (the update « evenements-joues »): instead of the one passive join, each street
// happening offers two to four things to do, each played as a little 3D game (web
// components/defi/jeux/configs/evenements.ts, the défi « evenement » in sims defi.go). The score scales
// what it does (and what it pays, a sale to the passers-by); a bad one can bring the happening's mishap
// (soaked by the gbaka's splash). Closed, the happenings are as they were: their single Join.

// EventsKey is the update the played happenings wait for.
const EventsKey = "evenements-joues"

// EventChoicePrefix starts every played choice's id (web lib/features.ts holds them back before the server answers).
const EventChoicePrefix = "evt-"

// MishapScore: under it, a choice's mishap comes (played badly).
const MishapScore = 40

// EventChoice is one thing to do at a happening: its interaction, played; and what a bad score brings.
type EventChoice struct {
	Interaction
	Mishap *RandomEvent `json:"-"`
}

// keep: the happening's own join kept as one of its choices (the foot's real match, the jam's junction).
const keep = "\x00keep"

func ch(id, label, icon string, minutes int64, cost int, e Needs, mishap ...RandomEvent) EventChoice {
	c := EventChoice{Interaction: Interaction{ID: EventChoicePrefix + id, Label: label, Icon: icon, Minutes: minutes, Cost: cost, Effect: e}}
	if len(mishap) > 0 {
		c.Mishap = &mishap[0]
	}
	return c
}

func oops(text string, money int, e Needs) RandomEvent {
	return RandomEvent{Text: text, Money: money, Effect: e}
}

// eventChoices: each happening's choices (keep: its own join, as it is).
var eventChoices = map[string][]EventChoice{
	"pluie": {
		ch("pluie-courir", "Courir s'abriter", "footprints", 20, 0, Needs{Fun: 10, Social: 5, Energy: -5},
			oops("Un gbaka passe dans la flaque : tu es trempé·e de la tête aux pieds.", 0, Needs{Hygiene: -25, Fun: -10})),
		ch("pluie-sachets", "Vendre des sachets aux passants", "shopping-bag", 30, -1500, Needs{Social: 15, Energy: -5},
			oops("Un coup de vent emporte la moitié de tes sachets dans le caniveau.", 0, Needs{Fun: -10})),
		ch("pluie-danser", "Danser sous la pluie", "music", 20, 0, Needs{Fun: 35, Social: 10, Hygiene: -20, Energy: -5},
			oops("Tu glisses dans la boue en plein pas de danse : tout le quartier rigole.", 0, Needs{Hygiene: -10, Fun: -5})),
		ch("pluie-voiture", "Aider à pousser la voiture embourbée", "car", 30, 0, Needs{Social: 25, Hygiene: -15, Energy: -15},
			oops("La roue patine et t'arrose de boue des pieds à la tête.", 0, Needs{Hygiene: -20})),
	},
	"delestage": {
		ch("delestage-lampe", "Allumer la lampe-tempête", "flame", 15, 0, Needs{Social: 15, Fun: 10},
			oops("La mèche fume et noircit le verre : on se contente du téléphone.", 0, Needs{Fun: -5})),
		ch("delestage-contes", "Raconter des contes dans le noir", "book-open", 30, 0, Needs{Social: 30, Fun: 20}),
		ch("delestage-groupe", "Réparer le groupe électrogène", "hammer", 30, 0, Needs{Social: 25, Fun: 5, Hygiene: -10, Energy: -10},
			oops("Le groupe tousse, crache une fumée noire… et s'arrête pour de bon.", 0, Needs{Hygiene: -10, Fun: -5})),
	},
	"mariage": {
		ch("mariage-danser", "Danser dans le cortège", "music", 30, 0, Needs{Social: 30, Fun: 30, Energy: -10}),
		ch("mariage-riz", "Lancer le riz sur les mariés", "heart", 15, 0, Needs{Social: 25, Fun: 20},
			oops("Ton riz atterrit dans le foulard de la tantie : elle te regarde de travers.", 0, Needs{Social: -10})),
		ch("mariage-photo", "Prendre la photo des mariés", "camera", 20, 0, Needs{Social: 25, Fun: 15},
			oops("La photo est floue : la mariée te demande de la refaire… trois fois.", 0, Needs{Fun: -5})),
	},
	"match": {
		ch("match-ambiance", "Faire l'ambiance devant l'écran", "drum", 60, 200, Needs{Fun: 40, Social: 30}),
		ch("match-prono", "Faire son pronostic", "trophy", 20, 0, Needs{Fun: 20, Social: 20}),
		ch("match-but", "Fêter le but sur les épaules", "flag", 15, 0, Needs{Fun: 35, Social: 20, Energy: -5},
			oops("Tu tombes des épaules du grand frère en plein milieu de la foule.", 0, Needs{Energy: -10, Fun: -5})),
	},
	"concert": {
		ch("concert-danser", "Danser le coupé-décalé", "music", 45, 0, Needs{Fun: 45, Social: 25, Energy: -20, Hygiene: -10}),
		ch("concert-travailler", "Faire le « travaillement »", "banknote", 20, 1000, Needs{Social: 30, Fun: 25},
			oops("Tu « travailles » un peu trop : quelques billets de plus s'envolent.", -1000, Needs{Fun: 5})),
		ch("concert-dj", "Réclamer son morceau au DJ", "disc-3", 15, 0, Needs{Fun: 25, Social: 15}),
	},
	"embouteillage": {
		{Interaction: Interaction{ID: keep}},
		ch("embouteillage-eau", "Vendre de l'eau aux chauffeurs", "glass-water", 30, -1200, Needs{Social: 15, Energy: -10},
			oops("Le gbaka démarre sans payer ses deux sachets !", 0, Needs{Fun: -10})),
	},
	"controle": {
		ch("controle-papiers", "Montrer les bons papiers", "id-card", 10, 0, Needs{Fun: 5},
			oops("« Laisse quelque chose pour le café… » Tu donnes 1 000F.", -1000, Needs{Fun: -10})),
		ch("controle-poli", "Rester poli avec l'agent", "shield", 10, 0, Needs{Fun: 5, Social: 5},
			oops("L'agent te garde une demi-heure sur le côté de la route.", 0, Needs{Fun: -10, Energy: -5})),
	},
	"foot": {
		{Interaction: Interaction{ID: keep}},
		ch("foot-penalty", "Tirer les penalties", "volleyball", 20, 0, Needs{Fun: 30, Social: 15, Energy: -10, Hygiene: -5}),
		ch("foot-commenter", "Commenter le match", "megaphone", 20, 0, Needs{Fun: 25, Social: 20}),
	},
	"bapteme": {
		ch("bapteme-plateau", "Faire le tour avec le plateau", "utensils", 20, 0, Needs{Social: 25, Hunger: 15},
			oops("Le plateau penche : le jus de bissap finit sur la robe de la tantie.", 0, Needs{Social: -5, Hygiene: -5})),
		ch("bapteme-cadeau", "Choisir le cadeau du bébé", "gift", 20, 1000, Needs{Social: 30, Fun: 15}),
	},
	"anniversaire": {
		ch("anniversaire-bougies", "Souffler les bougies", "cake", 10, 0, Needs{Fun: 25, Social: 15},
			oops("Tu postillonnes sur le gâteau : plus personne n'en veut.", 0, Needs{Social: -5})),
		ch("anniversaire-gateau", "Couper et servir le gâteau", "cake", 20, 0, Needs{Social: 20, Hunger: 15, Fun: 10}),
		ch("anniversaire-cadeau", "Emballer le cadeau", "gift", 15, 0, Needs{Social: 20, Fun: 15}),
	},
	"funerailles": {
		ch("funerailles-chorale", "Chanter avec la chorale", "music", 30, 0, Needs{Social: 30, Fun: -5, Energy: -10}),
		ch("funerailles-servir", "Servir les invités", "utensils", 30, 0, Needs{Social: 30, Energy: -10},
			oops("Un verre t'échappe des mains : tu t'excuses auprès de la famille.", 0, Needs{Social: -5})),
		ch("funerailles-condoleances", "Présenter ses condoléances", "hand-heart", 15, 2000, Needs{Social: 35, Fun: -10}),
	},
	"association": {
		ch("association-caisse", "Compter la caisse avec le trésorier", "piggy-bank", 30, 1000, Needs{Social: 30, Fun: 5}),
		ch("association-parole", "Prendre la parole à la réunion", "users", 30, 0, Needs{Social: 30, Fun: 10}),
	},
	"tontine": {
		ch("tontine-cotiser", "Cotiser à la tontine", "piggy-bank", 15, 5000, Needs{Social: 20}),
		ch("tontine-cahier", "Tenir le cahier de la tontine", "notebook-pen", 20, 0, Needs{Social: 20, Fun: 5}),
	},
	"salubrite": {
		ch("salubrite-caniveau", "Curer le caniveau", "shovel", 30, 0, Needs{Social: 30, Hygiene: -20, Energy: -15}),
		ch("salubrite-brouette", "Pousser la brouette", "hard-hat", 30, 0, Needs{Social: 25, Hygiene: -10, Energy: -15},
			oops("La brouette se renverse : tout le tas de feuilles est à refaire.", 0, Needs{Fun: -10, Energy: -5})),
	},
	"ouverture-boutique": {
		ch("boutique-cartons", "Porter les cartons", "store", 20, -800, Needs{Social: 10, Energy: -10},
			oops("Un carton tombe : le patron retient la casse sur ta pièce.", 0, Needs{Fun: -10})),
		ch("boutique-ruban", "Couper le ruban", "scissors", 10, 0, Needs{Fun: 20, Social: 15}),
		ch("boutique-file", "Être le premier dans la file", "ticket", 15, 0, Needs{Fun: 20, Social: 5},
			oops("Trop tard : les promos sont parties avant toi.", 0, Needs{Fun: -10})),
	},
	"ligue1": {
		ch("ligue1-chants", "Chanter avec les supporters", "drum", 60, 1000, Needs{Fun: 40, Social: 30, Energy: -10}),
		ch("ligue1-tifo", "Filmer le tifo", "camera", 20, 0, Needs{Fun: 25, Social: 15}),
	},
	"basket": {
		{Interaction: Interaction{ID: keep}},
		ch("basket-lancers", "Tirer des lancers francs", "trophy", 20, 0, Needs{Fun: 30, Social: 15, Energy: -10, Hygiene: -5}),
		ch("basket-micro", "Commenter au micro", "megaphone", 20, 0, Needs{Fun: 25, Social: 20}),
	},
	"inondation": {
		ch("inondation-caniveau", "Déboucher le caniveau", "shovel", 30, 0, Needs{Social: 25, Hygiene: -25, Energy: -10},
			oops("Le caniveau déborde sur tes chaussures.", 0, Needs{Hygiene: -15})),
		ch("inondation-passeur", "Faire traverser les passants", "hand", 30, -1000, Needs{Social: 20, Hygiene: -10, Energy: -10},
			oops("Le sac de la tantie tombe à l'eau : tu lui rends sa pièce.", 0, Needs{Social: -10})),
		ch("inondation-affaires", "Repêcher les affaires emportées", "waves", 20, 0, Needs{Social: 25, Hygiene: -20, Energy: -10}),
	},
	"femua": {
		ch("femua-danser", "Danser devant la grande scène", "music", 90, 0, Needs{Fun: 55, Social: 35, Energy: -25, Hygiene: -15}),
		ch("femua-filmer", "Filmer les artistes", "camera", 30, 0, Needs{Fun: 30, Social: 20}),
		ch("femua-quiz", "Le quiz du FEMUA", "trophy", 20, 0, Needs{Fun: 25, Social: 15}),
	},
	"abissa": {
		ch("abissa-tambours", "Danser au son des tambours", "drum", 60, 0, Needs{Fun: 45, Social: 35, Energy: -20}),
		ch("abissa-photo", "Photographier la fête", "camera", 20, 0, Needs{Fun: 25, Social: 20}),
	},
	"carnaval-bouake": {
		ch("carnaval-danser", "Danser derrière les chars", "party-popper", 60, 0, Needs{Fun: 45, Social: 30, Energy: -15}),
		ch("carnaval-bonbons", "Attraper les bonbons des chars", "gift", 20, 0, Needs{Fun: 30, Social: 15, Hunger: 5}),
	},
	"fete-masques": {
		ch("masques-photo", "Photographier les masques", "camera", 30, 0, Needs{Fun: 35, Social: 15}),
		ch("masques-griot", "Écouter le griot", "drama", 30, 0, Needs{Fun: 25, Social: 20}),
	},
	"fete-independance": {
		ch("independance-drapeau", "Hisser le drapeau", "flag", 15, 0, Needs{Fun: 25, Social: 30}),
		ch("independance-defile", "Défiler au pas", "drum", 45, 0, Needs{Fun: 35, Social: 30, Energy: -10}),
		ch("independance-quiz", "Le quiz du 7 août", "graduation-cap", 20, 0, Needs{Fun: 25, Social: 20}),
	},
	"fete-paix": {
		ch("paix-message", "Dire un mot de paix aux voisins", "hand-heart", 20, 0, Needs{Social: 35, Fun: 10}),
		ch("paix-arbre", "Arroser l'arbre de la paix", "sprout", 15, 0, Needs{Social: 25, Fun: 15}),
	},
	"fete-travail": {
		ch("travail-defile", "Défiler avec les collègues", "megaphone", 45, 0, Needs{Social: 30, Fun: 25, Energy: -10}),
		ch("travail-repas", "Le repas entre collègues", "utensils", 30, 0, Needs{Social: 30, Fun: 20, Hunger: 25}),
	},
	"noel": {
		ch("noel-bonbons", "Offrir des bonbons aux enfants", "gift", 20, 1000, Needs{Fun: 30, Social: 30}),
		ch("noel-cadeaux", "Emballer les cadeaux", "gift", 20, 0, Needs{Fun: 25, Social: 20}),
	},
	"nouvel-an": {
		ch("nouvel-an-voeux", "Faire la tournée des vœux", "sparkles", 30, 0, Needs{Social: 40, Fun: 20, Hunger: 15}),
		ch("nouvel-an-danser", "Danser jusqu'au matin", "music", 45, 0, Needs{Fun: 35, Social: 25, Energy: -15}),
	},
	"korite": {
		ch("korite-marmite", "Servir le repas de fête", "cooking-pot", 30, 0, Needs{Social: 35, Hunger: 35, Fun: 10},
			oops("La marmite tangue : un peu de sauce finit sur ton boubou neuf.", 0, Needs{Hygiene: -10})),
		ch("korite-voeux", "Souhaiter bonne fête aux voisins", "hand-heart", 20, 0, Needs{Social: 40, Fun: 15}),
	},
	"tabaski": {
		ch("tabaski-assiettes", "Préparer les assiettes des voisins", "utensils", 30, 0, Needs{Social: 35, Hunger: 40, Fun: 10}),
		ch("tabaski-visites", "Faire les visites de fête", "users", 30, 0, Needs{Social: 40, Fun: 15}),
	},
}

func init() {
	for i := range Happenings {
		h := &Happenings[i]
		list := eventChoices[h.ID]
		for _, c := range list {
			if c.ID == keep {
				c = EventChoice{Interaction: *h.Join}
			} else if h.Join != nil && h.Join.Requires != nil {
				// What the happening asks (the residents' meeting, the tontine), its choices ask too.
				c.Requires = h.Join.Requires
			}
			h.Choices = append(h.Choices, c)
		}
	}
}

// HappeningChoiceIDs: every played choice made for the update (not the joins kept: they are as they were).
func HappeningChoiceIDs() []string {
	var ids []string
	for _, h := range Happenings {
		for _, c := range h.Choices {
			if c.ID != JoinHappeningID && c.ID != RegulateTrafficID {
				ids = append(ids, c.ID)
			}
		}
	}
	return ids
}

// FindEventChoice: a played choice by its id, with its happening.
func FindEventChoice(id string) (EventChoice, Happening, bool) {
	for _, h := range Happenings {
		if i := slices.IndexFunc(h.Choices, func(c EventChoice) bool { return c.ID == id }); i >= 0 {
			return h.Choices[i], h, true
		}
	}
	return EventChoice{}, Happening{}, false
}

// Played: the happening as the street offers it: open (« evenements-joues »), its choices and no
// single join; closed, its join as before and no choices.
func (h Happening) Played(open bool) Happening {
	if open && len(h.Choices) > 0 {
		h.Join = nil
		h.Choices = slices.Clone(h.Choices)
	} else {
		h.Choices = nil
	}
	return h
}

// Offer: what there is to do at the happening (its choices, or its join).
func (h Happening) Offer() []Interaction {
	if len(h.Choices) > 0 {
		out := make([]Interaction, len(h.Choices))
		for i, c := range h.Choices {
			out[i] = c.Interaction
		}
		return out
	}
	if h.Join != nil {
		return []Interaction{*h.Join}
	}
	return nil
}
