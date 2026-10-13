package game

import (
	"errors"
)

var (
	ErrNotEnoughMoney = errors.New("pas assez d'argent")
	ErrClosed         = errors.New("pas disponible à cette heure")
)

// State is the part of a Sim that the rules change.
type State struct {
	Needs       Needs `json:"needs"`
	Money       int   `json:"money"`
	GameMinutes int64 `json:"gameMinutes"`
}

// Outcome describes what happened after an action, for the journal.
type Outcome struct {
	Text  string `json:"text"`
	Money int    `json:"money"`
}

// RandomEventChance is the probability that something unexpected happens
// when an activity ends.
const RandomEventChance = 0.35

// Available reports whether the interaction can start at the given game hour.
func (it Interaction) Available(hour int) bool {
	if it.MinHour == 0 && it.MaxHour == 0 {
		return true
	}
	end := it.MaxHour
	if end == 0 {
		end = 24
	}
	if it.MinHour < end {
		return hour >= it.MinHour && hour < end
	}
	// Window wraps past midnight, e.g. 21h → 4h.
	return hour >= it.MinHour || hour < end
}

func (k PlaceKind) Interaction(id string) (Interaction, bool) {
	for _, it := range k.Interactions {
		if it.ID == id {
			return it, true
		}
	}
	return Interaction{}, false
}

func HourOf(gameMinutes int64) int { return int(gameMinutes/60) % 24 }
