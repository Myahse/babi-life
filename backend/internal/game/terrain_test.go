package game

import "testing"

func TestPaintTerrain(t *testing.T) {
	g, cost, err := PaintTerrain("", []TerrainPaint{{0, 0, "r"}, {1, 0, "r"}, {-3, 5, "e"}, {2, 2, "a"}})
	if err != nil || cost != 100+100+50+30 || g != "0,0,r;1,0,r;2,2,a;-3,5,e" {
		t.Fatalf("first: %q %d %v", g, cost, err)
	}
	// Again: nothing to pay. A road on the water: a bridge; water under it again: back to water. A bridge asked on dry ground: a road.
	if _, cost, _ := PaintTerrain(g, []TerrainPaint{{0, 0, "r"}}); cost != 0 {
		t.Fatalf("same: %d", cost)
	}
	g2, cost, err := PaintTerrain(g, []TerrainPaint{{-3, 5, "r"}, {7, 7, "p"}})
	if err != nil || ParseTerrain(g2)[cellXY{-3, 5}] != TerrainBridge || ParseTerrain(g2)[cellXY{7, 7}] != TerrainRoad || cost != 500+100 {
		t.Fatalf("bridge: %q %d %v", g2, cost, err)
	}
	g3, cost, _ := PaintTerrain(g2, []TerrainPaint{{-3, 5, "e"}, {1, 0, "."}})
	if ParseTerrain(g3)[cellXY{-3, 5}] != TerrainWater || ParseTerrain(g3)[cellXY{1, 0}] != TerrainClear || cost != 50+20 {
		t.Fatalf("back: %q %d", g3, cost)
	}
	for _, bad := range [][]TerrainPaint{{{TerrainHalf, 0, "r"}}, {{0, -TerrainHalf - 1, "r"}}, {{0, 0, "M"}}, {{0, 0, ""}}} {
		if _, _, err := PaintTerrain(g, bad); err == nil {
			t.Errorf("%v: should be refused", bad)
		}
	}
	if _, _, err := PaintTerrain(g, make([]TerrainPaint, TerrainMaxPaint+1)); err == nil {
		t.Error("too many at once")
	}
	if len(ParseTerrain("junk;1,2;3,4,z;5,6,r")) != 1 {
		t.Error("parse keeps only good cells")
	}
}
