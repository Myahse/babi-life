package sims

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/kart"
)

// KartRace: the paid race at Babi Karting (game.Kinds["karting"]).
const KartRace = "course-kart"

// kartJoin: a Sim that has just paid for a race joins the next grid leaving
// Babi Karting, with the other players who did the same in the meantime.
func (h *Handler) kartJoin(w http.ResponseWriter, r *http.Request) {
	if h.Karts == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "le karting est fermé")
		return
	}
	var e kart.Entry
	var act *game.Activity
	err := h.DB.QueryRow(r.Context(), `SELECT id, first_name, gender, look, activity FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context())).
		Scan(&e.Sim, &e.Name, &e.Gender, &e.Look, &act)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	// Only with a race paid for, still going.
	if act == nil || act.Kind != "do" || act.Interaction.ID != KartRace || act.End < game.MinuteOf(time.Now()) {
		httpx.Error(w, http.StatusPaymentRequired, "paie d'abord une course au karting")
		return
	}
	race := h.Karts.Join(e, time.Now())
	httpx.JSON(w, http.StatusOK, map[string]any{"race": race, "now": time.Now().UnixMilli()})
}

// kartRace: a grid as it stands, while it fills.
func (h *Handler) kartRace(w http.ResponseWriter, r *http.Request) {
	race, ok := h.Karts.Get(chi.URLParam(r, "race"))
	if !ok {
		httpx.Error(w, http.StatusNotFound, "course introuvable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"race": race, "now": time.Now().UnixMilli()})
}
