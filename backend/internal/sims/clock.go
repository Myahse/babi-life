package sims

import (
	"errors"
	"fmt"
	"math/rand/v2"
	"slices"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// advance brings the Sim up to now on the real clock: needs drop, the current
// activity makes progress and maybe ends, and Saturdays are settled. It
// returns the journal lines that time produced.
func (s *Sim) advance(now time.Time, rng *rand.Rand) []Event {
	to := game.MinuteOf(now)
	s.lastTick = now
	var events []Event
	var away awayLog
	for {
		// An activity whose time is up ends, even when no time passes now.
		if a := s.Activity; a != nil && a.End <= s.GameMinutes {
			s.Needs = a.Progress(s.Needs, a.End, a.End)
			for _, ev := range s.finish(rng) {
				// What the Sim did by itself goes in one line at the end (autopilot.go); the surprises and promotions stay.
				if a.Auto && ev.Kind == "interaction" {
					away.add(a.Interaction.Label, ev.Money)
					continue
				}
				events = append(events, ev)
			}
			continue
		}
		if s.GameMinutes >= to {
			break
		}
		from := s.GameMinutes
		if a := s.Activity; a != nil {
			end := min(to, a.End)
			s.Needs = a.Progress(game.Decay(s.Needs, end-from), from, end)
			s.GameMinutes = end
			events = append(events, s.settleRange(from, end)...)
			continue
		}
		// Left idle a while: the Sim lives its life (autopilot.go), from the moment it was left.
		// Nothing needed just now: an hour idle, and it looks again (night falls, hunger comes).
		next := to
		if to-from >= autopilotAfter {
			if s.live() {
				continue
			}
			next = min(to, from+60)
		}
		s.Needs = game.DecayIdle(s.Needs, next-from)
		s.GameMinutes = next
		events = append(events, s.settleRange(from, next)...)
	}
	return append(events, away.event(s.FirstName, s.GameMinutes)...)
}

// finish ends the current activity: pay, move, promote, surprise.
func (s *Sim) finish(rng *rand.Rand) []Event {
	a := s.Activity
	s.Activity = nil
	if a.Kind == "travel" {
		s.City, s.Commune = a.Trip.City, a.Trip.Commune
		return []Event{{Kind: "travel", Text: a.Trip.Label, Money: -a.Trip.Fare, GameTime: a.Start}}
	}
	earned := a.Earned()
	s.Money += earned
	money := earned
	if a.Interaction.Cost > 0 {
		money = -a.Interaction.Cost
	}
	s.schoolMark(a.Interaction)
	events := []Event{{Kind: "interaction", Text: fmt.Sprintf("%s — %s", a.PlaceName, a.Interaction.Label), Money: money, GameTime: a.Start}}
	if a.Career != "" {
		if c, ok := game.FindCareer(a.Career); ok && a.Career == s.Career {
			if promo := s.work(c, s.Needs.Mood()); promo != "" {
				ev := Event{Kind: "career", Text: promo, GameTime: a.End}
				if m, ok := promotionMoment(s); ok {
					ev.moment = &m
				}
				events = append(events, ev)
			}
		}
	}
	events = append(events, s.socialize(a.Interaction, rng)...)
	if ev := a.Surprise(rng); ev != nil {
		s.Needs = s.Needs.Add(ev.Effect)
		s.Money += ev.Money
		events = append(events, Event{Kind: "random", Text: ev.Text, Money: ev.Money, GameTime: a.End})
	}
	return events
}

// stop cuts the current activity short: the Sim keeps what it got so far.
func (s *Sim) stop() (Event, error) {
	a := s.Activity
	switch {
	case a == nil:
		return Event{}, fmt.Errorf("ton perso ne fait rien")
	case a.Kind == "travel":
		return Event{}, fmt.Errorf("tu es en route : attends d'arriver")
	case a.PlaceID == custodyPlace:
		return Event{}, errInCustody
	}
	s.Activity = nil
	earned := a.Earned()
	s.Money += earned
	money := earned
	if a.Interaction.Cost > 0 {
		money = -a.Interaction.Cost
	}
	return Event{Kind: "interaction", Text: fmt.Sprintf("%s — %s (arrêté avant la fin)", a.PlaceName, a.Interaction.Label), Money: money, GameTime: a.Start}, nil
}

// settleRange charges rent and loan for every Saturday in (from, to].
func (s *Sim) settleRange(from, to int64) []Event {
	game.FadeFriends(s.Friends, to)
	events := s.growUp(from, to)
	// Children live with their family: no rent, pocket money instead.
	if s.BornAt != 0 && game.AgeAt(s.BornAt, to) < game.AdultAge {
		return append(events, s.pocketMoney(from, to)...)
	}
	l := game.Ledger{Money: s.Money, Loan: s.Loan, RentArrears: s.RentArrears, Housing: s.Housing}
	for range game.Saturdays(from, to) {
		var charges []game.Charge
		l, charges = game.WeekEnd(l)
		for _, c := range charges {
			events = append(events, Event{Kind: "bill", Text: c.Text, Money: c.Money, GameTime: to})
		}
	}
	s.Money, s.Loan, s.RentArrears, s.Housing = l.Money, l.Loan, l.RentArrears, l.Housing
	return events
}

// start puts the Sim to work on an interaction at a place.
func (s *Sim) start(it game.Interaction, placeID, placeKind, placeName string, surprises []game.RandomEvent, career string) error {
	if s.Activity != nil {
		return game.ErrBusy
	}
	st, err := game.Begin(s.state(), it)
	if err != nil {
		return err
	}
	s.setState(st)
	it.Minutes = game.Length(it.Minutes)
	s.Activity = &game.Activity{
		Kind: "do", PlaceID: placeID, PlaceKind: placeKind, PlaceName: placeName, Interaction: it,
		Start: s.GameMinutes, End: s.GameMinutes + max(it.Minutes, 1), Career: career, Surprises: slices.Clone(surprises),
	}
	return nil
}

// leave sets off on a trip by taxi (inside a city) or car (between cities).
func (s *Sim) leave(toCity world.City, toCommune world.Commune) error {
	return s.leaveWith(toCity, toCommune, Ride{}, newRand())
}

// Ride books a ride-hailing app instead of the shared taxi (App empty = taxi).
// Offer is the fare proposed on an app where the passenger sets the price.
type Ride struct {
	App   string
	Class string // on an app with classes: the kind of car
	Offer int
	// Party: the Sim plus friends riding along (1 when empty). A woro-woro
	// charges each seat; a taxi compteur or an app car takes the group.
	Party int
}

// MaxParty: a taxi or a car takes four passengers.
const MaxParty = 4

var (
	errNoRideHere   = errors.New("cette appli ne fait pas ce trajet")
	errNoRideClass  = errors.New("cette catégorie de voiture n'existe pas sur l'appli")
	errOfferRefused = errors.New("aucun chauffeur n'a accepté ton prix : propose un peu plus")
	errNoWoro       = errors.New("pas de woro-woro ici : prends un taxi compteur")
	errTooMany      = errors.New("pas plus de quatre passagers par voiture")
	errNoFlight     = errors.New("pas de vol pour cette ville")
	errNotAtAirport = errors.New("les vols partent de l'aéroport : vas-y d'abord")
)

// leaveWith starts a trip; rng draws the incident that may slow it down (and,
// on an offer app, whether a driver takes the proposed price).
func (s *Sim) leaveWith(toCity world.City, toCommune world.Commune, ride Ride, rng *rand.Rand) error {
	if s.Activity != nil {
		return game.ErrBusy
	}
	if st := s.stage().ID; st == game.StageBebe || st == game.StageEnfant {
		return errTooSmallToTravel
	}
	fromCity, _ := world.FindCity(s.City)
	fromCommune, _ := fromCity.Commune(s.Commune)
	minutes, fare, path := world.TripPath(fromCity, fromCommune, toCity, toCommune)
	if minutes == 0 {
		return fmt.Errorf("tu y es déjà")
	}
	party := max(1, ride.Party)
	if party > MaxParty {
		return errTooMany
	}
	// Street taxis in Abidjan: the woro-woro of your commune, or the taxi
	// compteur (always from the Plateau, which has no woro-woro). Elsewhere
	// it's just "the taxi".
	mode, label := "taxi", fmt.Sprintf("Trajet %s → %s en taxi", fromCommune.Name, toCommune.Name)
	street := fromCity.ID == toCity.ID && fromCity.ID == "abidjan"
	app := ride.App
	var class world.RideClass
	if street && app == "" {
		app = "woro"
		if !fromCommune.HasWoro() {
			app = "compteur"
		}
	}
	switch {
	case app == "avion":
		// A flight (game/flights.go): from the airport's commune, landing in the other city's.
		a := game.Airports[fromCity.ID]
		km, flight, landIn, ok := world.FlightPath(fromCity.ID, toCity.ID)
		if !ok {
			return errNoFlight
		}
		if fromCommune.ID != a.Commune {
			return errNotAtAirport
		}
		toCommune, path = landIn, flight
		minutes, fare = game.FlightQuote(km)
		fare *= party // one seat each
		mode, label = "avion", fmt.Sprintf("Vol %s → %s (%s)", fromCity.Name, toCity.Name, game.Airline)
		s.Needs = s.Needs.Add(game.FlightEffect)
	case fromCity.ID != toCity.ID:
		if app != "" {
			return errNoRideHere
		}
		mode, label = "car", fmt.Sprintf("Trajet %s → %s en car", fromCity.Name, toCity.Name)
		s.Needs = s.Needs.Add(game.RoadEffect)
	case app == "":
	case app == "woro":
		if !street || !fromCommune.HasWoro() {
			return errNoWoro
		}
		mode, label = "woro", fmt.Sprintf("Trajet %s → %s en woro-woro", fromCommune.Name, toCommune.Name)
		fare *= party // one fare per seat
	case app == "compteur":
		var ok bool
		if minutes, fare, ok = world.CompteurQuote(fromCity, fromCommune, toCommune); !ok {
			return errNoRideHere
		}
		mode, label = "compteur", fmt.Sprintf("Trajet %s → %s en taxi compteur", fromCommune.Name, toCommune.Name)
	default:
		a, ok := world.FindRideApp(app)
		if !ok {
			return errNoRideHere
		}
		if minutes, fare, ok = world.RideQuote(a, fromCity, fromCommune, toCommune); !ok {
			return errNoRideHere
		}
		// Whether a driver takes the offer is played out while booking (the
		// driver may also cancel then); here only a price nobody would take fails.
		if a.Model == "offer" {
			if ride.Offer <= 0 || world.OfferChance(ride.Offer, fare) <= 0 {
				return errOfferRefused
			}
			fare = ride.Offer
		}
		mode, label = a.ID, fmt.Sprintf("Trajet %s → %s en %s", fromCommune.Name, toCommune.Name, a.Name)
		if len(a.Classes) > 0 {
			c, ok := a.Class(ride.Class)
			if !ok {
				return errNoRideClass
			}
			fare = world.ClassFare(fare, c)
			class = c
			label = fmt.Sprintf("Trajet %s → %s en %s %s", fromCommune.Name, toCommune.Name, a.Name, c.Name)
		}
	}
	if street && world.TollOf(path.Bridges) > 0 {
		label += " (péage du 3e pont compris)"
	}
	if s.Money < fare {
		return game.ErrNotEnoughMoney
	}
	s.Money -= fare
	trip := &game.Trip{FromCity: fromCity.ID, FromCommune: fromCommune.ID, City: toCity.ID, Commune: toCommune.ID, Mode: mode, Class: class.ID, Fare: fare, Label: label, Path: path.Points, Bridges: path.Bridges}
	// The car's comfort shows on arrival: hot and cramped in Éco, rested in Confort+.
	s.Needs = s.Needs.Add(class.Effect)
	if party > 1 {
		trip.Party = party
	}
	// Only incidents that fit this route can happen: a jam on the bridges for
	// a trip across the lagoon, a roadblock on an intercity road…
	route := game.Route{FromCity: fromCity.ID, FromCommune: fromCommune.ID, ToCity: toCity.ID, ToCommune: toCommune.ID, FromBank: fromCommune.Admin.Bank, ToBank: toCommune.Admin.Bank, Bridges: path.Bridges, Mode: mode}
	if inc := game.IncidentFor(route, s.GameMinutes, rng); inc != nil && mode != "avion" {
		minutes += inc.Extra
		trip.Incident = inc.Text
		s.Needs = s.Needs.Add(inc.Effect)
	}
	// The way takes real minutes too, the long ones shortened like actions.
	minutes = game.Length(minutes)
	s.Activity = &game.Activity{
		Kind: "travel", Interaction: game.Interaction{ID: "travel", Label: label, Icon: tripIcon(mode), Minutes: minutes},
		Start: s.GameMinutes, End: s.GameMinutes + minutes,
		Trip: trip,
	}
	return nil
}

// tripIcon: the trip's icon in the app (a plane for a flight).
func tripIcon(mode string) string {
	if mode == "avion" {
		return "plane"
	}
	return "car-taxi-front"
}

func newRand() *rand.Rand { return rand.New(rand.NewPCG(uint64(time.Now().UnixNano()), 0)) }
