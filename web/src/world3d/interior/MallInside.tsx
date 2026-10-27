import { SpotActions } from '../SpotActions'
import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook, workLook } from '../../avatar/options'
import { rng } from '../themes'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { Vehicle } from '../vehicles'
import { BOX, Blocks } from '../open/ruePrincesse'
import { TalkHuman } from '../Talkable'
import { ActionProps } from './ActionProps'
import { Guest, mat, sign, useBigWalk, type Spot, type XZ, spotWhere } from './bigPlace'

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
/** The clothes rails in the wax shop (back row, first shop), along its side walls. */
const RAILS = [-7.6, -2.4]

const SPOTS: Record<string, Spot> = {
  supermarche: { at: [-28, -8], rot: Math.PI / 2, pose: 'busy', from: [-28, 4.5] },
  'leche-vitrine': { at: [12, 0], rot: 0, pose: 'walk', from: [12, 6], loop: { c: [12, 0], r: [16, 4.5], speed: 0.08 } },
  vetements: { at: [-5, -14.9], rot: Math.PI, pose: 'busy', from: [-5, -9.5] },
  // Between the rails of the wax shop, looking at the pieces (the shop's sheet: components/ClothesShop).
  'boutique-mode': { at: [-5, -12], rot: Math.PI, pose: 'walk', from: [-5, -9.5], loop: { c: [-5, -12], r: [1.7, 1.4], speed: 0.12 } },
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
  // The clothes rails of the wax shop.
  for (const x of RAILS) out.push([x, -12, 0.3, 1.6])
  // The supermarket's bakery counter along its left wall.
  out.push([-37.2, -6, 0.5, 4])
  // The outer walls of the gallery, with the doors.
  out.push([HW, 0, 0.2, HD], [-HW, 0, 0.2, HD], [-17, HD, 21, 0.2], [29, HD, 9, 0.2])
  return out
})()

/** Marcory's car on show, on its podium by the supermarket's wall. */
const SHOW_CAR: [number, number, number, number] = [-10, 0, 1.3, 2.6]

/** Where one can walk in a centre of this look (Marcory's car is in the way there). */
function freeOf(style?: MallLayout['style']) {
  if (style === 'palmeraie') return (x: number, z: number) => free(x, z) && !onPalm(x, z, PALMS(style))
  if (style !== 'marcory') return free
  const [cx, cz, hw, hd] = SHOW_CAR
  return (x: number, z: number) => free(x, z) && !(Math.abs(x - cx) < hw + 0.3 && Math.abs(z - cz) < hd + 0.3)
}

/** On one of the palms in their pots along the gallery. */
const onPalm = (x: number, z: number, xs: number[]) => xs.some((px) => Math.abs(x - px) < 0.75) && Math.abs(Math.abs(z) - 6.5) < 0.75

