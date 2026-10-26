import { SpotActions } from '../SpotActions'
import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import { NoShadows, type Pose } from '../../avatar/Human'
import { randomLook, workLook } from '../../avatar/options'
import { rng } from '../themes'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { ActionProps } from './ActionProps'
import { Guest, mat, sign, useBigWalk, type Spot, type XZ, spotWhere } from './bigPlace'
import { TalkHuman } from '../Talkable'
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

/**
 * What makes each hotel itself, after the real one it stands for: what is seen beyond the pool
 * (the lagoon and the bay of Cocody for the Plateau's lagoon-side hotel; the city far below for
 * the tower whose pool is on the 7th floor; the garden for Marcory's; the runway for the airport's),
 * the hall's height (the tower's atrium rises three floors), its restaurant and bar, its floors,
 * and its decor (wood panels, Ivorian textiles hanging in the atrium, banco walls and local
 * painters' canvases, the blue lights of the airport's).
 */
type View = 'lagune' | 'ville' | 'jardin' | 'aeroport'
type Decor = 'boiseries' | 'textiles' | 'banco' | 'bleu' | 'aucun'
type Hotel = { pal: Palette; view: View; tall: boolean; decor: Decor; resto: string; bar: string; floors: string; deck: string }
const HOTELS: Record<string, Hotel> = {
  'plateau-poulman': { pal: PALETTES['plateau-poulman'], view: 'lagune', tall: false, decor: 'boiseries', resto: 'LE LAGON · BUFFET', bar: 'LE CLUB · BAR', floors: 'ÉTAGES 1 – 10', deck: '#d8cfbd' },
  'plateau-noum': { pal: PALETTES['plateau-noum'], view: 'ville', tall: true, decor: 'textiles', resto: 'BOULEVARD · AFRO-FUSION', bar: 'SKY BAR · 22e', floors: 'PISCINE 7e · SKY BAR 22e', deck: '#3a383d' },
  'marcory-azale': { pal: PALETTES['marcory-azale'], view: 'jardin', tall: false, decor: 'banco', resto: 'LE BANCO · CUISINE D’ICI ET D’AILLEURS', bar: 'LE BAR', floors: 'ÉTAGES 1 – 5', deck: '#5f9a46' },
  'pb-rabisson': {
    pal: { wall: '#f2f4f7', floor: ['#dfe4ea', '#cfd6de'], wood: '#5b6b7d', fabric: '#1c4fa0', brass: '#9fb4cc', carpet: '#1c3a6b', sign: ['#1c4fa0', '#ffffff'] },
    view: 'aeroport', tall: false, decor: 'bleu', resto: 'LE GARDE-MANGER', bar: 'LE BAR DE LA PISCINE', floors: 'ÉTAGES 1 – 6', deck: '#d8d4cc',
  },
}
const PLAIN_HOTEL: Hotel = { pal: PLAIN, view: 'jardin', tall: false, decor: 'aucun', resto: 'RESTAURANT · BUFFET', bar: 'LE BAR', floors: 'ÉTAGES 1 – 8', deck: '#d8cfbd' }

