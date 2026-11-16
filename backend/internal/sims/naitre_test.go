package sims

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// naitreDB: a test database with the update « naitre-adulte » open.
func naitreDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	pool := replyDB(t)
	old := features.Default
	features.Default = &features.Store{DB: pool}
	t.Cleanup(func() { features.Default = old })
	if err := features.Default.Set(context.Background(), game.NaitreKey, true, nil); err != nil {
		t.Fatal(err)
	}
	return pool
}

// naitreLoad: the Sim as mutateWith reads it (with its Pionnier columns), then one naitreTurn in a
// transaction committed.
func naitreLoad(t *testing.T, pool *pgxpool.Pool, id string, fn func(*Sim, pgx.Tx)) (*Sim, []Event) {
	t.Helper()
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	var p pionnierRead
	var user string
	s, err := scanSim(tx.QueryRow(ctx, `SELECT `+simColumns+`, user_id, `+pionnierSQL+` FROM sims WHERE id = $1 FOR UPDATE`, id), &user, &p.djai, &p.seen, &p.paid)
	if err != nil {
		t.Fatal(err)
	}
	ev, err := naitreTurn(ctx, tx, &s, user, p)
	if err != nil {
		t.Fatal(err)
	}
	if fn != nil {
		fn(&s, tx)
	}
	if _, err := tx.Exec(ctx, `UPDATE sims SET born_at = $2, money = $3, family = $4, housing = $5, friends = $6, performance = $7, souvenirs = $8, grown_notice = $9 WHERE id = $1`,
		s.ID, s.BornAt, s.Money, s.Family, s.Housing, friendsOrEmpty(s.Friends), s.Performance, s.Souvenirs, s.GrownNotice); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	return &s, ev
}

func papersOf(s *Sim) []string {
	var out []string
	for _, p := range s.papers {
		out = append(out, p.kind)
	}
	return out
}

// Against a database (TEST_DATABASE_URL): every minor is made an adult on its next load, once, through the
// coming of age (its marks giving the diplomas, its friend from childhood kept); a Sim answering its
// souvenirs isn't touched.
func TestNaitreAgesMinors(t *testing.T) {
	pool := naitreDB(t)
	ctx := context.Background()
	f, _ := game.FindFamily("poignon")
	for _, c := range []struct {
		name  string
		stage string
		marks int
		bac   bool
		bepc  bool
	}{
		{"Bebe", game.StageBebe, 0, false, false},
		{"Enfant", game.StageEnfant, 12, false, true},
		{"Ado", game.StageAdo, game.BacMarks + 3, true, true},
	} {
		t.Run(c.stage, func(t *testing.T) {
			id := replySim(t, pool, c.name)
			friends := []game.Friend{{ID: "p-enfance-x", Name: "Koffi", Childhood: true, Friendship: 60}}
			at := game.MinutesToAge(float64(game.StageByID(c.stage).From)) + 5
			if _, err := pool.Exec(ctx, `UPDATE sims SET born_at = game_minutes - $2, family = 'poignon', housing = 'appart', performance = $3, friends = $4, money = 100 WHERE id = $1`, id, at, c.marks, friends); err != nil {
				t.Fatal(err)
			}
			s, ev := naitreLoad(t, pool, id, nil)
			if s.minor() || s.stage().ID != game.StageAdulte || s.GrownNotice != "due" || len(ev) == 0 {
				t.Fatalf("not made an adult: %s %d %q %v", s.stage().ID, s.age(), s.GrownNotice, ev)
			}
			if s.Housing != f.Leave {
				t.Errorf("housing %s, want %s", s.Housing, f.Leave)
			}
			want := 100 + f.Start
			if c.bac {
				want += f.BacGift
			}
			if s.Money < want {
				t.Errorf("money %d, want at least %d", s.Money, want)
			}
			papers := papersOf(s)
			if slices.Contains(papers, game.DocBAC) != c.bac || slices.Contains(papers, game.DocBEPC) != c.bepc {
				t.Errorf("papers %v (bac %v, bepc %v)", papers, c.bac, c.bepc)
			}
			fr := s.childhoodFriend()
			if fr == nil || !fr.Adult || fr.Friendship != 70 {
				t.Errorf("the friend from childhood: %+v", fr)
			}
			// Loaded again: nothing more (the notice stays until it's seen).
			s, ev = naitreLoad(t, pool, id, nil)
			if len(ev) != 0 || s.GrownNotice != "due" {
				t.Errorf("made an adult twice: %v", ev)
			}
		})
	}

	// A new Sim answering its souvenirs is left a baby until it answers.
	id := replySim(t, pool, "Nouveau")
	if _, err := pool.Exec(ctx, `UPDATE sims SET born_at = game_minutes - 5, family = 'gnambro', souvenirs = 'due' WHERE id = $1`, id); err != nil {
		t.Fatal(err)
	}
	s, ev := naitreLoad(t, pool, id, nil)
	if !s.minor() || len(ev) != 0 || s.GrownNotice != "" {
		t.Fatalf("a Sim answering its souvenirs was aged: %v", ev)
	}

	// Its answers: the village (a language), the bac, the second friend, the ball; then 18.
	s, _ = naitreLoad(t, pool, id, func(s *Sim, tx pgx.Tx) {
		start := s.Money
		ev, err := s.applySouvenirs(ctx, tx, souvenirsRequest{Grew: game.GrewVillage, Language: "baoule", School: game.SchoolBac, Friend: 1, Talent: "ballon"})
		if err != nil {
			t.Fatal(err)
		}
		if s.minor() || s.Souvenirs != "done" || len(ev) < 3 {
			t.Fatalf("souvenirs: %s %q %v", s.stage().ID, s.Souvenirs, ev)
		}
		if !slices.Contains(s.Languages, "baoule") || !slices.Contains(s.Traits, "sportif") {
			t.Errorf("language %v, traits %v", s.Languages, s.Traits)
		}
		if !slices.Contains(papersOf(s), game.DocBAC) {
			t.Errorf("no bac: %v", papersOf(s))
		}
		fam := s.family()
		if s.Money != start+fam.Start+fam.BacGift+game.VillageSavings {
			t.Errorf("money %d, want %d", s.Money-start, fam.Start+fam.BacGift+game.VillageSavings)
		}
		fr := s.childhoodFriend()
		if fr == nil || fr.Name != game.FriendChoices(s.ID, s.HomeCommune, 0)[1].Name || !fr.Adult {
			t.Errorf("friend %+v", fr)
		}
		if _, err := s.applySouvenirs(ctx, tx, souvenirsRequest{Grew: game.GrewCour, School: game.SchoolCM2, Friend: -1}); !errors.Is(err, errNoSouvenirs) {
			t.Errorf("answered twice: %v", err)
		}
	})
	if s.Souvenirs != "done" {
		t.Fatal("not saved")
	}
}

