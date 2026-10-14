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

// work credits a finished shift and returns the promotion text, if any.
func (s *Sim) work(c game.Career, mood float64) string {
	s.Performance += game.ShiftPerformance(mood, slices.Contains(s.Traits, "travailleur"))
	if s.CareerLevel >= len(c.Levels)-1 || s.Performance < game.NeededToPromote(s.CareerLevel) {
		return ""
	}
	s.CareerLevel++
	s.Performance = 0
	l := c.Levels[s.CareerLevel]
	return fmt.Sprintf("Promotion ! %s devient %s (%s par service).", s.FirstName, l.Title, game.FCFA(l.Pay))
}

// career joins a new career at the bottom of the ladder, or quits ("").
func (h *Handler) career(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Career string `json:"career"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		if s.minor() && req.Career != "" {
			return game.Outcome{}, nil, errTooYoungToWork
		}
		if s.Record > 0 && slices.Contains(game.CleanRecordCareers, req.Career) {
			return game.Outcome{}, nil, errRecordCareers
		}
		if req.Career == s.Career {
			return game.Outcome{}, nil, errors.New("c'est déjà ton travail")
		}
		var text string
		if req.Career == "" {
			text = "Tu as démissionné. Liberté… et plus de salaire."
		} else {
			c, ok := game.FindCareer(req.Career)
			if !ok {
				return game.Outcome{}, nil, errors.New("métier inconnu")
			}
			text = fmt.Sprintf("Embauché·e en %s comme %s !", game.LowerFirst(c.Label), c.Levels[0].Title)
		}
		s.Career, s.CareerLevel, s.Performance = req.Career, 0, 0
		out := game.Outcome{Text: text}
		return out, []Event{{Kind: "career", Text: text, GameTime: s.GameMinutes}}, nil
	})
}

// move rents a new home in the commune where the Sim is right now.
func (h *Handler) move(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Housing string `json:"housing"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		if s.Activity != nil {
			return game.Outcome{}, nil, game.ErrBusy
		}
		to, ok := game.FindHousing(req.Housing)
		if !ok {
			return game.Outcome{}, nil, errors.New("logement inconnu")
		}
		if to.ID == s.Housing && s.City == s.HomeCity && s.Commune == s.HomeCommune {
			return game.Outcome{}, nil, errors.New("tu habites déjà ici")
		}
		if s.RentArrears > 0 {
			return game.Outcome{}, nil, fmt.Errorf("règle d'abord tes %s d'arriérés de loyer", game.FCFA(s.RentArrears))
		}
		if s.Money < to.Deposit() {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		city, _ := world.FindCity(s.City)
		cm, _ := city.Commune(s.Commune)

		before := s.GameMinutes
		s.Money -= to.Deposit()
		s.Needs = s.Needs.Add(game.Needs{Energy: -20})
		s.Housing, s.HomeCity, s.HomeCommune = to.ID, s.City, s.Commune

		text := fmt.Sprintf("Déménagement : %s à %s ! Caution de %d semaines payée.", game.LowerFirst(to.Label), cm.Name, game.DepositWeeks)
		out := game.Outcome{Text: text, Money: -to.Deposit()}
		return out, []Event{{Kind: "bill", Text: text, Money: -to.Deposit(), GameTime: before}}, nil
	})
}

// repay pays back the microcredit early, or settles rent arrears.
func (h *Handler) repay(w http.ResponseWriter, r *http.Request) {
	var req struct {
		What   string `json:"what"` // "loan" | "rent"
		Amount int    `json:"amount"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		owed := &s.Loan
		label := "microcrédit"
		if req.What == "rent" {
			owed, label = &s.RentArrears, "loyer en retard"
		}
		amount := min(req.Amount, *owed)
		switch {
		case *owed == 0:
			return game.Outcome{}, nil, errors.New("tu ne dois rien")
		case amount <= 0:
			return game.Outcome{}, nil, errors.New("montant invalide")
		case s.Money < amount:
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		s.Money -= amount
		*owed -= amount
		text := fmt.Sprintf("Remboursement (%s) via Waye. Reste %s.", label, game.FCFA(*owed))
		out := game.Outcome{Text: text, Money: -amount}
		return out, []Event{{Kind: "bill", Text: text, Money: -amount, GameTime: s.GameMinutes}}, nil
	})
}
