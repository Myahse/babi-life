package sims

import (
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Away a day and a night: the Sim slept, ate and washed by itself, and
// it's one line of the journal; it's in better shape than left to waste away.
func TestLivesWhileAway(t *testing.T) {
	low := game.Needs{Hunger: 20, Energy: 20, Hygiene: 20, Social: 50, Fun: 50}
	s := newSim()
	s.Money, s.Needs = 50000, low
	ev := s.advance(noon.Add(20*time.Hour), noLuck())
	var line string
	for _, e := range ev {
		if strings.HasPrefix(e.Text, "Pendant ton absence") {
			line = e.Text
		}
		if e.Kind == "interaction" {
			t.Errorf("one line only, not each thing: %q", e.Text)
		}
	}
	t.Log(line)
	if !strings.Contains(line, "dormir") {
		t.Fatalf("didn't sleep: %q", line)
	}
	idle := game.DecayIdle(low, 20*60)
	if s.Needs.Energy <= idle.Energy || s.Needs.Hunger <= idle.Hunger {
		t.Errorf("no better than idle: %+v vs %+v", s.Needs, idle)
	}
	// Played a minute ago: the Sim waits for the player.
	s = newSim()
	s.Needs = low
	if ev := s.advance(noon.Add(10*time.Minute), noLuck()); s.Activity != nil || len(ev) != 0 {
		t.Errorf("acted under the player's nose: %+v %+v", s.Activity, ev)
	}
}
