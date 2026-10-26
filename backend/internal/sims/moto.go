package sims

import (
	"cmp"
	"errors"
	"fmt"
	"math"
	"net/http"
	"slices"
	"strings"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// A ride in the commune (web world3d/moto.ts): on a long way, the Sim walks,
// or pays to ride the rest: behind a moto-taxi driver, in a taxi, in the
// commune's woro-woro, or squeezed in a gbaka. The fare goes with the
// distance, as the phone measured it (bounded: one doesn't cross town so).

const (
	motoMin = 220    // metres: shorter, one walks
	motoMax = 20_000 // metres: the longest ride in a commune
)

var (
	errMotoShort = errors.New("c'est tout près : marche")
	errRideKind  = errors.New("ce transport ne passe pas par ici")
)

// rideFares: to get on, and every so many metres after (web rideFare says the same).
var rideFares = map[string]struct {
	name       string
	base, step int
	every      float64
}{
	"moto":  {"Moto-taxi", 200, 100, 500},
	"taxi":  {"Taxi", 300, 150, 500},
	"woro":  {"Woro-woro", 200, 50, 2000},
	"gbaka": {"Gbaka", 150, 50, 3000},
}

// motoFare: 200 to get on, 100 every 500 m.
func motoFare(metres int) int { return rideFare("moto", metres) }

// rideFare: what a ride of this kind and length costs.
func rideFare(kind string, metres int) int {
	f := rideFares[kind]
	return f.base + int(math.Ceil(float64(metres)/f.every))*f.step
}

// rideHere: whether this kind of ride is found in the Sim's commune: the
// woro-woro where the commune has its own, the gbaka in Abidjan, the moto-taxi
// and the taxi anywhere.
func rideHere(kind, city, commune string) bool {
	c, ok := world.FindCity(city)
	if !ok {
		return false
	}
	switch kind {
	case "woro":
		cm, ok := c.Commune(commune)
		return ok && slices.Contains(world.Compteur.Cities, city) && cm.HasWoro()
	case "gbaka":
		return slices.Contains(world.Compteur.Cities, city)
	}
	_, ok = rideFares[kind]
	return ok
}

// moto: POST {metres, kind}: the fare paid, the ride's on (a moto-taxi when no kind is said).
func (h *Handler) moto(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Metres int    `json:"metres"`
		Kind   string `json:"kind"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if req.Metres < motoMin {
		httpx.Error(w, http.StatusUnprocessableEntity, errMotoShort.Error())
		return
	}
	kind := cmp.Or(req.Kind, "moto")
	metres := min(req.Metres, motoMax)
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		if !rideHere(kind, s.City, s.Commune) {
			return game.Outcome{}, nil, errRideKind
		}
		fare := rideFare(kind, metres)
		// The president's « transport » measure (game/civic.go): the taxi, the woro-woro, the gbaka at half price.
		if off := game.FareOff(s.Measures); off > 0 && publicFare(kind) {
			fare = game.Discounted(fare, off)
		}
		if s.Money < fare {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		s.Money -= fare
		// The fare, said once (a travel event would also say « Bien arrivé·e » at the start of the ride).
		text := rideFares[kind].name + " : " + strings.Replace(fmt.Sprintf("%.1f km", float64(metres)/1000), ".", ",", 1)
		return game.Outcome{Text: text, Money: -fare}, nil, nil
	})
}
