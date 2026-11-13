package game

import "slices"

// L'armée (the update « armee », sims/armee.go; web components/Caserne.tsx): three ways in, all a game.
//   - The service militaire, from 18, signed at the caserne: a few « semaines de classes » lived there
//     (the lever des couleurs, the parcours du combattant, the garde de nuit, the marche), each drill its
//     own little game; meanwhile the Sim lives at the caserne. At the end, an « Attestation de service ».
//   - The EMPT (École militaire préparatoire technique, Bingerville): a concours played (the written quiz,
//     the épreuve physique), then the internat, its trimestres (the cours, the atelier, the sport, the
//     rassemblement); at the end, its brevet.
//   - The career, soldat to capitaine: missions played as the job's tasks (patrouille, garde au camp, the
//     défilé du 7 août, the aid after a flood: ceremonial and humanitarian, never a fight), promotion by
//     performance like every career; the service done starts it at caporal, the EMPT at sergent.
// The units are the game's own (the « Bataillon des Lagunes »), no real emblem, insignia or document.

// ArmeeKey: the update.
const ArmeeKey = "armee"

// The places' kinds and the career.
const (
	CaserneKind = "caserne"
	EmptKind    = "empt"
	ArmeeCareer = "armee"
	// ArmeeUnit: the game's own unit (invented), on the papers and the contract.
	ArmeeUnit = "Bataillon des Lagunes"
	// CaserneID, EmptID: the two places (world.go).
	CaserneID = "cocody-caserne"
	EmptID    = "bingerville-empt"
)

// The places' actions.
const (
	// At the caserne: signing up for the service, leaving it; joining the army (the career).
	ServiceSignID = "service-engager"
	ServiceQuitID = "service-quitter"
	ArmeeJoinID   = "armee-engager"
	// At the EMPT: the concours' two épreuves; leaving the school.
	EmptEcritID    = "empt-concours-ecrit"
	EmptPhysiqueID = "empt-concours-physique"
	EmptQuitID     = "empt-quitter"
)

// The papers (papiers.go).
const (
	DocService = "attestation-service"
	DocEMPT    = "brevet-empt"
)

// DrillPass: a drill's (or a concours épreuve's) score that counts.
const DrillPass = 50

// EmptMaxAge: the EMPT takes its pupils young (the game opens it to the teens and the young adults).
const EmptMaxAge = 22

// An ArmyProgram: the service's « semaines », the EMPT's « trimestres », each the same drills to pass.
type ArmyProgram struct {
	ID string `json:"id"`
	// Unit: what a round is called (« semaine », « trimestre »).
	Unit   string   `json:"unit"`
	Rounds int      `json:"rounds"`
	Steps  []string `json:"steps"`
	// Place: where it's lived.
	Place string `json:"place"`
	// Start: the career's rung it opens (1: caporal, 2: sergent).
	Start int `json:"start"`
}

// The two programs.
var (
	ServiceProgram = ArmyProgram{ID: "service", Unit: "semaine", Rounds: 3, Steps: []string{"caserne-couleurs", "caserne-parcours", "caserne-garde", "caserne-marche"}, Place: CaserneID, Start: 1}
	EmptProgram    = ArmyProgram{ID: "empt", Unit: "trimestre", Rounds: 3, Steps: []string{"empt-rassemblement", "empt-cours", "empt-atelier", "empt-sport"}, Place: EmptID, Start: 2}
)

// FindArmyProgram: a program by its id.
func FindArmyProgram(id string) (ArmyProgram, bool) {
	switch id {
	case ServiceProgram.ID:
		return ServiceProgram, true
	case EmptProgram.ID:
		return EmptProgram, true
	}
	return ArmyProgram{}, false
}

// ArmeeStartLevel: the career's first rung for a Sim, from what it's done (the EMPT beats the service).
func ArmeeStartLevel(service, empt bool) int {
	switch {
	case empt:
		return EmptProgram.Start
	case service:
		return ServiceProgram.Start
	}
	return 0
}

// DrillMention: the papers' mention, from the drills' average score.
func DrillMention(avg int) string {
	switch {
	case avg >= 90:
		return "Très bien"
	case avg >= 75:
		return "Bien"
	case avg >= 60:
		return "Assez bien"
	}
	return "Passable"
}

var caserneInteractions = []Interaction{
	{ID: ServiceSignID, Label: "S'engager pour le service militaire", Icon: "flag", Minutes: 30, Effect: Needs{Social: 5}, Ages: Adults},
	{ID: ArmeeJoinID, Label: "S'engager dans l'armée (carrière)", Icon: "shield", Minutes: 30, Effect: Needs{Social: 5}, Ages: Adults},
	// The service's drills (ServiceProgram), for a recruit only.
	{ID: "caserne-couleurs", Label: "Le lever des couleurs", Icon: "flag", Minutes: 30, Effect: Needs{Social: 10, Energy: -5}, Ages: Adults},
	{ID: "caserne-parcours", Label: "Le parcours du combattant", Icon: "footprints", Minutes: 90, Effect: Needs{Fun: 10, Energy: -30, Hygiene: -25}, Ages: Adults},
	{ID: "caserne-garde", Label: "La garde de nuit", Icon: "moon", Minutes: 120, Effect: Needs{Energy: -20, Social: 5}, Ages: Adults},
	{ID: "caserne-marche", Label: "La marche au pas, sac au dos", Icon: "backpack", Minutes: 120, Effect: Needs{Energy: -30, Hygiene: -20, Social: 10}, Ages: Adults},
	// The caserne's everyday, for a recruit.
	{ID: "caserne-ordinaire", Label: "Manger à l'ordinaire", Icon: "utensils", Minutes: 40, Effect: Needs{Hunger: 50, Social: 10}, Ages: Adults},
	{ID: "caserne-douche", Label: "La douche de la caserne", Icon: "shower-head", Minutes: 15, Effect: Needs{Hygiene: 60}, Ages: Adults},
	{ID: "caserne-dortoir", Label: "Dormir au dortoir", Icon: "bed", Minutes: 6 * 60, Effect: Needs{Energy: 90, Hunger: -15, Hygiene: -10}, Ages: Adults},
	{ID: ServiceQuitID, Label: "Quitter le service (sans l'attestation)", Icon: "door-open", Minutes: 10, Effect: Needs{Fun: -10}, Ages: Adults},
}

