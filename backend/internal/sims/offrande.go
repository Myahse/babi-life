package sims

import (
	"errors"
	"fmt"
	"net/http"
	"slices"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Giving during a service: the quête at mass, the offrande at the culte (the
// basket goes round, people dance up to the front with their note), the
// aumône at the Friday prayer. Like the notes at the club, a tap, not an
// activity: the service goes on.

// Offrandes: what one can give.
var Offrandes = []int{100, 500, 1000, 5000}

// services: the activities during which one can give (game/catalog.go).
var services = []string{"messe", "messe-matin", "culte", "veillee", "priere-vendredi"}

var (
	errNoService  = errors.New("on donne pendant la messe, le culte ou la prière du vendredi")
	errBadOffring = errors.New("100, 500, 1 000 ou 5 000 Djai")
	// What it's called and what happens, by faith.
	offrandeOf = map[string]struct {
		what  string
		lines []string
	}{
		game.FaithCatholic:   {"à la quête", []string{"Le panier passe de rang en rang, tu y glisses ton billet.", "La chorale chante pendant que les paniers passent.", "Le prêtre bénit les offrandes à l'autel."}},
		game.FaithProtestant: {"à l'offrande", []string{"Tu vas déposer ton enveloppe devant l'estrade en chantant.", "Le pasteur remercie les donateurs : « Que Dieu vous le rende ! »"}},
		game.FaithEvangelic:  {"à l'offrande", []string{"Tout le monde danse jusqu'à la corbeille, et toi avec !", "Le pasteur au micro : « Donnez avec joie, Dieu aime celui qui donne ! »", "La batterie s'emballe pendant que les billets tombent dans la corbeille."}},
		game.FaithMuslim:     {"en aumône", []string{"Tu glisses ton aumône dans la caisse de la mosquée, discrètement.", "À la sortie, tu donnes aux talibés qui attendent devant la mosquée."}},
	}
)

// offrande: POST /sims/{id}/offrande {amount} — a gift during the service the Sim is at.
func (h *Handler) offrande(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Amount int `json:"amount"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		a := s.Activity
		if a == nil || !slices.Contains(services, a.Interaction.ID) {
			return game.Outcome{}, nil, errNoService
		}
		if !slices.Contains(Offrandes, req.Amount) {
			return game.Outcome{}, nil, errBadOffring
		}
		if s.Money < req.Amount {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		_, _, p, _ := world.FindPlace(a.PlaceID)
		o, ok := offrandeOf[p.Faith]
		if !ok {
			o = offrandeOf[game.FaithEvangelic]
		}
		s.Money -= req.Amount
		k := float64(req.Amount) / 1000
		s.Needs = s.Needs.Add(game.Needs{Social: min(6, 1+k), Fun: min(5, 1+k/2)})
		text := fmt.Sprintf("%s donnés %s. %s", game.FCFA(req.Amount), o.what, o.lines[int(s.GameMinutes)%len(o.lines)])
		return game.Outcome{Text: text, Money: -req.Amount}, []Event{{Kind: "bill", Text: text, Money: -req.Amount, GameTime: s.GameMinutes}}, nil
	})
}
