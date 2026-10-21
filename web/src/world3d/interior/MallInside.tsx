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
import { Vehicle } from '../vehicles'
import { BOX, Blocks } from '../open/ruePrincesse'
import { TalkHuman } from '../Talkable'
import { Guest, mat, sign, useBigWalk, type Spot, type XZ } from './bigPlace'

// Inside a big shopping centre (PlaYce and the others, kind « mall »): not a
// room but a whole mall to walk through. The doors on the car park; the
// supermarket on the left, its aisles of shelves and its tills; the gallery,
// a wide atrium under the light, its fountain, benches and palms, the shops
// on both sides (pagnes and clothes, sneakers, phones, the pharmacy, jewels,
// books, beauty); at its end the food court and the ice-cream kiosk. People
// shopping, pushing trolleys, eating, children round the fountain, the
// security guard at the door. The shops' names and the layout are the game's.
// Frame: x across, +z toward the car park.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

const HW = 38
const HD = 24
/** The doors: in the middle of the gallery's front. */
const ENTRANCE: XZ = [12, HD - 1.5]

/** The supermarket's shelves (x of each row, from z0 to z1), its tills. */
const SHELVES = [-34, -30, -26, -22, -18]
const SHELF_Z: [number, number] = [-20, 3]
const TILLS = [-33, -28, -23, -18]
/** The shops: x of each one's middle, on the back row (z -20…-8) and the front row (z 8…20). */
const BACK = [-5, 2.5, 10, 17.5, 25]
const FRONT = [-5, 2.5, 25, 32.5]
const SHOP_W = 7.2

const SPOTS: Record<string, Spot> = {
  supermarche: { at: [-28, -8], rot: Math.PI / 2, pose: 'busy', from: [-28, 4.5] },
  'leche-vitrine': { at: [12, 0], rot: 0, pose: 'walk', from: [12, 6], loop: { c: [12, 0], r: [16, 4.5], speed: 0.08 } },
  vetements: { at: [-5, -15.5], rot: Math.PI, pose: 'busy', from: [-5, -9.5] },
  glace: { at: [30.5, 1.2], rot: 0, pose: 'eat', y: 0.05 },
}

/** What's in the way, as boxes [x, z, half-width, half-depth]. */
const SOLID: [number, number, number, number][] = (() => {
  const out: [number, number, number, number][] = []
  // The supermarket: its shelves, its tills, its wall on the gallery (open by the tills).
  for (const x of SHELVES) out.push([x, (SHELF_Z[0] + SHELF_Z[1]) / 2, 0.7, (SHELF_Z[1] - SHELF_Z[0]) / 2])
  for (const x of TILLS) out.push([x, 8, 0.6, 1.2])
  out.push([-12, -11, 0.2, 13])
  // The shops: side walls, back walls, their fronts round a wide door; a counter inside.
  for (const [row, z0, z1] of [[BACK, -20, -8], [FRONT, 8, 20]] as [number[], number, number][]) {
    const front = z0 < 0 ? z1 : z0
    const back = z0 < 0 ? z0 : z1
    for (const x of row) {
      out.push([x - SHOP_W / 2, (z0 + z1) / 2, 0.15, (z1 - z0) / 2], [x + SHOP_W / 2, (z0 + z1) / 2, 0.15, (z1 - z0) / 2])
      out.push([x, back, SHOP_W / 2, 0.15])
      out.push([x - SHOP_W / 2 + 1, front, 1, 0.15], [x + SHOP_W / 2 - 1, front, 1, 0.15])
      out.push([x, (back + front) / 2 + (z0 < 0 ? -2 : 2), 1.4, 0.4])
    }
  }
  // The atrium: the fountain, the benches, the escalator, the kiosk, the food court's tables.
  out.push([12, 0, 2.6, 2.6], [12, -5.5, 1.2, 0.4], [12, 5.5, 1.2, 0.4], [4, 0, 1.2, 3.6], [30.5, -5, 1.4, 1.2])
  for (const [x, z] of [[24, 0], [28, 3], [33, 0], [28, -3], [34, 4]]) out.push([x, z, 0.7, 0.7])
  // The outer walls of the gallery, with the doors.
  out.push([HW, 0, 0.2, HD], [-HW, 0, 0.2, HD], [-17, HD, 21, 0.2], [29, HD, 9, 0.2])
  return out
})()