var emptInteractions = []Interaction{
	{ID: EmptEcritID, Label: "Concours d'entrée : l'écrit", Icon: "pen-line", Minutes: 60, Effect: Needs{Energy: -10, Fun: -5}, Ages: TeensUp},
	{ID: EmptPhysiqueID, Label: "Concours d'entrée : l'épreuve physique", Icon: "dumbbell", Minutes: 60, Effect: Needs{Energy: -25, Hygiene: -20}, Ages: TeensUp},
	// The school's year (EmptProgram), for a pupil only.
	{ID: "empt-rassemblement", Label: "Le rassemblement du matin", Icon: "flag", Minutes: 30, Effect: Needs{Social: 10, Energy: -5}, Ages: TeensUp},
	{ID: "empt-cours", Label: "Le cours (maths, sciences)", Icon: "book-open", Minutes: 120, Effect: Needs{Energy: -15, Fun: -5}, Ages: TeensUp},
	{ID: "empt-atelier", Label: "L'atelier technique", Icon: "hammer", Minutes: 120, Effect: Needs{Fun: 10, Energy: -15, Hygiene: -10}, Ages: TeensUp},
	{ID: "empt-sport", Label: "Le sport sur le terrain", Icon: "dumbbell", Minutes: 90, Effect: Needs{Fun: 10, Energy: -25, Hygiene: -25}, Ages: TeensUp},
	// The internat's everyday, for a pupil.
	{ID: "empt-refectoire", Label: "Manger au réfectoire", Icon: "utensils", Minutes: 40, Effect: Needs{Hunger: 50, Social: 10}, Ages: TeensUp},
	{ID: "empt-douche", Label: "La douche de l'internat", Icon: "shower-head", Minutes: 15, Effect: Needs{Hygiene: 60}, Ages: TeensUp},
	{ID: "empt-dortoir", Label: "Dormir à l'internat", Icon: "bed", Minutes: 6 * 60, Effect: Needs{Energy: 90, Hunger: -15, Hygiene: -10}, Ages: TeensUp},
	{ID: EmptQuitID, Label: "Quitter l'école (sans le brevet)", Icon: "door-open", Minutes: 10, Effect: Needs{Fun: -10}, Ages: TeensUp},
}

// ArmeeInteractions: what the update brings to the places (features.go).
func ArmeeInteractions() []string {
	var out []string
	for _, l := range [][]Interaction{caserneInteractions, emptInteractions} {
		for _, it := range l {
			out = append(out, it.ID)
		}
	}
	return out
}

// InProgram: the actions only a recruit (or a pupil) of that program does.
func InProgram(p ArmyProgram, interaction string) bool {
	switch p.ID {
	case ServiceProgram.ID:
		return slices.Contains(ServiceProgram.Steps, interaction) || slices.Contains([]string{"caserne-ordinaire", "caserne-douche", "caserne-dortoir", ServiceQuitID}, interaction)
	case EmptProgram.ID:
		return slices.Contains(EmptProgram.Steps, interaction) || slices.Contains([]string{"empt-refectoire", "empt-douche", "empt-dortoir", EmptQuitID}, interaction)
	}
	return false
}

// ProgramOf: the program whose actions these are, if any.
func ProgramOf(interaction string) (ArmyProgram, bool) {
	for _, p := range []ArmyProgram{ServiceProgram, EmptProgram} {
		if InProgram(p, interaction) {
			return p, true
		}
	}
	return ArmyProgram{}, false
}

func init() {
	Kinds[CaserneKind] = PlaceKind{
		ID: CaserneKind, Label: "Caserne", Icon: "shield", Interactions: caserneInteractions,
		Events: []RandomEvent{
			{Text: "Le clairon sonne : tout le monde au garde-à-vous dans la cour.", Effect: Needs{Energy: -5}},
			{Text: "Un ancien te montre comment faire ton lit au carré : « Une pièce de 100 F doit rebondir dessus ! »", Effect: Needs{Social: 10}},
		},
	}
	Kinds[EmptKind] = PlaceKind{
		ID: EmptKind, Label: "École militaire préparatoire", Icon: "graduation-cap", Interactions: emptInteractions,
		Events: []RandomEvent{
			{Text: "L'adjudant d'internat passe dans les rangs : chaussures cirées, chemise rentrée. Ça va pour cette fois.", Effect: Needs{Fun: -5}},
			{Text: "Ton binôme de chambrée te prête son cahier d'atelier : on se serre les coudes.", Effect: Needs{Social: 10}},
		},
	}
}
