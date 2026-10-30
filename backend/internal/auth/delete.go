package auth

import (
	"cmp"
	"context"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/myahse/babi-life/backend/internal/account"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Deleting one's account from the game (« Réglages » › « Supprimer mon
// compte », web components/DeleteAccount.tsx), always open (Google Play asks
// for it, and the law): the player says it again first, with their password
// for an account with one, else (a Google account) by typing their username
// (or their e-mail, before they chose one). What goes and what stays: package account.

type deleteCheck struct {
	// Password: the account has one, it's asked; else Word is to be typed.
	Password bool   `json:"password"`
	Word     string `json:"word,omitempty"`
}

func (h *Handler) deleteCheck(ctx context.Context, user string) (deleteCheck, *string, string, error) {
	var hash *string
	var email, username string
	err := h.DB.QueryRow(ctx, `SELECT password_hash, email, COALESCE(username, '') FROM users WHERE id = $1`, user).Scan(&hash, &email, &username)
	if err != nil {
		return deleteCheck{}, nil, "", err
	}
	if hash != nil {
		return deleteCheck{Password: true}, hash, email, nil
	}
	return deleteCheck{Word: cmp.Or(username, email)}, nil, email, nil
}

// DeleteInfo: GET /me/delete, how this account confirms its deletion.
func (h *Handler) DeleteInfo(w http.ResponseWriter, r *http.Request) {
	c, _, _, err := h.deleteCheck(r.Context(), UserID(r.Context()))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "user not found")
		return
	}
	httpx.JSON(w, http.StatusOK, c)
}

// DeleteMe: DELETE /me {password} or {confirm}, the account and everything tied to it, for good.
func (h *Handler) DeleteMe(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
		Confirm  string `json:"confirm"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	user := UserID(ctx)
	c, hash, email, err := h.deleteCheck(ctx, user)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusUnauthorized, "user not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	// Wrong too often: the same pause as signing in (guessing a password through here takes as long).
	key := "acct|" + strings.ToLower(email)
	if failedLogins.Full(key) {
		httpx.Error(w, http.StatusTooManyRequests, errTooManyTries.Error())
		return
	}
	if c.Password {
		if bcrypt.CompareHashAndPassword([]byte(*hash), []byte(body.Password)) != nil {
			failedLogins.Hit(key)
			httpx.Error(w, http.StatusForbidden, "mot de passe incorrect")
			return
		}
	} else if !strings.EqualFold(strings.TrimSpace(body.Confirm), c.Word) {
		failedLogins.Hit(key)
		httpx.Error(w, http.StatusForbidden, "ce n'est pas ça : tape exactement ce qui est demandé")
		return
	}
	if err := h.Erase(ctx, user, "par le joueur, depuis le jeu"); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "la suppression n'a pas pu se faire : réessaie")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// Erase deletes the account (account.Delete), signs its devices out at once and
// removes its files; by is for the team's log. Used by /admin too.
func (h *Handler) Erase(ctx context.Context, user, by string) error {
	res, err := account.Delete(ctx, h.DB, user, by)
	if err != nil {
		return err
	}
	if h.Sessions != nil {
		s := h.Sessions
		s.mu.Lock()
		for k := range s.known {
			if strings.HasPrefix(k, "u:"+user+":") {
				delete(s.known, k)
			}
		}
		s.mu.Unlock()
		s.forget(res.Sessions...)
	}
	if h.Changed != nil {
		h.Changed(res.Changed...)
	}
	if h.RemoveFiles != nil && len(res.Files) > 0 {
		files := res.Files
		go func() {
			bg, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			defer cancel()
			h.RemoveFiles(bg, files)
		}()
	}
	log.Printf("auth: an account was deleted (%s)", by)
	return nil
}
