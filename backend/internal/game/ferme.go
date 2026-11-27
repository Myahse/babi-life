package game

import (
	"hash/fnv"
	"math"
	"slices"
	"strconv"
	"time"
)

// L'agriculture et l'élevage (the update « agriculture »; sims/ferme.go keeps a Sim's farm, world/ferme.go puts
// the village plots on the map; web components/ferme/). A Sim rents or buys a parcelle in a village round a
// town (Gonaté by Daloa, Sangouiné by Man, Djébonoua by Bouaké, Karakoro by Korhogo, Attiégouakro by
// Yamoussoukro, Gabiadji by San-Pédro, Ebimpé at Anyama, Akandjé at Bingerville; a few abroad where the climate
// fits), or sets up the yard at home (a potager and a poulailler). Then, a day at a time (a game day is a real
// day, Abidjan's):
//   - the field: défricher, labourer, semer (in its season it yields all it can), arroser each dry day (the rain
//     waters it), désherber when the weeds come, traiter the pests (natural products only), récolter, then
//     sécher or transformer (the beans on the claies, the manioc into attiéké, the palm into huile rouge) and
//     sell at the market or to the coopérative Ensemble;
//   - the animals: fed and watered each day they produce (eggs) and their young are born; forgotten a day they
//     get « fatigués » and produce less; now and then one is sick: the vet comes. They never die, no slaughter
//     is ever shown: they are sold alive at the market.
// What the farm brings is FromFerme, capped a day (FermeCap) inside the day's total: what the market can't take
// today waits in the grenier. Seeds, plants, animals, feed, tools, rent all cost. Everything here is the
// catalogue and the rules (pure); the state is the Sim's (sims/ferme.go).

// AgricultureKey: the update (features.go).
const AgricultureKey = "agriculture"

// FromFerme: what the farm's sales bring in, within FermeCap a day (and the day's total).
const FromFerme Income = "ferme"

// FermeCap: the most the farm's sales bring a day (the Pass adds its quarter).
const FermeCap = 6000

// The places' kinds (world/ferme.go): the village plots, the coopérative's warehouse, the vet's.
const (
	FermeKind = "ferme"
	CoopKind  = "cooperative"
	VetoKind  = "veterinaire"
)

// SkillAgri: the skill the farm trains (a level adds to the harvests, FermeSkillBonus).
const SkillAgri = "agriculture"

// The climates (an offer's Zone): the forest south (two rainy seasons), the centre's savanna, the north's
// (one rainy season, the harmattan), the Sahel's (Burkina), a temperate land with a winter (France), the
// continent's (the Iowa: a hard winter).
const (
	ZoneSud         = "sud"
	ZoneCentre      = "centre"
	ZoneNord        = "nord"
	ZoneSahel       = "sahel"
	ZoneTempere     = "tempere"
	ZoneContinental = "continental"
)

// rainByMonth: the chance of rain on a day, by zone and month (1..12).
var rainByMonth = map[string][12]float64{
	// Grande saison des pluies avril–juillet, petite saison sèche en août, petite saison des pluies sept.–nov.
	ZoneSud: {0.12, 0.15, 0.25, 0.5, 0.65, 0.7, 0.45, 0.2, 0.3, 0.45, 0.4, 0.15},
	// The centre: two lighter rainy seasons (mars–juin, sept.–oct.).
	ZoneCentre: {0.05, 0.1, 0.3, 0.4, 0.45, 0.45, 0.25, 0.25, 0.45, 0.4, 0.15, 0.05},
	// The north: one rainy season (mai–octobre), the harmattan from December.
	ZoneNord:  {0.01, 0.02, 0.08, 0.2, 0.35, 0.5, 0.6, 0.65, 0.55, 0.3, 0.05, 0.01},
	ZoneSahel: {0, 0.01, 0.04, 0.12, 0.3, 0.45, 0.6, 0.65, 0.5, 0.2, 0.02, 0},
	// France's west, Iowa: rain all year, round a third of the days.
	ZoneTempere:     {0.45, 0.4, 0.35, 0.35, 0.35, 0.3, 0.25, 0.25, 0.3, 0.4, 0.45, 0.45},
	ZoneContinental: {0.2, 0.2, 0.3, 0.35, 0.4, 0.4, 0.35, 0.3, 0.3, 0.3, 0.25, 0.2},
}

// coldMonths: the months nothing grows outside (the winter).
var coldMonths = map[string][]int{ZoneTempere: {12, 1, 2}, ZoneContinental: {12, 1, 2, 3}}

// MonthOfDay: the calendar month (1..12) of a game day.
func MonthOfDay(day int64) int { return int(DateOf(day * minutesPerDay).Month()) }

// fermeRoll: a number in [0,1) fixed for these words (the weather of a zone on a day, a plot's pests).
func fermeRoll(parts ...string) float64 {
	h := fnv.New64a()
	for _, p := range parts {
		_, _ = h.Write([]byte(p))
		_, _ = h.Write([]byte{0})
	}
	return float64(h.Sum64()%1_000_000) / 1_000_000
}

// Meteo: the farm's weather on a day in a zone: "pluie", "soleil", "harmattan" (the dry wind of the north's
// winter), "froid" (the winter abroad: nothing grows). The same for everyone, worked out from the season.
func Meteo(zone string, day int64) string {
	m := MonthOfDay(day)
	if slices.Contains(coldMonths[zone], m) {
		return "froid"
	}
	p := rainByMonth[zone]
	if fermeRoll("meteo", zone, strconv.FormatInt(day, 10)) < p[m-1] {
		return "pluie"
	}
	if (zone == ZoneNord || zone == ZoneSahel) && (m == 12 || m == 1 || m == 2) {
		return "harmattan"
	}
	return "soleil"
}

// RainySeason: whether this month is a rainy one there (a third of the days or more).
func RainySeason(zone string, month int) bool {
	p := rainByMonth[zone]
	return month >= 1 && month <= 12 && p[month-1] >= 0.3
}

