package game

import (
	"hash/fnv"
	"slices"
	"strconv"
	"strings"
)

// La cuisine ivoirienne (the update « cuisine-ivoire »): the dishes of the country where they're eaten
// (the maquis' foutou and kédjénou in the evening, the boutiquier's pain-omelette and the café Touba in
// the morning, the braiseuse's maïs at nightfall, the tantie's placali at the market), each place's
// « carte » with its prices and its dish of the day, the regions' own (Bouaké's, Korhogo's, Man's,
// Daloa's, Yamoussoukro's, Bassam's), the street's new sellers (sims/street.go), and cooking at home:
// the ingredients bought at the market into the fridge, a recipe cooked and played, shared with the
// house. Prices are Abidjan's (FCFA = Djai), in line with the garba's 500 and the poulet braisé's 3 500.

// CuisineKey: the update.
const CuisineKey = "cuisine-ivoire"

// DishPrefix: the eating out's activities; RecipePrefix: the cooking at home's.
const (
	DishPrefix   = "plat-"
	RecipePrefix = "recette-"
)

// The carte's sections, in its order.
const (
	SecPetitDej  = "petit-dej"
	SecPlats     = "plats"
	SecGrillades = "grillades"
	SecSoupes    = "soupes"
	SecSnacks    = "snacks"
	SecFruits    = "fruits"
	SecBoissons  = "boissons"
	SecAlcools   = "alcools"
)

// CarteSections: the sections' order and names.
var CarteSections = []struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}{
	{SecPetitDej, "Petit-déjeuner"}, {SecPlats, "Plats"}, {SecGrillades, "Grillades"}, {SecSoupes, "Soupes"},
	{SecSnacks, "Au coin de la rue"}, {SecFruits, "Fruits"}, {SecBoissons, "Boissons"}, {SecAlcools, "Pour les grands"},
}

// A Dish is one thing on the cartes: where it's served, when, at what price, and what it does.
type Dish struct {
	// ID: its activity's (DishPrefix + its name).
	ID string `json:"id"`
	// Name: as written on the carte; Label: the activity.
	Name    string   `json:"name"`
	Label   string   `json:"label"`
	Icon    string   `json:"icon"`
	Section string   `json:"section"`
	Price   int      `json:"price"`
	Minutes int64    `json:"minutes"`
	Effect  Needs    `json:"effect"`
	MinHour int      `json:"minHour,omitempty"`
	MaxHour int      `json:"maxHour,omitempty"`
	Days    []int    `json:"days,omitempty"`
	Ages    []string `json:"ages,omitempty"`
	// Kinds: the kinds of place that serve it.
	Kinds []string `json:"kinds"`
	// Cities: a region's own, only there; Region: its name on the carte.
	Cities []string `json:"cities,omitempty"`
	Region string   `json:"region,omitempty"`
	// Rare: not every place has it (Serves): the agouti, the escargots, the pepper soup…
	Rare bool `json:"rare,omitempty"`
	// Golvo: Garbaya (the delivery app) brings it too.
	Golvo bool `json:"golvo,omitempty"`
	// Alcohol: palm wine and koutoukou (web game/myCar.ts: no wheel after; by its icon, « wine »).
	Alcohol bool `json:"alcohol,omitempty"`
	// Plate: what's on the plate in the 3D (web world3d/interior/ActionProps.tsx dishFor).
	Plate string `json:"plate"`
}

// Hours.
const (
	morningFrom, morningTo = 5, 11
	lunchFrom              = 11
	lateTo                 = 2
)

var (
	maquis     = []string{"maquis"}
	maquisRest = []string{"maquis", "restaurant"}
	maquisRue  = []string{"maquis", "rue"}
	street     = []string{"market", "transport", "rue", "beach"}
	morning    = []string{"boutique", "market", "transport"}
	tantie     = []string{"market", "office", "village"}
	drinks     = []string{"maquis", "restaurant", "market", "transport", "rue", "beach"}
	fruits     = []string{"market", "transport", "beach", "rue"}
)

