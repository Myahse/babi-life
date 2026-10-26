package game

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math"
	"math/rand/v2"
	"sync"
)

// L'Envol and Babi Trade (sims/envol.go, sims/trade.go, web screens/casino/),
// in Babi Casino with the roulette, le 21 and the tickets.
//
// L'Envol: a plane takes off, the multiplier climbs while it flies; whoever
// cashes in before it flies off gets their stake times the multiplier, the
// others lose it. The rounds follow one another, the same for every player;
// where each flies off is keyed by the server's secret (BetSecret), never
// told before it happens. Whatever multiplier one aims for, the game gives
// back EnvolReturn of what's staked (the house keeps the rest).
//
// Babi Trade: made-up prices (cacao, coffee, gold), the same for everyone,
// moving every second at random (keyed by the secret too); one bets they'll
// be higher, or lower, in 30 s, 1 or 2 min. Right, TradePays times the stake;
// wrong, nothing. It is a game of chance, not trading: the price has no
// trend to read. The market sits in sessions of an hour, each opening near
// the price's level (TradeSession): a call ends in the session it was taken
// in, so the opening's jump, which leans back to the level, can't be played.
// The game's money only, adults only, in the casino's day.

/* ---------- L'Envol ---------- */

const (
	// A round every EnvolPeriod seconds: EnvolWait to place the bets, then the flight (EnvolMaxFlight at most).
	EnvolPeriod    = 40
	EnvolWait      = 8
	EnvolMaxFlight = 30
	// EnvolMax: the most a plane goes to (it flies off then at the latest).
	EnvolMax = 100.0
	// EnvolReturn: what any cash-out target gives back, on average, for 1 staked.
	EnvolReturn = 0.95
)

// The stakes of L'Envol.
var EnvolStakes = []int{100, 200, 500, 1000, 2000, 5000}

// envolRate: how fast the multiplier climbs (per second), to reach EnvolMax in EnvolMaxFlight.
var envolRate = math.Log(EnvolMax) / EnvolMaxFlight

// EnvolRound: the round running or next at a moment (Unix ms).
func EnvolRound(nowMs int64) int64 { return nowMs / 1000 / EnvolPeriod }

// EnvolTakeoff: when a round's plane takes off (Unix ms); its bets are taken till then.
func EnvolTakeoff(n int64) int64 { return (n*EnvolPeriod + EnvolWait) * 1000 }

// EnvolCrash: where a round's plane flies off (1.00 to EnvolMax): P(≥ x) = EnvolReturn / x.
func EnvolCrash(n int64) float64 {
	m := hmac.New(sha256.New, []byte(BetSecret))
	fmt.Fprintf(m, "envol:%d", n)
	sum := m.Sum(nil)
	// u in (0, 1].
	u := (float64(binary.BigEndian.Uint64(sum[:8])>>11) + 1) / float64(1<<53)
	x := math.Floor(EnvolReturn/u*100) / 100
	return math.Max(1, math.Min(EnvolMax, x))
}

// EnvolAt: the multiplier a plane has reached ms after it took off.
func EnvolAt(ms int64) float64 {
	if ms <= 0 {
		return 1
	}
	return math.Floor(math.Exp(envolRate*float64(ms)/1000)*100) / 100
}

// EnvolFlown: when a round's plane flies off (Unix ms).
func EnvolFlown(n int64) int64 {
	c := EnvolCrash(n)
	return EnvolTakeoff(n) + int64(math.Ceil(math.Log(c)/envolRate*1000))
}

/* ---------- Babi Trade ---------- */

// TradeAsset: a made-up price, its level and how much it moves.
type TradeAsset struct {
	ID    string  `json:"id"`
	Label string  `json:"label"`
	Unit  string  `json:"unit"`
	Base  float64 `json:"-"`
	// Vol: its move a second (standard deviation of the log price).
	Vol float64 `json:"-"`
}

var TradeAssets = []TradeAsset{
	{ID: "cacao", Label: "Cacao", Unit: "F le kilo", Base: 1800, Vol: 0.0009},
	{ID: "cafe", Label: "Café", Unit: "F le kilo", Base: 1250, Vol: 0.0011},
	{ID: "or", Label: "Or", Unit: "F le gramme", Base: 45000, Vol: 0.0007},
}

// The stakes, the lengths (seconds), what a right call pays, the calls open at once.
var (
	TradeStakes = []int{100, 200, 500, 1000, 2000, 5000}
	TradeSecs   = []int{30, 60, 120}
)

const (
	TradePays = 1.85
	TradeOpen = 3
)

// FindAsset: an asset by its id.
func FindAsset(id string) (TradeAsset, bool) {
	for _, a := range TradeAssets {
		if a.ID == id {
			return a, true
		}
	}
	return TradeAsset{}, false
}

// An hour of a price, second by second: worked out once (kept for the last hours).
var (
	hoursMu sync.Mutex
	hours   = map[string][]float64{}
	hourKey []string
)

// tradeHour: an asset's 3 600 prices of an hour (h: Unix hour). Each hour starts again
// near the asset's level (its own draw) and walks at random from there.
func tradeHour(a TradeAsset, h int64) []float64 {
	key := fmt.Sprintf("%s:%d:%s", a.ID, h, BetSecret)
	hoursMu.Lock()
	defer hoursMu.Unlock()
	if p, ok := hours[key]; ok {
		return p
	}
	m := hmac.New(sha256.New, []byte(BetSecret))
	fmt.Fprintf(m, "trade:%s:%d", a.ID, h)
	sum := m.Sum(nil)
	r := rand.New(rand.NewPCG(binary.BigEndian.Uint64(sum[:8]), binary.BigEndian.Uint64(sum[8:16])))
	p := make([]float64, 3600)
	x := math.Log(a.Base) + 0.03*r.NormFloat64()
	for i := range p {
		p[i] = math.Exp(x)
		x += a.Vol * r.NormFloat64()
	}
	hours[key] = p
	hourKey = append(hourKey, key)
	if len(hourKey) > 24 {
		delete(hours, hourKey[0])
		hourKey = hourKey[1:]
	}
	return p
}

// TradePrice: an asset's price at a second (Unix), rounded to the cent.
func TradePrice(a TradeAsset, t int64) float64 {
	p := tradeHour(a, t/3600)[t%3600]
	return math.Round(p*100) / 100
}

// TradeCloses: when the market's session (an hour) a second is in closes (Unix seconds:
// the next session's first second, its opening price).
func TradeCloses(t int64) int64 { return (t/3600 + 1) * 3600 }

// TradeFits: whether a call taken at a second for secs ends in its session.
func TradeFits(at int64, secs int) bool { return at+int64(secs) < TradeCloses(at) }

// TradeWins: whether a call came true: up (the price higher at the end) or down. A
// price that hasn't moved gives the stake back (tie).
func TradeWins(dir string, entry, exit float64) (won, tie bool) {
	switch {
	case exit == entry:
		return false, true
	case dir == "hausse":
		return exit > entry, false
	}
	return exit < entry, false
}
