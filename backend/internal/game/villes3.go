package game

// Man and Daloa alive (the updates « man-vivant » and « daloa-vivant »), the way San-Pédro and Korhogo were
// (villes2.go): their landmarks and their life, played, each activity tied to its place (Interaction.Places),
// at the hours the real thing keeps, at prices in line with the other cities'. Four are games of their own
// (sims/defi.go): the Dent de Man climbed (the story's épreuve « dent-de-man », reused), the liana bridge of
// Lieupleu crossed, the cocoa weighed at Daloa's market without being cheated (the épreuve « cacao-daloa »,
// reused), the day at the plantation with the planters. The others are played like every action (web
// components/defi/jeux/configs/villes3.ts).

// The updates.
const (
	ManKey   = "man-vivant"
	DaloaKey = "daloa-vivant"
)

// Man's places (world.go): the mountains, the waterfall, the sacred forest of the monkeys, the masks.
const (
	ManDentID       = "man-dent"
	ManCascadeID    = "man-cascade"
	ManMarcheID     = "man-marche"
	ManTonkpiID     = "man-tonkpi"
	ManGbepleuID    = "man-gbepleu"
	ManMasquesID    = "man-masques"
	ManPlantationID = "man-plantation"
	ManLianesID     = "man-lianes-excursions"
	ManMaquisID     = "man-maquis-dent"
	ManClubID       = "man-club-sommet"
	ManHotelID      = "man-hotel-brume"
	ManPlaceID      = "man-place-paix"
	DentClimb       = "dent-monter"
	LianesTrip      = "lianes-traverser"
)

// Daloa's places (world.go): the market and its scales, the plantation, the Lobo, the Bété culture.
const (
	DaloaMarcheID     = "daloa-marche"
	DaloaPlantationID = "daloa-plantation"
	DaloaLoboID       = "daloa-lobo"
	DaloaBeteID       = "daloa-cour-bete"
	DaloaCathedraleID = "daloa-cathedrale"
	DaloaMosqueeID    = "daloa-mosquee"
	DaloaMaquisID     = "daloa-maquis-cabosse"
	DaloaClubID       = "daloa-club-zigli"
	DaloaHotelID      = "daloa-hotel-antilope"
	DaloaCHRID        = "daloa-chr"
	DaloaStadeID      = "daloa-stade"
	DaloaRondPointID  = "daloa-rond-point"
	DaloaZoneID       = "daloa-zone-cacao"
	CocoaWeigh        = "daloa-balances"
	CocoaDay          = "plantation-cacao"
)