function free(x: number, z: number) {
  if (onPalm(x, z, PALMS())) return false
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

/**
 * What a centre is made of when it isn't the default: its supermarket's name,
 * its shops, its cinema in the gallery (a Kinéo, game/cinema.go), and the
 * look of a PlaYce as the photos show it: Marcory's hypermarket under its
 * ducts with magenta and yellow columns, its gallery under a white ring of
 * spotlights and coloured skylights, a car on show, the food court's bar and
 * its giant screen; Palmeraie's hypermarket under light wood trusses with red
 * columns, its bright gallery of palms.
 */
export type MallLayout = { market?: string; back?: string[]; front?: string[]; kineo?: boolean; style?: 'marcory' | 'palmeraie' }

/** At work there: at the first till, or behind the first shop's counter (its cashier's or its seller's place). */
const WORK: Record<string, Spot> = {
  caisse: { at: [TILLS[0] - 0.9, 8], rot: Math.PI / 2, pose: 'busy', from: [TILLS[0] - 0.9, 10.2] },
  vente: { at: [BACK[0] + 0.6, -13.2], rot: 0, pose: 'busy', from: [BACK[0] + 0.6, -9.5] },
}

export function MallInside({ sim, name, interactionId, roam, night, stage, layout, view }: { sim: Sim; /** The centre's name, over the doors. */ name: string; interactionId?: string; /** Just come in: walk about (tap the floor, or the keys). */ roam?: boolean; night: boolean; stage: string; layout?: MallLayout; /** Where the camera starts and looks (the lab). */ view?: { cam: [number, number, number]; look: [number, number, number] } }) {
  const working = interactionId === 'work' ? (sim.career ?? '') : ''
  const spot = interactionId ? ((working ? WORK[working] : SPOTS[interactionId]) ?? null) : null
  const walkable = useMemo(() => freeOf(layout?.style), [layout?.style])
  const { way, tap, onMoved } = useBigWalk(spot, interactionId, roam, walkable, ENTRANCE)
  const floor = useMemo(() => tiles(), [])
  const signs = useMemo(
    () => ({
      mall: sign(name.toUpperCase(), '#1f2a44', '#ffffff', 1024, 160),
      market: sign(layout?.market ?? 'BABI MARKET', '#c8102e', '#ffffff', 1024, 160),
      food: sign('FOOD COURT', '#ff8200', '#ffffff', 512, 128),
    }),
    [name, layout?.market],
  )
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: view?.cam ?? [12, 22, HD + 26], fov: 45, near: 0.3, far: 900 }} style={{ background: night ? '#0b1026' : '#9ccbea' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={[night ? '#9aa8e0' : '#ffffff', '#c9b48c', night ? 0.9 : 1.25]} />
          <directionalLight position={[30, 50, 25]} intensity={night ? 0.25 : 1.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-50} shadow-camera-right={50} shadow-camera-top={50} shadow-camera-bottom={-50} />
          <pointLight position={[12, 9, 0]} intensity={night ? 70 : 25} distance={50} color="#fff2d8" />
          <pointLight position={[-24, 8, -6]} intensity={night ? 60 : 20} distance={40} color="#ffffff" />
          <Building floor={floor} night={night} signs={signs} />
          <Supermarket night={night} style={layout?.style} />
          <Shops night={night} layout={layout} />
          <Atrium style={layout?.style} />
          {layout?.style === 'marcory' && <MarcoryGallery night={night} />}
          {layout?.style === 'palmeraie' && <PalmeraieGallery night={night} />}
          <Outside night={night} />
          <People working={working} />
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
          <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!!roam && !interactionId} onMoved={onMoved} free={walkable} entrance={ENTRANCE} working={!!working} look={working ? workLook(sim.look, working, sim.careerLevel) : undefined}>
            <ActionProps id={interactionId} kind="mall" lying={!!spot?.lying} />
          </Guest>
          {interactionId === 'supermarche' && <Trolley at={[-27.2, -9.2]} />}
          {/* What's done here, over where it's done (SpotActions): tap one, the Sim goes */}
          <SpotActions shown={!!roam && !interactionId} where={(id) => (id === 'work' ? spotWhere(WORK)(sim.career ?? '') : spotWhere(SPOTS)(id))} entrance={[ENTRANCE[0], 0, ENTRANCE[1]]} />
          <OrbitControls makeDefault target={view?.look ?? [12, 1, HD - 6]} enablePan={false} minDistance={6} maxDistance={80} minPolarAngle={0.25} maxPolarAngle={1.25} enableDamping />
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

function Supermarket({ night, style }: { night: boolean; style?: MallLayout['style'] }) {
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
      <Bakery />
      {style === 'marcory' && <Ducts />}
      {style === 'palmeraie' && <Trusses />}
      {/* The columns rising out of the shelves: magenta and yellow at Marcory, red with their wood at Palmeraie */}
      {style && (
        <Blocks
          at={SHELVES.filter((_, i) => i % 2 === 0).flatMap((x, i) =>
            [-15, -4].flatMap((z, j): Block[] =>
              style === 'marcory'
                ? [{ p: [x, 3.6, z], s: [0.8, 7.2, 0.8], c: (i + j) % 2 ? '#f2c230' : '#c2185b' }]
                : [{ p: [x, 3.6, z], s: [0.85, 7.2, 0.85], c: '#c92a2a' }, { p: [x, 3.6, z], s: [0.5, 2.6, 0.9], c: '#c08a4a' }],
            ),
          )}
          material={mat('#ffffff')}
          color
        />
      )}
    </group>
  )
}

