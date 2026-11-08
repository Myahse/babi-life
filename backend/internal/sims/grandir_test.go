package sims

import (
	"context"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// The baby and the child wait at the edge of their stage however long they play, the app told where
// (GrowHold); the teenager becomes an adult with the time played.
func TestHoldChildhood(t *testing.T) {
	baby := func() *Sim {
		s := newSimPtr()
		s.BornAt = s.GameMinutes - 1
		return s
	}
	s := baby()
	var said []Event
	for range 10 {
		said = append(said, s.advanceTo(s.GameMinutes+game.MinutesToAge(3), newRand())...)
	}
	if s.stage().ID != game.StageBebe || s.age() != 2 {
		t.Fatalf("the baby grew up with the time: %s %d", s.stage().ID, s.age())
	}
	if slices.ContainsFunc(said, func(e Event) bool { return strings.Contains(e.Text, "3 ans") }) {
		t.Fatalf("a birthday said while held: %v", said)
	}
	if h := s.growHold(context.Background()); h != game.MinutesToAge(3)-1 || s.GameMinutes-s.BornAt != h {
		t.Fatalf("the hold: %d, at %d", h, s.GameMinutes-s.BornAt)
	}
	// The child: up to just before 12.
	s.ageTo(game.StageByID(game.StageEnfant))
	s.advanceTo(s.GameMinutes+3*game.MinutesToAge(12), newRand())
	if s.stage().ID != game.StageEnfant || s.age() != 11 {
		t.Fatalf("the child grew up with the time: %s %d", s.stage().ID, s.age())
	}
	// The teenager: an adult with the time (an hour of play).
	s.ageTo(game.StageByID(game.StageAdo))
	if s.growHold(context.Background()) != 0 {
		t.Fatal("a teenager held")
	}
	s.advanceTo(s.GameMinutes+game.MinutesToAge(game.AdultAge), newRand())
	if s.stage().ID != game.StageAdulte {
		t.Fatalf("the teenager didn't grow up: %s", s.stage().ID)
	}
	// The shop's « tout de suite » still skips the milestones.
	s = baby()
	s.growing = game.StageAdo
	s.grow()
	if s.stage().ID != game.StageAdo {
		t.Fatalf("the shop didn't skip: %s", s.stage().ID)
	}
}

// What brings the étapes: the interactions started, the homework done; only a child's.
func TestReachSteps(t *testing.T) {
	s := newSimPtr()
	s.BornAt = s.GameMinutes - 1
	s.reachBy("jouer-cour")
	if len(s.reached) != 0 {
		t.Fatal("a baby reached a child's étape")
	}
	s.ageTo(game.StageByID(game.StageEnfant))
	for _, id := range []string{"aller-ecole", "jouer-cour", "aider-maison", "watch-tv", "play-basket"} {
		s.reachBy(id)
	}
	if want := []string{"ecole", "sport", "aider"}; !slices.Equal(s.reached, want) {
		t.Fatalf("reached %v, want %v", s.reached, want)
	}
	for _, st := range Steps {
		if st.How == "" || st.Where == "" || st.Line == "" {
			t.Errorf("%s: how, where and what's said are needed", st.ID)
		}
	}
	for _, f := range Firsts {
		if f.Where == "" {
			t.Errorf("%s: where is it done?", f.ID)
		}
	}
}

// Against a database (TEST_DATABASE_URL): the baby becomes a child on the server when its premières fois
// are done (those it can do), the child a teenager when its étapes are; nobody grows younger.
func TestGrowByMilestones(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	old := features.Default
	features.Default = &features.Store{DB: pool}
	t.Cleanup(func() { features.Default = old })
	id := replySim(t, pool, "Awa")
	s := &Sim{ID: id, FirstName: "Awa", Needs: game.FreshNeeds(), Family: "poignon", GameMinutes: game.MinuteOf(time.Now())}
	s.BornAt = s.GameMinutes - 10

	turn := func() []Event {
		t.Helper()
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		ev, err := settleGrowth(ctx, tx, s)
		if err != nil {
			t.Fatal(err)
		}
		if err := tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		return ev
	}
	first := func(f First) {
		t.Helper()
		tx, _ := pool.Begin(ctx)
		markFirst(ctx, tx, s, f, "")
		_ = tx.Commit(ctx)
	}
	said := func(ev []Event, part string) bool {
		return slices.ContainsFunc(ev, func(e Event) bool { return strings.Contains(e.Text, part) })
	}

	// The baby who did all its premières fois is a child on its next turn.
	for _, f := range Firsts {
		first(f)
	}
	ev := turn()
	if s.stage().ID != game.StageEnfant || !said(ev, "Toutes ses premières fois") || !said(ev, "3 ans") {
		t.Fatalf("not a child: %s %v", s.stage().ID, ev)
	}

	// A new baby: one première fois left, a baby still; the last one, a child.
	_, _ = pool.Exec(ctx, `DELETE FROM sim_firsts WHERE sim_id = $1`, id)
	s.BornAt = s.GameMinutes - 10
	due := firstsDue(ctx)
	if len(due) == 0 || len(due) > len(Firsts) {
		t.Fatalf("the premières fois asked for: %d", len(due))
	}
	for _, f := range due[:len(due)-1] {
		first(f)
	}
	if turn(); s.stage().ID != game.StageBebe {
		t.Fatal("a child with a première fois left")
	}
	first(due[len(due)-1])
	if turn(); s.stage().ID != game.StageEnfant {
		t.Fatal("not a child once all done")
	}

	// The child: its étapes one by one, said once each; the birthday comes with the time.
	for _, st := range []string{"ecole", "note", "sport", "aider"} {
		s.reach(st)
	}
	ev = turn()
	if !said(ev, "Premier jour d'école") || s.stage().ID != game.StageEnfant {
		t.Fatalf("the étapes: %s %v", s.stage().ID, ev)
	}
	s.reach("ecole")
	if ev := turn(); len(ev) != 0 {
		t.Fatalf("an étape said twice: %v", ev)
	}
	s.Friends = []game.Friend{{ID: "f", Name: "Koffi", Childhood: true}}
	turn()
	if s.stage().ID != game.StageEnfant {
		t.Fatal("a teenager without the birthday")
	}
	s.BornAt = s.GameMinutes - game.MinutesToAge(stepAge) - 1
	ev = turn()
	if s.stage().ID != game.StageAdo || !said(ev, "Toutes les étapes d'enfant") || !slices.Contains(s.Apps, "waye") {
		t.Fatalf("not a teenager: %s %v", s.stage().ID, ev)
	}
	// A teenager: nothing more of it.
	if ev := turn(); len(ev) != 0 || s.stage().ID != game.StageAdo {
		t.Fatalf("a teenager touched: %v", ev)
	}

	// A child aged 8, its étapes all done in one turn: a teenager at once, never younger.
	_, _ = pool.Exec(ctx, `DELETE FROM sim_steps WHERE sim_id = $1`, id)
	s.ageTo(game.StageByID(game.StageEnfant))
	s.BornAt = s.GameMinutes - game.MinutesToAge(8)
	for _, st := range Steps {
		s.reach(st.ID)
	}
	if turn(); s.stage().ID != game.StageAdo || s.age() < 12 {
		t.Fatalf("not a teenager: %s %d", s.stage().ID, s.age())
	}
}
