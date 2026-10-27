package sims

import (
	"encoding/json"
	"math/rand/v2"
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

func TestChatWithPasserby(t *testing.T) {
	p := Passerby{ID: "x1", Name: "Awa", Gender: "femme", Seed: 3}
	s := newSim()
	ans, err := s.chat(p, "gbairai", "", true, rand.New(rand.NewPCG(1, 2)))
	if err != nil || ans.Text == "" || ans.Mood != "good" || s.Activity == nil || s.Activity.PlaceKind != "chat" {
		t.Fatalf("gbairai: %+v %v %+v", ans, err, s.Activity)
	}
	// The same person: the conversation goes on (someone else: busy).
	if _, err := s.chat(p, "salut", "", true, rand.New(rand.NewPCG(1, 2))); err != nil || len(s.Activity.Said) != 2 {
		t.Errorf("chained: %v %+v", err, s.Activity)
	}
	if ans, _ := s.chat(p, "gbairai", "", true, rand.New(rand.NewPCG(1, 2))); ans.Mood != "bad" || s.Activity.Interaction.ID != "chat-again" {
		t.Errorf("twice the same: %+v", ans)
	}
	if _, err := s.chat(Passerby{ID: "x9", Name: "Yao", Gender: "homme"}, "salut", "", true, rand.New(rand.NewPCG(1, 2))); err != game.ErrBusy {
		t.Errorf("busy: %v", err)
	}
	for range chatTurns {
		s.chat(p, "salut", "", true, rand.New(rand.NewPCG(1, 2)))
	}
	if ans, _ := s.chat(p, "salut", "", true, rand.New(rand.NewPCG(1, 2))); ans.Mood != "bye" {
		t.Errorf("never leaves: %+v", ans)
	}
	if _, err := newSimPtr().chat(p, "nimporte", "", true, rand.New(rand.NewPCG(1, 2))); err == nil {
		t.Error("unknown topic accepted")
	}
	// Exchanging numbers can make a friend, once.
	made := false
	for seed := uint64(0); seed < 20 && !made; seed++ {
		s := newSim()
		if _, err := s.chat(p, "numero", "", true, rand.New(rand.NewPCG(seed, 9))); err != nil {
			t.Fatal(err)
		}
		made = s.findFriend("p-x1") != nil
	}
	if !made {
		t.Error("no friend made in 20 tries")
	}
	// A loan sometimes comes.
	got := false
	for seed := uint64(0); seed < 30 && !got; seed++ {
		s := newSim()
		before := s.Money
		ans, _ := s.chat(p, "djai", "", true, rand.New(rand.NewPCG(seed, 5)))
		got = ans.Money > 0 && s.Money == before+ans.Money
	}
	if !got {
		t.Error("no loan in 30 tries")
	}
}

func newSimPtr() *Sim { s := newSim(); return &s }

func TestEveryChatTopic(t *testing.T) {
	p := Passerby{ID: "x2", Name: "Koffi", Gender: "homme", Seed: 5}
	for _, topic := range chatTopics {
		if romantic(topic.id) || topic.id == "langue" || topic.id == "libre" {
			continue // TestRomance, TestGreetIn, TestChatFree
		}
		if len(topic.yes) == 0 && topic.id != "numero" {
			t.Errorf("%s has nothing to answer", topic.id)
		}
		if topic.chance > 0 && len(topic.no) == 0 {
			t.Errorf("%s can go wrong but has no lines for it", topic.id)
		}
		for seed := uint64(0); seed < 30; seed++ {
			s := newSim()
			s.Gender = "femme"
			ans, err := s.chat(p, topic.id, "C'est comment ?", true, rand.New(rand.NewPCG(seed, 3)))
			reply := ans.Text
			if err != nil {
				t.Fatalf("%s: %v", topic.id, err)
			}
			if strings.Contains(reply, "{") {
				t.Fatalf("%s: unfilled %q", topic.id, reply)
			}
		}
	}
}

func romantic(id string) bool { return id == "sortir" || id == "emmenager" || id == "rompre" }

// Going out, moving in, a night together, breaking up: adults only, with a friend.
func TestRomance(t *testing.T) {
	p := Passerby{ID: "r1", Name: "Aya", Gender: "femme", Seed: 3}
	s := newSim()
	if _, err := s.chat(p, "sortir", "", false, rand.New(rand.NewPCG(1, 1))); err != errNotAdult {
		t.Fatalf("a player not confirmed 18+ asked someone out: %v", err)
	}
	if _, err := s.chat(p, "sortir", "", true, rand.New(rand.NewPCG(1, 1))); err != errNotAcquainted {
		t.Fatalf("asked a stranger out: %v", err)
	}
	s.Friends = []game.Friend{{ID: "p-r1", Name: "Aya", Gender: "femme", Friendship: 95, Adult: true}}
	together := false
	for seed := uint64(0); seed < 20 && !together; seed++ {
		s.Activity = nil
		if _, err := s.chat(p, "sortir", "", true, rand.New(rand.NewPCG(seed, 2))); err != nil {
			t.Fatal(err)
		}
		together = s.partner() != nil
	}
	if !together {
		t.Fatal("a close friend never said yes")
	}
	// Not living together yet: no night at home.
	s.Activity = nil
	if _, err := s.interactAt(HomePlaceID, game.NightID); err == nil {
		t.Fatal("a night together without living together")
	}
	for seed := uint64(0); seed < 20 && !s.partner().Home; seed++ {
		s.Activity = nil
		if _, err := s.chat(p, "emmenager", "", true, rand.New(rand.NewPCG(seed, 4))); err != nil {
			t.Fatal(err)
		}
	}
	if !s.partner().Home {
		t.Fatal("never moved in")
	}
	s.Activity = nil
	it, err := s.interactAt(HomePlaceID, game.NightID)
	if err != nil || !strings.Contains(it.Label, "Aya") {
		t.Fatalf("night at home: %v %q", err, it.Label)
	}
	s.Activity = nil
	if _, err := s.chat(p, "rompre", "", true, rand.New(rand.NewPCG(1, 5))); err != nil || s.partner() != nil || s.Friends[0].Home {
		t.Fatalf("break-up: %v", err)
	}
	// Someone else's partner can't be asked out while one is together with someone.
	s.Friends = append(s.Friends, game.Friend{ID: "p-r2", Name: "Mariam", Gender: "femme", Friendship: 95, Adult: true, Partner: true})
	s.Activity = nil
	if ans, _ := s.chat(p, "sortir", "", true, rand.New(rand.NewPCG(1, 6))); ans.Mood != "bad" {
		t.Fatal("asked out while already together")
	}
}

// Met in a maquis or the street: the friend keeps the face they had there,
// and a look that isn't one (too big, not JSON) is dropped.
func TestFriendKeepsLook(t *testing.T) {
	look := json.RawMessage(`{"skin":"#5a3a22","hair":"short","outfit":"tshirt","outfitColor":"#ff0000"}`)
	for _, c := range []struct {
		look json.RawMessage
		keep bool
	}{{look, true}, {json.RawMessage(`{"skin":`), false}, {json.RawMessage(`"` + strings.Repeat("a", maxLook) + `"`), false}} {
		var f *game.Friend
		for seed := uint64(0); seed < 20 && f == nil; seed++ {
			s := newSim()
			if _, err := s.chat(Passerby{ID: "in-maquis-3", Name: "Awa", Gender: "femme", Seed: 3, Look: c.look}, "numero", "", true, rand.New(rand.NewPCG(seed, 9))); err != nil {
				t.Fatal(err)
			}
			f = s.findFriend("p-in-maquis-3")
		}
		if f == nil {
			t.Fatal("no friend made in 20 tries")
		}
		if got := string(f.Look) == string(c.look); got != c.keep {
			t.Errorf("look %.20s… kept %v, want %v", c.look, got, c.keep)
		}
	}
}

// Dancing at the maquis, one talks with the people there all the same: the
// dance goes on, the conversation is remembered, and after a while they go.
func TestChatAside(t *testing.T) {
	s := newSim()
	if err := s.start(game.Interaction{ID: "dance-coupe-decale", Label: "Danser", Minutes: 60}, "yop-maquis", "maquis", "Maquis de Sideci", nil, ""); err != nil {
		t.Fatal(err)
	}
	p := Passerby{ID: "in-yop-maquis-3", Name: "Ibrahim", Gender: "homme", Seed: 3}
	if _, err := s.chat(p, "salut", "", true, rand.New(rand.NewPCG(1, 2))); err != nil {
		t.Fatalf("aside refused: %v", err)
	}
	if s.Activity.Interaction.ID != "dance-coupe-decale" || s.Activity.ChatWith != p.ID || len(s.Activity.Said) != 1 {
		t.Fatalf("the dance should go on, with the aside noted: %+v", s.Activity)
	}
	if ans, _ := s.chat(p, "salut", "", true, rand.New(rand.NewPCG(1, 2))); ans.Text == "" || len(s.Activity.Said) != 2 {
		t.Errorf("chained aside: %+v %+v", ans, s.Activity)
	}
	for range chatTurns {
		s.chat(p, "salut", "", true, rand.New(rand.NewPCG(1, 2)))
	}
	if ans, _ := s.chat(p, "salut", "", true, rand.New(rand.NewPCG(1, 2))); ans.Mood != "bye" || s.Activity.Interaction.ID != "dance-coupe-decale" {
		t.Errorf("never leaves, or stopped the dance: %+v %+v", ans, s.Activity)
	}
	// Someone else there: a new aside.
	if _, err := s.chat(Passerby{ID: "in-yop-maquis-5", Name: "Awa", Gender: "femme"}, "salut", "", true, rand.New(rand.NewPCG(1, 2))); err != nil || len(s.Activity.Said) != 1 {
		t.Errorf("someone else: %v %+v", err, s.Activity)
	}
}

// A greeting in one of the player's languages: answered in it by those who speak it, else in French.
func TestGreetIn(t *testing.T) {
	s := newSim()
	s.Gender = "femme"
	s.GameMinutes = 9 * 60 // a Monday, at 9
	rng := rand.New(rand.NewPCG(1, 2))
	baoule := Passerby{ID: "b1", Name: "Yao", Gender: "homme", Seed: 0} // npcMother[0]: baoulé
	if _, err := s.chatIn(baoule, "langue", "Nja anyin o !", "baoule", true, rng); err != errNotSpoken {
		t.Fatalf("not spoken: %v", err)
	}
	s.Languages = []string{"baoule", "dioula"}
	ans, err := s.chatIn(baoule, "langue", "Nja anyin o !", "baoule", true, rng)
	if err != nil || ans.Mood != "good" || !strings.Contains(ans.Text, "Yoo, mmo arɛ o") {
		t.Fatalf("baoulé: %+v %v", ans, err)
	}
	s.Activity = nil
	dioula := Passerby{ID: "d1", Name: "Moussa", Gender: "homme", Seed: 5} // npcMother[5]: dioula
	ans, err = s.chatIn(dioula, "langue", "Nja anyin o !", "baoule", true, rng)
	if err != nil || ans.Mood != "" || !strings.Contains(ans.Text, "le dioula") {
		t.Fatalf("not shared: %+v %v", ans, err)
	}
	for _, l := range game.Languages {
		for _, femme := range []bool{false, true} {
			line, _ := game.GreetReply(l.ID, 20, femme, !femme)
			if strings.Contains(say([]string{line}, baoule, &s, rng), "{") {
				t.Fatalf("%s: unfilled %q", l.ID, line)
			}
		}
	}
	for seed := 0; seed < 400; seed++ {
		if langs := game.NpcLanguages(seed); game.LanguageLabel(langs[0]) == "" {
			t.Fatalf("seed %d: %v", seed, langs)
		}
	}
}

// What the player typed, answered in the passer-by's own words: the game counts it like a chat, never money.
func TestChatFree(t *testing.T) {
	p := Passerby{ID: "f1", Name: "Awa", Gender: "femme", Seed: 3}
	s := newSim()
	if _, err := s.chat(p, "libre", "Salut", true, rand.New(rand.NewPCG(1, 2))); err != errUnknownTopic {
		t.Fatalf("libre without an answer: %v", err)
	}
	money := s.Money
	for i := range 2 * chatTurns {
		ans, err := s.chatWith(p, "libre", "On dit quoi ?", "", true, rand.New(rand.NewPCG(uint64(i), 2)), &chatAnswer{Text: "Y a rien, on est là !", Mood: "good", Money: 5000})
		if err != nil || ans.Text != "Y a rien, on est là !" || ans.Mood != "good" || ans.Money != 0 {
			t.Fatalf("turn %d: %+v %v", i, ans, err)
		}
	}
	if s.Money != money {
		t.Errorf("money changed: %d → %d", money, s.Money)
	}
	ans, _ := s.chatWith(p, "libre", "Encore ?", "", true, rand.New(rand.NewPCG(9, 2)), &chatAnswer{Text: "…", Mood: "neutral"})
	if ans.Mood != "bye" {
		t.Errorf("a long talk ends: %+v", ans)
	}
	s.Activity = nil
	if ans, _ := s.chatWith(p, "libre", "Bof", "", true, rand.New(rand.NewPCG(9, 2)), &chatAnswer{Text: "Ah bon.", Mood: "neutral"}); ans.Mood != "" {
		t.Errorf("neutral: %+v", ans)
	}
}

func TestTalkQuota(t *testing.T) {
	var q talkQuota
	now := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	if q.take("u", now) != nil || q.take("u", now.Add(time.Second)) == nil {
		t.Fatal("two messages in a second")
	}
	for i := 1; i < freeDaily; i++ {
		if err := q.take("u", now.Add(time.Duration(i)*2*time.Second)); err != nil {
			t.Fatalf("message %d: %v", i, err)
		}
	}
	if q.take("u", now.Add(time.Hour)) == nil || q.take("v", now.Add(time.Hour)) != nil || q.take("u", now.Add(24*time.Hour)) != nil {
		t.Error("daily quota")
	}
}
