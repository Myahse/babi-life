package game

import (
	"maps"
	"slices"
)

// Yamoussoukro and Bouaké alive (the updates « yakro-vivant » and « bouake-vivant »): their landmarks
// and their life, played. Each activity here is tied to its place (Interaction.Places), at the hours the
// real thing keeps, at prices in line with Abidjan's (the zoo's ticket, the Hôtel Ivoire's brunch, the
// ski off Boulay). Three are games of their own (sims/defi.go): the basilica's visit with its guide,
// the crocodiles fed from behind the rail, the safari at the N'Zi. The others are played like every
// action (web components/defi/jeux/configs/villes.ts).

// The updates.
const (
	YakroKey  = "yakro-vivant"
	BouakeKey = "bouake-vivant"
)

// Yamoussoukro's places (world.go).
const (
	BasiliqueID      = "yakro-basilique"
	LacCaimansID     = "yakro-lac"
	YakroMosqueeID   = "yakro-mosquee"
	YakroFondationID = "yakro-fondation"
	YakroHotelID     = "yakro-hotel"
	YakroGolfID      = "yakro-golf"
	YakroMaquisID    = "yakro-maquis-braise"
	YakroClubID      = "yakro-club-caiman"
	YakroClub2ID     = "yakro-club-totem"
)

// Bouaké's places (world.go), and the commune of the N'Zi's reserve.
const (
	BouakeMarcheID  = "bouake-marche"
	BouakeHotelID   = "bouake-hotel-paons"
	BouakeAllocoID  = "bouake-allocodrome"
	BouakeMaquisID  = "bouake-maquis-airfrance"
	BouakeClubID    = "bouake-club"
	BroboCommune    = "brobo"
	NziReserveID    = "nzi-reserve"
	NziLodgeID      = "nzi-lodge"
	BasiliqueVisit  = "basilique-visite"
	CaimansFeed     = "caimans-nourrir"
	SafariDrive     = "safari-4x4"
	SafariWalk      = "safari-pied"
	GolfParcours    = "golf-parcours"
	GolfPractice    = "golf-practice"
	caimansFeedHour = 16
)

// The days of the basilica's visits: every day but Sunday morning's mass (the afternoon is open).
var basiliqueDays = []int{Lundi, Mardi, Mercredi, Jeudi, Vendredi, Samedi}

