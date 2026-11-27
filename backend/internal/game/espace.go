package game

import (
	"fmt"
	"hash/fnv"
	"strconv"
)

// L'espace (the updates « espace », « espace-station », « espace-lune », « espace-mars »; world/espace.go,
// world/espaceTerre.go, sims/espace.go; web lib/espace.ts). The game's own space agency, Astrélia (its siège at
// the Plateau), flies from four spaceports on Earth (Sassandra, its hub, Kourou, Cap Canaveral, Baïkonour) to
// three places up there: the Station Akwaba in low orbit, the Base Clair-de-Terre on the Moon, the Colonie
// Harmattan on Mars. Every brand is the game's own (the rocket Calao, the capsule Pirogue…): no real agency,
// company or launcher. PG: nobody is ever hurt; a launch is « reporté », a walk ends « retour au sas ».
//
// The rules of money (docs/economie.md, « L'espace »): a ticket is bought at the pad, once, for oneself only;
// cancelled before boarding it gives back 80 % of what it cost, after the launch nothing; nothing done up there
// pays (only the career's shift, in its daily cap); the way back always works, whatever the Sim has left.
//
// What the other workstreams plug in (each in its own file):
//   - the careers and the training (game/espaceCarriere.go): Careers appended in an init, and Missions (below).
//   - the Earth's activities (game/espaceTerreActs.go) and those up there (game/espaceActs.go): addActs(…) on
//     the kinds below (or Kinds[k] replaced whole), their ids added to EspaceActs[key] for the closed updates.

// The four updates.
const (
	EspaceKey        = "espace"
	EspaceStationKey = "espace-station"
	EspaceLuneKey    = "espace-lune"
	EspaceMarsKey    = "espace-mars"
)

// The game's names (all invented).
const (
	Agency      = "Astrélia"
	AgencySiege = "Siège d'Astrélia"
	Rocket      = "Calao-1"
	RocketHeavy = "Calao Lourd"
	Capsule     = "Pirogue"
	MarsShip    = "Grande Pirogue"
	ZeroGPlane  = "Albatros 0G"
	MoonRover   = "Margouillat"
	// SpaceCountry: the space's « country » (world/espace.go): never a country of the Earth.
	SpaceCountry = "espace"
	// RocketApp: the trip's mode (sims/clock.go leaveWith: ride.App).
	RocketApp = "fusee"
	// AstreliaSiegeID: the agency's siège, at the Plateau (world/espaceTerre.go).
	AstreliaSiegeID = "plateau-astrelia"
)

// The kinds of places (the pad on Earth; the modules, the capsule and the bases up there).
const (
	SpatioportKind   = "spatioport"
	EspaceStationK   = "espace-station"
	EspaceSasKind    = "espace-sas"
	EspaceCapsuleK   = "espace-capsule"
	EspaceLuneKind   = "espace-lune"
	EspaceMarsKind   = "espace-mars"
	EspaceKindPrefix = "espace-"
)

// The prices (francs; every trip includes the way back).
const (
	PriceSuborbital = 1_500_000
	PriceStation    = 12_000_000
	PriceLune       = 45_000_000
	PriceMars       = 150_000_000
	// StationNights: the nights aboard the ticket includes; each one more, StationNight (charged on the way
	// back, never more than the Sim has: the return always works).
	StationNights = 3
	StationNight  = 400_000
	// RefundPercent: a ticket cancelled before boarding gives this much back.
	RefundPercent = 80
	// SpaceMinAge: from 18 only.
	SpaceMinAge = 18
	// SpaceMinEnergy: too tired, no boarding (the preflight's medical).
	SpaceMinEnergy = 30
)

