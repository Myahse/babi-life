import { SpotActions } from '../SpotActions'
import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Player, Sim } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import { NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { Character } from '../Character'
import { TalkHuman } from '../Talkable'
import { BOX, Blocks } from '../open/ruePrincesse'
import { Dish } from './ActionProps'
import { Guest, mat, sign, useBigWalk, type Spot, type XZ, spotWhere, RichAO } from './bigPlace'
import { t as tr } from '../../lib/i18n'

// A beach on the ocean (Port-Bouët, Bassam, San-Pédro): one comes down from
// the road onto the sand, the Atlantic's rollers breaking white and running
// up the beach, the red flag by the lifeguard's chair (the bar is strong
// here); the paillotes and their plastic chairs, the fish on the grill and
// its smoke, the coconut seller's cart; a match on the sand, the pirogues
// pulled up, a horse led along the water. Behind the road, the town: the
// lighthouse at Port-Bouët, the old colonial houses at Bassam. What's done
// there is done on the sand or in the waves, not by the road.
// The frame: the shore along x, the sea north (-z), the road south (+z).

/** The water's edge, the road's wall. */
const WALL_Z = 34.8
const ENTRANCE: XZ = [0, WALL_Z - 1.4]
/** The paillotes: their tables under the straw. */
const PAILLOTES: XZ[] = [
  [-14, 19.5],
  [-6, 20.5],
  [2, 19.5],
  [10, 20.5],
]
/** The bar of the paillotes, its grill; the coconut seller's cart; the lifeguard's chair. */
const SHACK = { x: 27, z: 26.5, w: 12, d: 3.4 }
const GRILL: XZ = [19.5, 25.5]
const CART: XZ = [-20, 23]
const LIFEGUARD: XZ = [24, 5.5]
/** The match on the sand. */
const PITCH: XZ = [-28, 11.5]
/** The pirogues pulled up, the fishermen's side. */
const PIROGUES: { at: XZ; ry: number; colors: [string, string] }[] = [
  { at: [-46, 6.5], ry: 1.45, colors: ['#1d4ed8', '#f2b705'] },
  { at: [-40, 7.4], ry: 1.6, colors: ['#c92a2a', '#f4efe6'] },
  { at: [-52, 7], ry: 1.5, colors: ['#00a862', '#f2b705'] },
]
const PALMS: XZ[] = (() => {
  const r = rng('plage-cocotiers')
  const out: XZ[] = []
  // Along the wall, the middle left open (the sea seen from the road).
  for (let i = 0; i < 12; i++) {
    const x = -62 + i * 11 + r() * 3
    if (Math.abs(x) > 8) out.push([x, 30 + r() * 3.5])
  }
  out.push([12.8, 8.2], [-19, 15], [30, 14], [-52, 15])
  return out
})()
/** Where the Sim lies in the sun, on its towel under a parasol. */
const TOWEL: XZ = [16, 9]

function free(x: number, z: number) {
  if (z < -0.6 || z > WALL_Z - 0.6 || Math.abs(x) > 58) return false
  for (const [px, pz] of PAILLOTES) if (Math.hypot(x - px, z - pz) < 1.5) return false
  if (Math.abs(x - SHACK.x) < SHACK.w / 2 + 0.4 && Math.abs(z - SHACK.z) < SHACK.d / 2 + 0.4) return false
  if (Math.hypot(x - GRILL[0], z - GRILL[1]) < 1) return false
  if (Math.abs(x - CART[0]) < 1.2 && Math.abs(z - CART[1]) < 0.9) return false
  if (Math.abs(x - LIFEGUARD[0]) < 1 && Math.abs(z - LIFEGUARD[1]) < 1) return false
  for (const p of PIROGUES) if (Math.hypot(x - p.at[0], z - p.at[1]) < 2.2) return false
  for (const [px, pz] of PALMS) if (Math.hypot(x - px, z - pz) < 0.45) return false
  return true
}

const SPOTS: Record<string, Spot> = {
  // Into the waves from the water's edge, swimming along the shore.
  swim: { at: [6, -5.5], rot: Math.PI / 2, pose: 'swim', swim: 5, from: [6, -0.3] },
  // On the towel under the parasol, in the sun.
  'chill-sand': { at: TOWEL, rot: Math.PI, pose: 'idle', lying: true, y: 0.16, from: [TOWEL[0] + 1, TOWEL[1] + 0.4] },
  // At a paillote's table, facing the sea, the braised fish in front.
  'eat-fish': { at: [PAILLOTES[2][0], PAILLOTES[2][1] + 0.55], rot: Math.PI, pose: 'eat', y: 0.05, from: [PAILLOTES[2][0], PAILLOTES[2][1] + 1.7] },
  // Along the water, from one end of the beach to the other and back.
  'balade-plage': { at: [26, 2.8], rot: 0, pose: 'walk', loop: { c: [0, 2.8], r: [26, 1.2], speed: 0.05 } },
  // In the match on the sand.
  'foot-plage': { at: [PITCH[0] + 3.2, PITCH[1]], rot: -Math.PI / 2, pose: 'kick' },
  // At the coconut seller's cart, the nut opened with the machete, drunk from it.
  'coco-plage': { at: [CART[0], CART[1] - 1.2], rot: 0, pose: 'snack' },
}

type Variant = { bar: string; flag: string; town: 'phare' | 'colonial' | 'port' }
const VARIANTS: Record<string, Variant> = {
  'pb-plage': { bar: tr('PAILLOTE LA VAGUE · POISSON BRAISÉ'), flag: '#e03131', town: 'phare' },
  'bassam-plage': { bar: tr('CHEZ TANTIE AMENAN · POISSON BRAISÉ'), flag: '#f2b705', town: 'colonial' },
  'sp-plage': { bar: tr('LA PAILLOTE DU PORT'), flag: '#e03131', town: 'port' },
}

export function BeachScene({ sim, placeId, interactionId, roam, night, stage, others = [] }: { sim: Sim; placeId: string; interactionId?: string; /** Just come down onto the sand: walk about (tap it, or the keys). */ roam?: boolean; night: boolean; stage: string; /** Other players on this beach, each at what it's doing (blue pin). */ others?: Player[] }) {
  const v = VARIANTS[placeId] ?? VARIANTS['pb-plage']
  const spot = interactionId ? (SPOTS[interactionId] ?? null) : null
  const { way, tap, onMoved } = useBigWalk(spot, interactionId, roam, free, ENTRANCE)
  // In the swimsuit for the sea and the sun; the plate of fish on the table.
  const look = interactionId === 'swim' || interactionId === 'chill-sand' ? { ...sim.look, outfit: 'maillot', accessory: 'none' } : undefined
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [4, 16, 46], fov: 45, near: 0.3, far: 4000 }} style={{ background: night ? '#0b1026' : '#9fd3f2' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={[night ? '#6070b0' : '#ffffff', '#d8c08a', night ? 0.8 : 1.15]} />
          <directionalLight position={[40, 80, -60]} intensity={night ? 0.3 : 1.45} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={45} shadow-camera-bottom={-45} />
          {night && PAILLOTES.map(([x, z]) => <pointLight key={x} position={[x, 3, z]} intensity={40} distance={14} color="#ffd9a0" />)}
          <Sand night={night} roam={!!roam && !interactionId} onTap={tap} />
          <Sea night={night} />
          <Paillotes bar={v.bar} night={night} />
          <Grill />
          <Cart />
          <Lifeguard flag={v.flag} />
          {PIROGUES.map((p, i) => (
            <group key={i} position={[p.at[0], 0.05, p.at[1]]} rotation={[0, p.ry, 0.05]}>
              <Pirogue colors={p.colors} />
            </group>
          ))}
          {PALMS.map(([x, z], i) => (
            <Palm key={i} at={[x, z]} seed={i} />
          ))}
          <Road night={night} town={v.town} />
          <Bathers night={night} />
          <Match />
          <Strollers />
          {others.slice(0, 4).map((o, i) => (
            <Other key={o.id} player={o} i={i} />
          ))}
          <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!!roam && !interactionId} onMoved={onMoved} free={free} entrance={ENTRANCE} look={look}>
            {interactionId === 'eat-fish' && <Dish kind="poisson" />}
          </Guest>
          {/* What's done here, over where it's done (SpotActions): tap one, the Sim goes */}
          <SpotActions shown={!!roam && !interactionId} where={spotWhere(SPOTS)} entrance={[ENTRANCE[0], 0, ENTRANCE[1]]} />
          <OrbitControls makeDefault target={[0, 0, 14]} enablePan={false} minDistance={6} maxDistance={90} minPolarAngle={0.25} maxPolarAngle={1.35} enableDamping />
        </Suspense>
        <RichAO radius={3} falloff={1.5} intensity={1.6} />
      </Canvas>
    </div>
  )
}

