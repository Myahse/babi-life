import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { ActionProps } from './ActionProps'
import { Guest, mat, sign, useBigWalk, type Spot, type XZ } from './bigPlace'
import { TalkHuman } from '../Talkable'
import { BOX, Blocks } from '../open/ruePrincesse'

// Inside the Hôtel Ivoire: not a room but a world. The great hall (marble,
// columns, the chandeliers, the reception, the sofas), and around it the Ciné
// Ivoire, the casino, the shopping gallery, the bar, the restaurant along the
// glass wall over the lagoon, and outside the glass the pool terrace, the
// Plateau's towers across the water. A suite for the night. The famous ice
// rink is not here: closed for years, it is to become a convention centre
// (announced in 2026); where it would be, a lounge of the hall. The cinema is
// of the hotel's great years: the game has it open again; the casino is still
// there. The layout is the game's.
// Frame: x across, +z toward the entrance (the boulevard), -z the lagoon.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

/** The hall's walls (half-sizes): x from -HW to HW, z from -HD to HD; the terrace beyond, down to TERRACE. */
const HW = 32
const HD = 22
const TERRACE = -36

const SPOTS: Record<string, Spot> = {
  'lobby-ivoire': { at: [2, 9], rot: Math.PI, pose: 'phone' },
  'cinema-ivoire': { at: [22, -6.2], rot: Math.PI, pose: 'sit', y: 0.05 },
  'casino-ivoire': { at: [19.6, 8.4], rot: Math.PI, pose: 'busy' },
  'bar-hotel': { at: [0.7, -4.5], rot: Math.PI, pose: 'drink' },
  'brunch-lagune': { at: [-6, -15.4], rot: Math.PI, pose: 'eat', y: 0.05 },
  'piscine-hotel': { at: [0, -29], rot: Math.PI / 2, pose: 'swim', y: 0.42, swim: 7.5, from: [0, -23.6] },
  'nuit-hotel': { at: [26, -17.4], rot: 0, pose: 'sleep', y: 0.62, lying: true, from: [26, -15] },
}
const ENTRANCE: XZ = [0, HD - 1.5]

/** The sofas round low tables: [x, z, facing]. */
const LOUNGE: [number, number, number][] = [
  [-25, 6.5, 0], [-25, 9.5, Math.PI], [-18, 6.5, 0], [-18, 9.5, Math.PI],
  [-25, 13.5, 0], [-25, 16.5, Math.PI], [-18, 13.5, 0], [-18, 16.5, Math.PI],
]

/** The floor plan's solid things, as boxes [x, z, half-width, half-depth] (for walking round them). */
const SOLID: [number, number, number, number][] = [
  [-8, 12, 3.2, 0.7], // the reception desk
  ...LOUNGE.map(([x, z, r]): [number, number, number, number] => (Math.abs(Math.sin(r)) > 0.5 ? [x, z, 0.5, 1.3] : [x, z, 1.3, 0.5])), // the lounge's sofas
  [0, -6, 6.2, 0.7], // the bar counter
  [23.2, 0.4, 7.6, 0.3], // the cinema's walls (its door at x 14–15.5)
  [14, -6, 0.2, 6],
  [22, -12, 10, 0.2],
  [30.5, 12, 0.6, 8], // the slot machines
  [-22, -11.5, 8.5, 1.4], // the shops of the gallery
  [0, -28.5, 10.5, 4], // the pool
  [26, -18.6, 1.6, 2.2], // the suite's bed
  // The columns.
  ...([-12, 12] as const).flatMap((x) => [4, 16, -4].map((z) => [x, z, 0.7, 0.7] as [number, number, number, number])),
  // The glass wall over the terrace, open in the middle.
  [-18.5, -HD, 13.5, 0.2],
  [18.5, -HD, 13.5, 0.2],
]
// The casino's tables and the cinema's seat rows.
for (const [x, z] of [[18, 7], [24, 7], [18, 15], [24, 15]]) SOLID.push([x, z, 1.2, 0.8])
for (let r = 0; r < 4; r++) SOLID.push([22, -3 - r * 1.6, 6, 0.25])

