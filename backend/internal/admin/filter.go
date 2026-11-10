package admin

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
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
	// Hours: played at least, at most this many hours in all (users.play_seconds; -1: no bound).
	HMin, HMax int
	// Money: the first perso's Djai, at least, at most (-1: no bound).
	MMin, MMax int
	// Age: the first perso's age in years, at least, at most (-1: no bound); Stage: its stage of life.
	AMin, AMax int
	Stage      string
	// Family, Commune: the first perso's family drawn, and the commune it lives in.
	Family, Commune string
	// Online: connected now.
	Online bool
}

// The first perso of an account (the one the game plays), for the filter's conditions on it.
const firstSim = `(SELECT * FROM sims s WHERE s.user_id = u.id ORDER BY s.created_at LIMIT 1)`

// slug: a family's or a commune's id (letters, digits, dashes), safe to write in the query.
func slug(v string) bool {
	if v == "" || len(v) > 40 {
		return false
	}
	for _, c := range v {
		if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-' || c == '_') {
			return false
		}
	}
	return true
}

// FilterPrefix: an e-mail audience that is a players' filter, « filtre:<the filter's query> ».
const FilterPrefix = "filtre:"

// parseFilter: the filter from a query (?segment=&day=&min=&max=&absent=); an error for anything off.
func parseFilter(v url.Values) (playerFilter, error) {
	f := playerFilter{Segment: v.Get("segment"), Day: strings.TrimSpace(v.Get("day")), HMin: -1, HMax: -1, MMin: -1, MMax: -1, AMin: -1, AMax: -1,
		Stage: v.Get("stage"), Family: v.Get("family"), Commune: v.Get("commune"), Online: v.Get("online") == "1"}
	for _, n := range []struct {
		key string
		to  *int
		top int
	}{{"hmin", &f.HMin, 100000}, {"hmax", &f.HMax, 100000}, {"mmin", &f.MMin, 2_000_000_000}, {"mmax", &f.MMax, 2_000_000_000}, {"amin", &f.AMin, 200}, {"amax", &f.AMax, 200}} {
		if s := strings.ReplaceAll(strings.TrimSpace(v.Get(n.key)), " ", ""); s != "" {
			x, err := strconv.Atoi(s)
			if err != nil || x < 0 || x > n.top {
				return f, fmt.Errorf("nombre invalide : %s", n.key)
			}
			*n.to = x
		}
	}
	if f.Stage != "" && game.StageByID(f.Stage).ID != f.Stage {
		return f, fmt.Errorf("âge de la vie inconnu")
	}
	if f.Family != "" && !slug(f.Family) || f.Commune != "" && !slug(f.Commune) {
		return f, fmt.Errorf("famille ou commune invalide")
	}
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
	return f.Segment != "" || f.Day != "" || f.Min > 0 || f.Max > 0 || f.Absent > 0 || f.HMin >= 0 || f.HMax >= 0 || f.MMin >= 0 || f.MMax >= 0 ||
		f.AMin >= 0 || f.AMax >= 0 || f.Stage != "" || f.Family != "" || f.Commune != "" || f.Online
}

// livedSQL: the first perso's minutes lived since birth, in the query.
const livedSQL = `(f.game_minutes - f.born_at)`

// ageCond: a perso f at least (or at most) `age` years old: the minutes it has lived against those that age
// takes (game.MinutesToAge); a perso without a birth date (born 0) is an adult, 18.
func ageCond(age int, atLeast bool) string {
	if atLeast {
		return fmt.Sprintf("(CASE WHEN f.born_at = 0 THEN %d >= %d ELSE %s >= %d END)", game.AdultAge, age, livedSQL, game.MinutesToAge(float64(age)))
	}
	return fmt.Sprintf("(CASE WHEN f.born_at = 0 THEN %d <= %d ELSE %s < %d END)", game.AdultAge, age, livedSQL, game.MinutesToAge(float64(age+1)))
}

// nextStage: the stage of life after this one (nil after adult).
func nextStage(id string) *game.Stage {
	for i, st := range game.Stages {
		if st.ID == id && i+1 < len(game.Stages) {
			return &game.Stages[i+1]
		}
	}
	return nil
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
	if f.HMin >= 0 {
		conds = append(conds, fmt.Sprintf("u.play_seconds >= %d", f.HMin*3600))
	}
	if f.HMax >= 0 {
		conds = append(conds, fmt.Sprintf("u.play_seconds <= %d", f.HMax*3600))
	}
	// On the first perso: its money, its age, its stage, its family, its commune, online.
	var sim []string
	if f.MMin >= 0 {
		sim = append(sim, fmt.Sprintf("f.money >= %d", f.MMin))
	}
	if f.MMax >= 0 {
		sim = append(sim, fmt.Sprintf("f.money <= %d", f.MMax))
	}
	if f.AMin >= 0 {
		sim = append(sim, ageCond(f.AMin, true))
	}
	if f.AMax >= 0 {
		sim = append(sim, ageCond(f.AMax, false))
	}
	if f.Stage != "" {
		st := game.StageByID(f.Stage)
		sim = append(sim, ageCond(st.From, true))
		if next := nextStage(st.ID); next != nil {
			sim = append(sim, ageCond(next.From-1, false))
		}
	}
	if f.Family != "" {
		sim = append(sim, fmt.Sprintf("f.family = '%s'", f.Family))
	}
	if f.Commune != "" {
		sim = append(sim, fmt.Sprintf("f.commune = '%s'", f.Commune))
	}
	if f.Online {
		sim = append(sim, "f.last_tick > now() - interval '5 minutes'")
	}
	if len(sim) > 0 {
		conds = append(conds, "EXISTS (SELECT 1 FROM "+firstSim+" f WHERE "+strings.Join(sim, " AND ")+")")
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
	for k, n := range map[string]int{"hmin": f.HMin, "hmax": f.HMax, "mmin": f.MMin, "mmax": f.MMax, "amin": f.AMin, "amax": f.AMax} {
		if n >= 0 {
			v.Set(k, strconv.Itoa(n))
		}
	}
	for k, x := range map[string]string{"stage": f.Stage, "family": f.Family, "commune": f.Commune} {
		if x != "" {
			v.Set(k, x)
		}
	}
	if f.Online {
		v.Set("online", "1")
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
	between := func(lo, hi int, unit string) string {
		switch {
		case lo >= 0 && hi >= 0:
			return fmt.Sprintf("de %d à %d %s", lo, hi, unit)
		case lo >= 0:
			return fmt.Sprintf("%d %s ou plus", lo, unit)
		case hi >= 0:
			return fmt.Sprintf("%d %s au plus", hi, unit)
		}
		return ""
	}
	for _, x := range []string{between(f.HMin, f.HMax, "h de jeu"), between(f.MMin, f.MMax, "Djai"), between(f.AMin, f.AMax, "ans")} {
		if x != "" {
			parts = append(parts, x)
		}
	}
	if f.Stage != "" {
		parts = append(parts, strings.ToLower(game.StageByID(f.Stage).Label))
	}
	if f.Family != "" {
		parts = append(parts, "famille "+f.Family)
	}
	if f.Commune != "" {
		parts = append(parts, "à "+f.Commune)
	}
	if f.Online {
		parts = append(parts, "en ligne")
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
