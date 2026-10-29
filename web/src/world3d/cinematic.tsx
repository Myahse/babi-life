import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { whereabouts } from './whereabouts'

// The arrival's flight over the commune (components/Arrival.tsx): the game's
// own street, its roads and its people, seen low over the rooftops, the
// camera coming down in a wide turn onto the player's Sim. While it flies it holds the
// camera (a frame callback after the others, which then draws the frame
// itself); landed, the camera goes back where it was.

const state = { start: 0, seconds: 0, hold: null as null | [number, number, number] }
const subs = new Set<() => void>()
const tell = () => subs.forEach((f) => f())

/** Flies for that long; the promise is kept when it has landed. */
export function playCinematic(seconds: number): Promise<void> {
  Object.assign(state, { start: performance.now(), seconds, hold: null })
  tell()
  return new Promise((done) => setTimeout(() => (stopCinematic(), done()), seconds * 1000))
}
export function stopCinematic() {
  if (!state.seconds) return
  state.seconds = 0
  tell()
}
const flying = () => state.seconds > 0

/** Development only (captures): the camera held at [ahead, up, aside] metres from the Sim, as it faces, looking at it. */
export function holdCamera(at: [number, number, number], seconds = 30) {
  Object.assign(state, { start: performance.now(), seconds, hold: at })
  tell()
  setTimeout(stopCinematic, seconds * 1000)
}
if (import.meta.env.DEV) Object.assign(globalThis, { __holdCamera: holdCamera })
const useFlying = () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), flying)

/** In the street's Canvas (OpenWorld): nothing, or the flight. */
export function Cinematic() {
  return useFlying() ? <Flight /> : null
}

const ease = (u: number) => u * u * (3 - 2 * u)

function Flight() {
  const camera = useThree((s) => s.camera)
  const was = useRef<THREE.Vector3 | null>(null)
  useEffect(() => {
    was.current = camera.position.clone()
    return () => void (was.current && camera.position.copy(was.current))
  }, [camera])
  useFrame((st) => {
    const u = Math.min(1, (performance.now() - state.start) / (state.seconds * 1000))
    const e = ease(u)
    const [x, z] = whereabouts.sim
    if (state.hold) {
      const [ahead, up, aside] = state.hold
      const h = whereabouts.simHeading
      st.camera.position.set(x + Math.sin(h) * ahead + Math.cos(h) * aside, up, z + Math.cos(h) * ahead - Math.sin(h) * aside)
      st.camera.lookAt(x, up * 0.6, z)
      st.gl.render(st.scene, st.camera)
      return
    }
    // Low over the rooftops, so the streets, the cars and the people are seen (not the sky): a wide
    // turn round the Sim's quartier, then down among the houses, round the Sim, close behind it at the end.
    const a = 0.6 + u * 3.2
    const r = u < 0.55 ? 70 + (26 - 70) * ease(u / 0.55) : 26 + (7 - 26) * ease((u - 0.55) / 0.45)
    const h = u < 0.55 ? 38 + (14 - 38) * ease(u / 0.55) : 14 + (2.6 - 14) * ease((u - 0.55) / 0.45)
    st.camera.position.set(x + Math.sin(a) * r, h, z + Math.cos(a) * r)
    st.camera.lookAt(x, 0.6 + 0.5 * e, z)
    st.gl.render(st.scene, st.camera)
  }, 1)
  return null
}