/** Another player, beside the Sim's own spot for what it's doing (or by the way down to the sand). */
function Other({ player, i }: { player: Player; i: number }) {
  const id = player.activity?.interactionId ?? ''
  const s = SPOTS[id]
  const dx = [1.3, -1.3, 2.6, -2.6][i]
  const swim = id === 'swim' || id === 'chill-sand'
  const look = swim ? { ...player.look, outfit: 'maillot', accessory: 'none' } : player.look
  if (!s) {
    return (
      <group position={[ENTRANCE[0] + dx, 0, ENTRANCE[1] - 3]} rotation={[0, Math.PI, 0]}>
        <Character look={look} gender={player.gender} stage={player.stage} moodColor="#3b82f6" />
      </group>
    )
  }
  // Along the shore (or the walk's loop): beside the spot, on the same line.
  const [x, z] = s.loop ? [s.loop.c[0] + dx * 3, s.loop.c[1]] : [s.at[0] + dx, s.at[1]]
  return (
    <group position={[x, s.lying ? (s.y ?? 0) : s.swim ? 0 : 0, z]} rotation={[0, s.rot, 0]}>
      <group rotation={s.lying ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
        <Character look={look} gender={player.gender} stage={player.stage} pose={s.loop ? 'idle' : s.pose} moodColor="#3b82f6" marker={!s.lying} />
      </group>
    </group>
  )
}

/* ---------- The sand, the sea and its waves ---------- */

function Sand({ night, roam, onTap }: { night: boolean; roam: boolean; onTap: (p: XZ) => void }) {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, (WALL_Z - 0.5) / 2]}
        receiveShadow
        onClick={(e) => {
          if (!roam || e.delta > 6) return
          e.stopPropagation()
          onTap([e.point.x, e.point.z])
        }}
      >
        <planeGeometry args={[240, WALL_Z + 0.5]} />
        <meshLambertMaterial color={night ? '#6e6250' : '#ead7a6'} />
      </mesh>
      {/* Wet, darker, where the waves come up */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 1.5]} receiveShadow>
        <planeGeometry args={[240, 4]} />
        <meshLambertMaterial color={night ? '#4e4638' : '#c9b282'} />
      </mesh>
    </group>
  )
}

