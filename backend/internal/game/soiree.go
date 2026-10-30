package game

import (
	"errors"
	"fmt"
	"slices"
)

// A soirée thrown by a player at home (sims/party.go): the others in the
// commune see its lights over the house and come to it. Its place is
// virtual, « soiree:<id> », drawn as a club (web world3d Interior, the
// host's name on the LED wall). Throwing it costs the host; what's done
// there pays nothing (a sink, money.go).

const (
	SoireeKind   = "soiree"
	SoireePrefix = "soiree:"
	// SoireeCost: the sound system, the DJ's set and the drinks, paid by the host.
	SoireeCost = 5000
	// SoireeHours: how long it lasts (real time).
	SoireeHours = 3
	// SoireeHostID: what the host does there, receiving the guests.
	SoireeHostID = "recevoir-soiree"
	// SoireeMixID: behind the decks.
	SoireeMixID = "mixer-soiree"
	// AtalakuID, SlowID: at the club; at a soirée, the same with « -soiree ».
	AtalakuID = "atalaku"
	SlowID    = "slow"
)

// IsSlow: a slow danced at the club or a soirée (always with someone: sims/social.go).
func IsSlow(id string) bool { return id == SlowID || id == SlowID+"-soiree" }

func init() {
	Kinds[SoireeKind] = PlaceKind{
		ID: SoireeKind, Label: "Soirée", Icon: "party-popper",
		Interactions: []Interaction{
			{ID: SoireeHostID, Ages: Adults, Label: "Recevoir tes invités", Icon: "party-popper", Minutes: 60, Effect: Needs{Social: 30, Fun: 25, Energy: -10}},
			{ID: "danser-soiree", Ages: TeensUp, Label: "Danser le coupé-décalé", Icon: "music", Minutes: 45, Effect: Needs{Fun: 35, Social: 20, Energy: -15}},
			{ID: SoireeMixID, Ages: TeensUp, Label: "Passer derrière les platines", Icon: "disc-3", Minutes: 40, Effect: Needs{Fun: 30, Social: 15, Energy: -8}},
			{ID: "boire-soiree", Ages: Adults, Label: "Prendre un verre au bar", Icon: "martini", Minutes: 20, Cost: 1000, Effect: Needs{Fun: 10, Social: 15}},
			{ID: "travaillement-soiree", Ages: Adults, Label: "Travailler le DJ (lancer les billets)", Icon: "banknote", Minutes: 15, Cost: 5000, Effect: Needs{Fun: 30, Social: 25}},
			{ID: AtalakuID + "-soiree", Ages: Adults, Label: "Payer l'atalaku pour qu'il crie ton nom", Icon: "megaphone", Minutes: 15, Cost: 2000, Effect: Needs{Fun: 25, Social: 20}},
			{ID: "podium-soiree", Ages: TeensUp, Label: "Monter danser sur le podium", Icon: "music", Minutes: 30, Effect: Needs{Fun: 30, Social: 15, Energy: -15}},
			{ID: SlowID + "-soiree", Ages: Adults, Label: "Inviter quelqu'un à danser un slow", Icon: "heart", Minutes: 20, Effect: Needs{Fun: 15, Social: 25}},
			{ID: "bouteille-soiree", Ages: Adults, Label: "Ouvrir une bouteille au carré VIP", Icon: "beer", Minutes: 45, Cost: 20000, Effect: Needs{Fun: 30, Social: 35}},
		},
		Events: []RandomEvent{
			{Text: "Le DJ a crié ton nom au micro : tout le monde t'a applaudi·e !", Effect: Needs{Fun: 10, Social: 10}},
			{Text: "Les voisins ont tapé au mur à cause du bruit… la soirée continue.", Effect: Needs{Fun: -5}},
			{Text: "Ton morceau préféré est passé, tu as mis le feu sur la piste.", Effect: Needs{Fun: 15}},
		},
	}
}

// The soirée's room and its entry (the update « soiree-deco »): the host
// arranges the room the guests come into (sims/party.go), its tables, chairs,
// sofas, the bar counter, the sound system, the lights, the plants and rugs,
// as one furnishes a house (house.go), on a grid of one-metre cells. It is
// the soirée's own room (12 × 9, drawn as a club in web world3d Interior):
// the house's everyday furniture is never touched. The pieces are hired for
// the night with the soirée (SoireeCost): nothing more to pay, but a count
// that can't be passed. And the host chooses the entry: free, or a price the
// guests pay coming in, to the host (FromEntry, money.go); the host's friends
// come in free.

const (
	// SoireeDecoKey: the update (features) the room's arrangement and the entry price wait for.
	SoireeDecoKey = "soiree-deco"
	// PartyW, PartyD: the room, in cells (metres), as web world3d/interior/Shell's ROOM.
	PartyW, PartyD = 12, 9
	// PartyMaxPieces: the most pieces in the room.
	PartyMaxPieces = 24
	// EntryMin, EntryMax, EntryStep: an entry price's bounds, in Djai (0: free).
	EntryMin, EntryMax, EntryStep = 500, 5000, 500
)

// Rect: cells from (X0, Z0) up to (X1, Z1) excluded.
type Rect struct {
	X0 int `json:"x0"`
	Z0 int `json:"z0"`
	X1 int `json:"x1"`
	Z1 int `json:"z1"`
}

func (r Rect) has(x, z int) bool { return x >= r.X0 && x < r.X1 && z >= r.Z0 && z < r.Z1 }

