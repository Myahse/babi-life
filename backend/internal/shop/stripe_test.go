package shop

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
)

// fakeStripe: Stripe's Checkout Sessions, in memory. A session is created open; paid() pays it, at the sum asked.
type fakeStripe struct {
	mu       sync.Mutex
	sessions map[string]*Session
	forms    []map[string]string
}

func newFakeStripe(t *testing.T) (*fakeStripe, *Stripe) {
	f := &fakeStripe{sessions: map[string]*Session{}}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if user, _, _ := r.BasicAuth(); user != "sk_live_secret" {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":{"message":"bad key"}}`))
			return
		}
		f.mu.Lock()
		defer f.mu.Unlock()
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/checkout/sessions":
			_ = r.ParseForm()
			form := map[string]string{}
			for k := range r.PostForm {
				form[k] = r.PostForm.Get(k)
			}
			f.forms = append(f.forms, form)
			id := fmt.Sprintf("cs_live_%d", len(f.sessions)+1)
			meta := map[string]string{}
			for k, v := range form {
				if strings.HasPrefix(k, "metadata[") {
					meta[strings.TrimSuffix(strings.TrimPrefix(k, "metadata["), "]")] = v
				}
			}
			var amount int
			fmt.Sscan(form["line_items[0][price_data][unit_amount]"], &amount)
			f.sessions[id] = &Session{ID: id, URL: "https://checkout.stripe.com/c/" + id, Status: "open", PaymentStatus: "unpaid", AmountTotal: amount, Currency: form["line_items[0][price_data][currency]"], Livemode: true, Metadata: meta}
			_ = json.NewEncoder(w).Encode(f.sessions[id])
		case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/checkout/sessions/"):
			s, ok := f.sessions[strings.TrimPrefix(r.URL.Path, "/checkout/sessions/")]
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write([]byte(`{"error":{"message":"No such checkout session"}}`))
				return
			}
			_ = json.NewEncoder(w).Encode(s)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return f, &Stripe{Secret: "sk_live_secret", WebhookSecret: "whsec_test", Base: srv.URL, Client: srv.Client()}
}

func (f *fakeStripe) pay(id string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sessions[id].Status, f.sessions[id].PaymentStatus = "complete", "paid"
}

// stripeSign: a body as Stripe signs its webhooks.
func stripeSign(secret string, body []byte, at time.Time) string {
	mac := hmac.New(sha256.New, []byte(secret))
	fmt.Fprintf(mac, "%d.", at.Unix())
	mac.Write(body)
	return fmt.Sprintf("t=%d,v1=%s", at.Unix(), hex.EncodeToString(mac.Sum(nil)))
}

// The client: a session opened in francs CFA by card with our marks, asked back; a webhook's signature
// checked (the right secret, not too old).
func TestStripeClient(t *testing.T) {
	f, s := newFakeStripe(t)
	ctx := context.Background()
	sess, err := s.Create(ctx, NewSession{Amount: 2500, Name: "Babi Life · Pass", SuccessURL: "https://x/ok", BackURL: "https://x/ko", Metadata: map[string]string{"purchase": "p1"}})
	if err != nil || sess.URL == "" || !isCardRef(sess.ID) {
		t.Fatalf("create: %+v %v", sess, err)
	}
	form := f.forms[0]
	if form["line_items[0][price_data][currency]"] != "xof" || form["line_items[0][price_data][unit_amount]"] != "2500" || form["mode"] != "payment" || form["metadata[purchase]"] != "p1" || form["payment_method_types[0]"] != "card" {
		t.Fatalf("the session asked: %v", form)
	}
	f.pay(sess.ID)
	if got, err := s.Get(ctx, sess.ID); err != nil || !got.Paid() || got.AmountTotal != 2500 {
		t.Fatalf("get: %+v %v", got, err)
	}
	if _, err := (&Stripe{Secret: "sk_live_wrong", Base: s.Base, Client: s.Client}).Get(ctx, sess.ID); err == nil || !strings.Contains(err.Error(), "bad key") {
		t.Fatalf("a wrong key: %v", err)
	}
	body := []byte(`{"type":"checkout.session.completed"}`)
	now := time.Now()
	if !s.Signed(body, stripeSign("whsec_test", body, now), now) {
		t.Fatal("a good signature refused")
	}
	if s.Signed(body, stripeSign("whsec_other", body, now), now) || s.Signed(body, stripeSign("whsec_test", body, now.Add(-10*time.Minute)), now) || s.Signed([]byte(`{}`), stripeSign("whsec_test", body, now), now) {
		t.Fatal("a bad signature taken")
	}
	if (&Stripe{Secret: "sk_test_x"}).Test() == false || s.Test() {
		t.Fatal("test keys")
	}
}

