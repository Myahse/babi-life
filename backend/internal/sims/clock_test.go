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
	if s.Activity.Trip.Mode != "taxi" || s.Commune != "yopougon" {
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
	if err := s.leaveWith(abj, marcory, rand.New(alwaysSource{})); err != nil {
		t.Fatal(err)
	}
	a := s.Activity
	if a.Trip.Incident == "" || a.End-a.Start <= base {
		t.Fatalf("a jam should slow the trip: incident %q, %d min vs %d", a.Trip.Incident, a.End-a.Start, base)
	}
}