function free(x: number, z: number) {
  if (x < -HW + 0.5 || x > HW - 0.5 || z < -HD + 0.5 || z > HD + 14) return false
  // Out on the car park: only in front of the doors.
  if (z > HD - 0.2 && (x < 4 || x > 20)) return false
  for (const [cx, cz, hw, hd] of SOLID) if (Math.abs(x - cx) < hw + 0.3 && Math.abs(z - cz) < hd + 0.3) return false
  return true
}

/** The polished floor: big pale tiles. */
function tiles() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#ece8e1'
  g.fillRect(0, 0, 128, 128)
  g.strokeStyle = '#d6d0c6'
  g.lineWidth = 2
  g.strokeRect(1, 1, 126, 126)
  g.fillStyle = 'rgba(255,255,255,0.35)'
  g.fillRect(10, 10, 40, 6)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(HW / 1.5, HD / 1.5)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function MallInside({ sim, name, interactionId, roam, night, stage }: { sim: Sim; /** The centre's name, over the doors. */ name: string; interactionId?: string; /** Just come in: walk about (tap the floor, or the keys). */ roam?: boolean; night: boolean; stage: string }) {
  const spot = interactionId ? (SPOTS[interactionId] ?? null) : null
  const { way, tap, onMoved } = useBigWalk(spot, interactionId, roam, free, ENTRANCE)
  const floor = useMemo(() => tiles(), [])
  const signs = useMemo(
    () => ({
      mall: sign(name.toUpperCase(), '#1f2a44', '#ffffff', 1024, 160),
      market: sign('BABI MARKET', '#c8102e', '#ffffff', 1024, 160),
      food: sign('FOOD COURT', '#ff8200', '#ffffff', 512, 128),
    }),
    [name],
  )
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [12, 22, HD + 26], fov: 45, near: 0.3, far: 900 }} style={{ background: night ? '#0b1026' : '#9ccbea' }}>
        <Snapper />
        <Suspense fallback={null}>
          <hemisphereLight args={[night ? '#9aa8e0' : '#ffffff', '#c9b48c', night ? 0.9 : 1.25]} />
          <directionalLight position={[30, 50, 25]} intensity={night ? 0.25 : 1.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-50} shadow-camera-right={50} shadow-camera-top={50} shadow-camera-bottom={-50} />
          <pointLight position={[12, 9, 0]} intensity={night ? 70 : 25} distance={50} color="#fff2d8" />
          <pointLight position={[-24, 8, -6]} intensity={night ? 60 : 20} distance={40} color="#ffffff" />
          <Building floor={floor} night={night} signs={signs} />
          <Supermarket night={night} />
          <Shops night={night} />
          <Atrium />
          <Outside night={night} />
          <People />
          {roam && !interactionId && (
            // The floor, to tap where to walk (a drag turns the camera instead).
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.06, 7]}
              onClick={(e) => {
                if (e.delta > 6) return
                e.stopPropagation()
                tap([e.point.x, e.point.z])
              }}
            >
              <planeGeometry args={[HW * 2, HD * 2 + 14]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          )}
          <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!!roam && !interactionId} onMoved={onMoved} free={free} entrance={ENTRANCE} />
          {interactionId === 'supermarche' && <Trolley at={[-27.2, -9.2]} />}
          <OrbitControls makeDefault target={[12, 1, HD - 6]} enablePan={false} minDistance={6} maxDistance={80} minPolarAngle={0.25} maxPolarAngle={1.25} enableDamping />
        </Suspense>
      </Canvas>
    </div>
  )
}

/* ---------- The building: floor, walls, the name over the doors ---------- */

