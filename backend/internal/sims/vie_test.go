package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func lifeSim() *Sim {
	full := game.Needs{Hunger: 70, Energy: 70, Hygiene: 70, Social: 70, Fun: 70}
	return &Sim{FirstName: "Awa", Gender: "femme", City: "abidjan", Commune: "cocody", HomeCity: "abidjan", HomeCommune: "cocody", GameMinutes: 10_000, Needs: full, lifeOn: true}
}

func done(id string, e game.Needs, minutes int64) *game.Activity {
	return &game.Activity{Kind: "do", PlaceID: HomePlaceID, PlaceKind: "home", Interaction: game.Interaction{ID: id, Label: id, Minutes: minutes, Effect: e}}
}

// The needs' moods come and go with the needs; the timed ones end on the clock; a dirty house shows.
func TestLifeSyncMoods(t *testing.T) {
	s := lifeSim()
	s.lifeSync()
	if len(s.Life.Moodlets) != 0 || s.Mood == nil || s.Mood.Level != "bien" || s.Life.Since != s.GameMinutes {
		t.Fatalf("a Sim doing fine: %+v %+v", s.Life, s.Mood)
	}
	s.Needs.Hunger = 10
	s.lifeSync()
	if !s.hasMood("faim") {
		t.Fatal("hungry: « Affamé·e »")
	}
	s.Needs.Hunger = 60
	s.lifeSync()
	if s.hasMood("faim") {
		t.Fatal("fed: gone")
	}
	s.addMood("salaire", "")
	s.lifeSync()
	if !s.hasMood("salaire") || s.Mood.Score != 2 {
		t.Fatalf("paid: %+v", s.Mood)
	}
	s.GameMinutes += game.Moodlets["salaire"].Minutes
	s.lifeSync()
	if s.hasMood("salaire") {
		t.Fatal("over on the clock")
	}
	s.GameMinutes += dirtyAfter + 1
	s.lifeSync()
	if !s.hasMood("maison-sale") {
		t.Fatal("two days without cleaning: « Maison sale »")
	}
	s.lifeDone(done("faire-menage", game.Needs{}, 2), 0)
	s.lifeSync()
	if s.hasMood("maison-sale") || !s.hasMood("maison-propre") {
		t.Fatal("cleaned")
	}
}

// What was done leaves a mood and trains its skill; a level reached is said.
func TestLifeDone(t *testing.T) {
	s := lifeSim()
	evs := s.lifeDone(done("cook-attieke", game.Needs{Hunger: 55, Fun: 5}, 2), 0)
	if !s.hasMood("bien-mange") || s.Life.Skills["cuisine"] != 30 || len(evs) != 0 {
		t.Fatalf("cooked: %+v %v", s.Life, evs)
	}
	for range 3 {
		evs = s.lifeDone(done("cook-attieke", game.Needs{Hunger: 55}, 2), 0)
	}
	if s.skillLevel("cuisine") != 2 || len(evs) != 1 || evs[0].Kind != "skill" || !s.hasMood("fier") {
		t.Fatalf("level 2: %d %v", s.skillLevel("cuisine"), evs)
	}
	s.lifeDone(done("shower", game.Needs{Hygiene: 60}, 1), 0)
	if !s.hasMood("douche") {
		t.Fatal("« Douche fraîche »")
	}
	work := done("work", game.Needs{}, 8)
	work.Career = "bureau"
	s.lifeDone(work, 4000)
	if !s.hasMood("salaire") {
		t.Fatal("« Salaire reçu »")
	}
	// Shut: nothing (finish doesn't call it, lifeStart does nothing).
	off := lifeSim()
	off.lifeOn = false
	off.Activity = done("cook-attieke", game.Needs{Hunger: 55}, 2)
	off.lifeStart()
	if off.Activity.Boost != 0 || off.Activity.Interaction.Effect.Hunger != 55 {
		t.Fatal("shut: untouched")
	}
}

