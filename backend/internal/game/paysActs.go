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
		{ID: "nyc-harlem-souvenirs", Label: "Chiner des souvenirs au marché de Harlem", Icon: "shopping-bag", Minutes: 40, Cost: 12000, Effect: Needs{Fun: 20, Social: 20}, MinHour: 10, MaxHour: 20, Places: []string{"nyc-harlem-market"}},
	},
	"sport": {
		{ID: "nyc-yankees-match", Label: "Voir un match des Yankees", Icon: "trophy", Minutes: 3 * 60, Cost: 30000, Effect: Needs{Fun: 50, Social: 30, Energy: -10, Hunger: -10}, MinHour: 13, MaxHour: 22, Places: []string{"nyc-yankee-stadium"}},
	},
	// The diner, the pizzeria, the Jamaican grill of Queens, the bodega on the corner (world/pays.go).
	"restaurant": {
		{ID: "nyc-diner-brunch", Label: "Prendre un brunch au diner : pancakes, œufs, café à volonté", Icon: "coffee", Minutes: 45, Cost: 9000, Effect: Needs{Hunger: 60, Social: 10, Fun: 10}, MinHour: 7, MaxHour: 15, Places: []string{"nyc-diner"}},
		{ID: "nyc-pizza-part", Label: "Manger une part de pizza new-yorkaise", Icon: "pizza", Minutes: 15, Cost: 3500, Effect: Needs{Hunger: 40, Fun: 5}, MinHour: 11, MaxHour: 24, Places: []string{"bronx-pizza"}},
		{ID: "nyc-jerk-chicken", Label: "Manger un poulet jerk à la jamaïcaine", Icon: "drumstick", Minutes: 30, Cost: 8000, Effect: Needs{Hunger: 55, Fun: 10}, MinHour: 11, MaxHour: 23, Places: []string{"queens-grill"}},
	},
	"boutique": {
		{ID: "nyc-bodega-sandwich", Label: "Prendre un bacon-egg-cheese à la bodega", Icon: "sandwich", Minutes: 10, Cost: 3000, Effect: Needs{Hunger: 35}, MinHour: 6, MaxHour: 24, Places: []string{"bronx-bodega"}},
		{ID: "nyc-bodega-chat", Label: "Caresser le chat de la bodega", Icon: "cat", Minutes: 5, Effect: Needs{Fun: 10}, Places: []string{"bronx-bodega"}},
	},
	"transport": {
		{ID: "nyc-grand-central-visite", Label: "Admirer le grand hall de Grand Central", Icon: "train-front", Minutes: 20, Effect: Needs{Fun: 20, Social: 5}, MinHour: 6, MaxHour: 24, Places: []string{"nyc-grand-central"}},
	},
	"club": {
		{ID: "nyc-club-hiphop", Ages: Adults, Label: "Danser sur du hip-hop jusqu'au matin", Icon: "music", Minutes: 2 * 60, Cost: 15000, Effect: Needs{Fun: 45, Social: 30, Energy: -25}, MinHour: 22, MaxHour: 4, Places: []string{"nyc-club"}},
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
		{ID: "mtl-patin", Label: "Patiner sur la glace du Vieux-Port", Icon: "snowflake", Minutes: 45, Cost: 5000, Effect: Needs{Fun: 40, Energy: -15, Social: 10}, MinHour: 10, MaxHour: 22, Places: []string{"mtl-vieux-port"}},
		{ID: "mtl-tire-erable", Label: "Manger de la tire d'érable sur la neige", Icon: "candy", Minutes: 15, Cost: 2000, Effect: Needs{Fun: 25, Hunger: 10}, MinHour: 10, MaxHour: 20, Places: []string{"mtl-mont-royal"}},
	},
	// The casse-croûte, the bagel shop, the dépanneur (world/pays.go).
	"restaurant": {
		{ID: "mtl-poutine", Label: "Manger une poutine", Icon: "utensils", Minutes: 20, Cost: 7000, Effect: Needs{Hunger: 55, Fun: 10}, MinHour: 11, MaxHour: 24, Places: []string{"mtl-cassecroute"}},
		{ID: "mtl-smoked-meat", Label: "Manger un sandwich au smoked meat", Icon: "sandwich", Minutes: 30, Cost: 9000, Effect: Needs{Hunger: 60, Fun: 10}, MinHour: 11, MaxHour: 23, Places: []string{"mtl-cassecroute"}},
		{ID: "mtl-bagel", Label: "Manger un bagel tout chaud sorti du four à bois", Icon: "croissant", Minutes: 15, Cost: 2500, Effect: Needs{Hunger: 30, Fun: 5}, MinHour: 6, MaxHour: 24, Places: []string{"cdn-bagels"}},
	},
	"boutique": {
		{ID: "mtl-depanneur", Label: "Faire un tour au dépanneur du coin", Icon: "shopping-basket", Minutes: 15, Cost: 3000, Effect: Needs{Hunger: 15, Fun: 5}, MinHour: 7, MaxHour: 24, Places: []string{"cdn-depanneur"}},
	},
	"club": {
		{ID: "mtl-club-nuit", Ages: Adults, Label: "Sortir en club sur le boulevard Saint-Laurent", Icon: "music", Minutes: 2 * 60, Cost: 12000, Effect: Needs{Fun: 45, Social: 30, Energy: -25}, MinHour: 22, MaxHour: 3, Places: []string{"mtl-club"}},
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
