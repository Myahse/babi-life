package sims

import (
	"math/rand/v2"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// usesToBreak: how many evenings of TV before it breaks, for this seed.
func usesToBreak(s *Sim, seed uint64) int {
	rng := rand.New(rand.NewPCG(seed, 3))
	for n := 1; n <= 100; n++ {
		if evs := s.objUsed(done("watch-tv", game.Needs{Fun: 25}, 3), rng); len(evs) > 0 {
			return n
		}
	}
	return 100
}

// Used, an object wears and breaks; not before it's well worn; the finer ones last longer.
func TestObjectsWearAndBreak(t *testing.T) {
	plain, fine := 0, 0
	for seed := range uint64(100) {
		s := lifeSim()
		n := usesToBreak(s, seed)
		if n < 5 || n > 13 {
			t.Fatalf("a plain TV broke after %d uses", n)
		}
		if !s.broken("tele") || s.Life.Objects["tele"].Broken != s.GameMinutes {
			t.Fatal("broken, since now")
		}
		plain += n
		own := lifeSim()
		own.Housing, own.Furnished = game.OwnHouse, []string{"tele-geante"}
		fine += usesToBreak(own, seed)
	}
	if fine < plain*2 {
		t.Errorf("uses before breaking, over 100 TVs: plain %d, the giant screen %d", plain, fine)
	}
	// Not in the house (one's own, without a console): nothing to wear.
	s := lifeSim()
	s.Housing = game.OwnHouse
	if evs := s.objUsed(done("maison-foot", game.Needs{}, 1), rand.New(rand.NewPCG(1, 1))); evs != nil || s.Life.Objects != nil {
		t.Error("no console, nothing to wear")
	}
	// Elsewhere than at home: nothing.
	a := done("watch-tv", game.Needs{}, 3)
	a.PlaceID = "maquis-1"
	if s.objUsed(a, rand.New(rand.NewPCG(1, 1))) != nil {
		t.Error("the maquis' TV isn't the house's")
	}
}

// Broken: what's done on it is refused, the mood holds at home; the repair asks for it to be broken.
func TestObjectsBroken(t *testing.T) {
	s := lifeSim()
	if err := s.objBlocks("reparer-tele", HomePlaceID); err != errNotBroken {
		t.Fatalf("nothing to mend: %v", err)
	}
	s.objState("douche").Broken = s.GameMinutes
	if err := s.objBlocks("shower", HomePlaceID); err == nil {
		t.Error("a broken shower: no shower")
	}
	if err := s.objBlocks("shower", "salle-1"); err != nil {
		t.Error("the gym's shower works")
	}
	if err := s.objBlocks("reparer-douche", HomePlaceID); err != nil {
		t.Error("it can be mended")
	}
	s.lifeSync()
	if !s.hasMood("fuite-eau") {
		t.Error("« Fuite d'eau » at home")
	}
	// Two leaks: one mood.
	s.objState("lavabo").Broken = s.GameMinutes
	s.lifeSync()
	n := 0
	for _, m := range s.Life.Moodlets {
		if m.ID == "fuite-eau" {
			n++
		}
	}
	if n != 1 {
		t.Errorf("leaks' moods: %d", n)
	}
	// Shut: nothing is broken.
	s.lifeOn = false
	if s.objBlocks("shower", HomePlaceID) != nil {
		t.Error("shut: the shower works")
	}
}

// Mending it oneself: the bricolage decides; a failure may shock; it trains the bricolage.
func TestObjectsRepair(t *testing.T) {
	fixed := func(level int) (ok, shocks int) {
		for seed := range uint64(300) {
			s := lifeSim()
			s.Life.Skills = map[string]int{"bricolage": game.SkillXP(level)}
			s.objState("tele").Broken = s.GameMinutes
			evs := s.repairDone(done("reparer-tele", game.Needs{}, 3), rand.New(rand.NewPCG(seed, 5)))
			if len(evs) == 0 || (level < game.SkillMax && s.Life.Skills["bricolage"] <= game.SkillXP(level)) {
				t.Fatal("a repair said and trained")
			}
			if !s.broken("tele") {
				ok++
				if !s.hasMood("repare") || s.Life.Objects["tele"].Wear != 10 {
					t.Fatal("mended: proud of it, as new")
				}
			} else if s.hasMood("decharge") {
				shocks++
			}
		}
		return
	}
	lo, shock := fixed(1)
	hi, _ := fixed(10)
	if lo < 90 || lo > 150 || hi < 280 || shock < 70 {
		t.Errorf("mended out of 300: bricolage 1 %d (%d shocks), bricolage 10 %d", lo, shock, hi)
	}
}

// The repairman: paid now, here for a moment, and it's mended.
func TestObjectsRepairman(t *testing.T) {
	s := lifeSim()
	s.Money = 10_000
	if _, err := s.callRepairman("tele"); err != errNotBroken {
		t.Fatalf("nothing broken: %v", err)
	}
	s.objState("tele").Broken = s.GameMinutes
	out, err := s.callRepairman("tele")
	if err != nil || out.Money != -4000 || s.Money != 6000 {
		t.Fatalf("called: %v %+v money %d", err, out, s.Money)
	}
	if _, err := s.callRepairman("tele"); err != errProComing {
		t.Fatalf("called twice: %v", err)
	}
	if err := s.objBlocks("reparer-tele", HomePlaceID); err != errProComing {
		t.Fatal("the repairman's on it")
	}
	s.lifeSync()
	if !s.broken("tele") {
		t.Fatal("not yet")
	}
	s.GameMinutes += game.RepairmanMinutes
	s.lifeSync()
	if s.broken("tele") || len(s.pending) != 1 || s.Life.Objects["tele"].Fixed != 1 {
		t.Fatalf("done: %+v %v", s.Life.Objects["tele"], s.pending)
	}
	// Not enough money.
	s.objState("frigo").Broken = s.GameMinutes
	s.Money = 100
	if _, err := s.callRepairman("frigo"); err != game.ErrNotEnoughMoney {
		t.Errorf("broke: %v", err)
	}
	// The finer the piece, the dearer.
	if game.RepairmanCost(450000) <= game.RepairmanCost(45000) {
		t.Error("the giant screen costs more to mend")
	}
}

// The whole way: a broken TV refuses the evening in front of it, through the house's actions.
func TestObjectsInteract(t *testing.T) {
	s := workSim(t)
	s.Career = ""
	s.objState("tele").Broken = s.GameMinutes
	if _, err := s.interactAt(HomePlaceID, "watch-tv"); err == nil {
		t.Fatal("watched a broken TV")
	}
	if _, err := s.interactAt(HomePlaceID, "reparer-tele"); err != nil {
		t.Fatalf("mending it: %v", err)
	}
	s.Life.Skills = map[string]int{"bricolage": game.SkillXP(10)}
	s.advanceTo(s.Activity.End, rand.New(rand.NewPCG(2, 2)))
	if s.broken("tele") {
		t.Fatal("bricolage 10: mended")
	}
	if _, err := s.interactAt(HomePlaceID, "watch-tv"); err != nil {
		t.Fatalf("the TV again: %v", err)
	}
}