// The mood and the skill weigh a little on an action's good, never on its pay, once.
func TestLifeStart(t *testing.T) {
	s := lifeSim()
	s.addMood("salaire", "")
	s.addMood("festin", "")
	s.Life.Skills = map[string]int{"cuisine": game.SkillXP(5)}
	s.Activity = done("cook-attieke", game.Needs{Hunger: 50, Energy: -10}, 2)
	s.Activity.Interaction.Cost = -500
	s.lifeStart()
	want := 50 * game.MoodFactor(4) * game.SkillBonus(5)
	if got := s.Activity.Interaction.Effect.Hunger; got < want-0.1 || got > want+0.1 || s.Activity.Interaction.Effect.Energy != -10 || s.Activity.Interaction.Cost != -500 {
		t.Fatalf("boosted %+v, want hunger %v", s.Activity.Interaction, want)
	}
	again := s.Activity.Interaction.Effect.Hunger
	s.lifeStart()
	if s.Activity.Interaction.Effect.Hunger != again {
		t.Fatal("boosted twice")
	}
	s = lifeSim()
	s.addMood("dispute", "Koffi")
	s.addMood("nuit-blanche", "")
	s.Activity = done("watch-tv", game.Needs{Fun: 40}, 3)
	s.lifeStart()
	if s.Activity.Interaction.Effect.Fun >= 40 {
		t.Fatal("a bad mood takes a little")
	}
}

// A promotion asks for the career's skill.
func TestPromotionSkill(t *testing.T) {
	c, _ := game.FindCareer("maquis")
	s := lifeSim()
	s.Career, s.CareerLevel = "maquis", 1
	if s.promotionHeld(c) != "cuisine" {
		t.Fatal("to the third rung: cuisine 2")
	}
	s.Life.Skills = map[string]int{"cuisine": game.SkillXP(2)}
	if s.promotionHeld(c) != "" {
		t.Fatal("cuisine 2: promoted")
	}
	s.lifeOn = false
	s.Life.Skills = nil
	if s.promotionHeld(c) != "" {
		t.Fatal("shut: as before")
	}
}

// What can be said depends on what they are to each other; how it goes moves the gauges.
func TestLifeChat(t *testing.T) {
	s := lifeSim()
	koffi := Passerby{ID: "koffi", Name: "Koffi", Gender: "homme", Seed: 3}
	if s.lifeGate(koffi, "drague", true) == nil {
		t.Fatal("no flirting with a stranger")
	}
	if s.lifeGate(koffi, "salut", true) != nil {
		t.Fatal("hello to anyone")
	}
	s.lifeChat(koffi, "salut", chatAnswer{Mood: "good"})
	f := s.findFriend("p-koffi")
	if f == nil || game.RelStatus(f.Friendship, f.Romance, f.Enemy, f.Partner) != game.RelConnaissance {
		t.Fatal("greeted well: someone known now")
	}
	if s.lifeGate(koffi, "confier", true) == nil {
		t.Fatal("deep talk needs friends")
	}
	f.Friendship = 45
	if s.lifeGate(koffi, "confier", true) != nil || s.lifeGate(koffi, "drague", true) != nil {
		t.Fatal("friends: deep talk and flirting")
	}
	s.lifeChat(koffi, "drague", chatAnswer{Mood: "good"})
	if f.Romance != 12 || !s.hasMood("amoureux") {
		t.Fatalf("flirted: %+v", f)
	}
	f.Friendship = 25
	s.lifeChat(koffi, "disputer", chatAnswer{Mood: "bad"})
	if !f.Enemy || !s.hasMood("dispute") {
		t.Fatalf("quarrel: %+v", f)
	}
	if s.Life.Moodlets[len(s.Life.Moodlets)-1].Label != "Dispute avec Koffi" {
		t.Fatalf("the reason: %+v", s.Life.Moodlets)
	}
	if s.lifeGate(koffi, "confier", true) == nil || s.lifeGate(koffi, "excuser", true) != nil {
		t.Fatal("enemies: only making up")
	}
	s.lifeChat(koffi, "excuser", chatAnswer{Mood: "good"})
	s.lifeChat(koffi, "excuser", chatAnswer{Mood: "good"})
	if f.Enemy || s.hasMood("dispute") {
		t.Fatalf("made up: %+v", f)
	}
	if s.Life.Skills["charisme"] == 0 {
		t.Fatal("talking trains the charisme")
	}
	// Papa: his own gauge.
	s.lifeChat(Passerby{ID: ParentPrefix + "papa", Name: "Papa"}, "parent-journee", chatAnswer{Mood: "good"})
	if s.Life.Kin[ParentPrefix+"papa"].Friendship <= 60 {
		t.Fatal("papa closer")
	}
	// Shut: the wheel's own topics refused, the rest as ever.
	s.lifeOn = false
	if s.lifeGate(koffi, "disputer", true) == nil || s.lifeGate(koffi, "drague", true) != nil {
		t.Fatal("shut")
	}
}
