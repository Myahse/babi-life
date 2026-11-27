package sims

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// L'espace (the updates « espace », « espace-station », « espace-lune », « espace-mars »; game/espace.go): the
// ticket bought at the pad (once, for oneself), the rocket taken at the next launch (clock.go leaveWith, the mode
// « fusee »), the arrival up there, the cruise's rounds to the Moon and Mars (like the army's, armee.go: each
// round its steps, done in the capsule), and the way back, which always works. Kept in the Sim's Life.
//
// The hooks the other workstreams use: Espace.Training (B, sims/espaceFormation.go sets it), game.Missions (B:
// a career that flies free), spaceDone (D, sims/espaceVie.go: what an action up there does once it ends).

// Espace: what the agency keeps of a Sim.
type Espace struct {
	// Ticket: bought, not used yet (one at a time).
	Ticket *SpaceTicket `json:"ticket,omitempty"`
	// Voyage: up there (or on the way), nil on Earth.
	Voyage *SpaceVoyage `json:"voyage,omitempty"`
	// Training: the tourists' short training done (B: sims/espaceFormation.go; the tester's « espace-formation »).
	Training bool `json:"training,omitempty"`
	// Visited: the destinations been to (game.Destination ids); Missions: the missions flown.
	Visited  []string `json:"visited,omitempty"`
	Missions int      `json:"missions,omitempty"`
	// LaunchNow: the tester's « espace-lancer »: the next boarding takes off at once, whatever the timetable.
	LaunchNow bool `json:"launchNow,omitempty"`
	// Formation: the training centre's record, the careers' missions (espaceFormation.go).
	Formation *Formation `json:"formation,omitempty"`
	// Vie: the life up there (D: espaceVie.go): the messages from Mars on their way, the mini-games' scores.
	Vie *EspaceVie `json:"vie,omitempty"`
}

// SpaceTicket: a ticket for a destination, what it cost and when.
type SpaceTicket struct {
	Dest   string `json:"dest"`
	Paid   int    `json:"paid"`
	Bought int64  `json:"bought"`
}

// SpaceVoyage: the journey being lived.
type SpaceVoyage struct {
	Dest string `json:"dest"`
	// From: the spaceport it left from (the way back lands there).
	From string `json:"from"`
	// Round, Rounds, Steps, Done: the cruise (the Moon's, Mars's): the rounds passed, this round's steps done.
	Round  int      `json:"round"`
	Rounds int      `json:"rounds"`
	Steps  []string `json:"steps,omitempty"`
	Done   []string `json:"done"`
	// Launched: the launch's game minute; Arrived: landed or docked (0: not yet).
	Launched int64 `json:"launched"`
	Arrived  int64 `json:"arrived,omitempty"`
	// Paid: what the ticket cost (0: a mission).
	Paid    int  `json:"paid,omitempty"`
	Mission bool `json:"mission,omitempty"`
}

var (
	errNotAtPad      = errors.New("la fusée part du pas de tir d'un spatioport : Sassandra, Kourou, Cap Canaveral ou Baïkonour")
	errNoTicket      = errors.New("il te faut un billet : achète-le au pas de tir")
	errTicketHeld    = errors.New("tu as déjà un billet : un seul à la fois (annule-le d'abord)")
	errNoTicketHeld  = errors.New("tu n'as pas de billet à annuler")
	errSpaceAge      = fmt.Errorf("l'espace, c'est à partir de %d ans", game.SpaceMinAge)
	errSpaceTired    = errors.New("trop fatigué·e pour la visite médicale : repose-toi avant le lancement")
	errSpaceClosed   = errors.New("bientôt dans le jeu")
	errInSpace       = errors.New("tu es dans l'espace : rentre d'abord sur Terre (au sas, « Rentrer sur Terre »)")
	errCruising      = errors.New("la capsule est en croisière : fais d'abord les tâches de bord, l'atterrissage viendra")
	errNoRocketThere = errors.New("la fusée ne va que dans l'espace")
	errSpaceBusy     = errors.New("tu es déjà là-haut")
)

// space: the Sim's space record, made when asked.
func (s *Sim) space() *Espace {
	if s.Life.Espace == nil {
		s.Life.Espace = &Espace{}
	}
	return s.Life.Espace
}

// voyage: the journey being lived, nil when none.
func (s *Sim) voyage() *SpaceVoyage {
	if s.Life.Espace == nil {
		return nil
	}
	return s.Life.Espace.Voyage
}

// inSpace: up there now.
func (s *Sim) inSpace() bool { return world.IsSpace(s.City) }

// spaceOpen: the update (and the others it needs) open.
func spaceOpen(keys ...string) bool {
	for _, k := range keys {
		if k != "" && !features.Default.Open(context.Background(), k) {
			return false
		}
	}
	return true
}

