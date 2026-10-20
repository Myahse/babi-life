package sims

import (
	"errors"
	"fmt"
	"net/http"
	"slices"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The emotes a Sim has: the free ones, and the ones bought once with Djai
// (game/emotes.go). Playing one is the app's business (the pose sent live).

var errEmoteMoney = errors.New("pas assez de Djai pour cette émote")

// emoteList: GET /sims/{id}/emotes, the ones bought.
func (h *Handler) emoteList(w http.ResponseWriter, r *http.Request) {
	var owned []string
	if err := h.DB.QueryRow(r.Context(), `SELECT emotes FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context())).Scan(&owned); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	if owned == nil {
		owned = []string{}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"owned": owned})
}

// emoteBuy: POST /sims/{id}/emotes/{emote}, bought once and kept.
func (h *Handler) emoteBuy(w http.ResponseWriter, r *http.Request) {
	e, ok := game.FindEmote(chi.URLParam(r, "emote"))
	if !ok {
		httpx.Error(w, http.StatusNotFound, "émote inconnue")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		var owned []string
		if err := tx.QueryRow(ctx, `SELECT emotes FROM sims WHERE id = $1`, s.ID).Scan(&owned); err != nil {
			return game.Outcome{}, nil, err
		}
		if e.Price == 0 || slices.Contains(owned, e.ID) {
			return game.Outcome{Text: fmt.Sprintf("Tu as déjà l'émote %s.", e.Label)}, nil, nil
		}
		if s.Money < e.Price {
			return game.Outcome{}, nil, errEmoteMoney
		}
		s.Money -= e.Price
		if _, err := tx.Exec(ctx, `UPDATE sims SET emotes = array_append(emotes, $2) WHERE id = $1`, s.ID, e.ID); err != nil {
			return game.Outcome{}, nil, err
		}
		text := fmt.Sprintf("Nouvelle émote : %s %s (%s Djai).", e.Emoji, e.Label, money(e.Price))
		return game.Outcome{Text: text, Money: -e.Price}, []Event{{Kind: "money", Text: text, Money: -e.Price, GameTime: s.GameMinutes}}, nil
	})
}
