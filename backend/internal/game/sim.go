package game

import (
	"errors"
	"fmt"
	"math/rand/v2"
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
	Text   string       `json:"text"`
	Money  int          `json:"money"`
	Random *RandomEvent `json:"random,omitempty"`
	// Promotion is set when a work shift earned the Sim a new job title.
	Promotion string `json:"promotion,omitempty"`
	// Bills are the Saturday charges (rent, loan) settled during the action.
	Bills []Bill `json:"bills,omitempty"`
}

type Bill struct {
	Text  string `json:"text"`
	Money int    `json:"money"`
}

// RandomEventChance is the probability that something unexpected happens
// after an interaction.
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

// Perform runs an interaction and maybe a random event.
func Perform(st State, kind PlaceKind, it Interaction, rng *rand.Rand) (State, Outcome, error) {
	if !it.Available(HourOf(st.GameMinutes)) {
		return st, Outcome{}, ErrClosed
	}
	if it.Cost > 0 && st.Money < it.Cost {
		return st, Outcome{}, ErrNotEnoughMoney
	}

	st.Needs = Decay(st.Needs, it.Minutes).Add(it.Effect)
	st.Money -= it.Cost
	st.GameMinutes += it.Minutes
	out := Outcome{Text: fmt.Sprintf("%s — %s", kind.Label, it.Label), Money: -it.Cost}

	if rng.Float64() < RandomEventChance {
		pool := append(append([]RandomEvent{}, kind.Events...), GenericEvents...)
		ev := pool[rng.IntN(len(pool))]
		st.Needs = st.Needs.Add(ev.Effect)
		st.Money += ev.Money
		out.Random = &ev
	}
	return st, out, nil
}

// Travel moves the Sim, costing time and money.
func Travel(st State, minutes int64, fare int) (State, error) {
	if st.Money < fare {
		return st, ErrNotEnoughMoney
	}
	st.Needs = Decay(st.Needs, minutes).Add(Needs{Energy: -float64(minutes) / 30})
	st.Money -= fare
	st.GameMinutes += minutes
	return st, nil
}

func HourOf(gameMinutes int64) int { return int(gameMinutes/60) % 24 }
