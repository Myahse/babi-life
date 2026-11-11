package sims

import (
	"context"
	"fmt"
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
	pool := replyDB(t)
	id := replySim(t, pool, "Awa")
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	s := &Sim{ID: id, FirstName: "Awa", Gender: "femme", Needs: game.FreshNeeds(), Money: 20000, City: "abidjan", Commune: "cocody", HomeCity: "abidjan", HomeCommune: "cocody", GameMinutes: game.MinuteOf(time.Now())}
	s.BornAt = s.GameMinutes - game.MinutesToAge(30)
	live := pnjAt(ctx, "abidjan", "cocody", time.Now(), 0)
	// Greeted, then again: remembered.
	out, _, err := s.pnjMeet(ctx, tx, live[0].ID, "saluer")
	if err != nil || !strings.Contains(out.Text, "PNJ") || !strings.Contains(out.Text, "Bonne arrivée") {
		t.Fatalf("greet: %q %v", out.Text, err)
	}
	for range 2 {
		out, _, _ = s.pnjMeet(ctx, tx, live[0].ID, "saluer")
	}
	if !strings.Contains(out.Text, "Encore toi") {
		t.Fatalf("not remembered: %q", out.Text)
	}
	if _, _, err := s.pnjMeet(ctx, tx, live[0].ID, "ajouter"); err != errPnjFriend {
		t.Fatalf("friend: %v", err)
	}
	// An invitation (when this slot has one): answered, not asked again.
	if in := pnjInvite(ctx, tx, id, "abidjan", "cocody", time.Now(), live); in != nil {
		if _, _, err := s.pnjAnswer(ctx, tx, in.ID, "refuser"); err != nil {
			t.Fatal(err)
		}
		if pnjInvite(ctx, tx, id, "abidjan", "cocody", time.Now(), live) != nil {
			t.Fatal("asked again after answering")
		}
	}
	// Answering one (built here: not every slot has one): remembered for that slot.
	inv := live[1].ID + pnjInviteSep + fmt.Sprint(time.Now().Unix()/int64(PnjSlot.Seconds()))
	if out, _, err := s.pnjAnswer(ctx, tx, inv, "refuser"); err != nil || !strings.Contains(out.Text, "une autre fois") {
		t.Fatalf("refused: %q %v", out.Text, err)
	}
	if _, _, err := s.pnjAnswer(ctx, tx, live[1].ID+pnjInviteSep+"12", "accepter"); err != errInviteGone {
		t.Fatalf("an old invitation: %v", err)
	}
	joined := false
	for _, p := range live {
		if p.Activity == nil {
			continue // nothing open found for it at this hour: it walks about
		}
		if _, _, err := s.pnjMeet(ctx, tx, p.ID, "rejoindre"); err == nil {
			joined = s.Activity != nil && s.Activity.PlaceID == p.Activity.PlaceID && s.Activity.Interaction.ID == p.Activity.InteractionID
			break
		} else {
			t.Logf("%s: %v", p.Activity.Label, err)
		}
	}
	if !joined {
		t.Error("no AI player could be joined")
	}
	if _, _, err := s.pnjMeet(ctx, tx, PnjPrefix+"yopougon-1", "saluer"); err != errNotHere {
		t.Fatalf("another commune's: %v", err)
	}
}
