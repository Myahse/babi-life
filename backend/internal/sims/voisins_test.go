package sims

import (
	"math/rand/v2"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func TestVoisins(t *testing.T) {
	s := lifeSim()
	s.voisinsOn = true
	s.Money = 50000
	rng := rand.New(rand.NewPCG(1, 2))
	if ev := s.voisinsSync(rng); ev != nil || len(s.Life.Voisins.Houses) != game.VoisinsCount {
		t.Fatalf("la cour : %v", s.Life.Voisins)
	}
	c := s.Life.Voisins
	names := map[string]bool{}
	for _, h := range c.Houses {
		if names[h.Family] || h.Lien != game.LienStart || h.Name == "" {
			t.Fatalf("famille : %+v", h)
		}
		names[h.Family] = true
	}
	// A greeting a day; a dish a day, paid.
	id := c.Houses[0].ID
	if _, _, err := s.voisinDo(id, "saluer"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.voisinDo(id, "saluer"); err != errGreeted {
		t.Fatalf("deux fois : %v", err)
	}
	if _, _, err := s.voisinDo(id, "plat"); err != nil || s.Money != 50000-game.DishCost {
		t.Fatalf("plat : %v %d", err, s.Money)
	}
	if c.Houses[0].Lien != game.LienStart+game.GreetLien+game.DishLien {
		t.Fatalf("lien %d", c.Houses[0].Lien)
	}
	if _, _, err := s.voisinDo(id, "oui"); err != errNoAsk {
		t.Fatalf("rien demandé : %v", err)
	}
	// A loan: lent, then paid back days later.
	c.Houses[0].Lien = 60
	c.Houses[0].Ask = &VoisinAsk{Kind: "emprunt", Amount: 5000, Day: s.GameMinutes / game.DayMinutes}
	before := s.Money
	if _, _, err := s.voisinDo(id, "oui"); err != nil || s.Money != before-5000 || c.Houses[0].Owe != 5000 {
		t.Fatalf("prêt : %v %d %+v", err, s.Money, c.Houses[0])
	}
	s.GameMinutes += 6 * game.DayMinutes
	ev := s.voisinsSync(rng)
	if c.Houses[0].Owe != 0 || s.Money < before {
		t.Fatalf("pas remboursé : %d %+v", s.Money, c.Houses[0])
	}
	if len(ev) == 0 {
		t.Fatal("aucune nouvelle")
	}
	// Days go by: news, asks, at most VoisinCatchUp days at once; an ask left goes.
	for range 30 {
		s.GameMinutes += game.DayMinutes
		s.voisinsSync(rng)
	}
	news, asks := 0, 0
	for _, h := range c.Houses {
		news += len(h.News)
		if h.Ask != nil {
			asks++
			if h.Ask.Day < s.GameMinutes/game.DayMinutes-game.VoisinAskDays {
				t.Fatalf("demande périmée : %+v", h.Ask)
			}
		}
	}
	if news == 0 {
		t.Fatal("aucune vie chez les voisins")
	}
	// A no to an ask: the bond down.
	h := &c.Houses[1]
	h.Ask, h.Lien = &VoisinAsk{Kind: "condoleances", Day: s.GameMinutes / game.DayMinutes}, 50
	if _, _, err := s.voisinDo(h.ID, "non"); err != nil || h.Lien != 40 || h.Ask != nil {
		t.Fatalf("non : %v %+v", err, h)
	}
	// The neighbour who drops by is one of them.
	c.Houses[2].Lien = 50
	for range 20 {
		if v := s.voisinVisitor(rng); v != nil && v.Who[:3] != "p-n" {
			t.Fatalf("visite : %+v", v)
		}
	}
}

func TestAskKinds(t *testing.T) {
	rng := rand.New(rand.NewPCG(3, 4))
	for _, tr := range game.VoisinTraits {
		for range 20 {
			a := game.AskFor(tr, rng)
			if a.Text == "" || a.Yes == "" || a.No == "" || a.YesText == "" || a.NoText == "" {
				t.Fatalf("%s : %+v", tr, a)
			}
		}
	}
}
