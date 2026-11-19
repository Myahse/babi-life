package admin

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The links the team pastes in /admin (« Testeurs de l'appli ») and the game shows: for now the Android app's
// testers, the Google group to join and the Play Store's page to accept the test (web components/TestersCard.tsx,
// update « testeurs-android »). Empty: the card doesn't show.

// teamLinks: each link, and the hosts it may point to (nothing else is accepted, so a typo can't send players elsewhere).
var teamLinks = map[string][]string{
	"testeurs-groupe": {"groups.google.com"},
	"testeurs-play":   {"play.google.com"},
}

// linksCache: the public read, at most every 30 s from the database.
type linksCache struct {
	mu   sync.Mutex
	at   time.Time
	vals map[string]string
}

var links linksCache

func (h *Handler) readLinks(ctx context.Context) (map[string]string, error) {
	out := map[string]string{}
	for id := range teamLinks {
		out[id] = ""
	}
	rows, err := h.DB.Query(ctx, `SELECT id, url FROM team_links`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id, u string
		if rows.Scan(&id, &u) == nil {
			if _, ok := teamLinks[id]; ok {
				out[id] = u
			}
		}
	}
	return out, rows.Err()
}

// links: GET /admin/links, every link as set.
func (h *Handler) links(w http.ResponseWriter, r *http.Request) {
	vals, err := h.readLinks(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, vals)
}

// setLink: POST /admin/links/{id} {"url": "https://…"} — set or cleared ("").
func (h *Handler) setLink(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	hosts, ok := teamLinks[id]
	if !ok {
		httpx.Error(w, http.StatusNotFound, "lien inconnu")
		return
	}
	var req struct {
		URL string `json:"url"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	u := strings.TrimSpace(req.URL)
	if u != "" && !linkOK(u, hosts) {
		httpx.Error(w, http.StatusUnprocessableEntity, "le lien doit commencer par https://"+hosts[0])
		return
	}
	if _, err := h.DB.Exec(r.Context(), `INSERT INTO team_links (id, url) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET url = $2, updated_at = now()`, id, u); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	links.mu.Lock()
	links.vals = nil
	links.mu.Unlock()
	httpx.JSON(w, http.StatusOK, map[string]string{"id": id, "url": u})
}

// linkOK: an https link to one of the hosts allowed, nothing more.
func linkOK(raw string, hosts []string) bool {
	p, err := url.Parse(raw)
	if err != nil || p.Scheme != "https" || p.User != nil || len(raw) > 500 {
		return false
	}
	for _, h := range hosts {
		if strings.EqualFold(p.Hostname(), h) {
			return true
		}
	}
	return false
}

// Testers: GET /testeurs (public, the game): the testers' links, empty while not set.
func (h *Handler) Testers(w http.ResponseWriter, r *http.Request) {
	links.mu.Lock()
	vals := links.vals
	fresh := vals != nil && time.Since(links.at) < 30*time.Second
	links.mu.Unlock()
	if !fresh {
		v, err := h.readLinks(r.Context())
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		vals = v
		links.mu.Lock()
		links.vals, links.at = v, time.Now()
		links.mu.Unlock()
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	httpx.JSON(w, http.StatusOK, map[string]string{"group": vals["testeurs-groupe"], "play": vals["testeurs-play"]})
}