// The pacing (real minutes: a game minute is a real one).
const (
	// LaunchEvery, CargoEvery: a crewed launch every 3 hours from each spaceport, a cargo every 90 minutes.
	LaunchEvery = 180
	CargoEvery  = 90
	// ScrubOneIn: one launch in this many is « reporté » (the weather, a sensor): deterministic (Scrubbed).
	ScrubOneIn = 10
	// BoardWindow: the boarding opens this long before a launch; Preflight: the suit-up, the medical, the walk
	// to the pad (the shortest wait there is).
	BoardWindow = 20
	Preflight   = 5
	// LaunchLeg: from the ignition to the station's dock (or to the cruise); ReturnLeg: the re-entry, the
	// parachutes, the splashdown or the steppe; LandingLeg: from the cruise down to the Moon or Mars.
	LaunchLeg  = 8
	ReturnLeg  = 8
	LandingLeg = 4
	// FloatLeg: from one module (or one part of the base) to another.
	FloatLeg = 1
)

// Spaceport: where the rockets leave from on Earth, and where those coming back land.
type Spaceport struct {
	// ID: its city's (world/espaceTerre.go).
	ID   string `json:"id"`
	Name string `json:"name"`
	// Commune, Pad: the pad's commune and place (where one boards).
	Commune string `json:"commune"`
	Pad     string `json:"pad"`
	// Splash: the commune the way back lands in; Landing: "mer" (a splashdown, the boat) or "steppe".
	Splash  string `json:"splash"`
	Landing string `json:"landing"`
	// Key: its region's update ("" Côte d'Ivoire's), with « espace ».
	Key string `json:"key,omitempty"`
}

// Spaceports: by city.
var Spaceports = map[string]Spaceport{
	"sassandra":     {ID: "sassandra", Name: "Spatioport Astrélia de Sassandra", Commune: "sassandra-spatioport", Pad: "sassandra-pas-de-tir", Splash: "sassandra-centre", Landing: "mer"},
	"kourou":        {ID: "kourou", Name: "Ensemble de lancement Calao de Kourou", Commune: "kourou-spatioport", Pad: "kourou-pas-de-tir", Splash: "kourou-centre", Landing: "mer", Key: AmeriquesKey},
	"cap-canaveral": {ID: "cap-canaveral", Name: "Pas de tir Calao de Canaveral", Commune: "canaveral-merritt", Pad: "canaveral-pas-de-tir", Splash: "canaveral-cocoa", Landing: "mer", Key: USAKey},
	"baikonour":     {ID: "baikonour", Name: "Pas de tir Calao de Baïkonour", Commune: "baikonour-steppe", Pad: "baikonour-pas-de-tir", Splash: "baikonour-centre", Landing: "steppe", Key: AsieKey},
}

// SpaceportIDs: the four, in a set order (the hub first).
var SpaceportIDs = []string{"sassandra", "kourou", "cap-canaveral", "baikonour"}

// SpaceportAt: the spaceport whose pad is in this commune.
func SpaceportAt(city, commune string) (Spaceport, bool) {
	sp, ok := Spaceports[city]
	if !ok || sp.Commune != commune {
		return Spaceport{}, false
	}
	return sp, true
}

// Destination: a place up there one flies to.
type Destination struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// City, Commune: where one lands (world/espace.go); Cruise: the capsule's commune, where the cruise is
	// lived (the Moon's, Mars's), "" when the rocket docks straight (the station).
	City    string `json:"city"`
	Commune string `json:"commune"`
	Cruise  string `json:"cruise,omitempty"`
	// Rounds, Steps: the cruise's rounds, each its steps to do (the capsule's actions).
	Rounds int      `json:"rounds"`
	Steps  []string `json:"steps,omitempty"`
	Price  int      `json:"price"`
	Key    string   `json:"key"`
	Rocket string   `json:"rocket"`
	Ship   string   `json:"ship"`
	// Ticket: the pad's action that buys it.
	Ticket string `json:"ticket"`
}

// The cruise's steps (the capsule, espace-capsule).
const (
	CruiseSleep = "croisiere-dormir"
	CruiseMeal  = "croisiere-repas"
	CruiseSport = "croisiere-sport"
	CruiseFix   = "croisiere-maintenance"
	CruiseCall  = "croisiere-appel"
)

// The tickets' actions at the pad.
const (
	TicketStation = "espace-billet-station"
	TicketLune    = "espace-billet-lune"
	TicketMars    = "espace-billet-mars"
	TicketCancel  = "espace-billet-annuler"
	PadWatch      = "espace-pas-de-tir-regarder"
)

