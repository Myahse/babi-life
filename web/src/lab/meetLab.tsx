import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { Character } from '../world3d/Character'
import { InHand, type Hold } from '../world3d/inHand'
import { GREET_GAP, TALK_GAP, type Greeting } from '../world3d/meet'
import { turnTo } from '../world3d/open/shared'
import { worldTime } from '../lib/worldClock'

// Development only (city.html?view=meet): a meeting played over and over, as the street plays it
// (world3d/meet.ts): the Sim walks up, both greet (&g=shake|dap|bise|hug|wave), they talk in turns, a wave,
// and they part. &buy=alloco|garba|brochette|sachet: buying from a seller instead, the money out, the
// thing bought handed back, eaten. &cam=x,y,z moves the camera; &t= runs the clock from there.

const q = new URLSearchParams(location.search)
const ground = new THREE.MeshLambertMaterial({ color: '#c9b48a' })

type Beat = { until: number; sim: Pose; npc: Pose; simHold?: Hold; npcHold?: Hold; walk?: 'sim' | 'npc' | 'away' }
function beats(g: Greeting, buy: Hold | null): Beat[] {
  if (buy)
    return [
      { until: 2.6, sim: 'walk', npc: 'idle', walk: 'sim' },
      { until: 2.8, sim: 'idle', npc: 'idle' },
      { until: 4.0, sim: 'give', npc: 'give', simHold: 'notes', npcHold: buy },
      { until: 8.0, sim: 'snack', npc: 'thumbsup', simHold: buy },
      { until: 9.5, sim: 'idle', npc: 'idle' },
    ]
  return [
    { until: 2.6, sim: 'walk', npc: 'wave', walk: 'sim' },
    { until: 2.9, sim: 'idle', npc: 'idle', walk: 'npc' },
    { until: 4.9, sim: g, npc: g, walk: 'npc' },
    { until: 9.5, sim: 'talk', npc: 'talk', walk: 'npc' },
    { until: 11.1, sim: 'wave', npc: 'wave' },
    { until: 13.5, sim: 'idle', npc: 'walk', walk: 'away' },
  ]
}

function Scene() {
  const g = (q.get('g') ?? 'shake') as Greeting
  const buy = (q.get('buy') as Hold | null) ?? null
  const list = useMemo(() => beats(g, buy), [g, buy])
  const total = list[list.length - 1].until
  const looks = useMemo(() => [randomLook('homme', () => 0.31), randomLook(q.get('npc') === 'homme' ? 'homme' : 'femme', () => 0.62)], [])
  const sim = useRef<THREE.Group>(null)
  const npc = useRef<THREE.Group>(null)
  const [k, setK] = useState(0)
  const t0 = useRef(worldTime())
  const lap = useRef(-1)
  useFrame((_, dt) => {
    const s = sim.current
    const n = npc.current
    if (!s || !n) return
    const run = (worldTime() - t0.current) / total
    const t = (run % 1) * total
    const i = list.findIndex((b) => t < b.until)
    if (i !== k) setK(i)
    const b = list[i]
    // Each time round, from the start.
    if (Math.floor(run) !== lap.current) {
      lap.current = Math.floor(run)
      s.position.set(-4, 0, 0.6)
      s.rotation.y = 0
      n.position.set(0.3, 0, 0)
      n.rotation.y = -Math.PI / 2
    }
    const gap = buy ? 1.25 : b.sim === g ? Math.min(TALK_GAP, GREET_GAP[g]) : TALK_GAP
    const [dx, dz] = [n.position.x - s.position.x, n.position.z - s.position.z]
    const d = Math.hypot(dx, dz)
    if (b.walk === 'sim' && d > gap) {
      const step = Math.min(d - gap, 1.9 * dt)
      s.position.x += (dx / d) * step
      s.position.z += (dz / d) * step
    }
    // (The last step theirs, to the greeting's distance, and back out.)
    const want = b.npc === g ? GREET_GAP[g] : TALK_GAP
    if (b.walk === 'npc' && Math.abs(d - want) > 0.05) {
      const step = Math.sign(d - want) * Math.min(Math.abs(d - want), 0.9 * dt)
      n.position.x -= (dx / d) * step
      n.position.z -= (dz / d) * step
    }
    if (b.walk === 'away') {
      n.position.x += 1.4 * dt
      n.rotation.y = turnTo(n.rotation.y, Math.PI / 2, 1 - Math.exp(-8 * dt))
    } else n.rotation.y = turnTo(n.rotation.y, Math.atan2(-dx, -dz), 1 - Math.exp(-8 * dt))
    s.rotation.y = turnTo(s.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt))
  })
  const b = list[Math.max(0, k)]
  return (
    <>
      <group ref={sim}>
        <Character look={looks[0]} gender="homme" walking={b.sim === 'walk'} running={false} busy={false} pose={b.sim === 'walk' ? undefined : b.sim} marker={false} stage="adulte" seed={3} hold={b.simHold ? <InHand what={b.simHold} /> : undefined} />
      </group>
      <group ref={npc}>
        <Character look={looks[1]} gender={q.get('npc') === 'homme' ? 'homme' : 'femme'} walking={b.npc === 'walk'} running={false} busy={false} pose={b.npc === 'walk' ? undefined : b.npc} marker={false} stage="adulte" seed={8} hold={b.npcHold ? <InHand what={b.npcHold} /> : undefined} />
      </group>
    </>
  )
}

export function MeetLab() {
  const cam = (q.get('cam') ?? '-0.8,1.7,4.6').split(',').map(Number) as [number, number, number]
  const look = (q.get('look') ?? '-0.8,0.95,0.3').split(',').map(Number) as [number, number, number]
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: cam, fov: 40 }} style={{ width: '100vw', height: '100vh' }}>
        <color attach="background" args={['#a9d3f0']} />
        <hemisphereLight args={['#ffffff', '#b8a27c', 1.3]} />
        <directionalLight position={[6, 12, 8]} intensity={1.5} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={ground}>
          <planeGeometry args={[40, 40]} />
        </mesh>
        <Scene />
        <OrbitControls target={look} />
      </Canvas>
    </div>
  )
}
