package sims

import (
	"math/rand/v2"
	"slices"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// astronaut: an adult tourist in Sassandra's town, rich enough for the station.
func astronaut() *Sim {
	s := &Sim{ID: "a", FirstName: "Aya", LastName: "Koné", Needs: game.FreshNeeds(), Money: 13_000_000, City: "sassandra", Commune: "sassandra-centre",
		HomeCity: "abidjan", HomeCommune: "cocody", GameMinutes: 600_000}
	s.BornAt = s.GameMinutes - game.MinutesToAge(30)
	// (The express training done: espaceFormation.go, espaceFormation_test.go.)
	s.Life.Espace = &Espace{Training: true}
	return s
}

func rocketRng() *rand.Rand { return rand.New(rand.NewPCG(1, 1)) }

// spaceCity: a destination's city and the commune one asks for.
func spaceCity(t *testing.T, id string) (world.City, world.Commune) {
	t.Helper()
	c, ok := world.FindCity(id)
	if !ok || !world.IsSpace(id) {
		t.Fatalf("no space city %s", id)
	}
	return c, c.Communes[0]
}

// arrive: the trip under way, over.
func arrive(s *Sim) []Event {
	s.GameMinutes = s.Activity.End
	return s.finish(rocketRng())
}

// No launch away from the pad, without a ticket, under 18, too tired.
func TestNoLaunchWithoutPadOrTicket(t *testing.T) {
	station, cm := spaceCity(t, "station-akwaba")
	s := astronaut()
	if err := s.leaveWith(station, cm, Ride{App: game.RocketApp}, rocketRng()); err != errNotAtPad {
		t.Fatalf("from the town: %v", err)
	}
	// Not by plane, nor by taxi, either.
	if err := s.leaveWith(station, cm, Ride{App: "avion"}, rocketRng()); err != errNotAtPad {
		t.Fatalf("by plane: %v", err)
	}
	s.Commune = "sassandra-spatioport"
	if err := s.leaveWith(station, cm, Ride{App: game.RocketApp}, rocketRng()); err != errNoTicket {
		t.Fatalf("no ticket: %v", err)
	}
	s.space().Ticket = &SpaceTicket{Dest: "lune", Paid: 1}
	if err := s.leaveWith(station, cm, Ride{App: game.RocketApp}, rocketRng()); err == nil {
		t.Fatal("a Moon ticket takes one to the station")
	}
	young := astronaut()
	young.Commune = "sassandra-spatioport"
	young.BornAt = young.GameMinutes - game.MinutesToAge(16)
	young.space().Ticket = &SpaceTicket{Dest: "station"}
	if err := young.leaveWith(station, cm, Ride{App: game.RocketApp}, rocketRng()); err != errSpaceAge {
		t.Fatalf("at 16: %v", err)
	}
	if _, err := young.interactAt("sassandra-pas-de-tir", game.TicketStation); err == nil {
		t.Fatal("a ticket sold at 16")
	}
	tired := astronaut()
	tired.Commune, tired.Needs.Energy = "sassandra-spatioport", 10
	tired.space().Ticket = &SpaceTicket{Dest: "station"}
	if err := tired.leaveWith(station, cm, Ride{App: game.RocketApp}, rocketRng()); err != errSpaceTired {
		t.Fatalf("too tired: %v", err)
	}
	// The rocket goes nowhere on Earth.
	abj, _ := world.FindCity("abidjan")
	if err := tired.leaveWith(abj, abj.Communes[0], Ride{App: game.RocketApp}, rocketRng()); err != errNoRocketThere {
		t.Fatalf("to Abidjan by rocket: %v", err)
	}
}

// The ticket is paid once, when bought; boarding uses it up and charges nothing more; one at a time.
func TestFareChargedOnce(t *testing.T) {
	station, cm := spaceCity(t, "station-akwaba")
	s := astronaut()
	s.Commune = "sassandra-spatioport"
	if _, err := s.interactAt("sassandra-pas-de-tir", game.TicketStation); err != nil {
		t.Fatal(err)
	}
	if s.Money != 13_000_000-game.PriceStation || s.space().Ticket == nil || s.space().Ticket.Paid != game.PriceStation {
		t.Fatalf("bought: money %d, ticket %+v", s.Money, s.space().Ticket)
	}
	s.GameMinutes = s.Activity.End
	s.finish(rocketRng())
	if _, err := s.interactAt("sassandra-pas-de-tir", game.TicketStation); err != errTicketHeld {
		t.Fatalf("a second ticket: %v", err)
	}
	// Boarding: the next launch, at most BoardWindow away.
	l := game.NextLaunch("sassandra", s.GameMinutes+game.Preflight)
	s.GameMinutes = l.At - game.BoardWindow - 30
	if err := s.leaveWith(station, cm, Ride{App: game.RocketApp}, rocketRng()); err == nil {
		t.Fatal("boarded before the window opened")
	}
	s.GameMinutes = l.At - game.BoardWindow
	money := s.Money
	if err := s.leaveWith(station, cm, Ride{App: game.RocketApp}, rocketRng()); err != nil {
		t.Fatal(err)
	}
	tr := s.Activity.Trip
	if s.Money != money || tr.Fare != 0 || s.space().Ticket != nil || s.voyage() == nil || tr.Mode != game.RocketApp || tr.Departs != l.At {
		t.Fatalf("boarding charged again or kept the ticket: money %d→%d, trip %+v", money, s.Money, tr)
	}
	if s.Activity.End != l.At+game.LaunchLeg {
		t.Errorf("arrives at %d, want the launch %d + %d", s.Activity.End, l.At, game.LaunchLeg)
	}
	arrive(s)
	if s.City != "station-akwaba" || s.Commune != "akwaba-noeud" || s.voyage().Arrived == 0 || !slices.Contains(s.space().Visited, "station") {
		t.Fatalf("arrival: %s/%s %+v", s.City, s.Commune, s.space())
	}
	if s.Money != money {
		t.Errorf("the arrival cost money: %d", s.Money-money)
	}
	// A second boarding from up there: no (and a second ticket can't be bought from there).
	if err := s.leaveWith(station, cm, Ride{App: game.RocketApp}, rocketRng()); err == nil {
		t.Fatal("left again")
	}
}

// Cancelled before boarding: 80 % back, never more than was paid (nothing for a ticket given).
func TestRefundNeverMoreThanPaid(t *testing.T) {
	for _, paid := range []int{0, 1, 3, 999, game.PriceStation, game.PriceMars} {
		if r := game.Refund(paid); r > paid || r < 0 {
			t.Errorf("refund %d for %d", r, paid)
		}
	}
	s := astronaut()
	s.Commune = "sassandra-spatioport"
	if _, err := s.interactAt("sassandra-pas-de-tir", game.TicketCancel); err != errNoTicketHeld {
		t.Fatalf("cancelling nothing: %v", err)
	}
	start := s.Money
	if _, err := s.interactAt("sassandra-pas-de-tir", game.TicketStation); err != nil {
		t.Fatal(err)
	}
	s.GameMinutes = s.Activity.End
	s.finish(rocketRng())
	if _, err := s.interactAt("sassandra-pas-de-tir", game.TicketCancel); err != nil {
		t.Fatal(err)
	}
	if lost := start - s.Money; lost != game.PriceStation-game.Refund(game.PriceStation) || s.space().Ticket != nil {
		t.Fatalf("lost %d, ticket %+v", lost, s.space().Ticket)
	}
	// A ticket given (the tester's): nothing back.
	s.GameMinutes = s.Activity.End
	s.finish(rocketRng())
	s.testerDo(TesterAction{Action: "espace-billet"})
	before := s.Money
	if _, err := s.interactAt("sassandra-pas-de-tir", game.TicketCancel); err != nil {
		t.Fatal(err)
	}
	if s.Money != before {
		t.Errorf("a free ticket paid back %d", s.Money-before)
	}
}

// The way back always works: no money, no energy, no ticket, no record of the journey; never below zero.
func TestReturnAlwaysWorks(t *testing.T) {
	sassandra, _ := world.FindCity("sassandra")
	for _, c := range []struct {
		name  string
		setup func(*Sim)
		lands string
	}{
		{"broke and exhausted", func(s *Sim) { s.Money, s.Needs = 0, game.Needs{} }, "sassandra-centre"},
		{"no voyage kept", func(s *Sim) { s.Life.Espace = nil }, "sassandra-centre"},
		{"from Baïkonour", func(s *Sim) {
			s.space().Voyage = &SpaceVoyage{Dest: "station", From: "baikonour", Arrived: s.GameMinutes}
		}, "baikonour-centre"},
		{"ten nights, little money", func(s *Sim) {
			s.Money = 100_000
			s.space().Voyage = &SpaceVoyage{Dest: "station", From: "sassandra", Arrived: s.GameMinutes - 10*24*60}
		}, "sassandra-centre"},
		{"a minor", func(s *Sim) { s.BornAt = s.GameMinutes - game.MinutesToAge(10) }, "sassandra-centre"},
	} {
		s := astronaut()
		s.City, s.Commune = "station-akwaba", "akwaba-noeud"
		s.space().Voyage = &SpaceVoyage{Dest: "station", From: "sassandra", Arrived: s.GameMinutes}
		c.setup(s)
		// Whatever the commune asked for on Earth, it lands at its spaceport's.
		if err := s.leaveWith(sassandra, sassandra.Communes[1], Ride{App: game.RocketApp}, rocketRng()); err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		arrive(s)
		if s.inSpace() || s.Commune != c.lands || s.Money < 0 || s.voyage() != nil {
			t.Errorf("%s: at %s/%s, money %d", c.name, s.City, s.Commune, s.Money)
		}
	}
	// Called away from up there (an invitation, a taxi): no, only by the rocket.
	s := astronaut()
	s.City, s.Commune = "station-akwaba", "akwaba-noeud"
	abj, _ := world.FindCity("abidjan")
	if err := s.leave(abj, abj.Communes[0]); err != errInSpace {
		t.Fatalf("a taxi from orbit: %v", err)
	}
}

// The Moon: the cruise's steps in the capsule, then the landing at the base.
func TestMoonCruise(t *testing.T) {
	lune, cm := spaceCity(t, "lune")
	s := astronaut()
	s.Commune, s.Money = "sassandra-spatioport", 0
	s.testerDo(TesterAction{Action: "espace-billet", Stage: "lune"})
	s.testerDo(TesterAction{Action: "espace-lancer"})
	if err := s.leaveWith(lune, cm, Ride{App: game.RocketApp}, rocketRng()); err != nil {
		t.Fatal(err)
	}
	arrive(s)
	if s.Commune != "lune-pirogue" || s.voyage().Arrived != 0 {
		t.Fatalf("in cruise: %s %+v", s.Commune, s.voyage())
	}
	base, _ := lune.Commune("lune-base")
	if err := s.leaveWith(lune, base, Ride{}, rocketRng()); err != errCruising {
		t.Fatalf("out of the capsule mid-cruise: %v", err)
	}
	d, _ := game.FindDestination("lune")
	for _, step := range d.Steps {
		if _, err := s.interactAt("lune-capsule", step); err != nil {
			t.Fatalf("%s: %v", step, err)
		}
		s.GameMinutes = s.Activity.End
		s.finish(rocketRng())
	}
	if s.Activity == nil || s.Activity.Trip == nil || s.Activity.Trip.Commune != "lune-base" {
		t.Fatalf("no landing: %+v", s.Activity)
	}
	arrive(s)
	if s.Commune != "lune-base" || s.voyage().Arrived == 0 || s.Money != 0 {
		t.Fatalf("landed: %s %+v, money %d", s.Commune, s.voyage(), s.Money)
	}
	// Mars: three rounds, the tester's shortcut finishing each.
	mars, mcm := spaceCity(t, "mars")
	m := astronaut()
	m.Commune = "sassandra-spatioport"
	m.testerDo(TesterAction{Action: "espace-billet", Stage: "mars"})
	m.testerDo(TesterAction{Action: "espace-lancer"})
	if err := m.leaveWith(mars, mcm, Ride{App: game.RocketApp}, rocketRng()); err != nil {
		t.Fatal(err)
	}
	arrive(m)
	for i := 0; i < 3; i++ {
		if _, _, err := m.testerEspace("espace-round", ""); err != nil {
			t.Fatalf("round %d: %v", i, err)
		}
	}
	arrive(m)
	if m.Commune != "mars-colonie" || m.voyage().Arrived == 0 {
		t.Fatalf("on Mars: %s %+v", m.Commune, m.voyage())
	}
}

// Up there, a shift still counts in the account's daily cap (one a day).
func TestShiftCapAboard(t *testing.T) {
	saved := game.Careers
	defer func() { game.Careers = saved }()
	game.Careers = append(slices.Clone(game.Careers), game.Career{ID: "test-astronaute", Label: "Astronaute", Icon: "rocket", Kind: game.EspaceStationK, MinHour: 0, MaxHour: 24, Minutes: 60,
		Levels: []game.Level{{Title: "Candidat·e", Pay: 3000}}})
	s := astronaut()
	s.City, s.Commune, s.Career = "station-akwaba", "akwaba-noeud", "test-astronaute"
	if _, err := s.interactAt("akwaba-module-vie", game.WorkInteractionID); err != nil {
		t.Fatal(err)
	}
	s.GameMinutes = s.Activity.End
	s.finish(rocketRng())
	if _, err := s.interactAt("akwaba-module-vie", game.WorkInteractionID); err == nil {
		t.Fatal("a second shift the same day, aboard")
	}
}

// Nobody is born up there.
func TestBirthplaceNeverInSpace(t *testing.T) {
	for i := range 20 {
		city, _ := birthplace(nil, nil, "station-akwaba", "akwaba-noeud", rand.New(rand.NewPCG(uint64(i), 1)), nil)
		if world.IsSpace(city) {
			t.Fatalf("born in %s", city)
		}
	}
	for _, c := range world.Cities {
		if world.IsSpace(c.ID) || c.Country == game.SpaceCountry {
			t.Fatalf("%s is up there but in Cities", c.ID)
		}
	}
}

// Up there, no shower: the hygiene drops faster than on Earth.
func TestSpaceHygiene(t *testing.T) {
	earth, up := astronaut(), astronaut()
	up.City, up.Commune = "station-akwaba", "akwaba-noeud"
	a, b := earth.decay(game.FreshNeeds(), 120, false), up.decay(game.FreshNeeds(), 120, false)
	if b.Hygiene >= a.Hygiene {
		t.Errorf("hygiene up there %v, on Earth %v", b.Hygiene, a.Hygiene)
	}
}
