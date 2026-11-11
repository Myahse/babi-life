package game

import (
	"fmt"
	"hash/fnv"
	"time"
)

// Les rendez-vous de la semaine (the update « rendez-vous », sims/rendezvous.go): fixed times in
// the week, on Abidjan's clock (UTC, the game's own), when something worth coming back for happens,
// each made of what the game already has: the maquis' happy hour, the Friday soirées, the Saturday
// dames tournament, the Sunday street football, the republic's vote and its results. A rendez-vous is
// a window of time, a place or a mode, a bonus, and who said « J'y serai ». Pure functions of the
// clock: every server finds the same ones with nothing stored; the team only turns one off (admin).

// RendezVousKey: the update that brings them (features.go).
const RendezVousKey = "rendez-vous"

// RendezVous is one appointment of the week.
type RendezVous struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	About string `json:"about"`
	// Bonus: what coming brings, said on the card.
	Bonus string `json:"bonus"`
	Emoji string `json:"emoji"`
	// Mode: where « Y aller » leads (web components/RendezVous.tsx): maquis, soiree, dames, foot, politique.
	Mode string `json:"mode"`
	// Days: the days of the week it's on; Start: the minute of the day it starts; Length: in minutes.
	Days   []time.Weekday `json:"days"`
	Start  int            `json:"start"`
	Length int            `json:"length"`
	// Featured: held in one commune of Abidjan, a different one each time (FeaturedCommune).
	Featured bool `json:"featured,omitempty"`
	// Needs: the update the mode itself waits for ("" none): closed, the rendez-vous isn't held.
	Needs string `json:"needs,omitempty"`
}

// The bonuses' amounts.
const (
	// HappyHourOff: the share off at the maquis of the commune during the happy hour.
	HappyHourOff = 0.5
	// SoireeNightOff: the share off the soirée's cost (SoireeCost) for a host of the commune of the night.
	SoireeNightOff = 0.5
	// FootBonus: the first street match of the Sunday rendez-vous, once per account.
	FootBonus = 1000
	// DamesNpcStake: a win against a man of the grin counts for the tournament only with at least this stake.
	DamesNpcStake = 500
	// DamesNpcMax, DamesPairMax: the most wins counted against the men of the grin, and against the same player.
	DamesNpcMax  = 5
	DamesPairMax = 2
	// DamesPlayerPoints: a win against a player is worth this many wins against the grin.
	DamesPlayerPoints = 3
)

// DamesPrizes: the Saturday tournament's fixed pot, to the first three (15 000 Djai a week in all, whoever plays).
var DamesPrizes = [3]int{8000, 4500, 2500}

// SoireeNightID: the soirée night, in a Sim's measures while it's on in its commune (the host's cost halved; no price elsewhere).
const SoireeNightID = "soiree-night"

// HappyHour: the happy hour as a measure (civic.go's prices), added to a Sim's measures while it's on in its commune.
var HappyHour = Measure{ID: "happy-hour", Label: "Happy hour au maquis", About: "Au maquis de la commune du jour, tout à moitié prix pendant une heure.", Kinds: []string{"maquis"}, Off: HappyHourOff}