function free(x: number, z: number) {
  if (x < -HW + 0.5 || x > HW - 0.5 || z > HD - 0.5 || z < TERRACE + 0.5) return false
  for (const [cx, cz, hw, hd] of SOLID) if (Math.abs(x - cx) < hw + 0.3 && Math.abs(z - cz) < hd + 0.3) return false
  return true
}

const colored = new THREE.MeshLambertMaterial({ color: '#ffffff' })

/** The marble of the hall: big pale tiles, a darker border. */
function marble() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 ? '#efe6d6' : '#e2d6c0'
      g.fillRect(i * 64, j * 64, 64, 64)
      g.strokeStyle = 'rgba(160,140,110,0.25)'
      g.beginPath()
      g.moveTo(i * 64 + 10, j * 64 + 50)
      g.bezierCurveTo(i * 64 + 25, j * 64 + 20, i * 64 + 40, j * 64 + 45, i * 64 + 58, j * 64 + 12)
      g.stroke()
    }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(HW / 4, HD / 4)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function IvoireInside({ sim, interactionId, roam, night, stage }: { sim: Sim; interactionId?: string; /** Just come in: walk about (tap the floor, or the keys). */ roam?: boolean; night: boolean; stage: string }) {
  const spot = interactionId ? (SPOTS[interactionId] ?? null) : null
  const { way, tap, onMoved } = useBigWalk(spot, interactionId, roam, free, ENTRANCE)
  const signs = useMemo(
    () => ({
      cine: sign('CINÉ IVOIRE', '#1b1b2f', '#ffd54f'),
      casino: sign('CASINO', '#5a0f1a', '#f3c63f'),
      bar: sign('LE BAR DU HALL', '#2b1d14', '#f3e6c9'),
      resto: sign('LA TERRASSE · BRUNCH', '#f3e6c9', '#2b1d14'),
      hotel: sign('HÔTEL IVOIRE', '#f3f1ec', '#b5432c', 1024, 160),
      shops: ['BIJOUTERIE', 'PAGNES WAX', 'LIBRAIRIE', 'CAFÉ'].map((t, i) => sign(t, ['#3d2b5a', '#b5432c', '#1f5f8b', '#5a3a1a'][i], '#ffffff', 256, 64)),
    }),
    [],
  )
  const floor = useMemo(() => marble(), [])
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 16, HD + 20], fov: 45, near: 0.3, far: 900 }} style={{ background: night ? '#0b1026' : '#9ccbea' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={[night ? '#8090d0' : '#ffffff', '#c9b48c', night ? 0.75 : 1.2]} />
          <directionalLight position={[30, 50, 25]} intensity={night ? 0.25 : 1.3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} />
          <pointLight position={[0, 9, 8]} intensity={night ? 60 : 25} distance={40} color="#ffe2b0" />
          <pointLight position={[0, 8, -14]} intensity={night ? 40 : 10} distance={30} color="#ffd9a0" />
          <Hall floor={floor} night={night} signs={signs} />
          <Lounge />
          <Casino night={night} />
          <Cinema night={night} />
          <Terrace night={night} />
          <People night={night} />
          {roam && !interactionId && (
            // The floor, to tap where to walk (a drag turns the camera instead).
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.06, (HD + TERRACE) / 2]}
              onClick={(e) => {
                if (e.delta > 6) return
                e.stopPropagation()
                tap([e.point.x, e.point.z])
              }}
            >
              <planeGeometry args={[HW * 2, HD - TERRACE]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          )}
          <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!!roam && !interactionId} onMoved={onMoved} free={free} entrance={ENTRANCE}>
            <ActionProps id={interactionId} kind="hotel" lying={!!spot?.lying} />
          </Guest>
          <OrbitControls makeDefault target={[0, 1, HD - 6]} enablePan={false} minDistance={6} maxDistance={70} minPolarAngle={0.25} maxPolarAngle={1.25} enableDamping />
        </Suspense>
      </Canvas>
    </div>
  )
}

/* ---------- The hall ---------- */

