package shop

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Stripe: paying by card (Visa, Mastercard…) on Stripe Checkout's page, beside GeniusPay's Mobile Money.
// A Checkout Session is opened for the purchase (or a donation, dons.go) in francs CFA (XOF, a currency
// without cents for Stripe), the player pays on Stripe's page and comes back to the game. As with
// GeniusPay, a session is only believed paid when asked of Stripe with the secret key; its webhook
// (signed with STRIPE_WEBHOOK_SECRET) only says « go and look ». The keys live in the environment, never
// in the code.
type Stripe struct {
	Secret string
	// WebhookSecret (whsec_…): the webhooks' signature checked with it.
	WebhookSecret string
	Base          string
	Client        *http.Client
}

const stripeBase = "https://api.stripe.com/v1"

// StripeFromEnv: Stripe with STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET), or nil: no card payment.
func StripeFromEnv() *Stripe {
	key := os.Getenv("STRIPE_SECRET_KEY")
	if key == "" {
		return nil
	}
	base := stripeBase
	// (Another address: a local stand-in, to try the site without Stripe.)
	if b := strings.TrimRight(os.Getenv("STRIPE_API_BASE"), "/"); b != "" {
		base = b
	}
	return &Stripe{Secret: key, WebhookSecret: os.Getenv("STRIPE_WEBHOOK_SECRET"), Base: base, Client: &http.Client{Timeout: 20 * time.Second}}
}

// Test: test keys (sk_test_…, rk_test_…): nothing is really paid.
func (s *Stripe) Test() bool { return strings.Contains(s.Secret, "_test_") }

// Session is a Checkout Session as Stripe says it.
type Session struct {
	ID string `json:"id"`
	// URL: the page to pay on (while it's open).
	URL string `json:"url"`
	// Status: open, complete, expired; PaymentStatus: paid, unpaid, no_payment_required.
	Status        string            `json:"status"`
	PaymentStatus string            `json:"payment_status"`
	AmountTotal   int               `json:"amount_total"`
	Currency      string            `json:"currency"`
	Livemode      bool              `json:"livemode"`
	Metadata      map[string]string `json:"metadata"`
}

// Paid: the session's money received.
func (s Session) Paid() bool { return s.Status == "complete" && s.PaymentStatus == "paid" }

// NewSession: what's paid (francs CFA), what it's for, where Stripe sends the payer back, and our own marks.
type NewSession struct {
	Amount              int
	Name                string
	Email               string
	SuccessURL, BackURL string
	Metadata            map[string]string
}

// Create opens a Checkout Session for one payment by card.
func (s *Stripe) Create(ctx context.Context, n NewSession) (Session, error) {
	f := url.Values{}
	f.Set("mode", "payment")
	f.Set("payment_method_types[0]", "card")
	f.Set("line_items[0][quantity]", "1")
	f.Set("line_items[0][price_data][currency]", "xof")
	f.Set("line_items[0][price_data][unit_amount]", strconv.Itoa(n.Amount))
	f.Set("line_items[0][price_data][product_data][name]", n.Name)
	f.Set("success_url", n.SuccessURL)
	f.Set("cancel_url", n.BackURL)
	f.Set("locale", "fr")
	if n.Email != "" {
		f.Set("customer_email", n.Email)
	}
	for k, v := range n.Metadata {
		f.Set("metadata["+k+"]", v)
		f.Set("payment_intent_data[metadata]["+k+"]", v)
	}
	return s.call(ctx, http.MethodPost, "/checkout/sessions", f)
}

// Get asks Stripe how a session stands.
func (s *Stripe) Get(ctx context.Context, id string) (Session, error) {
	return s.call(ctx, http.MethodGet, "/checkout/sessions/"+url.PathEscape(id), nil)
}

func (s *Stripe) call(ctx context.Context, method, path string, form url.Values) (Session, error) {
	var body io.Reader
	if form != nil {
		body = strings.NewReader(form.Encode())
	}
	req, err := http.NewRequestWithContext(ctx, method, s.Base+path, body)
	if err != nil {
		return Session{}, err
	}
	req.SetBasicAuth(s.Secret, "")
	if form != nil {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	res, err := s.Client.Do(req)
	if err != nil {
		return Session{}, err
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode >= 300 {
		var e struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = json.Unmarshal(data, &e)
		return Session{}, fmt.Errorf("stripe %s %s: %d %s", method, path, res.StatusCode, e.Error.Message)
	}
	var out Session
	if err := json.Unmarshal(data, &out); err != nil {
		return Session{}, err
	}
	if out.ID == "" {
		return Session{}, errors.New("stripe: no session in the answer")
	}
	return out, nil
}

// Signed: a webhook's body signed by Stripe (header Stripe-Signature: t=…,v1=…), at most 5 minutes old.
func (s *Stripe) Signed(body []byte, header string, now time.Time) bool {
	if s.WebhookSecret == "" {
		return false
	}
	var t int64
	var sigs []string
	for _, part := range strings.Split(header, ",") {
		k, v, ok := strings.Cut(strings.TrimSpace(part), "=")
		if !ok {
			continue
		}
		switch k {
		case "t":
			t, _ = strconv.ParseInt(v, 10, 64)
		case "v1":
			sigs = append(sigs, v)
		}
	}
	if t == 0 || len(sigs) == 0 || now.Sub(time.Unix(t, 0)).Abs() > 5*time.Minute {
		return false
	}
	mac := hmac.New(sha256.New, []byte(s.WebhookSecret))
	fmt.Fprintf(mac, "%d.", t)
	mac.Write(body)
	want := mac.Sum(nil)
	for _, sig := range sigs {
		if got, err := hex.DecodeString(sig); err == nil && hmac.Equal(got, want) {
			return true
		}
	}
	return false
}
