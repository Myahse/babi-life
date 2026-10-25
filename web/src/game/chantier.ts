import { serverNow } from '../lib/worldClock'

// A house built from a plan goes up over time on its lot (backend sims/plot.go):
// the masons are at it, the Sim is free meanwhile.

/** Whether a lot's house is still going up. */
export const building = (p: { buildUntil?: string }) => !!p.buildUntil && Date.parse(p.buildUntil) > serverNow()

/** When it'll be done, as the game's clock says it (Abidjan time): « 18 h 42 ». */
export const doneAt = (p: { buildUntil?: string }) => {
  const d = new Date(p.buildUntil ?? 0)
  return `${String(d.getUTCHours()).padStart(2, '0')} h ${String(d.getUTCMinutes()).padStart(2, '0')}`
}
