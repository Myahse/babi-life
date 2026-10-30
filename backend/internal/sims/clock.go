package sims

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"slices"
	"time"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// The player away: nothing earned, spent, lost or grown while nobody plays
// the Sim. The world's clock goes on (the same hour for everyone), the Sim's
// own time doesn't. The app says when it's put away (closed, sent to the
// background: pause, the Sim held from that very moment); while it's open and
// seen it says it's there every minute (heartbeat), so an app gone without a
// word (killed, the phone dead) holds the Sim from a minute after it last
// spoke. (Left at work all night, or living by itself while away, a Sim got
// rich without being played; then it went on a few minutes after the app
// was closed.)
const (
	heartbeat    = time.Minute
	offlineAfter = 150 * time.Second
)

// advance brings the Sim up to now on the real clock: the time the player
// was there goes by for it (needs drop, the current activity makes progress
// and maybe ends, Saturdays are settled), the time it was away is held. It
// returns the journal lines that time produced.
func (s *Sim) advance(now time.Time, rng *rand.Rand) []Event {
	var events []Event
	switch {
	case s.pausedAt != nil:
		// Put away: lived up to then, held since.
		events = s.advanceTo(min(game.MinuteOf(now), game.MinuteOf(*s.pausedAt)), rng)
		events = append(events, s.hold(game.MinuteOf(now)-s.GameMinutes)...)
		s.pausedAt = nil
	case !s.lastTick.IsZero() && now.Sub(s.lastTick) > offlineAfter:
		events = s.advanceTo(game.MinuteOf(s.lastTick.Add(heartbeat)), rng)
		events = append(events, s.hold(game.MinuteOf(now)-s.GameMinutes)...)
	}
	s.lastTick = now
	return append(events, s.advanceTo(game.MinuteOf(now), rng)...)
}

// PassBonus: the share added to the Djai earned (work, gigs, défis) while the Babi Pass (shop/) lasts.
const PassBonus = game.PassBonus

// passOn: the Babi Pass still running at the Sim's time.
func (s *Sim) passOn() bool {
	return s.PassUntil != nil && game.TimeOf(s.GameMinutes).Before(*s.PassUntil)
}

// withPass: what's earned, a quarter more with the Pass (nothing on what's spent).
func (s *Sim) withPass(earned int) int {
	if earned <= 0 || !s.passOn() {
		return earned
	}
	return earned + int(float64(earned)*PassBonus+0.5)
}

// SectBonus: the share a sect adds to what its members earn (politics.Sects):
// the Baobab on work, the Cercle des Sept on défis and bets, the Lumière on all.
const SectBonus = 0.05

// withSect: what's earned, a twentieth more when the Sim's sect blesses that kind ("travail", "defi").
func (s *Sim) withSect(earned int, kind string) int {
	if earned <= 0 || s.Sect == "" {
		return earned
	}
	if s.Sect == "lumiere" || (s.Sect == "baobab" && kind == "travail") || (s.Sect == "sept" && kind == "defi") {
		return earned + int(float64(earned)*SectBonus+0.5)
	}
	return earned
}

// hold: time gone by for the world but not for the Sim (the player away): its
// clock jumps on, and what it was doing, its age (from 18), its friends' last news wait
// where they were. Only the landlord doesn't wait: if a Saturday went by, he
// passes once (rent and loan, as on a Saturday played; however many weeks the
// player was away, only one), so the rent is paid by those who never play at
// midnight on a Friday.
func (s *Sim) hold(minutes int64) []Event {
	if minutes <= 0 {
		return nil
	}
	from := s.GameMinutes
	s.GameMinutes += minutes
	// One grows up by playing: 24 hours in the game a baby, then a child and a teen, whatever the
	// account's age; away, the age waits for the player, at every age (and the baby's needs too).
	var grown []Event
	if s.BornAt != 0 {
		s.BornAt += minutes
	}
	if a := s.Activity; a != nil {
		a.Start += minutes
		a.End += minutes
		for k, at := range a.Tasks {
			a.Tasks[k] = at + minutes
		}
	}
	for i := range s.Friends {
		s.Friends[i].Seen += minutes
	}
	if game.Saturdays(from, s.GameMinutes) == 0 || (s.BornAt != 0 && game.AgeAt(s.BornAt, s.GameMinutes) < game.AdultAge) {
		return grown
	}
	return append(grown, s.weekEnd(s.GameMinutes)...)
}