/** The ocean: deep blue out there, green near the shore; the rollers coming in and breaking white, the foam running up the sand and back. */
function Sea({ night }: { night: boolean }) {
  const breakers = useRef<(THREE.Mesh | null)[]>([])
  const swash = useRef<THREE.Mesh>(null)
  const N = 5
  useFrame(() => {
    const t = worldTime()
    breakers.current.forEach((m, i) => {
      if (!m) return
      // Each roller comes in, rises, breaks and spreads, one after the other.
      const p = (t * 0.11 + i / N) % 1
      const rise = Math.sin(p * Math.PI)
      m.position.set(0, 0.04 + rise * 0.15, -30 + 29 * p)
      m.scale.set(300, 0.06 + rise * 0.3, 0.6 + p * 2.4)
      ;(m.material as THREE.MeshLambertMaterial).opacity = (night ? 0.35 : 0.85) * rise
    })
    const s = swash.current
    if (s) {
      // The thin sheet of foam up the beach, and back.
      const up = Math.max(0, Math.sin(t * 0.69))
      const far = 0.5 + up * 3.2
      s.scale.set(300, 0.02, far + 1)
      s.position.set(0, 0.04, (far - 1) / 2)
      ;(s.material as THREE.MeshLambertMaterial).opacity = 0.2 + up * 0.35
    }
  })
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -700]}>
        <planeGeometry args={[5000, 1400]} />
        <meshLambertMaterial color={night ? '#0b2033' : '#1f6f9a'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -17]}>
        <planeGeometry args={[400, 36]} />
        <meshLambertMaterial color={night ? '#123044' : '#3aa6b9'} transparent opacity={0.85} />
      </mesh>
      {[...Array(N)].map((_, i) => (
        <mesh key={i} ref={(m) => void (breakers.current[i] = m)} geometry={BOX}>
          <meshLambertMaterial color="#f4fbff" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={swash} geometry={BOX}>
        <meshLambertMaterial color="#eef8fb" transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ---------- The paillotes, the grill, the cart, the lifeguard ---------- */

function Paillotes({ bar, night }: { bar: string; night: boolean }) {
  const label = useMemo(() => sign(bar, '#0b6b3d', '#ffd166', 1024, 112), [bar])
  // The plastic chairs, in their colours, round each table.
  const chairs = useMemo(() => {
    const colors = ['#c92a2a', '#1d4ed8', '#f8f9fa', '#2f9e44']
    return PAILLOTES.flatMap(([x, z], i) =>
      [
        [0, 0.55],
        [0, -0.55],
        [0.75, 0],
      ].map(([dx, dz], k) => ({ p: [x + dx, 0.24, z + dz] as [number, number, number], s: [0.45, 0.46, 0.45] as [number, number, number], c: colors[(i + k) % colors.length] })),
    )
  }, [])
  return (
    <group>
      {PAILLOTES.map(([x, z]) => (
        <group key={x} position={[x, 0, z]}>
          {/* The pole, the straw roof, the table */}
          <mesh geometry={BOX} position={[0, 1.4, 0]} scale={[0.14, 2.8, 0.14]} material={mat('#6b4f34')} />
          <mesh position={[0, 2.9, 0]} castShadow>
            <coneGeometry args={[2.1, 1, 10]} />
            <meshLambertMaterial color="#c9a25a" />
          </mesh>
          <mesh geometry={BOX} position={[0, 0.74, 0]} scale={[1, 0.05, 0.75]} material={mat('#f8f9fa')} />
          <mesh geometry={BOX} position={[0, 0.37, 0]} scale={[0.07, 0.74, 0.07]} material={mat('#f8f9fa')} />
        </group>
      ))}
      <Blocks at={chairs} material={mat('#ffffff')} color />
      {/* The bar: a wooden shack, a tin roof, its sign; the crates, the cooler, the speaker */}
      <group position={[SHACK.x, 0, SHACK.z]}>
        <mesh geometry={BOX} position={[0, 0.55, 0]} scale={[SHACK.w, 1.1, 0.8]} material={mat('#8a5a34')} castShadow />
        {/* The shelves behind, low (the beach seen over them from the road) */}
        <mesh geometry={BOX} position={[0, 0.7, 1.2]} scale={[SHACK.w, 1.4, 0.3]} material={mat('#a8743f')} />
        <mesh geometry={BOX} position={[0, 2.95, 0.5]} rotation={[0.12, 0, 0]} scale={[SHACK.w + 1, 0.1, SHACK.d + 0.6]} material={mat('#9aa0a8')} castShadow />
        {[-SHACK.w / 2, SHACK.w / 2].flatMap((dx) => [-1.4, 1.4].map((dz) => <mesh key={`${dx}${dz}`} geometry={BOX} position={[dx, 1.4, dz]} scale={[0.15, 2.8, 0.15]} material={mat('#6b4f34')} />))}
        {/* Its name, on both sides of the roof's edge */}
        <mesh position={[0, 2.35, -1.5]} rotation={[0, Math.PI, 0]} material={label}>
          <planeGeometry args={[8, 0.88]} />
        </mesh>
        <mesh position={[0, 2.35, 1.95]} material={label}>
          <planeGeometry args={[8, 0.88]} />
        </mesh>
        <mesh geometry={BOX} position={[-4.5, 0.4, -1.1]} scale={[0.9, 0.8, 0.6]} material={mat('#1d4ed8')} />
        <mesh geometry={BOX} position={[5.4, 0.6, -0.9]} scale={[0.6, 1.2, 0.5]} material={mat('#1d1d24')} />
        {night && <pointLight position={[0, 2.4, -0.6]} intensity={30} distance={12} color="#ffb86b" />}
      </group>
    </group>
  )
}

/** The barrel grill, the fish on it, its smoke drifting off the sea. */
function Grill() {
  const puffs = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const t = worldTime()
    puffs.current.forEach((m, i) => {
      if (!m) return
      const k = (t * 0.3 + i / 8) % 1
      m.position.set(GRILL[0] + k * 1.6 + Math.sin(t + i) * 0.2, 1.1 + k * 4, GRILL[1] + k * 0.8)
      m.scale.setScalar(0.3 + k * 1.2)
      ;(m.material as THREE.MeshLambertMaterial).opacity = 0.45 * (1 - k)
    })
  })
  return (
    <group>
      <group position={[GRILL[0], 0, GRILL[1]]}>
        <mesh position={[0, 0.6, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 1.1, 12, 1, false, 0, Math.PI]} />
          <meshLambertMaterial color="#3a3d44" side={THREE.DoubleSide} />
        </mesh>
        {[-0.45, 0.45].map((x) => (
          <mesh key={x} geometry={BOX} position={[x, 0.3, 0]} scale={[0.06, 0.6, 0.6]} material={mat('#2b2b30')} />
        ))}
        {[-0.25, 0.05, 0.3].map((x) => (
          <mesh key={x} geometry={BOX} position={[x, 0.64, 0]} scale={[0.14, 0.05, 0.4]} material={mat('#9a5a22', '#3a1a00')} />
        ))}
      </group>
      {[...Array(8)].map((_, i) => (
        <mesh key={i} ref={(m) => void (puffs.current[i] = m)}>
          <sphereGeometry args={[0.5, 8, 6]} />
          <meshLambertMaterial color="#d6d6d6" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/** The coconut seller's cart, the green nuts piled up. */
function Cart() {
  const nuts = useMemo(() => [...Array(9)].map((_, i) => ({ p: [-0.5 + (i % 3) * 0.45, 0.95 + Math.floor(i / 3) * 0.12, -0.2 + Math.floor(i / 3) * 0.2] as [number, number, number], s: [0.3, 0.3, 0.3] as [number, number, number] })), [])
  return (
    <group position={[CART[0], 0, CART[1]]}>
      <mesh geometry={BOX} position={[0, 0.7, 0]} scale={[1.8, 0.2, 1.1]} material={mat('#6b4f34')} />
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.32, 0.55]} rotation={[Math.PI / 2, 0, 0]} material={mat('#2b2b30')}>
          <cylinderGeometry args={[0.32, 0.32, 0.08, 12]} />
        </mesh>
      ))}
      <Blocks at={nuts} material={mat('#5c8a2a')} />
    </group>
  )
}

/** The lifeguard's tall chair, the flag on its pole (red: no swimming far out). */
function Lifeguard({ flag }: { flag: string }) {
  const cloth = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (cloth.current) cloth.current.rotation.y = Math.sin(worldTime() * 3) * 0.25
  })
  return (
    <group position={[LIFEGUARD[0], 0, LIFEGUARD[1]]}>
      {[-0.5, 0.5].flatMap((x) => [-0.5, 0.5].map((z) => <mesh key={`${x}${z}`} geometry={BOX} position={[x, 0.9, z]} scale={[0.1, 1.8, 0.1]} material={mat('#f8f9fa')} />))}
      <mesh geometry={BOX} position={[0, 1.8, 0]} scale={[1.2, 0.1, 1.2]} material={mat('#e03131')} />
      <mesh geometry={BOX} position={[0, 2.3, 0.55]} scale={[1.2, 0.9, 0.08]} material={mat('#e03131')} />
      <mesh geometry={BOX} position={[1.5, 2.5, 0]} scale={[0.07, 5, 0.07]} material={mat('#adb5bd')} />
      <mesh ref={cloth} position={[1.5, 4.6, 0]}>
        <boxGeometry args={[0.02, 0.6, 0.9]} />
        <meshLambertMaterial color={flag} />
      </mesh>
    </group>
  )
}

