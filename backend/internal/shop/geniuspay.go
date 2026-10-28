package shop

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// GeniusPay: the payment service (pay.genius.ci), Mobile Money and cards in
// Côte d'Ivoire. A payment is created without a method: GeniusPay's own page
// (checkout_url) lets the player choose Wave, Orange Money, MTN, Moov or a
// card, then sends them back to the game. Its word on a payment is only
// believed when asked directly (Get, with the secret key): a webhook only
// says « go and look ».
type GeniusPay struct {
	Key, Secret string
	// WebhookSecret (whsec_…): the webhooks' signature checked with it, when set.
	WebhookSecret string
	Base          string
	Client        *http.Client
	// Test: told so in the environment (GENIUSPAY_SANDBOX), whatever the keys look like.
	Test bool
}

const defaultBase = "https://pay.genius.ci/api/v1/merchant"

// FromEnv: GeniusPay with the keys in the environment (never in the code), or nil: the shop shut.
func FromEnv() *GeniusPay {
	key, secret := os.Getenv("GENIUSPAY_API_KEY"), os.Getenv("GENIUSPAY_API_SECRET")
	if key == "" || secret == "" {
		return nil
	}
	base := strings.TrimRight(os.Getenv("GENIUSPAY_BASE_URL"), "/")
	if base == "" {
		base = defaultBase
	}
	test, _ := strconv.ParseBool(os.Getenv("GENIUSPAY_SANDBOX"))
	return &GeniusPay{Key: key, Secret: secret, WebhookSecret: os.Getenv("GENIUSPAY_WEBHOOK_SECRET"), Base: base, Client: &http.Client{Timeout: 20 * time.Second}, Test: test}
}

// Sandbox: test keys (pk_sandbox_…, pk_test_…, or GENIUSPAY_SANDBOX=true): nothing is really paid.
func (g *GeniusPay) Sandbox() bool {
	k := strings.ToLower(g.Key)
	return g.Test || strings.HasPrefix(k, "pk_sandbox") || strings.HasPrefix(k, "pk_test") || strings.Contains(k, "_sandbox_") || strings.Contains(k, "_test_")
}

// Customer: who pays, as GeniusPay's page shows it.
type Customer struct {
	Name  string `json:"name,omitempty"`
	Email string `json:"email,omitempty"`
}