function Hall({ floor, night, signs }: { floor: THREE.Texture; night: boolean; signs: { cine: THREE.Material; casino: THREE.Material; bar: THREE.Material; resto: THREE.Material; hotel: THREE.Material; shops: THREE.Material[] } }) {
  const parts = useMemo(() => {
    const walls: Block[] = []
    const gold: Block[] = []
    const wood: Block[] = []
    const fabric: Block[] = []
    // The side walls and the entrance wall (cut low on the boulevard's side so the hall can be seen), the doors in its middle.
    walls.push({ p: [-HW, 4, 0], s: [0.5, 8, HD * 2] }, { p: [HW, 4, 0], s: [0.5, 8, HD * 2] })
    walls.push({ p: [-(HW + 5) / 2, 0.6, HD], s: [HW - 5, 1.2, 0.5] }, { p: [(HW + 5) / 2, 0.6, HD], s: [HW - 5, 1.2, 0.5] })
    // The columns, with gold rings.
    for (const x of [-12, 12])
      for (const z of [4, 16, -4]) {
        walls.push({ p: [x, 4, z], s: [1.3, 8, 1.3] })
        gold.push({ p: [x, 0.25, z], s: [1.6, 0.5, 1.6] }, { p: [x, 7.6, z], s: [1.6, 0.4, 1.6] })
      }
    // The reception: the long desk in wood and marble, the wall of keys behind.
    wood.push({ p: [-8, 0.55, 12], s: [6.4, 1.1, 1.3] })
    walls.push({ p: [-8, 1.15, 12], s: [6.6, 0.1, 1.5], c: '#f3ece0' })
    wood.push({ p: [-8, 2.2, 14.4], s: [7, 4.4, 0.3] })
    gold.push({ p: [-8, 3.6, 14.2], s: [5, 0.4, 0.05] })
    // The lobby's sofas and low tables (velvet, round the carpet).
    fabric.push({ p: [6, 0.4, 13], s: [3.6, 0.8, 1], c: '#7a1f2b' }, { p: [6, 0.9, 13.45], s: [3.6, 0.6, 0.2], c: '#7a1f2b' })
    fabric.push({ p: [6, 0.4, 8], s: [3.6, 0.8, 1], c: '#7a1f2b' }, { p: [6, 0.9, 7.55], s: [3.6, 0.6, 0.2], c: '#7a1f2b' })
    wood.push({ p: [6, 0.3, 10.5], s: [2.2, 0.6, 1.4] })
    // The bar: the counter, the stools, the bottles on lit shelves.
    wood.push({ p: [0, 0.6, -6], s: [12, 1.2, 1.2] })
    walls.push({ p: [0, 1.25, -6], s: [12.2, 0.1, 1.4], c: '#2b2b2b' })
    for (let x = -5; x <= 5; x += 1.4) fabric.push({ p: [x, 0.4, -4.6], s: [0.5, 0.8, 0.5], c: '#3a2a20' })
    wood.push({ p: [0, 2, -8.6], s: [10, 4, 0.4] })
    // The shops of the gallery: fronts in glass and wood along the back wall.
    for (let i = 0; i < 4; i++) {
      wood.push({ p: [-28 + i * 4, 1.6, -12.6], s: [3.6, 3.2, 0.6] })
      walls.push({ p: [-28 + i * 4, 1.4, -11.9], s: [3, 2.2, 0.1], c: '#cfe8f2' })
    }
    // The restaurant's tables along the glass, the chairs.
    for (const x of [-10, -6, -2, 2, 6, 10]) {
      walls.push({ p: [x, 0.75, -17], s: [1.6, 0.08, 1.6], c: '#ffffff' })
      wood.push({ p: [x, 0.37, -17], s: [0.2, 0.74, 0.2] })
      fabric.push({ p: [x, 0.25, -15.6], s: [0.6, 0.5, 0.6], c: '#c9a46a' }, { p: [x, 0.25, -18.4], s: [0.6, 0.5, 0.6], c: '#c9a46a' })
    }
    // The suite: the bed, the bedside lamps, a low wall round it.
    fabric.push({ p: [26, 0.35, -18.6], s: [3, 0.7, 4.2], c: '#f5f1e8' }, { p: [26, 0.75, -18.6], s: [3.1, 0.1, 3], c: '#b5432c' })
    wood.push({ p: [26, 1, -20.8], s: [3.4, 2, 0.3] })
    walls.push({ p: [21.5, 0.6, -18], s: [0.3, 1.2, 8] })
    return { walls, gold, wood, fabric }
  }, [])
  return (
    <group>
      {/* Outside the doors: the forecourt, the drive, the lawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, HD + 40]} receiveShadow>
        <planeGeometry args={[300, 80]} />
        <meshLambertMaterial color="#4f8f3c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, HD + 8]} receiveShadow>
        <planeGeometry args={[40, 16]} />
        <meshLambertMaterial color="#d8d0c0" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, HD + 30]} receiveShadow>
        <planeGeometry args={[9, 30]} />
        <meshLambertMaterial color="#4a4a4f" />
      </mesh>
      {/* The marble floor of the hall, the carpet of the lobby */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[HW * 2, HD * 2]} />
        <meshLambertMaterial map={floor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3, 0.02, 10.5]} receiveShadow>
        <planeGeometry args={[12, 9]} />
        <meshLambertMaterial color="#8a2a32" />
      </mesh>
      <Blocks at={parts.walls.map((b) => ({ ...b, c: b.c ?? '#f3ece0' }))} material={colored} color />
      <Blocks at={parts.gold} material={mat('#c9a227', night ? '#5a4310' : undefined)} />
      <Blocks at={parts.wood} material={mat('#6b4426')} />
      <Blocks at={parts.fabric.map((b) => ({ ...b, c: b.c ?? '#7a1f2b' }))} material={colored} color />
      {/* The bottles on the bar's shelves, lit from behind */}
      <mesh position={[0, 2.6, -8.35]}>
        <planeGeometry args={[9.6, 2.4]} />
        <meshBasicMaterial color={night ? '#ffb347' : '#e8b27a'} />
      </mesh>
      {[...Array(24)].map((_, i) => (
        <mesh key={i} geometry={BOX} position={[-4.5 + (i % 12) * 0.82, 2 + Math.floor(i / 12) * 1.1, -8.25]} scale={[0.18, 0.55, 0.18]} material={mat(['#2f6b3a', '#7a1f2b', '#c9a227', '#3a5a8a'][i % 4])} />
      ))}
      {/* The chandeliers of the hall */}
      {[[-6, 8], [6, 8], [0, 16], [0, 0]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 7.2, z]}>
          <mesh geometry={BOX} scale={[0.06, 1.6, 0.06]} position={[0, 0.8, 0]} material={mat('#c9a227')} />
          {[...Array(8)].map((_, i) => (
            <mesh key={i} geometry={BOX} position={[Math.cos((i / 8) * Math.PI * 2) * 1.1, 0, Math.sin((i / 8) * Math.PI * 2) * 1.1]} scale={[0.22, 0.34, 0.22]} material={mat('#fff6d8', '#ffd98a')} />
          ))}
          <mesh geometry={BOX} scale={[0.9, 0.5, 0.9]} material={mat('#fff6d8', '#ffe2a8')} />
        </group>
      ))}
      {/* The signs */}
      <mesh position={[-8, 3.8, 14.24]} rotation={[0, Math.PI, 0]} material={signs.hotel} scale={[1, 1, 1]}>
        <planeGeometry args={[6, 0.95]} />
      </mesh>
      <mesh position={[22, 3.6, 0.62]} material={signs.cine}>
        <planeGeometry args={[6, 1.5]} />
      </mesh>
      <mesh position={[22, 4.4, 20.6]} rotation={[0, Math.PI, 0]} material={signs.casino}>
        <planeGeometry args={[6, 1.5]} />
      </mesh>
      <mesh position={[0, 4.5, -8.38]} material={signs.bar}>
        <planeGeometry args={[5, 1.25]} />
      </mesh>
      <mesh position={[0, 4.2, -20.6]} material={signs.resto}>
        <planeGeometry args={[7, 1.4]} />
      </mesh>
      {signs.shops.map((m, i) => (
        <mesh key={i} position={[-28 + i * 4, 3.5, -12.25]} material={m}>
          <planeGeometry args={[3.4, 0.85]} />
        </mesh>
      ))}
      {/* The glass wall over the terrace and the lagoon: tall panes, open in the middle */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 18.5, 4, -HD]}>
          <boxGeometry args={[27, 8, 0.15]} />
          <meshLambertMaterial color="#bfe3f2" transparent opacity={0.28} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- The hall's lounge, where the rink was ---------- */