// Culture: a crop.
type Culture struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	// Kind: "vivrier" (food crops), "maraicher" (the vegetables), "rente" (cash crops, annual: le coton),
	// "perenne" (trees: cacao, café, anacarde, hévéa, palmier, karité).
	Kind string `json:"kind"`
	// Zones: where it grows.
	Zones []string `json:"zones"`
	// Seed: the seeds (or the young plants, for the trees) for one row.
	Seed      int    `json:"seed"`
	SeedLabel string `json:"seedLabel"`
	// Days: the days of growth to the (first) harvest; Again: a tree's days between two harvests after it.
	Days  int `json:"days"`
	Again int `json:"again,omitempty"`
	// Sow: the months it's best sown in (empty: all year, with water); Season: a tree's harvest months.
	Sow    []int `json:"sow,omitempty"`
	Season []int `json:"season,omitempty"`
	// Yield: units a row gives at its best; Unit their name.
	Yield int    `json:"yield"`
	Unit  string `json:"unit"`
	// Price: a unit at the market (0: the market doesn't buy it raw); Coop: the coopérative's.
	Price int `json:"price"`
	Coop  int `json:"coop,omitempty"`
	// Make: what it's turned into (fèves séchées, attiéké…), if anything.
	Make  string `json:"make,omitempty"`
	About string `json:"about"`
}

// Produit: what the grenier holds besides the raw harvest: a crop transformed, the eggs, the fish.
type Produit struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	Unit  string `json:"unit"`
	Price int    `json:"price"`
	Coop  int    `json:"coop,omitempty"`
	// From: the crop it's made of; Ratio: units made from one; Days: how long it dries or ferments; Cost: a
	// unit's work paid (the décortiqueuse, the press); Label of the doing (Do).
	From  string  `json:"from,omitempty"`
	Ratio float64 `json:"ratio,omitempty"`
	Days  int     `json:"days,omitempty"`
	Cost  int     `json:"cost,omitempty"`
	Do    string  `json:"do,omitempty"`
}

var (
	allYear  []int
	southSow = []int{3, 4, 5, 6, 9, 10, 11}
	northSow = []int{5, 6, 7}
	tropics  = []string{ZoneSud, ZoneCentre, ZoneNord, ZoneSahel}
	forest   = []string{ZoneSud, ZoneCentre}
	savanna  = []string{ZoneCentre, ZoneNord, ZoneSahel}
	dry      = []string{ZoneNord, ZoneSahel}
	anywhere = []string{ZoneSud, ZoneCentre, ZoneNord, ZoneSahel, ZoneTempere, ZoneContinental}
)

// Cultures: every crop. The days are the game's (a real day each): a garden's vegetables in three, the trees
// a week and more before their first harvest, then every few days in their season.
var Cultures = []Culture{
	// Les cultures de rente, the trees.
	{ID: "cacao", Label: "Cacao", Icon: "bean", Kind: "perenne", Zones: []string{ZoneSud, ZoneCentre}, Seed: 1500, SeedLabel: "Les plants de la pépinière", Days: 8, Again: 3, Season: []int{10, 11, 12, 1, 2, 3}, Yield: 12, Unit: "kg de fèves", Price: 0, Make: "feves-sechees",
		About: "Sous l'ombre des bananiers, les cabosses poussent sur le tronc. La grande traite d'octobre à mars ; les fèves fermentent puis sèchent sur les claies avant la coopérative."},
	{ID: "cafe", Label: "Café", Icon: "coffee", Kind: "perenne", Zones: []string{ZoneSud, ZoneCentre}, Seed: 1200, SeedLabel: "Les plants de caféier", Days: 8, Again: 3, Season: []int{11, 12, 1, 2}, Yield: 10, Unit: "kg de cerises", Price: 0, Make: "cafe-seche",
		About: "Les cerises rouges cueillies à la main de novembre à février, séchées au soleil sur les aires de séchage."},
	{ID: "anacarde", Label: "Anacarde (cajou)", Icon: "nut", Kind: "perenne", Zones: savanna, Seed: 1000, SeedLabel: "Les plants d'anacardier", Days: 7, Again: 4, Season: []int{2, 3, 4, 5}, Yield: 10, Unit: "kg de noix", Price: 250, Coop: 400,
		About: "Les noix de cajou ramassées sous les arbres de février à mai, vendues brutes à la coopérative."},
	{ID: "hevea", Label: "Hévéa", Icon: "droplet", Kind: "perenne", Zones: []string{ZoneSud}, Seed: 1800, SeedLabel: "Les plants greffés", Days: 9, Again: 2, Season: []int{1, 4, 5, 6, 7, 8, 9, 10, 11, 12}, Yield: 8, Unit: "kg de caoutchouc", Price: 0, Coop: 450,
		About: "La saignée à l'aube : une fine entaille dans l'écorce, le latex blanc coule dans la tasse. Repos en février-mars, quand l'arbre perd ses feuilles."},
	{ID: "palmier", Label: "Palmier à huile", Icon: "tree-palm", Kind: "perenne", Zones: []string{ZoneSud}, Seed: 1500, SeedLabel: "Les plants de palmier", Days: 8, Again: 3, Yield: 4, Unit: "régimes", Price: 600, Coop: 800, Make: "huile-rouge",
		About: "Les régimes coupés toute l'année, plus nombreux de mars à mai. Pilés et bouillis au village : l'huile rouge."},
	{ID: "karite", Label: "Karité", Icon: "trees", Kind: "perenne", Zones: dry, Seed: 600, SeedLabel: "Les jeunes karités du parc", Days: 6, Again: 3, Season: []int{6, 7, 8}, Yield: 8, Unit: "kg d'amandes", Price: 200, Make: "beurre-karite",
		About: "Les fruits tombés ramassés de juin à août par les femmes du village ; les amandes deviennent le beurre de karité."},
	// Les vivriers.
	{ID: "igname", Label: "Igname", Icon: "carrot", Kind: "vivrier", Zones: tropics, Seed: 1200, SeedLabel: "Les semenceaux sur les buttes", Days: 6, Sow: []int{11, 12, 2, 3, 4}, Yield: 20, Unit: "kg", Price: 250,
		About: "Plantée sur de grosses buttes à la fin de la saison sèche, tuteurée : la reine des champs du centre, pour le foutou."},
	{ID: "manioc", Label: "Manioc", Icon: "carrot", Kind: "vivrier", Zones: forest, Seed: 500, SeedLabel: "Les boutures", Days: 7, Yield: 30, Unit: "kg", Price: 100, Make: "attieke",
		About: "Des boutures plantées toute l'année, presque sans soin. Râpé, pressé et cuit à la vapeur : l'attiéké."},
	{ID: "banane", Label: "Banane plantain", Icon: "banana", Kind: "vivrier", Zones: forest, Seed: 1500, SeedLabel: "Les rejets de bananier", Days: 6, Sow: []int{3, 4, 5, 6, 9, 10}, Yield: 6, Unit: "régimes", Price: 900,
		About: "Les rejets plantés au début des pluies ; l'alloco, le foutou banane, le foufou."},
	{ID: "riz", Label: "Riz", Icon: "wheat", Kind: "vivrier", Zones: anywhere[:4], Seed: 800, SeedLabel: "Les semences de riz", Days: 5, Sow: []int{4, 5, 6, 7, 8, 9}, Yield: 25, Unit: "kg de paddy", Price: 120, Make: "riz-blanc",
		About: "Le riz des bas-fonds, les pieds dans l'eau : il demande de l'eau chaque jour. Décortiqué au village, il se vend mieux."},
	{ID: "mais", Label: "Maïs", Icon: "wheat", Kind: "vivrier", Zones: anywhere, Seed: 600, SeedLabel: "Les semences de maïs", Days: 4, Sow: []int{3, 4, 5, 6, 7, 9, 10}, Yield: 25, Unit: "kg", Price: 150,
		About: "Semé en lignes au début des pluies, récolté en épis : grillé au bord de la route, ou pour nourrir les poules."},
	{ID: "mil", Label: "Mil", Icon: "wheat", Kind: "vivrier", Zones: dry, Seed: 400, SeedLabel: "Les semences de mil", Days: 4, Sow: northSow, Yield: 20, Unit: "kg", Price: 150,
		About: "La céréale du nord et du Sahel, qui tient avec peu de pluie : la bouillie, le tô, le dêguê."},
	{ID: "sorgho", Label: "Sorgho", Icon: "wheat", Kind: "vivrier", Zones: dry, Seed: 400, SeedLabel: "Les semences de sorgho", Days: 4, Sow: northSow, Yield: 22, Unit: "kg", Price: 140,
		About: "Haut comme un homme, il résiste à la sécheresse : le tô, et le tchapalo des cabarets."},
	// La culture de rente du nord.
	{ID: "coton", Label: "Coton", Icon: "cloud", Kind: "rente", Zones: dry, Seed: 900, SeedLabel: "Les semences de coton", Days: 6, Sow: []int{6, 7}, Yield: 15, Unit: "kg de coton-graine", Price: 0, Coop: 330,
		About: "Semé en juin-juillet, récolté blanc d'octobre à décembre : la coopérative l'achète pour l'égreneuse."},
	// Le maraîchage, all year with water.
	{ID: "tomate", Label: "Tomate", Icon: "cherry", Kind: "maraicher", Zones: anywhere, Seed: 700, SeedLabel: "Les plants de tomate", Days: 3, Yield: 15, Unit: "kg", Price: 350,
		About: "Plantée en planches, arrosée chaque jour : la tomate de la sauce, qui se vend bien en saison sèche."},
	{ID: "piment", Label: "Piment", Icon: "flame", Kind: "maraicher", Zones: tropics, Seed: 500, SeedLabel: "Les plants de piment", Days: 3, Yield: 6, Unit: "kg", Price: 800,
		About: "Petit, rouge et fort : il en faut un peu dans chaque sauce."},
	{ID: "aubergine", Label: "Aubergine", Icon: "egg", Kind: "maraicher", Zones: tropics, Seed: 500, SeedLabel: "Les plants d'aubergine", Days: 3, Yield: 12, Unit: "kg", Price: 300,
		About: "L'aubergine blanche ou le petit gnangnan amer, pour la sauce aubergine."},
	{ID: "gombo", Label: "Gombo", Icon: "sprout", Kind: "maraicher", Zones: tropics, Seed: 400, SeedLabel: "Les graines de gombo", Days: 2, Yield: 10, Unit: "kg", Price: 400,
		About: "Il pousse vite et se cueille tous les jours : la sauce gombo, frais ou séché."},
}

