package game

import (
	"math"
	"time"
)

// Being a landlord and a boss (the update « immobilier », sims/estate.go): past one's own house, a
// building on a big lot that works for its owner. An apartment block (immeuble) whose flats are let to
// the game's tenants, the same with a shop on the ground floor, and the tower (tour) whose floors are let
// as offices, with a shop below. Tenants pay by the day while the building is kept up; the shop sells with
// the staff its owner hires (the game's people, paid a wage a day). The money waits in the building till
// the owner comes to collect it, a week at most, the tax taken; what's collected has its own daily limit
// (FromEstate), out of the day's total, as Dodo's rentals: a building pays, it doesn't make Djai endless.

// Estate kinds.
const (
	EstateImmeuble = "immeuble"
	EstateTour     = "tour"
)

// EstatePlan: what a building plan lets: its units (flats, or offices for a tower) and whether it has a shop.
type EstatePlan struct {
	Kind  string `json:"kind"`
	Units int    `json:"units"`
	Shop  bool   `json:"shop"`
	// Hours: how long the masons take (a building isn't a house's afternoon).
	Hours int `json:"hours"`
}

// EstatePlans: the building plans, by plan id.
var EstatePlans = map[string]EstatePlan{
	"immeuble":          {Kind: EstateImmeuble, Units: 8, Hours: 3},
	"immeuble-commerce": {Kind: EstateImmeuble, Units: 6, Shop: true, Hours: 4},
	"tour":              {Kind: EstateTour, Units: 12, Shop: true, Hours: 12},
}

// ShopKind is a business on a building's ground floor.
type ShopKind struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	// FitOut: what fitting it out costs; Sales: a day's takings for each one working there (Yopougon's prices);
	// Staff: the most it takes.
	FitOut int `json:"fitOut"`
	Sales  int `json:"sales"`
	Staff  int `json:"staff"`
}

// ShopKinds: the businesses one can open.
var ShopKinds = []ShopKind{
	{ID: "boutique", Label: "Boutique de quartier", Icon: "store", FitOut: 60000, Sales: 6400, Staff: 3},
	{ID: "maquis", Label: "Maquis", Icon: "utensils", FitOut: 90000, Sales: 8400, Staff: 4},
	{ID: "salon", Label: "Salon de coiffure", Icon: "scissors", FitOut: 70000, Sales: 7200, Staff: 3},
	{ID: "pharmacie", Label: "Pharmacie", Icon: "pill", FitOut: 150000, Sales: 10400, Staff: 3},
	{ID: "supermarche", Label: "Supermarché", Icon: "shopping-cart", FitOut: 200000, Sales: 9200, Staff: 6},
}

func FindShopKind(id string) (ShopKind, bool) {
	for _, k := range ShopKinds {
		if k.ID == id {
			return k, true
		}
	}
	return ShopKind{}, false
}

const (
	// Wage: what one of the shop's staff is paid a day.
	Wage = 1500
	// EstateTax: the share of what's collected that goes to the taxes (impôt foncier, patente).
	EstateTax = 0.10
	// WearPerDay: how much of its upkeep a building loses a day (100: like new).
	WearPerDay = 3.0
	// RepairPerPoint: what one point of upkeep costs to get back, for each unit.
	RepairPerPoint = 120
	// PendingDays: the most days of money that wait in a building for its owner.
	PendingDays = 7
)

// StaffNames: the people one hires.
var StaffNames = []string{"Aminata", "Koffi", "Mariam", "Yao", "Fatou", "Ibrahim", "Adjoua", "Serge", "Awa", "Moussa", "Akissi", "Didier", "Bintou", "Konan", "Ruth", "Seydou"}

// UnitRent: a day's rent for one flat (an office: two and a half), by the commune's land price.
func UnitRent(commune, kind string) int {
	m2, ok := LotPricePerM2[commune]
	if !ok {
		m2 = DefaultLotPrice
	}
	r := float64(m2) * 3
	if kind == EstateTour {
		r *= 2.5
	}
	return int(math.Round(r/50) * 50)
}

