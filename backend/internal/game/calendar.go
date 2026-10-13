package game

import (
	"slices"
	"time"
)

// Days of the week as the world data writes them: 0 = lundi … 6 = dimanche.
// Epoch is a Monday, so the weekday is a plain modulo of the game day.
const (
	Lundi = iota
	Mardi
	Mercredi
	Jeudi
	Vendredi
	Samedi
	Dimanche
)

// Weekdays (lundi–vendredi) and Workweek (lundi–samedi), for opening days.
var (
	Weekdays = []int{Lundi, Mardi, Mercredi, Jeudi, Vendredi}
	Workweek = []int{Lundi, Mardi, Mercredi, Jeudi, Vendredi, Samedi}
)

func WeekdayOf(gameMinutes int64) int { return int((gameMinutes / (24 * 60)) % 7) }

// DateOf is the calendar day (Abidjan time) of a game minute.
func DateOf(gameMinutes int64) time.Time {
	t := TimeOf(gameMinutes)
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// A Holiday is a public holiday of Côte d'Ivoire (décret n° 96-205 du 7 mars
// 1996, modifié par le décret n° 2011-371 du 4 novembre 2011).
type Holiday struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	// Fixed date (Month, Day), or a date computed from Easter (EasterOffset,
	// Rule "easter"), or dates declared each year by the government (Rule
	// "declared", listed in Declared as YYYY-MM-DD).
	Rule         string   `json:"rule"` // "fixed" | "easter" | "declared"
	Month        int      `json:"month,omitempty"`
	Day          int      `json:"day,omitempty"`
	EasterOffset int      `json:"easterOffset,omitempty"`
	Declared     []string `json:"declared,omitempty"`
	Source       *Source  `json:"source"`
}

var holidaysSrc = Verified("Liste de l'article 2 du décret n° 96-205, modifié par le décret n° 2011-371.", SrcHolidaysDecree, SrcHolidaysText)

// Lunar holidays are fixed each year by a government announcement: only
// dates actually declared are listed, the audit flags the missing years.
var declaredSrc = Partial("Date fixée chaque année par le gouvernement selon le calendrier lunaire ; seules les dates déjà annoncées sont listées.", SrcHolidaysDecree)

var Holidays = []Holiday{
	{ID: "nouvel-an", Label: "Jour de l'An", Rule: "fixed", Month: 1, Day: 1, Source: holidaysSrc},
	{ID: "lundi-paques", Label: "Lundi de Pâques", Rule: "easter", EasterOffset: 1, Source: holidaysSrc},
	{ID: "fete-travail", Label: "Fête du Travail", Rule: "fixed", Month: 5, Day: 1, Source: holidaysSrc},
	{ID: "ascension", Label: "Ascension", Rule: "easter", EasterOffset: 39, Source: holidaysSrc},
	{ID: "lundi-pentecote", Label: "Lundi de Pentecôte", Rule: "easter", EasterOffset: 50, Source: holidaysSrc},
	{ID: "fete-nationale", Label: "Fête nationale (Indépendance)", Rule: "fixed", Month: 8, Day: 7, Source: holidaysSrc},
	{ID: "assomption", Label: "Assomption", Rule: "fixed", Month: 8, Day: 15, Source: holidaysSrc},
	{ID: "toussaint", Label: "Toussaint", Rule: "fixed", Month: 11, Day: 1, Source: holidaysSrc},
	{ID: "paix", Label: "Journée nationale de la Paix", Rule: "fixed", Month: 11, Day: 15, Source: Verified("Instituée en 1996, chaque 15 novembre.", SrcHolidaysDecree, SrcPeaceDay)},
	{ID: "noel", Label: "Noël", Rule: "fixed", Month: 12, Day: 25, Source: holidaysSrc},
	{ID: "korite", Label: "Korité (Aïd el-Fitr, fin du Ramadan)", Rule: "declared", Source: declaredSrc},
	{ID: "tabaski", Label: "Tabaski (Aïd el-Kébir)", Rule: "declared", Source: declaredSrc},
	{ID: "lendemain-nuit-destin", Label: "Lendemain de la Nuit du Destin", Rule: "declared", Declared: []string{"2026-03-16"},
		Source: Verified("Le lundi 16 mars 2026 a été déclaré férié et chômé.", SrcNuitDestin2026, SrcHolidaysDecree)},
	{ID: "lendemain-maouloud", Label: "Lendemain du Maouloud", Rule: "declared", Source: declaredSrc},
}

// Easter returns Easter Sunday of a year (Gregorian computus, Meeus/Jones/Butcher).
func Easter(year int) time.Time {
	a := year % 19
	b, c := year/100, year%100
	d, e := b/4, b%4
	f := (b + 8) / 25
	g := (b - f + 1) / 3
	h := (19*a + b - d - g + 15) % 30
	i, k := c/4, c%4
	l := (32 + 2*e + 2*i - h - k) % 7
	m := (a + 11*h + 22*l) / 451
	month := (h + l - 7*m + 114) / 31
	day := (h+l-7*m+114)%31 + 1
	return time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
}

// On reports whether the holiday falls on a calendar day.
func (h Holiday) On(day time.Time) bool {
	switch h.Rule {
	case "fixed":
		return int(day.Month()) == h.Month && day.Day() == h.Day
	case "easter":
		return Easter(day.Year()).AddDate(0, 0, h.EasterOffset).Equal(day)
	case "declared":
		return slices.Contains(h.Declared, day.Format("2006-01-02"))
	}
	return false
}

// HolidayOn returns the public holiday on a game minute's day, if any.
func HolidayOn(gameMinutes int64) (Holiday, bool) {
	day := DateOf(gameMinutes)
	for _, h := range Holidays {
		if h.On(day) {
			return h, true
		}
	}
	return Holiday{}, false
}