/** The bakery: its glass counter of croissants and pains au chocolat, the bread on the shelf behind, the baker. */
function Bakery() {
  const pastries = useMemo<Block[]>(() => {
    const out: Block[] = []
    for (let i = 0; i < 14; i++) out.push({ p: [-37.05 + (i % 2) * 0.35, 1.02, -9.5 + Math.floor(i / 2) * 1], s: [0.22, 0.08, 0.14], c: i % 3 ? '#d9a35a' : '#8a5a2a' })
    return out
  }, [])
  return (
    <group>
      <Blocks at={[{ p: [-37.2, 0.45, -6], s: [1, 0.9, 8], c: '#f3f1ec' }, { p: [-37.2, 0.95, -6], s: [1, 0.05, 8], c: '#c9a227' }, { p: [-37.85, 1.6, -6], s: [0.3, 1.2, 8], c: '#8a5a32' }]} material={mat('#ffffff')} color />
      <mesh position={[-36.75, 1.25, -6]}>
        <boxGeometry args={[0.06, 0.6, 8]} />
        <meshLambertMaterial color="#d8eef6" transparent opacity={0.35} />
      </mesh>
      <Blocks at={pastries} material={mat('#ffffff')} color />
      {/* The baguettes standing in their baskets on the shelf */}
      <Blocks at={[...Array(12)].map((_, i): Block => ({ p: [-37.8, 2.3, -9.5 + i * 0.65], s: [0.08, 0.7, 0.08], c: '#d9a35a' }))} material={mat('#ffffff')} color />
    </group>
  )
}

/** Marcory's hypermarket roof: silver ducts and the trays of the lights, running the length of the aisles. */
function Ducts() {
  const parts = useMemo<Block[]>(() => {
    const out: Block[] = []
    for (const z of [-17, -9, -1, 7]) out.push({ p: [-24.5, 6.4, z], s: [23, 0.12, 0.5], c: '#dfe3e8' })
    for (const x of [-35, -27, -19]) out.push({ p: [x, 6.6, -6], s: [0.12, 0.12, 30], c: '#9aa1a8' })
    return out
  }, [])
  return (
    <group>
      {[-14, -2].map((z) => (
        <mesh key={z} position={[-24.5, 6.9, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.45, 0.45, 23, 14]} />
          <meshLambertMaterial color="#c9ced4" />
        </mesh>
      ))}
      <Blocks at={parts} material={mat('#ffffff')} color />
    </group>
  )
}

/** Palmeraie's new hypermarket roof: light glued-wood trusses over white panels. */
function Trusses() {
  const parts = useMemo<Block[]>(() => {
    const out: Block[] = []
    for (const z of [-20, -14, -8, -2, 4, 10]) {
      // Each truss: its two chords, the posts between them.
      out.push({ p: [-24.5, 6.6, z], s: [25, 0.35, 0.35], c: '#d9b07a' }, { p: [-24.5, 7.8, z], s: [25, 0.3, 0.3], c: '#d9b07a' })
      for (let x = -36; x <= -13; x += 2.9) out.push({ p: [x, 7.2, z], s: [0.22, 1.2, 0.25], c: '#c99d66' })
    }
    for (const x of [-34, -24.5, -15]) out.push({ p: [x, 7.5, -5], s: [0.3, 0.3, 32], c: '#c99d66' })
    return out
  }, [])
  return (
    <group>
      <Blocks at={parts} material={mat('#ffffff')} color />
      {/* The red rail along the walls, as round the new hypermarket */}
      <Blocks at={[{ p: [-37.75, 3.2, -6], s: [0.15, 0.25, 34], c: '#c92a2a' }, { p: [-24.5, 3.2, -23.75], s: [26, 0.25, 0.15], c: '#c92a2a' }]} material={mat('#ffffff')} color />
    </group>
  )
}

/* ---------- The shops round the gallery ---------- */