// rocketTrip: a trip by rocket (leaveWith's mode « fusee »), or any trip from or to up there: the launch from
// the pad, a float from one module to another, the landing after the cruise, the way back to Earth.
func (s *Sim) rocketTrip(toCity world.City, toCommune world.Commune, app string) error {
	fromCity, _ := world.FindCity(s.City)
	fromCommune, _ := fromCity.Commune(s.Commune)
	switch {
	case world.IsSpace(fromCity.ID) && fromCity.ID == toCity.ID:
		return s.spaceFloat(fromCity, fromCommune, toCommune)
	case world.IsSpace(fromCity.ID):
		// Back to Earth only by the rocket (asked for); an invitation, a taxi called from up there: no.
		if app != game.RocketApp {
			return errInSpace
		}
		return s.spaceReturn(fromCity, fromCommune)
	case world.IsSpace(toCity.ID):
		return s.spaceLaunch(fromCity, fromCommune, toCity)
	}
	return errNoRocketThere
}

// spaceLaunch: boarding at the pad for the next launch: the ticket (or the mission), 18 and over, rested enough;
// the ticket is used there and then (it was paid when bought: nothing more to pay).
func (s *Sim) spaceLaunch(fromCity world.City, fromCommune world.Commune, toCity world.City) error {
	sp, ok := game.SpaceportAt(fromCity.ID, fromCommune.ID)
	if !ok {
		return errNotAtPad
	}
	d, ok := game.DestinationOfCity(toCity.ID)
	if !ok {
		return errNoRocketThere
	}
	if !spaceOpen(game.EspaceKey, d.Key, sp.Key) {
		return errSpaceClosed
	}
	if s.age() < game.SpaceMinAge {
		return errSpaceAge
	}
	if s.Needs.Energy < game.SpaceMinEnergy {
		return errSpaceTired
	}
	e := s.space()
	if e.Voyage != nil {
		return errSpaceBusy
	}
	mission := s.missionAllowed(d.ID)
	if !mission && (e.Ticket == nil || e.Ticket.Dest != d.ID) {
		if e.Ticket != nil {
			if have, ok := game.FindDestination(e.Ticket.Dest); ok {
				return fmt.Errorf("ton billet est pour %s, pas pour %s", have.Name, d.Name)
			}
		}
		return errNoTicket
	}
	// The preflight's medical (espaceFormation.go): not sick, trained.
	if err := s.spaceBoard(); err != nil {
		return err
	}
	now := s.GameMinutes
	l := game.NextLaunch(sp.ID, now+game.Preflight)
	if e.LaunchNow {
		l = game.Launch{Spaceport: sp.ID, At: now + game.Preflight, Crewed: true}
		e.LaunchNow = false
	}
	if l.At-now > game.BoardWindow {
		return fmt.Errorf("prochain lancement habité à %s : l'embarquement ouvre %d minutes avant", game.ClockLabel(l.At), game.BoardWindow)
	}
	paid := 0
	if !mission {
		paid = e.Ticket.Paid
		e.Ticket = nil
	}
	landIn := d.Commune
	if d.Cruise != "" {
		landIn = d.Cruise
	}
	to, _ := toCity.Commune(landIn)
	e.Voyage = &SpaceVoyage{Dest: d.ID, From: sp.ID, Rounds: d.Rounds, Steps: slices.Clone(d.Steps), Done: []string{}, Launched: l.At, Paid: paid, Mission: mission}
	label := fmt.Sprintf("Lancement %s %s → %s, décollage %s", d.Rocket, fromCity.Name, d.Name, game.ClockLabel(l.At))
	s.rocketGo(fromCity, fromCommune, toCity, to, (l.At-now)+game.LaunchLeg, label, sp.Pad, l.At)
	return nil
}

// rocketGo: the trip under way (no fare: the ticket paid it).
func (s *Sim) rocketGo(fromCity world.City, fromCommune world.Commune, toCity world.City, to world.Commune, minutes int64, label, fromPlace string, departs int64) {
	trip := &game.Trip{FromCity: fromCity.ID, FromCommune: fromCommune.ID, City: toCity.ID, Commune: to.ID, Mode: game.RocketApp, Label: label, FromPlace: fromPlace, Company: game.Agency, Departs: departs}
	s.Activity = &game.Activity{
		Kind: "travel", Interaction: game.Interaction{ID: "travel", Label: label, Icon: "rocket", Minutes: minutes},
		Start: s.GameMinutes, End: s.GameMinutes + max(1, minutes), Trip: trip,
	}
}