// Dishes: everything the cartes serve.
var Dishes = []Dish{
	// Breakfast: the boutiquier's bread and omelette, the café Touba, the bouillie, the beignets.
	{ID: DishPrefix + "pain-omelette", Name: "Pain-beurre-omelette", Label: "Manger un pain-beurre-omelette chez le boutiquier", Icon: "egg", Section: SecPetitDej, Price: 500, Minutes: 15, Effect: Needs{Hunger: 35, Energy: 4}, MinHour: morningFrom, MaxHour: morningTo, Kinds: []string{"boutique", "transport"}, Plate: "omelette"},
	{ID: DishPrefix + "cafe-touba", Name: "Café Touba", Label: "Boire un café Touba bien poivré", Icon: "coffee", Section: SecPetitDej, Price: 100, Minutes: 10, Effect: Needs{Energy: 15, Hunger: 2}, MinHour: morningFrom, MaxHour: 13, Kinds: morning, Ages: TeensUp, Plate: "cafe"},
	{ID: DishPrefix + "bouillie-mil", Name: "Bouillie de mil (koko)", Label: "Boire une bouillie de mil", Icon: "soup", Section: SecPetitDej, Price: 200, Minutes: 15, Effect: Needs{Hunger: 22, Energy: 5}, MinHour: morningFrom, MaxHour: 10, Kinds: morning, Plate: "bouillie"},
	{ID: DishPrefix + "beignets", Name: "Beignets (puff-puff)", Label: "Manger des beignets tout chauds", Icon: "cookie", Section: SecPetitDej, Price: 200, Minutes: 10, Effect: Needs{Hunger: 18, Fun: 4}, MinHour: 6, MaxHour: 11, Kinds: []string{"market", "transport", "beach"}, Plate: "beignets"},
	{ID: DishPrefix + "galettes", Name: "Galettes de maïs", Label: "Manger des galettes de maïs", Icon: "cookie", Section: SecPetitDej, Price: 150, Minutes: 10, Effect: Needs{Hunger: 15, Fun: 3}, MinHour: 6, MaxHour: 12, Kinds: []string{"market", "transport"}, Plate: "beignets"},
	// The plates of the maquis and the restaurants, from noon to late.
	{ID: DishPrefix + "foutou-banane-graine", Name: "Foutou banane, sauce graine", Label: "Manger un foutou banane sauce graine", Icon: "soup", Section: SecPlats, Price: 2000, Minutes: 35, Effect: Needs{Hunger: 62, Fun: 8}, MinHour: lunchFrom, MaxHour: 23, Kinds: maquisRest, Golvo: true, Plate: "foutou"},
	{ID: DishPrefix + "foutou-igname-graine", Name: "Foutou igname, sauce graine", Label: "Manger un foutou igname sauce graine", Icon: "soup", Section: SecPlats, Price: 2500, Minutes: 35, Effect: Needs{Hunger: 66, Fun: 8}, MinHour: lunchFrom, MaxHour: 23, Kinds: maquis, Golvo: true, Plate: "foutou"},
	{ID: DishPrefix + "foutou-arachide", Name: "Foutou banane, sauce arachide", Label: "Manger un foutou sauce arachide", Icon: "soup", Section: SecPlats, Price: 2000, Minutes: 35, Effect: Needs{Hunger: 62, Fun: 7}, MinHour: lunchFrom, MaxHour: 23, Kinds: maquis, Plate: "foutou"},
	{ID: DishPrefix + "foufou-claire", Name: "Foufou, sauce claire au poisson fumé", Label: "Manger un foufou sauce claire", Icon: "soup", Section: SecPlats, Price: 2000, Minutes: 30, Effect: Needs{Hunger: 58, Fun: 6}, MinHour: lunchFrom, MaxHour: 23, Kinds: maquis, Rare: true, Plate: "foutou"},
	{ID: DishPrefix + "riz-gombo", Name: "Riz, sauce gombo", Label: "Manger un riz sauce gombo", Icon: "soup", Section: SecPlats, Price: 1500, Minutes: 25, Effect: Needs{Hunger: 55, Fun: 4}, MinHour: lunchFrom, MaxHour: 23, Kinds: []string{"maquis", "market", "office"}, Plate: "riz"},
	{ID: DishPrefix + "riz-arachide", Name: "Riz, sauce arachide au poulet", Label: "Manger un riz sauce arachide", Icon: "soup", Section: SecPlats, Price: 2500, Minutes: 30, Effect: Needs{Hunger: 62, Fun: 6}, MinHour: lunchFrom, MaxHour: 23, Kinds: maquisRest, Golvo: true, Plate: "riz"},
	{ID: DishPrefix + "riz-gras", Name: "Riz gras (tchêp) au poulet", Label: "Manger un riz gras au poulet", Icon: "drumstick", Section: SecPlats, Price: 2500, Minutes: 30, Effect: Needs{Hunger: 62, Fun: 8}, MinHour: lunchFrom, MaxHour: 23, Kinds: []string{"maquis", "restaurant", "office"}, Golvo: true, Plate: "riz"},
	{ID: DishPrefix + "kedjenou", Name: "Kédjénou de poulet, attiéké", Label: "Manger un kédjénou de poulet", Icon: "cooking-pot", Section: SecPlats, Price: 3500, Minutes: 40, Effect: Needs{Hunger: 66, Fun: 12, Social: 6}, MinHour: 12, MaxHour: lateTo, Kinds: maquisRest, Golvo: true, Plate: "kedjenou"},
	{ID: DishPrefix + "placali-kplala", Name: "Placali, sauce kplala", Label: "Manger un placali sauce kplala", Icon: "soup", Section: SecPlats, Price: 1500, Minutes: 25, Effect: Needs{Hunger: 55, Fun: 4}, MinHour: lunchFrom, MaxHour: 21, Kinds: []string{"maquis", "market", "village"}, Rare: true, Plate: "placali"},
	{ID: DishPrefix + "attieke-poisson", Name: "Attiéké-poisson braisé", Label: "Manger un attiéké-poisson braisé", Icon: "fish", Section: SecPlats, Price: 3000, Minutes: 30, Effect: Needs{Hunger: 60, Fun: 8}, MinHour: lunchFrom, MaxHour: lateTo, Kinds: maquisRest, Golvo: true, Plate: "poisson"},
	{ID: DishPrefix + "attoukpou", Name: "Attoukpou, sauce aubergine", Label: "Manger un attoukpou sauce aubergine", Icon: "soup", Section: SecPlats, Price: 1500, Minutes: 25, Effect: Needs{Hunger: 52, Fun: 5}, MinHour: lunchFrom, MaxHour: 21, Kinds: []string{"maquis", "village"}, Rare: true, Plate: "placali"},
	{ID: DishPrefix + "ablo-poisson", Name: "Ablo et poisson frit", Label: "Manger de l'ablo avec du poisson frit", Icon: "fish", Section: SecPlats, Price: 1000, Minutes: 20, Effect: Needs{Hunger: 42, Fun: 4}, MinHour: 9, MaxHour: 21, Kinds: []string{"market", "beach"}, Plate: "ablo"},
	{ID: DishPrefix + "gari-sucre", Name: "Gari sucré à l'eau glacée", Label: "Manger un gari sucré", Icon: "wheat", Section: SecSnacks, Price: 200, Minutes: 10, Effect: Needs{Hunger: 25, Energy: 4}, MinHour: 8, MaxHour: 22, Kinds: []string{"market", "transport"}, Plate: "bouillie"},
	// La cantine de la tantie, at the offices on weekdays at noon, and at the market.
	{ID: DishPrefix + "cantine-tantie", Name: "Riz sauce du jour chez la tantie", Label: "Manger à la cantine de la tantie", Icon: "utensils", Section: SecPlats, Price: 700, Minutes: 25, Effect: Needs{Hunger: 50, Social: 8}, MinHour: 11, MaxHour: 15, Days: Workweek, Kinds: tantie, Plate: "riz"},
	// The grills of the evening.
	{ID: DishPrefix + "choukouya", Name: "Choukouya de mouton", Label: "Partager un choukouya de mouton", Icon: "drumstick", Section: SecGrillades, Price: 3000, Minutes: 35, Effect: Needs{Hunger: 50, Fun: 12, Social: 15}, MinHour: 17, MaxHour: lateTo, Kinds: maquisRue, Golvo: true, Plate: "brochette"},
	{ID: DishPrefix + "escargots", Name: "Escargots braisés, sauce pimentée", Label: "Manger des escargots braisés", Icon: "shell", Section: SecGrillades, Price: 3000, Minutes: 30, Effect: Needs{Hunger: 45, Fun: 15}, MinHour: 17, MaxHour: lateTo, Kinds: maquis, Rare: true, Plate: "escargots"},
	{ID: DishPrefix + "agouti", Name: "Agouti braisé, sauce graine", Label: "Manger un agouti braisé", Icon: "drumstick", Section: SecGrillades, Price: 6000, Minutes: 45, Effect: Needs{Hunger: 70, Fun: 15, Social: 10}, MinHour: 18, MaxHour: 1, Kinds: maquis, Rare: true, Plate: "poulet"},
	// The soups of late at night.
	{ID: DishPrefix + "pepper-soup", Name: "Pepper soup de poisson", Label: "Manger une pepper soup bien pimentée", Icon: "soup", Section: SecSoupes, Price: 2500, Minutes: 25, Effect: Needs{Hunger: 40, Energy: 10, Fun: 6}, MinHour: 17, MaxHour: 3, Kinds: maquisRue, Rare: true, Plate: "soupe"},
	{ID: DishPrefix + "soupe-poisson", Name: "Soupe de poisson du maquis", Label: "Manger une soupe de poisson", Icon: "soup", Section: SecSoupes, Price: 2000, Minutes: 25, Effect: Needs{Hunger: 42, Energy: 6}, MinHour: lunchFrom, MaxHour: lateTo, Kinds: maquis, Plate: "soupe"},
	// The street's snacks: the braiseuses, the beignets, the peanuts.
	{ID: DishPrefix + "mais-grille", Name: "Maïs grillé", Label: "Manger un épi de maïs grillé", Icon: "wheat", Section: SecSnacks, Price: 150, Minutes: 10, Effect: Needs{Hunger: 14, Fun: 4}, MinHour: 15, MaxHour: 23, Kinds: street, Plate: "mais"},
	{ID: DishPrefix + "igname-braisee", Name: "Igname braisée, sauce pimentée", Label: "Manger de l'igname braisée", Icon: "flame", Section: SecSnacks, Price: 300, Minutes: 15, Effect: Needs{Hunger: 28, Fun: 3}, MinHour: 11, MaxHour: 22, Kinds: street, Plate: "igname"},
	{ID: DishPrefix + "aloco-braise", Name: "Banane braisée et arachides", Label: "Manger une banane braisée avec des arachides", Icon: "banana", Section: SecSnacks, Price: 250, Minutes: 10, Effect: Needs{Hunger: 22, Fun: 4}, MinHour: 10, MaxHour: 22, Kinds: street, Plate: "banane"},
	{ID: DishPrefix + "claclo", Name: "Claclo (beignets de banane)", Label: "Manger des claclos", Icon: "cookie", Section: SecSnacks, Price: 100, Minutes: 10, Effect: Needs{Hunger: 12, Fun: 4}, MinHour: 7, MaxHour: 20, Kinds: []string{"market", "transport", "beach"}, Plate: "beignets"},
	{ID: DishPrefix + "gbofloto", Name: "Gbofloto", Label: "Manger des gboflotos", Icon: "cookie", Section: SecSnacks, Price: 100, Minutes: 10, Effect: Needs{Hunger: 12, Fun: 4}, MinHour: 6, MaxHour: 21, Kinds: []string{"market", "transport", "rue"}, Plate: "beignets"},
	{ID: DishPrefix + "arachides-grillees", Name: "Arachides grillées", Label: "Grignoter des arachides grillées", Icon: "nut", Section: SecSnacks, Price: 100, Minutes: 5, Effect: Needs{Hunger: 6, Fun: 3}, Kinds: []string{"market", "rue", "beach", "maquis"}, Plate: "arachides"},
	// Fruits, cut and peeled.
	{ID: DishPrefix + "mangue", Name: "Mangue bien mûre", Label: "Manger une mangue", Icon: "apple", Section: SecFruits, Price: 200, Minutes: 10, Effect: Needs{Hunger: 10, Fun: 5}, MinHour: 7, MaxHour: 20, Kinds: fruits, Plate: "fruits"},
	{ID: DishPrefix + "ananas", Name: "Tranches d'ananas", Label: "Manger des tranches d'ananas", Icon: "citrus", Section: SecFruits, Price: 200, Minutes: 10, Effect: Needs{Hunger: 9, Fun: 5}, MinHour: 7, MaxHour: 20, Kinds: fruits, Plate: "fruits"},
	{ID: DishPrefix + "papaye", Name: "Papaye coupée", Label: "Manger de la papaye", Icon: "apple", Section: SecFruits, Price: 200, Minutes: 10, Effect: Needs{Hunger: 10, Energy: 3}, MinHour: 7, MaxHour: 20, Kinds: fruits, Plate: "fruits"},
	{ID: DishPrefix + "orange-pelee", Name: "Oranges pelées", Label: "Sucer des oranges pelées", Icon: "citrus", Section: SecFruits, Price: 100, Minutes: 5, Effect: Needs{Hunger: 6, Energy: 4}, MinHour: 7, MaxHour: 20, Kinds: fruits, Plate: "fruits"},
	// The drinks of here.
	{ID: DishPrefix + "bissap", Name: "Bissap glacé", Label: "Boire un bissap bien glacé", Icon: "cup-soda", Section: SecBoissons, Price: 300, Minutes: 5, Effect: Needs{Hunger: 5, Fun: 6, Energy: 3}, Kinds: drinks, Golvo: true, Plate: "bissap"},
	{ID: DishPrefix + "gnamankoudji", Name: "Gnamankoudji (jus de gingembre)", Label: "Boire un gnamankoudji qui pique", Icon: "cup-soda", Section: SecBoissons, Price: 300, Minutes: 5, Effect: Needs{Hunger: 4, Energy: 8}, Kinds: drinks, Plate: "gingembre"},
	{ID: DishPrefix + "tomi", Name: "Jus de tomi (baobab)", Label: "Boire un jus de tomi", Icon: "cup-soda", Section: SecBoissons, Price: 300, Minutes: 5, Effect: Needs{Hunger: 8, Fun: 4}, Kinds: drinks, Plate: "tomi"},
	// For the grown-ups: palm wine, and the koutoukou distilled from it. Drunk, no wheel for a while.
	{ID: DishPrefix + "bandji", Name: "Bandji (vin de palme)", Label: "Boire un bandji frais", Icon: "wine", Section: SecAlcools, Price: 500, Minutes: 30, Effect: Needs{Fun: 14, Social: 12, Energy: -4}, MinHour: 15, MaxHour: lateTo, Ages: Adults, Kinds: maquisRue, Alcohol: true, Plate: "bandji"},
	{ID: DishPrefix + "koutoukou", Name: "Petit verre de koutoukou", Label: "Boire un petit verre de koutoukou", Icon: "wine", Section: SecAlcools, Price: 300, Minutes: 15, Effect: Needs{Fun: 16, Social: 8, Energy: -8}, MinHour: 17, MaxHour: lateTo, Ages: Adults, Kinds: maquis, Alcohol: true, Plate: "koutoukou"},
	// The regions' own.
	{ID: DishPrefix + "foutou-claire-mouton", Name: "Foutou igname, sauce claire au mouton", Label: "Manger le foutou sauce claire au mouton de Bouaké", Icon: "soup", Section: SecPlats, Price: 2500, Minutes: 35, Effect: Needs{Hunger: 68, Fun: 10}, MinHour: lunchFrom, MaxHour: 23, Kinds: maquis, Cities: []string{"bouake"}, Region: "Bouaké", Plate: "foutou"},
	{ID: DishPrefix + "igname-pilee-bouake", Name: "Igname pilée et sauce djoumgblé", Label: "Manger l'igname pilée sauce djoumgblé", Icon: "soup", Section: SecPlats, Price: 2000, Minutes: 30, Effect: Needs{Hunger: 62, Fun: 8}, MinHour: lunchFrom, MaxHour: 22, Kinds: []string{"maquis", "market"}, Cities: []string{"bouake", "yamoussoukro"}, Region: "Pays baoulé", Plate: "foutou"},
	{ID: DishPrefix + "to-baobab", Name: "Tô de mil, sauce feuilles de baobab", Label: "Manger un tô sauce feuilles de baobab", Icon: "soup", Section: SecPlats, Price: 1000, Minutes: 25, Effect: Needs{Hunger: 58, Fun: 6}, MinHour: lunchFrom, MaxHour: 22, Kinds: []string{"maquis", "market"}, Cities: []string{"korhogo"}, Region: "Korhogo", Plate: "foutou"},
	{ID: DishPrefix + "degue", Name: "Dêguê (mil au lait caillé)", Label: "Manger un dêguê bien frais", Icon: "milk", Section: SecSnacks, Price: 300, Minutes: 10, Effect: Needs{Hunger: 18, Fun: 8}, MinHour: 8, MaxHour: 21, Kinds: []string{"market", "transport", "boutique"}, Cities: []string{"korhogo"}, Region: "Korhogo", Plate: "bouillie"},
	{ID: DishPrefix + "riz-feuille-man", Name: "Riz de montagne, sauce feuille", Label: "Manger le riz de montagne sauce feuille", Icon: "leaf", Section: SecPlats, Price: 1500, Minutes: 30, Effect: Needs{Hunger: 60, Fun: 6}, MinHour: lunchFrom, MaxHour: 22, Kinds: []string{"maquis", "market"}, Cities: []string{"man"}, Region: "Man", Plate: "riz"},
	{ID: DishPrefix + "cafe-man", Name: "Café des montagnes de Man", Label: "Boire un café des montagnes de Man", Icon: "coffee", Section: SecPetitDej, Price: 200, Minutes: 10, Effect: Needs{Energy: 18, Fun: 4}, MinHour: morningFrom, MaxHour: 14, Kinds: []string{"boutique", "market", "maquis"}, Ages: TeensUp, Cities: []string{"man"}, Region: "Man", Plate: "cafe"},
	{ID: DishPrefix + "graine-escargots-daloa", Name: "Foutou banane, sauce graine aux escargots", Label: "Manger la sauce graine aux escargots de Daloa", Icon: "shell", Section: SecPlats, Price: 3000, Minutes: 35, Effect: Needs{Hunger: 66, Fun: 12}, MinHour: lunchFrom, MaxHour: 23, Kinds: maquis, Cities: []string{"daloa"}, Region: "Daloa", Plate: "foutou"},
	{ID: DishPrefix + "kedjenou-pintade", Name: "Kédjénou de pintade", Label: "Manger un kédjénou de pintade", Icon: "cooking-pot", Section: SecPlats, Price: 4000, Minutes: 45, Effect: Needs{Hunger: 68, Fun: 14, Social: 6}, MinHour: 12, MaxHour: lateTo, Kinds: maquis, Cities: []string{"yamoussoukro"}, Region: "Yamoussoukro", Plate: "kedjenou"},
	{ID: DishPrefix + "langouste-bassam", Name: "Langouste grillée de Bassam", Label: "Manger une langouste grillée face à la mer", Icon: "fish", Section: SecGrillades, Price: 8000, Minutes: 45, Effect: Needs{Hunger: 55, Fun: 22, Social: 10}, MinHour: 12, MaxHour: 23, Kinds: []string{"maquis", "beach", "restaurant"}, Cities: []string{"grand-bassam"}, Region: "Grand-Bassam", Plate: "poisson"},
}

