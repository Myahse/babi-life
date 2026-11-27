package game

import "slices"

// L'espace on Earth (the update « espace »; world/espaceTerre.go, sims/espaceTerre.go; web world3d/espace/
// spatioport.tsx): what one does round the four spaceports without flying up there. The visitor centre (the
// Calao's full-size mock-up, the control room behind its glass), the launch watched from the beach (free), the
// Albatros 0G's parabolic flight from the town's airport, the tourist centrifuge, and the suborbital hop from
// the pad (four minutes weightless, the Earth's curve). They give mood and skills, never Djai (docs/economie.md
// « L'espace »): their prices are what they cost, nothing pays back.

// VisiteursKind: the agency's visitor centres (Sassandra, Kourou, Canaveral; world/espaceTerre.go): the guide's
// workplace too (espaceCarriere.go GuideCareer).
const VisiteursKind = "astrelia-visiteurs"

// The activities' ids.
const (
	ActVisiteurs   = "espace-visiteurs"
	ActCentrifuge  = "espace-centrifugeuse"
	ActPlage       = "espace-plage-lancement"
	ActSteppe      = "espace-steppe-lancement"
	ActAlbatros    = "espace-albatros"
	ActSuborbital  = "espace-saut-suborbital"
	PriceVisiteurs = 15_000
	PriceCentri    = 25_000
	PriceAlbatros  = 150_000
)

// The visitor centres (Baïkonour's is the cosmodrome's museum), the beaches the launches are watched from,
// and the spaceports' towns' airports (the Albatros 0G's).
var (
	// (Baïkonour's is the cosmodrome's museum, a « culture »: the activities there by its id.)
	espaceMusee     = []string{"baikonour-musee"}
	espacePlages    = []string{"sassandra-plage", "kourou-plage", "canaveral-jetee", "canaveral-playalinda"}
	espaceAeroports = []string{"sassandra-aeroport", "kourou-aeroport", "canaveral-aeroport", "baikonour-aeroport"}
)

// WatchFrom: the spaceport whose launches are watched from this place (the beach's, the steppe's river bank).
var WatchFrom = map[string]string{
	"sassandra-plage-lancements": "sassandra", "sassandra-plage": "sassandra", "kourou-plage": "kourou",
	"canaveral-jetee": "cap-canaveral", "canaveral-playalinda": "cap-canaveral", "baikonour-syr-daria": "baikonour",
}

// EspaceTerreActs: the Earth's space activities, by kind of place.
var EspaceTerreActs = map[string][]Interaction{
	VisiteursKind: {
		{ID: ActVisiteurs, Label: "Visiter le centre des visiteurs : la Calao grandeur nature, la salle de contrôle", Icon: "rocket", Minutes: 2 * 60, Cost: PriceVisiteurs, Effect: Needs{Fun: 45, Social: 5, Energy: -10}, MinHour: 9, MaxHour: 18},
		{ID: ActCentrifuge, Label: "Faire un tour de centrifugeuse (jusqu'à 4 G)", Icon: "orbit", Minutes: 30, Cost: PriceCentri, Effect: Needs{Fun: 40, Energy: -10, Hunger: -5}, MinHour: 9, MaxHour: 18, Ages: TeensUp},
	},
	"culture": {
		{ID: ActVisiteurs, Label: "Visiter le centre des visiteurs : la Calao grandeur nature, la salle de contrôle", Icon: "rocket", Minutes: 2 * 60, Cost: PriceVisiteurs, Effect: Needs{Fun: 45, Social: 5, Energy: -10}, MinHour: 9, MaxHour: 18, Places: espaceMusee},
		{ID: ActCentrifuge, Label: "Faire un tour de centrifugeuse (jusqu'à 4 G)", Icon: "orbit", Minutes: 30, Cost: PriceCentri, Effect: Needs{Fun: 40, Energy: -10, Hunger: -5}, MinHour: 9, MaxHour: 18, Ages: TeensUp, Places: espaceMusee},
	},
	"beach": {
		{ID: ActPlage, Label: "Regarder un lancement de la Calao depuis la plage", Icon: "rocket", Minutes: 40, Effect: Needs{Fun: 35, Social: 10}, Places: espacePlages},
	},
	"nature": {
		{ID: ActPlage, Label: "Regarder un lancement de la Calao depuis la plage", Icon: "rocket", Minutes: 40, Effect: Needs{Fun: 35, Social: 10}, Places: []string{"sassandra-plage-lancements"}},
		{ID: ActSteppe, Label: "Regarder un lancement depuis la steppe, au bord du Syr-Daria", Icon: "rocket", Minutes: 40, Effect: Needs{Fun: 35, Social: 10}, Places: []string{"baikonour-syr-daria"}},
	},
	"aeroport": {
		{ID: ActAlbatros, Label: "Vol parabolique à bord de l'Albatros 0G : quinze paraboles en apesanteur", Icon: "plane", Minutes: 2 * 60, Cost: PriceAlbatros, Effect: Needs{Fun: 60, Energy: -15, Hunger: -10}, MinHour: 8, MaxHour: 17, Ages: Adults, Places: espaceAeroports},
	},
	SpatioportKind: {
		{ID: ActSuborbital, Label: "Saut suborbital dans la Pirogue : quatre minutes en apesanteur, la Terre toute ronde", Icon: "rocket", Minutes: 90, Cost: PriceSuborbital, Effect: Needs{Fun: 80, Energy: -20, Hunger: -10}, MinHour: 7, MaxHour: 19, Ages: Adults},
	},
}

// espaceSkills: the skill each one trains, and how fast (SkillOf).
var espaceSkills = map[string]struct {
	skill string
	rate  float64
}{
	ActVisiteurs:  {"logique", 1},
	ActCentrifuge: {"forme", 1.3},
	ActAlbatros:   {"forme", 1.2},
	ActSuborbital: {"forme", 1},
}

// EspaceSkillOf: the skill a space activity on Earth trains ("" when none: game/vie.go SkillOf asks it first).
func EspaceSkillOf(id string) (string, float64) {
	s := espaceSkills[id]
	return s.skill, s.rate
}

func init() {
	Kinds[VisiteursKind] = PlaceKind{ID: VisiteursKind, Label: "Centre des visiteurs", Icon: "rocket", Events: []RandomEvent{
		{Text: "Un groupe d'écoliers colle le nez à la vitre de la salle de contrôle.", Effect: Needs{Fun: 6, Social: 4}},
		{Text: "Sous la Calao grandeur nature, tout le monde se prend en photo.", Effect: Needs{Fun: 6}},
	}}
	addActs(EspaceTerreActs)
	// The guide works at the visitor centres too.
	for i, c := range Careers {
		if c.ID == GuideCareer && !slices.Contains(c.Also, VisiteursKind) {
			Careers[i].Also = append(Careers[i].Also, VisiteursKind)
		}
	}
	EspaceActs[EspaceKey] = append(EspaceActs[EspaceKey], ActVisiteurs, ActCentrifuge, ActPlage, ActSteppe, ActAlbatros, ActSuborbital)
	Moodlets["apesanteur"] = MoodletDef{"J'ai flotté en apesanteur", "orbit", 3, 240}
	Moodlets["lancement-vu"] = MoodletDef{"J'ai vu partir une fusée", "rocket", 2, 180}
}

// LaunchDuring: the first crewed or cargo launch (not « reporté ») from that spaceport in [from, to), if any.
func LaunchDuring(spaceport string, from, to int64) (Launch, bool) {
	for _, l := range LaunchTimetable(spaceport, from, to) {
		if !l.Scrub {
			return l, true
		}
	}
	return Launch{}, false
}
