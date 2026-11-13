import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { whereabouts } from '../whereabouts'
import { reportFps, shouldProbe } from '../../lib/lightPhone'

// « Téléphone léger » on by itself (lib/lightPhone.ts): the street's frames counted for a few seconds
// once it stands (its first chunks built: those seconds are slow on every phone), and a phone that
// can't keep up gets the light street from then on. Measured once; only where « Auto » could still
// turn it on (the update open, the phone not already light, the player not on « Normal »).

/** Seconds of street before counting, then seconds counted. */
const SETTLE = 5
const SPAN = 8

export function SlowProbe() {
  const s = useRef({ on: true, wait: SETTLE, frames: 0, time: 0 })
  useFrame((_, dt) => {
    const p = s.current
    if (!p.on || !whereabouts.streetReady) return
    // (A frame of seconds: the tab was hidden, or the game paused the street. Not counted.)
    if (dt > 2) return
    if (p.wait > 0) {
      p.wait -= dt
      // (Asked once the street has settled: the server's word on the update has come by then.)
      if (p.wait <= 0 && !shouldProbe()) p.on = false
      return
    }
    p.frames++
    p.time += dt
    if (p.time < SPAN) return
    p.on = false
    if (shouldProbe()) reportFps(p.frames / p.time)
  })
  return null
}
