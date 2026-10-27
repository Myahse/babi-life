package sims

import (
	"errors"
	"net/http"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// HairPrice: a new haircut, hair colour or beard is a visit to the barber or
// the salon. Clothes, colours, pagne and accessories come from the wardrobe.
const HairPrice = 2000

// changeLook puts on a new look and says what it cost. The body stays the
// Sim's own (skin, build, height, eyes) and so do its bumps and bruises.
func (s *Sim) changeLook(nl Look) (int, error) {
	if s.Activity != nil {
		return 0, game.ErrBusy
	}
	if err := nl.validate(s.Gender); err != nil {
		return 0, err
	}
	if !s.Prestige && slices.Contains(strings.Split(nl.Accessory, ","), "couronne") {
		return 0, errors.New("la couronne vient avec le Pack Prestige (Boutique)")
	}
	old := s.Look
	nl.Skin, nl.Body, nl.Height, nl.Eyes, nl.Marks = old.Skin, old.Body, old.Height, old.Eyes, old.Marks
	cost := 0
	if nl.Hair != old.Hair || nl.HairColor != old.HairColor || nl.Beard != old.Beard {
		cost = HairPrice
	}
	if s.Money < cost {
		return 0, game.ErrNotEnoughMoney
	}
	s.Money -= cost
	s.Look = nl
	return cost, nil
}

func (h *Handler) changeLookHandler(w http.ResponseWriter, r *http.Request) {
	var nl Look
	if err := httpx.Decode(r, &nl); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		// The boutiques' own prints: worn by those who bought a piece with one (clothes.go).
		var owned []string
		if err := tx.QueryRow(r.Context(), `SELECT clothes FROM sims WHERE id = $1`, s.ID).Scan(&owned); err != nil {
			return game.Outcome{}, nil, err
		}
		if nl.Pattern != s.Look.Pattern {
			if err := piecePattern(nl.Pattern, owned); err != nil {
				return game.Outcome{}, nil, err
			}
		}
		cost, err := s.changeLook(nl)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if cost == 0 {
			return game.Outcome{Text: "Nouveau look !"}, nil, nil
		}
		text := "Nouveau look ! Coiffure payée " + game.FCFA(cost) + "."
		return game.Outcome{Text: text, Money: -cost}, []Event{{Kind: "bill", Text: text, Money: -cost, GameTime: s.GameMinutes}}, nil
	})
}
