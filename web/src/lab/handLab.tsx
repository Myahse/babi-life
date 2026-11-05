import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HandInHand } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { Character } from '../world3d/Character'
import { HAND_GAP } from '../world3d/handHold'
import { worldTime } from '../lib/worldClock'

// Development only (city.html?view=hand): a couple walking a long oval side by side, as an outing's partner
// walks with the Sim (world3d/Walker.tsx Trail): apart for the first lap's half, then hand in hand
// (avatar/Human.tsx HandInHand), the walk going on. &speed= their pace (m/s).

const q = new URLSearchParams(location.search)
const ground = new THREE.MeshLambertMaterial({ color: '#c9b48a' })
const SPEED = Number(q.get('speed') ?? 1.9)

function Couple() {
  const looks = useMemo(() => [randomLook('homme', () => 0.31), randomLook('femme', () => 0.62)], [])
  const pair = useRef<THREE.Group>(null)
  const hands = useMemo(() => [{ side: 0 }, { side: 0 }], [])
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    const t = worldTime()
    // Round an oval 16 m by 8: where along it, and the way it goes.
    const R = 4
    const a = (t * SPEED) / R / 1.6
    const [x, z] = [Math.sin(a) * R * 2, Math.cos(a) * R]
    const [dx, dz] = [Math.cos(a) * R * 2, -Math.sin(a) * R]
    const g = pair.current
    if (!g) return
    g.position.set(x, 0, z)
    g.rotation.y = Math.atan2(dx, dz)
    // Hand in hand after the first few seconds, apart again for a moment every 14 s.
    const on = t % 14 > 4
    hands[0].side = on ? 1 : 0
    hands[1].side = on ? -1 : 0
    const cam = Number(q.get('cam') ?? 0.35)
    camera.position.set(x + Math.sin(g.rotation.y + cam) * 4.2, 1.9, z + Math.cos(g.rotation.y + cam) * 4.2)
    camera.lookAt(x, 0.9, z)
  })
  return (
    <group ref={pair}>
      <HandInHand.Provider value={hands[0]}>
        <Character look={looks[0]} gender="homme" walking speed={SPEED} marker={false} />
      </HandInHand.Provider>
      <group position={[HAND_GAP, 0, 0]}>
        <HandInHand.Provider value={hands[1]}>
          <Character look={looks[1]} gender="femme" walking speed={SPEED} marker={false} seed={7} />
        </HandInHand.Provider>
      </group>
    </group>
  )
}

export function HandLab() {
  return (
    <Canvas camera={{ position: [4, 2, 4], fov: 42 }} style={{ position: 'fixed', inset: 0, background: '#9fd0f0' }}>
      <hemisphereLight args={['#fff6e8', '#6a5a3a', 1.2]} />
      <directionalLight position={[6, 10, 4]} intensity={1.2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={ground}>
        <planeGeometry args={[60, 60]} />
      </mesh>
      <Couple />
    </Canvas>
  )
}
