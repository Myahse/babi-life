package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Two players together. Between friends (bonds.friends), both adults (the
// Sims grown up, the accounts 18 or over: users.adult_at): one asks, the
// other says yes or no, wherever they are. One couple of players at a time
// each; either can break it off. Like the romance with the people of the
// game (chat.go), it's said, never shown.

var (
	errCoupleAdults  = errors.New("seulement entre adultes : vos deux persos et vos deux comptes")
	errCoupleAlready = errors.New("vous êtes déjà ensemble")
	errCoupleTaken   = errors.New("l'un·e de vous est déjà en couple avec un·e autre joueur·se")
	errCoupleAsked   = errors.New("tu as déjà demandé : attends sa réponse")
	errCoupleNone    = errors.New("vous n'êtes pas ensemble")
)

// inCouple: whether this Sim is together with a player, and with whom ("" if not).
func inCouple(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, sim string) string {
	var other string
	_ = q.QueryRow(ctx, `SELECT CASE WHEN sim_a = $1::uuid THEN sim_b ELSE sim_a END FROM bonds WHERE (sim_a = $1::uuid OR sim_b = $1::uuid) AND couple LIMIT 1`, sim).Scan(&other)
	return other
}

// grownUp: the Sim is an adult and its player said they're 18 or over.
func grownUp(ctx context.Context, tx pgx.Tx, sim string) bool {
	var o Sim
	var adult bool
	if err := tx.QueryRow(ctx, `SELECT o.born_at, u.adult_at IS NOT NULL FROM sims o JOIN users u ON u.id = o.user_id WHERE o.id = $1`, sim).Scan(&o.BornAt, &adult); err != nil {
		return false
	}
	o.GameMinutes = game.MinuteOf(time.Now())
	return adult && o.stage().ID == game.StageAdulte
}

// couple: POST {action: proposer | accepter | refuser | rompre} with another player.
func (h *Handler) couple(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Action string `json:"action"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	to := chi.URLParam(r, "other")
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		var name string
		if err := tx.QueryRow(ctx, `SELECT first_name FROM sims WHERE id::text = $1`, to).Scan(&name); err != nil || to == s.ID {
			return game.Outcome{}, nil, errNotFound
		}
		x, y := pair(s.ID, to)
		now := game.MinuteOf(time.Now())
		tell := func(other, text string) { _ = insertEvent(ctx, tx, other, "social", text, 0, now) }
		together := func() (game.Outcome, []Event, error) {
			if _, err := tx.Exec(ctx, `UPDATE bonds SET couple = true, friendship = LEAST(100, friendship + 15) WHERE sim_a = $1 AND sim_b = $2`, x, y); err != nil {
				return game.Outcome{}, nil, err
			}
			_, _ = tx.Exec(ctx, `DELETE FROM couple_requests WHERE (from_sim = $1 AND to_sim = $2) OR (from_sim = $2 AND to_sim = $1)`, s.ID, to)
			s.Needs = s.Needs.Add(game.Needs{Social: 25, Fun: 20})
			tell(to, fmt.Sprintf("%s et toi, vous êtes ensemble maintenant ❤", s.FirstName))
			text := fmt.Sprintf("%s et toi, vous êtes ensemble maintenant ❤", name)
			return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
		}
		switch req.Action {
		case "proposer":
			if !areFriends(ctx, tx, s.ID, to) {
				return game.Outcome{}, nil, errOnlyFriends
			}
			if !grownUp(ctx, tx, s.ID) || !grownUp(ctx, tx, to) {
				return game.Outcome{}, nil, errCoupleAdults
			}
			mine, theirs := inCouple(ctx, tx, s.ID), inCouple(ctx, tx, to)
			if mine == to {
				return game.Outcome{}, nil, errCoupleAlready
			}
			if mine != "" || theirs != "" {
				return game.Outcome{}, nil, errCoupleTaken
			}
			var theyAsked, iAsked bool
			_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM couple_requests WHERE from_sim = $1 AND to_sim = $2),
				EXISTS(SELECT 1 FROM couple_requests WHERE from_sim = $2 AND to_sim = $1)`, to, s.ID).Scan(&theyAsked, &iAsked)
			if theyAsked {
				return together()
			}
			if iAsked {
				return game.Outcome{}, nil, errCoupleAsked
			}
			if _, err := tx.Exec(ctx, `INSERT INTO couple_requests (from_sim, to_sim) VALUES ($1, $2) ON CONFLICT DO NOTHING`, s.ID, to); err != nil {
				return game.Outcome{}, nil, err
			}
			tell(to, fmt.Sprintf("%s te demande de sortir ensemble ❤ Réponds dans l'appli Amis.", s.FirstName))
			text := fmt.Sprintf("Tu demandes à %s de sortir ensemble. Réponse dans l'appli Amis.", name)
			return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
		case "accepter", "refuser":
			var asked bool
			_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM couple_requests WHERE from_sim = $1 AND to_sim = $2)`, to, s.ID).Scan(&asked)
			if !asked {
				return game.Outcome{}, nil, errNoRequest
			}
			if req.Action == "refuser" {
				_, _ = tx.Exec(ctx, `DELETE FROM couple_requests WHERE from_sim = $1 AND to_sim = $2`, to, s.ID)
				tell(to, fmt.Sprintf("%s préfère que vous restiez ami·es.", s.FirstName))
				return game.Outcome{Text: fmt.Sprintf("Tu préfères rester ami·e avec %s.", name)}, nil, nil
			}
			if !grownUp(ctx, tx, s.ID) || !grownUp(ctx, tx, to) {
				return game.Outcome{}, nil, errCoupleAdults
			}
			if inCouple(ctx, tx, s.ID) != "" || inCouple(ctx, tx, to) != "" {
				return game.Outcome{}, nil, errCoupleTaken
			}
			return together()
		case "rompre":
			if inCouple(ctx, tx, s.ID) != to {
				return game.Outcome{}, nil, errCoupleNone
			}
			if _, err := tx.Exec(ctx, `UPDATE bonds SET couple = false, friendship = GREATEST(0, friendship - 35) WHERE sim_a = $1 AND sim_b = $2`, x, y); err != nil {
				return game.Outcome{}, nil, err
			}
			s.Needs = s.Needs.Add(game.Needs{Social: -10, Fun: -10})
			tell(to, fmt.Sprintf("%s a rompu. Vous n'êtes plus ensemble.", s.FirstName))
			text := fmt.Sprintf("Tu as rompu avec %s.", name)
			return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
		}
		return game.Outcome{}, nil, errors.New("réponse inconnue")
	})
}

// markCouples: on the friends list, who the Sim is together with, and the couple requests either way.
func (h *Handler) markCouples(ctx context.Context, me string, friends []Player) {
	if len(friends) == 0 {
		return
	}
	with := inCouple(ctx, h.DB, me)
	state := map[string]string{}
	rows, err := h.DB.Query(ctx, `SELECT from_sim, to_sim FROM couple_requests WHERE from_sim = $1 OR to_sim = $1`, me)
	if err == nil {
		for rows.Next() {
			var from, to string
			if rows.Scan(&from, &to) == nil {
				if from == me {
					state[to] = "sent"
				} else {
					state[from] = "received"
				}
			}
		}
		rows.Close()
	}
	for i := range friends {
		friends[i].Couple = friends[i].ID == with
		friends[i].CoupleRequest = state[friends[i].ID]
	}
}
