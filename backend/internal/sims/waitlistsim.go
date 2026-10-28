package sims

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/myahse/babi-life/backend/internal/auth"
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
