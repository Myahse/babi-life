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
import { Guest, mat, sign, useBigWalk, type Spot, type XZ } from './bigPlace'
import { BOX, Blocks } from '../open/ruePrincesse'

// Inside a business hotel of Abidjan (the Plateau's, Marcory's): not one room
// but the hotel as it is, after the real ones (two hundred rooms and more over
// ten floors; the lobby with its reception and its lounge; the restaurant
// with its buffet, looking onto the pool; the bar; the pool deck with its
// loungers, its parasols and its poolside bar; the spa and the gym). The hall
// is in front, the restaurant on the left, the bar on the right, the pool deck
// behind the glass; one of the rooms is shown down the corridor. Each hotel
// has its own colours. The Hôtel Ivoire has its own world (IvoireInside).
// Frame: x across, +z toward the entrance, -z the pool deck.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

/** The building's walls (half-sizes): x from -HW to HW, z from -HD to HD; the pool deck beyond, down to DECK. */
const HW = 22
const HD = 16
const DECK = -34

/** A hotel's colours: the walls, the stone of the floor, the wood, the fabric, the brass. */
type Palette = { wall: string; floor: [string, string]; wood: string; fabric: string; brass: string; carpet: string; sign: [string, string] }
const PALETTES: Record<string, Palette> = {
  // The Plateau's big international hotel: grey stone, teal, light wood.
  'plateau-poulman': { wall: '#e9e6e1', floor: ['#d9d6d0', '#c9c5be'], wood: '#9a7652', fabric: '#1f6f78', brass: '#c9a227', carpet: '#2e4a52', sign: ['#1f2a33', '#e9e6e1'] },
  // The new one by the Pyramide: black and gold, dark wood, velvet.
  'plateau-noum': { wall: '#2b2a2e', floor: ['#3a383d', '#2f2d31'], wood: '#5a3a24', fabric: '#7a1f2b', brass: '#d4af37', carpet: '#4a1820', sign: ['#111014', '#d4af37'] },
  // Marcory's: warm terracotta, a geometric wall, the garden round the pool.
  'marcory-azale': { wall: '#f1e4d2', floor: ['#e6d3b8', '#d8c2a2'], wood: '#8a5a32', fabric: '#c2552e', brass: '#b8862b', carpet: '#7a3a22', sign: ['#c2552e', '#fff6ea'] },
}
const PLAIN: Palette = { wall: '#efe9df', floor: ['#e8e1d4', '#d9d0c0'], wood: '#7a5233', fabric: '#2c4a6b', brass: '#c9a227', carpet: '#3a4a6b', sign: ['#2c4a6b', '#ffffff'] }

const SPOTS: Record<string, Spot> = {
  // Lengths of the pool, from the deck.
  'piscine-hotel': { at: [0, -26], rot: Math.PI / 2, pose: 'swim', y: 0.42, swim: 6.5, from: [0, -20.5] },
  // A table of the restaurant, by the glass over the pool.
  'brunch-lagune': { at: [-14, -11.4], rot: Math.PI, pose: 'eat', y: 0.05 },
  // A stool at the bar.
  'bar-hotel': { at: [13.4, -4.6], rot: Math.PI, pose: 'drink' },
  // The room down the corridor, the king bed.
  'nuit-hotel': { at: [17.2, 10.6], rot: Math.PI / 2, pose: 'sleep', y: 0.62, lying: true, from: [14.6, 10.6] },
}
const ENTRANCE: XZ = [0, HD - 1.5]

