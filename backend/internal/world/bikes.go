package world

// Vélo Babi, the bikes to hire in Abidjan: a station in each commune, at its heart, a few bikes in its
// racks. One takes a bike for a while, paid with Waye (sims/bikes.go); when the time is up it locks (one
// pays again to go on); left somewhere, after a while it goes back to its station by itself. The name,
// the stations, the bikes and the prices are the game's (invented brands only).

// BikeBrand: the service's name, on the stations and the bikes.
const BikeBrand = "Vélo Babi"

// BikeDock is a station: its commune, where it stands, how many bikes its racks hold.
type BikeDock struct {
	ID      string  `json:"id"`
	City    string  `json:"city"`
	Commune string  `json:"commune"`
	Lat     float64 `json:"lat"`
	Lng     float64 `json:"lng"`
	Bikes   int     `json:"bikes"`
}

// BikePlan is a hire: so many real minutes for so many Djai.
type BikePlan struct {
	ID      string `json:"id"`
	Minutes int    `json:"minutes"`
	Price   int    `json:"price"`
}

var BikePlans = []BikePlan{{"15", 15, 150}, {"30", 30, 250}, {"60", 60, 400}}

// BikeRacks: the bikes a station holds.
const BikeRacks = 10

// BikeDocks: one station in each of Abidjan's communes, at its heart.
func BikeDocks() []BikeDock {
	city, ok := FindCity("abidjan")
	if !ok {
		return nil
	}
	out := make([]BikeDock, 0, len(city.Communes))
	for _, c := range city.Communes {
		out = append(out, BikeDock{ID: "velo-" + c.ID, City: city.ID, Commune: c.ID, Lat: c.Lat, Lng: c.Lng, Bikes: BikeRacks})
	}
	return out
}

// FindBikeDock: a station by its id.
func FindBikeDock(id string) (BikeDock, bool) {
	for _, d := range BikeDocks() {
		if d.ID == id {
			return d, true
		}
	}
	return BikeDock{}, false
}

// FindBikePlan: a hire by its id.
func FindBikePlan(id string) (BikePlan, bool) {
	for _, p := range BikePlans {
		if p.ID == id {
			return p, true
		}
	}
	return BikePlan{}, false
}
