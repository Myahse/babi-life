package sims

import (
	"math/rand/v2"
	"slices"
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func famSim() *Sim {
	s := lifeSim()
	s.LastName = "Kouassi"
	s.Housing = game.OwnHouse
	s.Look = Look{Skin: "#7a4b2a", Hair: "afro", HairColor: "#1b1b1b", Outfit: "tshirt", OutfitColor: "#2266aa"}
	s.Friends = []game.Friend{{ID: "p-koffi", Name: "Koffi", Gender: "homme", Seed: 3, Friendship: 80, Romance: 80, Partner: true, Home: true, Adult: true}, {ID: "p-yao", Name: "Yao", Gender: "homme", Seed: 4, Friendship: 50, Adult: true}}
	s.lifeSync()
	return s
}

// Adult life goes by in real days: young adult, adult, senior; each a birthday at home, the hair greying.
func TestFamilleAgeing(t *testing.T) {
	s := famSim()
	f := s.Life.Famille
	if f == nil || f.Stage != game.AgeJeune || f.Years != 18 || f.Party != nil {
		t.Fatalf("an adult starts young: %+v", f)
	}
	s.GameMinutes += game.Days(game.Spans.Jeune)
	s.pending = nil
	s.lifeSync()
	if f.Stage != game.AgeAdulte || f.Years != 30 || f.Party == nil || f.Party.Who != "self" || len(s.pending) == 0 || !strings.Contains(s.pending[0].Text, "30 ans") {
		t.Fatalf("30: a birthday: %+v %+v", f, s.pending)
	}
	if s.Look.HairColor != "#56524e" {
		t.Fatalf("salt and pepper: %s", s.Look.HairColor)
	}
	s.GameMinutes += game.Days(game.Spans.Adulte)
	s.lifeSync()
	if f.Stage != game.AgeSenior || f.Years != 60 || s.Look.HairColor != "#d9d6d0" {
		t.Fatalf("60: a senior, white hair: %+v %s", f, s.Look.HairColor)
	}
	// No child to take over: the senior's years over, nobody passes.
	s.GameMinutes += game.Days(game.Spans.Senior) + 10
	s.lifeSync()
	if f.Last {
		t.Fatal("no heir: no farewell")
	}
}

// A couple at home tries for a baby; it comes on its day, one of the household, and grows up.
func TestFamilleBaby(t *testing.T) {
	s := famSim()
	rng := rand.New(rand.NewPCG(1, 2))
	for i := 0; i < 3 && s.Life.Famille.Expecting == nil; i++ {
		if _, _, err := s.tryBaby(rng); err != nil {
			t.Fatal(err)
		}
	}
	e := s.Life.Famille.Expecting
	if e == nil || e.Mother != "self" || e.Due-e.Since != game.Days(game.Spans.Grossesse) {
		t.Fatalf("the third try at the latest: %+v", e)
	}
	if _, _, err := s.tryBaby(rng); err != errExpecting {
		t.Fatalf("one at a time: %v", err)
	}
	s.lifeSync()
	if !s.hasMood("enceinte") {
		t.Fatal("« Un bébé en route »")
	}
	s.GameMinutes = e.Due
	s.lifeSync()
	f := s.Life.Famille
	if len(f.Kids) != 1 || f.Expecting != nil || f.Arrival != f.Kids[0].ID || !s.hasMood("jeune-parent") || s.hasMood("enceinte") {
		t.Fatalf("born at home: %+v", f)
	}
	k := f.Kids[0]
	if slices.Contains(s.houseMembers(), "kid:"+k.ID) {
		t.Fatal("a baby isn't told what to do")
	}
	if err := s.nameKid(k.ID, "Ange"); err != nil || f.Kids[0].Name != "Ange" {
		t.Fatalf("named: %v", err)
	}
	if s.nameKid(k.ID, "x") != errBadName {
		t.Fatal("a real first name")
	}
	s.GameMinutes += game.Days(game.Spans.Bebe)
	s.lifeSync()
	if f.Kids[0].Stage != game.StageEnfant || f.Party == nil || f.Party.Who != k.ID || !slices.Contains(s.houseMembers(), "kid:"+k.ID) {
		t.Fatalf("a child now, one of the household: %+v", f)
	}
	// Without a partner at home, no baby.
	s2 := lifeSim()
	if _, _, err := s2.tryBaby(rng); err != errNoPartnerIn {
		t.Fatalf("a couple: %v", err)
	}
}

// A child of 18 takes over: the person played changes, three quarters of the money less the debts are
// theirs; the parent and the partner stay at home as elders, who pass gently in old age (not with « vieillesse douce »).
func TestFamilleNextGeneration(t *testing.T) {
	s := famSim()
	f := s.Life.Famille
	f.Kids = []Kid{{ID: "k1", Name: "Ange", Gender: "homme", Seed: 9, Born: s.GameMinutes - game.Childhood() - 10, Traits: []string{"sportif", "artiste"}}}
	s.Money, s.Loan = 100_000, 20_000
	s.Career, s.CareerLevel = "banque", 3
	s.Life.Skills = map[string]int{"cuisine": 40}
	s.lifeSync()
	look := Look{Skin: "#7a4b2a", Hair: "court", HairColor: "#1b1b1b", Outfit: "tshirt", OutfitColor: "#aa2222"}
	old, err := s.handDown("k1", look, false)
	if err != nil {
		t.Fatal(err)
	}
	if old != "Awa" || s.FirstName != "Ange" || s.Gender != "homme" || s.LastName != "Kouassi" || s.Money != 60_000 || s.Loan != 0 || s.Career != "" || s.Life.Skills["cuisine"] != 10 {
		t.Fatalf("the heir: %s %s %d %d %s %v", s.FirstName, s.Gender, s.Money, s.Loan, s.Career, s.Life.Skills)
	}
	if s.age() < game.AdultAge || f.Generation != 1 || len(f.Kids) != 0 || f.Farewell == nil || f.Farewell.Money != 60_000 || f.Farewell.Rest != 20_000 || f.Farewell.Gone {
		t.Fatalf("handed down: %+v", f)
	}
	if len(f.Elders) != 2 || f.Elders[0].Name != "Awa" || f.Elders[0].Kin != "maman" || f.Elders[1].Name != "Koffi" || f.Elders[1].Kin != "papa" {
		t.Fatalf("the elders: %+v", f.Elders)
	}
	if s.partnerHome() != nil || s.Friends[0].Romance != 0 || s.Friends[0].Friendship != 25 {
		t.Fatalf("no romance comes down: %+v", s.Friends)
	}
	if !slices.Contains(s.houseMembers(), "elder:"+f.Elders[0].ID) {
		t.Fatal("the elders are of the household")
	}
	// Under 18: not yet.
	f.Kids = []Kid{{ID: "k2", Name: "Aya", Gender: "femme", Born: s.GameMinutes}}
	if _, err := s.handDown("k2", look, false); err != errNoHeir {
		t.Fatalf("18 first: %v", err)
	}
	// The elders' years go by; « vieillesse douce » keeps them.
	f.Gentle = true
	s.GameMinutes = f.Elders[0].AdultAt + game.LifeEnd() + 2*game.DayMinutes
	s.lifeSync()
	if len(f.Elders) != 2 || len(f.Memorials) != 0 {
		t.Fatal("vieillesse douce: nobody passes")
	}
	f.Gentle = false
	s.pending = nil
	s.lifeSync()
	if len(f.Elders) != 0 || len(f.Memorials) != 2 || f.Farewell == nil || !f.Farewell.Gone || !s.hasMood("deuil") {
		t.Fatalf("a gentle passing, the photos on the wall: %+v", f)
	}
}

// The senior's farewell: only once the years are over and a child can take over.
func TestFamilleFarewell(t *testing.T) {
	s := famSim()
	f := s.Life.Famille
	f.AdultAt = s.GameMinutes - game.LifeEnd() - 1
	f.Kids = []Kid{{ID: "k1", Name: "Ange", Gender: "homme", Born: s.GameMinutes - game.Childhood() - 10}}
	s.lifeSync()
	if !f.Last || !s.hasMood("serein") {
		t.Fatalf("the last days: %+v", f)
	}
	f.Gentle = true
	s.lifeSync()
	if f.Last {
		t.Fatal("vieillesse douce: no farewell")
	}
	f.Gentle = false
	s.lifeSync()
	look := Look{Skin: "#7a4b2a", Hair: "court", HairColor: "#1b1b1b", Outfit: "tshirt", OutfitColor: "#aa2222"}
	if _, err := s.handDown("k1", look, true); err != nil {
		t.Fatal(err)
	}
	if len(f.Memorials) != 1 || f.Memorials[0].Name != "Awa" || !f.Farewell.Gone || f.Farewell.Heir != "Ange" || len(f.Elders) != 1 {
		t.Fatalf("gone, the photo, the partner stays: %+v", f)
	}
}

// Visitors: invited, at the door, let in, looked after, gone home at their time.
func TestFamilleVisit(t *testing.T) {
	s := famSim()
	s.Money = 5000
	if _, _, err := s.invite("p-koffi"); err != errNotFriend {
		t.Fatalf("the partner lives here: %v", err)
	}
	if _, _, err := s.invite("p-yao"); err != nil {
		t.Fatal(err)
	}
	v := s.Life.Famille.Visit
	if v.State != "route" {
		t.Fatalf("on the way: %+v", v)
	}
	s.GameMinutes += invitedIn
	s.lifeSync()
	if v.State != "porte" {
		t.Fatalf("at the door: %+v", v)
	}
	if _, _, err := s.openDoor(); err != nil || v.State != "dedans" {
		t.Fatalf("in: %v %+v", err, v)
	}
	if _, _, err := s.host("manger"); err != nil || s.Money != 3500 {
		t.Fatalf("fed: %v %d", err, s.Money)
	}
	if _, _, err := s.host("manger"); err != errAlreadyHosted {
		t.Fatalf("once: %v", err)
	}
	if _, _, err := s.host("dames"); err != nil {
		t.Fatal(err)
	}
	yao := s.friendByID("p-yao")
	if yao.Friendship < 50+8+7 {
		t.Fatalf("the friendship grows: %d", yao.Friendship)
	}
	s.GameMinutes += visitStay
	s.lifeSync()
	if s.Life.Famille.Visit != nil || !s.hasMood("bonne-visite") {
		t.Fatalf("gone home, a good visit: %+v", s.Life.Famille.Visit)
	}
	// Unannounced: a knock; not opened, they go.
	s.dropBy(rand.New(rand.NewPCG(5, 6)))
	if v := s.Life.Famille.Visit; v == nil || v.State != "porte" || v.Kind != "surprise" {
		t.Fatalf("a knock: %+v", v)
	}
	if _, _, err := s.sendAway(); err != nil || s.Life.Famille.Visit != nil {
		t.Fatal("not opened")
	}
}

func TestParseSpans(t *testing.T) {
	d := game.ParseSpans("jeune=7, senior=3,bad=1,ado=x", game.Spans)
	if d.Jeune != 7 || d.Senior != 3 || d.Adulte != game.Spans.Adulte || d.Ado != game.Spans.Ado {
		t.Fatalf("%+v", d)
	}
}
