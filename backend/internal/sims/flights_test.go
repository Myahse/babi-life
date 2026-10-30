package sims

import (
	"context"
	"math/rand/v2"
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Abidjan to Bouaké by plane: from the airport's commune, landing at
// Bouaké's, much faster than the coach and dearer; not from elsewhere.
func TestFlight(t *testing.T) {
	bouake, _ := world.FindCity("bouake")
	centre, _ := bouake.Commune("bouake-centre")
	s := newSim()
	s.Commune, s.Money = "yopougon", 500000
	if err := s.leaveWith(bouake, centre, Ride{App: "avion"}, rand.New(rand.NewPCG(1, 1))); err != errNotAtAirport {
		t.Fatalf("from Yopougon: %v", err)
	}
	s.Commune = "port-bouet"
	if err := s.leaveWith(bouake, centre, Ride{App: "avion", Party: 2}, rand.New(rand.NewPCG(1, 1))); err != nil {
		t.Fatal(err)
	}
	trip := s.Activity.Trip
	km, _, _, _ := world.FlightPath("abidjan", "bouake")
	minutes, fare := game.FlightQuote(km)
	if trip.Mode != "avion" || trip.City != "bouake" || trip.Commune != "bouake-centre" || trip.Fare != 2*fare || s.Money != 500000-2*fare {
		t.Fatalf("flight: %+v, money %d", trip, s.Money)
	}
	// « voyages-villes » open (no store in tests): it leaves from the airport and lands at the other's.
	if trip.FromPlace != "pb-aeroport" || trip.Place != "bouake-aeroport" || trip.Company != game.Airline {
		t.Errorf("flight's ends: %+v", trip)
	}
	// By coach the same way, from Adjamé's gare: longer on the road, and much cheaper.
	car := newSim()
	car.Commune, car.Money = "adjame", 500000
	if err := car.leaveWith(bouake, centre, Ride{}, rand.New(rand.NewPCG(1, 1))); err != nil {
		t.Fatal(err)
	}
	if car.Activity.End-car.Activity.Start < s.Activity.End-s.Activity.Start || minutes > 60 {
		t.Errorf("the plane is slower: plane %d min, car %d", s.Activity.End-s.Activity.Start, car.Activity.End-car.Activity.Start)
	}
	if car.Activity.Trip.Fare*5 > fare {
		t.Errorf("the coach (%d) should cost far less than a seat on the plane (%d)", car.Activity.Trip.Fare, fare)
	}
	if s.Needs.Fun <= car.Needs.Fun || s.Needs.Energy <= car.Needs.Energy {
		t.Errorf("the plane should leave you happier and less tired than the road: %+v vs %+v", s.Needs, car.Needs)
	}
	// Grand-Bassam has its aérodrome now: a flight from Port-Bouët lands there.
	bassam, _ := world.FindCity("grand-bassam")
	s = newSim()
	s.Commune, s.Money = "port-bouet", 500000
	if err := s.leaveWith(bassam, bassam.Communes[0], Ride{App: "avion"}, rand.New(rand.NewPCG(1, 1))); err != nil {
		t.Fatalf("to Bassam: %v", err)
	}
	if s.Activity.Trip.Place != "bassam-aerodrome" || s.Activity.Trip.City != "grand-bassam" {
		t.Errorf("to Bassam: %+v", s.Activity.Trip)
	}
}

// Every city has its airport, in it, of the « aeroport » kind, and flies to
// every other: priced and timed by distance, the further the dearer and longer.
func TestAirportsEveryCity(t *testing.T) {
	if _, ok := game.Kinds["aeroport"]; !ok {
		t.Fatal("no « aeroport » kind")
	}
	for _, c := range world.Cities {
		a, ok := game.Airports[c.ID]
		if !ok {
			t.Errorf("%s has no airport", c.Name)
			continue
		}
		city, cm, p, ok := world.FindPlace(a.Place)
		if !ok || city.ID != c.ID || cm.ID != a.Commune || p.Kind != "aeroport" || p.Source == nil {
			t.Errorf("%s's airport %s: %v %s %s %s", c.Name, a.Place, ok, city.ID, cm.ID, p.Kind)
		}
		for _, to := range world.Cities {
			if to.ID == c.ID {
				continue
			}
			if _, _, _, ok := world.FlightPath(c.ID, to.ID); !ok {
				t.Errorf("no flight %s → %s", c.ID, to.ID)
			}
		}
	}
	routes := world.FlightRoutes()
	if n := len(world.Cities); len(routes) != n*(n-1) {
		t.Errorf("%d flights for %d cities", len(routes), n)
	}
	// Further: dearer and at least as long.
	near, _, _, _ := world.FlightPath("abidjan", "grand-bassam")
	far, _, _, _ := world.FlightPath("abidjan", "korhogo")
	nm, nf := game.FlightQuote(near)
	fm, ff := game.FlightQuote(far)
	if !(ff > nf && fm > nm) {
		t.Errorf("Korhogo (%d min, %d F) vs Bassam (%d min, %d F)", fm, ff, nm, nf)
	}
	for _, r := range routes {
		want := ""
		if r.From == "grand-bassam" || r.To == "grand-bassam" {
			want = game.TravelKey
		}
		if r.Key != want {
			t.Errorf("%s → %s waits for %q", r.From, r.To, r.Key)
		}
	}
	// The aérodrome is the game's own, and says so.
	if _, _, p, _ := world.FindPlace("bassam-aerodrome"); p.Real || p.Source.Status != game.StatusFictional {
		t.Errorf("Bassam's aérodrome should be fictional: %+v", p.Source)
	}
}

// The coaches: a gare routière in every city, a line to every other city,
// cheaper and slower than the plane, leaving at set hours from the gare only.
func TestCoaches(t *testing.T) {
	for _, c := range world.Cities {
		g, ok := game.Gares[c.ID]
		if !ok {
			t.Errorf("%s has no gare routière", c.Name)
			continue
		}
		city, cm, p, ok := world.FindPlace(g.Place)
		if !ok || city.ID != c.ID || cm.ID != g.Commune || p.Kind != "transport" || p.Source == nil {
			t.Errorf("%s's gare %s: %v %s %s", c.Name, g.Place, ok, cm.ID, p.Kind)
		}
	}
	routes := world.CoachRoutes()
	if n := len(world.Cities); len(routes) != n*(n-1) {
		t.Errorf("%d coach lines for %d cities", len(routes), n)
	}
	brands := map[string]bool{}
	for _, co := range game.CoachCompanies {
		brands[co.ID] = true
		// Invented names only: none of the real companies'.
		for _, real := range []string{"UTB", "STIF", "AVS", "TSR", "SBTA", "CTE", "Sonef", "Léopard", "UTS"} {
			if strings.Contains(co.Name, real) {
				t.Errorf("%s: a real company's name", co.Name)
			}
		}
	}
	for _, r := range routes {
		if !brands[r.Company] || r.Fare <= 0 || r.Game <= 0 || r.Every <= 0 || r.First >= r.Last {
			t.Errorf("line %s → %s: %+v", r.From, r.To, r)
		}
		km, _, _, ok := world.FlightPath(r.From, r.To)
		if !ok {
			continue
		}
		fm, ff := game.FlightQuote(km)
		if r.Fare >= ff || r.Game < fm && km > 60 {
			t.Errorf("%s → %s: the coach (%d min, %d F) should be cheaper and slower than the plane (%d min, %d F)", r.From, r.To, r.Game, r.Fare, fm, ff)
		}
	}

	bouake, _ := world.FindCity("bouake")
	centre, _ := bouake.Commune("bouake-centre")
	s := newSim()
	s.Money = 500000
	// From Yopougon: to the gare first.
	if err := s.leaveWith(bouake, centre, Ride{App: "car"}, rand.New(rand.NewPCG(1, 1))); err != errNotAtGare {
		t.Fatalf("from Yopougon: %v", err)
	}
	s.Commune = "adjame"
	// At 14 h 05: the 15 h, one an hour on this long line.
	day := s.GameMinutes - s.GameMinutes%(24*60)
	s.GameMinutes = day + 14*60 + 5
	if err := s.leaveWith(bouake, centre, Ride{App: "car", Party: 2}, rand.New(rand.NewPCG(1, 1))); err != nil {
		t.Fatal(err)
	}
	trip := s.Activity.Trip
	m, f, _, _, co, _ := world.CoachPath("abidjan", "bouake")
	if trip.Mode != "car" || trip.FromPlace != "adjame-gare" || trip.Place != "bouake-gare" || trip.Company != co.Name || trip.Departs != day+15*60 || trip.Fare != 2*f {
		t.Fatalf("coach: %+v", trip)
	}
	if !strings.Contains(trip.Label, "départ 15 h") || s.Activity.Interaction.Icon != "bus" {
		t.Errorf("label %q icon %q", trip.Label, s.Activity.Interaction.Icon)
	}
	if got := s.Activity.End - s.Activity.Start; got != game.Length(m+55) && trip.Incident == "" {
		t.Errorf("coach length %d, want %d", got, game.Length(m+55))
	}
	// At night: no coach.
	n := newSim()
	n.Commune, n.Money = "adjame", 500000
	n.GameMinutes = day + 23*60
	if err := n.leaveWith(bouake, centre, Ride{}, rand.New(rand.NewPCG(1, 1))); err != errNoCoachNow {
		t.Errorf("at 23 h: %v", err)
	}
	// Babies and children don't travel alone (there are no players' parents to take them).
	kid := newSim()
	kid.Commune, kid.Money = "adjame", 500000
	kid.BornAt = kid.GameMinutes - game.MinutesToAge(6)
	if err := kid.leaveWith(bouake, centre, Ride{App: "car"}, rand.New(rand.NewPCG(1, 1))); err != errTooSmallToTravel {
		t.Errorf("a child alone on the coach: %v", err)
	}
	kid.Commune = "port-bouet"
	if err := kid.leaveWith(bouake, centre, Ride{App: "avion"}, rand.New(rand.NewPCG(1, 1))); err != errTooSmallToTravel {
		t.Errorf("a child alone on the plane: %v", err)
	}
}

// The timetable: the first at 5 h, then every `every` minutes, the last at its hour, none after.
func TestNextCoach(t *testing.T) {
	day := int64(3 * 24 * 60)
	for _, c := range []struct {
		at, want int64
		ok       bool
	}{{day + 3*60, day + 5*60, true}, {day + 5*60, day + 5*60, true}, {day + 5*60 + 1, day + 5*60 + 30, true}, {day + 20*60 + 59, day + 21*60, true}, {day + 21*60, day + 21*60, true}, {day + 21*60 + 1, 0, false}} {
		got, ok := game.NextCoach(c.at, 30, 5*60, 21*60)
		if got != c.want || ok != c.ok {
			t.Errorf("at %s: %s %v, want %s %v", game.ClockLabel(c.at), game.ClockLabel(got), ok, game.ClockLabel(c.want), c.ok)
		}
	}
	if e, _, l := game.CoachTimetable(30); e != 20 || l != 22*60 {
		t.Errorf("a short line: every %d, last %d", e, l)
	}
	if e, _, _ := game.CoachTimetable(600); e != 60 {
		t.Errorf("a long line: every %d", e)
	}
}

// With « voyages-villes » closed (a fresh database): the flights of before, the coach from anywhere
// as before, and nothing to or from Grand-Bassam's aérodrome.
func TestTravelClosed(t *testing.T) {
	pool := replyDB(t)
	old := features.Default
	features.Default = &features.Store{DB: pool}
	t.Cleanup(func() { features.Default = old })
	if features.Default.BlocksKey(context.Background(), game.TravelKey) == "" {
		t.Fatal("« voyages-villes » should ship closed")
	}
	bouake, _ := world.FindCity("bouake")
	centre, _ := bouake.Commune("bouake-centre")
	s := newSim()
	s.Money = 500000
	if err := s.leaveWith(bouake, centre, Ride{}, rand.New(rand.NewPCG(1, 1))); err != nil {
		t.Fatalf("the coach from Yopougon, closed: %v", err)
	}
	if tr := s.Activity.Trip; tr.Mode != "car" || tr.Place != "" || tr.Departs != 0 {
		t.Errorf("closed, the coach as before: %+v", tr)
	}
	bassam, _ := world.FindCity("grand-bassam")
	p := newSim()
	p.Commune, p.Money = "port-bouet", 500000
	if err := p.leaveWith(bassam, bassam.Communes[0], Ride{App: "avion"}, rand.New(rand.NewPCG(1, 1))); err != errNoFlight {
		t.Errorf("to Bassam by plane, closed: %v", err)
	}
	if err := p.leaveWith(bouake, centre, Ride{App: "avion"}, rand.New(rand.NewPCG(1, 1))); err != nil {
		t.Errorf("the flights of before, closed: %v", err)
	}
	if tr := p.Activity.Trip; tr.Place != "" {
		t.Errorf("closed, no arrival place: %+v", tr)
	}
}
