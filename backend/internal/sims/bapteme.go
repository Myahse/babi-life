package sims

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The baptism (the update « bapteme », web components/Bapteme.tsx): the
// baby's first days, the whole family in the courtyard, the grand-mère who
// whispers its name, the dancing, the presents. Once, while it is a baby:
// the family's gift (two weeks of its pocket money) and a happy baby.

var errBaptised = errors.New("déjà baptisé·e")

// baptismDue: GET /sims/{id}/bapteme: {due}.
func (h *Handler) baptismDue(w http.ResponseWriter, r *http.Request) {
	if features.Default.BlocksKey(r.Context(), "bapteme") != "" {
		httpx.JSON(w, http.StatusOK, map[string]bool{"due": false})
		return
	}
	var born, now int64
	var done bool
	err := h.DB.QueryRow(r.Context(), `SELECT born_at, game_minutes, baptised FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context())).Scan(&born, &now, &done)
	due := err == nil && !done && born != 0 && game.StageOf(game.AgeAt(born, now)).ID == game.StageBebe
	httpx.JSON(w, http.StatusOK, map[string]bool{"due": due})
}

// baptise: POST /sims/{id}/bapteme: the family's gift, once.
func (h *Handler) baptise(w http.ResponseWriter, r *http.Request) {
	if features.Default.BlocksKey(r.Context(), "bapteme") != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		tag, err := tx.Exec(r.Context(), `UPDATE sims SET baptised = true WHERE id = $1 AND NOT baptised`, s.ID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if tag.RowsAffected() == 0 || s.stage().ID != game.StageBebe {
			return game.Outcome{}, nil, errBaptised
		}
		gift := 2 * s.family().Pocket
		s.Money += gift
		s.Needs = s.Needs.Add(game.Needs{Social: 30, Fun: 25})
		text := fmt.Sprintf("Le baptême de %s : toute la famille est venue, la grand-mère a dit ton nom à ton oreille, on a dansé jusqu'au soir. Les cadeaux : %s.", s.FirstName, game.FCFA(gift))
		return game.Outcome{Text: text, Money: gift}, []Event{{Kind: "life", Text: text, Money: gift, GameTime: s.GameMinutes}}, nil
	})
}