// BabyDecay: a baby's needs drop this many times faster (it has to be looked after: fed, changed, rocked).
const BabyDecay = 2

// decayed: these minutes, as the needs feel them (a baby's go twice as fast).
func (s *Sim) decayed(minutes int64) int64 {
	if s.BornAt != 0 && s.stage().ID == game.StageBebe {
		return minutes * BabyDecay
	}
	return minutes
}

// advanceTo lets the Sim's time run to the game minute `to`.
func (s *Sim) advanceTo(to int64, rng *rand.Rand) []Event {
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
			s.Needs = a.Progress(game.Decay(s.Needs, s.decayed(end-from)), from, end)
			s.GameMinutes = end
			events = append(events, s.settleRange(from, end)...)
			continue
		}
		// Going to work by itself (the Boulot app's switch, jobs.go): as soon as the shift's hours come.
		if s.AutoWork && s.goToWork() {
			continue
		}
		s.Needs = game.DecayIdle(s.Needs, s.decayed(to-from))
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
	would, earned := s.pay(a)
	money := earned
	if a.Interaction.Cost > 0 {
		money = -a.Interaction.Cost
	}
	s.schoolMark(a.Interaction)
	text := capNote(fmt.Sprintf("%s — %s", a.PlaceName, a.Interaction.Label), earnedFrom(a), earned, would)
	// At a slot machine: the spins, and what the session came to.
	if note, net, ok := machineNote(a); ok {
		text, money = text+note, net
	}
	events := []Event{{Kind: "interaction", Text: text, Money: money, GameTime: a.Start}}
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
		// Money come by chance: within the day's luck, or something else happens.
		// What an activity paid for gives back (the tontine's pot to the one
		// whose turn it is, at most five times what was put in) isn't luck: its
		// rarity (game.Windfall) keeps it well below what's paid in.
		paidBack := ev.Money > 0 && a.Interaction.Cost > 0 && ev.Money <= 5*a.Interaction.Cost
		if ev.Money > 0 && !paidBack && s.left(game.FromLuck) < ev.Money {
			calm := game.Calm(append(append([]game.RandomEvent{}, a.Surprises...), game.GenericEvents...), rng)
			ev = &calm
		}
		// A child (no phone credit, no cousin to send money to) or a Sim without
		// the money: something that costs nothing happens instead.
		if ev.Money < 0 && (s.minor() || s.Money < -ev.Money) {
			quiet := game.Quiet(append(append([]game.RandomEvent{}, a.Surprises...), game.GenericEvents...), rng)
			ev = &quiet
		}
		s.Needs = s.Needs.Add(ev.Effect)
		if ev.Money > 0 && !paidBack {
			s.earn(game.FromLuck, ev.Money)
		} else {
			s.Money += ev.Money
		}
		events = append(events, Event{Kind: "random", Text: ev.Text, Money: ev.Money, GameTime: a.End})
	}
	return events
}

// earnedFrom: the source of what an activity pays: work, or a petit boulot.
func earnedFrom(a *game.Activity) game.Income {
	if a.Career != "" {
		return game.FromWork
	}
	return game.FromGig
}

