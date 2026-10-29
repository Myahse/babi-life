package sims

import (
	"math/rand/v2"
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

func noLuck() *rand.Rand { return rand.New(rand.NewPCG(1, 2)) }

// A Wednesday at 12:00, Abidjan time.
var noon = time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)

func newSim() Sim {
	return Sim{FirstName: "Aya", City: "abidjan", Commune: "yopougon", HomeCity: "abidjan", HomeCommune: "yopougon",
		Housing: "studio", Money: 10000, Needs: game.FreshNeeds(), GameMinutes: game.MinuteOf(noon), lastTick: noon}
}

// played: the player there all along until `until` (its app asks every few minutes), the Sim's time going by.
func played(s *Sim, until time.Time) []Event {
	at := s.lastTick
	if at.IsZero() {
		at = game.TimeOf(s.GameMinutes)
	}
	var ev []Event
	for at = at.Add(heartbeat); at.Before(until); at = at.Add(heartbeat) {
		ev = append(ev, s.advance(at, noLuck())...)
	}
	return append(ev, s.advance(until, noLuck())...)
}

// The player away all night: the Sim's life waits for it. Its selling stops
// where it was and goes on once back; its needs and its money are as they
// were, its age too.
func TestOnHoldWhileAway(t *testing.T) {
	s := newSim()
	s.BornAt = s.GameMinutes - game.MinutesToAge(25)
	born := s.BornAt
	sell, _ := game.Kinds["market"].Interaction("sell-goods") // 6 real minutes, earns 1 200F
	_ = s.start(sell, "yop-marche", "market", "Marché de Siporex", nil, "")
	s.advance(noon.Add(2*time.Minute), noLuck())
	money := s.Money
	ev := s.advance(noon.Add(20*time.Hour), noLuck())
	if s.Activity == nil || len(ev) != 0 || s.Money != money {
		t.Fatalf("away, nothing happens: act %+v events %v money %d", s.Activity, ev, s.Money)
	}
	if s.GameMinutes != game.MinuteOf(noon.Add(20*time.Hour)) {
		t.Error("the Sim's clock is the world's when back")
	}
	if left := s.Activity.End - s.GameMinutes; left != 3 {
		t.Errorf("selling: 2 min played, 1 counted after the last word, 3 left; got %d", left)
	}
	// As if played only that minute more.
	twin := newSim()
	_ = twin.start(sell, "yop-marche", "market", "Marché de Siporex", nil, "")
	twin.advance(noon.Add(2*time.Minute), noLuck())
	twin.advance(noon.Add(3*time.Minute), noLuck())
	if s.Needs != twin.Needs {
		t.Errorf("needs as after a minute more: %+v, not %+v", twin.Needs, s.Needs)
	}
	if game.AgeAt(s.BornAt, s.GameMinutes) != game.AgeAt(born, game.MinuteOf(noon.Add(3*time.Minute))) {
		t.Error("a Sim doesn't grow older while nobody plays it")
	}
	ev = played(&s, noon.Add(20*time.Hour+8*time.Minute))
	if s.Activity != nil || s.Money < money+1200 || len(ev) == 0 {
		t.Fatalf("back, the selling ends and pays: act %+v money %d ev %v", s.Activity, s.Money, ev)
	}
	// Idle and away a week: no fading friends, needs as they were; only the
	// landlord doesn't wait: he passes once for the Saturday gone by.
	s = newSim()
	s.Friends = []game.Friend{{ID: "f1", Name: "Koffi", Friendship: 50, Seen: s.GameMinutes}}
	needs, money := s.Needs, s.Money
	ev = s.advance(noon.Add(8*24*time.Hour), noLuck())
	if len(ev) == 0 || s.Money >= money || s.Friends[0].Friendship != 50 || s.Needs.Hunger < needs.Hunger-5 {
		t.Errorf("a week away: events %v money %d friendship %d needs %+v", ev, s.Money, s.Friends[0].Friendship, s.Needs)
	}
	for _, e := range ev {
		if e.Kind != "bill" {
			t.Errorf("a week away, only the landlord: %+v", e)
		}
	}
	// Away three weeks more: one Saturday's rent again (and what was still owed), not three.
	s.Money = 100000
	owed := s.RentArrears
	h, _ := game.FindHousing(s.Housing)
	ev = s.advance(noon.Add(29*24*time.Hour), noLuck())
	if s.Money != 100000-h.Rent-owed {
		t.Errorf("three weeks away: one rent (%d) and %d owed, money %d, events %v", h.Rent, owed, s.Money, ev)
	}
}

