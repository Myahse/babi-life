package account

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/db"
	"github.com/myahse/babi-life/backend/internal/game"
)

// testDB: a fresh database migrated from scratch, beside the one TEST_DATABASE_URL
// names (e.g. postgres://postgres:pg@localhost:5432/babi); without it, the test is skipped.
func testDB(t *testing.T) *pgxpool.Pool {
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
	name := fmt.Sprintf("babi_test_account_%d", time.Now().UnixNano())
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

// player: an account and its Sim.
func player(t *testing.T, pool *pgxpool.Pool, first string) (user, sim string) {
	t.Helper()
	ctx := context.Background()
	if err := pool.QueryRow(ctx, `INSERT INTO users (email, name, first_name, last_name, username, password_hash) VALUES ($1, $2, $2, 'Test', $3, 'x') RETURNING id`,
		strings.ToLower(first)+"@test.ci", first, strings.ToLower(first)).Scan(&user); err != nil {
		t.Fatal(err)
	}
	now := game.MinuteOf(time.Now())
	if err := pool.QueryRow(ctx, `
		INSERT INTO sims (user_id, first_name, last_name, gender, look, traits, aspiration,
		                  home_city, home_commune, city, commune, money, needs, game_minutes,
		                  origin, housing, loan, born_at, family, apps)
		VALUES ($1, $2, 'Test', 'femme', '{}', '{}', '', 'abidjan', 'cocody', 'abidjan', 'cocody', 0, $3, $4, '', '', 0, $4, '', '{}')
		RETURNING id`, user, first, game.FreshNeeds(), now).Scan(&sim); err != nil {
		t.Fatal(err)
	}
	return user, sim
}

func exec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
}

func count(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(), sql, args...).Scan(&n); err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
	return n
}

