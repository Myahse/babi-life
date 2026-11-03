package admin

import (
	"net/http"
	"time"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Cohort is one day's new accounts and how many of them came back.
type Cohort struct {
	Day     string `json:"day"`
	Signups int    `json:"signups"`
	// Came back the next day, within the 7 days after, and on any later day at all.
	D1   int `json:"d1"`
	D7   int `json:"d7"`
	Ever int `json:"ever"`
}

// Retention is the admin's view of who comes back (migration 100: a row a day an account came in).
type Retention struct {
	Cohorts []Cohort `json:"cohorts"`
	// The accounts by how they come: only the day they signed up (« jamais revenus »), came back on
	// another day (« revenus »), in the game in the last 7 days (« actifs »), came back once at least but
	// not seen for 7 days (« perdus »).
	Never    int `json:"never"`
	Returned int `json:"returned"`
	Active   int `json:"active"`
	Lapsed   int `json:"lapsed"`
	// Active accounts today, in the last 7 days and the last 30 (DAU, WAU, MAU).
	DAU int `json:"dau"`
	WAU int `json:"wau"`
	MAU int `json:"mau"`
	// The new players' path (auth/funnel.go), for the accounts made in the last 30 days.
	Funnel Funnel `json:"funnel"`
}

// Funnel: of the accounts made in the last 30 days, how many passed each step: the tutorial started,
// finished (or skipped), the first activity finished after it, a second session; came back the next day
// (of those made at least a day ago: D1Base) and on the seventh (of those made at least a week ago).
type Funnel struct {
	Signups       int `json:"signups"`
	TutoStart     int `json:"tutoStart"`
	TutoDone      int `json:"tutoDone"`
	TutoSkip      int `json:"tutoSkip"`
	FirstActivity int `json:"firstActivity"`
	SecondSession int `json:"secondSession"`
	D1Base        int `json:"d1Base"`
	D1            int `json:"d1"`
	D7Base        int `json:"d7Base"`
	D7            int `json:"d7"`
}

// retention: GET /admin/retention, the last 30 days' sign-ups and how many came back, the accounts by
// segment, and the daily, weekly and monthly active players.
func (h *Handler) retention(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	out := Retention{Cohorts: []Cohort{}}
	rows, err := h.DB.Query(ctx, `
		WITH first AS (SELECT u.id, (u.created_at AT TIME ZONE 'UTC')::date AS d0 FROM users u WHERE u.created_at > now() - interval '31 days')
		SELECT f.d0, count(*),
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM user_days x WHERE x.user_id = f.id AND x.day = f.d0 + 1)),
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM user_days x WHERE x.user_id = f.id AND x.day > f.d0 AND x.day <= f.d0 + 7)),
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM user_days x WHERE x.user_id = f.id AND x.day > f.d0))
		FROM first f GROUP BY f.d0 ORDER BY f.d0 DESC`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	for rows.Next() {
		var c Cohort
		var d time.Time
		if err := rows.Scan(&d, &c.Signups, &c.D1, &c.D7, &c.Ever); err != nil {
			rows.Close()
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		c.Day = d.Format("2006-01-02")
		out.Cohorts = append(out.Cohorts, c)
	}
	rows.Close()
	err = h.DB.QueryRow(ctx, `
		WITH a AS (SELECT u.id, (u.created_at AT TIME ZONE 'UTC')::date AS d0,
				(SELECT count(*) FROM user_days x WHERE x.user_id = u.id AND x.day > (u.created_at AT TIME ZONE 'UTC')::date) AS later,
				(SELECT max(day) FROM user_days x WHERE x.user_id = u.id) AS last
			FROM users u WHERE NOT u.official)
		SELECT count(*) FILTER (WHERE later = 0),
			count(*) FILTER (WHERE later > 0),
			count(*) FILTER (WHERE last > current_date - 7),
			count(*) FILTER (WHERE later > 0 AND last <= current_date - 7),
			(SELECT count(DISTINCT user_id) FROM user_days WHERE day = current_date),
			(SELECT count(DISTINCT user_id) FROM user_days WHERE day > current_date - 7),
			(SELECT count(DISTINCT user_id) FROM user_days WHERE day > current_date - 30)
		FROM a`).Scan(&out.Never, &out.Returned, &out.Active, &out.Lapsed, &out.DAU, &out.WAU, &out.MAU)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	f := &out.Funnel
	err = h.DB.QueryRow(ctx, `
		WITH n AS (SELECT u.id, (u.created_at AT TIME ZONE 'UTC')::date AS d0, u.play_sessions FROM users u WHERE NOT u.official AND u.created_at > now() - interval '30 days')
		SELECT count(*),
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM user_funnel x WHERE x.user_id = n.id AND x.step = 'tuto_start')),
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM user_funnel x WHERE x.user_id = n.id AND x.step = 'tuto_done')),
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM user_funnel x WHERE x.user_id = n.id AND x.step = 'tuto_skip')),
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM user_funnel x WHERE x.user_id = n.id AND x.step = 'first_activity')),
			count(*) FILTER (WHERE n.play_sessions >= 2),
			count(*) FILTER (WHERE n.d0 <= current_date - 1),
			count(*) FILTER (WHERE n.d0 <= current_date - 1 AND EXISTS (SELECT 1 FROM user_days x WHERE x.user_id = n.id AND x.day = n.d0 + 1)),
			count(*) FILTER (WHERE n.d0 <= current_date - 7),
			count(*) FILTER (WHERE n.d0 <= current_date - 7 AND EXISTS (SELECT 1 FROM user_days x WHERE x.user_id = n.id AND x.day = n.d0 + 7))
		FROM n`).Scan(&f.Signups, &f.TutoStart, &f.TutoDone, &f.TutoSkip, &f.FirstActivity, &f.SecondSession, &f.D1Base, &f.D1, &f.D7Base, &f.D7)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, out)
}

// segmentNames: the groups of the retention, by what the admin page calls them.
var segmentNames = map[string]string{"jamais": "jamais revenus", "revenus": "revenus", "actifs": "actifs (7 jours)", "perdus": "perdus"}

func validSegment(s string) bool { _, ok := segmentNames[s]; return ok }

// inSegment: the SQL condition that an account u is in the group named by the parameter p (« $3 »):
// jamais (came only the day they signed up), revenus (another day too), actifs (in the last 7 days),
// perdus (came back once at least, not seen for 7 days); anything else, everyone.
func inSegment(p string) string {
	signup := "(u.created_at AT TIME ZONE 'UTC')::date"
	later := "EXISTS (SELECT 1 FROM user_days x WHERE x.user_id = u.id AND x.day > " + signup + ")"
	recent := "EXISTS (SELECT 1 FROM user_days x WHERE x.user_id = u.id AND x.day > current_date - 7)"
	return "CASE " + p + "::text WHEN 'jamais' THEN NOT " + later + " WHEN 'revenus' THEN " + later + " WHEN 'actifs' THEN " + recent +
		" WHEN 'perdus' THEN " + later + " AND NOT " + recent + " ELSE true END"
}
