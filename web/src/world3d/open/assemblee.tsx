import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { worldTime } from '../../lib/worldClock'
import { rng } from '../themes'
import { Vehicle } from '../vehicles'
import { Blocks, PLANE } from './ruePrincesse'
import { Lamps, People, type Staff } from './hotelBits'
import { WavingFlag } from './flag'
import { t as tr } from '../../lib/i18n'

// The Assemblée nationale, avenue Jeanne-Gervais on the Plateau: a wide low
// white building of two floors behind a colonnade of square pillars and its
// deep overhang with the name across; the drum of the hemicycle rising behind
// under a shallow dome; the three flags on the forecourt, the Garde
// républicaine at the gate (one marching his round), the deputies' black cars
// at the steps. Its plan is the game's (the map gives a low block of about
// 80 × 90 m). Frame: +z the avenue.

const W = 36 // half its width
const D = 26 // half its depth
const H = 10
const DRUM = { r: 17, z: -6, h: 17 }
const COURT = 22 // the forecourt, from the colonnade to the gate

const white = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const dome = new THREE.MeshLambertMaterial({ color: '#c9d2d6' })
const paving = new THREE.MeshLambertMaterial({ color: '#d8d2c6', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const lawn = new THREE.MeshLambertMaterial({ color: '#4e9a3f', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const gold = new THREE.MeshLambertMaterial({ color: '#d4a62a', emissive: '#6b4f0a', emissiveIntensity: 0.25 })

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

/** The name over the colonnade, in bronze letters on white. */
function frieze() {
  const c = document.createElement('canvas')
  c.width = 1536
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#f4f1ea'
  g.fillRect(0, 0, 1536, 128)
  g.fillStyle = '#5a4a24'
  g.font = '700 74px serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(tr('ASSEMBLÉE NATIONALE'), 768, 68)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return new THREE.MeshLambertMaterial({ map: t })
}

export function Assemblee({ night }: { night: boolean }) {
  const name = useMemo(frieze, [])
  const blocks = useMemo(() => {
    const b: Block[] = []
    // The body on its podium; the two floors' window bands between thin fins, on every side.
    b.push({ p: [0, 0.6, 0], s: [2 * W + 2, 1.2, 2 * D + 2], c: '#d8d2c6' })
    b.push({ p: [0, H / 2 + 1.2, 0], s: [2 * W, H, 2 * D], c: '#f4f1ea' })
    for (const y of [3.6, 7.8]) {
      for (const z of [D + 0.06, -D - 0.06]) b.push({ p: [0, y, z], s: [2 * W - 4, 2.2, 0.1], c: '#2f3a48' })
      for (const x of [W + 0.06, -W - 0.06]) b.push({ p: [x, y, 0], s: [0.1, 2.2, 2 * D - 4], c: '#2f3a48' })
    }
    for (let x = -W + 2; x <= W - 2 + 0.01; x += 2) for (const z of [D + 0.2, -D - 0.2]) b.push({ p: [x, H / 2 + 1.2, z], s: [0.25, H, 0.4], c: '#f4f1ea' })
    // The colonnade: square pillars ahead of the facade, the deep overhang with the name; the steps down.
    for (let x = -W + 4; x <= W - 4 + 0.01; x += 6) b.push({ p: [x, (H + 3) / 2 + 1.2, D + 6], s: [1.2, H + 3, 1.2], c: '#ffffff' })
    b.push({ p: [0, H + 4.9, D + 3.4], s: [2 * W + 1, 1.6, 8], c: '#f4f1ea' })
    b.push({ p: [0, 0.6, D + 4], s: [2 * W, 1.2, 8], c: '#d8d2c6' })
    for (let i = 0; i < 4; i++) {
      const front = 3 - i * 0.7
      b.push({ p: [0, (i + 1) * 0.15, D + 8 + front / 2], s: [30 - i, (i + 1) * 0.3, front], c: '#d8d2c6' })
    }
    // The doors under the colonnade, in bronze and glass.
    b.push({ p: [0, 3.8, D + 0.14], s: [14, 5.2, 0.12], c: '#3a4a55' })
    // The drum of the hemicycle over the roof (its wall is drawn round), the gate's pillars and railings, the guard boxes.
    for (const x of [-9, 9]) b.push({ p: [x, 1.6, D + 8 + COURT], s: [1.4, 3.2, 1.4], c: '#f4f1ea' })
    for (const s of [-1, 1]) b.push({ p: [s * (9 + W / 2), 1, D + 8 + COURT], s: [W - 2, 2, 0.25], c: '#2b2f36' })
    for (const x of [-12, 12]) b.push({ p: [x, 1.4, D + 8 + COURT - 2], s: [1.6, 2.8, 1.6], c: '#3e5a3a' }, { p: [x, 2.95, D + 8 + COURT - 2], s: [2, 0.3, 2], c: '#f4f1ea' })
    return b
  }, [])
  // The Garde républicaine at the gate, the drivers by the cars, deputies on the steps.
  const people = useMemo<Staff[]>(
    () => [
      { p: [-12, 0, D + 8 + COURT - 0.7], r: 0, who: 'vigile', pose: 'guard' },
      { p: [12, 0, D + 8 + COURT - 0.7], r: 0, who: 'vigile', pose: 'guard' },
      { p: [-4, 1.2, D + 5], r: 0.3, who: 'client', pose: 'talk' },
      { p: [-2.8, 1.2, D + 5.6], r: -2.7, who: 'client', pose: 'talk' },
      { p: [6, 1.2, D + 4], r: 0, who: 'client', pose: 'phone' },
      { p: [-17, 0, D + 15], r: Math.PI / 2, who: 'portier', pose: 'idle' },
      { p: [-17, 0, D + 20], r: Math.PI / 2, who: 'portier', pose: 'phone' },
    ],
    [],
  )
  return (
    <group>
      {/* The forecourt: lawns, the paved way in */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, D + 8 + COURT / 2]} scale={[2 * W + 4, COURT, 1]} geometry={PLANE} material={lawn} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, D + 8 + COURT / 2]} scale={[22, COURT, 1]} geometry={PLANE} material={paving} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-20, 0.04, D + 8 + COURT / 2]} scale={[8, COURT, 1]} geometry={PLANE} material={paving} receiveShadow />
      <Blocks at={blocks} material={white} color />
      {/* The hemicycle's drum and its shallow dome, rising behind the colonnade */}
      <mesh position={[0, (H + 1.2 + DRUM.h) / 2, DRUM.z]} material={white} castShadow receiveShadow>
        <cylinderGeometry args={[DRUM.r, DRUM.r, DRUM.h - H - 1.2, 40]} />
      </mesh>
      <mesh position={[0, DRUM.h - 1.1, DRUM.z]} castShadow>
        <cylinderGeometry args={[DRUM.r + 0.4, DRUM.r + 0.4, 1, 40]} />
        <meshLambertMaterial color="#e8590c" />
      </mesh>
      <mesh position={[0, DRUM.h - 0.6, DRUM.z]} scale={[1, 0.28, 1]} material={dome} castShadow>
        <sphereGeometry args={[DRUM.r, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, H + 4.9, D + 7.42]} scale={[44, 1.3, 1]} geometry={PLANE} material={name} />
      {/* The arms of the Republic over the doors: the gold disc */}
      <mesh position={[0, 7.6, D + 0.25]} rotation={[Math.PI / 2, 0, 0]} material={gold}>
        <cylinderGeometry args={[1.5, 1.5, 0.2, 24]} />
      </mesh>
      {[-7, 0, 7].map((x, i) => (
        <group key={x} position={[x, 0, D + 8 + COURT / 2 + 2]}>
          <WavingFlag height={x ? 11 : 13} w={x ? 3 : 3.6} seed={i * 3 + 1} />
        </group>
      ))}
      {/* The deputies' black cars, nose out, along the left of the forecourt */}
      {[13, 18, 23].map((z, i) => (
        <Vehicle key={z} p={[-20, 0, D + z]} r={Math.PI / 2} kind="car" color="#17171a" seed={i + 3} crew={false} />
      ))}
      <Lamps from={[-11, D + 10]} to={[-11, D + 6 + COURT]} step={6} night={night} />
      <Lamps from={[11, D + 10]} to={[11, D + 6 + COURT]} step={6} night={night} />
      {night && <pointLight position={[0, H + 2, D + 8]} intensity={50} distance={30} color="#fff1c2" />}
      <NoShadows>
        <People at={people} seed="assemblee" />
        <Sentry from={[-6, D + 8 + COURT - 1.2]} to={[6, D + 8 + COURT - 1.2]} />
      </NoShadows>
    </group>
  )
}

