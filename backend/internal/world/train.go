package world

import "github.com/myahse/babi-life/backend/internal/game"

// The train: the real railway from Abidjan to the north (the line to Ouagadougou, its stations where
// OpenStreetMap has them). Two services in the game, both on it:
//   - the « train de banlieue » in Abidjan, from the Gare de Treichville up through the Plateau, Adjamé
//     and Abobo to Anyama: a ticket, a train every so often, all day;
//   - the « grandes lignes » train to Bouaké, two a day, from the same stations.
// Not the métro (world/metro.go, line 1, in works): the railway already runs. The operator's name is the
// game's (invented brands only); the fares and the times are the game's rules.

// TrainStation is a station on the line: its city and commune (one gets on and off there), its name,
// where it is (OpenStreetMap), and how far along the line from Treichville.
type TrainStation struct {
	City    string  `json:"city"`
	Commune string  `json:"commune"`
	Name    string  `json:"name"`
	Lat     float64 `json:"lat"`
	Lng     float64 `json:"lng"`
	Km      float64 `json:"km"`
}

type TrainLine struct {
	Company  string         `json:"company"`
	Stations []TrainStation `json:"stations"`
	// In Abidjan: one ticket (Djai), a train every Every game minutes from First to Last (minutes
	// after midnight), PerKm game minutes a km on the way, at least Min.
	Fare  int `json:"fare"`
	Every int `json:"every"`
	First int `json:"first"`
	Last  int `json:"last"`
	// To Bouaké: the ticket, and the departures (minutes after midnight); the journey, game minutes.
	LongFare    int          `json:"longFare"`
	LongDeparts []int        `json:"longDeparts"`
	LongMinutes int          `json:"longMinutes"`
	Source      *game.Source `json:"source,omitempty"`
}

var Train = TrainLine{
	Company: "Ébène Rail",
	Stations: []TrainStation{
		{"abidjan", "treichville", "Gare de Treichville", 5.29700, -4.00600, 0},
		{"abidjan", "plateau", "Gare du Plateau", 5.31800, -4.01800, 3},
		{"abidjan", "adjame", "Gare d'Adjamé", 5.35700, -4.02500, 7},
		{"abidjan", "abobo", "Halte d'Abobo", 5.42000, -4.02000, 14},
		{"abidjan", "anyama", "Halte d'Anyama", 5.49400, -4.05200, 23},
		{"bouake", "bouake-centre", "Gare de Bouaké", 7.69000, -5.02600, 316},
	},
	Fare: 300, Every: 25, First: 5*60 + 30, Last: 21 * 60,
	LongFare: 6500, LongDeparts: []int{7 * 60, 14*60 + 30}, LongMinutes: 330,
	Source: &game.Source{Status: game.StatusPartial, Checked: game.Checked, Note: "La voie ferrée Abidjan – Ouagadougou et ses gares d'Abidjan (Treichville, Plateau, Adjamé, Abobo, Anyama) et de Bouaké existent (OpenStreetMap) ; le nom de la compagnie, les horaires, les prix et la durée sont des règles du jeu."},
}

// trainStop: the station of a city's commune on the line, or -1.
func trainStop(city, commune string) int {
	for i, s := range Train.Stations {
		if s.City == city && s.Commune == commune {
			return i
		}
	}
	return -1
}

// TrainQuote: from one station's commune to another's. In Abidjan, the banlieue train: the wait for the
// next one is part of the trip. To or from Bouaké, the grande ligne, from the next departure. The way it
// goes by the stations between (points as [lng, lat]); long: a grande ligne; departs: when it leaves
// (game minutes), false when none is left today.
func TrainQuote(fromCity, fromCommune, toCity, toCommune string, now int64) (minutes int64, fare int, path Path, long bool, departs int64, ok bool) {
	a, b := trainStop(fromCity, fromCommune), trainStop(toCity, toCommune)
	if a < 0 || b < 0 || a == b {
		return 0, 0, Path{}, false, 0, false
	}
	step := 1
	if b < a {
		step = -1
	}
	for i := a; ; i += step {
		s := Train.Stations[i]
		path.Points = append(path.Points, [2]float64{s.Lng, s.Lat})
		if i == b {
			break
		}
	}
	km := Train.Stations[b].Km - Train.Stations[a].Km
	if km < 0 {
		km = -km
	}
	path.Km = km
	long = Train.Stations[a].City != Train.Stations[b].City
	if long {
		day := now - now%(24*60)
		at := int(now % (24 * 60))
		departs = -1
		for _, d := range Train.LongDeparts {
			if d >= at {
				departs = day + int64(d)
				break
			}
		}
		if departs < 0 {
			return 0, 0, Path{}, true, 0, false
		}
		return departs - now + int64(Train.LongMinutes), Train.LongFare, path, true, departs, true
	}
	at, okNext := game.NextCoach(now, Train.Every, Train.First, Train.Last)
	if !okNext {
		return 0, 0, Path{}, false, 0, false
	}
	return at - now + int64(2+km*1.5), Train.Fare, path, false, at, true
}
