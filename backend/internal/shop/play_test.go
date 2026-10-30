package shop

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/db"
	"github.com/myahse/babi-life/backend/internal/game"
)

// fakeGoogle: Google's token endpoint and the Developer API's one-time purchases, as play.go calls them.
type fakeGoogle struct {
	mu        sync.Mutex
	purchases map[string]PlayPurchase // by token
	consumed  map[string]int
	acked     map[string]int
	gets      int
	srv       *httptest.Server
}

func newFakeGoogle(t *testing.T) *fakeGoogle {
	f := &fakeGoogle{purchases: map[string]PlayPurchase{}, consumed: map[string]int{}, acked: map[string]int{}}
	prefix := "/androidpublisher/v3/applications/" + PlayPackage + "/purchases/products/"
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		if r.URL.Path == "/token" {
			_ = r.ParseForm()
			if r.Form.Get("grant_type") != "urn:ietf:params:oauth:grant-type:jwt-bearer" || r.Form.Get("assertion") == "" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access_token":"tok-1","token_type":"Bearer","expires_in":3600}`))
			return
		}
		if r.Header.Get("Authorization") != "Bearer tok-1" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		rest, ok := strings.CutPrefix(r.URL.EscapedPath(), prefix)
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		product, tail, _ := strings.Cut(rest, "/tokens/")
		token, action, _ := strings.Cut(tail, ":")
		token, _ = url.PathUnescape(token)
		p, known := f.purchases[product+"/"+token]
		if !known {
			w.WriteHeader(http.StatusGone)
			_, _ = w.Write([]byte(`{"error":{"code":410,"message":"The purchase token is no longer valid."}}`))
			return
		}
		switch {
		case r.Method == http.MethodGet && action == "":
			f.gets++
			_ = json.NewEncoder(w).Encode(p)
		case r.Method == http.MethodPost && action == "consume":
			f.consumed[token]++
			p.ConsumptionState, p.AcknowledgementState = 1, 1
			f.purchases[product+"/"+token] = p
		case r.Method == http.MethodPost && action == "acknowledge":
			f.acked[token]++
			p.AcknowledgementState = 1
			f.purchases[product+"/"+token] = p
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeGoogle) set(product, token string, p PlayPurchase) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.purchases[product+"/"+token] = p
}

// serviceAccount: a service account's JSON, its key made now, its tokens asked of the fake.
func serviceAccount(t *testing.T, tokenURL string) string {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	der, _ := x509.MarshalPKCS8PrivateKey(key)
	b, _ := json.Marshal(map[string]string{
		"type": "service_account", "project_id": "babi-test", "private_key_id": "k1",
		"private_key":  string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})),
		"client_email": "play@babi-test.iam.gserviceaccount.com", "token_uri": tokenURL,
	})
	return string(b)
}

func testPlay(t *testing.T) (*Play, *fakeGoogle) {
	f := newFakeGoogle(t)
	p, err := NewPlay(serviceAccount(t, f.srv.URL+"/token"))
	if err != nil {
		t.Fatal(err)
	}
	p.Base = f.srv.URL
	return p, f
}

// The service account, raw or in base64; anything else refused.
func TestServiceAccountJSON(t *testing.T) {
	raw := `{"type":"service_account"}`
	for _, in := range []string{raw, "  " + raw + "\n", base64.StdEncoding.EncodeToString([]byte(raw)), base64.RawURLEncoding.EncodeToString([]byte(raw))} {
		if b, err := serviceAccountJSON(in); err != nil || string(b) != raw {
			t.Errorf("%q: %q %v", in, b, err)
		}
	}
	if _, err := serviceAccountJSON("not json"); err == nil {
		t.Error("garbage taken")
	}
	if _, err := NewPlay(`{"type":"service_account"}`); err == nil {
		t.Error("a service account without a key taken")
	}
}