// Destinations: the three, nearest first.
var Destinations = []Destination{
	{ID: "station", Name: "Station Akwaba", City: "station-akwaba", Commune: "akwaba-noeud", Price: PriceStation, Key: EspaceStationKey, Rocket: Rocket, Ship: Capsule, Ticket: TicketStation},
	{ID: "lune", Name: "Base Clair-de-Terre", City: "lune", Commune: "lune-base", Cruise: "lune-pirogue", Rounds: 1, Steps: []string{CruiseSleep, CruiseMeal, CruiseFix}, Price: PriceLune, Key: EspaceLuneKey, Rocket: Rocket, Ship: Capsule, Ticket: TicketLune},
	{ID: "mars", Name: "Colonie Harmattan", City: "mars", Commune: "mars-colonie", Cruise: "mars-pirogue", Rounds: 3, Steps: []string{CruiseSleep, CruiseSport, CruiseMeal, CruiseFix, CruiseCall}, Price: PriceMars, Key: EspaceMarsKey, Rocket: RocketHeavy, Ship: MarsShip, Ticket: TicketMars},
}

// FindDestination: by its id ("station", "lune", "mars").
func FindDestination(id string) (Destination, bool) {
	for _, d := range Destinations {
		if d.ID == id {
			return d, true
		}
	}
	return Destination{}, false
}

// DestinationOfCity: the destination a space city is (by its world id).
func DestinationOfCity(city string) (Destination, bool) {
	for _, d := range Destinations {
		if d.City == city {
			return d, true
		}
	}
	return Destination{}, false
}

// DestinationOfTicket: the destination the pad's action buys.
func DestinationOfTicket(action string) (Destination, bool) {
	for _, d := range Destinations {
		if d.Ticket == action {
			return d, true
		}
	}
	return Destination{}, false
}

// Refund: what a ticket bought for `paid` gives back, cancelled before boarding (never more than paid).
func Refund(paid int) int {
	if paid <= 0 {
		return 0
	}
	return min(paid, paid*RefundPercent/100)
}

// ExtraNights: what the nights aboard the station past those included cost (nights: the nights spent).
func ExtraNights(nights int) int {
	return max(0, nights-StationNights) * StationNight
}

/* ---------- The timetable ---------- */

// Launch: one launch from a spaceport (game minute At).
type Launch struct {
	Spaceport string `json:"spaceport"`
	At        int64  `json:"at"`
	// Crewed: a crew aboard (the cargo flies alone, seen in the sky only).
	Crewed bool `json:"crewed"`
	// Scrub: « lancement reporté » (one in ScrubOneIn).
	Scrub bool `json:"scrub,omitempty"`
}

// launchHash: FNV-1a over the string (the phone's lib/espace.ts the same, to the bit).
func launchHash(s string) uint32 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(s))
	return h.Sum32()
}

// LaunchOffset: when in its period a spaceport's crewed (or cargo) launches fall, hashed from its id.
func LaunchOffset(spaceport string, crewed bool) int64 {
	if crewed {
		return int64(launchHash(spaceport) % LaunchEvery)
	}
	return int64(launchHash(spaceport+":cargo") % CargoEvery)
}

// Scrubbed: whether the n-th launch of that kind from that spaceport is « reporté ».
func Scrubbed(spaceport string, crewed bool, n int64) bool {
	kind := "h"
	if !crewed {
		kind = "c"
	}
	return launchHash(spaceport+":"+kind+":"+strconv.FormatInt(n, 10))%ScrubOneIn == 0
}

// LaunchAt: the n-th launch of that kind from that spaceport (n may be negative: before the epoch).
func LaunchAt(spaceport string, crewed bool, n int64) Launch {
	every := int64(CargoEvery)
	if crewed {
		every = LaunchEvery
	}
	return Launch{Spaceport: spaceport, At: n*every + LaunchOffset(spaceport, crewed), Crewed: crewed, Scrub: Scrubbed(spaceport, crewed, n)}
}

