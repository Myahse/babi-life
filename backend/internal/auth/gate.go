package auth

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// GameGate keeps the game shut on the server until launch (GAME_OPEN=true):
// the site's own lock (web lib/launch.ts) is only in the browser, and an
// account could call the API by itself. Before launch, a signed-in account
// may still make its Sim from the wish list and look at it (GET /sims,
// POST /sims, GET /sims/{id}); everything else (playing, the shop, the
// politics) is for the team's accounts: testers, or those the testers'
// reset turned back into players (tester_off).
func GameGate(db *pgxpool.Pool, open bool) func(http.Handler) http.Handler {
	type seen struct {
		ok bool
		at time.Time
	}
	var mu sync.Mutex
	cache := map[string]seen{}
	team := func(r *http.Request) bool {
		user := UserID(r.Context())
		mu.Lock()
		c, hit := cache[user]
		mu.Unlock()
		if hit && time.Since(c.at) < time.Minute {
			return c.ok
		}
		var ok bool
		if err := db.QueryRow(r.Context(), `SELECT tester OR tester_off FROM users WHERE id = $1`, user).Scan(&ok); err != nil {
			return false
		}
		mu.Lock()
		cache[user] = seen{ok, time.Now()}
		mu.Unlock()
		return ok
	}
	return func(next http.Handler) http.Handler {
		if open {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if WishList(r.Method, r.URL.Path) || team(r) {
				next.ServeHTTP(w, r)
				return
			}
			httpx.Error(w, http.StatusForbidden, "le jeu n'est pas encore ouvert : rendez-vous à la sortie")
		})
	}
}

// WishList: what the wish list does before launch: make one's Sim, see one's Sims.
func WishList(method, path string) bool {
	rest, ok := strings.CutPrefix(path, "/api/v1/sims")
	if !ok || (rest != "" && !strings.HasPrefix(rest, "/")) {
		return false
	}
	switch {
	case rest == "" || rest == "/":
		return method == http.MethodGet || method == http.MethodPost
	case method == http.MethodGet:
		// /sims/{id} only, not what's under it.
		return !strings.Contains(strings.Trim(rest, "/"), "/")
	}
	return false
}
