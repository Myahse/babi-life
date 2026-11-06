package game

import "testing"

func TestSkillLevels(t *testing.T) {
	if SkillLevel(0) != 1 || SkillLevel(SkillXP(2)-1) != 1 || SkillLevel(SkillXP(2)) != 2 {
		t.Fatal("level 2 starts at SkillXP(2)")
	}
	if SkillLevel(1<<20) != SkillMax {
		t.Fatal("capped at 10")
	}
	for l := 2; l <= SkillMax; l++ {
		if SkillXP(l) <= SkillXP(l-1) {
			t.Fatalf("level %d not above %d", l, l-1)
		}
	}
}

func TestSkillGain(t *testing.T) {
	sk, base := SkillGain("cook-attieke", 2, nil, 0, 0)
	if sk != "cuisine" || base != 30 {
		t.Fatalf("cooking: %s %d", sk, base)
	}
	if _, g := SkillGain("cook-attieke", 2, []string{"gourmand"}, 0, 0); g <= base {
		t.Fatal("the gourmand learns faster")
	}
	if _, g := SkillGain("cook-attieke", 2, nil, 4, 0); g <= base {
		t.Fatal("a good mood helps a little")
	}
	if _, g := SkillGain("cook-attieke", 2, nil, 0, 100); g <= base {
		t.Fatal("a game played well counts more")
	}
	if sk, g := SkillGain("watch-tv", 3, nil, 0, 0); sk != "" || g != 0 {
		t.Fatal("the TV trains nothing")
	}
}

func TestMood(t *testing.T) {
	if m := MoodOf(nil); m.Level != "bien" || m.Score != 0 {
		t.Fatalf("no moodlet: %+v", m)
	}
	happy := []Moodlet{NewMoodlet("salaire", "", 0), NewMoodlet("festin", "", 0)}
	if m := MoodOf(happy); m.Level != "ravi" {
		t.Fatalf("paid and fed: %+v", m)
	}
	sad := []Moodlet{NewMoodlet("dispute", "Koffi", 0), NewMoodlet("nuit-blanche", "", 0)}
	m := MoodOf(sad)
	if m.Level != "mal" {
		t.Fatalf("a quarrel after a night not slept: %+v", m)
	}
	if sad[0].Label != "Dispute avec Koffi" || sad[0].Until != Moodlets["dispute"].Minutes {
		t.Fatalf("the reason in the label, the time: %+v", sad[0])
	}
	if f := MoodFactor(m.Score); f >= 1 || f < 0.9 {
		t.Fatalf("a bad mood takes a little: %v", f)
	}
	if MoodFactor(100) != 1.1 {
		t.Fatal("never more than +10 %")
	}
}

func TestRelationships(t *testing.T) {
	if RelStatus(10, 0, false, false) != RelConnaissance || RelStatus(50, 0, false, false) != RelAmi || RelStatus(85, 0, false, false) != RelMeilleurAmi {
		t.Fatal("friendship statuses")
	}
	if RelStatus(90, 90, true, false) != RelEnnemi || RelStatus(10, 90, true, true) != RelPartenaire {
		t.Fatal("enemy, partner")
	}
	flirt, _ := SocialOf("drague")
	if SocialWhy(flirt, false, Rel{}, true) == "" {
		t.Fatal("no flirting with a stranger")
	}
	if SocialWhy(flirt, true, Rel{Friendship: 30}, false) == "" {
		t.Fatal("between adults only")
	}
	if SocialWhy(flirt, true, Rel{Friendship: 30}, true) != "" {
		t.Fatal("a friend of 30 can be flirted with")
	}
	deep, _ := SocialOf("confier")
	if SocialWhy(deep, true, Rel{Friendship: 20}, true) == "" || SocialWhy(deep, true, Rel{Friendship: 45}, true) != "" {
		t.Fatal("deep talk needs friends")
	}
	fight, _ := SocialOf("disputer")
	r := Rel{Friendship: 30}.Apply(fight, false)
	if !r.Enemy || r.Friendship != 15 {
		t.Fatalf("a quarrel leaving it low: enemies: %+v", r)
	}
	if SocialWhy(deep, true, r, true) == "" {
		t.Fatal("enemies: nothing but making up")
	}
	sorry, _ := SocialOf("excuser")
	r = r.Apply(sorry, true).Apply(sorry, true)
	if r.Enemy || r.Friendship < 30 {
		t.Fatalf("made up: %+v", r)
	}
	kiss, _ := SocialOf("embrasser")
	if SocialWhy(kiss, true, Rel{Friendship: 90, Romance: 30}, true) == "" {
		t.Fatal("a kiss needs romance")
	}
	if g := (Rel{Friendship: 99, Romance: 95}).Apply(kiss, true); g.Romance != 100 || g.Friendship != 100 {
		t.Fatalf("gauges kept within 100: %+v", g)
	}
}

func TestSkillRequirement(t *testing.T) {
	r := &Requirement{Skill: "cuisine", SkillLevel: 4}
	if r.Check(Who{}) == nil || r.Check(Who{Skills: map[string]int{"cuisine": 3}}) == nil {
		t.Fatal("cuisine 4 needed")
	}
	if r.Check(Who{Skills: map[string]int{"cuisine": 4}}) != nil {
		t.Fatal("cuisine 4 is enough")
	}
	if PromotionSkill(1) != 0 || PromotionSkill(2) != 2 || PromotionSkill(4) != 6 {
		t.Fatal("promotion skills")
	}
	for _, id := range LifeInteractions {
		if _, ok := Kinds["home"].Interaction(id); !ok {
			t.Fatalf("%s not at home", id)
		}
	}
}
