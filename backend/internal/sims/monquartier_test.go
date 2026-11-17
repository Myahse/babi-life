package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
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

// Against a database: a quartier building is a place of the street (« quartier:<id> ») where its owner and its
// visitors do what that kind of place offers; a visitor's purchase leaves the owner's share in the building and,
// once a day for each buyer, reputation; a block or another commune keeps one out.
func TestQuartierPlaceActions(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	old := features.Default
	features.Default = &features.Store{DB: pool}
	t.Cleanup(func() { features.Default = old })
	if err := features.Default.Set(ctx, game.MonQuartierKey, true, nil); err != nil {
		t.Fatal(err)
	}
	awa, koffi := replySim(t, pool, "Awa"), replySim(t, pool, "Koffi")
	if _, err := pool.Exec(ctx, `UPDATE sims SET money = 1000000, born_at = game_minutes - $1 WHERE id IN ($2, $3)`, game.MinutesToAge(25), awa, koffi); err != nil {
		t.Fatal(err)
	}
	code, res := quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/quartier/build", `{"kind":"boutique","slot":0}`)
	if code != 200 {
		t.Fatalf("build: %d %v", code, res)
	}
	id := int64(res["data"].(map[string]any)["id"].(float64))
	place := "quartier:" + jsonInt(id)

	// One action at the boutique, at ten in the morning, in a transaction of its own.
	act := func(sim, placeID string) (*Sim, game.Interaction, error) {
		t.Helper()
		var user string
		_ = pool.QueryRow(ctx, `SELECT user_id FROM sims WHERE id = $1`, sim).Scan(&user)
		uctx := auth.WithUserID(ctx, user)
		tx, err := pool.Begin(uctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(uctx)
		s, err := scanSim(tx.QueryRow(uctx, `SELECT `+simColumns+` FROM sims WHERE id = $1`, sim))
		if err != nil {
			t.Fatal(err)
		}
		s.GameMinutes = (s.GameMinutes/(24*60)+1)*24*60 + 10*60
		if err := loadQuartierPlace(uctx, tx, &s, placeID); err != nil {
			return &s, game.Interaction{}, err
		}
		it, err := s.interactAt(placeID, "courses")
		if err != nil {
			return &s, it, err
		}
		if err := (&Handler{DB: pool}).quartierSale(uctx, tx, &s, it); err != nil {
			t.Fatal(err)
		}
		return &s, it, tx.Commit(uctx)
	}
	state := func() (pending, rep int) {
		_ = pool.QueryRow(ctx, `SELECT earnings_pending FROM quartier_buildings WHERE id = $1`, id).Scan(&pending)
		_ = pool.QueryRow(ctx, `SELECT reputation FROM quartiers WHERE sim_id = $1`, awa).Scan(&rep)
		return
	}
	p0, r0 := state()

	// The owner in its own boutique: its menu, nothing earned off itself.
	s, it, err := act(awa, place)
	if err != nil || it.ID != "courses" || s.Activity == nil || s.Activity.PlaceName != "Boutique" {
		t.Fatalf("the owner: %v %+v", err, s.Activity)
	}
	if p, r := state(); p != p0 || r != r0 {
		t.Fatalf("the owner paid itself: %d %d", p-p0, r-r0)
	}
	// A visitor: the boutique « · Awa », the owner's share and reputation; the second purchase the same
	// day, the share only.
	s, it, err = act(koffi, place)
	if err != nil || s.Activity == nil || s.Activity.PlaceName != "Boutique · Awa" {
		t.Fatalf("the visitor: %v %+v", err, s.Activity)
	}
	share := game.QuartierSale(it.Cost)
	if p, r := state(); p != p0+share || r != r0+game.RepSale || share <= 0 {
		t.Fatalf("a sale: +%d F +%d rep (share %d)", p-p0, r-r0, share)
	}
	if _, _, err = act(koffi, place); err != nil {
		t.Fatal(err)
	}
	if p, r := state(); p != p0+2*share || r != r0+game.RepSale {
		t.Fatalf("two sales: +%d F +%d rep", p-p0, r-r0)
	}
	var lines int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM sim_events WHERE sim_id = $1 AND text LIKE 'Koffi a payé chez toi%'`, awa).Scan(&lines)
	if lines != 1 {
		t.Errorf("the owner told %d times", lines)
	}

	// Another commune: go there first. An unknown building, a block: refused.
	if _, err := pool.Exec(ctx, `UPDATE sims SET commune = 'yopougon' WHERE id = $1`, koffi); err != nil {
		t.Fatal(err)
	}
	if _, _, err := act(koffi, place); err == nil || !strings.Contains(err.Error(), "va d'abord") {
		t.Errorf("from another commune: %v", err)
	}
	if _, _, err := act(koffi, "quartier:999999999"); !errors.Is(err, errQuartierPlaceGone) {
		t.Errorf("no such building: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE sims SET commune = 'cocody' WHERE id = $1`, koffi); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO blocks (sim, blocked) VALUES ($1, $2)`, awa, koffi); err != nil {
		t.Fatal(err)
	}
	if _, _, err := act(koffi, place); !errors.Is(err, errFriendsOnly) {
		t.Errorf("blocked: %v", err)
	}
}

// Against a database: the quartier as a neighbourhood of lots. A v1 building (layout 1, a slot of the old ring)
// is moved onto its lot when the quartier is read; every lot is listed, free or built; a building is put where
// the phone snapped its lot to the street when near enough, refused far from it; « À faire maintenant » points
// to a lot; the area lists the other players' quartiers and homes round it, none across a block, a friends-only
// one without its buildings.
func TestQuartierLotsDB(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	awa, koffi, ali := replySim(t, pool, "Awa"), replySim(t, pool, "Koffi"), replySim(t, pool, "Ali")
	if _, err := pool.Exec(ctx, `UPDATE sims SET money = 1000000 WHERE id = $1`, awa); err != nil {
		t.Fatal(err)
	}
	code, q := quartierCall(t, pool, awa, http.MethodGet, "/sims/"+awa+"/quartier", "")
	if code != 200 || len(q["lots"].([]any)) != game.QuartierLots || q["radius"].(float64) != game.QuartierRadius {
		t.Fatalf("lots: %d %v", code, q["lots"])
	}
	if todo := q["todo"].(map[string]any); todo["lot"] != float64(0) {
		t.Fatalf("the first todo's lot: %v", todo)
	}
	c := q["center"].(map[string]any)
	clat, clng := c["lat"].(float64), c["lng"].(float64)

	// A v1 building on slot 4 (45 m round the home), as the update's first version kept it.
	var old int64
	if err := pool.QueryRow(ctx, `INSERT INTO quartier_buildings (sim_id, kind, slot, lat, lng, heading, staff) VALUES ($1, 'grin', 4, $2, $3, 0, 0) RETURNING id`, awa, clat+0.0003, clng).Scan(&old); err != nil {
		t.Fatal(err)
	}
	_, q = quartierCall(t, pool, awa, http.MethodGet, "/sims/"+awa+"/quartier", "")
	var lat, lng float64
	var layout int
	_ = pool.QueryRow(ctx, `SELECT lat, lng, layout FROM quartier_buildings WHERE id = $1`, old).Scan(&lat, &lng, &layout)
	e, n := game.MetresFrom(clat, clng, lat, lng)
	e4, n4, _ := game.QuartierLotSpot(4)
	if layout != game.QuartierLotLayout || math.Abs(e-e4) > 0.5 || math.Abs(n-n4) > 0.5 {
		t.Fatalf("v1 slot 4 not on lot 4: layout %d, %.1f,%.1f vs %.1f,%.1f", layout, e, n, e4, n4)
	}
	if l := q["lots"].([]any)[4].(map[string]any); int64(l["building"].(float64)) != old {
		t.Fatalf("lot 4: %v", l)
	}
	if free := q["freeSlots"].([]any); len(free) != game.QuartierLots-1 {
		t.Fatalf("free lots: %d", len(free))
	}

	// Built where the phone snapped lot 7 to its street (25 m off its place); refused 200 m off.
	e7, n7, _ := game.QuartierLotSpot(7)
	slat, slng := game.OffsetLatLng(clat, clng, e7+20, n7-15)
	body := fmt.Sprintf(`{"kind":"boutique","slot":7,"lat":%f,"lng":%f,"heading":1.5}`, slat, slng)
	code, res := quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/quartier/build", body)
	b, _ := res["data"].(map[string]any)
	if code != 200 || b["lot"].(float64) != 7 || math.Abs(b["lat"].(float64)-slat) > 1e-6 || math.Abs(b["heading"].(float64)-1.5) > 1e-6 {
		t.Fatalf("snapped build: %d %v", code, res)
	}
	flat, flng := game.OffsetLatLng(clat, clng, e7+200, n7)
	if code, _ := quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/quartier/build", fmt.Sprintf(`{"kind":"boutique","slot":8,"lat":%f,"lng":%f}`, flat, flng)); code != 422 {
		t.Fatalf("a lot moved 200 m: %d", code)
	}
	if code, _ := quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/quartier/build", `{"kind":"boutique","slot":30}`); code != 422 {
		t.Fatalf("lot 30: %d", code)
	}

	// The area: Koffi's quartier 300 m away and his home, Ali's far off; then Koffi friends-only (no buildings),
	// then blocked (gone).
	klat, klng := game.OffsetLatLng(clat, clng, 300, 0)
	quartierCall(t, pool, koffi, http.MethodGet, "/sims/"+koffi+"/quartier", "")
	if _, err := pool.Exec(ctx, `UPDATE quartiers SET center_lat = $2, center_lng = $3 WHERE sim_id = $1`, koffi, klat, klng); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO quartier_buildings (sim_id, kind, slot, lat, lng, layout) VALUES ($1, 'maquis', 0, $2, $3, 2)`, koffi, klat, klng-0.0005); err != nil {
		t.Fatal(err)
	}
	var plot int64
	if err := pool.QueryRow(ctx, `INSERT INTO plots (sim_id, lot_commune, lot_lat, lot_lng) VALUES ($1, 'cocody', $2, $3) RETURNING id`, koffi, klat, klng).Scan(&plot); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE sims SET home_plot = $2 WHERE id = $1`, koffi, plot); err != nil {
		t.Fatal(err)
	}
	quartierCall(t, pool, ali, http.MethodGet, "/sims/"+ali+"/quartier", "")
	alat, alng := game.OffsetLatLng(clat, clng, 3000, 0)
	_, _ = pool.Exec(ctx, `UPDATE quartiers SET center_lat = $2, center_lng = $3 WHERE sim_id = $1`, ali, alat, alng)

	code, area := quartierCall(t, pool, awa, http.MethodGet, "/quartiers/"+awa+"/area", "")
	qs, _ := area["quartiers"].([]any)
	if code != 200 || len(qs) != 1 || qs[0].(map[string]any)["owner"] != koffi || len(qs[0].(map[string]any)["buildings"].([]any)) != 1 {
		t.Fatalf("area: %d %v", code, area)
	}
	if hs := area["homes"].([]any); len(hs) != 1 || hs[0].(map[string]any)["ownerName"] != "Koffi" {
		t.Fatalf("homes: %v", area["homes"])
	}
	_, _ = pool.Exec(ctx, `UPDATE quartiers SET visits_mode = 'amis' WHERE sim_id = $1`, koffi)
	_, area = quartierCall(t, pool, awa, http.MethodGet, "/quartiers/"+awa+"/area", "")
	if k := area["quartiers"].([]any)[0].(map[string]any); k["locked"] != true || len(k["buildings"].([]any)) != 0 {
		t.Fatalf("friends only: %v", k)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO blocks (sim, blocked) VALUES ($1, $2)`, koffi, awa); err != nil {
		t.Fatal(err)
	}
	_, area = quartierCall(t, pool, awa, http.MethodGet, "/quartiers/"+awa+"/area", "")
	if len(area["quartiers"].([]any)) != 0 || len(area["homes"].([]any)) != 0 {
		t.Fatalf("blocked: %v", area)
	}
	// A friend-only owner's area is refused to a stranger.
	_, _ = pool.Exec(ctx, `UPDATE quartiers SET visits_mode = 'amis' WHERE sim_id = $1`, awa)
	if code, _ := quartierCall(t, pool, ali, http.MethodGet, "/quartiers/"+awa+"/area", ""); code != 403 {
		t.Fatalf("a stranger at a friends-only area: %d", code)
	}

	// A v1 quartier centred on its commune's centre (no lot on the map) moves onto the home the street draws, its
	// v1 building onto its lot round it.
	_, cm, _ := world.FindCommune("abidjan", "cocody")
	if _, err := pool.Exec(ctx, `UPDATE quartiers SET center_lat = $2, center_lng = $3 WHERE sim_id = $1`, ali, cm.Lat, cm.Lng); err != nil {
		t.Fatal(err)
	}
	var v1 int64
	if err := pool.QueryRow(ctx, `INSERT INTO quartier_buildings (sim_id, kind, slot, lat, lng) VALUES ($1, 'grin', 2, $2, $3) RETURNING id`, ali, cm.Lat, cm.Lng).Scan(&v1); err != nil {
		t.Fatal(err)
	}
	_, q = quartierCall(t, pool, ali, http.MethodGet, "/sims/"+ali+"/quartier", "")
	hlat, hlng := game.StreetHome(ali, false, cm.Lat, cm.Lng)
	c = q["center"].(map[string]any)
	if math.Abs(c["lat"].(float64)-hlat) > 1e-9 || math.Abs(c["lng"].(float64)-hlng) > 1e-9 {
		t.Fatalf("v1 centre not on the home: %v vs %f,%f", c, hlat, hlng)
	}
	_ = pool.QueryRow(ctx, `SELECT lat, lng FROM quartier_buildings WHERE id = $1`, v1).Scan(&lat, &lng)
	e, n = game.MetresFrom(hlat, hlng, lat, lng)
	e2, n2, _ := game.QuartierLotSpot(2)
	if math.Abs(e-e2) > 0.5 || math.Abs(n-n2) > 0.5 {
		t.Fatalf("v1 slot 2 not on lot 2 round the home: %.1f,%.1f vs %.1f,%.1f", e, n, e2, n2)
	}
}
