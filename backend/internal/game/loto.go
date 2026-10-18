package game

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math/rand/v2"
	"time"
)

// The loto of the street kiosks (« Loto Chance », the game's own: an orange
// parasol, the chalkboard of the last numbers, the bench where people wait
// and talk about their numbers). Five numbers out of 90 are drawn seven times
// a day, every two hours from 9 h to 21 h (Abidjan time), each draw with its
// name. A ticket plays 1, 2 or 3 numbers on a draw: all of them must come out
// among the five. The winnings are a multiple of the stake (the game's rules,
// with the house's share, like every loto). The draw is keyed by the server's
// secret (BetSecret): nobody can know it in advance. Adults only, in Djai.

// LotoDraw is one draw of the day.
type LotoDraw struct {
	ID      int64  `json:"id"` // unix seconds of the draw
	Name    string `json:"name"`
	At      int64  `json:"at"`
	Numbers []int  `json:"numbers,omitempty"` // once drawn
}

// The draws of a day: the hour and the name.
var lotoSchedule = []struct {
	Hour int
	Name string
}{{9, "Premier Café"}, {11, "Garba Chaud"}, {13, "Midi Pile"}, {15, "La Descente"}, {17, "Retour du Boulot"}, {19, "Maquis"}, {21, "Nuit de Babi"}}

// LotoPays: the winnings for 1, 2 or 3 numbers, × the stake.
var LotoPays = map[int]int{1: 15, 2: 250, 3: 2500}

const (
	LotoMinStake = 100
	LotoMaxStake = 10000
	LotoPerDay   = 20
)

// LotoDraws: the draws from yesterday to tomorrow around a time, in order, with the numbers of those already drawn.
func LotoDraws(now time.Time) []LotoDraw {
	day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC) // Abidjan is UTC
	var out []LotoDraw
	for d := -1; d <= 1; d++ {
		base := day.AddDate(0, 0, d)
		for _, s := range lotoSchedule {
			at := base.Add(time.Duration(s.Hour) * time.Hour).Unix()
			dr := LotoDraw{ID: at, Name: s.Name, At: at}
			if at <= now.Unix() {
				dr.Numbers = LotoNumbers(at)
			}
			out = append(out, dr)
		}
	}
	return out
}

// LotoDrawAt: the draw at a unix second, if it's one.
func LotoDrawAt(id int64) (LotoDraw, bool) {
	t := time.Unix(id, 0).UTC()
	for _, s := range lotoSchedule {
		if t.Hour() == s.Hour && t.Minute() == 0 && t.Second() == 0 {
			return LotoDraw{ID: id, Name: s.Name, At: id}, true
		}
	}
	return LotoDraw{}, false
}

// LotoNumbers: the five numbers of a draw, from 1 to 90 (keyed by the secret).
func LotoNumbers(id int64) []int {
	m := hmac.New(sha256.New, []byte(BetSecret))
	fmt.Fprintf(m, "loto:%d", id)
	sum := m.Sum(nil)
	r := rand.New(rand.NewPCG(binary.BigEndian.Uint64(sum[:8]), binary.BigEndian.Uint64(sum[8:16])))
	pool := r.Perm(90)[:5]
	out := make([]int, 5)
	for i, n := range pool {
		out[i] = n + 1
	}
	return out
}

// LotoWins: does a ticket win (all its numbers among the five drawn)?
func LotoWins(picked, drawn []int) bool {
	in := map[int]bool{}
	for _, n := range drawn {
		in[n] = true
	}
	for _, n := range picked {
		if !in[n] {
			return false
		}
	}
	return len(picked) > 0
}