// launchIndex: the first n whose launch is at or after `from`.
func launchIndex(spaceport string, crewed bool, from int64) int64 {
	every := int64(CargoEvery)
	if crewed {
		every = LaunchEvery
	}
	d := from - LaunchOffset(spaceport, crewed)
	n := d / every
	if d%every != 0 && d > 0 {
		n++
	}
	if d < 0 {
		n = -((-d) / every)
	}
	return n
}

// LaunchTimetable: the launches (crewed and cargo, scrubbed ones too) from a spaceport in [from, to), in order.
func LaunchTimetable(spaceport string, from, to int64) []Launch {
	var out []Launch
	for _, crewed := range []bool{true, false} {
		for n := launchIndex(spaceport, crewed, from); ; n++ {
			l := LaunchAt(spaceport, crewed, n)
			if l.At >= to {
				break
			}
			if l.At >= from {
				out = append(out, l)
			}
		}
	}
	// In time order (two lists merged).
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j].At < out[j-1].At; j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out
}

// NextLaunch: the next crewed launch not « reporté » from a spaceport, at or after now (game minute).
func NextLaunch(spaceport string, now int64) Launch {
	for n := launchIndex(spaceport, true, now); ; n++ {
		if l := LaunchAt(spaceport, true, n); !l.Scrub && l.At >= now {
			return l
		}
	}
}

// LaunchRules: what the phone needs to work the timetable out itself (lib/espace.ts), with the prices.
func LaunchRules() map[string]any {
	ports := make([]Spaceport, 0, len(SpaceportIDs))
	for _, id := range SpaceportIDs {
		ports = append(ports, Spaceports[id])
	}
	return map[string]any{
		"agency": Agency, "every": LaunchEvery, "cargoEvery": CargoEvery, "scrubOneIn": ScrubOneIn,
		"boardWindow": BoardWindow, "preflight": Preflight, "launchLeg": LaunchLeg, "returnLeg": ReturnLeg, "landingLeg": LandingLeg,
		"spaceports": ports, "destinations": Destinations, "refund": RefundPercent, "minAge": SpaceMinAge, "minEnergy": SpaceMinEnergy,
		"stationNights": StationNights, "stationNight": StationNight, "suborbital": PriceSuborbital,
	}
}

/* ---------- The places' kinds and their actions ---------- */

// Missions: a career's mission aboard (game/espaceCarriere.go fills it): the career that flies free, and to where.
var Missions = map[string][]string{}

// FliesFree: whether this career flies there free (a mission: no ticket).
func FliesFree(career, dest string) bool {
	for _, d := range Missions[career] {
		if d == dest {
			return true
		}
	}
	return false
}

// EspaceActs: each update's actions (features.go), the other workstreams' appended to theirs in an init.
var EspaceActs = map[string][]string{
	EspaceKey:        {TicketCancel, PadWatch},
	EspaceStationKey: {TicketStation, "station-coupole", "station-sachet", "station-sac", "station-eponge", "station-appel", "station-tapis", "sas-combinaison"},
	EspaceLuneKey:    {TicketLune, CruiseSleep, CruiseMeal, CruiseFix, "lune-marcher", "lune-lever-terre", "lune-sachet", "lune-sac", "lune-eponge"},
	EspaceMarsKey:    {TicketMars, CruiseSport, CruiseCall, "mars-marcher", "mars-serre", "mars-sachet", "mars-sac", "mars-eponge", "mars-message"},
}

// spaceSleep: sleeping in a sleeping bag, strapped to the wall: rests 0.8 times as much as a bed (home's sleep).
var spaceSleep = Needs{Energy: 80, Hunger: -10, Hygiene: -10}

