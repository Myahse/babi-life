package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// The perso made on the wish list (/liste/creer, the waitlist table's sim)
// waits for its player: signed up with the same e-mail, the account's first
// perso starts from it (the creator filled in with it), and is born into the
// family the wish list drew, in its commune. A number alone can't be matched.

type listed struct {
	FirstName string          `json:"firstName"`
	Sim       json.RawMessage `json:"sim"`
	Family    string          `json:"family,omitempty"`
	Commune   string          `json:"commune,omitempty"`
}

// fromWaitlist: the wish list's perso for this account's e-mail, if any (the latest).
func (h *Handler) fromWaitlist(ctx context.Context, user string) (listed, bool) {
	var l listed
	err := h.DB.QueryRow(ctx, `
		SELECT w.first_name, w.sim, COALESCE(w.family, ''), COALESCE(w.born_in, '') FROM waitlist w JOIN users u ON lower(w.contact) = lower(u.email)
		WHERE u.id = $1 AND w.kind = 'email' AND w.sim IS NOT NULL
		ORDER BY w.created_at DESC LIMIT 1`, user).Scan(&l.FirstName, &l.Sim, &l.Family, &l.Commune)
	return l, err == nil && len(l.Sim) > 0
}

// waitlistSim: GET /me/waitlist-sim: the perso made on the wish list, for the creator to start from.
func (h *Handler) waitlistSim(w http.ResponseWriter, r *http.Request) {
	l, ok := h.fromWaitlist(r.Context(), auth.UserID(r.Context()))
	if !ok {
		httpx.Error(w, http.StatusNotFound, "pas de perso sur la liste")
		return
	}
	httpx.JSON(w, http.StatusOK, l)
}

// listedBirth: for the account's first perso, the family and the commune the wish list drew (ok false: draw anew).
func (h *Handler) listedBirth(ctx context.Context, user string) (game.Family, world.City, world.Commune, bool) {
	var others int
	if h.DB.QueryRow(ctx, `SELECT count(*) FROM sims WHERE user_id = $1`, user).Scan(&others) != nil || others > 0 {
		return game.Family{}, world.City{}, world.Commune{}, false
	}
	l, ok := h.fromWaitlist(ctx, user)
	if !ok {
		return game.Family{}, world.City{}, world.Commune{}, false
	}
	fam, ok := game.FindFamily(l.Family)
	if !ok {
		return game.Family{}, world.City{}, world.Commune{}, false
	}
	for _, c := range world.Cities {
		if cm, ok := c.Commune(l.Commune); ok {
			return fam, c, cm, true
		}
	}
	return game.Family{}, world.City{}, world.Commune{}, false
}

// The persos made before the wish list was carried over were born into a
// family drawn anew: their player is offered the list's one back, once
// (update « famille-liste »). Accepted, the Sim takes that family and, while it
// still lives in the family home, its home in the list's commune; refused, it
// keeps its own. Either way the offer goes.

type familyOffer struct {
	Family  game.Family `json:"family"`
	Commune string      `json:"commune"` // its name
	city    world.City
	commune world.Commune
}

// listedOffer: the offer for this Sim, if one is due (its account's first perso, not answered, not born that way).
func (h *Handler) listedOffer(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, user, sim string) (familyOffer, bool) {
	if features.Default.BlocksKey(ctx, "famille-liste") != "" {
		return familyOffer{}, false
	}
	var first bool
	var family, home string
	if q.QueryRow(ctx, `
		SELECT s.family, s.home_commune, NOT s.listed_answered AND s.id = (SELECT id FROM sims WHERE user_id = $1 ORDER BY created_at LIMIT 1)
		FROM sims s WHERE s.id = $2 AND s.user_id = $1`, user, sim).Scan(&family, &home, &first) != nil || !first {
		return familyOffer{}, false
	}
	l, ok := h.fromWaitlist(ctx, user)
	if !ok || (l.Family == family && l.Commune == home) {
		return familyOffer{}, false
	}
	fam, ok := game.FindFamily(l.Family)
	if !ok {
		return familyOffer{}, false
	}
	for _, c := range world.Cities {
		if cm, ok := c.Commune(l.Commune); ok {
			return familyOffer{Family: fam, Commune: cm.Name, city: c, commune: cm}, true
		}
	}
	return familyOffer{}, false
}

// listedFamily: GET /sims/{id}/listed-family: {offer} or {offer: null}.
func (h *Handler) listedFamily(w http.ResponseWriter, r *http.Request) {
	o, ok := h.listedOffer(r.Context(), h.DB, auth.UserID(r.Context()), chi.URLParam(r, "id"))
	if !ok {
		httpx.JSON(w, http.StatusOK, map[string]any{"offer": nil})
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"offer": o})
}

// answerListedFamily: POST /sims/{id}/listed-family {accept}: takes the list's family back, or keeps one's own.
func (h *Handler) answerListedFamily(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Accept bool `json:"accept"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		o, ok := h.listedOffer(r.Context(), tx, auth.UserID(r.Context()), s.ID)
		if !ok {
			return game.Outcome{}, nil, errors.New("plus rien à choisir")
		}
		if _, err := tx.Exec(r.Context(), `UPDATE sims SET listed_answered = true WHERE id = $1`, s.ID); err != nil {
			return game.Outcome{}, nil, err
		}
		if !req.Accept {
			return game.Outcome{Text: "Tu gardes ta famille. Elle t'aime comme tu es !"}, nil, nil
		}
		old, _ := game.FindFamily(s.Family)
		s.Family = o.Family.ID
		// Still at the family home: the home is the new family's, in the list's commune (and the Sim at it if it was in the old one's).
		if s.Housing == old.Housing || old.ID == "" {
			s.Housing = o.Family.Housing
			if s.City == s.HomeCity && s.Commune == s.HomeCommune {
				s.City, s.Commune = o.city.ID, o.commune.ID
			}
			s.HomeCity, s.HomeCommune = o.city.ID, o.commune.ID
		}
		text := fmt.Sprintf("%s retrouve sa famille de la liste : une famille %s, %s. %s", s.FirstName, strings.ToLower(o.Family.Label), inCommune(o.Commune), o.Family.Hint)
		return game.Outcome{Text: text}, []Event{{Kind: "random", Text: text, GameTime: s.GameMinutes}}, nil
	})
}
