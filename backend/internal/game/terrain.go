package game

import (
	"errors"
	"sort"
	"strconv"
	"strings"
)

// Mon quartier's ground (update « mon-quartier »): beside the buildings on its lots, the owner shapes the world
// itself, cell by cell (TerrainCell metres, counted from the world's middle: cell x covers x·8 to x·8+8 m east,
// y the same south): a road laid, water dug, a bridge thrown over the water (a road laid on water), a tree
// planted, the ground cleared (the houses and trees the world had there go). Each paid. The phone lays the
// cells over the world it generates (web world3d/quartier/univers/terrain.ts) and keeps them off the lots, the
// home and the places.

const (
	// TerrainCell: a cell's side (m); TerrainHalf: the cells from the middle to the edge each way.
	TerrainCell = 8
	TerrainHalf = 80
	// TerrainMax: cells shaped at most in a quartier; TerrainMaxPaint: changed at most in one go.
	TerrainMax      = 6000
	TerrainMaxPaint = 400
)

// The ground's tiles.
const (
	TerrainRoad   = "r"
	TerrainWater  = "e"
	TerrainBridge = "p"
	TerrainTree   = "a"
	TerrainClear  = "."
)

// TerrainPrices: a cell's price by what it becomes (Djai).
var TerrainPrices = map[string]int{TerrainRoad: 100, TerrainWater: 50, TerrainBridge: 500, TerrainTree: 30, TerrainClear: 20}

var (
	errTerrainCell = errors.New("cette case est hors de ton quartier")
	errTerrainTool = errors.New("on ne pose ici qu'une route, de l'eau, un arbre, ou on rase")
	errTerrainMany = errors.New("trop de cases d'un coup : valide en plusieurs fois")
	errTerrainFull = errors.New("ton quartier est déjà tout aménagé")
)

// TerrainPaint: one cell asked to become a tile.
type TerrainPaint struct {
	X, Y int
	Tile string
}

type cellXY struct{ x, y int }

// ParseTerrain reads a quartier's ground (« x,y,t;… »); what can't be read is left out.
func ParseTerrain(s string) map[cellXY]string {
	out := map[cellXY]string{}
	for _, part := range strings.Split(s, ";") {
		f := strings.Split(part, ",")
		if len(f) != 3 {
			continue
		}
		x, e1 := strconv.Atoi(f[0])
		y, e2 := strconv.Atoi(f[1])
		if e1 != nil || e2 != nil || TerrainPrices[f[2]] == 0 {
			continue
		}
		out[cellXY{x, y}] = f[2]
	}
	return out
}

// formatTerrain writes it back, sorted (the same ground, the same text: the phones' caches key on it).
func formatTerrain(m map[cellXY]string) string {
	keys := make([]cellXY, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		if keys[i].y != keys[j].y {
			return keys[i].y < keys[j].y
		}
		return keys[i].x < keys[j].x
	})
	var b strings.Builder
	for i, k := range keys {
		if i > 0 {
			b.WriteByte(';')
		}
		b.WriteString(strconv.Itoa(k.x))
		b.WriteByte(',')
		b.WriteString(strconv.Itoa(k.y))
		b.WriteByte(',')
		b.WriteString(m[k])
	}
	return b.String()
}

// PaintTerrain: the ground with the cells changed, and what it costs (a cell already so costs nothing). A road
// laid on water dug here is a bridge, water dug under a bridge takes it away.
func PaintTerrain(terrain string, cells []TerrainPaint) (string, int, error) {
	if len(cells) > TerrainMaxPaint {
		return terrain, 0, errTerrainMany
	}
	m := ParseTerrain(terrain)
	cost := 0
	for _, c := range cells {
		if c.X < -TerrainHalf || c.Y < -TerrainHalf || c.X >= TerrainHalf || c.Y >= TerrainHalf {
			return terrain, 0, errTerrainCell
		}
		if TerrainPrices[c.Tile] == 0 {
			return terrain, 0, errTerrainTool
		}
		k := cellXY{c.X, c.Y}
		was, want := m[k], c.Tile
		if want == TerrainRoad && (was == TerrainWater || was == TerrainBridge) {
			want = TerrainBridge
		}
		if want == TerrainBridge && was != TerrainWater && was != TerrainBridge {
			// (A bridge stands over water only: on dry ground, a road.)
			want = TerrainRoad
		}
		if want == was {
			continue
		}
		m[k] = want
		cost += TerrainPrices[want]
	}
	if len(m) > TerrainMax {
		return terrain, 0, errTerrainFull
	}
	return formatTerrain(m), cost, nil
}
