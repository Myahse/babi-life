import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { whereabouts } from './whereabouts'

// The arrival's flight over the commune (components/Arrival.tsx): the game's
// own street, its roads and its people, seen from the sky, the camera coming
// down in a wide turn onto the player's Sim. While it flies it holds the
// camera (a frame callback after the others, which then draws the frame
// itself); landed, the camera goes back where it was.

const state = { start: 0, seconds: 0 }
const subs = new Set<() => void>()
const tell = () => subs.forEach((f) => f())

/** Flies for that long; the promise is kept when it has landed. */
export function playCinematic(seconds: number): Promise<void> {
  Object.assign(state, { start: performance.now(), seconds })
  tell()
  return new Promise((done) => setTimeout(() => (stopCinematic(), done()), seconds * 1000))
}
export function stopCinematic() {
  if (!state.seconds) return
  state.seconds = 0
  tell()
}
const flying = () => state.seconds > 0
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
    // A wide turn coming down: from high over the commune onto the Sim, a little behind it at the end.
    const a = 0.6 + u * 2.6
    const r = 150 + (14 - 150) * e
    const h = 95 + (6 - 95) * Math.pow(e, 0.8)
    st.camera.position.set(x + Math.sin(a) * r, h, z + Math.cos(a) * r)
    st.camera.lookAt(x, 1.2 * e, z)
    st.gl.render(st.scene, st.camera)
  }, 1)
  return null
}
