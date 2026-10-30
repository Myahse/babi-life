import * as THREE from 'three'

// The aim-and-throw game's ground (Viser.tsx): where the thing thrown starts, where the target
// stands, the arc it flies along. Shared with the Sim who throws it (ViserSport.tsx).

export type Phase = 'aim' | 'power' | 'fly' | 'after'
/** What the 3D reads and writes each frame. */
export type Live = {
  phase: Phase; t: number; a: number; pw: number; tx: number; c: THREE.Vector3 | null; ideal: [number, number]; shot: number; hit: number; flyT: number; end: number; d: number; out: THREE.Vector3
  /** Seconds since the tap, before the ball leaves (the run-up and the kick, the shot's gather). */
  wind: number
  /** The Sim's right fist (the ball in it before the shot), when it has one. */
  hand: THREE.Object3D | null
  /** Where the ball really left from, off the arc's start (eased away as it flies). */
  from: THREE.Vector3
}

export const P0 = new THREE.Vector3(0, 0.45, 2.6)
export const TZ = -2.4
export const R = 0.85

export const dirOf = (a: number) => new THREE.Vector3(Math.sin(a), 0, -Math.cos(a))
export const distOf = (pw: number) => 1.2 + pw * 7
/** Where the thrown thing is, s of the way (0..1) along its arc. */
export function arc(a: number, d: number, s: number, out = new THREE.Vector3()) {
  out.copy(P0).addScaledVector(dirOf(a), d * s)
  out.y = P0.y * (1 - s) + (0.9 + d * 0.24) * 4 * s * (1 - s)
  return out
}
/** How near the arc comes to the target's middle, and where along it. */
export function nearest(a: number, d: number, c: THREE.Vector3) {
  let best = Infinity
  let at = 1
  const v = new THREE.Vector3()
  for (let i = 0; i <= 80; i++) {
    const k = arc(a, d, i / 80, v).distanceTo(c)
    if (k < best) [best, at] = [k, i / 80]
    if (k < R * 0.4) break
  }
  return { best, at }
}
