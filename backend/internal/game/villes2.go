package game

// San-Pédro and Korhogo alive (the updates « sanpedro-vivant » and « korhogo-vivant »), the way
// Yamoussoukro and Bouaké were (villes.go): their landmarks and their life, played, each activity tied to
// its place (Interaction.Places), at the hours the real thing keeps, at prices in line with the other
// cities'. Five are games of their own (sims/defi.go): the port's crane loading the cocoa, the pirogue
// out at dawn with the fishermen, the day in the Taï forest, the loom at Waraniéné, the toile bought at
// Korhogo's market without being fooled (the story's épreuve « toile-korhogo », reused). The others are
// played like every action (web components/defi/jeux/configs/villes2.ts).

// The updates.
const (
	SanPedroKey = "sanpedro-vivant"
	KorhogoKey  = "korhogo-vivant"
)

// San-Pédro's places (world.go), and the commune of Grand-Béréby's bay.
const (
	SPPortID        = "sp-port"
	SPPecheID       = "sp-peche"
	SPBardotID      = "sp-bardot"
	SPCathedraleID  = "sp-cathedrale"
	SPMonogagaID    = "sp-monogaga"
	SPMaquisID      = "sp-maquis-merou"
	SPClubID        = "sp-club-cargo"
	SPTaiID         = "sp-tai-excursions"
	BerebyCommune   = "grand-bereby"
	BerebySirenesID = "bereby-sirenes"
	BerebyHotelID   = "bereby-campement"
	GrueCacao       = "port-grue-cacao"
	PirogueFish     = "peche-pirogue"
	TaiTrip         = "tai-excursion"
)

// Korhogo's places (world.go): the villages of the Senufo crafts round the town, the rock, the sacred wood.
const (
	KoMarcheID     = "korhogo-marche"
	KoMosqueeID    = "korhogo-mosquee"
	KoMontID       = "korhogo-mont"
	KoWaranieneID  = "korhogo-waraniene"
	KoFakahaID     = "korhogo-fakaha"
	KoKoniID       = "korhogo-koni"
	KoBoisSacreID  = "korhogo-bois-sacre"
	KoMaquisID     = "korhogo-maquis-to"
	KoClubID       = "korhogo-club-balafon"
	WeaveWaraniene = "waraniene-tisser"
	ToileMarket    = "korhogo-toile-marche"
)