/** A long fishing pirogue, painted, pulled up on the sand. */
function Pirogue({ colors }: { colors: [string, string] }) {
  return (
    <group>
      <mesh geometry={BOX} position={[0, 0.3, 0]} scale={[8, 0.6, 1.3]} material={mat(colors[0])} castShadow />
      <mesh geometry={BOX} position={[0, 0.62, 0]} scale={[8.1, 0.08, 1.36]} material={mat(colors[1])} />
      {[-1, 1].map((k) => (
        <mesh key={k} geometry={BOX} position={[k * 4.3, 0.42, 0]} rotation={[0, 0, k * 0.4]} scale={[1.3, 0.45, 0.8]} material={mat(colors[0])} castShadow />
      ))}
      {[-2, 0, 2].map((x) => (
        <mesh key={x} geometry={BOX} position={[x, 0.45, 0]} scale={[0.2, 0.2, 1.2]} material={mat('#6b4f34')} />
      ))}
    </group>
  )
}

function Palm({ at, seed }: { at: XZ; seed: number }) {
  const lean = (seed % 5) * 0.06 - 0.12
  return (
    <group position={[at[0], 0, at[1]]} rotation={[lean, seed, 0]}>
      <mesh position={[0, 3.6, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, 7.2, 6]} />
        <meshLambertMaterial color="#8a6a44" />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <mesh key={k} geometry={BOX} position={[Math.sin(k * 1.05) * 1.1, 7.1, Math.cos(k * 1.05) * 1.1]} rotation={[Math.cos(k * 1.05) * 0.55, k * 1.05, -Math.sin(k * 1.05) * 0.55]} scale={[0.55, 0.08, 2.6]} material={mat('#3f8a3a')} castShadow />
      ))}
    </group>
  )
}