// YakroActs: what's done at Yamoussoukro's places, by the kind they're of.
var YakroActs = map[string][]Interaction{
	"worship": {
		// The basilica (Pierre Fakhoury, 1989): the guide takes visitors through the nave under the dome, its
		// 7 000 seats and its 36 stained-glass windows (one shows Félix Houphouët-Boigny among the apostles).
		{ID: BasiliqueVisit, Label: "Visiter la basilique avec le guide", Icon: "church", Minutes: 75, Cost: 2000, Effect: Needs{Fun: 35, Social: 10, Energy: -8}, MinHour: 8, MaxHour: 17, Days: basiliqueDays, Places: []string{BasiliqueID}},
		{ID: "basilique-esplanade", Label: "Se promener sur l'esplanade, entre les colonnes", Icon: "camera", Minutes: 30, Effect: Needs{Fun: 20, Energy: -4}, MinHour: 7, MaxHour: 19, Places: []string{BasiliqueID}},
		{ID: "basilique-cierge", Label: "Allumer un cierge sous la coupole", Icon: "flame", Minutes: 20, Cost: 500, Effect: Needs{Fun: 10, Social: 10}, MinHour: 8, MaxHour: 18, Places: []string{BasiliqueID}},
		// The great mosque of Yamoussoukro: its own visit, outside prayer times.
		{ID: "mosquee-yakro-visite", Label: "Visiter la grande mosquée, pieds nus", Icon: "landmark", Minutes: 40, Effect: Needs{Fun: 20, Social: 10}, MinHour: 9, MaxHour: 12, Days: []int{Lundi, Mardi, Mercredi, Jeudi, Samedi, Dimanche}, Places: []string{YakroMosqueeID}},
	},
	"nature": {
		// The sacred crocodiles in the lakes round the presidential palace: the keeper feeds them in the late
		// afternoon (a chicken thrown from behind the rail). One may buy a chicken and throw it, from afar.
		{ID: CaimansFeed, Label: "Nourrir les caïmans sacrés, de loin", Icon: "drumstick", Minutes: 30, Cost: 2500, Effect: Needs{Fun: 40, Social: 10, Energy: -5}, MinHour: caimansFeedHour, MaxHour: 18, Places: []string{LacCaimansID}},
		{ID: "caimans-repas", Label: "Regarder le repas des caïmans", Icon: "eye", Minutes: 30, Effect: Needs{Fun: 25, Social: 10}, MinHour: caimansFeedHour, MaxHour: 18, Places: []string{LacCaimansID}},
		{ID: "lac-tour", Label: "Faire le tour des lacs du palais", Icon: "footprints", Minutes: 60, Effect: Needs{Fun: 20, Energy: -15, Hygiene: -5}, MinHour: 6, MaxHour: 19, Places: []string{LacCaimansID}},
	},
	"culture": {
		// The Fondation Félix-Houphouët-Boigny pour la recherche de la paix: its marble halls and its gardens.
		{ID: "fondation-visite", Label: "Visiter la Fondation et ses jardins", Icon: "landmark", Minutes: 60, Cost: 1000, Effect: Needs{Fun: 25, Social: 5}, MinHour: 9, MaxHour: 17, Days: Weekdays, Places: []string{YakroFondationID}},
		{ID: "fondation-conference", Ages: TeensUp, Label: "Assister à une conférence sur la paix", Icon: "presentation", Minutes: 90, Effect: Needs{Fun: 15, Social: 20, Energy: -5}, MinHour: 10, MaxHour: 17, Days: []int{Mardi, Jeudi}, Places: []string{YakroFondationID}},
	},
	"hotel": {
		// The Hôtel Le Résident (the game's), its tower and its restaurant at the top, over the lakes.
		{ID: "resident-panorama", Label: "Dîner au restaurant panoramique, tout en haut", Icon: "utensils", Minutes: 90, Cost: 18000, Effect: Needs{Hunger: 60, Fun: 25, Social: 15}, MinHour: 19, MaxHour: 23, Places: []string{YakroHotelID}},
	},
	"golf": {
		{ID: GolfParcours, Ages: TeensUp, Label: "Faire un parcours de 9 trous", Icon: "flag", Minutes: 2 * 60, Cost: 15000, Effect: Needs{Fun: 40, Social: 15, Energy: -20, Hygiene: -10}, MinHour: 7, MaxHour: 18},
		{ID: GolfPractice, Label: "Taper des balles au practice", Icon: "target", Minutes: 45, Cost: 3000, Effect: Needs{Fun: 25, Energy: -10}, MinHour: 7, MaxHour: 19},
		{ID: "golf-club-house", Ages: Adults, Label: "Prendre un verre au club-house", Icon: "beer", Minutes: 45, Cost: 4000, Effect: Needs{Social: 20, Fun: 15}, MinHour: 10, MaxHour: 22},
	},
	"maquis": {
		// On the rue des Maquis, by the palace: the braisés, the kedjenou, the « choukouya ».
		{ID: "braise-kedjenou", Label: "Manger un kédjénou de poulet, cuit dans la canari", Icon: "cooking-pot", Minutes: 45, Cost: 3000, Effect: Needs{Hunger: 65, Fun: 10, Social: 10}, MinHour: 11, MaxHour: 2, Places: []string{YakroMaquisID}},
		{ID: "braise-choukouya", Label: "Partager un choukouya de mouton", Icon: "drumstick", Minutes: 45, Cost: 4000, Effect: Needs{Hunger: 55, Fun: 15, Social: 20}, MinHour: 17, MaxHour: 2, Places: []string{YakroMaquisID}},
	},
}

