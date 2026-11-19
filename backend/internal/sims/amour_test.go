package sims

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// amourAdult: the Sim grown up (25) and its account 18 or over.
func amourAdult(t *testing.T, pool *pgxpool.Pool, sim string) {
	t.Helper()
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `UPDATE sims SET born_at = born_at - $2, money = 100000 WHERE id = $1`, sim, game.MinutesToAge(25)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE users SET adult_at = now() WHERE id = (SELECT user_id FROM sims WHERE id = $1)`, sim); err != nil {
		t.Fatal(err)
	}
}

// amourFriends: the Sim's friends met in the game, as saved.
func amourFriends(t *testing.T, pool *pgxpool.Pool, sim string) []game.Friend {
	t.Helper()
	var raw []byte
	if err := pool.QueryRow(context.Background(), `SELECT friends FROM sims WHERE id = $1`, sim).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	var out []game.Friend
	_ = json.Unmarshal(raw, &out)
	return out
}

// Against a database (TEST_DATABASE_URL): shut, every route and the dates are refused; open, a partner
// met in the game says « Bonjour mon cœur » once a day, the love's fading is read and never written, the
// mots doux are paced, the date is scored by the server and ends there; a minor account is refused.
func TestAmourPNJ(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	old := features.Default
	features.Default = &features.Store{DB: pool}
	t.Cleanup(func() { features.Default = old })

	awa := replySim(t, pool, "Awa")
	amourAdult(t, pool, awa)
	// Yao, met in the game, together with Awa: last tended ten days ago, his romance gauge at 80.
	tended := time.Now().Add(-10 * 24 * time.Hour).Unix()
	yao := game.Friend{ID: "p-yao1", Name: "Yao", Gender: "homme", Seed: 7, Commune: "cocody", Friendship: 70, Adult: true, Partner: true, Home: true, Romance: 80, Stage: game.LoveEnsemble, LoveSince: tended - 86400, LoveTended: tended, AnnivSeen: 1}
	raw, _ := json.Marshal([]game.Friend{yao})
	if _, err := pool.Exec(ctx, `UPDATE sims SET friends = $2 WHERE id = $1`, awa, raw); err != nil {
		t.Fatal(err)
	}
	base := "/sims/" + awa + "/amour"

	// Shut: nothing.
	if err := features.Default.Set(ctx, game.AmourKey, false, nil); err != nil {
		t.Fatal(err)
	}
	if code, _ := quartierCall(t, pool, awa, http.MethodGet, base, ""); code != http.StatusForbidden {
		t.Fatalf("shut: %d", code)
	}
	if code, _ := quartierCall(t, pool, awa, http.MethodPost, base+"/mot", `{"id":"pense"}`); code != http.StatusForbidden {
		t.Fatalf("shut mot: %d", code)
	}
	if code, res := quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/outing", `{"placeId":"x","interactionId":"rdv-maquis","friends":["p-yao1"],"players":[]}`); code == 200 {
		t.Fatalf("shut date: %v", res)
	}
	if features.Default.Blocks(ctx, "rdv-lagune") != game.AmourKey || features.Default.BlocksKey(ctx, game.CoeurKey) != game.AmourKey {
		t.Fatal("rdv-* and the app not behind the update")
	}

	if err := features.Default.Set(ctx, game.AmourKey, true, nil); err != nil {
		t.Fatal(err)
	}
	code, res := quartierCall(t, pool, awa, http.MethodGet, base, "")
	v, _ := res["data"].(map[string]any)
	if code != 200 || v == nil {
		t.Fatalf("open: %d %v", code, res)
	}
	p, _ := v["partner"].(map[string]any)
	if p == nil || p["kind"] != "pnj" || p["name"] != "Yao" || p["lang"] == "" {
		t.Fatalf("partner: %v", v["partner"])
	}
	// Ten days untended: 80 less 3 a day past the three days' grace, read, not written.
	if love := int(p["love"].(float64)); love != 80-7*game.LoveFade {
		t.Fatalf("love read: %d", love)
	}
	if v["hello"] == nil || v["hello"] == "" {
		t.Fatal("no bonjour the first time today")
	}
	for range 10 {
		_, res = quartierCall(t, pool, awa, http.MethodGet, base, "")
	}
	if h := res["data"].(map[string]any)["hello"]; h != nil && h != "" {
		t.Fatalf("bonjour again: %v", h)
	}
	var hellos int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM partner_messages WHERE sim_id = $1 AND NOT mine`, awa).Scan(&hellos)
	if hellos != 1 {
		t.Fatalf("bonjours written: %d", hellos)
	}
	if f := amourFriends(t, pool, awa); len(f) != 1 || f[0].Romance != 80 || f[0].LoveTended != tended {
		t.Fatalf("the fading written: %+v", f)
	}

	// A mot doux: Yao answers, the love tended; six a day, not seven.
	code, res = quartierCall(t, pool, awa, http.MethodPost, base+"/mot", `{"id":"pense"}`)
	if code != 200 || !strings.Contains(res["outcome"].(map[string]any)["text"].(string), "Yao") {
		t.Fatalf("mot: %d %v", code, res)
	}
	if f := amourFriends(t, pool, awa); f[0].LoveTended <= tended {
		t.Fatal("not tended by a mot doux")
	}
	if code, _ := quartierCall(t, pool, awa, http.MethodPost, base+"/mot", `{"id":"n-importe-quoi"}`); code != 422 {
		t.Fatalf("unknown mot: %d", code)
	}
	for i := 1; i < game.MotsPerDay; i++ {
		if code, res := quartierCall(t, pool, awa, http.MethodPost, base+"/mot", `{"id":"manque"}`); code != 200 {
			t.Fatalf("mot %d: %d %v", i, code, res)
		}
	}
	if code, _ := quartierCall(t, pool, awa, http.MethodPost, base+"/mot", `{"id":"manque"}`); code != 422 {
		t.Fatalf("a seventh mot: %d", code)
	}

	// A date: never alone; with Yao, the answers scored by the server.
	if code, _ := quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/interact", `{"placeId":"x","interactionId":"rdv-maquis"}`); code != 422 {
		t.Fatalf("a date alone: %d", code)
	}
	now := game.MinuteOf(time.Now())
	act, _ := json.Marshal(game.Activity{Kind: "do", PlaceID: "x", PlaceKind: "maquis", PlaceName: "Maquis Test", Interaction: game.Interaction{ID: "rdv-maquis", Label: "Dîner en amoureux", Minutes: 60, Effect: game.Needs{Hunger: 50}}, Start: now, End: now + 60, With: []string{"p-yao1"}})
	if _, err := pool.Exec(ctx, `UPDATE sims SET activity = $2, game_minutes = $3 WHERE id = $1`, awa, act, now); err != nil {
		t.Fatal(err)
	}
	before := amourFriends(t, pool, awa)[0].Romance
	if code, _ := quartierCall(t, pool, awa, http.MethodPost, base+"/rdv", `{"choices":["mot","mot"]}`); code != 422 {
		t.Fatalf("two answers: %d", code)
	}
	code, res = quartierCall(t, pool, awa, http.MethodPost, base+"/rdv", `{"choices":["blague","ecouter","mot","mot"]}`)
	sc, _ := res["data"].(map[string]any)
	if code != 200 || sc == nil || sc["score"].(float64) != 100 || sc["love"].(float64) != 12 {
		t.Fatalf("date: %d %v", code, res)
	}
	if res["sim"].(map[string]any)["activity"] != nil {
		t.Fatal("the date not over")
	}
	f := amourFriends(t, pool, awa)[0]
	if f.Romance <= before {
		t.Fatalf("love after the date: %d (before %d)", f.Romance, before)
	}
	if code, _ := quartierCall(t, pool, awa, http.MethodPost, base+"/rdv", `{"choices":["blague","ecouter","mot","mot"]}`); code != 422 {
		t.Fatalf("scored twice: %d", code)
	}
	_, res = quartierCall(t, pool, awa, http.MethodGet, base, "")
	if d := res["data"].(map[string]any)["dates"].([]any); len(d) != 1 || d[0].(map[string]any)["title"] != "Notre soirée au maquis" {
		t.Fatalf("dates: %v", d)
	}

	// A câlin at home with Yao living there; not twice within the hour.
	if code, res := quartierCall(t, pool, awa, http.MethodPost, base+"/calin", `{}`); code != 200 {
		t.Fatalf("câlin: %d %v", code, res)
	}
	if code, _ := quartierCall(t, pool, awa, http.MethodPost, base+"/calin", `{}`); code != 422 {
		t.Fatalf("câlin again: %d", code)
	}

	// A minor account: refused.
	kid := replySim(t, pool, "Petit")
	if code, _ := quartierCall(t, pool, kid, http.MethodGet, "/sims/"+kid+"/amour", ""); code != 422 {
		t.Fatalf("a minor: %d", code)
	}
}

