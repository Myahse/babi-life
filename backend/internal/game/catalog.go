package game

// An Interaction is something a Sim can do at a place. Cost is in FCFA;
// a negative cost means the Sim earns money (work, small business…).
type Interaction struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	Icon    string `json:"icon"`
	Minutes int64  `json:"minutes"`
	Cost    int    `json:"cost"`
	Effect  Needs  `json:"effect"`
	// MinHour/MaxHour restrict when the interaction is available
	// (24h clock, MaxHour exclusive). Zero values mean "any time".
	MinHour int `json:"minHour,omitempty"`
	MaxHour int `json:"maxHour,omitempty"`
	// Days it is open (0 = lundi … 6 = dimanche); empty = every day.
	Days []int `json:"days,omitempty"`
	// Requires limits who can do it; nil = anyone.
	Requires *Requirement `json:"requires,omitempty"`
}

// A Requirement limits an interaction to some Sims.
type Requirement struct {
	// Resident: only Sims who live in the commune (the mairie's état civil…).
	Resident bool `json:"resident,omitempty"`
	// MinMoney the Sim must hold, beyond the cost (a contribution, a deposit…).
	MinMoney int `json:"minMoney,omitempty"`
	// AnyTrait: the Sim needs at least one of these traits.
	AnyTrait []string `json:"anyTrait,omitempty"`
	// Career: the Sim must work in this career.
	Career string `json:"career,omitempty"`
}

// Who describes a Sim for requirement checks.
type Who struct {
	Resident bool
	Money    int
	Traits   []string
	Career   string
}

// Check explains why a Sim can't do it, or returns nil.
func (r *Requirement) Check(w Who) error {
	if r == nil {
		return nil
	}
	switch {
	case r.Resident && !w.Resident:
		return ErrResidentsOnly
	case w.Money < r.MinMoney:
		return ErrNotEnoughMoney
	case r.Career != "" && w.Career != r.Career:
		return ErrWrongCareer
	case len(r.AnyTrait) > 0 && !anyIn(r.AnyTrait, w.Traits):
		return ErrNotYourThing
	}
	return nil
}

func anyIn(want, have []string) bool {
	for _, a := range want {
		for _, b := range have {
			if a == b {
				return true
			}
		}
	}
	return false
}

// A RandomEvent may happen after an interaction at a place of that kind.
type RandomEvent struct {
	Text   string `json:"text"`
	Money  int    `json:"money"`
	Effect Needs  `json:"effect"`
}

type PlaceKind struct {
	ID           string        `json:"id"`
	Label        string        `json:"label"`
	Icon         string        `json:"icon"`
	Interactions []Interaction `json:"interactions"`
	Events       []RandomEvent `json:"-"`
}

