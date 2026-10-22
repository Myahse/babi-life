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
const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))
export const useDriving = () => useSyncExternalStore(subscribe, () => current)

/** A model's top speed in town (km/h) as driven in the game's streets (m/s): a little under, the streets are short. */
export const topSpeed = (kmh: number) => (kmh / 3.6) * 0.8