function Building({ floor, night, signs }: { floor: THREE.Texture; night: boolean; signs: { mall: THREE.Material; market: THREE.Material; food: THREE.Material } }) {
  const walls = useMemo<Block[]>(
    () => [
      // Back and sides (high), the front low on each side of the doors so one sees in.
      { p: [0, 3.5, -HD], s: [HW * 2, 7, 0.4] },
      { p: [-HW, 3.5, 0], s: [0.4, 7, HD * 2] },
      { p: [HW, 3.5, 0], s: [0.4, 7, HD * 2] },
      { p: [-17, 0.6, HD], s: [42, 1.2, 0.4] },
      { p: [29, 0.6, HD], s: [18, 1.2, 0.4] },
      // The supermarket's wall on the gallery.
      { p: [-12, 2, -11], s: [0.4, 4, 26] },
    ],
    [],
  )
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[HW * 2, HD * 2]} />
        <meshLambertMaterial map={floor} />
      </mesh>
      <Blocks at={walls} material={mat('#f3f1ec')} />
      {/* The doors: glass, the frame, the name over them; the security gates */}
      <mesh position={[12, 2.2, HD]}>
        <boxGeometry args={[8, 4.4, 0.1]} />
        <meshLambertMaterial color="#bfe3f2" transparent opacity={0.25} />
      </mesh>
      <mesh geometry={BOX} position={[12, 5, HD]} scale={[16, 1.6, 0.6]} material={mat('#1f2a44')} />
      <mesh position={[12, 5, HD + 0.32]} material={signs.mall}>
        <planeGeometry args={[14, 1.4]} />
      </mesh>
      <Blocks at={[9, 11, 13, 15].map((x) => ({ p: [x, 0.7, HD - 2.4] as [number, number, number], s: [0.15, 1.4, 0.6] as [number, number, number] }))} material={mat('#b9bec6')} />
      <mesh position={[-23, 4.6, 6.2]} material={signs.market}>
        <planeGeometry args={[12, 1.9]} />
      </mesh>
      <mesh position={[30.5, 4, -3.4]} material={signs.food}>
        <planeGeometry args={[6, 1.5]} />
      </mesh>
      {/* The light falling from the glass roof over the atrium */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, 0.02, 0]}>
        <planeGeometry args={[46, 14]} />
        <meshBasicMaterial color={night ? '#fff0c8' : '#ffffff'} transparent opacity={night ? 0.12 : 0.22} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ---------- The supermarket ---------- */

