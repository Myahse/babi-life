package sims

import (
	"context"
	"errors"
	"testing"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Against a database (TEST_DATABASE_URL), « examens-avant-travail »: shut, nothing changes; open, a
// working adult with the old BEPC and bac (given at 18) keeps its post and rung but can't work (no shift,
// no task, no pay, no hire elsewhere); it sits the BEPC « en candidat libre » (the bac waits for it), then
// the bac, and works again at the same rung. A small trade works with the BEPC alone; a teenager's BEPC
// passed with the update open counts.
func TestTravailExamensDB(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	old := features.Default
	features.Default = &features.Store{DB: pool}
	t.Cleanup(func() { features.Default = old })
	set := func(k string, open bool) {
		t.Helper()
		if err := features.Default.Set(ctx, k, open, nil); err != nil {
			t.Fatal(err)
		}
	}
	set(game.PapersKey, true)
	set(game.EtudesKey, true)
	load := func(id string) *Sim {
		t.Helper()
		s, err := scanSim(pool.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1`, id))
		if err != nil {
			t.Fatal(err)
		}
		return &s
	}
	lycee := "lycee-classique-abidjan"
	// An exam sat and handed in with this share of right answers.
	sit := func(s *Sim, id string, score int) []Event {
		t.Helper()
		it, err := s.etudesTweak(lycee, game.Interaction{ID: id})
		if err != nil {
			t.Fatalf("%s: %v", id, err)
		}
		a := &game.Activity{Kind: "do", Interaction: it, PlaceID: lycee, PlaceName: "Lycée classique", End: s.GameMinutes}
		a.Copie = copieAt(game.PlanOf(id, it.Variant), score)
		return s.etudesFinish(a)
	}
	// A whole shift of the Sim's career, done.
	shift := func(s *Sim) *game.Activity {
		c, _ := game.FindCareer(s.Career)
		return &game.Activity{Kind: "do", Career: c.ID, Interaction: c.Shift(s.CareerLevel), Applied: 1, End: s.GameMinutes}
	}
	_, cm, _ := world.FindCommune("abidjan", "cocody")
	office := ""
	for _, p := range cm.Places {
		if p.Kind == "office" {
			office = p.ID
			break
		}
	}
	if office == "" {
		t.Fatal("no office in Cocody")
	}

	// The adult at the office, chef de service, with the BEPC and the bac given at 18.
	id := replySim(t, pool, "Awa")
	if _, err := pool.Exec(ctx, `UPDATE sims SET born_at = game_minutes - $2, career = 'bureau', career_level = 2, performance = 7, money = 50000 WHERE id = $1`, id, game.MinutesToAge(30)); err != nil {
		t.Fatal(err)
	}
	s := load(id)
	e := s.etudes()
	e.BEPC, e.BAC = &game.Exam{Note: 12}, &game.Exam{Note: 11}

	// Shut: as it always was.
	if err := s.workBlock("bureau"); err != nil {
		t.Fatalf("shut: %v", err)
	}
	if _, err := s.etudesTweak(lycee, game.Interaction{ID: game.BEPCID}); !errors.Is(err, game.ErrEtudesHasBEPC) {
		t.Errorf("shut, BEPC again: %v", err)
	}
	if would, _ := s.pay(shift(s)); would <= 0 {
		t.Errorf("shut, shift unpaid: %d", would)
	}

	set(game.ExamensKey, true)
	// Open: the post waits; nothing of work goes through.
	if err := s.workBlock("bureau"); err != game.ErrExamsBEPCBacPost {
		t.Fatalf("open, old diplomas: %v", err)
	}
	if _, err := s.interactAt(office, game.WorkInteractionID); err != game.ErrExamsBEPCBacPost {
		t.Errorf("open, shift started: %v", err)
	}
	if err := s.goWork(); err != game.ErrExamsBEPCBacPost {
		t.Errorf("open, off to work: %v", err)
	}
	if would, got := s.pay(shift(s)); would != 0 || got != 0 {
		t.Errorf("open, shift paid %d/%d", would, got)
	}
	s.Activity = shift(s)
	s.Activity.End = s.GameMinutes + 60
	if _, err := s.jobTask("x", 80, newRand()); err != game.ErrExamsBEPCBacPost {
		t.Errorf("open, a task: %v", err)
	}
	s.Activity = nil
	// Nor hired elsewhere: a small trade asks the BEPC, the rest both.
	if err := s.workBlock("commerce"); err != game.ErrExamsBEPC {
		t.Errorf("open, commerce: %v", err)
	}
	if err := s.workBlock(game.ArmeeCareer); err != game.ErrExamsBEPCBac {
		t.Errorf("open, armee: %v", err)
	}
	// The bac waits for the BEPC retaken; the BEPC opens again, paid « en candidat libre ».
	if _, err := s.etudesTweak(lycee, game.Interaction{ID: game.BacCID}); !errors.Is(err, game.ErrEtudesNoBEPC) {
		t.Errorf("bac before the BEPC retaken: %v", err)
	}
	if it, err := s.etudesTweak(lycee, game.Interaction{ID: game.BEPCID}); err != nil || it.Cost != game.BEPCFee {
		t.Fatalf("BEPC retaken: %v %+v", err, it)
	}
	sit(s, game.BEPCID, 80)
	if e.ReBEPC == nil || e.BEPC.Note != 12 || e.BEPC.On != 0 {
		t.Fatalf("BEPC retaken: re %+v old %+v", e.ReBEPC, e.BEPC)
	}
	if err := s.workBlock("bureau"); err != game.ErrExamsBacPost {
		t.Errorf("BEPC only: %v", err)
	}
	if err := s.workBlock("commerce"); err != nil {
		t.Errorf("BEPC only, a small trade: %v", err)
	}
	money := s.Money
	evs := sit(s, game.BacCID, 80)
	if e.ReBAC == nil || e.BAC.Note != 11 || s.Money != money {
		t.Fatalf("bac retaken: re %+v old %+v, money %d → %d (no second gift)", e.ReBAC, e.BAC, money, s.Money)
	}
	if len(evs) != 1 || s.examSaid == "" {
		t.Errorf("bac retaken said: %v", evs)
	}
	// Back at work, where it was.
	if err := s.workBlock("bureau"); err != nil {
		t.Fatalf("both retaken: %v", err)
	}
	if s.Career != "bureau" || s.CareerLevel != 2 || s.Performance != 7 {
		t.Errorf("post changed: %s %d %d", s.Career, s.CareerLevel, s.Performance)
	}
	if would, _ := s.pay(shift(s)); would <= 0 {
		t.Errorf("both retaken, shift unpaid: %d", would)
	}

	// A small trade (the market) with the BEPC alone.
	id2 := replySim(t, pool, "Mariam")
	if _, err := pool.Exec(ctx, `UPDATE sims SET born_at = game_minutes - $2, career = 'commerce', career_level = 1, money = 50000 WHERE id = $1`, id2, game.MinutesToAge(25)); err != nil {
		t.Fatal(err)
	}
	m := load(id2)
	if err := m.workBlock("commerce"); err != game.ErrExamsBEPCPost {
		t.Fatalf("market, nothing retaken: %v", err)
	}
	sit(m, game.BEPCID, 80)
	if err := m.workBlock("commerce"); err != nil || m.CareerLevel != 1 {
		t.Errorf("market with the BEPC: %v (rung %d)", err, m.CareerLevel)
	}
	if would, _ := m.pay(shift(m)); would <= 0 {
		t.Errorf("market with the BEPC, unpaid: %d", would)
	}

	// A teenager at the lycée: its BEPC passed with the update open counts.
	id3 := replySim(t, pool, "Yao")
	if _, err := pool.Exec(ctx, `UPDATE sims SET born_at = game_minutes - $2, family = 'poignon' WHERE id = $1`, id3, game.MinutesToAge(15)); err != nil {
		t.Fatal(err)
	}
	teen := load(id3)
	sit(teen, game.BEPCID, 80)
	if te := teen.Life.Etudes; te.BEPC == nil || te.ReBEPC == nil {
		t.Errorf("teen's BEPC: %+v", te)
	}

	// Shut again: the old diplomas are enough once more.
	set(game.ExamensKey, false)
	m2 := load(id2)
	if err := m2.workBlock("commerce"); err != nil {
		t.Errorf("shut again: %v", err)
	}
}