// SanPedroActs: what's done at San-Pédro's places and at Grand-Béréby, by the kind they're of.
var SanPedroActs = map[string][]Interaction{
	"office": {
		// The Port autonome: the first cocoa port in the world, the jute bags stacked in the warehouses,
		// the slings swung into the ships' holds. A docker's shift at the crane pays, played well or not.
		{ID: GrueCacao, Ages: Adults, Label: "Charger le cacao à la grue (un quart de docker)", Icon: "ship", Minutes: 4 * 60, Cost: -4500, Effect: Needs{Energy: -25, Hygiene: -15, Social: 10, Fun: 15}, MinHour: 6, MaxHour: 20, Places: []string{SPPortID}},
		{ID: "port-visite", Label: "Visiter le port avec un agent du port", Icon: "landmark", Minutes: 60, Cost: 2000, Effect: Needs{Fun: 30, Social: 10, Energy: -5}, MinHour: 8, MaxHour: 17, Days: Weekdays, Places: []string{SPPortID}},
		{ID: "port-cargos", Label: "Regarder les cargos charger, au bout du quai", Icon: "binoculars", Minutes: 30, Effect: Needs{Fun: 20}, MinHour: 6, MaxHour: 19, Places: []string{SPPortID}},
	},
	"peche": {
		// The fishing port: the big painted pirogues of the Fanti and Ghanaian fishermen out at dawn, back
		// toward ten with the catch, the women who buy it on the sand and smoke it in the ovens.
		{ID: PirogueFish, Ages: TeensUp, Label: "Partir pêcher en pirogue avec les pêcheurs", Icon: "sailboat", Minutes: 3 * 60, Cost: 2000, Effect: Needs{Fun: 40, Social: 15, Energy: -25, Hygiene: -15}, MinHour: 5, MaxHour: 10, Places: []string{SPPecheID}},
		{ID: "peche-criee", Ages: TeensUp, Label: "Acheter le poisson au retour des pirogues", Icon: "fish", Minutes: 30, Cost: 1500, Effect: Needs{Hunger: 15, Social: 15, Fun: 10}, MinHour: 8, MaxHour: 13, Places: []string{SPPecheID}},
		{ID: "peche-filets", Ages: TeensUp, Label: "Aider à démêler les filets", Icon: "hand", Minutes: 90, Cost: -800, Effect: Needs{Social: 20, Energy: -10}, MinHour: 10, MaxHour: 18, Places: []string{SPPecheID}},
		{ID: "peche-fume", Label: "Manger le poisson fumé des fumeuses", Icon: "flame", Minutes: 20, Cost: 1000, Effect: Needs{Hunger: 40, Social: 5}, MinHour: 9, MaxHour: 19, Places: []string{SPPecheID}},
	},
	"rue": {
		// Le Bardot, the big popular quarter on the lagoon's edge: its maquis and its music at night.
		{ID: "bardot-ambiance", Ages: Adults, Label: "Faire l'ambiance au Bardot, de maquis en maquis", Icon: "music", Minutes: 90, Cost: 2500, Effect: Needs{Fun: 40, Social: 30, Energy: -15}, MinHour: 19, MaxHour: 3, Places: []string{SPBardotID}},
		{ID: "bardot-garba", Label: "Manger un garba au Bardot", Icon: "fish", Minutes: 20, Cost: 500, Effect: Needs{Hunger: 40, Social: 5}, MinHour: 7, MaxHour: 23, Places: []string{SPBardotID}},
	},
	"worship": {
		{ID: "sp-cathedrale-visite", Label: "Visiter la cathédrale de San-Pédro", Icon: "church", Minutes: 40, Effect: Needs{Fun: 20, Social: 10}, MinHour: 8, MaxHour: 18, Places: []string{SPCathedraleID}},
	},
	"beach": {
		// Monogaga, east of the town: the long sand under the coconut palms, the rollers, the paillotes.
		{ID: "monogaga-paillote", Label: "Déjeuner sous une paillote de Monogaga", Icon: "utensils", Minutes: 75, Cost: 5000, Effect: Needs{Hunger: 55, Fun: 20, Social: 10}, MinHour: 11, MaxHour: 17, Places: []string{SPMonogagaID}},
		{ID: "monogaga-rouleaux", Label: "Jouer dans les rouleaux de Monogaga", Icon: "waves", Minutes: 45, Effect: Needs{Fun: 35, Energy: -15, Hygiene: -10}, MinHour: 8, MaxHour: 18, Places: []string{SPMonogagaID}},
		// The Baie des Sirènes, Grand-Béréby: the cove between the rocks, the sea turtles that come to lay at night.
		{ID: "sirenes-tortues", Label: "Voir les tortues marines pondre, avec les écogardes", Icon: "eye", Minutes: 90, Cost: 3000, Effect: Needs{Fun: 45, Social: 10, Energy: -10}, MinHour: 20, MaxHour: 2, Places: []string{BerebySirenesID}},
		{ID: "sirenes-crique", Label: "Nager dans la crique entre les rochers", Icon: "waves", Minutes: 45, Effect: Needs{Fun: 35, Energy: -10, Hygiene: -5}, MinHour: 7, MaxHour: 18, Places: []string{BerebySirenesID}},
	},
	"hotel": {
		{ID: "campement-langouste", Label: "Dîner de langouste grillée, face à la baie", Icon: "utensils", Minutes: 90, Cost: 15000, Effect: Needs{Hunger: 60, Fun: 25, Social: 15}, MinHour: 19, MaxHour: 23, Places: []string{BerebyHotelID}},
	},
	"maquis": {
		{ID: "merou-capitaine", Label: "Manger un capitaine braisé avec l'attiéké", Icon: "fish", Minutes: 45, Cost: 4000, Effect: Needs{Hunger: 65, Fun: 10, Social: 10}, MinHour: 11, MaxHour: 2, Places: []string{SPMaquisID}},
		{ID: "merou-crabes", Label: "Partager crabes et crevettes grillés", Icon: "drumstick", Minutes: 60, Cost: 6000, Effect: Needs{Hunger: 55, Fun: 15, Social: 20}, MinHour: 17, MaxHour: 2, Places: []string{SPMaquisID}},
	},
	"club": {
		{ID: "cargo-nuit", Ages: Adults, Label: "Danser jusqu'au matin au Cargo Club", Icon: "music", Minutes: 2 * 60, Cost: 5000, Effect: Needs{Fun: 45, Social: 30, Energy: -25}, MinHour: 22, MaxHour: 5, Places: []string{SPClubID}},
	},
	"excursion": {
		// The Parc national de Taï (UNESCO), three hours' road to the north-west: the ecotourism of
		// Djouroutou, the chimpanzees that crack nuts with stones, the pygmy hippo of the streams.
		{ID: TaiTrip, Ages: TeensUp, Label: "Une journée au parc national de Taï (Djouroutou)", Icon: "footprints", Minutes: 11 * 60, Cost: 45000, Effect: Needs{Fun: 60, Social: 15, Energy: -40, Hygiene: -25, Hunger: -20}, MinHour: 5, MaxHour: 8, Places: []string{SPTaiID}},
		{ID: "tai-hana", Ages: TeensUp, Label: "Descendre la Hana en pirogue, à Taï", Icon: "sailboat", Minutes: 9 * 60, Cost: 35000, Effect: Needs{Fun: 50, Energy: -30, Hygiene: -20, Hunger: -15}, MinHour: 5, MaxHour: 9, Places: []string{SPTaiID}},
	},
}

