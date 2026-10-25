package sims

import (
	"fmt"
	"strings"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The experience of what the Sim does (game/progress.go): each activity, done
// to its end or stopped (for the part done), adds to the player's level and to
// the skills it trains; what goes up is said in the journal.

// gain: an activity's experience, share the part of it done (1: to its end).
func (s *Sim) gain(a *game.Activity, share float64) game.Gain {
	if a == nil || a.Kind != "do" || a.PlaceID == custodyPlace {
		return game.Gain{}
	}
	// (Started before experience was counted: the least.)
	xp := int(float64(max(2, a.XP)) * min(1, max(0, share)))
	return s.Progress.Add(xp, game.Trains(a.Interaction.ID, a.PlaceKind, a.Career))
}

// gainBuilding: a house built or furnished: experience for the player and the Bâtisseur skill.
func (s *Sim) gainBuilding(xp int) []Event {
	return progressEvents(s.Progress.Add(min(150, xp), []string{game.SkillBatisseur}), s.GameMinutes)
}

// progressLines: what went up, as said: the skills' new levels and what they open, the player's level.
func progressLines(g game.Gain) []string {
	var out []string
	for _, l := range g.SkillUps {
		out = append(out, "Compétence "+l+".")
	}
	if g.LevelUp > 0 {
		line := fmt.Sprintf("Niveau %d atteint !", g.LevelUp)
		if len(g.Opened) > 0 {
			line += " Nouvelle compétence : " + strings.Join(g.Opened, ", ") + "."
		}
		out = append(out, line)
	}
	return out
}

// progressEvents: the journal lines of what went up.
func progressEvents(g game.Gain, at int64) []Event {
	var out []Event
	for _, l := range progressLines(g) {
		out = append(out, Event{Kind: "progress", Text: l, GameTime: at})
	}
	return out
}
