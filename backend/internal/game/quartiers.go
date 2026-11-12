package game

import (
	"maps"
	"slices"
)

// The communes in detail (the update « communes-detail »): the carrefours and rond-points everybody
// knows and gives as a meeting point (« Retrouve-moi au carrefour Siporex »), the préfectures and
// sous-préfectures, each at its real spot (world quartiers.go). What's done there is small and of the
// street: waiting for someone, a garba from the woman at the corner, watching the gbakas go by.

// CommunesDetailKey is the update.
const CommunesDetailKey = "communes-detail"

// QuartierActs: what's done at a carrefour and at a préfecture, by kind.
var QuartierActs = map[string][]Interaction{
	"carrefour": {
		{ID: "carrefour-rdv", Label: "Attendre un ami au carrefour", Icon: "users", Minutes: 20, Effect: Needs{Social: 20, Fun: 5}},
		{ID: "carrefour-garba", Label: "Manger un garba chez la tantie du carrefour", Icon: "fish", Minutes: 20, Cost: 600, Effect: Needs{Hunger: 40, Social: 5}, MinHour: 6, MaxHour: 23},
		{ID: "carrefour-credit", Label: "Prendre du crédit au kiosque", Icon: "smartphone", Minutes: 10, Cost: 500, Effect: Needs{Social: 10}, MinHour: 6, MaxHour: 23},
		{ID: "carrefour-regarder", Label: "Regarder passer les gbakas et les woro-woro", Icon: "eye", Minutes: 20, Effect: Needs{Fun: 12}},
	},
	"prefecture": {
		{ID: "prefecture-legalisation", Ages: Adults, Label: "Faire légaliser un document à la préfecture", Icon: "stamp", Minutes: 60, Cost: 500, Effect: Needs{Fun: -10, Social: 5}, MinHour: 8, MaxHour: 16, Days: Weekdays},
		{ID: "prefecture-ceremonie", Label: "Assister à une cérémonie officielle devant la préfecture", Icon: "flag", Minutes: 45, Effect: Needs{Social: 15, Fun: 10}, MinHour: 9, MaxHour: 12, Days: []int{Lundi, Samedi}},
	},
}

var quartierKinds = map[string]PlaceKind{
	"carrefour": {ID: "carrefour", Label: "Carrefour", Icon: "signpost",
		Events: []RandomEvent{
			{Text: "Un apprenti de gbaka crie la destination à pleins poumons : « Adjamé-Adjamé ! »", Effect: Needs{Fun: 5}},
			{Text: "Ton ami arrive en retard, comme d'habitude : « J'étais dans gbaka, on a gâté route ! »", Effect: Needs{Social: 10, Fun: 5}},
			{Text: "Le feu est en panne : un policier règle la circulation au sifflet, tout le monde klaxonne.", Effect: Needs{Fun: 5}},
		}},
	"prefecture": {ID: "prefecture", Label: "Préfecture", Icon: "landmark"},
}

func init() {
	for id, k := range quartierKinds {
		Kinds[id] = k
	}
	addActs(QuartierActs)
}

// QuartierIDs: the activities the update brings (features.go).
func QuartierIDs() []string {
	var out []string
	for _, kind := range slices.Sorted(maps.Keys(QuartierActs)) {
		for _, it := range QuartierActs[kind] {
			out = append(out, it.ID)
		}
	}
	return out
}