// KorhogoActs: what's done at Korhogo's places and its villages.
var KorhogoActs = map[string][]Interaction{
	"artisans": {
		// Waraniéné: the narrow looms under the hangars, the long warp stretched out on the ground.
		{ID: WeaveWaraniene, Label: "Tisser une bande de pagne avec un tisserand", Icon: "shirt", Minutes: 90, Cost: 2000, Effect: Needs{Fun: 35, Social: 15, Energy: -10}, MinHour: 8, MaxHour: 18, Places: []string{KoWaranieneID}},
		{ID: "waraniene-pagne", Ages: TeensUp, Label: "Acheter un pagne tissé à la coopérative", Icon: "shopping-basket", Minutes: 30, Cost: 12000, Effect: Needs{Fun: 25, Social: 10}, MinHour: 8, MaxHour: 18, Places: []string{KoWaranieneID}},
		{ID: "waraniene-coton", Label: "Regarder les femmes filer le coton", Icon: "eye", Minutes: 30, Effect: Needs{Fun: 15, Social: 15}, MinHour: 8, MaxHour: 17, Places: []string{KoWaranieneID}},
		// Fakaha: the painters of the « toiles de Korhogo », the figures in mud dyes on the woven cotton.
		{ID: "fakaha-peindre", Label: "Peindre une toile avec les peintres de Fakaha", Icon: "palette", Minutes: 90, Cost: 3000, Effect: Needs{Fun: 35, Social: 10, Energy: -5}, MinHour: 8, MaxHour: 17, Places: []string{KoFakahaID}},
		{ID: "fakaha-toile", Ages: TeensUp, Label: "Acheter une toile peinte au village", Icon: "palette", Minutes: 30, Cost: 10000, Effect: Needs{Fun: 25, Social: 5}, MinHour: 8, MaxHour: 18, Places: []string{KoFakahaID}},
		// Koni: the smiths at the forge, the clay furnaces, the bellows, the hammers on the anvil.
		{ID: "koni-forge", Ages: TeensUp, Label: "Battre le fer avec les forgerons de Koni", Icon: "hammer", Minutes: 60, Cost: 1000, Effect: Needs{Fun: 30, Social: 10, Energy: -15, Hygiene: -10}, MinHour: 7, MaxHour: 17, Places: []string{KoKoniID}},
		{ID: "koni-daba", Ages: TeensUp, Label: "Acheter une daba forgée au village", Icon: "hammer", Minutes: 20, Cost: 4000, Effect: Needs{Fun: 15, Social: 10}, MinHour: 7, MaxHour: 18, Places: []string{KoKoniID}},
	},
	"sacre": {
		// The sacred wood of the Poro: one stays at its edge, by the path the quarter's guide shows; what's
		// inside belongs to the initiated, and nothing of it is shown or told.
		{ID: "poro-oree", Label: "Visiter l'orée du bois sacré, avec un guide du quartier", Icon: "trees", Minutes: 45, Cost: 2000, Effect: Needs{Fun: 20, Social: 10}, MinHour: 8, MaxHour: 17, Places: []string{KoBoisSacreID}},
		{ID: "poro-fromagers", Label: "Regarder les grands fromagers, de l'extérieur", Icon: "camera", Minutes: 20, Effect: Needs{Fun: 15}, MinHour: 7, MaxHour: 18, Places: []string{KoBoisSacreID}},
	},
	"nature": {
		// Mont Korhogo: the granite rock over the west of the town, the mango and cashew country all round.
		{ID: "mont-korhogo-monter", Label: "Monter sur le rocher du mont Korhogo", Icon: "mountain", Minutes: 60, Effect: Needs{Fun: 35, Energy: -15, Hygiene: -5}, MinHour: 6, MaxHour: 18, Places: []string{KoMontID}},
		{ID: "mont-mangues", Label: "Cueillir des mangues au pied du mont", Icon: "apple", Minutes: 30, Effect: Needs{Hunger: 20, Fun: 15}, MinHour: 7, MaxHour: 18, Places: []string{KoMontID}},
		{ID: "mont-coucher", Label: "Regarder le soleil se coucher sur la ville", Icon: "sunset", Minutes: 30, Effect: Needs{Fun: 25, Energy: 5}, MinHour: 17, MaxHour: 20, Places: []string{KoMontID}},
	},
	"market": {
		{ID: ToileMarket, Ages: TeensUp, Label: "Acheter une toile de Korhogo, sans se faire avoir", Icon: "palette", Minutes: 30, Cost: 8000, Effect: Needs{Fun: 25, Social: 10}, MinHour: 7, MaxHour: 18, Places: []string{KoMarcheID}},
		{ID: "korhogo-cajou", Label: "Acheter des noix de cajou et des mangues", Icon: "shopping-basket", Minutes: 20, Cost: 1500, Effect: Needs{Hunger: 20, Social: 10}, MinHour: 6, MaxHour: 18, Places: []string{KoMarcheID}},
	},
	"worship": {
		{ID: "korhogo-mosquee-visite", Label: "Visiter la grande mosquée, pieds nus", Icon: "landmark", Minutes: 40, Effect: Needs{Fun: 20, Social: 10}, MinHour: 9, MaxHour: 12, Days: []int{Lundi, Mardi, Mercredi, Jeudi, Samedi, Dimanche}, Places: []string{KoMosqueeID}},
	},
	"maquis": {
		// The tô, the north's own: the millet or maize paste with its sauce (gombo, feuilles), and the tchapalo.
		{ID: "to-gombo", Label: "Manger le tô sauce gombo", Icon: "cooking-pot", Minutes: 30, Cost: 1000, Effect: Needs{Hunger: 60, Social: 5}, MinHour: 10, MaxHour: 23, Places: []string{KoMaquisID}},
		{ID: "to-tchapalo", Ages: Adults, Label: "Boire le tchapalo entre amis", Icon: "beer", Minutes: 45, Cost: 500, Effect: Needs{Social: 30, Fun: 20, Energy: -5}, MinHour: 15, MaxHour: 1, Places: []string{KoMaquisID}},
		{ID: "to-balafon", Label: "Écouter le balafon en mangeant", Icon: "music", Minutes: 60, Cost: 1500, Effect: Needs{Fun: 30, Social: 15, Hunger: 20}, MinHour: 19, MaxHour: 24, Places: []string{KoMaquisID}},
	},
	"club": {
		{ID: "balafon-nuit", Ages: Adults, Label: "Danser sur le balafon au Balafon Club", Icon: "music", Minutes: 90, Cost: 3000, Effect: Needs{Fun: 45, Social: 30, Energy: -20}, MinHour: 21, MaxHour: 4, Places: []string{KoClubID}},
	},
}