// The placeholders' kinds (B, C and D enrich them: their own files' addActs).
var espaceKinds = map[string]PlaceKind{
	SpatioportKind: {ID: SpatioportKind, Label: "Spatioport", Icon: "rocket", Interactions: []Interaction{
		{ID: TicketStation, Label: "Acheter un billet pour la Station Akwaba (3 nuits comprises)", Icon: "ticket", Minutes: 20, Cost: PriceStation, Effect: Needs{Fun: 10}, Ages: Adults},
		{ID: TicketLune, Label: "Acheter un billet pour la Base Clair-de-Terre, sur la Lune", Icon: "ticket", Minutes: 20, Cost: PriceLune, Effect: Needs{Fun: 10}, Ages: Adults},
		{ID: TicketMars, Label: "Acheter un billet pour la Colonie Harmattan, sur Mars", Icon: "ticket", Minutes: 20, Cost: PriceMars, Effect: Needs{Fun: 10}, Ages: Adults},
		{ID: TicketCancel, Label: "Annuler mon billet (80 % remboursés)", Icon: "ticket-x", Minutes: 10, Ages: Adults},
		{ID: PadWatch, Label: "Regarder la fusée Calao sur son pas de tir", Icon: "rocket", Minutes: 20, Effect: Needs{Fun: 15}},
	}, Events: []RandomEvent{
		{Text: "Un technicien en blouse t'explique les trois étages de la Calao, les mains dans tous les sens.", Effect: Needs{Fun: 5, Social: 5}},
		{Text: "La tour de lancement s'écarte doucement de la fusée : tout le monde lève la tête.", Effect: Needs{Fun: 8}},
	}},
	EspaceStationK: {ID: EspaceStationK, Label: "Module de la station", Icon: "satellite", Interactions: []Interaction{
		{ID: "station-coupole", Label: "Regarder la Terre depuis la coupole", Icon: "globe", Minutes: 30, Effect: Needs{Fun: 35, Social: 5}, Ages: Adults},
		{ID: "station-sachet", Label: "Manger un sachet d'attiéké-poisson réhydraté", Icon: "utensils", Minutes: 30, Effect: Needs{Hunger: 55, Fun: 5}, Ages: Adults},
		{ID: "station-sac", Label: "Dormir dans le sac de couchage, accroché au mur", Icon: "bed", Minutes: 7 * 60, Effect: spaceSleep, Ages: Adults},
		{ID: "station-eponge", Label: "Faire sa toilette à l'éponge (pas de douche là-haut)", Icon: "droplets", Minutes: 20, Effect: Needs{Hygiene: 35}, Ages: Adults},
		{ID: "station-appel", Label: "Appeler la famille depuis l'orbite", Icon: "phone", Minutes: 20, Effect: Needs{Social: 40, Fun: 10}, Ages: Adults},
		{ID: "station-tapis", Label: "Courir sur le tapis, tenu par les élastiques", Icon: "dumbbell", Minutes: 45, Effect: Needs{Fun: 10, Energy: -15, Hygiene: -15}, Ages: Adults},
	}, Events: []RandomEvent{
		{Text: "Une goutte d'eau flotte devant ton nez : tu la gobes comme une bille.", Effect: Needs{Fun: 10}},
		{Text: "Le soleil se lève derrière la Terre, pour la dixième fois aujourd'hui.", Effect: Needs{Fun: 8}},
	}},
	EspaceSasKind: {ID: EspaceSasKind, Label: "Sas d'amarrage", Icon: "door-closed", Interactions: []Interaction{
		{ID: "sas-combinaison", Label: "Vérifier sa combinaison avant le retour", Icon: "shield-check", Minutes: 10, Effect: Needs{Fun: 5}, Ages: Adults},
	}},
	EspaceCapsuleK: {ID: EspaceCapsuleK, Label: "La capsule", Icon: "rocket", Interactions: []Interaction{
		{ID: CruiseSleep, Label: "Dormir pendant la croisière", Icon: "bed", Minutes: 2 * 60, Effect: Needs{Energy: 35}, Ages: Adults},
		{ID: CruiseMeal, Label: "Prendre le repas de bord", Icon: "utensils", Minutes: 2 * 60, Effect: Needs{Hunger: 45}, Ages: Adults},
		{ID: CruiseSport, Label: "Faire sa séance de sport à bord", Icon: "dumbbell", Minutes: 2 * 60, Effect: Needs{Fun: 5, Energy: -10}, Ages: Adults},
		{ID: CruiseFix, Label: "La maintenance du vaisseau", Icon: "wrench", Minutes: 2 * 60, Effect: Needs{Fun: 10}, Ages: Adults},
		{ID: CruiseCall, Label: "Appeler la maison (la voix arrive en retard)", Icon: "phone", Minutes: 2 * 60, Effect: Needs{Social: 30}, Ages: Adults},
	}},
	EspaceLuneKind: {ID: EspaceLuneKind, Label: "Base lunaire", Icon: "moon", Interactions: []Interaction{
		{ID: "lune-marcher", Label: "Marcher sur la Lune, à grands bonds", Icon: "footprints", Minutes: 60, Effect: Needs{Fun: 45, Energy: -15}, Ages: Adults},
		{ID: "lune-lever-terre", Label: "Regarder la Terre se lever sur l'horizon", Icon: "sunrise", Minutes: 30, Effect: Needs{Fun: 35}, Ages: Adults},
		{ID: "lune-sachet", Label: "Manger un kédjénou lyophilisé", Icon: "utensils", Minutes: 30, Effect: Needs{Hunger: 55}, Ages: Adults},
		{ID: "lune-sac", Label: "Dormir dans la base", Icon: "bed", Minutes: 7 * 60, Effect: spaceSleep, Ages: Adults},
		{ID: "lune-eponge", Label: "Toilette à l'éponge", Icon: "droplets", Minutes: 20, Effect: Needs{Hygiene: 35}, Ages: Adults},
	}},
	EspaceMarsKind: {ID: EspaceMarsKind, Label: "Colonie martienne", Icon: "orbit", Interactions: []Interaction{
		{ID: "mars-marcher", Label: "Marcher dans le cratère Jezero", Icon: "footprints", Minutes: 60, Effect: Needs{Fun: 45, Energy: -15}, Ages: Adults},
		{ID: "mars-serre", Label: "S'occuper de la serre du dôme", Icon: "sprout", Minutes: 45, Effect: Needs{Fun: 25}, Ages: Adults},
		{ID: "mars-sachet", Label: "Manger un sachet d'attiéké réhydraté", Icon: "utensils", Minutes: 30, Effect: Needs{Hunger: 55}, Ages: Adults},
		{ID: "mars-sac", Label: "Dormir dans la colonie", Icon: "bed", Minutes: 7 * 60, Effect: spaceSleep, Ages: Adults},
		{ID: "mars-eponge", Label: "Toilette à l'éponge", Icon: "droplets", Minutes: 20, Effect: Needs{Hygiene: 35}, Ages: Adults},
		{ID: "mars-message", Label: "Enregistrer un message pour la maison (12 minutes de route)", Icon: "mail", Minutes: 20, Effect: Needs{Social: 30}, Ages: Adults},
	}},
}

