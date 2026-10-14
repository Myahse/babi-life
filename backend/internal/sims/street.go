package sims

import (
	"errors"
	"hash/fnv"
	"net/http"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The tantie's alloco stall at the street corner: 300 F of fried plantain,
// eaten standing, when she has some left. Often she hasn't: « Ya pas banane
// oh ! ». Whether she has is the same for everyone at the same stall in the
// same game hour, so asking again straight away doesn't change her answer.

var streetAlloco = game.Interaction{ID: "street-alloco", Label: "Manger l'alloco de la tantie", Icon: "banana", Minutes: 15, Cost: 300, Effect: game.Needs{Hunger: 25}, MinHour: 8, MaxHour: 23}

// NoBanana is what she says when there's none left.
const NoBanana = "Ya pas banane oh !"

var errUnknownVendor = errors.New("vendeuse inconnue")

// hasBanana: does this stall still have plantain at this game minute?
// Never before 8 h or after 23 h; otherwise about two hours in three.
func hasBanana(vendor string, gameMinutes int64) bool {
	h := game.HourOf(gameMinutes)
	if h < streetAlloco.MinHour || h >= streetAlloco.MaxHour {
		return false
	}
	f := fnv.New32a()
	_, _ = f.Write([]byte(vendor))
	hour := uint32(gameMinutes / 60)
	f.Write([]byte{byte(hour), byte(hour >> 8), byte(hour >> 16), byte(hour >> 24)})
	return f.Sum32()%3 != 0
}

// buyAlloco starts eating at the stall, or returns her answer when there's none.
func (s *Sim) buyAlloco(vendor string) (string, error) {
	if vendor == "" || len(vendor) > 80 {
		return "", errUnknownVendor
	}
	if s.Activity != nil {
		return "", game.ErrBusy
	}
	if !hasBanana(vendor, s.GameMinutes) {
		return NoBanana, nil
	}
	if err := s.start(streetAlloco, "", "market", "Alloco de la tantie", nil, ""); err != nil {
		return "", err
	}
	return "Alloco chaud, bon appétit !", nil
}

func (h *Handler) street(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Vendor string `json:"vendor"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		said, err := s.buyAlloco(req.Vendor)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if said == NoBanana {
			return game.Outcome{Text: said}, nil, nil
		}
		return game.Outcome{Text: said, Money: -streetAlloco.Cost}, nil, nil
	})
}
