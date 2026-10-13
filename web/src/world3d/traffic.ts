import type { VehicleKind } from './props'

// The traffic rules of the street scene, kept free of React and three.js.

// Lights at the two cross streets. The boulevard gets green, amber, then red
// while the cross street goes, with a short all-red in between.
const CYCLE = 20
export type Light = 'green' | 'amber' | 'red'
export function boulevardLight(t: number): Light {
  const p = t % CYCLE
  return p < 9 ? 'green' : p < 11 ? 'amber' : 'red'
}
export function crossLight(t: number): Light {
  const p = t % CYCLE
  return p < 11.5 || p >= 19.5 ? 'red' : p < 17.5 ? 'green' : 'amber'
}

// A vehicle on a track (one lane, one direction); s is how far along it is.
export type Mover = { kind: VehicleKind; color?: string; trim?: string; len: number; speed: number; v: number; s: number }
export type Track = {
  length: number
  movers: Mover[]
  /** Where the vehicles' fronts must stop when the light is red. */
  stops: number[]
  light: (t: number) => Light
  place: (s: number) => [number, number]
  rot: number
}

/** Move every vehicle: keep a distance to the one ahead, stop at red lights. */
export function drive(track: Track, t: number, dt: number) {
  const ms = track.movers
  ms.sort((a, b) => a.s - b.s)
  ms.forEach((m, i) => {
    const lead = ms[(i + 1) % ms.length]
    let gap = lead.s - lead.len / 2 - (m.s + m.len / 2)
    if (i === ms.length - 1) gap += track.length
    if (ms.length === 1) gap = Infinity
    const front = m.s + m.len / 2
    let room = gap - 2
    const light = track.light(t)
    for (const stop of track.stops) {
      let d = stop - front
      if (d < -track.length / 2) d += track.length
      if (d < -0.5 || d > 40) continue
      // Amber: stop if there's room to brake, otherwise go through.
      if (light === 'red' || (light === 'amber' && d > (m.v * m.v) / 16)) room = Math.min(room, d)
    }
    const target = room <= 0.3 ? 0 : m.speed * Math.min(1, room / 14)
    m.v += Math.max(-14 * dt, Math.min(6 * dt, target - m.v))
    m.v = Math.max(0, m.v)
    m.s = (m.s + m.v * dt) % track.length
  })
}