// NewPayment: what's asked of GeniusPay (amount in F CFA, XOF, 200 at least).
type NewPayment struct {
	Amount      int       `json:"amount"`
	Currency    string    `json:"currency"`
	Description string    `json:"description"`
	Customer    *Customer `json:"customer,omitempty"`
	// PaymentMethod: the operator the player chose (wave, orange_money…), GeniusPay's page opened on it.
	PaymentMethod string            `json:"payment_method,omitempty"`
	SuccessURL    string            `json:"success_url"`
	ErrorURL      string            `json:"error_url"`
	WebhookURL    string            `json:"webhook_url,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

// Payment: a payment as GeniusPay has it.
type Payment struct {
	Reference string `json:"reference"`
	Amount    Amount `json:"amount"`
	Currency  string `json:"currency"`
	Status    string `json:"status"`
	// Fees: GeniusPay's share, when it says so (the sum paid can include them).
	Fees        Amount `json:"fees"`
	CheckoutURL string `json:"checkout_url"`
	PaymentURL  string `json:"payment_url"`
	Environment string `json:"environment"`
}

// URL: the page the player pays on.
func (p Payment) URL() string {
	if p.CheckoutURL != "" {
		return p.CheckoutURL
	}
	return p.PaymentURL
}

// Amount: a sum as GeniusPay writes it, a number or a string ("500.00").
type Amount float64

func (a *Amount) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		*a = 0
		return nil
	}
	f, err := strconv.ParseFloat(s, 64)
	*a = Amount(f)
	return err
}

// Create a payment: its reference and the page to pay on.
func (g *GeniusPay) Create(ctx context.Context, p NewPayment) (Payment, error) {
	return g.call(ctx, http.MethodPost, "/payments", p)
}

// Get a payment, as it is now.
func (g *GeniusPay) Get(ctx context.Context, reference string) (Payment, error) {
	return g.call(ctx, http.MethodGet, "/payments/"+reference, nil)
}

func (g *GeniusPay) call(ctx context.Context, method, path string, body any) (Payment, error) {
	var buf *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return Payment{}, err
		}
		buf = bytes.NewReader(b)
	} else {
		buf = bytes.NewReader(nil)
	}
	req, err := http.NewRequestWithContext(ctx, method, g.Base+path, buf)
	if err != nil {
		return Payment{}, err
	}
	req.Header.Set("X-API-Key", g.Key)
	req.Header.Set("X-API-Secret", g.Secret)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	res, err := g.Client.Do(req)
	if err != nil {
		return Payment{}, err
	}
	defer res.Body.Close()
	var out struct {
		Message string          `json:"message"`
		Data    json.RawMessage `json:"data"`
		// Its errors: {"success": false, "error": {"code", "message"}}, the fields refused under « errors ».
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
		Errors json.RawMessage `json:"errors"`
	}
	raw := new(bytes.Buffer)
	if _, err := raw.ReadFrom(http.MaxBytesReader(nil, res.Body, 1<<20)); err != nil {
		return Payment{}, err
	}
	_ = json.Unmarshal(raw.Bytes(), &out)
	if res.StatusCode >= 300 {
		if out.Message == "" && out.Error.Message != "" {
			out.Message = out.Error.Code + " " + out.Error.Message
		}
		if out.Message == "" {
			out.Message = res.Status
		}
		if len(out.Errors) > 0 && string(out.Errors) != "null" {
			out.Message += " " + string(out.Errors)
		}
		// The whole answer in the server's log: GeniusPay says there which field it refused.
		log.Printf("geniuspay %s %s: %d %.400s", method, path, res.StatusCode, raw.String())
		return Payment{}, fmt.Errorf("geniuspay %s %s: %s", method, path, out.Message)
	}
	// The payment under « data », or the answer itself.
	data := out.Data
	if len(data) == 0 || data[0] != '{' {
		data = raw.Bytes()
	}
	p, err := paymentIn(data)
	if err != nil {
		log.Printf("geniuspay %s %s: an answer without a payment: %.300s", method, path, raw.String())
	}
	return p, err
}

// paymentIn: the payment in an answer or a webhook's data, where it is, or one level down
// (« payment », « transaction »).
func paymentIn(data []byte) (Payment, error) {
	var p Payment
	if err := json.Unmarshal(data, &p); err != nil {
		return Payment{}, err
	}
	if p.Reference == "" {
		var in struct {
			Payment     *Payment `json:"payment"`
			Transaction *Payment `json:"transaction"`
		}
		if json.Unmarshal(data, &in) == nil {
			if in.Payment != nil && in.Payment.Reference != "" {
				return *in.Payment, nil
			}
			if in.Transaction != nil && in.Transaction.Reference != "" {
				return *in.Transaction, nil
			}
		}
		return Payment{}, errors.New("geniuspay: no reference in the answer")
	}
	return p, nil
}

// Signed: a webhook's signature right (HMAC-SHA256 with the webhook secret). Two ways are in use:
// X-Webhook-Signature over « timestamp.body », the timestamp within five minutes; or
// X-GeniusPay-Signature over the body. No secret set: nothing to check it with (the payment
// is asked of GeniusPay all the same before anything is added).
func (g *GeniusPay) Signed(body []byte, h http.Header, now time.Time) bool {
	if g.WebhookSecret == "" {
		return true
	}
	mac := func(msg []byte) []byte {
		m := hmac.New(sha256.New, []byte(g.WebhookSecret))
		m.Write(msg)
		return []byte(hex.EncodeToString(m.Sum(nil)))
	}
	clean := func(s string) []byte {
		return []byte(strings.ToLower(strings.TrimPrefix(strings.TrimSpace(s), "sha256=")))
	}
	if sig := h.Get("X-Webhook-Signature"); sig != "" {
		ts := h.Get("X-Webhook-Timestamp")
		t, err := strconv.ParseInt(ts, 10, 64)
		if err != nil {
			return false
		}
		if t > 1e12 {
			t /= 1000 // in milliseconds
		}
		if d := now.Unix() - t; d > 300 || d < -300 {
			return false
		}
		return hmac.Equal(clean(sig), mac([]byte(ts+"."+string(body))))
	}
	if sig := h.Get("X-GeniusPay-Signature"); sig != "" {
		return hmac.Equal(clean(sig), mac(body))
	}
	return false
}
