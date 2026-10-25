package sims

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// At the maquis's machine: the stake taken, what it wins paid, the spins of
// the day counted, and the session told at the end.
func TestMachineSpins(t *testing.T) {
	s := adultSim(game.Families[0], "")
	s.City, s.Commune = "abidjan", "cocody"
	s.Money = 100_000
	s.GameMinutes = game.MinuteOf(monday.Add(20 * time.Hour))
	if _, _, err := s.spin(100, noLuck()); !errors.Is(err, errNoMachine) {
		t.Fatalf("no machine: %v", err)
	}
	if _, err := s.interactAt("cocody-danga", game.SlotsMaquisID); err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.spin(1000, noLuck()); !errors.Is(err, errSlotStake) {
		t.Errorf("1 000 at the maquis: %v", err)
	}
	before := s.Money
	rng := noLuck()
	staked, won := 0, 0
	for range 150 {
		out, _, err := s.spin(200, rng)
		if err != nil {
			t.Fatal(err)
		}
		staked += 200
		won += out.Money + 200
	}
	m := s.Activity.Machine
	if m.Spins != 150 || m.Staked != staked || m.Won != won || s.Money != before-staked+won {
		t.Errorf("session %+v, money %d (from %d, staked %d, won %d)", m, s.Money, before, staked, won)
	}
	// The day's spins run out.
	for range game.SlotsPerDay - 150 {
		if _, _, err := s.spin(100, rng); err != nil {
			t.Fatal(err)
		}
	}
	if _, _, err := s.spin(100, rng); err == nil || !strings.Contains(err.Error(), "reviens demain") {
		t.Errorf("past %d spins: %v", game.SlotsPerDay, err)
	}
	// Leaving the machine tells the session.
	ev, err := s.stop()
	if err != nil || !strings.Contains(ev.Text, "200 tours") || ev.Money != s.Money-before {
		t.Errorf("left the machine: %q %d, %v", ev.Text, ev.Money, err)
	}
}

// A child can't sit at one, nor can the machines be played for a stake not offered.
func TestMachineAdultsOnly(t *testing.T) {
	s := adultSim(game.Families[0], "")
	s.City, s.Commune = "abidjan", "cocody"
	s.GameMinutes = game.MinuteOf(monday.Add(20 * time.Hour))
	s.BornAt = s.GameMinutes - game.MinutesToAge(12)
	if _, err := s.interactAt("cocody-danga", game.SlotsMaquisID); err == nil {
		t.Error("a child at the slot machine")
	}
}