// shopFactor: how much more a shop sells in a dear commune than in Yopougon.
func shopFactor(commune string) float64 {
	m2, ok := LotPricePerM2[commune]
	if !ok {
		m2 = DefaultLotPrice
	}
	return math.Max(0.6, math.Min(3, float64(m2)/1500))
}

// ShopSales: a day's takings for a shop with that many people working, in that commune, that well kept.
func ShopSales(k ShopKind, staff int, commune string, upkeep float64) int {
	return int(float64(k.Sales*min(staff, k.Staff)) * shopFactor(commune) * (0.5 + upkeep/200))
}

// TenantsWanted: how many units are let in a building this well kept (a run-down one empties).
func TenantsWanted(units int, upkeep float64) int {
	return int(math.Round(float64(units) * math.Max(0, math.Min(1, (upkeep-20)/60))))
}

// Estate is a building's state, as kept between two visits.
type Estate struct {
	Kind    string  `json:"kind"`
	Units   int     `json:"units"`
	Tenants int     `json:"tenants"`
	Upkeep  float64 `json:"upkeep"`
	Shop    string  `json:"shop,omitempty"`
	Staff   []Staff `json:"staff"`
	Pending int     `json:"pending"`
	// Hours: the hours already counted of the day running (tenants come and go once a day).
	Hours int       `json:"-"`
	Last  time.Time `json:"-"`
}

// Staff is someone working in the shop.
type Staff struct {
	Name  string    `json:"name"`
	Since time.Time `json:"since"`
}

// DayGross: what the building brings a day as it stands (rents and the shop's takings, the wages taken off).
func (e Estate) DayGross(commune string) int {
	g := e.Tenants * UnitRent(commune, e.Kind)
	if k, ok := FindShopKind(e.Shop); ok && len(e.Staff) > 0 {
		g += ShopSales(k, len(e.Staff), commune, e.Upkeep) - len(e.Staff)*Wage
	}
	return g
}

// Settle moves the building on to now: hour by hour, the rents and the shop's takings come in (the wages
// go out), the building wears, and once a day the tenants come or leave as its upkeep says. What waits
// stops at a week's worth.
func (e *Estate) Settle(commune string, now time.Time) {
	if e.Last.IsZero() || !now.After(e.Last) {
		if e.Last.IsZero() {
			e.Last = now
		}
		return
	}
	hours := int(now.Sub(e.Last) / time.Hour)
	if hours > 24*PendingDays*2 {
		hours = 24 * PendingDays * 2
	}
	full := e.Units*UnitRent(commune, e.Kind) + 6*10400*3
	ceiling := full * PendingDays
	acc := float64(0)
	for range hours {
		acc += float64(e.DayGross(commune)) / 24
		e.Upkeep = math.Max(0, e.Upkeep-WearPerDay/24)
		if e.Hours++; e.Hours >= 24 {
			e.Hours = 0
			want := TenantsWanted(e.Units, e.Upkeep)
			step := 2
			if e.Kind == EstateTour {
				step = 1
			}
			switch {
			case e.Tenants < want:
				e.Tenants = min(want, e.Tenants+step)
			case e.Tenants > want:
				e.Tenants = max(want, e.Tenants-1)
			}
		}
	}
	e.Pending += int(acc)
	// A week's worth waits at most; a shop losing money (more wages than takings) a week's wages at most.
	e.Pending = max(-len(e.Staff)*Wage*PendingDays, min(ceiling, e.Pending))
	e.Last = e.Last.Add(time.Duration(hours) * time.Hour)
}

// RepairCost: what getting the building back like new costs.
func (e Estate) RepairCost() int {
	return int(math.Ceil(100-e.Upkeep)) * RepairPerPoint * max(1, e.Units)
}

// Collect: what the owner takes now (the tax off what's waiting, up to `left`, the day's limit), and the tax.
func (e *Estate) Collect(left int) (got, tax int) {
	if e.Pending <= 0 {
		return 0, 0
	}
	gross := e.Pending
	net := int(math.Round(float64(gross) * (1 - EstateTax)))
	if net > left {
		net = max(0, left)
		gross = int(math.Ceil(float64(net) / (1 - EstateTax)))
	}
	e.Pending -= gross
	return net, gross - net
}