function Lounge() {
  const guests = useMemo(() => {
    const r = rng('ivoire-salon')
    return [0, 1, 3, 4, 6].map((i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { i, gender, look: randomLook(gender, r) }
    })
  }, [])
  return (
    <group>
      {/* A rug under each group, the low table, the sofas (seat and back), the palms in their pots */}
      {[8, 15].flatMap((z) =>
        [-25, -18].map((x) => (
          <group key={`${x}${z}`}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, z]} receiveShadow>
              <planeGeometry args={[4.4, 4.6]} />
              <meshLambertMaterial color="#8a1c1c" />
            </mesh>
            <Blocks at={[{ p: [x, 0.25, z], s: [1.4, 0.5, 0.9] }]} material={mat('#3b2a1e')} />
          </group>
        )),
      )}
      <Blocks at={LOUNGE.map(([x, z]) => ({ p: [x, 0.25, z] as [number, number, number], s: [2.6, 0.5, 0.9] as [number, number, number] }))} material={mat('#e9dfc9')} />
      <Blocks at={LOUNGE.map(([x, z, r]) => ({ p: [x, 0.7, z - Math.cos(r) * 0.4] as [number, number, number], s: [2.6, 0.8, 0.18] as [number, number, number] }))} material={mat('#d8cbb0')} />
      {[[-29, 3], [-29, 19], [-14, 3], [-14, 19]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.4, 0.32, 0.7, 10]} />
            <meshLambertMaterial color="#b5432c" />
          </mesh>
          <mesh position={[0, 1.6, 0]}>
            <icosahedronGeometry args={[0.9, 0]} />
            <meshLambertMaterial color="#2f7a3a" />
          </mesh>
        </group>
      ))}
      <NoShadows>
        {guests.map((g) => {
          const [x, z, r] = LOUNGE[g.i]
          return (
            <group key={g.i} position={[x + (g.i % 2 ? 0.5 : -0.5), 0.05, z]} rotation={[0, r, 0]}>
              <Human look={g.look} gender={g.gender} pose={g.i % 3 ? 'talk' : 'drink'} seed={g.i * 3} />
            </group>
          )
        })}
      </NoShadows>
    </group>
  )
}

