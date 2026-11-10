package shop

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Paying by card (stripe.go) in the shop: the purchase's Checkout Session opened, asked again, and Stripe's
// webhook. What's bought is given once Stripe says the session is paid, the sum sold, in francs CFA.

// isCardRef: a purchase's reference that is a Stripe Checkout Session.
func isCardRef(ref string) bool { return strings.HasPrefix(ref, "cs_") }

// openCard opens the Checkout Session for a purchase and records it; the page to pay on.
func (h *Handler) openCard(ctx context.Context, id string, n NewSession) (string, error) {
	sess, err := h.Card.Create(ctx, n)
	if err != nil || sess.URL == "" {
		_, _ = h.DB.Exec(ctx, `UPDATE purchases SET status = 'error', updated_at = now() WHERE id = $1`, id)
		if err == nil {
			err = errNoPage
		}
		return "", err
	}
	if _, err := h.DB.Exec(ctx, `UPDATE purchases SET reference = $2, status = 'pending', updated_at = now() WHERE id = $1`, id, sess.ID); err != nil {
		return "", err
	}
	return sess.URL, nil
}

// settleCard asks Stripe how a purchase's session stands and, paid the sum sold, gives what was bought (once).
func (h *Handler) settleCard(ctx context.Context, id, ref string) (string, bool, error) {
	if h.Card == nil {
		return "pending", false, errShut
	}
	sess, err := h.Card.Get(ctx, ref)
	if err != nil {
		return "pending", false, err
	}
	return h.settleSession(ctx, id, sess)
}

// settleSession: the purchase as this session says.
func (h *Handler) settleSession(ctx context.Context, id string, sess Session) (string, bool, error) {
	log.Printf("shop: purchase %s: Stripe says %q/%q (%d %s, live %v)", id, sess.Status, sess.PaymentStatus, sess.AmountTotal, sess.Currency, sess.Livemode)
	if sess.Paid() {
		return h.creditIf(ctx, id, func(price int) bool {
			// Less than sold, another currency, or a test payment while the shop sells for real: held, looked at by hand.
			if sess.AmountTotal < price || !strings.EqualFold(sess.Currency, "xof") || (!sess.Livemode && !h.Card.Test()) {
				log.Printf("shop: purchase %s paid %d %s by card (live %v), sold %d XOF: not credited", id, sess.AmountTotal, sess.Currency, sess.Livemode, price)
				return false
			}
			return true
		})
	}
	status := "pending"
	if sess.Status == "expired" {
		status = "expired"
	}
	_, err := h.DB.Exec(ctx, `UPDATE purchases SET status = $2, updated_at = now() WHERE id = $1 AND credited_at IS NULL`, id, status)
	return status, false, err
}

// StripeWebhook: Stripe telling a Checkout Session changed (POST /shop/stripe, not signed in). Its signature
// checked, the session is asked of Stripe itself before anything is done: a purchase, or a donation (dons.go).
func (h *Handler) StripeWebhook(w http.ResponseWriter, r *http.Request) {
	if h.Card == nil {
		httpx.Error(w, http.StatusServiceUnavailable, errShut.Error())
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 256<<10))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if !h.Card.Signed(body, r.Header.Get("Stripe-Signature"), time.Now()) {
		httpx.Error(w, http.StatusUnauthorized, "invalid signature")
		return
	}
	var ev struct {
		Type string `json:"type"`
		Data struct {
			Object Session `json:"object"`
		} `json:"data"`
	}
	_ = json.Unmarshal(body, &ev)
	if !strings.HasPrefix(ev.Type, "checkout.session.") || ev.Data.Object.ID == "" {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ignored"})
		return
	}
	ctx := r.Context()
	sess, err := h.Card.Get(ctx, ev.Data.Object.ID)
	if err != nil {
		// Stripe sends it again later.
		log.Printf("shop: stripe webhook %s: %v", ev.Data.Object.ID, err)
		httpx.Error(w, http.StatusBadGateway, "try again")
		return
	}
	var status string
	switch {
	case sess.Metadata["purchase"] != "":
		status, _, err = h.settleSession(ctx, sess.Metadata["purchase"], sess)
	case sess.Metadata["don"] != "":
		amount := sess.AmountTotal
		if !strings.EqualFold(sess.Currency, "xof") {
			amount = -1
		}
		status, err = h.settleDonation(ctx, sess.Metadata["don"], sess.Paid(), sess.Status == "expired", amount)
	default:
		status = "unknown"
	}
	if err != nil {
		log.Printf("shop: stripe webhook %s: %v", sess.ID, err)
		httpx.Error(w, http.StatusBadGateway, "try again")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": status})
}
