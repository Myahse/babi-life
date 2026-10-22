// The water-ski défi, between the screen and the 3D: components/defi/Ski.tsx
// holds the buttons and shows how it goes, BoulayScene's Skier skis it. The
// gates are laid on the water ahead of the skier when it begins (buoys to go
// round on the outside, ramps to jump), each judged as the skier passes it.

type XZ = [number, number]
export type SkiGate = { t: number; /** -1 or 1: a buoy on that side; 0: a ramp in the middle. */ side: -1 | 0 | 1; at: XZ; rot: number; result?: 'ok' | 'miss' | 'jump' | 'hop' }

export const skiDefi = {
  /** Asked for by the screen: the Skier lays the gates and starts. */
  requested: false,
  active: false,
  /** When the first gate comes (worldTime seconds): the countdown before it. */
  t0: 0,
  /** The buttons held: -1 to the left, 1 to the right. */
  steer: 0,
  /** When « Sauter » was touched (worldTime seconds). */
  jumpAt: -100,
  gates: [] as SkiGate[],
  /** Bumped when the gates or their results change (to draw them again). */
  version: 0,
  done: false,
}

/** Where the buoys stand off the boat's wake (m); the skier must pass beyond them. */
export const SKI_BUOY = 4.5
/** Seconds between gates; how many; which are ramps. */
export const SKI_GAP = 2.4
export const SKI_SIDES: (-1 | 0 | 1)[] = [1, -1, 1, -1, 0, 1, -1, 1, -1, 0, 1, -1]

export function resetSki() {
  Object.assign(skiDefi, { requested: false, active: false, t0: 0, steer: 0, jumpAt: -100, gates: [], done: false })
  skiDefi.version++
}

/** The score: a point a buoy, two a jump (one for a hop off the ramp without jumping), out of 100. */
export function skiScore(gates: SkiGate[]) {
  const max = gates.reduce((s, g) => s + (g.side === 0 ? 2 : 1), 0) || 1
  const got = gates.reduce((s, g) => s + (g.result === 'ok' || g.result === 'hop' ? 1 : g.result === 'jump' ? 2 : 0), 0)
  return Math.round((got / max) * 100)
}