// Produits: the grenier's other things.
var Produits = []Produit{
	{ID: "feves-sechees", Label: "Fèves de cacao séchées", Icon: "bean", Unit: "kg", Price: 0, Coop: 1000, From: "cacao", Ratio: 0.6, Days: 2, Do: "Fermenter et sécher les fèves sur les claies"},
	{ID: "cafe-seche", Label: "Café séché", Icon: "coffee", Unit: "kg", Price: 0, Coop: 900, From: "cafe", Ratio: 0.5, Days: 2, Do: "Sécher les cerises au soleil"},
	{ID: "attieke", Label: "Attiéké", Icon: "cooking-pot", Unit: "kg", Price: 300, From: "manioc", Ratio: 0.5, Days: 1, Cost: 20, Do: "Faire l'attiéké avec les femmes du village"},
	{ID: "huile-rouge", Label: "Huile rouge", Icon: "droplet", Unit: "litres", Price: 700, From: "palmier", Ratio: 2, Days: 1, Cost: 100, Do: "Piler les graines et faire l'huile rouge"},
	{ID: "beurre-karite", Label: "Beurre de karité", Icon: "sparkles", Unit: "kg", Price: 800, Coop: 1100, From: "karite", Ratio: 0.4, Days: 1, Cost: 30, Do: "Torréfier et baratter le beurre de karité"},
	{ID: "riz-blanc", Label: "Riz blanc décortiqué", Icon: "wheat", Unit: "kg", Price: 300, From: "riz", Ratio: 0.65, Cost: 25, Do: "Passer le paddy à la décortiqueuse du village"},
	{ID: "oeufs", Label: "Œufs", Icon: "egg", Unit: "œufs", Price: 100},
	{ID: "oeufs-pintade", Label: "Œufs de pintade", Icon: "egg", Unit: "œufs", Price: 125},
	{ID: "tilapia", Label: "Tilapias frais", Icon: "fish", Unit: "poissons", Price: 350},
}

// FindCulture, FindProduit.
func FindCulture(id string) (Culture, bool) {
	i := slices.IndexFunc(Cultures, func(c Culture) bool { return c.ID == id })
	if i < 0 {
		return Culture{}, false
	}
	return Cultures[i], true
}

func FindProduit(id string) (Produit, bool) {
	i := slices.IndexFunc(Produits, func(p Produit) bool { return p.ID == id })
	if i < 0 {
		return Produit{}, false
	}
	return Produits[i], true
}

// SoldAs: what a grenier's unit is called and sells for (a raw crop or a product): its market price and the
// coopérative's (0: not bought there), and its label.
func SoldAs(id string) (label, unit string, market, coop int, ok bool) {
	if c, ok := FindCulture(id); ok {
		return c.Label, c.Unit, c.Price, c.Coop, true
	}
	if p, ok := FindProduit(id); ok {
		return p.Label, p.Unit, p.Price, p.Coop, true
	}
	return "", "", 0, 0, false
}