func init() {
	// The spaceports' towns fly (Sassandra with « espace »; the others with their region) and Sassandra has its gare.
	for id, a := range map[string]Airport{
		"sassandra":     {"sassandra", "sassandra-centre", "sassandra-aeroport", EspaceKey},
		"kourou":        {"kourou", "kourou-centre", "kourou-aeroport", AmeriquesKey},
		"cap-canaveral": {"cap-canaveral", "canaveral-titusville", "canaveral-aeroport", USAKey},
		"baikonour":     {"baikonour", "baikonour-centre", "baikonour-aeroport", AsieKey},
	} {
		Airports[id] = a
	}
	Gares["sassandra"] = Gare{"sassandra", "sassandra-centre", "sassandra-gare"}
	for id, k := range espaceKinds {
		if _, ok := Kinds[id]; !ok {
			Kinds[id] = k
		}
	}
	Moodlets["mal-espace"] = MoodletDef{"Mal de l'espace", "loader", -1, 90}
	Moodlets["terre-haut"] = MoodletDef{"La Terre vue d'en haut", "globe", 3, 360}
}

// IsSpaceKind: a kind of place up there (espace-*).
func IsSpaceKind(kind string) bool {
	return len(kind) > len(EspaceKindPrefix) && kind[:len(EspaceKindPrefix)] == EspaceKindPrefix
}

// TicketLabel: the line the journal says when a ticket is bought.
func TicketLabel(d Destination, paid int) string {
	return fmt.Sprintf("Billet %s acheté : %s, vol %s. Rends-toi au pas de tir à l'heure du lancement.", d.Name, FCFA(paid), d.Rocket)
}
