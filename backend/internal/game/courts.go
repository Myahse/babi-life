package game

import "sort"

// Courts: the only places where one plays football or basketball, by sport.
// The other sports grounds of the map (OpenStreetMap's pitches) are scenery:
// a fixed few, where everyone meets, fill up with players (court.Cap) and
// friends end up in the same match (package court).
var Courts = map[string]string{
	"cocody-ufhb":       "foot",
	"abobo-terrain":     "foot",
	"koumassi-terrain":  "foot",
	"yop-terrain":       "foot",
	"marcory-terrain":   "foot",
	"cocody-basket":     "basket",
	"yop-basket":        "basket",
	"plateau-basket":    "basket",
	"treich-palais":     "basket",
	"portbouet-terrain": "foot",
	// The stadium's pitch, eleven against eleven, between its matches and concerts (stadium.go).
	"plateau-stade": "foot11",
}

// courtsFor: the courts of one sport, for an interaction's Places.
func courtsFor(sport string) []string {
	var out []string
	for id, s := range Courts {
		if s == sport {
			out = append(out, id)
		}
	}
	sort.Strings(out)
	return out
}

// CourtSport: the sport an interaction plays at a court ("" for the rest).
func CourtSport(interaction string) string {
	switch interaction {
	case "play-football":
		return "foot"
	case "play-basket":
		return "basket"
	case Foot11ID:
		return "foot11"
	}
	return ""
}

// Foot11ID: eleven against eleven on the stadium's pitch (court.Cap: 22 players).
const Foot11ID = "play-foot11"

func init() {
	for _, kind := range []string{"sport", StadiumKind} {
		k := Kinds[kind]
		for i, it := range k.Interactions {
			if s := CourtSport(it.ID); s != "" {
				k.Interactions[i].Places = courtsFor(s)
			}
		}
		Kinds[kind] = k
	}
}
