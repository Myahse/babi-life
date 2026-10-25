package game

import (
	"slices"
	"strings"
	"testing"
)

func TestLevels(t *testing.T) {
	for _, c := range []struct{ xp, level, into int }{{0, 1, 0}, {99, 1, 99}, {100, 2, 0}, {239, 2, 139}, {240, 3, 0}} {
		if l, in, _ := LevelOf(c.xp); l != c.level || in != c.into {
			t.Errorf("%d XP: level %d (+%d), want %d (+%d)", c.xp, l, in, c.level, c.into)
		}
	}
	for _, c := range []struct{ xp, level int }{{0, 0}, {59, 0}, {60, 1}, {180, 2}, {360, 3}, {3300, 10}, {99999, 10}} {
		if l, _, _ := SkillLevelOf(c.xp); l != c.level {
			t.Errorf("skill %d XP: level %d, want %d", c.xp, l, c.level)
		}
	}
	if ActivityXP(60) != 20 || ActivityXP(8*60) != 60 || ActivityXP(5) != 2 {
		t.Error("an hour is worth 20, a shift at most 60, the least thing 2")
	}
}

func TestTrains(t *testing.T) {
	for _, c := range []struct {
		id, kind, career string
		want             []string
	}{
		{"danser-soiree", SoireeKind, "", []string{SkillDanse}},
		{"cook-attieke", "home", "", []string{SkillCuisine}},
		{"musculation", "gym", "", []string{SkillForme}},
		{"gbairai", "market", "", []string{SkillCharisme}},
		{"amphi", "universite", "", []string{SkillSavoir}},
		{"mixer-soiree", SoireeKind, "", []string{SkillMixage}},
		{"work", "club", "ambiance", []string{SkillMixage}},
		{"work", "office", "cadre", nil},
		{"champagne-vip", "club", "", nil},
	} {
		if got := Trains(c.id, c.kind, c.career); !slices.Equal(got, c.want) {
			t.Errorf("%s at %s: %v, want %v", c.id, c.kind, got, c.want)
		}
	}
}

// A dancer gets more fun from a dance, a sportsman less tired; a locked skill
// doesn't train, until the level that opens it.
func TestProgressGains(t *testing.T) {
	p := Progress{Skills: map[string]int{SkillDanse: 180, SkillForme: 600}}
	e := p.Boost(Needs{Fun: 40, Energy: -20}, []string{SkillDanse})
	if e.Fun <= 40 || e.Fun > 40*1.07 || e.Energy != -20 {
		t.Errorf("Danse 2: %+v", e)
	}
	if e := p.Boost(Needs{Fun: 10, Energy: -20}, []string{SkillForme}); e.Energy <= -20 || e.Energy > -17 {
		t.Errorf("Forme 4: %+v", e)
	}
	g := p.Add(20, []string{SkillMixage})
	if p.Skills[SkillMixage] != 0 || len(g.SkillsXP) != 0 || p.XP != 20 {
		t.Errorf("Mixage is locked at level 1: %+v %+v", p, g)
	}
	g = p.Add(230, []string{SkillDanse})
	if g.LevelUp != 3 || !slices.Contains(g.Opened, "Mixage") {
		t.Errorf("level 3 opens Mixage: %+v", g)
	}
	if len(g.SkillUps) != 1 || !strings.Contains(g.SkillUps[0], "Danse niveau 3") {
		t.Errorf("Danse went up: %+v", g.SkillUps)
	}
	if p.Add(20, []string{SkillMixage}); p.Skills[SkillMixage] != 20 {
		t.Error("Mixage trains once open")
	}
}

// The podium needs Danse 2; the decks at a soirée, Mixage open.
func TestSkillRequirements(t *testing.T) {
	podium, _ := Kinds["club"].Interaction("podium")
	fresh := Progress{}
	if err := podium.Requires.Check(Who{Skills: fresh.Levels()}); err == nil || !strings.Contains(err.Error(), "Danse niveau 2") {
		t.Errorf("podium without Danse: %v", err)
	}
	dancer := Progress{Skills: map[string]int{SkillDanse: 180}}
	if err := podium.Requires.Check(Who{Skills: dancer.Levels()}); err != nil {
		t.Errorf("podium at Danse 2: %v", err)
	}
	decks, _ := Kinds[SoireeKind].Interaction(SoireeMixID)
	if err := decks.Requires.Check(Who{Skills: fresh.Levels()}); err == nil || !strings.Contains(err.Error(), "s'ouvre au niveau 3") {
		t.Errorf("decks before level 3: %v", err)
	}
	if err := decks.Requires.Check(Who{Skills: (&Progress{XP: 240}).Levels()}); err != nil {
		t.Errorf("decks at level 3: %v", err)
	}
	for _, s := range Skills {
		for _, pk := range s.Perks {
			if pk.Text == "" {
				t.Errorf("%s: a perk without its text", s.ID)
			}
		}
	}
}