// Put away (the app closed or hidden): held from that very moment, not a minute more.
func TestPausedHeldAtOnce(t *testing.T) {
	s := newSim()
	sell, _ := game.Kinds["market"].Interaction("sell-goods") // 6 real minutes
	_ = s.start(sell, "yop-marche", "market", "Marché de Siporex", nil, "")
	s.advance(noon.Add(2*time.Minute), noLuck())
	at := noon.Add(2 * time.Minute)
	s.pausedAt = &at
	// Back a minute later (under the gap that would hold an app gone without a word): still nothing went by.
	s.advance(noon.Add(3*time.Minute), noLuck())
	if left := s.Activity.End - s.GameMinutes; left != 4 || s.pausedAt != nil {
		t.Fatalf("paused at 2 min, back at 3: 4 min left, got %d (paused %v)", s.Activity.End-s.GameMinutes, s.pausedAt)
	}
	// Played on: it goes by again.
	s.advance(noon.Add(4*time.Minute), noLuck())
	if left := s.Activity.End - s.GameMinutes; left != 3 {
		t.Errorf("played a minute more: 3 left, got %d", left)
	}
}

func TestActivityEndsWhileAway(t *testing.T) {
	s := newSim()
	sell, _ := game.Kinds["market"].Interaction("sell-goods") // 4 h (6 real minutes), earns 1 200F
	if err := s.start(sell, "yop-marche", "market", "Marché de Siporex", nil, ""); err != nil {
		t.Fatal(err)
	}
	if err := s.start(sell, "yop-marche", "market", "Marché de Siporex", nil, ""); err != game.ErrBusy {
		t.Fatalf("a busy Sim can't start something else, got %v", err)
	}
	ev := s.advance(noon.Add(4*time.Minute), noLuck())
	if s.Activity == nil || len(ev) != 0 || s.Money != 10000 {
		t.Fatalf("after 4 min it is still selling: %+v %v %d", s.Activity, ev, s.Money)
	}
	ev = played(&s, noon.Add(6*time.Hour))
	if s.Activity != nil || s.Money < 11200 || len(ev) == 0 || !strings.Contains(ev[0].Text, "Vendre") {
		t.Fatalf("after 6 h it is done and paid: act=%v money=%d ev=%v", s.Activity, s.Money, ev)
	}
	if s.GameMinutes != game.MinuteOf(noon.Add(6*time.Hour)) {
		t.Error("the clock must be the real time")
	}
}

func TestStopPaysProRata(t *testing.T) {
	s := newSim()
	sell, _ := game.Kinds["market"].Interaction("sell-goods")
	_ = s.start(sell, "yop-marche", "market", "Marché de Siporex", nil, "")
	played(&s, noon.Add(3*time.Minute))
	ev, err := s.stop()
	if err != nil || s.Activity != nil || s.Money != 10600 || ev.Money != 600 {
		t.Fatalf("3 min of 6: money %d ev %+v err %v", s.Money, ev, err)
	}
}

func TestTaxiArrives(t *testing.T) {
	s := newSim()
	abj, _ := world.FindCity("abidjan")
	cocody, _ := abj.Commune("cocody")
	if err := s.leave(abj, cocody); err != nil {
		t.Fatal(err)
	}
	if s.Activity.Trip.Mode != "woro" || s.Commune != "yopougon" {
		t.Fatalf("on the way, still in Yopougon: %+v", s.Activity.Trip)
	}
	if _, err := s.stop(); err == nil {
		t.Error("can't get out of a moving taxi")
	}
	played(&s, noon.Add(3*time.Hour))
	if s.Commune != "cocody" || s.Activity != nil {
		t.Fatalf("arrived: commune %s act %v", s.Commune, s.Activity)
	}
}

