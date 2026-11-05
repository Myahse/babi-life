package sims

import (
	"context"
	"math"
	"slices"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// Le mode vie (the update « mode-vie », web game/lifeMode.ts, components/LifeHud.tsx): the player watches
// the Sim live, taps the house's objects and its family, queues orders, and the Sim gets by on its own
// when nothing is asked (free will). Every order is still an ordinary action sent here (interact,
// fridge/eat, chat): the needs, the money and the clock stay the server's.
//
// The games become optional. Where an action is played (the update « gestes-maison »: no clock, its game
// ends it), one asked with `auto` plays by itself instead: it takes its ordinary time again (game.Length,
// so it can't be done faster than the clock), and counts as a game played fairly well (AutoScore) — the
// same share of its good and its pay as that score would give (playDefi, homeDone). Played after all
// while it lasts (« Jouer pour un meilleur résultat »), the game's own score counts, up to 100.

// LifeModeKey: the update, web lib/features.ts.
const LifeModeKey = "mode-vie"

// AutoScore: what an action left to play by itself counts as (the game played can earn up to 100).
const AutoScore = 65

// lifeModeOpen: the update is open with the players.
func lifeModeOpen(ctx context.Context) bool {
	return features.Default != nil && features.Default.BlocksKey(ctx, LifeModeKey) == ""
}

// playedWell: the share of an action's good (and pay) a game's score gives (homeDone).
func playedWell(score int) float64 {
	return 0.6 + 0.4*float64(score)/100
}

// autoPlay: the action just started is to play by itself. played: actions are played, not timed
// (playedNoClock). Only an action that would wait for its game changes: its clock back, its good
// and pay scaled to AutoScore; any other one goes on as ever (its clock, all its good).
func autoPlay(a *game.Activity, played bool) {
	if a == nil || a.Kind != "do" || a.Auto != nil || a.Defi > 0 || !played {
		return
	}
	if !gesteOK(a) && !slices.Contains(homeDefis, defiOf(a.Interaction.ID)) {
		return
	}
	it := &a.Interaction
	a.Auto = &game.AutoPlay{Score: AutoScore, Effect: it.Effect, Cost: it.Cost}
	a.End = a.Start + max(it.Minutes, 1)
	well := playedWell(AutoScore)
	good := func(v float64) float64 {
		if v > 0 {
			return math.Round(v*well*10) / 10
		}
		return v
	}
	it.Effect = game.Needs{Hunger: good(it.Effect.Hunger), Energy: good(it.Effect.Energy), Hygiene: good(it.Effect.Hygiene), Social: good(it.Effect.Social), Fun: good(it.Effect.Fun)}
	if it.Cost < 0 {
		it.Cost = int(math.Round(float64(it.Cost) * well))
	}
}

// unAuto: the game played after all: the action's whole good and pay back, for its score to scale.
func unAuto(a *game.Activity) {
	if a == nil || a.Auto == nil {
		return
	}
	a.Interaction.Effect, a.Interaction.Cost = a.Auto.Effect, a.Auto.Cost
	a.Auto = nil
}
