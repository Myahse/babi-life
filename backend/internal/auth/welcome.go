package auth

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/myahse/babi-life/backend/internal/i18n"
	"github.com/myahse/babi-life/backend/internal/mail"
)

// Community: the players' WhatsApp group, named in the welcome e-mail (web/src/lib/contact.ts WHATSAPP_COMMUNITY).
const Community = "https://chat.whatsapp.com/Lg3fgekmf6z6fS3J5jPZPi"

// welcome: a new account's welcome e-mail, sent once (users.welcomed_at), in the background so the
// sign-up isn't kept waiting. Test accounts (dev logins) get none.
func (h *Handler) welcome(u User, lang string) {
	if h.Mail == nil || u.Email == "" || strings.HasSuffix(u.Email, ".local") {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		// Taken once: two sign-ups racing (or a retry) send a single e-mail.
		tag, err := h.DB.Exec(ctx, `UPDATE users SET welcomed_at = now() WHERE id = $1 AND welcomed_at IS NULL`, u.ID)
		if err != nil || tag.RowsAffected() == 0 {
			return
		}
		if lang == "" {
			lang = u.Lang
		}
		msg, err := mail.Welcome(h.SiteURL, i18n.For(ctx, lang), u.Email, u.FirstName, Community)
		if err == nil {
			err = h.Mail.Send(ctx, msg)
		}
		if err != nil {
			// Not tried again: a welcome is only worth it at the start.
			log.Printf("welcome e-mail: %v", err)
		}
	}()
}
