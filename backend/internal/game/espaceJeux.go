package game

// Les jeux de l'espace (the update « espace-jeux »; sims/espaceJeux.go; web components/espace/jeux2/): six
// mini-games, each its own action, played in 3D blocks on the phone in a minute or two:
//   - l'amarrage: the Pirogue guided by hand to the Station Akwaba's docking port (the closing speed kept low);
//   - l'alunissage: the engine dosed to land softly on the Base Clair-de-Terre's pad (in the capsule during the
//     Moon's cruise, and on the simulator of the training centre at Sassandra);
//   - le Margouillat: the rover driven to a beacon between the craters and the boulders, at 1/6 g;
//   - la serre: a few Martian days of a greenhouse grown with little water and little light;
//   - la réparation: a solar panel's module changed during a spacewalk (the tether, the hand-holds, the oxygen);
//   - la salle de contrôle: the mission controller's shift, a launch's telemetry followed and the « go / no go »
//     given at the right moments (a shift of the career: in the one-shift-a-day cap, its pay as ever).
//
// The rule of money (docs/economie.md, « L'espace »): none of them pays anything; only the skills and the mood
// grow (the controller's shift pays its own pay, a little less played badly, never more). PG: a game failed is
// « on recommence » or « retour au sas », nobody hurt.

// EspaceJeuxKey: the update.
const EspaceJeuxKey = "espace-jeux"

// The six games' actions.
const (
	AmarrageID       = "station-amarrage"
	AlunissageID     = "lune-alunissage"
	AlunissageSimuID = "entrainement-alunissage"
	MargouillatJeuID = "lune-margouillat-balise"
	SerreJeuID       = "mars-serre-jours"
	ReparationID     = "station-reparation"
	ControleJeuID    = "controle-lancement"
)

// JeuxGames: each action's game (the kind the phone posts, POST /sims/{id}/espace/jeu).
var JeuxGames = map[string]string{
	AmarrageID:       "amarrage",
	AlunissageID:     "alunissage",
	AlunissageSimuID: "alunissage",
	MargouillatJeuID: "margouillat",
	SerreJeuID:       "serre",
	ReparationID:     "reparation",
	ControleJeuID:    "controle",
}

// IsJeuxKind: one of the six games' kinds.
func IsJeuxKind(kind string) bool {
	for _, k := range JeuxGames {
		if k == kind {
			return true
		}
	}
	return false
}

// JeuxSkill: the skill each one trains and how much a minute of it counts (as SpaceSkill).
var JeuxSkill = map[string]struct {
	Skill string
	Rate  float64
}{
	AmarrageID:       {"logique", 1.1},
	AlunissageID:     {"logique", 1.1},
	AlunissageSimuID: {"logique", 1},
	MargouillatJeuID: {"bricolage", 0.8},
	SerreJeuID:       {"cuisine", 1},
	ReparationID:     {"bricolage", 1.2},
	ControleJeuID:    {"logique", 0.3},
}

// ControleRooms: where the controller's launch is followed: the siège's control room (the Plateau) and the
// spaceports' pads (their launch control).
var ControleRooms = []string{SiegeKind, SpatioportKind}

// ControleShift: the controller's shift taken in the control room, followed as a launch (its pay, its hours:
// the career's own).
func ControleShift(shift Interaction) Interaction {
	shift.ID = ControleJeuID
	shift.Label = "Salle de contrôle : suivre un lancement et donner les « go / no go » (ton service du jour)"
	shift.Icon = "radar"
	return shift
}

var jeuxActs = map[string][]Interaction{
	EspaceSasKind: {
		{ID: AmarrageID, Label: "Piloter la Pirogue à la main jusqu'au port d'amarrage", Icon: "rocket", Minutes: 60, Effect: Needs{Fun: 35, Energy: -5}, Ages: Adults, Cities: onStation},
		{ID: ReparationID, Label: "Sortie de réparation : changer un module du panneau solaire", Icon: "wrench", Minutes: 60, Effect: Needs{Fun: 35, Energy: -15}, Ages: Adults, Cities: onStation},
	},
	EspaceCapsuleK: {
		{ID: AlunissageID, Label: "Aux commandes : poser la Pirogue sur la Base Clair-de-Terre (simulateur de bord)", Icon: "moon", Minutes: 60, Effect: Needs{Fun: 35}, Ages: Adults, Cities: onMoon},
	},
	EntrainementKind: {
		{ID: AlunissageSimuID, Label: "Le simulateur d'alunissage : poser la Pirogue tout en douceur", Icon: "moon", Minutes: 60, Effect: Needs{Fun: 30, Energy: -5}, Ages: Adults},
	},
	EspaceRoverKind: {
		{ID: MargouillatJeuID, Label: "Piloter le Margouillat jusqu'à la balise, entre cratères et rochers", Icon: "car", Minutes: 60, Effect: Needs{Fun: 40, Energy: -10}, Ages: Adults, Cities: onMoon},
	},
	EspaceSerreKind: {
		{ID: SerreJeuID, Label: "Tenir la serre quelques sols : peu d'eau, peu de lumière", Icon: "sprout", Minutes: 60, Effect: Needs{Fun: 30}, Ages: Adults, Cities: onMars},
	},
	SiegeKind: {
		{ID: ControleJeuID, Label: "Salle de contrôle : suivre un lancement et donner les « go / no go » (ton service du jour)", Icon: "radar", Minutes: 8 * 60, Ages: Adults, Requires: &Requirement{Career: ControleCareer}},
	},
	SpatioportKind: {
		{ID: ControleJeuID, Label: "Salle de contrôle : suivre un lancement et donner les « go / no go » (ton service du jour)", Icon: "radar", Minutes: 8 * 60, Ages: Adults, Requires: &Requirement{Career: ControleCareer}},
	},
}

// JeuxActs: the update's actions.
var JeuxActs = []string{AmarrageID, ReparationID, AlunissageID, AlunissageSimuID, MargouillatJeuID, SerreJeuID, ControleJeuID}

func init() {
	addActs(jeuxActs)
	EspaceActs[EspaceJeuxKey] = append(EspaceActs[EspaceJeuxKey], JeuxActs...)
	Moodlets["pilote-espace"] = MoodletDef{"Aux commandes, tout en douceur", "rocket", 3, 240}
	Moodlets["go-lancement"] = MoodletDef{"Le bon « go » au bon moment", "radar", 3, 240}
}