/** What stands in the way, as boxes [x, z, half-width, half-depth]. */
const SOLID: [number, number, number, number][] = [
  [0, 6.5, 4.6, 0.8], // the reception desk, facing the doors
  [0, 3.8, 4.5, 0.4], // the wall of the lifts behind it
  [-HW / 2 - 0.5, -2, HW / 2 - 0.5, 0.2], // the restaurant's low wall (its way in at x -6…-4)
  [-17, -4.5, 3.2, 0.8], // the buffet
  [13, -6, 5, 0.7], // the bar counter
  [0, -26, 9, 4], // the pool
  [13, 6.2, 9, 0.2], // the corridor's wall (the room's door at x 13…14)
  [17.6, 10.6, 2.2, 1.6], // the king bed
  [20.6, 13.6, 1.4, 1.4], // the room's bathroom
  [-8, 6, 2.4, 1.2], // the lobby's sofas
  [-8, 2, 2.4, 1.2],
  // The pillars of the hall.
  ...([-6, 6] as const).flatMap((x) => [4, -2].map((z) => [x, z, 0.6, 0.6] as [number, number, number, number])),
  // The glass wall over the deck, open in the middle.
  [-12.5, -HD, 9.5, 0.2],
  [12.5, -HD, 9.5, 0.2],
]
// The restaurant's tables.
const TABLES: XZ[] = [[-18, -11.4], [-14, -11.4], [-10, -11.4], [-18, -7.6], [-14, -7.6], [-10, -7.6]]
for (const [x, z] of TABLES) SOLID.push([x, z, 0.9, 0.9])

function free(x: number, z: number) {
  if (x < -HW + 0.5 || x > HW - 0.5 || z > HD - 0.5 || z < DECK + 0.5) return false
  // The doorway in the corridor's wall and the restaurant's way in.
  if (z > 5.8 && z < 6.6 && x > 12.8 && x < 14.2) return true
  if (z > -2.4 && z < -1.6 && x > -6.2 && x < -3.8) return true
  for (const [cx, cz, hw, hd] of SOLID) if (Math.abs(x - cx) < hw + 0.3 && Math.abs(z - cz) < hd + 0.3) return false
  return true
}

const colored = new THREE.MeshLambertMaterial({ color: '#ffffff' })

/** The floor's stone: big tiles in two shades. */
function stone([a, b]: [string, string]) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? a : b
      g.fillRect(i * 64, j * 64, 64, 64)
      g.strokeStyle = 'rgba(0,0,0,0.08)'
      g.strokeRect(i * 64 + 0.5, j * 64 + 0.5, 63, 63)
    }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(HW / 2, HD / 2)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function HotelInside({ sim, placeId, name, interactionId, roam, night, stage }: { sim: Sim; placeId: string; name: string; interactionId?: string; /** Just come in: walk about (tap the floor, or the keys). */ roam?: boolean; night: boolean; stage: string }) {
  const pal = PALETTES[placeId] ?? PLAIN
  const spot = interactionId ? (SPOTS[interactionId] ?? null) : null
  const { way, tap, onMoved } = useBigWalk(spot, interactionId, roam, free, ENTRANCE)
  const signs = useMemo(
    () => ({
      hotel: sign(name.toUpperCase(), pal.sign[0], pal.sign[1], 1024, 160),
      resto: sign('RESTAURANT · BUFFET', pal.sign[1], pal.sign[0]),
      bar: sign('LE BAR', pal.sign[0], pal.sign[1]),
      spa: sign('SPA · SALLE DE SPORT →', '#ffffff', '#2b2b2b'),
      rooms: sign('CHAMBRES 101 – 120 →', '#ffffff', '#2b2b2b'),
      lifts: sign('ASCENSEURS · ÉTAGES 1 – 10', pal.sign[0], pal.sign[1]),
    }),
    [name, pal],
  )
  const floor = useMemo(() => stone(pal.floor), [pal])
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 15, HD + 18], fov: 45, near: 0.3, far: 700 }} style={{ background: night ? '#0b1026' : '#9ccbea' }}>
        <Snapper />
        <Suspense fallback={null}>
          <hemisphereLight args={[night ? '#8090d0' : '#ffffff', '#c9b48c', night ? 0.75 : 1.2]} />
          <directionalLight position={[25, 45, 20]} intensity={night ? 0.25 : 1.3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
          <pointLight position={[0, 7, 6]} intensity={night ? 45 : 18} distance={30} color="#ffe2b0" />
          <pointLight position={[-14, 6, -8]} intensity={night ? 30 : 8} distance={20} color="#ffd9a0" />
          <pointLight position={[13, 6, -5]} intensity={night ? 30 : 8} distance={18} color="#ffc48a" />
          <Hall pal={pal} floor={floor} night={night} signs={signs} />
          <Room pal={pal} />
          <Deck pal={pal} night={night} />
          <People placeId={placeId} night={night} />
          {roam && !interactionId && (
            // The floor, to tap where to walk (a drag turns the camera instead).
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.06, (HD + DECK) / 2]}
              onClick={(e) => {
                if (e.delta > 6) return
                e.stopPropagation()
                tap([e.point.x, e.point.z])
              }}
            >
              <planeGeometry args={[HW * 2, HD - DECK]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          )}
          <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!!roam && !interactionId} onMoved={onMoved} free={free} entrance={ENTRANCE} />
          <OrbitControls makeDefault target={[0, 1, HD - 6]} enablePan={false} minDistance={6} maxDistance={60} minPolarAngle={0.25} maxPolarAngle={1.25} enableDamping />
        </Suspense>
      </Canvas>
    </div>
  )
}

