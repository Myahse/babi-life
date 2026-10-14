// Package waitlist keeps the wish list: people who sign up, before the game
// opens, to hear when it does (and to test it first, if they like).
package waitlist

import (
	"crypto/subtle"
	"encoding/csv"
	"errors"
	"net"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

type Handler struct {
	DB *pgxpool.Pool
	// AdminKey unlocks the export (WAITLIST_ADMIN_KEY); empty: no export.
	AdminKey string

	mu   sync.Mutex
	seen map[string][]time.Time // sign-ups per IP, for the last hour
}

// Contact is an e-mail or a phone number, normalised; kind says which.
func Contact(raw string) (contact, kind string, err error) {
	raw = strings.TrimSpace(raw)
	if strings.Contains(raw, "@") {
		a, err := mail.ParseAddress(raw)
		if err != nil || a.Address != raw || len(raw) > 200 {
			return "", "", errors.New("cet e-mail n'a pas l'air bon")
		}
		return strings.ToLower(raw), "email", nil
	}
	digits := regexp.MustCompile(`[^\d]`).ReplaceAllString(raw, "")
	switch {
	case strings.HasPrefix(raw, "+") && len(digits) >= 8 && len(digits) <= 15:
		return "+" + digits, "phone", nil
	case strings.HasPrefix(digits, "00") && len(digits) >= 10 && len(digits) <= 17:
		return "+" + digits[2:], "phone", nil
	case len(digits) == 10: // a number in Côte d'Ivoire, without +225
		return "+225" + digits, "phone", nil
	}
	return "", "", errors.New("mets un e-mail ou un numéro WhatsApp (ex. 07 07 07 07 07)")
}

var errTooMany = errors.New("trop d'inscriptions depuis ce réseau : réessaie plus tard")

// allow: at most 20 sign-ups an hour from one address (a whole cyber café, but not a script).
func (h *Handler) allow(ip string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.seen == nil {
		h.seen = map[string][]time.Time{}
	}
	cut := time.Now().Add(-time.Hour)
	recent := h.seen[ip][:0]
	for _, t := range h.seen[ip] {
		if t.After(cut) {
			recent = append(recent, t)
		}
	}
	if len(recent) >= 20 {
		h.seen[ip] = recent
		return false
	}
	h.seen[ip] = append(recent, time.Now())
	return true
}

// Join: POST /api/v1/waitlist {firstName, contact, commune, beta, source}.
func (h *Handler) Join(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FirstName string `json:"firstName"`
		Contact   string `json:"contact"`
		Commune   string `json:"commune"`
		Beta      bool   `json:"beta"`
		Source    string `json:"source"`
		Website   string `json:"website"` // a field people don't see: bots fill it
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	name := strings.TrimSpace(req.FirstName)
	if n := utf8.RuneCountInString(name); n < 1 || n > 60 {
		httpx.Error(w, http.StatusUnprocessableEntity, "dis-nous ton prénom")
		return
	}
	contact, kind, err := Contact(req.Contact)
	if err != nil {
		httpx.Error(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	if req.Website != "" {
		httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true}) // a bot: say yes, keep nothing
		return
	}
	ip := r.RemoteAddr
	if host, _, err := net.SplitHostPort(ip); err == nil {
		ip = host
	}
	if !h.allow(ip) {
		httpx.Error(w, http.StatusTooManyRequests, errTooMany.Error())
		return
	}
	clip := func(s string, n int) string {
		s = strings.TrimSpace(s)
		if utf8.RuneCountInString(s) > n {
			return string([]rune(s)[:n])
		}
		return s
	}
	_, err = h.DB.Exec(r.Context(), `INSERT INTO waitlist (first_name, contact, kind, commune, beta, source) VALUES ($1, $2, $3, $4, $5, $6)`,
		name, contact, kind, clip(req.Commune, 60), req.Beta, clip(req.Source, 40))
	var pg *pgconn.PgError
	already := errors.As(err, &pg) && pg.Code == "23505"
	if err != nil && !already {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	var count int
	_ = h.DB.QueryRow(r.Context(), `SELECT count(*) FROM waitlist`).Scan(&count)
	httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true, "already": already, "count": count})
}

// Count: GET /api/v1/waitlist/count — how many are on the list (shown on the page).
func (h *Handler) Count(w http.ResponseWriter, r *http.Request) {
	var count int
	if err := h.DB.QueryRow(r.Context(), `SELECT count(*) FROM waitlist`).Scan(&count); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]int{"count": count})
}

// Export: GET /api/v1/waitlist/export with header X-Admin-Key — the list, as CSV.
func (h *Handler) Export(w http.ResponseWriter, r *http.Request) {
	key := r.Header.Get("X-Admin-Key")
	if h.AdminKey == "" || subtle.ConstantTimeCompare([]byte(key), []byte(h.AdminKey)) != 1 {
		httpx.Error(w, http.StatusUnauthorized, "clé invalide")
		return
	}
	rows, err := h.DB.Query(r.Context(), `SELECT first_name, contact, kind, commune, beta, source, created_at FROM waitlist ORDER BY created_at`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="babi-life-liste.csv"`)
	out := csv.NewWriter(w)
	_ = out.Write([]string{"prenom", "contact", "type", "commune", "beta", "source", "inscrit_le"})
	for rows.Next() {
		var name, contact, kind, commune, source string
		var beta bool
		var at time.Time
		if rows.Scan(&name, &contact, &kind, &commune, &beta, &source, &at) == nil {
			b := "non"
			if beta {
				b = "oui"
			}
			_ = out.Write([]string{name, contact, kind, commune, b, source, at.Format(time.RFC3339)})
		}
	}
	out.Flush()
}
