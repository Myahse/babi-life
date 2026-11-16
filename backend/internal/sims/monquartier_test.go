package sims

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
)

// quartierCall: one request to the routes as the Sim's player.
func quartierCall(t *testing.T, pool *pgxpool.Pool, sim, method, path, body string) (int, map[string]any) {
	t.Helper()
	var user string
	if err := pool.QueryRow(context.Background(), `SELECT user_id FROM sims WHERE id = $1`, sim).Scan(&user); err != nil {
		t.Fatal(err)
	}
	r := chi.NewRouter()
	(&Handler{DB: pool}).Routes(r)
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req = req.WithContext(auth.WithUserID(req.Context(), user))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

// Against a database (TEST_DATABASE_URL): the quartier made on first read, a building paid and placed, a
// locked one refused, the money waiting collected, staff hired, visits (once a day each, friends only
// when asked), and the hub's shape.
func TestMonQuartier(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	awa, koffi := replySim(t, pool, "Awa"), replySim(t, pool, "Koffi")
	if _, err := pool.Exec(ctx, `UPDATE sims SET money = 1000000 WHERE id = $1`, awa); err != nil {
		t.Fatal(err)
	}

	code, q := quartierCall(t, pool, awa, http.MethodGet, "/sims/"+awa+"/quartier", "")
	if code != 200 || q["name"] != "Quartier Awa" || q["level"].(float64) != 1 || q["radius"].(float64) != game.QuartierRadius {
		t.Fatalf("first read: %d %v", code, q)
	}
	if todo, _ := q["todo"].(map[string]any); todo == nil || todo["kind"] != "build" {
		t.Fatalf("first todo: %v", q["todo"])
	}
	if n := len(q["unlocks"].([]any)); n != len(game.QuartierKinds) {
		t.Fatalf("unlocks: %d", n)
	}

	// A maquis needs level 2; a boutique is built on slot 3.
	if code, _ := quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/quartier/build", `{"kind":"maquis","slot":0}`); code != 422 {
		t.Fatalf("a maquis at level 1: %d", code)
	}
	code, res := quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/quartier/build", `{"kind":"boutique","slot":3}`)
	b, _ := res["data"].(map[string]any)
	if code != 200 || b == nil || b["slot"].(float64) != 3 || b["staff"].(float64) != 1 {
		t.Fatalf("a boutique: %d %v", code, res)
	}
	if code, _ := quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/quartier/build", `{"kind":"grin","slot":3}`); code != 422 {
		t.Fatalf("two on one slot: %d", code)
	}
	var money int
	_ = pool.QueryRow(ctx, `SELECT money FROM sims WHERE id = $1`, awa).Scan(&money)
	if money != 1000000-120000 {
		t.Fatalf("paid: %d", money)
	}
	id := int64(b["id"].(float64))

	// Nothing waits yet; two days later, the takings, the tax off.
	if code, _ := quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/quartier/collect", `{}`); code != 422 {
		t.Fatalf("collect at once: %d", code)
	}
	if _, err := pool.Exec(ctx, `UPDATE quartier_buildings SET last = now() - interval '2 days' WHERE id = $1`, id); err != nil {
		t.Fatal(err)
	}
	_, q = quartierCall(t, pool, awa, http.MethodGet, "/sims/"+awa+"/quartier", "")
	pending := int(q["pending"].(float64))
	if pending != 2*int(q["perDay"].(float64)) || pending <= 0 {
		t.Fatalf("two days: %d of %v a day", pending, q["perDay"])
	}
	code, res = quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/quartier/collect", `{"buildingId":`+jsonInt(id)+`}`)
	if d, _ := res["data"].(map[string]any); code != 200 || d == nil || int(d["amount"].(float64)) != int(float64(pending)*0.9+0.5) {
		t.Fatalf("collected: %d %v", code, res)
	}

	// Staff: one more, up to the most; then one less.
	if code, res = quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/quartier/staff", `{"buildingId":`+jsonInt(id)+`,"delta":1}`); code != 200 || res["data"].(map[string]any)["staff"].(float64) != 2 {
		t.Fatalf("hire: %d %v", code, res)
	}
	quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/quartier/staff", `{"buildingId":`+jsonInt(id)+`,"delta":1}`)
	if code, _ = quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/quartier/staff", `{"buildingId":`+jsonInt(id)+`,"delta":1}`); code != 422 {
		t.Fatalf("a fourth: %d", code)
	}

	// Visits: Koffi's first today brings reputation, the second not.
	var rep0 int
	_ = pool.QueryRow(ctx, `SELECT reputation FROM quartiers WHERE sim_id = $1`, awa).Scan(&rep0)
	code, v := quartierCall(t, pool, koffi, http.MethodPost, "/sims/"+koffi+"/quartier/visit", `{"owner":"`+awa+`"}`)
	if code != 200 || v["name"] != "Quartier Awa" || v["pending"] != nil {
		t.Fatalf("visit: %d %v", code, v)
	}
	if bs := v["buildings"].([]any); len(bs) != 1 || bs[0].(map[string]any)["perDay"] != nil {
		t.Fatalf("a visitor sees the money: %v", bs)
	}
	quartierCall(t, pool, koffi, http.MethodPost, "/sims/"+koffi+"/quartier/visit", `{"owner":"`+awa+`"}`)
	var rep1 int
	_ = pool.QueryRow(ctx, `SELECT reputation FROM quartiers WHERE sim_id = $1`, awa).Scan(&rep1)
	if rep1-rep0 != game.RepVisit {
		t.Fatalf("two visits the same day: +%d", rep1-rep0)
	}

	// Friends only: Koffi is refused, then let in once friends.
	if code, _ := quartierCall(t, pool, awa, http.MethodPut, "/sims/"+awa+"/quartier", `{"visitsMode":"amis","name":"Les Rosiers"}`); code != 200 {
		t.Fatalf("edit: %d", code)
	}
	if code, _ := quartierCall(t, pool, koffi, http.MethodGet, "/quartiers/"+awa, ""); code != 403 {
		t.Fatalf("not a friend: %d", code)
	}
	a, b2 := pair(awa, koffi)
	if _, err := pool.Exec(ctx, `INSERT INTO bonds (sim_a, sim_b, friends) VALUES ($1, $2, true)`, a, b2); err != nil {
		t.Fatal(err)
	}
	if code, v := quartierCall(t, pool, koffi, http.MethodGet, "/quartiers/"+awa, ""); code != 200 || v["name"] != "Les Rosiers" {
		t.Fatalf("a friend: %d %v", code, v)
	}

	// A demande done brings reputation to the quartier.
	tx, _ := pool.Begin(ctx)
	if err := quartierRep(ctx, tx, awa, game.RepErrand); err != nil {
		t.Fatal(err)
	}
	_ = tx.Commit(ctx)

	// The hub.
	code, hub := quartierCall(t, pool, awa, http.MethodGet, "/hub", "")
	if code != 200 || hub["communes"] == nil || hub["events"] == nil {
		t.Fatalf("hub: %d %v", code, hub)
	}
	c0 := hub["communes"].([]any)[0].(map[string]any)
	if _, ok := c0["highlights"].([]any); !ok || c0["commune"] == "" {
		t.Fatalf("hub commune: %v", c0)
	}
	h := &Handler{DB: pool, OnlineIn: func() map[string]int { return map[string]int{"abidjan|cocody": 7} }}
	out, err := h.hubNow(ctx, time.Now())
	if err != nil || out["communes"].([]*hubCommune)[0].Commune != "cocody" {
		t.Fatalf("the busiest first: %v", err)
	}
}

func jsonInt(n int64) string { b, _ := json.Marshal(n); return string(b) }
