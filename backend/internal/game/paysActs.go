package game

// Les pays (world/pays.go): what's done in the cities abroad, each tied to its place (Interaction.Places),
// behind its country's update (features.go Interactions). Prices in francs as the game's money, in line
// with the real thing (a tô in a Ouaga maquis, the Empire State's observatory, a Yankees ticket, a poutine);
// hours as the places keep them. Played like every action (web components/defi/jeux/configs/pays.ts).

// BurkinaActs: Ouagadougou's and Bobo-Dioulasso's.
var BurkinaActs = map[string][]Interaction{
	"maquis": {
		{ID: "faso-to", Label: "Manger un tô sauce gombo", Icon: "cooking-pot", Minutes: 40, Cost: 500, Effect: Needs{Hunger: 60, Social: 10}, MinHour: 11, MaxHour: 23, Places: []string{"ouaga-maquis", "zogona-maquis", "bobo-maquis"}},
		{ID: "faso-poulet-bicyclette", Label: "Manger un poulet bicyclette grillé", Icon: "drumstick", Minutes: 45, Cost: 3000, Effect: Needs{Hunger: 70, Fun: 15, Social: 10}, MinHour: 12, MaxHour: 23, Places: []string{"ouaga-maquis", "zogona-maquis", "bobo-maquis"}},
		{ID: "faso-riz-gras", Label: "Manger un riz gras", Icon: "utensils", Minutes: 30, Cost: 700, Effect: Needs{Hunger: 55, Social: 5}, MinHour: 11, MaxHour: 22, Places: []string{"ouaga-maquis", "zogona-maquis", "bobo-maquis"}},
		{ID: "faso-dolo", Ages: Adults, Label: "Boire le dolo avec les anciens", Icon: "beer", Minutes: 45, Cost: 300, Effect: Needs{Social: 30, Fun: 20, Energy: -5}, MinHour: 15, MaxHour: 23, Places: []string{"bobo-maquis", "zogona-maquis"}},
	},
	"market": {
		{ID: "faso-dan-fani", Label: "Acheter un pagne Faso Dan Fani tissé", Icon: "shopping-bag", Minutes: 40, Cost: 8000, Effect: Needs{Fun: 25, Social: 15}, MinHour: 8, MaxHour: 18, Places: []string{"ouaga-grand-marche", "bobo-marche"}},
		{ID: "faso-marchander", Label: "Marchander au Grand marché", Icon: "hand-coins", Minutes: 45, Cost: 1500, Effect: Needs{Fun: 20, Social: 25, Hunger: 10}, MinHour: 7, MaxHour: 18, Places: []string{"ouaga-grand-marche", "bobo-marche"}},
	},
	"culture": {
		{ID: "faso-heros-visite", Label: "Visiter le monument des Héros nationaux", Icon: "landmark", Minutes: 40, Cost: 1000, Effect: Needs{Fun: 25, Social: 5}, MinHour: 8, MaxHour: 18, Places: []string{"ouaga-monument-heros"}},
		{ID: "faso-musee", Label: "Visiter le musée national (masques et costumes)", Icon: "landmark", Minutes: 60, Cost: 1000, Effect: Needs{Fun: 30, Social: 5}, MinHour: 9, MaxHour: 17, Days: Workweek, Places: []string{"ouaga-musee"}},
	},
	"worship": {
		{ID: "dioulassoba-visite", Label: "Visiter la mosquée de Dioulassoba avec un guide", Icon: "landmark", Minutes: 45, Cost: 1000, Effect: Needs{Fun: 30, Social: 10}, MinHour: 8, MaxHour: 17, Places: []string{"bobo-mosquee"}},
		{ID: "ouaga-cathedrale-visite", Label: "Visiter la cathédrale de Ouagadougou", Icon: "church", Minutes: 30, Effect: Needs{Fun: 15, Social: 10}, MinHour: 8, MaxHour: 18, Places: []string{"ouaga-cathedrale"}},
	},
	"rue": {
		{ID: "faso-nation-balade", Label: "Flâner sur la place de la Nation", Icon: "footprints", Minutes: 30, Effect: Needs{Fun: 15, Social: 10}, MinHour: 7, MaxHour: 21, Places: []string{"ouaga-place-nation"}},
	},
	"grin": {
		{ID: "faso-the-etudiants", Label: "Le thé à la menthe avec les étudiants de Zogona", Icon: "coffee", Minutes: 60, Cost: 200, Effect: Needs{Social: 35, Fun: 15}, MinHour: 15, MaxHour: 23, Places: []string{"zogona-grin"}},
	},
	"club": {
		{ID: "faso-night", Ages: Adults, Label: "Danser au Faso Night", Icon: "music", Minutes: 2 * 60, Cost: 2500, Effect: Needs{Fun: 45, Social: 30, Energy: -25}, MinHour: 22, MaxHour: 5, Places: []string{"ouaga-club", "bobo-club"}},
	},
}

