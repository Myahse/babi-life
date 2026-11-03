package game

import "slices"

// Prison at the MACA (the update « braquages », sims/prison.go): caught after a robbery, the Sim
// doesn't wait out a clock, it lives there, like a baby lives its « premières fois »: the cantine, the
// promenade, the atelier, the parloir, the classes; its « étapes » done, it passes before the juge
// d'application des peines, and is let out. Meanwhile it can't leave (no taxi, no other place).
// Nothing in prison pays.

// PrisonKind: the MACA's place kind, its interactions at sims.PrisonPlaceID.
const PrisonKind = "prison"

// JugeID: the last étape, open once the others are done; it ends with the Sim let out.
const JugeID = "prison-juge"

// PrisonStep: one étape before the sortie.
type PrisonStep struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	How   string `json:"how"`
	// By: the interaction that brings it when started.
	By string `json:"-"`
	// Line: what the journal says when it comes.
	Line string `json:"-"`
}

// PrisonSteps: every étape, in the order the list shows them (the juge last).
var PrisonSteps = []PrisonStep{
	{ID: "cantine", Label: "Le premier repas à la cantine", Icon: "utensils", How: "« Manger à la cantine »", By: "prison-cantine", Line: "La cantine de la MACA : du riz, une sauce claire, et tout le monde qui te regarde. Tu manges vite."},
	{ID: "promenade", Label: "La promenade dans la cour", Icon: "footprints", How: "« La promenade dans la cour »", By: "prison-promenade", Line: "La cour : le soleil sur le mur, un ballon fait de sachets, les anciens qui t'expliquent les règles."},
	{ID: "atelier", Label: "Le travail à l'atelier", Icon: "hammer", How: "« Travailler à l'atelier »", By: "prison-atelier", Line: "L'atelier de menuiserie : un tabouret fini de tes mains. Le surveillant hoche la tête."},
	{ID: "parloir", Label: "Le parloir", Icon: "users", How: "« Le parloir »", By: "prison-parloir", Line: "Le parloir : la famille derrière la vitre, un sachet d'attiéké passé au gardien. On te dit de tenir bon."},
	{ID: "cours", Label: "Le cours à la bibliothèque", Icon: "book-open", How: "« Suivre un cours à la bibliothèque »", By: "prison-cours", Line: "Le cours du soir à la bibliothèque : une leçon, un cahier, et l'envie de faire autrement en sortant."},
	{ID: "juge", Label: "Devant le juge", Icon: "gavel", How: "« Passer devant le juge » (une fois les autres étapes faites)", By: JugeID, Line: "Devant le juge d'application des peines : bonne conduite, dossier en ordre. « Libérable. »"},
}

// PrisonStepsFor: the étapes a sentence asks: a till's, the first four and the juge; a bank's, or with a
// record already heavy, the class too.
func PrisonStepsFor(record int, bank bool) []string {
	ids := []string{"cantine", "promenade", "atelier", "parloir"}
	if bank || record >= 2 {
		ids = append(ids, "cours")
	}
	return append(ids, "juge")
}

// PrisonStepBy: the étape an interaction brings, if any.
func PrisonStepBy(interaction string) (PrisonStep, bool) {
	i := slices.IndexFunc(PrisonSteps, func(s PrisonStep) bool { return s.By == interaction })
	if i < 0 {
		return PrisonStep{}, false
	}
	return PrisonSteps[i], true
}

var prisonInteractions = []Interaction{
	{ID: "prison-cantine", Label: "Manger à la cantine", Icon: "utensils", Minutes: 40, Effect: Needs{Hunger: 45, Fun: -5}, Ages: Adults},
	{ID: "prison-promenade", Label: "La promenade dans la cour", Icon: "footprints", Minutes: 60, Effect: Needs{Fun: 15, Social: 15, Energy: -5}, Ages: Adults},
	{ID: "prison-atelier", Label: "Travailler à l'atelier", Icon: "hammer", Minutes: 120, Effect: Needs{Fun: 5, Energy: -15, Hygiene: -10}, Ages: Adults},
	{ID: "prison-parloir", Label: "Le parloir", Icon: "users", Minutes: 30, Effect: Needs{Social: 40, Fun: 10}, Ages: Adults},
	{ID: "prison-cours", Label: "Suivre un cours à la bibliothèque", Icon: "book-open", Minutes: 90, Effect: Needs{Fun: 5, Energy: -10}, Ages: Adults},
	{ID: JugeID, Label: "Passer devant le juge", Icon: "gavel", Minutes: 30, Effect: Needs{Fun: 10}, Ages: Adults},
	{ID: "prison-douche", Label: "La douche commune", Icon: "shower-head", Minutes: 20, Effect: Needs{Hygiene: 60}, Ages: Adults},
	{ID: "prison-dormir", Label: "Dormir en cellule", Icon: "bed", Minutes: 6 * 60, Effect: Needs{Energy: 90, Hunger: -15, Hygiene: -10, Fun: -5}, Ages: Adults},
}

func init() {
	Kinds[PrisonKind] = PlaceKind{
		ID: PrisonKind, Label: "La MACA", Icon: "shield", Interactions: prisonInteractions,
		Events: []RandomEvent{
			{Text: "Appel en cellule : on compte, on recompte. Personne ne bouge.", Effect: Needs{Fun: -5}},
			{Text: "Un ancien te glisse un morceau de pain : « Ici, on se serre les coudes. »", Effect: Needs{Social: 10, Hunger: 5}},
		},
	}
}
