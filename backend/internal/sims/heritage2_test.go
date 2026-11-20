package sims

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/feats"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// The feats as renom counts them: an office, a diploma, a marriage, a rung reached, even if gone since.
func TestHeritageFeatsIn(t *testing.T) {
	in := game.RenomIn{CareerLevel: 1}
	featsIn([]string{"mandat:depute", "mandat:maire", "diplome:bac", "mariage:", "carriere:commerce:4", "carriere:commerce:3"}, &in)
	if in.Office != "depute" || !in.Bac || in.Sup || !in.Married || in.CareerLevel != 4 {
		t.Fatalf("feats: %+v", in)
	}
	if game.Renom(in) <= game.Renom(game.RenomIn{CareerLevel: 1}) {
		t.Fatal("the feats add renom")
	}
	if !game.Distant(game.HeirFilleul) || !game.Distant(game.HeirNeveu) || game.Distant(game.HeirCouple) {
		t.Fatal("distant heirs")
	}
}

// The childhood friend's child: offered only without a child of 18, the friend at 60 or more.
func TestHeritageFilleulOffered(t *testing.T) {
	s := heirSim()
	s.Friends = append(s.Friends, game.Friend{ID: "p-ami", Name: "Kouamé", Gender: "homme", Friendship: 59, Childhood: true, Adult: true})
	hasFilleul := func() bool {
		for _, h := range s.heirOptions(1) {
			if h.Kind == game.HeirFilleul {
				return true
			}
		}
		return false
	}
	if hasFilleul() {
		t.Fatal("59: not close enough")
	}
	s.friendByID("p-ami").Friendship = 60
	if !hasFilleul() {
		t.Fatalf("60: offered: %+v", s.heirOptions(1))
	}
	s.Life.Famille.Kids = []Kid{{ID: "k1", Name: "Ama", Gender: "femme", Born: s.GameMinutes - game.HeirSpans.Childhood() - 5}}
	if hasFilleul() {
		t.Fatal("a child of 18 of one's own: no filleul")
	}
	// A child of two players taken by the other parent: not an heir here, the friend's child comes back.
	s.Life.Famille.Kids[0].Shared, s.Life.Famille.Kids[0].Took = 7, "Koffi"
	if !hasFilleul() {
		t.Fatal("the shared child taken: the filleul again")
	}
}

// heirAdults: two players, adults (the Sims and the accounts), together, money to spare.
func heirAdults(t *testing.T, pool *pgxpool.Pool) (string, string) {
	t.Helper()
	ctx := context.Background()
	awa, koffi := replySim(t, pool, "Awa"), replySim(t, pool, "Koffi")
	for _, id := range []string{awa, koffi} {
		if _, err := pool.Exec(ctx, `UPDATE sims SET born_at = game_minutes - $2, money = 500000, family = 'lagnon', last_tick = now() WHERE id = $1`, id, game.MinutesToAge(30)); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `UPDATE users SET adult_at = now() WHERE id = (SELECT user_id FROM sims WHERE id = $1)`, id); err != nil {
			t.Fatal(err)
		}
	}
	_, _ = pool.Exec(ctx, `UPDATE sims SET gender = 'homme' WHERE id = $1`, koffi)
	x, y := pair(awa, koffi)
	if _, err := pool.Exec(ctx, `INSERT INTO bonds (sim_a, sim_b, friendship, friends, couple, romance, love_stage, love_since, love_tended) VALUES ($1, $2, 80, true, true, 80, 'ensemble', now(), now())`, x, y); err != nil {
		t.Fatal(err)
	}
	return awa, koffi
}

func heirFam(t *testing.T, pool *pgxpool.Pool, id string) (*Famille, int) {
	t.Helper()
	var raw []byte
	var money int
	if err := pool.QueryRow(context.Background(), `SELECT coalesce(life->'famille', 'null'), money FROM sims WHERE id = $1`, id).Scan(&raw, &money); err != nil {
		t.Fatal(err)
	}
	var f *Famille
	_ = json.Unmarshal(raw, &f)
	return f, money
}

