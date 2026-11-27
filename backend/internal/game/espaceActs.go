package game

import "strconv"

// La vie là-haut (workstream D of l'espace; espace.go for the socle; world/espaceVie.go for the places; sims/
// espaceVie.go for what the actions do once done; web world3d/espace). What one does at the Station Akwaba, at the
// Base Clair-de-Terre and at the Colonie Harmattan: the Earth from the cupola, a photo for Babigram, the
// experiments of the laboratory (skill points), the spacewalk (the mini-game SortieEVA: the oxygen gauge, empty,
// means back to the airlock), the treadmill, the sachets, the sleeping bag; on the Moon the big jumps, the
// Margouillat rover, the Earthrise, the greenhouse and the regolith mine; on Mars the dome, the greenhouse, the
// lab, the rover to the delta of Jezero, the dust storm (a happening) and the messages home that take 12 minutes.
//
// The rule of money (docs/economie.md, « L'espace »): nothing here pays and nothing costs. Only the skills and
// the mood grow (sims/espaceVie.go: spaceDone).

// The kinds of places the socle's cities gain (world/espaceVie.go).
const (
	EspaceCoupoleKind = "espace-coupole"
	EspaceLaboKind    = "espace-labo"
	EspaceSerreKind   = "espace-serre"
	EspaceRoverKind   = "espace-rover"
	EspaceMineKind    = "espace-mine"
)

// The actions with something more to them (sims/espaceVie.go).
const (
	// SpacewalkID: the spacewalk, from the station's airlock (the mini-game SortieEVA).
	SpacewalkID = "station-sortie"
	// The photos (the phone posts them on Babigram from the scene).
	PhotoTerreID   = "station-photo"
	PhotoLuneID    = "lune-photo"
	PhotoMarsID    = "mars-photo"
	MarsMessageID  = "mars-message"
	StationCallID  = "station-appel"
	CruiseCallID   = CruiseCall
	DustStormID    = "tempete-poussiere"
	RegolithMineID = "lune-regolithe"
)

// MarsLag: the minutes a message takes from Mars to the Earth (one way; a game minute is a real one).
const MarsLag = 12

// SpaceGamePass: a spacewalk scored this much or more is « réussie » (the panel fixed).
const SpaceGamePass = 50

// SpaceSkill: the skill an action up there trains and how much a minute of it counts (as game.SkillOf).
var SpaceSkill = map[string]struct {
	Skill string
	Rate  float64
}{
	"labo-plantes":     {"logique", 1.1},
	"labo-cristaux":    {"logique", 1.1},
	"labo-attieke":     {"cuisine", 1.1},
	"mars-labo-roches": {"logique", 1.2},
	"station-tapis":    {"forme", 1},
	SpacewalkID:        {"bricolage", 1.2},
	"lune-serre":       {"cuisine", 0.8},
	"mars-serre":       {"cuisine", 0.8},
	RegolithMineID:     {"bricolage", 1},
	"lune-margouillat": {"bricolage", 0.6},
	"mars-rover":       {"bricolage", 0.6},
	CruiseFix:          {"bricolage", 0.6},
	CruiseSport:        {"forme", 0.8},
}

// SpaceGames: the actions played as a mini-game (the phone's SortieEVA and the lab's): the game's kind.
var SpaceGames = map[string]string{
	SpacewalkID:     "eva",
	"labo-plantes":  "labo",
	"labo-cristaux": "labo",
	"labo-attieke":  "labo",
}

var (
	onStation = []string{"station-akwaba"}
	onMoon    = []string{"lune"}
	onMars    = []string{"mars"}
)