func TestRentFallsOnTheRealSaturday(t *testing.T) {
	s := newSim()
	s.Money = 100000
	ev := played(&s, noon.Add(4*24*time.Hour)) // Wednesday → Sunday, the player there
	paid := false
	for _, e := range ev {
		paid = paid || (e.Kind == "bill" && e.Money == -15000)
	}
	if !paid {
		t.Fatalf("Saturday's rent: %v", ev)
	}
}

func TestActivityDueNowEnds(t *testing.T) {
	s := newSim()
	nap, _ := game.Kinds["home"].Interaction("nap")
	_ = s.start(nap, "home", "home", "Chez toi", nil, "")
	s.Activity.End = s.GameMinutes // due right now
	ev := s.advance(noon, noLuck())
	if s.Activity != nil || len(ev) == 0 {
		t.Fatalf("an activity due now must end: %+v %v", s.Activity, ev)
	}
}

// alwaysSource makes every random draw 0: every possible incident happens.
type alwaysSource struct{}

func (alwaysSource) Uint64() uint64 { return 0 }

// neverSource makes every random draw as high as it goes: no incident.
type neverSource struct{}

func (neverSource) Uint64() uint64 { return ^uint64(0) }

func TestCrossingTheLagoonAtRushHourCanJam(t *testing.T) {
	s := newSim()                                           // in Yopougon (north bank) at noon
	s.GameMinutes = game.MinuteOf(noon.Add(-4 * time.Hour)) // 8h
	abj, _ := world.FindCity("abidjan")
	marcory, _ := abj.Commune("marcory")
	yop, _ := abj.Commune("yopougon")
	base, _ := world.Trip(abj, yop, abj, marcory)
	if err := s.leaveWith(abj, marcory, Ride{}, rand.New(alwaysSource{})); err != nil {
		t.Fatal(err)
	}
	a := s.Activity
	if a.Trip.Incident == "" || a.End-a.Start <= game.Length(base) {
		t.Fatalf("a jam should slow the trip: incident %q, %d min vs %d", a.Trip.Incident, a.End-a.Start, game.Length(base))
	}
}

func TestRideApps(t *testing.T) {
	abj, _ := world.FindCity("abidjan")
	cocody, _ := abj.Commune("cocody")
	yop, _ := abj.Commune("yopougon")
	taxiMin, taxiFare := world.Trip(abj, yop, abj, cocody)

	s := newSim()
	if err := s.leaveWith(abj, cocody, Ride{App: "gnango"}, rand.New(alwaysSource{})); err != nil {
		t.Fatal(err)
	}
	if tr := s.Activity.Trip; tr.Mode != "gnango" || tr.Fare <= taxiFare || s.Activity.End-s.Activity.Start > taxiMin+30 {
		t.Errorf("Gnango should be dearer and not slower: %+v, %d min vs taxi %d", tr, s.Activity.End-s.Activity.Start, taxiMin)
	}

	// The classes: dearer as the car gets better; an unknown class is refused.
	eco := s.Activity.Trip.Fare
	if s.Activity.Trip.Class != "eco" {
		t.Errorf("no class picked should be Éco: %+v", s.Activity.Trip)
	}
	var plus int
	for _, c := range []string{"confort", "confortplus", "goyave"} {
		s = newSim()
		if err := s.leaveWith(abj, cocody, Ride{App: "gnango", Class: c}, rand.New(alwaysSource{})); err != nil {
			t.Fatal(err)
		}
		if tr := s.Activity.Trip; tr.Class != c || tr.Fare <= eco || tr.Fare <= plus || !strings.Contains(tr.Label, map[string]string{"confort": "Confort", "confortplus": "Confort+", "goyave": "Goyave"}[c]) {
			t.Errorf("%s should cost more than the class below: %+v (éco %d)", c, tr, eco)
		}
		plus = s.Activity.Trip.Fare
	}
	s = newSim()
	if err := s.leaveWith(abj, cocody, Ride{App: "gnango", Class: "limousine"}, rand.New(alwaysSource{})); err == nil {
		t.Error("an unknown class should be refused")
	}

	s = newSim()
	if err := s.leaveWith(abj, cocody, Ride{App: "idrive", Offer: 100}, rand.New(alwaysSource{})); err == nil {
		t.Error("a 100 F offer should find no driver")
	}
	_, quote, _ := world.RideQuote(world.RideApps[1], abj, yop, cocody)
	if err := s.leaveWith(abj, cocody, Ride{App: "indrive", Offer: quote * 9 / 10}, rand.New(alwaysSource{})); err != nil || s.Activity.Trip.Fare != quote*9/10 {
		t.Errorf("a fair offer should be taken at that price: %v %+v", err, s.Activity)
	}

	s = newSim()
	bke, _ := world.FindCity("bouake")
	if err := s.leaveWith(bke, bke.Communes[0], Ride{App: "gnango"}, rand.New(alwaysSource{})); err == nil {
		t.Error("no Yango ride from Abidjan to Bouaké")
	}
}

