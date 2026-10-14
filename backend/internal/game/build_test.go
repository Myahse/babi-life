package game

import (
	"encoding/json"
	"testing"
)

func TestEditPlacesAndCharges(t *testing.T) {
	blocks, placed, cost, err := Edit(nil, 0, []Block{{0, 0, 0, "banco"}, {0, 1, 0, "banco"}, {1, 0, 0, "bois"}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(blocks) != 3 || placed != 3 || cost != 75+75+100 {
		t.Fatalf("got %d blocks, %d placed, cost %d", len(blocks), placed, cost)
	}
	// Taking one down gives half back.
	blocks, _, cost, err = Edit(blocks, 3, nil, []Block{{X: 1, Y: 0, Z: 0}})
	if err != nil || len(blocks) != 2 || cost != -50 {
		t.Fatalf("remove: %v, %d blocks, cost %d", err, len(blocks), cost)
	}
}

func TestEditRules(t *testing.T) {
	base := []Block{{0, 0, 0, "banco"}}
	cases := []struct {
		name   string
		place  []Block
		remove []Block
		built  int
		want   error
	}{
		{"out of the plot", []Block{{PlotW, 0, 0, "banco"}}, nil, 0, ErrOutOfPlot},
		{"too high", []Block{{0, PlotH, 0, "banco"}}, nil, 0, ErrOutOfPlot},
		{"on a block", []Block{{0, 0, 0, "banco"}}, nil, 0, ErrTaken},
		{"floating", []Block{{5, 3, 5, "banco"}}, nil, 0, ErrFloating},
		{"unknown material", []Block{{1, 0, 0, "or"}}, nil, 0, ErrNoMaterial},
		{"nothing to remove", nil, []Block{{X: 3}}, 0, ErrEmpty},
	}
	for _, c := range cases {
		if _, _, _, err := Edit(base, c.built, c.place, c.remove); err != c.want {
			t.Errorf("%s: got %v, want %v", c.name, err, c.want)
		}
	}
	// Glass is locked at first, then opens up.
	if _, _, _, err := Edit(base, 0, []Block{{1, 0, 0, "verre"}}, nil); err == nil {
		t.Error("glass should be locked for a new builder")
	}
	if _, _, _, err := Edit(base, 250, []Block{{1, 0, 0, "verre"}}, nil); err != nil {
		t.Errorf("glass should be open after 250 blocks: %v", err)
	}
}

func TestBlockJSON(t *testing.T) {
	data, _ := json.Marshal([]Block{{1, 2, 3, "tole"}})
	if string(data) != `[[1,2,3,"tole"]]` {
		t.Fatalf("got %s", data)
	}
	var back []Block
	if err := json.Unmarshal(data, &back); err != nil || back[0] != (Block{1, 2, 3, "tole"}) {
		t.Fatalf("round trip: %v %+v", err, back)
	}
}
