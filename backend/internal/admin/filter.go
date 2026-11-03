package admin

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// The players' filter of the admin (Joueurs, and the e-mails' audience « joueurs filtrés »): who came
// back on a given day (and not just signed up that day), on how many different days they came in all
// (migration 100: a row a day), the retention's group; to target an e-mail at the ones who come back the
// most, or the ones who came back once and stopped.
type playerFilter struct {
	Segment string
	// Day: came into the game that day (YYYY-MM-DD), having signed up before it.
	Day string
	// Min, Max: on at least, at most this many different days (0: no bound).
	Min, Max int
	// Absent: not seen for at least this many days (0: no bound).
	Absent int
}

// FilterPrefix: an e-mail audience that is a players' filter, « filtre:<the filter's query> ».
const FilterPrefix = "filtre:"

// parseFilter: the filter from a query (?segment=&day=&min=&max=&absent=); an error for anything off.
func parseFilter(v url.Values) (playerFilter, error) {
	f := playerFilter{Segment: v.Get("segment"), Day: strings.TrimSpace(v.Get("day"))}
	if f.Segment != "" && !validSegment(f.Segment) {
		return f, fmt.Errorf("groupe inconnu")
	}
	if f.Day != "" {
		if _, err := time.Parse("2006-01-02", f.Day); err != nil {
			return f, fmt.Errorf("jour invalide")
		}
	}
	for _, n := range []struct {
		key string
		to  *int
	}{{"min", &f.Min}, {"max", &f.Max}, {"absent", &f.Absent}} {
		if s := v.Get(n.key); s != "" {
			x, err := strconv.Atoi(s)
			if err != nil || x < 0 || x > 10000 {
				return f, fmt.Errorf("nombre de jours invalide")
			}
			*n.to = x
		}
	}
	return f, nil
}

// any: some condition is set.
func (f playerFilter) any() bool {
	return f.Segment != "" || f.Day != "" || f.Min > 0 || f.Max > 0 || f.Absent > 0
}

// sql: the condition that an account u passes the filter. Its values are checked (parseFilter), written
// in the query as they are.
func (f playerFilter) sql() string {
	conds := []string{"true"}
	if f.Segment != "" {
		conds = append(conds, inSegment("'"+f.Segment+"'"))
	}
	if f.Day != "" {
		conds = append(conds, fmt.Sprintf("EXISTS (SELECT 1 FROM user_days x WHERE x.user_id = u.id AND x.day = DATE '%s' AND x.day > (u.created_at AT TIME ZONE 'UTC')::date)", f.Day))
	}
	days := "(SELECT count(*) FROM user_days x WHERE x.user_id = u.id)"
	if f.Min > 0 {
		conds = append(conds, fmt.Sprintf("%s >= %d", days, f.Min))
	}
	if f.Max > 0 {
		conds = append(conds, fmt.Sprintf("%s <= %d", days, f.Max))
	}
	if f.Absent > 0 {
		conds = append(conds, fmt.Sprintf("NOT EXISTS (SELECT 1 FROM user_days x WHERE x.user_id = u.id AND x.day > current_date - %d)", f.Absent))
	}
	return "(" + strings.Join(conds, " AND ") + ")"
}

// query: the filter as a query (its e-mail audience's, after FilterPrefix).
func (f playerFilter) query() string {
	v := url.Values{}
	if f.Segment != "" {
		v.Set("segment", f.Segment)
	}
	if f.Day != "" {
		v.Set("day", f.Day)
	}
	for k, n := range map[string]int{"min": f.Min, "max": f.Max, "absent": f.Absent} {
		if n > 0 {
			v.Set(k, strconv.Itoa(n))
		}
	}
	return v.Encode()
}

// label: the filter in words, for the campaigns' list.
func (f playerFilter) label() string {
	parts := []string{}
	if f.Segment != "" {
		parts = append(parts, segmentNames[f.Segment])
	}
	if f.Day != "" {
		if d, err := time.Parse("2006-01-02", f.Day); err == nil {
			parts = append(parts, "revenus le "+d.Format("02/01/2006"))
		}
	}
	switch {
	case f.Min > 0 && f.Max > 0:
		parts = append(parts, fmt.Sprintf("de %d à %d jours", f.Min, f.Max))
	case f.Min > 0:
		parts = append(parts, fmt.Sprintf("%d jours ou plus", f.Min))
	case f.Max > 0:
		parts = append(parts, fmt.Sprintf("%d jours au plus", f.Max))
	}
	if f.Absent > 0 {
		parts = append(parts, fmt.Sprintf("absents depuis %d jours", f.Absent))
	}
	if len(parts) == 0 {
		return "les joueurs"
	}
	return "joueurs : " + strings.Join(parts, ", ")
}

// filterAudience: an e-mail audience that is a players' filter, if it is one.
func filterAudience(a string) (playerFilter, bool) {
	q, ok := strings.CutPrefix(a, FilterPrefix)
	if !ok {
		return playerFilter{}, false
	}
	v, err := url.ParseQuery(q)
	if err != nil {
		return playerFilter{}, false
	}
	f, err := parseFilter(v)
	return f, err == nil
}

// audienceLabel: an audience in words.
func audienceLabel(a string) string {
	if f, ok := filterAudience(a); ok {
		return f.label()
	}
	return audiences[a]
}