// Every product: one ID, lowercase as Play wants, the same as the catalogue's PlayID, growing up at each of its prices.
func TestPlayProducts(t *testing.T) {
	ok := regexp.MustCompile(`^[a-z0-9][a-z0-9_]*$`)
	seen := map[string]bool{}
	for _, p := range PlayProducts() {
		if !ok.MatchString(p.ID) || seen[p.ID] || p.Price <= 0 {
			t.Errorf("product %+v: bad, repeated or without a price", p)
		}
		seen[p.ID] = true
	}
	for _, p := range Packs {
		if got, ok := FindPlay(p.PlayID); !ok || got.Kind != "djai" || got.Djai != p.Djai || got.Price != p.Price {
			t.Errorf("pack %s: %+v", p.ID, got)
		}
	}
	for _, it := range Items {
		if it.Grow != "" {
			continue
		}
		if got, ok := FindPlay(it.PlayID); !ok || got.Item != it.ID || got.Price != it.Price || got.Once != it.Once {
			t.Errorf("item %s: %+v", it.ID, got)
		}
	}
	if got, ok := FindPlay(GrowPlayID(game.StageAdulte, GrowPrice(game.StageBebe, game.StageAdulte))); !ok || got.Item != "grandir-adulte" || got.Price != 5000 || got.Kind != "grandir" {
		t.Errorf("growing up from the cradle: %+v", got)
	}
	if p, _ := FindPlay("veste_repos"); p.Kind != "tenue" || !p.Once {
		t.Errorf("a piece of clothing: %+v", p)
	}
	if _, ok := FindPlay("djai_42"); ok {
		t.Error("an unknown product found")
	}
}

// The client: the token asked with the service account, a purchase read, consumed, acknowledged; an unknown token said so.
func TestPlayClient(t *testing.T) {
	p, f := testPlay(t)
	ctx := context.Background()
	f.set("djai_500", "tk/1", PlayPurchase{PurchaseState: 0, OrderID: "GPA.1", ObfuscatedExternalAccountID: "u1"})
	got, err := p.Get(ctx, "djai_500", "tk/1")
	if err != nil || got.OrderID != "GPA.1" || got.PurchaseState != 0 || got.ObfuscatedExternalAccountID != "u1" || got.Test() {
		t.Fatalf("get: %+v %v", got, err)
	}
	if err := p.Consume(ctx, "djai_500", "tk/1"); err != nil || f.consumed["tk/1"] != 1 {
		t.Fatalf("consume: %v %v", err, f.consumed)
	}
	if err := p.Acknowledge(ctx, "djai_500", "tk/1"); err != nil || f.acked["tk/1"] != 1 {
		t.Fatalf("acknowledge: %v %v", err, f.acked)
	}
	if _, err := p.Get(ctx, "djai_500", "nope"); !errors.Is(err, errPlayUnknown) {
		t.Fatalf("unknown token: %v", err)
	}
	zero := 0
	f.set("djai_500", "test", PlayPurchase{PurchaseType: &zero})
	if got, _ := p.Get(ctx, "djai_500", "test"); !got.Test() {
		t.Error("a license tester's purchase not seen as a test")
	}
}

// Without the service account: refused, said in French.
func TestPlayNotConfigured(t *testing.T) {
	h := &Handler{}
	rec := httptest.NewRecorder()
	h.play(rec, httptest.NewRequest(http.MethodPost, "/shop/play", strings.NewReader(`{"productId":"djai_500","purchaseToken":"x"}`)))
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "pas encore configuré") {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	rec = httptest.NewRecorder()
	h.PlayNotification(rec, httptest.NewRequest(http.MethodPost, "/shop/play/rtdn", strings.NewReader(`{}`)))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("rtdn: %d", rec.Code)
	}
}

// playDB: a fresh database (TEST_DATABASE_URL), as the other packages' tests.
func playDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	admin, err := db.Connect(ctx, base)
	if err != nil {
		t.Skipf("no database: %v", err)
	}
	defer admin.Close()
	name := fmt.Sprintf("babi_test_play_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, `CREATE DATABASE `+name); err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(base)
	u.Path = "/" + name
	pool, err := db.Connect(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		if a, err := db.Connect(ctx, base); err == nil {
			_, _ = a.Exec(ctx, `DROP DATABASE IF EXISTS `+name+` WITH (FORCE)`)
			a.Close()
		}
	})
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	return pool
}