// ManActs: what's done at Man's places, by the kind they're of.
var ManActs = map[string][]Interaction{
	"nature": {
		// The Dent de Man (881 m), the tooth of rock over the town: the path through the coffee and the forest,
		// the last part on the rock with the hands, the town under the mist from the top. Off early, with a guide.
		{ID: DentClimb, Ages: TeensUp, Label: "Monter la Dent de Man avec un guide", Icon: "mountain", Minutes: 5 * 60, Cost: 5000, Effect: Needs{Fun: 50, Social: 10, Energy: -40, Hygiene: -25, Hunger: -20}, MinHour: 5, MaxHour: 9, Places: []string{ManDentID}},
		{ID: "dent-pique-nique", Label: "Pique-niquer au pied de la Dent", Icon: "utensils", Minutes: 60, Cost: 1500, Effect: Needs{Hunger: 35, Fun: 20, Social: 10}, MinHour: 10, MaxHour: 16, Places: []string{ManDentID}},
		// Mont Tonkpi (1 189 m), the highest of the eighteen mountains round the town: the track up to the
		// antennas, the belvédère and its view over the mountains and, on a clear day, the plain to the north.
		{ID: "tonkpi-belvedere", Label: "Monter au belvédère du mont Tonkpi", Icon: "mountain", Minutes: 2 * 60, Cost: 2000, Effect: Needs{Fun: 40, Energy: -20, Hygiene: -10}, MinHour: 6, MaxHour: 16, Places: []string{ManTonkpiID}},
		{ID: "tonkpi-brume", Label: "Regarder les dix-huit montagnes sortir de la brume", Icon: "camera", Minutes: 30, Effect: Needs{Fun: 25, Energy: 5}, MinHour: 6, MaxHour: 18, Places: []string{ManTonkpiID}},
		// The Cascade, at the edge of town by Zadépleu: the water down the rocks under the forest, the bamboo
		// grove on the path, the pool at its foot where the young of Man bathe.
		{ID: "cascade-baigner", Label: "Se baigner au pied de la cascade", Icon: "waves", Minutes: 60, Cost: 1000, Effect: Needs{Fun: 40, Energy: -10, Hygiene: 10}, MinHour: 8, MaxHour: 17, Places: []string{ManCascadeID}},
		{ID: "cascade-bambous", Label: "Marcher sous les bambous jusqu'à la cascade", Icon: "footprints", Minutes: 45, Cost: 1000, Effect: Needs{Fun: 25, Energy: -8}, MinHour: 7, MaxHour: 18, Places: []string{ManCascadeID}},
	},
	"sacre": {
		// The sacred forest of Gbêpleu: its monkeys are not hunted and come to the visitors for bananas.
		{ID: "gbepleu-singes", Label: "Donner des bananes aux singes sacrés de Gbêpleu", Icon: "banana", Minutes: 30, Cost: 500, Effect: Needs{Fun: 35, Social: 5}, MinHour: 8, MaxHour: 17, Places: []string{ManGbepleuID}},
		{ID: "gbepleu-respect", Label: "Écouter le gardien raconter la forêt sacrée", Icon: "trees", Minutes: 30, Effect: Needs{Fun: 15, Social: 15}, MinHour: 8, MaxHour: 17, Places: []string{ManGbepleuID}},
	},
	"culture": {
		// The Dan masks: the stilt dancers (the échassiers, the « masques longs ») and the juggling masks that
		// dance for visitors, to the drums. The masks of the sacred forest are not the show's: only those
		// danced in public are shown.
		{ID: "masques-spectacle", Label: "Voir la danse des échassiers et des masques", Icon: "drama", Minutes: 90, Cost: 3000, Effect: Needs{Fun: 45, Social: 20, Energy: -5}, MinHour: 16, MaxHour: 21, Days: []int{Vendredi, Samedi, Dimanche}, Places: []string{ManMasquesID}},
		{ID: "masques-tam-tam", Label: "Taper le tam-tam avec les musiciens des masques", Icon: "drum", Minutes: 45, Cost: 1000, Effect: Needs{Fun: 35, Social: 15, Energy: -5}, MinHour: 15, MaxHour: 20, Places: []string{ManMasquesID}},
		{ID: "masques-sculpteurs", Label: "Regarder les sculpteurs tailler les masques", Icon: "hammer", Minutes: 45, Effect: Needs{Fun: 25, Social: 10}, MinHour: 8, MaxHour: 18, Places: []string{ManMasquesID}},
		{ID: "masques-acheter", Ages: TeensUp, Label: "Acheter un masque dan sculpté", Icon: "palette", Minutes: 30, Cost: 15000, Effect: Needs{Fun: 25, Social: 5}, MinHour: 8, MaxHour: 18, Places: []string{ManMasquesID}},
	},
	"market": {
		{ID: "man-marche-cafe", Label: "Acheter le café et la kola du pays", Icon: "coffee", Minutes: 30, Cost: 1500, Effect: Needs{Fun: 15, Social: 15}, MinHour: 6, MaxHour: 18, Places: []string{ManMarcheID}},
		{ID: "man-marche-banane", Label: "Manger la banane braisée et les arachides", Icon: "banana", Minutes: 20, Cost: 500, Effect: Needs{Hunger: 35, Social: 5}, MinHour: 7, MaxHour: 20, Places: []string{ManMarcheID}},
	},
	"plantation": {
		// The coffee and the cocoa of the mountains grow under the forest's big trees: picked by hand, a
		// day's work paid by the planter.
		{ID: "man-cafe-cueillir", Ages: TeensUp, Label: "Cueillir le café sous les grands arbres", Icon: "coffee", Minutes: 3 * 60, Cost: -2500, Effect: Needs{Fun: 20, Social: 20, Energy: -25, Hygiene: -15}, MinHour: 7, MaxHour: 14, Places: []string{ManPlantationID}},
		{ID: "man-cafe-secher", Label: "Retourner le café qui sèche au soleil", Icon: "sprout", Minutes: 45, Cost: -800, Effect: Needs{Fun: 15, Social: 10, Energy: -8}, MinHour: 9, MaxHour: 16, Places: []string{ManPlantationID}},
		{ID: "man-cafe-gouter", Label: "Goûter le café du planteur, grillé au feu de bois", Icon: "coffee", Minutes: 20, Effect: Needs{Fun: 15, Social: 15, Energy: 10}, MinHour: 7, MaxHour: 18, Places: []string{ManPlantationID}},
	},
	"excursion": {
		// The liana bridges of Lieupleu and Vatouo, by Danané, 75 km west: woven of lianas over the Cavally's
		// streams by the village's initiated, and crossed with care.
		{ID: LianesTrip, Ages: TeensUp, Label: "Une journée aux ponts de lianes de Lieupleu", Icon: "footprints", Minutes: 9 * 60, Cost: 20000, Effect: Needs{Fun: 55, Social: 15, Energy: -30, Hygiene: -15, Hunger: -15}, MinHour: 6, MaxHour: 9, Places: []string{ManLianesID}},
		{ID: "lianes-histoire", Label: "Écouter le guide raconter les ponts tissés en une nuit", Icon: "book-open", Minutes: 30, Effect: Needs{Fun: 20, Social: 10}, MinHour: 8, MaxHour: 18, Places: []string{ManLianesID}},
	},
	"maquis": {
		// The west's own: the rice with the sauce feuille or the sauce graine, the bangui (palm wine).
		{ID: "dent-sauce-feuille", Label: "Manger le riz sauce feuille du pays dan", Icon: "cooking-pot", Minutes: 40, Cost: 1500, Effect: Needs{Hunger: 60, Social: 10}, MinHour: 11, MaxHour: 23, Places: []string{ManMaquisID}},
		{ID: "dent-bangui", Ages: Adults, Label: "Boire le bangui avec les anciens", Icon: "beer", Minutes: 45, Cost: 500, Effect: Needs{Social: 30, Fun: 20, Energy: -5}, MinHour: 16, MaxHour: 24, Places: []string{ManMaquisID}},
	},
	"rue": {
		// The Place de la Paix: the benches, the café Touba sellers in the morning, the Dent over the roofs.
		{ID: "paix-cafe-touba", Label: "Boire un café Touba sur la place de la Paix", Icon: "coffee", Minutes: 20, Cost: 200, Effect: Needs{Energy: 10, Social: 10, Fun: 5}, MinHour: 6, MaxHour: 11, Places: []string{ManPlaceID}},
	},
	"club": {
		{ID: "sommet-nuit", Ages: Adults, Label: "Danser jusqu'au matin au Sommet Club", Icon: "music", Minutes: 2 * 60, Cost: 3000, Effect: Needs{Fun: 45, Social: 30, Energy: -25}, MinHour: 22, MaxHour: 5, Places: []string{ManClubID}},
	},
	"hotel": {
		{ID: "brume-terrasse", Label: "Dîner sur la terrasse, face à la Dent", Icon: "utensils", Minutes: 90, Cost: 10000, Effect: Needs{Hunger: 60, Fun: 25, Social: 15}, MinHour: 19, MaxHour: 23, Places: []string{ManHotelID}},
		{ID: "brume-matin", Label: "Prendre le petit-déjeuner dans la brume du matin", Icon: "coffee", Minutes: 45, Cost: 4000, Effect: Needs{Hunger: 40, Fun: 15, Energy: 10}, MinHour: 6, MaxHour: 10, Places: []string{ManHotelID}},
	},
}

