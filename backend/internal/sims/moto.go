package sims

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// A moto-taxi in the commune (web world3d/moto.ts): on a long way, the Sim
// walks, or pays to ride the rest behind a driver. The fare goes with the
// distance, as the phone measured it (bounded: a moto-taxi doesn't cross town).

const (
	motoMin = 220    // metres: shorter, one walks
	motoMax = 20_000 // metres: the longest ride in a commune
)

var errMotoShort = errors.New("c'est tout près : marche")

// motoFare: 200 to get on, 100 every 500 m (web motoFare says the same).
func motoFare(metres int) int {
	return 200 + int(math.Ceil(float64(metres)/500))*100
}

// moto: POST {metres}: the fare paid, the ride's on.
func (h *Handler) moto(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Metres int `json:"metres"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if req.Metres < motoMin {
		httpx.Error(w, http.StatusUnprocessableEntity, errMotoShort.Error())
		return
	}
	metres := min(req.Metres, motoMax)
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		fare := motoFare(metres)
		if s.Money < fare {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		s.Money -= fare
		// The fare, said once (a travel event would also say « Bien arrivé·e » at the start of the ride).
		text := "Moto-taxi : " + strings.Replace(fmt.Sprintf("%.1f km", float64(metres)/1000), ".", ",", 1)
		return game.Outcome{Text: text, Money: -fare}, nil, nil
	})
}
