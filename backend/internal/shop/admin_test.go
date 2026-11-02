package shop

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The « Paiements » tab: the purchases begun and paid with their totals, and one asked again of
// GeniusPay by hand: paid there, it's given (once); not paid, nothing is.
func TestAdminPurchases(t *testing.T) {
	pool := playDB(t)
	ctx := context.Background()
	// GeniusPay: MTX-PAID was paid 500 F, MTX-OPEN is still waiting.
	gp := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ref := strings.TrimPrefix(r.URL.Path, "/payments/")
		status := map[string]string{"MTX-PAID": "completed", "MTX-OPEN": "pending"}[ref]
		_, _ = fmt.Fprintf(w, `{"success":true,"data":{"reference":%q,"amount":500,"currency":"XOF","status":%q,"environment":"live"}}`, ref, status)
	}))
	defer gp.Close()
	h := &Handler{DB: pool, Pay: &GeniusPay{Key: "pk_live_k", Secret: "sk_live_s", Base: gp.URL, Client: gp.Client()}}
	var user, sim string
	if err := pool.QueryRow(ctx, `INSERT INTO users (email, name, first_name, last_name, username, password_hash, adult_at) VALUES ('kader@test.ci', 'Kader', 'Kader', 'Test', 'kader', 'x', now()) RETURNING id`).Scan(&user); err != nil {
		t.Fatal(err)
	}
	now := game.MinuteOf(time.Now())
	if err := pool.QueryRow(ctx, `
		INSERT INTO sims (user_id, first_name, last_name, gender, look, traits, aspiration, home_city, home_commune, city, commune, money, needs, game_minutes, origin, housing, loan, born_at, family, apps)
		VALUES ($1, 'Kader', 'Test', 'homme', '{}', '{}', '', 'abidjan', 'cocody', 'abidjan', 'cocody', 0, $2, $3, '', '', 0, $3, '', '{}') RETURNING id`, user, game.FreshNeeds(), now).Scan(&sim); err != nil {
		t.Fatal(err)
	}
	add := func(ref, status string, credited bool) (id string) {
		if err := pool.QueryRow(ctx, `INSERT INTO purchases (user_id, sim_id, kind, item, pack, price, djai, reference, status, credited_at) VALUES ($1, $2, 'djai', 'piece', 'piece', 500, 40000, $3, $4, CASE WHEN $5 THEN now() END) RETURNING id`,
			user, sim, ref, status, credited).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return
	}
	add("MTX-OLD", "completed", true)
	paid := add("MTX-PAID", "pending", false)
	waiting := add("MTX-OPEN", "pending", false)

	r := chi.NewRouter()
	h.Admin(r)
	get := func(url string) (out struct {
		Purchases []AdminPurchase `json:"purchases"`
		Totals    AdminTotals     `json:"totals"`
	}) {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: %d %s", url, rec.Code, rec.Body)
		}
		_ = json.Unmarshal(rec.Body.Bytes(), &out)
		return
	}
	all := get("/purchases")
	if len(all.Purchases) != 3 || all.Totals.Begun != 3 || all.Totals.Paid != 1 || all.Totals.Waiting != 2 || all.Totals.Revenue != 500 {
		t.Fatalf("all: %d purchases, totals %+v", len(all.Purchases), all.Totals)
	}
	if p := all.Purchases[0]; p.Name != "Kader" || p.Email != "kader@test.ci" || p.Sim != "Kader" || p.Via != "geniuspay" {
		t.Errorf("who made it: %+v", p)
	}
	if w := get("/purchases?status=waiting&q=kader"); len(w.Purchases) != 2 {
		t.Errorf("waiting: %d", len(w.Purchases))
	}

	check := func(id string) (out struct {
		Purchase AdminPurchase `json:"purchase"`
		Said     string        `json:"said"`
	}) {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/purchases/"+id+"/check", nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("check %s: %d %s", id, rec.Code, rec.Body)
		}
		_ = json.Unmarshal(rec.Body.Bytes(), &out)
		return
	}
	money := func() (m int) {
		_ = pool.QueryRow(ctx, `SELECT money FROM sims WHERE id = $1`, sim).Scan(&m)
		return
	}
	for range 2 {
		c := check(paid)
		if c.Purchase.Credited == nil || c.Purchase.Status != "completed" || !strings.Contains(c.Said, "completed") || !strings.Contains(c.Said, "500") {
			t.Fatalf("paid at GeniusPay: %+v « %s »", c.Purchase, c.Said)
		}
	}
	if m := money(); m != 40000 {
		t.Errorf("money %d after two checks, want 40 000 once", m)
	}
	if c := check(waiting); c.Purchase.Credited != nil || c.Purchase.Status != "pending" {
		t.Errorf("still waiting at GeniusPay: %+v « %s »", c.Purchase, c.Said)
	}
	if m := money(); m != 40000 {
		t.Errorf("money %d: something given for a payment not made", m)
	}
}
