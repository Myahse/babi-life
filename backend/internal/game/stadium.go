package game

import (
	"fmt"
	"hash/fnv"
)

// The stadium's agenda: a match on Wednesday evening and Saturday afternoon,
// a concert on Friday night and Sunday afternoon, every week, the same for
// everyone. The clubs and the artists are the game's own (none is a real
// club or a real singer); who plays and who sings changes from week to week,
// drawn from the stadium and the week. The doors open an hour before.
// Tickets: the match 2 000 F, the concert 5 000 F (game rules).

// StadiumKind is the place kind of the big stadiums.
const StadiumKind = "stade"

// The interactions that need something on at the stadium.
const (
	StadiumMatchID   = "stade-match"
	StadiumConcertID = "stade-concert"
)

// DoorsOpen: how long before the start one can go in.
const DoorsOpen = 60

// A StadiumEvent is a match or a concert at a stadium.
type StadiumEvent struct {
	Kind   string `json:"kind"` // "match" or "concert"
	Title  string `json:"title"`
	Detail string `json:"detail"`
	// Start and End in game minutes.
	Start int64 `json:"start"`
	End   int64 `json:"end"`
	// Home and Away: the clubs (a match); Score once it's played, e.g. "2 – 1".
	Home  string `json:"home,omitempty"`
	Away  string `json:"away,omitempty"`
	Score string `json:"score,omitempty"`
	// When each side scores, in minutes from the kick-off (the 3D cheers them as they come).
	HomeGoals []int64 `json:"homeGoals,omitempty"`
	AwayGoals []int64 `json:"awayGoals,omitempty"`
	// Artist and Genre (a concert).
	Artist string `json:"artist,omitempty"`
	Genre  string `json:"genre,omitempty"`
}

// The clubs of the game's league.
var Clubs = []string{"Babi Sporting", "Yop City FC", "Étoile de Treichville", "Lagune FC", "Racing d'Adjamé", "Koumassi Lions", "Abobo Warriors", "Cocody Olympique", "Plateau United", "Bingerville Athletic", "Marcory Espoir", "Port-Bouët Marine"}

// The artists who fill the stadium, with what they sing.
var Artists = []struct{ Name, Genre string }{
	{"DJ Garba Chaud", "coupé-décalé"},
	{"Bébé Alloco", "coupé-décalé"},
	{"Les Ambianceurs de Yop", "zouglou"},
	{"Les Frères Woro", "zouglou"},
	{"Akissi Lumière", "afro-pop"},
	{"Lady Attiéké", "afro-pop"},
	{"MC Gbaka", "rap ivoire"},
	{"Tonton Kédjénou", "rap ivoire"},
	{"Ras Lagune", "reggae"},
	{"Chorale Étoile de Babi", "gospel"},
}

type slot struct {
	day        int   // 0 = lundi
	start, end int64 // minutes of the day
	kind       string
}

var stadiumWeek = []slot{
	{2, 19 * 60, 21 * 60, "match"},
	{4, 20 * 60, 23*60 + 30, "concert"},
	{5, 16 * 60, 18 * 60, "match"},
	{6, 16 * 60, 19 * 60, "concert"},
}

const week = 7 * 24 * 60

var dayNames = []string{"lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"}

func draw(parts ...any) uint32 {
	f := fnv.New32a()
	fmt.Fprint(f, parts...)
	return f.Sum32()
}

// stadiumEvent: what's on at slot i of week w.
func stadiumEvent(placeID string, w int64, i int) StadiumEvent {
	sl := stadiumWeek[i]
	e := StadiumEvent{Kind: sl.kind, Start: w*week + int64(sl.day)*24*60 + sl.start}
	e.End = e.Start - sl.start + sl.end
	n := draw(placeID, w, i)
	if sl.kind == "match" {
		a := int(n % uint32(len(Clubs)))
		b := (a + 1 + int(n/16%uint32(len(Clubs)-1))) % len(Clubs)
		e.Home, e.Away = Clubs[a], Clubs[b]
		e.Title = e.Home + " – " + e.Away
		e.Detail = "Championnat de Babi · coup d'envoi " + clockOf(e.Start)
		e.HomeGoals, e.AwayGoals = MatchGoals(e)
		return e
	}
	// Sunday afternoon is for gospel; Friday night for the rest.
	ar := Artists[len(Artists)-1]
	if sl.day != 6 {
		ar = Artists[n%uint32(len(Artists)-1)]
	}
	e.Artist, e.Genre = ar.Name, ar.Genre
	e.Title = ar.Name + " en concert"
	e.Detail = ar.Genre + " · début " + clockOf(e.Start)
	return e
}

