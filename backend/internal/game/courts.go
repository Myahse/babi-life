package game

import (
	"slices"
	"sort"
)

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
	// Tennis (the update « tennis », web sports/tennis.ts): the club's clay at Cocody, the Plateau's hard court, the Hôtel Ivoire's.
	"cocody-tennis":  "tennis",
	"plateau-tennis": "tennis",
	HotelIvoireID:    "tennis",
	// Beach-volley, two against two on the sand (the update « volley », web sports/volley.ts): Port-Bouët's beach, Grand-Bassam's.
	"pb-plage":    "beach",
	BassamPlageID: "beach",
}

// MoreCourts: a second game at a court, with its own match beside the first (the Palais des Sports'
// volleyball, six against six, beside its basketball).
var MoreCourts = map[string][]string{"treich-palais": {"volley"}}

// IsCourt: whether this place is a court of this sport.
func IsCourt(place, sport string) bool {
	return Courts[place] == sport || slices.Contains(MoreCourts[place], sport)
}

// CourtKey: the place a match is kept under (package court holds one match per key): the court itself for
// its first game, the court and the game for a second one (the Palais' volleyball doesn't wait for its basketball).
func CourtKey(place, sport string) string {
	if Courts[place] == sport || Courts[place] == "" {
		return place
	}
	return place + "#" + sport
}

// courtsFor: the courts of one sport, for an interaction's Places.
func courtsFor(sport string) []string {
	var out []string
	for id, s := range Courts {
		if s == sport {
			out = append(out, id)
		}
	}
	for id, more := range MoreCourts {
		if slices.Contains(more, sport) {
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
	case TennisID, HotelTennisID:
		return "tennis"
	case VolleyID:
		return "volley"
	case BeachVolleyID:
		return "beach"
	}
	return ""
}

// Foot11ID: eleven against eleven on the stadium's pitch (court.Cap: 22 players).
const Foot11ID = "play-foot11"

// The racket and net games (update « tennis », « volley »): tennis at the courts (and at the Hôtel Ivoire's,
// its own line on the hotel's sheet), volleyball at the Palais des Sports, beach-volley on the beaches.
const (
	TennisID      = "play-tennis"
	HotelTennisID = "hotel-tennis"
	VolleyID      = "play-volley"
	BeachVolleyID = "play-beach-volley"
)

func init() {
	for _, kind := range []string{"sport", StadiumKind, "hotel", "beach"} {
		k := Kinds[kind]
		for i, it := range k.Interactions {
			if s := CourtSport(it.ID); s != "" {
				k.Interactions[i].Places = courtsFor(s)
			}
		}
		Kinds[kind] = k
	}
}
