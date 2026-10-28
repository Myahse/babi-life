package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/mail"
)

// « Mot de passe oublié »: the player gives their e-mail; if an account with
// a password has it, a link goes out (good for ResetFor, once). The answer is
// the same either way, so nobody learns who plays. Following the link, they
// choose a new password; every device signed in is signed out.

const (
	ResetFor = 30 * time.Minute
	// resetsPerHour: links an account can be sent in an hour.
	resetsPerHour = 3
)

// Mailer sends an e-mail (package mail); nil: resets can't be sent.
type Mailer = mail.Sender

var errResetsOff = errors.New("la récupération du mot de passe par e-mail n'est pas encore en place. Réessaie bientôt")

func hashToken(t string) string {
	h := sha256.Sum256([]byte(t))
	return hex.EncodeToString(h[:])
}

// Forgot answers POST /auth/forgot {email}: « identifiants oubliés ». For any
// account of that address or pseudo (Google or password), an e-mail saying how
// it signs in and a link to choose a (new) password; the answer is the same
// whether the account exists or not.
func (h *Handler) Forgot(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if err := httpx.Decode(r, &c); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	c.clean()
	if h.Mail == nil {
		httpx.Error(w, http.StatusServiceUnavailable, errResetsOff.Error())
		return
	}
	sent := map[string]string{"text": "Si un compte existe pour cette adresse ou ce pseudo, un e-mail vient de partir : il dit comment tu te connectes (Google ou mot de passe) et donne un lien pour choisir un mot de passe (valable 30 minutes). Regarde aussi dans les spams."}
	ctx := r.Context()
	var id string
	err := h.DB.QueryRow(ctx, `SELECT id FROM users WHERE email = $1 OR lower(username) = $1`, c.Email).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.JSON(w, http.StatusOK, sent)
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "réessaie dans un instant")
		return
	}
	if err := h.SendAccount(ctx, id); err != nil && !errors.Is(err, errTooManyResets) {
		log.Printf("auth: account mail: %v", err)
		httpx.Error(w, http.StatusBadGateway, "l'e-mail n'est pas parti, réessaie dans un instant")
		return
	}
	httpx.JSON(w, http.StatusOK, sent)
}

var errTooManyResets = errors.New("too many account e-mails this hour")

// SendAccount e-mails an account how it signs in (its address, its pseudo,
// Google and/or a password) with a link to choose a password (/admin's « Envoyer
// ses identifiants » too); a few an hour at most.
func (h *Handler) SendAccount(ctx context.Context, id string) error {
	if h.Mail == nil {
		return errResetsOff
	}
	var email, first, username string
	var google, password bool
	var recent int
	if err := h.DB.QueryRow(ctx, `SELECT u.email, u.first_name, coalesce(u.username, ''), u.google_sub IS NOT NULL, u.password_hash IS NOT NULL,
		(SELECT count(*) FROM password_resets p WHERE p.user_id = u.id AND p.created_at > now() - interval '1 hour')
		FROM users u WHERE u.id = $1`, id).Scan(&email, &first, &username, &google, &password, &recent); err != nil {
		return err
	}
	if recent >= resetsPerHour {
		return errTooManyResets
	}
	if !strings.Contains(email, "@") {
		return fmt.Errorf("pas d'adresse e-mail sur ce compte")
	}
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	token := hex.EncodeToString(b)
	if _, err := h.DB.Exec(ctx, `INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`, hashToken(token), id, time.Now().Add(ResetFor)); err != nil {
		return err
	}
	msg, err := mail.Account(h.SiteURL, email, first, username, google, password, h.SiteURL+"/mot-de-passe?token="+token, int(ResetFor/time.Minute))
	if err != nil {
		return err
	}
	return h.Mail.Send(ctx, msg)
}

// Reset answers POST /auth/reset {token, password}.
func (h *Handler) Reset(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if len(body.Password) < minPassword {
		httpx.Error(w, http.StatusUnprocessableEntity, fmt.Sprintf("le mot de passe doit faire au moins %d caractères", minPassword))
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "réessaie dans un instant")
		return
	}
	ctx := r.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "réessaie dans un instant")
		return
	}
	defer tx.Rollback(ctx)
	var user string
	err = tx.QueryRow(ctx, `UPDATE password_resets SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id`, hashToken(body.Token)).Scan(&user)
	if err != nil {
		httpx.Error(w, http.StatusGone, "ce lien n'est plus valable : redemande un e-mail")
		return
	}
	if _, err := tx.Exec(ctx, `UPDATE users SET password_hash = $2 WHERE id = $1`, user, string(hash)); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "réessaie dans un instant")
		return
	}
	// Every device signed in with the old password is signed out.
	var sids []string
	rows, err := tx.Query(ctx, `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`, user)
	if err == nil {
		for rows.Next() {
			var sid string
			if rows.Scan(&sid) == nil {
				sids = append(sids, sid)
			}
		}
		rows.Close()
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "réessaie dans un instant")
		return
	}
	if h.Sessions != nil {
		h.Sessions.forget(sids...)
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"text": "C'est fait : ton nouveau mot de passe est enregistré. Connecte-toi avec."})
}
