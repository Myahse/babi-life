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
	// Adult: the player said they are 18 or over (migration 035); romance needs it.
	Adult bool `json:"adult"`
	// Lang: the game's language chosen on the account (migration 093): "fr", "en", "" never chosen.
	Lang string `json:"lang,omitempty"`
}

// userColumns and scanUser read a users row the same way everywhere.
const userColumns = `id, email, name, first_name, last_name, coalesce(username, ''), avatar_url, created_at, tester, adult_at IS NOT NULL, lang`

func scanUser(row interface{ Scan(...any) error }, u *User) error {
	return row.Scan(&u.ID, &u.Email, &u.Name, &u.FirstName, &u.LastName, &u.Username, &u.AvatarURL, &u.CreatedAt, &u.Tester, &u.Adult, &u.Lang)
}

type Handler struct {
	DB       *pgxpool.Pool
	Tokens   Tokens
	Verifier *GoogleVerifier   // nil when the Google client id is not set
	Firebase *FirebaseVerifier // nil when FIREBASE_PROJECT_ID is not set
	DevLogin bool
	// Sessions: one per sign-in, the devices of the account (sessions.go); nil: tokens only.
	Sessions *Sessions
	// Mail: sends the « mot de passe oublié » links (reset.go); nil: not set up.
	Mail Mailer
	// SiteURL: where the game is, for the links in e-mails.
	SiteURL string
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
	h.signIn(w, r, id)
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
	h.signIn(w, r, GoogleIdentity{Sub: "dev:" + slug, Email: slug + "@dev.local", Name: name, FirstName: first, LastName: last})
}

func (h *Handler) signIn(w http.ResponseWriter, r *http.Request, id GoogleIdentity) {
	ctx := r.Context()
	// Someone who registered with this (Google-verified) e-mail gets Google linked to that account.
	if _, err := h.DB.Exec(ctx, `UPDATE users SET google_sub = $1 WHERE email = $2 AND google_sub IS NULL`, id.Sub, id.Email); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save user")
		return
	}
	if id.FirstName == "" {
		id.FirstName, id.LastName, _ = strings.Cut(id.Name, " ")
	}
	var u User
	var created bool
	err := h.DB.QueryRow(ctx, `
		INSERT INTO users (google_sub, email, name, first_name, last_name, avatar_url)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (google_sub) DO UPDATE
		   SET email = EXCLUDED.email, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url,
		       first_name = CASE WHEN users.first_name = '' THEN EXCLUDED.first_name ELSE users.first_name END,
		       last_name  = CASE WHEN users.last_name  = '' THEN EXCLUDED.last_name  ELSE users.last_name  END,
		       last_login_at = now()
		RETURNING `+userColumns+`, xmax = 0`,
		id.Sub, id.Email, id.Name, id.FirstName, id.LastName, id.Picture,
	).Scan(&u.ID, &u.Email, &u.Name, &u.FirstName, &u.LastName, &u.Username, &u.AvatarURL, &u.CreatedAt, &u.Tester, &u.Adult, &u.Lang, &created) // userColumns, then whether it was just made
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save user")
		return
	}
	// A new account, by a friend's link (referral.go).
	if created {
		_ = RecordReferral(ctx, h.DB, u.ID, refOf(r))
	}
	h.issue(w, r, u)
}

// issue: a new session for this device, and its token.
func (h *Handler) issue(w http.ResponseWriter, r *http.Request, u User) {
	sid := ""
	if h.Sessions != nil {
		var err error
		if sid, err = h.Sessions.Start(r.Context(), u.ID, r); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not issue session")
			return
		}
	}
	token, err := h.Tokens.Issue(u.ID, sid)
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

// ConfirmAdult: the player says once that they are 18 or over (romance in the game).
func (h *Handler) ConfirmAdult(w http.ResponseWriter, r *http.Request) {
	var u User
	if err := scanUser(h.DB.QueryRow(r.Context(), `UPDATE users SET adult_at = coalesce(adult_at, now()) WHERE id = $1 RETURNING `+userColumns, UserID(r.Context())), &u); err != nil {
		httpx.Error(w, http.StatusUnauthorized, "user not found")
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}

// SetLang keeps the game's language on the account (« Réglages » › « Langue »): it follows the player.
func (h *Handler) SetLang(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Lang string `json:"lang"`
	}
	if err := httpx.Decode(r, &body); err != nil || (body.Lang != "fr" && body.Lang != "en") {
		httpx.Error(w, http.StatusBadRequest, "langue inconnue")
		return
	}
	var u User
	if err := scanUser(h.DB.QueryRow(r.Context(), `UPDATE users SET lang = $2 WHERE id = $1 RETURNING `+userColumns, UserID(r.Context()), body.Lang), &u); err != nil {
		httpx.Error(w, http.StatusUnauthorized, "user not found")
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}

// BecomeTester: with the testers' code (or the admin key), the account is a
// tester's from now on, on every browser. Typed: the person has just typed
// the code (on /testeur or in the toolbox), not a browser sending the one it
// kept, so it holds even after the testers' reset.
func (h *Handler) BecomeTester(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code  string `json:"code"`
		Typed bool   `json:"typed"`
	}
	user := UserID(r.Context())
	if FailedCodes.Full(user) {
		httpx.Error(w, http.StatusTooManyRequests, "trop d'essais : réessaie dans une heure")
		return
	}
	if err := httpx.Decode(r, &body); err != nil || !adminkey.Tester(body.Code) {
		FailedCodes.Hit(user)
		httpx.Error(w, http.StatusForbidden, "code testeur incorrect")
		return
	}
	// After the testers' reset (sims.ResetTesters) the code a browser kept no
	// longer works for the account: typing it again (or /admin) does.
	var off bool
	if err := h.DB.QueryRow(r.Context(), `SELECT tester_off OR tester_revoked FROM users WHERE id = $1`, UserID(r.Context())).Scan(&off); err == nil && off && !body.Typed {
		httpx.Error(w, http.StatusForbidden, "les tests sont finis : ton compte est un compte joueur")
		return
	}
	var u User
	if err := scanUser(h.DB.QueryRow(r.Context(), `UPDATE users SET tester = true, tester_off = false, tester_revoked = false WHERE id = $1 RETURNING `+userColumns, UserID(r.Context())), &u); err != nil {
		httpx.Error(w, http.StatusUnauthorized, "user not found")
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}
