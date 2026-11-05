package sims

import (
	"fmt"
	"sync"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The house editor's « Annuler » (web components/BuildMode): a block or a piece of furniture put
// down and taken away again within a short while is paid back in full (not half), and one taken
// away and put back again costs what it brought back (half). So undoing a change costs nothing,
// as if it had never been made. Kept in memory per lot, for a moment only (one API instance, as
// the live hubs are): after a restart, taking away is half price again, as it always was.

// regretFor: how long a change can be taken back at what it cost.
const regretFor = 2 * time.Minute

type regretKey struct {
	lot  int64
	what string // "b:x,y,z:material" or "p:x,y,z:id"
	sold bool   // taken away (else put down)
}

var regrets = struct {
	sync.Mutex
	at map[regretKey]time.Time
}{at: map[regretKey]time.Time{}}

func blockRegret(b game.Block) string { return fmt.Sprintf("b:%d,%d,%d:%s", b.X, b.Y, b.Z, b.M) }
func pieceRegret(p game.Piece) string { return fmt.Sprintf("p:%d,%d,%d:%s", p.X, p.Y, p.Z, p.ID) }

// takeRegret: whether `what` was put down (sold false) or taken away (sold true) on the lot
// within the window; the mark is used up.
func takeRegret(lot int64, what string, sold bool, now time.Time) bool {
	regrets.Lock()
	defer regrets.Unlock()
	k := regretKey{lot, what, sold}
	at, ok := regrets.at[k]
	if ok {
		delete(regrets.at, k)
	}
	return ok && now.Sub(at) <= regretFor
}

// markRegret: `what` was just put down or taken away on the lot. Old marks are swept at the same time.
func markRegret(lot int64, what string, sold bool, now time.Time) {
	regrets.Lock()
	defer regrets.Unlock()
	if len(regrets.at) > 2000 {
		for k, at := range regrets.at {
			if now.Sub(at) > regretFor {
				delete(regrets.at, k)
			}
		}
	}
	regrets.at[regretKey{lot, what, sold}] = now
}

// undoDiscount: what a batch of edits costs less because some of it takes back a change just made
// (the other half of the price, each time), and how many blocks put down are not new ones (so the
// count that unlocks materials doesn't grow by putting the same block down again and again). It
// marks the batch's own changes for the next one. `before` is the house the edits apply to.
func undoDiscount(lot int64, before game.House, place, remove []game.Block, furnish, unfurnish []game.Piece, now time.Time) (discount, notNew int) {
	grid := map[[3]int]string{}
	for _, b := range before.Blocks {
		grid[[3]int{b.X, b.Y, b.Z}] = b.M
	}
	pieceAt := func(x, y, z int) (game.Piece, bool) {
		for _, p := range before.Furniture {
			if p.Covers(x, y, z) {
				return p, true
			}
		}
		return game.Piece{}, false
	}
	half := func(price int) int { return price - price/2 }
	for _, r := range remove {
		m, ok := grid[[3]int{r.X, r.Y, r.Z}]
		if !ok {
			continue
		}
		b := game.Block{X: r.X, Y: r.Y, Z: r.Z, M: m}
		mat, _ := game.FindMaterial(m)
		if takeRegret(lot, blockRegret(b), false, now) {
			discount += half(mat.Price)
			notNew++ // the block put down a moment ago is gone again: it no longer counts
		} else {
			markRegret(lot, blockRegret(b), true, now)
		}
	}
	for _, u := range unfurnish {
		p, ok := pieceAt(u.X, u.Y, u.Z)
		if !ok {
			continue
		}
		f, _ := game.FindFurniture(p.ID)
		if takeRegret(lot, pieceRegret(p), false, now) {
			discount += half(f.Price)
		} else {
			markRegret(lot, pieceRegret(p), true, now)
		}
	}
	for _, b := range place {
		mat, _ := game.FindMaterial(b.M)
		if takeRegret(lot, blockRegret(b), true, now) {
			discount += half(mat.Price)
			notNew++
		} else {
			markRegret(lot, blockRegret(b), false, now)
		}
	}
	for _, p := range furnish {
		f, _ := game.FindFurniture(p.ID)
		if takeRegret(lot, pieceRegret(p), true, now) {
			discount += half(f.Price)
		} else {
			markRegret(lot, pieceRegret(p), false, now)
		}
	}
	return discount, notNew
}
