package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/myahse/babi-life/backend/internal/httpx"
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
type Mailer interface {
	Send(to, subject, body string) error
}

var errResetsOff = errors.New("la récupération du mot de passe par e-mail n'est pas encore en place. Réessaie bientôt")

func hashToken(t string) string {
	h := sha256.Sum256([]byte(t))
	return hex.EncodeToString(h[:])
}

// Forgot answers POST /auth/forgot {email}.
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
	sent := map[string]string{"text": "Si un compte existe pour cette adresse, un e-mail vient de partir avec un lien pour choisir un nouveau mot de passe (valable 30 minutes). Regarde aussi dans les spams."}
	ctx := r.Context()
	var id, email, first string
	var recent int
	err := h.DB.QueryRow(ctx, `SELECT u.id, u.email, u.first_name, (SELECT count(*) FROM password_resets p WHERE p.user_id = u.id AND p.created_at > now() - interval '1 hour')
		FROM users u WHERE (u.email = $1 OR lower(u.username) = $1) AND u.password_hash IS NOT NULL`, c.Email).Scan(&id, &email, &first, &recent)
	if errors.Is(err, pgx.ErrNoRows) || recent >= resetsPerHour {
		httpx.JSON(w, http.StatusOK, sent)
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "réessaie dans un instant")
		return
	}
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	token := hex.EncodeToString(b)
	if _, err := h.DB.Exec(ctx, `INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`, hashToken(token), id, time.Now().Add(ResetFor)); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "réessaie dans un instant")
		return
	}
	link := h.SiteURL + "/mot-de-passe?token=" + token
	body := fmt.Sprintf("Bonjour %s,\n\nQuelqu'un (toi, on espère) a demandé un nouveau mot de passe pour ton compte Babi Life.\n\nPour en choisir un, ouvre ce lien dans les 30 minutes :\n%s\n\nSi ce n'était pas toi, ignore cet e-mail : ton mot de passe ne change pas.\n\nÀ tout de suite dans Babi !\n", first, link)
	if err := h.Mail.Send(email, "Babi Life : ton nouveau mot de passe", body); err != nil {
		log.Printf("auth: reset mail: %v", err)
		httpx.Error(w, http.StatusBadGateway, "l'e-mail n'est pas parti, réessaie dans un instant")
		return
	}
	httpx.JSON(w, http.StatusOK, sent)
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
