package game

import "testing"

func TestLotPrices(t *testing.T) {
	small, _ := FindLotSize("150")
	if small.Area() != 150 || LotPrice("cocody", small) != 660000 || LotPrice("songon", small) != 115500 {
		t.Errorf("150 m²: Cocody %d, Songon %d", LotPrice("cocody", small), LotPrice("songon", small))
	}
	if LotPrice("daloa-centre", small) != 165000 {
		t.Error("the other towns at the default price")
	}
	for i := 1; i < len(LotSizes); i++ {
		if LotSizes[i].W < LotSizes[i-1].W || LotSizes[i].D < LotSizes[i-1].D {
			t.Error("a bigger lot holds the smaller one's house")
		}
	}
}

func TestHouseFurniture(t *testing.T) {
	h := House{W: 10, D: 15}
	h, _, cost, err := h.Edit([]Block{{0, 0, 0, "banco"}}, nil, []Piece{{X: 2, Y: 0, Z: 2, ID: "lit"}, {X: 5, Y: 0, Z: 5, ID: "wc"}}, nil)
	if err != nil || cost != 75+25000+15000 || len(h.Furniture) != 2 {
		t.Fatalf("furnish: %v %d", err, cost)
	}
	if _, _, _, err := h.Edit(nil, nil, []Piece{{X: 3, Y: 0, Z: 3, ID: "table"}}, nil); err != ErrFurnitureIn {
		t.Errorf("a piece on the bed: %v", err)
	}
	if _, _, _, err := h.Edit([]Block{{2, 0, 3, "banco"}}, nil, nil, nil); err != ErrFurnitureIn {
		t.Errorf("a block in the bed: %v", err)
	}
	if _, _, _, err := h.Edit(nil, nil, []Piece{{X: 9, Y: 0, Z: 0, ID: "lit"}}, nil); err != ErrOutOfPlot {
		t.Errorf("a bed across the fence: %v", err)
	}
	if _, _, _, err := h.Edit(nil, nil, []Piece{{X: 9, Y: 0, Z: 0, R: 1, ID: "natte"}}, nil); err != ErrOutOfPlot {
		t.Errorf("a turned mat across the fence: %v", err)
	}
	if h.Livable() {
		t.Error("no roof over the bed: not livable yet")
	}
	// A roof: posts at the corners and slabs over the bed.
	var roof []Block
	for y := 0; y < 3; y++ {
		roof = append(roof, Block{1, y, 1, "parpaing"})
	}
	for z := 1; z <= 3; z++ {
		for x := 1; x <= 3; x++ {
			roof = append(roof, Block{x, 3, z, "tole"})
		}
	}
	h, _, _, err = h.Edit(roof, nil, nil, nil)
	if err != nil || !h.Livable() {
		t.Fatalf("covered bed and toilets: livable (%v)", err)
	}
	h2, _, back, err := h.Edit(nil, nil, nil, []Piece{{X: 3, Y: 0, Z: 3}})
	if err != nil || back != -12500 || h2.Livable() {
		t.Errorf("selling the bed back: %v %d", err, back)
	}
	if !h.Fits(10, 15) || h.Fits(3, 3) {
		t.Error("fits")
	}
	if (House{}).Fits(1, 1) != true {
		t.Error("an empty house fits anywhere")
	}
	if _, _, _, err := (House{}).Edit([]Block{{0, 0, 0, "banco"}}, nil, nil, nil); err != ErrNoLot {
		t.Error("no lot, no building")
	}
}

func TestHomeComfortAndNeeds(t *testing.T) {
	if HomeComfort(nil) != 0.75 || HomeComfort([]string{"lit", "ventilo"}) != 0.98 {
		t.Errorf("comfort %v", HomeComfort([]string{"lit", "ventilo"}))
	}
	if HomeNeeds("watch-tv", nil) != "Télé" || HomeNeeds("watch-tv", []string{"tele"}) != "" || HomeNeeds("call-family", nil) != "" {
		t.Error("needs")
	}
	if HomeNeeds("sleep", []string{"natte"}) != "" {
		t.Error("a mat is enough to sleep")
	}
}

// A piece moved goes for nothing, turned or not; the staircase stays; a finer piece adds comfort past the basics' cap.
func TestMoveAndFinerPieces(t *testing.T) {
	h := House{W: 10, D: 10, Furniture: []Piece{{X: 1, Y: 0, Z: 1, ID: "canape"}}}
	moved, err := h.Move(Piece{X: 2, Y: 0, Z: 1}, Piece{X: 5, Y: 0, Z: 5, R: 1})
	if err != nil || len(moved.Furniture) != 1 || moved.Furniture[0] != (Piece{X: 5, Y: 0, Z: 5, R: 1, ID: "canape"}) {
		t.Fatalf("moved %v, %v", moved.Furniture, err)
	}
	if _, err := h.Move(Piece{X: 8, Y: 0, Z: 8}, Piece{X: 5, Y: 0, Z: 5}); err != ErrNoPiece {
		t.Errorf("nothing there: %v", err)
	}
	if _, err := (House{W: 10, D: 10, Furniture: []Piece{{X: 0, Y: 0, Z: 0, ID: StairsID}}}).Move(Piece{}, Piece{X: 5, Y: 0, Z: 0}); err != ErrStairsStay {
		t.Errorf("stairs: %v", err)
	}
	basics := []string{"lit", "chaises", "table", "canape", "gaziniere", "frigo", "tele", "ventilo", "armoire", "douche", "wc"}
	if c := HomeComfort(basics); c != 1.35 {
		t.Errorf("basics %v", c)
	}
	if c := HomeComfort(append(basics, "lit-baldaquin", "piano", "aquarium", "clim")); c != 1.5 {
		t.Errorf("with the finer pieces %v", c)
	}
	// A canopy bed is a bed: one can move in with it.
	if !(House{W: 10, D: 10, Furniture: []Piece{{X: 0, Y: 0, Z: 0, ID: "lit-baldaquin"}, {X: 5, Y: 0, Z: 5, ID: "wc-design"}}, Blocks: []Block{{0, 3, 0, "banco"}, {1, 3, 0, "banco"}, {0, 3, 1, "banco"}, {1, 3, 1, "banco"}}}).Livable() {
		t.Error("a canopy bed and designer toilets should be livable")
	}
	if FridgeRoom([]string{"frigo", "frigo-americain"}) != 42 || FridgeRoom([]string{"lit"}) != 0 {
		t.Error("fridge room")
	}
}
