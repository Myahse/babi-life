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
	// Ages: the life stages that can do it; empty = from childhood up (KidsUp).
	Ages []string `json:"ages,omitempty"`
	// Places: only at these places of the kind (the Hôtel Ivoire's ice rink…); empty = at every one.
	Places []string `json:"places,omitempty"`
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

// The gym's prices (game rules): a session, a class, the month's membership.
const (
	GymSession      = 1500
	GymClass        = 2000
	GymMonth        = 15000
	GymMembershipID = "abonnement-salle"
)

// Kinds is the catalogue of place kinds. Every place in the world references
// one of these by ID. Add new kinds here as areas get designed.
var Kinds = map[string]PlaceKind{
	"home": {
		ID: "home", Label: "Chez toi", Icon: "house",
		Interactions: []Interaction{
			{ID: "sleep", Label: "Dormir", Icon: "bed-double", Minutes: 7 * 60, Effect: Needs{Energy: 100, Hunger: -10, Hygiene: -10}, Ages: Everyone},
			{ID: "nap", Label: "Faire la sieste", Icon: "bed", Minutes: 60, Effect: Needs{Energy: 20}, Ages: Everyone},
			// A baby's day, with maman.
			{ID: "biberon", Label: "Boire le biberon", Icon: "milk", Minutes: 15, Effect: Needs{Hunger: 45}, Ages: Babies},
			{ID: "bouillie", Label: "Manger la bouillie", Icon: "soup", Minutes: 20, Effect: Needs{Hunger: 55, Fun: 5}, Ages: Babies},
			{ID: "bain-bebe", Label: "Prendre le bain avec maman", Icon: "bath", Minutes: 20, Effect: Needs{Hygiene: 70, Fun: 10, Social: 10}, Ages: Babies},
			{ID: "hochet", Label: "Jouer avec le hochet", Icon: "baby", Minutes: 30, Effect: Needs{Fun: 35, Energy: -5}, Ages: Babies},
			{ID: "calin", Label: "Faire un câlin à maman", Icon: "heart", Minutes: 15, Effect: Needs{Social: 40}, Ages: Babies},
			// School days: class in the morning, homework after. Both count towards the bac.
			{ID: "aller-ecole", Label: "Aller à l'école", Icon: "school", Minutes: 5 * 60, Effect: Needs{Social: 25, Fun: -10, Energy: -20, Hunger: -15}, MinHour: 7, MaxHour: 9, Days: Weekdays, Ages: Kids},
			{ID: "devoirs", Label: "Faire ses devoirs", Icon: "notebook-pen", Minutes: 60, Effect: Needs{Fun: -10, Energy: -5}, MinHour: 14, MaxHour: 21, Ages: Kids},
			{ID: "jouer-cour", Label: "Jouer dans la cour", Icon: "volleyball", Minutes: 45, Effect: Needs{Fun: 35, Social: 15, Hygiene: -15, Energy: -10}, Ages: []string{StageEnfant}},
			{ID: "shower", Label: "Prendre une douche", Icon: "shower-head", Minutes: 20, Effect: Needs{Hygiene: 60}},
			{ID: "cook-attieke", Ages: Adults, Label: "Préparer attiéké-poisson", Icon: "cooking-pot", Minutes: 45, Cost: 1500, Effect: Needs{Hunger: 55, Fun: 5}},
			{ID: "watch-tv", Label: "Regarder RTI 1", Icon: "tv", Minutes: 60, Effect: Needs{Fun: 25, Energy: -3}},
			// Only with a pool (CanSwimAtHome): one's own, or the rented villa's.
			{ID: SwimID, Label: "Nager dans la piscine", Icon: "waves", Minutes: 45, Effect: Needs{Fun: 35, Hygiene: 10, Energy: -12}, Ages: []string{StageEnfant, StageAdo, StageAdulte}},
			{ID: "call-family", Ages: TeensUp, Label: "Appeler la famille au village", Icon: "smartphone", Minutes: 20, Cost: 200, Effect: Needs{Social: 30}},
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
			{ID: "drink-with-friends", Ages: Adults, Label: "Prendre un pot avec les amis", Icon: "beer", Minutes: 90, Cost: 2000, Effect: Needs{Social: 40, Fun: 30, Energy: -10}, MinHour: 17},
			Gbairai,
			{ID: "dance-coupe-decale", Ages: Adults, Label: "Danser le coupé-décalé", Icon: "music", Minutes: 60, Effect: Needs{Fun: 40, Social: 20, Energy: -15, Hygiene: -10}, MinHour: 19},
			// The travaillement: banknotes rained on the dancers, the more the louder.
			{ID: "petit-travaillement", Ages: Adults, Label: "Petit « travaillement »", Icon: "banknote", Minutes: 30, Cost: 5000, Effect: Needs{Fun: 20, Social: 25}, MinHour: 19, MaxHour: 4},
			{ID: "travaillement", Ages: Adults, Label: "Faire le « travaillement »", Icon: "banknote", Minutes: 60, Cost: 20000, Effect: Needs{Fun: 40, Social: 50}, MinHour: 19, MaxHour: 4},
			{ID: "grand-travaillement", Ages: Adults, Label: "Grand « travaillement » : tout le monde crie ton nom", Icon: "banknote", Minutes: 60, Cost: 100000, Effect: Needs{Fun: 70, Social: 80}, MinHour: 19, MaxHour: 4},
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
			{ID: "buy-food", Ages: TeensUp, Label: "Faire le marché", Icon: "shopping-basket", Minutes: 60, Cost: 3000, Effect: Needs{Hunger: 15, Social: 10, Energy: -5}},
			{ID: "bargain", Ages: TeensUp, Label: "Marchander avec les tanties", Icon: "messages-square", Minutes: 30, Effect: Needs{Social: 20, Fun: 10}},
			{ID: "eat-alloco", Label: "Manger de l'alloco", Icon: "banana", Minutes: 15, Cost: 300, Effect: Needs{Hunger: 25}},
			Gbairai,
			{ID: "sell-goods", Ages: TeensUp, Label: "Vendre au petit commerce", Icon: "store", Minutes: 4 * 60, Cost: -4000, Effect: Needs{Energy: -20, Social: 15, Hygiene: -10}, MinHour: 6, MaxHour: 18},
		},
		Events: []RandomEvent{
			{Text: "Une tantie t'a fait « cadeau » d'une poignée de piment en plus.", Effect: Needs{Social: 5}},
			{Text: "Un pickpocket t'a soulagé de quelques billets…", Money: -2000, Effect: Needs{Fun: -10}},
		},
	},
	"office": {
		ID: "office", Label: "Bureau", Icon: "briefcase",
		Interactions: []Interaction{
			{ID: "read-ads", Ages: Adults, Label: "Lire les offres d'emploi", Icon: "newspaper", Minutes: 30, Effect: Needs{Fun: -5, Social: 5}},
			{ID: "coffee-break", Ages: Adults, Label: "Pause café avec les collègues", Icon: "coffee", Minutes: 20, Cost: 300, Effect: Needs{Energy: 10, Social: 15}},
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
			{ID: "wait-gbaka", Ages: TeensUp, Label: "Attendre le gbaka", Icon: "hourglass", Minutes: 30, Effect: Needs{Fun: -10, Social: 5}},
			{ID: "eat-brochette", Label: "Manger une brochette", Icon: "flame", Minutes: 10, Cost: 500, Effect: Needs{Hunger: 15}},
		},
		Events: []RandomEvent{
			{Text: "Un « gnambro » te fait payer 100F de plus. C'est comme ça.", Money: -100},
		},
	},
	"club": {
		ID: "club", Label: "Boîte de nuit", Icon: "disc-3",
		Interactions: []Interaction{
			{ID: "party", Ages: Adults, Label: "Faire la fête jusqu'au matin", Icon: "party-popper", Minutes: 4 * 60, Cost: 5000, Effect: Needs{Fun: 60, Social: 40, Energy: -40, Hygiene: -25}, MinHour: 21, MaxHour: 4},
			// The travaillement: banknotes rained on the dancers, the more the louder.
			{ID: "petit-travaillement", Ages: Adults, Label: "Petit « travaillement »", Icon: "banknote", Minutes: 30, Cost: 5000, Effect: Needs{Fun: 20, Social: 25}, MinHour: 21, MaxHour: 4},
			{ID: "travaillement", Ages: Adults, Label: "Faire le « travaillement »", Icon: "banknote", Minutes: 60, Cost: 20000, Effect: Needs{Fun: 40, Social: 50}, MinHour: 21, MaxHour: 4},
			{ID: "grand-travaillement", Ages: Adults, Label: "Grand « travaillement » : tout le monde crie ton nom", Icon: "banknote", Minutes: 60, Cost: 100000, Effect: Needs{Fun: 70, Social: 80}, MinHour: 21, MaxHour: 4},
			// The bottles: whisky at the table, champagne in the VIP corner with the sparklers,
			// and on Friday night (into Saturday morning) the round for the whole club.
			{ID: "bouteille-whisky", Ages: Adults, Label: "Prendre une bouteille de whisky à table", Icon: "beer", Minutes: 60, Cost: 40000, Effect: Needs{Fun: 30, Social: 35}, MinHour: 21, MaxHour: 4},
			{ID: "champagne-vip", Ages: Adults, Label: "Champagne au carré VIP, avec les cierges magiques", Icon: "sparkles", Minutes: 90, Cost: 150000, Effect: Needs{Fun: 55, Social: 65}, MinHour: 21, MaxHour: 4},
			{ID: "tournee-vendredi", Ages: Adults, Label: "Vendredi soir : le champagne pour toute la boîte", Icon: "crown", Minutes: 120, Cost: 500000, Effect: Needs{Fun: 85, Social: 100}, MinHour: 22, MaxHour: 4, Days: []int{Vendredi, Samedi}},
		},
		Events: []RandomEvent{
			{Text: "Ton artiste préféré passe en showcase surprise !", Effect: Needs{Fun: 30}},
			{Text: "C'est vendredi : la boîte est pleine à craquer, la file dépasse le parking !", Effect: Needs{Social: 15, Fun: 10}},
		},
	},
	"sport": {
		ID: "sport", Label: "Terrain", Icon: "trophy",
		Interactions: []Interaction{
			{ID: "play-football", Label: "Jouer au foot", Icon: "volleyball", Minutes: 90, Effect: Needs{Fun: 35, Social: 25, Energy: -25, Hygiene: -30}},
			{ID: "play-basket", Label: "Jouer au basket", Icon: "trophy", Minutes: 60, Effect: Needs{Fun: 35, Social: 20, Energy: -25, Hygiene: -25}},
			{ID: "watch-match", Label: "Regarder un match", Icon: "trophy", Minutes: 120, Cost: 1000, Effect: Needs{Fun: 35, Social: 20}},
		},
		Events: []RandomEvent{
			{Text: "Tu marques le but de la victoire ! On scande ton nom.", Effect: Needs{Fun: 25, Social: 15}},
		},
	},
	// The big stadiums: the match and the concert when they're on (stadium.go),
	// and the joggers' laps round the outside in the morning and evening.
	StadiumKind: {
		ID: StadiumKind, Label: "Stade", Icon: "trophy",
		Interactions: []Interaction{
			{ID: StadiumMatchID, Label: "Regarder le match", Icon: "trophy", Minutes: 120, Cost: 2000, Effect: Needs{Fun: 40, Social: 25, Energy: -10}},
			{ID: StadiumConcertID, Label: "Aller au concert", Icon: "music", Minutes: 180, Cost: 5000, Effect: Needs{Fun: 50, Social: 25, Energy: -15}},
			{ID: "stade-footing", Label: "Faire des tours de stade en courant", Icon: "footprints", Minutes: 30, Effect: Needs{Fun: 10, Energy: -20, Hygiene: -20}, MinHour: 6, MaxHour: 20},
		},
		Events: []RandomEvent{
			{Text: "Toute la tribune se lève et chante : tu as des frissons.", Effect: Needs{Fun: 10, Social: 10}},
			{Text: "Ton voisin de tribune partage ses arachides avec toi.", Effect: Needs{Hunger: 5, Social: 10}},
			{Text: "La ola fait le tour du stade, tu te lèves avec tout le monde.", Effect: Needs{Fun: 10}},
		},
	},
	// The gym (salle de sport): weights, the treadmill and the bike, the evening
	// class with the music up. A session is paid at the door; the month's
	// membership makes them free for 30 days (sims/gym.go). Prices are game
	// rules, in the range of Abidjan's neighbourhood gyms.
	"gym": {
		ID: "gym", Label: "Salle de sport", Icon: "dumbbell",
		Interactions: []Interaction{
			{ID: "musculation", Ages: TeensUp, Label: "Séance de musculation", Icon: "dumbbell", Minutes: 60, Cost: GymSession, Effect: Needs{Fun: 10, Social: 5, Energy: -30, Hygiene: -30, Hunger: -15}, MinHour: 6, MaxHour: 22},
			{ID: "cardio", Ages: TeensUp, Label: "Cardio : tapis et vélo", Icon: "heart", Minutes: 45, Cost: GymSession, Effect: Needs{Fun: 10, Energy: -25, Hygiene: -25, Hunger: -10}, MinHour: 6, MaxHour: 22},
			{ID: "tractions", Ages: TeensUp, Label: "Tractions à la barre", Icon: "dumbbell", Minutes: 30, Cost: GymSession, Effect: Needs{Fun: 10, Energy: -25, Hygiene: -20, Hunger: -10}, MinHour: 6, MaxHour: 22},
			{ID: "boxe-sac", Ages: TeensUp, Label: "Boxe pieds-poings au sac de frappe", Icon: "dumbbell", Minutes: 40, Cost: GymSession, Effect: Needs{Fun: 20, Energy: -30, Hygiene: -25, Hunger: -10}, MinHour: 6, MaxHour: 22},
			{ID: "corde-a-sauter", Ages: TeensUp, Label: "Corde à sauter", Icon: "heart", Minutes: 20, Cost: GymSession, Effect: Needs{Fun: 10, Energy: -20, Hygiene: -20}, MinHour: 6, MaxHour: 22},
			{ID: "cours-collectif", Ages: TeensUp, Label: "Cours collectif (aérobic, zumba)", Icon: "music", Minutes: 60, Cost: GymClass, Effect: Needs{Fun: 25, Social: 20, Energy: -25, Hygiene: -25}, MinHour: 17, MaxHour: 21},
			{ID: GymMembershipID, Ages: TeensUp, Label: "Prendre l'abonnement du mois (séances gratuites)", Icon: "id-card", Minutes: 10, Cost: GymMonth, Effect: Needs{Fun: 5}, MinHour: 6, MaxHour: 22},
			{ID: "douche-vestiaire", Ages: TeensUp, Label: "Prendre une douche au vestiaire", Icon: "shower-head", Minutes: 15, Effect: Needs{Hygiene: 50}, MinHour: 6, MaxHour: 22},
		},
		Events: []RandomEvent{
			{Text: "Le coach te corrige la posture : « Dos droit, on respire ! »", Effect: Needs{Fun: 5, Social: 10}},
			{Text: "Coupure de courant : le tapis s'arrête net. On finit aux haltères.", Effect: Needs{Fun: -10}},
			{Text: "Un habitué te montre son programme « pour avoir les bras comme lui ».", Effect: Needs{Social: 15}},
		},
	},
	// Public services and culture. Opening days and hours are game rules,
	// not the institutions' real timetables.
	"mairie": {
		ID: "mairie", Label: "Mairie", Icon: "landmark",
		Interactions: []Interaction{
			{ID: "etat-civil", Ages: Adults, Label: "Demander un extrait d'acte de naissance", Icon: "file-text", Minutes: 60, Cost: 500, Effect: Needs{Fun: -10, Social: 5},
				MinHour: 8, MaxHour: 16, Days: Weekdays, Requires: &Requirement{Resident: true}},
			{ID: "legalisation", Ages: Adults, Label: "Faire légaliser un document", Icon: "stamp", Minutes: 45, Cost: 500, Effect: Needs{Fun: -10, Social: 5}, MinHour: 8, MaxHour: 16, Days: Weekdays},
			{ID: "mariage-civil", Ages: Adults, Label: "Être témoin d'un mariage civil", Icon: "heart", Minutes: 90, Effect: Needs{Social: 35, Fun: 25}, MinHour: 9, MaxHour: 14, Days: []int{Vendredi, Samedi}},
			{ID: "conseil", Ages: Adults, Label: "Assister au conseil municipal", Icon: "users", Minutes: 120, Effect: Needs{Social: 20, Fun: -5, Energy: -5}, MinHour: 9, MaxHour: 12, Days: []int{Mercredi}, Requires: &Requirement{Resident: true}},
		},
		Events: []RandomEvent{
			{Text: "Le système est en panne : « Revenez demain. »", Effect: Needs{Fun: -15}},
			{Text: "L'agent d'accueil te reconnaît : il t'aide à passer vite.", Effect: Needs{Fun: 10, Social: 10}},
		},
	},
	"school": {
		ID: "school", Label: "École", Icon: "graduation-cap",
		Interactions: []Interaction{
			{ID: "cours-du-soir", Ages: Adults, Label: "Suivre un cours du soir", Icon: "book-open", Minutes: 120, Cost: 1000, Effect: Needs{Fun: -5, Energy: -15, Social: 15}, MinHour: 17, MaxHour: 20, Days: Weekdays},
			{ID: "bibliotheque", Label: "Réviser à la bibliothèque", Icon: "library", Minutes: 90, Effect: Needs{Fun: -5, Energy: -10}, MinHour: 8, MaxHour: 18, Days: Workweek},
			{ID: "conference", Ages: TeensUp, Label: "Assister à une conférence", Icon: "presentation", Minutes: 90, Effect: Needs{Fun: 15, Social: 15, Energy: -5}, MinHour: 9, MaxHour: 17, Days: Weekdays},
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
			{ID: "visite-malade", Ages: TeensUp, Label: "Rendre visite à un malade", Icon: "hand-heart", Minutes: 45, Effect: Needs{Social: 30, Fun: -5}, MinHour: 12, MaxHour: 19},
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
			{ID: "supermarche", Ages: TeensUp, Label: "Faire les courses au supermarché", Icon: "shopping-cart", Minutes: 60, Cost: 8000, Effect: Needs{Hunger: 25, Fun: 5, Energy: -5}, MinHour: 8, MaxHour: 21},
			{ID: "leche-vitrine", Label: "Faire du lèche-vitrine", Icon: "shopping-bag", Minutes: 60, Effect: Needs{Fun: 20, Social: 5, Energy: -5}, MinHour: 9, MaxHour: 21},
			{ID: "vetements", Ages: TeensUp, Label: "S'acheter une tenue", Icon: "shirt", Minutes: 45, Cost: 15000, Effect: Needs{Fun: 35}, MinHour: 9, MaxHour: 21},
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
			{ID: "anniversaire-resto", Ages: TeensUp, Label: "Fêter un anniversaire avec les amis", Icon: "cake", Minutes: 90, Cost: 15000, Effect: Needs{Social: 40, Fun: 35, Hunger: 40}, MinHour: 12, MaxHour: 22},
		},
		Events: []RandomEvent{
			{Text: "La file d'attente est longue : il faut patienter.", Effect: Needs{Fun: -10}},
			{Text: "On t'offre une boisson avec ton menu.", Effect: Needs{Fun: 10}},
		},
	},
	// Barbers and hair salons: a haircut changes the Sim's look (see
	// Hairdos), and the chairs are where the quarter's gbairai goes round.
	// Anyone can sit in either: the barbier cuts short, the salon braids.
	"barbier": {
		ID: "barbier", Label: "Barbier", Icon: "scissors",
		Interactions: []Interaction{
			{ID: "degrade", Label: "Se faire un dégradé", Icon: "scissors", Minutes: 40, Cost: 1000, Effect: Needs{Hygiene: 20, Fun: 15, Social: 10}, MinHour: 8, MaxHour: 22},
			{ID: "boule-a-zero", Label: "Se faire raser la tête", Icon: "scissors", Minutes: 25, Cost: 1000, Effect: Needs{Hygiene: 25, Fun: 5}, MinHour: 8, MaxHour: 22},
			{ID: "coupe-courte", Label: "Se faire une coupe courte", Icon: "scissors", Minutes: 30, Cost: 1000, Effect: Needs{Hygiene: 20, Fun: 10}, MinHour: 8, MaxHour: 22},
			{ID: "iroquoise", Ages: TeensUp, Label: "Se faire une iroquoise", Icon: "scissors", Minutes: 45, Cost: 1500, Effect: Needs{Hygiene: 15, Fun: 25, Social: 10}, MinHour: 8, MaxHour: 22},
			{ID: "taille-barbe", Ages: Adults, Label: "Se faire tailler la barbe", Icon: "scissors", Minutes: 20, Cost: 500, Effect: Needs{Hygiene: 15, Fun: 5}, MinHour: 8, MaxHour: 22},
			Gbairai,
		},
		Events: []RandomEvent{
			{Text: "Débat enflammé chez le barbier : qui est le meilleur, l'Asec ou l'Africa ?", Effect: Needs{Fun: 15, Social: 10}},
			{Text: "La tondeuse a dérapé : ton contour n'est plus droit…", Effect: Needs{Fun: -15}},
			{Text: "Coupure de courant au milieu de la coupe : on attend le groupe électrogène.", Effect: Needs{Fun: -10}},
		},
	},
	// The boutiques of the quarter: the kiosk, the shop on the corner, the
	// clothes, the phones (thousands of them on the map, in Yopougon alone).
	"boutique": {
		ID: "boutique", Label: "Boutique", Icon: "store",
		Interactions: []Interaction{
			{ID: "credit", Label: "Acheter du crédit", Icon: "smartphone", Minutes: 5, Cost: 500, Effect: Needs{Social: 5}, MinHour: 7, MaxHour: 22},
			{ID: "courses", Label: "Faire quelques courses", Icon: "shopping-bag", Minutes: 20, Cost: 2500, Effect: Needs{Hunger: 15, Fun: 5}, MinHour: 7, MaxHour: 22},
			{ID: "sucrerie", Label: "Prendre une sucrerie bien fraîche", Icon: "cup-soda", Minutes: 10, Cost: 300, Effect: Needs{Hunger: 5, Fun: 10}, MinHour: 7, MaxHour: 23},
			Gbairai,
		},
		Events: []RandomEvent{
			{Text: "Le boutiquier n'a pas la monnaie : tu repars avec des bonbons à la place.", Effect: Needs{Fun: 5}},
			{Text: "Le boutiquier te fait crédit : « Tu me donnes ça demain. »", Money: 200, Effect: Needs{Social: 10}},
		},
	},
	"couture": {
		ID: "couture", Label: "Couturier", Icon: "shirt",
		Interactions: []Interaction{
			{ID: "coudre-pagne", Label: "Faire coudre une tenue en pagne", Icon: "shirt", Minutes: 60, Cost: 7000, Effect: Needs{Fun: 20, Social: 15}, MinHour: 8, MaxHour: 20},
			{ID: "retouche", Label: "Faire une retouche", Icon: "scissors", Minutes: 20, Cost: 1000, Effect: Needs{Fun: 5, Social: 5}, MinHour: 8, MaxHour: 20},
			Gbairai,
		},
		Events: []RandomEvent{
			{Text: "« Revenez demain, c'est presque fini » : le couturier, fidèle à sa réputation.", Effect: Needs{Fun: -10}},
			{Text: "La tenue tombe parfaitement : tout le quartier te demande l'adresse du couturier.", Effect: Needs{Fun: 15, Social: 15}},
		},
	},
	// The commissariat of an arrondissement (« Commissariat du 16ᵉ
	// Arrondissement »), open day and night: a complaint after a theft or an
	// attack, a declaration of loss for a lost ID or phone, a question at the
	// desk. Free at the counter, as in life; the wait is long.
	"police": {
		ID: "police", Label: "Commissariat", Icon: "shield",
		Interactions: []Interaction{
			{ID: "porter-plainte", Ages: TeensUp, Label: "Porter plainte (vol, agression)", Icon: "file-text", Minutes: 90, Effect: Needs{Fun: -10, Energy: -10, Social: 5}},
			{ID: "declaration-perte", Ages: TeensUp, Label: "Faire une déclaration de perte (pièce, téléphone)", Icon: "id-card", Minutes: 60, Effect: Needs{Fun: -10, Energy: -5}},
			{ID: "renseignement", Label: "Demander un renseignement à l'accueil", Icon: "shield", Minutes: 15, Effect: Needs{Social: 5}},
		},
		Events: []RandomEvent{
			{Text: "« Le chef n'est pas là, asseyez-vous sur le banc. » Tu patientes longtemps.", Effect: Needs{Fun: -10, Energy: -5}},
			{Text: "L'agent prend ta déposition avec sérieux et note tout dans le registre.", Effect: Needs{Fun: 5, Social: 10}},
		},
	},
	"pharmacie": {
		ID: "pharmacie", Label: "Pharmacie", Icon: "stethoscope",
		Interactions: []Interaction{
			{ID: "medicaments", Label: "Acheter des médicaments", Icon: "stethoscope", Minutes: 15, Cost: 3000, Effect: Needs{Energy: 15}, MinHour: 7, MaxHour: 23},
			{ID: "conseil", Label: "Demander conseil au pharmacien", Icon: "users", Minutes: 10, Cost: 0, Effect: Needs{Social: 5, Energy: 5}, MinHour: 7, MaxHour: 23},
		},
		Events: []RandomEvent{
			{Text: "Pharmacie de garde : la file d'attente déborde sur le trottoir.", Effect: Needs{Energy: -5}},
		},
	},
	// The fuel station: its shop and café, the gas bottle for cooking at home,
	// the phone credit, the air for the tyres. Prices are game rules.
	"station": {
		ID: "station", Label: "Station-service", Icon: "fuel",
		Interactions: []Interaction{
			{ID: "boutique-station", Label: "Petit-déj à la boutique (café, croissant)", Icon: "coffee", Minutes: 20, Cost: 1500, Effect: Needs{Hunger: 25, Energy: 10}},
			{ID: "gaz-bouteille", Label: "Recharger la bouteille de gaz", Icon: "flame", Minutes: 15, Cost: 2000, Effect: Needs{Energy: -5, Hunger: 5}},
			{ID: "credit-station", Label: "Recharger son crédit téléphone", Icon: "smartphone", Minutes: 5, Cost: 1000, Effect: Needs{Social: 10}},
			{ID: "gonfler-pneus", Label: "Faire gonfler les pneus du vélo", Icon: "bike", Minutes: 10, Cost: 200, Effect: Needs{Fun: 5}},
		},
		Events: []RandomEvent{
			{Text: "Rupture de gaz : la file des bouteilles fait le tour de la station.", Effect: Needs{Energy: -5}},
			{Text: "Le pompiste te reconnaît et t'offre un café.", Effect: Needs{Social: 10, Energy: 5}},
		},
	},
	"salon": {
		ID: "salon", Label: "Salon de coiffure", Icon: "flower-2",
		Interactions: []Interaction{
			{ID: "tresses", Label: "Se faire tresser", Icon: "flower-2", Minutes: 3 * 60, Cost: 5000, Effect: Needs{Fun: 10, Social: 30, Energy: -10, Hygiene: 15}, MinHour: 8, MaxHour: 20},
			{ID: "tissage", Ages: TeensUp, Label: "Se faire poser un tissage", Icon: "flower-2", Minutes: 2 * 60, Cost: 15000, Effect: Needs{Fun: 25, Social: 20, Hygiene: 15}, MinHour: 8, MaxHour: 20},
			{ID: "chignon", Label: "Se faire un chignon", Icon: "flower-2", Minutes: 45, Cost: 2000, Effect: Needs{Fun: 15, Hygiene: 10}, MinHour: 8, MaxHour: 20},
			{ID: "nattes", Label: "Se faire des nattes collées", Icon: "flower-2", Minutes: 90, Cost: 3000, Effect: Needs{Fun: 10, Social: 20, Hygiene: 15}, MinHour: 8, MaxHour: 20},
			{ID: "vanilles", Label: "Se faire des vanilles", Icon: "flower-2", Minutes: 2 * 60, Cost: 4000, Effect: Needs{Fun: 15, Social: 25, Energy: -5, Hygiene: 15}, MinHour: 8, MaxHour: 20},
			{ID: "macarons", Label: "Se faire des macarons", Icon: "flower-2", Minutes: 40, Cost: 1500, Effect: Needs{Fun: 15, Hygiene: 10}, MinHour: 8, MaxHour: 20},
			{ID: "carre", Ages: TeensUp, Label: "Se faire un carré", Icon: "flower-2", Minutes: 60, Cost: 5000, Effect: Needs{Fun: 20, Social: 10, Hygiene: 15}, MinHour: 8, MaxHour: 20},
			{ID: "manucure", Ages: TeensUp, Label: "Se faire les ongles", Icon: "sparkles", Minutes: 45, Cost: 3000, Effect: Needs{Fun: 20, Social: 10}, MinHour: 8, MaxHour: 20},
			Gbairai,
		},
		Events: []RandomEvent{
			{Text: "Toute la clientèle connaît déjà la nouvelle du quartier. Le gbairai va vite !", Effect: Needs{Social: 15, Fun: 10}},
			{Text: "La coiffeuse t'a tiré les cheveux trop fort : tu as mal à la tête.", Effect: Needs{Fun: -10}},
		},
	},
	"hotel": {
		ID: "hotel", Label: "Hôtel", Icon: "hotel",
		Interactions: []Interaction{
			{ID: "piscine-hotel", Label: "Se baigner à la piscine", Icon: "waves", Minutes: 60, Cost: 10000, Effect: Needs{Fun: 35, Hygiene: 10, Energy: -10}, MinHour: 8, MaxHour: 19},
			{ID: "brunch-lagune", Label: "Bruncher face à la lagune", Icon: "utensils", Minutes: 90, Cost: 20000, Effect: Needs{Hunger: 60, Fun: 20, Social: 15}, MinHour: 10, MaxHour: 15},
			{ID: "bar-hotel", Ages: Adults, Label: "Prendre un verre au bar de l'hôtel", Icon: "beer", Minutes: 60, Cost: 6000, Effect: Needs{Social: 20, Fun: 25}, MinHour: 17},
			{ID: "nuit-hotel", Ages: Adults, Label: "Passer la nuit à l'hôtel", Icon: "bed-double", Minutes: 8 * 60, Cost: 60000, Effect: Needs{Energy: 100, Hygiene: 40, Fun: 20}, MinHour: 20, MaxHour: 2},
			// The Hôtel Ivoire's own: its ice rink, its cinema and its casino (world3d/interior/IvoireInside.tsx).
			{ID: "patinoire", Label: "Patiner à la patinoire", Icon: "snowflake", Minutes: 60, Cost: 5000, Effect: Needs{Fun: 40, Social: 10, Energy: -15}, MinHour: 10, MaxHour: 22, Places: []string{HotelIvoireID}},
			{ID: "cinema-ivoire", Label: "Voir un film au Ciné Ivoire", Icon: "clapperboard", Minutes: 2 * 60, Cost: 3500, Effect: Needs{Fun: 40, Energy: -5}, MinHour: 12, MaxHour: 2, Places: []string{HotelIvoireID}},
			{ID: "casino-ivoire", Ages: Adults, Label: "Passer la soirée au casino", Icon: "dice-5", Minutes: 90, Cost: 15000, Effect: Needs{Fun: 45, Social: 15, Energy: -10}, MinHour: 18, MaxHour: 4, Places: []string{HotelIvoireID}},
			{ID: "lobby-ivoire", Label: "Flâner dans le grand hall", Icon: "sparkles", Minutes: 30, Effect: Needs{Fun: 15, Social: 5}, Places: []string{HotelIvoireID}},
		},
		Events: []RandomEvent{
			{Text: "Une star du coupé-décalé traverse le hall, entourée de gardes du corps.", Effect: Needs{Fun: 20}},
			{Text: "Il y a un grand mariage dans les salons : la musique s'entend jusqu'à la piscine.", Effect: Needs{Fun: 10, Social: 5}},
		},
	},
	"universite": {
		ID: "universite", Label: "Université", Icon: "graduation-cap",
		Interactions: []Interaction{
			{ID: "amphi", Ages: Adults, Label: "Suivre un cours en amphi", Icon: "presentation", Minutes: 3 * 60, Effect: Needs{Fun: -10, Energy: -20, Social: 20, Hunger: -10}, MinHour: 7, MaxHour: 16, Days: Weekdays},
			{ID: "partiel", Ages: Adults, Label: "Passer un partiel", Icon: "file-text", Minutes: 3 * 60, Effect: Needs{Fun: -25, Energy: -25}, MinHour: 8, MaxHour: 12, Days: Weekdays},
			{ID: "bu", Ages: TeensUp, Label: "Réviser à la bibliothèque universitaire", Icon: "library", Minutes: 2 * 60, Effect: Needs{Fun: -5, Energy: -10}, MinHour: 8, MaxHour: 19, Days: Workweek},
			{ID: "resto-u", Ages: TeensUp, Label: "Manger au resto U", Icon: "utensils", Minutes: 30, Cost: 250, Effect: Needs{Hunger: 45, Social: 10}, MinHour: 11, MaxHour: 14, Days: Workweek},
			{ID: "conference-u", Ages: TeensUp, Label: "Assister à une conférence", Icon: "presentation", Minutes: 90, Effect: Needs{Fun: 15, Social: 15, Energy: -5}, MinHour: 9, MaxHour: 17, Days: Weekdays},
		},
		Events: []RandomEvent{
			{Text: "Grève : les amphis sont fermés, tout le monde rentre.", Effect: Needs{Fun: 5, Social: 5}},
			{Text: "L'amphi est plein : tu suis le cours debout, à la fenêtre.", Effect: Needs{Energy: -10, Fun: -10}},
			{Text: "Les résultats sont affichés : tu valides ton semestre !", Effect: Needs{Fun: 30}},
		},
	},
	// A village of the Ébrié, inside the city: attiéké is made there.
	"village": {
		ID: "village", Label: "Village ébrié", Icon: "cooking-pot",
		Interactions: []Interaction{
			{ID: "preparer-attieke", Ages: TeensUp, Label: "Aider à préparer l'attiéké", Icon: "cooking-pot", Minutes: 3 * 60, Cost: -3000, Effect: Needs{Energy: -25, Hygiene: -15, Social: 20}, MinHour: 6, MaxHour: 15},
			{ID: "attieke-frais", Label: "Manger de l'attiéké frais du village", Icon: "fish", Minutes: 20, Cost: 500, Effect: Needs{Hunger: 45, Fun: 5}},
			{ID: "anciens", Label: "Écouter les anciens raconter le village", Icon: "users", Minutes: 60, Effect: Needs{Social: 25, Fun: 10}},
		},
		Events: []RandomEvent{
			{Text: "Les femmes du village te donnent un sachet d'attiéké pour la maison.", Effect: Needs{Hunger: 20, Social: 10}},
		},
	},
	"lagune": {
		ID: "lagune", Label: "Bord de lagune", Icon: "waves",
		Interactions: []Interaction{
			{ID: "balade-lagune", Label: "Se promener au bord de la lagune", Icon: "footprints", Minutes: 45, Effect: Needs{Fun: 20, Energy: -5, Social: 5}},
			{ID: "photo-plateau", Label: "Prendre les tours du Plateau en photo", Icon: "camera", Minutes: 20, Effect: Needs{Fun: 15}},
			{ID: "coucher-soleil", Label: "Regarder le soleil se coucher sur la lagune", Icon: "sunset", Minutes: 30, Effect: Needs{Fun: 25, Energy: 5}, MinHour: 17, MaxHour: 20},
		},
		Events: []RandomEvent{
			{Text: "Une pinasse passe, les passagers te font signe.", Effect: Needs{Fun: 10}},
		},
	},
	// The Zoo national d'Abidjan (Cocody, toward Abobo): the walk under the big
	// trees past the elephant, the hippos' pool, the crocodiles, the
	// chimpanzees, the lions, the leopard, the hyenas, the zebras, the peacocks. Open in the day; the adult ticket is 1 000 F
	// since the 2021 reopening (500 and 1 500 F for the other rates).
	"zoo": {
		ID: "zoo", Label: "Zoo", Icon: "paw-print",
		Interactions: []Interaction{
			{ID: "zoo-visite", Label: "Visiter le zoo", Icon: "paw-print", Minutes: 2 * 60, Cost: 1000, Effect: Needs{Fun: 35, Social: 10, Energy: -15, Hunger: -10}, MinHour: 8, MaxHour: 17},
			{ID: "zoo-photos", Label: "Faire des selfies devant les lions", Icon: "camera", Minutes: 30, Effect: Needs{Fun: 15, Social: 5}, MinHour: 8, MaxHour: 17},
			{ID: "zoo-pique-nique", Label: "Pique-niquer sous les arbres", Icon: "sandwich", Minutes: 60, Cost: 500, Effect: Needs{Hunger: 30, Social: 20, Fun: 10}, MinHour: 8, MaxHour: 17},
		},
		Events: []RandomEvent{
			{Text: "L'éléphant s'arrose avec sa trompe : tout le monde recule en riant.", Effect: Needs{Fun: 10}},
			{Text: "Un chimpanzé t'imite derrière la vitre. Les enfants sont morts de rire.", Effect: Needs{Fun: 10, Social: 5}},
			{Text: "Le lion se réveille et rugit : ton cœur a failli sortir.", Effect: Needs{Fun: 10, Energy: -5}},
			{Text: "L'hippopotame ouvre la bouche en grand, juste au moment de ta photo.", Effect: Needs{Fun: 10}},
			{Text: "Un paon fait la roue juste devant toi. Tout le monde sort son téléphone.", Effect: Needs{Fun: 10, Social: 5}},
			{Text: "La hyène fait les cent pas derrière le grillage sans te quitter des yeux.", Effect: Needs{Fun: 5}},
		},
	},
	// Babi Karting (invented for the game): the circuit, the karts, the races of
	// three laps against the quarter's drivers that the player drives (the web's kart game).
	"karting": {
		ID: "karting", Label: "Karting", Icon: "car",
		Interactions: []Interaction{
			{ID: "course-kart", Ages: TeensUp, Label: "Faire une course de karting (3 tours)", Icon: "car", Minutes: 30, Cost: 3000, Effect: Needs{Fun: 45, Social: 10, Energy: -10}, MinHour: 10, MaxHour: 23},
			{ID: "regarder-kart", Label: "Regarder les courses depuis la tribune", Icon: "flag", Minutes: 30, Effect: Needs{Fun: 15, Social: 10}, MinHour: 10, MaxHour: 23},
		},
		Events: []RandomEvent{
			{Text: "Tu doubles deux karts dans le dernier virage : la tribune se lève.", Effect: Needs{Fun: 10, Social: 5}},
			{Text: "Une banane plantain sur la piste, et tu fais un tête-à-queue devant tout le monde.", Effect: Needs{Fun: 5}},
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

// Gbairai: gossip, the news of the quarter told from chair to chair. Everyone
// takes part, whoever they are.
var Gbairai = Interaction{ID: "gbairai", Ages: TeensUp, Label: "Faire le gbairai (les commérages)", Icon: "messages-square", Minutes: 45, Effect: Needs{Social: 30, Fun: 20}}

// Hairdos: what a visit to the barbier or the salon does to the Sim's look.
var Hairdos = map[string]struct{ Hair, Beard string }{
	"degrade":      {Hair: "degrade"},
	"coupe-courte": {Hair: "short"},
	"iroquoise":    {Hair: "mohawk"},
	"nattes":       {Hair: "cornrows"},
	"vanilles":     {Hair: "twists"},
	"macarons":     {Hair: "puffs"},
	"carre":        {Hair: "bob"},
	"boule-a-zero": {Hair: "bald"},
	"taille-barbe": {Beard: "bouc"},
	"tresses":      {Hair: "braids"},
	"tissage":      {Hair: "weave"},
	"chignon":      {Hair: "bun"},
}

// Generic events can happen anywhere.
var GenericEvents = []RandomEvent{
	{Text: "Tu trouves un billet de 1 000F par terre. C'est Dieu qui donne !", Money: 1000, Effect: Needs{Fun: 10}},
	{Text: "Il pleut des cordes, tu es trempé·e.", Effect: Needs{Hygiene: -15, Fun: -10}},
	{Text: "Un ami t'envoie un transfert Mobile Money « pour ta soif ».", Money: 2000, Effect: Needs{Social: 10}},
	{Text: "Délestage : le courant est parti. On s'éclaire au téléphone en attendant.", Effect: Needs{Fun: -8, Energy: -5}},
	{Text: "Une tantie te fait goûter son garba « juste pour voir ». Il était doux !", Effect: Needs{Hunger: 15, Social: 5}},
	{Text: "Tu croises un ami d'enfance. Vous avez rigolé comme avant.", Effect: Needs{Social: 15, Fun: 10}},
	{Text: "Un woro-woro t'a éclaboussé·e en passant dans une flaque.", Effect: Needs{Hygiene: -12, Fun: -6}},
	{Text: "Le crédit de ton téléphone est fini au mauvais moment. Tu recharges 500 Djai.", Money: -500},
	{Text: "On t'a rendu la monnaie en trop. Tu es revenu·e la rendre : le vendeur te bénit.", Effect: Needs{Social: 8, Fun: 4}},
	{Text: "Les enfants du quartier jouent au foot dans la rue. Tu as tapé quelques balles avec eux.", Effect: Needs{Fun: 12, Energy: -6}},
	{Text: "Le cousin du village appelle : il a « un petit problème ». Tu envoies 1 000 Djai.", Money: -1000, Effect: Needs{Social: 6}},
	{Text: "Un coupé-décalé passe dans un maquis : tu as fait deux pas de danse dans la rue.", Effect: Needs{Fun: 10}},
	{Text: "La chaleur est trop forte aujourd'hui. Tu as bu de l'eau glacée.", Money: -100, Effect: Needs{Energy: -5}},
	{Text: "Tu as gagné 2 000 Djai au pari du match. La chance est avec toi !", Money: 2000, Effect: Needs{Fun: 12}},
	{Text: "Un vendeur ambulant t'a eu avec ses lunettes « originales » : 1 500 Djai.", Money: -1500, Effect: Needs{Fun: 3}},
}

// HotelIvoireID: the Hôtel Ivoire (world/world.go), whose ice rink, cinema and casino are its own.
const HotelIvoireID = "cocody-hotel-ivoire"