// spaceFloat: from one module (one part of the base) to another; never out of the capsule before the landing.
func (s *Sim) spaceFloat(city world.City, from, to world.Commune) error {
	if from.ID == to.ID {
		return fmt.Errorf("tu y es déjà")
	}
	if v := s.voyage(); v != nil && v.Arrived == 0 {
		return errCruising
	}
	if d, ok := game.DestinationOfCity(city.ID); ok && to.ID == d.Cruise {
		return errors.New("la capsule ne repart qu'avec le retour sur Terre")
	}
	s.rocketGo(city, from, city, to, game.FloatLeg, fmt.Sprintf("Flotter jusqu'à %s", to.Name), "", 0)
	s.Activity.Trip.Mode = "flotte"
	return nil
}

// spaceReturn: the way back to the spaceport left from: re-entry, parachutes, the sea or the steppe. It always
// works (no ticket, no money, no age, whatever the updates say): only the station's nights past those included
// are charged, never more than the Sim has.
func (s *Sim) spaceReturn(fromCity world.City, fromCommune world.Commune) error {
	e := s.space()
	v := e.Voyage
	sp := game.Spaceports["sassandra"]
	if v != nil {
		if from, ok := game.Spaceports[v.From]; ok {
			sp = from
		}
	}
	earth, _ := world.FindCity(sp.ID)
	to, _ := earth.Commune(sp.Splash)
	note := ""
	if v != nil && v.Dest == "station" && v.Arrived > 0 && !v.Mission {
		nights := int((s.GameMinutes - v.Arrived) / (24 * 60))
		if cost := min(game.ExtraNights(nights), max(0, s.Money)); cost > 0 {
			s.Money -= cost
			note = fmt.Sprintf(" (nuits en plus à bord : %s)", game.FCFA(cost))
		}
	}
	e.Voyage = nil
	how := "amerrissage au large"
	if sp.Landing == "steppe" {
		how = "atterrissage dans la steppe"
	}
	label := fmt.Sprintf("Retour sur Terre : rentrée atmosphérique, parachutes, %s, %s%s", how, earth.Name, note)
	s.rocketGo(fromCity, fromCommune, earth, to, game.ReturnLeg, label, "", s.GameMinutes)
	return nil
}

// rocketArrived: a rocket's trip over (clock.go finish): docked, in cruise, landed, back home. The line it says.
func (s *Sim) rocketArrived(t *game.Trip) []Event {
	if t == nil || t.Mode != game.RocketApp {
		return nil
	}
	v := s.voyage()
	d, up := game.DestinationOfCity(t.City)
	switch {
	case !up:
		s.addMood("terre-haut", "")
		return []Event{{Kind: "life", Text: "Bienvenue sur Terre ! L'équipe d'Astrélia t'aide à sortir de la capsule. Les jambes sont lourdes, le sourire est grand.", GameTime: s.GameMinutes}}
	case v == nil:
		return nil
	case t.Commune == d.Cruise:
		return []Event{{Kind: "life", Text: fmt.Sprintf("En orbite ! La %s file vers %s : %d %s de croisière, fais les tâches de bord pour arriver.", d.Ship, d.Name, d.Rounds, plural(d.Rounds, "étape", "étapes")), GameTime: s.GameMinutes}}
	}
	if v.Arrived == 0 {
		v.Arrived = s.GameMinutes
		if !slices.Contains(s.space().Visited, d.ID) {
			s.space().Visited = append(s.space().Visited, d.ID)
		}
		if v.Mission {
			s.space().Missions++
		}
		s.addMood("mal-espace", "")
		s.addMood("terre-haut", "")
	}
	text := fmt.Sprintf("Arrivée à la %s ! L'apesanteur te soulève l'estomac, puis la vue te coupe le souffle.", d.Name)
	switch d.ID {
	case "lune":
		text = fmt.Sprintf("Alunissage ! Bienvenue à la %s, au bord du cratère Shackleton : un pas, et tu flottes à moitié.", d.Name)
	case "mars":
		text = fmt.Sprintf("Atterrissage sur Mars ! La %s t'ouvre son sas : le ciel est rose, la poussière rouge.", d.Name)
	}
	return []Event{{Kind: "life", Text: text, GameTime: s.GameMinutes}}
}

func plural(n int, one, many string) string {
	if n == 1 {
		return one
	}
	return many
}

