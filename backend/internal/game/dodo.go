package game

import (
	"fmt"
	"hash/fnv"
	"math"
	"math/rand/v2"
)

// Dodo, the phone's app for homes let by the night (sims/dodo.go): in every
// commune, the game's own hosts' places (a room in a family's home, a
// furnished studio, a flat, a duplex, a villa with its pool where the
// quarter is posh), the same for everyone, priced by the commune's land; and
// the houses players let on their lots. Booked from anywhere; once there,
// one sleeps, washes, cooks and watches TV in it (the « logement » kind).

// DodoKind: what one does in a home booked on Dodo.
const DodoKind = "logement"

// DodoType: a kind of home on Dodo, its price against a studio's, and what it has.
type DodoType struct {
	ID     string   `json:"id"`
	Label  string   `json:"label"`
	Rate   float64  `json:"rate"`
	Guests int      `json:"guests"`
	Has    []string `json:"has"`
	// Posh: only where land is dear (a villa's pool in Cocody, not in Abobo).
	Posh bool `json:"-"`
}

var DodoTypes = []DodoType{
	{ID: "chambre", Label: "Chambre chez l'habitant", Rate: 0.55, Guests: 1, Has: []string{"Petit-déjeuner", "Ventilateur", "Wi-Fi"}},
	{ID: "studio", Label: "Studio meublé", Rate: 1, Guests: 2, Has: []string{"Clim", "Wi-Fi", "Cuisine", "Télé"}},
	{ID: "appart", Label: "Appartement 2 pièces", Rate: 1.6, Guests: 4, Has: []string{"Clim", "Wi-Fi", "Cuisine", "Balcon", "Gardien"}},
	{ID: "duplex", Label: "Duplex", Rate: 2.6, Guests: 6, Has: []string{"Clim", "Wi-Fi", "Cuisine équipée", "Terrasse", "Parking", "Groupe électrogène"}},
	{ID: "villa", Label: "Villa avec piscine", Rate: 4.5, Guests: 8, Has: []string{"Piscine", "Clim", "Wi-Fi", "Jardin", "Gardien", "Groupe électrogène"}, Posh: true},
}

// DodoListing: one home on Dodo.
type DodoListing struct {
	ID       string   `json:"id"` // g:<commune>:<n> for the game's, p:<id> for a player's
	Title    string   `json:"title"`
	Type     string   `json:"type"`
	TypeName string   `json:"typeName"`
	Host     string   `json:"host"`
	HostSim  string   `json:"hostSim,omitempty"`
	City     string   `json:"city"`
	Commune  string   `json:"commune"`
	Night    int      `json:"night"`
	Rating   float64  `json:"rating"`
	Reviews  int      `json:"reviews"`
	Guests   int      `json:"guests"`
	Has      []string `json:"has"`
	Seed     int      `json:"seed"`
	// Full: booked tonight (by the game's travellers, or by a player).
	Full bool `json:"full"`
	Mine bool `json:"mine,omitempty"`
}

var dodoHosts = []string{"Tantie Akissi", "Koffi", "Mariam", "Serge", "Adjoua", "Yao", "Fatou", "Kouamé", "Awa", "Ibrahim", "Nadège", "Didier", "Aminata", "Ange", "Salimata", "Hervé"}
var dodoNear = []string{"près du carrefour", "à deux pas du marché", "au calme, dans une cour", "vue sur la lagune", "près des maquis", "dans une rue goudronnée", "à côté de la pharmacie", "près de la gare des woro-woro", "dans une résidence sécurisée", "au bord du boulevard"}
var dodoWords = []string{"cosy", "lumineux", "tout neuf", "climatisé", "spacieux", "charmant", "propre et calme", "plein de couleurs"}

// DodoNight: a studio's night in a commune: land dearer, nights dearer.
func DodoNight(commune string) int {
	m2, ok := LotPricePerM2[commune]
	if !ok {
		m2 = DefaultLotPrice
	}
	return 8000 + m2*6
}

func dodoSeed(parts ...any) uint64 {
	f := fnv.New64a()
	fmt.Fprint(f, parts...)
	return f.Sum64()
}

// DodoListings: the game's own homes in a commune (the same for everyone), five or six.
func DodoListings(city, commune string, day int64) []DodoListing {
	r := rand.New(rand.NewPCG(dodoSeed("dodo", city, commune), 7))
	m2, ok := LotPricePerM2[commune]
	posh := ok && m2 >= 2500
	n := 5 + r.IntN(2)
	out := make([]DodoListing, 0, n)
	for i := 0; i < n; i++ {
		t := DodoTypes[r.IntN(len(DodoTypes))]
		if t.Posh && !posh {
			t = DodoTypes[2]
		}
		night := int(math.Round(float64(DodoNight(commune))*t.Rate*(0.85+r.Float64()*0.3)/500)) * 500
		word := dodoWords[r.IntN(len(dodoWords))]
		if t.ID == "chambre" || t.ID == "villa" {
			word = ""
		}
		title := t.Label
		if word != "" {
			title += " " + word
		}
		title += " " + dodoNear[r.IntN(len(dodoNear))]
		id := fmt.Sprintf("g:%s:%s:%d", city, commune, i)
		out = append(out, DodoListing{ID: id, Title: title, Type: t.ID, TypeName: t.Label, Host: dodoHosts[r.IntN(len(dodoHosts))], City: city, Commune: commune, Night: night,
			Rating: math.Round((4.2+r.Float64()*0.78)*100) / 100, Reviews: 3 + r.IntN(180), Guests: t.Guests, Has: t.Has, Seed: r.IntN(1 << 30),
			Full: dodoSeed(id, day)%100 < 25})
	}
	return out
}

// FindDodoType: a kind of home by its id.
func FindDodoType(id string) (DodoType, bool) {
	for _, t := range DodoTypes {
		if t.ID == id {
			return t, true
		}
	}
	return DodoType{}, false
}

// DodoFee: Dodo's share of what a guest pays a player.
const DodoFee = 0.10
