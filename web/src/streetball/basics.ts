import type { Geste, Input, Player } from './game'

// What the match online (online.ts, which the game screen imports to join a match) needs of the game,
// without loading the whole game (game.ts, its rules and its players' AI): it comes with the match.

/** Every skill move, in the order they're offered. */
export const GESTES: Geste[] = ['passement', 'roulette', 'petitpont', 'sombrero', 'crochet', 'aile', 'talonnade', 'jongle', 'crossover', 'entrejambe', 'dos', 'spin', 'hesitation', 'show', 'pompe', 'stepback']

/** The player's hands at rest: the stick centred, no button pressed. */
export const NO_INPUT: Input = { mx: 0, mz: 0, pass: false, shoot: false, skill: false, defend: false, guard: false }

/**
 * The length of one step at a speed (m): short and quick walking, long running (about 1 m at a jog,
 * 1.5 at a run, near 2 sprinting), so the cadence (speed / step) goes from 2 steps a second to over 4.
 */
export const gaitStep = (v: number) => Math.min(1.95, Math.max(0.45, 0.4 + 0.19 * v))

/** A player's step phase (Player.gait) carried on by the ground covered since last time: the host's step, and a phone drawing the host's match (online.ts). */
export function advanceGait(p: Player) {
  const d = Math.hypot(p.x - p.gx, p.z - p.gz)
  p.gx = p.x
  p.gz = p.z
  // (A jump in place: put back, a set piece, a replay: not a step.)
  if (d > 1.2) return
  p.gait = (p.gait + (d / gaitStep(Math.hypot(p.vx, p.vz))) * Math.PI) % (Math.PI * 4096)
}
