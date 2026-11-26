package game

// The seasons of the south and of the desert (the updates « pays-oceanie », « pays-moyen-orient »): what
// happens in the streets there by the month. In Oceania the seasons are upside down: Christmas and the New Year
// on the beach in the heat of summer, the cold wind of the austral winter in July. In the Gulf, the sand wind of
// spring and the great heat of summer. Only in those cities (Happening.Cities); the update hides the cities.
var southHappenings = []Happening{
	{ID: "noel-plage", Category: "saison", Source: Fictional, Label: "Noël en été", Icon: "tree-palm", MinHour: 10, MaxHour: 20, Months: []int{12}, Weight: 6,
		Cities: []string{"sydney", "melbourne", "brisbane", "perth", "canberra", "auckland", "wellington", "suva", "noumea", "papeete", "apia", "nukualofa", "port-vila", "port-moresby"},
		Text:   "C'est Noël… en plein été : bonnets rouges en short, pique-niques et barbecues sur la plage.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Pique-niquer en bonnet de Noël à la plage", Icon: "tree-palm", Minutes: 60, Cost: 3000, Effect: Needs{Fun: 35, Social: 30, Hunger: 20}}},
	{ID: "hiver-austral", Category: "saison", Source: Fictional, Label: "Hiver austral", Icon: "snowflake", MinHour: 6, MaxHour: 22, Months: []int{6, 7, 8}, Weight: 3,
		Cities: []string{"melbourne", "canberra", "wellington", "auckland", "sydney"},
		Text:   "Juillet, au sud : le vent froid descend de l'Antarctique, on ressort les pulls et les bonnets.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Se réchauffer avec une soupe dans un café", Icon: "soup", Minutes: 30, Cost: 4000, Effect: Needs{Hunger: 30, Social: 15, Fun: 10}}},
	{ID: "vent-de-sable", Category: "saison", Source: Fictional, Label: "Vent de sable", Icon: "cloud-rain", MinHour: 9, MaxHour: 19, Months: []int{3, 4, 5, 6}, Weight: 3,
		Cities: []string{"dubai", "abou-dhabi", "riyad", "doha", "koweit", "manama", "bagdad"},
		Text:   "Le ciel devient jaune : un vent de sable souffle sur la ville, chacun se met à l'abri.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Attendre la fin du vent de sable à l'abri, un thé à la main", Icon: "coffee", Minutes: 45, Effect: Needs{Social: 15, Energy: 10}}},
	{ID: "grande-chaleur", Category: "saison", Source: Fictional, Label: "Grande chaleur", Icon: "thermometer", MinHour: 11, MaxHour: 17, Months: []int{6, 7, 8}, Weight: 4,
		Cities: []string{"dubai", "abou-dhabi", "riyad", "djeddah", "la-mecque", "medine", "doha", "koweit", "manama", "mascate", "bagdad"},
		Text:   "Quarante-cinq degrés à l'ombre : la rue se vide, tout le monde attend le soir dans la fraîcheur.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Se mettre au frais dans un mall climatisé", Icon: "snowflake", Minutes: 60, Effect: Needs{Fun: 15, Energy: 15}}},
}

// southChoices: what there is to do at each, played (« evenements-joues », happenings_joues.go): its join, and this.
var southChoices = map[string]EventChoice{
	"noel-plage":     ch("noel-plage-baignade", "Se baigner le jour de Noël", "waves", 45, 0, Needs{Fun: 35, Social: 15, Energy: -10, Hygiene: -5}),
	"hiver-austral":  ch("hiver-austral-marche", "Marcher vite dans le vent, le col relevé", "footprints", 20, 0, Needs{Fun: 10, Energy: -5}),
	"vent-de-sable":  ch("vent-de-sable-foulard", "Se couvrir le visage d'un foulard et continuer", "footprints", 20, 0, Needs{Fun: 5, Hygiene: -10}),
	"grande-chaleur": ch("grande-chaleur-eau", "Boire beaucoup d'eau à l'ombre", "droplet", 20, 500, Needs{Energy: 10, Hunger: 5}),
}

func init() {
	for i := range southHappenings {
		h := &southHappenings[i]
		// The join played as a choice of its own (not kept: those are the matches'), and the other.
		j := ch(h.ID+"-join", h.Join.Label, h.Join.Icon, h.Join.Minutes, h.Join.Cost, h.Join.Effect)
		h.Choices = []EventChoice{j, southChoices[h.ID]}
	}
	Happenings = append(Happenings, southHappenings...)
}