func TestStreetTaxis(t *testing.T) {
	abj, _ := world.FindCity("abidjan")
	cocody, _ := abj.Commune("cocody")
	yop, _ := abj.Commune("yopougon")
	woroMin, woroFare := world.Trip(abj, yop, abj, cocody)

	s := newSim()
	if err := s.leaveWith(abj, cocody, Ride{App: "compteur"}, rand.New(alwaysSource{})); err != nil {
		t.Fatal(err)
	}
	if tr := s.Activity.Trip; tr.Mode != "compteur" || tr.Fare <= woroFare || s.Activity.End-s.Activity.Start > woroMin+30 {
		t.Errorf("the compteur should be dearer and not slower: %+v", tr)
	}
	if s.Activity.Trip.Incident == "Le woro-woro attend d'être plein avant de partir." {
		t.Error("a taxi compteur doesn't wait to fill up")
	}

	// The Plateau has no woro-woro: you leave in a taxi compteur.
	s = newSim()
	s.Commune = "plateau"
	if err := s.leaveWith(abj, cocody, Ride{App: "woro"}, rand.New(alwaysSource{})); err == nil {
		t.Error("no woro-woro from the Plateau")
	}
	if err := s.leaveWith(abj, cocody, Ride{}, rand.New(alwaysSource{})); err != nil || s.Activity.Trip.Mode != "compteur" {
		t.Errorf("default from the Plateau should be the compteur: %v %+v", err, s.Activity)
	}
}

// The gbaka is cheaper and slower than the woro-woro; the moto-taxi quicker and dearer, one passenger.
func TestGbakaAndMotoTaxi(t *testing.T) {
	abj, _ := world.FindCity("abidjan")
	cocody, _ := abj.Commune("cocody")
	yop, _ := abj.Commune("yopougon")
	woroMin, woroFare := world.Trip(abj, yop, abj, cocody)
	// On the road (the game shortens every trip alike): the gbaka slower, the moto-taxi quicker.
	if g, _, _ := world.GbakaQuote(abj, yop, cocody); g <= woroMin {
		t.Errorf("gbaka %d min, woro-woro %d", g, woroMin)
	}
	if m, _, _ := world.MotoQuote(abj, yop, cocody); m >= woroMin {
		t.Errorf("moto-taxi %d min, woro-woro %d", m, woroMin)
	}

	s := newSim()
	if err := s.leaveWith(abj, cocody, Ride{App: "gbaka", Party: 2}, rand.New(neverSource{})); err != nil {
		t.Fatal(err)
	}
	if tr := s.Activity.Trip; tr.Mode != "gbaka" || tr.Fare >= 2*woroFare {
		t.Errorf("the gbaka should be cheaper a seat: %+v (the woro-woro %d F)", tr, woroFare)
	}
	s = newSim()
	if err := s.leaveWith(abj, cocody, Ride{App: "moto", Party: 2}, rand.New(alwaysSource{})); err != errMotoOne {
		t.Errorf("two behind a moto-taxi: %v", err)
	}
	if err := s.leaveWith(abj, cocody, Ride{App: "moto"}, rand.New(alwaysSource{})); err != nil {
		t.Fatal(err)
	}
	if tr := s.Activity.Trip; tr.Mode != "moto" || tr.Fare <= woroFare {
		t.Errorf("the moto-taxi should cost more than a woro seat: %+v", tr)
	}
	// Not between cities: the car (or the plane).
	bouake, _ := world.FindCity("bouake")
	s = newSim()
	if err := s.leaveWith(bouake, bouake.Communes[0], Ride{App: "gbaka"}, rand.New(alwaysSource{})); err == nil {
		t.Error("a gbaka to Bouaké")
	}
}

