package game

import (
	"math/rand/v2"
	"slices"
	"strings"
)

// Le jeu de dames as it's played at the grin: the international game, on a
// board of 10 × 10, twenty pieces each. The men go forward one square on the
// diagonal and capture forward and backward; a capture is a must, and the
// one that takes the most pieces must be played; the pieces taken come off
// only once the move is done (so none is jumped twice). A man that ends its
// move on the far row becomes a dame, which flies along the diagonals. The
// side that can't move has lost; twenty-five moves each with only dames
// moving and nothing taken is a draw.
//
// The squares are numbered as on a real board, 1 to 50 from the top left;
// here 0 to 49. White starts on 31–50 (the bottom), goes up, and plays first.

// Board: what's on each of the 50 dark squares.
type Board [50]int8

const (
	DameEmpty     int8 = 0
	DameWhiteMan  int8 = 1
	DameWhiteKing int8 = 2
	DameBlackMan  int8 = -1
	DameBlackKing int8 = -2
)

// DamesQuietDraw: plies with only dames moving and nothing taken, before the game is drawn (25 moves each).
const DamesQuietDraw = 50

// DamesMove: the squares the piece goes through (its start first) and the pieces it takes.
type DamesMove struct {
	Path  []int `json:"path"`
	Taken []int `json:"taken,omitempty"`
}

// NewBoard: the start, the black men on 1–20, the white on 31–50.
func NewBoard() Board {
	var b Board
	for i := 0; i < 20; i++ {
		b[i] = DameBlackMan
	}
	for i := 30; i < 50; i++ {
		b[i] = DameWhiteMan
	}
	return b
}

// squareRC: a square's row (0 at the top) and column.
func squareRC(i int) (int, int) {
	r := i / 5
	return r, 2*(i%5) + 1 - r%2
}

// squareAt: the square at a row and column, or -1 off the board or on a light square.
func squareAt(r, c int) int {
	if r < 0 || r > 9 || c < 0 || c > 9 || (r+c)%2 == 0 {
		return -1
	}
	return r*5 + c/2
}

var dameDirs = [4][2]int{{-1, -1}, {-1, 1}, {1, -1}, {1, 1}}

func side(p int8) int8 {
	switch {
	case p > 0:
		return 1
	case p < 0:
		return -1
	}
	return 0
}

func isKing(p int8) bool { return p == DameWhiteKing || p == DameBlackKing }

// Moves: everything the side to play (1 white, -1 black) may play.
func (b Board) Moves(turn int8) []DamesMove {
	var caps []DamesMove
	most := 0
	for i, p := range b {
		if side(p) != turn {
			continue
		}
		for _, m := range b.capturesFrom(i) {
			switch {
			case len(m.Taken) > most:
				most, caps = len(m.Taken), []DamesMove{m}
			case len(m.Taken) == most:
				caps = append(caps, m)
			}
		}
	}
	if most > 0 {
		return caps
	}
	var out []DamesMove
	for i, p := range b {
		if side(p) != turn {
			continue
		}
		r, c := squareRC(i)
		for _, d := range dameDirs {
			if !isKing(p) && d[0] != -int(turn) {
				continue // a man goes forward: up for white, down for black
			}
			for k := 1; ; k++ {
				j := squareAt(r+d[0]*k, c+d[1]*k)
				if j < 0 || b[j] != DameEmpty {
					break
				}
				out = append(out, DamesMove{Path: []int{i, j}})
				if !isKing(p) {
					break
				}
			}
		}
	}
	return out
}

// capturesFrom: every way the piece on `from` can take, to its end (each sequence that can't go on).
func (b Board) capturesFrom(from int) []DamesMove {
	p := b[from]
	b[from] = DameEmpty // it has left its square for the whole move
	var out []DamesMove
	var walk func(at int, path, taken []int)
	walk = func(at int, path, taken []int) {
		r, c := squareRC(at)
		more := false
		for _, d := range dameDirs {
			// Up to the first piece on this diagonal (next to it, for a man).
			k := 1
			j := squareAt(r+d[0], c+d[1])
			if isKing(p) {
				for j >= 0 && b[j] == DameEmpty {
					k++
					j = squareAt(r+d[0]*k, c+d[1]*k)
				}
			}
			if j < 0 || side(b[j]) != -side(p) || slices.Contains(taken, j) {
				continue
			}
			// Where it can land beyond: the next square, or (a dame) any empty one after it.
			for l := k + 1; ; l++ {
				land := squareAt(r+d[0]*l, c+d[1]*l)
				if land < 0 || b[land] != DameEmpty {
					break
				}
				more = true
				walk(land, append(append([]int{}, path...), land), append(append([]int{}, taken...), j))
				if !isKing(p) {
					break
				}
			}
		}
		if !more && len(taken) > 0 {
			out = append(out, DamesMove{Path: path, Taken: taken})
		}
	}
	walk(from, []int{from}, nil)
	return out
}