// DaloaActs: what's done at Daloa's places.
var DaloaActs = map[string][]Interaction{
	"market": {
		// The cocoa's scales: the pisteurs weigh the planters' bags at the market; a scale can be rigged.
		{ID: CocoaWeigh, Ages: TeensUp, Label: "Surveiller les pesées du cacao, juste ou truqué", Icon: "calculator", Minutes: 45, Effect: Needs{Fun: 20, Social: 20}, MinHour: 7, MaxHour: 17, Places: []string{DaloaMarcheID}},
		{ID: "daloa-marche-vivres", Label: "Acheter la banane, l'attiéké et le gombo", Icon: "shopping-basket", Minutes: 30, Cost: 1500, Effect: Needs{Hunger: 15, Social: 15, Fun: 10}, MinHour: 6, MaxHour: 18, Places: []string{DaloaMarcheID}},
	},
	"plantation": {
		// The cocoa belt's day: the ripe pods cut with the hook on its pole, split with the machete (the
		// écabossage), the beans in the leaves to ferment, then dried on the claies. Paid by the planter.
		{ID: CocoaDay, Ages: TeensUp, Label: "Une journée de récolte avec les planteurs", Icon: "sprout", Minutes: 5 * 60, Cost: -3500, Effect: Needs{Fun: 30, Social: 20, Energy: -35, Hygiene: -20, Hunger: -15}, MinHour: 6, MaxHour: 13, Places: []string{DaloaPlantationID}},
		{ID: "plantation-secher", Label: "Retourner les fèves qui sèchent sur les claies", Icon: "sprout", Minutes: 45, Cost: -800, Effect: Needs{Fun: 15, Social: 10, Energy: -8}, MinHour: 9, MaxHour: 16, Places: []string{DaloaPlantationID}},
		{ID: "plantation-bangui", Ages: Adults, Label: "Boire le bangui avec les planteurs", Icon: "beer", Minutes: 45, Cost: 500, Effect: Needs{Social: 30, Fun: 15, Energy: -5}, MinHour: 15, MaxHour: 20, Places: []string{DaloaPlantationID}},
	},
	"riviere": {
		// The Lobo, west of the town: the fishermen's pirogues, their nasses (the traps) set in the reeds.
		{ID: "lobo-pirogue", Label: "Descendre la Lobo en pirogue avec un pêcheur", Icon: "sailboat", Minutes: 90, Cost: 3000, Effect: Needs{Fun: 40, Energy: -10}, MinHour: 7, MaxHour: 17, Places: []string{DaloaLoboID}},
		{ID: "lobo-nasses", Ages: TeensUp, Label: "Lever les nasses avec les pêcheurs", Icon: "fish", Minutes: 60, Cost: -500, Effect: Needs{Fun: 25, Social: 15, Energy: -10, Hygiene: -10}, MinHour: 6, MaxHour: 11, Places: []string{DaloaLoboID}},
	},
	"culture": {
		// The Bété's own: the dances and the songs (the tohourou of the elders, the ziglibithy that Ernesto
		// Djédjé, a son of the country, made famous), and the funerals, where one comes to share the
		// family's grief: one greets, one gives one's share, one dances with them, never films.
		{ID: "bete-danse", Label: "Voir les danses et les chants bétés", Icon: "drama", Minutes: 90, Cost: 2000, Effect: Needs{Fun: 45, Social: 20, Energy: -5}, MinHour: 17, MaxHour: 22, Days: []int{Vendredi, Samedi, Dimanche}, Places: []string{DaloaBeteID}},
		{ID: "bete-ziglibithy", Label: "Danser le ziglibithy d'Ernesto Djédjé", Icon: "music", Minutes: 45, Cost: 1000, Effect: Needs{Fun: 40, Social: 15, Energy: -10}, MinHour: 16, MaxHour: 22, Places: []string{DaloaBeteID}},
		{ID: "bete-tohourou", Label: "Écouter le tohourou des anciens", Icon: "users", Minutes: 45, Effect: Needs{Fun: 20, Social: 20}, MinHour: 15, MaxHour: 21, Places: []string{DaloaBeteID}},
		{ID: "bete-funerailles", Ages: TeensUp, Label: "Assister à une veillée de funérailles, avec respect", Icon: "hand-heart", Minutes: 90, Cost: 2000, Effect: Needs{Social: 30, Fun: 5, Energy: -10}, MinHour: 19, MaxHour: 24, Days: []int{Samedi}, Places: []string{DaloaBeteID}},
	},
	"worship": {
		{ID: "daloa-cathedrale-visite", Label: "Visiter la cathédrale du Christ-Roi", Icon: "church", Minutes: 40, Effect: Needs{Fun: 20, Social: 10}, MinHour: 8, MaxHour: 18, Places: []string{DaloaCathedraleID}},
		{ID: "daloa-mosquee-visite", Label: "Visiter la grande mosquée, pieds nus", Icon: "landmark", Minutes: 40, Effect: Needs{Fun: 20, Social: 10}, MinHour: 9, MaxHour: 12, Days: []int{Lundi, Mardi, Mercredi, Jeudi, Samedi, Dimanche}, Places: []string{DaloaMosqueeID}},
	},
	"maquis": {
		{ID: "cabosse-sauce-graine", Label: "Manger la sauce graine et le foutou banane", Icon: "cooking-pot", Minutes: 45, Cost: 2500, Effect: Needs{Hunger: 65, Fun: 10, Social: 10}, MinHour: 11, MaxHour: 23, Places: []string{DaloaMaquisID}},
		{ID: "cabosse-planteurs", Ages: Adults, Label: "Écouter les planteurs parler du prix du cacao", Icon: "messages-square", Minutes: 45, Cost: 1000, Effect: Needs{Social: 30, Fun: 15}, MinHour: 16, MaxHour: 24, Places: []string{DaloaMaquisID}},
	},
	"rue": {
		// The rond-point du Commerce: the motos and the taxis turning, the sellers of everything at its edge.
		{ID: "rond-point-alloco", Label: "Manger l'alloco des vendeuses du rond-point", Icon: "drumstick", Minutes: 20, Cost: 500, Effect: Needs{Hunger: 35, Social: 10}, MinHour: 16, MaxHour: 23, Places: []string{DaloaRondPointID}},
	},
	"office": {
		// The exporters' warehouses: the lorries from the plantations unloaded bag by bag, a day's work paid.
		{ID: "zone-decharger", Ages: Adults, Label: "Décharger un camion de cacao au magasin", Icon: "package", Minutes: 3 * 60, Cost: -3000, Effect: Needs{Fun: 10, Social: 15, Energy: -30, Hygiene: -20}, MinHour: 7, MaxHour: 16, Days: Workweek, Places: []string{DaloaZoneID}},
	},
	"sport": {
		{ID: "stade-daloa-match", Label: "Voir un match du championnat au stade de Daloa", Icon: "trophy", Minutes: 2 * 60, Cost: 1000, Effect: Needs{Fun: 40, Social: 25, Energy: -5}, MinHour: 15, MaxHour: 18, Days: []int{Samedi, Dimanche}, Places: []string{DaloaStadeID}},
	},
	"club": {
		{ID: "zigli-nuit", Ages: Adults, Label: "Danser jusqu'au matin au Ziglibithy Club", Icon: "music", Minutes: 2 * 60, Cost: 3000, Effect: Needs{Fun: 45, Social: 30, Energy: -25}, MinHour: 22, MaxHour: 5, Places: []string{DaloaClubID}},
	},
	"hotel": {
		{ID: "antilope-piscine", Label: "Dîner au bord de la piscine", Icon: "utensils", Minutes: 90, Cost: 9000, Effect: Needs{Hunger: 60, Fun: 25, Social: 15}, MinHour: 19, MaxHour: 23, Places: []string{DaloaHotelID}},
	},
}

// The kinds of place these cities bring: the plantation (Man's coffee, Daloa's cocoa) and the river.
var villes3Kinds = map[string]PlaceKind{
	"plantation": {ID: "plantation", Label: "Plantation", Icon: "sprout",
		Events: []RandomEvent{
			{Text: "Le planteur te tend une cabosse ouverte : « Goûte la pulpe, c'est sucré ! »", Effect: Needs{Hunger: 5, Fun: 10}},
			{Text: "Une averse passe sur la plantation : tout le monde court sous l'appatam, en riant.", Effect: Needs{Social: 10, Hygiene: -5}},
		}},
	"riviere": {ID: "riviere", Label: "Rivière", Icon: "sailboat",
		Events: []RandomEvent{
			{Text: "Un martin-pêcheur file au ras de l'eau devant la pirogue.", Effect: Needs{Fun: 10}},
		}},
}

func init() {
	for id, k := range villes3Kinds {
		Kinds[id] = k
	}
	for _, acts := range []map[string][]Interaction{ManActs, DaloaActs} {
		addActs(acts)
	}
	villeActs[ManKey] = ManActs
	villeActs[DaloaKey] = DaloaActs
}
