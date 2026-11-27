package sims

import (
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

func fermeSim(money int) *Sim {
	return &Sim{ID: "f", FirstName: "Konan", Needs: game.FreshNeeds(), Money: money, City: "daloa", Commune: "daloa-centre", HomeCity: "abidjan", HomeCommune: "cocody",
		GameMinutes: game.MinuteOf(time.Date(2026, 11, 10, 9, 0, 0, 0, time.UTC))}
}

var openAll = func(game.FermeOffre) bool { return true }

// Renting, sowing, feeding: each charged once, and never twice for the same thing.
func TestFermeCostsOnce(t *testing.T) {
	s := fermeSim(100000)
	o, _ := game.FindOffre("gonate")
	if _, money, err := s.fermeAct("louer", fermeReq{Offre: "gonate"}, openAll); err != nil || money != -o.Rent || s.Money != 100000-o.Rent {
		t.Fatalf("rent: %v %d %d", err, money, s.Money)
	}
	if _, _, err := s.fermeAct("louer", fermeReq{Offre: "gonate"}, openAll); err != errFermeHave {
		t.Fatalf("rented twice: %v", err)
	}
	p := s.ferme().Plots[0]
	if p.RentUntil != s.today()+game.RentDays {
		t.Fatalf("rent until %d", p.RentUntil)
	}
	for _, act := range []string{"defricher", "labourer"} {
		if _, money, err := s.fermeAct(act, fermeReq{Plot: p.ID}, openAll); err != nil || money != 0 {
			t.Fatalf("%s: %v %d", act, err, money)
		}
	}
	before := s.Money
	c, _ := game.FindCulture("gombo")
	if _, money, err := s.fermeAct("semer", fermeReq{Plot: p.ID, Crop: "gombo", Score: 80}, openAll); err != nil || money != -c.Seed*o.Rows || s.Money != before-c.Seed*o.Rows {
		t.Fatalf("sow: %v %d", err, money)
	}
	if _, _, err := s.fermeAct("semer", fermeReq{Plot: p.ID, Crop: "gombo"}, openAll); err != errFermeStage {
		t.Fatalf("sown twice: %v", err)
	}
	// A crop that doesn't grow there is refused (and costs nothing).
	if _, _, err := s.fermeAct("semer", fermeReq{Plot: p.ID, Crop: "coton"}, openAll); err == nil {
		t.Fatal("coton sown at Daloa")
	}
	// Watered once a day (unless it rains: then no need).
	if game.Meteo(game.ZoneSud, s.today()) != "pluie" {
		if _, _, err := s.fermeAct("arroser", fermeReq{Plot: p.ID}, openAll); err != nil {
			t.Fatalf("water: %v", err)
		}
		if _, _, err := s.fermeAct("arroser", fermeReq{Plot: p.ID}, openAll); err != errFermeDone {
			t.Fatalf("watered twice: %v", err)
		}
	}
	// The animals: bought (at least Min), fed once a day.
	b, _ := game.FindBete("poules")
	before = s.Money
	if _, money, err := s.fermeAct("betes", fermeReq{Plot: p.ID, Kind: "poules", Qty: 1}, openAll); err != nil || money != -b.Min*b.Price || s.Money != before-b.Min*b.Price {
		t.Fatalf("hens: %v %d", err, money)
	}
	before = s.Money
	if _, money, err := s.fermeAct("nourrir", fermeReq{Plot: p.ID, Kind: "poules"}, openAll); err != nil || money != -b.Feed*b.Min || s.Money != before-b.Feed*b.Min {
		t.Fatalf("feed: %v %d", err, money)
	}
	if _, _, err := s.fermeAct("nourrir", fermeReq{Plot: p.ID, Kind: "poules"}, openAll); err != errFermeDone {
		t.Fatalf("fed twice: %v", err)
	}
	// Away from Daloa, the field waits (but the farmhand can be hired from anywhere).
	s.City = "abidjan"
	if _, _, err := s.fermeAct("desherber", fermeReq{Plot: p.ID}, openAll); err != errFermeAway {
		t.Fatalf("worked from afar: %v", err)
	}
	if _, _, err := s.fermeAct("manoeuvre", fermeReq{Plot: p.ID, On: true}, openAll); err != nil || !p.Hand {
		t.Fatalf("farmhand: %v", err)
	}
	// A minor can't rent a plot, but can help in the yard.
	kid := fermeSim(50000)
	kid.BornAt = kid.GameMinutes - 850
	if _, _, err := kid.fermeAct("louer", fermeReq{Offre: "gonate"}, openAll); err != errFermeMinor {
		t.Fatalf("a minor rents: %v", err)
	}
}

// The field grows with water and ripens in its days; without water (the Sahel's dry season) it waits, never dies.
func TestFermeGrowth(t *testing.T) {
	p := &Parcelle{ID: "p1", Offre: "gonate", Owned: true, Champ: champ0()}
	p.Champ = Champ{Stage: game.StagePousse, Crop: "mais", Quality: 1, WeedAt: 100}
	c, _ := game.FindCulture("mais")
	day := game.FermeToday(time.Date(2026, 1, 10, 0, 0, 0, 0, time.UTC))
	for d := day; d < day+int64(c.Days); d++ {
		p.Champ.Watered = d
		p.Champ.Pest = false
		p.fieldDay(game.ZoneSud, d, false, "")
	}
	if p.Champ.Stage != game.StageMur {
		t.Fatalf("watered maize not ripe after %d days: %+v", c.Days, p.Champ)
	}
	dry := &Parcelle{ID: "p2", Owned: true, Champ: Champ{Stage: game.StagePousse, Crop: "mil", Quality: 1, WeedAt: 100}}
	for d := day; d < day+20; d++ {
		if w := game.Meteo(game.ZoneSahel, d); w == "pluie" {
			t.Fatalf("rain in the Sahel in January")
		}
		dry.fieldDay(game.ZoneSahel, d, false, "")
	}
	if dry.Champ.Growth != 0 || dry.Champ.Stage != game.StagePousse || dry.Champ.Crop != "mil" {
		t.Fatalf("a dry field grew or was lost: %+v", dry.Champ)
	}
	// The winter abroad: nothing grows even watered.
	cold := &Parcelle{ID: "p3", Owned: true, Champ: Champ{Stage: game.StagePousse, Crop: "mais", Quality: 1}}
	cold.Champ.Watered = day
	cold.fieldDay(game.ZoneContinental, day, false, "")
	if cold.Champ.Growth != 0 {
		t.Fatalf("maize grew in the Iowa winter")
	}
}

// Forgotten a whole month, the animals are tired, never dead; fed again they recover and have their young.
func TestFermeAnimalsNeverDie(t *testing.T) {
	e := &Enclos{Kind: "chevres", Adults: 4, Condition: 80, BirthIn: 10}
	for d := int64(1000); d < 1030; d++ {
		e.penDay("p1", d, false)
		if e.Adults != 4 || e.Condition < 20 {
			t.Fatalf("day %d: %+v", d, e)
		}
	}
	if !e.Tired || e.Young != 0 {
		t.Fatalf("forgotten goats: %+v", e)
	}
	e.Sick = false
	born := 0
	for d := int64(1030); d < 1060; d++ {
		e.Fed, e.Watered = d, d
		e.Sick = false
		n, _, _ := e.penDay("p1", d, false)
		born += n
	}
	if e.Tired || e.Condition < 90 || born == 0 || e.Adults < 4 {
		t.Fatalf("goats kept a month: %+v (born %d)", e, born)
	}
	// The hens lay when kept, not when forgotten.
	h := &Enclos{Kind: "poules", Adults: 6, Condition: 100}
	h.Fed, h.Watered = 5, 5
	h.penDay("p1", 5, false)
	if h.Eggs == 0 {
		t.Fatal("kept hens laid nothing")
	}
	eggs := h.Eggs
	h.penDay("p1", 6, false)
	if h.Eggs != eggs || h.Adults != 6 {
		t.Fatalf("forgotten hens: %+v", h)
	}
}

// What the farm sells is capped a day: the rest waits in the grenier; buying and selling back never makes money.
func TestFermeSalesCapped(t *testing.T) {
	s := fermeSim(5_000_000)
	f := s.ferme()
	f.Grenier["tilapia"] = 500 // 175 000 F at the market
	text, got, err := s.fermeAct("vendre", fermeReq{Product: "tilapia"}, openAll)
	if err != nil || got <= 0 || got > game.FermeCap {
		t.Fatalf("sale: %v %d %q", err, got, text)
	}
	if f.Grenier["tilapia"] != 500-got/350 {
		t.Fatalf("grenier after sale: %d (got %d)", f.Grenier["tilapia"], got)
	}
	if _, _, err := s.fermeAct("vendre", fermeReq{Product: "tilapia"}, openAll); err != errFermeCapped {
		t.Fatalf("sold past the cap: %v", err)
	}
	// Raw cocoa isn't bought; dried beans are, by the coopérative.
	f.Grenier["cacao"] = 10
	if _, _, err := s.fermeAct("vendre", fermeReq{Product: "cacao", To: "coop"}, openAll); err != errFermeNoBuyer {
		t.Fatalf("raw cocoa sold: %v", err)
	}
	// A plot bought and sold back, animals bought and sold: always less money than before.
	s2 := fermeSim(5_000_000)
	for i := 0; i < 5; i++ {
		before := s2.Money
		if _, _, err := s2.fermeAct("acheter", fermeReq{Offre: "gonate"}, openAll); err != nil {
			t.Fatalf("buy: %v", err)
		}
		p := s2.ferme().Plots[len(s2.ferme().Plots)-1]
		if _, _, err := s2.fermeAct("betes", fermeReq{Plot: p.ID, Kind: "porcs", Qty: 2}, openAll); err != nil {
			t.Fatalf("pigs: %v", err)
		}
		for {
			if _, _, err := s2.fermeAct("vendre-betes", fermeReq{Plot: p.ID, Kind: "porcs", Qty: 2}, openAll); err != nil {
				break
			}
		}
		// The day's cap may keep some: they're given away to empty the plot (the test's own way).
		p.Pens = nil
		if _, _, err := s2.fermeAct("rendre", fermeReq{Plot: p.ID}, openAll); err != nil {
			t.Fatalf("sell back: %v", err)
		}
		if s2.Money >= before {
			t.Fatalf("round %d made money: %d -> %d", i, before, s2.Money)
		}
	}
	// The farm's own total that day stays under its cap whatever was sold.
	if t2 := s2.wallet().Got(s2.today(), game.FromFerme).Djai; t2 > game.FermeCap {
		t.Fatalf("farm earned %d in a day", t2)
	}
}

// A harvest goes to the grenier; the beans dry; the days are brought up once.
func TestFermeHarvestAndDry(t *testing.T) {
	s := fermeSim(300000)
	if _, _, err := s.fermeAct("acheter", fermeReq{Offre: "gonate"}, openAll); err != nil {
		t.Fatal(err)
	}
	p := s.ferme().Plots[0]
	p.Champ = Champ{Stage: game.StageMur, Crop: "cacao", Quality: 1, Score: 70}
	if _, _, err := s.fermeAct("recolter", fermeReq{Plot: p.ID, Score: 90}, openAll); err != nil {
		t.Fatal(err)
	}
	raw := s.ferme().Grenier["cacao"]
	if raw <= 0 || p.Champ.Stage != game.StagePousse || p.Champ.Crop != "cacao" {
		t.Fatalf("cocoa harvest: %d %+v", raw, p.Champ)
	}
	if _, _, err := s.fermeAct("transformer", fermeReq{Product: "feves-sechees"}, openAll); err != nil {
		t.Fatal(err)
	}
	if s.ferme().Grenier["cacao"] != 0 || len(s.ferme().Sechage) != 1 {
		t.Fatalf("drying: %+v", s.ferme())
	}
	s.GameMinutes += 3 * 24 * 60
	s.fermeSettle()
	if s.ferme().Grenier["feves-sechees"] == 0 || len(s.ferme().Sechage) != 0 {
		t.Fatalf("dried beans: %+v", s.ferme())
	}
	if again := s.fermeSettle(); again != nil {
		t.Fatalf("settled twice: %v", again)
	}
}
