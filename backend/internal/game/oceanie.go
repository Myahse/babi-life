package game

// L'Océanie (world/oceanie.go): the update that opens it, its airports (Air Lagune flies to each, priced on the
// distance: flights.go), the gares routières of Australia's and New Zealand's cities and their coach companies
// (invented names), and what's done there, each tied to its place, behind the update (features.go). The south's
// seasons: Christmas comes in summer (OceanieHappenings).

// OceanieKey: the closed update « pays-oceanie ».
const OceanieKey = "pays-oceanie"

// The coach companies of Oceania (invented names): Australia's, New Zealand's.
var ocCoaches = []CoachCompany{
	{ID: "croixdusud", Name: "Croix du Sud Coaches", Body: "#fff4e6", Stripe: "#d9480f"},
	{ID: "longnuage", Name: "Long Nuage Blanc Express", Body: "#f8f9fa", Stripe: "#2b8a3e"},
}

// ocCoach: who runs the coaches of a city of the region (coaches.go CoachCompanyOf, by RegionCoach).
func ocCoach(city string) CoachCompany {
	if city == "auckland" || city == "wellington" {
		return ocCoaches[1]
	}
	return ocCoaches[0]
}

func init() {
	for id, a := range map[string]Airport{
		"sydney": {"sydney", "syd-mascot", "syd-aeroport", OceanieKey},
		"melbourne": {"melbourne", "melbourne-centre", "melbourne-aeroport", OceanieKey},
		"brisbane": {"brisbane", "brisbane-centre", "brisbane-aeroport", OceanieKey},
		"perth": {"perth", "perth-centre", "perth-aeroport", OceanieKey},
		"canberra": {"canberra", "canberra-centre", "canberra-aeroport", OceanieKey},
		"auckland": {"auckland", "auckland-centre", "auckland-aeroport", OceanieKey},
		"wellington": {"wellington", "wellington-centre", "wellington-aeroport", OceanieKey},
		"suva": {"suva", "suva-centre", "suva-aeroport", OceanieKey},
		"port-moresby": {"port-moresby", "port-moresby-centre", "port-moresby-aeroport", OceanieKey},
		"noumea": {"noumea", "noumea-centre", "noumea-aeroport", OceanieKey},
		"papeete": {"papeete", "papeete-centre", "papeete-aeroport", OceanieKey},
		"apia": {"apia", "apia-centre", "apia-aeroport", OceanieKey},
		"nukualofa": {"nukualofa", "nukualofa-centre", "nukualofa-aeroport", OceanieKey},
		"port-vila": {"port-vila", "port-vila-centre", "port-vila-aeroport", OceanieKey},
	} {
		Airports[id] = a
	}
	for id, g := range map[string]Gare{
		"sydney": {"sydney", "syd-centre", "syd-centre-gare"},
		"melbourne": {"melbourne", "melbourne-centre", "melbourne-gare"},
		"brisbane": {"brisbane", "brisbane-centre", "brisbane-gare"},
		"perth": {"perth", "perth-centre", "perth-gare"},
		"canberra": {"canberra", "canberra-centre", "canberra-gare"},
		"auckland": {"auckland", "auckland-centre", "auckland-gare"},
		"wellington": {"wellington", "wellington-centre", "wellington-gare"},
	} {
		Gares[id] = g
		RegionCoach[id] = ocCoach(id)
	}
	CoachCompanies = append(CoachCompanies, ocCoaches...)
	addActs(OceanieActs)
	villeActs[OceanieKey] = OceanieActs
}