/* ---------- The casino ---------- */

function Casino({ night }: { night: boolean }) {
  const slots = useRef<THREE.MeshBasicMaterial[]>([])
  useFrame(() => {
    const t = worldTime()
    slots.current.forEach((m, i) => m?.color.setHSL(((Math.floor(t * 3 + i * 1.7) * 0.29) % 1 + 1) % 1, 0.8, 0.55))
  })
  return (
    <group>
      {/* The red carpet of the casino */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[22, 0.02, 12]} receiveShadow>
        <planeGeometry args={[18, 16]} />
        <meshLambertMaterial color="#5a0f1a" />
      </mesh>
      {/* The tables: green felt on wood */}
      <Blocks at={[[18, 7], [24, 7], [18, 15], [24, 15]].map(([x, z]) => ({ p: [x, 0.42, z] as [number, number, number], s: [2.4, 0.84, 1.6] as [number, number, number] }))} material={mat('#5a3a1a')} />
      <Blocks at={[[18, 7], [24, 7], [18, 15], [24, 15]].map(([x, z]) => ({ p: [x, 0.86, z] as [number, number, number], s: [2.2, 0.04, 1.4] as [number, number, number] }))} material={mat('#1d6b3a')} />
      {/* The slot machines along the wall, their screens changing */}
      {[...Array(8)].map((_, i) => (
        <group key={i} position={[30.6, 0, 5 + i * 2]}>
          <mesh geometry={BOX} position={[0, 0.9, 0]} scale={[0.9, 1.8, 1.4]} material={mat('#2b2b33')} />
          <mesh position={[-0.46, 1.25, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[1, 0.7]} />
            <meshBasicMaterial ref={(m) => { if (m) slots.current[i] = m }} color="#ff4d6d" />
          </mesh>
          <mesh geometry={BOX} position={[0, 2, 0]} scale={[0.9, 0.3, 1.4]} material={mat('#c9a227', night ? '#7a5a10' : '#3a2a08')} />
        </group>
      ))}
    </group>
  )
}

/* ---------- The cinema ---------- */

function Cinema({ night }: { night: boolean }) {
  const screen = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => {
    const t = worldTime()
    screen.current?.color.setHSL(((Math.floor(t * 0.7) * 0.37) % 1 + 1) % 1, 0.45, 0.5 + Math.sin(t * 7) * 0.05)
  })
  return (
    <group>
      {/* The dark room: its walls (the door at its left end), the floor, the screen, the red seats in rows */}
      <Blocks
        at={[
          { p: [23.2, 2.5, 0.4], s: [16, 5, 0.3] },
          { p: [22, 2.5, -12], s: [20, 5, 0.3] },
          { p: [14, 2.5, -6], s: [0.3, 5, 12] },
        ]}
        material={mat('#2b1d2e')}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[22, 0.02, -6]}>
        <planeGeometry args={[16, 12]} />
        <meshLambertMaterial color="#3a1420" />
      </mesh>
      <mesh position={[22, 2.6, -11.8]}>
        <planeGeometry args={[11, 4.6]} />
        <meshBasicMaterial ref={screen} color="#6d8fbf" />
      </mesh>
      <pointLight position={[22, 2.5, -9]} intensity={night ? 8 : 5} distance={12} color="#9fb6ff" />
      <Blocks at={[...Array(4)].flatMap((_, r) => [...Array(9)].map((_, i) => ({ p: [16.5 + i * 1.35, 0.45, -3 - r * 1.6] as [number, number, number], s: [1.1, 0.9, 0.7] as [number, number, number] })))} material={mat('#9b1c2c')} />
    </group>
  )
}