func init() {
	for _, d := range Dishes {
		for _, k := range d.Kinds {
			kind, ok := Kinds[k]
			if !ok {
				continue
			}
			kind.Interactions = append(kind.Interactions, d.Interaction())
			Kinds[k] = kind
		}
	}
	home := Kinds["home"]
	for _, r := range Recipes {
		home.Interactions = append(home.Interactions, r.Interaction())
	}
	Kinds["home"] = home
}

// Interaction: the dish as an activity at the places that serve it.
func (d Dish) Interaction() Interaction {
	return Interaction{ID: d.ID, Label: d.Label, Icon: d.Icon, Minutes: d.Minutes, Cost: d.Price, Effect: d.Effect, MinHour: d.MinHour, MaxHour: d.MaxHour, Days: d.Days, Ages: d.Ages, Cities: d.Cities}
}

// FindDish: a dish by its activity's id.
func FindDish(id string) (Dish, bool) {
	i := slices.IndexFunc(Dishes, func(d Dish) bool { return d.ID == id })
	if i < 0 {
		return Dish{}, false
	}
	return Dishes[i], true
}

// IsDish: an eating out of the cartes.
func IsDish(id string) bool { return strings.HasPrefix(id, DishPrefix) }

// hash32: FNV-1a over the strings, the same on the phone (web game/cuisine.ts).
func hash32(parts ...string) uint32 {
	f := fnv.New32a()
	for i, p := range parts {
		if i > 0 {
			_, _ = f.Write([]byte{'|'})
		}
		_, _ = f.Write([]byte(p))
	}
	return f.Sum32()
}

