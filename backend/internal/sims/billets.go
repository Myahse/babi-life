package sims

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Throwing notes on the dancers at the club (the travaillement in a flick):
// not an activity, a tap. Whatever the Sim is doing there (dancing, at the
// bar, in the VIP corner), a handful of notes goes over the dancers on their
// podiums, and the night gets better. From 18, while the club is open.

// Billets: the handfuls one can throw.
var Billets = []int{1000, 5000, 10000}

var (
	errNotAClub     = errors.New("on lance les billets en boîte de nuit")
	errClubClosed   = errors.New("la boîte est fermée : elle ouvre à 21 h")
	errTooYoungClub = errors.New("la boîte, c'est à partir de 18 ans")
	errBadHandful   = errors.New("une liasse de 1 000, 5 000 ou 10 000 Djai")
	billetsLines    = []string{"La danseuse te pointe du doigt et redouble d'énergie !", "Le DJ annonce ton nom au micro : « Gros bras dans la place ! »", "Tout le monde se retourne : les billets volent au-dessus de la piste.", "Le danseur fait un grand écart sous la pluie de billets !", "Les gens crient « Travaillement ! » autour de toi."}
)

// clubOpen: 21 h to 4 h, like the club's own nights (game/catalog.go).
func clubOpen(gameMinutes int64) bool {
	h := (gameMinutes / 60) % 24
	return h >= 21 || h < 4
}

// billets: POST /sims/{id}/billets {place, amount} — a handful of notes over the dancers.
func (h *Handler) billets(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Place  string `json:"place"`
		Amount int    `json:"amount"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		c, cm, p, ok := world.FindPlace(req.Place)
		switch {
		case !ok || p.Kind != "club":
			return game.Outcome{}, nil, errNotAClub
		case s.City != c.ID || s.Commune != cm.ID:
			return game.Outcome{}, nil, fmt.Errorf("va d'abord %s", inCommune(cm.Name))
		case s.stage().ID != game.StageAdulte:
			return game.Outcome{}, nil, errTooYoungClub
		case !clubOpen(s.GameMinutes):
			return game.Outcome{}, nil, errClubClosed
		}
		valid := false
		for _, b := range Billets {
			valid = valid || b == req.Amount
		}
		if !valid {
			return game.Outcome{}, nil, errBadHandful
		}
		if s.Money < req.Amount {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		s.Money -= req.Amount
		k := float64(req.Amount) / 1000
		s.Needs = s.Needs.Add(game.Needs{Fun: min(12, 2*k), Social: min(8, k)})
		text := fmt.Sprintf("%s lancés. %s", game.FCFA(req.Amount), billetsLines[int(s.GameMinutes)%len(billetsLines)])
		return game.Outcome{Text: text, Money: -req.Amount}, nil, nil
	})
}
