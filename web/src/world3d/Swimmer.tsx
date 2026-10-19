import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../lib/worldClock'
import type { Sim } from '../lib/types'
import { Character } from './Character'

/** Swimming speed (m/s): an easy crawl. */
const SPEED = 0.9

/**
 * The Sim swimming lengths of a pool: face down at the surface, the crawl,
 * along its own +z from -len to +len, a turn at the wall, and back. Its
 * group stands at the pool's middle, at the water.
 */
export function Swimmer({ len, look, gender, stage }: { len: number; look: Sim['look']; gender: Sim['gender']; stage: string }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const o = g.current
    if (!o) return
    const t = worldTime()
    const lap = (2 * len) / SPEED
    const p = (t % (2 * lap)) / lap
    const there = p < 1
    const k = there ? p : p - 1
    o.position.set(0, Math.sin(t * 5.2) * 0.03, there ? -len + 2 * len * k : len - 2 * len * k)
    // Turning at the wall: half a turn over the last and first half-metre.
    const want = there ? 0 : Math.PI
    o.rotation.y += Math.atan2(Math.sin(want - o.rotation.y), Math.cos(want - o.rotation.y)) * 0.12
    // Rolling a little with each stroke.
    o.rotation.z = Math.sin(t * 2.6) * 0.18
  })
  return (
    <group ref={g}>
      {/* Lying face down, head first: the feet (its origin) a body's length behind the middle */}
      <group rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.05]}>
        <Character look={look} gender={gender} pose="swim" stage={stage} marker={false} />
      </group>
    </group>
  )
}