// Bete: an animal one raises.
type Bete struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	// Young: what its young are called.
	Young string   `json:"young"`
	Icon  string   `json:"icon"`
	Zones []string `json:"zones"`
	// Price: an adult bought (Min of them at least, the first time); Sell: an adult sold at the market,
	// SellYoung: a young one.
	Price     int `json:"price"`
	Min       int `json:"min"`
	Sell      int `json:"sell"`
	SellYoung int `json:"sellYoung"`
	// Feed: a head's food a day (and what it is); Graze: it can be led to the pasture instead (free).
	Feed      int    `json:"feed"`
	FeedLabel string `json:"feedLabel"`
	Graze     bool   `json:"graze,omitempty"`
	// Product: what it gives each day it's well (Per an adult); the eggs.
	Product string  `json:"product,omitempty"`
	Per     float64 `json:"per,omitempty"`
	// Every: the days well kept between two births (Litter young, from-to); Grow: days for a young to be grown.
	Every  int    `json:"every,omitempty"`
	Litter [2]int `json:"litter,omitempty"`
	Grow   int    `json:"grow,omitempty"`
	// Max: the most a pen keeps (adults and young).
	Max int `json:"max"`
	// Vet: the vet's visit; Herder: the bouvier's wage a day (the oxen are kept by a herder).
	Vet    int `json:"vet"`
	Herder int `json:"herder,omitempty"`
	// Pond: fish in a pond (tilapia): bought as alevins, grown, then fished and sold; no births.
	Pond  bool   `json:"pond,omitempty"`
	Pen   string `json:"pen"`
	About string `json:"about"`
}

// Betes: the animals.
var Betes = []Bete{
	{ID: "poules", Label: "Poules", Young: "poussins", Icon: "egg", Zones: anywhere, Price: 3500, Min: 3, Sell: 3000, SellYoung: 1200, Feed: 60, FeedLabel: "le maïs concassé et le son", Product: "oeufs", Per: 0.7, Every: 9, Litter: [2]int{3, 6}, Grow: 6, Max: 30, Vet: 3000, Pen: "le poulailler",
		About: "Le poulailler et son coq : nourries et abreuvées, elles pondent chaque jour ; une poule couve et les poussins sortent."},
	{ID: "pintades", Label: "Pintades", Young: "pintadeaux", Icon: "bird", Zones: tropics, Price: 4500, Min: 3, Sell: 4000, SellYoung: 1500, Feed: 70, FeedLabel: "le mil et les graines", Product: "oeufs-pintade", Per: 0.4, Every: 11, Litter: [2]int{3, 5}, Grow: 7, Max: 20, Vet: 3000, Pen: "l'enclos des pintades",
		About: "Leur plumage gris à pois blancs, leur cri qui garde la cour : elles pondent surtout en saison des pluies."},
	{ID: "lapins", Label: "Lapins", Young: "lapereaux", Icon: "rabbit", Zones: []string{ZoneSud, ZoneCentre, ZoneTempere}, Price: 6000, Min: 2, Sell: 4500, SellYoung: 1500, Feed: 80, FeedLabel: "l'herbe fraîche et les granulés", Every: 6, Litter: [2]int{3, 6}, Grow: 5, Max: 30, Vet: 3000, Pen: "les clapiers",
		About: "Les clapiers à l'ombre : de l'herbe, de l'eau propre, et les portées se suivent."},
	{ID: "chevres", Label: "Chèvres", Young: "cabris", Icon: "milk", Zones: tropics, Price: 25000, Min: 2, Sell: 20000, SellYoung: 7000, Feed: 150, FeedLabel: "le fourrage et les feuilles", Graze: true, Every: 10, Litter: [2]int{1, 2}, Grow: 8, Max: 12, Vet: 6000, Pen: "l'enclos des chèvres",
		About: "Elles mangent de tout et grimpent partout : menées au pâturage chaque jour, elles font leurs cabris."},
	{ID: "moutons", Label: "Moutons", Young: "agneaux", Icon: "sheep", Zones: []string{ZoneCentre, ZoneNord, ZoneSahel, ZoneTempere}, Price: 40000, Min: 2, Sell: 32000, SellYoung: 12000, Feed: 200, FeedLabel: "le foin et le son", Graze: true, Every: 12, Litter: [2]int{1, 2}, Grow: 9, Max: 12, Vet: 8000, Pen: "la bergerie",
		About: "La bergerie et ses brebis : au pâturage chaque jour, les agneaux arrivent ; avant la Tabaski, ils se vendent bien."},
	{ID: "porcs", Label: "Porcs", Young: "porcelets", Icon: "piggy-bank", Zones: []string{ZoneSud, ZoneCentre, ZoneTempere, ZoneContinental}, Price: 45000, Min: 2, Sell: 35000, SellYoung: 8000, Feed: 300, FeedLabel: "le son, les drêches et les restes", Every: 10, Litter: [2]int{4, 8}, Grow: 8, Max: 12, Vet: 8000, Pen: "la porcherie",
		About: "La porcherie bien propre, l'eau changée chaque jour : la truie met bas une belle portée."},
	{ID: "boeufs", Label: "Bœufs", Young: "veaux", Icon: "beef", Zones: []string{ZoneCentre, ZoneNord, ZoneSahel, ZoneContinental}, Price: 250000, Min: 2, Sell: 200000, SellYoung: 60000, Feed: 600, FeedLabel: "le fourrage et les tourteaux", Graze: true, Every: 15, Litter: [2]int{1, 1}, Grow: 12, Max: 8, Vet: 15000, Herder: 1000, Pen: "le parc à bœufs",
		About: "Le troupeau mené chaque jour aux pâturages par le bouvier, qui connaît chaque bête par son nom."},
	{ID: "tilapia", Label: "Tilapias", Young: "alevins", Icon: "fish", Zones: []string{ZoneSud, ZoneCentre}, Price: 100, Min: 50, Feed: 3, FeedLabel: "les granulés flottants", Product: "tilapia", Grow: 6, Max: 300, Vet: 5000, Pond: true, Pen: "l'étang",
		About: "L'étang creusé au bas de la parcelle, les alevins lâchés dedans : nourris chaque jour, ils grossissent, puis on pêche l'étang."},
}

func FindBete(id string) (Bete, bool) {
	i := slices.IndexFunc(Betes, func(b Bete) bool { return b.ID == id })
	if i < 0 {
		return Bete{}, false
	}
	return Betes[i], true
}

