package game

import (
	"errors"
	"math/rand"
	"strings"
)

// Mon quartier (the update « mon-quartier », sims/quartier.go, web screens/Quartier.tsx): beside the world
// of Babi where everyone is, each Sim has a neighbourhood of its own that it shapes as it likes. A square
// of land, a grid of QuartierSize × QuartierSize cells of QuartierCell metres: at first only its house,
// the road that leads out to Babi, the billboards (Babi Pub's: they stay, whatever the owner does), some
// trees and the lagoon's edge. The owner lays roads, digs water, throws bridges (a road over water),
// plants trees or clears the ground, cell by cell, paying for each.

const (
	// QuartierSize: cells a side; QuartierCell: metres a cell (the land is 320 m a side).
	QuartierSize = 40
	QuartierCell = 8
	// QuartierMaxPaint: cells changed at most in one go.
	QuartierMaxPaint = 400
)

// The cells: what the owner may lay, and what stays (the house, the boards, the way out).
const (
	TileGrass  = '.'
	TileRoad   = 'r'
	TileWater  = 'e'
	TileBridge = 'p'
	TileTree   = 'a'
	TileHouse  = 'M'
	TileBoard  = 'B'
	TileGate   = 'E'
)

// QuartierPrices: what a cell costs, by what it becomes (Djai).
var QuartierPrices = map[string]int{
	string(TileGrass):  20,  // the ground cleared (a road broken up, water filled in, a tree cut)
	string(TileRoad):   100, // a road laid
	string(TileWater):  50,  // water dug
	string(TileBridge): 500, // a road over water: a bridge
	string(TileTree):   30,  // a tree planted
}

// The house's cells (a square of 4), the road out (down to the gate on the land's edge), the boards beside it.
const (
	houseX, houseY = 18, 16
	houseSide      = 4
	gateX          = 19
)

// QuartierBoards: where Babi Pub's boards stand (by the road in, facing it), and their kind.
var QuartierBoards = []struct {
	X, Y   int
	Format string
}{{21, 33, "4x3"}, {17, 26, "geant"}, {18, 37, "sucette"}}

var (
	errQuartierCell  = errors.New("cette case n'est pas sur ton terrain")
	errQuartierFixed = errors.New("ta maison, la route vers Babi et les panneaux restent à leur place")
	errQuartierTool  = errors.New("on ne peut poser ici que de l'herbe, une route, de l'eau ou un arbre")
	errQuartierMany  = errors.New("trop de cases d'un coup : valide en plusieurs fois")
	errQuartierTree  = errors.New("un arbre se plante dans l'herbe")
)

// NewQuartier: a Sim's land as it gets it (the seed draws its trees and the lagoon's shore).
func NewQuartier(seed int64) string {
	n := QuartierSize
	rng := rand.New(rand.NewSource(seed))
	g := []byte(strings.Repeat(string(TileGrass), n*n))
	set := func(x, y int, t byte) { g[y*n+x] = t }
	// The lagoon along the east side, its shore wavering.
	edge := n - 5
	for y := 0; y < n; y++ {
		if r := rng.Intn(5); r == 0 && edge > n-7 {
			edge--
		} else if r == 1 && edge < n-3 {
			edge++
		}
		for x := edge; x < n; x++ {
			set(x, y, TileWater)
		}
	}
	// The house, the road from its door down to the gate on the south edge, the boards beside the road.
	for y := houseY; y < houseY+houseSide; y++ {
		for x := houseX; x < houseX+houseSide; x++ {
			set(x, y, TileHouse)
		}
	}
	for y := houseY + houseSide; y < n-1; y++ {
		set(gateX, y, TileRoad)
	}
	set(gateX, n-1, TileGate)
	for _, b := range QuartierBoards {
		set(b.X, b.Y, TileBoard)
	}
	// Trees here and there on the grass, none close to the house or the road.
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			if g[y*n+x] != TileGrass || (x >= houseX-2 && x < houseX+houseSide+2 && y >= houseY-2) || (x >= gateX-1 && x <= gateX+1 && y >= houseY) {
				continue
			}
			if rng.Float64() < 0.07 {
				set(x, y, TileTree)
			}
		}
	}
	return string(g)
}

// QuartierPaint: one cell asked to become a tile (grass, road, water or a tree).
type QuartierPaint struct {
	X, Y int
	Tile string
}

// PaintQuartier: the land with the cells changed, and what it costs (a cell that stays as it is costs
// nothing). A road laid over water is a bridge; water dug under a bridge takes it away. The house, the
// road out's gate and the boards can't be touched.
func PaintQuartier(grid string, cells []QuartierPaint) (string, int, error) {
	n := QuartierSize
	if len(grid) != n*n {
		return grid, 0, errQuartierCell
	}
	if len(cells) > QuartierMaxPaint {
		return grid, 0, errQuartierMany
	}
	g := []byte(grid)
	cost := 0
	for _, c := range cells {
		if c.X < 0 || c.Y < 0 || c.X >= n || c.Y >= n {
			return grid, 0, errQuartierCell
		}
		if len(c.Tile) != 1 {
			return grid, 0, errQuartierTool
		}
		i := c.Y*n + c.X
		was, want := g[i], c.Tile[0]
		switch was {
		case TileHouse, TileBoard, TileGate:
			return grid, 0, errQuartierFixed
		}
		switch want {
		case TileRoad:
			if was == TileWater || was == TileBridge {
				want = TileBridge
			}
		case TileTree:
			if was != TileGrass && was != TileTree {
				return grid, 0, errQuartierTree
			}
		case TileGrass, TileWater:
		default:
			return grid, 0, errQuartierTool
		}
		if want == was {
			continue
		}
		g[i] = want
		cost += QuartierPrices[string(want)]
	}
	return string(g), cost, nil
}
