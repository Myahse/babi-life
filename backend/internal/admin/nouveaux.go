package admin

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The admin's « Nouveaux joueurs »: where new players drop off, day by day of sign-up. Each step from
// what the database already holds where it can, else from what the game says (auth/funnel.go, migration 125):
//   - compte: the account (users.created_at, a UTC day like user_days);
//   - perso: a Sim made (sims);
//   - rue: in the 3D street (the game's « rue », or the tutorial seen, which only shows there);
//   - bouge: the Sim walked in it (the game's « bouge ») or did something (an interaction in its journal,
//     the tutorial's first activity);
//   - message: a first message written anywhere (Gbairai to a player, the Grin rooms, papa or maman);
//   - d1, d7: came back the day after, the seventh day (user_days, as the retention).
// What a later step can't happen without counts the earlier too (the Sim moved: it was in the street, it
// had a perso), so the bars only go down, and the steps from before the update are not all missing.
// The source is a friend's link (users.referred_by) or not; the platform, the first session's device
// (auth/sessions.go DeviceName: « L'appli Babi Life » is the Android app's WebView, else the website).

// NewPlayersRow: one sign-up day's accounts (or all of them, the total), and how many passed each step.
// D1Base, D7Base: of those, the ones old enough to have had the day after, the seventh.
type NewPlayersRow struct {
	Day     string `json:"day,omitempty"`
	Signups int    `json:"signups"`
	Sim     int    `json:"sim"`
	Street  int    `json:"street"`
	Moved   int    `json:"moved"`
	Message int    `json:"message"`
	D1Base  int    `json:"d1Base"`
	D1      int    `json:"d1"`
	D7Base  int    `json:"d7Base"`
	D7      int    `json:"d7"`
}

// NewPlayersGone: the accounts that never came back after their first day (made a day ago at least).
type NewPlayersGone struct {
	Count int `json:"count"`
	// Their time in the game (users.play_seconds), on average and the middle one.
	AvgSeconds    int `json:"avgSeconds"`
	MedianSeconds int `json:"medianSeconds"`
	// The furthest step each reached (compte, perso, rue, bouge, message), and the last screen seen
	// (migration 125; only the accounts made since it): the most seen first.
	LastStep    map[string]int `json:"lastStep"`
	Screens     []ScreenCount  `json:"screens"`
	WithScreens int            `json:"withScreens"`
}

type ScreenCount struct {
	Screen string `json:"screen"`
	N      int    `json:"n"`
}

type NewPlayers struct {
	Days     int             `json:"days"`
	Source   string          `json:"source"`
	Platform string          `json:"platform"`
	Total    NewPlayersRow   `json:"total"`
	Cohorts  []NewPlayersRow `json:"cohorts"`
	// The window's accounts by platform (web, app, inconnu) and source (parrainage, direct), whatever the filters.
	Platforms map[string]int `json:"platforms"`
	Sources   map[string]int `json:"sources"`
	Gone      NewPlayersGone `json:"gone"`
}

// newPlayersCTE: each account of the window ($1 days, today's included) with its source and platform,
// filtered ($2 source, $3 platform, "" for all), and the steps it passed (f).
const newPlayersCTE = `
	WITH n AS (
		SELECT u.id, (u.created_at AT TIME ZONE 'UTC')::date AS d0, u.play_seconds,
			CASE WHEN u.referred_by IS NOT NULL THEN 'parrainage' ELSE 'direct' END AS source,
			COALESCE((SELECT CASE WHEN s.device LIKE 'L''appli%' THEN 'app' ELSE 'web' END FROM sessions s WHERE s.user_id = u.id ORDER BY s.created_at LIMIT 1), 'inconnu') AS platform
		FROM users u
		WHERE NOT u.official AND (u.created_at AT TIME ZONE 'UTC')::date > current_date - $1::int
	), p AS (
		SELECT n.*,
			EXISTS (SELECT 1 FROM sims s WHERE s.user_id = n.id) AS sim,
			EXISTS (SELECT 1 FROM user_funnel x WHERE x.user_id = n.id AND x.step IN ('rue', 'tuto_start')) AS rue,
			EXISTS (SELECT 1 FROM user_funnel x WHERE x.user_id = n.id AND x.step IN ('bouge', 'first_activity'))
				OR EXISTS (SELECT 1 FROM sims s JOIN sim_events e ON e.sim_id = s.id WHERE s.user_id = n.id AND e.kind = 'interaction') AS bouge,
			EXISTS (SELECT 1 FROM sims s JOIN messages m ON m.from_sim = s.id WHERE s.user_id = n.id)
				OR EXISTS (SELECT 1 FROM sims s JOIN grin g ON g.sim = s.id WHERE s.user_id = n.id)
				OR EXISTS (SELECT 1 FROM sims s JOIN parent_messages pm ON pm.sim_id = s.id WHERE s.user_id = n.id AND pm.mine) AS message,
			EXISTS (SELECT 1 FROM user_days x WHERE x.user_id = n.id AND x.day = n.d0 + 1) AS d1,
			EXISTS (SELECT 1 FROM user_days x WHERE x.user_id = n.id AND x.day = n.d0 + 7) AS d7,
			EXISTS (SELECT 1 FROM user_days x WHERE x.user_id = n.id AND x.day > n.d0) AS back
		FROM n WHERE ($2::text = '' OR n.source = $2::text) AND ($3::text = '' OR n.platform = $3::text)
	), f AS (
		SELECT p.*, (p.rue OR p.bouge) AS street, (p.sim OR p.rue OR p.bouge OR p.message) AS made FROM p
	)`