/* ---------- The hall: the reception, the lifts, the lounge, the restaurant, the bar ---------- */

type Signs = { hotel: THREE.Material; resto: THREE.Material; bar: THREE.Material; spa: THREE.Material; rooms: THREE.Material; lifts: THREE.Material }

function Hall({ pal, floor, night, signs }: { pal: Palette; floor: THREE.Texture; night: boolean; signs: Signs }) {
  const parts = useMemo(() => {
    const walls: Block[] = []
    const brass: Block[] = []
    const wood: Block[] = []
    const fabric: Block[] = []
    // The side walls; the front wall cut low, the revolving doors in its middle.
    walls.push({ p: [-HW, 3.5, 0], s: [0.5, 7, HD * 2] }, { p: [HW, 3.5, 0], s: [0.5, 7, HD * 2] })
    walls.push({ p: [-(HW + 4) / 2, 0.6, HD], s: [HW - 4, 1.2, 0.5] }, { p: [(HW + 4) / 2, 0.6, HD], s: [HW - 4, 1.2, 0.5] })
    // The pillars, brass at foot and head.
    for (const x of [-6, 6])
      for (const z of [4, -2]) {
        walls.push({ p: [x, 3.5, z], s: [1.1, 7, 1.1] })
        brass.push({ p: [x, 0.2, z], s: [1.3, 0.4, 1.3] }, { p: [x, 6.7, z], s: [1.3, 0.3, 1.3] })
      }
    // The reception, facing the doors across the lobby: the long desk, its stone top, the wall of the lifts behind with their doors.
    wood.push({ p: [0, 0.55, 6.5], s: [9, 1.1, 1.4] })
    walls.push({ p: [0, 1.15, 6.5], s: [9.2, 0.1, 1.6], c: '#f3ece0' })
    walls.push({ p: [0, 2, 3.8], s: [9, 4, 0.6], c: pal.wall })
    for (const x of [-3, -1, 1, 3]) brass.push({ p: [x, 1.25, 4.12], s: [1.6, 2.5, 0.05] })
    // The lounge on the left of the hall: two sofas face to face round a low table, armchairs.
    fabric.push({ p: [-8, 0.4, 6.5], s: [4, 0.8, 1], c: pal.fabric }, { p: [-8, 0.9, 6.95], s: [4, 0.6, 0.2], c: pal.fabric })
    fabric.push({ p: [-8, 0.4, 1.5], s: [4, 0.8, 1], c: pal.fabric }, { p: [-8, 0.9, 1.05], s: [4, 0.6, 0.2], c: pal.fabric })
    wood.push({ p: [-8, 0.3, 4], s: [2.4, 0.6, 1.6] })
    // The right of the hall: armchairs by the window, a low table, the gift shop's window.
    for (const z of [10, 6]) fabric.push({ p: [16, 0.4, z], s: [1.2, 0.8, 1.2], c: pal.fabric }, { p: [18, 0.4, z], s: [1.2, 0.8, 1.2], c: pal.fabric })
    // The restaurant (left, behind its low wall): the buffet, the tables and chairs.
    walls.push({ p: [-13.5, 0.55, -2], s: [15, 1.1, 0.3], c: pal.wall }, { p: [-HW + 0.6, 0.55, -2], s: [1.2, 1.1, 0.3], c: pal.wall })
    wood.push({ p: [-17, 0.5, -4.5], s: [6.4, 1, 1.4] })
    walls.push({ p: [-17, 1.03, -4.5], s: [6.5, 0.06, 1.5], c: '#f4f4f4' })
    for (const [x, z] of TABLES) {
      walls.push({ p: [x, 0.75, z], s: [1.5, 0.08, 1.5], c: '#ffffff' })
      wood.push({ p: [x, 0.37, z], s: [0.2, 0.74, 0.2] })
      fabric.push({ p: [x - 1.05, 0.25, z], s: [0.55, 0.5, 0.55], c: pal.wood }, { p: [x + 1.05, 0.25, z], s: [0.55, 0.5, 0.55], c: pal.wood })
    }
    // The bar (right): the counter, its top, the stools, the shelves behind, lounge chairs.
    wood.push({ p: [13, 0.6, -6], s: [10, 1.2, 1.2] })
    walls.push({ p: [13, 1.25, -6], s: [10.2, 0.1, 1.4], c: '#2b2b2b' })
    for (let x = 9; x <= 17.5; x += 1.5) fabric.push({ p: [x, 0.4, -4.6], s: [0.5, 0.8, 0.5], c: '#3a2a20' })
    wood.push({ p: [13, 2, -8.4], s: [9, 4, 0.4] })
    for (const [x, z] of [[9, -11], [12, -11], [15, -11], [18, -11]]) fabric.push({ p: [x, 0.35, z], s: [1, 0.7, 1], c: pal.fabric }, { p: [x + 0.8, 0.3, z], s: [0.6, 0.6, 0.6], c: pal.wood })
    return { walls, brass, wood, fabric }
  }, [pal])
  const bottles = useMemo(() => [...Array(20)].map((_, i) => ({ x: 9.2 + (i % 10) * 0.84, y: 2 + Math.floor(i / 10) * 1.1, c: ['#2f6b3a', '#7a1f2b', '#c9a227', '#3a5a8a'][i % 4] })), [])
  const dishes = useMemo(() => [...Array(8)].map((_, i) => ({ x: -19.6 + i * 0.75, c: ['#c2552e', '#e7c23a', '#5a8a3a', '#f4f1ea'][i % 4] })), [])
  return (
    <group>
      {/* The forecourt and the drive outside the doors */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, HD + 30]} receiveShadow>
        <planeGeometry args={[200, 60]} />
        <meshLambertMaterial color="#8a8f96" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, HD + 6]} receiveShadow>
        <planeGeometry args={[30, 12]} />
        <meshLambertMaterial color="#d8d0c0" />
      </mesh>
      {/* The stone floor, the lounge's carpet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[HW * 2, HD * 2]} />
        <meshLambertMaterial map={floor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8, 0.02, 4]} receiveShadow>
        <planeGeometry args={[7, 8]} />
        <meshLambertMaterial color={pal.carpet} />
      </mesh>
      <Blocks at={parts.walls.map((b) => ({ ...b, c: b.c ?? pal.wall }))} material={colored} color />
      <Blocks at={parts.brass} material={mat(pal.brass, night ? '#4a3a10' : undefined)} />
      <Blocks at={parts.wood} material={mat(pal.wood)} />
      <Blocks at={parts.fabric.map((b) => ({ ...b, c: b.c ?? pal.fabric }))} material={colored} color />
      {/* The bottles on the bar's lit shelves, the buffet's dishes */}
      <mesh position={[13, 2.6, -8.15]}>
        <planeGeometry args={[8.6, 2.4]} />
        <meshBasicMaterial color={night ? '#ffb347' : '#e8b27a'} />
      </mesh>
      {bottles.map((b, i) => (
        <mesh key={i} geometry={BOX} position={[b.x, b.y, -8.05]} scale={[0.18, 0.55, 0.18]} material={mat(b.c)} />
      ))}
      {dishes.map((d, i) => (
        <mesh key={i} geometry={BOX} position={[d.x, 1.12, -4.5]} scale={[0.55, 0.12, 0.8]} material={mat(d.c)} />
      ))}
      {/* Lights hanging over the hall and the reception */}
      {[[-3, 5], [3, 5], [0, 0], [-14, -9], [13, -9]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 6.2, z]}>
          <mesh geometry={BOX} scale={[0.05, 1.2, 0.05]} position={[0, 0.6, 0]} material={mat(pal.brass)} />
          <mesh geometry={BOX} scale={[1.4, 0.35, 1.4]} material={mat('#fff6d8', '#ffd98a')} />
        </group>
      ))}
      {/* The signs: the hotel's name over the reception, the restaurant, the bar, the lifts, the way to the rooms and the spa */}
      <mesh position={[0, 3.35, 4.12]} material={signs.hotel}>
        <planeGeometry args={[7, 1.05]} />
      </mesh>
      <mesh position={[0, 2.75, 4.12]} material={signs.lifts}>
        <planeGeometry args={[4.4, 0.4]} />
      </mesh>
      <mesh position={[-13, 3.4, -1.7]} rotation={[0, Math.PI, 0]} material={signs.resto}>
        <planeGeometry args={[6, 1.2]} />
      </mesh>
      <mesh position={[13, 4.6, -8.16]} material={signs.bar}>
        <planeGeometry args={[4, 1]} />
      </mesh>
      <mesh position={[HW - 0.3, 2.6, 2]} rotation={[0, -Math.PI / 2, 0]} material={signs.spa}>
        <planeGeometry args={[5, 0.6]} />
      </mesh>
      <mesh position={[13.5, 3, 5.88]} rotation={[0, Math.PI, 0]} material={signs.rooms}>
        <planeGeometry args={[4.4, 0.55]} />
      </mesh>
      {/* The glass wall over the pool deck: tall panes, open in the middle */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 12.5, 3.5, -HD]}>
          <boxGeometry args={[19, 7, 0.15]} />
          <meshLambertMaterial color="#bfe3f2" transparent opacity={0.28} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- One of the rooms, down the corridor ---------- */