const SHOP_COLORS = { back: ['#f3e0e3', '#e8e8e8', '#e3eef7', '#e6f4ea', '#ece6f3'], front: ['#f3ebe0', '#fbe4ee', '#fbe9dc', '#e0f3f1'] }

/** The front row's shop that is the cinema, when the centre has one. */
const KINEO_AT = 2

function Shops({ night, layout }: { night: boolean; layout?: MallLayout }) {
  const signs = useMemo(
    () => ({
      back: (layout?.back ?? ['MODE WAX', 'BABI SNEAKERS', 'PHONE 225', 'PHARMACIE DU MALL', 'BIJOUX D’ÉBÈNE']).map((t, i) => sign(t, ['#7a1f2b', '#111111', '#1f5f8b', '#0f7a3a', '#3d2b5a'][i], '#ffffff', 512, 96)),
      front: (layout?.front ?? ['LIBRAIRIE', 'BEAUTÉ & CO', 'BURGER 225', 'GLACIER COCO']).map((t, i) => (layout?.kineo && i === KINEO_AT ? sign('KINÉO', '#c8102e', '#ffffff', 512, 96) : sign(t, ['#5a3a1a', '#d6336c', '#b5432c', '#2a9d8f'][i], '#ffffff', 512, 96))),
    }),
    [layout],
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
        const cinema = layout?.kineo && k === 'front' && i === KINEO_AT
        walls.push({ p: [x, 2, back], s: [SHOP_W, 4, 0.3], c: cinema ? '#7a1020' : SHOP_COLORS[k][i] })
        if (cinema) {
          // The cinema: this week's posters in its windows, the doors to the screens at the back, no counter of goods.
          for (const dx of [-SHOP_W / 2 + 1, SHOP_W / 2 - 1]) inside.push({ p: [x + dx, 1.3, front + 0.12], s: [1.4, 1.9, 0.05], c: dx < 0 ? '#ff7a00' : '#d6336c' })
          inside.push({ p: [x, 1.2, back - 0.2], s: [2.4, 2.4, 0.1], c: '#2b2230' })
          walls.push({ p: [x, 3.4, front], s: [SHOP_W, 1.2, 0.3], c: '#2b2f3a' })
          return
        }
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
        // The wax shop: two clothes rails along its sides, the pieces hanging on them (bought from the shop's sheet).
        if (k === 'back' && i === 0)
          for (const rx of RAILS) {
            for (const dz of [-1.5, 1.5]) inside.push({ p: [rx, 0.8, -12 + dz], s: [0.06, 1.6, 0.06], c: '#9aa1a8' })
            inside.push({ p: [rx, 1.6, -12], s: [0.05, 0.05, 3.1], c: '#9aa1a8' })
            for (let h = 0; h < 9; h++) inside.push({ p: [rx, 1.12, -13.3 + h * 0.33], s: [0.5, 0.86, 0.07], c: ['#ff7a00', '#1f4fd1', '#2f9e44', '#c92a2a', '#f2c94c', '#7b5cff', '#141416', '#e64980', '#6b4423'][Math.floor(r() * 9)] })
          }
      })
    }
    return { walls, inside }
  }, [layout])
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