// Kinds is the catalogue of place kinds. Every place in the world references
// one of these by ID. Add new kinds here as areas get designed.
var Kinds = map[string]PlaceKind{
	"home": {
		ID: "home", Label: "Chez toi", Icon: "house",
		Interactions: []Interaction{
			{ID: "sleep", Label: "Dormir", Icon: "bed-double", Minutes: 7 * 60, Effect: Needs{Energy: 100, Hunger: -10, Hygiene: -10}},
			{ID: "nap", Label: "Faire la sieste", Icon: "bed", Minutes: 60, Effect: Needs{Energy: 20}},
			{ID: "shower", Label: "Prendre une douche", Icon: "shower-head", Minutes: 20, Effect: Needs{Hygiene: 60}},
			{ID: "cook-attieke", Label: "Préparer attiéké-poisson", Icon: "cooking-pot", Minutes: 45, Cost: 1500, Effect: Needs{Hunger: 55, Fun: 5}},
			{ID: "watch-tv", Label: "Regarder RTI 1", Icon: "tv", Minutes: 60, Effect: Needs{Fun: 25, Energy: -3}},
			{ID: "call-family", Label: "Appeler la famille au village", Icon: "smartphone", Minutes: 20, Cost: 200, Effect: Needs{Social: 30}},
		},
		Events: []RandomEvent{
			{Text: "Coupure de courant ! La CIE a encore frappé.", Effect: Needs{Fun: -10}},
			{Text: "Ta voisine t'apporte un plat de foutou sauce graine.", Effect: Needs{Hunger: 30, Social: 10}},
			{Text: "La pompe à eau est en panne, il faut cotiser pour le plombier.", Money: -3000, Effect: Needs{Hygiene: -10, Fun: -10}},
		},
	},
	"maquis": {
		ID: "maquis", Label: "Maquis", Icon: "drumstick",
		Interactions: []Interaction{
			{ID: "eat-poulet-braise", Label: "Manger un poulet braisé", Icon: "drumstick", Minutes: 45, Cost: 3500, Effect: Needs{Hunger: 60, Fun: 10, Social: 10}},
			{ID: "eat-garba", Label: "Manger un garba", Icon: "fish", Minutes: 20, Cost: 500, Effect: Needs{Hunger: 40}},
			{ID: "drink-with-friends", Label: "Prendre un pot avec les amis", Icon: "beer", Minutes: 90, Cost: 2000, Effect: Needs{Social: 40, Fun: 30, Energy: -10}, MinHour: 17},
			{ID: "dance-coupe-decale", Label: "Danser le coupé-décalé", Icon: "music", Minutes: 60, Effect: Needs{Fun: 40, Social: 20, Energy: -15, Hygiene: -10}, MinHour: 19},
		},
		Events: []RandomEvent{
			{Text: "Un grand-frère « travaillement » paie la tournée pour toute la table !", Effect: Needs{Fun: 15, Social: 15}},
			{Text: "Le DJ dédicace ton nom au micro. Tu es la star de la soirée.", Effect: Needs{Fun: 20}},
			{Text: "La serveuse s'est trompée dans l'addition… à ton désavantage.", Money: -1000},
		},
	},
	"market": {
		ID: "market", Label: "Marché", Icon: "shopping-basket",
		Interactions: []Interaction{
			{ID: "buy-food", Label: "Faire le marché", Icon: "shopping-basket", Minutes: 60, Cost: 3000, Effect: Needs{Hunger: 15, Social: 10, Energy: -5}},
			{ID: "bargain", Label: "Marchander avec les tanties", Icon: "messages-square", Minutes: 30, Effect: Needs{Social: 20, Fun: 10}},
			{ID: "eat-alloco", Label: "Manger de l'alloco", Icon: "banana", Minutes: 15, Cost: 300, Effect: Needs{Hunger: 25}},
			{ID: "sell-goods", Label: "Vendre au petit commerce", Icon: "store", Minutes: 4 * 60, Cost: -4000, Effect: Needs{Energy: -20, Social: 15, Hygiene: -10}, MinHour: 6, MaxHour: 18},
		},
		Events: []RandomEvent{
			{Text: "Une tantie t'a fait « cadeau » d'une poignée de piment en plus.", Effect: Needs{Social: 5}},
			{Text: "Un pickpocket t'a soulagé de quelques billets…", Money: -2000, Effect: Needs{Fun: -10}},
		},
	},
	"office": {
		ID: "office", Label: "Bureau", Icon: "briefcase",
		Interactions: []Interaction{
			{ID: "read-ads", Label: "Lire les offres d'emploi", Icon: "newspaper", Minutes: 30, Effect: Needs{Fun: -5, Social: 5}},
			{ID: "coffee-break", Label: "Pause café avec les collègues", Icon: "coffee", Minutes: 20, Cost: 300, Effect: Needs{Energy: 10, Social: 15}},
		},
		Events: []RandomEvent{
			{Text: "Le patron t'a félicité devant tout le monde. Prime !", Money: 10000, Effect: Needs{Fun: 15}},
			{Text: "Réunion surprise qui dure deux heures…", Effect: Needs{Fun: -15, Energy: -10}},
		},
	},
	"beach": {
		ID: "beach", Label: "Plage", Icon: "tree-palm",
		Interactions: []Interaction{
			{ID: "swim", Label: "Se baigner", Icon: "waves", Minutes: 60, Effect: Needs{Fun: 35, Hygiene: -10, Energy: -10}},
			{ID: "chill-sand", Label: "Se poser sous les cocotiers", Icon: "sunset", Minutes: 90, Cost: 1000, Effect: Needs{Fun: 25, Energy: 10, Social: 10}},
			{ID: "eat-fish", Label: "Manger du poisson braisé", Icon: "fish", Minutes: 45, Cost: 3000, Effect: Needs{Hunger: 55, Fun: 10}},
		},
		Events: []RandomEvent{
			{Text: "Attention aux vagues ! Le maître-nageur te rappelle à l'ordre.", Effect: Needs{Fun: -5}},
			{Text: "Tu croises des amis d'enfance. Quelle ambiance !", Effect: Needs{Social: 25}},
		},
	},
	"worship": {
		ID: "worship", Label: "Lieu de culte", Icon: "landmark",
		Interactions: []Interaction{
			{ID: "pray", Label: "Prier / se recueillir", Icon: "hand-heart", Minutes: 60, Effect: Needs{Fun: 10, Social: 15}},
			{ID: "visit", Label: "Visiter", Icon: "camera", Minutes: 45, Cost: 2000, Effect: Needs{Fun: 25}},
		},
	},
	"transport": {
		ID: "transport", Label: "Gare", Icon: "bus",
		Interactions: []Interaction{
			{ID: "wait-gbaka", Label: "Attendre le gbaka", Icon: "hourglass", Minutes: 30, Effect: Needs{Fun: -10, Social: 5}},
			{ID: "eat-brochette", Label: "Manger une brochette", Icon: "flame", Minutes: 10, Cost: 500, Effect: Needs{Hunger: 15}},
		},
		Events: []RandomEvent{
			{Text: "Un « gnambro » te fait payer 100F de plus. C'est comme ça.", Money: -100},
		},
	},
	"club": {
		ID: "club", Label: "Boîte de nuit", Icon: "disc-3",
		Interactions: []Interaction{
			{ID: "party", Label: "Faire la fête jusqu'au matin", Icon: "party-popper", Minutes: 4 * 60, Cost: 5000, Effect: Needs{Fun: 60, Social: 40, Energy: -40, Hygiene: -25}, MinHour: 21, MaxHour: 4},
			{ID: "travaillement", Label: "Faire le « travaillement »", Icon: "banknote", Minutes: 60, Cost: 20000, Effect: Needs{Fun: 40, Social: 50}, MinHour: 21, MaxHour: 4},
		},
		Events: []RandomEvent{
			{Text: "Ton artiste préféré passe en showcase surprise !", Effect: Needs{Fun: 30}},
		},
	},
	"sport": {
		ID: "sport", Label: "Terrain", Icon: "trophy",
		Interactions: []Interaction{
			{ID: "play-football", Label: "Jouer au foot", Icon: "volleyball", Minutes: 90, Effect: Needs{Fun: 35, Social: 25, Energy: -25, Hygiene: -30}},
			{ID: "watch-match", Label: "Regarder un match", Icon: "trophy", Minutes: 120, Cost: 1000, Effect: Needs{Fun: 35, Social: 20}},
		},
		Events: []RandomEvent{
			{Text: "Tu marques le but de la victoire ! On scande ton nom.", Effect: Needs{Fun: 25, Social: 15}},
		},
	},
	// Public services and culture. Opening days and hours are game rules,
	// not the institutions' real timetables.
	"mairie": {
		ID: "mairie", Label: "Mairie", Icon: "landmark",
		Interactions: []Interaction{
			{ID: "etat-civil", Label: "Demander un extrait d'acte de naissance", Icon: "file-text", Minutes: 60, Cost: 500, Effect: Needs{Fun: -10, Social: 5},
				MinHour: 8, MaxHour: 16, Days: Weekdays, Requires: &Requirement{Resident: true}},
			{ID: "legalisation", Label: "Faire légaliser un document", Icon: "stamp", Minutes: 45, Cost: 500, Effect: Needs{Fun: -10, Social: 5}, MinHour: 8, MaxHour: 16, Days: Weekdays},
			{ID: "mariage-civil", Label: "Être témoin d'un mariage civil", Icon: "heart", Minutes: 90, Effect: Needs{Social: 35, Fun: 25}, MinHour: 9, MaxHour: 14, Days: []int{Vendredi, Samedi}},
			{ID: "conseil", Label: "Assister au conseil municipal", Icon: "users", Minutes: 120, Effect: Needs{Social: 20, Fun: -5, Energy: -5}, MinHour: 9, MaxHour: 12, Days: []int{Mercredi}, Requires: &Requirement{Resident: true}},
		},
		Events: []RandomEvent{
			{Text: "Le système est en panne : « Revenez demain. »", Effect: Needs{Fun: -15}},
			{Text: "L'agent d'accueil te reconnaît : il t'aide à passer vite.", Effect: Needs{Fun: 10, Social: 10}},
		},
	},
	"school": {
		ID: "school", Label: "École", Icon: "graduation-cap",
		Interactions: []Interaction{
			{ID: "cours-du-soir", Label: "Suivre un cours du soir", Icon: "book-open", Minutes: 120, Cost: 1000, Effect: Needs{Fun: -5, Energy: -15, Social: 15}, MinHour: 17, MaxHour: 20, Days: Weekdays},
			{ID: "bibliotheque", Label: "Réviser à la bibliothèque", Icon: "library", Minutes: 90, Effect: Needs{Fun: -5, Energy: -10}, MinHour: 8, MaxHour: 18, Days: Workweek},
			{ID: "conference", Label: "Assister à une conférence", Icon: "presentation", Minutes: 90, Effect: Needs{Fun: 15, Social: 15, Energy: -5}, MinHour: 9, MaxHour: 17, Days: Weekdays},
		},
		Events: []RandomEvent{
			{Text: "Ton professeur te félicite devant toute la classe.", Effect: Needs{Fun: 20}},
			{Text: "Grève surprise : les cours sont annulés.", Effect: Needs{Fun: 10, Social: 5}},
		},
	},
	"health": {
		ID: "health", Label: "Santé", Icon: "hospital",
		Interactions: []Interaction{
			{ID: "consultation", Label: "Se faire consulter", Icon: "stethoscope", Minutes: 90, Cost: 3000, Effect: Needs{Energy: 15, Fun: -5}, MinHour: 7, MaxHour: 18},
			{ID: "visite-malade", Label: "Rendre visite à un malade", Icon: "hand-heart", Minutes: 45, Effect: Needs{Social: 30, Fun: -5}, MinHour: 12, MaxHour: 19},
		},
		Events: []RandomEvent{
			{Text: "La salle d'attente est pleine : tu patientes longtemps.", Effect: Needs{Fun: -15, Energy: -5}},
			{Text: "L'infirmière te donne de bons conseils pour ta santé.", Effect: Needs{Energy: 10}},
		},
	},
	"culture": {
		ID: "culture", Label: "Culture", Icon: "drama",
		Interactions: []Interaction{
			{ID: "spectacle", Label: "Voir un spectacle", Icon: "drama", Minutes: 120, Cost: 3000, Effect: Needs{Fun: 45, Social: 15}, MinHour: 18, MaxHour: 23},
			{ID: "exposition", Label: "Visiter une exposition", Icon: "palette", Minutes: 60, Cost: 1000, Effect: Needs{Fun: 25}, MinHour: 9, MaxHour: 18, Days: []int{Mardi, Mercredi, Jeudi, Vendredi, Samedi, Dimanche}},
		},
		Events: []RandomEvent{
			{Text: "Tu croises l'artiste à la sortie : photo souvenir !", Effect: Needs{Fun: 20, Social: 10}},
		},
	},
	"mall": {
		ID: "mall", Label: "Centre commercial", Icon: "shopping-bag",
		Interactions: []Interaction{
			{ID: "supermarche", Label: "Faire les courses au supermarché", Icon: "shopping-cart", Minutes: 60, Cost: 8000, Effect: Needs{Hunger: 25, Fun: 5, Energy: -5}, MinHour: 8, MaxHour: 21},
			{ID: "leche-vitrine", Label: "Faire du lèche-vitrine", Icon: "shopping-bag", Minutes: 60, Effect: Needs{Fun: 20, Social: 5, Energy: -5}, MinHour: 9, MaxHour: 21},
			{ID: "vetements", Label: "S'acheter une tenue", Icon: "shirt", Minutes: 45, Cost: 15000, Effect: Needs{Fun: 35}, MinHour: 9, MaxHour: 21},
			{ID: "glace", Label: "Prendre une glace entre amis", Icon: "ice-cream-cone", Minutes: 30, Cost: 1500, Effect: Needs{Fun: 15, Social: 20, Hunger: 5}, MinHour: 10, MaxHour: 21},
		},
		Events: []RandomEvent{
			{Text: "Promo flash au supermarché : tu repars avec un sac en plus.", Effect: Needs{Fun: 10, Hunger: 10}},
			{Text: "Tu croises une ancienne camarade de classe entre deux rayons.", Effect: Needs{Social: 20}},
			{Text: "La clim du centre commercial : enfin de la fraîcheur !", Effect: Needs{Energy: 10}},
		},
	},
	"restaurant": {
		ID: "restaurant", Label: "Restaurant", Icon: "hamburger",
		Interactions: []Interaction{
			{ID: "burger", Label: "Manger un burger-frites", Icon: "hamburger", Minutes: 30, Cost: 4500, Effect: Needs{Hunger: 55, Fun: 10}, MinHour: 10, MaxHour: 23},
			{ID: "milkshake", Label: "Prendre un milkshake", Icon: "cup-soda", Minutes: 20, Cost: 2500, Effect: Needs{Fun: 10, Hunger: 10, Social: 5}, MinHour: 10, MaxHour: 23},
			{ID: "anniversaire-resto", Label: "Fêter un anniversaire avec les amis", Icon: "cake", Minutes: 90, Cost: 15000, Effect: Needs{Social: 40, Fun: 35, Hunger: 40}, MinHour: 12, MaxHour: 22},
		},
		Events: []RandomEvent{
			{Text: "La file d'attente est longue : il faut patienter.", Effect: Needs{Fun: -10}},
			{Text: "On t'offre une boisson avec ton menu.", Effect: Needs{Fun: 10}},
		},
	},
	"nature": {
		ID: "nature", Label: "Site naturel", Icon: "mountain",
		Interactions: []Interaction{
			{ID: "hike", Label: "Faire une randonnée", Icon: "footprints", Minutes: 3 * 60, Effect: Needs{Fun: 40, Energy: -30, Hygiene: -20, Hunger: -15}},
			{ID: "photos", Label: "Prendre des photos", Icon: "camera", Minutes: 30, Effect: Needs{Fun: 20}},
		},
	},
}

// Generic events can happen anywhere.
var GenericEvents = []RandomEvent{
	{Text: "Tu trouves un billet de 1 000F par terre. C'est Dieu qui donne !", Money: 1000, Effect: Needs{Fun: 10}},
	{Text: "Il pleut des cordes, tu es trempé·e.", Effect: Needs{Hygiene: -15, Fun: -10}},
	{Text: "Un ami t'envoie un transfert Mobile Money « pour ta soif ».", Money: 2000, Effect: Needs{Social: 10}},
}
