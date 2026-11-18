package game

import (
	"math"
	"time"
)

// Mon quartier (the update « mon-quartier », sims/monquartier.go): each Sim's own few streets around its
// home, which it grows building by building. The buildings and their prices are all in one table below;
// a level unlocks more of them, and the level comes from the quartier's reputation (buildings opened,
// their customers, the players who come to visit, the demandes done). The money a building makes waits in
// it till its owner collects it, a week at most, the tax off, under the same daily limit as the rents
// (FromEstate): a quartier pays, it doesn't make Djai endless. Nothing runs in the background: a quartier
// is moved on to now each time it's read (SettleQuartier), so the database sleeps when nobody plays.

// MonQuartierKey is the update.
const MonQuartierKey = "mon-quartier"

// QuartierRadius: the reach (m) round a quartier's anchor in its commune where the other players' quartiers
// and homes count as its neighbours (GET /quartiers/{id}/area); the quartier itself is its own world.
const QuartierRadius = 600

// QuartierKind is a building one can put up in one's quartier.
type QuartierKind struct {
	ID    string `json:"kind"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	About string `json:"about"`
	// Level: the quartier's level it needs; Price: what building it costs (F); Max: how many a quartier may have.
	Level int `json:"level"`
	Price int `json:"price"`
	Max   int `json:"max"`
	// Shop: the business it runs (ShopKinds: its takings per person working, its staff's wages); none, it
	// brings Day a day by itself (a rent, a fee, the market's stalls).
	Shop string `json:"-"`
	Day  int    `json:"-"`
	// Staff: the most people working there (0: nobody to hire); Rep: the reputation its customers and
	// neighbours bring a day while it's open.
	Staff int `json:"staff"`
	Rep   int `json:"-"`
}

// QuartierKinds: every building, in the order of the levels (one table for every price).
var QuartierKinds = []QuartierKind{
	{ID: "maison", Label: "Maison à louer", Icon: "house", About: "Une maison dans ta rue, louée à une famille.", Level: 1, Price: 150000, Max: 3, Day: 2500, Rep: 2},
	{ID: "boutique", Label: "Boutique", Icon: "store", About: "Riz, huile, crédit téléphone. Vend toute la journée.", Level: 1, Price: 120000, Max: 2, Shop: "boutique", Staff: 3, Rep: 4},
	{ID: "grin", Label: "Grin", Icon: "coffee", About: "Le thé et les causeries du quartier. Les habitués font ta réputation.", Level: 1, Price: 30000, Max: 1, Rep: 6},
	{ID: "maquis", Label: "Maquis", Icon: "utensils", About: "Chaises, grill, guirlandes. Les voisins viennent manger le soir.", Level: 2, Price: 250000, Max: 1, Shop: "maquis", Staff: 4, Rep: 8},
	{ID: "salon", Label: "Salon de coiffure", Icon: "scissors", About: "Tresses et coupes. Les PNJ et les joueurs s'y font coiffer.", Level: 2, Price: 180000, Max: 1, Shop: "salon", Staff: 3, Rep: 5},
	{ID: "cabine", Label: "Cabine Mobile Money", Icon: "smartphone", About: "Petit revenu régulier.", Level: 2, Price: 60000, Max: 2, Day: 1800, Rep: 3},
	{ID: "terrain", Label: "Terrain de foot", Icon: "volleyball", About: "Les jeunes du quartier y jouent tous les soirs.", Level: 3, Price: 300000, Max: 1, Rep: 15},
	{ID: "arret_gbaka", Label: "Arrêt de gbaka", Icon: "bus", About: "Les gbakas s'arrêtent chez toi : du passage et un petit droit de stationnement.", Level: 3, Price: 200000, Max: 1, Day: 2000, Rep: 10},
	{ID: "eclairage", Label: "Éclairage public", Icon: "lamp-floor", About: "Des lampadaires : la rue vit aussi la nuit.", Level: 3, Price: 80000, Max: 1, Rep: 6},
	{ID: "ecole", Label: "École", Icon: "school", About: "Une école primaire : les familles veulent habiter chez toi.", Level: 4, Price: 900000, Max: 1, Day: 6000, Rep: 20},
	{ID: "pharmacie", Label: "Pharmacie", Icon: "pill", About: "La croix verte du quartier.", Level: 4, Price: 600000, Max: 1, Shop: "pharmacie", Staff: 3, Rep: 12},
	{ID: "marche", Label: "Marché", Icon: "shopping-basket", About: "Des étals couverts : les commerçantes te paient leur place.", Level: 4, Price: 750000, Max: 1, Day: 9000, Rep: 15},
	{ID: "salle_fetes", Label: "Salle des fêtes", Icon: "party-popper", About: "Mariages, baptêmes, anniversaires : on la loue tous les week-ends.", Level: 5, Price: 1500000, Max: 1, Day: 15000, Rep: 25},
	{ID: "immeuble", Label: "Immeuble", Icon: "hotel", About: "Huit appartements loués à la journée.", Level: 5, Price: 2500000, Max: 1, Day: 24000, Rep: 10},
}

// FindQuartierKind: a building by its kind.
func FindQuartierKind(id string) (QuartierKind, bool) {
	for _, k := range QuartierKinds {
		if k.ID == id {
			return k, true
		}
	}
	return QuartierKind{}, false
}

// quartierPlaceKinds: the street's place kind each building runs once opened (its menu of actions and
// prices, its inside), the first one the game has (web components/quartier/useQuartier.ts PLACE_KIND, the same).
var quartierPlaceKinds = map[string][]string{
	"boutique":    {"boutique"},
	"maquis":      {"maquis"},
	"salon":       {"salon"},
	"cabine":      {"mobile-money", "boutique"},
	"pharmacie":   {"pharmacie"},
	"marche":      {"market"},
	"ecole":       {"school"},
	"grin":        {"grin"},
	"terrain":     {"sport"},
	"salle_fetes": {"salle-fetes", "club"},
}

// QuartierPlaceKind: the place a building of a quartier is in the street (none: nothing to do inside).
func QuartierPlaceKind(kind string) (PlaceKind, bool) {
	for _, id := range quartierPlaceKinds[kind] {
		if k, ok := Kinds[id]; ok {
			return k, true
		}
	}
	return PlaceKind{}, false
}

// A visitor's purchase at someone's quartier building: the owner's share of the price (the goods cost the
// rest), at most QuartierSaleMax a time, waiting in the building like its takings; and RepSale reputation,
// once a day for each buyer.
const (
	QuartierSaleShare = 0.5
	QuartierSaleMax   = 5000
	RepSale           = 2
)

// QuartierSale: what the owner earns when a visitor pays `cost` at its building.
func QuartierSale(cost int) int {
	if cost <= 0 {
		return 0
	}
	return min(QuartierSaleMax, int(math.Round(float64(cost)*QuartierSaleShare)))
}

// QuartierLevels: the reputation each level needs (index 0: level 1).
var QuartierLevels = []int{0, 100, 300, 700, 1500}

// Reputation won: a building opened (its level times this, plus the base), a player's visit (once a day
// for each visitor), a demande done.
const (
	RepOpenBase   = 20
	RepOpenPerLvl = 10
	RepVisit      = 5
	RepErrand     = 10
)

// QuartierLevel: the level a reputation reaches (a pioneer starts at 2).
func QuartierLevel(rep int, pionnier bool) int {
	lvl := 1
	for i, need := range QuartierLevels {
		if rep >= need {
			lvl = i + 1
		}
	}
	if pionnier && lvl < 2 {
		lvl = 2
	}
	return lvl
}

// NextQuartierLevel: the next level and the reputation it needs (0, 0 at the top).
func NextQuartierLevel(level int) (int, int) {
	if level >= len(QuartierLevels) {
		return 0, 0
	}
	return level + 1, QuartierLevels[level]
}

// RepForOpening: what opening a building brings.
func RepForOpening(k QuartierKind) int { return RepOpenBase + RepOpenPerLvl*k.Level }

// QuartierPerDay: what a building brings a day, the wages off (a shop with nobody working sells nothing).
func QuartierPerDay(k QuartierKind, staff int, commune string) int {
	if s, ok := FindShopKind(k.Shop); ok {
		if staff <= 0 {
			return 0
		}
		return ShopSales(s, staff, commune, 100) - staff*Wage
	}
	return int(math.Round(float64(k.Day)*shopFactor(commune)/50) * 50)
}

// QBuilding is a building's money as kept between two visits.
type QBuilding struct {
	Kind    string
	Staff   int
	Pending int
	Last    time.Time
}

// Settle moves the building's money on to now, hour by hour, a week's worth waiting at most.
func (b *QBuilding) Settle(commune string, now time.Time) {
	if b.Last.IsZero() || !now.After(b.Last) {
		if b.Last.IsZero() {
			b.Last = now
		}
		return
	}
	k, ok := FindQuartierKind(b.Kind)
	if !ok {
		b.Last = now
		return
	}
	hours := int(now.Sub(b.Last) / time.Hour)
	if hours <= 0 {
		return
	}
	day := QuartierPerDay(k, b.Staff, commune)
	// (Never below what's there: the visitors' purchases (QuartierSale) wait in it beyond the week's takings.)
	b.Pending = max(b.Pending, min(day*PendingDays, b.Pending+day*min(hours, 24*PendingDays)/24))
	b.Last = b.Last.Add(time.Duration(hours) * time.Hour)
}

// Collect: what the owner takes now (the tax off, up to `left`, the day's limit), and the tax.
func (b *QBuilding) Collect(left int) (got, tax int) {
	e := Estate{Pending: b.Pending}
	got, tax = e.Collect(left)
	b.Pending = e.Pending
	return got, tax
}

// QuartierRepGain: the reputation the open buildings' customers bring from `last` to now (a week's worth
// at most for an owner away), and the moment it's counted up to: only whole points move the clock on, so
// no fraction is lost between two reads.
func QuartierRepGain(repPerDay int, last, now time.Time) (int, time.Time) {
	if repPerDay <= 0 || !now.After(last) {
		return 0, now
	}
	if gap := now.Sub(last); gap > PendingDays*24*time.Hour {
		last = now.Add(-PendingDays * 24 * time.Hour)
	}
	gain := int(float64(repPerDay) * now.Sub(last).Hours() / 24)
	if gain <= 0 {
		return 0, last
	}
	return gain, last.Add(time.Duration(float64(gain) / float64(repPerDay) * 24 * float64(time.Hour)))
}

// QuartierLots: how many lots one may build on in one's quartier (the « slot » of a building is its lot).
// Since the third layout (univers.go) a quartier is its own world, generated on the phone from its seed and
// preset: a lot is a number there, laid out along that world's streets; the server keeps only the number.
const QuartierLots = 30

// QuartierLotLayout: the version of the lots' places; a building kept under an older one (v1: a ring of slots
// round the home; v2: lots among the real streets round it) keeps its number as its lot in the quartier's own
// world when its quartier is read (sims/monquartier.go migrateLots).
const QuartierLotLayout = 3

// spotRng: the street's seeded draw (web world3d/themes.ts rng): the same numbers from the same seed on the
// server as on every phone.
func spotRng(seed string) func() float64 {
	h := uint32(2166136261)
	for _, c := range seed {
		h = (h ^ uint32(c)) * 16777619
	}
	return func() float64 {
		h = (h ^ (h >> 15)) * 2246822507
		h = (h ^ (h >> 13)) * 3266489909
		h ^= h >> 16
		return float64(h) / 4294967296
	}
}

// StreetHome: where the street draws a Sim's home in its commune when its lot wasn't set on the map (web
// world3d/open/OpenWorld.tsx homeSpot, lotSpot.ts for one's own house: the first lot's key is the Sim's id),
// from the commune's centre: a quartier is centred there, so every phone sees its lots round the same home.
func StreetHome(simID string, ownHouse bool, lat, lng float64) (float64, float64) {
	seed, d0, dr := "home"+simID, 120.0, 260.0
	if ownHouse {
		seed, d0, dr = "lot"+simID, 140, 300
	}
	r := spotRng(seed)
	a := r() * 2 * math.Pi
	d := d0 + r()*dr
	// The street's metres: x east, z south.
	x, z := math.Cos(a)*d, math.Sin(a)*d
	return lat - z/110574, lng + x/(math.Cos(lat*math.Pi/180)*111320)
}

// MetresFrom: a point's metres east and north of another (the inverse of OffsetLatLng).
func MetresFrom(lat0, lng0, lat, lng float64) (east, north float64) {
	const m = 111320.0
	return (lng - lng0) * m * math.Cos(lat0*math.Pi/180), (lat - lat0) * m
}

// QuartierMoveMin: how far (m) the Sim's home may move from its quartier's centre before the quartier is offered
// to follow it (closer, its lots still stand round the home). Another commune always counts.
const QuartierMoveMin = 150.0

// QuartierHomeMoved: whether the home (where it is now) has left its quartier behind, and the owner wasn't already
// asked about this same home (stay: the home it chose to keep the quartier away from, if any).
func QuartierHomeMoved(qCommune string, qLat, qLng float64, hCommune string, hLat, hLng float64, stay *[2]float64) bool {
	far := func(lat, lng float64) bool {
		e, n := MetresFrom(lat, lng, hLat, hLng)
		return math.Hypot(e, n) > QuartierMoveMin
	}
	if qCommune == hCommune && !far(qLat, qLng) {
		return false
	}
	return stay == nil || far(stay[0], stay[1])
}

// OffsetLatLng: a point moved east and north by metres.
func OffsetLatLng(lat, lng, east, north float64) (float64, float64) {
	const m = 111320.0
	return lat + north/m, lng + east/(m*math.Cos(lat*math.Pi/180))
}