function Room({ pal }: { pal: Palette }) {
  return (
    <group>
      {/* The corridor's wall with the room's door; the room's own walls, cut low so it can be seen */}
      <Blocks
        at={[
          { p: [8.5, 1.5, 6.2], s: [9, 3, 0.25] },
          { p: [18.2, 1.5, 6.2], s: [7.6, 3, 0.25] },
          { p: [11, 0.6, 11], s: [0.25, 1.2, 9.6] },
        ]}
        material={mat(pal.wall)}
      />
      {/* The room's carpet; the king bed, its headboard, the bedside tables and lamps; the desk and its chair; the TV on the wall */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[16.5, 0.02, 11]} receiveShadow>
        <planeGeometry args={[10.4, 9.4]} />
        <meshLambertMaterial color={pal.carpet} />
      </mesh>
      <Blocks
        at={[
          { p: [17.6, 0.32, 10.6], s: [3.6, 0.64, 2.4], c: '#f5f1e8' },
          { p: [17.6, 0.7, 10.6], s: [2.2, 0.1, 2.5], c: pal.fabric },
          { p: [19.55, 0.95, 10.6], s: [0.25, 1.9, 2.8], c: pal.wood },
          { p: [19.2, 0.3, 8.6], s: [0.6, 0.6, 0.6], c: pal.wood },
          { p: [19.2, 0.3, 12.6], s: [0.6, 0.6, 0.6], c: pal.wood },
          { p: [19.2, 0.75, 8.6], s: [0.25, 0.3, 0.25], c: '#fff6d8' },
          { p: [19.2, 0.75, 12.6], s: [0.25, 0.3, 0.25], c: '#fff6d8' },
          { p: [13, 0.74, 14.6], s: [2.4, 0.08, 0.8], c: pal.wood },
          { p: [13, 0.3, 14.6], s: [0.12, 0.6, 0.6], c: pal.wood },
          { p: [13, 0.25, 13.9], s: [0.55, 0.5, 0.55], c: pal.fabric },
          { p: [11.25, 1.6, 10.6], s: [0.08, 0.9, 1.6], c: '#151820' },
        ]}
        material={colored}
        color
      />
      {/* The bathroom in the corner, behind glass: the shower, the basin */}
      <Blocks at={[{ p: [20.6, 0.06, 13.6], s: [2.6, 0.12, 2.6] }, { p: [20.6, 0.45, 12.3], s: [1.6, 0.9, 0.5] }]} material={mat('#f4f6f8')} />
      <mesh position={[19.3, 1.2, 13.6]}>
        <boxGeometry args={[0.06, 2.4, 2.6]} />
        <meshLambertMaterial color="#cfe8f2" transparent opacity={0.35} />
      </mesh>
    </group>
  )
}