// espaceVieKinds: the kinds up there, whole (the socle's placeholders' replaced: their ids kept).
var espaceVieKinds = map[string]PlaceKind{
	EspaceStationK: {ID: EspaceStationK, Label: "Module de vie", Icon: "satellite", Interactions: []Interaction{
		{ID: "station-sachet", Label: "Manger un sachet d'attiéké-poisson réhydraté", Icon: "utensils", Minutes: 30, Effect: Needs{Hunger: 55, Fun: 5}, Ages: Adults},
		{ID: "station-kedjenou", Label: "Manger un kédjénou lyophilisé, à la cuillère qui colle", Icon: "cooking-pot", Minutes: 30, Effect: Needs{Hunger: 50, Fun: 8}, Ages: Adults},
		{ID: "station-sac", Label: "Dormir dans le sac de couchage, accroché au mur", Icon: "bed", Minutes: 7 * 60, Effect: spaceSleep, Ages: Adults},
		{ID: "station-eponge", Label: "Faire sa toilette à l'éponge (pas de douche là-haut)", Icon: "droplets", Minutes: 20, Effect: Needs{Hygiene: 35}, Ages: Adults},
		{ID: StationCallID, Label: "Appeler la famille depuis l'orbite", Icon: "phone", Minutes: 20, Effect: Needs{Social: 40, Fun: 10}, Ages: Adults},
		{ID: "station-tapis", Label: "Courir sur le tapis, tenu par les élastiques", Icon: "dumbbell", Minutes: 45, Effect: Needs{Fun: 10, Energy: -15, Hygiene: -15}, Ages: Adults},
		{ID: "station-saltos", Label: "Faire des saltos en apesanteur", Icon: "sparkles", Minutes: 15, Effect: Needs{Fun: 25, Energy: -5}, Ages: Adults},
	}, Events: []RandomEvent{
		{Text: "Une goutte d'eau flotte devant ton nez : tu la gobes comme une bille.", Effect: Needs{Fun: 10}},
		{Text: "Le soleil se lève derrière la Terre, pour la dixième fois aujourd'hui.", Effect: Needs{Fun: 8}},
	}},
	EspaceCoupoleKind: {ID: EspaceCoupoleKind, Label: "Coupole d'observation", Icon: "globe", Interactions: []Interaction{
		{ID: "station-coupole", Label: "Regarder la Terre depuis la coupole", Icon: "globe", Minutes: 30, Effect: Needs{Fun: 35, Social: 5}, Ages: Adults},
		{ID: PhotoTerreID, Label: "Photographier la Terre pour Babigram", Icon: "camera", Minutes: 15, Effect: Needs{Fun: 20, Social: 5}, Ages: Adults},
		{ID: "station-abidjan", Label: "Guetter les lumières d'Abidjan au passage de nuit", Icon: "sparkles", Minutes: 20, Effect: Needs{Fun: 30, Social: 10}, Ages: Adults},
	}},
	EspaceLaboKind: {ID: EspaceLaboKind, Label: "Laboratoire", Icon: "brain", Interactions: []Interaction{
		{ID: "labo-plantes", Label: "Expérience : faire pousser des haricots sans pesanteur", Icon: "sprout", Minutes: 45, Effect: Needs{Fun: 15}, Ages: Adults, Cities: onStation},
		{ID: "labo-cristaux", Label: "Expérience : des cristaux qui grandissent en flottant", Icon: "gem", Minutes: 45, Effect: Needs{Fun: 15}, Ages: Adults, Cities: onStation},
		{ID: "labo-attieke", Label: "Expérience : l'attiéké en apesanteur", Icon: "cooking-pot", Minutes: 45, Effect: Needs{Fun: 20, Hunger: 10}, Ages: Adults, Cities: onStation},
		{ID: "mars-labo-roches", Label: "Analyser les roches rapportées du delta", Icon: "search", Minutes: 45, Effect: Needs{Fun: 15}, Ages: Adults, Cities: onMars},
	}},
	EspaceSasKind: {ID: EspaceSasKind, Label: "Sas", Icon: "door-closed", Interactions: []Interaction{
		{ID: "sas-combinaison", Label: "Vérifier sa combinaison avant le retour", Icon: "shield-check", Minutes: 10, Effect: Needs{Fun: 5}, Ages: Adults},
		{ID: SpacewalkID, Label: "Sortie dans l'espace : réparer un panneau solaire", Icon: "satellite", Minutes: 40, Effect: Needs{Fun: 40, Energy: -15}, Ages: Adults, Cities: onStation},
	}},
	EspaceLuneKind: {ID: EspaceLuneKind, Label: "Base lunaire", Icon: "moon", Interactions: []Interaction{
		{ID: "lune-marcher", Label: "Marcher sur la Lune, à grands bonds", Icon: "footprints", Minutes: 60, Effect: Needs{Fun: 45, Energy: -15}, Ages: Adults},
		{ID: "lune-lever-terre", Label: "Regarder la Terre se lever sur l'horizon", Icon: "sunrise", Minutes: 30, Effect: Needs{Fun: 35}, Ages: Adults},
		{ID: PhotoLuneID, Label: "Photographier le lever de Terre pour Babigram", Icon: "camera", Minutes: 15, Effect: Needs{Fun: 20, Social: 5}, Ages: Adults},
		{ID: "lune-sachet", Label: "Manger un kédjénou lyophilisé", Icon: "utensils", Minutes: 30, Effect: Needs{Hunger: 55}, Ages: Adults},
		{ID: "lune-sac", Label: "Dormir dans la base", Icon: "bed", Minutes: 7 * 60, Effect: spaceSleep, Ages: Adults},
		{ID: "lune-eponge", Label: "Toilette à l'éponge", Icon: "droplets", Minutes: 20, Effect: Needs{Hygiene: 35}, Ages: Adults},
	}},
	EspaceSerreKind: {ID: EspaceSerreKind, Label: "Serre", Icon: "sprout", Interactions: []Interaction{
		{ID: "lune-serre", Label: "S'occuper de la serre : salades et gombo sous les lampes", Icon: "sprout", Minutes: 45, Effect: Needs{Fun: 25}, Ages: Adults, Cities: onMoon},
		{ID: "mars-serre", Label: "S'occuper de la serre du dôme : manioc et piment", Icon: "sprout", Minutes: 45, Effect: Needs{Fun: 25}, Ages: Adults, Cities: onMars},
	}},
	EspaceRoverKind: {ID: EspaceRoverKind, Label: "Rover", Icon: "car", Interactions: []Interaction{
		{ID: "lune-margouillat", Label: "Conduire le Margouillat au bord du cratère Shackleton", Icon: "car", Minutes: 60, Effect: Needs{Fun: 45, Energy: -10}, Ages: Adults, Cities: onMoon},
		{ID: "mars-rover", Label: "Partir en rover jusqu'au delta de Jezero", Icon: "car", Minutes: 90, Effect: Needs{Fun: 50, Energy: -15}, Ages: Adults, Cities: onMars},
	}},
	EspaceMineKind: {ID: EspaceMineKind, Label: "Mine de régolithe", Icon: "shovel", Interactions: []Interaction{
		{ID: RegolithMineID, Label: "Un poste à la mine de régolithe (on en tire l'eau et l'oxygène de la base)", Icon: "shovel", Minutes: 2 * 60, Effect: Needs{Fun: 15, Energy: -25, Hygiene: -20}, Ages: Adults, Cities: onMoon},
	}},
	EspaceMarsKind: {ID: EspaceMarsKind, Label: "Dôme d'Harmattan", Icon: "orbit", Interactions: []Interaction{
		{ID: "mars-marcher", Label: "Marcher dans le cratère Jezero", Icon: "footprints", Minutes: 60, Effect: Needs{Fun: 45, Energy: -15}, Ages: Adults},
		{ID: PhotoMarsID, Label: "Photographier le coucher de soleil bleu de Mars", Icon: "camera", Minutes: 15, Effect: Needs{Fun: 20, Social: 5}, Ages: Adults},
		{ID: "mars-sachet", Label: "Manger un sachet d'attiéké réhydraté", Icon: "utensils", Minutes: 30, Effect: Needs{Hunger: 55}, Ages: Adults},
		{ID: "mars-sac", Label: "Dormir dans la colonie", Icon: "bed", Minutes: 7 * 60, Effect: spaceSleep, Ages: Adults},
		{ID: "mars-eponge", Label: "Toilette à l'éponge", Icon: "droplets", Minutes: 20, Effect: Needs{Hygiene: 35}, Ages: Adults},
		{ID: MarsMessageID, Label: "Enregistrer un message pour la maison (12 minutes de route)", Icon: "mail", Minutes: 20, Effect: Needs{Social: 30}, Ages: Adults},
	}},
}

