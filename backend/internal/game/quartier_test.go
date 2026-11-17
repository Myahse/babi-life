package game

import (
	"strings"
	"testing"
)

func TestNewQuartier(t *testing.T) {
	g := NewQuartier(42)
	n := QuartierSize
	if len(g) != n*n || g != NewQuartier(42) {
		t.Fatal("the land: its size, the same for the same seed")
	}
	if strings.Count(g, string(TileHouse)) != houseSide*houseSide || strings.Count(g, string(TileBoard)) != len(QuartierBoards) || g[(n-1)*n+gateX] != TileGate {
		t.Fatal("the house, the boards, the gate")
	}
	// The road runs from under the house to the gate.
	for y := houseY + houseSide; y < n-1; y++ {
		if g[y*n+gateX] != TileRoad {
			t.Fatalf("no road at row %d", y)
		}
	}
	if !strings.Contains(g, string(TileWater)) || !strings.Contains(g, string(TileTree)) {
		t.Fatal("the lagoon and some trees")
	}
}

func TestPaintQuartier(t *testing.T) {
	n := QuartierSize
	g := NewQuartier(1)
	at := func(g string, x, y int) byte { return g[y*n+x] }
	// A road on grass: 100; again: nothing; over the lagoon: a bridge.
	water := strings.IndexByte(g, TileWater)
	wx, wy := water%n, water/n
	g2, cost, err := PaintQuartier(g, []QuartierPaint{{2, 2, "r"}, {2, 2, "r"}, {wx, wy, "r"}})
	if err != nil || at(g2, 2, 2) != TileRoad || at(g2, wx, wy) != TileBridge || cost != 100+500 {
		t.Fatalf("road and bridge: %v %d", err, cost)
	}
	// Water under the bridge: the bridge goes; grass back: cleared.
	g3, cost, err := PaintQuartier(g2, []QuartierPaint{{wx, wy, "e"}, {2, 2, "."}})
	if err != nil || at(g3, wx, wy) != TileWater || at(g3, 2, 2) != TileGrass || cost != 50+20 {
		t.Fatalf("back: %v %d", err, cost)
	}
	for _, bad := range [][]QuartierPaint{
		{{houseX, houseY, "r"}},                           // the house
		{{QuartierBoards[0].X, QuartierBoards[0].Y, "."}}, // a board
		{{gateX, n - 1, "e"}},                             // the gate
		{{-1, 0, "r"}}, {{0, n, "r"}},                     // off the land
		{{3, 3, "M"}}, {{3, 3, "rr"}}, // not a tool
		{{wx, wy, "a"}}, // a tree in the water
	} {
		if _, _, err := PaintQuartier(g, bad); err == nil {
			t.Errorf("%v: should be refused", bad)
		}
	}
	if _, _, err := PaintQuartier(g, make([]QuartierPaint, QuartierMaxPaint+1)); err == nil {
		t.Error("too many cells")
	}
}
