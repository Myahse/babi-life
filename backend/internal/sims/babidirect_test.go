package sims

import (
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

func TestInCommune(t *testing.T) {
	if inCommune("Plateau") != "au Plateau" || inCommune("Yopougon") != "à Yopougon" {
		t.Error(inCommune("Plateau"), inCommune("Yopougon"))
	}
}

func TestHappeningPosts(t *testing.T) {
	from := game.MinuteOf(time.Date(2026, 3, 10, 6, 0, 0, 0, time.UTC))
	to := from + 24*60
	posts := happeningPosts(from, to)
	if len(posts) == 0 {
		t.Fatal("a whole day without a happening told")
	}
	perSlot := map[int64]map[string]bool{}
	keys := map[string]bool{}
	for _, p := range posts {
		m := game.MinuteOf(p.At)
		if m <= from || m > to {
			t.Errorf("%s out of the window", p.Key)
		}
		if keys[p.Key] {
			t.Errorf("%s twice", p.Key)
		}
		keys[p.Key] = true
		slot := m / game.HappeningMinutes
		if perSlot[slot] == nil {
			perSlot[slot] = map[string]bool{}
		}
		if perSlot[slot][p.Emoji+p.Body[:10]] {
			t.Errorf("the same happening twice in a slot: %s", p.Body)
		}
		perSlot[slot][p.Emoji+p.Body[:10]] = true
		if len(perSlot[slot]) > DirectPerSlot {
			t.Errorf("more than %d in slot %d", DirectPerSlot, slot)
		}
		if p.Commune == "" || p.Kind != "quartier" || !strings.Contains(p.Body, "en ce moment") || p.Sim != "" {
			t.Errorf("post %+v", p)
		}
		// Still on when it's told.
		h, start, ok := game.HappeningAt(strings.Split(p.Key, ":")[1], p.Commune, m)
		if !ok || m-start >= game.HappeningMinutes || !strings.HasPrefix(p.Body, h.Label) {
			t.Errorf("%s: not on at %d (%s)", p.Key, m, h.Label)
		}
	}
	// Caught up in two halves: the same posts.
	mid := from + 7*60 + 13
	again := append(happeningPosts(from, mid), happeningPosts(mid, to)...)
	if len(again) != len(posts) {
		t.Errorf("in two goes: %d posts, %d in one", len(again), len(posts))
	}
	for i := range again {
		if again[i].Key != posts[i].Key {
			t.Errorf("post %d: %s vs %s", i, again[i].Key, posts[i].Key)
		}
	}
}

func TestStadiumPosts(t *testing.T) {
	from := game.MinuteOf(time.Date(2026, 3, 9, 0, 0, 0, 0, time.UTC)) // a Monday
	posts := stadiumPosts(from, from+7*24*60)
	kick, end, concert := 0, 0, 0
	for _, p := range posts {
		switch p.Emoji {
		case "🏟️":
			kick++
		case "🏁":
			end++
			if !strings.Contains(p.Body, " – ") {
				t.Errorf("no score: %s", p.Body)
			}
		case "🎤":
			concert++
		}
	}
	// Two matches and two concerts a week at each stadium.
	n := len(stadiums())
	if n == 0 || kick != 2*n || end != 2*n || concert != 2*n {
		t.Errorf("%d stadiums: %d kick-offs, %d results, %d concerts", n, kick, end, concert)
	}
}

func TestBetPosts(t *testing.T) {
	from := time.Date(2026, 3, 10, 10, 0, 0, 0, time.UTC)
	posts := betPosts(from, from.Add(4*time.Hour))
	if len(posts) != 2 {
		t.Fatalf("%d Bet225 posts in 4 hours", len(posts))
	}
	for _, p := range posts {
		if strings.Count(p.Body, "\n") != 6 || !strings.Contains(p.Body, "Bet225") {
			t.Errorf("post %q", p.Body)
		}
	}
	all := directPosts(from, from.Add(4*time.Hour))
	for i := 1; i < len(all); i++ {
		if all[i].At.Before(all[i-1].At) {
			t.Error("not in order")
		}
	}
}

func TestMoments(t *testing.T) {
	s := Sim{ID: "s1", FirstName: "Awa", Gender: "femme", HomeCity: "abidjan", HomeCommune: "yopougon", City: "abidjan", Commune: "cocody"}
	if b := birthMoment(s); b.Body != "Une petite fille est née à Yopougon : bienvenue à Awa dans Babi !" || b.Sim != "s1" {
		t.Errorf("birth: %q", b.Body)
	}
	if _, ok := promotionMoment(&s); ok {
		t.Error("a promotion without a career")
	}
	s.Career, s.CareerLevel = game.Careers[0].ID, 1
	p, ok := promotionMoment(&s)
	if !ok || !strings.Contains(p.Body, game.Careers[0].Levels[1].Title) || !strings.Contains(p.Body, "Awa") {
		t.Errorf("promotion: %q", p.Body)
	}
	if h := houseMoment(&s, true, "abidjan", "plateau"); !strings.Contains(h.Body, "au Plateau") {
		t.Errorf("house: %q", h.Body)
	}
	for _, m := range []directItem{p, birthMoment(s), tikiMoment(&s, "Influenceur·se")} {
		if strings.Contains(m.Body, "F") && strings.Contains(m.Body, "000") {
			t.Errorf("money in a public post: %q", m.Body)
		}
	}
}

// A promotion at the end of a shift goes to Babi Direct with its journal line.
func TestPromotionCarriesMoment(t *testing.T) {
	c := game.Careers[0]
	s := Sim{ID: "s2", FirstName: "Koffi", Gender: "homme", City: "abidjan", Commune: "plateau", Career: c.ID, Performance: 1000, Needs: game.FreshNeeds()}
	s.Activity = &game.Activity{Kind: "do", PlaceName: "Bureau", Interaction: game.Interaction{ID: "work", Label: "Travailler"}, Start: 0, End: 10, Career: c.ID}
	var moment *directItem
	for _, ev := range s.finish(newRand()) {
		if ev.Kind == "career" {
			moment = ev.moment
		}
	}
	if moment == nil || s.CareerLevel != 1 || !strings.Contains(moment.Body, "Koffi devient "+c.Levels[1].Title) || moment.Commune != "plateau" {
		t.Fatalf("promotion moment: %+v (level %d)", moment, s.CareerLevel)
	}
}