func TestDelete(t *testing.T) {
	pool := testDB(t)
	ctx := context.Background()
	awaU, awa := player(t, pool, "Awa")
	koffiU, koffi := player(t, pool, "Koffi")
	_, yao := player(t, pool, "Yao")
	bintouU, bintou := player(t, pool, "Bintou")

	// Awa's life, mixed with the others'.
	exec(t, pool, `INSERT INTO sessions (user_id, device) VALUES ($1, 'test')`, awaU)
	exec(t, pool, `INSERT INTO push_subs (user_id, kind, endpoint, p256dh, auth) VALUES ($1, 'fcm', 'tok-awa', '', '')`, awaU)
	exec(t, pool, `INSERT INTO messages (from_sim, to_sim, body) VALUES ($1, $2, 'salut'), ($2, $1, 'ça va ?'), ($2, $3, 'yo'), ($1, $2, '[ticket:bet:awa:abcdefghij]'), ($1, $3, 'on dit quoi'), ($1, $4, 'bintou ?')`, awa, koffi, yao, bintou)
	exec(t, pool, `INSERT INTO grin (room, sim, body) VALUES ('babi', $1, 'bonjour le grin'), ('babi', $1, '[defi:garba:80]')`, awa)
	// A second Sim of Awa's, which she wrote to: nobody left on either side, it goes.
	var awa2 string
	if err := pool.QueryRow(ctx, `INSERT INTO sims (user_id, first_name, last_name, gender, look, traits, aspiration, home_city, home_commune, city, commune, money, needs, game_minutes, origin, housing, loan, born_at, family, apps)
		SELECT user_id, 'Awa2', last_name, gender, look, traits, aspiration, home_city, home_commune, city, commune, money, needs, game_minutes, origin, housing, loan, born_at, family, apps FROM sims WHERE id = $1 RETURNING id`, awa).Scan(&awa2); err != nil {
		t.Fatal(err)
	}
	exec(t, pool, `INSERT INTO messages (from_sim, to_sim, body) VALUES ($1, $2, 'moi à moi'), ($2, $1, 'oui')`, awa, awa2)
	exec(t, pool, `INSERT INTO bonds (sim_a, sim_b, friendship) VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid), 50)`, awa, koffi)
	exec(t, pool, `INSERT INTO photos (sim, key, mime) VALUES ($1, 'photos/awa.jpg', 'image/jpeg'), ($2, 'photos/koffi.jpg', 'image/jpeg')`, awa, koffi)
	exec(t, pool, `INSERT INTO ideas (user_id, sim_id, sim_name, topic, text) VALUES ($1, $2, 'Awa', 'autre', 'une idée')`, awaU, awa)
	exec(t, pool, `INSERT INTO reports (reporter, reported, reason) VALUES ($1, $2, 'test')`, awa, koffi)
	// A purchase given, one not paid yet.
	exec(t, pool, `INSERT INTO purchases (user_id, sim_id, pack, price, djai, reference, status, credited_at) VALUES ($1, $2, 'p1', 500, 100, 'ref-1', 'completed', now())`, awaU, awa)
	exec(t, pool, `INSERT INTO purchases (user_id, sim_id, pack, price, djai, reference, status) VALUES ($1, $2, 'p1', 500, 100, 'ref-2', 'pending')`, awaU, awa)
	// Koffi brought Awa: his gift stays, without her name.
	exec(t, pool, `INSERT INTO referral_gifts (user_id, friend_id, friend_name) VALUES ($1, $2, 'Awa')`, koffiU, awaU)
	// Awa founded a party Koffi joined; she leads a crew alone.
	var party int64
	if err := pool.QueryRow(ctx, `INSERT INTO parties (name, acronym, color, slogan, leader) VALUES ('Parti', 'PT', '#000', '', $1) RETURNING id`, awa).Scan(&party); err != nil {
		t.Fatal(err)
	}
	exec(t, pool, `INSERT INTO party_members (sim_id, party_id, joined_at) VALUES ($1, $3, now() - interval '1 day'), ($2, $3, now())`, awa, koffi, party)
	var crew int64
	if err := pool.QueryRow(ctx, `INSERT INTO crews (name, tag, commune, leader) VALUES ('Gang', 'GG', 'cocody', $1) RETURNING id`, awa).Scan(&crew); err != nil {
		t.Fatal(err)
	}
	exec(t, pool, `INSERT INTO crew_members (sim_id, crew_id, role) VALUES ($1, $2, 'chef')`, awa, crew)
	// Kept by her e-mail, apart from the account.
	exec(t, pool, `INSERT INTO waitlist (first_name, contact, kind) VALUES ('Awa', 'awa@test.ci', 'email'), ('Yao', 'yao@test.ci', 'email')`)
	exec(t, pool, `INSERT INTO mail_optout (email) VALUES ('awa@test.ci')`)
	exec(t, pool, `INSERT INTO deletion_requests (email, username) VALUES ('awa@test.ci', 'awa')`)

	// Bintou deleted first: her chat with Awa stays with Awa, until Awa goes too.
	if _, err := Delete(ctx, pool, bintouU, "test"); err != nil {
		t.Fatal(err)
	}
	if n := count(t, pool, `SELECT count(*) FROM messages WHERE to_sim IS NULL AND from_sim = $1 AND gone IS NOT NULL`, awa); n != 1 {
		t.Fatalf("Awa's message to Bintou, kept for Awa: %d", n)
	}

	res, err := Delete(ctx, pool, awaU, "test")
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Sessions) != 1 || len(res.Files) != 1 || res.Files[0] != "photos/awa.jpg" {
		t.Fatalf("result: %+v", res)
	}
	if len(res.Changed) != 1 || res.Changed[0] != koffi {
		t.Fatalf("changed: %v, want Koffi (the party's new leader)", res.Changed)
	}

	// Nothing of Awa anywhere: no column of any table holds her account's or her Sim's id, or her e-mail (but the opt-out and the request).
	rows, err := pool.Query(ctx, `SELECT table_name, column_name, data_type FROM information_schema.columns
		WHERE table_schema = 'public' AND data_type IN ('uuid', 'text') AND table_name NOT IN ('mail_optout', 'deletion_requests')`)
	if err != nil {
		t.Fatal(err)
	}
	type col struct{ table, name, kind string }
	var cols []col
	for rows.Next() {
		var c col
		if err := rows.Scan(&c.table, &c.name, &c.kind); err != nil {
			t.Fatal(err)
		}
		cols = append(cols, c)
	}
	rows.Close()
	for _, c := range cols {
		q := fmt.Sprintf(`SELECT count(*) FROM %q WHERE %q::text IN ($1, $2, $3)`, c.table, c.name)
		if n := count(t, pool, q, awaU, awa, "awa@test.ci"); n != 0 {
			t.Errorf("%s.%s still holds Awa (%d rows)", c.table, c.name, n)
		}
		if n := count(t, pool, q, bintouU, bintou, awa2); n != 0 {
			t.Errorf("%s.%s still holds Bintou or Awa's second Sim (%d rows)", c.table, c.name, n)
		}
	}

	// What stays, anonymised.
	if n := count(t, pool, `SELECT count(*) FROM purchases WHERE user_id IS NULL AND sim_id IS NULL`); n != 2 {
		t.Errorf("purchases kept anonymised: %d, want 2", n)
	}
	var status string
	_ = pool.QueryRow(ctx, `SELECT status FROM purchases WHERE reference = 'ref-2'`).Scan(&status)
	if status != "account-deleted" {
		t.Errorf("the purchase not paid: %q, want account-deleted", status)
	}
	var friend string
	_ = pool.QueryRow(ctx, `SELECT friend_name FROM referral_gifts WHERE user_id = $1`, koffiU).Scan(&friend)
	if friend != Deleted {
		t.Errorf("Koffi's gift: %q, want %q", friend, Deleted)
	}
	if n := count(t, pool, `SELECT count(*) FROM parties WHERE id = $1 AND leader = $2`, party, koffi); n != 1 {
		t.Error("the party should go on, led by Koffi")
	}
	if n := count(t, pool, `SELECT count(*) FROM crews WHERE id = $1`, crew); n != 0 {
		t.Error("a crew with nobody left goes")
	}
	if n := count(t, pool, `SELECT count(*) FROM deletion_requests WHERE status = 'done'`); n != 1 {
		t.Error("the request for this account should be done")
	}
	if n := count(t, pool, `SELECT count(*) FROM mail_optout`); n != 1 {
		t.Error("the opt-out stays")
	}
	if n := count(t, pool, `SELECT count(*) FROM admin_log WHERE action = 'Compte supprimé'`); n != 2 { // Bintou's, Awa's
		t.Error("the team's log should say it")
	}

	// The others are untouched.
	if n := count(t, pool, `SELECT count(*) FROM sims WHERE id IN ($1, $2)`, koffi, yao); n != 2 {
		t.Error("the other Sims should stay")
	}
	// Her chats stay with Koffi and Yao, her side signed by nobody, each its own new id; the ticket she sent, withdrawn.
	if n := count(t, pool, `SELECT count(*) FROM messages`); n != 5 {
		t.Errorf("messages left: %d, want 5 (Koffi's to Yao, Awa's chats with them)", n)
	}
	if n := count(t, pool, `SELECT count(*) FROM messages WHERE (from_sim IS NULL AND to_sim = $1) OR (to_sim IS NULL AND from_sim = $1)`, koffi); n != 3 {
		t.Errorf("Koffi's chat with Awa: %d messages, want 3", n)
	}
	if n := count(t, pool, `SELECT count(DISTINCT gone) FROM messages WHERE gone IS NOT NULL`); n != 2 {
		t.Errorf("chats with Awa: %d ids, want 2 (Koffi's, Yao's)", n)
	}
	if n := count(t, pool, `SELECT count(*) FROM messages WHERE (from_sim IS NULL OR to_sim IS NULL) AND gone IS NULL`); n != 0 {
		t.Errorf("%d messages of a deleted Sim without their chat's id", n)
	}
	if n := count(t, pool, `SELECT count(*) FROM messages WHERE from_sim IS NULL AND body = '[retire]'`); n != 1 {
		t.Error("the ticket Awa sent should be withdrawn")
	}
	if n := count(t, pool, `SELECT count(*) FROM grin WHERE sim IS NULL`); n != 2 {
		t.Errorf("Awa's messages in the grin: %d, want 2 kept", n)
	}
	if n := count(t, pool, `SELECT count(*) FROM grin WHERE body = '[retire]'`); n != 1 {
		t.Error("the défi Awa shared in the grin should be withdrawn")
	}
	if n := count(t, pool, `SELECT count(*) FROM photos WHERE sim = $1`, koffi); n != 1 {
		t.Error("Koffi's photo should stay")
	}
	if n := count(t, pool, `SELECT count(*) FROM waitlist WHERE contact = 'yao@test.ci'`); n != 1 {
		t.Error("Yao's wish-list entry should stay")
	}

	// Twice: nothing more.
	if _, err := Delete(ctx, pool, awaU, "test"); err != ErrNoUser {
		t.Errorf("again: %v, want ErrNoUser", err)
	}
}

