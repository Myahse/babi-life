package game

import "slices"

// L'espace, les carrières et la formation (the update « espace »; sims/espaceFormation.go; web
// components/espace/Formation.tsx, components/espace/jeux/). Six jobs at Astrélia on the game's pay scale, and
// the way up for those who want to fly without a ticket:
//   - the selection at the Centre d'entraînement Astrélia (Sassandra): the concours written (physics, maths,
//     English), then five drills each played (the physical's parcours, the centrifuge, the pool, the sea
//     survival, the medical); each counts from DrillPass;
//   - then, hired « Astronaute candidat·e », the training stay: three modules (like the EMPT's trimestres), each
//     its drills; at the end the « Brevet d'astronaute Astrélia » (the Papiers app) and the rung Astronaute;
//   - a mission is MissionShifts[dest] shifts worked aboard, each inside the one-shift-a-day cap; astronauts
//     (and the space tourism's hosts, to the station) fly free (Missions).
// The tourists do a short version, two drills, included in their ticket (TouristDrills): « formation express ».
// PG: a drill failed is « on recommence », the centrifuge only ever greys the view a little.

// The places' kinds: the training centre (Sassandra) and the siège (the Plateau, the mission control).
const (
	EntrainementKind = "astrelia-entrainement"
	SiegeKind        = "astrelia-siege"
	// EntrainementID: the Centre d'entraînement Astrélia (world/espaceTerre.go).
	EntrainementID = "sassandra-entrainement"
)

// The six careers.
const (
	AstronauteCareer = "astronaute"
	IngenieurCareer  = "ingenieur-lancement"
	ControleCareer   = "controle-mission"
	TourismeCareer   = "tourisme-spatial"
	PasDeTirCareer   = "pas-de-tir"
	GuideCareer      = "guide-spatial"
)

// EspaceCareers: Astrélia's jobs (the phone hides them while « espace » is shut).
var EspaceCareers = []string{AstronauteCareer, IngenieurCareer, ControleCareer, TourismeCareer, PasDeTirCareer, GuideCareer}

// IsEspaceCareer: one of Astrélia's jobs.
func IsEspaceCareer(id string) bool { return slices.Contains(EspaceCareers, id) }

// The actions of the training centre (and the pads, for the tourists).
const (
	ConcoursEcritID = "astrelia-concours-ecrit"
	// The selection's drills.
	SelPhysiqueID = "selection-physique"
	SelCentriID   = "selection-centrifugeuse"
	SelPiscineID  = "selection-piscine"
	SelSurvieID   = "selection-survie"
	SelMedicaleID = "selection-medicale"
	// The stay's drills.
	ModCentriID   = "module-centrifugeuse"
	ModPiscineID  = "module-piscine"
	ModParaboleID = "module-parabolique"
	ModSurvieID   = "module-survie"
	ModSystemesID = "module-systemes"
	ModPhysiqueID = "module-physique"
	// The tourists' « formation express », included in the ticket.
	TourCentriID = "touriste-centrifugeuse"
	TourSurvieID = "touriste-survie"
	// The centre's everyday, for Astrélia's people.
	CentreCantineID = "entrainement-cantine"
	CentreDoucheID  = "entrainement-douche"
	CentreChambreID = "entrainement-chambre"
)

// The paper (papiers.go).
const DocBrevetAstro = "brevet-astronaute"

// The selection: the concours written, then these drills, each at DrillPass at least.
var SelectionDrills = []string{SelPhysiqueID, SelCentriID, SelPiscineID, SelSurvieID, SelMedicaleID}

// The training stay: its modules, each its drills (all at DrillPass to pass the module).
type FormationModule struct {
	Name  string   `json:"name"`
	Steps []string `json:"steps"`
}

var FormationModules = []FormationModule{
	{Name: "Les bases", Steps: []string{ModSystemesID, ModCentriID, ModPiscineID}},
	{Name: "L'apesanteur", Steps: []string{ModParaboleID, ModPiscineID, ModPhysiqueID}},
	{Name: "Le retour sur Terre", Steps: []string{ModCentriID, ModSurvieID, ModSystemesID}},
}

// TouristDrills: the tourists' two (a ticket or a mission held).
var TouristDrills = []string{TourCentriID, TourSurvieID}

// MedicalMin: the medical's bar, every need at this or more (and not sick).
const MedicalMin = 50

// CentrifugeMaxG: the centrifuge's top (the drill keeps the gauge in its band, up to this).
const CentrifugeMaxG = 8

