package auth

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Sessions: each sign-in is a session, one device (a phone, a computer, the
// app). The player sees the devices signed in to their account, when each was
// last used, and signs one out (or all the others): its token stops working
// at once on this server (within a few seconds on the others), and its live
// connection is closed. Tokens from before sessions keep working until the
// player signs all the other devices out.

const (
	// How long a session's check is trusted before asking the database again.
	sessionCache = 15 * time.Second
	// How often a session's « last used » is written.
	seenEvery = 5 * time.Minute
)

type Sessions struct {
	DB *pgxpool.Pool
	// OnRevoke: sessions just signed out (to close their live connection).
	OnRevoke func(sids ...string)

	mu    sync.Mutex
	known map[string]checked
	seen  map[string]time.Time
}

type checked struct {
	ok    bool
	until time.Time
}

func NewSessions(db *pgxpool.Pool) *Sessions {
	return &Sessions{DB: db, known: map[string]checked{}, seen: map[string]time.Time{}}
}

// Start: a new session for a user signing in from this request's device.
func (s *Sessions) Start(ctx context.Context, userID string, r *http.Request) (string, error) {
	var id string
	err := s.DB.QueryRow(ctx, `INSERT INTO sessions (user_id, device) VALUES ($1, $2) RETURNING id`, userID, DeviceName(r.UserAgent())).Scan(&id)
	return id, err
}

// Valid: is this session still signed in? (A token from before sessions: unless all the other devices were signed out since.)
func (s *Sessions) Valid(ctx context.Context, userID, sid string, issued time.Time) bool {
	key := "s:" + sid
	if sid == "" {
		key = "u:" + userID + ":" + issued.UTC().Format(time.RFC3339)
	}
	now := time.Now()
	s.mu.Lock()
	c, ok := s.known[key]
	s.mu.Unlock()
	if ok && now.Before(c.until) {
		if c.ok && sid != "" {
			s.touch(sid, now)
		}
		return c.ok
	}
	valid := false
	if sid == "" {
		var after *time.Time
		if err := s.DB.QueryRow(ctx, `SELECT tokens_after FROM users WHERE id = $1`, userID).Scan(&after); err == nil {
			valid = after == nil || !issued.Before(*after)
		}
	} else {
		var revoked *time.Time
		if err := s.DB.QueryRow(ctx, `SELECT revoked_at FROM sessions WHERE id = $1 AND user_id = $2`, sid, userID).Scan(&revoked); err == nil {
			valid = revoked == nil
		}
	}
	s.mu.Lock()
	if len(s.known) > 50000 {
		s.known = map[string]checked{}
	}
	s.known[key] = checked{valid, now.Add(sessionCache)}
	s.mu.Unlock()
	if valid && sid != "" {
		s.touch(sid, now)
	}
	return valid
}

// touch: the session was used now (written at most every few minutes).
func (s *Sessions) touch(sid string, now time.Time) {
	s.mu.Lock()
	last := s.seen[sid]
	due := now.Sub(last) > seenEvery
	if due {
		if len(s.seen) > 50000 {
			s.seen = map[string]time.Time{}
		}
		s.seen[sid] = now
	}
	s.mu.Unlock()
	if due {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_, _ = s.DB.Exec(ctx, `UPDATE sessions SET last_seen = now() WHERE id = $1`, sid)
		}()
	}
}

func (s *Sessions) forget(sids ...string) {
	s.mu.Lock()
	for _, sid := range sids {
		s.known["s:"+sid] = checked{false, time.Now().Add(sessionCache)}
	}
	s.mu.Unlock()
	if s.OnRevoke != nil && len(sids) > 0 {
		s.OnRevoke(sids...)
	}
}

// Device is one session as the player sees it.
type Device struct {
	ID       string    `json:"id"`
	Device   string    `json:"device"`
	Created  time.Time `json:"createdAt"`
	LastSeen time.Time `json:"lastSeen"`
	Current  bool      `json:"current"`
}