// Serves: whether this place has this dish on its carte (the rare ones at about half the places).
func Serves(placeID, dishID string) bool {
	d, ok := FindDish(dishID)
	if !ok {
		return false
	}
	return !d.Rare || hash32(placeID, dishID)%2 == 0
}

// DishOfDayOff: the dish of the day's discount (a share of the price).
const DishOfDayOff = 0.2

// DishOfDay: the place's dish of the day (a plate it serves, chosen anew each day), or "".
func DishOfDay(placeID, kind, city string, day int64) string {
	var plats []string
	for _, d := range Dishes {
		if d.Section != SecPlats && d.Section != SecGrillades {
			continue
		}
		if !slices.Contains(d.Kinds, kind) || len(d.Cities) > 0 && !slices.Contains(d.Cities, city) || !Serves(placeID, d.ID) {
			continue
		}
		plats = append(plats, d.ID)
	}
	if len(plats) == 0 {
		return ""
	}
	return plats[hash32(placeID, strconv.FormatInt(day, 10))%uint32(len(plats))]
}

// OnCarte: the dish at that place, at that price (the dish of the day for less), or why not.
func OnCarte(it Interaction, placeID, kind, city string, gameMinutes int64) (Interaction, bool) {
	if !IsDish(it.ID) {
		return it, true
	}
	if !Serves(placeID, it.ID) {
		return it, false
	}
	if DishOfDay(placeID, kind, city, DayOf(gameMinutes)) == it.ID {
		it.Cost = Discounted(it.Cost, DishOfDayOff)
	}
	return it, true
}