// Against a database (TEST_DATABASE_URL): a donation by card opened, its webhook (signed) settles it once
// Stripe says it's paid; it's then listed among the donors, its sum in the total; less paid than given: held.
func TestDonationByCard(t *testing.T) {
	pool := playDB(t)
	ctx := context.Background()
	f, s := newFakeStripe(t)
	h := &Handler{DB: pool, Card: s, Site: "https://lifeinbabi.com"}
	r := chi.NewRouter()
	h.DonRoutes(r)
	r.Post("/shop/stripe", h.StripeWebhook)
	call := func(method, url, body string, header map[string]string) (int, map[string]any) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(method, url, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		for k, v := range header {
			req.Header.Set(k, v)
		}
		r.ServeHTTP(rec, req)
		var out map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &out)
		return rec.Code, out
	}
	if code, _ := call(http.MethodPost, "/dons", `{"amount":100,"method":"carte"}`, nil); code != http.StatusUnprocessableEntity {
		t.Fatalf("a donation under the minimum: %d", code)
	}
	if code, _ := call(http.MethodPost, "/dons", `{"amount":5000,"method":"mobile"}`, nil); code != http.StatusServiceUnavailable {
		t.Fatalf("Mobile Money without GeniusPay: %d", code)
	}
	code, out := call(http.MethodPost, "/dons", `{"amount":5000,"method":"carte","name":"Tantie Awa","email":"awa@test.ci","message":"Courage à l'équipe !","public":true}`, nil)
	if code != http.StatusOK || out["url"] == "" {
		t.Fatalf("donate: %d %v", code, out)
	}
	id := out["id"].(string)
	var ref string
	if err := pool.QueryRow(ctx, `SELECT reference FROM donations WHERE id::text = $1`, id).Scan(&ref); err != nil || !isCardRef(ref) {
		t.Fatalf("its session: %q %v", ref, err)
	}
	if _, st := call(http.MethodGet, "/dons/"+id, "", nil); st["status"] != "pending" {
		t.Fatalf("before paying: %v", st)
	}
	// Stripe's webhook: refused unsigned; signed, the session asked of Stripe (still unpaid: nothing).
	body := []byte(fmt.Sprintf(`{"type":"checkout.session.completed","data":{"object":{"id":%q}}}`, ref))
	if code, _ := call(http.MethodPost, "/shop/stripe", string(body), nil); code != http.StatusUnauthorized {
		t.Fatalf("an unsigned webhook: %d", code)
	}
	hook := func() map[string]any {
		_, out := call(http.MethodPost, "/shop/stripe", string(body), map[string]string{"Stripe-Signature": stripeSign("whsec_test", body, time.Now())})
		return out
	}
	if out := hook(); out["status"] != "pending" {
		t.Fatalf("unpaid: %v", out)
	}
	f.pay(ref)
	if out := hook(); out["status"] != "paid" {
		t.Fatalf("paid: %v", out)
	}
	hook()
	_, list := call(http.MethodGet, "/dons", "", nil)
	donors := list["donors"].([]any)
	if len(donors) != 1 || donors[0].(map[string]any)["name"] != "Tantie Awa" || list["total"].(float64) != 5000 {
		t.Fatalf("the donors: %v", list)
	}
	// A session paid less than the donation said: held, not counted.
	_, out = call(http.MethodPost, "/dons", `{"amount":2000,"method":"carte"}`, nil)
	id2 := out["id"].(string)
	_ = pool.QueryRow(ctx, `SELECT reference FROM donations WHERE id::text = $1`, id2).Scan(&ref)
	f.mu.Lock()
	f.sessions[ref].AmountTotal = 1000
	f.mu.Unlock()
	f.pay(ref)
	if _, st := call(http.MethodGet, "/dons/"+id2, "", nil); st["status"] != "mismatch" {
		t.Fatalf("paid less: %v", st)
	}
}

