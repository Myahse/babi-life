package game

import "slices"

// The fridge one fills (the update « frigo »): bought at the market or the
// supermarket while doing the shopping there, kept at home in the fridge (as
// many as it holds: Furniture.Stock), taken out and eaten at home when hungry.

// Grocery is a thing one keeps in the fridge: its price, and what eating it does.
type Grocery struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	Icon    string `json:"icon"`
	Price   int    `json:"price"`
	Minutes int    `json:"minutes"`
	Effect  Needs  `json:"effect"`
	// Drink: drunk, not eaten.
	Drink bool `json:"drink,omitempty"`
}

// Groceries: what the market and the supermarket sell for the fridge.
var Groceries = []Grocery{
	{ID: "eau", Label: "Bouteille d'eau fraîche", Icon: "glass-water", Price: 300, Minutes: 5, Effect: Needs{Hunger: 4, Energy: 3}, Drink: true},
	{ID: "bissap", Label: "Jus de bissap", Icon: "cup-soda", Price: 600, Minutes: 10, Effect: Needs{Hunger: 8, Fun: 6}, Drink: true},
	{ID: "gnamakoudji", Label: "Jus de gingembre", Icon: "cup-soda", Price: 600, Minutes: 10, Effect: Needs{Hunger: 8, Energy: 6}, Drink: true},
	{ID: "sucrerie", Label: "Sucrerie bien glacée", Icon: "cup-soda", Price: 500, Minutes: 10, Effect: Needs{Hunger: 5, Fun: 8}, Drink: true},
	{ID: "yaourt", Label: "Yaourt", Icon: "milk", Price: 500, Minutes: 10, Effect: Needs{Hunger: 12, Fun: 3}},
	{ID: "fruits", Label: "Mangue et ananas coupés", Icon: "apple", Price: 1000, Minutes: 15, Effect: Needs{Hunger: 18, Fun: 4}},
	{ID: "garba", Label: "Garba (à réchauffer)", Icon: "fish", Price: 800, Minutes: 20, Effect: Needs{Hunger: 35}},
	{ID: "attieke-poisson", Label: "Attiéké-poisson (à réchauffer)", Icon: "fish", Price: 2000, Minutes: 25, Effect: Needs{Hunger: 45, Fun: 4}},
	{ID: "alloco-poulet", Label: "Alloco-poulet (à réchauffer)", Icon: "drumstick", Price: 2500, Minutes: 25, Effect: Needs{Hunger: 50, Fun: 6}},
	{ID: "foutou", Label: "Foutou sauce graine (à réchauffer)", Icon: "soup", Price: 1800, Minutes: 30, Effect: Needs{Hunger: 52, Fun: 3}},
	{ID: "glace", Label: "Crème glacée", Icon: "ice-cream-cone", Price: 1500, Minutes: 10, Effect: Needs{Hunger: 10, Fun: 15}},
}

func FindGrocery(id string) (Grocery, bool) {
	i := slices.IndexFunc(Groceries, func(g Grocery) bool { return g.ID == id })
	if i < 0 {
		return Grocery{}, false
	}
	return Groceries[i], true
}

// FridgeKey: the update the fridge comes with.
const FridgeKey = "frigo"

// FridgeShopping: the shopping during which one fills the fridge (the market, the supermarket, the boutique).
var FridgeShopping = []string{"buy-food", "supermarche", "courses"}

// FridgeRoom: how many things the fridges in a house hold (0: no fridge).
func FridgeRoom(furnished []string) int {
	n := 0
	for _, id := range furnished {
		if f, ok := FindFurniture(id); ok && f.Kind() == "frigo" {
			n += f.Stock
		}
	}
	return n
}

// FridgeCount: how many things are in it.
func FridgeCount(stock map[string]int) int {
	n := 0
	for _, c := range stock {
		n += c
	}
	return n
}

// FromFridgePrefix: the activity of eating something taken out of the fridge ("frigo-" + its id).
const FromFridgePrefix = "frigo-"

// FromFridge: eating (or drinking) it at home, as an activity: nothing to pay, it was bought.
func FromFridge(g Grocery) Interaction {
	verb := "Manger"
	if g.Drink {
		verb = "Boire"
	}
	return Interaction{ID: FromFridgePrefix + g.ID, Label: verb + " : " + g.Label + " (du frigo)", Icon: g.Icon, Minutes: int64(g.Minutes), Effect: g.Effect}
}
