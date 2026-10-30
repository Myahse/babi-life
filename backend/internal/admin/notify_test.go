package admin

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/db"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/push"
)

func TestPushLimit(t *testing.T) {
	if overLimit(PushPerDay-1, false) != nil || overLimit(PushPerDay, false) == nil {
		t.Errorf("campaigns: %d a day", PushPerDay)
	}
	if overLimit(PushTestsPerDay-1, true) != nil || overLimit(PushTestsPerDay, true) == nil {
		t.Errorf("tests: %d a day", PushTestsPerDay)
	}
}

func TestPushClean(t *testing.T) {
	for _, c := range []struct {
		q  pushRequest
		ok bool
	}{
		{pushRequest{Title: " Salut ", Body: "Viens jouer"}, true},
		{pushRequest{Title: "Salut", Body: "Viens", URL: "/jeu?app=gbairai", Image: "https://pub.example/a.jpg"}, true},
		{pushRequest{Title: "", Body: "Viens"}, false},
		{pushRequest{Title: "Salut", Body: "Viens", URL: "https://ailleurs.example"}, false},
		{pushRequest{Title: "Salut", Body: "Viens", URL: "//ailleurs.example"}, false},
		{pushRequest{Title: "Salut", Body: "Viens", Image: "http://pub.example/a.jpg"}, false},
		{pushRequest{Title: string(make([]rune, 66)), Body: "Viens"}, false},
	} {
		q := c.q
		if err := q.clean(); (err == nil) != c.ok {
			t.Errorf("%+v: %v", c.q, err)
		}
		if c.ok && (q.URL == "" || q.Title != "Salut") {
			t.Errorf("cleaned: %+v", q)
		}
	}
}

// « Prévenir les joueurs »: off by default, only on opening, words from the update when left empty, its app opened.
func TestFeatureNotice(t *testing.T) {
	f := features.Feature{ID: "tiki", Label: "Tikitoko", About: "Les vidéos du quartier.", Keys: []string{"app:tikitoko"}}
	if _, ok := featureNotice(f, true, nil); ok {
		t.Error("no option: no notice")
	}
	if _, ok := featureNotice(f, true, &featureNotify{Send: false, Title: "x"}); ok {
		t.Error("unticked: no notice")
	}
	if _, ok := featureNotice(f, false, &featureNotify{Send: true}); ok {
		t.Error("closed or scheduled: no notice")
	}
	q, ok := featureNotice(f, true, &featureNotify{Send: true})
	if !ok || q.Title != "Nouveau : Tikitoko" || q.Body != f.About || q.URL != "/jeu?app=tikitoko" || q.Audience != "tous" {
		t.Errorf("prefilled: %+v", q)
	}
	if q.clean() != nil {
		t.Error("a prefilled notice is valid")
	}
	q, _ = featureNotice(features.Feature{ID: "foot11", Label: "Le foot", About: "Au stade."}, true, &featureNotify{Send: true, Title: "Le foot est là", Body: "Viens jouer au stade"})
	if q.Title != "Le foot est là" || q.Body != "Viens jouer au stade" || q.URL != "/jeu" {
		t.Errorf("own words: %+v", q)
	}
}

// fakePush: every player has one phone that takes everything.
type fakePush struct {
	mu   sync.Mutex
	sent map[string][]push.Message
}

func (f *fakePush) Ways() (bool, bool) { return true, true }
func (f *fakePush) Counts(ctx context.Context) (int, int, int, error) {
	return 0, 0, 0, nil
}
func (f *fakePush) Deliver(ctx context.Context, user string, m push.Message) (int, int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent[user] = append(f.sent[user], m)
	return 1, 0
}