function Supermarket({ night }: { night: boolean }) {
  const parts = useMemo(() => {
    const r = rng('mall-rayons')
    const shelves: Block[] = []
    const goods: Block[] = []
    const colors = ['#e63946', '#f1c40f', '#2a9d8f', '#e76f51', '#457b9d', '#f4a261', '#8ab17d', '#ffffff', '#6d597a']
    for (const x of SHELVES) {
      const len = SHELF_Z[1] - SHELF_Z[0]
      shelves.push({ p: [x, 1, (SHELF_Z[0] + SHELF_Z[1]) / 2], s: [1.2, 2, len] })
      // The goods on both faces, four shelves high, in blocks of colour.
      for (const side of [-1, 1])
        for (let y = 0; y < 4; y++)
          for (let z = SHELF_Z[0] + 0.6; z < SHELF_Z[1]; z += 1.2) goods.push({ p: [x + side * 0.62, 0.35 + y * 0.48, z], s: [0.08, 0.36, 1.05], c: colors[Math.floor(r() * colors.length)] })
    }
    const tills: Block[] = TILLS.flatMap((x) => [
      { p: [x, 0.5, 8], s: [1.1, 1, 2.4], c: '#2b2f3a' },
      { p: [x, 1.02, 8.4], s: [1, 0.04, 1.4], c: '#3a3a3a' },
      { p: [x + 0.3, 1.35, 7.4], s: [0.3, 0.5, 0.06], c: '#111111' },
      { p: [x, 2.6, 7], s: [0.5, 0.4, 0.1], c: '#c8102e' },
    ])
    // The trolleys lined up, the fruit and vegetables at the front.
    const trolleys: Block[] = [...Array(6)].map((_, i) => ({ p: [-14.5, 0.5, 14 + i * 0.6] as [number, number, number], s: [0.8, 1, 0.5] as [number, number, number], c: '#b9bec6' }))
    const fruit: Block[] = [...Array(5)].flatMap((_, i) => [
      { p: [-33 + i * 4, 0.45, 14] as [number, number, number], s: [2.4, 0.9, 1.6] as [number, number, number], c: '#8a5a32' },
      { p: [-33 + i * 4, 0.95, 14] as [number, number, number], s: [2.2, 0.2, 1.4] as [number, number, number], c: ['#f4a261', '#e9c46a', '#8ab17d', '#e63946', '#f1c40f'][i] },
    ])
    return { shelves, goods, tills, trolleys, fruit }
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-24, 0.015, 0]} receiveShadow>
        <planeGeometry args={[24, HD * 2]} />
        <meshLambertMaterial color="#e3e7ea" />
      </mesh>
      <Blocks at={parts.shelves} material={mat('#dfe3e8')} />
      <Blocks at={parts.goods} material={mat('#ffffff')} color />
      <Blocks at={[...parts.tills, ...parts.trolleys, ...parts.fruit]} material={mat('#ffffff')} color />
      {/* The till lights */}
      {TILLS.map((x) => (
        <mesh key={x} geometry={BOX} position={[x, 2.95, 7]} scale={[0.3, 0.2, 0.12]} material={mat('#fff6d8', night ? '#ffd98a' : '#c9a227')} />
      ))}
    </group>
  )
}

/* ---------- The shops round the gallery ---------- */

const SHOP_COLORS = { back: ['#f3e0e3', '#e8e8e8', '#e3eef7', '#e6f4ea', '#ece6f3'], front: ['#f3ebe0', '#fbe4ee', '#fbe9dc', '#e0f3f1'] }

function Shops({ night }: { night: boolean }) {
  const signs = useMemo(
    () => ({
      back: ['MODE WAX', 'BABI SNEAKERS', 'PHONE 225', 'PHARMACIE DU MALL', 'BIJOUX D’ÉBÈNE'].map((t, i) => sign(t, ['#7a1f2b', '#111111', '#1f5f8b', '#0f7a3a', '#3d2b5a'][i], '#ffffff', 512, 96)),
      front: ['LIBRAIRIE', 'BEAUTÉ & CO', 'BURGER 225', 'GLACIER COCO'].map((t, i) => sign(t, ['#5a3a1a', '#d6336c', '#b5432c', '#2a9d8f'][i], '#ffffff', 512, 96)),
    }),
    [],
  )
  const parts = useMemo(() => {
    const walls: Block[] = []
    const inside: Block[] = []
    const r = rng('mall-boutiques')
    for (const [row, z0, z1, k] of [[BACK, -20, -8, 'back'], [FRONT, 8, 20, 'front']] as [number[], number, number, 'back' | 'front'][]) {
      const front = z0 < 0 ? z1 : z0
      const back = z0 < 0 ? z0 : z1
      row.forEach((x, i) => {
        walls.push({ p: [x - SHOP_W / 2, 2, (z0 + z1) / 2], s: [0.3, 4, z1 - z0], c: '#f3f1ec' }, { p: [x + SHOP_W / 2, 2, (z0 + z1) / 2], s: [0.3, 4, z1 - z0], c: '#f3f1ec' })
        walls.push({ p: [x, 2, back], s: [SHOP_W, 4, 0.3], c: SHOP_COLORS[k][i] })
        // The shop window either side of the door; the band over the front.
        walls.push({ p: [x - SHOP_W / 2 + 1, 1.2, front], s: [2, 2.4, 0.1], c: '#cfe8f2' }, { p: [x + SHOP_W / 2 - 1, 1.2, front], s: [2, 2.4, 0.1], c: '#cfe8f2' })
        walls.push({ p: [x, 3.4, front], s: [SHOP_W, 1.2, 0.3], c: '#2b2f3a' })
        // Inside: its floor colour, a counter, racks or shelves of things, colours on them.
        const deep = z0 < 0 ? -1 : 1
        inside.push({ p: [x, 0.5, (back + front) / 2 + deep * 2], s: [2.8, 1, 0.8], c: '#6b4426' })
        for (let j = 0; j < 3; j++) {
          inside.push({ p: [x - 2.6 + j * 2.6, 1.1, back - deep * 0.5], s: [1.6, 2.2, 0.4], c: '#dfe3e8' })
          for (let y = 0; y < 3; y++) inside.push({ p: [x - 2.6 + j * 2.6, 0.5 + y * 0.6, back - deep * 0.75], s: [1.4, 0.35, 0.12], c: ['#e63946', '#f1c40f', '#2a9d8f', '#e76f51', '#457b9d', '#ffffff', '#d6336c'][Math.floor(r() * 7)] })
        }
      })
    }
    return { walls, inside }
  }, [])
  return (
    <group>
      <Blocks at={parts.walls} material={mat('#ffffff')} color />
      <Blocks at={parts.inside} material={mat('#ffffff')} color />
      {BACK.map((x, i) => (
        <mesh key={`b${x}`} position={[x, 3.4, -7.82]} material={signs.back[i]}>
          <planeGeometry args={[SHOP_W - 0.6, 1]} />
        </mesh>
      ))}
      {FRONT.map((x, i) => (
        <mesh key={`f${x}`} position={[x, 3.4, 7.82]} rotation={[0, Math.PI, 0]} material={signs.front[i]}>
          <planeGeometry args={[SHOP_W - 0.6, 1]} />
        </mesh>
      ))}
      {night && <pointLight position={[10, 3, -12]} intensity={20} distance={30} color="#ffe8c0" />}
    </group>
  )
}

