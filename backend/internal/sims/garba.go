package sims

import (
	"fmt"
	"hash/fnv"
	"strings"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The garbadrome: attiéké and fried thon. Everyone presses at the front and
// points at their fish: « Donne-moi une grosse queue là-bas ! », « Donne-moi
// milieu là ! ». The piece (a big tail, the middle, or a small piece) and
// where it comes from: straight out of the hot oil (wait a little, it's
// crackling hot) or from the glass box (already fried, served at once). The
// big tails and the middles run out now and then: then it's another piece.

type garbaPiece struct {
	label  string
	cost   int
	hunger int
	oneIn  uint32 // run out about one hour in this many (0: never)
}

var garbaPieces = map[string]garbaPiece{
	"queue":  {"grosse queue", 1000, 50, 4},
	"milieu": {"milieu", 1000, 50, 3},
	"petit":  {"petit morceau", 500, 35, 0},
}

// garbaChoice reads « piece » or « piece-huile » / « piece-boite » (the box by default).
func garbaChoice(choice string) (string, garbaPiece, bool, bool) {
	id, from, _ := strings.Cut(choice, "-")
	p, ok := garbaPieces[id]
	return id, p, from == "huile", ok
}

// garbaLeft: is there still this piece at this garbadrome, this game hour?
func garbaLeft(vendor, piece string, gameMinutes int64) bool {
	p := garbaPieces[piece]
	if p.oneIn == 0 {
		return true
	}
	f := fnv.New32a()
	_, _ = f.Write([]byte(vendor + "/" + piece))
	hour := uint32(gameMinutes / 60)
	f.Write([]byte{byte(hour), byte(hour >> 8), byte(hour >> 16), byte(hour >> 24)})
	return f.Sum32()%p.oneIn != 0
}

// buyGarba: what's said, and what it costs (0: nothing bought).
func (s *Sim) buyGarba(vendor, choice string) (string, int, error) {
	if s.Activity != nil {
		return "", 0, game.ErrBusy
	}
	id, p, hot, ok := garbaChoice(choice)
	if !ok {
		return "", 0, fmt.Errorf("choisis ton poisson")
	}
	h := game.HourOf(s.GameMinutes)
	if h < 9 && h >= 2 {
		return "Le garbadrome n'est pas encore ouvert, reviens à 9 h !", 0, nil
	}
	if !garbaLeft(vendor, id, s.GameMinutes) {
		return fmt.Sprintf("Y a plus %s oh ! Prends autre chose.", p.label), 0, nil
	}
	it := game.Interaction{ID: "street-garba", Label: "Manger un garba (" + p.label + ")", Icon: "fish", Minutes: 15, Cost: p.cost, Effect: game.Needs{Hunger: float64(p.hunger), Social: 3}}
	said := fmt.Sprintf("Ton garba, %s de la boîte, avec piment. Bon appétit !", p.label)
	if hot {
		// Out of the oil: a few minutes more, but crackling hot.
		it.Minutes = 25
		it.Effect.Fun = 5
		said = fmt.Sprintf("Il sort de l'huile, ton %s, bien chaud ! Attiéké, piment, oignon. Bon appétit !", p.label)
	}
	if err := s.start(it, "", "market", "Garbadrome", nil, ""); err != nil {
		return "", 0, err
	}
	return said, p.cost, nil
}
