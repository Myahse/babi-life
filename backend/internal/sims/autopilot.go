package sims

import (
	"fmt"
	"sort"
	"strings"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// The Sim lives on when the player is away (an online game: the clock never
// stops). Left idle a while (autopilotAfter, so never under the player's
// nose), it does what anyone would at that hour: sleeps at night, eats when
// hungry, washes, goes to work in its hours if its workplace is in the
// commune, naps when worn out. What it did comes back as one line of the
// journal, not a hundred.

// autopilotAfter: game minutes of doing nothing before the Sim acts by itself.
const autopilotAfter = 30

type routineStep struct{ place, interaction string }

// routine: what the Sim would do now, in order of need; the first it can do (interactAt checks age, hours, money, furniture) it does.
func (s *Sim) routine() []routineStep {
	hour := (s.GameMinutes / 60) % 24
	night := hour >= 22 || hour < 6
	var steps []routineStep
	if night && s.Needs.Energy < 80 {
		steps = append(steps, routineStep{HomePlaceID, "sleep"})
	}
	if s.Needs.Hunger < 35 {
		steps = append(steps, routineStep{HomePlaceID, "biberon"}, routineStep{HomePlaceID, "bouillie"}, routineStep{HomePlaceID, "cook-attieke"})
		steps = append(steps, s.nearby("maquis", "eat-garba")...)
	}
	if s.Needs.Hygiene < 35 {
		steps = append(steps, routineStep{HomePlaceID, "bain-bebe"}, routineStep{HomePlaceID, "shower"})
	}
	// Work in its hours (the shift's own: interactAt says no outside them), at a workplace in the commune.
	if s.Career != "" && !night {
		if c, ok := game.FindCareer(s.Career); ok {
			if _, cm, ok := world.FindCommune(s.City, s.Commune); ok {
				for _, p := range cm.Places {
					if c.WorksAt(p.Kind) {
						steps = append(steps, routineStep{p.ID, game.WorkInteractionID})
					}
				}
			}
		}
	}
	if s.Needs.Energy < 25 {
		steps = append(steps, routineStep{HomePlaceID, "nap"})
	}
	return steps
}

// nearby: an interaction at the places of a kind in the Sim's commune.
func (s *Sim) nearby(kind, interaction string) []routineStep {
	var out []routineStep
	if _, cm, ok := world.FindCommune(s.City, s.Commune); ok {
		for _, p := range cm.Places {
			if p.Kind == kind {
				out = append(out, routineStep{p.ID, interaction})
			}
		}
	}
	return out
}

// live: idle, the Sim starts the first thing of its routine it can; false if nothing's needed.
func (s *Sim) live() bool {
	for _, st := range s.routine() {
		if _, err := s.interactAt(st.place, st.interaction); err == nil {
			s.Activity.Auto = true
			return true
		}
	}
	return false
}

// awayLog: what the Sim did by itself, counted, for one line of the journal.
type awayLog struct {
	done  map[string]int
	money int
	from  int64
}

func (l *awayLog) add(label string, money int) {
	if l.done == nil {
		l.done = map[string]int{}
	}
	l.done[label]++
	l.money += money
}

// event: the line of the journal (none if the Sim did nothing by itself).
func (l *awayLog) event(name string, at int64) []Event {
	if len(l.done) == 0 {
		return nil
	}
	labels := make([]string, 0, len(l.done))
	for k := range l.done {
		labels = append(labels, k)
	}
	sort.Slice(labels, func(i, j int) bool {
		return l.done[labels[i]] > l.done[labels[j]] || (l.done[labels[i]] == l.done[labels[j]] && labels[i] < labels[j])
	})
	parts := make([]string, len(labels))
	for i, k := range labels {
		r := []rune(k)
		parts[i] = fmt.Sprintf("%d× %s", l.done[k], strings.ToLower(string(r[:1]))+string(r[1:]))
	}
	return []Event{{Kind: "life", Text: fmt.Sprintf("Pendant ton absence, %s a vécu sa vie : %s.", name, strings.Join(parts, ", ")), Money: l.money, GameTime: at}}
}
