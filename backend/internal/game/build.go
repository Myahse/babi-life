package game

import (
	"encoding/json"
	"errors"
)

// Building one's own house, Minecraft-style: a plot of PlotW × PlotD blocks of
// one metre, up to PlotH high. Basic materials (banco, wood, cement blocks,
// corrugated iron) are there from the start; better ones unlock as the
// player builds. Blocks are paid for; taking one down gives half back.

const (
	PlotW = 12
	PlotD = 12
	PlotH = 12 // three storeys of four blocks: a triplex
	// MaxEdit: blocks placed or removed in one save.
	MaxEdit = 400
)

type Material struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Color  string `json:"color"`
	Price  int    `json:"price"`  // FCFA a block
	Unlock int    `json:"unlock"` // blocks built before it can be used
	Glass  bool   `json:"glass,omitempty"`
}

var Materials = []Material{
	{ID: "banco", Label: "Banco", Color: "#a8673b", Price: 75},
	{ID: "bois", Label: "Planches", Color: "#9c6b3c", Price: 100},
	{ID: "parpaing", Label: "Parpaing", Color: "#9a9a94", Price: 150},
	{ID: "tole", Label: "Tôle", Color: "#a9b4bd", Price: 120},
	{ID: "brique", Label: "Brique", Color: "#b4492f", Price: 250, Unlock: 60},
	{ID: "carreau", Label: "Carreaux", Color: "#e9e4d8", Price: 300, Unlock: 60},
	{ID: "verre", Label: "Vitre", Color: "#9fd3e8", Price: 400, Unlock: 200, Glass: true},
	{ID: "jaune", Label: "Peinture jaune", Color: "#f2c94c", Price: 200, Unlock: 200},
	{ID: "bleu", Label: "Peinture bleue", Color: "#5aa0d8", Price: 200, Unlock: 200},
	{ID: "vert", Label: "Peinture verte", Color: "#5fb37a", Price: 200, Unlock: 200},
	{ID: "marbre", Label: "Marbre", Color: "#f1efe9", Price: 800, Unlock: 400},
}

func FindMaterial(id string) (Material, bool) {
	for _, m := range Materials {
		if m.ID == id {
			return m, true
		}
	}
	return Material{}, false
}

// Block is one block of a plot: where, and what it's made of. In JSON, a
// short array [x, y, z, "material"] (a house is many of them).
type Block struct {
	X, Y, Z int
	M       string
}

func (b Block) MarshalJSON() ([]byte, error) { return json.Marshal([]any{b.X, b.Y, b.Z, b.M}) }

func (b *Block) UnmarshalJSON(data []byte) error {
	var raw []json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil || len(raw) < 3 {
		return errors.New("bloc invalide")
	}
	for i, p := range []*int{&b.X, &b.Y, &b.Z} {
		if err := json.Unmarshal(raw[i], p); err != nil {
			return errors.New("bloc invalide")
		}
	}
	if len(raw) > 3 {
		return json.Unmarshal(raw[3], &b.M)
	}
	return nil
}

type cell struct{ x, y, z int }

func (b Block) at() cell { return cell{b.X, b.Y, b.Z} }

var (
	ErrOutOfPlot  = errors.New("c'est en dehors de ton terrain")
	ErrTaken      = errors.New("il y a déjà un bloc ici")
	ErrEmpty      = errors.New("il n'y a pas de bloc ici")
	ErrFloating   = errors.New("un bloc doit reposer sur le sol ou contre un autre bloc")
	ErrTooMuch    = errors.New("trop de blocs d'un coup")
	ErrNoMaterial = errors.New("matériau inconnu")
)

// Edit applies removals then placements to a plot of the old fixed size
// (PlotW × PlotD), with no furniture. It returns the new blocks, how many
// were placed, and what it costs (negative: money back).
func Edit(blocks []Block, built int, place []Block, remove []Block) ([]Block, int, int, error) {
	h, placed, cost, err := House{W: PlotW, D: PlotD, Blocks: blocks, Built: built}.Edit(place, remove, nil, nil)
	return h.Blocks, placed, cost, err
}

func touches(grid map[cell]string, c cell) bool {
	for _, d := range []cell{{1, 0, 0}, {-1, 0, 0}, {0, 1, 0}, {0, -1, 0}, {0, 0, 1}, {0, 0, -1}} {
		if _, ok := grid[cell{c.x + d.x, c.y + d.y, c.z + d.z}]; ok {
			return true
		}
	}
	return false
}