// The missions: who flies free, from which rung, and how many shifts aboard make a mission.
var (
	MissionMinLevel = map[string]map[string]int{
		AstronauteCareer: {"station": 1, "lune": 2, "mars": 3},
		TourismeCareer:   {"station": 1},
	}
	MissionShifts = map[string]int{"station": 2, "lune": 3, "mars": 4}
)

// MissionLevel: the rung this career flies to that destination free from (ok false: never).
func MissionLevel(career, dest string) (int, bool) {
	l, ok := MissionMinLevel[career][dest]
	return l, ok
}

// IsFormationDrill: an action of the selection, the stay or the express training (played, scored).
func IsFormationDrill(id string) bool {
	if slices.Contains(SelectionDrills, id) || slices.Contains(TouristDrills, id) || id == ConcoursEcritID {
		return true
	}
	for _, m := range FormationModules {
		if slices.Contains(m.Steps, id) {
			return true
		}
	}
	return false
}

// IsModuleStep: a drill of the training stay.
func IsModuleStep(id string) bool {
	return slices.ContainsFunc(FormationModules, func(m FormationModule) bool { return slices.Contains(m.Steps, id) })
}

var espaceCareers = []Career{
	{ID: AstronauteCareer, Label: "Astronaute", Icon: "rocket", Kind: EntrainementKind, Also: []string{EspaceStationK, EspaceLuneKind, EspaceMarsKind}, MinHour: 6, MaxHour: 18, Minutes: 6 * 60,
		Effect: Needs{Energy: -40, Hygiene: -20, Fun: 10, Hunger: -20},
		Levels: []Level{{"Astronaute candidat·e", 3000}, {"Astronaute", 4400}, {"Astronaute confirmé·e", 6000}, {"Commandant·e de bord", 8000}, {"Chef·fe des astronautes", 10000}}},
	{ID: IngenieurCareer, Label: "Ingénierie de lancement", Icon: "wrench", Kind: SpatioportKind, Also: []string{SiegeKind}, MinHour: 6, MaxHour: 14, Minutes: 8 * 60,
		Effect: Needs{Energy: -35, Fun: -10, Hunger: -20, Social: 10},
		Levels: []Level{{"Ingénieur·e stagiaire", 3000}, {"Ingénieur·e de lancement", 4300}, {"Ingénieur·e principal·e", 5900}, {"Directeur·rice du lancement", 7900}, {"Directeur·rice technique d'Astrélia", 9800}}},
	{ID: ControleCareer, Label: "Contrôle de mission", Icon: "radar", Kind: SiegeKind, MinHour: 0, MaxHour: 24, Minutes: 8 * 60,
		Effect: Needs{Energy: -35, Fun: -10, Hunger: -20, Social: 10},
		Levels: []Level{{"Opérateur·rice de console", 2900}, {"Contrôleur·se de mission", 4200}, {"Contrôleur·se principal·e", 5800}, {"Directeur·rice de vol", 7800}, {"Directeur·rice des opérations", 9600}}},
	{ID: TourismeCareer, Label: "Tourisme spatial", Icon: "ticket", Kind: SpatioportKind, Also: []string{EspaceStationK}, MinHour: 6, MaxHour: 16, Minutes: 7 * 60,
		Effect: Needs{Energy: -30, Fun: 5, Hunger: -15, Social: 25},
		Levels: []Level{{"Hôte·sse d'accueil", 2800}, {"Hôte·sse du tourisme spatial", 3900}, {"Chef·fe de cabine", 5300}, {"Responsable des vols touristiques", 7000}, {"Directeur·rice du tourisme spatial", 8800}}},
	{ID: PasDeTirCareer, Label: "Pas de tir", Icon: "hard-hat", Kind: SpatioportKind, MinHour: 5, MaxHour: 14, Minutes: 8 * 60,
		Effect: Needs{Energy: -40, Hygiene: -25, Fun: -5, Social: 10},
		Levels: []Level{{"Technicien·ne de pas de tir", 2800}, {"Technicien·ne confirmé·e", 3900}, {"Chef·fe d'équipe du pas de tir", 5300}, {"Responsable du pas de tir", 7000}, {"Directeur·rice du spatioport", 8800}}},
	{ID: GuideCareer, Label: "Guide du centre spatial", Icon: "flag", Kind: SpatioportKind, Also: []string{EntrainementKind}, MinHour: 8, MaxHour: 15, Minutes: 6 * 60,
		Effect: Needs{Energy: -25, Fun: 5, Hunger: -15, Social: 30},
		Levels: []Level{{"Guide stagiaire", 2600}, {"Guide du centre spatial", 3600}, {"Guide principal·e", 4900}, {"Responsable des visites", 6500}, {"Directeur·rice du centre des visiteurs", 8300}}},
}

