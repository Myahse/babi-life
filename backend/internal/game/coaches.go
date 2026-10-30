package game

import "fmt"

// The intercity coaches (« les cars »), the update « voyages-villes »: every
// city has its gare routière, and from it a coach line to every other city,
// run by one of the game's coach companies (invented names, like every brand
// in the game: the real ones, UTB and the others, are left to the real roads).
// A coach leaves at set hours, is much cheaper and much slower than the plane
// (its time and fare are the road's: world.TripPath), and tires one out
// (RoadEffect). Babies and children don't take it alone (sims: errTooSmallToTravel).

// TravelKey: the update that brings the coaches, the airport of Grand-Bassam
// and the trips seen in 3D (boarding, the short loading screen, the arrival).
const TravelKey = "voyages-villes"

// AirlineApp: the airline's app on the phone (world.PhoneApps), under the same update.
const AirlineApp = "airlagune"

// Gare: a city's gare routière, where its coaches leave from and arrive (world/world.go).
type Gare struct{ City, Commune, Place string }

// Gares: one per city.
var Gares = map[string]Gare{
	"abidjan":      {"abidjan", "adjame", "adjame-gare"},
	"yamoussoukro": {"yamoussoukro", "yakro-centre", "yakro-gare"},
	"bouake":       {"bouake", "bouake-centre", "bouake-gare"},
	"grand-bassam": {"grand-bassam", "bassam-france", "bassam-gare"},
	"san-pedro":    {"san-pedro", "sp-centre", "sp-gare"},
	"man":          {"man", "man-centre", "man-gare"},
	"korhogo":      {"korhogo", "korhogo-centre", "korhogo-gare"},
	"daloa":        {"daloa", "daloa-centre", "daloa-gare"},
}

// CoachCompany: one of the game's coach companies, its livery for the 3D coach.
type CoachCompany struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Body   string `json:"body"`   // the coach's paint
	Stripe string `json:"stripe"` // its band
}

// CoachCompanies: invented names only (game rule: invented brands).
var CoachCompanies = []CoachCompany{
	{ID: "savane", Name: "Savane Lignes", Body: "#f4f1e6", Stripe: "#2f9e44"},
	{ID: "gbe", Name: "Gbê Express", Body: "#ff7a00", Stripe: "#1c1c1e"},
	{ID: "cotebleue", Name: "Côte Bleue Cars", Body: "#e7f1fb", Stripe: "#1d4ed8"},
}

// CoachCompanyOf: who runs the line between two cities: the north (Bouaké,
// Korhogo) is Savane Lignes', the west (Man, Daloa) Gbê Express's, the coast
// and the centre Côte Bleue Cars'.
func CoachCompanyOf(a, b string) CoachCompany {
	in := func(ids ...string) bool {
		for _, id := range ids {
			if a == id || b == id {
				return true
			}
		}
		return false
	}
	switch {
	case in("korhogo", "bouake"):
		return CoachCompanies[0]
	case in("man", "daloa"):
		return CoachCompanies[1]
	}
	return CoachCompanies[2]
}

// The coaches' hours: the first leaves at 5 h, the last at 21 h (22 h on a
// short line); between, one every 20, 30 or 60 minutes, the further the rarer.
const (
	CoachFirstHour     = 5
	coachLastHour      = 21
	coachShortLastHour = 22
)

// CoachTimetable: how often a coach leaves on a line of that many road km,
// and the hour of the last one (game minutes after midnight).
func CoachTimetable(roadKm float64) (every, first, last int) {
	switch {
	case roadKm < 80:
		return 20, CoachFirstHour * 60, coachShortLastHour * 60
	case roadKm < 350:
		return 30, CoachFirstHour * 60, coachLastHour * 60
	}
	return 60, CoachFirstHour * 60, coachLastHour * 60
}

// NextCoach: the first departure at or after now (game minutes) on a line of
// that timetable, and false when the day's last has gone (none at night).
func NextCoach(now int64, every, first, last int) (int64, bool) {
	day := now - now%(24*60)
	at := int(now % (24 * 60))
	if at > last {
		return 0, false
	}
	if at <= first {
		return day + int64(first), true
	}
	n := (at - first + every - 1) / every
	return day + int64(first+n*every), true
}

// ClockLabel: a game minute as the board writes it (« 14 h 30 »).
func ClockLabel(m int64) string {
	h, mn := (m/60)%24, m%60
	if mn == 0 {
		return fmt.Sprintf("%d h", h)
	}
	return fmt.Sprintf("%d h %02d", h, mn)
}