// spaceFinish: an action up there over (clock.go finish): a cruise's step counted; its rounds all done, the
// landing starts. (D's own, once an action up there ends: spaceDone.)
func (s *Sim) spaceFinish(a *game.Activity) []Event {
	if !s.inSpace() || a == nil || a.Kind != "do" {
		return nil
	}
	events := append(spaceDone(s, a), s.missionShift(a)...)
	v := s.voyage()
	if v == nil || v.Arrived != 0 || a.PlaceKind != game.EspaceCapsuleK || !slices.Contains(v.Steps, a.Interaction.ID) {
		return events
	}
	if slices.Contains(v.Done, a.Interaction.ID) {
		return append(events, Event{Kind: "life", Text: "Déjà fait pour cette étape : fais les autres tâches de bord.", GameTime: s.GameMinutes})
	}
	v.Done = append(v.Done, a.Interaction.ID)
	if len(v.Done) < len(v.Steps) {
		return append(events, Event{Kind: "life", Text: fmt.Sprintf("Tâche de bord faite (%d/%d).", len(v.Done), len(v.Steps)), GameTime: s.GameMinutes})
	}
	return append(events, s.spaceRound()...)
}

// spaceRound: a cruise's round over; the last one, the landing.
func (s *Sim) spaceRound() []Event {
	v := s.voyage()
	v.Round++
	v.Done = []string{}
	if v.Round < v.Rounds {
		return []Event{{Kind: "life", Text: fmt.Sprintf("Étape %d sur %d de la croisière terminée.", v.Round, v.Rounds), GameTime: s.GameMinutes}}
	}
	d, _ := game.FindDestination(v.Dest)
	city, _ := world.FindCity(d.City)
	from, _ := city.Commune(s.Commune)
	to, _ := city.Commune(d.Commune)
	label := "Descente vers la Lune : le module se pose doucement"
	if d.ID == "mars" {
		label = "Entrée dans le ciel de Mars : bouclier, parachutes, rétrofusées"
	}
	if s.Activity == nil {
		s.rocketGo(city, from, city, to, game.LandingLeg, label, "", s.GameMinutes)
	}
	return []Event{{Kind: "life", Text: "Croisière terminée : la descente commence !", GameTime: s.GameMinutes}}
}

// spaceDone: what an action up there does once it ends, beyond its needs (D: sims/espaceVie.go sets it: the
// photos, the experiments' skill points, the delayed messages). Never money: nothing up there pays.
var spaceDone = func(s *Sim, a *game.Activity) []Event { return nil }

// spaceCheck: whether this action of the pad is the Sim's to do now (interactAt): one ticket at a time, from 18.
func (s *Sim) spaceCheck(kind, id string) error {
	if kind != game.SpatioportKind {
		return nil
	}
	if d, ok := game.DestinationOfTicket(id); ok {
		if s.age() < game.SpaceMinAge {
			return errSpaceAge
		}
		if !spaceOpen(game.EspaceKey, d.Key) {
			return errSpaceClosed
		}
		if e := s.Life.Espace; e != nil && (e.Ticket != nil || e.Voyage != nil) {
			return errTicketHeld
		}
	}
	if id == game.TicketCancel && (s.Life.Espace == nil || s.Life.Espace.Ticket == nil) {
		return errNoTicketHeld
	}
	return nil
}

// spaceStart: what an action of the pad does as it starts (clock.go start): the ticket bought (it.Cost, already
// paid by game.Begin: what it cost is kept, the refund's limit), or cancelled (80 % back, never more than paid).
func (s *Sim) spaceStart(it game.Interaction) {
	if d, ok := game.DestinationOfTicket(it.ID); ok {
		s.space().Ticket = &SpaceTicket{Dest: d.ID, Paid: max(0, it.Cost), Bought: s.GameMinutes}
		s.pending = append(s.pending, Event{Kind: "life", Text: game.TicketLabel(d, max(0, it.Cost)), GameTime: s.GameMinutes})
		return
	}
	if it.ID == game.TicketCancel {
		s.pending = append(s.pending, s.ticketCancel())
	}
}

// ticketCancel: the ticket given back before boarding.
func (s *Sim) ticketCancel() Event {
	e := s.space()
	t := e.Ticket
	if t == nil {
		return Event{Kind: "life", Text: errNoTicketHeld.Error(), GameTime: s.GameMinutes}
	}
	back := game.Refund(t.Paid)
	e.Ticket = nil
	s.Money += back
	return Event{Kind: "life", Text: fmt.Sprintf("Billet annulé : %s remboursés.", game.FCFA(back)), Money: back, GameTime: s.GameMinutes}
}

// spaceDecay: up there, no shower: the hygiene drops half as fast again (the « toilette à l'éponge » for it).
func (s *Sim) spaceDecay(before, after game.Needs) game.Needs {
	if !s.inSpace() || after.Hygiene >= before.Hygiene {
		return after
	}
	after.Hygiene = max(0, before.Hygiene-(before.Hygiene-after.Hygiene)*1.5)
	return after
}