// FermeOffre: a plot one can rent or buy (or the yard at home: Home).
type FermeOffre struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	// Place, City: where it is (world/ferme.go); Home: the yard of one's own house, wherever one lives.
	Place string `json:"place,omitempty"`
	City  string `json:"city,omitempty"`
	Home  bool   `json:"home,omitempty"`
	Zone  string `json:"zone"`
	// Rows: the field's rows (a crop on all of them); Pens: how many kinds of animals it keeps.
	Rows int `json:"rows"`
	Pens int `json:"pens"`
	// Rent: a week (RentDays) rented, paid in advance; Price: bought, for good (sold back at PlotResale).
	Rent  int `json:"rent,omitempty"`
	Price int `json:"price"`
	// Crops, Animals: what does well there.
	Crops   []string `json:"crops"`
	Animals []string `json:"animals"`
	About   string   `json:"about"`
}

var (
	cocoaBelt = []string{"cacao", "cafe", "banane", "manioc", "igname", "riz", "mais", "tomate", "piment", "aubergine", "gombo"}
	northLand = []string{"coton", "mil", "sorgho", "karite", "anacarde", "mais", "riz", "tomate", "piment", "gombo"}
	smallYard = []string{"tomate", "piment", "aubergine", "gombo", "mais"}
)

// FermeOffres: the plots. The places are the villages round the towns (world/ferme.go).
var FermeOffres = []FermeOffre{
	{ID: "cour", Label: "Ta cour : le potager et le poulailler", Home: true, Zone: ZoneSud, Rows: 3, Pens: 1, Price: 12000, Crops: smallYard, Animals: []string{"poules", "pintades", "lapins"},
		About: "Derrière la maison, trois planches de légumes et un petit poulailler grillagé. Toujours à côté de toi, là où tu habites."},
	{ID: "gonate", Label: "Parcelle de Gonaté (Daloa)", Place: "ferme-gonate", City: "daloa", Zone: ZoneSud, Rows: 8, Pens: 2, Rent: 2500, Price: 150000, Crops: cocoaBelt, Animals: []string{"poules", "pintades", "chevres", "porcs", "tilapia"},
		About: "Au cœur de la boucle du cacao, sur la route d'Issia : la terre rouge de forêt, voisine des plantations des Gnaoré."},
	{ID: "sangouine", Label: "Parcelle de Sangouiné (Man)", Place: "ferme-sangouine", City: "man", Zone: ZoneSud, Rows: 7, Pens: 2, Rent: 2500, Price: 140000, Crops: []string{"cafe", "cacao", "riz", "banane", "manioc", "tomate", "piment", "gombo"}, Animals: []string{"poules", "chevres", "porcs", "tilapia"},
		About: "Au pied des montagnes, le café sous les grands arbres et le riz des bas-fonds entre les collines."},
	{ID: "djebonoua", Label: "Parcelle de Djébonoua (Bouaké)", Place: "ferme-djebonoua", City: "bouake", Zone: ZoneCentre, Rows: 8, Pens: 2, Rent: 2000, Price: 120000, Crops: []string{"igname", "mais", "anacarde", "riz", "manioc", "tomate", "piment", "aubergine", "gombo"}, Animals: []string{"poules", "pintades", "chevres", "moutons", "boeufs"},
		About: "La savane du pays baoulé : les buttes d'igname à perte de vue, les anacardiers et les bœufs au pâturage."},
	{ID: "karakoro", Label: "Parcelle de Karakoro (Korhogo)", Place: "ferme-karakoro", City: "korhogo", Zone: ZoneNord, Rows: 9, Pens: 2, Rent: 2000, Price: 110000, Crops: northLand, Animals: []string{"poules", "pintades", "chevres", "moutons", "boeufs"},
		About: "Le pays sénoufo : le coton blanc, le mil, les grands karités du parc et le troupeau mené par le bouvier."},
	{ID: "attiegouakro", Label: "Parcelle d'Attiégouakro (Yamoussoukro)", Place: "ferme-attiegouakro", City: "yamoussoukro", Zone: ZoneCentre, Rows: 8, Pens: 2, Rent: 2500, Price: 140000, Crops: []string{"igname", "manioc", "banane", "cacao", "mais", "anacarde", "tomate", "aubergine", "gombo"}, Animals: []string{"poules", "pintades", "porcs", "tilapia"},
		About: "Entre forêt et savane près de la capitale : l'igname, le manioc, et les étangs à tilapias au bord des lacs."},
	{ID: "gabiadji", Label: "Parcelle de Gabiadji (San-Pédro)", Place: "ferme-gabiadji", City: "san-pedro", Zone: ZoneSud, Rows: 8, Pens: 2, Rent: 2500, Price: 160000, Crops: []string{"cacao", "hevea", "palmier", "banane", "manioc", "tomate", "piment", "gombo"}, Animals: []string{"poules", "porcs", "tilapia"},
		About: "Le sud-ouest des grandes plantations : l'hévéa saigné à l'aube, les palmiers à huile et le cacao qui part au port."},
	{ID: "ebimpe", Label: "Parcelle d'Ebimpé (Anyama)", Place: "ferme-ebimpe", City: "abidjan", Zone: ZoneSud, Rows: 5, Pens: 2, Rent: 6000, Price: 350000, Crops: []string{"tomate", "piment", "aubergine", "gombo", "banane", "manioc", "mais", "palmier"}, Animals: []string{"poules", "lapins", "porcs", "tilapia"},
		About: "Aux portes d'Abidjan, entre ville et campagne : les maraîchers qui livrent les marchés d'Adjamé et d'Abobo."},
	{ID: "akandje", Label: "Jardins d'Akandjé (Bingerville)", Place: "ferme-akandje", City: "abidjan", Zone: ZoneSud, Rows: 4, Pens: 2, Rent: 6000, Price: 320000, Crops: []string{"tomate", "piment", "aubergine", "gombo", "manioc", "palmier"}, Animals: []string{"poules", "lapins", "tilapia"},
		About: "Au bord de la lagune Ébrié, les planches de légumes et les étangs à poissons des jardins de Bingerville."},
	// Abroad, kept light: where the climate fits.
	{ID: "bama", Label: "Parcelle de Bama (Bobo-Dioulasso)", Place: "ferme-bama", City: "bobo-dioulasso", Zone: ZoneSahel, Rows: 8, Pens: 2, Rent: 2000, Price: 100000, Crops: []string{"coton", "mil", "sorgho", "karite", "mais", "riz", "tomate", "gombo"}, Animals: []string{"poules", "pintades", "chevres", "moutons", "boeufs"},
		About: "La vallée du Kou, ses rizières irriguées et ses champs de coton : le grenier du Burkina."},
	{ID: "ejisu", Label: "Ferme d'Ejisu (Kumasi)", Place: "ferme-ejisu", City: "kumasi", Zone: ZoneSud, Rows: 7, Pens: 2, Rent: 3000, Price: 160000, Crops: []string{"cacao", "palmier", "banane", "manioc", "igname", "tomate", "piment"}, Animals: []string{"poules", "chevres", "tilapia"},
		About: "Le pays ashanti, voisin du nôtre : le même cacao sous les mêmes arbres, de l'autre côté de la frontière."},
	{ID: "loire", Label: "Maraîchage de la Loire (Nantes)", Place: "ferme-loire", City: "nantes", Zone: ZoneTempere, Rows: 6, Pens: 2, Rent: 25000, Price: 1500000, Crops: []string{"tomate", "mais"}, Animals: []string{"poules", "lapins", "moutons", "porcs"},
		About: "Les terres sableuses au bord de la Loire, leurs légumes et leurs serres ; l'hiver, rien ne pousse dehors."},
	{ID: "iowa", Label: "Ferme du comté de Polk (Des Moines)", Place: "ferme-iowa", City: "des-moines", Zone: ZoneContinental, Rows: 10, Pens: 2, Rent: 30000, Price: 2000000, Crops: []string{"mais", "tomate"}, Animals: []string{"porcs", "boeufs", "poules"},
		About: "Les grandes plaines de l'Iowa, le maïs jusqu'à l'horizon ; l'hiver est long et rude, la terre gèle."},
}