/* ---------- Behind: the wall, the road, the town ---------- */

function Road({ night, town }: { night: boolean; town: Variant['town'] }) {
  const houses = useMemo(() => {
    const r = rng(`plage-ville-${town}`)
    return [...Array(26)].map((_, i) => {
      const colonial = town === 'colonial'
      const h = colonial ? 7 + r() * 3 : 3 + r() * 4
      const c = colonial ? ['#f2c94c', '#e8a87c', '#d9cbb0', '#f4efe6', '#b5d3c4'][Math.floor(r() * 5)] : ['#d9cbb0', '#e8dcc4', '#c9b48c', '#e3c9a0', '#f4efe6'][Math.floor(r() * 5)]
      return { p: [-75 + i * 6 + r() * 1.5, h / 2, 62 + r() * 6] as [number, number, number], s: [5 + r() * 1.5, h, 6] as [number, number, number], c: night ? '#2a2e40' : c }
    })
  }, [town, night])
  const roofs = useMemo(() => houses.map((b) => ({ p: [b.p[0], b.s[1] + 0.15, b.p[2]] as [number, number, number], s: [b.s[0] + 0.6, 0.3, b.s[2] + 0.6] as [number, number, number], c: town === 'colonial' ? '#b5532a' : '#9aa0a8' })), [houses, town])
  return (
    <group>
      {/* The low wall along the sand, open where one comes down */}
      <Blocks
        at={[
          { p: [-31.5, 0.35, WALL_Z], s: [59, 0.7, 0.4] },
          { p: [31.5, 0.35, WALL_Z], s: [59, 0.7, 0.4] },
        ]}
        material={mat('#f4efe6')}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, WALL_Z + 6]} receiveShadow>
        <planeGeometry args={[400, 11]} />
        <meshLambertMaterial color={night ? '#26282c' : '#55585e'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 80]}>
        <planeGeometry args={[600, 90]} />
        <meshLambertMaterial color={night ? '#3a3a34' : '#c9b48c'} />
      </mesh>
      <Blocks at={houses} material={mat('#ffffff')} color />
      <Blocks at={roofs} material={mat('#ffffff')} color />
      {/* Bassam: the arcades of the old houses' verandas */}
      {town === 'colonial' &&
        houses.map((b, i) => (
          <mesh key={i} geometry={BOX} position={[b.p[0], 3.2, b.p[2] - b.s[2] / 2 - 0.6]} scale={[b.s[0], 0.25, 1.2]} material={mat(night ? '#2a2e40' : '#f4efe6')} />
        ))}
      {/* Port-Bouët: the lighthouse, red and white, over the roofs */}
      {town === 'phare' && (
        <group position={[-40, 0, 78]}>
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <mesh key={k} position={[0, 2.5 + k * 5, 0]} material={mat(k % 2 ? '#f8f9fa' : '#c92a2a')}>
              <cylinderGeometry args={[2.2 - k * 0.2, 2.4 - k * 0.2, 5, 12]} />
            </mesh>
          ))}
          <mesh position={[0, 31.5, 0]} material={mat('#2e3540', night ? '#ffd166' : undefined)}>
            <cylinderGeometry args={[1.3, 1.3, 2, 12]} />
          </mesh>
        </group>
      )}
    </group>
  )
}