// RendezVousList: the week's appointments (Abidjan's clock is UTC).
var RendezVousList = []RendezVous{
	{ID: "happy-hour", Label: "Happy hour au maquis", Emoji: "🍻", Mode: "maquis", Featured: true,
		About: "Du lundi au jeudi, de 18 h à 19 h : la commune du jour fait son happy hour. Tous ses maquis à moitié prix.",
		Bonus: "Le maquis à moitié prix", Days: []time.Weekday{time.Monday, time.Tuesday, time.Wednesday, time.Thursday}, Start: 18 * 60, Length: 60},
	{ID: "soiree-vendredi", Label: "La nuit des soirées", Emoji: "🪩", Mode: "soiree", Featured: true, Needs: "soiree",
		About: "Le vendredi de 21 h à 1 h, la commune de la nuit fait la fête : ses habitants organisent leur soirée à moitié prix, et tout le monde vient danser.",
		Bonus: "Organiser sa soirée à moitié prix (habitants de la commune)", Days: []time.Weekday{time.Friday}, Start: 21 * 60, Length: 4 * 60},
	{ID: "dames-samedi", Label: "Le tournoi de dames du samedi", Emoji: "🏆", Mode: "dames", Needs: "app:dames",
		About: "Le samedi de 16 h à 18 h sur Dames 225 : chaque partie gagnée compte (3 points contre un joueur, 1 contre un gars du grin avec une mise d'au moins 500 F). Les trois premiers se partagent le pot.",
		Bonus: "Pot fixe : 8 000, 4 500 et 2 500 Djai", Days: []time.Weekday{time.Saturday}, Start: 16 * 60, Length: 2 * 60},
	{ID: "foot-dimanche", Label: "Le foot de rue du dimanche", Emoji: "⚽", Mode: "foot",
		About: "Le dimanche de 17 h à 18 h, tout le monde au terrain du quartier : le premier match joué pendant l'heure rapporte un petit quelque chose.",
		Bonus: "1 000 Djai pour ton premier match", Days: []time.Weekday{time.Sunday}, Start: 17 * 60, Length: 60},
	{ID: "vote-dimanche", Label: "Le jour du vote", Emoji: "🗳️", Mode: "politique", Needs: "app:politique",
		About: "Le dimanche, on vote pour le président et les maires, à la mairie de sa commune. Les urnes ferment à minuit.",
		Bonus: "Ta voix pèse autant qu'un quartier", Days: []time.Weekday{time.Sunday}, Start: 9 * 60, Length: 15 * 60},
	{ID: "resultats-lundi", Label: "Les résultats des élections", Emoji: "📣", Mode: "politique", Needs: "app:politique",
		About: "Le lundi à 9 h, les résultats tombent : le nouveau président et les maires de la semaine.",
		Bonus: "Le nouveau président et ses mesures", Days: []time.Weekday{time.Monday}, Start: 9 * 60, Length: 60},
}

// FindRendezVous: an appointment by its id.
func FindRendezVous(id string) (RendezVous, bool) {
	for _, r := range RendezVousList {
		if r.ID == id {
			return r, true
		}
	}
	return RendezVous{}, false
}

// Occurrence: one time a rendez-vous is held.
type Occurrence struct {
	RendezVous
	// Key: the occurrence's own name (its id and day), what joins and posts are kept under.
	Key   string    `json:"key"`
	From  time.Time `json:"from"`
	Until time.Time `json:"until"`
	// Commune: where it's held (Featured), "" otherwise.
	Commune string `json:"commune,omitempty"`
}

// Live reports whether it's on at that moment.
func (o Occurrence) Live(now time.Time) bool { return !now.Before(o.From) && now.Before(o.Until) }

// OccurrenceKey: « dames-samedi:20261114 ».
func OccurrenceKey(id string, start time.Time) string {
	return id + ":" + start.UTC().Format("20060102")
}

// FeaturedCommune: the commune a featured rendez-vous is held in that day, one of the communes
// given (Abidjan's), drawn by the day and the rendez-vous, never the same two days in a row.
func FeaturedCommune(id string, start time.Time, communes []string) string {
	if len(communes) == 0 {
		return ""
	}
	pick := func(day int64) int {
		f := fnv.New32a()
		fmt.Fprintf(f, "%s:%d", id, day)
		return int(f.Sum32() % uint32(len(communes)))
	}
	day := start.UTC().Unix() / 86400
	i := pick(day)
	// Never the commune of the day before (with one commune, it's that one).
	if len(communes) > 1 && i == pick(day-1) {
		i = (i + 1) % len(communes)
	}
	return communes[i]
}

// OccurrencesBetween: the times the rendez-vous given are held over [from, to) (overlapping it),
// in start order; communes: those a featured one may be held in.
func OccurrencesBetween(list []RendezVous, from, to time.Time, communes []string) []Occurrence {
	var out []Occurrence
	from, to = from.UTC(), to.UTC()
	// From the day before (a night that began yesterday still on) to the last day.
	first := time.Date(from.Year(), from.Month(), from.Day()-1, 0, 0, 0, 0, time.UTC)
	for day := first; day.Before(to); day = day.AddDate(0, 0, 1) {
		for _, r := range list {
			on := false
			for _, d := range r.Days {
				on = on || d == day.Weekday()
			}
			if !on {
				continue
			}
			start := day.Add(time.Duration(r.Start) * time.Minute)
			end := start.Add(time.Duration(r.Length) * time.Minute)
			if !end.After(from) || !start.Before(to) {
				continue
			}
			o := Occurrence{RendezVous: r, Key: OccurrenceKey(r.ID, start), From: start, Until: end}
			if r.Featured {
				o.Commune = FeaturedCommune(r.ID, start, communes)
			}
			out = append(out, o)
		}
	}
	// In start order (a few dozen at most: insertion sort).
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j].From.Before(out[j-1].From); j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out
}