/* ---------- The atrium: fountain, benches, palms, escalator, the food court ---------- */

function Atrium() {
  const water = useRef<THREE.MeshLambertMaterial>(null)
  useFrame(() => {
    water.current?.color.setHSL(0.53, 0.65, 0.55 + Math.sin(worldTime() * 2) * 0.04)
  })
  const parts = useMemo(() => {
    const out: Block[] = [
      // The fountain's basin.
      { p: [12, 0.35, 0], s: [5.2, 0.7, 5.2], c: '#d8d0c0' },
      // The benches.
      { p: [12, 0.25, -5.5], s: [2.4, 0.5, 0.8], c: '#6b4426' },
      { p: [12, 0.25, 5.5], s: [2.4, 0.5, 0.8], c: '#6b4426' },
      // The escalator up to the mezzanine (its steps, its rails), the mezzanine's edge.
      { p: [4, 1.6, 0], s: [2, 0.4, 7.2], c: '#9aa1a8' },
      { p: [3, 2.2, 0], s: [0.15, 1.2, 7.2], c: '#2b2f3a' },
      { p: [5, 2.2, 0], s: [0.15, 1.2, 7.2], c: '#2b2f3a' },
      // The ice-cream kiosk and the food court's counter; its tables and stools.
      { p: [30.5, 0.55, -5], s: [2.8, 1.1, 2.4], c: '#2a9d8f' },
      { p: [30.5, 1.8, -5], s: [3.2, 0.25, 2.8], c: '#ffffff' },
    ]
    for (const [x, z] of [[24, 0], [28, 3], [33, 0], [28, -3], [34, 4], [30.5, 2]]) {
      out.push({ p: [x, 0.75, z], s: [1.2, 0.08, 1.2], c: '#ffffff' }, { p: [x, 0.37, z], s: [0.15, 0.74, 0.15], c: '#9aa1a8' })
      for (const [dx, dz] of [[0, 0.9], [0, -0.9]]) out.push({ p: [x + dx, 0.22, z + dz], s: [0.45, 0.44, 0.45], c: '#ff8200' })
    }
    // Palms in pots along the gallery.
    for (const x of [-6, 2, 20, 26]) for (const z of [-6.5, 6.5]) out.push({ p: [x, 0.4, z], s: [0.9, 0.8, 0.9], c: '#8a5a32' })
    return out
  }, [])
  return (
    <group>
      <Blocks at={parts} material={mat('#ffffff')} color />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, 0.62, 0]}>
        <planeGeometry args={[4.6, 4.6]} />
        <meshLambertMaterial ref={water} color="#58c4dc" />
      </mesh>
      <mesh geometry={BOX} position={[12, 1.2, 0]} scale={[0.5, 1.6, 0.5]} material={mat('#d8d0c0')} />
      {[-6, 2, 20, 26].flatMap((x) =>
        [-6.5, 6.5].map((z) => (
          <group key={`${x}${z}`} position={[x, 0.8, z]}>
            <mesh geometry={BOX} position={[0, 1.2, 0]} scale={[0.25, 2.4, 0.25]} material={mat('#7d6248')} />
            {[0, 1, 2, 3, 4].map((k) => (
              <mesh key={k} geometry={BOX} position={[Math.cos((k / 5) * Math.PI * 2) * 0.8, 2.4, Math.sin((k / 5) * Math.PI * 2) * 0.8]} rotation={[0, (k / 5) * Math.PI * 2, 0.4]} scale={[1.6, 0.08, 0.4]} material={mat('#2f7a35')} />
            ))}
          </group>
        )),
      )}
    </group>
  )
}

