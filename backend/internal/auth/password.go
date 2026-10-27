package auth

import (
	"context"
	"errors"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"

	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/throttle"
)

const minPassword = 8

// Wrong passwords: 10 per account and 40 per network in 15 minutes, then a pause.
// Sign-ups: 15 an hour per network. The testers' code: 8 wrong tries an hour per account.
var (
	failedLogins    = throttle.New(10, 15*time.Minute)
	signUps         = throttle.New(15, time.Hour)
	FailedCodes     = throttle.New(8, time.Hour)
	errTooManyTries = errors.New("trop d'essais : attends un quart d'heure avant de réessayer")
)

type credentials struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Username  string `json:"username"`
	// Email is an e-mail on sign-up; on login it may also be a username.
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (c *credentials) clean() {
	c.FirstName = strings.TrimSpace(c.FirstName)
	c.LastName = strings.TrimSpace(c.LastName)
	c.Username = strings.TrimSpace(c.Username)
	c.Email = strings.ToLower(strings.TrimSpace(c.Email))
}

// usernameRe: 3–24 letters, digits, _ or . (shown to every player).
var usernameRe = regexp.MustCompile(`^[A-Za-z0-9_.]{3,24}$`)

func (h *Handler) usernameFree(ctx context.Context, username, except string) (bool, error) {
	var taken bool
	err := h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE lower(username) = lower($1) AND id::text <> $2)`, username, except).Scan(&taken)
	return !taken, err
}

// UsernameAvailable answers GET /auth/username?u=… with {"available": bool}.
func (h *Handler) UsernameAvailable(w http.ResponseWriter, r *http.Request) {
	u := strings.TrimSpace(r.URL.Query().Get("u"))
	if !usernameRe.MatchString(u) {
		httpx.JSON(w, http.StatusOK, map[string]bool{"available": false})
		return
	}
	free, err := h.usernameFree(r.Context(), u, "")
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not check")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"available": free})
}

// SetUsername lets a signed-in player (a Google sign-up) choose a username once.
func (h *Handler) SetUsername(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	body.Username = strings.TrimSpace(body.Username)
	if !usernameRe.MatchString(body.Username) {
		httpx.Error(w, http.StatusUnprocessableEntity, "pseudo : 3 à 24 lettres, chiffres, _ ou .")
		return
	}
	var u User
	err := scanUser(h.DB.QueryRow(r.Context(), `UPDATE users SET username = $2 WHERE id = $1 RETURNING `+userColumns, UserID(r.Context()), body.Username), &u)
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		httpx.Error(w, http.StatusConflict, "ce pseudo est déjà pris")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save username")
		return
	}
	httpx.JSON(w, http.StatusOK, u)
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
	if !signUps.Allow(throttle.IP(r)) {
		httpx.Error(w, http.StatusTooManyRequests, "trop de comptes créés depuis ce réseau : réessaie dans une heure")
		return
	}
	c.clean()
	switch {
	case c.FirstName == "" || len(c.FirstName) > 40:
		httpx.Error(w, http.StatusUnprocessableEntity, "indique ton prénom")
		return
	case c.LastName == "" || len(c.LastName) > 40:
		httpx.Error(w, http.StatusUnprocessableEntity, "indique ton nom")
		return
	case !usernameRe.MatchString(c.Username):
		httpx.Error(w, http.StatusUnprocessableEntity, "pseudo : 3 à 24 lettres, chiffres, _ ou .")
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
	err = scanUser(h.DB.QueryRow(r.Context(), `
		INSERT INTO users (email, name, first_name, last_name, username, password_hash) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+userColumns, c.Email, c.FirstName+" "+c.LastName, c.FirstName, c.LastName, c.Username, string(hash),
	), &u)
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		if pg.ConstraintName == "users_username_key" {
			httpx.Error(w, http.StatusConflict, "ce pseudo est déjà pris")
		} else {
			httpx.Error(w, http.StatusConflict, "un compte existe déjà avec cet e-mail : connecte-toi")
		}
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create account")
		return
	}
	h.issue(w, r, u)
}

// Login signs in with email + password.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if err := httpx.Decode(r, &c); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	c.clean()
	// Too many wrong passwords for this account, or from this network: a pause (guessing passwords takes forever).
	ip := throttle.IP(r)
	if failedLogins.Full("acct|"+c.Email) || failedLogins.Full("ip|"+ip) {
		httpx.Error(w, http.StatusTooManyRequests, errTooManyTries.Error())
		return
	}
	failed := func() {
		failedLogins.Hit("acct|" + c.Email)
		failedLogins.Hit("ip|" + ip)
	}
	var u User
	var hash *string
	err := h.DB.QueryRow(r.Context(), `
		UPDATE users SET last_login_at = now() WHERE email = $1 OR lower(username) = $1
		RETURNING `+userColumns+`, password_hash`, c.Email,
	).Scan(&u.ID, &u.Email, &u.Name, &u.FirstName, &u.LastName, &u.Username, &u.AvatarURL, &u.CreatedAt, &u.Tester, &u.Adult, &hash) // userColumns, then the hash
	if errors.Is(err, pgx.ErrNoRows) {
		failed()
		httpx.Error(w, http.StatusUnauthorized, "e-mail, pseudo ou mot de passe incorrect")
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
		failed()
		httpx.Error(w, http.StatusUnauthorized, "e-mail, pseudo ou mot de passe incorrect")
		return
	}
	h.issue(w, r, u)
}