func TestFriendsRideAlong(t *testing.T) {
	abj, _ := world.FindCity("abidjan")
	cocody, _ := abj.Commune("cocody")
	yop, _ := abj.Commune("yopougon")
	_, seat := world.Trip(abj, yop, abj, cocody)

	s := newSim()
	if err := s.leaveWith(abj, cocody, Ride{App: "woro", Party: 2}, rand.New(alwaysSource{})); err != nil || s.Activity.Trip.Fare != 2*seat {
		t.Errorf("two seats in the woro-woro cost two fares: %v %+v", err, s.Activity)
	}
	s = newSim()
	_, meter, _ := world.CompteurQuote(abj, yop, cocody)
	if err := s.leaveWith(abj, cocody, Ride{App: "compteur", Party: 3}, rand.New(alwaysSource{})); err != nil || s.Activity.Trip.Fare != meter {
		t.Errorf("a taxi compteur takes the group for one fare: %v %+v", err, s.Activity)
	}
	five := newSim()
	if err := five.leaveWith(abj, cocody, Ride{App: "compteur", Party: 5}, rand.New(alwaysSource{})); err != errTooMany {
		t.Error("five don't fit in a taxi")
	}
	if p := s.Activity.Trip.Path; len(p) < 2 {
		t.Error("the trip should carry its road path for the map")
	}
}

// One's own car to another commune: no fare but the petrol (and the 3e pont's
// toll), quicker than the taxi; the bike not up country.
func TestOwnVehicleTrip(t *testing.T) {
	car, _ := game.FindVehicleModel("auto-akwaba")
	bike, _ := game.FindVehicleModel("velo-kodjo")
	abj, _ := world.FindCity("abidjan")
	cocody, _ := abj.Commune("cocody")
	taxi := newSim()
	if err := taxi.leaveWith(abj, cocody, Ride{App: "compteur"}, noLuck()); err != nil {
		t.Fatal(err)
	}
	s := newSim()
	if err := s.leaveWith(abj, cocody, Ride{Own: &OwnVehicle{ID: 3, Model: car, Color: "#c92a2a"}}, noLuck()); err != nil {
		t.Fatal(err)
	}
	tr := s.Activity.Trip
	if tr.Mode != "perso" || tr.Vehicle == nil || tr.Vehicle.ID != 3 || tr.Vehicle.Km <= 0 || !strings.Contains(tr.Label, car.Name) {
		t.Fatalf("own car trip: %+v %+v", tr, tr.Vehicle)
	}
	if tr.Fare <= 0 || tr.Fare >= taxi.Activity.Trip.Fare {
		t.Errorf("the petrol, less than the taxi: %d vs %d", tr.Fare, taxi.Activity.Trip.Fare)
	}
	if s.Activity.End-s.Activity.Start > taxi.Activity.End-taxi.Activity.Start {
		t.Error("one's own car is no slower than the taxi")
	}
	bassam, _ := world.FindCity("grand-bassam")
	far := newSim()
	if err := far.leaveWith(bassam, bassam.Communes[0], Ride{Own: &OwnVehicle{ID: 4, Model: bike}}, noLuck()); err != errBikeTooFar {
		t.Errorf("by bike up country: %v", err)
	}
}
