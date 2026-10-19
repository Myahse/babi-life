package game

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"slices"
)

// One's own house, as in Abidjan: from 18 you buy a lot (a terrain of so
// many m², priced by the m² in its commune, plus the fees for the deed), you
// build on it block by block (build.go), you put in the basic furniture, and
// once there is a covered bed and a toilet you can move in: no more rent.

// LotSize is a lot one can buy: its width and depth in metres (= blocks).
type LotSize struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	W     int    `json:"w"`
	D     int    `json:"d"`
}

func (l LotSize) Area() int { return l.W * l.D }

// LotSizes: the usual lots of a lotissement, from the small one to the big one.
var LotSizes = []LotSize{
	{ID: "150", Label: "Petit lot", W: 10, D: 15},
	{ID: "300", Label: "Lot moyen", W: 15, D: 20},
	{ID: "500", Label: "Grand lot", W: 20, D: 25},
	{ID: "600", Label: "Très grand lot", W: 20, D: 30},
}

func FindLotSize(id string) (LotSize, bool) {
	for _, l := range LotSizes {
		if l.ID == id {
			return l, true
		}
	}
	return LotSize{}, false
}

// LotPricePerM2: Djai a m² by commune, in the order of Abidjan's real prices
// (the posh quarters dear, the outskirts cheap), scaled to the game's pay.
var LotPricePerM2 = map[string]int{
	"plateau": 6000, "cocody": 4000, "marcory": 3000, "treichville": 2500, "koumassi": 2000, "adjame": 2000,
	"port-bouet": 1800, "yopougon": 1500, "bingerville": 1500, "abobo": 1200, "attecoube": 1200,
	"anyama": 800, "songon": 700, "bassam-france": 1500,
}

// DefaultLotPrice: a m² in the other towns.
const DefaultLotPrice = 1000

// LotFees: the deed (ACD) and the notary, on top of the price.
const LotFees = 0.10

// LotPrice: what a lot of this size costs in this commune, fees included.
func LotPrice(commune string, l LotSize) int {
	m2, ok := LotPricePerM2[commune]
	if !ok {
		m2 = DefaultLotPrice
	}
	return int(math.Round(float64(m2*l.Area()) * (1 + LotFees)))
}

// Furniture is a piece one puts in the house: its footprint (W × D cells,
// H high), its price, the comfort it adds once one lives there, and the
// home activities it makes possible.
type Furniture struct {
	ID      string   `json:"id"`
	Label   string   `json:"label"`
	Icon    string   `json:"icon"`
	W       int      `json:"w"`
	D       int      `json:"d"`
	H       int      `json:"h"`
	Price   int      `json:"price"`
	Comfort float64  `json:"comfort"`
	Unlocks []string `json:"unlocks,omitempty"`
	Color   string   `json:"color"`
}

var Furnitures = []Furniture{
	{ID: "natte", Label: "Natte", Icon: "rectangle-horizontal", W: 1, D: 2, H: 1, Price: 2000, Comfort: 0, Unlocks: []string{"sleep", "nap"}, Color: "#d9b26b"},
	{ID: "lit", Label: "Lit avec matelas", Icon: "bed-double", W: 2, D: 2, H: 1, Price: 25000, Comfort: 0.15, Unlocks: []string{"sleep", "nap"}, Color: "#5a7fbf"},
	{ID: "chaises", Label: "Chaises en plastique", Icon: "armchair", W: 1, D: 1, H: 1, Price: 3000, Comfort: 0.03, Color: "#e8e3d6"},
	{ID: "table", Label: "Table à manger", Icon: "utensils", W: 1, D: 2, H: 1, Price: 8000, Comfort: 0.05, Color: "#8a5a32"},
	{ID: "canape", Label: "Canapé", Icon: "sofa", W: 2, D: 1, H: 1, Price: 40000, Comfort: 0.1, Color: "#7a4a8a"},
	{ID: "gaziniere", Label: "Gazinière et bonbonne", Icon: "cooking-pot", W: 1, D: 1, H: 1, Price: 15000, Comfort: 0.03, Unlocks: []string{"cook-attieke"}, Color: "#cfd3d6"},
	{ID: "frigo", Label: "Frigo", Icon: "refrigerator", W: 1, D: 1, H: 2, Price: 60000, Comfort: 0.06, Color: "#f4f6f8"},
	{ID: "tele", Label: "Télé", Icon: "tv", W: 1, D: 1, H: 1, Price: 45000, Comfort: 0.05, Unlocks: []string{"watch-tv"}, Color: "#222222"},
	{ID: "ventilo", Label: "Ventilateur", Icon: "fan", W: 1, D: 1, H: 2, Price: 10000, Comfort: 0.08, Color: "#3a8fd8"},
	{ID: "armoire", Label: "Armoire", Icon: "archive", W: 1, D: 1, H: 2, Price: 20000, Comfort: 0.03, Color: "#6b4426"},
	{ID: "douche", Label: "Douche", Icon: "shower-head", W: 1, D: 1, H: 2, Price: 12000, Comfort: 0.04, Unlocks: []string{"shower"}, Color: "#9fd3e8"},
	{ID: "wc", Label: "Toilettes", Icon: "toilet", W: 1, D: 1, H: 1, Price: 15000, Comfort: 0.05, Color: "#ffffff"},
}