func FindOffre(id string) (FermeOffre, bool) {
	i := slices.IndexFunc(FermeOffres, func(o FermeOffre) bool { return o.ID == id })
	if i < 0 {
		return FermeOffre{}, false
	}
	return FermeOffres[i], true
}

// OffreAt: the offer whose place this is.
func OffreAt(place string) (FermeOffre, bool) {
	for _, o := range FermeOffres {
		if o.Place != "" && o.Place == place {
			return o, true
		}
	}
	return FermeOffre{}, false
}

// The rules.
const (
	// FermeMaxPlots: the plots a Sim keeps (the yard besides).
	FermeMaxPlots = 3
	// RentDays: a rent's length.
	RentDays = 7
	// PlotResale: what a plot bought sells back for.
	PlotResale = 0.8
	// ClearCost: hiring the village's young to clear it with you (else it's done alone, tiring); PloughCost,
	// the motoculteur rented for the day (the daba is free, and tiring).
	ClearCost  = 1500
	PloughCost = 2500
	// TreatCost: the natural treatment (the neem's juice, the ash, the piment) for a field.
	TreatCost = 400
	// ManoeuvreDay: the farmhand paid by the day to water, weed and feed while one is away.
	ManoeuvreDay = 600
	// PestChance: a field's chance a day of catching its pests (halved with an agronome's eye).
	PestChance = 0.1
	// SickChance: a pen's chance a day of a sick animal (more when tired).
	SickChance      = 0.03
	SickChanceTired = 0.08
	// OutOfSeason: what a crop sown out of its season yields, and a tree harvested out of its season.
	OutOfSeason = 0.7
	OffSeason   = 0.45
	// FermeCatchUp: the most days brought up at once (away longer: the rest just passes).
	FermeCatchUp = 60
)

// FermeSkillBonus: what the farming skill adds to a harvest (2 % a level past the first).
func FermeSkillBonus(level int) float64 { return 1 + 0.02*float64(max(0, level-1)) }

// ScoreFactor: a mini-game's score (0–100) as a harvest's or a pen's factor (0.9 to 1.1): bounded, never a gain
// beyond the day's cap.
func ScoreFactor(score int) float64 {
	score = max(0, min(100, score))
	return 0.9 + 0.2*float64(score)/100
}

// InSow: whether this crop is sown in its season now (empty: all year).
func (c Culture) InSow(month int) bool { return len(c.Sow) == 0 || slices.Contains(c.Sow, month) }

// InSeason: whether a tree is in its harvest months (empty: all year).
func (c Culture) InSeason(month int) bool {
	return len(c.Season) == 0 || slices.Contains(c.Season, month)
}

// GrowsIn: whether it grows in that climate.
func (c Culture) GrowsIn(zone string) bool { return slices.Contains(c.Zones, zone) }

// LivesIn: whether the animal is raised in that climate.
func (b Bete) LivesIn(zone string) bool { return slices.Contains(b.Zones, zone) }

// HarvestUnits: what a field yields: its rows, the crop's yield, how well it was kept (quality 0.5–1.1), the
// season, the skill, the game's score.
func HarvestUnits(c Culture, rows int, quality float64, season float64, skillLevel, score int, bonus float64) int {
	u := float64(rows*c.Yield) * quality * season * FermeSkillBonus(skillLevel) * ScoreFactor(score) * bonus
	return max(1, int(math.Round(u)))
}

// FermeRoll: a farm's fixed roll for a thing on a day (pests, births, sickness).
func FermeRoll(what, id string, day int64) float64 {
	return fermeRoll(what, id, strconv.FormatInt(day, 10))
}

// The careers of the land.
const (
	AgriculteurCareer = "agriculteur"
	EleveurCareer     = "eleveur"
	OuvrierCareer     = "ouvrier-agricole"
	AgronomeCareer    = "agronome"
	VeterinaireCareer = "veterinaire"
)

// FermeCareers: their ids (the phone hides them while « agriculture » is shut).
var FermeCareers = []string{AgriculteurCareer, EleveurCareer, OuvrierCareer, AgronomeCareer, VeterinaireCareer}

func IsFermeCareer(id string) bool { return slices.Contains(FermeCareers, id) }

