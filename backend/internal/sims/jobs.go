package sims

import (
	"errors"
	"fmt"
	"math"
	"math/rand/v2"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// At work: the job's tasks, done a tap at a time during the shift
// (game/jobs.go), and going to work by oneself as the shift's hours come
// (the Boulot app's switch).

var (
	errNotAtWork = errors.New("tu n'es pas au travail : commence ton service d'abord")
	errNotYet    = errors.New("c'est déjà fait : refais-le un peu plus tard dans ton service")
	errNotYours  = errors.New("pas encore à ton échelon")
)

// jobTask: one of the job's tasks, during the shift. Once a shift it counts
// towards the promotion; where customers tip, half the time there's one.
func (s *Sim) jobTask(id string, rng *rand.Rand) (game.Outcome, error) {
	a := s.Activity
	if a == nil || a.Kind != "do" || a.Career == "" || a.Career != s.Career || a.End <= s.GameMinutes {
		return game.Outcome{}, errNotAtWork
	}
	c, ok := game.FindCareer(s.Career)
	if !ok {
		return game.Outcome{}, errNotAtWork
	}
	t, ok := c.TaskOf(id, s.CareerLevel)
	if !ok {
		return game.Outcome{}, errNotYours
	}
	last, done := a.Tasks[id]
	if done && s.GameMinutes-last < game.TaskCooldown {
		return game.Outcome{}, errNotYet
	}
	if a.Tasks == nil {
		a.Tasks = map[string]int64{}
	}
	a.Tasks[id] = s.GameMinutes
	text := t.Lines[rng.IntN(len(t.Lines))]
	if !done {
		s.Performance++
		text += " (+1 pour ta promotion)"
	}
	tip := 0
	if t.Tip > 0 && rng.Float64() < 0.5 {
		// Within the day's tips (money.go): past them, the customer just says thank you.
		if tip = s.earn(game.FromTips, game.TaskTip(t, s.CareerLevel, rng.Float64())); tip > 0 {
			text += fmt.Sprintf(" Pourboire : %s.", game.FCFA(tip))
		}
	}
	s.Needs = s.Needs.Add(game.Needs{Energy: -2, Social: 2})
	return game.Outcome{Text: text, Money: tip}, nil
}

func (h *Handler) doJobTask(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Task string `json:"task"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		out, err := s.jobTask(req.Task, newRand())
		return out, nil, err
	})
}

// goToWork: free, in its hours, the Sim starts its shift at a workplace of
// its commune (the first that takes it: interactAt says no outside the hours
// and days, or elsewhere). False if there's none to go to now.
func (s *Sim) goToWork() bool {
	c, ok := game.FindCareer(s.Career)
	if !ok || s.Activity != nil {
		return false
	}
	_, cm, ok := world.FindCommune(s.City, s.Commune)
	if !ok {
		return false
	}
	for _, p := range cm.Places {
		if !c.WorksAt(p.Kind) {
			continue
		}
		if _, err := s.interactAt(p.ID, game.WorkInteractionID); err == nil {
			return true
		}
	}
	// Outside Abidjan the pharmacies, commissariats, banks… are the map's:
	// the first one of the kind (what would turn it away, the hours, turns
	// all of them away).
	for _, p := range world.MapPlacesOf(cm.ID, math.MaxInt) {
		if c.WorksAt(p.Kind) {
			_, err := s.interactAt(p.ID, game.WorkInteractionID)
			return err == nil
		}
	}
	return false
}

func (h *Handler) setAutoWork(w http.ResponseWriter, r *http.Request) {
	var req struct {
		On bool `json:"on"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	tag, err := h.DB.Exec(r.Context(), `UPDATE sims SET auto_work = $1 WHERE id = $2 AND user_id = $3`, req.On, chi.URLParam(r, "id"), auth.UserID(r.Context()))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"autoWork": req.On})
}