/* ---------- The pool deck: the pool, the loungers and parasols, the poolside bar, the garden ---------- */

function Deck({ pal, night }: { pal: Palette; night: boolean }) {
  const water = useRef<THREE.MeshLambertMaterial>(null)
  useFrame(() => {
    water.current?.color.setHSL(0.53, 0.7, 0.5 + Math.sin(worldTime() * 1.3) * 0.03)
  })
  const loungers = useMemo(() => [-14, -11, -8, 8, 11, 14].flatMap((x) => [-20.5, -31.5].map((z) => [x, z] as XZ)), [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (DECK - HD) / 2]} receiveShadow>
        <planeGeometry args={[HW * 2, -HD - DECK]} />
        <meshLambertMaterial color="#d8cfbd" />
      </mesh>
      {/* The garden round the deck */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, DECK - 20]} receiveShadow>
        <planeGeometry args={[200, 40]} />
        <meshLambertMaterial color="#4f8f3c" />
      </mesh>
      {/* The pool: its rim, the water */}
      <mesh geometry={BOX} position={[0, 0.3, -26]} scale={[18.6, 0.6, 8.4]} material={mat('#f3f1ec')} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.62, -26]}>
        <planeGeometry args={[17.6, 7.4]} />
        <meshLambertMaterial ref={water} color="#3fb7d8" transparent opacity={0.9} />
      </mesh>
      {/* Loungers in pairs under parasols */}
      <Blocks at={loungers.map(([x, z]) => ({ p: [x, 0.3, z] as [number, number, number], s: [0.8, 0.15, 2] as [number, number, number] }))} material={mat('#ffffff')} />
      {loungers.filter((_, i) => i % 2 === 0).map(([x, z], i) => (
        <group key={i} position={[x + 1.4, 0, z]}>
          <mesh geometry={BOX} position={[0, 1.2, 0]} scale={[0.08, 2.4, 0.08]} material={mat('#e8e3d6')} />
          <mesh geometry={BOX} position={[0, 2.45, 0]} scale={[2.6, 0.12, 2.6]} material={mat(pal.fabric)} />
        </group>
      ))}
      {/* The poolside bar: a hut, its counter, stools */}
      <Blocks
        at={[
          { p: [-17, 0.55, -27], s: [4, 1.1, 1.2] },
          { p: [-17, 2.8, -27.6], s: [5, 0.2, 3] },
          ...[-18.5, -15.5].map((x) => ({ p: [x, 1.4, -28.6] as [number, number, number], s: [0.15, 2.8, 0.15] as [number, number, number] })),
        ]}
        material={mat(pal.wood)}
      />
      <Blocks at={[-18.4, -17, -15.6].map((x) => ({ p: [x, 0.4, -25.8] as [number, number, number], s: [0.5, 0.8, 0.5] as [number, number, number] }))} material={mat('#3a2a20')} />
      {/* Palms round the deck */}
      {[[-20, -20], [20, -20], [-20, -33], [20, -33], [18, -27]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={BOX} position={[0, 2.5, 0]} scale={[0.45, 5, 0.45]} material={mat('#7a5a3a')} />
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} geometry={BOX} position={[Math.cos((k * Math.PI) / 2) * 1.1, 5, Math.sin((k * Math.PI) / 2) * 1.1]} scale={[k % 2 ? 0.6 : 2.4, 0.2, k % 2 ? 2.4 : 0.6]} material={mat('#2f8f3a')} />
          ))}
        </group>
      ))}
      {night && <pointLight position={[0, 3, -26]} intensity={12} distance={18} color="#7fd6ff" />}
    </group>
  )
}

