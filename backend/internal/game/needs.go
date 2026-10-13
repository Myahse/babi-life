// Package game holds the rules of the simulation: needs, time, interactions
// and the random things that happen to a Sim. It has no I/O so it can be
// unit-tested and tuned freely.
package game

// Needs are the Sim's motives, each between 0 (critical) and 100 (full).
type Needs struct {
	Hunger  float64 `json:"hunger"`
	Energy  float64 `json:"energy"`
	Hygiene float64 `json:"hygiene"`
	Social  float64 `json:"social"`
	Fun     float64 `json:"fun"`
}

func FreshNeeds() Needs {
	return Needs{Hunger: 80, Energy: 85, Hygiene: 90, Social: 70, Fun: 70}
}

// decayPerHour is how much each need drops per hour (real hours: the game runs on real time).
var decayPerHour = Needs{Hunger: 4, Energy: 3, Hygiene: 3, Social: 2.5, Fun: 3}

// Add returns n+d with every need clamped to [0, 100].
func (n Needs) Add(d Needs) Needs {
	return Needs{
		Hunger:  clamp(n.Hunger + d.Hunger),
		Energy:  clamp(n.Energy + d.Energy),
		Hygiene: clamp(n.Hygiene + d.Hygiene),
		Social:  clamp(n.Social + d.Social),
		Fun:     clamp(n.Fun + d.Fun),
	}
}

func (n Needs) Scale(f float64) Needs {
	return Needs{n.Hunger * f, n.Energy * f, n.Hygiene * f, n.Social * f, n.Fun * f}
}

// Mood is the average of all needs; the HUD shows it as the losange colour.
func (n Needs) Mood() float64 {
	return (n.Hunger + n.Energy + n.Hygiene + n.Social + n.Fun) / 5
}

func clamp(v float64) float64 {
	switch {
	case v < 0:
		return 0
	case v > 100:
		return 100
	}
	return v
}

// Decay lowers the needs for the given number of game minutes.
func Decay(n Needs, minutes int64) Needs {
	return n.Add(decayPerHour.Scale(-float64(minutes) / 60))
}
