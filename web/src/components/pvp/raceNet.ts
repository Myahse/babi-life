import { standing, type Car, type Race } from '../defi/race/engine'
import type { PvpLine } from './line'

// La course à deux against a real player (update « jeux-en-ligne »): the first
// player's phone runs the race (both cars and the traffic) and sends it whole;
// the other sends its hands, drives on its own between two sends so nothing
// stalls, and takes the race each time it comes, its own car first.

export type RaceVersus = { line: PvpLine; /** This phone runs the race. */ host: boolean; onOver: (first: boolean) => void }

const r3 = (v: number) => Math.round(v * 1000) / 1000

function packCar(c: Car): number[] {
  return [r3(c.x), r3(c.z), r3(c.heading), r3(c.speed), r3(c.steer), c.drift, r3(c.charge), r3(c.boost), r3(c.nitro), r3(c.bump), c.i, r3(c.s), r3(c.d), c.lap, c.half ? 1 : 0, r3(c.progress), c.finished === null ? -1 : r3(c.finished)]
}

function unpackCar(c: Car, v: number[]) {
  Object.assign(c, { x: v[0], z: v[1], heading: v[2], speed: v[3], steer: v[4], drift: v[5], charge: v[6], boost: v[7], nitro: v[8], bump: v[9], i: v[10], s: v[11], d: v[12], lap: v[13], half: v[14] > 0, progress: v[15], finished: v[16] < 0 ? null : v[16] })
}

/** The race in rows of numbers: the clock and the end (the host first or not), the two cars (the host's first), the traffic. */
export function packRace(R: Race): number[][] {
  return [[r3(R.time), R.over ? 1 : 0, r3(R.wait), R.over ? (standing(R).first ? 1 : 0) : -1], packCar(R.cars[0]), packCar(R.cars[1]), R.traffic.map((t) => r3(t.s))]
}

/** The host's race into this phone's, its own car first; whether the host came first, once it's over (else null). */
export function unpackRace(R: Race, b: number[][]): boolean | null {
  const [g, host, guest, traffic] = b
  if (!g || !host || !guest) return null
  R.time = g[0]
  R.wait = g[2]
  unpackCar(R.cars[0], guest)
  unpackCar(R.cars[1], host)
  traffic?.forEach((s, k) => R.traffic[k] && (R.traffic[k].s = s))
  return g[1] > 0 && g[3] >= 0 ? g[3] > 0 : null
}
