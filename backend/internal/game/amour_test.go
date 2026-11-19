package game

import (
	"testing"
	"time"
)

func TestLoveNow(t *testing.T) {
	now := time.Date(2026, 11, 19, 12, 0, 0, 0, time.UTC)
	day := 24 * time.Hour
	if v := LoveNow(80, now.Add(-2*day), now, true); v != 80 {
		t.Errorf("within the grace: %d", v)
	}
	if v := LoveNow(80, now.Add(-5*day), now, true); v != 80-2*LoveFade {
		t.Errorf("two days past the grace: %d", v)
	}
	if v := LoveNow(40, now.Add(-60*day), now, true); v != LoveFloor {
		t.Errorf("a couple's floor: %d", v)
	}
	if v := LoveNow(40, now.Add(-60*day), now, false); v != 0 {
		t.Errorf("no floor out of a couple: %d", v)
	}
	if !Missing(now.Add(-4*day), now) || Missing(now.Add(-3*day), now) || Missing(time.Time{}, now) {
		t.Error("missing")
	}
	if LoveDays(now.Add(-36*time.Hour), now) != 2 || LoveDays(now, now) != 1 {
		t.Error("days together")
	}
}

func TestAnnivDue(t *testing.T) {
	since := time.Date(2026, 1, 10, 9, 0, 0, 0, time.UTC)
	if _, _, ok := AnnivDue(since, 0, since.AddDate(0, 0, 6)); ok {
		t.Fatal("a week not yet")
	}
	i, seen, ok := AnnivDue(since, 0, since.AddDate(0, 0, 8))
	if !ok || i != 0 || seen != 1 {
		t.Fatalf("a week: %d %d %v", i, seen, ok)
	}
	// Said once: not again.
	if _, _, ok := AnnivDue(since, seen, since.AddDate(0, 0, 9)); ok {
		t.Fatal("the week twice")
	}
	// Away four months: only the three months, the month passed over.
	i, seen, ok = AnnivDue(since, 1, since.AddDate(0, 4, 0))
	if !ok || i != 2 || seen != 3 {
		t.Fatalf("away: %d %d %v", i, seen, ok)
	}
	label, at, ok := NextAnniv(since, seen, since.AddDate(0, 4, 0))
	if !ok || label != "1 an ensemble" || !at.Equal(since.AddDate(1, 0, 0)) {
		t.Fatalf("next: %q %v", label, at)
	}
	if _, _, ok := NextAnniv(since, 4, since.AddDate(2, 0, 0)); ok {
		t.Fatal("after the year")
	}
}

func TestScoreDate(t *testing.T) {
	all := []string{ChoiceBlague, ChoiceEcouter, ChoiceMot, ChoiceMot}
	a, err := ScoreDate("rdv-maquis", all, LangServices, false)
	if err != nil || a.Points != 12 || a.Score != 100 || a.Love != 12 {
		t.Fatalf("all best: %+v %v", a, err)
	}
	b, _ := ScoreDate("rdv-maquis", all, LangServices, false)
	if b.Score != a.Score || b.Love != a.Love {
		t.Fatal("not the same for the same answers")
	}
	worst, err := ScoreDate("rdv-maquis", []string{ChoiceEcouter, ChoiceBlague, ChoiceEcouter, ChoiceBlague}, LangServices, false)
	if err != nil || worst.Points != -4 || worst.Score != 1 || worst.Love != 3 {
		t.Fatalf("all wrong: %+v", worst)
	}
	// The love language lifts a plain answer, never a flat one.
	if React(Beat{Best: ChoiceBlague, Bad: ChoiceEcouter}, ChoiceMot, LangMots) != ReactMatch {
		t.Error("their language")
	}
	if React(Beat{Best: ChoiceBlague, Bad: ChoiceMot}, ChoiceMot, LangMots) != ReactWrong {
		t.Error("the flat one stays flat")
	}
	if _, err := ScoreDate("rdv-maquis", all[:3], LangMots, false); err == nil {
		t.Error("three answers")
	}
	if _, err := ScoreDate("rdv-maquis", []string{ChoiceCadeau, ChoiceMot, ChoiceMot, ChoiceMot}, LangMots, false); err != ErrDateGift {
		t.Error("a gift with none in the bag")
	}
	if _, err := ScoreDate("drink-with-friends", all, LangMots, false); err != ErrDateKind {
		t.Error("not a date")
	}
	for id, k := range DateKinds {
		if !IsRdv(id) || k.ID != id || k.Title == "" {
			t.Errorf("date %s", id)
		}
		for _, b := range k.Beats {
			if b.Best == b.Bad || b.Best == "" {
				t.Errorf("%s beat %+v", id, b)
			}
		}
	}
	if LangOf("p-1") != LangOf("p-1") {
		t.Error("love language drawn twice")
	}
	if _, ok := FindMot("manque"); !ok {
		t.Error("mot doux")
	}
	if LoveStageLabel(LoveEnsemble) == "" || LoveStageLabel("x") != "" {
		t.Error("stages")
	}
}
