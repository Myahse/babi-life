package game

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
)

// La table de l'Ivoire: the casino's roulette played together, at the Hôtel Ivoire (web world3d/interior/
// IvoireInside.tsx) and from the Babi Casino app. One wheel for everyone: a round every TablePeriod seconds,
// the bets taken for TableBets seconds, then « rien ne va plus », the ball rolling until TableResult, the
// number shown until the next round. The number is drawn from the round and the server's secret (BetSecret),
// as L'Envol's: the same on every screen, foreseen by no one.

const (
	TablePeriod = 45 // seconds a round
	TableBets   = 30 // seconds into the round the bets are taken
	TableResult = 40 // seconds into the round the ball has stopped
)

// TableRound is the round going at a moment (ms since 1970).
func TableRound(nowMs int64) int64 { return nowMs / 1000 / TablePeriod }

// TableSpinAt is when a round's bets close and the ball is thrown (ms); TableResultAt when it has stopped.
func TableSpinAt(n int64) int64   { return (n*TablePeriod + TableBets) * 1000 }
func TableResultAt(n int64) int64 { return (n*TablePeriod + TableResult) * 1000 }

// TableNumber is the number a round's ball stops on (0 to 36).
func TableNumber(n int64) int {
	m := hmac.New(sha256.New, []byte(BetSecret))
	fmt.Fprintf(m, "table:%d", n)
	return int(binary.BigEndian.Uint64(m.Sum(nil)[:8]) % 37)
}