// The diploma gates past the first rung (DiplomaGates; the bac and the BEPC, WorkExams, for all six).
var espaceGates = map[string]Gate{
	AstronauteCareer: {Level: 1, Rank: 5, Filieres: []string{"sciences", "genie", "info", "medecine"}, Label: "un Master, un diplôme d'ingénieur ou un doctorat en sciences, génie, informatique ou médecine"},
	IngenieurCareer:  {Level: 1, Degree: DegreeIngenieur, Label: "un diplôme d'ingénieur"},
	ControleCareer:   {Level: 1, Rank: 3, Label: "une Licence (ou plus)"},
	PasDeTirCareer:   {Level: 1, Rank: 2, Filieres: []string{"genie", "info", "sciences"}, Label: "un BTS (ou plus) en génie, informatique ou sciences"},
}

var espaceTasks = map[string][]JobTask{
	AstronauteCareer: {
		{ID: "checklist", Label: "Réviser les procédures de la Pirogue", Icon: "clipboard-list", Pose: "write", Lines: []string{"La check-list du lancement par cœur, dans l'ordre.", "Le simulateur de la Pirogue : arrimage parfait au premier essai.", "Les pannes du manuel, une à une : tu les connais toutes."}},
		{ID: "experience", Label: "Mener une expérience", Icon: "flask-conical", Pose: "write", Lines: []string{"Les cristaux poussent bien droit dans leur boîte.", "Les plants de manioc ont sorti une feuille de plus.", "Les mesures envoyées au sol : le labo d'Abidjan est content."}},
		{ID: "sport", Label: "La séance de sport", Icon: "dumbbell", Pose: "carry", Lines: []string{"Le tapis, les élastiques, une heure : les jambes tiennent.", "Les tractions à la barre : le coach note un record.", "Étirements, gainage : le corps est prêt pour la suite."}},
		{ID: "maintenance", Label: "La maintenance des modules", Icon: "wrench", Pose: "point", MinLevel: 1, Lines: []string{"Un filtre à air changé, le ronron revient.", "Une fuite de rien du tout repérée et colmatée.", "Le panneau solaire répond de nouveau au sol."}},
		{ID: "commandement", Label: "Briefer l'équipage", Icon: "megaphone", Pose: "board", MinLevel: 3, Lines: []string{"Chacun sait son rôle pour la sortie de demain.", "Le planning de la semaine affiché, sans fausse note.", "L'équipage t'écoute, et le contrôle de mission aussi."}},
	},
	IngenieurCareer: {
		{ID: "moteurs", Label: "Contrôler les moteurs de la Calao", Icon: "gauge", Pose: "point", Lines: []string{"Les neuf moteurs testés : tous au vert.", "Une vanne un peu lente remplacée avant le lancement.", "Le banc d'essai rugit : la poussée est bonne."}},
		{ID: "calculs", Label: "Calculer la trajectoire", Icon: "calculator", Pose: "write", Lines: []string{"La fenêtre de tir tombe pile à l'heure prévue.", "La trajectoire passe bien au-dessus du golfe de Guinée.", "Les chiffres collent : la capsule rejoindra la station."}},
		{ID: "revue", Label: "La revue d'aptitude au vol", Icon: "clipboard-check", Pose: "board", MinLevel: 2, Lines: []string{"Tout le monde dit « go » : la Calao peut partir.", "Une question de plus, une réponse claire : go.", "Le directeur signe : lancement confirmé."}},
	},
	ControleCareer: {
		{ID: "console", Label: "Surveiller la console", Icon: "monitor", Pose: "write", Lines: []string{"Les courbes de la station, toutes dans le vert.", "Un capteur bavard : tu le calmes en deux commandes.", "La relève arrive, rien à signaler."}},
		{ID: "liaison", Label: "Parler à l'équipage", Icon: "radio", Pose: "direct", Lines: []string{"« Akwaba, ici Abidjan, on vous reçoit cinq sur cinq. »", "Les astronautes saluent le Plateau depuis l'orbite.", "Tu lis le programme du jour à l'équipage."}},
		{ID: "decompte", Label: "Mener le compte à rebours", Icon: "timer", Pose: "board", MinLevel: 2, Lines: []string{"Dix, neuf, huit… décollage ! La salle applaudit.", "Une pause dans le décompte, puis tout repart : go.", "La Calao monte droit : la salle souffle enfin."}},
	},
	TourismeCareer: {
		{ID: "accueil", Label: "Accueillir les voyageurs", Icon: "hand", Pose: "direct", Lines: []string{"Une famille vient voir partir sa grand-mère : larmes de joie.", "Les badges remis, les sourires aussi.", "Un voyageur nerveux rassuré autour d'un café."}},
		{ID: "consignes", Label: "Expliquer les consignes à bord", Icon: "megaphone", Pose: "board", Lines: []string{"Comment boire en apesanteur : tout le monde rit.", "Le sac de couchage accroché au mur, la démonstration.", "Les sangles, la toilette à l'éponge : les voyageurs sont prêts."}},
		{ID: "photo", Label: "La photo du groupe devant la fusée", Icon: "camera", Pose: "point", Lines: []string{"Tout le monde dans le cadre, la Calao derrière.", "Un pouce levé, un drapeau de l'agence : clic.", "La photo part sur Babigram avant même le décollage."}},
	},
	PasDeTirCareer: {
		{ID: "pleins", Label: "Faire les pleins de la Calao", Icon: "fuel", Pose: "carry", Lines: []string{"Les réservoirs pleins, sans une goutte à côté.", "Le froid des ergols fume autour de la fusée.", "Pleins faits dans les temps : bravo l'équipe."}},
		{ID: "tour", Label: "Vérifier la tour de lancement", Icon: "construction", Pose: "point", Lines: []string{"Chaque bras de la tour testé, ils s'écartent bien.", "Un boulon resserré tout en haut, le vent dans le dos.", "L'ascenseur de la tour remis en route."}},
		{ID: "securite", Label: "Le tour de sécurité du pas de tir", Icon: "shield-check", Pose: "whistle", MinLevel: 2, Lines: []string{"La zone dégagée, tout le monde derrière la ligne.", "Les caméras du pas de tir, toutes en marche.", "Le pas de tir prêt : tu donnes ton « go »."}},
	},
	GuideCareer: {
		{ID: "visite", Label: "Faire visiter le spatioport", Icon: "flag", Pose: "point", Lines: []string{"Le car de l'école de San-Pédro ouvre grand les yeux devant la Calao.", "« Et ça va jusqu'à la Lune ? » Oui, et tu racontes comment.", "Les touristes posent mille questions : tu as mille réponses."}},
		{ID: "maquette", Label: "Présenter la maquette de la station", Icon: "orbit", Pose: "board", Lines: []string{"La Station Akwaba en petit : chaque module expliqué.", "Un enfant veut savoir où on dort : tu montres le sac.", "La maquette tourne, la classe applaudit."}},
		{ID: "lancement", Label: "Commenter un lancement à la plage", Icon: "megaphone", Pose: "direct", MinLevel: 2, Lines: []string{"Le grondement arrive après la lumière : tu l'avais annoncé.", "Le public compte avec toi jusqu'à zéro.", "Les étages se séparent : tu expliques, tout le monde regarde en l'air."}},
	},
}