// Play: the board after the move (which must be one of Moves), and whether it was quiet (a dame moving, nothing taken).
func (b Board) Play(m DamesMove) (Board, bool) {
	from, to := m.Path[0], m.Path[len(m.Path)-1]
	p := b[from]
	quiet := isKing(p) && len(m.Taken) == 0
	b[from] = DameEmpty
	for _, t := range m.Taken {
		b[t] = DameEmpty
	}
	// A man ending its move on the far row is crowned.
	r, _ := squareRC(to)
	if p == DameWhiteMan && r == 0 {
		p = DameWhiteKing
	} else if p == DameBlackMan && r == 9 {
		p = DameBlackKing
	}
	b[to] = p
	return b, quiet
}

// Find: the legal move with this path, if there is one (the path as the player tapped it: its start and its end
// are enough when only one move goes from one to the other).
func (b Board) Find(turn int8, path []int) (DamesMove, bool) {
	if len(path) < 2 {
		return DamesMove{}, false
	}
	var hit []DamesMove
	for _, m := range b.Moves(turn) {
		if m.Path[0] != path[0] || m.Path[len(m.Path)-1] != path[len(path)-1] {
			continue
		}
		if slices.Equal(path, m.Path) {
			return m, true
		}
		hit = append(hit, m)
	}
	if len(hit) >= 1 && len(path) == 2 {
		return hit[0], true
	}
	return DamesMove{}, false
}

// String: the board in 50 letters (w, W, b, B, .), as kept in the database.
func (b Board) String() string {
	var s strings.Builder
	for _, p := range b {
		s.WriteByte(map[int8]byte{DameEmpty: '.', DameWhiteMan: 'w', DameWhiteKing: 'W', DameBlackMan: 'b', DameBlackKing: 'B'}[p])
	}
	return s.String()
}

// ParseBoard: the board back from its 50 letters.
func ParseBoard(s string) (Board, bool) {
	var b Board
	if len(s) != 50 {
		return b, false
	}
	for i := 0; i < 50; i++ {
		switch s[i] {
		case 'w':
			b[i] = DameWhiteMan
		case 'W':
			b[i] = DameWhiteKing
		case 'b':
			b[i] = DameBlackMan
		case 'B':
			b[i] = DameBlackKing
		case '.':
		default:
			return b, false
		}
	}
	return b, true
}

// score: how good the board is for `turn`: the pieces (a dame worth three men), the men further up, the middle held.
func (b Board) score(turn int8) int {
	v := 0
	for i, p := range b {
		if p == DameEmpty {
			continue
		}
		r, c := squareRC(i)
		w := 100
		if isKing(p) {
			w = 320
		} else {
			// Up the board: the white from the bottom, the black from the top.
			up := 9 - r
			if p < 0 {
				up = r
			}
			w += up * 3
			if c >= 3 && c <= 6 {
				w += 4
			}
		}
		if side(p) == turn {
			v += w
		} else {
			v -= w
		}
	}
	return v
}

// search: the best the side to play can get, looking `depth` plies ahead (negamax with alpha-beta).
func (b Board) search(turn int8, depth, alpha, beta int) int {
	moves := b.Moves(turn)
	if len(moves) == 0 {
		return -100000 - depth // lost: the sooner, the worse
	}
	if depth == 0 {
		return b.score(turn)
	}
	for _, m := range moves {
		next, _ := b.Play(m)
		v := -next.search(-turn, depth-1, -beta, -alpha)
		if v > alpha {
			alpha = v
		}
		if alpha >= beta {
			break
		}
	}
	return alpha
}

// BestMove: what a player of this strength (how many plies ahead it looks, 1 to 4) plays; among moves
// near as good as the best, one at random (people don't always play the same).
func (b Board) BestMove(turn int8, depth int, rng *rand.Rand) (DamesMove, bool) {
	moves := b.Moves(turn)
	if len(moves) == 0 {
		return DamesMove{}, false
	}
	type scored struct {
		m DamesMove
		v int
	}
	all := make([]scored, 0, len(moves))
	best := -1 << 30
	for _, m := range moves {
		next, _ := b.Play(m)
		v := -next.search(-turn, depth-1, -1<<30, 1<<30)
		all = append(all, scored{m, v})
		best = max(best, v)
	}
	var near []DamesMove
	for _, s := range all {
		if s.v >= best-6 {
			near = append(near, s.m)
		}
	}
	return near[rng.IntN(len(near))], true
}

// Count: the pieces of each side left.
func (b Board) Count() (white, black int) {
	for _, p := range b {
		switch side(p) {
		case 1:
			white++
		case -1:
			black++
		}
	}
	return
}
