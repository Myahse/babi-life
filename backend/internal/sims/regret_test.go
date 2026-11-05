package sims

import (
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Undoing a change in the house editor costs nothing, and only within the window.
func TestUndoDiscount(t *testing.T) {
	now := time.Now()
	b := game.Block{X: 2, Y: 0, Z: 3, M: "parpaing"}
	mat, _ := game.FindMaterial("parpaing")
	h := game.House{W: 10, D: 10}
	// Put down: nothing off.
	if off, n := undoDiscount(901, h, []game.Block{b}, nil, nil, nil, now); off != 0 || n != 0 {
		t.Fatalf("put down: %d %d", off, n)
	}
	// Taken away a moment later: the other half back, and it no longer counts as built.
	h.Blocks = []game.Block{b}
	off, n := undoDiscount(901, h, nil, []game.Block{b}, nil, nil, now.Add(10*time.Second))
	if off != mat.Price-mat.Price/2 || n != 1 {
		t.Fatalf("taken back: %d %d", off, n)
	}
	// An old block knocked down (half back), then put back at once: costs that half, not counted as new.
	old := game.Block{X: 5, Y: 0, Z: 5, M: "parpaing"}
	h.Blocks = []game.Block{old}
	if off, _ := undoDiscount(901, h, nil, []game.Block{old}, nil, nil, now); off != 0 {
		t.Fatalf("knocked down: %d", off)
	}
	h.Blocks = nil
	off, n = undoDiscount(901, h, []game.Block{old}, nil, nil, nil, now.Add(20*time.Second))
	if off != mat.Price-mat.Price/2 || n != 1 {
		t.Fatalf("put back: %d %d", off, n)
	}
	// Too late: half price, as always.
	p := game.Piece{X: 1, Y: 0, Z: 1, R: 0, ID: "lit"}
	undoDiscount(902, h, nil, nil, []game.Piece{p}, nil, now)
	h.Furniture = []game.Piece{p}
	if off, _ := undoDiscount(902, h, nil, nil, nil, []game.Piece{{X: 1, Y: 0, Z: 1}}, now.Add(3*time.Minute)); off != 0 {
		t.Fatalf("too late: %d", off)
	}
}