func heirOpen(t *testing.T, pool *pgxpool.Pool) func(bool) {
	t.Helper()
	ctx := context.Background()
	old := features.Default
	features.Default = &features.Store{DB: pool}
	t.Cleanup(func() { features.Default = old })
	return func(on bool) {
		if err := features.Default.Set(ctx, game.HeritageKey, on, nil); err != nil {
			t.Fatal(err)
		}
	}
}

// Against a database: a child of two players. Shut, nothing; a baby only for an official couple and with
// the yes of both; the child in both families; two passations at once to it: exactly one takes it, the
// other is refused and told, no money crosses; the couple broken asks for no more babies.
func TestHeritageCoupleKidDB(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	open := heirOpen(t, pool)
	awa, koffi := heirAdults(t, pool)
	couple := func(sim, kind, action string) (int, map[string]any) {
		return quartierCall(t, pool, sim, http.MethodPost, "/sims/"+sim+"/heritage/couple", fmt.Sprintf(`{"kind":%q,"action":%q}`, kind, action))
	}
	kids := func() int {
		var n int
		_ = pool.QueryRow(ctx, `SELECT count(*) FROM couple_kids`).Scan(&n)
		return n
	}

	// Shut: refused, nothing written.
	if code, _ := couple(awa, "officiel", "demander"); code != 422 {
		t.Fatalf("shut: %d", code)
	}
	var reqs int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM love_requests`).Scan(&reqs)
	if f, _ := heirFam(t, pool, awa); reqs != 0 || kids() != 0 || f != nil {
		t.Fatalf("shut, something changed: %d requests %d kids %+v", reqs, kids(), f)
	}

	open(true)
	if code, out := couple(awa, "bebe", "demander"); code != 422 || out["error"] != errCoupleOfficiel.Error() {
		t.Fatalf("not official: %d %v", code, out)
	}
	if code, out := couple(awa, "officiel", "demander"); code != 200 {
		t.Fatalf("ask officiel: %d %v", code, out)
	}
	if code, out := couple(koffi, "officiel", "accepter"); code != 200 {
		t.Fatalf("yes officiel: %d %v", code, out)
	}
	// Consent: asked, nothing made till the other says yes; one can't say yes to one's own ask.
	if code, out := couple(awa, "bebe", "demander"); code != 200 {
		t.Fatalf("ask baby: %d %v", code, out)
	}
	if code, _ := couple(awa, "bebe", "accepter"); code != 422 || kids() != 0 {
		t.Fatalf("own ask accepted: %d, %d kids", code, kids())
	}
	if code, _ := couple(koffi, "bebe", "refuser"); code != 200 || kids() != 0 {
		t.Fatalf("refused: %d %d", code, kids())
	}
	if code, _ := couple(koffi, "bebe", "accepter"); code != 422 {
		t.Fatalf("no ask left: %d", code)
	}
	couple(awa, "bebe", "demander")
	if code, out := couple(koffi, "bebe", "accepter"); code != 200 || kids() != 1 {
		t.Fatalf("yes baby: %d %v, %d kids", code, out, kids())
	}
	// The asker told (after the save).
	var told int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM sim_events WHERE sim_id = $1 AND text LIKE '%Un bébé est en route%'`, awa).Scan(&told)
	if told != 1 {
		t.Fatalf("Awa told %d times", told)
	}
	fk, _ := heirFam(t, pool, koffi)
	if fk == nil || fk.Expecting == nil || fk.Expecting.Shared == 0 || fk.Expecting.Kid == nil {
		t.Fatalf("on its way at Koffi's: %+v", fk)
	}
	// Awa's next turn: on its way there too, the same child.
	quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/heritage/ancien/x/sync", "{}")
	fa, _ := heirFam(t, pool, awa)
	if fa == nil || fa.Expecting == nil || fa.Expecting.Shared != fk.Expecting.Shared || fa.Expecting.Kid.Name != fk.Expecting.Kid.Name {
		t.Fatalf("on its way at Awa's: %+v", fa)
	}
	if code, _ := couple(awa, "bebe", "demander"); code != 422 {
		t.Fatalf("one already on its way: %d", code)
	}
	// Born in both (each its own day), grown up, the parents 61, their generation 22 days old.
	for _, id := range []string{awa, koffi} {
		if _, err := pool.Exec(ctx, `UPDATE sims SET life = jsonb_set(life, '{famille,expecting,due}', to_jsonb(game_minutes - 1)) WHERE id = $1`, id); err != nil {
			t.Fatal(err)
		}
		quartierCall(t, pool, id, http.MethodPost, "/sims/"+id+"/heritage/ancien/x/sync", "{}")
		if _, err := pool.Exec(ctx, `UPDATE sims SET generation_since = now() - interval '22 days', life = jsonb_set(jsonb_set(life, '{famille,kids,0,born}', to_jsonb(game_minutes - $2::bigint)), '{famille,adultAt}', to_jsonb(game_minutes - $3::bigint)) WHERE id = $1`,
			id, game.HeirSpans.Childhood()+5, game.HeirSpans.LivedFor(61)); err != nil {
			t.Fatal(err)
		}
	}
	// Named by one parent: the name in both.
	quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/famille/nommer", fmt.Sprintf(`{"kid":%q,"name":"Aya"}`, fa.Expecting.Kid.ID))
	quartierCall(t, pool, koffi, http.MethodPost, "/sims/"+koffi+"/heritage/ancien/x/sync", "{}")
	fa, moneyA := heirFam(t, pool, awa)
	fk, moneyK := heirFam(t, pool, koffi)
	if len(fa.Kids) != 1 || len(fk.Kids) != 1 || fa.Kids[0].ID != fk.Kids[0].ID || fa.Kids[0].Shared == 0 || fk.Kids[0].Name != "Aya" {
		t.Fatalf("the child in both: %+v / %+v", fa.Kids, fk.Kids)
	}
	kid := fa.Kids[0].ID

	// Both hand down to it at once: exactly one takes it.
	r := chi.NewRouter()
	(&Handler{DB: pool}).Routes(r)
	users := map[string]string{}
	for _, id := range []string{awa, koffi} {
		var u string
		_ = pool.QueryRow(ctx, `SELECT user_id FROM sims WHERE id = $1`, id).Scan(&u)
		users[id] = u
	}
	codes, bodies := map[string]int{}, map[string]string{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, id := range []string{awa, koffi} {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			req := httptest.NewRequest(http.MethodPost, "/sims/"+id+"/heritage/passation", strings.NewReader(fmt.Sprintf(`{"heir":%q,"look":{},"gen":1}`, kid)))
			req = req.WithContext(auth.WithUserID(req.Context(), users[id]))
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			mu.Lock()
			codes[id], bodies[id] = w.Code, w.Body.String()
			mu.Unlock()
		}(id)
	}
	wg.Wait()
	winner, loser := awa, koffi
	if codes[koffi] == 200 {
		winner, loser = koffi, awa
	}
	if codes[winner] != 200 || codes[loser] != 422 || !strings.Contains(bodies[loser], errSharedTaken.Error()) {
		t.Fatalf("exactly one wins: %v %v", codes, bodies[loser])
	}
	var taken string
	_ = pool.QueryRow(ctx, `SELECT taken_by::text FROM couple_kids`).Scan(&taken)
	if taken != winner {
		t.Fatalf("taken by %s, want %s", taken, winner)
	}
	// No money crossed: the winner's is the heir's share of its own estate, the loser's untouched.
	_, mw := heirFam(t, pool, winner)
	_, ml := heirFam(t, pool, loser)
	before := map[string]int{awa: moneyA, koffi: moneyK}
	heir, _, _ := game.Split(before[winner], game.HeirShare)
	if mw != heir || ml != before[loser] {
		t.Fatalf("money: winner %d (want %d), loser %d (want %d)", mw, heir, ml, before[loser])
	}
	// The other parent told, and the child no heir there any more.
	quartierCall(t, pool, loser, http.MethodPost, "/sims/"+loser+"/heritage/ancien/x/sync", "{}")
	fl, _ := heirFam(t, pool, loser)
	if len(fl.Kids) != 1 || fl.Kids[0].Took == "" {
		t.Fatalf("told: %+v", fl.Kids)
	}
	var said int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM sim_events WHERE sim_id = $1 AND text LIKE '%a repris la maison de%'`, loser).Scan(&said)
	if said != 1 {
		t.Fatalf("« a repris la maison » said %d times", said)
	}
	_, st := quartierCall(t, pool, loser, http.MethodGet, "/sims/"+loser+"/heritage", "")
	for _, h := range st["heirs"].([]any) {
		if h.(map[string]any)["id"] == kid {
			t.Fatal("the child taken is still an heir")
		}
	}
	// The passation broke the couple: no more babies asked.
	if code, out := couple(loser, "bebe", "demander"); code != 422 || out["error"] != errCoupleNotYours.Error() {
		t.Fatalf("after: %d %v", code, out)
	}
}

// A block: the asks between them go, none can be made; a child on its way stays.
func TestHeritageCoupleBreakDB(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	heirOpen(t, pool)(true)
	awa, koffi := heirAdults(t, pool)
	x, y := pair(awa, koffi)
	_, _ = pool.Exec(ctx, `UPDATE bonds SET love_stage = 'officiel' WHERE sim_a = $1 AND sim_b = $2`, x, y)
	call := func(sim, kind, action string) (int, map[string]any) {
		return quartierCall(t, pool, sim, http.MethodPost, "/sims/"+sim+"/heritage/couple", fmt.Sprintf(`{"kind":%q,"action":%q}`, kind, action))
	}
	call(awa, "bebe", "demander")
	call(koffi, "bebe", "accepter")
	_, _ = pool.Exec(ctx, `INSERT INTO love_requests (from_sim, to_sim, kind) VALUES ($1, $2, 'bebe')`, koffi, awa)
	_, _ = pool.Exec(ctx, `INSERT INTO blocks (sim, blocked) VALUES ($1, $2)`, awa, koffi)
	loveEnd(ctx, pool, awa, koffi)
	var n int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM love_requests`).Scan(&n)
	if n != 0 {
		t.Fatalf("asks left after a block: %d", n)
	}
	if code, _ := call(koffi, "bebe", "demander"); code != 422 {
		t.Fatalf("asked after a block: %d", code)
	}
	quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/heritage/ancien/x/sync", "{}")
	if fa, _ := heirFam(t, pool, awa); fa == nil || fa.Expecting == nil || fa.Expecting.Shared == 0 {
		t.Fatalf("on its way: %+v", fa)
	}
}