var fermeCareers = []Career{
	{ID: AgriculteurCareer, Label: "Agriculture", Icon: "sprout", Kind: FermeKind, Also: []string{CoopKind}, MinHour: 5, MaxHour: 11, Minutes: 7 * 60,
		Effect: Needs{Energy: -40, Hygiene: -25, Hunger: -20, Fun: 5, Social: 10},
		Levels: []Level{{"Aide-planteur·se", 1800}, {"Planteur·se", 2600}, {"Chef·fe de plantation", 3600}, {"Grand·e planteur·se", 4800}, {"Président·e de coopérative", 6200}}},
	{ID: EleveurCareer, Label: "Élevage", Icon: "beef", Kind: FermeKind, Also: []string{VetoKind}, MinHour: 5, MaxHour: 12, Minutes: 7 * 60,
		Effect: Needs{Energy: -35, Hygiene: -25, Hunger: -20, Fun: 5, Social: 5},
		Levels: []Level{{"Aide-éleveur·se", 1800}, {"Éleveur·se", 2600}, {"Éleveur·se confirmé·e", 3500}, {"Chef·fe d'élevage", 4700}, {"Grand·e éleveur·se", 6000}}},
	{ID: OuvrierCareer, Label: "Ouvrier agricole", Icon: "shovel", Kind: FermeKind, MinHour: 5, MaxHour: 10, Minutes: 7 * 60,
		Effect: Needs{Energy: -45, Hygiene: -30, Hunger: -25, Social: 10},
		Levels: []Level{{"Manœuvre agricole", 1600}, {"Ouvrier·ère agricole", 2100}, {"Chef·fe d'équipe", 2800}, {"Contremaître", 3600}, {"Régisseur·se de domaine", 4500}}},
	{ID: AgronomeCareer, Label: "Agronomie", Icon: "microscope", Kind: CoopKind, Also: []string{FermeKind}, MinHour: 7, MaxHour: 11, Minutes: 8 * 60,
		Effect: Needs{Energy: -30, Hygiene: -10, Hunger: -20, Social: 15},
		Levels: []Level{{"Technicien·ne agricole", 2800}, {"Agronome", 4000}, {"Agronome principal·e", 5400}, {"Chef·fe de projet agricole", 7000}, {"Directeur·rice de recherche agronomique", 8600}}},
	{ID: VeterinaireCareer, Label: "Santé animale", Icon: "stethoscope", Kind: VetoKind, Also: []string{FermeKind}, MinHour: 7, MaxHour: 12, Minutes: 8 * 60,
		Effect: Needs{Energy: -35, Hygiene: -15, Hunger: -20, Social: 15},
		Levels: []Level{{"Auxiliaire vétérinaire", 2600}, {"Vétérinaire assistant·e", 3800}, {"Vétérinaire", 5200}, {"Vétérinaire chef·fe de clinique", 6800}, {"Directeur·rice des services vétérinaires", 8400}}},
}

// The diploma gates (DiplomaGates; the BEPC alone for the trades of the land, SmallTrades).
var fermeGates = map[string]Gate{
	AgronomeCareer:    {Level: 1, Rank: 3, Filieres: []string{"sciences", "genie"}, Label: "une Licence (ou plus) en sciences ou en génie"},
	VeterinaireCareer: {Level: 2, Rank: 5, Filieres: []string{"sciences", "medecine", "pharmacie"}, Label: "un Master (ou plus) en sciences, en médecine ou en pharmacie"},
}

var fermeTasks = map[string][]JobTask{
	AgriculteurCareer: {
		{ID: "semis", Label: "Semer une ligne de maïs", Icon: "sprout", Pose: "pick", Lines: []string{"Trois graines par poquet, bien en ligne : le vieux du village approuve.", "La ligne est droite jusqu'au bout du champ.", "La terre est encore humide de la pluie d'hier : parfait pour semer."}},
		{ID: "desherbage", Label: "Désherber à la daba", Icon: "shovel", Pose: "carry", Lines: []string{"Les mauvaises herbes arrachées, le maïs respire.", "Une planche entière nettoyée avant la chaleur.", "La daba chante sur la terre sèche."}},
		{ID: "cueillette", Label: "Récolter les cabosses", Icon: "bean", Pose: "pick", Lines: []string{"Les cabosses jaunes coupées, les vertes laissées pour plus tard.", "Un panier plein, porté sur la tête jusqu'au tas.", "L'écabossage au coupe-coupe, les fèves blanches dans les feuilles."}},
		{ID: "pesee", Label: "Peser les sacs à la coopérative", Icon: "scale", Pose: "point", MinLevel: 2, Lines: []string{"La balance est juste : le prix aussi.", "Les sacs de fèves séchées comptés un à un.", "Le reçu signé : les planteurs repartent contents."}},
	},
	EleveurCareer: {
		{ID: "nourrir", Label: "Nourrir les bêtes", Icon: "wheat", Pose: "carry", Lines: []string{"Le son versé dans les mangeoires : tout le monde se presse.", "Le fourrage frais réparti, chacun sa part.", "Les poules accourent au bruit du seau de maïs."}},
		{ID: "abreuver", Label: "Changer l'eau des abreuvoirs", Icon: "droplets", Pose: "carry", Lines: []string{"L'eau fraîche de la pompe, les abreuvoirs propres.", "Le seau rempli dix fois : les bêtes boivent longtemps.", "Les abreuvoirs frottés, l'eau claire comme au puits."}},
		{ID: "paturage", Label: "Mener le troupeau au pâturage", Icon: "footprints", Pose: "point", Lines: []string{"Le troupeau suit le bâton, tranquille, jusqu'à l'herbe verte.", "Une chèvre têtue ramenée dans le rang.", "Retour au parc avant la nuit, toutes les bêtes comptées."}},
		{ID: "soins", Label: "Soigner une bête avec le vétérinaire", Icon: "stethoscope", Pose: "direct", MinLevel: 2, Lines: []string{"Le vaccin fait, la bête repart brouter.", "Une patte bandée, elle marche déjà mieux.", "Le carnet de santé du troupeau tenu à jour."}},
	},
	OuvrierCareer: {
		{ID: "defricher", Label: "Défricher à la machette", Icon: "axe", Pose: "carry", Lines: []string{"Les broussailles coupées, le champ apparaît.", "Les branches rangées en tas, rien n'est brûlé.", "Le coupe-coupe aiguisé, le travail avance vite."}},
		{ID: "buttes", Label: "Monter les buttes d'igname", Icon: "shovel", Pose: "carry", Lines: []string{"Une rangée de belles buttes rondes.", "La terre retournée, bien meuble pour les semenceaux.", "Le chef d'équipe compte : vingt buttes de plus."}},
		{ID: "porter", Label: "Porter les régimes au camion", Icon: "package", Pose: "carry", Lines: []string{"Les régimes chargés sans en abîmer un.", "Le camion part plein vers le marché.", "Une pause à l'ombre, de l'eau fraîche, et on reprend."}},
	},
	AgronomeCareer: {
		{ID: "sol", Label: "Analyser la terre d'un champ", Icon: "flask-conical", Pose: "write", Lines: []string{"Le sol manque un peu de matière : le compost fera l'affaire.", "La terre est bonne : le planteur sourit.", "Les échantillons étiquetés partent au labo."}},
		{ID: "conseil", Label: "Conseiller les planteurs", Icon: "messages-square", Pose: "direct", Lines: []string{"Le neem contre les chenilles, sans produit chimique.", "Semer en ligne, c'est moins de semences et plus de récolte.", "Les plants malades arrachés à temps : la parcelle est sauvée."}},
		{ID: "essai", Label: "Suivre la parcelle d'essai", Icon: "clipboard-list", Pose: "write", MinLevel: 1, Lines: []string{"La nouvelle variété de manioc pousse plus vite.", "Les mesures notées, ligne par ligne.", "Le rapport de la saison envoyé à la coopérative."}},
	},
	VeterinaireCareer: {
		{ID: "vaccin", Label: "Vacciner le poulailler", Icon: "syringe", Pose: "direct", Lines: []string{"Trois cents poules vaccinées, aucune oubliée.", "Le poulailler protégé pour la saison.", "L'éleveur note la date dans son carnet."}},
		{ID: "consultation", Label: "Recevoir une chèvre malade", Icon: "stethoscope", Pose: "direct", Lines: []string{"Un peu de fièvre : le bon remède, et du repos.", "Elle repart en bêlant, sa propriétaire rassurée.", "Les sabots nettoyés et soignés."}},
		{ID: "tournee", Label: "La tournée des villages", Icon: "car", Pose: "point", MinLevel: 2, Lines: []string{"Cinq troupeaux visités avant midi.", "Le bouvier attendait au bord de la piste.", "Les veaux de la saison tous en bonne santé."}},
	},
}

