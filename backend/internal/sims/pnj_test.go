package sims

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The AI players: the same for everyone in a commune at a time, fewer when real players are there,
// each doing something open now at a real place of the commune; greeting gives a tip, joining starts the
// same thing there, they're never asked as friends.
func TestPnj(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 11, 3, 15, 0, 0, 0, time.UTC)
	a, b := pnjAt(ctx, "abidjan", "cocody", now, 0), pnjAt(ctx, "abidjan", "cocody", now, 0)
	if len(a) != 3 || a[0].ID != b[0].ID || len(pnjAt(ctx, "abidjan", "cocody", now, 9)) != 1 {
		t.Fatalf("cast: %d, %+v", len(a), a)
	}
	for _, p := range a {
		if !p.Npc || p.Username == "" || !strings.HasPrefix(p.ID, PnjPrefix+"cocody-") || p.Activity == nil || !p.Activity.Joinable {
			t.Fatalf("%+v %+v", p, p.Activity)
		}
	}
	s := &Sim{ID: "x", FirstName: "Awa", Needs: game.FreshNeeds(), Money: 20000, City: "abidjan", Commune: "cocody", HomeCity: "abidjan", HomeCommune: "cocody", BornAt: -1, GameMinutes: game.MinuteOf(time.Now())}
	s.BornAt = s.GameMinutes - game.MinutesToAge(30)
	live := pnjAt(ctx, "abidjan", "cocody", time.Now(), 0)
	out, _, err := s.pnjMeet(ctx, live[0].ID, "saluer")
	if err != nil || !strings.Contains(out.Text, "PNJ") {
		t.Fatalf("greet: %q %v", out.Text, err)
	}
	if _, _, err := s.pnjMeet(ctx, live[0].ID, "ajouter"); err != errPnjFriend {
		t.Fatalf("friend: %v", err)
	}
	joined := false
	for _, p := range live {
		if _, _, err := s.pnjMeet(ctx, p.ID, "rejoindre"); err == nil {
			joined = s.Activity != nil && s.Activity.PlaceID == p.Activity.PlaceID && s.Activity.Interaction.ID == p.Activity.InteractionID
			break
		} else {
			t.Logf("%s: %v", p.Activity.Label, err)
		}
	}
	if !joined {
		t.Error("no AI player could be joined")
	}
	if _, _, err := s.pnjMeet(ctx, PnjPrefix+"yopougon-1", "saluer"); err != errNotHere {
		t.Fatalf("another commune's: %v", err)
	}
}
