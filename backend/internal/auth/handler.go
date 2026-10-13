package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	AvatarURL string    `json:"avatarUrl"`
	CreatedAt time.Time `json:"createdAt"`
}

type Handler struct {
	DB       *pgxpool.Pool
	Tokens   Tokens
	Verifier *GoogleVerifier // nil when Google sign-in is not configured
	DevLogin bool
}

type session struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// Google exchanges a Google ID token (from the Sign-In button) for a session.
func (h *Handler) Google(w http.ResponseWriter, r *http.Request) {
	if h.Verifier == nil {
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
	id, err := h.Verifier.Verify(r.Context(), body.Credential)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "invalid google credential")
		return
	}
	h.signIn(w, r.Context(), id)
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
	h.signIn(w, r.Context(), GoogleIdentity{Sub: "dev:" + slug, Email: slug + "@dev.local", Name: name})
}

func (h *Handler) signIn(w http.ResponseWriter, ctx context.Context, id GoogleIdentity) {
	var u User
	err := h.DB.QueryRow(ctx, `
		INSERT INTO users (google_sub, email, name, avatar_url)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (google_sub) DO UPDATE
		   SET email = EXCLUDED.email, name = EXCLUDED.name,
		       avatar_url = EXCLUDED.avatar_url, last_login_at = now()
		RETURNING id, email, name, avatar_url, created_at`,
		id.Sub, id.Email, id.Name, id.Picture,
	).Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.CreatedAt)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save user")
		return
	}
	token, err := h.Tokens.Issue(u.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not issue session")
		return
	}
	httpx.JSON(w, http.StatusOK, session{Token: token, User: u})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	var u User
	err := h.DB.QueryRow(r.Context(),
		`SELECT id, email, name, avatar_url, created_at FROM users WHERE id = $1`, UserID(r.Context()),
	).Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.CreatedAt)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "user not found")
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}