// BouakeActs: what's done at Bouaké's places and at the N'Zi.
var BouakeActs = map[string][]Interaction{
	"market": {
		// The country of the Baoulé weavers: the kita (the woven pagne) and the yams of the region.
		{ID: "marche-bouake-kita", Ages: TeensUp, Label: "Choisir un pagne kita tissé à la main", Icon: "shirt", Minutes: 45, Cost: 8000, Effect: Needs{Fun: 25, Social: 10, Energy: -5}, MinHour: 7, MaxHour: 18, Places: []string{BouakeMarcheID}},
		{ID: "marche-bouake-igname", Label: "Marchander des ignames au carré des vivriers", Icon: "shopping-basket", Minutes: 30, Cost: 1500, Effect: Needs{Hunger: 15, Social: 15, Fun: 10}, MinHour: 6, MaxHour: 17, Places: []string{BouakeMarcheID}},
	},
	"hotel": {
		// The Hôtel Le Jardin des Paons (the game's): its garden of animals, as many hotels of the centre keep.
		{ID: "jardin-animaux", Label: "Faire le tour du jardin aux animaux", Icon: "paw-print", Minutes: 40, Cost: 1000, Effect: Needs{Fun: 30, Social: 5}, MinHour: 8, MaxHour: 18, Places: []string{BouakeHotelID}},
		{ID: "nourrir-autruches", Label: "Donner du grain aux autruches", Icon: "bird", Minutes: 20, Cost: 500, Effect: Needs{Fun: 25}, MinHour: 8, MaxHour: 18, Places: []string{BouakeHotelID}},
		// The lodge on the N'Zi: dinner on the terrace over the river, the night sounds.
		{ID: "lodge-terrasse", Label: "Dîner sur la terrasse, face à la rivière", Icon: "utensils", Minutes: 90, Cost: 12000, Effect: Needs{Hunger: 60, Fun: 25, Social: 15}, MinHour: 18, MaxHour: 23, Places: []string{NziLodgeID}},
		{ID: "lodge-feu", Label: "Écouter les histoires du pisteur autour du feu", Icon: "flame", Minutes: 45, Effect: Needs{Social: 25, Fun: 20}, MinHour: 19, MaxHour: 23, Places: []string{NziLodgeID}},
	},
	"nature": {
		// The reserve on the N'Zi (41 000 ha, decree of 2018): elephants, buffalo, antelopes, monkeys, birds.
		{ID: SafariDrive, Label: "Partir en safari en 4x4", Icon: "binoculars", Minutes: 150, Cost: 15000, Effect: Needs{Fun: 50, Social: 10, Energy: -15}, MinHour: 6, MaxHour: 18, Places: []string{NziReserveID}},
		{ID: SafariWalk, Ages: TeensUp, Label: "Safari à pied avec le pisteur", Icon: "footprints", Minutes: 120, Cost: 8000, Effect: Needs{Fun: 45, Energy: -25, Hygiene: -15, Hunger: -10}, MinHour: 6, MaxHour: 11, Places: []string{NziReserveID}},
		{ID: "nzi-pirogue", Label: "Descendre la N'Zi en pirogue", Icon: "sailboat", Minutes: 60, Cost: 5000, Effect: Needs{Fun: 35, Energy: -10}, MinHour: 7, MaxHour: 18, Places: []string{NziReserveID}},
		{ID: "nzi-oiseaux", Label: "Observer les oiseaux au bord de l'eau", Icon: "bird", Minutes: 45, Cost: 2000, Effect: Needs{Fun: 25, Energy: -5}, MinHour: 6, MaxHour: 19, Places: []string{NziReserveID}},
	},
	"maquis": {
		{ID: "allocodrome-alloco", Label: "Manger l'alloco-poisson de l'allocodrome", Icon: "fish", Minutes: 30, Cost: 1000, Effect: Needs{Hunger: 50, Social: 10}, MinHour: 16, MaxHour: 1, Places: []string{BouakeAllocoID}},
		{ID: "airfrance-zouglou", Ages: Adults, Label: "Danser le zouglou au maquis jusqu'à tard", Icon: "music", Minutes: 90, Cost: 2000, Effect: Needs{Fun: 40, Social: 30, Energy: -20}, MinHour: 20, MaxHour: 3, Places: []string{BouakeMaquisID}},
	},
}

// golfKind: the golf course (Yamoussoukro's), a kind of place of its own.
var golfKind = PlaceKind{ID: "golf", Label: "Golf", Icon: "flag",
	Events: []RandomEvent{
		{Text: "Un héron se pose sur le green juste avant ton coup. Tu attends qu'il reparte.", Effect: Needs{Fun: 5}},
		{Text: "Ta balle file droit vers le drapeau : les caddies applaudissent.", Effect: Needs{Fun: 15, Social: 5}},
	}}

func init() {
	Kinds["golf"] = golfKind
	for _, acts := range []map[string][]Interaction{YakroActs, BouakeActs} {
		addActs(acts)
	}
}

// addActs: a city's activities added to their kinds, in the same order every time (the menus list them so).
func addActs(acts map[string][]Interaction) {
	for _, kind := range slices.Sorted(maps.Keys(acts)) {
		k := Kinds[kind]
		k.Interactions = append(k.Interactions, acts[kind]...)
		Kinds[kind] = k
	}
}

// villeActs: each update's activities.
var villeActs = map[string]map[string][]Interaction{YakroKey: YakroActs, BouakeKey: BouakeActs, SanPedroKey: SanPedroActs, KorhogoKey: KorhogoActs}

// VilleIDs: every activity an update brings (features.go), by update.
func VilleIDs(key string) []string {
	acts := villeActs[key]
	var out []string
	for _, kind := range slices.Sorted(maps.Keys(acts)) {
		for _, it := range acts[kind] {
			out = append(out, it.ID)
		}
	}
	return out
}