// pay: what the activity pays for what was done of it (a shift; a petit boulot,
// within the day's limit), with the Pass and the sect; what it would have paid and what it paid.
func (s *Sim) pay(a *game.Activity) (would, got int) {
	would = s.withPass(a.Earned())
	if a.Career != "" {
		would = s.withSect(would, "travail")
	}
	return would, s.earn(earnedFrom(a), would)
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
	would, earned := s.pay(a)
	money := earned
	if a.Interaction.Cost > 0 {
		money = -a.Interaction.Cost
	}
	// Leaving a slot machine is how its session ends: the spins, and what it came to.
	if note, net, ok := machineNote(a); ok {
		return Event{Kind: "interaction", Text: fmt.Sprintf("%s — %s%s", a.PlaceName, a.Interaction.Label, note), Money: net, GameTime: a.Start}, nil
	}
	return Event{Kind: "interaction", Text: capNote(fmt.Sprintf("%s — %s (arrêté avant la fin)", a.PlaceName, a.Interaction.Label), earnedFrom(a), earned, would), Money: money, GameTime: a.Start}, nil
}

// settleRange charges rent and loan for every Saturday in (from, to].
func (s *Sim) settleRange(from, to int64) []Event {
	game.FadeFriends(s.Friends, to)
	events := s.growUp(from, to)
	// Children live with their family: no rent, pocket money instead.
	if s.BornAt != 0 && game.AgeAt(s.BornAt, to) < game.AdultAge {
		return append(events, s.pocketMoney(from, to)...)
	}
	for range game.Saturdays(from, to) {
		events = append(events, s.weekEnd(to)...)
	}
	return events
}

// weekEnd: a Saturday's rent and loan installment, settled at `at`.
func (s *Sim) weekEnd(at int64) []Event {
	l, charges := game.WeekEnd(game.Ledger{Money: s.Money, Loan: s.Loan, RentArrears: s.RentArrears, Housing: s.Housing})
	s.Money, s.Loan, s.RentArrears, s.Housing = l.Money, l.Loan, l.RentArrears, l.Housing
	events := make([]Event, 0, len(charges))
	for _, c := range charges {
		events = append(events, Event{Kind: "bill", Text: c.Text, Money: c.Money, GameTime: at})
	}
	return events
}