// ---------- Cooking at home ----------

// An Ingredient is bought at the market for the fridge, and cooked (never eaten as it is).
type Ingredient struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	Price int    `json:"price"`
}

// IngredientPrefix: in the fridge, the ingredients' keys.
const IngredientPrefix = "ing-"

// Ingredients: what the market sells to cook.
var Ingredients = []Ingredient{
	{ID: IngredientPrefix + "banane", Label: "Bananes plantain (trois doigts)", Icon: "banana", Price: 500},
	{ID: IngredientPrefix + "igname", Label: "Igname", Icon: "carrot", Price: 700},
	{ID: IngredientPrefix + "graine", Label: "Graines de palme", Icon: "bean", Price: 500},
	{ID: IngredientPrefix + "arachide", Label: "Pâte d'arachide", Icon: "nut", Price: 400},
	{ID: IngredientPrefix + "gombo", Label: "Gombo frais", Icon: "leaf", Price: 300},
	{ID: IngredientPrefix + "kplala", Label: "Feuilles de kplala", Icon: "leaf", Price: 200},
	{ID: IngredientPrefix + "manioc", Label: "Pâte de manioc (pour le placali)", Icon: "wheat", Price: 300},
	{ID: IngredientPrefix + "riz", Label: "Riz parfumé (1 kg)", Icon: "wheat", Price: 700},
	{ID: IngredientPrefix + "poulet", Label: "Poulet bicyclette", Icon: "drumstick", Price: 3000},
	{ID: IngredientPrefix + "poisson", Label: "Poisson fumé", Icon: "fish", Price: 1000},
	{ID: IngredientPrefix + "condiments", Label: "Tomates, oignons, piment", Icon: "salad", Price: 300},
	{ID: IngredientPrefix + "oeufs", Label: "Œufs (trois)", Icon: "egg", Price: 300},
	{ID: IngredientPrefix + "pain", Label: "Pain et beurre", Icon: "croissant", Price: 250},
	{ID: IngredientPrefix + "mais", Label: "Épis de maïs frais", Icon: "wheat", Price: 300},
	{ID: IngredientPrefix + "bissap", Label: "Fleurs de bissap et sucre", Icon: "flower", Price: 400},
	{ID: IngredientPrefix + "gingembre", Label: "Gingembre frais", Icon: "sprout", Price: 300},
}