func FindFurniture(id string) (Furniture, bool) {
	for _, f := range Furnitures {
		if f.ID == id {
			return f, true
		}
	}
	return Furniture{}, false
}

// Piece is a piece of furniture in a house: its corner cell, turned a
// quarter or not (W and D swapped). In JSON: [x, y, z, r, "id"].
type Piece struct {
	X, Y, Z, R int
	ID         string
}

func (p Piece) MarshalJSON() ([]byte, error) { return json.Marshal([]any{p.X, p.Y, p.Z, p.R, p.ID}) }

func (p *Piece) UnmarshalJSON(data []byte) error {
	var raw []json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil || len(raw) < 3 {
		return errors.New("meuble invalide")
	}
	for i, v := range []*int{&p.X, &p.Y, &p.Z} {
		if err := json.Unmarshal(raw[i], v); err != nil {
			return errors.New("meuble invalide")
		}
	}
	if len(raw) > 3 {
		_ = json.Unmarshal(raw[3], &p.R)
	}
	if len(raw) > 4 {
		return json.Unmarshal(raw[4], &p.ID)
	}
	return nil
}

// cells: the cells the piece fills.
func (p Piece) cells() []cell {
	f, _ := FindFurniture(p.ID)
	w, d := f.W, f.D
	if p.R%2 == 1 {
		w, d = d, w
	}
	var out []cell
	for y := 0; y < max(1, f.H); y++ {
		for z := 0; z < d; z++ {
			for x := 0; x < w; x++ {
				out = append(out, cell{p.X + x, p.Y + y, p.Z + z})
			}
		}
	}
	return out
}

// House is a lot with what stands on it.
type House struct {
	W, D      int
	Blocks    []Block
	Furniture []Piece
	Built     int
}

var (
	ErrNoLot        = errors.New("achète d'abord un terrain (appli Logement)")
	ErrFurnitureIn  = errors.New("un meuble est là : enlève-le d'abord")
	ErrNoFloor      = errors.New("un meuble se pose sur le sol ou sur un plancher")
	ErrNoPiece      = errors.New("il n'y a pas de meuble ici")
	ErrNoFurniture  = errors.New("meuble inconnu")
	ErrNotLivable   = errors.New("pour emménager, il faut un lit (ou une natte) sous un toit et des toilettes")
	ErrHomeLacks    = errors.New("il te manque le meuble pour ça")
	ErrLotTooSmall  = errors.New("ta maison ne tient pas sur ce terrain")
	ErrLotElsewhere = errors.New("ton terrain est dans une autre commune : démolis d'abord pour en acheter un ailleurs")
)

