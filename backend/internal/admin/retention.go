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