// start puts the Sim to work on an interaction at a place.
func (s *Sim) start(it game.Interaction, placeID, placeKind, placeName string, surprises []game.RandomEvent, career string) error {
	if s.Activity != nil {
		return game.ErrBusy
	}
	if it.Fed && s.Needs.Hunger < game.FedHunger {
		return errNotFed
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
	// Played (the update « gestes-maison »): no clock ends it, its game does (sims/defi.go); held a whole
	// day at most, should the player never come back to it.
	if gesteOK(s.Activity) || slices.Contains(homeDefis, defiOf(it.ID)) {
		if playedNoClock() {
			s.Activity.End = s.GameMinutes + max(it.Minutes, playedHold)
		}
	}
	// The jam regulated (jam.go): no clock ends it either, the junction's game does; held while the jam lasts.
	if defiOf(it.ID) == "circulation" {
		if _, start, ok := game.HappeningAt(s.City, s.Commune, s.GameMinutes); ok {
			s.Activity.End = max(s.Activity.End, start+game.HappeningMinutes)
		}
	}
	// The crèche, the school: the friend from childhood is there (childhood.go).
	if ev := s.toSchool(it); ev != nil {
		s.pending = append(s.pending, *ev)
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
	// Own: the Sim's own vehicle, driven there (the handler found it in its garage).
	Own *OwnVehicle
}

// OwnVehicle: one of the Sim's vehicles (garage.go), for a trip.
type OwnVehicle struct {
	ID    int64
	Model game.VehicleModel
	Color string
}

// MaxParty: a taxi or a car takes four passengers.
const MaxParty = 4

var (
	errBikeTooFar   = errors.New("trop loin pour y aller à vélo")
	errNoRideHere   = errors.New("cette appli ne fait pas ce trajet")
	errMetroClosed  = errors.New("le métro n'est pas encore ouvert : la ligne 1 est en travaux")
	errNoMetro      = errors.New("le métro ne va pas là : la ligne 1 passe par Anyama, Abobo, Adjamé, le Plateau, Treichville, Marcory, Koumassi et Port-Bouët")
	errNoRideClass  = errors.New("cette catégorie de voiture n'existe pas sur l'appli")
	errOfferRefused = errors.New("aucun chauffeur n'a accepté ton prix : propose un peu plus")
	errNoWoro       = errors.New("pas de woro-woro ici : prends un taxi compteur")
	errTooMany      = errors.New("pas plus de quatre passagers par voiture")
	errNoFlight     = errors.New("pas de vol pour cette ville")
	errMotoOne      = errors.New("une seule personne derrière le moto-taxi")
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
	case ride.Own != nil:
		// At the wheel of one's own vehicle: no driver to wait for and nobody
		// else's stops, a little quicker than a taxi; no fare, the petrol on the
		// way's length (and the 3e pont's toll for a car), as for a drive in town.
		m := ride.Own.Model
		if m.Kind != "voiture" && party > 1 {
			return errMotoOne
		}
		if m.Kind == "velo" && fromCity.ID != toCity.ID {
			return errBikeTooFar
		}
		fare = fuelCost(m, int(path.Km*1000))
		if m.Kind == "voiture" {
			fare += world.TollOf(path.Bridges)
		}
		if fromCity.ID != toCity.ID {
			s.Needs = s.Needs.Add(game.RoadEffect)
			mode, label = "perso", fmt.Sprintf("Trajet %s → %s en %s", fromCity.Name, toCity.Name, m.Name)
		} else {
			mode, label = "perso", fmt.Sprintf("Trajet %s → %s en %s", fromCommune.Name, toCommune.Name, m.Name)
		}
		minutes = max(1, minutes*4/5)
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
	case app == "gbaka":
		var ok bool
		if minutes, fare, ok = world.GbakaQuote(fromCity, fromCommune, toCommune); !ok {
			return errNoRideHere
		}
		mode, label = "gbaka", fmt.Sprintf("Trajet %s → %s en gbaka", fromCommune.Name, toCommune.Name)
		fare *= party // one fare per seat
	case app == "metro":
		// The line 1 (world/metro.go), once the update is open (on its date, or by hand).
		if !features.Default.Open(context.Background(), "metro") {
			return errMetroClosed
		}
		var ok bool
		var line world.Path
		if minutes, fare, line, ok = world.MetroQuote(fromCity, fromCommune, toCommune); !ok {
			return errNoMetro
		}
		path = line
		mode, label = "metro", fmt.Sprintf("Trajet %s → %s en métro (%s)", fromCommune.Name, toCommune.Name, world.Metro.Name)
		fare *= party // a ticket each
	case app == "moto":
		if party > 1 {
			return errMotoOne
		}
		var ok bool
		if minutes, fare, ok = world.MotoQuote(fromCity, fromCommune, toCommune); !ok {
			return errNoRideHere
		}
		mode, label = "moto", fmt.Sprintf("Trajet %s → %s en moto-taxi", fromCommune.Name, toCommune.Name)
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
	if street && world.TollOf(path.Bridges) > 0 && (ride.Own == nil || ride.Own.Model.Kind == "voiture") {
		label += " (péage du 3e pont compris)"
	}
	// The president's « transport » measure (game/civic.go): the public transport at half price.
	if off := game.FareOff(s.Measures); off > 0 && publicFare(mode) && fare > 0 {
		fare = game.Discounted(fare, off)
		label += " (moitié prix : mesure du président)"
	}
	if s.Money < fare {
		return game.ErrNotEnoughMoney
	}
	s.Money -= fare
	trip := &game.Trip{FromCity: fromCity.ID, FromCommune: fromCommune.ID, City: toCity.ID, Commune: toCommune.ID, Mode: mode, Class: class.ID, Fare: fare, Label: label, Path: path.Points, Bridges: path.Bridges}
	if o := ride.Own; o != nil {
		trip.Vehicle = &game.TripVehicle{ID: o.ID, Kind: o.Model.Kind, Body: o.Model.Body, Color: o.Color, Name: o.Model.Name, Top: float64(o.Model.TopSpeed), Km: path.Km}
	}
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