const SPOTS: Record<string, Spot> = {
  // Lengths of the pool, from the deck.
  'piscine-hotel': { at: [0, -26], rot: Math.PI / 2, pose: 'swim', y: 0.42, swim: 6.5, from: [0, -20.5] },
  // A table of the restaurant, by the glass over the pool: on its chair (the chairs stand either side, along x), facing it.
  'brunch-lagune': { at: [-14.9, -11.4], rot: Math.PI / 2, pose: 'eat', y: 0.05 },
  // A stool at the bar.
  'bar-hotel': { at: [13.4, -4.6], rot: Math.PI, pose: 'drink', y: 0.35 },
  // At work: behind the reception desk, beside the receptionist.
  work: { at: [3.6, 5], rot: 0, pose: 'busy', from: [5.2, 5] },
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
  const hotel = HOTELS[placeId] ?? PLAIN_HOTEL
  const pal = hotel.pal
  const spot = interactionId ? (SPOTS[interactionId] ?? null) : null
  const { way, tap, onMoved } = useBigWalk(spot, interactionId, roam, free, ENTRANCE)
  const signs = useMemo(
    () => ({
      hotel: sign(name.toUpperCase(), pal.sign[0], pal.sign[1], 1024, 160),
      resto: sign(hotel.resto, pal.sign[1], pal.sign[0]),
      bar: sign(hotel.bar, pal.sign[0], pal.sign[1]),
      spa: sign('SPA · SALLE DE SPORT →', '#ffffff', '#2b2b2b'),
      rooms: sign('CHAMBRES 101 – 120 →', '#ffffff', '#2b2b2b'),
      lifts: sign(`ASCENSEURS · ${hotel.floors}`, pal.sign[0], pal.sign[1]),
    }),
    [name, pal, hotel],
  )
  const floor = useMemo(() => stone(pal.floor), [pal])
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 30, HD + 14], fov: 45, near: 0.3, far: 900 }} style={{ background: night ? '#0b1026' : '#9ccbea' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={[night ? '#8090d0' : '#ffffff', '#c9b48c', night ? 0.75 : 1.2]} />
          <directionalLight position={[25, 45, 20]} intensity={night ? 0.25 : 1.3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
          <pointLight position={[0, 7, 6]} intensity={night ? 45 : 18} distance={30} color="#ffe2b0" />
          <pointLight position={[-14, 6, -8]} intensity={night ? 30 : 8} distance={20} color="#ffd9a0" />
          <pointLight position={[13, 6, -5]} intensity={night ? 30 : 8} distance={18} color="#ffc48a" />
          <Hall pal={pal} floor={floor} night={night} signs={signs} tall={hotel.tall} />
          <HallDecor decor={hotel.decor} pal={pal} night={night} tall={hotel.tall} />
          <Room pal={pal} />
          <Deck pal={pal} night={night} color={hotel.deck} garden={hotel.view === 'jardin'} />
          <Beyond view={hotel.view} night={night} />
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
          <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!!roam && !interactionId} onMoved={onMoved} free={free} entrance={ENTRANCE} working={interactionId === 'work'} look={interactionId === 'work' ? workLook(sim.look, sim.career ?? '', sim.careerLevel) : undefined}>
            <ActionProps id={interactionId} kind="hotel" lying={!!spot?.lying} />
          </Guest>
          {/* What's done here, over where it's done (SpotActions): tap one, the Sim goes */}
          <SpotActions shown={!!roam && !interactionId} where={spotWhere(SPOTS)} entrance={[ENTRANCE[0], 0, ENTRANCE[1]]} />
          <OrbitControls makeDefault target={[0, 1, -4]} enablePan={false} minDistance={6} maxDistance={70} minPolarAngle={0.25} maxPolarAngle={1.25} enableDamping />
        </Suspense>
      </Canvas>
    </div>
  )
}

/* ---------- The hall: the reception, the lifts, the lounge, the restaurant, the bar ---------- */

type Signs = { hotel: THREE.Material; resto: THREE.Material; bar: THREE.Material; spa: THREE.Material; rooms: THREE.Material; lifts: THREE.Material }

