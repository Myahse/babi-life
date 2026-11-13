package sims

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// The parents' names on the papers are the same every time, the father's name the Sim's.
func TestParentNames(t *testing.T) {
	f1, m1 := game.ParentNames("abc", "Kouadio")
	f2, m2 := game.ParentNames("abc", "Kouadio")
	if f1 != f2 || m1 != m2 || !strings.HasSuffix(f1, " Kouadio") || m1 == "" {
		t.Fatalf("parents: %q %q / %q %q", f1, m1, f2, m2)
	}
	if game.Employer("abc", "bureau") != game.Employer("abc", "bureau") || game.Employer("abc", "inconnu") == "" {
		t.Fatal("employer")
	}
	if p := plate(123); !regexp.MustCompile(`^BL 0123 [A-Z]{2}$`).MatchString(p) {
		t.Fatalf("plate %q", p)
	}
}

// Against a database (TEST_DATABASE_URL): the extrait and the contract come by themselves, the
// carte grise with a moto; the permis needs the card; the card can't be asked twice while valid;
// the roadblock warns, then fines; a job left marks its contract ended; the legalisation marks them.
func TestPapersDB(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	old := features.Default
	features.Default = &features.Store{DB: pool}
	t.Cleanup(func() { features.Default = old })
	if err := features.Default.Set(ctx, game.PapersKey, true, nil); err != nil {
		t.Fatal(err)
	}
	id := replySim(t, pool, "Awa")
	if _, err := pool.Exec(ctx, `UPDATE sims SET born_at = born_at - $2, career = 'bureau', housing = 'studio', money = 50000 WHERE id = $1`, id, game.MinutesToAge(25)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO vehicles (sim_id, model, color) VALUES ($1, 'moto-baobab', '#c92a2a')`, id); err != nil {
		t.Fatal(err)
	}
	load := func() *Sim {
		s, err := scanSim(pool.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1`, id))
		if err != nil {
			t.Fatal(err)
		}
		return &s
	}
	s := load()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	evs, err := syncPapers(ctx, tx, s)
	if err != nil {
		t.Fatal(err)
	}
	if len(evs) != 3 {
		t.Errorf("new papers said: %v", evs)
	}
	list, err := listPapers(ctx, tx, id)
	if err != nil {
		t.Fatal(err)
	}
	kinds := map[string]Paper{}
	for _, p := range list {
		kinds[p.Kind] = p
		if !regexp.MustCompile(`^BL-\d{4}-\d{6}$`).MatchString(p.Number) {
			t.Errorf("number %q", p.Number)
		}
	}
	for _, k := range []string{game.DocExtrait, game.DocTravail, game.DocBail, game.DocCarteGrise} {
		if _, ok := kinds[k]; !ok {
			t.Errorf("no %s in %v", k, kinds)
		}
	}
	if kinds[game.DocExtrait].Data["father"] == "" {
		t.Error("no father on the extrait")
	}
	// Again: nothing new.
	if evs, _ := syncPapers(ctx, tx, s); len(evs) != 0 {
		t.Errorf("synced twice: %v", evs)
	}
	if err := papersBefore(ctx, tx, s, game.PermisID); !errors.Is(err, errNeedCNI) {
		t.Errorf("the permis without the card: %v", err)
	}
	// The roadblock: a warning, then a fine.
	said, fine, err := papersCheck(ctx, tx, s)
	if err != nil || fine != 0 || !strings.Contains(said, "avertissement") {
		t.Fatalf("first check: %q %d %v", said, fine, err)
	}
	said, fine, err = papersCheck(ctx, tx, s)
	if err != nil || fine != game.PapersFine || s.Money != 50000-game.PapersFine {
		t.Fatalf("second check: %q %d %v", said, fine, err)
	}
	// The card at the mairie, then the permis.
	if _, err := papersAct(ctx, tx, s, "Mairie", game.Interaction{ID: game.CNIMairieID}); err != nil {
		t.Fatal(err)
	}
	if err := papersBefore(ctx, tx, s, game.CNIPoliceID); !errors.Is(err, errCNIStillValid) {
		t.Errorf("the card asked twice: %v", err)
	}
	if err := papersBefore(ctx, tx, s, game.PermisID); err != nil {
		t.Errorf("the permis with the card: %v", err)
	}
	if said, _ := papersPermis(ctx, tx, s, 20); !strings.Contains(said, "Recalé") {
		t.Errorf("failed test: %q", said)
	}
	// Paid and failed: the next try is free; that free try used, the one after is paid again.
	s.Life.PermisRetry = true
	if said, _ := papersPermis(ctx, tx, s, 20); !strings.Contains(said, "gratuit") {
		t.Errorf("failed paid test, no free retry said: %q", said)
	}
	if _, err := papersPermis(ctx, tx, s, 80); err != nil {
		t.Fatal(err)
	}
	if said, fine, _ := papersCheck(ctx, tx, s); fine != 0 || !strings.Contains(said, "Tout est en règle") {
		t.Errorf("all in order: %q %d", said, fine)
	}
	// The job left: its contract ended.
	s.Career = ""
	if _, err := syncPapers(ctx, tx, s); err != nil {
		t.Fatal(err)
	}
	var ended bool
	_ = tx.QueryRow(ctx, `SELECT ended FROM documents WHERE sim_id = $1 AND kind = $2`, id, game.DocTravail).Scan(&ended)
	if !ended {
		t.Error("the contract of a job left isn't ended")
	}
	// The legalisation: the live ones legalised, the attestation made.
	said, err = papersAct(ctx, tx, s, "Mairie", game.Interaction{ID: game.LegalisationID})
	if err != nil || !strings.Contains(said, "légalisé") {
		t.Fatalf("legalisation: %q %v", said, err)
	}
	var n int
	_ = tx.QueryRow(ctx, `SELECT count(*) FROM documents WHERE sim_id = $1 AND legalised`, id).Scan(&n)
	if n < 4 || !hasPaper(ctx, tx, id, game.DocLegalisation) {
		t.Errorf("legalised: %d", n)
	}
}