// Against a database: a pack of Djai bought by card in the shop (Stripe's page at the price, no operator's
// fees), given once Stripe says the session is paid, when the player comes back to the game.
func TestBuyByCard(t *testing.T) {
	pool := playDB(t)
	ctx := context.Background()
	f, s := newFakeStripe(t)
	h := &Handler{DB: pool, Card: s, Site: "https://lifeinbabi.com"}
	var user, sim string
	if err := pool.QueryRow(ctx, `INSERT INTO users (email, name, first_name, last_name, username, password_hash, adult_at) VALUES ('carte@test.ci', 'Carte', 'Carte', 'Test', 'carte', 'x', now()) RETURNING id`).Scan(&user); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		INSERT INTO sims (user_id, first_name, last_name, gender, look, traits, aspiration, home_city, home_commune, city, commune, money, needs, game_minutes, origin, housing, loan, born_at, family, apps)
		VALUES ($1, 'Carte', 'Test', 'homme', '{}', '{}', '', 'abidjan', 'cocody', 'abidjan', 'cocody', 0, '{}', 0, '', '', 0, 0, '', '{}') RETURNING id`, user).Scan(&sim); err != nil {
		t.Fatal(err)
	}
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			next.ServeHTTP(w, req.WithContext(auth.WithUserID(req.Context(), user)))
		})
	})
	h.Routes(r)
	do := func(method, url, body string) (int, map[string]any) {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(method, url, strings.NewReader(body)))
		var out map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &out)
		return rec.Code, out
	}
	_, view := do(http.MethodGet, "/sims/"+sim+"/shop", "")
	if view["card"] != true || view["open"] == true {
		t.Fatalf("the shop by card only: %v", view)
	}
	pack := Packs[0]
	code, out := do(http.MethodPost, "/sims/"+sim+"/shop", fmt.Sprintf(`{"pack":%q,"method":"carte"}`, pack.ID))
	if code != http.StatusOK || !strings.HasPrefix(out["url"].(string), "https://checkout.stripe.com/") {
		t.Fatalf("buy by card: %d %v", code, out)
	}
	if code, _ := do(http.MethodPost, "/sims/"+sim+"/shop", fmt.Sprintf(`{"pack":%q}`, pack.ID)); code != http.StatusServiceUnavailable {
		t.Fatalf("Mobile Money without GeniusPay: %d", code)
	}
	if form := f.forms[0]; form["line_items[0][price_data][unit_amount]"] != fmt.Sprint(pack.Price) || form["metadata[purchase]"] != out["id"] {
		t.Fatalf("the session asked: %v", form)
	}
	id := out["id"].(string)
	if _, p := do(http.MethodPost, "/sims/"+sim+"/shop/"+id, ""); p["credited"] == true {
		t.Fatalf("given before paying: %v", p)
	}
	var ref string
	_ = pool.QueryRow(ctx, `SELECT reference FROM purchases WHERE id = $1`, id).Scan(&ref)
	f.pay(ref)
	_, p := do(http.MethodPost, "/sims/"+sim+"/shop/"+id, "")
	_, again := do(http.MethodPost, "/sims/"+sim+"/shop/"+id, "")
	var money int
	_ = pool.QueryRow(ctx, `SELECT money FROM sims WHERE id = $1`, sim).Scan(&money)
	if p["credited"] != true || again["credited"] != true || money != pack.Djai {
		t.Fatalf("paid: %v, the Sim's Djai %d (want %d once)", p, money, pack.Djai)
	}
}
