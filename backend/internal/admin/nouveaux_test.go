package admin

import (
	"context"
	"reflect"
	"testing"
)

// « Nouveaux joueurs »: each step from what the database holds (a Sim, its journal, its messages, the days
// it came) or what the game said (user_funnel); a later step counts the earlier; D1 and D7 only over the
// accounts old enough; the source, the platform (the first session's device), and the ones who never came back.
func TestNewPlayers(t *testing.T) {
	pool := notifyDB(t)
	ctx := context.Background()
	now := `(SELECT (extract(epoch from now()) / 60)::bigint)`
	sim := func(id, user string) string {
		return `('` + id + `', '` + user + `', 'P', 'G', 'femme', '{}', '{}', '', 'abidjan', 'cocody', 'abidjan', 'cocody', 0, '{}', ` + now + `, '', '', 0, ` + now + `, 'gnambro', '{}', now())`
	}
	const (
		a  = "00000000-0000-0000-0000-0000000000b1" // 8 days ago, by a friend's link, on the website: everything, came back at D1 and D7
		b  = "00000000-0000-0000-0000-0000000000b2" // 2 days ago, in the app: did something (no « rue » said), never came back
		c  = "00000000-0000-0000-0000-0000000000b3" // today: nothing yet
		f  = "00000000-0000-0000-0000-0000000000b4" // 3 days ago: a perso only, never came back
		o  = "00000000-0000-0000-0000-0000000000b5" // the team's account: not counted
		e  = "00000000-0000-0000-0000-0000000000b6" // 40 days ago: out of the window
		sa = "00000000-0000-0000-0000-0000000001b1"
		sb = "00000000-0000-0000-0000-0000000001b2"
		sf = "00000000-0000-0000-0000-0000000001b4"
	)
	for _, s := range []string{
		`INSERT INTO users (id, email, name, created_at, play_seconds, official) VALUES
			('` + e + `', 'e@x.ci', 'E', now() - interval '40 days', 0, false),
			('` + a + `', 'a@x.ci', 'A', now() - interval '8 days', 3000, false),
			('` + b + `', 'b@x.ci', 'B', now() - interval '2 days', 120, false),
			('` + c + `', 'c@x.ci', 'C', now(), 0, false),
			('` + f + `', 'f@x.ci', 'F', now() - interval '3 days', 60, false),
			('` + o + `', 'o@x.ci', 'O', now() - interval '1 days', 0, true)`,
		`UPDATE users SET referred_by = '` + e + `' WHERE id = '` + a + `'`,
		`INSERT INTO sessions (user_id, device, created_at) VALUES ('` + a + `', 'Linux · Chrome', now() - interval '8 days'), ('` + a + `', 'L''appli Babi Life · Android', now() - interval '1 days'),
			('` + b + `', 'L''appli Babi Life · Android', now() - interval '2 days')`,
		`INSERT INTO sims (id, user_id, first_name, last_name, gender, look, traits, aspiration, home_city, home_commune, city, commune, money, needs, game_minutes, origin, housing, loan, born_at, family, apps, last_tick) VALUES ` +
			sim(sa, a) + `, ` + sim(sb, b) + `, ` + sim(sf, f),
		`INSERT INTO user_funnel (user_id, step) VALUES ('` + a + `', 'rue'), ('` + a + `', 'bouge')`,
		`INSERT INTO grin (room, sim, body) VALUES ('babi', '` + sa + `', 'bonjour')`,
		`INSERT INTO sim_events (sim_id, kind, text, game_time) VALUES ('` + sb + `', 'interaction', 'Manger', 0), ('` + sf + `', 'random', 'Il pleut', 0)`,
		`DELETE FROM user_days`,
		`INSERT INTO user_days VALUES ('` + a + `', current_date - 8), ('` + a + `', current_date - 7), ('` + a + `', current_date - 1),
			('` + b + `', current_date - 2), ('` + f + `', current_date - 3), ('` + c + `', current_date)`,
		`INSERT INTO user_last_screen (user_id, screen) VALUES ('` + b + `', 'tel:gbairai')`,
	} {
		if _, err := pool.Exec(ctx, s); err != nil {
			t.Fatal(err)
		}
	}
	out, err := newPlayersStats(ctx, pool, 14, "", "")
	if err != nil {
		t.Fatal(err)
	}
	want := NewPlayersRow{Signups: 4, Sim: 3, Street: 2, Moved: 2, Message: 1, D1Base: 3, D1: 1, D7Base: 1, D7: 1}
	if out.Total != want {
		t.Errorf("total %+v, want %+v", out.Total, want)
	}
	if len(out.Cohorts) != 4 || out.Cohorts[3].D7 != 1 || out.Cohorts[0].D1Base != 0 {
		t.Errorf("cohorts %+v", out.Cohorts)
	}
	if !reflect.DeepEqual(out.Platforms, map[string]int{"web": 1, "app": 1, "inconnu": 2}) || !reflect.DeepEqual(out.Sources, map[string]int{"parrainage": 1, "direct": 3}) {
		t.Errorf("split %v %v", out.Platforms, out.Sources)
	}
	g := out.Gone
	if g.Count != 2 || g.AvgSeconds != 90 || g.MedianSeconds != 90 || !reflect.DeepEqual(g.LastStep, map[string]int{"bouge": 1, "perso": 1}) ||
		!reflect.DeepEqual(g.Screens, []ScreenCount{{"tel:gbairai", 1}}) || g.WithScreens != 1 {
		t.Errorf("gone %+v", g)
	}
	// The filters: the app's accounts, the friends' links.
	if out, err = newPlayersStats(ctx, pool, 14, "", "app"); err != nil || out.Total.Signups != 1 || out.Total.Moved != 1 || out.Total.Message != 0 || out.Gone.Count != 1 {
		t.Errorf("app: %+v %v", out.Total, err)
	}
	if out, err = newPlayersStats(ctx, pool, 14, "parrainage", ""); err != nil || out.Total.Signups != 1 || out.Total.D7 != 1 || out.Gone.Count != 0 {
		t.Errorf("parrainage: %+v %v", out.Total, err)
	}
	// 30 days: still not the one from 40 days ago.
	if out, err = newPlayersStats(ctx, pool, 30, "", ""); err != nil || out.Total.Signups != 4 {
		t.Errorf("30 days: %+v %v", out.Total, err)
	}
}