/* ---------- The people ---------- */

function People({ placeId, night }: { placeId: string; night: boolean }) {
  const list = useMemo(() => {
    const r = rng(`hotel-gens|${placeId}`)
    const one = (p: [number, number, number], ry: number, pose: Pose, dress?: string) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      return { p, ry, pose, gender, look: dress ? { ...look, outfit: dress } : look, seed: r() * 100 }
    }
    return [
      // At the reception: the receptionists, guests checking in with their cases, the bellboy.
      one([-2.5, 0, 5.4], 0, 'busy', 'suit'), one([2.5, 0, 5.4], 0, 'talk', 'suit'),
      one([-2.5, 0, 7.7], Math.PI, 'talk'), one([2.4, 0, 7.7], Math.PI, 'phone'), one([5.6, 0, 8.6], -0.6, 'idle', 'suit'),
      // The lounge: a business meeting on the sofas, someone waiting on the phone.
      one([-9, 0.35, 6.5], Math.PI, 'sit', 'suit'), one([-7, 0.35, 6.5], Math.PI, 'sit'), one([-8, 0.35, 1.5], 0, 'talk', 'suit'),
      one([16, 0.35, 10], Math.PI / 2, 'phone'), one([2, 0, 2], 0.4, 'phone'),
      // The restaurant: people at the buffet, at the tables; the waiter.
      one([-18, 0, -3.4], Math.PI, 'busy'), one([-16, 0, -3.4], Math.PI, 'idle'),
      one([-19, 0.05, -7.6], Math.PI / 2, 'eat'), one([-17, 0.05, -7.6], -Math.PI / 2, 'talk'), one([-10.9, 0.05, -11.4], Math.PI / 2, 'eat'), one([-12, 0, -9.6], 0.3, 'busy', 'suit'),
      // The bar: the barman, the drinkers.
      one([13, 0, -7.2], 0, 'busy', 'suit'), one([10.5, 0, -4.6], Math.PI, 'drink'), one([15.5, 0, -4.6], Math.PI, 'talk'),
      // The deck: sunbathers, a swimmer's friend filming, the poolside barman.
      one([-14, 0.4, -20.5], 0, 'sleep', 'maillot'), one([11, 0.4, -31.5], 0, 'sleep', 'maillot'), one([6, 0, -21], Math.PI, 'phone'),
      one([-17, 0, -28.2], 0, 'busy'),
    ]
  }, [placeId])
  // Guests crossing the hall between the doors and the lifts.
  const walkers = useMemo(() => {
    const r = rng(`hotel-passants|${placeId}`)
    return [...Array(4)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), x: -3 + i * 2, z0: 8.4, z1: HD - 2, speed: 1 + r() * 0.4, phase: r() * 30 }
    })
  }, [placeId])
  const wr = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    const t = worldTime()
    walkers.forEach((w, i) => {
      const g = wr.current[i]
      if (!g) return
      const len = w.z1 - w.z0
      const p = ((t * w.speed + w.phase) % (2 * len)) / len
      const there = p < 1
      g.position.set(w.x + 5, 0, there ? w.z0 + len * p : w.z1 - len * (p - 1))
      g.rotation.y = there ? 0 : Math.PI
    })
  })
  return (
    <NoShadows>
      {list.map((g, i) => (
        <group key={i} position={g.p} rotation={g.pose === 'sleep' ? [-Math.PI / 2, 0, g.ry] : [0, g.ry, 0]}>
          <Human look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
        </group>
      ))}
      {walkers.map((w, i) => (
        <group key={`w${i}`} ref={(g) => { wr.current[i] = g }}>
          <Human look={w.look} gender={w.gender} pose="walk" speed={w.speed} seed={i * 7} />
        </group>
      ))}
      {night && <pointLight position={[0, 4, 4]} intensity={10} distance={16} color="#ffe2b0" />}
    </NoShadows>
  )
}
