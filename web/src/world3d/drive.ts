import { useSyncExternalStore } from 'react'

// Driving one's own vehicle in the street (backend sims/garage.go): the Bolide
// app (screens/BolideApp.tsx) starts it, Play's DriveHud holds the pedals and
// the wheel, the Walker drives it (and the keys, and the pad). What's driven,
// the hands on the controls, how fast it goes and how far it has gone: the
// petrol is paid on that when it's parked.

export type Driven = { id: number; kind: 'velo' | 'moto' | 'voiture'; body: string; color: string; name: string; /** m/s */ top: number }

/** How each kind handles: pick-up and brakes (m/s²), turning (rad/s at speed), reverse (m/s), its body's half-length (m). */
export const HANDLING: Record<Driven['kind'], { accel: number; brake: number; turn: number; reverse: number; half: number; width: number }> = {
  velo: { accel: 1.8, brake: 5, turn: 2.6, reverse: 0, half: 0.8, width: 0.35 },
  moto: { accel: 4.5, brake: 8, turn: 2.3, reverse: 0, half: 1, width: 0.4 },
  voiture: { accel: 3.6, brake: 9, turn: 1.7, reverse: 3.5, half: 2.3, width: 0.95 },
}

let current: Driven | null = null
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((f) => f())

/** The hands (the on-screen pedals and wheel: -1…1), and what the Walker measures. */
export const drive = { throttle: 0, steer: 0, speed: 0, metres: 0, bumped: 0 }

export function startDrive(v: Driven) {
  current = v
  Object.assign(drive, { throttle: 0, steer: 0, speed: 0, metres: 0, bumped: 0 })
  // Taken out from the app while it stood parked somewhere: it's here now.
  if (parked?.v.id === v.id && !getIn.at) setParked(null)
  changed()
}
/** Parked: how far it went (m). */
export function stopDrive() {
  const m = Math.round(drive.metres)
  current = null
  Object.assign(drive, { throttle: 0, steer: 0, speed: 0 })
  changed()
  return m
}
/** Read in the frame loop. */
export const driving = () => current

/**
 * The vehicle left parked in the street: whose, which, where (against the
 * kerb, the way it faces), in which commune. It stays there, drawn, until
 * the Sim gets back in (kept on the phone: back in the game, it's where it
 * was left).
 */
export type Parked = { sim: string; v: Driven; x: number; z: number; h: number; commune: string }
const PARKED = 'babi.parked'
let parked: Parked | null = (() => {
  try {
    return JSON.parse(localStorage.getItem(PARKED) ?? 'null') as Parked | null
  } catch {
    return null
  }
})()
export const parkedNow = () => parked
export function setParked(p: Parked | null) {
  parked = p
  try {
    if (p) localStorage.setItem(PARKED, JSON.stringify(p))
    else localStorage.removeItem(PARKED)
  } catch {
    // Private mode: it stays parked until the page closes.
  }
  changed()
}
/** Parking now (Play's « Garer »): in which commune; the Walker sets the vehicle against the kerb and the Sim on the sidewalk. */
export const parkIn: { commune: string | null } = { commune: null }
/** Getting back in: the spot the Walker sets off from (else the nearest street). */
export const getIn: { at: { x: number; z: number; h: number } | null } = { at: null }

type XZ = [number, number]
/**
 * The GPS: where to (a place), the way there by the streets (the Walker works
 * it out from where the car is, again when it strays), how far is left and
 * the next thing to do: turn left or right in so many metres, or arrive.
 */
export const gps = {
  to: null as { id: string; name: string; door: XZ } | null,
  way: null as XZ[] | null,
  left: 0,
  next: null as { turn: 'left' | 'right' | 'straight' | 'arrive' | 'uturn'; in: number } | null,
  /** No way there by the streets (they don't join up, or not loaded that far): how far the place is as the crow flies. */
  lost: 0,
}
const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))
export const useDriving = () => useSyncExternalStore(subscribe, () => current)
export const useParked = () => useSyncExternalStore(subscribe, () => parked)

/** A model's top speed in town (km/h) as driven in the game's streets (m/s): a little under, the streets are short. */
export const topSpeed = (kmh: number) => (kmh / 3.6) * 0.8

/** Where a point is along a way: the segment it's nearest, how far along that segment (0–1), how far off the way, and how far from its start. */
export function onWay(way: XZ[], x: number, z: number) {
  let best = { i: 0, t: 0, d: Infinity, from: 0 }
  let run = 0
  for (let i = 1; i < way.length; i++) {
    const [ax, az] = way[i - 1]
    const [bx, bz] = way[i]
    const [dx, dz] = [bx - ax, bz - az]
    const len = Math.hypot(dx, dz)
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (len * len))) : 0
    const d = Math.hypot(ax + dx * t - x, az + dz * t - z)
    if (d < best.d) best = { i, t, d, from: run + len * t }
    run += len
  }
  return best
}

/** The GPS's next instruction for a car at (x, z) heading h on the way: turn at the next corner, carry on, turn round, or arrive. */
export function nextTurn(way: XZ[], x: number, z: number, h: number): { left: number; next: NonNullable<typeof gps.next> } {
  const o = onWay(way, x, z)
  const seg = (k: number) => Math.hypot(way[k][0] - way[k - 1][0], way[k][1] - way[k - 1][1])
  const head = (k: number) => Math.atan2(way[k][0] - way[k - 1][0], way[k][1] - way[k - 1][1])
  let left = seg(o.i) * (1 - o.t)
  for (let k = o.i + 1; k < way.length; k++) left += seg(k)
  if (left < 18) return { left, next: { turn: 'arrive', in: left } }
  // Facing away from the way: turn round first.
  if (Math.cos(head(o.i) - h) < -0.5) return { left, next: { turn: 'uturn', in: 0 } }
  let dist = seg(o.i) * (1 - o.t)
  for (let k = o.i; k < way.length - 1; k++) {
    // A corner: the way turns more than a third of a right angle there (short kinks don't count).
    const turn = Math.atan2(Math.sin(head(k + 1) - head(k)), Math.cos(head(k + 1) - head(k)))
    if (Math.abs(turn) > 0.55 && seg(k + 1) > 4) return { left, next: { turn: turn > 0 ? 'left' : 'right', in: dist } }
    dist += seg(k + 1)
  }
  return { left, next: { turn: 'straight', in: left } }
}

// In development, for tests in the browser.
if (import.meta.env.DEV) (globalThis as unknown as { __drive: unknown }).__drive = { drive, gps, startDrive, stopDrive, parkedNow, driving, onWay }
