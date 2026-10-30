package account

import (
	"net/http"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/throttle"
)

// Requests: POST /account/deletion-request, the public page's form
// (web /suppression-compte) for someone who can't sign in any more: their
// e-mail and username are kept (deletion_requests) for the team, who finds
// the account on /admin and deletes it (or closes the request). The answer
// is the same whether an account matches or not: the form tells nobody who
// plays.
type Requests struct {
	DB *pgxpool.Pool
}

// 5 requests an hour from one network: someone who got it wrong, not a script.
var asked = throttle.New(5, time.Hour)

func (h *Requests) Ask(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Username string `json:"username"`
		Note     string `json:"note"`
		Website  string `json:"website"` // a field people don't see: bots fill it
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if !asked.Allow(throttle.IP(r)) {
		httpx.Error(w, http.StatusTooManyRequests, "trop de demandes depuis ce réseau : réessaie dans une heure")
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	username := strings.TrimSpace(body.Username)
	note := strings.TrimSpace(body.Note)
	if a, err := mail.ParseAddress(email); err != nil || a.Address != email || len(email) > 200 {
		httpx.Error(w, http.StatusUnprocessableEntity, "adresse e-mail invalide")
		return
	}
	if utf8.RuneCountInString(username) > 40 || utf8.RuneCountInString(note) > 500 {
		httpx.Error(w, http.StatusUnprocessableEntity, "c'est trop long")
		return
	}
	// A bot: told it's done, nothing kept.
	if body.Website != "" {
		httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}
	// Asked again while the first is waiting: the same request.
	if _, err := h.DB.Exec(r.Context(), `
		INSERT INTO deletion_requests (email, username, note)
		SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM deletion_requests WHERE status = 'open' AND email = $1 AND lower(username) = lower($2))`,
		email, username, note); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}