/** A trolley beside the Sim doing its shopping, full. */
function Trolley({ at }: { at: XZ }) {
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh geometry={BOX} position={[0, 0.7, 0]} scale={[0.6, 0.5, 0.9]} material={mat('#b9bec6')} />
      <mesh geometry={BOX} position={[0, 1.0, 0]} scale={[0.5, 0.25, 0.8]} material={mat('#e63946')} />
      <mesh geometry={BOX} position={[0, 0.25, 0]} scale={[0.5, 0.06, 0.8]} material={mat('#2b2f3a')} />
    </group>
  )
}

/* ---------- Outside: the car park ---------- */

function Outside({ night }: { night: boolean }) {
  const cars = useMemo(() => {
    const r = rng('mall-parking')
    const out: { p: [number, number, number]; r: number; c: string }[] = []
    for (let i = 0; i < 14; i++) {
      if (r() < 0.25) continue
      const x = -30 + i * 4.6
      if (x > 2 && x < 22) continue
      out.push({ p: [x, 0, HD + 9 + (i % 2) * 0.3], r: Math.PI / 2, c: ['#f8f9fa', '#c92a2a', '#212529', '#2a6cf0', '#868e96'][Math.floor(r() * 5)] })
    }
    return out
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, HD + 14]} receiveShadow>
        <planeGeometry args={[HW * 2 + 20, 28]} />
        <meshLambertMaterial color={night ? '#3a3c42' : '#55585e'} />
      </mesh>
      <Blocks at={[...Array(16)].map((_, i) => ({ p: [-32 + i * 4.6, 0.02, HD + 9] as [number, number, number], s: [0.12, 0.02, 5] as [number, number, number] }))} material={mat('#f3f1ec')} />
      {cars.map((c, i) => (
        <Vehicle key={i} p={c.p} r={c.r} kind="car" color={c.c} seed={i} />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshLambertMaterial color="#b98b5c" />
      </mesh>
    </group>
  )
}

/* ---------- The people ---------- */

function People() {
  const list = useMemo(() => {
    const r = rng('mall-gens')
    const one = (p: [number, number, number], ry: number, pose: Pose, dress?: string, kid = false) => {
      const gender: 'femme' | 'homme' = r() < 0.55 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      return { p, ry, pose, gender, kid, look: dress ? { ...look, outfit: dress } : look, seed: r() * 100 }
    }
    return [
      // The security guard at the doors.
      one([8.6, 0, HD - 2], Math.PI, 'idle', 'vigile'),
      // The cashiers and the customers at the tills; shoppers in the aisles.
      ...TILLS.map((x) => one([x - 0.9, 0, 8], Math.PI / 2, 'busy')),
      one([-33, 0, 9.6], Math.PI, 'phone'), one([-23, 0, 9.6], Math.PI, 'idle'),
      one([-32, 0, -4], -Math.PI / 2, 'busy'), one([-24, 0, -12], Math.PI / 2, 'busy'), one([-20, 0, 0], -Math.PI / 2, 'touch'), one([-28, 0, -17], Math.PI / 2, 'busy'),
      one([-30, 0, 15.5], Math.PI, 'busy'), one([-22, 0, 15.5], Math.PI, 'talk'),
      // In the shops: the sellers, the customers.
      ...BACK.map((x) => one([x + 0.6, 0, -13.2], 0, 'busy')),
      ...FRONT.map((x) => one([x + 0.6, 0, 13.2], Math.PI, 'busy')),
      one([-4, 0, -16], Math.PI, 'phone'), one([10.5, 0, -17], Math.PI, 'busy'), one([3, 0, 15.5], 0, 'talk'),
      // The atrium: on the benches, by the fountain, children round it.
      one([11.2, 0.05, -5.6], 0, 'sit'), one([12.8, 0.05, -5.6], 0, 'phone'), one([12, 0.05, 5.6], Math.PI, 'sit'),
      one([9.2, 0, 2], 1.2, 'cheer', undefined, true), one([14.8, 0, -2], -1.6, 'wave', undefined, true), one([9.5, 0, -1.8], 2.6, 'idle'),
      // The food court: people eating, the server at the kiosk.
      one([24, 0.05, 0.9], Math.PI, 'eat'), one([24, 0.05, -0.9], 0, 'talk'), one([28, 0.05, 3.9], Math.PI, 'eat'), one([33, 0.05, 0.9], Math.PI, 'drink'), one([28, 0.05, -2.1], Math.PI, 'eat'),
      one([30.5, 0, -6.6], 0, 'busy'),
    ]
  }, [])
  // Shoppers walking the gallery, back and forth, bags in hand.
  const walkers = useMemo(() => {
    const r = rng('mall-passants')
    return [...Array(9)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.55 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), z: -5 + (i % 5) * 2.5, x0: -8, x1: 34, speed: 1 + r() * 0.4, phase: r() * 60, kid: r() < 0.2 }
    })
  }, [])
  const wr = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    const t = worldTime()
    walkers.forEach((w, i) => {
      const g = wr.current[i]
      if (!g) return
      const len = w.x1 - w.x0
      const p = ((t * w.speed + w.phase) % (2 * len)) / len
      const there = p < 1
      // Round the fountain rather than through it.
      const x = there ? w.x0 + len * p : w.x1 - len * (p - 1)
      const z = Math.abs(x - 12) < 4 ? w.z + Math.sign(w.z || 1) * (4 - Math.abs(x - 12)) : w.z
      g.position.set(x, 0, z)
      g.rotation.y = there ? Math.PI / 2 : -Math.PI / 2
    })
  })
  return (
    <NoShadows>
      {list.map((g, i) => (
        <group key={i} position={g.p} rotation={[0, g.ry, 0]} scale={g.kid ? 0.62 : 1}>
          {g.kid ? <Human look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} /> : <TalkHuman id={`mall-${i}`} look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />}
        </group>
      ))}
      {walkers.map((w, i) => (
        <group key={`w${i}`} ref={(g) => { wr.current[i] = g }} scale={w.kid ? 0.62 : 1}>
          {w.kid ? <Human look={w.look} gender={w.gender} pose="walk" speed={w.speed} seed={i * 7} /> : <TalkHuman id={`mall-w${i}`} look={w.look} gender={w.gender} pose="walk" speed={w.speed} seed={i * 7 + 0.5} />}
        </group>
      ))}
    </NoShadows>
  )
}