// The places' activities: the village plots (the planters' help, the tour of the fields, the meal at the
// campement), the coopérative, the vet's.
var FermeActs = map[string][]Interaction{
	FermeKind: {
		{ID: "ferme-coup-de-main", Ages: TeensUp, Label: "Donner un coup de main aux planteurs du village", Icon: "shovel", Minutes: 3 * 60, Cost: -2000, Effect: Needs{Fun: 15, Social: 20, Energy: -25, Hygiene: -15}, MinHour: 6, MaxHour: 14},
		{ID: "ferme-tour-champs", Label: "Faire le tour des champs avec un ancien du village", Icon: "footprints", Minutes: 45, Effect: Needs{Fun: 20, Social: 20, Energy: -5}, MinHour: 7, MaxHour: 18},
		{ID: "ferme-campement", Label: "Manger au campement : foutou et sauce graine", Icon: "cooking-pot", Minutes: 40, Cost: 1000, Effect: Needs{Hunger: 60, Social: 10}, MinHour: 11, MaxHour: 20},
		{ID: "ferme-appatam", Label: "Se reposer à l'ombre de l'appatam", Icon: "tent", Minutes: 30, Effect: Needs{Energy: 15, Fun: 5, Social: 5}, MinHour: 11, MaxHour: 17},
	},
	CoopKind: {
		{ID: "coop-formation", Label: "Suivre la formation des planteurs (semis, produits naturels)", Icon: "book-open", Minutes: 60, Effect: Needs{Fun: 10, Social: 15, Energy: -5}, MinHour: 8, MaxHour: 16, Days: Weekdays},
		{ID: "coop-pesee", Label: "Regarder la pesée des sacs à la coopérative", Icon: "scale", Minutes: 30, Effect: Needs{Fun: 15, Social: 15}, MinHour: 7, MaxHour: 17},
	},
	VetoKind: {
		{ID: "veto-tournee", Ages: TeensUp, Label: "Accompagner le vétérinaire dans sa tournée", Icon: "car", Minutes: 90, Effect: Needs{Fun: 25, Social: 15, Energy: -10}, MinHour: 8, MaxHour: 15},
		{ID: "veto-conseils", Label: "Demander conseil pour ses bêtes", Icon: "messages-square", Minutes: 20, Effect: Needs{Social: 10, Fun: 5}, MinHour: 8, MaxHour: 17},
	},
}

// FermeActIDs: the activities the update brings (features.go).
func FermeActIDs() []string {
	var out []string
	for _, k := range []string{FermeKind, CoopKind, VetoKind} {
		for _, it := range FermeActs[k] {
			out = append(out, it.ID)
		}
	}
	return out
}

// FermeStage: a field's stage, as the phone shows it.
const (
	StageFriche   = "friche"   // to clear
	StageDefriche = "defriche" // cleared, to plough
	StageLaboure  = "laboure"  // ploughed, to sow
	StagePousse   = "pousse"   // sown, growing
	StageMur      = "mur"      // ripe: to harvest
)

// FermeToday: the game day of an instant.
func FermeToday(t time.Time) int64 { return DayOf(MinuteOf(t)) }

func init() {
	Careers = append(Careers, fermeCareers...)
	for id, ts := range fermeTasks {
		jobTasks[id] = ts
	}
	for id, g := range fermeGates {
		DiplomaGates[id] = g
	}
	// The trades of the land ask for the BEPC alone (examens.go), the agronome and the vet the bac too.
	SmallTrades = append(SmallTrades, AgriculteurCareer, EleveurCareer, OuvrierCareer)
	Caps[FromFerme] = Cap{Djai: FermeCap, Full: "La coopérative et le marché ont assez acheté à ta ferme aujourd'hui : le reste attend au grenier jusqu'à demain."}
	Skills = append(Skills, Skill{ID: SkillAgri, Label: "Agriculture", Icon: "sprout", Hint: "Ta parcelle et tes bêtes (appli Ferme), la formation de la coopérative"})
	Moodlets["belle-recolte"] = MoodletDef{"Une belle récolte", "wheat", 2, 240}
	Moodlets["naissance-ferme"] = MoodletDef{"Des petits sont nés à la ferme", "heart", 2, 240}
	Kinds[FermeKind] = PlaceKind{ID: FermeKind, Label: "Parcelles du village", Icon: "sprout", Events: []RandomEvent{
		{Text: "Une vieille du village te tend une mangue bien mûre : « Pour la route ! »", Effect: Needs{Hunger: 10, Social: 10}},
		{Text: "Une averse passe sur les champs : tout le monde court sous l'appatam, en riant.", Effect: Needs{Social: 10, Hygiene: -5}},
		{Text: "Les enfants du village courent derrière les pintades.", Effect: Needs{Fun: 10}},
	}}
	Kinds[CoopKind] = PlaceKind{ID: CoopKind, Label: "Coopérative Ensemble", Icon: "warehouse", Events: []RandomEvent{
		{Text: "Le tableau du jour affiche le prix des fèves : les planteurs comparent, contents.", Effect: Needs{Social: 10}},
	}}
	Kinds[VetoKind] = PlaceKind{ID: VetoKind, Label: "Cabinet vétérinaire", Icon: "stethoscope", Events: []RandomEvent{
		{Text: "Un cabri de quelques jours tète son biberon dans la salle d'attente.", Effect: Needs{Fun: 10}},
	}}
	addActs(FermeActs)
}
