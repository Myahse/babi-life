package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/adminkey"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	FirstName string    `json:"firstName"`
	LastName  string    `json:"lastName"`
	Username  string    `json:"username"` // "" until chosen
	AvatarURL string    `json:"avatarUrl"`
	CreatedAt time.Time `json:"createdAt"`
	// Tester: a team account, with the testers' toolbox (migration 021).
	Tester bool `json:"tester"`
}

// userColumns and scanUser read a users row the same way everywhere.
const userColumns = `id, email, name, first_name, last_name, coalesce(username, ''), avatar_url, created_at, tester`

func scanUser(row interface{ Scan(...any) error }, u *User) error {
	return row.Scan(&u.ID, &u.Email, &u.Name, &u.FirstName, &u.LastName, &u.Username, &u.AvatarURL, &u.CreatedAt, &u.Tester)
}

type Handler struct {
	DB       *pgxpool.Pool
	Tokens   Tokens
	Verifier *GoogleVerifier   // nil when the Google client id is not set
	Firebase *FirebaseVerifier // nil when FIREBASE_PROJECT_ID is not set
	DevLogin bool
}

type session struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// Google exchanges a Google ID token for a session. The token may come from
// the Google button or from Firebase Auth.
func (h *Handler) Google(w http.ResponseWriter, r *http.Request) {
	if h.Verifier == nil && h.Firebase == nil {
		httpx.Error(w, http.StatusNotImplemented, "google sign-in is not configured")
		return
	}
	var body struct {
		Credential string `json:"credential"`
	}
	if err := httpx.Decode(r, &body); err != nil || body.Credential == "" {
		httpx.Error(w, http.StatusBadRequest, "credential is required")
		return
	}
	id, err := h.Identify(r.Context(), body.Credential)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "invalid google credential")
		return
	}
	h.signIn(w, r.Context(), id)
}

// Identify checks a token from either Google Sign-In or Firebase Auth.
func (h *Handler) Identify(ctx context.Context, token string) (GoogleIdentity, error) {
	var first error
	if h.Verifier != nil {
		id, err := h.Verifier.Verify(ctx, token)
		if err == nil {
			return id, nil
		}
		first = err
	}
	if h.Firebase != nil {
		return h.Firebase.Verify(ctx, token)
	}
	if first != nil {
		return GoogleIdentity{}, first
	}
	return GoogleIdentity{}, errors.New("google sign-in is not configured")
}

// Dev signs in as a local test player. Only mounted when DEV_LOGIN=true.
func (h *Handler) Dev(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	_ = httpx.Decode(r, &body)
	name := strings.TrimSpace(body.Name)
	if name == "" {
		name = "Joueur Test"
	}
	slug := strings.ToLower(strings.Join(strings.Fields(name), "."))
	first, last, _ := strings.Cut(name, " ")
	h.signIn(w, r.Context(), GoogleIdentity{Sub: "dev:" + slug, Email: slug + "@dev.local", Name: name, FirstName: first, LastName: last})
}

func (h *Handler) signIn(w http.ResponseWriter, ctx context.Context, id GoogleIdentity) {
	// Someone who registered with this (Google-verified) e-mail gets Google linked to that account.
	if _, err := h.DB.Exec(ctx, `UPDATE users SET google_sub = $1 WHERE email = $2 AND google_sub IS NULL`, id.Sub, id.Email); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save user")
		return
	}
	if id.FirstName == "" {
		id.FirstName, id.LastName, _ = strings.Cut(id.Name, " ")
	}
	var u User
	err := scanUser(h.DB.QueryRow(ctx, `
		INSERT INTO users (google_sub, email, name, first_name, last_name, avatar_url)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (google_sub) DO UPDATE
		   SET email = EXCLUDED.email, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url,
		       first_name = CASE WHEN users.first_name = '' THEN EXCLUDED.first_name ELSE users.first_name END,
		       last_name  = CASE WHEN users.last_name  = '' THEN EXCLUDED.last_name  ELSE users.last_name  END,
		       last_login_at = now()
		RETURNING `+userColumns,
		id.Sub, id.Email, id.Name, id.FirstName, id.LastName, id.Picture,
	), &u)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save user")
		return
	}
	h.issue(w, u)
}

func (h *Handler) issue(w http.ResponseWriter, u User) {
	token, err := h.Tokens.Issue(u.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not issue session")
		return
	}
	httpx.JSON(w, http.StatusOK, session{Token: token, User: u})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	var u User
	err := scanUser(h.DB.QueryRow(r.Context(), `SELECT `+userColumns+` FROM users WHERE id = $1`, UserID(r.Context())), &u)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "user not found")
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}

// BecomeTester: with the testers' code (or the admin key), the account is a
// tester's from now on, on every browser.
func (h *Handler) BecomeTester(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code string `json:"code"`
	}
	if err := httpx.Decode(r, &body); err != nil || !adminkey.Tester(body.Code) {
		httpx.Error(w, http.StatusForbidden, "code testeur incorrect")
		return
	}
	// After the testers' reset (sims.ResetTesters) the code no longer works for the account: only /admin can.
	var off bool
	if err := h.DB.QueryRow(r.Context(), `SELECT tester_off FROM users WHERE id = $1`, UserID(r.Context())).Scan(&off); err == nil && off {
		httpx.Error(w, http.StatusForbidden, "les tests sont finis : ton compte est un compte joueur")
		return
	}
	var u User
	if err := scanUser(h.DB.QueryRow(r.Context(), `UPDATE users SET tester = true WHERE id = $1 RETURNING `+userColumns, UserID(r.Context())), &u); err != nil {
		httpx.Error(w, http.StatusUnauthorized, "user not found")
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}