/* ---------- The terrace: the pool, the loungers, the lagoon and the Plateau across it ---------- */

function Terrace({ night }: { night: boolean }) {
  const water = useRef<THREE.MeshLambertMaterial>(null)
  useFrame(() => {
    water.current?.color.setHSL(0.53, 0.7, 0.5 + Math.sin(worldTime() * 1.3) * 0.03)
  })
  const towers = useMemo(() => {
    const r = rng('ivoire-plateau')
    return [...Array(14)].map((_, i) => ({ x: -70 + i * 11 + r() * 4, h: 20 + r() * 50, w: 6 + r() * 6 }))
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (TERRACE - HD) / 2]} receiveShadow>
        <planeGeometry args={[HW * 2, -HD - TERRACE]} />
        <meshLambertMaterial color="#d8cfbd" />
      </mesh>
      {/* The pool: a rim, the water */}
      <mesh geometry={BOX} position={[0, 0.3, -28.5]} scale={[21, 0.6, 8]} material={mat('#f3f1ec')} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.62, -28.5]}>
        <planeGeometry args={[20, 7]} />
        <meshLambertMaterial ref={water} color="#3fb7d8" transparent opacity={0.9} />
      </mesh>
      <Blocks at={[-14, -12, 12, 14].flatMap((x) => [-26, -31].map((z) => ({ p: [x, 0.3, z] as [number, number, number], s: [0.8, 0.15, 2] as [number, number, number] })))} material={mat('#ffffff')} />
      {/* The lagoon, and across it the towers of the Plateau, lit at night */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, TERRACE - 150]}>
        <planeGeometry args={[600, 300]} />
        <meshLambertMaterial color={night ? '#0e2a3a' : '#3c7c8a'} />
      </mesh>
      {towers.map((t, i) => (
        <mesh key={i} geometry={BOX} position={[t.x * 2, t.h / 2, -300]} scale={[t.w * 2, t.h, t.w * 2]} material={mat(night ? '#1b2238' : '#c9ccd2', night ? (i % 3 ? '#3a3010' : '#2a3550') : undefined)} />
      ))}
    </group>
  )
}

/* ---------- The people ---------- */