// USAActs: New York's.
var USAActs = map[string][]Interaction{
	"culture": {
		{ID: "nyc-empire-observatoire", Label: "Monter à l'observatoire du 86e étage", Icon: "building-2", Minutes: 60, Cost: 26000, Effect: Needs{Fun: 50, Social: 5, Energy: -5}, MinHour: 9, MaxHour: 24, Places: []string{"nyc-empire-state"}},
		{ID: "nyc-apollo-amateur", Label: "Amateur Night à l'Apollo", Icon: "mic", Minutes: 2 * 60, Cost: 18000, Effect: Needs{Fun: 50, Social: 25, Energy: -10}, MinHour: 19, MaxHour: 23, Days: []int{Mercredi}, Places: []string{"nyc-apollo"}},
		{ID: "nyc-apollo-visite", Label: "Visiter l'Apollo Theater", Icon: "drama", Minutes: 45, Cost: 10000, Effect: Needs{Fun: 30, Social: 10}, MinHour: 10, MaxHour: 17, Places: []string{"nyc-apollo"}},
	},
	"rue": {
		{ID: "nyc-times-photo", Label: "Se prendre en photo sous les écrans de Times Square", Icon: "camera", Minutes: 20, Effect: Needs{Fun: 30, Social: 10}, Places: []string{"nyc-times-square"}},
		{ID: "nyc-times-hotdog", Label: "Manger un hot-dog d'un chariot de rue", Icon: "drumstick", Minutes: 15, Cost: 3500, Effect: Needs{Hunger: 35, Fun: 5}, MinHour: 9, MaxHour: 24, Places: []string{"nyc-times-square"}},
	},
	"nature": {
		{ID: "nyc-central-park", Label: "Se promener dans Central Park", Icon: "trees", Minutes: 60, Effect: Needs{Fun: 30, Energy: -5, Social: 5}, MinHour: 6, MaxHour: 21, Places: []string{"nyc-central-park"}},
		{ID: "nyc-central-jogging", Label: "Courir autour du réservoir de Central Park", Icon: "footprints", Minutes: 45, Effect: Needs{Fun: 20, Energy: -20, Hygiene: -15}, MinHour: 6, MaxHour: 20, Places: []string{"nyc-central-park"}},
		{ID: "nyc-unisphere-photo", Label: "Se prendre en photo devant l'Unisphère", Icon: "camera", Minutes: 20, Effect: Needs{Fun: 25, Social: 5}, MinHour: 7, MaxHour: 21, Places: []string{"nyc-flushing"}},
	},
	"market": {
		{ID: "nyc-harlem-wax", Label: "Acheter du wax et du beurre de karité sur la 116e rue", Icon: "shopping-bag", Minutes: 40, Cost: 12000, Effect: Needs{Fun: 20, Social: 25}, MinHour: 10, MaxHour: 20, Places: []string{"nyc-harlem-market"}},
	},
	"sport": {
		{ID: "nyc-yankees-match", Label: "Voir un match des Yankees", Icon: "trophy", Minutes: 3 * 60, Cost: 30000, Effect: Needs{Fun: 50, Social: 30, Energy: -10, Hunger: -10}, MinHour: 13, MaxHour: 22, Places: []string{"nyc-yankee-stadium"}},
	},
	"maquis": {
		{ID: "nyc-maquis-garba", Label: "Manger un garba de chez nous, loin du pays", Icon: "cooking-pot", Minutes: 40, Cost: 9000, Effect: Needs{Hunger: 60, Social: 20, Fun: 10}, MinHour: 11, MaxHour: 24, Places: []string{"nyc-maquis", "bronx-maquis"}},
		{ID: "nyc-maquis-diaspora", Label: "Causer du pays avec la diaspora", Icon: "messages-square", Minutes: 45, Cost: 3000, Effect: Needs{Social: 35, Fun: 15}, MinHour: 17, MaxHour: 24, Places: []string{"nyc-maquis", "bronx-maquis"}},
	},
	"transport": {
		{ID: "nyc-grand-central-visite", Label: "Admirer le grand hall de Grand Central", Icon: "train-front", Minutes: 20, Effect: Needs{Fun: 20, Social: 5}, MinHour: 6, MaxHour: 24, Places: []string{"nyc-grand-central"}},
	},
	"club": {
		{ID: "nyc-lounge-night", Ages: Adults, Label: "Danser le coupé-décalé à Harlem", Icon: "music", Minutes: 2 * 60, Cost: 15000, Effect: Needs{Fun: 45, Social: 30, Energy: -25}, MinHour: 22, MaxHour: 4, Places: []string{"nyc-club"}},
	},
}

