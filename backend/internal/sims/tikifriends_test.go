package sims

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The friends met in the game post on Tikitoko: with their face, found again
// from the post's id (to like or save it), and never the bande.
func TestFriendPosts(t *testing.T) {
	now := time.Date(2026, 10, 21, 18, 0, 0, 0, time.UTC)
	look := json.RawMessage(`{"skin":"#5a3a22","hair":"short","outfit":"tshirt","outfitColor":"#ff0000"}`)
	friends := []game.Friend{
		{ID: "p-in-yop-maquis-6", Name: "Ibrahim", Gender: "homme", Seed: 6123, Look: look},
		{ID: "p-x-2", Name: "Affoué", Gender: "femme", Seed: 777},
		{ID: "g-Bôrô", Name: "Bôrô", Gender: "homme", Seed: 9, Gang: true},
	}
	ps := friendPosts("sim-a", friends, now, "")
	if len(ps) == 0 {
		t.Fatal("no friend posted in four days")
	}
	seen := map[int64]bool{}
	for _, p := range ps {
		if !p.Friend || p.ID >= 0 || seen[p.ID] {
			t.Fatalf("bad post %+v", p)
		}
		seen[p.ID] = true
		if strings.Contains(p.Author.ID, "Bôrô") {
			t.Fatal("the bande posted")
		}
		if p.At.After(now) {
			t.Fatalf("posted in the future: %v", p.At)
		}
		if p.Author.ID == "friend-p-in-yop-maquis-6" && p.Author.Look.Skin != "#5a3a22" {
			t.Errorf("Ibrahim without his face: %+v", p.Author.Look)
		}
		again, ok := findFriendPost("sim-a", friends, p.ID, now)
		if !ok || again.Caption != p.Caption || again.Author.ID != p.Author.ID {
			t.Errorf("post %d not found again: %+v", p.ID, again)
		}
		// Another player's id space: not theirs.
		if _, ok := findFriendPost("sim-b", friends, p.ID, now); ok {
			t.Errorf("post %d found for another Sim", p.ID)
		}
	}
	// Far from the creators' ids.
	if _, ok := npcPost(ps[0].ID, now); ok {
		t.Error("a friend's post read as a creator's")
	}
	// One friend's page.
	only := friendPosts("sim-a", friends, now, "friend-p-x-2")
	for _, p := range only {
		if p.Author.ID != "friend-p-x-2" {
			t.Errorf("someone else on Affoué's page: %s", p.Author.ID)
		}
	}
	if pr, ok := friendProfile("sim-a", friends, "friend-p-x-2", now); !ok || pr.Handle != "affoue_77" {
		t.Errorf("profile: %+v %v", pr, ok)
	}
	if _, ok := friendProfile("sim-a", friends, "friend-g-Bôrô", now); ok {
		t.Error("the bande has a page")
	}
}
