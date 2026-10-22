import type { HomeSpot } from './Walker'
import type { Pose } from '../avatar/Human'

// Where things are in the 3D street, shared with the screen around it: the
// Sim, which way the camera looks, the places and the streets. The 3D scene
// writes it as it runs; the mini-map and the « Où aller ? » list read it.

type XZ = [number, number]

export const whereabouts = {
  sim: [0, 0] as XZ,
  /** The Sim's height (up on a bridge), which way it faces, and what it's doing: sent to the other players (lib/live.ts). */
  simY: 0,
  simHeading: 0,
  simPose: 'idle' as Pose,
  /** Camera heading: the angle (radians) of the way the camera looks, on the ground. 0 is north, clockwise. */
  heading: 0,
  /** Angle from straight down (radians). 0 is overhead, π/2 is the horizon. */
  polar: 0.9,
  places: [] as { id: string; kind: string; name: string; door: XZ }[],
  /** Street segments: from, to, width. */
  roads: [] as [XZ, XZ, number][],
  water: [] as XZ[][],
  /** Who the Sim is talking to stands here: the Sim turns to face them (Walker.tsx). */
  faceTo: null as XZ | null,
  /** On the way to somewhere (Walker.tsx): where (a place's name, or null for a spot), how far is left (m), how fast it goes (m/s), how. */
  way: null as { to: string | null; left: number; speed: number; how: 'walk' | 'run' | 'moto' | 'taxi' | 'woro' | 'gbaka' } | null,
  /** The street's pitch or court the Sim plays on with the quartier (streetlife.tsx): its middle, its length's way, half its length to run. */
  pitch: null as { at: XZ; dir: XZ; half: number } | null,
  /** The street scene the Sim joined (open/joinIn.tsx): which (its vendor id), for which activity, its place in it. */
  joined: null as { id: string; activity: string; spot: HomeSpot } | null,
  /** Is there room for the Sim's body here (Walker.tsx)? */
  roomAt: (_x: number, _z: number) => true,
}

// In development, for tests in the browser.
if (import.meta.env.DEV) (globalThis as unknown as { whereabouts: typeof whereabouts }).whereabouts = whereabouts

export const distanceTo = (p: XZ) => Math.hypot(p[0] - whereabouts.sim[0], p[1] - whereabouts.sim[1])

/** Direction of p seen from the Sim, relative to where the camera looks (0 = straight ahead, clockwise). */
export function bearingTo(p: XZ) {
  const a = Math.atan2(p[0] - whereabouts.sim[0], -(p[1] - whereabouts.sim[1]))
  return a - whereabouts.heading
}