// Against a database: two players together: « Mon cœur » shows the player, a mot doux reaches Gbairai as
// a card (never typed), and a block ends the couple and drops the requests (with the update open).
func TestAmourPlayers(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	old := features.Default
	features.Default = &features.Store{DB: pool}
	t.Cleanup(func() { features.Default = old })
	if err := features.Default.Set(ctx, game.AmourKey, true, nil); err != nil {
		t.Fatal(err)
	}
	awa, koffi := replySim(t, pool, "Awa"), replySim(t, pool, "Koffi")
	amourAdult(t, pool, awa)
	amourAdult(t, pool, koffi)
	x, y := pair(awa, koffi)
	if _, err := pool.Exec(ctx, `INSERT INTO bonds (sim_a, sim_b, friendship, friends, couple, romance, love_stage, love_since, love_tended) VALUES ($1, $2, 80, true, true, 75, 'ensemble', now() - interval '8 days', now())`, x, y); err != nil {
		t.Fatal(err)
	}
	_, res := quartierCall(t, pool, awa, http.MethodGet, "/sims/"+awa+"/amour", "")
	v := res["data"].(map[string]any)
	p := v["partner"].(map[string]any)
	if p["kind"] != "joueur" || p["name"] != "Koffi" || p["days"].(float64) != 9 {
		t.Fatalf("player partner: %v", p)
	}
	// Eight days together: the week's anniversary said once.
	var seen int
	_ = pool.QueryRow(ctx, `SELECT anniv_seen FROM bonds WHERE sim_a = $1 AND sim_b = $2`, x, y).Scan(&seen)
	if seen != 1 || v["next"].(map[string]any)["label"] != "1 mois ensemble" {
		t.Fatalf("anniversary: %d %v", seen, v["next"])
	}
	if code, res := quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/amour/mot", `{"id":"bebe"}`); code != 200 {
		t.Fatalf("mot to a player: %d %v", code, res)
	}
	var body string
	_ = pool.QueryRow(ctx, `SELECT body FROM messages WHERE from_sim = $1 AND to_sim = $2`, awa, koffi).Scan(&body)
	if body != "[amour:bebe]" {
		t.Fatalf("the card: %q", body)
	}
	if _, err := pool.Exec(ctx, `UPDATE sims SET apps = '{gbairai}', born_at = born_at WHERE id IN ($1, $2)`, awa, koffi); err != nil {
		t.Fatal(err)
	}
	if code, _ := quartierCall(t, pool, koffi, http.MethodPost, "/sims/"+koffi+"/gbairai/"+awa, `{"body":"[amour:bebe]"}`); code == 200 {
		t.Fatal("a card typed by hand")
	}
	// A date with a player: soon.
	if code, _ := quartierCall(t, pool, awa, http.MethodPost, "/sims/"+awa+"/outing", `{"placeId":"x","interactionId":"rdv-glace","friends":[],"players":["`+koffi+`"]}`); code != 422 {
		t.Fatalf("a date between players: %d", code)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO love_requests (from_sim, to_sim, kind) VALUES ($1, $2, 'officiel')`, koffi, awa); err != nil {
		t.Fatal(err)
	}
	// Koffi blocks Awa: the couple ends, the request goes.
	if code, res := quartierCall(t, pool, koffi, http.MethodPost, "/sims/"+koffi+"/gbairai/"+awa+"/block", `{"blocked":true}`); code != 200 {
		t.Fatalf("block: %d %v", code, res)
	}
	var couple bool
	var stage string
	var reqs int
	_ = pool.QueryRow(ctx, `SELECT couple, love_stage FROM bonds WHERE sim_a = $1 AND sim_b = $2`, x, y).Scan(&couple, &stage)
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM love_requests`).Scan(&reqs)
	if couple || stage != "" || reqs != 0 {
		t.Fatalf("after the block: couple %v stage %q requests %d", couple, stage, reqs)
	}
}