/* ---------- The people on the beach ---------- */

type Still = { p: [number, number, number]; ry: number; pose: Pose; gender: 'femme' | 'homme'; look: ReturnType<typeof randomLook>; seed: number; lying?: boolean; towel?: string }

function Bathers({ night }: { night: boolean }) {
  const still = useMemo<Still[]>(() => {
    const r = rng('plage-baigneurs')
    const one = (p: [number, number, number], ry: number, pose: Pose, outfit?: [string, string], extra?: Partial<Still>): Still => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      return { p, ry, pose, gender, look: outfit ? { ...look, outfit: outfit[0], outfitColor: outfit[1], accessory: 'none' } : look, seed: r() * 100, ...extra }
    }
    const swim: [string, string] = ['maillot', '#1d4ed8']
    return [
      // In the waves up to the waist, jumping them, calling to the others.
      ...(night ? [] : ([[-4, -3.2, 'wave'], [-2.6, -4.4, 'cheer'], [1, -3.6, 'leap'], [11, -3, 'wave'], [13, -4.2, 'idle']] as [number, number, Pose][]).map(([x, z, pose]) => one([x, -0.75, z], 0.3, pose, swim))),
      // At the paillotes' tables, eating the fish, a drink.
      one([PAILLOTES[0][0], 0.05, PAILLOTES[0][1] + 0.55], Math.PI, 'eat'),
      one([PAILLOTES[0][0], 0.05, PAILLOTES[0][1] - 0.55], 0, 'drink'),
      one([PAILLOTES[1][0] + 0.75, 0.05, PAILLOTES[1][1]], -Math.PI / 2, 'drink'),
      one([PAILLOTES[2][0], 0.05, PAILLOTES[2][1] - 0.55], 0, 'eat'),
      one([PAILLOTES[3][0], 0.05, PAILLOTES[3][1] + 0.55], Math.PI, 'sit'),
      one([PAILLOTES[3][0] + 0.75, 0.05, PAILLOTES[3][1]], -Math.PI / 2, 'eat'),
      // Behind the bar, at the grill, the coconut seller with the machete.
      one([SHACK.x - 3, 0, SHACK.z + 0.6], Math.PI, 'busy', ['pagne', '#e8590c']),
      one([SHACK.x + 2, 0, SHACK.z + 0.6], Math.PI, 'idle', ['debardeur', '#f8f9fa']),
      one([GRILL[0], 0, GRILL[1] + 0.8], Math.PI, 'cook', ['pagne', '#2f9e44']),
      one([CART[0] + 1.2, 0, CART[1]], -Math.PI / 2, 'busy', ['debardeur', '#f2c230']),
      // The lifeguard up on his chair, in red.
      one([LIFEGUARD[0], 1.85, LIFEGUARD[1] + 0.1], Math.PI, 'sit', ['debardeur', '#e03131']),
      // Lying in the sun on their towels.
      ...(night ? [] : ([[-10, 8.5, '#f08a24'], [-7.6, 9.2, '#1d4ed8'], [22, 10.5, '#2f9e44']] as [number, number, string][]).map(([x, z, towel]) => one([x, 0.16, z], Math.PI, 'idle', ['maillot', '#c92a2a'], { lying: true, towel }))),
      // Sitting on the sand looking at the sea.
      one([-16, 0, 5.5], Math.PI, 'sit'),
      one([-15.2, 0, 5.6], Math.PI, 'sit'),
    ]
  }, [night])
  return (
    <group>
      {/* The Sim's own towel and parasol, and the others' towels */}
      <mesh geometry={BOX} position={[TOWEL[0], 0.04, TOWEL[1] + 0.85]} scale={[0.9, 0.03, 1.9]} material={mat('#ffd166')} />
      <group position={[TOWEL[0] - 1, 0, TOWEL[1] + 0.6]}>
        <mesh geometry={BOX} position={[0, 1.1, 0]} rotation={[0, 0, 0.15]} scale={[0.05, 2.2, 0.05]} material={mat('#f8f9fa')} />
        <mesh position={[0.18, 2.2, 0]} rotation={[0, 0, 0.15]}>
          <coneGeometry args={[1.3, 0.45, 8]} />
          <meshLambertMaterial color="#e03131" />
        </mesh>
      </group>
      {still
        .filter((s) => s.towel)
        .map((s, i) => (
          <mesh key={i} geometry={BOX} position={[s.p[0], 0.04, s.p[2] + 0.85]} scale={[0.9, 0.03, 1.9]} material={mat(s.towel!)} />
        ))}
      <NoShadows>
        {still.map((g, i) => (
          <group key={i} position={g.p} rotation={[0, g.ry, 0]}>
            <group rotation={g.lying ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
              <TalkHuman id={`plage-${i}`} look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
            </group>
          </group>
        ))}
      </NoShadows>
    </group>
  )
}