// Edit: blocks and furniture taken out, then put in. It returns the house,
// how many blocks were placed, and what it costs (negative: money back; a
// piece of furniture taken out sells for half).
func (h House) Edit(place, remove []Block, furnish, unfurnish []Piece) (House, int, int, error) {
	if h.W == 0 || h.D == 0 {
		return h, 0, 0, ErrNoLot
	}
	if len(place)+len(remove)+len(furnish)+len(unfurnish) > MaxEdit {
		return h, 0, 0, ErrTooMuch
	}
	grid := make(map[cell]string, len(h.Blocks))
	for _, b := range h.Blocks {
		grid[b.at()] = b.M
	}
	pieces := slices.Clone(h.Furniture)
	taken := func() map[cell]bool {
		m := map[cell]bool{}
		for _, p := range pieces {
			for _, c := range p.cells() {
				m[c] = true
			}
		}
		return m
	}
	cost := 0
	for _, u := range unfurnish {
		i := slices.IndexFunc(pieces, func(p Piece) bool { return slices.Contains(p.cells(), cell{u.X, u.Y, u.Z}) })
		if i < 0 {
			return h, 0, 0, ErrNoPiece
		}
		f, _ := FindFurniture(pieces[i].ID)
		cost -= f.Price / 2
		pieces = slices.Delete(pieces, i, i+1)
	}
	occupied := taken()
	for _, r := range remove {
		m, ok := grid[r.at()]
		if !ok {
			return h, 0, 0, ErrEmpty
		}
		if occupied[cell{r.X, r.Y + 1, r.Z}] {
			return h, 0, 0, ErrFurnitureIn
		}
		mat, _ := FindMaterial(m)
		cost -= mat.Price / 2
		delete(grid, r.at())
	}
	inside := func(c cell) bool { return c.x >= 0 && c.x < h.W && c.z >= 0 && c.z < h.D && c.y >= 0 && c.y < PlotH }
	for _, p := range place {
		if !inside(p.at()) {
			return h, 0, 0, ErrOutOfPlot
		}
		if _, ok := grid[p.at()]; ok {
			return h, 0, 0, ErrTaken
		}
		if occupied[p.at()] {
			return h, 0, 0, ErrFurnitureIn
		}
		mat, ok := FindMaterial(p.M)
		if !ok {
			return h, 0, 0, ErrNoMaterial
		}
		if mat.Unlock > h.Built {
			return h, 0, 0, fmt.Errorf("%s : construis encore %d blocs pour le débloquer", mat.Label, mat.Unlock-h.Built)
		}
		if p.Y > 0 && !touches(grid, p.at()) {
			return h, 0, 0, ErrFloating
		}
		grid[p.at()] = p.M
		cost += mat.Price
	}
	for _, p := range furnish {
		f, ok := FindFurniture(p.ID)
		if !ok {
			return h, 0, 0, ErrNoFurniture
		}
		p.R %= 2
		for _, c := range p.cells() {
			if !inside(c) {
				return h, 0, 0, ErrOutOfPlot
			}
			if _, ok := grid[c]; ok {
				return h, 0, 0, ErrTaken
			}
			if occupied[c] {
				return h, 0, 0, ErrFurnitureIn
			}
			if c.y == p.Y && c.y > 0 {
				if _, ok := grid[cell{c.x, c.y - 1, c.z}]; !ok {
					return h, 0, 0, ErrNoFloor
				}
			}
		}
		pieces = append(pieces, p)
		for _, c := range p.cells() {
			occupied[c] = true
		}
		cost += f.Price
	}
	out := House{W: h.W, D: h.D, Built: h.Built + len(place), Furniture: pieces, Blocks: make([]Block, 0, len(grid))}
	for y := 0; y < PlotH; y++ {
		for z := 0; z < h.D; z++ {
			for x := 0; x < h.W; x++ {
				if m, ok := grid[cell{x, y, z}]; ok {
					out.Blocks = append(out.Blocks, Block{x, y, z, m})
				}
			}
		}
	}
	return out, len(place), cost, nil
}

// Fits: whether everything standing on the house fits on a lot w × d.
func (h House) Fits(w, d int) bool {
	for _, b := range h.Blocks {
		if b.X >= w || b.Z >= d {
			return false
		}
	}
	for _, p := range h.Furniture {
		for _, c := range p.cells() {
			if c.x >= w || c.z >= d {
				return false
			}
		}
	}
	return true
}

// Has: the furniture ids in the house, each once.
func (h House) Has() []string {
	var ids []string
	for _, p := range h.Furniture {
		if !slices.Contains(ids, p.ID) {
			ids = append(ids, p.ID)
		}
	}
	return ids
}

// Livable: a bed (or a mat) with a roof over it, and toilets.
func (h House) Livable() bool {
	grid := map[cell]bool{}
	for _, b := range h.Blocks {
		grid[b.at()] = true
	}
	covered := func(p Piece) bool {
		for _, c := range p.cells() {
			roof := false
			for y := c.y + 1; y < PlotH; y++ {
				if grid[cell{c.x, y, c.z}] {
					roof = true
					break
				}
			}
			if !roof {
				return false
			}
		}
		return true
	}
	bed, wc := false, false
	for _, p := range h.Furniture {
		switch p.ID {
		case "lit", "natte":
			bed = bed || covered(p)
		case "wc":
			wc = true
		}
	}
	return bed && wc
}

// HomeComfort: one's own house is as comfortable as what is in it.
func HomeComfort(furnished []string) float64 {
	c := 0.75
	for _, id := range furnished {
		if f, ok := FindFurniture(id); ok {
			c += f.Comfort
		}
	}
	return math.Min(1.35, math.Round(c*100)/100)
}

// HomeNeeds: the furniture a home activity needs in one's own house ("" when none).
func HomeNeeds(interaction string, furnished []string) string {
	var need []string
	for _, f := range Furnitures {
		if slices.Contains(f.Unlocks, interaction) {
			if slices.Contains(furnished, f.ID) {
				return ""
			}
			need = append(need, f.Label)
		}
	}
	if len(need) == 0 {
		return ""
	}
	return need[len(need)-1]
}

// OwnHouse: the housing of a Sim living in the house it built.
const OwnHouse = "maison"