// PartyKept: the room's parts kept clear: the stage at the back with the DJ
// and the podiums, the dance floor before it, and the way in at the front.
var PartyKept = []Rect{
	{X0: 4, Z0: 0, X1: 11, Z1: 3},
	{X0: 5, Z0: 3, X1: 10, Z1: 7},
	{X0: 5, Z0: 7, X1: 8, Z1: 9},
}

// PartyFurnitures: the pieces only a soirée has (the house's are in Furnitures).
var PartyFurnitures = []Furniture{
	{ID: "comptoir", Label: "Comptoir de bar", Icon: "martini", W: 3, D: 1, H: 1, Color: "#1b1530", Room: "soiree"},
	{ID: "sono", Label: "Sono (deux enceintes)", Icon: "speaker", W: 1, D: 1, H: 2, Color: "#141416", Room: "soiree"},
	{ID: "platines", Label: "Platines du DJ", Icon: "disc-3", W: 2, D: 1, H: 1, Color: "#1b1b1f", Room: "soiree"},
	{ID: "spots", Label: "Jeu de lumières", Icon: "sparkles", W: 1, D: 1, H: 2, Color: "#ff2d95", Room: "soiree"},
}

// partyFromHouse: the house's pieces a soirée's room takes too.
var partyFromHouse = []string{"table", "chaises", "canape", "transat", "canape-velours", "canape-cuir", "table-marbre", "tapis", "plante", "lampadaire"}

// PartyCatalog: every piece the room takes, the soirée's own first (free: hired with the soirée).
func PartyCatalog() []Furniture {
	out := slices.Clone(PartyFurnitures)
	for _, id := range partyFromHouse {
		if f, ok := FindFurniture(id); ok {
			f.Price = 0
			out = append(out, f)
		}
	}
	return out
}

// FindPartyFurniture: a piece the room takes.
func FindPartyFurniture(id string) (Furniture, bool) {
	for _, f := range PartyCatalog() {
		if f.ID == id {
			return f, true
		}
	}
	return Furniture{}, false
}

var (
	ErrPartyPiece   = errors.New("ce meuble ne va pas dans la salle de la soirée")
	ErrPartyOut     = errors.New("ça dépasse de la salle : tourne-le ou pose-le ailleurs")
	ErrPartyKept    = errors.New("la scène, la piste de danse et l'entrée restent libres")
	ErrPartyOverlap = errors.New("pas la place : il y a déjà quelque chose ici")
	ErrPartyTooMany = fmt.Errorf("pas plus de %d meubles dans la salle", PartyMaxPieces)
	ErrEntryPrice   = fmt.Errorf("l'entrée est libre, ou de %s à %s (par %s)", FCFA(EntryMin), FCFA(EntryMax), FCFA(EntryStep))
)

// CheckEntry: an entry price the host may ask (0: free).
func CheckEntry(price int) error {
	if price == 0 || price >= EntryMin && price <= EntryMax && price%EntryStep == 0 {
		return nil
	}
	return ErrEntryPrice
}

// CheckLayout: a room's arrangement as the host sent it: known pieces (and,
// for those waiting for an update, open: `open` says), on the floor, in the
// room, off the stage, the floor and the way in, none on another, a quarter
// turn at a time, not too many.
func CheckLayout(pieces []Piece, open func(Furniture) bool) error {
	if len(pieces) > PartyMaxPieces {
		return ErrPartyTooMany
	}
	taken := map[[2]int]bool{}
	for _, p := range pieces {
		f, ok := FindPartyFurniture(p.ID)
		if !ok || open != nil && !open(f) {
			return ErrPartyPiece
		}
		if p.Y != 0 || p.R < 0 || p.R > 3 {
			return ErrPartyOut
		}
		w, d := f.W, f.D
		if p.R%2 == 1 {
			w, d = d, w
		}
		for z := p.Z; z < p.Z+d; z++ {
			for x := p.X; x < p.X+w; x++ {
				if x < 0 || z < 0 || x >= PartyW || z >= PartyD {
					return ErrPartyOut
				}
				for _, k := range PartyKept {
					if k.has(x, z) {
						return ErrPartyKept
					}
				}
				if taken[[2]int{x, z}] {
					return ErrPartyOverlap
				}
				taken[[2]int{x, z}] = true
			}
		}
	}
	return nil
}

// PartyStart: the room as it is the first time (a host's next soirée starts from its last one's):
// the bar along the left, the sofas of the VIP corner, the sound either side of the floor, a few tables.
var PartyStart = []Piece{
	{X: 0, Z: 0, R: 0, ID: "comptoir"},
	{X: 0, Z: 2, R: 1, ID: "canape"},
	{X: 0, Z: 5, R: 1, ID: "canape"},
	{X: 2, Z: 3, R: 0, ID: "table"},
	{X: 3, Z: 3, R: 0, ID: "chaises"},
	{X: 3, Z: 4, R: 0, ID: "chaises"},
	{X: 4, Z: 6, R: 0, ID: "sono"},
	{X: 10, Z: 6, R: 0, ID: "sono"},
	{X: 11, Z: 0, R: 0, ID: "spots"},
	{X: 3, Z: 0, R: 0, ID: "spots"},
	{X: 10, Z: 8, R: 0, ID: "chaises"},
	{X: 11, Z: 8, R: 0, ID: "chaises"},
}
