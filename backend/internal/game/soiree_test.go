package game

import (
	"errors"
	"testing"
)

// The entry: free, or from 500 to 5 000 Djai by 500; nothing else.
func TestSoireeEntry(t *testing.T) {
	for _, p := range []int{0, EntryMin, 1000, 2500, EntryMax} {
		if err := CheckEntry(p); err != nil {
			t.Errorf("%d refused: %v", p, err)
		}
	}
	for _, p := range []int{-500, 100, 499, 750, EntryMax + EntryStep, 1_000_000} {
		if !errors.Is(CheckEntry(p), ErrEntryPrice) {
			t.Errorf("%d accepted", p)
		}
	}
	// What the guests pay the host isn't earned by playing: its own limit, out of the day's total.
	if Caps[FromEntry].Djai <= 0 || inTotal(FromEntry) {
		t.Errorf("the entries' limit: %+v, in the total %v", Caps[FromEntry], inTotal(FromEntry))
	}
	p := NewPurse()
	if got := p.Take(0, FromEntry, Caps[FromEntry].Djai+EntryMax, false); got != Caps[FromEntry].Djai {
		t.Errorf("a day's entries: %d", got)
	}
	if p.Got(0, EarnedTotal).Djai != 0 {
		t.Error("entries counted as earned")
	}
}

// The room's arrangement: known pieces, in the room, off the stage, the floor and the way in, none on another.
func TestSoireeLayout(t *testing.T) {
	if err := CheckLayout(PartyStart, nil); err != nil {
		t.Fatalf("the starting room: %v", err)
	}
	if err := CheckLayout(nil, nil); err != nil {
		t.Errorf("an empty room: %v", err)
	}
	cases := []struct {
		name   string
		pieces []Piece
		want   error
	}{
		{"unknown piece", []Piece{{X: 0, Z: 0, ID: "fusee"}}, ErrPartyPiece},
		{"a house's bed", []Piece{{X: 0, Z: 0, ID: "lit"}}, ErrPartyPiece},
		{"off the room", []Piece{{X: PartyW - 1, Z: 8, ID: "canape"}}, ErrPartyOut},
		{"below it", []Piece{{X: -1, Z: 0, ID: "chaises"}}, ErrPartyOut},
		{"upstairs", []Piece{{X: 0, Y: 1, Z: 0, ID: "chaises"}}, ErrPartyOut},
		{"a bad turn", []Piece{{X: 0, Z: 0, R: 4, ID: "chaises"}}, ErrPartyOut},
		{"on the stage", []Piece{{X: 6, Z: 1, ID: "sono"}}, ErrPartyKept},
		{"on the dance floor", []Piece{{X: 6, Z: 4, ID: "table"}}, ErrPartyKept},
		{"in the way in", []Piece{{X: 6, Z: 8, ID: "plante"}}, ErrPartyKept},
		{"one on another", []Piece{{X: 0, Z: 0, ID: "comptoir"}, {X: 2, Z: 0, ID: "chaises"}}, ErrPartyOverlap},
	}
	for _, c := range cases {
		if err := CheckLayout(c.pieces, nil); !errors.Is(err, c.want) {
			t.Errorf("%s: %v, want %v", c.name, err, c.want)
		}
	}
	// Turned a quarter, the counter fits down the left wall, not across the floor.
	if err := CheckLayout([]Piece{{X: 0, Z: 0, R: 1, ID: "comptoir"}}, nil); err != nil {
		t.Errorf("the counter turned along the wall: %v", err)
	}
	if err := CheckLayout([]Piece{{X: 3, Z: 4, R: 0, ID: "comptoir"}}, nil); !errors.Is(err, ErrPartyKept) {
		t.Errorf("the counter onto the floor: %v", err)
	}
	// Not too many.
	var many []Piece
	for z := range PartyD {
		for x := range 4 {
			many = append(many, Piece{X: x, Z: z, ID: "chaises"})
		}
	}
	if err := CheckLayout(many, nil); !errors.Is(err, ErrPartyTooMany) {
		t.Errorf("%d pieces: %v", len(many), err)
	}
	if err := CheckLayout(many[:PartyMaxPieces], nil); err != nil {
		t.Errorf("%d pieces: %v", PartyMaxPieces, err)
	}
	// A finer piece waits for its update.
	closed := func(f Furniture) bool { return f.Key == "" }
	if err := CheckLayout([]Piece{{X: 0, Z: 0, ID: "canape-cuir"}}, closed); !errors.Is(err, ErrPartyPiece) {
		t.Errorf("a leather sofa, « deco-premium » closed: %v", err)
	}
	if err := CheckLayout(PartyStart, closed); err != nil {
		t.Errorf("the starting room needs no update: %v", err)
	}
	// Hired with the soirée: nothing costs in the room, and its own pieces stay out of the house's catalogue.
	for _, f := range PartyCatalog() {
		if f.Price != 0 {
			t.Errorf("%s costs %d", f.ID, f.Price)
		}
	}
	for _, f := range PartyFurnitures {
		if _, ok := FindFurniture(f.ID); ok {
			t.Errorf("%s in the house's furniture", f.ID)
		}
	}
	// The kept parts are within the room.
	for _, k := range PartyKept {
		if k.X0 < 0 || k.Z0 < 0 || k.X1 > PartyW || k.Z1 > PartyD || k.X0 >= k.X1 || k.Z0 >= k.Z1 {
			t.Errorf("kept %+v", k)
		}
	}
}