function Hall({ pal, floor, night, signs, tall }: { pal: Palette; floor: THREE.Texture; night: boolean; signs: Signs; /** A triple-height atrium. */ tall: boolean }) {
  const H = tall ? 14 : 7
  const parts = useMemo(() => {
    const walls: Block[] = []
    const brass: Block[] = []
    const wood: Block[] = []
    const fabric: Block[] = []
    // The side walls; the front wall cut low, the revolving doors in its middle.
    walls.push({ p: [-HW, H / 2, 0], s: [0.5, H, HD * 2] }, { p: [HW, H / 2, 0], s: [0.5, H, HD * 2] })
    walls.push({ p: [-(HW + 4) / 2, 0.6, HD], s: [HW - 4, 1.2, 0.5] }, { p: [(HW + 4) / 2, 0.6, HD], s: [HW - 4, 1.2, 0.5] })
    // The pillars, brass at foot and head.
    for (const x of [-6, 6])
      for (const z of [4, -2]) {
        walls.push({ p: [x, H / 2, z], s: [1.1, H, 1.1] })
        brass.push({ p: [x, 0.2, z], s: [1.3, 0.4, 1.3] }, { p: [x, H - 0.3, z], s: [1.3, 0.3, 1.3] })
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
  }, [pal, H])
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
        <mesh key={s} position={[s * 12.5, H / 2, -HD]}>
          <boxGeometry args={[19, H, 0.15]} />
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

function Deck({ pal, night, color, garden }: { pal: Palette; night: boolean; color: string; /** A lawn round the pool, its flower beds and a paved path (else a paved deck). */ garden: boolean }) {
  const water = useRef<THREE.MeshLambertMaterial>(null)
  useFrame(() => {
    water.current?.color.setHSL(0.53, 0.7, 0.5 + Math.sin(worldTime() * 1.3) * 0.03)
  })
  const loungers = useMemo(() => [-14, -11, -8, 8, 11, 14].flatMap((x) => [-20.5, -31.5].map((z) => [x, z] as XZ)), [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (DECK - HD) / 2]} receiveShadow>
        <planeGeometry args={[HW * 2, -HD - DECK]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {garden && (
        <>
          {/* The paved way from the doors to the pool and round it, the beds of flowers */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -19]} receiveShadow>
            <planeGeometry args={[3, 6]} />
            <meshLambertMaterial color="#d8c2a2" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -26]} receiveShadow>
            <planeGeometry args={[22, 11]} />
            <meshLambertMaterial color="#d8c2a2" />
          </mesh>
          <Blocks at={[[-17, -19], [17, -19], [-17, -33], [17, -33], [-6, -32.6], [6, -32.6]].map(([x, z], i) => ({ p: [x, 0.25, z] as [number, number, number], s: [3, 0.5, 1.4] as [number, number, number], c: ['#d6336c', '#f2c94c', '#e8432f', '#ffffff', '#d6336c', '#f2c94c'][i] }))} material={colored} color />
        </>
      )}
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

/* ---------- What makes each hall its own ---------- */

/** A woven cloth hanging in the atrium: bands and blocks of colour, after the kente and the Baoulé pagnes. */
function cloth(colors: string[], seed: number) {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 128
  const g = c.getContext('2d')!
  const r = rng(`cloth${seed}`)
  for (let y = 0; y < 128; y += 8)
    for (let x = 0; x < 32; x += 8) {
      g.fillStyle = colors[Math.floor(r() * colors.length)]
      g.fillRect(x, y, 8, 8)
    }
  for (let y = 0; y < 128; y += 16) {
    g.fillStyle = colors[0]
    g.fillRect(0, y, 32, 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide })
}

/** A painter's canvas: a few strong shapes on a ground. */
function canvasArt(seed: number) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const r = rng(`art${seed}`)
  const pick = () => ['#c2552e', '#f2c94c', '#1f6f78', '#2b1d14', '#e8d6a8', '#7a1f2b', '#3a8f4a'][Math.floor(r() * 7)]
  g.fillStyle = pick()
  g.fillRect(0, 0, 64, 64)
  for (let i = 0; i < 6; i++) {
    g.fillStyle = pick()
    if (r() < 0.5) g.fillRect(r() * 48, r() * 48, 8 + r() * 24, 8 + r() * 24)
    else {
      g.beginPath()
      g.arc(r() * 64, r() * 64, 4 + r() * 14, 0, Math.PI * 2)
      g.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshLambertMaterial({ map: t })
}

function HallDecor({ decor, pal, night, tall }: { decor: Decor; pal: Palette; night: boolean; tall: boolean }) {
  const banners = useMemo(() => (decor === 'textiles' ? [0, 1, 2, 3, 4, 5].map((i) => cloth(i % 2 ? ['#d4af37', '#7a1f2b', '#111014', '#e8d6a8'] : ['#2f6b3a', '#d4af37', '#c2552e', '#111014'], i)) : []), [decor])
  const paintings = useMemo(() => (decor === 'banco' ? [0, 1, 2, 3, 4, 5].map((i) => canvasArt(i)) : []), [decor])
  if (decor === 'boiseries')
    // Wood panels up the side walls and club armchairs in leather by them.
    return (
      <group>
        <Blocks at={[-1, 1].flatMap((side) => [...Array(10)].map((_, i) => ({ p: [side * (HW - 0.32), 2.2, -12 + i * 2.9] as [number, number, number], s: [0.12, 4.2, 2.6] as [number, number, number] })))} material={mat(pal.wood)} />
        <Blocks at={[-1, 1].map((side) => ({ p: [side * (HW - 0.3), 4.4, 1] as [number, number, number], s: [0.14, 0.12, 29] as [number, number, number] }))} material={mat(pal.brass)} />
        <Blocks at={[[-19.6, 12], [-19.6, 9.6], [-17.2, 12]].map(([x, z]) => ({ p: [x, 0.42, z] as [number, number, number], s: [1.3, 0.84, 1.3] as [number, number, number] }))} material={mat('#5a3a24')} />
      </group>
    )
  if (decor === 'textiles')
    // The atrium three floors high: the woven cloths hanging from the roof, the galleries of the floors above.
    return (
      <group>
        {banners.map((m, i) => (
          // High along both walls of the atrium, turned to the hall: from the doors they frame it, not hide it.
          <mesh key={i} position={[(i % 2 ? 1 : -1) * (HW - 2.2), 10, 10 - Math.floor(i / 2) * 7]} rotation={[0, (i % 2 ? -1 : 1) * Math.PI / 2, 0]} material={m}>
            <planeGeometry args={[2.4, 6.5]} />
          </mesh>
        ))}
        {tall && <Blocks at={[7, 10.5].flatMap((y) => [-1, 1].map((side) => ({ p: [side * (HW - 1.4), y, 2] as [number, number, number], s: [2.6, 0.25, HD * 2 - 6] as [number, number, number] })))} material={mat(pal.brass, night ? '#4a3a10' : undefined)} />}
        <pointLight position={[0, 12, 6]} intensity={night ? 40 : 15} distance={30} color="#ffd9a0" />
      </group>
    )
  if (decor === 'banco')
    // Banco walls (earth bricks, a little uneven), the geometric frieze, the local painters' canvases.
    return (
      <group>
        <Blocks
          at={[-1, 1].flatMap((side) => [...Array(5)].flatMap((_, row) => [...Array(14)].map((_, i) => ({ p: [side * (HW - 0.3), 0.6 + row * 1.2, -13 + i * 2.2 + (row % 2) * 1.1] as [number, number, number], s: [0.1, 1.1, 2.1] as [number, number, number], c: ['#c98b5a', '#b9774a', '#d29a68'][(i + row) % 3] }))))}
          material={colored}
          color
        />
        {/* The frieze of triangles along the top of the walls */}
        <Blocks at={[-1, 1].flatMap((side) => [...Array(28)].map((_, i) => ({ p: [side * (HW - 0.36), 6.3 - (i % 2) * 0.25, -14 + i * 1.08] as [number, number, number], s: [0.06, 0.5, 0.5] as [number, number, number], ry: Math.PI / 4, c: i % 2 ? '#2b1d14' : '#e8d6a8' })))} material={colored} color />
        {paintings.map((m, i) => (
          <group key={i} position={[(i < 3 ? -1 : 1) * (HW - 0.38), 3, -9 + (i % 3) * 8]} rotation={[0, i < 3 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <mesh geometry={BOX} position={[0, 0, -0.02]} scale={[2.6, 2, 0.06]} material={mat('#2b1d14')} />
            <mesh position={[0, 0, 0.02]} material={m}>
              <planeGeometry args={[2.3, 1.7]} />
            </mesh>
          </group>
        ))}
      </group>
    )
  if (decor === 'bleu')
    // The airport hotel: blue light along the walls and the desk, the departures board by the reception.
    return (
      <group>
        <Blocks at={[-1, 1].map((side) => ({ p: [side * (HW - 0.3), 5.6, 0] as [number, number, number], s: [0.08, 0.12, HD * 2] as [number, number, number] }))} material={mat('#3a7bff', '#2a5bd0')} />
        <Blocks at={[{ p: [0, 0.25, 7.22], s: [9, 0.08, 0.04] }]} material={mat('#3a7bff', '#2a5bd0')} />
        <group position={[7.5, 2.6, 6.8]}>
          <mesh geometry={BOX} scale={[3.6, 2, 0.12]} material={mat('#111827')} />
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[0, 0.7 - i * 0.35, 0.07]}>
              <planeGeometry args={[3.2, 0.18]} />
              <meshBasicMaterial color={i === 0 ? '#ffd54f' : '#9fd3ff'} />
            </mesh>
          ))}
        </group>
      </group>
    )
  return null
}