// The childhood friend's child takes over: the family's name, 60 %, the friend its tonton at 85, the
// player friends tontons too; the feats recorded count; Babi Direct and the friends told; the elder in the grin.
func TestHeritageFilleulDB(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	open := heirOpen(t, pool)
	awa, koffi := heirAdults(t, pool)
	x, y := pair(awa, koffi)
	_, _ = pool.Exec(ctx, `UPDATE bonds SET couple = false, love_stage = '' WHERE sim_a = $1 AND sim_b = $2`, x, y)
	// Shut: a feat isn't written.
	feats.Record(ctx, pool, awa, feats.Office, "maire")
	var n int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM generation_feats`).Scan(&n)
	if n != 0 {
		t.Fatal("shut: a feat written")
	}
	open(true)
	feats.Record(ctx, pool, awa, feats.Office, "maire")
	feats.Record(ctx, pool, awa, feats.Office, "maire")
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM generation_feats`).Scan(&n)
	if n != 1 {
		t.Fatalf("one feat: %d", n)
	}
	friends, _ := json.Marshal([]game.Friend{{ID: "p-ami", Name: "Kouamé", Gender: "homme", Seed: 5, Friendship: 70, Childhood: true, Adult: true}})
	if _, err := pool.Exec(ctx, `UPDATE sims SET friends = $2, money = 100000 WHERE id = $1`, awa, friends); err != nil {
		t.Fatal(err)
	}
	quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/heritage/ancien/x/sync", "{}")
	_, _ = pool.Exec(ctx, `UPDATE sims SET generation_since = now() - interval '22 days', life = jsonb_set(life, '{famille,adultAt}', to_jsonb(game_minutes - $2::bigint)) WHERE id = $1`, awa, game.HeirSpans.LivedFor(61))
	_, st := quartierCall(t, pool, awa, http.MethodGet, "/sims/"+awa+"/heritage", "")
	var heir map[string]any
	for _, h := range st["heirs"].([]any) {
		if h.(map[string]any)["kind"] == game.HeirFilleul {
			heir = h.(map[string]any)
		}
	}
	if heir == nil || heir["parent"] != "Kouamé" {
		t.Fatalf("the friend's child offered: %v", st["heirs"])
	}
	renomPreview := int(st["preview"].(map[string]any)["renom"].(float64))
	if code, out := quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/heritage/passation", fmt.Sprintf(`{"heir":%q,"look":{},"gen":1}`, heir["id"])); code != 200 {
		t.Fatalf("passation: %d %v", code, out)
	}
	var first, last string
	var money, renom int
	var fr []byte
	_ = pool.QueryRow(ctx, `SELECT first_name, last_name, money, renom, friends FROM sims WHERE id = $1`, awa).Scan(&first, &last, &money, &renom, &fr)
	h, _, _ := game.Split(100000, game.FilleulShare)
	var list []game.Friend
	_ = json.Unmarshal(fr, &list)
	if first != heir["name"] || last != "Test" || money != h || renom != renomPreview || len(list) != 1 || !list[0].Tonton || list[0].Friendship != game.TontonBond {
		t.Fatalf("after: %s %s %d (want %d) renom %d (want %d) %+v", first, last, money, h, renom, renomPreview, list)
	}
	if renom <= game.Renom(game.RenomIn{Years: 61, Neveu: true}) {
		t.Fatalf("the feat counted: %d", renom)
	}
	var kind string
	_ = pool.QueryRow(ctx, `SELECT heir_kind FROM family_generations WHERE sim_id = $1`, awa).Scan(&kind)
	if kind != game.HeirFilleul {
		t.Fatalf("history: %q", kind)
	}
	// Koffi, a friend who is a player: the heir's tonton, told in his journal; Babi Direct too.
	ps := []Player{{ID: koffi, Gender: "homme"}}
	(&Handler{DB: pool}).tontons(ctx, awa, ps)
	if ps[0].Tonton != "tonton" {
		t.Fatalf("listed: %+v", ps[0])
	}
	var told, direct int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM sim_events WHERE sim_id = $1 AND text LIKE '%passe la main%'`, koffi).Scan(&told)
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM babi_direct WHERE key LIKE 'passation:%'`).Scan(&direct)
	if told != 1 || direct != 1 {
		t.Fatalf("told: friend %d, Babi Direct %d", told, direct)
	}
	// The elder (Awa now) speaks now and then in Cocody's grin, their face found back from the id.
	for k := 0; k < 16; k++ {
		(&Handler{DB: pool}).elderGrin(ctx, "cocody", timeAt(8).Add(time.Duration(k)*ElderGrinEvery))
	}
	var pnj, name string
	if err := pool.QueryRow(ctx, `SELECT pnj, pnj_name FROM grin WHERE pnj LIKE 'ancien-%' LIMIT 1`).Scan(&pnj, &name); err != nil || pnj != ancienPrefix+awa || name != "Awa" {
		t.Fatalf("the elder in the grin: %v %q %q", err, pnj, name)
	}
	if e, fam, ok := elderOfGrin(ctx, pool, pnj, name); !ok || fam != "Test" || e.Gender != "femme" {
		t.Fatalf("the elder's face: %+v %q %v", e, fam, ok)
	}
}

// With the update shut, a child of two players already there changes nothing, and no elder speaks.
func TestHeritageClosedSyncDB(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	heirOpen(t, pool)(false)
	awa, koffi := heirAdults(t, pool)
	if _, err := pool.Exec(ctx, `INSERT INTO couple_kids (sim_a, sim_b, kid) VALUES ($1, $2, '{"id":"c1","name":"Ama","gender":"femme","seed":3}')`, awa, koffi); err != nil {
		t.Fatal(err)
	}
	quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/famille/vu", "{}")
	if f, _ := heirFam(t, pool, awa); f != nil && (f.Expecting != nil || len(f.Kids) > 0) {
		t.Fatalf("shut: %+v", f)
	}
	(&Handler{DB: pool}).elderGrin(ctx, "cocody", timeAt(12))
	var n int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM grin`).Scan(&n)
	if n != 0 {
		t.Fatal("shut: an elder spoke")
	}
}

// timeAt: today at that hour (Abidjan: UTC).
func timeAt(h int) time.Time {
	n := time.Now().UTC()
	return time.Date(n.Year(), n.Month(), n.Day(), h, 0, 0, 0, time.UTC)
}
