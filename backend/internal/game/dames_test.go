package game

import (
	"math/rand/v2"
	"testing"
)

func board(white, black []int, kings ...int) Board {
	var b Board
	for _, n := range white {
		b[n-1] = DameWhiteMan
	}
	for _, n := range black {
		b[n-1] = DameBlackMan
	}
	for _, n := range kings {
		b[n-1] *= 2
	}
	return b
}

func TestDamesOpening(t *testing.T) {
	b := NewBoard()
	// White's first move: nine ways (31–35 each one or two squares forward, but 35 only one).
	if n := len(b.Moves(1)); n != 9 {
		t.Fatalf("white opens with %d moves, want 9", n)
	}
	if n := len(b.Moves(-1)); n != 9 {
		t.Fatalf("black has %d moves, want 9", n)
	}
	if got, ok := ParseBoard(b.String()); !ok || got != b {
		t.Fatal("the board doesn't come back from its letters")
	}
}

func TestDamesCaptureIsAMust(t *testing.T) {
	// A white man on 33, a black one on 28 just up its diagonal: white must take it (33x22; squares are 0-based here).
	b := board([]int{33, 45}, []int{28})
	moves := b.Moves(1)
	if len(moves) != 1 || len(moves[0].Taken) != 1 || moves[0].Taken[0] != 27 || moves[0].Path[1] != 21 {
		t.Fatalf("want 33x22 taking 28, got %+v", moves)
	}
}

func TestDamesManTakesBackward(t *testing.T) {
	// A white man on 23, a black one behind it on 28, 32 free: the man takes backward (23x32).
	b := board([]int{23}, []int{28})
	moves := b.Moves(1)
	if len(moves) != 1 || moves[0].Path[1] != 31 {
		t.Fatalf("want 23x32 backward, got %+v", moves)
	}
}

func TestDamesMostPiecesMustBeTaken(t *testing.T) {
	// From 46: 41 then 32 (two pieces); from 50: only 44 (one). The two must be taken.
	b := board([]int{46, 50}, []int{41, 32, 44, 1})
	moves := b.Moves(1)
	if len(moves) == 0 {
		t.Fatal("no move")
	}
	for _, m := range moves {
		if len(m.Taken) != 2 {
			t.Fatalf("a move taking %d pieces is allowed: %+v", len(m.Taken), moves)
		}
	}
	next, _ := b.Play(moves[0])
	if next[40] != DameEmpty || next[31] != DameEmpty {
		t.Fatal("the pieces taken stay on the board")
	}
}

func TestDamesKingFlies(t *testing.T) {
	// A white dame on 46, a black man on 23 far up its diagonal (46-41-37-32-28-23-19-14-10-5): it takes from afar and may land on 19, 14, 10 or 5.
	b := board([]int{46}, []int{23}, 46)
	moves := b.Moves(1)
	if len(moves) != 4 {
		t.Fatalf("the dame takes and lands on %d squares, want 4: %+v", len(moves), moves)
	}
	for _, m := range moves {
		if len(m.Taken) != 1 || m.Taken[0] != 22 {
			t.Fatalf("wrong piece taken: %+v", m)
		}
	}
}

func TestDamesCrowning(t *testing.T) {
	b := board([]int{7}, []int{45})
	m, ok := b.Find(1, []int{6, 1})
	if !ok {
		t.Fatalf("7-2 not found among %+v", b.Moves(1))
	}
	next, quiet := b.Play(m)
	if next[1] != DameWhiteKing || quiet {
		t.Fatalf("the man isn't crowned on 2 (got %d) or the move counts as quiet", next[1])
	}
}

func TestDamesBestMoveTakes(t *testing.T) {
	// Black, given the choice, takes the piece left hanging rather than giving one away.
	b := board([]int{28, 46, 47, 48}, []int{22, 1, 2, 3})
	m, ok := b.BestMove(-1, 3, rand.New(rand.NewPCG(1, 2)))
	if !ok || len(m.Taken) == 0 {
		t.Fatalf("black didn't take: %+v", m)
	}
	// A whole game plays out to the end without trouble.
	g, turn, quiet := NewBoard(), int8(1), 0
	for ply := 0; ply < 400; ply++ {
		m, ok := g.BestMove(turn, 2, rand.New(rand.NewPCG(uint64(ply), 7)))
		if !ok {
			return
		}
		var q bool
		g, q = g.Play(m)
		if q {
			quiet++
		} else {
			quiet = 0
		}
		if quiet >= DamesQuietDraw {
			return
		}
		turn = -turn
	}
}