// The dust storm at the Colonie Harmattan (HappeningAt: up there, only this).
var dustStorm = Happening{
	ID: DustStormID, Category: "saison", Source: Fictional, Label: "Tempête de poussière", Icon: "eye",
	Text: "Une tempête de poussière couvre le ciel de Jezero : le dôme devient orange, tout le monde rentre.",
	Join: &Interaction{ID: JoinHappeningID, Label: "Regarder la tempête depuis le dôme, bien à l'abri", Icon: "eye", Minutes: 60, Effect: Needs{Fun: 30, Social: 15}},
}

// DustStormOneIn: one slot in this many, the storm blows over the colony.
const DustStormOneIn = 4

// SpaceHappeningAt: what's going on up there (only Mars's dust storm, at the colony): a pure function of the clock.
func SpaceHappeningAt(city, commune string, gameMinutes int64) (Happening, int64, bool) {
	slot := gameMinutes / HappeningMinutes
	start := slot * HappeningMinutes
	if city != "mars" || commune != "mars-colonie" || gameMinutes < 0 {
		return Happening{}, start, false
	}
	if launchHash("tempete:"+strconv.FormatInt(slot, 10))%DustStormOneIn != 0 {
		return Happening{}, start, false
	}
	return dustStorm, start, true
}

func init() {
	for id, k := range espaceVieKinds {
		Kinds[id] = k
	}
	EspaceActs[EspaceStationKey] = append(EspaceActs[EspaceStationKey], "station-kedjenou", "station-saltos", PhotoTerreID, "station-abidjan", "labo-plantes", "labo-cristaux", "labo-attieke", SpacewalkID)
	EspaceActs[EspaceLuneKey] = append(EspaceActs[EspaceLuneKey], PhotoLuneID, "lune-serre", "lune-margouillat", RegolithMineID)
	EspaceActs[EspaceMarsKey] = append(EspaceActs[EspaceMarsKey], PhotoMarsID, "mars-labo-roches", "mars-rover")
	Moodlets["sortie-eva"] = MoodletDef{"Une sortie dans le vide", "satellite", 3, 240}
	Moodlets["photo-espace"] = MoodletDef{"Une photo que personne n'a", "camera", 2, 180}
	Moodlets["savant-espace"] = MoodletDef{"Une expérience réussie", "brain", 2, 180}
	Moodlets["nouvelles-terre"] = MoodletDef{"Des nouvelles de la maison", "mail", 3, 240}
}
