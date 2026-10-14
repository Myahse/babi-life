package sims

import (
	"math/rand/v2"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func TestChatWithPasserby(t *testing.T) {
	p := Passerby{ID: "x1", Name: "Awa", Gender: "femme", Seed: 3}
	s := newSim()
	reply, _, err := s.chat(p, "gbairai", rand.New(rand.NewPCG(1, 2)))
	if err != nil || reply == "" || s.Activity == nil || s.Activity.PlaceKind != "chat" {
		t.Fatalf("gbairai: %q %v %+v", reply, err, s.Activity)
	}
	if _, _, err := s.chat(p, "salut", rand.New(rand.NewPCG(1, 2))); err != game.ErrBusy {
		t.Errorf("busy: %v", err)
	}
	if _, _, err := newSimPtr().chat(p, "nimporte", rand.New(rand.NewPCG(1, 2))); err == nil {
		t.Error("unknown topic accepted")
	}
	// Exchanging numbers can make a friend, once.
	made := false
	for seed := uint64(0); seed < 20 && !made; seed++ {
		s := newSim()
		if _, _, err := s.chat(p, "numero", rand.New(rand.NewPCG(seed, 9))); err != nil {
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
		_, money, _ := s.chat(p, "djai", rand.New(rand.NewPCG(seed, 5)))
		got = money > 0 && s.Money == before+money
	}
	if !got {
		t.Error("no loan in 30 tries")
	}
}

func newSimPtr() *Sim { s := newSim(); return &s }