// The kinds of place these cities bring: the fishermen's port, the craft villages, the sacred wood, the
// excursion agency. Every one of their activities is tied to its place (the kinds hold nothing else).
var villes2Kinds = map[string]PlaceKind{
	"peche": {ID: "peche", Label: "Port de pêche", Icon: "sailboat",
		Events: []RandomEvent{
			{Text: "Une pirogue rentre chargée de sardinelles : tout le quai court l'aider à la tirer sur le sable.", Effect: Needs{Social: 10, Fun: 10}},
			{Text: "Une fumeuse te glisse un petit poisson fumé « pour goûter ».", Effect: Needs{Hunger: 10, Social: 5}},
		}},
	"artisans": {ID: "artisans", Label: "Village d'artisans", Icon: "palette",
		Events: []RandomEvent{
			{Text: "Le vieux du village te montre comment son père faisait, et tout le monde rit de tes mains maladroites.", Effect: Needs{Social: 10, Fun: 10}},
			{Text: "Des enfants t'apportent une mangue bien mûre.", Effect: Needs{Hunger: 10, Social: 5}},
		}},
	"sacre":     {ID: "sacre", Label: "Bois sacré", Icon: "trees"},
	"excursion": {ID: "excursion", Label: "Agence d'excursions", Icon: "binoculars"},
}

func init() {
	for id, k := range villes2Kinds {
		Kinds[id] = k
	}
	for _, acts := range []map[string][]Interaction{SanPedroActs, KorhogoActs} {
		addActs(acts)
	}
}
