package shop

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

func sign(secret, msg string) string {
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(msg))
	return hex.EncodeToString(m.Sum(nil))
}

// The webhooks' two signatures, and what's refused: a wrong one, an old one, none.
func TestSigned(t *testing.T) {
	g := &GeniusPay{WebhookSecret: "whsec_test"}
	body := []byte(`{"event":"payment.success","data":{"reference":"MTX-1"}}`)
	now := time.Unix(1_800_000_000, 0)
	ts := strconv.FormatInt(now.Unix(), 10)
	h := http.Header{}
	h.Set("X-Webhook-Timestamp", ts)
	h.Set("X-Webhook-Signature", sign("whsec_test", ts+"."+string(body)))
	if !g.Signed(body, h, now) {
		t.Error("timestamp.body signature refused")
	}
	if g.Signed(body, h, now.Add(10*time.Minute)) {
		t.Error("a signature ten minutes old taken")
	}
	if g.Signed([]byte(`{"event":"payment.success","data":{"reference":"MTX-2"}}`), h, now) {
		t.Error("another body taken with the same signature")
	}
	h = http.Header{}
	h.Set("X-GeniusPay-Signature", "sha256="+sign("whsec_test", string(body)))
	if !g.Signed(body, h, now) {
		t.Error("body signature refused")
	}
	if g.Signed(body, http.Header{}, now) {
		t.Error("no signature taken")
	}
	if !(&GeniusPay{}).Signed(body, http.Header{}, now) {
		t.Error("no secret set: nothing to check it with")
	}
}

// A payment created and read back: the keys sent, the answer under « data », an amount as a string.
func TestCreateAndGet(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-API-Key") != "pk_sandbox_k" || r.Header.Get("X-API-Secret") != "sk_sandbox_s" {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"success":false,"message":"Clés invalides"}`))
			return
		}
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/payments":
			var p NewPayment
			_ = json.NewDecoder(r.Body).Decode(&p)
			if p.Amount != 500 || p.Currency != "XOF" || p.Metadata["purchase"] != "p1" {
				w.WriteHeader(http.StatusUnprocessableEntity)
				return
			}
			_, _ = w.Write([]byte(`{"success":true,"data":{"reference":"MTX-1","amount":500,"currency":"XOF","status":"pending","checkout_url":"https://pay.genius.ci/checkout/MTX-1"}}`))
		case r.Method == http.MethodGet && r.URL.Path == "/payments/MTX-1":
			_, _ = w.Write([]byte(`{"success":true,"data":{"reference":"MTX-1","amount":"500.00","currency":"XOF","status":"completed"}}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()
	g := &GeniusPay{Key: "pk_sandbox_k", Secret: "sk_sandbox_s", Base: srv.URL, Client: srv.Client()}
	ctx := context.Background()
	p, err := g.Create(ctx, NewPayment{Amount: 500, Currency: "XOF", Metadata: map[string]string{"purchase": "p1"}})
	if err != nil || p.Reference != "MTX-1" || p.URL() != "https://pay.genius.ci/checkout/MTX-1" {
		t.Fatalf("created: %+v %v", p, err)
	}
	p, err = g.Get(ctx, "MTX-1")
	if err != nil || !paid(p.Status) || p.Amount != 500 {
		t.Fatalf("read back: %+v %v", p, err)
	}
	if !g.Sandbox() {
		t.Error("test keys are the sandbox")
	}
	bad := &GeniusPay{Key: "pk_live_x", Secret: "nope", Base: srv.URL, Client: srv.Client()}
	if _, err := bad.Get(ctx, "MTX-1"); err == nil || err.Error() != "geniuspay GET /payments/MTX-1: Clés invalides" {
		t.Errorf("wrong keys: %v", err)
	}
}

func TestPacks(t *testing.T) {
	for i, p := range Packs {
		if p.Price < 200 {
			t.Errorf("%s: GeniusPay takes 200 F at least", p.ID)
		}
		if i > 0 && float64(p.Djai)/float64(p.Price) <= float64(Packs[i-1].Djai)/float64(Packs[i-1].Price) {
			t.Errorf("%s gives less per franc than the one before", p.ID)
		}
	}
	if thousands(1120000) != "1 120 000" {
		t.Errorf("thousands: %q", thousands(1120000))
	}
}
