package game

// La plage de Grand-Bassam (world: bassam-plage), what's done there beyond the bathe and the braised fish
// of every beach: the surf in the rollers, the jet-ski and the ski nautique out past the bar, beach-volley
// on the sand, the swimming lesson and the dive with the maître-nageur, and the beach party on Friday and
// Saturday nights. Shown in 3D in the beach's scene (web world3d/interior/BeachScene.tsx); all of it opens
// with the update « bassam-plage » (features).

// BassamPlageID is Grand-Bassam's beach.
const BassamPlageID = "bassam-plage"

// BassamVolleyID: the beach's first beach-volley, a passive activity, replaced by the real match
// (BeachVolleyID, courts.go) once the update « volley » is open (features: Replaces).
const BassamVolleyID = "beach-volley"

// BassamKey is the update that opens it.
const BassamKey = "bassam-plage"

// BassamActivities: the beach's own, its ID's order kept for the update's list.
var BassamActivities = []Interaction{
	{ID: "surf-cours", Ages: TeensUp, Label: "Prendre un cours de surf", Icon: "waves", Minutes: 60, Cost: 8000, Effect: Needs{Fun: 35, Energy: -25, Hygiene: -10, Social: 10}, MinHour: 8, MaxHour: 17, Places: []string{BassamPlageID}},
	{ID: "surf", Ages: TeensUp, Label: "Surfer les vagues (planche louée)", Icon: "waves", Minutes: 45, Cost: 3000, Effect: Needs{Fun: 40, Energy: -25, Hygiene: -10}, MinHour: 7, MaxHour: 18, Places: []string{BassamPlageID}},
	{ID: "jet-ski", Ages: Adults, Label: "Faire un tour de jet-ski", Icon: "ship", Minutes: 20, Cost: 15000, Effect: Needs{Fun: 45, Energy: -10}, MinHour: 9, MaxHour: 18, Places: []string{BassamPlageID}},
	{ID: "ski-nautique", Ages: TeensUp, Label: "Faire du ski nautique derrière le bateau", Icon: "sailboat", Minutes: 30, Cost: 20000, Effect: Needs{Fun: 50, Energy: -25, Hygiene: -5}, MinHour: 9, MaxHour: 17, Places: []string{BassamPlageID}},
	{ID: BassamVolleyID, Label: "Jouer au beach-volley", Icon: "volleyball", Minutes: 45, Effect: Needs{Fun: 30, Social: 25, Energy: -20, Hygiene: -15}, MinHour: 7, MaxHour: 19, Places: []string{BassamPlageID}},
	{ID: "lecon-natation", Label: "Leçon de natation avec le maître-nageur", Icon: "life-buoy", Minutes: 45, Cost: 3000, Effect: Needs{Fun: 20, Energy: -20, Social: 10}, MinHour: 8, MaxHour: 17, Places: []string{BassamPlageID}},
	{ID: "plongee", Ages: TeensUp, Label: "Baptême de plongée avec un moniteur", Icon: "fish", Minutes: 60, Cost: 25000, Effect: Needs{Fun: 50, Energy: -20}, MinHour: 8, MaxHour: 16, Places: []string{BassamPlageID}},
	// The beach party: Friday and Saturday nights, the sound system on the sand, the fire, the dancing to 2 h.
	{ID: "beach-party", Ages: TeensUp, Label: "Faire la fête à la beach party", Icon: "party-popper", Minutes: 180, Cost: 5000, Effect: Needs{Fun: 55, Social: 45, Energy: -35}, MinHour: 20, MaxHour: 2, Days: []int{4, 5}, Places: []string{BassamPlageID}},
}

// BassamEvents: what may happen on Bassam's beach.
var BassamEvents = []RandomEvent{
	{Text: "Le maître-nageur siffle : drapeau rouge, on ne va pas plus loin que la barre à Bassam !", Effect: Needs{Fun: -3}},
	{Text: "Tu as tenu debout sur ta planche jusqu'au bord. Les gens applaudissent depuis les paillotes !", Effect: Needs{Fun: 10, Social: 8}},
}

// BassamIDs: the activities' IDs (the update's list).
func BassamIDs() []string {
	ids := make([]string, len(BassamActivities))
	for i, a := range BassamActivities {
		ids[i] = a.ID
	}
	return ids
}
