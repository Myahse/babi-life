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
	reply, _, err := s.chat(p, "gbairai", "", rand.New(rand.NewPCG(1, 2)))
	if err != nil || reply == "" || s.Activity == nil || s.Activity.PlaceKind != "chat" {
		t.Fatalf("gbairai: %q %v %+v", reply, err, s.Activity)
	}
	if _, _, err := s.chat(p, "salut", "", rand.New(rand.NewPCG(1, 2))); err != game.ErrBusy {
		t.Errorf("busy: %v", err)
	}
	if _, _, err := newSimPtr().chat(p, "nimporte", "", rand.New(rand.NewPCG(1, 2))); err == nil {
		t.Error("unknown topic accepted")
	}
	// Exchanging numbers can make a friend, once.
	made := false
	for seed := uint64(0); seed < 20 && !made; seed++ {
		s := newSim()
		if _, _, err := s.chat(p, "numero", "", rand.New(rand.NewPCG(seed, 9))); err != nil {
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
		_, money, _ := s.chat(p, "djai", "", rand.New(rand.NewPCG(seed, 5)))
		got = money > 0 && s.Money == before+money
	}
	if !got {
		t.Error("no loan in 30 tries")
	}
}

func newSimPtr() *Sim { s := newSim(); return &s }

func TestEveryChatTopic(t *testing.T) {
	p := Passerby{ID: "x2", Name: "Koffi", Gender: "homme", Seed: 5}
	for _, topic := range chatTopics {
		if len(topic.yes) == 0 && topic.id != "numero" {
			t.Errorf("%s has nothing to answer", topic.id)
		}
		if topic.chance > 0 && len(topic.no) == 0 {
			t.Errorf("%s can go wrong but has no lines for it", topic.id)
		}
		for seed := uint64(0); seed < 30; seed++ {
			s := newSim()
			s.Gender = "femme"
			reply, _, err := s.chat(p, topic.id, "C'est comment ?", rand.New(rand.NewPCG(seed, 3)))
			if err != nil {
				t.Fatalf("%s: %v", topic.id, err)
			}
			if strings.Contains(reply, "{") {
				t.Fatalf("%s: unfilled %q", topic.id, reply)
			}
		}
	}
}