// List: GET /me/sessions, the devices signed in (the one asking first).
func (s *Sessions) List(w http.ResponseWriter, r *http.Request) {
	me := SessionID(r.Context())
	rows, err := s.DB.Query(r.Context(), `SELECT id, device, created_at, last_seen FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND last_seen > now() - interval '31 days' ORDER BY last_seen DESC LIMIT 50`, UserID(r.Context()))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	list := []Device{}
	for rows.Next() {
		var d Device
		if err := rows.Scan(&d.ID, &d.Device, &d.Created, &d.LastSeen); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		d.Current = d.ID == me
		if d.Current {
			list = append([]Device{d}, list...)
		} else {
			list = append(list, d)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"sessions": list, "legacy": me == ""})
}

// Revoke: DELETE /me/sessions/{session}, sign that device out.
func (s *Sessions) Revoke(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "session")
	tag, err := s.DB.Exec(r.Context(), `UPDATE sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`, id, UserID(r.Context()))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "appareil introuvable")
		return
	}
	s.forget(id)
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// End: DELETE /me/session, signing out of this device (its token stops working everywhere).
func (s *Sessions) End(w http.ResponseWriter, r *http.Request) {
	me := SessionID(r.Context())
	if me != "" {
		if _, err := s.DB.Exec(r.Context(), `UPDATE sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2`, me, UserID(r.Context())); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		s.forget(me)
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// RevokeOthers: POST /me/sessions/others, sign every other device out (and the tokens from before sessions).
func (s *Sessions) RevokeOthers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	me, user := SessionID(ctx), UserID(ctx)
	rows, err := s.DB.Query(ctx, `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND id::text <> $2 AND revoked_at IS NULL RETURNING id`, user, me)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	var gone []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			gone = append(gone, id)
		}
	}
	rows.Close()
	if me != "" {
		// The tokens from before sessions: no more (this device's has a session, it stays).
		if _, err := s.DB.Exec(ctx, `UPDATE users SET tokens_after = now() WHERE id = $1`, user); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		s.mu.Lock()
		for k := range s.known {
			if strings.HasPrefix(k, "u:"+user+":") {
				delete(s.known, k)
			}
		}
		s.mu.Unlock()
	}
	s.forget(gone...)
	httpx.JSON(w, http.StatusOK, map[string]int{"signedOut": len(gone)})
}

// DeviceName: a short name for a device from its browser's user agent (« Android · Chrome », « iPhone · Safari », « L'appli Android »…).
func DeviceName(ua string) string {
	l := strings.ToLower(ua)
	app := strings.Contains(l, "babitest") || strings.Contains(l, "babilife")
	os := "Appareil"
	switch {
	case strings.Contains(l, "iphone"):
		os = "iPhone"
	case strings.Contains(l, "ipad"):
		os = "iPad"
	case strings.Contains(l, "android"):
		os = "Android"
	case strings.Contains(l, "windows"):
		os = "Windows"
	case strings.Contains(l, "mac os") || strings.Contains(l, "macintosh"):
		os = "Mac"
	case strings.Contains(l, "cros"):
		os = "Chromebook"
	case strings.Contains(l, "linux"):
		os = "Linux"
	}
	if app {
		return "L'appli Babi Life · " + os
	}
	browser := ""
	switch {
	case strings.Contains(l, "edg/"):
		browser = "Edge"
	case strings.Contains(l, "opr/") || strings.Contains(l, "opera"):
		browser = "Opera"
	case strings.Contains(l, "samsungbrowser"):
		browser = "Samsung Internet"
	case strings.Contains(l, "firefox"):
		browser = "Firefox"
	case strings.Contains(l, "chrome") || strings.Contains(l, "crios"):
		browser = "Chrome"
	case strings.Contains(l, "safari"):
		browser = "Safari"
	}
	if browser == "" {
		return os
	}
	return os + " · " + browser
}