// FindIngredient: an ingredient by its id.
func FindIngredient(id string) (Ingredient, bool) {
	i := slices.IndexFunc(Ingredients, func(g Ingredient) bool { return g.ID == id })
	if i < 0 {
		return Ingredient{}, false
	}
	return Ingredients[i], true
}

// BigMarkets: Adjamé's and Treichville's, where everything costs a little less.
var BigMarkets = []string{"adjame-forum", MarcheTreichID}

// BigMarketOff: their discount on the ingredients (a share of the price).
const BigMarketOff = 0.15

// IngredientPrice: what it costs at this market.
func IngredientPrice(g Ingredient, placeID string) int {
	if slices.Contains(BigMarkets, placeID) {
		return Discounted(g.Price, BigMarketOff)
	}
	return g.Price
}

// A Recipe is cooked at home from the fridge's ingredients, played as its own little game.
type Recipe struct {
	// ID: its activity's (RecipePrefix + its name).
	ID    string `json:"id"`
	Name  string `json:"name"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	// Needs: the ingredients it takes, how many of each.
	Needs   map[string]int `json:"needs"`
	Minutes int64          `json:"minutes"`
	Effect  Needs          `json:"effect"`
	// Yields: what it puts back in the fridge (the bissap in its bottles).
	Yields map[string]int `json:"yields,omitempty"`
}

// Shared: what sharing the plate with the house adds (and the friendship of those who ate it).
var Shared = Needs{Social: 20, Fun: 6}

// SharedFriendship: how much those at the table like you more.
const SharedFriendship = 6

func ing(pairs ...any) map[string]int {
	m := map[string]int{}
	for i := 0; i+1 < len(pairs); i += 2 {
		m[IngredientPrefix+pairs[i].(string)] = pairs[i+1].(int)
	}
	return m
}

// Recipes: what one cooks at home, better than eating out (and for less).
var Recipes = []Recipe{
	{ID: RecipePrefix + "foutou-graine", Name: "Foutou banane, sauce graine", Label: "Piler le foutou et faire la sauce graine", Icon: "soup", Needs: ing("banane", 2, "graine", 1, "poisson", 1, "condiments", 1), Minutes: 60, Effect: Needs{Hunger: 78, Fun: 12, Social: 4}},
	{ID: RecipePrefix + "foutou-igname", Name: "Foutou igname, sauce claire", Label: "Piler le foutou igname, sauce claire", Icon: "soup", Needs: ing("igname", 2, "poisson", 1, "condiments", 1), Minutes: 60, Effect: Needs{Hunger: 76, Fun: 10, Social: 4}},
	{ID: RecipePrefix + "sauce-graine", Name: "Riz, sauce graine au poisson fumé", Label: "Préparer la sauce graine", Icon: "cooking-pot", Needs: ing("riz", 1, "graine", 1, "poisson", 1, "condiments", 1), Minutes: 50, Effect: Needs{Hunger: 74, Fun: 10}},
	{ID: RecipePrefix + "kedjenou", Name: "Kédjénou de poulet", Label: "Faire un kédjénou dans la canari", Icon: "cooking-pot", Needs: ing("poulet", 1, "condiments", 1, "riz", 1), Minutes: 60, Effect: Needs{Hunger: 82, Fun: 16, Social: 5}},
	{ID: RecipePrefix + "sauce-arachide", Name: "Riz, sauce arachide au poulet", Label: "Préparer la sauce arachide", Icon: "cooking-pot", Needs: ing("riz", 1, "arachide", 1, "poulet", 1, "condiments", 1), Minutes: 55, Effect: Needs{Hunger: 80, Fun: 12}},
	{ID: RecipePrefix + "sauce-gombo", Name: "Riz, sauce gombo", Label: "Préparer la sauce gombo", Icon: "cooking-pot", Needs: ing("riz", 1, "gombo", 1, "poisson", 1), Minutes: 45, Effect: Needs{Hunger: 72, Fun: 8}},
	{ID: RecipePrefix + "placali-kplala", Name: "Placali, sauce kplala", Label: "Faire le placali sauce kplala", Icon: "soup", Needs: ing("manioc", 1, "kplala", 1, "poisson", 1), Minutes: 45, Effect: Needs{Hunger: 70, Fun: 8}},
	{ID: RecipePrefix + "riz-gras", Name: "Riz gras (tchêp) au poulet", Label: "Préparer un riz gras au poulet", Icon: "drumstick", Needs: ing("riz", 1, "poulet", 1, "condiments", 1), Minutes: 50, Effect: Needs{Hunger: 78, Fun: 12}},
	{ID: RecipePrefix + "pain-omelette", Name: "Pain-beurre-omelette", Label: "Faire un pain-omelette", Icon: "egg", Needs: ing("oeufs", 1, "pain", 1, "condiments", 1), Minutes: 20, Effect: Needs{Hunger: 45, Fun: 6, Energy: 4}},
	{ID: RecipePrefix + "mais-braise", Name: "Maïs braisé", Label: "Braiser du maïs sur le feu", Icon: "flame", Needs: ing("mais", 1), Minutes: 25, Effect: Needs{Hunger: 24, Fun: 10}},
	{ID: RecipePrefix + "bissap", Name: "Jus de bissap maison", Label: "Faire le jus de bissap", Icon: "cup-soda", Needs: ing("bissap", 1, "gingembre", 1), Minutes: 30, Effect: Needs{Hunger: 6, Fun: 10, Energy: 4}, Yields: map[string]int{"bissap": 2}},
}

// Interaction: the recipe as an activity in the kitchen (its ingredients taken from the fridge: sims/cuisine.go).
func (r Recipe) Interaction() Interaction {
	return Interaction{ID: r.ID, Room: RoomKitchen, Ages: TeensUp, Label: r.Label, Icon: r.Icon, Minutes: r.Minutes, Effect: r.Effect}
}

// FindRecipe: a recipe by its activity's id.
func FindRecipe(id string) (Recipe, bool) {
	i := slices.IndexFunc(Recipes, func(r Recipe) bool { return r.ID == id })
	if i < 0 {
		return Recipe{}, false
	}
	return Recipes[i], true
}

// Missing: the ingredients the fridge doesn't have enough of, by id (how many more), or nil.
func (r Recipe) Missing(stock map[string]int) map[string]int {
	var out map[string]int
	for id, n := range r.Needs {
		if stock[id] < n {
			if out == nil {
				out = map[string]int{}
			}
			out[id] = n - stock[id]
		}
	}
	return out
}

// Cook: the ingredients taken out of the fridge, and what it yields put in.
func (r Recipe) Cook(stock map[string]int) {
	for id, n := range r.Needs {
		stock[id] -= n
	}
	for id, n := range r.Yields {
		stock[id] += n
	}
}

// CuisineIDs: every activity the update brings (features.go): the dishes, the recipes, the street's new sellers.
func CuisineIDs() []string {
	out := make([]string, 0, len(Dishes)+len(Recipes)+len(CuisineStreet))
	for _, d := range Dishes {
		out = append(out, d.ID)
	}
	for _, r := range Recipes {
		out = append(out, r.ID)
	}
	return append(out, CuisineStreet...)
}

// CuisineStreet: the street's new sellers' activities (sims/street.go): the tantie au pain-omelette,
// the vendeuse de bissap, the braiseuse de maïs, the vendeur de fruits.
var CuisineStreet = []string{"street-omelette", "street-bissap", "street-mais", "street-fruits"}

// CuisineData: what the phone needs (the cartes' sections, the dishes, the ingredients, the recipes).
func CuisineData() map[string]any {
	return map[string]any{"sections": CarteSections, "dishes": Dishes, "ingredients": Ingredients, "recipes": Recipes, "bigMarkets": BigMarkets, "bigMarketOff": BigMarketOff, "dayOff": DishOfDayOff}
}