// CanadaActs: Montréal's.
var CanadaActs = map[string][]Interaction{
	"worship": {
		{ID: "mtl-notre-dame-visite", Label: "Visiter la basilique Notre-Dame", Icon: "church", Minutes: 45, Cost: 9000, Effect: Needs{Fun: 30, Social: 5}, MinHour: 9, MaxHour: 17, Places: []string{"mtl-basilique"}},
		{ID: "mtl-notre-dame-aura", Label: "Voir le spectacle de lumière dans la basilique", Icon: "sparkles", Minutes: 60, Cost: 18000, Effect: Needs{Fun: 50, Social: 10}, MinHour: 18, MaxHour: 22, Places: []string{"mtl-basilique"}},
		{ID: "mtl-oratoire-marches", Label: "Monter les marches de l'oratoire Saint-Joseph", Icon: "footprints", Minutes: 45, Effect: Needs{Fun: 25, Energy: -15, Social: 5}, MinHour: 7, MaxHour: 20, Places: []string{"mtl-oratoire"}},
	},
	"nature": {
		{ID: "mtl-belvedere", Label: "Monter au belvédère du mont Royal", Icon: "mountain", Minutes: 60, Effect: Needs{Fun: 35, Energy: -15}, MinHour: 7, MaxHour: 22, Places: []string{"mtl-mont-royal"}},
		{ID: "mtl-vieux-port-balade", Label: "Se promener sur les quais du Vieux-Port", Icon: "footprints", Minutes: 45, Effect: Needs{Fun: 25, Social: 10}, MinHour: 8, MaxHour: 23, Places: []string{"mtl-vieux-port"}},
	},
	"maquis": {
		{ID: "mtl-poutine", Label: "Manger une poutine", Icon: "utensils", Minutes: 20, Cost: 7000, Effect: Needs{Hunger: 55, Fun: 10}, MinHour: 11, MaxHour: 24, Places: []string{"mtl-maquis", "cdn-maquis"}},
		{ID: "mtl-maquis-attieke", Label: "Manger un attiéké-poisson chez les gens du pays", Icon: "cooking-pot", Minutes: 40, Cost: 9000, Effect: Needs{Hunger: 60, Social: 20}, MinHour: 11, MaxHour: 23, Places: []string{"mtl-maquis", "cdn-maquis"}},
	},
	"boutique": {
		{ID: "mtl-epicerie", Label: "Faire le plein de produits du pays à l'épicerie", Icon: "shopping-basket", Minutes: 30, Cost: 6000, Effect: Needs{Fun: 10, Social: 15, Hunger: 10}, MinHour: 9, MaxHour: 21, Places: []string{"cdn-epicerie"}},
	},
	"club": {
		{ID: "mtl-zouglou-nuit", Ages: Adults, Label: "Danser au Club Zouglou Nord", Icon: "music", Minutes: 2 * 60, Cost: 12000, Effect: Needs{Fun: 45, Social: 30, Energy: -25}, MinHour: 22, MaxHour: 3, Places: []string{"mtl-club"}},
	},
}

func init() {
	for _, acts := range []map[string][]Interaction{BurkinaActs, USAActs, CanadaActs} {
		addActs(acts)
	}
	villeActs[BurkinaKey] = BurkinaActs
	villeActs[USAKey] = USAActs
	villeActs[CanadaKey] = CanadaActs
}
