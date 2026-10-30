package admin

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The « Suppressions » tab: the account deletions asked on the public page
// (/suppression-compte, account.Requests) by someone who can't sign in. Each
// shows the accounts its e-mail and username match; the team makes sure it's
// theirs (writing to that e-mail), then deletes the account (the same as from
// the game: auth.Handler.Erase) or closes the request.

// Deletion is one request, with the accounts it matches.
type Deletion struct {
	ID       int64      `json:"id"`
	Email    string     `json:"email"`
	Username string     `json:"username"`
	Note     string     `json:"note"`
	Status   string     `json:"status"`
	At       time.Time  `json:"at"`
	Done     *time.Time `json:"doneAt,omitempty"`
	Matches  []Match    `json:"matches"`
}

// Match: an account the request may be about, and by what.
type Match struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Sim      string `json:"sim"`
	ByEmail  bool   `json:"byEmail"`
	ByName   bool   `json:"byUsername"`
}

func (h *Handler) deletions(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	rows, err := h.DB.Query(r.Context(), `SELECT id, email, username, note, status, created_at, done_at FROM deletion_requests
		WHERE $1 = 'all' OR status = COALESCE(NULLIF($1, ''), 'open') ORDER BY created_at DESC LIMIT 200`, status)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	out := []Deletion{}
	for rows.Next() {
		var d Deletion
		if err := rows.Scan(&d.ID, &d.Email, &d.Username, &d.Note, &d.Status, &d.At, &d.Done); err != nil {
			rows.Close()
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		d.Matches = []Match{}
		out = append(out, d)
	}
	rows.Close()
	for i := range out {
		if out[i].Status != "open" {
			continue
		}
		m, err := h.DB.Query(r.Context(), `
			SELECT u.id, u.name, COALESCE(u.username, ''), u.email,
				COALESCE((SELECT s.first_name || ' ' || s.last_name FROM sims s WHERE s.user_id = u.id ORDER BY s.created_at LIMIT 1), ''),
				lower(u.email) = lower($1), $2 <> '' AND lower(COALESCE(u.username, '')) = lower($2)
			FROM users u WHERE lower(u.email) = lower($1) OR ($2 <> '' AND lower(u.username) = lower($2)) LIMIT 5`, out[i].Email, out[i].Username)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		for m.Next() {
			var x Match
			if m.Scan(&x.ID, &x.Name, &x.Username, &x.Email, &x.Sim, &x.ByEmail, &x.ByName) == nil {
				out[i].Matches = append(out[i].Matches, x)
			}
		}
		m.Close()
	}
	httpx.JSON(w, http.StatusOK, out)
}

// deletionAct: POST /admin/deletions/{id} {action: "delete", user} deletes that account
// (one the request matches) and closes the request; {action: "close"} closes it without.
func (h *Handler) deletionAct(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body struct {
		Action string `json:"action"`
		User   string `json:"user"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	var email, username string
	if err := h.DB.QueryRow(ctx, `SELECT email, username FROM deletion_requests WHERE id = $1 AND status = 'open'`, id).Scan(&email, &username); err != nil {
		httpx.Error(w, http.StatusNotFound, "demande introuvable ou déjà traitée")
		return
	}
	switch body.Action {
	case "close":
		if _, err := h.DB.Exec(ctx, `UPDATE deletion_requests SET status = 'closed', done_at = now() WHERE id = $1`, id); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		h.Log(ctx, "Demande de suppression classée", "n° "+strconv.FormatInt(id, 10))
	case "delete":
		if h.Erase == nil {
			httpx.Error(w, http.StatusNotImplemented, "suppression indisponible")
			return
		}
		// Only an account the request names (its e-mail or its username).
		var ok bool
		_ = h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id::text = $1 AND (lower(email) = lower($2) OR ($3 <> '' AND lower(username) = lower($3))))`, body.User, email, username).Scan(&ok)
		if !ok {
			httpx.Error(w, http.StatusUnprocessableEntity, "ce compte ne correspond pas à la demande")
			return
		}
		if err := h.Erase(ctx, body.User, "par l'équipe, demande n° "+strconv.FormatInt(id, 10)); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "la suppression n'a pas pu se faire : réessaie")
			return
		}
		if _, err := h.DB.Exec(ctx, `UPDATE deletion_requests SET status = 'done', done_at = COALESCE(done_at, now()) WHERE id = $1`, id); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
	default:
		httpx.Error(w, http.StatusBadRequest, "action inconnue")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}