// OceanieActs: the cities' own, by kind, each tied to its place.
var OceanieActs = map[string][]Interaction{
	"culture": {
		{ID: "oc-opera-syd", Label: "Voir un spectacle à l'Opéra de Sydney", Icon: "music", Minutes: 150, Cost: 45000, Effect: Needs{Social: 15, Fun: 50}, MinHour: 19, MaxHour: 23, Places: []string{"syd-opera"}},
		{ID: "oc-parlement-cbr", Label: "Visiter le Parlement d'Australie", Icon: "landmark", Minutes: 75, Effect: Needs{Social: 5, Fun: 30, Energy: -5}, MinHour: 9, MaxHour: 17, Places: []string{"canberra-parlement"}},
		{ID: "oc-art-aborigene", Label: "Découvrir l'art aborigène à la Galerie nationale", Icon: "palette", Minutes: 75, Effect: Needs{Social: 5, Fun: 35, Energy: -5}, MinHour: 10, MaxHour: 17, Places: []string{"canberra-galerie"}},
		{ID: "oc-sky-jump", Label: "Sauter de la Sky Tower au bout d'un câble", Icon: "mountain", Minutes: 45, Cost: 150000, Effect: Needs{Social: 10, Fun: 65, Energy: -15}, MinHour: 10, MaxHour: 18, Places: []string{"auckland-sky-tower"}},
		{ID: "oc-taonga", Label: "Voir les trésors maoris et le haka au musée d'Auckland", Icon: "landmark", Minutes: 90, Cost: 15000, Effect: Needs{Social: 10, Fun: 40, Energy: -5}, MinHour: 10, MaxHour: 17, Places: []string{"auckland-musee"}},
		{ID: "oc-te-papa", Label: "Visiter le musée Te Papa", Icon: "landmark", Minutes: 90, Effect: Needs{Social: 5, Fun: 40, Energy: -5}, MinHour: 10, MaxHour: 18, Places: []string{"wellington-te-papa"}},
		{ID: "oc-beehive", Label: "Se prendre en photo devant la Ruche", Icon: "camera", Minutes: 15, Effect: Needs{Social: 5, Fun: 20}, MinHour: 7, MaxHour: 21, Places: []string{"wellington-beehive"}},
		{ID: "oc-fiji-museum", Label: "Voir les grandes pirogues au musée des Fidji", Icon: "sailboat", Minutes: 60, Cost: 3000, Effect: Needs{Social: 5, Fun: 30, Energy: -5}, MinHour: 9, MaxHour: 16, Places: []string{"suva-musee"}},
		{ID: "oc-parlement-pom", Label: "Visiter le Parlement en forme de haus tambaran", Icon: "landmark", Minutes: 60, Effect: Needs{Social: 5, Fun: 30, Energy: -5}, MinHour: 9, MaxHour: 15, Days: Workweek, Places: []string{"port-moresby-parlement"}},
		{ID: "oc-tjibaou", Label: "Visiter le centre culturel Tjibaou", Icon: "landmark", Minutes: 90, Cost: 6000, Effect: Needs{Social: 10, Fun: 40, Energy: -5}, MinHour: 9, MaxHour: 17, Places: []string{"noumea-tjibaou"}},
		{ID: "oc-stevenson", Label: "Visiter la maison de Robert Louis Stevenson à Vailima", Icon: "book-open", Minutes: 60, Cost: 3000, Effect: Needs{Social: 5, Fun: 30, Energy: -5}, MinHour: 9, MaxHour: 16, Places: []string{"apia-vailima"}},
	},
	"rue": {
		{ID: "oc-bridge-climb", Label: "Escalader l'arche du Harbour Bridge", Icon: "mountain", Minutes: 180, Cost: 120000, Effect: Needs{Social: 15, Fun: 60, Energy: -25}, MinHour: 7, MaxHour: 21, Places: []string{"syd-harbour-bridge"}},
		{ID: "oc-fed-square", Label: "Prendre le tram gratuit et finir à Federation Square", Icon: "train-front", Minutes: 45, Effect: Needs{Social: 15, Fun: 25}, MinHour: 6, MaxHour: 24, Places: []string{"melbourne-federation"}},
		{ID: "oc-hosier", Label: "Photographier les fresques de Hosier Lane", Icon: "camera", Minutes: 20, Effect: Needs{Social: 5, Fun: 25}, MinHour: 7, MaxHour: 22, Places: []string{"melbourne-hosier"}},
		{ID: "oc-story-bridge", Label: "Escalader le Story Bridge", Icon: "mountain", Minutes: 120, Cost: 70000, Effect: Needs{Social: 10, Fun: 50, Energy: -20}, MinHour: 8, MaxHour: 20, Places: []string{"brisbane-story-bridge"}},
		{ID: "oc-roulottes", Label: "Dîner aux roulottes de la place Vaiete", Icon: "utensils", Minutes: 60, Cost: 9000, Effect: Needs{Hunger: 65, Social: 25, Fun: 15}, MinHour: 18, MaxHour: 23, Places: []string{"papeete-vaiete"}},
	},
	"transport": {
		{ID: "oc-ferry-manly", Label: "Prendre le ferry de Manly depuis Circular Quay", Icon: "sailboat", Minutes: 60, Cost: 5000, Effect: Needs{Social: 10, Fun: 35}, MinHour: 6, MaxHour: 23, Places: []string{"syd-circular-quay"}},
		{ID: "oc-cable-car", Label: "Monter en funiculaire au-dessus du port", Icon: "train-front", Minutes: 20, Cost: 3000, Effect: Needs{Social: 5, Fun: 25}, MinHour: 7, MaxHour: 22, Places: []string{"wellington-funiculaire"}},
	},
	"market": {
		{ID: "oc-rocks-market", Label: "Flâner au marché des Rocks", Icon: "shopping-bag", Minutes: 45, Effect: Needs{Social: 15, Fun: 25}, MinHour: 10, MaxHour: 17, Days: Weekend, Places: []string{"syd-rocks"}},
		{ID: "oc-queen-vic", Label: "Faire le marché Queen Victoria", Icon: "shopping-basket", Minutes: 45, Cost: 5000, Effect: Needs{Hunger: 10, Social: 20, Fun: 20}, MinHour: 6, MaxHour: 15, Places: []string{"melbourne-queen-victoria"}},
		{ID: "oc-suva-marche", Label: "Faire le marché municipal de Suva", Icon: "shopping-basket", Minutes: 45, Cost: 2000, Effect: Needs{Hunger: 10, Social: 25, Fun: 20}, MinHour: 6, MaxHour: 18, Places: []string{"suva-marche"}},
		{ID: "oc-bilum", Label: "Choisir un bilum tissé au marché", Icon: "shopping-bag", Minutes: 30, Cost: 8000, Effect: Needs{Social: 20, Fun: 20}, MinHour: 8, MaxHour: 17, Places: []string{"port-moresby-bilum"}},
		{ID: "oc-marche-noumea", Label: "Faire le marché du port de Nouméa", Icon: "shopping-basket", Minutes: 40, Cost: 3000, Effect: Needs{Hunger: 10, Social: 20, Fun: 20}, MinHour: 5, MaxHour: 12, Places: []string{"noumea-marche"}},
		{ID: "oc-papeete-marche", Label: "Se faire une couronne de fleurs de tiare au marché", Icon: "flower", Minutes: 30, Cost: 3000, Effect: Needs{Social: 20, Fun: 25}, MinHour: 6, MaxHour: 17, Places: []string{"papeete-marche"}},
		{ID: "oc-fugalei", Label: "Faire le marché de Fugalei", Icon: "shopping-basket", Minutes: 40, Cost: 1500, Effect: Needs{Hunger: 10, Social: 20, Fun: 20}, MinHour: 5, MaxHour: 18, Places: []string{"apia-marche"}},
		{ID: "oc-talamahu", Label: "Acheter du tapa au marché de Talamahu", Icon: "shopping-basket", Minutes: 40, Cost: 5000, Effect: Needs{Social: 20, Fun: 20}, MinHour: 7, MaxHour: 17, Days: Workweek, Places: []string{"nukualofa-talamahu"}},
	},
	"nature": {
		{ID: "oc-jardin-syd", Label: "Pique-niquer au Jardin botanique face à l'Opéra", Icon: "trees", Minutes: 60, Effect: Needs{Social: 20, Fun: 25, Energy: 5}, MinHour: 7, MaxHour: 20, Places: []string{"syd-jardin"}},
		{ID: "oc-bondi-coogee", Label: "Marcher sur les falaises de Bondi à Coogee", Icon: "footprints", Minutes: 90, Effect: Needs{Social: 10, Fun: 35, Energy: -20}, MinHour: 6, MaxHour: 19, Places: []string{"syd-bondi-sentier"}},
		{ID: "oc-kings-park", Label: "Regarder Perth depuis Kings Park", Icon: "trees", Minutes: 60, Effect: Needs{Social: 10, Fun: 30, Energy: -5}, MinHour: 6, MaxHour: 21, Places: []string{"perth-kings-park"}},
		{ID: "oc-mont-eden", Label: "Monter au cratère du mont Eden", Icon: "mountain", Minutes: 60, Effect: Needs{Social: 10, Fun: 30, Energy: -15}, MinHour: 6, MaxHour: 20, Places: []string{"auckland-eden"}},
		{ID: "oc-mele", Label: "Se baigner dans les cascades de Mele", Icon: "waves", Minutes: 120, Cost: 6000, Effect: Needs{Social: 10, Fun: 45, Energy: -20, Hygiene: 5}, MinHour: 8, MaxHour: 17, Places: []string{"port-vila-mele"}},
	},
	"beach": {
		{ID: "oc-bondi-surf", Label: "Prendre une leçon de surf à Bondi", Icon: "waves", Minutes: 120, Cost: 45000, Effect: Needs{Social: 15, Fun: 50, Energy: -30, Hygiene: -5}, MinHour: 7, MaxHour: 18, Places: []string{"syd-bondi-surf"}},
		{ID: "oc-bondi", Label: "Se baigner entre les drapeaux à Bondi", Icon: "waves", Minutes: 90, Effect: Needs{Social: 10, Fun: 40, Energy: -15, Hygiene: -5}, MinHour: 6, MaxHour: 19, Places: []string{"syd-bondi-plage"}},
		{ID: "oc-icebergs", Label: "Nager à la piscine des Icebergs", Icon: "waves", Minutes: 60, Cost: 5000, Effect: Needs{Social: 10, Fun: 35, Energy: -10, Hygiene: 10}, MinHour: 6, MaxHour: 18, Places: []string{"syd-bondi-icebergs"}},
		{ID: "oc-south-bank", Label: "Se baigner à la plage de South Bank", Icon: "waves", Minutes: 60, Effect: Needs{Social: 15, Fun: 35, Energy: -10, Hygiene: -5}, MinHour: 6, MaxHour: 21, Places: []string{"brisbane-south-bank"}},
		{ID: "oc-cottesloe", Label: "Regarder le soleil se coucher sur l'océan Indien à Cottesloe", Icon: "sunset", Minutes: 60, Effect: Needs{Social: 15, Fun: 35, Energy: 5}, MinHour: 16, MaxHour: 21, Places: []string{"perth-cottesloe"}},
		{ID: "oc-anse-vata", Label: "Se baigner à l'Anse Vata", Icon: "waves", Minutes: 90, Effect: Needs{Social: 10, Fun: 40, Energy: -15, Hygiene: -5}, MinHour: 6, MaxHour: 19, Places: []string{"noumea-anse-vata"}},
		{ID: "oc-pointe-venus", Label: "Se baigner sur le sable noir de la Pointe Vénus", Icon: "waves", Minutes: 90, Effect: Needs{Social: 10, Fun: 40, Energy: -15, Hygiene: -5}, MinHour: 7, MaxHour: 18, Places: []string{"papeete-plage"}},
	},
	"restaurant": {
		{ID: "oc-meat-pie", Label: "Manger une meat pie", Icon: "sandwich", Minutes: 15, Cost: 4000, Effect: Needs{Hunger: 45, Social: 5, Fun: 5}, MinHour: 7, MaxHour: 23, Places: []string{"syd-centre-pie", "auckland-pie"}},
		{ID: "oc-flat-white", Label: "Boire un flat white et manger un avocado toast", Icon: "coffee", Minutes: 30, Cost: 9000, Effect: Needs{Hunger: 25, Social: 15, Fun: 10}, MinHour: 7, MaxHour: 15, Places: []string{"syd-centre-cafe", "melbourne-cafe", "wellington-cafe", "brisbane-cafe", "canberra-cafe"}},
		{ID: "oc-barbie", Label: "Griller des saucisses au barbecue du parc", Icon: "flame", Minutes: 60, Cost: 6000, Effect: Needs{Hunger: 55, Social: 25, Fun: 15}, MinHour: 11, MaxHour: 21, Places: []string{"syd-centre-barbie", "brisbane-barbie"}},
		{ID: "oc-fish-chips-oc", Label: "Manger un fish and chips face à la mer", Icon: "fish", Minutes: 30, Cost: 8000, Effect: Needs{Hunger: 55, Social: 10, Fun: 10}, MinHour: 11, MaxHour: 21, Places: []string{"syd-bondi-fish", "perth-fish"}},
		{ID: "oc-souvlaki-mel", Label: "Manger un souvlaki de Melbourne", Icon: "sandwich", Minutes: 15, Cost: 5000, Effect: Needs{Hunger: 50, Social: 5, Fun: 5}, MinHour: 11, MaxHour: 24, Places: []string{"melbourne-souvlaki"}},
		{ID: "oc-hangi", Label: "Manger un hāngī cuit dans la terre", Icon: "flame", Minutes: 60, Cost: 8000, Effect: Needs{Hunger: 70, Social: 25, Fun: 15}, MinHour: 11, MaxHour: 20, Places: []string{"auckland-hangi"}},
		{ID: "oc-kava", Label: "Partager le kava en cercle « bula ! »", Icon: "cup-soda", Minutes: 60, Cost: 1500, Effect: Needs{Social: 40, Fun: 20, Energy: 10}, MinHour: 16, MaxHour: 24, Places: []string{"suva-kava"}},
		{ID: "oc-lovo", Label: "Manger un lovo cuit dans le four de terre", Icon: "flame", Minutes: 60, Cost: 6000, Effect: Needs{Hunger: 70, Social: 25, Fun: 15}, MinHour: 11, MaxHour: 20, Places: []string{"suva-lovo"}},
		{ID: "oc-mumu", Label: "Manger un mumu de porc et de patate douce", Icon: "flame", Minutes: 60, Cost: 5000, Effect: Needs{Hunger: 70, Social: 20, Fun: 15}, MinHour: 11, MaxHour: 20, Places: []string{"port-moresby-mumu"}},
		{ID: "oc-bougna", Label: "Manger un bougna cuit dans les feuilles de bananier", Icon: "flame", Minutes: 60, Cost: 8000, Effect: Needs{Hunger: 70, Social: 25, Fun: 15}, MinHour: 11, MaxHour: 21, Places: []string{"noumea-bougna"}},
		{ID: "oc-poisson-cru", Label: "Manger un poisson cru au lait de coco", Icon: "fish", Minutes: 30, Cost: 7000, Effect: Needs{Hunger: 55, Social: 10, Fun: 10}, MinHour: 11, MaxHour: 22, Places: []string{"papeete-poisson-cru"}},
		{ID: "oc-oka", Label: "Manger un oka et un palusami", Icon: "fish", Minutes: 40, Cost: 4000, Effect: Needs{Hunger: 60, Social: 15, Fun: 10}, MinHour: 11, MaxHour: 21, Places: []string{"apia-oka"}},
		{ID: "oc-lu-pulu", Label: "Manger un lu pulu dans les feuilles de taro", Icon: "flame", Minutes: 45, Cost: 5000, Effect: Needs{Hunger: 65, Social: 20, Fun: 10}, MinHour: 11, MaxHour: 21, Places: []string{"nukualofa-lu"}},
		{ID: "oc-lap-lap", Label: "Manger un lap-lap au marché de Port-Vila", Icon: "utensils", Minutes: 30, Cost: 2500, Effect: Needs{Hunger: 60, Social: 15, Fun: 10}, MinHour: 6, MaxHour: 22, Places: []string{"port-vila-lap-lap", "port-vila-marche"}},
	},
	"club": {
		{ID: "oc-kings-cross", Ages: Adults, Label: "Sortir à Kings Cross", Icon: "music", Minutes: 120, Cost: 20000, Effect: Needs{Social: 30, Fun: 45, Energy: -25}, MinHour: 22, MaxHour: 4, Places: []string{"syd-centre-club", "melbourne-club", "auckland-club"}},
	},
	"boutique": {
		{ID: "oc-afro-syd", Label: "Trouver du gari et du plantain à l'épicerie africaine", Icon: "shopping-basket", Minutes: 20, Cost: 6000, Effect: Needs{Social: 10, Fun: 10}, MinHour: 9, MaxHour: 20, Places: []string{"syd-centre-afro"}},
		{ID: "oc-monoi", Label: "Acheter du monoï et un paréo", Icon: "gift", Minutes: 20, Cost: 6000, Effect: Needs{Social: 5, Fun: 20}, MinHour: 8, MaxHour: 18, Places: []string{"papeete-monoi"}},
	},
	"sport": {
		{ID: "oc-mcg-footy", Label: "Voir un match de football australien au MCG", Icon: "trophy", Minutes: 180, Cost: 25000, Effect: Needs{Social: 35, Fun: 55, Energy: -10}, MinHour: 13, MaxHour: 22, Places: []string{"melbourne-mcg"}},
	},
	"zoo": {
		{ID: "oc-koala", Label: "Tenir un koala et nourrir les kangourous", Icon: "paw-print", Minutes: 120, Cost: 25000, Effect: Needs{Social: 15, Fun: 50, Energy: -10}, MinHour: 9, MaxHour: 17, Places: []string{"brisbane-lone-pine"}},
	},
	"worship": {
		{ID: "oc-chants-tonga", Label: "Écouter les chœurs du dimanche à l'église Centenaire", Icon: "music", Minutes: 90, Effect: Needs{Social: 30, Fun: 35, Energy: 5}, MinHour: 9, MaxHour: 13, Days: Weekend, Places: []string{"nukualofa-eglise"}},
	},
}
