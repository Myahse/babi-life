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

// QuartierRadius: the quartier's radius in metres (a weak phone may load half of it, the client decides).
const QuartierRadius = 300

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
	b.Pending = min(day*PendingDays, b.Pending+day*min(hours, 24*PendingDays)/24)
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

// QuartierSlots: how many spots a quartier's layout has.
const QuartierSlots = 18

// QuartierSlotSpot: where a slot is, in metres east and north of the centre, and the heading (radians) its
// front faces: rings of six around the home, each ring further out and turned half a step, facing in.
func QuartierSlotSpot(slot int) (east, north, heading float64) {
	ring := slot / 6
	i := slot % 6
	r := 45.0 + 40*float64(ring)
	a := (float64(i) + 0.5*float64(ring%2)) * math.Pi / 3
	east, north = r*math.Cos(a), r*math.Sin(a)
	// Facing the centre: the heading points from the spot back to the home.
	return east, north, math.Atan2(-east, -north)
}

// OffsetLatLng: a point moved east and north by metres.
func OffsetLatLng(lat, lng, east, north float64) (float64, float64) {
	const m = 111320.0
	return lat + north/m, lng + east/(m*math.Cos(lat*math.Pi/180))
}