func clockOf(m int64) string {
	h, mn := (m/60)%24, m%60
	if mn == 0 {
		return fmt.Sprintf("%d h", h)
	}
	return fmt.Sprintf("%d h %02d", h, mn)
}

// The match's clock, in minutes from the kick-off: the first half to 45,
// half-time to 60, the second half to FullTime; then the players celebrate
// or sit on the grass until the event ends (120).
const (
	HalfTime   = 45
	SecondHalf = 60
	FullTime   = 105
)

// MatchGoals: the minutes when each side scores, always while the ball is
// in play, the same for everyone. Home first.
func MatchGoals(e StadiumEvent) (home, away []int64) {
	n := draw(e.Home, e.Away, e.Start)
	for k := uint32(0); k < 6; k++ {
		r := draw(n, k)
		if r%3 != 0 {
			continue
		}
		// 3 to 86 minutes of play, put on the clock: past 45, after the break.
		at := int64(3 + r/7%84)
		if at >= HalfTime {
			at += SecondHalf - HalfTime
		}
		// Room for the build-up, the celebration and the kick-off between two goals.
		if near(at, home) || near(at, away) {
			continue
		}
		if r/1000%2 == 0 {
			home = append(home, at)
		} else {
			away = append(away, at)
		}
	}
	return home, away
}

func near(at int64, goals []int64) bool {
	for _, g := range goals {
		if at-g < 3 && g-at < 3 {
			return true
		}
	}
	return false
}

// withScore: the score at game minute now (none before kick-off).
func withScore(e StadiumEvent, now int64) StadiumEvent {
	e.Score = ""
	if now < e.Start || e.Kind != "match" {
		return e
	}
	h, a := MatchGoals(e)
	count := func(goals []int64) (n int) {
		for _, g := range goals {
			if e.Start+g <= now {
				n++
			}
		}
		return n
	}
	e.Score = fmt.Sprintf("%d – %d", count(h), count(a))
	return e
}

// StadiumAgenda: the events of a stadium that end after from and start
// before to, in order, with the score so far for a match under way.
func StadiumAgenda(placeID string, now, from, to int64) []StadiumEvent {
	var out []StadiumEvent
	if to < from {
		return out
	}
	for w := from / week; w <= to/week; w++ {
		for i := range stadiumWeek {
			e := stadiumEvent(placeID, w, i)
			if e.End > from && e.Start < to {
				out = append(out, withScore(e, now))
			}
		}
	}
	return out
}

// StadiumEventAt: the match or concert one can be at now (from the doors
// opening to the end), if any.
func StadiumEventAt(placeID string, now int64) (StadiumEvent, bool) {
	for _, e := range StadiumAgenda(placeID, now, now, now+DoorsOpen+1) {
		if now >= e.Start-DoorsOpen && now < e.End {
			return e, true
		}
	}
	return StadiumEvent{}, false
}

// NextStadiumEvent: the next one of this kind ("match", "concert") from now.
func NextStadiumEvent(placeID, kind string, now int64) (StadiumEvent, bool) {
	for _, e := range StadiumAgenda(placeID, now, now, now+week+1) {
		if e.Kind == kind && e.Start-DoorsOpen > now {
			return e, true
		}
	}
	return StadiumEvent{}, false
}

// AtStadium: the interaction as it is now at the stadium: the match or the
// concert that's on, until its end; or why not.
func AtStadium(placeID string, it Interaction, now int64) (Interaction, error) {
	kind := map[string]string{StadiumMatchID: "match", StadiumConcertID: "concert"}[it.ID]
	if kind == "" {
		return it, nil
	}
	e, ok := StadiumEventAt(placeID, now)
	if !ok || e.Kind != kind {
		what := map[string]string{"match": "Pas de match en ce moment", "concert": "Pas de concert en ce moment"}[kind]
		if next, ok := NextStadiumEvent(placeID, kind, now); ok {
			return it, fmt.Errorf("%s. Prochain : %s, %s %s", what, next.Title, dayNames[WeekdayOf(next.Start)], clockOf(next.Start))
		}
		return it, fmt.Errorf("%s", what)
	}
	it.Label = it.Label + " : " + e.Title
	// Till the end (from the doors, the wait is part of it).
	it.Minutes = e.End - now
	return it, nil
}