/* ---------- Beyond the pool: what each hotel looks out on ---------- */

function Beyond({ view, night }: { view: View; night: boolean }) {
  const towers = useMemo(() => {
    const r = rng(`hotel-vue|${view}`)
    return [...Array(18)].map((_, i) => ({ x: -110 + i * 13 + r() * 5, z: r() * 30, h: 18 + r() * 55, w: 6 + r() * 7 }))
  }, [view])
  const lit = (i: number) => (night ? (i % 3 ? '#3a3010' : '#2a3550') : undefined)
  if (view === 'lagune')
    // The Ébrié lagoon below the terrace, the bay of Cocody and its towers across the water.
    return (
      <group>
        <Blocks at={[{ p: [0, 0.5, DECK - 0.3], s: [HW * 2, 1, 0.3] }]} material={mat('#f3f1ec')} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, DECK - 160]}>
          <planeGeometry args={[600, 320]} />
          <meshLambertMaterial color={night ? '#0e2a3a' : '#3c7c8a'} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, DECK - 330]}>
          <planeGeometry args={[600, 40]} />
          <meshLambertMaterial color="#4f8f3c" />
        </mesh>
        {towers.map((t, i) => (
          <mesh key={i} geometry={BOX} position={[t.x * 2, t.h / 2, DECK - 320 - t.z]} scale={[t.w * 2, t.h, t.w * 2]} material={mat(night ? '#1b2238' : '#c9ccd2', lit(i))} />
        ))}
      </group>
    )
  if (view === 'ville')
    // The pool deck on the 7th floor: glass all round, the city far below, the lagoon past the towers.
    return (
      <group>
        {([[0, DECK, HW * 2, 0.12], [-HW, (DECK - HD) / 2, 0.12, -HD - DECK], [HW, (DECK - HD) / 2, 0.12, -HD - DECK]] as const).map(([x, z, w, d], i) => (
          <mesh key={i} position={[x, 0.6, z]}>
            <boxGeometry args={[w, 1.2, d]} />
            <meshLambertMaterial color="#bfe3f2" transparent opacity={0.35} />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -26, -60]}>
          <planeGeometry args={[500, 400]} />
          <meshLambertMaterial color={night ? '#1a1c22' : '#8a8f96'} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -25.8, -260]}>
          <planeGeometry args={[600, 200]} />
          <meshLambertMaterial color={night ? '#0e2a3a' : '#3c7c8a'} />
        </mesh>
        {towers.map((t, i) => (
          <mesh key={i} geometry={BOX} position={[t.x, -26 + t.h / 2, DECK - 40 - t.z * 2]} scale={[t.w, t.h, t.w]} material={mat(night ? '#1b2238' : ['#c9ccd2', '#9aa3ad', '#dfe3e8'][i % 3], lit(i))} />
        ))}
        {towers.slice(0, 8).map((t, i) => (
          <mesh key={`s${i}`} geometry={BOX} position={[(i < 4 ? -1 : 1) * (HW + 20 + (i % 4) * 14), -26 + t.h / 2, -10 - (i % 4) * 18]} scale={[t.w, t.h, t.w]} material={mat(night ? '#1b2238' : '#b8bec6', lit(i))} />
        ))}
      </group>
    )
  if (view === 'aeroport')
    // Past the fence, the airport: the apron, the runway, the tower, a plane taking off now and then.
    return <Airport night={night} />
  // The garden: lawn, palms and hedges, the low houses of the quarter beyond.
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, DECK - 30]} receiveShadow>
        <planeGeometry args={[220, 60]} />
        <meshLambertMaterial color="#4f8f3c" />
      </mesh>
      <Blocks at={[{ p: [0, 0.6, DECK - 0.4], s: [HW * 2, 1.2, 0.8] }]} material={mat('#2f7a34')} />
      {[...Array(10)].map((_, i) => (
        <group key={i} position={[-40 + i * 9, 0, DECK - 8 - (i % 3) * 5]}>
          <mesh geometry={BOX} position={[0, 3, 0]} scale={[0.5, 6, 0.5]} material={mat('#7a5a3a')} />
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} geometry={BOX} position={[Math.cos((k * Math.PI) / 2) * 1.2, 6, Math.sin((k * Math.PI) / 2) * 1.2]} scale={[k % 2 ? 0.6 : 2.6, 0.2, k % 2 ? 2.6 : 0.6]} material={mat('#2f8f3a')} />
          ))}
        </group>
      ))}
      {towers.slice(0, 12).map((t, i) => (
        <mesh key={i} geometry={BOX} position={[t.x * 1.4, 3 + (i % 3), DECK - 70 - t.z]} scale={[t.w * 1.4, 6 + (i % 3) * 2, t.w * 1.2]} material={mat(['#e8d6b8', '#d9c2a0', '#f1e4d2'][i % 3])} />
      ))}
    </group>
  )
}

