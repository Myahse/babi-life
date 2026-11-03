package admin

import (
	"context"
	"net/url"
	"testing"
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
	h := &Handler{DB: pool}
	list, err := h.mailRecipients(ctx, FilterPrefix+"min=3", "")
	if err != nil || len(list) != 2 {
		t.Fatalf("audience: %v %+v", err, list)
	}
	if l := audienceLabel(FilterPrefix + "min=3&absent=2"); l != "joueurs : 3 jours ou plus, absents depuis 2 jours" {
		t.Errorf("label %q", l)
	}
}
