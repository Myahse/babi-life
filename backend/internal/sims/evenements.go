package sims

import (
	"context"
	"fmt"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// The happenings played (the update « evenements-joues », game/happenings_joues.go): each choice is the
// défi « evenement », played as its own little game (web components/defi/jeux/configs/evenements.ts).
// Played, it's done at once (homeDone: all its good played well, a little less played badly; what it
// pays, the same); played badly, its mishap comes.

// eventsOpen: whether the happenings are played (no store, the tests: open). A var, so tests can close it.
var eventsOpen = func(ctx context.Context) bool {
	return features.Default.BlocksKey(ctx, game.EventsKey) == ""
}

// EventsOpen: the same, for the API's /happening (cmd/api).
func EventsOpen(ctx context.Context) bool { return eventsOpen(ctx) }

// eventLines: what's said after a choice, played badly, well, perfectly.
var eventLines = [3]string{"%s : pas terrible, mais tu as essayé.", "%s : bien joué, le quartier apprécie !", "%s : parfait, tout le quartier en parle !"}

// eventLine: the line said for a choice at a tier.
func eventLine(interaction string, tier int) string {
	label := "L'événement"
	if c, _, ok := game.FindEventChoice(interaction); ok {
		label = c.Label
	}
	return fmt.Sprintf(eventLines[tier], label)
}

// eventMishap: played badly (under game.MishapScore), the choice's mishap: its effect, what it costs (as
// far as the money goes; a child pays nothing), said after the line. The money it took.
func eventMishap(s *Sim, interaction string, score int, text string) (string, int) {
	c, _, ok := game.FindEventChoice(interaction)
	if !ok || c.Mishap == nil || score >= game.MishapScore {
		return text, 0
	}
	m := c.Mishap
	s.Needs = s.Needs.Add(m.Effect)
	paid := 0
	if m.Money < 0 && !s.minor() {
		paid = min(-m.Money, max(s.Money, 0))
		s.Money -= paid
	}
	return text + " " + m.Text, paid
}