// A purchase given once whatever how many times it's sent, consumed; a pending one given when Google says
// paid; another account's refused; the crown acknowledged, not consumed; a refund takes it back.
func TestPlaySettle(t *testing.T) {
	pool := playDB(t)
	ctx := context.Background()
	play, f := testPlay(t)
	h := &Handler{DB: pool, Play: play}
	var user, other, sim string
	for i, u := range []*string{&user, &other} {
		if err := pool.QueryRow(ctx, `INSERT INTO users (email, name, first_name, last_name, username, password_hash, adult_at) VALUES ($1, 'P', 'P', 'Test', $2, 'x', now()) RETURNING id`,
			fmt.Sprintf("p%d@test.ci", i), fmt.Sprintf("p%d", i)).Scan(u); err != nil {
			t.Fatal(err)
		}
	}
	now := game.MinuteOf(time.Now())
	if err := pool.QueryRow(ctx, `
		INSERT INTO sims (user_id, first_name, last_name, gender, look, traits, aspiration,
		                  home_city, home_commune, city, commune, money, needs, game_minutes,
		                  origin, housing, loan, born_at, family, apps)
		VALUES ($1, 'Awa', 'Test', 'femme', '{}', '{}', '', 'abidjan', 'cocody', 'abidjan', 'cocody', 0, $2, $3, '', '', 0, $3, '', '{}')
		RETURNING id`, user, game.FreshNeeds(), now).Scan(&sim); err != nil {
		t.Fatal(err)
	}
	money := func() (m int) {
		_ = pool.QueryRow(ctx, `SELECT money FROM sims WHERE id = $1`, sim).Scan(&m)
		return
	}
	pack, _ := FindPlay("djai_500")
	f.set(pack.ID, "tok-a", PlayPurchase{PurchaseState: 0, OrderID: "GPA.A", ObfuscatedExternalAccountID: user})
	for range 3 {
		p, err := h.playSettle(ctx, pack, "tok-a", &user, &sim)
		if err != nil || !p.Credited || p.Status != "completed" || p.Djai != pack.Djai {
			t.Fatalf("paid: %+v %v", p, err)
		}
	}
	if m := money(); m != pack.Djai {
		t.Fatalf("money %d, want %d once", m, pack.Djai)
	}
	if f.consumed["tok-a"] != 1 {
		t.Errorf("consumed %d times", f.consumed["tok-a"])
	}
	if _, err := h.playSettle(ctx, pack, "tok-a", &other, nil); !errors.Is(err, errPlayOther) {
		t.Errorf("another account's token: %v", err)
	}
	// The same order under another token: not given twice.
	f.set(pack.ID, "tok-a2", PlayPurchase{PurchaseState: 0, OrderID: "GPA.A"})
	if p, _ := h.playSettle(ctx, pack, "tok-a2", &user, &sim); p.Credited || money() != pack.Djai {
		t.Errorf("an order given twice: %+v", p)
	}

	// Pending (cash): recorded, then given when Google says paid (the notification, no account sent: the one the app gave).
	f.set(pack.ID, "tok-b", PlayPurchase{PurchaseState: 2, ObfuscatedExternalAccountID: user})
	if p, err := h.playSettle(ctx, pack, "tok-b", &user, &sim); err != nil || p.Credited || p.Status != "pending" {
		t.Fatalf("pending: %+v %v", p, err)
	}
	f.set(pack.ID, "tok-b", PlayPurchase{PurchaseState: 0, OrderID: "GPA.B", ObfuscatedExternalAccountID: user})
	body, _ := json.Marshal(map[string]any{"oneTimeProductNotification": map[string]any{"notificationType": 1, "purchaseToken": "tok-b", "sku": pack.ID}, "packageName": PlayPackage})
	push, _ := json.Marshal(map[string]any{"message": map[string]any{"data": body}})
	rec := httptest.NewRecorder()
	h.PlayNotification(rec, httptest.NewRequest(http.MethodPost, "/shop/play/rtdn", strings.NewReader(string(push))))
	if rec.Code != http.StatusOK || money() != 2*pack.Djai {
		t.Fatalf("notification: %d %s, money %d", rec.Code, rec.Body, money())
	}

	// Kept for good: acknowledged, never consumed.
	crown, _ := FindPlay("pack_prestige")
	f.set(crown.ID, "tok-c", PlayPurchase{PurchaseState: 0, OrderID: "GPA.C"})
	if p, err := h.playSettle(ctx, crown, "tok-c", &user, &sim); err != nil || !p.Credited {
		t.Fatalf("crown: %+v %v", p, err)
	}
	if f.acked["tok-c"] != 1 || f.consumed["tok-c"] != 0 {
		t.Errorf("crown acked %d consumed %d", f.acked["tok-c"], f.consumed["tok-c"])
	}
	// Refunded: the crown taken back.
	f.set(crown.ID, "tok-c", PlayPurchase{PurchaseState: 1, OrderID: "GPA.C"})
	if p, err := h.playSettle(ctx, crown, "tok-c", &user, &sim); err != nil || p.Status != "refunded" {
		t.Fatalf("refund: %+v %v", p, err)
	}
	var prestige bool
	_ = pool.QueryRow(ctx, `SELECT prestige FROM sims WHERE id = $1`, sim).Scan(&prestige)
	if prestige {
		t.Error("the crown kept after a refund")
	}
	// A token Google doesn't know: refused.
	if _, err := h.playSettle(ctx, pack, "forged", &user, &sim); !errors.Is(err, errPlayUnknown) {
		t.Errorf("a forged token: %v", err)
	}
}
