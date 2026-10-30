package world

import "github.com/myahse/babi-life/backend/internal/game"

// CoachPath: the coach between two cities' gares routières (game.Gares): the
// road (world.TripPath's, between the two gares' communes), its time and fare,
// the commune one gets off in, and the company that runs the line.
func CoachPath(fromCity, toCity string) (minutes int64, fare int, path Path, landIn Commune, company game.CoachCompany, ok bool) {
	a, okA := game.Gares[fromCity]
	b, okB := game.Gares[toCity]
	if !okA || !okB || fromCity == toCity {
		return 0, 0, Path{}, Commune{}, game.CoachCompany{}, false
	}
	fc, fm, ok1 := FindCommune(a.City, a.Commune)
	tc, tm, ok2 := FindCommune(b.City, b.Commune)
	if !ok1 || !ok2 || fm.ID == "" || tm.ID == "" {
		return 0, 0, Path{}, Commune{}, game.CoachCompany{}, false
	}
	minutes, fare, path = TripPath(fc, fm, tc, tm)
	return minutes, fare, path, tm, game.CoachCompanyOf(fromCity, toCity), true
}

// CoachRoute: a coach line, as the gare's departures board and the map list it.
type CoachRoute struct {
	From    string `json:"from"`  // city
	Place   string `json:"place"` // its gare routière
	To      string `json:"to"`
	ToName  string `json:"toName"`
	Commune string `json:"commune"` // where one gets off
	ToPlace string `json:"toPlace"` // the gare one arrives at
	Minutes int64  `json:"minutes"` // real minutes, as the trip lasts
	Game    int64  `json:"game"`    // game minutes on the road, as the timetable says
	Fare    int    `json:"fare"`
	Km      int    `json:"km"` // by road
	Company string `json:"company"`
	// The timetable: one every `every` minutes, from `first` to `last` (minutes after midnight).
	Every int `json:"every"`
	First int `json:"first"`
	Last  int `json:"last"`
}

// CoachRoutes: every coach line there is, both ways (every city to every other).
func CoachRoutes() []CoachRoute {
	var out []CoachRoute
	for _, from := range Cities {
		g, ok := game.Gares[from.ID]
		if !ok {
			continue
		}
		for _, to := range Cities {
			minutes, fare, path, landIn, co, ok := CoachPath(from.ID, to.ID)
			if !ok {
				continue
			}
			every, first, last := game.CoachTimetable(path.Km)
			out = append(out, CoachRoute{From: from.ID, Place: g.Place, To: to.ID, ToName: to.Name, Commune: landIn.ID, ToPlace: game.Gares[to.ID].Place, Minutes: game.Length(minutes), Game: minutes, Fare: fare, Km: int(path.Km), Company: co.ID, Every: every, First: first, Last: last})
		}
	}
	return out
}
