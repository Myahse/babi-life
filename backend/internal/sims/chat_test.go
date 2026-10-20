package sims

import (
	"math/rand/v2"
	"strings"
	"testing"

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
		if romantic(topic.id) {
			continue // TestRomance
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
