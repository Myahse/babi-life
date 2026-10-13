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

func TestActivityEndsWhileAway(t *testing.T) {
	s := newSim()
	sell, _ := game.Kinds["market"].Interaction("sell-goods") // 4 h, earns 4 000F
	if err := s.start(sell, "yop-marche", "market", "Marché de Siporex", nil, ""); err != nil {
		t.Fatal(err)
	}
	if err := s.start(sell, "yop-marche", "market", "Marché de Siporex", nil, ""); err != game.ErrBusy {
		t.Fatalf("a busy Sim can't start something else, got %v", err)
	}
	ev := s.advance(noon.Add(time.Hour), noLuck())
	if s.Activity == nil || len(ev) != 0 || s.Money != 10000 {
		t.Fatalf("after 1 h it is still selling: %+v %v %d", s.Activity, ev, s.Money)
	}
	ev = s.advance(noon.Add(6*time.Hour), noLuck())
	if s.Activity != nil || s.Money < 14000 || len(ev) == 0 || !strings.Contains(ev[0].Text, "Vendre") {
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
	s.advance(noon.Add(time.Hour), noLuck())
	ev, err := s.stop()
	if err != nil || s.Activity != nil || s.Money != 11000 || ev.Money != 1000 {
		t.Fatalf("1 h of 4: money %d ev %+v err %v", s.Money, ev, err)
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
	s.advance(noon.Add(3*time.Hour), noLuck())
	if s.Commune != "cocody" || s.Activity != nil {
		t.Fatalf("arrived: commune %s act %v", s.Commune, s.Activity)
	}
}

func TestRentFallsOnTheRealSaturday(t *testing.T) {
	s := newSim()
	s.Money = 100000
	ev := s.advance(noon.Add(4*24*time.Hour), noLuck()) // Wednesday → Sunday
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
	if a.Trip.Incident == "" || a.End-a.Start <= base {
		t.Fatalf("a jam should slow the trip: incident %q, %d min vs %d", a.Trip.Incident, a.End-a.Start, base)
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