// notifyDB: a fresh database (TEST_DATABASE_URL, as the sims tests), or skipped.
func notifyDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	a, err := db.Connect(ctx, base)
	if err != nil {
		t.Skipf("no database: %v", err)
	}
	defer a.Close()
	name := fmt.Sprintf("babi_test_notify_%d", time.Now().UnixNano())
	if _, err := a.Exec(ctx, `CREATE DATABASE `+name); err != nil {
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

// player: an account and its Sim in a commune, last seen `ago`, with `subs` phones taking notifications.
func player(t *testing.T, pool *pgxpool.Pool, first, commune string, ago time.Duration, adult, tester bool, subs int) string {
	t.Helper()
	ctx := context.Background()
	var user string
	seen := time.Now().Add(-ago)
	var adultAt *time.Time
	if adult {
		adultAt = &seen
	}
	if err := pool.QueryRow(ctx, `INSERT INTO users (email, name, first_name, last_name, username, password_hash, last_login_at, adult_at, tester)
		VALUES ($1, $2, $2, 'Test', $3, 'x', $4, $5, $6) RETURNING id`, first+"@test.ci", first, first, seen, adultAt, tester).Scan(&user); err != nil {
		t.Fatal(err)
	}
	now := game.MinuteOf(time.Now())
	if _, err := pool.Exec(ctx, `
		INSERT INTO sims (user_id, first_name, last_name, gender, look, traits, aspiration,
		                  home_city, home_commune, city, commune, money, needs, game_minutes,
		                  origin, housing, loan, born_at, family, apps, last_tick)
		VALUES ($1, $2, 'Test', 'femme', '{}', '{}', '', 'abidjan', $3, 'abidjan', $3, 0, $4, $5, '', '', 0, $5, '', '{}', $6)`,
		user, first, commune, game.FreshNeeds(), now, seen); err != nil {
		t.Fatal(err)
	}
	for i := range subs {
		if _, err := pool.Exec(ctx, `INSERT INTO push_subs (user_id, kind, endpoint) VALUES ($1, 'fcm', $2)`, user, fmt.Sprintf("%s-%d", first, i)); err != nil {
			t.Fatal(err)
		}
	}
	return user
}

func TestPushAudiences(t *testing.T) {
	pool := notifyDB(t)
	ctx := context.Background()
	pushGap = 0
	awa := player(t, pool, "awa", "cocody", time.Hour, true, true, 2)
	koffi := player(t, pool, "koffi", "yopougon", 30*24*time.Hour, false, false, 1)
	_ = player(t, pool, "ali", "cocody", time.Hour, true, true, 0) // no notifications: never in an audience
	fake := &fakePush{sent: map[string][]push.Message{}}
	h := &Handler{DB: pool, Push: fake}

	for _, c := range []struct {
		audience, commune string
		days              int
		want              []string
	}{
		{"tous", "", 0, []string{awa, koffi}},
		{"actifs", "", 7, []string{awa}},
		{"actifs", "", 60, []string{awa, koffi}},
		{"commune", "yopougon", 0, []string{koffi}},
		{"commune", "cocody", 0, []string{awa}},
		{"adultes", "", 0, []string{awa}},
		{"testeurs", "", 0, []string{awa}},
	} {
		got, err := h.pushUsers(ctx, c.audience, c.days, c.commune)
		slices.Sort(c.want)
		if err != nil || !slices.Equal(got, c.want) {
			t.Errorf("%s %s %d: %v %v, want %v", c.audience, c.commune, c.days, got, err, c.want)
		}
	}
	for _, bad := range []struct {
		a, c string
		d    int
	}{{"actifs", "", 0}, {"actifs", "", 91}, {"commune", "nulle-part", 0}, {"amis", "", 0}} {
		if _, err := h.pushUsers(ctx, bad.a, bad.d, bad.c); err == nil {
			t.Errorf("%v: refused", bad)
		}
	}

	// A test: to one account (by its pseudo), marked as such, kept apart.
	req := pushRequest{Title: "Salut", Body: "Viens", Image: "https://pub.example/a.jpg"}
	if err := req.clean(); err != nil {
		t.Fatal(err)
	}
	req.Test = "AWA"
	if _, _, err := h.pushTest(ctx, req); err != nil {
		t.Fatal(err)
	}
	if m := fake.sent[awa]; len(m) != 1 || m[0].Title != "[Test] Salut" || m[0].Image != req.Image || m[0].URL != "/jeu" {
		t.Errorf("test: %+v", m)
	}
	req.Test = "ali"
	if _, _, err := h.pushTest(ctx, req); err == nil {
		t.Error("a test to an account without notifications is refused")
	}

	// A campaign: in the background, everyone of the audience once, followed to the end.
	req.Test, req.Audience = "", "tous"
	id, total, _, err := h.pushStart(ctx, req, "admin")
	if err != nil || total != 2 {
		t.Fatalf("start: %d %v", total, err)
	}
	var status string
	var sent, devices int
	for range 100 {
		_ = pool.QueryRow(ctx, `SELECT status, sent, devices FROM push_campaigns WHERE id = $1`, id).Scan(&status, &sent, &devices)
		if status != "running" {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if status != "done" || sent != 2 || devices != 2 || len(fake.sent[koffi]) != 1 {
		t.Errorf("campaign: %s %d %d %v", status, sent, devices, fake.sent)
	}

	// The day's limit: PushPerDay campaigns, then refused (tests don't count).
	for range PushPerDay - 1 {
		if _, err := pool.Exec(ctx, `INSERT INTO push_campaigns (title, body, audience, status) VALUES ('x', 'y', 'tous', 'done')`); err != nil {
			t.Fatal(err)
		}
	}
	if _, _, code, err := h.pushStart(ctx, req, "admin"); err == nil || code != 429 {
		t.Errorf("past the limit: %d %v", code, err)
	}
	// And an update's notice goes the same way: refused too, said to the team.
	f := features.Feature{ID: "tiki", Label: "Tikitoko", About: "Les vidéos."}
	if s := h.noticeOnOpen(ctx, f, true, &featureNotify{Send: true}); !strings.HasPrefix(s, "Notification non envoyée") {
		t.Errorf("notice past the limit: %q", s)
	}
	if s := h.noticeOnOpen(ctx, f, true, nil); s != "" {
		t.Errorf("no notice asked: %q", s)
	}
}
