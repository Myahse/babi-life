package game

import (
	"fmt"
	"math"
	"math/rand/v2"
	"time"
)

// The game runs on real Abidjan time (UTC+0, no daylight saving). A game
// minute is a real minute, counted from Epoch, a Monday, so HourOf and the
// Saturday arithmetic work on it directly.
var Epoch = time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

// MinuteOf converts a real instant into game minutes.
func MinuteOf(t time.Time) int64 { return int64(t.Sub(Epoch) / time.Minute) }

// TimeOf converts game minutes back into a real instant.
func TimeOf(m int64) time.Time { return Epoch.Add(time.Duration(m) * time.Minute) }

// IdleFloor is as low as a need drops while the Sim is left alone: someone who
// closes the app for a weekend comes back to a tired, hungry Sim, not a dead one.
const IdleFloor = 8

// DecayIdle lowers needs for time the Sim spent doing nothing.
func DecayIdle(n Needs, minutes int64) Needs {
	d := Decay(n, minutes)
	floor := func(before, after float64) float64 { return math.Max(after, math.Min(before, IdleFloor)) }
	return Needs{floor(n.Hunger, d.Hunger), floor(n.Energy, d.Energy), floor(n.Hygiene, d.Hygiene), floor(n.Social, d.Social), floor(n.Fun, d.Fun)}
}

// Activity is what a Sim is busy with: an interaction at a place, or a trip.
// It takes real time; its effect on needs is applied as it goes, and its
// earnings and surprises come at the end.
type Activity struct {
	Kind        string        `json:"kind"` // "do" | "travel"
	PlaceID     string        `json:"placeId,omitempty"`
	PlaceKind   string        `json:"placeKind,omitempty"`
	PlaceName   string        `json:"placeName,omitempty"`
	Interaction Interaction   `json:"interaction"`
	Start       int64         `json:"start"`
	End         int64         `json:"end"`
	Applied     float64       `json:"applied"` // share of the effect already applied, 0..1
	Career      string        `json:"career,omitempty"`
	Surprises   []RandomEvent `json:"surprises,omitempty"`
	Trip        *Trip         `json:"trip,omitempty"`
}

type Trip struct {
	FromCity    string `json:"fromCity"`
	FromCommune string `json:"fromCommune"`
	City        string `json:"city"`
	Commune     string `json:"commune"`
	Mode        string `json:"mode"` // "woro" | "compteur" | "taxi" | "car" | a ride app ID
	Fare        int    `json:"fare"`
	Label       string `json:"label"`
	// Incident is what slowed the trip down, if anything (see TripIncidents).
	Incident string `json:"incident,omitempty"`
}

var ErrBusy = fmt.Errorf("ton Sim est occupé·e : arrête d'abord ce qu'il fait")

// Begin checks an interaction can start now and charges what is paid up front.
func Begin(st State, it Interaction) (State, error) {
	if !it.OpenAt(st.GameMinutes) {
		return st, ErrClosed
	}
	if it.Cost > 0 && st.Money < it.Cost {
		return st, ErrNotEnoughMoney
	}
	if it.Cost > 0 {
		st.Money -= it.Cost
	}
	return st, nil
}

// Progress applies the effect for the time in (from, to] that falls inside
// the activity.
func (a *Activity) Progress(n Needs, from, to int64) Needs {
	dur := float64(a.End - a.Start)
	if dur <= 0 {
		dur = 1
	}
	share := math.Min(1, math.Max(0, float64(to-a.Start)/dur)) - a.Applied
	if share <= 0 {
		return n
	}
	a.Applied += share
	effect := a.Interaction.Effect
	if a.Kind == "travel" {
		effect = Needs{Energy: -float64(a.End-a.Start) / 30}
	}
	return n.Add(effect.Scale(share))
}

// Earned is what the Sim is paid for the share of the activity done.
func (a *Activity) Earned() int {
	if a.Interaction.Cost >= 0 {
		return 0
	}
	return int(math.Round(float64(-a.Interaction.Cost) * a.Applied))
}

// Surprise draws the random event (or none) at the end of an activity.
func (a *Activity) Surprise(rng *rand.Rand) *RandomEvent {
	if a.Kind != "do" || rng.Float64() >= RandomEventChance {
		return nil
	}
	pool := append(append([]RandomEvent{}, a.Surprises...), GenericEvents...)
	ev := pool[rng.IntN(len(pool))]
	return &ev
}
