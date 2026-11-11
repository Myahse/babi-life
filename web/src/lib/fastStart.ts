import { api } from './api'
import type { ActionResult, Sim } from './types'

// The update « demarrage-rapide » (lib/features.ts fastStartOpen): what a returning player's first
// screen needs is asked for at once, side by side, instead of one after the other (the world, then
// the game's code, then the Sims, then the street's code), on a slow phone network each wait is a
// second or more.

type Ahead = { at: number; sims: Promise<Sim[]>; sim: Promise<ActionResult | null> }
let ahead: Ahead | null = null
const quiet = <T>(p: Promise<T>) => (p.catch(() => undefined), p)

/**
 * The game's code, asked now (it's big: started while the world, or the creator, is on its way), then the
 * street's: one after the other, the game's screen first (on a slow network they'd share it and both come late).
 */
export function preloadGame() {
  void import('../screens/Play').then(() => import('../world3d/open/OpenWorld')).catch(() => undefined)
}

/**
 * Signed in, the game opening: the Sims and the first Sim's state asked now, the game's code once there's
 * a Sim (`eager`, a player coming back: at once, most have one). The Sims returned.
 */
export function startGame(eager = false): Promise<Sim[]> {
  if (eager) void import('../screens/Play').catch(() => undefined)
  if (ahead && Date.now() - ahead.at < 60_000) return ahead.sims
  const sims = quiet(api.sims())
  // No Sim yet: not the game's code (the creator comes first, App.tsx asks for it meanwhile), nor anything kept.
  void sims.then((s) => (s.length ? preloadGame() : takeStart()), preloadGame)
  ahead = { at: Date.now(), sims, sim: quiet(sims.then((s) => (s.length ? api.sim(s[0].id) : null))) }
  return sims
}

/** What was asked ahead, once and fresh (asked in the last minute), else null: the game asks itself. */
export function takeStart(): Ahead | null {
  const a = ahead
  ahead = null
  return a && Date.now() - a.at < 60_000 ? a : null
}
