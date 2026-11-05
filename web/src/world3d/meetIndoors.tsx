import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { gazeTarget } from '../avatar/expressions'
import { indoorMeet, indoorSim, indoorWalker, meeting } from './meet'
import { useTalking } from './talk'

// Meeting someone inside a place (world3d/meet.ts, indoors): the room's walker (Interior.tsx WalkTo,
// HomeInside.tsx Walking) takes the walk up asked, finds where to stop (a step from them, on the side the
// Sim comes from, on free floor: not in a table, a counter, someone else), walks there round what's in the
// way, turns to them and they greet each other, as in the street. The camera frames the two of them while
// they talk, and goes back to where the player had it after.

type XZ = [number, number]

/** The Sim is free to walk about this room (roaming, nothing being done): someone tapped is walked up to. */
export function useIndoorWalker(on: boolean) {
  useEffect(() => {
    if (!on) return
    indoorWalker.on = true
    return () => void (indoorWalker.on = false)
  }, [on])
}

/**
 * Where to stop to talk to someone standing at `them`, coming from `from`: `gap` away from them, on free
 * floor, the nearest such spot to the Sim (so it stops on its own side, not round the back of them).
 * Nowhere free that close (they stand in a corner, behind the counter): a little further out.
 */
export function stopNear(from: XZ, them: XZ, gap: number, free?: ((x: number, z: number) => boolean) | null): XZ {
  const [tx, tz] = them
  const toward = Math.atan2(from[0] - tx, from[1] - tz)
  for (const r of [gap, gap + 0.25, gap + 0.5, gap + 0.9]) {
    let best: XZ | null = null
    let bestD = Infinity
    for (let k = 0; k < 16; k++) {
      // From the side facing the Sim, round both ways.
      const a = toward + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8)
      const [x, z] = [tx + Math.sin(a) * r, tz + Math.cos(a) * r]
      if (free && !free(x, z)) continue
      const d = Math.hypot(x - from[0], z - from[1])
      if (d < bestD) [best, bestD] = [[x, z], d]
    }
    if (best) return best
  }
  const d = Math.hypot(from[0] - tx, from[1] - tz) || 1
  return [tx + ((from[0] - tx) / d) * gap, tz + ((from[1] - tz) / d) * gap]
}

/** The walk up asked now (once: taken by the room's walker), with where to stop for it; null if none. */
export function takeIndoorMeet(from: XZ, free?: ((x: number, z: number) => boolean) | null): { to: XZ; arrive: () => void } | null {
  const m = indoorMeet.to
  if (!m || meeting.id !== m.id || !meeting.where) return null
  indoorMeet.to = null
  const them = meeting.where()
  // Already close: greeted where it stands.
  if (Math.hypot(them[0] - from[0], them[1] - from[1]) < m.gap + 0.4) return { to: from, arrive: m.arrive }
  return { to: stopNear(from, them, m.gap, free), arrive: m.arrive }
}

/** Each frame from the room's walker: where the Sim is (for the one it talks to, and the eyes on it). */
export function indoorSimAt(x: number, y: number, z: number, eyeY = 1.55) {
  indoorSim[0] = x
  indoorSim[1] = z
  // (The street's Walker keeps this target while out there; hidden indoors, it leaves it to the room.)
  gazeTarget('me', 7, 1).set(x, y + eyeY, z)
}

/** The angle (about y) the Sim turns to, to face the one it talks to; null if no one. */
export function meetingFacing(x: number, z: number): number | null {
  if (!meeting.id || !meeting.where) return null
  const [tx, tz] = meeting.where()
  if (Math.hypot(tx - x, tz - z) < 0.05) return null
  return Math.atan2(tx - x, tz - z)
}

/**
 * The camera on the two of them while they talk (from the tap: the Sim walking up too): looking at the middle
 * between them, from where the player had it turned, far enough for both to be whole in the strip of room
 * left over the chat sheet (chatFraming.tsx lifts the picture); back where it was, gliding, when the talk is over.
 */
const TWO_SHOT = 9

export function IndoorTwoShot({ floor = 0 }: { floor?: number }) {
  const talking = useTalking()
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void; minDistance: number } | null
  const kept = useRef<{ pos: THREE.Vector3; target: THREE.Vector3; min: number } | null>(null)
  const back = useRef(0)
  const v = useRef({ mid: new THREE.Vector3(), want: new THREE.Vector3(), off: new THREE.Vector3() }).current
  useFrame((_, dtRaw) => {
    if (!controls) return
    const dt = Math.min(dtRaw, 0.1)
    const k = 1 - Math.exp(-3 * dt)
    const them = talking && meeting.id === talking && meeting.where ? meeting.where() : null
    const close = them && Math.hypot(them[0] - indoorSim[0], them[1] - indoorSim[1]) < 9 ? them : null
    if (close) {
      if (!kept.current) kept.current = { pos: camera.position.clone(), target: controls.target.clone(), min: controls.minDistance }
      controls.minDistance = Math.min(kept.current.min, 4)
      v.mid.set((close[0] + indoorSim[0]) / 2, floor + 1.3, (close[1] + indoorSim[1]) / 2)
      // From the way the camera already looks, a little lower: both of them whole over the sheet (a phone's
      // strip of picture is a little over a quarter of the screen, lifted: 9 m off and aimed over their heads, both stand whole in it).
      v.off.copy(camera.position).sub(controls.target).setY(0)
      if (v.off.lengthSq() < 0.01) v.off.set(0, 0, 1)
      v.off.normalize().multiplyScalar(TWO_SHOT * Math.sin(1.05)).setY(TWO_SHOT * Math.cos(1.05))
      v.want.copy(v.mid).add(v.off)
      controls.target.lerp(v.mid, k)
      camera.position.lerp(v.want, k)
      controls.update()
      back.current = 1
      return
    }
    const was = kept.current
    if (!was || !back.current) return
    // The talk over: back to the player's own view.
    controls.target.lerp(was.target, k)
    camera.position.lerp(was.pos, k)
    controls.update()
    if (camera.position.distanceTo(was.pos) < 0.05) {
      controls.minDistance = was.min
      kept.current = null
      back.current = 0
    }
  })
  return null
}