// The training centre's actions (the selection, the stay, the everyday) and the tourists' at the pads.
var entrainementInteractions = []Interaction{
	{ID: ConcoursEcritID, Label: "Concours Astrélia : l'écrit (physique, maths, anglais)", Icon: "pen-line", Minutes: 60, Effect: Needs{Energy: -10, Fun: -5}, Ages: Adults},
	{ID: SelPhysiqueID, Label: "Sélection : l'épreuve physique (le parcours)", Icon: "footprints", Minutes: 60, Effect: Needs{Energy: -25, Hygiene: -20}, Ages: Adults},
	{ID: SelCentriID, Label: "Sélection : la centrifugeuse", Icon: "rotate-cw", Minutes: 30, Effect: Needs{Energy: -15, Fun: 10}, Ages: Adults},
	{ID: SelPiscineID, Label: "Sélection : la piscine, en flottabilité neutre", Icon: "waves", Minutes: 60, Effect: Needs{Energy: -20, Hygiene: 10}, Ages: Adults},
	{ID: SelSurvieID, Label: "Sélection : la survie en mer après l'amerrissage", Icon: "life-buoy", Minutes: 60, Effect: Needs{Energy: -20, Hygiene: -10}, Ages: Adults},
	{ID: SelMedicaleID, Label: "Sélection : la visite médicale", Icon: "stethoscope", Minutes: 30, Effect: Needs{Social: 5}, Ages: Adults},
	{ID: ModSystemesID, Label: "Formation : les systèmes de la Pirogue", Icon: "book-open", Minutes: 90, Effect: Needs{Energy: -10, Fun: -5}, Ages: Adults},
	{ID: ModCentriID, Label: "Formation : la centrifugeuse, jusqu'à 8 G", Icon: "rotate-cw", Minutes: 45, Effect: Needs{Energy: -20, Fun: 10}, Ages: Adults},
	{ID: ModPiscineID, Label: "Formation : la sortie dans l'espace, en piscine", Icon: "waves", Minutes: 90, Effect: Needs{Energy: -25, Hygiene: 10}, Ages: Adults},
	{ID: ModParaboleID, Label: "Formation : le vol parabolique", Icon: "plane", Minutes: 60, Effect: Needs{Energy: -15, Fun: 25}, Ages: Adults},
	{ID: ModSurvieID, Label: "Formation : la survie en mer", Icon: "life-buoy", Minutes: 90, Effect: Needs{Energy: -25, Hygiene: -10}, Ages: Adults},
	{ID: ModPhysiqueID, Label: "Formation : la préparation physique", Icon: "dumbbell", Minutes: 60, Effect: Needs{Energy: -25, Hygiene: -20}, Ages: Adults},
	{ID: TourCentriID, Label: "Formation express : la centrifugeuse (comprise dans le billet)", Icon: "rotate-cw", Minutes: 20, Effect: Needs{Energy: -10, Fun: 15}, Ages: Adults},
	{ID: TourSurvieID, Label: "Formation express : sortir de la capsule en mer (comprise dans le billet)", Icon: "life-buoy", Minutes: 20, Effect: Needs{Energy: -10, Fun: 10}, Ages: Adults},
	{ID: CentreCantineID, Label: "Manger à la cantine des astronautes", Icon: "utensils", Minutes: 40, Effect: Needs{Hunger: 55, Social: 10}, Ages: Adults},
	{ID: CentreDoucheID, Label: "La douche du centre", Icon: "shower-head", Minutes: 15, Effect: Needs{Hygiene: 60}, Ages: Adults},
	{ID: CentreChambreID, Label: "Dormir dans une chambre du centre", Icon: "bed", Minutes: 6 * 60, Effect: Needs{Energy: 90, Hunger: -15, Hygiene: -10}, Ages: Adults},
}

