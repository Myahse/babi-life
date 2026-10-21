import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import { NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { Character } from '../Character'
import { TalkHuman } from '../Talkable'
import { BOX, Blocks } from '../open/ruePrincesse'
import { Guest, mat, useBigWalk, type Spot, type XZ } from './bigPlace'

// Île Boulay, across the lagoon from Azito (Yopougon): the pinasse lands on
// the beach of the village (N'gandikro), the long boats pulled up on the
// sand, the nets drying on their poles, the women smoking the fish, the
// houses under their tin roofs behind the coconut palms; the forest beyond,
// over the whole island; to the east, a weekend house with its jetty and its
// speedboat. Across the water, Yopougon's shore and the Azito power station's
// stacks. The day on the island: a walk round the village. Water-skiing: the
// speedboat goes round off the beach, the Sim behind it on its skis.
// The frame: the beach along x, the island south (+z), the water north (-z).

/** The beach: from the water's edge (z 0) to the village. */
const SHORE = 0
const LAND = 9
const LANDING: XZ = [-26, 1.5]

type House = { at: XZ; w: number; d: number; ry: number; wall: string }

/** The village's houses, round its square, under the palms. */
const HOUSES: House[] = (() => {
  const r = rng('boulay-village')
  const out: House[] = []
  const walls = ['#d9cbb0', '#e8dcc4', '#c9b48c', '#e3c9a0', '#d6c2b0', '#efe3cf']
  for (let i = 0; i < 16; i++) {
    const row = i < 8 ? 0 : 1
    const x = -42 + (i % 8) * 11 + r() * 3
    const z = LAND + 10 + row * 13 + r() * 2.5
    out.push({ at: [x, z], w: 6 + r() * 2.5, d: 5 + r() * 2, ry: (r() - 0.5) * 0.25, wall: walls[Math.floor(r() * walls.length)] })
  }
  return out
})()

/** The palms along the beach, the forest's trees inland. */
const PALMS: XZ[] = (() => {
  const r = rng('boulay-cocotiers')
  return [...Array(26)].map((_, i): XZ => [-70 + i * 6 + r() * 3, LAND - 3 + r() * 5])
})()
const FOREST: { at: XZ; h: number; s: number }[] = (() => {
  const r = rng('boulay-foret')
  const out: { at: XZ; h: number; s: number }[] = []
  while (out.length < 320) {
    const [x, z] = [-260 + r() * 520, LAND + 34 + r() * 260]
    // The village's clearing stays open.
    if (Math.abs(x) < 55 && z < LAND + 40) continue
    out.push({ at: [x, z], h: 9 + r() * 14, s: 5 + r() * 6 })
  }
  // The edges of the island, east and west of the village, wooded down to the beach.
  while (out.length < 420) {
    const [x, z] = [(r() < 0.5 ? -1 : 1) * (75 + r() * 180), LAND + 2 + r() * 34]
    out.push({ at: [x, z], h: 8 + r() * 10, s: 4 + r() * 5 })
  }
  return out
})()

/** The long boats: on the sand, and the one at the landing. */
const PINASSES: { at: XZ; ry: number; colors: [string, string] }[] = [
  { at: [-12, 4.2], ry: 1.35, colors: ['#1d4ed8', '#f2b705'] },
  { at: [-4, 4.8], ry: 1.5, colors: ['#b02e0c', '#f4efe6'] },
  { at: [6, 4.4], ry: 1.7, colors: ['#00a862', '#f2b705'] },
  { at: [16, 5], ry: 1.45, colors: ['#14213d', '#ff7a00'] },
]
/** The weekend house, east, with its jetty out into the water. */
const VILLA: XZ = [92, LAND + 8]
const JETTY = { x: 96, z0: 2, z1: -26 }

/** Off the beach, where the speedboat goes round with the skier. */
const SKI = { c: [10, -70] as XZ, r: [80, 26] as XZ, speed: 0.13 }

function free(x: number, z: number) {
  if (z < SHORE + 0.6 || z > LAND + 34 || Math.abs(x) > 70) return false
  for (const h of HOUSES) if (Math.abs(x - h.at[0]) < h.w / 2 + 0.4 && Math.abs(z - h.at[1]) < h.d / 2 + 0.4) return false
  for (const p of PINASSES) if (Math.hypot(x - p.at[0], z - p.at[1]) < 2) return false
  return true
}

const SPOTS: Record<string, Spot> = {
  // The day on the island: round the village and back along the beach.
  'traversee-boulay': { at: [0, LAND + 2], rot: 0, pose: 'walk', loop: { c: [-6, LAND + 2.5], r: [30, 4], speed: 0.04 } },
}

export function BoulayScene({ sim, interactionId, night, stage }: { sim: Sim; interactionId?: string; night: boolean; stage: string }) {
  const ski = interactionId === 'ski-boulay'
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={ski ? { position: [10, 11, -66], fov: 45, near: 0.3, far: 5000 } : { position: [-22, 15, -12], fov: 45, near: 0.3, far: 5000 }} style={{ background: night ? '#0b1026' : '#9ccbea' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={[night ? '#6070b0' : '#ffffff', '#b8a27c', night ? 0.85 : 1.15]} />
          {/* At night: the moon over the water, the bulbs of the village and the paillote */}
          {night && [[-20, LAND + 14], [10, LAND + 14], [34, LAND + 3], [-46, LAND + 4]].map(([x, z]) => <pointLight key={x} position={[x, 4, z]} intensity={70} distance={26} color="#ffd9a0" />)}
          <directionalLight position={[60, 90, -40]} intensity={night ? 0.35 : 1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={60} shadow-camera-bottom={-60} />
          <Island night={night} />
          <Village night={night} />
          <Across night={night} />
          <Villagers />
          {ski ? <Skier sim={sim} stage={stage} /> : <Walker sim={sim} stage={stage} interactionId={interactionId} />}
          <OrbitControls makeDefault target={ski ? [10, 0, -40] : [-22, 0, 9]} enablePan={false} minDistance={6} maxDistance={140} minPolarAngle={0.25} maxPolarAngle={1.35} enableDamping />
        </Suspense>
      </Canvas>
    </div>
  )
}

/** The Sim on the island: off the pinasse at the landing, then round the village. */
function Walker({ sim, stage, interactionId }: { sim: Sim; stage: string; interactionId?: string }) {
  const spot = interactionId ? (SPOTS[interactionId] ?? null) : null
  const { way, onMoved } = useBigWalk(spot, interactionId, false, free, LANDING)
  return <Guest sim={sim} stage={stage} way={way} spot={spot} steer={false} onMoved={onMoved} free={free} entrance={LANDING} />
}

/** The water, the beach, the island's ground, its palms and its forest. */
function Island({ night }: { night: boolean }) {
  const water = useRef<THREE.MeshLambertMaterial>(null)
  useFrame(() => {
    // The lagoon's light moving a little.
    if (water.current) water.current.color.setHSL(0.53, 0.38, (night ? 0.12 : 0.36) + Math.sin(worldTime() * 0.6) * 0.012)
  })
  const trunks = useMemo(() => FOREST.map((t) => ({ p: [t.at[0], t.h / 2, t.at[1]] as [number, number, number], s: [0.5, t.h, 0.5] as [number, number, number] })), [])
  const crowns = useMemo(() => {
    const r = rng('boulay-houppiers')
    const shades = ['#2f6b2a', '#3f8a3a', '#356e2e', '#4a7d36', '#2a5a28']
    return FOREST.map((t) => ({ p: [t.at[0], t.h, t.at[1]] as [number, number, number], s: [t.s, t.s * 0.6, t.s] as [number, number, number], ry: r() * 3, c: shades[Math.floor(r() * shades.length)] }))
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -600]} receiveShadow>
        <planeGeometry args={[6000, 2600]} />
        <meshLambertMaterial ref={water} color="#3c7c8a" />
      </mesh>
      {/* The sand, from the water's edge up to the village */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, (SHORE - 3 + LAND + 2) / 2]} receiveShadow>
        <planeGeometry args={[560, LAND + 5 - SHORE]} />
        <meshLambertMaterial color={night ? '#6e6250' : '#e3cf9e'} />
      </mesh>
      {/* The island's ground, its tracks of red earth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, LAND + 1 + 200]} receiveShadow>
        <planeGeometry args={[560, 400]} />
        <meshLambertMaterial color={night ? '#3a4a2c' : '#8a9a5a'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-6, 0.08, LAND + 16]} receiveShadow>
        <planeGeometry args={[100, 26]} />
        <meshLambertMaterial color={night ? '#5a4030' : '#b8794a'} />
      </mesh>
      <Blocks at={trunks} material={mat('#6b4f34')} />
      <Blocks at={crowns} material={mat('#ffffff')} color />
      {PALMS.map(([x, z], i) => (
        <Palm key={i} at={[x, z]} seed={i} />
      ))}
    </group>
  )
}

function Palm({ at, seed }: { at: XZ; seed: number }) {
  const lean = (seed % 5) * 0.05 - 0.1
  return (
    <group position={[at[0], 0, at[1]]} rotation={[lean, seed, 0]}>
      <mesh position={[0, 3.5, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, 7, 6]} />
        <meshLambertMaterial color="#8a6a44" />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <mesh key={k} geometry={BOX} position={[Math.sin(k * 1.05) * 1.1, 6.9, Math.cos(k * 1.05) * 1.1]} rotation={[Math.cos(k * 1.05) * 0.55, k * 1.05, -Math.sin(k * 1.05) * 0.55]} scale={[0.55, 0.08, 2.6]} material={mat('#3f8a3a')} castShadow />
      ))}
    </group>
  )
}

/** A long wooden boat, painted, its outboard on the back. */
function Pinasse({ colors }: { colors: [string, string] }) {
  return (
    <group>
      <mesh geometry={BOX} position={[0, 0.35, 0]} scale={[7.5, 0.7, 1.5]} material={mat(colors[0])} castShadow />
      <mesh geometry={BOX} position={[0, 0.72, 0]} scale={[7.6, 0.1, 1.56]} material={mat(colors[1])} />
      {[-1, 1].map((k) => (
        <mesh key={k} geometry={BOX} position={[k * 4.1, 0.45, 0]} rotation={[0, 0, k * 0.35]} scale={[1.4, 0.5, 0.9]} material={mat(colors[0])} castShadow />
      ))}
      <mesh geometry={BOX} position={[0, 0.5, 0]} scale={[0.25, 0.3, 1.4]} material={mat('#6b4f34')} />
      <mesh geometry={BOX} position={[-4.6, 0.7, 0]} scale={[0.35, 0.9, 0.3]} material={mat('#2b2b30')} />
    </group>
  )
}

/** The village: its houses, the nets drying, the fish ovens and their smoke, the paillote; the weekend house and its jetty. */
function Village({ night }: { night: boolean }) {
  const walls = useMemo(() => HOUSES.map((h) => ({ p: [h.at[0], 1.3, h.at[1]] as [number, number, number], s: [h.w, 2.6, h.d] as [number, number, number], ry: h.ry, c: h.wall })), [])
  const roofs = useMemo(() => {
    const r = rng('boulay-toles')
    return HOUSES.map((h) => ({ p: [h.at[0], 2.75, h.at[1]] as [number, number, number], s: [h.w + 0.7, 0.14, h.d + 0.7] as [number, number, number], ry: h.ry, c: ['#9aa0a8', '#8a7a6a', '#a3a9b0', '#7f6a55'][Math.floor(r() * 4)] }))
  }, [])
  const doors = useMemo(() => HOUSES.map((h) => ({ p: [h.at[0] + Math.sin(h.ry) * (h.d / 2 + 0.02), 1, h.at[1] - Math.cos(h.ry) * (h.d / 2 + 0.02)] as [number, number, number], s: [0.9, 2, 0.08] as [number, number, number], ry: h.ry })), [])
  // The nets on their poles, between the boats and the houses.
  const poles = useMemo(() => [-30, -24, -18, 22, 28].map((x) => ({ p: [x, 1.2, LAND - 3] as [number, number, number], s: [0.12, 2.4, 0.12] as [number, number, number] })), [])
  const jetty = useMemo(() => [...Array(Math.round((JETTY.z0 - JETTY.z1) / 0.6))].map((_, i) => ({ p: [JETTY.x, 0.45, JETTY.z0 - i * 0.6] as [number, number, number], s: [2.4, 0.12, 0.5] as [number, number, number] })), [])
  return (
    <group>
      <Blocks at={walls} material={mat('#ffffff')} color />
      <Blocks at={roofs} material={mat('#ffffff')} color />
      <Blocks at={doors} material={mat('#5a3d28')} />
      {PINASSES.map((p, i) => (
        <group key={i} position={[p.at[0], 0.05, p.at[1]]} rotation={[0, p.ry, 0.06]}>
          <Pinasse colors={p.colors} />
        </group>
      ))}
      {/* The one that brought the Sim, at the landing in the water */}
      <group position={[LANDING[0] - 1.5, -0.2, LANDING[1] - 4.5]} rotation={[0, 0.2, 0]}>
        <Pinasse colors={['#f4efe6', '#00a862']} />
      </group>
      <Blocks at={poles} material={mat('#6b4f34')} />
      {[[-27, 6], [25, 6]].map(([x, w]) => (
        <mesh key={x} position={[x, 1.6, LAND - 3]}>
          <planeGeometry args={[w * 2 - 1, 1.6]} />
          <meshLambertMaterial color="#2f5a3a" transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <Smokers night={night} />
      {/* The paillote by the beach: drinks under the straw */}
      <group position={[34, 0, LAND + 3]}>
        {[[-2, -2], [2, -2], [-2, 2], [2, 2]].map(([x, z]) => (
          <mesh key={`${x}${z}`} geometry={BOX} position={[x, 1.3, z]} scale={[0.18, 2.6, 0.18]} material={mat('#6b4f34')} />
        ))}
        <mesh position={[0, 3.1, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[4, 1.6, 4]} />
          <meshLambertMaterial color="#c9a25a" />
        </mesh>
        <mesh geometry={BOX} position={[0, 0.55, 0]} scale={[2.4, 1.1, 0.8]} material={mat('#8a5a34')} />
      </group>
      {/* The weekend house: white, a tiled roof, its terrace on the water's side; its jetty and its speedboat */}
      <group position={[VILLA[0], 0, VILLA[1]]}>
        <mesh geometry={BOX} position={[0, 1.7, 0]} scale={[14, 3.4, 9]} material={mat('#f4f1ea')} castShadow />
        <mesh geometry={BOX} position={[0, 3.6, 0]} scale={[15, 0.5, 10]} material={mat('#b5532a')} castShadow />
        <mesh geometry={BOX} position={[0, 0.15, -6.5]} scale={[14, 0.3, 4]} material={mat('#c9b48c')} />
        <mesh geometry={BOX} position={[-3, 1.4, -4.55]} scale={[5, 2.2, 0.08]} material={mat('#9fc6dc')} />
        <mesh geometry={BOX} position={[3, 1.4, -4.55]} scale={[5, 2.2, 0.08]} material={mat('#9fc6dc')} />
      </group>
      <Blocks at={jetty} material={mat('#8a6a44')} />
      <group position={[JETTY.x - 3, 0, JETTY.z1 + 4]}>
        <Speedboat />
      </group>
    </group>
  )
}

/** A white speedboat, its windscreen, its engine. */
function Speedboat() {
  return (
    <group>
      <mesh geometry={BOX} position={[0, 0.35, 0]} scale={[2.2, 0.8, 6]} material={mat('#f8f9fa')} castShadow />
      <mesh geometry={BOX} position={[0, 0.5, 3.4]} rotation={[0.5, 0, 0]} scale={[1.4, 0.6, 1.4]} material={mat('#f8f9fa')} />
      <mesh geometry={BOX} position={[0, 0.78, 0.4]} scale={[2.1, 0.05, 0.6]} material={mat('#1d4ed8')} />
      <mesh geometry={BOX} position={[0, 1.05, 1]} rotation={[-0.4, 0, 0]} scale={[1.8, 0.5, 0.05]} material={mat('#9fc6dc')} />
      <mesh geometry={BOX} position={[0, 0.6, -3.1]} scale={[0.5, 0.9, 0.5]} material={mat('#2b2b30')} />
    </group>
  )
}

/** The ovens where the women smoke the fish, their smoke going up. */
function Smokers({ night }: { night: boolean }) {
  const puffs = useRef<(THREE.Mesh | null)[]>([])
  const ovens: XZ[] = [
    [-50, LAND + 3],
    [-47, LAND + 4.5],
    [-44, LAND + 3.2],
  ]
  useFrame(() => {
    const t = worldTime()
    puffs.current.forEach((m, i) => {
      if (!m) return
      const k = (t * 0.25 + i / 4) % 1
      const o = ovens[Math.floor(i / 4) % ovens.length]
      m.position.set(o[0] + Math.sin(t + i) * 0.3 + k * 1.2, 1 + k * 6, o[1] - k * 0.6)
      m.scale.setScalar(0.5 + k * 1.6)
      ;(m.material as THREE.MeshLambertMaterial).opacity = 0.45 * (1 - k)
    })
  })
  return (
    <group>
      {ovens.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={BOX} position={[0, 0.4, 0]} scale={[1.8, 0.8, 1.2]} material={mat('#a0522d')} castShadow />
          <mesh geometry={BOX} position={[0, 0.84, 0]} scale={[1.7, 0.08, 1.1]} material={mat('#3a3d44')} />
          <mesh geometry={BOX} position={[0, 0.9, 0]} scale={[1.4, 0.06, 0.8]} material={mat('#b07a3a', night ? '#3a1a00' : undefined)} />
        </group>
      ))}
      {[...Array(12)].map((_, i) => (
        <mesh key={i} ref={(m) => void (puffs.current[i] = m)}>
          <sphereGeometry args={[0.5, 8, 6]} />
          <meshLambertMaterial color="#cfcfcf" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/** Across the channel: Yopougon's shore, its houses, the Azito power station's two stacks. */
function Across({ night }: { night: boolean }) {
  const town = useMemo(() => {
    const r = rng('boulay-yopougon')
    return [...Array(80)].map(() => {
      const h = 4 + r() * 10
      return { p: [-900 + r() * 1800, h / 2, -1000 - r() * 180] as [number, number, number], s: [10 + r() * 20, h, 10 + r() * 16] as [number, number, number], c: night ? (r() < 0.3 ? '#4a4020' : '#1b2238') : ['#d9d6cf', '#e6dfd2', '#c9b48c', '#d2c3a8', '#b5532a'][Math.floor(r() * 5)] }
    })
  }, [night])
  return (
    <group>
      <mesh geometry={BOX} position={[0, 1, -1100]} scale={[4000, 2, 220]} material={mat(night ? '#2a2a34' : '#a9a27a')} />
      <Blocks at={town} material={mat('#ffffff')} color />
      {/* The power station: its hall and its stacks */}
      <mesh geometry={BOX} position={[180, 9, -1040]} scale={[70, 18, 40]} material={mat(night ? '#2b3040' : '#c7ccd2')} />
      {[160, 200].map((x) => (
        <mesh key={x} position={[x, 25, -1050]}>
          <cylinderGeometry args={[2.6, 3.2, 50, 12]} />
          <meshLambertMaterial color={night ? '#3a3d44' : '#e9e4da'} emissive={night ? '#ff3b30' : '#000000'} emissiveIntensity={night ? 0.15 : 0} />
        </mesh>
      ))}
      {/* Far off east, the city's towers over the water */}
      {[...Array(9)].map((_, i) => (
        <mesh key={i} geometry={BOX} position={[1300 + i * 45, 20 + (i % 3) * 14, -700 + (i % 4) * 30]} scale={[22, 40 + (i % 3) * 28, 22]} material={mat(night ? '#1b2238' : '#9fb0c2')} />
      ))}
    </group>
  )
}

/** The people of the village: mending nets, at the ovens, under the paillote, the boatman at the landing, two kids in the water's edge. */
function Villagers() {
  const list = useMemo(() => {
    const r = rng('boulay-gens')
    const one = (p: [number, number, number], ry: number, pose: Pose, dress?: string, g?: 'femme' | 'homme', kid = false) => {
      const gender: 'femme' | 'homme' = g ?? (r() < 0.5 ? 'femme' : 'homme')
      const look = randomLook(gender, r)
      return { p, ry, pose, gender, look: dress ? { ...look, outfit: dress } : look, seed: r() * 100, kid }
    }
    return [
      // The nets: two fishermen mending them, sitting on the sand.
      one([-27, 0.05, LAND - 4.2], 0, 'busy', 'debardeur', 'homme'),
      one([24, 0.05, LAND - 4.2], 0, 'busy', 'debardeur', 'homme'),
      one([-10, 0, 3.4], -1.2, 'talk', 'short', 'homme'),
      // The women at the ovens, turning the fish.
      one([-50, 0, LAND + 4.3], Math.PI, 'cook', 'pagne', 'femme'),
      one([-44, 0, LAND + 4.5], Math.PI, 'cook', 'pagne', 'femme'),
      one([-47, 0, LAND + 2.9], 0, 'talk', 'pagne', 'femme'),
      // Under the paillote.
      one([33, 0.05, LAND + 1.6], 0, 'drink'),
      one([35.6, 0, LAND + 3], -Math.PI / 2, 'busy'),
      // The boatman, by his pinasse.
      one([LANDING[0] - 3.4, 0, LANDING[1] - 0.6], 2.6, 'idle', 'debardeur', 'homme'),
      // On the village square, the old men under the tree; the kids at the water.
      one([-14, 0.05, LAND + 16], 0.4, 'sit', 'boubou', 'homme'),
      one([-12.4, 0.05, LAND + 16.6], -0.6, 'talk', 'boubou', 'homme'),
      one([4, 0, 0.6], Math.PI, 'wave', undefined, undefined, true),
      one([6, 0, 0.2], Math.PI, 'cheer', undefined, undefined, true),
    ]
  }, [])
  return (
    <NoShadows>
      {list.map((g, i) => (
        <group key={i} position={g.p} rotation={[0, g.ry, 0]} scale={g.kid ? 0.62 : 1}>
          <TalkHuman id={`boulay-${i}`} look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
        </group>
      ))}
      {/* The village's big tree, over the old men */}
      <mesh position={[-13, 3, LAND + 18]} castShadow>
        <cylinderGeometry args={[0.5, 0.7, 6, 7]} />
        <meshLambertMaterial color="#6b4f34" />
      </mesh>
      <mesh geometry={BOX} position={[-13, 6.5, LAND + 18]} scale={[9, 3, 8]} material={mat('#3f7a34')} castShadow />
    </NoShadows>
  )
}

/** Water-skiing: the speedboat round its loop off the beach, the Sim behind it on the rope; the camera following. */
function Skier({ sim, stage }: { sim: Sim; stage: string }) {
  const boat = useRef<THREE.Group>(null)
  const ski = useRef<THREE.Group>(null)
  const rope = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  const along = (t: number) => {
    const a = t * SKI.speed
    return { p: new THREE.Vector3(SKI.c[0] + Math.cos(a) * SKI.r[0], 0, SKI.c[1] + Math.sin(a) * SKI.r[1]), a }
  }
  useFrame((_, dt) => {
    const t = worldTime()
    const b = along(t)
    // The skier 14 m behind the boat, on its rope, swinging out to one side and the other.
    const dir = new THREE.Vector3(-Math.sin(b.a) * SKI.r[0], 0, Math.cos(b.a) * SKI.r[1]).normalize()
    const side = new THREE.Vector3(dir.z, 0, -dir.x)
    const out = Math.sin(t * 0.9) * 4
    const s = b.p.clone().addScaledVector(dir, -14).addScaledVector(side, out)
    const heading = Math.atan2(dir.x, dir.z)
    if (boat.current) {
      boat.current.position.copy(b.p)
      boat.current.rotation.y = heading
    }
    if (ski.current) {
      ski.current.position.copy(s)
      // Facing the boat on the rope, leaning into the swing.
      ski.current.rotation.set(0, Math.atan2(b.p.x - s.x, b.p.z - s.z), -Math.cos(t * 0.9) * 0.25)
    }
    if (rope.current) {
      const [from, to] = [b.p.clone().setY(0.9), s.clone().setY(1.1)]
      rope.current.position.copy(from).add(to).multiplyScalar(0.5)
      rope.current.lookAt(to)
      rope.current.scale.set(1, 1, from.distanceTo(to))
    }
    // The camera comes along, on the boat and the skier both (the island behind them).
    if (controls) {
      const k = Math.min(1, dt * 2)
      const [mx, mz] = [(s.x + b.p.x) / 2, (s.z + b.p.z) / 2]
      const [ox, oz] = [(mx - controls.target.x) * k, (mz - controls.target.z) * k]
      controls.target.x += ox
      controls.target.z += oz
      camera.position.x += ox
      camera.position.z += oz
      controls.update()
    }
  })
  const rideLook = useMemo(() => ({ ...sim.look, outfit: 'maillot', accessory: 'none' }), [sim.look])
  return (
    <group>
      <group ref={boat}>
        <Speedboat />
        <group position={[0, 0.7, 0.6]}>
          <Character look={randomLook('homme', rng('boulay-pilote'))} gender="homme" pose="sit" stage="adulte" marker={false} />
        </group>
        {/* The wake behind */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -7]}>
          <planeGeometry args={[2.6, 9]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      </group>
      <mesh ref={rope}>
        <boxGeometry args={[0.03, 0.03, 1]} />
        <meshBasicMaterial color="#f2b705" />
      </mesh>
      <group ref={ski}>
        {[-0.18, 0.18].map((x) => (
          <mesh key={x} geometry={BOX} position={[x, 0.06, 0.2]} scale={[0.16, 0.05, 1.7]} material={mat('#ff7a00')} />
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -1.6]}>
          <planeGeometry args={[1, 2.6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} />
        </mesh>
        <group position={[0, 0.08, 0]}>
          <Character look={rideLook} gender={sim.gender} pose="keeper" stage={stage} />
        </group>
      </group>
    </group>
  )
}
