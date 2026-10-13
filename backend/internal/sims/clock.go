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
	for {
		// An activity whose time is up ends, even when no time passes now.
		if a := s.Activity; a != nil && a.End <= s.GameMinutes {
			s.Needs = a.Progress(s.Needs, a.End, a.End)
			events = append(events, s.finish(rng)...)
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
		s.Needs = game.DecayIdle(s.Needs, to-from)
		s.GameMinutes = to
		events = append(events, s.settleRange(from, to)...)
	}
	return events
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
	events := []Event{{Kind: "interaction", Text: fmt.Sprintf("%s — %s", a.PlaceName, a.Interaction.Label), Money: money, GameTime: a.Start}}
	if a.Career != "" {
		if c, ok := game.FindCareer(a.Career); ok && a.Career == s.Career {
			if promo := s.work(c, s.Needs.Mood()); promo != "" {
				events = append(events, Event{Kind: "career", Text: promo, GameTime: a.End})
			}
		}
	}
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
		return Event{}, fmt.Errorf("ton Sim ne fait rien")
	case a.Kind == "travel":
		return Event{}, fmt.Errorf("tu es en route : attends d'arriver")
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
	var events []Event
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
	Offer int
}

var (
	errNoRideHere   = errors.New("cette appli ne fait pas ce trajet")
	errOfferRefused = errors.New("aucun chauffeur n'a accepté ton prix : propose un peu plus")
)

// leaveWith starts a trip; rng draws the incident that may slow it down (and,
// on an offer app, whether a driver takes the proposed price).
func (s *Sim) leaveWith(toCity world.City, toCommune world.Commune, ride Ride, rng *rand.Rand) error {
	if s.Activity != nil {
		return game.ErrBusy
	}
	fromCity, _ := world.FindCity(s.City)
	fromCommune, _ := fromCity.Commune(s.Commune)
	minutes, fare := world.Trip(fromCity, fromCommune, toCity, toCommune)
	if minutes == 0 {
		return fmt.Errorf("tu y es déjà")
	}
	var app world.RideApp
	if ride.App != "" {
		var ok bool
		if app, ok = world.FindRideApp(ride.App); !ok || fromCity.ID != toCity.ID {
			return errNoRideHere
		}
		if minutes, fare, ok = world.RideQuote(app, fromCity, fromCommune, toCommune); !ok {
			return errNoRideHere
		}
		if app.Model == "offer" {
			if ride.Offer <= 0 || rng.Float64() >= world.OfferChance(ride.Offer, fare) {
				return errOfferRefused
			}
			fare = ride.Offer
		}
	}
	if s.Money < fare {
		return game.ErrNotEnoughMoney
	}
	s.Money -= fare
	mode, label := "taxi", fmt.Sprintf("Trajet %s → %s en taxi", fromCommune.Name, toCommune.Name)
	if fromCity.ID != toCity.ID {
		mode, label = "car", fmt.Sprintf("Trajet %s → %s en car", fromCity.Name, toCity.Name)
	}
	if app.ID != "" {
		mode, label = app.ID, fmt.Sprintf("Trajet %s → %s en %s", fromCommune.Name, toCommune.Name, app.Name)
	}
	trip := &game.Trip{FromCity: fromCity.ID, FromCommune: fromCommune.ID, City: toCity.ID, Commune: toCommune.ID, Mode: mode, Fare: fare, Label: label}
	// Only incidents that fit this route can happen: a jam on the bridges for
	// a trip across the lagoon, a roadblock on an intercity road…
	route := game.Route{FromCity: fromCity.ID, FromCommune: fromCommune.ID, ToCity: toCity.ID, ToCommune: toCommune.ID, FromBank: fromCommune.Admin.Bank, ToBank: toCommune.Admin.Bank}
	if inc := game.IncidentFor(route, s.GameMinutes, rng); inc != nil {
		minutes += inc.Extra
		trip.Incident = inc.Text
		s.Needs = s.Needs.Add(inc.Effect)
	}
	s.Activity = &game.Activity{
		Kind: "travel", Interaction: game.Interaction{ID: "travel", Label: label, Icon: "car-taxi-front", Minutes: minutes},
		Start: s.GameMinutes, End: s.GameMinutes + minutes,
		Trip: trip,
	}
	return nil
}

func newRand() *rand.Rand { return rand.New(rand.NewPCG(uint64(time.Now().UnixNano()), 0)) }
