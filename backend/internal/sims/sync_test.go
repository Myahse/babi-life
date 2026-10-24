package sims

import (
	"context"
	"math/rand/v2"
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// beats: the game open and seen, saying so every minute in (from, to].
func beats(from, to time.Time) []syncStep {
	var steps []syncStep
	for at := from.Add(time.Minute); !at.After(to); at = at.Add(time.Minute) {
		steps = append(steps, syncStep{At: at.UnixMilli(), Do: "beat"})
	}
	return steps
}

func replayed(t *testing.T, s *Sim, steps []syncStep, now time.Time, done int64) (game.Outcome, int64) {
	t.Helper()
	p := &replay{s: s, rng: rand.New(neverSource{}), playing: s.pausedAt == nil, last: s.lastTick}
	out, done, err := (&Handler{}).replaySync(context.Background(), nil, p, steps, 0, now, done, nil)
	if err != nil {
		t.Fatal(err)
	}
	return out, done
}

// Played offline: selling at the market, paid at the end; the phone put away for hours, nothing
// went by meanwhile; what couldn't be done is said; sent again, nothing is counted twice.
func TestSyncReplaysOffline(t *testing.T) {
	s := newSim()
	steps := beats(noon, noon.Add(time.Minute))
	steps = append(steps, syncStep{At: noon.Add(time.Minute).UnixMilli() + 1, Do: "interact", PlaceID: "yop-marche", InteractionID: "sell-goods", Label: "Vendre au marché"})
	steps = append(steps, beats(noon.Add(time.Minute), noon.Add(12*time.Minute))...)
	steps = append(steps, syncStep{At: noon.Add(12 * time.Minute).UnixMilli() + 1, Do: "pause"})
	back := noon.Add(5 * time.Hour)
	steps = append(steps, syncStep{At: back.UnixMilli(), Do: "beat"}, syncStep{At: back.UnixMilli() + 1, Do: "stop"})
	now := back.Add(30 * time.Second)

	out, done := replayed(t, &s, steps, now, 0)
	if s.Activity != nil || s.Money != 14000 {
		t.Fatalf("the selling done and paid: activity %+v money %d", s.Activity, s.Money)
	}
	if s.GameMinutes != game.MinuteOf(now) || !s.lastTick.Equal(now) || s.pausedAt != nil {
		t.Errorf("the Sim's clock is the world's: %d want %d (last %v)", s.GameMinutes, game.MinuteOf(now), s.lastTick)
	}
	// Five hours put away: the needs as after a quarter of an hour, not five hours.
	if fresh := game.FreshNeeds(); s.Needs.Hunger < fresh.Hunger-3 {
		t.Errorf("held while put away: hunger %.1f from %.1f", s.Needs.Hunger, fresh.Hunger)
	}
	if !strings.Contains(out.Text, "est compté") || !strings.Contains(out.Text, "Arrêter : ton perso ne fait rien") {
		t.Errorf("said: %q", out.Text)
	}
	if done != back.UnixMilli()+1 {
		t.Errorf("the latest step counted: %d", done)
	}

	// The answer lost, sent again: the same steps, nothing more.
	money, needs := s.Money, s.Needs
	out, _ = replayed(t, &s, steps, now.Add(10*time.Second), done)
	if s.Money != money || s.Needs != needs || !strings.Contains(out.Text, "à jour") {
		t.Errorf("counted twice: money %d needs %+v said %q", s.Money, s.Needs, out.Text)
	}
}

// Gone without a word offline (the app killed, the phone dead): lived a minute after the last sign, then held.
func TestSyncHoldsAfterSilence(t *testing.T) {
	s := newSim()
	steps := []syncStep{{At: noon.Add(time.Minute).UnixMilli(), Do: "interact", PlaceID: "yop-marche", InteractionID: "sell-goods"}}
	steps = append(steps, beats(noon.Add(time.Minute), noon.Add(3*time.Minute))...)
	back := noon.Add(2 * time.Hour)
	steps = append(steps, syncStep{At: back.UnixMilli(), Do: "beat"})
	replayed(t, &s, steps, back.Add(30*time.Second), 0)
	if s.Activity == nil {
		t.Fatal("still selling")
	}
	if left := s.Activity.End - s.GameMinutes; left != 7 {
		t.Errorf("3 min played and 1 after the last sign: 7 left, got %d", left)
	}
}