function People({ night }: { night: boolean }) {
  const list = useMemo(() => {
    const r = rng('ivoire-gens')
    const one = (p: [number, number, number], ry: number, pose: Pose, dress?: string) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      return { p, ry, pose, gender, look: dress ? { ...look, outfit: dress } : look, seed: r() * 100 }
    }
    return [
      // At the reception: two receptionists behind the desk, guests checking in, the bellboy.
      one([-9.5, 0, 13.3], Math.PI, 'busy', 'suit'), one([-6.5, 0, 13.3], Math.PI, 'talk', 'suit'),
      one([-9.5, 0, 10.6], 0, 'talk'), one([-6.4, 0, 10.6], 0, 'phone'), one([-3.5, 0, 11.5], -0.6, 'idle', 'suit'),
      // The lobby: a meeting on the sofas, people waiting, a couple taking a selfie under the chandelier.
      one([5, 0.35, 13], Math.PI, 'sit'), one([7, 0.35, 13], Math.PI, 'sit'), one([6, 0.35, 8], 0, 'sit'),
      one([1, 0, 4], 0.4, 'phone'), one([1.8, 0, 4.2], -0.5, 'hug'), one([-2, 0, 16], 2.6, 'talk'), one([-1.2, 0, 15.4], -0.6, 'talk'),
      // At the bar: the barman, the drinkers.
      one([0, 0, -7.2], 0, 'busy', 'suit'), one([-3.6, 0, -4.2], Math.PI, 'drink'), one([2.2, 0, -4.2], Math.PI, 'talk'),
      // The casino: dealers, players round the tables, someone at the slots.
      one([18, 0, 5.8], 0, 'busy', 'suit'), one([18, 0, 8.4], Math.PI, 'busy'), one([17, 0, 8.4], Math.PI, 'cheer'),
      one([24, 0, 13.8], 0, 'busy', 'suit'), one([24, 0, 16.4], Math.PI, 'busy'), one([25, 0, 16.4], Math.PI, 'phone'), one([29.6, 0, 9], Math.PI / 2, 'touch'),
      // The cinema: people watching.
      ...[[17.85, -3], [20.55, -3], [23.25, -4.6], [24.6, -4.6], [19.2, -6.2], [26, -7.8]].map(([x, z]) => one([x, 0.05, z], Math.PI, 'sit')),
      // The gallery: window-shopping.
      one([-27, 0, -10.2], Math.PI, 'idle'), one([-20, 0, -10.2], Math.PI, 'phone'), one([-19, 0, -9.8], Math.PI, 'talk'),
      // The restaurant: brunch with the lagoon behind the glass; the waiter.
      one([-10, 0.05, -15.6], Math.PI, 'eat'), one([-10, 0.05, -18.4], 0, 'talk'), one([2, 0.05, -15.6], Math.PI, 'drink'), one([6, 0.05, -18.4], 0, 'eat'), one([8, 0, -14.5], 0.3, 'busy', 'suit'),
      // The terrace: sunbathers, someone filming the view.
      one([-14, 0.4, -26], 0, 'sleep', 'maillot'), one([12, 0.4, -31], 0, 'sleep', 'maillot'), one([16, 0, -33], Math.PI, 'phone'),
    ]
  }, [])
  // Walkers crossing the hall, back and forth between the doors and the lifts.
  const walkers = useMemo(() => {
    const r = rng('ivoire-passants')
    return [...Array(6)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), x: -4 + i * 1.6, z0: -2, z1: HD - 2, speed: 1.1 + r() * 0.4, phase: r() * 30 }
    })
  }, [])
  const wr = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    const t = worldTime()
    walkers.forEach((w, i) => {
      const g = wr.current[i]
      if (!g) return
      const len = w.z1 - w.z0
      const p = ((t * w.speed + w.phase) % (2 * len)) / len
      const there = p < 1
      g.position.set(w.x, 0, there ? w.z0 + len * p : w.z1 - len * (p - 1))
      g.rotation.y = there ? 0 : Math.PI
    })
  })
  return (
    <NoShadows>
      {list.map((g, i) => (
        <group key={i} position={g.p} rotation={g.pose === 'sleep' ? [-Math.PI / 2, 0, g.ry] : [0, g.ry, 0]}>
          <TalkHuman id={`ivoire-${i}`} look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
        </group>
      ))}
      {walkers.map((w, i) => (
        <group key={`w${i}`} ref={(g) => { wr.current[i] = g }}>
          <TalkHuman id={`ivoire-w${i}`} look={w.look} gender={w.gender} pose="walk" speed={w.speed} seed={i * 7 + 0.5} />
        </group>
      ))}
      {night && <pointLight position={[0, 3, -28]} intensity={10} distance={18} color="#7fd6ff" />}
    </NoShadows>
  )
}