/** The match on the sand: two goals of sandals, the players round the ball going from one to the next. */
function Match() {
  const players = useMemo(() => {
    const r = rng('plage-foot')
    const at: [number, number, Pose][] = [
      [-4.5, 0, 'keeper'],
      [-2, -1.6, 'run'],
      [-1.4, 1.5, 'kick'],
      [1.2, -1.2, 'run'],
      [1.8, 1.6, 'kick'],
      [4.5, 0, 'keeper'],
    ]
    return at.map(([dx, dz, pose]) => {
      const gender: 'femme' | 'homme' = r() < 0.8 ? 'homme' : 'femme'
      const look = randomLook(gender, r)
      return { p: [PITCH[0] + dx, 0, PITCH[1] + dz] as [number, number, number], pose, gender, look: { ...look, outfit: r() < 0.5 ? 'debardeur' : 'jersey' }, seed: r() * 100 }
    })
  }, [])
  const ball = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = ball.current
    if (!m) return
    // From one player to the next, a little bounce each time.
    const t = worldTime() * 0.7
    const i = Math.floor(t) % players.length
    const k = t % 1
    const a = players[i].p
    const b = players[(i + 2) % players.length].p
    m.position.set(a[0] + (b[0] - a[0]) * k, 0.12 + Math.sin(k * Math.PI) * 0.8, a[2] + (b[2] - a[2]) * k)
  })
  return (
    <group>
      {/* The goals: two sandals each side */}
      {[-5.5, 5.5].flatMap((dx) => [-1, 1].map((k) => <mesh key={`${dx}${k}`} geometry={BOX} position={[PITCH[0] + dx, 0.05, PITCH[1] + k]} scale={[0.25, 0.08, 0.1]} material={mat('#1d1d24')} />))}
      <mesh ref={ball}>
        <sphereGeometry args={[0.12, 12, 8]} />
        <meshLambertMaterial color="#f8f9fa" />
      </mesh>
      <NoShadows>
        {players.map((p, i) => (
          <group key={i} position={p.p} rotation={[0, Math.atan2(PITCH[0] - p.p[0], PITCH[1] - p.p[2]), 0]}>
            <TalkHuman id={`plage-foot-${i}`} look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}

/** Along the water: people walking, a seller with her basin on the head, a horse led by its owner for a ride. */
function Strollers() {
  const walkers = useMemo(() => {
    const r = rng('plage-promeneurs')
    return [
      { z: 3.2, half: 30, speed: 0.9, phase: 0 },
      { z: 3.8, half: 30, speed: -0.8, phase: 20 },
      { z: 14, half: 34, speed: 0.7, phase: 40, basin: true },
      { z: 4.6, half: 28, speed: 1, phase: 60, horse: true },
    ].map((w) => {
      const gender: 'femme' | 'homme' = w.basin ? 'femme' : w.horse ? 'homme' : r() < 0.5 ? 'femme' : 'homme'
      return { ...w, gender, look: randomLook(gender, r), seed: r() * 100 }
    })
  }, [])
  const refs = useRef<(THREE.Group | null)[]>([])
  const legs = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    const t = worldTime()
    walkers.forEach((w, i) => {
      const g = refs.current[i]
      if (!g) return
      // To one end and back.
      const span = 4 * w.half
      const d = (((t * Math.abs(w.speed) + w.phase) % span) + span) % span
      const out = d < span / 2
      const x = out ? -w.half + d : w.half - (d - span / 2)
      const dir = (out ? 1 : -1) * Math.sign(w.speed)
      g.position.set(dir > 0 ? x : -x, 0, w.z)
      g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2
    })
    // The horse's legs, two by two.
    legs.current.forEach((m, k) => {
      if (m) m.rotation.x = Math.sin(t * 5 + (k % 2 ? Math.PI : 0) + (k > 1 ? Math.PI : 0)) * 0.35
    })
  })
  return (
    <NoShadows>
      {walkers.map((w, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          <TalkHuman id={`plage-w${i}`} look={w.look} gender={w.gender} pose="walk" speed={Math.abs(w.speed)} seed={w.seed} />
          {w.basin && (
            <mesh position={[0, 1.82, 0]} material={mat('#c3c8cf')}>
              <cylinderGeometry args={[0.38, 0.28, 0.16, 14]} />
            </mesh>
          )}
          {w.horse && (
            // The horse beside him, its rope in his hand.
            <group position={[0.9, 0, 0.2]}>
              <mesh geometry={BOX} position={[0, 1.3, 0]} scale={[0.55, 0.65, 1.5]} material={mat('#6b4423')} />
              <mesh geometry={BOX} position={[0, 1.75, 0.85]} rotation={[0.6, 0, 0]} scale={[0.3, 0.75, 0.32]} material={mat('#6b4423')} />
              <mesh geometry={BOX} position={[0, 2.05, 1.18]} rotation={[1.3, 0, 0]} scale={[0.24, 0.55, 0.26]} material={mat('#5a3a1e')} />
              <mesh geometry={BOX} position={[0, 1.35, -0.85]} rotation={[-0.5, 0, 0]} scale={[0.1, 0.6, 0.1]} material={mat('#2b1a10')} />
              <mesh geometry={BOX} position={[0, 1.7, 0.3]} scale={[0.6, 0.06, 0.6]} material={mat('#c92a2a')} />
              {[
                [-0.2, 0.6],
                [0.2, 0.6],
                [-0.2, -0.6],
                [0.2, -0.6],
              ].map(([x, z], k) => (
                // Swung from the hip.
                <group key={k} ref={(g) => void (legs.current[k] = g)} position={[x, 1.05, z]}>
                  <mesh geometry={BOX} position={[0, -0.5, 0]} scale={[0.12, 1, 0.12]} material={mat('#5a3a1e')} />
                </group>
              ))}
            </group>
          )}
        </group>
      ))}
    </NoShadows>
  )
}
