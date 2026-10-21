package world

import "github.com/myahse/babi-life/backend/internal/game"

// FlightPath: a flight between two cities' airports (game.Airports): the
// distance as the crow flies, the line on the map, and the commune one lands in.
func FlightPath(fromCity, toCity string) (km float64, path Path, landIn Commune, ok bool) {
	a, okA := game.Airports[fromCity]
	b, okB := game.Airports[toCity]
	if !okA || !okB || fromCity == toCity {
		return 0, Path{}, Commune{}, false
	}
	_, _, pa, okA := FindPlace(a.Place)
	city, cm, pb, okB := FindPlace(b.Place)
	if !okA || !okB || city.ID != toCity {
		return 0, Path{}, Commune{}, false
	}
	km = distanceKm(pa.Lat, pa.Lng, pb.Lat, pb.Lng)
	return km, Path{Points: [][2]float64{{pa.Lng, pa.Lat}, {pb.Lng, pb.Lat}}, Km: float64(int(km*10)) / 10}, cm, true
}

// FlightRoute: one flight on the airline, as the game's phone lists it (the airport's card).
type FlightRoute struct {
	From    string `json:"from"`  // city
	Place   string `json:"place"` // its airport
	To      string `json:"to"`
	ToName  string `json:"toName"`
	Commune string `json:"commune"` // where one lands
	Minutes int64  `json:"minutes"` // real minutes, as the trip lasts
	Fare    int    `json:"fare"`
	Km      int    `json:"km"`
	Airline string `json:"airline"`
}

// FlightRoutes: every flight there is, both ways.
func FlightRoutes() []FlightRoute {
	var out []FlightRoute
	for _, from := range Cities {
		a, ok := game.Airports[from.ID]
		if !ok {
			continue
		}
		for _, to := range Cities {
			km, _, landIn, ok := FlightPath(from.ID, to.ID)
			if !ok {
				continue
			}
			minutes, fare := game.FlightQuote(km)
			out = append(out, FlightRoute{From: from.ID, Place: a.Place, To: to.ID, ToName: to.Name, Commune: landIn.ID, Minutes: game.Length(minutes), Fare: fare, Km: int(km), Airline: game.Airline})
		}
	}
	return out
}
