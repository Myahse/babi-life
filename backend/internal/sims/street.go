package sims

import (
	"errors"
	"hash/fnv"
	"net/http"
	"strings"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The sellers of the street. The alloco tantie at the corner (300 F of fried
// plantain, eaten standing), the women grilling porc au four in Yopougon,
// the café and thé sellers with their pousse-pousse, the pain brochette man
// at his grill in the evening; and the street's own pitch and court, where the
// boys of the quartier take whoever comes into their game (free, from morning
// to the lights going off). The vendor id says which (« porc:… », « cafe:… »,
// « the:… », « brochette:… », « foot:… », « basket:… »; anything else is an
// alloco stall). Each
// is often sold out: « Ya pas banane oh ! ». Whether there's some is the same
// for everyone at the same stall in the same game hour, so asking again
// straight away doesn't change the answer.

var streetAlloco = game.Interaction{ID: "street-alloco", Label: "Manger l'alloco de la tantie", Icon: "banana", Minutes: 15, Cost: 300, Effect: game.Needs{Hunger: 25}, MinHour: 8, MaxHour: 23}

// NoBanana is what she says when there's none left.
const NoBanana = "Ya pas banane oh !"

// A kind of street seller: what one buys, when, and what's said.
type streetSeller struct {
	it      game.Interaction
	place   string // the activity's place name
	soldOut string
	enjoy   string
	oneIn   uint32 // sold out about one hour in this many
}

var streetSellers = map[string]streetSeller{
	"alloco": {streetAlloco, "Alloco de la tantie", NoBanana, "Alloco chaud, bon appétit !", 3},
	"porc": {game.Interaction{ID: "street-porc", Label: "Manger le porc au four", Icon: "drumstick", Minutes: 30, Cost: 1500, Effect: game.Needs{Hunger: 50, Fun: 6, Social: 4}, MinHour: 11, MaxHour: 24},
		"Porc au four", "Le porc est fini, reviens demain !", "Porc au four bien grillé, avec l'attiéké. Bon appétit !", 4},
	"cafe": {game.Interaction{ID: "street-cafe", Label: "Boire un café du pousse-pousse", Icon: "coffee", Minutes: 10, Cost: 150, Effect: game.Needs{Energy: 15, Hunger: 3}, MinHour: 5, MaxHour: 23},
		"Café du pousse-pousse", "Le thermos est vide, attends un peu !", "Café bien chaud, bien sucré !", 5},
	"brochette": {game.Interaction{ID: "street-brochette", Label: "Manger un pain brochette", Icon: "sandwich", Minutes: 15, Cost: 500, Effect: game.Needs{Hunger: 35, Fun: 3}, MinHour: 16, MaxHour: 24},
		"Pain brochette", "Y a plus pain oh, attends le livreur !", "Pain brochette bien chaud : oignon, mayo, un peu de piment. Bon appétit !", 4},
	"the": {game.Interaction{ID: "street-the", Label: "Boire un thé avec les gars", Icon: "cup-soda", Minutes: 20, Cost: 100, Effect: game.Needs{Energy: 8, Social: 10, Fun: 4}, MinHour: 6, MaxHour: 24},
		"Thé du pousse-pousse", "Le thé n'est pas encore prêt, assieds-toi d'abord !", "Premier thé, bien mousseux. On cause !", 5},
	// The street's pitch and court (web world3d/open/streetlife.tsx): a pickup game with the
	// quartier, shorter and less of a crowd than a match at the courts (game.Courts).
	"foot": {game.Interaction{ID: "street-foot", Label: "Jouer au foot avec les gars du quartier", Icon: "volleyball", Minutes: 45, Effect: game.Needs{Fun: 25, Social: 15, Energy: -18, Hygiene: -20}, MinHour: 6, MaxHour: 23},
		"Terrain du quartier", "Les équipes sont faites, attends la prochaine partie !", "Les gars te prennent dans leur équipe. Balle à terre !", 6},
	"basket": {game.Interaction{ID: "street-basket", Label: "Jouer au basket avec les gars du quartier", Icon: "trophy", Minutes: 40, Effect: game.Needs{Fun: 25, Social: 12, Energy: -18, Hygiene: -18}, MinHour: 6, MaxHour: 23},
		"Terrain de basket du quartier", "On joue à la gagne : attends ton tour !", "Trois contre trois, à la gagne. À toi la balle !", 6},
	// Tea at a grin of the street, with the boys, a share of the sugar and the leaves: one makes it
	// oneself there (its défi, sims/defi.go), unlike the pousse-pousse's, poured by the seller.
	"grin": {game.Interaction{ID: "street-grin", Label: "Prendre le thé au grin avec les gars", Icon: "cup-soda", Minutes: 25, Cost: 100, Effect: game.Needs{Energy: 8, Social: 14, Fun: 5}, MinHour: 6, MaxHour: 24},
		"Le grin du quartier", "", "On te fait de la place sur le banc. Premier thé : il est amer comme la mort !", never},
	// What the street does, joined (web world3d/open/joinIn.tsx): a ring of people talking (by day,
	// or on the porch after dark), the travaillement party at night, the draughts under the lamp, the
	// street preacher. Free; the scene is there or it isn't, so never « sold out » (oneIn: never).
	"causerie": {game.Interaction{ID: "street-causerie", Label: "Causer avec les gens du quartier", Icon: "messages-square", Minutes: 20, Effect: game.Needs{Social: 14, Fun: 4}, MinHour: 6, MaxHour: 24},
		"Causerie du quartier", "", "On te fait de la place : « Assia, viens on cause ! »", never},
	"travail": {game.Interaction{ID: "street-travail", Label: "Danser au son du travaillement", Icon: "music", Minutes: 30, Effect: game.Needs{Fun: 18, Social: 10, Energy: -10}, MinHour: 18, MaxHour: 24},
		"Le travaillement du coin", "", "Le DJ monte le son, le grand-frère lance les billets. Danse !", never},
	"dames": {game.Interaction{ID: "street-dames", Label: "Supporter la partie de dames", Icon: "grid-3x3", Minutes: 20, Effect: game.Needs{Fun: 10, Social: 8}, MinHour: 19, MaxHour: 24},
		"Les dames sous le lampadaire", "", "« Il va manger trois pions là ! » Tu supportes avec les autres.", never},
	"preche": {game.Interaction{ID: "street-preche", Label: "Écouter le prêcheur de rue", Icon: "book-open", Minutes: 15, Effect: game.Needs{Social: 4, Fun: 2}, MinHour: 7, MaxHour: 19},
		"Le prêcheur du carrefour", "", "« Amen ! » Tu écoutes la parole avec les autres.", never},
	// The marchands who walk the street (streetlife.tsx Marchand): oranges peeled, frozen water in
	// its bag, phone credit, the bread of the morning.
	"oranges": {game.Interaction{ID: "street-oranges", Label: "Manger des oranges épluchées", Icon: "citrus", Minutes: 10, Cost: 200, Effect: game.Needs{Hunger: 12, Energy: 3}, MinHour: 7, MaxHour: 20},
		"Oranges de la marchande", "Les oranges sont finies, ma fille !", "Bien épluchées, bien sucrées. Prends !", 5},
	"eau": {game.Interaction{ID: "street-eau", Label: "Boire un sachet d'eau glacée", Icon: "droplet", Minutes: 5, Cost: 50, Effect: game.Needs{Energy: 5, Hunger: 2}, MinHour: 7, MaxHour: 22},
		"Eau glacée", "Y a plus glacé, c'est chaud seulement !", "Eau glacée, bien fraîche !", 6},
	"credit": {game.Interaction{ID: "street-credit", Label: "Acheter du crédit et appeler la famille", Icon: "smartphone", Minutes: 10, Cost: 500, Effect: game.Needs{Social: 10}, MinHour: 6, MaxHour: 22},
		"Crédit du vendeur", "Mon réseau est en panne, reviens tout à l'heure !", "Crédit chargé. Allô, maman ?", 6},
	"pain": {game.Interaction{ID: "street-pain", Label: "Acheter un pain chaud", Icon: "croissant", Minutes: 5, Cost: 150, Effect: game.Needs{Hunger: 14}, MinHour: 6, MaxHour: 21},
		"Pain du vendeur", "Le pain est fini, le livreur arrive !", "Pain chaud, bien croustillant !", 5},
}

// never: a scene's oneIn, for one that's never « sold out » (hasStock).
const never = 0

// StreetActivity: what one does in the street, for the game's encyclopedia (/world: street).
type StreetActivity struct {
	Interaction game.Interaction `json:"interaction"`
	Place       string           `json:"place"`
}

// streetOrder: the street's sellers and scenes, in the encyclopedia's order.
var streetOrder = []string{"alloco", "porc", "brochette", "cafe", "the", "grin", "oranges", "eau", "pain", "credit", "foot", "basket", "causerie", "travail", "dames", "preche"}

// StreetActivities: every activity of the street (the sellers, the scenes joined, the garbadrome).
func StreetActivities() []StreetActivity {
	out := make([]StreetActivity, 0, len(streetOrder)+1)
	for _, k := range streetOrder {
		sl := streetSellers[k]
		out = append(out, StreetActivity{sl.it, sl.place})
	}
	// The garba: its cheapest fish, as the price from.
	cheap := garbaPiece{}
	for _, p := range garbaPieces {
		if cheap.cost == 0 || p.cost < cheap.cost {
			cheap = p
		}
	}
	return append(out, StreetActivity{game.Interaction{ID: "street-garba", Label: "Manger un garba", Icon: "fish", Minutes: 15, Cost: cheap.cost, Effect: game.Needs{Hunger: float64(cheap.hunger), Social: 3}, MinHour: 9, MaxHour: 2}, "Garbadrome"})
}

// sellerOf: the kind of seller a vendor id names (alloco by default).
func sellerOf(vendor string) streetSeller {
	kind, _, found := strings.Cut(vendor, ":")
	if sl, ok := streetSellers[kind]; found && ok {
		return sl
	}
	return streetSellers["alloco"]
}

var errUnknownVendor = errors.New("vendeuse inconnue")

// hasStock: does this seller still have some at this game minute? Never
// outside the seller's hours; otherwise most hours.
func hasStock(vendor string, gameMinutes int64) bool {
	sl := sellerOf(vendor)
	h := game.HourOf(gameMinutes)
	if h < sl.it.MinHour || h >= sl.it.MaxHour {
		return false
	}
	if sl.oneIn == never {
		return true
	}
	f := fnv.New32a()
	_, _ = f.Write([]byte(vendor))
	hour := uint32(gameMinutes / 60)
	f.Write([]byte{byte(hour), byte(hour >> 8), byte(hour >> 16), byte(hour >> 24)})
	return f.Sum32()%sl.oneIn != 0
}

// hasBanana: the alloco stall's stock (kept for its own tests).
func hasBanana(vendor string, gameMinutes int64) bool { return hasStock(vendor, gameMinutes) }

// buyStreet starts eating (or drinking) at the seller's, or returns their answer when there's none.
func (s *Sim) buyStreet(vendor string) (string, error) {
	if vendor == "" || len(vendor) > 80 {
		return "", errUnknownVendor
	}
	if s.Activity != nil {
		return "", game.ErrBusy
	}
	sl := sellerOf(vendor)
	if !hasStock(vendor, s.GameMinutes) {
		return sl.soldOut, nil
	}
	if err := s.start(sl.it, "", "market", sl.place, nil, ""); err != nil {
		return "", err
	}
	return sl.enjoy, nil
}

// buyAlloco: buying at an alloco stall.
func (s *Sim) buyAlloco(vendor string) (string, error) { return s.buyStreet(vendor) }

func (h *Handler) street(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Vendor string `json:"vendor"`
		// At the garbadrome: which fish (garba.go).
		Choice string `json:"choice"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if strings.HasPrefix(req.Vendor, "garba:") {
		h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
			said, cost, err := s.buyGarba(req.Vendor, req.Choice)
			return game.Outcome{Text: said, Money: -cost}, nil, err
		})
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		said, err := s.buyStreet(req.Vendor)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		sl := sellerOf(req.Vendor)
		if said == sl.soldOut {
			return game.Outcome{Text: said}, nil, nil
		}
		return game.Outcome{Text: said, Money: -sl.it.Cost}, nil, nil
	})
}
