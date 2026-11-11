package admin

import (
	"context"
	"fmt"
	"net/url"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The players' filter: anything off refused; against a database, came back on a day (not the sign-up
// day), on how many days, absent since; the same filter as an e-mail audience.
func TestPlayerFilter(t *testing.T) {
	for _, bad := range []string{"segment=x", "day=hier", "min=-1", "max=abc"} {
		v, _ := url.ParseQuery(bad)
		if _, err := parseFilter(v); err == nil {
			t.Errorf("%s taken", bad)
		}
	}
	pool := notifyDB(t)
	ctx := context.Background()
	// Awa: signed up 10 days ago, came back 9 and 3 days ago (3 days); Koffi: only the day he signed up
	// 5 days ago (1 day); Yao: signed up 3 days ago, came back 2 days ago and today (3 days).
	for _, s := range []string{
		`INSERT INTO users (id, email, name, created_at) VALUES ('00000000-0000-0000-0000-00000000000a', 'awa@x.ci', 'Awa', now() - interval '10 days'), ('00000000-0000-0000-0000-00000000000b', 'koffi@x.ci', 'Koffi', now() - interval '5 days'), ('00000000-0000-0000-0000-00000000000c', 'yao@x.ci', 'Yao', now() - interval '3 days')`,
		`DELETE FROM user_days`,
		`INSERT INTO user_days VALUES ('00000000-0000-0000-0000-00000000000a', current_date - 10), ('00000000-0000-0000-0000-00000000000a', current_date - 9), ('00000000-0000-0000-0000-00000000000a', current_date - 3),
			('00000000-0000-0000-0000-00000000000b', current_date - 5), ('00000000-0000-0000-0000-00000000000c', current_date - 3), ('00000000-0000-0000-0000-00000000000c', current_date - 2), ('00000000-0000-0000-0000-00000000000c', current_date)`,
	} {
		if _, err := pool.Exec(ctx, s); err != nil {
			t.Fatal(err)
		}
	}
	var day string
	_ = pool.QueryRow(ctx, `SELECT to_char(current_date - 3, 'YYYY-MM-DD')`).Scan(&day)
	count := func(q string) int {
		t.Helper()
		v, _ := url.ParseQuery(q)
		f, err := parseFilter(v)
		if err != nil {
			t.Fatal(err)
		}
		var n int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM users u WHERE u.email LIKE '%@x.ci' AND `+f.sql()).Scan(&n); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
		return n
	}
	for q, want := range map[string]int{
		"":                      3,
		"day=" + day:            1, // Awa came back that day; Yao signed up that day: not « came back »
		"min=3":                 2,
		"max=1":                 1,
		"min=2&max=3&absent=2":  1, // Awa, not seen for 3 days
		"segment=jamais":        1,
		"segment=revenus&min=3": 2,
		"day=" + day + "&min=3": 1,
	} {
		if got := count(q); got != want {
			t.Errorf("%q: %d, want %d", q, got, want)
		}
	}
	// On the first perso: Awa, 1 000 Djai, an adult in Cocody, family poignon, 30 h played, online; Koffi,
	// 50 000 Djai, a child of 5 in Yopougon, 2 h played; Yao: no perso yet.
	now := `(SELECT (extract(epoch from now()) / 60)::bigint)`
	for _, q := range []string{
		`UPDATE users SET play_seconds = 30 * 3600 WHERE email = 'awa@x.ci'`,
		`UPDATE users SET play_seconds = 2 * 3600 WHERE email = 'koffi@x.ci'`,
		`INSERT INTO sims (user_id, first_name, last_name, gender, look, traits, aspiration, home_city, home_commune, city, commune, money, needs, game_minutes, origin, housing, loan, born_at, family, apps, last_tick)
			VALUES ('00000000-0000-0000-0000-00000000000a', 'Awa', 'K', 'femme', '{}', '{}', '', 'abidjan', 'cocody', 'abidjan', 'cocody', 1000, '{}', ` + now + `, '', '', 0, 0, 'poignon', '{}', now()),
			('00000000-0000-0000-0000-00000000000b', 'Koffi', 'K', 'homme', '{}', '{}', '', 'abidjan', 'yopougon', 'abidjan', 'yopougon', 50000, '{}', ` + now + `, '', '', 0, ` + now + ` - ` + fmt.Sprint(game.MinutesToAge(5.5)) + `, 'gnambro', '{}', now() - interval '1 day')`,
	} {
		if _, err := pool.Exec(ctx, q); err != nil {
			t.Fatal(err)
		}
	}
	for q, want := range map[string]int{
		"hmin=10":               1,
		"hmax=5":                2, // Koffi, and Yao (0 h)
		"mmin=10000":            1,
		"mmax=5000":             1,
		"amin=18":               1,
		"amin=4&amax=6":         1,
		"stage=enfant":          1,
		"stage=adulte":          1,
		"stage=bebe":            0,
		"family=poignon":        1,
		"commune=yopougon":      1,
		"online=1":              1,
		"hmin=1&mmin=10000":     1,
		"stage=adulte&mmin=999": 1,
	} {
		if got := count(q); got != want {
			t.Errorf("%q: %d, want %d", q, got, want)
		}
	}
	for _, bad := range []string{"hmin=-2", "mmin=x", "stage=vieux", "family=a'b", "commune=Cocody%27"} {
		v, _ := url.ParseQuery(bad)
		if _, err := parseFilter(v); err == nil {
			t.Errorf("%s taken", bad)
		}
	}
	if l := audienceLabel(FilterPrefix + "hmin=10&stage=adulte&online=1"); l != "joueurs : 10 h de jeu ou plus, adulte, en ligne" {
		t.Errorf("label %q", l)
	}
	h := &Handler{DB: pool}
	list, err := h.mailRecipients(ctx, FilterPrefix+"min=3", "")
	if err != nil || len(list) != 2 {
		t.Fatalf("audience: %v %+v", err, list)
	}
	if l := audienceLabel(FilterPrefix + "min=3&absent=2"); l != "joueurs : 3 jours ou plus, absents depuis 2 jours" {
		t.Errorf("label %q", l)
	}
}

// Growing a group: only the persos living that stage now, never towards a younger age.
func TestGrowGroup(t *testing.T) {
	adult := game.StageByID(game.StageAdulte)
	for _, bad := range []string{"x", "adulte"} {
		if _, _, err := growGroup(bad, adult); err == nil {
			t.Errorf("from %q taken", bad)
		}
	}
	if _, _, err := growGroup("ado", game.StageByID("enfant")); err == nil {
		t.Error("ado → enfant taken")
	}
	pool := notifyDB(t)
	ctx := context.Background()
	now := `(SELECT (extract(epoch from now()) / 60)::bigint)`
	for _, q := range []string{
		`INSERT INTO users (id, email, name) VALUES ('00000000-0000-0000-0000-0000000000e1', 'g1@g.ci', 'G1'), ('00000000-0000-0000-0000-0000000000e2', 'g2@g.ci', 'G2') ON CONFLICT DO NOTHING`,
		`INSERT INTO sims (user_id, first_name, last_name, gender, look, traits, aspiration, home_city, home_commune, city, commune, money, needs, game_minutes, origin, housing, loan, born_at, family, apps, last_tick)
			VALUES ('00000000-0000-0000-0000-0000000000e1', 'Bebe', 'G', 'femme', '{}', '{}', '', 'abidjan', 'cocody', 'abidjan', 'cocody', 0, '{}', ` + now + `, '', '', 0, ` + now + ` - ` + fmt.Sprint(game.MinutesToAge(1)) + `, 'gnambro', '{}', now()),
			('00000000-0000-0000-0000-0000000000e2', 'Enfant', 'G', 'homme', '{}', '{}', '', 'abidjan', 'cocody', 'abidjan', 'cocody', 0, '{}', ` + now + `, '', '', 0, ` + now + ` - ` + fmt.Sprint(game.MinutesToAge(5)) + `, 'gnambro', '{}', now())`,
	} {
		if _, err := pool.Exec(ctx, q); err != nil {
			t.Fatal(err)
		}
	}
	where, who, err := growGroup(game.StageBebe, adult)
	if err != nil || who == "" {
		t.Fatal(err)
	}
	var names string
	if err := pool.QueryRow(ctx, `SELECT string_agg(first_name, ',') FROM sims WHERE last_name = 'G' AND `+where).Scan(&names); err != nil {
		t.Fatal(err)
	}
	if names != "Bebe" {
		t.Errorf("babies: %q, want Bebe", names)
	}
}
