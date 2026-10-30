import { useMemo } from 'react'
import * as THREE from 'three'
import { Vehicle } from '../vehicles'
import { sign } from '../interior/bigPlace'
import { BOX, Blocks } from './ruePrincesse'
import { Bays, Booth, Lamps, Loungers, People, RoofKit, Stroller, Trolley, type Staff } from './hotelBits'
import { Palm } from './noum'
import { t as tr } from '../../lib/i18n'

// The Rabisson by the airport, as the photos of the real one show it: a long
// low slab of four floors in a grid of blue glass, panes of orange, green, red
// and yellow scattered over it, raised over a glazed ground floor screened by
// white struts that branch like trees. In the middle the recessed glass
// entrance, a round white awning on its own branching column, the name on top
// and on a tall blue sign by the road. Behind, the white colonnade on the pool,
// grey elephants standing on its deck. Sizes are the game's estimates.
// Frame: +z toward the street.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

const W = 84
const DEPTH = 18
const GROUND = 4.5
const FLOORS = 4
const STOREY = 3.6
const TOP = GROUND + FLOORS * STOREY
/** The bays of the grid: one pane and its frame each. */
const BAYS = 48

const white = new THREE.MeshLambertMaterial({ color: '#f1f3f5' })
const paving = new THREE.MeshLambertMaterial({ color: '#c9c6bf', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const lawn = new THREE.MeshLambertMaterial({ color: '#5a9a3c', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const deck = new THREE.MeshLambertMaterial({ color: '#6c7178', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const rim = new THREE.MeshLambertMaterial({ color: '#e3d6bc' })
const water = new THREE.MeshLambertMaterial({ color: '#56b8e6', emissive: '#1a5f88', emissiveIntensity: 0.3 })
const bush = new THREE.MeshLambertMaterial({ color: '#3d7a32' })
const bloom = new THREE.MeshLambertMaterial({ color: '#d9468f' })
const navy = new THREE.MeshLambertMaterial({ color: '#1d3f9e' })
const PLANE_GEO = new THREE.PlaneGeometry(1, 1)

const rnd = (i: number) => Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1)
const PANES = ['#f08a24', '#6cc04a', '#e2453c', '#f2c230', '#3b7fe0', '#e06aa0']

/** The grid of glass: blue panes in light frames, a coloured pane here and there, small white-framed windows; at night rooms lit. */
function gridTexture(night: boolean) {
  const c = document.createElement('canvas')
  c.width = BAYS * 8
  c.height = FLOORS * 2 * 8
  const g = c.getContext('2d')!
  g.fillStyle = night ? '#4a5568' : '#c9d3dc'
  g.fillRect(0, 0, c.width, c.height)
  let k = 0
  for (let row = 0; row < FLOORS * 2; row++)
    for (let b = 0; b < BAYS; b++) {
      const r = rnd(k++)
      const room = row % 2 === 0
      // Each floor is two rows of panes: the upper one carries the colours and the windows.
      g.fillStyle = night ? (room && rnd(k * 3) > 0.62 ? '#ffe2a0' : '#16233a') : room && r > 0.8 ? PANES[Math.floor(rnd(k * 5) * PANES.length)] : row % 4 < 2 ? '#3e6c9e' : '#33608f'
      g.fillRect(b * 8 + 1, row * 8 + 1, 7, 7)
      if (!night && room && r > 0.62 && r <= 0.8) {
        g.fillStyle = '#f4f6f8'
        g.fillRect(b * 8 + 2, row * 8 + 2, 5, 5)
        g.fillStyle = '#2f4a66'
        g.fillRect(b * 8 + 3, row * 8 + 3, 3, 3)
      }
    }
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A white strut leaning in the facade's plane. */
const Strut = ({ x, z, a, h }: { x: number; z: number; a: number; h: number }) => <mesh geometry={BOX} position={[x + Math.sin(a) * (h / 2), (Math.cos(a) * h) / 2, z]} rotation={[0, 0, -a]} scale={[0.22, h, 0.22]} material={white} />

/** A tree of struts: a fan of white branches from one foot. */
const Tree = ({ x, z, h }: { x: number; z: number; h: number }) => (
  <>
    {[-0.55, -0.25, 0, 0.25, 0.55].map((a) => (
      <Strut key={a} x={x} z={z} a={a} h={h / Math.cos(a)} />
    ))}
  </>
)

/** The grey elephant of the pool deck, in blocks: body, head, ears, trunk, tusks, legs. */
function Elephant({ x, z, ry = 0, color = '#5e6268' }: { x: number; z: number; ry?: number; color?: string }) {
  const m = useMemo(() => new THREE.MeshLambertMaterial({ color }), [color])
  const tusk = useMemo(() => new THREE.MeshLambertMaterial({ color: '#d8d8d2' }), [])
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <mesh geometry={BOX} position={[0, 2.1, 0]} scale={[1.6, 1.6, 3]} material={m} castShadow />
      {[[-0.5, -1], [0.5, -1], [-0.5, 1], [0.5, 1]].map(([dx, dz], i) => (
        <mesh key={i} geometry={BOX} position={[dx, 0.7, dz]} scale={[0.5, 1.4, 0.5]} material={m} />
      ))}
      <mesh geometry={BOX} position={[0, 2.6, 1.9]} scale={[1.2, 1.2, 1]} material={m} castShadow />
      <mesh geometry={BOX} position={[-0.9, 2.6, 1.7]} rotation={[0, 0.4, 0]} scale={[0.15, 1.4, 1.1]} material={m} />
      <mesh geometry={BOX} position={[0.9, 2.6, 1.7]} rotation={[0, -0.4, 0]} scale={[0.15, 1.4, 1.1]} material={m} />
      <mesh geometry={BOX} position={[0, 1.6, 2.5]} rotation={[0.15, 0, 0]} scale={[0.3, 1.8, 0.3]} material={m} />
      <mesh geometry={BOX} position={[-0.35, 1.9, 2.5]} rotation={[0.5, 0, 0]} scale={[0.1, 0.8, 0.1]} material={tusk} />
      <mesh geometry={BOX} position={[0.35, 1.9, 2.5]} rotation={[0.5, 0, 0]} scale={[0.1, 0.8, 0.1]} material={tusk} />
    </group>
  )
}

export function HotelRabisson({ night }: { night: boolean }) {
  const mats = useMemo(() => {
    const map = gridTexture(night)
    return {
      grid: new THREE.MeshLambertMaterial({ map, emissive: night ? '#ffffff' : '#000000', emissiveMap: night ? map : null, emissiveIntensity: night ? 0.5 : 0 }),
      side: new THREE.MeshLambertMaterial({ color: night ? '#26324a' : '#3e6c9e' }),
      ground: new THREE.MeshLambertMaterial({ color: night ? '#ffd9a0' : '#5d7f99', emissive: '#ffb45a', emissiveIntensity: night ? 0.7 : 0 }),
      hall: new THREE.MeshLambertMaterial({ color: night ? '#ffcf8a' : '#5a86a6', emissive: '#ffb45a', emissiveIntensity: night ? 1 : 0 }),
      name: sign(tr('Rabisson'), '#1d3f9e', '#ffffff', 512, 128),
    }
  }, [night])
  const trees = useMemo(() => {
    const out: number[] = []
    for (let x = -W / 2 + 4; x < W / 2 - 2; x += 6) if (Math.abs(x) > 8) out.push(x)
    return out
  }, [])
  const colonnade: Block[] = useMemo(() => {
    const out: Block[] = [{ p: [0, GROUND, -DEPTH - 3], s: [W - 10, 0.5, 6] }]
    for (let x = -W / 2 + 6; x <= W / 2 - 6; x += 6) out.push({ p: [x, GROUND / 2, -DEPTH - 5.6], s: [0.5, GROUND, 0.5] })
    return out
  }, [])
  const bushes: Block[] = useMemo(() => {
    const out: Block[] = []
    for (let x = -W / 2; x < W / 2; x += 3.2) if (Math.abs(x) > 6) out.push({ p: [x + rnd(x) * 1.2, 0.5, 13 + rnd(x + 1)], s: [2.2, 1, 1.4] })
    return out
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 7]} geometry={PLANE_GEO} scale={[W + 6, 14, 1]} material={paving} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 15]} geometry={PLANE_GEO} scale={[W + 6, 5, 1]} material={lawn} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -DEPTH - 15]} geometry={PLANE_GEO} scale={[W - 4, 30, 1]} material={deck} />
      {/* The slab of rooms over the glazed ground floor */}
      <mesh geometry={BOX} position={[0, (TOP + GROUND) / 2, -DEPTH / 2]} scale={[W, TOP - GROUND, DEPTH]} material={mats.side} castShadow receiveShadow />
      <mesh position={[0, (TOP + GROUND) / 2, 0.02]} material={mats.grid}>
        <planeGeometry args={[W, TOP - GROUND]} />
      </mesh>
      {/* The same grid on the back, over the pool */}
      <mesh position={[0, (TOP + GROUND) / 2, -DEPTH - 0.02]} rotation={[0, Math.PI, 0]} material={mats.grid}>
        <planeGeometry args={[W, TOP - GROUND]} />
      </mesh>
      <mesh geometry={BOX} position={[0, GROUND - 0.3, -DEPTH / 2 + 0.3]} scale={[W + 0.4, 0.6, DEPTH + 0.6]} material={white} />
      <mesh geometry={BOX} position={[0, TOP + 0.25, -DEPTH / 2]} scale={[W + 0.2, 0.5, DEPTH + 0.2]} material={white} />
      <mesh geometry={BOX} position={[0, GROUND / 2, -DEPTH / 2 - 1]} scale={[W - 2, GROUND, DEPTH - 2]} material={mats.ground} />
      {/* The white trees screening the ground floor, a white pier at each end */}
      {trees.map((x) => (
        <Tree key={x} x={x} z={0.2} h={GROUND - 0.6} />
      ))}
      <Blocks at={[{ p: [-W / 2 + 1.5, GROUND / 2, -0.5], s: [3, GROUND, 1.2] }, { p: [W / 2 - 1.5, GROUND / 2, -0.5], s: [3, GROUND, 1.2] }]} material={white} />
      {/* The entrance: the recessed glass up the full height, the name over it, the round awning on its tree */}
      <mesh position={[0, TOP / 2, 0.05]} material={mats.hall}>
        <planeGeometry args={[12, TOP - 0.5]} />
      </mesh>
      <mesh position={[0, TOP + 1.3, 0.1]} material={mats.name}>
        <planeGeometry args={[8, 2]} />
      </mesh>
      <mesh position={[0, 5.6, 3.5]} material={white} castShadow>
        <cylinderGeometry args={[3.6, 3.6, 0.4, 32]} />
      </mesh>
      <Tree x={0} z={3.5} h={5.4} />
      {night && <pointLight position={[0, 4, 6]} intensity={35} distance={18} color="#ffd9a0" />}
      {/* The tall blue sign by the road */}
      <mesh geometry={BOX} position={[-W / 2 + 2, 5, 18]} scale={[0.5, 10, 0.5]} material={white} />
      <mesh geometry={BOX} position={[-W / 2 + 2, 10.5, 18]} scale={[7, 2.2, 0.4]} material={navy} />
      <mesh position={[-W / 2 + 2, 10.5, 18.22]} material={mats.name}>
        <planeGeometry args={[6.6, 1.8]} />
      </mesh>
      {/* The bougainvillea in the planted strip */}
      <Blocks at={bushes} material={bush} />
      <Blocks at={bushes.map((b) => ({ p: [b.p[0], 1.05, b.p[2]], s: [b.s[0] * 0.8, 0.3, b.s[2] * 0.8] }))} material={bloom} />
      {/* Behind: the colonnade on the pool, the pool in its rim, the elephants on the deck */}
      <Blocks at={colonnade} material={white} />
      <mesh geometry={BOX} position={[0, 0.25, -DEPTH - 16]} scale={[30, 0.5, 12]} material={rim} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.52, -DEPTH - 16]} geometry={PLANE_GEO} scale={[28, 10, 1]} material={water} />
      <Elephant x={18} z={-DEPTH - 14} ry={-0.6} />
      <Elephant x={-18} z={-DEPTH - 12} ry={0.5} color="#b9bec4" />
      {[-30, -24, 24, 30].map((x) => (
        <Palm key={x} x={x} z={-DEPTH - 10} h={4} />
      ))}
      <Vehicle p={[3, 0, 6]} r={Math.PI / 2} kind="car" seed={8} color="#7a1e1e" />
      <Vehicle p={[-20, 0, 8]} r={Math.PI / 2} kind="taxi" seed={3} />
      {/* The life at the door: doormen, guests, the trolley, the kiosk; the bays of the car park */}
      <People at={RABISSON_PEOPLE} seed="rabisson" />
      <Trolley p={[4, 0, 2.2]} r={0.4} />
      <Booth p={[-14, 0, 10]} night={night} />
      <Bays x0={-38} z={8} n={8} />
      <Stroller from={[-40, 11]} to={[40, 11]} seed="rabisson-a" />
      <Stroller from={[1.5, 1]} to={[1.5, 10]} seed="rabisson-b" speed={0.9} bag />
      <Lamps from={[-40, 12.2]} to={[40, 12.2]} step={16} night={night} />
      {/* Behind: the loungers on both sides of the pool, swimmers on its deck; the machines on the roof */}
      <Loungers from={[-14, -25.5]} to={[14, -25.5]} ry={Math.PI} n={8} />
      <Loungers from={[-12, -43]} to={[12, -43]} n={6} />
      <People at={RABISSON_POOL} seed="rabisson-pool" />
      <RoofKit x0={-40} x1={40} z0={-17} z1={-1} y={TOP + 0.5} />
    </group>
  )
}

/** Who stands at the door and by the pool. */
const RABISSON_PEOPLE: Staff[] = [
  { p: [-2.5, 0, 1.5], who: 'portier' },
  { p: [2.5, 0, 1.5], who: 'portier' },
  { p: [5, 0, 5], r: -0.4, pose: 'phone' },
  { p: [-6, 0, 6], r: 1.5, pose: 'talk' },
  { p: [-4.8, 0, 6], r: -1.5 },
  { p: [-15.5, 0, 12], who: 'vigile' },
]
const RABISSON_POOL: Staff[] = [
  { p: [8, 0, -26.8], r: Math.PI },
  { p: [-10, 0, -27], r: Math.PI, pose: 'phone' },
  { p: [4, 0, -41.5], r: 0, pose: 'wave' },
]

/** What one can't walk through: the slab, the colonnade's roof line, the pool, the sign's post. */
export const RABISSON_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 0, z: -DEPTH / 2, hw: W / 2 + 0.3, hd: DEPTH / 2 + 0.6, rot: 0, top: TOP + 1 },
  { x: 0, z: -DEPTH - 16, hw: 15, hd: 6, rot: 0, top: 0.6 },
  { x: -W / 2 + 2, z: 18, r: 0.6 },
]
