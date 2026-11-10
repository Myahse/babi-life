package shop

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Donations (the site's page /don, web screens/Don.tsx): anyone, signed in or not, gives Babi Life the sum
// they like, by card (Stripe, stripe.go) or Mobile Money (GeniusPay). Nothing is bought: no Djai, nothing in
// the game, only thanks; the donors who agree are listed on the page with their message. A donation is only
// believed paid when the payment service says so, asked with the secret key (its webhook, or the page
// asking on the way back, or Watch).

const (
	// DonMin, DonMax: the smallest and the largest donation, in F CFA.
	DonMin = 500
	DonMax = 1_000_000
)

var (
	errDonAmount = fmt.Errorf("un don va de %s à %s F", thousands(DonMin), thousands(DonMax))
	errDonBusy   = errors.New("beaucoup de dons en cours : réessaie dans une minute")
)

// Donor: a donation as the page lists it (the public ones, paid).
type Donor struct {
	Name    string    `json:"name"`
	Amount  int       `json:"amount"`
	Message string    `json:"message,omitempty"`
	At      time.Time `json:"at"`
}

// DonRoutes: the page's (not signed in).
func (h *Handler) DonRoutes(r chi.Router) {
	r.Get("/dons", h.donors)
	r.Post("/dons", h.donate)
	r.Get("/dons/{don}", h.donation)
}

// donors: GET /dons — how one can give (card, Mobile Money), the latest donors who agreed to be shown, and the total given.
func (h *Handler) donors(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := h.DB.Query(ctx, `SELECT name, amount, message, paid_at FROM donations WHERE paid_at IS NOT NULL AND public AND NOT test ORDER BY paid_at DESC LIMIT 20`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	list, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (Donor, error) {
		var d Donor
		return d, row.Scan(&d.Name, &d.Amount, &d.Message, &d.At)
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	var total, count int
	_ = h.DB.QueryRow(ctx, `SELECT COALESCE(sum(amount), 0), count(*) FROM donations WHERE paid_at IS NOT NULL AND NOT test`).Scan(&total, &count)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"card": h.Card != nil && !h.Card.Test(), "mobile": h.Pay != nil && !h.Pay.Sandbox(),
		// (Test keys: the page says so, and nothing is really paid.)
		"test":   (h.Card != nil && h.Card.Test()) || (h.Pay != nil && h.Pay.Sandbox()),
		"donors": list, "total": total, "count": count, "min": DonMin, "max": DonMax,
	})
}

// clip: a field typed by the donor, trimmed to n characters.
func clip(s string, n int) string {
	s = strings.TrimSpace(s)
	for utf8.RuneCountInString(s) > n {
		r := []rune(s)
		s = string(r[:n])
	}
	return s
}

// donate: POST /dons {amount, method: carte|mobile, name, email, message, public} — the donation recorded and
// its payment opened; the page to pay on.
func (h *Handler) donate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Amount  int    `json:"amount"`
		Method  string `json:"method"`
		Name    string `json:"name"`
		Email   string `json:"email"`
		Message string `json:"message"`
		Public  bool   `json:"public"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if req.Amount < DonMin || req.Amount > DonMax {
		httpx.Error(w, http.StatusUnprocessableEntity, errDonAmount.Error())
		return
	}
	card := req.Method == "carte"
	if (card && h.Card == nil) || (!card && h.Pay == nil) {
		httpx.Error(w, http.StatusServiceUnavailable, "les dons ouvrent bientôt")
		return
	}
	ctx := r.Context()
	// A page that's asked too often (a script): wait.
	var recent int
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM donations WHERE created_at > now() - interval '1 minute'`).Scan(&recent)
	if recent >= 30 {
		httpx.Error(w, http.StatusTooManyRequests, errDonBusy.Error())
		return
	}
	name, email, msg := clip(req.Name, 40), clip(req.Email, 120), clip(req.Message, 280)
	if !strings.Contains(email, "@") {
		email = ""
	}
	method := "mobile"
	test := h.Pay != nil && h.Pay.Sandbox()
	if card {
		method, test = "carte", h.Card.Test()
	}
	var id string
	if err := h.DB.QueryRow(ctx, `INSERT INTO donations (amount, name, email, message, public, method, test) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		req.Amount, name, email, msg, req.Public && name != "", method, test).Scan(&id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	back := h.Site + "/don?merci=" + id
	what := "Don à Babi Life"
	var ref, url string
	var err error
	if card {
		var sess Session
		sess, err = h.Card.Create(ctx, NewSession{Amount: req.Amount, Name: what, Email: email, SuccessURL: back, BackURL: h.Site + "/don?annule=1", Metadata: map[string]string{"don": id}})
		ref, url = sess.ID, sess.URL
	} else {
		np := NewPayment{Amount: req.Amount, Currency: "XOF", Description: what, SuccessURL: back, ErrorURL: h.Site + "/don?annule=1", Metadata: map[string]string{"don": id}}
		if name != "" || email != "" {
			np.Customer = &Customer{Name: name, Email: email}
		}
		if h.API != "" {
			np.WebhookURL = h.API + "/api/v1/shop/geniuspay"
		}
		var pay Payment
		pay, err = h.Pay.Create(ctx, np)
		ref, url = pay.Reference, pay.URL()
	}
	if err != nil || url == "" {
		log.Printf("dons: payment not created for %s (%d F, %s): %v", id, req.Amount, method, err)
		_, _ = h.DB.Exec(ctx, `UPDATE donations SET status = 'error', updated_at = now() WHERE id = $1`, id)
		httpx.Error(w, http.StatusBadGateway, "le paiement ne répond pas : réessaie dans un instant")
		return
	}
	if _, err := h.DB.Exec(ctx, `UPDATE donations SET reference = $2, status = 'pending', updated_at = now() WHERE id = $1`, id, ref); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"id": id, "url": url})
}

// donation: GET /dons/{don} — back from the payment's page: the donation as the payment service says it now.
func (h *Handler) donation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "don")
	var status, name string
	var ref *string
	var amount int
	if err := h.DB.QueryRow(ctx, `SELECT status, reference, amount, name FROM donations WHERE id::text = $1`, id).Scan(&status, &ref, &amount, &name); err != nil {
		httpx.Error(w, http.StatusNotFound, "don introuvable")
		return
	}
	if status == "pending" && ref != nil {
		if s, err := h.askDonation(ctx, id, *ref); err == nil {
			status = s
		} else {
			log.Printf("dons: check %s: %v", id, err)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"status": status, "amount": amount, "name": name})
}

// askDonation: the payment service asked how a donation's payment stands, the donation settled so.
func (h *Handler) askDonation(ctx context.Context, id, ref string) (string, error) {
	if isCardRef(ref) {
		if h.Card == nil {
			return "pending", errShut
		}
		sess, err := h.Card.Get(ctx, ref)
		if err != nil {
			return "pending", err
		}
		amount := sess.AmountTotal
		if !strings.EqualFold(sess.Currency, "xof") {
			amount = -1
		}
		return h.settleDonation(ctx, id, sess.Paid(), sess.Status == "expired", amount)
	}
	if h.Pay == nil {
		return "pending", errShut
	}
	pay, err := h.Pay.Get(ctx, ref)
	if err != nil {
		return "pending", err
	}
	st := strings.ToLower(pay.Status)
	amount := int(math.Round(float64(pay.Amount)))
	if pay.Currency != "" && !strings.EqualFold(pay.Currency, "XOF") {
		amount = -1
	}
	return h.settleDonation(ctx, id, paid(st), st == "expired" || st == "failed" || st == "cancelled", amount)
}

// settleDonation: a donation paid (the sum given at least, when said: 0, not said), or given up; once. Paid
// less than given, or in another currency (amount < 0): held « mismatch », looked at by hand.
func (h *Handler) settleDonation(ctx context.Context, id string, isPaid, gone bool, amount int) (string, error) {
	switch {
	case isPaid && amount < 0:
		_, err := h.DB.Exec(ctx, `UPDATE donations SET status = 'mismatch', updated_at = now() WHERE id::text = $1 AND paid_at IS NULL`, id)
		return "mismatch", err
	case isPaid:
		var paidAt *time.Time
		var given int
		if err := h.DB.QueryRow(ctx, `SELECT paid_at, amount FROM donations WHERE id::text = $1`, id).Scan(&paidAt, &given); err != nil {
			return "pending", err
		}
		if paidAt != nil {
			return "paid", nil
		}
		if amount > 0 && amount < given {
			_, err := h.DB.Exec(ctx, `UPDATE donations SET status = 'mismatch', updated_at = now() WHERE id::text = $1`, id)
			return "mismatch", err
		}
		if _, err := h.DB.Exec(ctx, `UPDATE donations SET status = 'paid', paid_at = now(), updated_at = now() WHERE id::text = $1 AND paid_at IS NULL`, id); err != nil {
			return "pending", err
		}
		log.Printf("dons: %s paid (%d F)", id, given)
		return "paid", nil
	case gone:
		_, err := h.DB.Exec(ctx, `UPDATE donations SET status = 'expired', updated_at = now() WHERE id::text = $1 AND paid_at IS NULL`, id)
		return "expired", err
	}
	return "pending", nil
}

// watchDonations: the donations still waiting asked again (a webhook lost); past a day, expired.
func (h *Handler) watchDonations(ctx context.Context) {
	rows, err := h.DB.Query(ctx, `SELECT id::text, reference FROM donations WHERE status = 'pending' AND reference IS NOT NULL
		AND created_at > now() - interval '25 hours' AND updated_at < now() - interval '2 minutes' ORDER BY created_at LIMIT 50`)
	if err != nil {
		return
	}
	type open struct{ id, ref string }
	list, _ := pgx.CollectRows(rows, func(row pgx.CollectableRow) (open, error) {
		var o open
		return o, row.Scan(&o.id, &o.ref)
	})
	for _, o := range list {
		if _, err := h.askDonation(ctx, o.id, o.ref); err != nil {
			log.Printf("dons: watch %s: %v", o.id, err)
		}
	}
	_, _ = h.DB.Exec(ctx, `UPDATE donations SET status = 'expired', updated_at = now() WHERE paid_at IS NULL AND status IN ('created', 'pending') AND created_at < now() - interval '25 hours'`)
}
