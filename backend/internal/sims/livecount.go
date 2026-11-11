package sims

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// FastStartKey is the update « demarrage-rapide »: a lighter start on a small phone, and the home
// page's live count of the players (web lib/features.ts, screens/Title.tsx).
const FastStartKey = "demarrage-rapide"

// LiveCountTTL: how long one count serves everyone (the home page asks on each visit).
const LiveCountTTL = 45 * time.Second

// LiveCounts is what the home page shows before signing up: no names, no accounts, two numbers.
type LiveCounts struct {
	// Online: players with the game open on a screen right now (the PNJ are never counted).
	Online int `json:"online"`
	// Today: players who played today (Abidjan's day), at least those online.
	Today int `json:"today"`
}

// LiveCount serves GET /players/live, public and cheap: counted at most once per LiveCountTTL
// whatever the traffic (one query for the whole site), the last count served meanwhile.
type LiveCount struct {
	DB *pgxpool.Pool
	// Online: the live hub's count of the Sims connected now (live.Hub.Online).
	Online func() int
	// Today: who played today (tests set their own; nil: the query below).
	Today func(ctx context.Context) (int, error)
	// Now: the clock (tests).
	Now func() time.Time

	mu   sync.Mutex
	at   time.Time
	last LiveCounts
}

// Count is the counts now, from the cache while it's fresh.
func (l *LiveCount) Count(ctx context.Context) (LiveCounts, error) {
	now := time.Now
	if l.Now != nil {
		now = l.Now
	}
	// One at a time: who comes while it's counting waits for that count instead of asking again.
	l.mu.Lock()
	defer l.mu.Unlock()
	if !l.at.IsZero() && now().Sub(l.at) < LiveCountTTL {
		return l.last, nil
	}
	today := l.Today
	if today == nil {
		today = l.today
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	n, err := today(ctx)
	if err != nil {
		// The database slow or away: the last count if there was one, else the error.
		if !l.at.IsZero() {
			return l.last, nil
		}
		return LiveCounts{}, err
	}
	c := LiveCounts{Today: n}
	if l.Online != nil {
		c.Online = l.Online()
	}
	c.Today = max(c.Today, c.Online)
	l.at, l.last = now(), c
	return c, nil
}

// today: the players (not the team's accounts) whose Sim was played since midnight in Abidjan.
func (l *LiveCount) today(ctx context.Context) (int, error) {
	var n int
	err := l.DB.QueryRow(ctx, `SELECT count(DISTINCT s.user_id) FROM sims s JOIN users u ON u.id = s.user_id
		WHERE NOT u.official AND s.last_tick >= date_trunc('day', now() AT TIME ZONE 'Africa/Abidjan') AT TIME ZONE 'Africa/Abidjan'`).Scan(&n)
	return n, err
}

func (l *LiveCount) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Closed, nothing to show: the home page doesn't ask then.
	if features.Default.BlocksKey(r.Context(), FastStartKey) != "" {
		httpx.Error(w, http.StatusNotFound, "pas encore")
		return
	}
	c, err := l.Count(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}
	// Browsers and the CDN may keep it a little too: it's the same for everyone.
	w.Header().Set("Cache-Control", "public, max-age=30")
	httpx.JSON(w, http.StatusOK, c)
}
