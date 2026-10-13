package auth

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

const minPassword = 8

type credentials struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (c *credentials) clean() {
	c.Name = strings.TrimSpace(c.Name)
	c.Email = strings.ToLower(strings.TrimSpace(c.Email))
}

func validEmail(s string) bool {
	a, err := mail.ParseAddress(s)
	return err == nil && a.Address == s && strings.Contains(s[strings.Index(s, "@"):], ".")
}

// Register creates an email + password account and signs it in.
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if err := httpx.Decode(r, &c); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	c.clean()
	switch {
	case c.Name == "" || len(c.Name) > 60:
		httpx.Error(w, http.StatusUnprocessableEntity, "indique ton nom")
		return
	case !validEmail(c.Email):
		httpx.Error(w, http.StatusUnprocessableEntity, "adresse e-mail invalide")
		return
	case len(c.Password) < minPassword || len(c.Password) > 72: // bcrypt reads 72 bytes at most
		httpx.Error(w, http.StatusUnprocessableEntity, "le mot de passe doit faire au moins 8 caractères")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(c.Password), bcrypt.DefaultCost)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not hash password")
		return
	}
	var u User
	err = h.DB.QueryRow(r.Context(), `
		INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
		RETURNING id, email, name, avatar_url, created_at`, c.Email, c.Name, string(hash),
	).Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.CreatedAt)
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		httpx.Error(w, http.StatusConflict, "un compte existe déjà avec cet e-mail : connecte-toi")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create account")
		return
	}
	h.issue(w, u)
}

// Login signs in with email + password.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if err := httpx.Decode(r, &c); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	c.clean()
	var u User
	var hash *string
	err := h.DB.QueryRow(r.Context(), `
		UPDATE users SET last_login_at = now() WHERE email = $1
		RETURNING id, email, name, avatar_url, created_at, password_hash`, c.Email,
	).Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.CreatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusUnauthorized, "e-mail ou mot de passe incorrect")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not sign in")
		return
	}
	if hash == nil {
		httpx.Error(w, http.StatusUnauthorized, "ce compte utilise Google : clique sur « Continuer avec Google »")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(*hash), []byte(c.Password)) != nil {
		httpx.Error(w, http.StatusUnauthorized, "e-mail ou mot de passe incorrect")
		return
	}
	h.issue(w, u)
}