// CentreLife: the centre's everyday, for Astrélia's people only (a career of the agency).
var CentreLife = []string{CentreCantineID, CentreDoucheID, CentreChambreID}

// FormationActs: what the training brings to the places (features: the update « espace »).
func FormationActs() []string {
	out := make([]string, 0, len(entrainementInteractions))
	for _, it := range entrainementInteractions {
		out = append(out, it.ID)
	}
	return out
}

func init() {
	Careers = append(Careers, espaceCareers...)
	for id, ts := range espaceTasks {
		jobTasks[id] = ts
	}
	for id, g := range espaceGates {
		DiplomaGates[id] = g
	}
	Missions[AstronauteCareer] = []string{"station", "lune", "mars"}
	Missions[TourismeCareer] = []string{"station"}
	Kinds[EntrainementKind] = PlaceKind{ID: EntrainementKind, Label: "Centre d'entraînement Astrélia", Icon: "rocket", Interactions: entrainementInteractions,
		Events: []RandomEvent{
			{Text: "Un ancien astronaute passe dans le couloir et te tape sur l'épaule : « Tiens bon, ça vaut le coup. »", Effect: Needs{Social: 10, Fun: 5}},
			{Text: "Par la baie vitrée, la Calao sur son pas de tir, au bout de la plage : un jour, ce sera toi.", Effect: Needs{Fun: 10}},
		}}
	Kinds[SiegeKind] = PlaceKind{ID: SiegeKind, Label: AgencySiege, Icon: "radar", Interactions: []Interaction{
		{ID: "siege-salle-controle", Label: "Regarder la salle de contrôle depuis la galerie", Icon: "monitor", Minutes: 30, Effect: Needs{Fun: 20}},
	}, Events: []RandomEvent{
		{Text: "Sur le grand écran, la Station Akwaba passe au-dessus de l'Afrique : toute la salle lève les yeux.", Effect: Needs{Fun: 10}},
	}}
	addActs(map[string][]Interaction{SpatioportKind: {entrainementInteractions[12], entrainementInteractions[13]}})
	EspaceActs[EspaceKey] = append(EspaceActs[EspaceKey], FormationActs()...)
	EspaceActs[EspaceKey] = append(EspaceActs[EspaceKey], "siege-salle-controle")
}