function Airport({ night }: { night: boolean }) {
  const plane = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = plane.current
    if (!g) return
    // Down the runway, then up and away; one every 45 s.
    const k = (worldTime() % 45) / 45
    const x = -220 + k * 520
    g.position.set(x, x > 0 ? x * 0.18 : 0.8, DECK - 90)
    g.rotation.set(0, 0, x > 0 ? 0.18 : 0)
  })
  return (
    <group>
      {/* The fence, the apron and the runway with its marks */}
      <Blocks at={[{ p: [0, 1, DECK - 1], s: [HW * 2 + 20, 2, 0.1] }]} material={mat('#9aa3ad')} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, DECK - 80]}>
        <planeGeometry args={[600, 120]} />
        <meshLambertMaterial color="#7d8288" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, DECK - 90]}>
        <planeGeometry args={[560, 14]} />
        <meshLambertMaterial color="#4a4d52" />
      </mesh>
      {[...Array(28)].map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-270 + i * 20, 0.03, DECK - 90]}>
          <planeGeometry args={[8, 0.6]} />
          <meshBasicMaterial color="#f4f4f4" />
        </mesh>
      ))}
      {/* The control tower and the terminal */}
      <mesh geometry={BOX} position={[60, 14, DECK - 120]} scale={[4, 28, 4]} material={mat('#e8eaed')} />
      <mesh geometry={BOX} position={[60, 29, DECK - 120]} scale={[8, 4, 8]} material={mat('#26303d', night ? '#3a5a8a' : undefined)} />
      <mesh geometry={BOX} position={[-40, 6, DECK - 130]} scale={[90, 12, 20]} material={mat('#dfe3e8')} />
      {/* The plane: fuselage, wings, tail */}
      <group ref={plane}>
        <mesh geometry={BOX} scale={[30, 3.6, 3.6]} material={mat('#f4f6f8')} />
        <mesh geometry={BOX} position={[-2, -0.4, 0]} scale={[7, 0.5, 30]} material={mat('#f4f6f8')} />
        <mesh geometry={BOX} position={[-13.5, 3.6, 0]} scale={[3.6, 5, 0.5]} material={mat('#1c4fa0')} />
        <mesh geometry={BOX} position={[-13.5, 0.6, 0]} scale={[3, 0.4, 10]} material={mat('#f4f6f8')} />
        <mesh geometry={BOX} position={[14.5, 0.4, 0]} scale={[1.2, 2.4, 3]} material={mat('#26303d')} />
      </group>
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
      return { gender, look: randomLook(gender, r), x: -3 + i * 2, z0: 9.4, z1: HD - 2, speed: 1 + r() * 0.4, phase: r() * 30 }
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
          <TalkHuman id={`hotel-${placeId}-${i}`} look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
        </group>
      ))}
      {walkers.map((w, i) => (
        <group key={`w${i}`} ref={(g) => { wr.current[i] = g }}>
          <TalkHuman id={`hotel-${placeId}-w${i}`} look={w.look} gender={w.gender} pose="walk" speed={w.speed} seed={i * 7 + 0.5} />
        </group>
      ))}
      {night && <pointLight position={[0, 4, 4]} intensity={10} distance={16} color="#ffe2b0" />}
    </NoShadows>
  )
}