// newPlayersStats: the funnel of the accounts made in the last days (1 to 90), filtered by source and platform.
func newPlayersStats(ctx context.Context, db interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}, days int, source, platform string) (NewPlayers, error) {
	out := NewPlayers{Days: days, Source: source, Platform: platform, Cohorts: []NewPlayersRow{}, Platforms: map[string]int{}, Sources: map[string]int{},
		Gone: NewPlayersGone{LastStep: map[string]int{}, Screens: []ScreenCount{}}}
	rows, err := db.Query(ctx, newPlayersCTE+`
		SELECT d0, count(*), count(*) FILTER (WHERE made), count(*) FILTER (WHERE street), count(*) FILTER (WHERE bouge), count(*) FILTER (WHERE message),
			bool_and(d0 <= current_date - 1), count(*) FILTER (WHERE d1), bool_and(d0 <= current_date - 7), count(*) FILTER (WHERE d7)
		FROM f GROUP BY d0 ORDER BY d0 DESC`, days, source, platform)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var c NewPlayersRow
		var d time.Time
		var d1Open, d7Open bool
		if err := rows.Scan(&d, &c.Signups, &c.Sim, &c.Street, &c.Moved, &c.Message, &d1Open, &c.D1, &d7Open, &c.D7); err != nil {
			rows.Close()
			return out, err
		}
		c.Day = d.Format("2006-01-02")
		if d1Open {
			c.D1Base = c.Signups
		}
		if d7Open {
			c.D7Base = c.Signups
		}
		t := &out.Total
		t.Signups += c.Signups
		t.Sim += c.Sim
		t.Street += c.Street
		t.Moved += c.Moved
		t.Message += c.Message
		t.D1Base += c.D1Base
		t.D1 += c.D1
		t.D7Base += c.D7Base
		t.D7 += c.D7
		out.Cohorts = append(out.Cohorts, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return out, err
	}
	// The window's split, without the filters.
	rows, err = db.Query(ctx, newPlayersCTE+` SELECT platform, source, count(*) FROM n GROUP BY platform, source`, days, "", "")
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var pl, so string
		var k int
		if err := rows.Scan(&pl, &so, &k); err != nil {
			rows.Close()
			return out, err
		}
		out.Platforms[pl] += k
		out.Sources[so] += k
	}
	rows.Close()
	// The ones who never came back.
	g := &out.Gone
	var avg, median float64
	if err := db.QueryRow(ctx, newPlayersCTE+`
		SELECT count(*), COALESCE(avg(play_seconds), 0), COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY play_seconds), 0)
		FROM f WHERE d0 <= current_date - 1 AND NOT back`, days, source, platform).Scan(&g.Count, &avg, &median); err != nil {
		return out, err
	}
	g.AvgSeconds, g.MedianSeconds = int(avg+0.5), int(median+0.5)
	rows, err = db.Query(ctx, newPlayersCTE+`
		SELECT CASE WHEN message THEN 'message' WHEN bouge THEN 'bouge' WHEN street THEN 'rue' WHEN made THEN 'perso' ELSE 'compte' END AS last, count(*)
		FROM f WHERE d0 <= current_date - 1 AND NOT back GROUP BY last`, days, source, platform)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var s string
		var k int
		if err := rows.Scan(&s, &k); err != nil {
			rows.Close()
			return out, err
		}
		g.LastStep[s] = k
	}
	rows.Close()
	rows, err = db.Query(ctx, newPlayersCTE+`
		SELECT ls.screen, count(*) FROM f JOIN user_last_screen ls ON ls.user_id = f.id
		WHERE f.d0 <= current_date - 1 AND NOT f.back GROUP BY ls.screen ORDER BY count(*) DESC, ls.screen LIMIT 15`, days, source, platform)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var s ScreenCount
		if err := rows.Scan(&s.Screen, &s.N); err != nil {
			rows.Close()
			return out, err
		}
		g.Screens = append(g.Screens, s)
	}
	rows.Close()
	err = db.QueryRow(ctx, newPlayersCTE+`
		SELECT count(*) FROM f JOIN user_last_screen ls ON ls.user_id = f.id WHERE f.d0 <= current_date - 1 AND NOT f.back`, days, source, platform).Scan(&g.WithScreens)
	return out, err
}

// newPlayers: GET /admin/nouveaux?days=14|30&source=parrainage|direct&platform=web|app|inconnu.
func (h *Handler) newPlayers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	days, _ := strconv.Atoi(q.Get("days"))
	if days < 1 || days > 90 {
		days = 14
	}
	source, platform := q.Get("source"), q.Get("platform")
	if source != "" && source != "parrainage" && source != "direct" {
		source = ""
	}
	if platform != "" && platform != "web" && platform != "app" && platform != "inconnu" {
		platform = ""
	}
	out, err := newPlayersStats(r.Context(), h.DB, days, source, platform)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, out)
}
