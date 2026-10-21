package sims

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/court"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// courtEntry: the Sim as the other players at the court see it.
func courtEntry(s *Sim) court.Entry {
	look, _ := json.Marshal(s.Look)
	return court.Entry{Sim: s.ID, Name: s.FirstName, Gender: s.Gender, Look: look}
}

// courtTake: starting to play at a court takes a place in its match, or says
// it's full (before the Sim spends its time walking on).
func (h *Handler) courtTake(s *Sim, placeID string, it game.Interaction) error {
	sport := game.CourtSport(it.ID)
	if h.Courts == nil || sport == "" || game.Courts[placeID] != sport {
		return nil
	}
	_, err := h.Courts.Join(placeID, sport, courtEntry(s), time.Now())
	var full court.Full
	if errors.As(err, &full) {
		left := max(1, int(time.Until(time.UnixMilli(full.Until)).Minutes()+0.5))
		return fmt.Errorf("terrain complet (%d joueurs au maximum) : prochain match dans %d min", court.Cap[sport], left)
	}
	return err
}

// courtJoin: the match of the court the Sim is playing at (the one it took a place in).
func (h *Handler) courtJoin(w http.ResponseWriter, r *http.Request) {
	if h.Courts == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "le terrain est fermé")
		return
	}
	var s Sim
	var act *game.Activity
	err := h.DB.QueryRow(r.Context(), `SELECT id, first_name, gender, look, activity FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context())).
		Scan(&s.ID, &s.FirstName, &s.Gender, &s.Look, &act)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	if act == nil || act.Kind != "do" || act.End < game.MinuteOf(time.Now()) {
		httpx.Error(w, http.StatusConflict, "tu ne joues pas en ce moment")
		return
	}
	sport := game.CourtSport(act.Interaction.ID)
	if sport == "" || game.Courts[act.PlaceID] != sport {
		httpx.Error(w, http.StatusConflict, "ce n'est pas un terrain")
		return
	}
	m, err := h.Courts.Join(act.PlaceID, sport, courtEntry(&s), time.Now())
	var full court.Full
	if errors.As(err, &full) {
		httpx.Error(w, http.StatusConflict, "terrain complet")
		return
	} else if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"match": m, "now": time.Now().UnixMilli()})
}

// courtMatch: a match as it stands (who has come, who has gone).
func (h *Handler) courtMatch(w http.ResponseWriter, r *http.Request) {
	m, ok := h.Courts.Get(chi.URLParam(r, "match"))
	if !ok {
		httpx.Error(w, http.StatusNotFound, "match introuvable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"match": m, "now": time.Now().UnixMilli()})
}

// courtLeave: the Sim walks off the court; its place opens for someone else.
func (h *Handler) courtLeave(w http.ResponseWriter, r *http.Request) {
	var sim string
	if err := h.DB.QueryRow(r.Context(), `SELECT id FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context())).Scan(&sim); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	h.Courts.Leave(chi.URLParam(r, "match"), sim)
	w.WriteHeader(http.StatusNoContent)
}

// courtAt: how many play at a court now, out of how many (shown before joining).
func (h *Handler) courtAt(w http.ResponseWriter, r *http.Request) {
	place := chi.URLParam(r, "place")
	sport, ok := game.Courts[place]
	if !ok || h.Courts == nil {
		httpx.Error(w, http.StatusNotFound, "ce n'est pas un terrain")
		return
	}
	out := map[string]any{"sport": sport, "cap": court.Cap[sport], "players": 0}
	if m, ok := h.Courts.At(place, time.Now()); ok {
		out["sport"], out["cap"], out["players"], out["start"], out["end"] = m.Sport, m.Cap, len(m.Entries), m.Start, m.End
	}
	httpx.JSON(w, http.StatusOK, out)
}