func TestRequests(t *testing.T) {
	pool := testDB(t)
	h := &Requests{DB: pool}
	ask := func(body, ip string) int {
		r := httptest.NewRequest(http.MethodPost, "/account/deletion-request", strings.NewReader(body))
		r.Header.Set("X-Forwarded-For", ip)
		w := httptest.NewRecorder()
		h.Ask(w, r)
		return w.Code
	}
	if c := ask(`{"email":"pas-un-mail","username":"x"}`, "10.0.0.1"); c != http.StatusUnprocessableEntity {
		t.Errorf("bad e-mail: %d", c)
	}
	if c := ask(`{"email":"Awa@Test.ci","username":"awa"}`, "10.0.0.1"); c != http.StatusOK {
		t.Errorf("request: %d", c)
	}
	// The same again while it waits: one request.
	if c := ask(`{"email":"awa@test.ci","username":"AWA"}`, "10.0.0.1"); c != http.StatusOK {
		t.Errorf("again: %d", c)
	}
	// A bot (the hidden field): told ok, nothing kept.
	if c := ask(`{"email":"bot@test.ci","website":"http://spam"}`, "10.0.0.1"); c != http.StatusOK {
		t.Errorf("bot: %d", c)
	}
	if n := count(t, pool, `SELECT count(*) FROM deletion_requests`); n != 1 {
		t.Errorf("requests kept: %d, want 1", n)
	}
	// Past 5 an hour from one network: refused.
	ask(`{"email":"b@test.ci"}`, "10.0.0.1")
	if c := ask(`{"email":"c@test.ci"}`, "10.0.0.1"); c != http.StatusTooManyRequests {
		t.Errorf("6th from one network: %d, want 429", c)
	}
	if c := ask(`{"email":"c@test.ci"}`, "10.0.0.2"); c != http.StatusOK {
		t.Errorf("another network: %d", c)
	}
}
