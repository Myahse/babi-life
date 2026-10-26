package sims

import (
	"errors"
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Bingo cards: the stake offered, four a draw, the day's cards, the money; adults only.
func TestBingoCards(t *testing.T) {
	s := adultSim(game.Families[0], "")
	s.Money = 1_000_000
	if _, err := s.bingoCards("poker", 1, 100, 0, noLuck()); !errors.Is(err, errBingoGame) {
		t.Errorf("unknown room: %v", err)
	}
	// Any amount typed, from the least card to the dearest.
	if _, err := s.bingoCards(game.Loto90, 1, 50, 0, noLuck()); !errors.Is(err, errBingoStake) {
		t.Errorf("50 a card: %v", err)
	}
	if _, err := s.bingoCards(game.Loto90, 1, 1500, 0, noLuck()); !errors.Is(err, errBingoStake) {
		t.Errorf("1 500 a card: %v", err)
	}
	if _, err := s.bingoCards(game.Loto90, 2, 100, 3, noLuck()); !errors.Is(err, errBingoCards) {
		t.Errorf("five cards on a draw: %v", err)
	}
	before := s.Money
	cards, err := s.bingoCards(game.Bingo75, 4, 500, 0, noLuck())
	if err != nil || len(cards) != 4 || len(cards[0]) != 25 || s.Money != before-2000 {
		t.Fatalf("4 cards at 500: %d cards, money %d (from %d), %v", len(cards), s.Money, before, err)
	}
	// The day's cards run out.
	for range (game.BingoPerDay - 4) / 4 {
		if _, err := s.bingoCards(game.Eclair, 4, 100, 0, noLuck()); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := s.bingoCards(game.Eclair, 1, 100, 0, noLuck()); err == nil || !strings.Contains(err.Error(), "reviens demain") {
		t.Errorf("past %d cards: %v", game.BingoPerDay, err)
	}
	poor := adultSim(game.Families[0], "")
	poor.Money = 300
	if _, err := poor.bingoCards(game.Loto90, 1, 500, 0, noLuck()); !errors.Is(err, game.ErrNotEnoughMoney) {
		t.Errorf("300 for a card at 500: %v", err)
	}
	kid := adultSim(game.Families[0], "")
	kid.BornAt = kid.GameMinutes - game.MinutesToAge(12)
	if _, err := kid.bingoCards(game.Loto90, 1, 100, 0, noLuck()); !errors.Is(err, errBingoMinor) {
		t.Errorf("a child at bingo: %v", err)
	}
}
