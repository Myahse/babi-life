package sims

import (
	"context"
	"errors"
	"testing"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// Against a database (TEST_DATABASE_URL), the update open: a teenager sits the BEPC then the bac (its série
// kept); an adult with a bac from before the séries enrols at the UFHB on the spot, its classes counted
// three a day, its partiels validating the semesters (the réinscription charged each year, owed when it
// can't be paid), down to the Licence: its paper in the wallet, the career it opens, the start it gives.
func TestEtudesDB(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	old := features.Default
	features.Default = &features.Store{DB: pool}
	t.Cleanup(func() { features.Default = old })
	for _, k := range []string{game.PapersKey, game.EtudesKey} {
		if err := features.Default.Set(ctx, k, true, nil); err != nil {
			t.Fatal(err)
		}
	}
	load := func(id string) *Sim {
		s, err := scanSim(pool.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1`, id))
		if err != nil {
			t.Fatal(err)
		}
		return &s
	}
	do := func(s *Sim, id, place string, score int) []Event {
		return s.etudesFinish(&game.Activity{Kind: "do", Interaction: game.Interaction{ID: id}, PlaceID: place, PlaceName: place, End: s.GameMinutes, Defi: score})
	}

	// The teenager, 15, at the Lycée classique d'Abidjan.
	teen := replySim(t, pool, "Aya")
	if _, err := pool.Exec(ctx, `UPDATE sims SET born_at = game_minutes - $2, family = 'poignon' WHERE id = $1`, teen, game.MinutesToAge(15)); err != nil {
		t.Fatal(err)
	}
	s := load(teen)
	lycee := "lycee-classique-abidjan"
	if _, err := s.etudesTweak(lycee, game.Interaction{ID: game.BacCID}); !errors.Is(err, game.ErrEtudesNoBEPC) {
		t.Errorf("bac before the BEPC: %v", err)
	}
	if _, err := s.etudesTweak(lycee, game.Interaction{ID: game.DortoirID}); !errors.Is(err, errInternatOnly) {
		t.Errorf("dortoir for a day pupil: %v", err)
	}
	if _, _, err := s.etudesAct("internat", lycee, "", ""); err != nil || !s.Life.Etudes.Internat {
		t.Fatalf("internat: %v", err)
	}
	if _, err := s.etudesTweak(lycee, game.Interaction{ID: game.DortoirID}); err != nil {
		t.Errorf("dortoir for a boarder: %v", err)
	}
	if it, err := s.etudesTweak(lycee, game.Interaction{ID: game.BEPCID}); err != nil || it.Cost != 0 {
		t.Fatalf("BEPC at 15: %v %+v", err, it)
	}
	if evs := do(s, game.BEPCID, lycee, 20); s.Life.Etudes.BEPC != nil || len(evs) != 1 {
		t.Fatalf("BEPC failed with 20: %v", evs)
	}
	do(s, game.BEPCID, lycee, 70)
	if s.Life.Etudes.BEPC == nil || s.Life.Etudes.BEPCTries != 2 {
		t.Fatalf("BEPC: %+v", s.Life.Etudes)
	}
	if _, err := s.etudesTweak(lycee, game.Interaction{ID: game.BacCID}); err == nil {
		t.Error("bac at 15")
	}
	s.BornAt -= game.MinutesToAge(16) - game.MinutesToAge(15)
	if _, err := s.etudesTweak(lycee, game.Interaction{ID: game.BacCID}); err != nil {
		t.Fatalf("bac at 16: %v", err)
	}
	money := s.Money
	do(s, game.BacCID, lycee, 80)
	if b := s.Life.Etudes.BAC; b == nil || b.Serie != game.SerieC || s.Money != money+s.family().BacGift {
		t.Fatalf("bac C: %+v money %d", b, s.Money-money)
	}

	// The adult with a bac from before (in its papers): the UFHB, a Licence de droit.
	id := replySim(t, pool, "Awa")
	if _, err := pool.Exec(ctx, `UPDATE sims SET born_at = game_minutes - $2, money = 100000, family = 'poignon' WHERE id = $1`, id, game.MinutesToAge(20)); err != nil {
		t.Fatal(err)
	}
	s = load(id)
	if _, _, err := s.etudesAct("inscription", "cocody-universite", game.DegreeLicence, "droit"); !errors.Is(err, game.ErrEtudesNoBac) {
		t.Errorf("enrolled without a bac: %v", err)
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	if _, err := issuePapers(ctx, tx, s, []paperIssue{{kind: game.DocBAC, data: map[string]any{"marks": 12}}}); err != nil {
		t.Fatal(err)
	}
	if err := importLegacy(ctx, tx, s); err != nil || bacSerie(s.Life.Etudes) != "*" {
		t.Fatalf("legacy bac: %v %+v", err, s.Life.Etudes)
	}
	if _, _, err := s.etudesAct("inscription", "bouake-universite", game.DegreeLicence, "droit"); !errors.Is(err, errEtudesGoThere) {
		t.Errorf("enrolled from afar: %v", err)
	}
	if _, _, err := s.etudesAct("inscription", "cocody-universite", game.DegreeLicence, "droit"); err != nil {
		t.Fatal(err)
	}
	c := s.Life.Etudes.Cursus
	if c == nil || s.Money != 100000-game.PublicFee || c.Semestres != 6 {
		t.Fatalf("enrolled: %+v money %d", c, s.Money)
	}
	ufhb := "cocody-universite"
	if _, err := s.etudesTweak(ufhb, game.Interaction{ID: game.PartielID}); err == nil {
		t.Error("partiel without the classes")
	}
	day := (s.GameMinutes/(24*60) + 1) * 24 * 60
	semester := func(n int) {
		for i := 0; i < game.SemesterCours; i++ {
			s.GameMinutes = day + int64(i/game.CoursPerDay)*24*60 + int64(i%game.CoursPerDay)
			do(s, game.AmphiID, ufhb, 0)
		}
		day += 3 * 24 * 60
		it, err := s.etudesTweak(ufhb, game.Interaction{ID: game.PartielID})
		if err != nil || it.Variant != "droit" {
			t.Fatalf("semester %d partiel: %v %+v", n, err, it)
		}
		do(s, game.PartielID, ufhb, 85)
	}
	// A fourth class the same day doesn't count.
	s.GameMinutes = day
	for i := 0; i < 4; i++ {
		do(s, game.AmphiID, ufhb, 0)
	}
	if c.Cours != game.CoursPerDay {
		t.Fatalf("classes the same day: %d", c.Cours)
	}
	c.Cours = 0
	day += 24 * 60
	semester(1)
	semester(2)
	if c.Semestre != 3 || s.Money != 100000-2*game.PublicFee {
		t.Fatalf("after a year: S%d money %d", c.Semestre, s.Money)
	}
	semester(3)
	// Broke when the third year begins: the réinscription is owed, the classes wait for it.
	s.Money = 0
	semester(4)
	if c.Semestre != 5 || c.Due != game.PublicFee {
		t.Fatalf("S%d due %d", c.Semestre, c.Due)
	}
	if _, err := s.etudesTweak(ufhb, game.Interaction{ID: game.AmphiID}); !errors.Is(err, game.ErrEtudesDue) {
		t.Errorf("classes with the fee owed: %v", err)
	}
	if _, _, err := s.etudesAct("reinscription", "", "", ""); !errors.Is(err, game.ErrNotEnoughMoney) {
		t.Errorf("réinscription broke: %v", err)
	}
	s.Money = game.PublicFee
	if _, _, err := s.etudesAct("reinscription", "", "", ""); err != nil || c.Due != 0 || s.Money != 0 {
		t.Fatalf("réinscription: %v", err)
	}
	semester(5)
	semester(6)
	e := s.Life.Etudes
	if e.Cursus != nil || !game.Has(e.Diplomes, game.DegreeLicence, "droit") {
		t.Fatalf("no Licence: %+v", e)
	}
	// Its paper.
	if _, err := syncPapers(ctx, tx, s); err != nil {
		t.Fatal(err)
	}
	var data map[string]any
	if err := tx.QueryRow(ctx, `SELECT data FROM documents WHERE sim_id = $1 AND kind = $2 AND ref = 'licence:droit'`, id, game.DocDiplome).Scan(&data); err != nil || data["diploma"] != "Licence de droit" {
		t.Fatalf("diploma paper: %v %v", err, data)
	}
	// The careers: a Licence opens the teacher's rung and starts the career there; not the avocat's.
	if s.careerStart("enseignement") != 1 || s.careerStart("droit") != 0 {
		t.Error("start levels")
	}
	s.Career, s.CareerLevel = "droit", 0
	c2, _ := game.FindCareer("droit")
	if _, held := s.promotionGate(c2); !held {
		t.Error("avocat without a Master")
	}
	s.Performance = game.NeededToPromote(0) - 1
	if promo := s.work(c2, 100); promo != "" || s.CareerLevel != 0 || len(s.pending) != 1 {
		t.Errorf("promoted without the diploma: %q %v", promo, s.pending)
	}
	// Grandfathered: an avocat already goes on climbing.
	s.CareerLevel, s.Performance = 1, game.NeededToPromote(1)
	if promo := s.work(c2, 100); promo == "" || s.CareerLevel != 2 {
		t.Errorf("grandfathered avocat held: %q", promo)
	}
	// Then the Master, after the Licence.
	s.Money = 100000
	if _, _, err := s.etudesAct("inscription", ufhb, game.DegreeMaster, "droit"); err != nil || s.Money != 100000-game.PublicFee2 {
		t.Fatalf("Master: %v", err)
	}
}

// With the update shut, nothing changes: no gate, no start, the old bac at 18.
func TestEtudesClosed(t *testing.T) {
	old := features.Default
	features.Default = nil
	t.Cleanup(func() { features.Default = old })
	s := &Sim{Life: Life{Etudes: &game.Etudes{}}}
	c, _ := game.FindCareer("droit")
	if _, held := s.promotionGate(c); held || s.careerStart("droit") != 0 {
		t.Error("the update shut asks for diplomas")
	}
	if it, err := s.etudesTweak("cocody-universite", game.Interaction{ID: game.PartielID}); err != nil || it.Variant != "" {
		t.Errorf("partiel changed while shut: %v", err)
	}
}
