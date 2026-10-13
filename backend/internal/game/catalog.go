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
