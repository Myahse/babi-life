package sims

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Accepting an invitation from another commune of the city: the taxi there, paid by the host when it
// said so (its money down by the fare, the guest's unchanged), or by the guest; the invitation waits,
// on the way, to be joined on arrival.
func TestInviteTrip(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	host := replySim(t, pool, "Yao")
	guest := replySim(t, pool, "Awa")
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE sims SET money = 10000 WHERE id = $1`, host); err != nil {
		t.Fatal(err)
	}
	city, cm, _, ok := world.FindPlace("plateau-pharmacie")
	if !ok {
		t.Skip("no such place")
	}
	var inv string
	if err := tx.QueryRow(ctx, `INSERT INTO invites (from_sim, to_sim, place_id, interaction_id, label, pays) VALUES ($1, $2, 'plateau-pharmacie', 'x', 'x', 'moi') RETURNING id`, host, guest).Scan(&inv); err != nil {
		t.Fatal(err)
	}
	now := game.MinuteOf(time.Now())
	s := &Sim{ID: guest, FirstName: "Awa", Needs: game.FreshNeeds(), Money: 500, City: "abidjan", Commune: "cocody", HomeCity: "abidjan", HomeCommune: "cocody", GameMinutes: now, BornAt: now - game.MinutesToAge(25)}
	h := &Handler{}
	out, _, err := h.inviteTrip(ctx, tx, s, Invite{ID: inv, From: host, PlaceID: "plateau-pharmacie", Pays: "moi"}, "Yao", city, cm)
	if err != nil {
		t.Fatal(err)
	}
	if s.Activity == nil || s.Activity.Trip == nil || s.Activity.Trip.Commune != cm.ID || s.Money != 500 || !strings.Contains(out.Text, "payé par Yao") {
		t.Fatalf("%q money %d %+v", out.Text, s.Money, s.Activity)
	}
	var hostMoney int
	var status string
	_ = tx.QueryRow(ctx, `SELECT money FROM sims WHERE id = $1`, host).Scan(&hostMoney)
	_ = tx.QueryRow(ctx, `SELECT status FROM invites WHERE id = $1`, inv).Scan(&status)
	if hostMoney != 10000-s.Activity.Trip.Fare || s.Activity.Trip.Fare <= 0 || status != "travelling" {
		t.Fatalf("host %d, fare %d, status %s", hostMoney, s.Activity.Trip.Fare, status)
	}
	// The guest paying: its own money.
	s2 := &Sim{ID: guest, FirstName: "Awa", Needs: game.FreshNeeds(), Money: 500, City: "abidjan", Commune: "cocody", HomeCity: "abidjan", HomeCommune: "cocody", GameMinutes: now, BornAt: now - game.MinutesToAge(25)}
	if _, _, err := h.inviteTrip(ctx, tx, s2, Invite{ID: inv, From: host, PlaceID: "plateau-pharmacie", Pays: "toi"}, "Yao", city, cm); err != nil || s2.Money >= 500 {
		t.Fatalf("guest paying: %v, money %d", err, s2.Money)
	}
}
