package game

// Les pays (world/pays.go): the updates that open the game's countries abroad, and their airports
// (flights.go Airports: Air Lagune flies there, its seats priced on the distance).
const (
	BurkinaKey = "pays-burkina"
	USAKey     = "pays-usa"
	CanadaKey  = "pays-canada"
)

func init() {
	for id, a := range map[string]Airport{
		"ouagadougou":    {"ouagadougou", "ouaga-centre", "ouaga-aeroport", BurkinaKey},
		"bobo-dioulasso": {"bobo-dioulasso", "bobo-centre", "bobo-aeroport", BurkinaKey},
		"new-york":       {"new-york", "nyc-queens", "nyc-jfk", USAKey},
		"montreal":       {"montreal", "mtl-dorval", "mtl-aeroport", CanadaKey},
	} {
		Airports[id] = a
	}
}