// Against a database: an account that paid « grandir vite » (credited, not a test, not refunded) is thanked
// once as a Pionnier, its flag for the quartier kept; its other Sim isn't paid again.
func TestNaitrePionnier(t *testing.T) {
	pool := naitreDB(t)
	ctx := context.Background()
	id := replySim(t, pool, "Pion")
	var user string
	if err := pool.QueryRow(ctx, `UPDATE sims SET money = 1000, born_at = born_at - $2 WHERE id = $1 RETURNING user_id`, id, game.MinutesToAge(25)).Scan(&user); err != nil {
		t.Fatal(err)
	}
	for i, p := range []struct {
		price    int
		status   string
		credited bool
		sandbox  bool
	}{
		{2000, "completed", true, false},
		{3000, "completed", true, false},
		{5000, "completed", true, true},
		{1000, "refunded", true, false},
		{2000, "pending", false, false},
	} {
		if _, err := pool.Exec(ctx, `INSERT INTO purchases (user_id, sim_id, kind, item, pack, price, djai, reference, status, credited_at, sandbox)
			VALUES ($1, $2, 'grandir', 'grandir-adulte', 'grandir-adulte', $3, 0, $4, $5, CASE WHEN $6 THEN now() END, $7)`, user, id, p.price, "ref-pion-"+string(rune('a'+i)), p.status, p.credited, p.sandbox); err != nil {
			t.Fatal(err)
		}
	}
	s, ev := naitreLoad(t, pool, id, nil)
	djai := game.PionnierDjai(5000)
	if s.Pionnier == nil || s.Pionnier.Djai != djai || s.Money != 1000+djai || len(ev) != 1 {
		t.Fatalf("pionnier %+v, money %d, %v", s.Pionnier, s.Money, ev)
	}
	var paid int
	var flag bool
	if err := pool.QueryRow(ctx, `SELECT paid, pionnier_quartier_niveau2 FROM pionniers WHERE user_id = $1`, user).Scan(&paid, &flag); err != nil || paid != 5000 || !flag {
		t.Fatalf("row: %d %v %v", paid, flag, err)
	}
	var simFlag bool
	if err := pool.QueryRow(ctx, `SELECT pionnier FROM sims WHERE id = $1`, id).Scan(&simFlag); err != nil || !simFlag {
		t.Fatalf("sims.pionnier: %v %v", simFlag, err)
	}
	s, ev = naitreLoad(t, pool, id, nil)
	if s.Money != 1000+djai || len(ev) != 0 || s.Pionnier == nil || s.Pionnier.Seen {
		t.Fatalf("thanked twice: %d %v", s.Money, ev)
	}
	// Another Sim of the same account: a Pionnier too, not paid again.
	var other string
	if err := pool.QueryRow(ctx, `INSERT INTO sims (user_id, first_name, last_name, gender, look, traits, aspiration, home_city, home_commune, city, commune, money, needs, game_minutes, origin, housing, loan, born_at, family, apps)
		SELECT user_id, 'Deux', 'Test', 'femme', '{}', '{}', '', 'abidjan', 'cocody', 'abidjan', 'cocody', 0, needs, game_minutes, '', '', 0, 0, '', '{}' FROM sims WHERE id = $1 RETURNING id`, id).Scan(&other); err != nil {
		t.Fatal(err)
	}
	s2, ev := naitreLoad(t, pool, other, nil)
	if s2.Money != 0 || len(ev) != 0 || s2.Pionnier == nil {
		t.Fatalf("the other Sim: %d %v %+v", s2.Money, ev, s2.Pionnier)
	}
	// The pin: a Pionnier's only.
	nl := s2.Look
	nl.Accessory = game.PionnierAccessory
	if err := nl.validate(s2.Gender); err != nil {
		t.Fatalf("the pin refused by the look: %v", err)
	}
	s2.Pionnier = nil
	if _, err := s2.changeLook(nl); err == nil {
		t.Error("the pin worn by someone else")
	}
}