/** The sentry of the Garde républicaine marching his round along the gate: stiff steps, a halt and a turn at each end. */
function Sentry({ from, to }: { from: [number, number]; to: [number, number] }) {
  const g = useRef<THREE.Group>(null)
  const look = useMemo(() => ({ ...randomLook('homme', rng('assemblee-sentinelle')), outfit: 'gendarme', accessory: 'none' }), [])
  const [halt, setHalt] = useState(false)
  const len = Math.hypot(to[0] - from[0], to[1] - from[1])
  const heading = Math.atan2(to[0] - from[0], to[1] - from[1])
  useFrame(() => {
    if (!g.current) return
    // Twelve metres at a slow march, a salute at the halt, back the other way.
    const walk = len / 1.1
    const leg = walk + 2.5
    const u = worldTime() % (2 * leg)
    const back = u >= leg
    const k = Math.min(1, (back ? u - leg : u) / walk)
    const t = back ? 1 - k : k
    g.current.position.set(from[0] + (to[0] - from[0]) * t, 0, from[1] + (to[1] - from[1]) * t)
    g.current.rotation.y = back ? heading + Math.PI : heading
    if (k >= 1 !== halt) setHalt(k >= 1)
  })
  return (
    <group ref={g}>
      <Human look={look} gender="homme" pose={halt ? 'salute' : 'walk'} speed={0.8} seed={7} />
    </group>
  )
}

/** What a walker can't go through: the building and its colonnade, the gate, the guard boxes, the flags (its frame). */
export const ASSEMBLEE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 0, z: 0, hw: W + 1, hd: D + 1, rot: 0, top: H + 1.2 },
  ...[...Array(12)].map((_, i) => ({ x: -W + 4 + i * 6, z: D + 6, r: 0.8 })),
  { x: -9, z: D + 8 + COURT, r: 0.9 },
  { x: 9, z: D + 8 + COURT, r: 0.9 },
  { x: -12, z: D + 6 + COURT, hw: 1, hd: 1, rot: 0, top: 3 },
  { x: 12, z: D + 6 + COURT, hw: 1, hd: 1, rot: 0, top: 3 },
  { x: -20, z: D + 18, hw: 1.2, hd: 7.5, rot: 0, top: 1.6 },
]