function Atrium({ style }: { style?: MallLayout['style'] }) {
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
    for (const x of PALMS(style)) for (const z of [-6.5, 6.5]) out.push({ p: [x, 0.4, z], s: [0.9, 0.8, 0.9], c: style === 'palmeraie' ? '#c08a4a' : '#8a5a32' })
    // The food court's tables in wood at Palmeraie.
    if (style === 'palmeraie') for (const o of out) if (o.c === '#ffffff' && Math.abs(o.s[1] - 0.08) < 0.01) o.c = '#d9b07a'
    return out
  }, [style])
  return (
    <group>
      <Blocks at={parts} material={mat('#ffffff')} color />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, 0.62, 0]}>
        <planeGeometry args={[4.6, 4.6]} />
        <meshLambertMaterial ref={water} color="#58c4dc" />
      </mesh>
      <mesh geometry={BOX} position={[12, 1.2, 0]} scale={[0.5, 1.6, 0.5]} material={mat('#d8d0c0')} />
      {PALMS(style).flatMap((x) =>
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

/** Where the palms stand along the gallery: more of them at the Palmeraie. */
// Between the shops' doors, never in front of one.
const PALMS = (style?: MallLayout['style']) => (style === 'palmeraie' ? [-9.5, -1.25, 6.25, 13.75, 21.25, 28.75] : [-1.25, 6.25, 21.25, 28.75])

/* ---------- PlaYce Marcory's gallery ---------- */

/**
 * Over the atrium the white ring of the ceiling, its spotlights hanging on
 * their wires, the skylights of colour inside it; a car on show on its
 * podium; the food court's bar and its giant screen (a match on).
 */
function MarcoryGallery({ night }: { night: boolean }) {
  const screen = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => {
    const t = worldTime()
    // The match: the green of the pitch, a flash of the crowd now and then.
    screen.current?.color.setHSL(Math.floor(t / 4) % 5 === 0 ? 0.08 : 0.33, 0.55, 0.32 + Math.sin(t * 6) * 0.03)
  })
  const ring = useMemo(() => {
    const out: Block[] = []
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2
      out.push({ p: [12 + Math.cos(a) * 10, 6.4, Math.sin(a) * 6.5], s: [2.4, 1, 0.6], ry: -a + Math.PI / 2, c: '#f8f9fa' })
    }
    return out
  }, [])
  const spots = useMemo(() => [...Array(14)].map((_, i) => [12 + Math.cos(i * 2.4) * (2 + (i % 4) * 2), Math.sin(i * 2.4) * (1.5 + (i % 4) * 1.2)] as XZ), [])
  return (
    <group>
      <Blocks at={ring} material={mat('#ffffff')} color />
      {/* The skylights of colour, seen through */}
      {[['#3ba7ff', 8, -1.5], ['#ff8a3d', 14, 1.5], ['#f06595', 16, -2.5]].map(([c, x, z]) => (
        <mesh key={c as string} rotation={[-Math.PI / 2, 0, 0.4]} position={[x as number, 7.4, z as number]}>
          <planeGeometry args={[5, 2.4]} />
          <meshBasicMaterial color={c as string} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {spots.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={BOX} position={[0, 6.4, 0]} scale={[0.02, 1.4, 0.02]} material={mat('#2b2f3a')} />
          <mesh geometry={BOX} position={[0, 5.6, 0]} scale={[0.22, 0.22, 0.22]} material={mat('#ffffff', night ? '#fff2c0' : '#a8a08a')} />
        </group>
      ))}
      {/* The car on show, on its podium, the ropes round it */}
      <mesh geometry={BOX} position={[-10, 0.1, 0]} scale={[2.6, 0.2, 5.2]} material={mat('#2b2f3a')} />
      <Vehicle p={[-10, 0.2, 0]} r={0} kind="car" seed={31} color="#1b1d22" />
      <Blocks at={[...[-1, 1].flatMap((sx) => [-1, 1].map((sz): Block => ({ p: [-10 + sx * 1.6, 0.5, sz * 2.9], s: [0.08, 1, 0.08], c: '#c9a227' }))), { p: [-8.4, 0.9, 0], s: [0.03, 0.03, 5.8], c: '#c92a2a' }]} material={mat('#ffffff')} color />
      {/* The food court's bar, its giant screen on the wall */}
      <mesh geometry={BOX} position={[36.6, 0.55, 3]} scale={[1.2, 1.1, 6]} material={mat('#2b2230')} />
      <mesh geometry={BOX} position={[37.75, 4.4, 0]} scale={[0.2, 3.4, 6]} material={mat('#111111')} />
      <mesh position={[37.6, 4.4, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[5.6, 3]} />
        <meshBasicMaterial ref={screen} color="#2f8f3a" />
      </mesh>
    </group>
  )
}

/* ---------- PlaYce Palmeraie's gallery ---------- */

/** Bright and natural: the light wood slats across the atrium's roof, green hanging over the food court. */
function PalmeraieGallery({ night }: { night: boolean }) {
  const slats = useMemo<Block[]>(() => {
    const out: Block[] = []
    for (let x = -10; x <= 36; x += 2.4) out.push({ p: [x, 7.2, 0], s: [0.25, 0.3, 15], c: '#d9b07a' })
    // The planters over the food court's counter, their green spilling down.
    for (const x of [24, 28, 32]) out.push({ p: [x, 5.6, -6.8], s: [2.4, 0.4, 0.6], c: '#c08a4a' }, { p: [x, 5.1, -6.6], s: [2.2, 0.8, 0.3], c: '#2f7a35' })
    return out
  }, [])
  return (
    <group>
      <Blocks at={slats} material={mat('#ffffff')} color />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[13, 0.03, 0]}>
        <planeGeometry args={[46, 14]} />
        <meshBasicMaterial color={night ? '#ffe6b0' : '#fffaf0'} transparent opacity={night ? 0.1 : 0.28} depthWrite={false} />
      </mesh>
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

/** working: the Sim's job there (its till's cashier, its shop's seller stand aside). */
function People({ working }: { working: string }) {
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
      ...TILLS.slice(working === 'caisse' ? 1 : 0).map((x) => one([x - 0.9, 0, 8], Math.PI / 2, 'busy')),
      one([-33, 0, 9.6], Math.PI, 'phone'), one([-23, 0, 9.6], Math.PI, 'idle'),
      one([-32, 0, -4], -Math.PI / 2, 'busy'), one([-24, 0, -12], Math.PI / 2, 'busy'), one([-20, 0, 0], -Math.PI / 2, 'touch'), one([-28, 0, -17], Math.PI / 2, 'busy'),
      one([-30, 0, 15.5], Math.PI, 'busy'), one([-22, 0, 15.5], Math.PI, 'talk'),
      // In the shops: the sellers, the customers.
      ...BACK.slice(working === 'vente' ? 1 : 0).map((x) => one([x + 0.6, 0, -13.2], 0, 'busy')),
      ...FRONT.map((x) => one([x + 0.6, 0, 13.2], Math.PI, 'busy')),
      one([-4, 0, -16], Math.PI, 'phone'), one([10.5, 0, -17], Math.PI, 'busy'), one([3, 0, 15.5], 0, 'talk'),
      // The atrium: on the benches, by the fountain, children round it.
      one([11.2, 0.05, -5.6], 0, 'sit'), one([12.8, 0.05, -5.6], 0, 'phone'), one([12, 0.05, 5.6], Math.PI, 'sit'),
      one([9.2, 0, 2], 1.2, 'cheer', undefined, true), one([14.8, 0, -2], -1.6, 'wave', undefined, true), one([9.5, 0, -1.8], 2.6, 'idle'),
      // The food court: people eating, the server at the kiosk.
      one([24, 0.05, 0.9], Math.PI, 'eat'), one([24, 0.05, -0.9], 0, 'talk'), one([28, 0.05, 3.9], Math.PI, 'eat'), one([33, 0.05, 0.9], Math.PI, 'drink'), one([28, 0.05, -2.1], Math.PI, 'eat'),
      one([30.5, 0, -6.6], 0, 'busy'),
    ]
  }, [working])
  // Shoppers walking the gallery, back and forth, bags in hand.
  const walkers = useMemo(() => {
    const r = rng('mall-passants')
    // On the gallery's two free lanes, between the escalator, the fountain and its benches on one side and the
    // palms on the other; they turn round before the food court (its tables, its stools, the ice-cream kiosk).
    return [...Array(9)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.55 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), z: (i % 2 ? 4.4 : -4.4) + (r() - 0.5) * 0.2, x0: -8 + r() * 2, x1: 19 + r() * 1.5, speed: 1 + r() * 0.4, phase: r() * 60, kid: r() < 0.2 }
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
      const x = there ? w.x0 + len * p : w.x1 - len * (p - 1)
      // Each on its own side of the lane, so the ones coming the other way pass by.
      g.position.set(x, 0, w.z + (there ? 0.35 : -0.35) * Math.sign(w.z))
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
