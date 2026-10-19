import { useMemo } from 'react'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Vehicle } from '../vehicles'
import { BOX, Blocks, PLANE } from './ruePrincesse'

// The Hôtel Ivoire, Cocody, over the Ébrié lagoon, as an aerial photo shows
// it: the slender white tower (1969), square in plan, its windows in vertical
// strips, the emblem at the top where Le Toit d'Abidjan is (23rd floor); the
// main building (1963), a white block of about thirteen floors on its podium
// trimmed in red; the Palais des Congrès (1 650 seats), a great white shell
// on a wide white forecourt; the pools winding through the palms at the
// tower's foot, with their footbridges, and the round pavilions under their
// dark conical roofs; in front, the car park among geometric lawns and trees.
// Sources: the user's photo, Forbes Afrique, Greyscape. Sizes are the game's
// estimates. Frame: +z toward the street, -z toward the lagoon.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

const white = new THREE.MeshLambertMaterial({ color: '#f3f1ec' })
const shade = new THREE.MeshLambertMaterial({ color: '#dcd8cf' })
const red = new THREE.MeshLambertMaterial({ color: '#c0262d' })
const podium = new THREE.MeshLambertMaterial({ color: '#3a3433' })
const lawn = new THREE.MeshLambertMaterial({ color: '#4e9a3f', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const lawnLight = new THREE.MeshLambertMaterial({ color: '#6fb24e' })
const paving = new THREE.MeshLambertMaterial({ color: '#e9e6df', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const tarmac = new THREE.MeshLambertMaterial({ color: '#8d8f93', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const trunk = new THREE.MeshLambertMaterial({ color: '#8a6a48' })
const leaves = new THREE.MeshLambertMaterial({ color: '#2f8a3a' })
const steel = new THREE.MeshLambertMaterial({ color: '#b8bec6' })
const colored = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const hutRoof = new THREE.MeshLambertMaterial({ color: '#4a4440' })
const shell = new THREE.MeshLambertMaterial({ color: '#f6f4ef', flatShading: true })
const glassDark = new THREE.MeshLambertMaterial({ color: '#22303f', emissive: '#ffd27a', emissiveIntensity: 0 })
const hedge = new THREE.MeshLambertMaterial({ color: '#2c6e2f' })
const wood = new THREE.MeshLambertMaterial({ color: '#8a6a48' })
const lampHead = new THREE.MeshLambertMaterial({ color: '#f4f1ea', emissive: '#fff2cc', emissiveIntensity: 0 })
const gold = new THREE.MeshLambertMaterial({ color: '#d4b052', emissive: '#d4b052', emissiveIntensity: 0 })

/** A white facade with its windows: vertical strips (the tower) or a grid (the main building); lit here and there at night. */
function facade(kind: 'strips' | 'grid', across: number, floors: number) {
  const make = (night: boolean) => {
    const c = document.createElement('canvas')
    c.width = c.height = 8
    const g = c.getContext('2d')!
    g.fillStyle = night ? '#000' : '#f3f1ec'
    g.fillRect(0, 0, 8, 8)
    g.fillStyle = night ? '#fff' : '#3d5570'
    if (kind === 'strips') {
      // A tall narrow window in each bay, the white piers between, a thin band at each floor.
      g.fillRect(2, 0, 4, night ? 3 : 7)
    } else {
      g.fillRect(1, 2, 6, 4)
      if (night) {
        g.fillStyle = '#000'
        g.fillRect(4, 2, 3, 4)
      }
    }
    const t = new THREE.CanvasTexture(c)
    t.magFilter = t.minFilter = THREE.NearestFilter
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(across, floors)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  return new THREE.MeshLambertMaterial({ map: make(false), emissiveMap: make(true), emissive: '#ffd27a', emissiveIntensity: 0 })
}

/** Palms in blocks: a slender trunk, leaves out in a star. */
function palms(at: [number, number][], seed: string) {
  const r = rng(seed)
  const trunks: Block[] = []
  const crowns: Block[] = []
  for (const [x, z] of at) {
    const h = 7 + r() * 6
    trunks.push({ p: [x, h / 2, z], s: [0.4, h, 0.4] })
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + r()
      crowns.push({ p: [x + Math.cos(a) * 1.4, h - 0.2, z + Math.sin(a) * 1.4], s: [3, 0.25, 0.75], ry: -a, c: k % 2 ? '#2f8a3a' : '#3c9a45' })
    }
    crowns.push({ p: [x, h + 0.2, z], s: [1.1, 0.6, 1.1], c: '#3c9a45' })
  }
  return { trunks, crowns }
}
/** Round garden trees: a trunk and a ball of leaves (in blocks). */
function trees(at: [number, number][]) {
  const trunks: Block[] = []
  const crowns: Block[] = []
  at.forEach(([x, z], i) => {
    trunks.push({ p: [x, 1.2, z], s: [0.4, 2.4, 0.4] })
    crowns.push({ p: [x, 3.4, z], s: [3.2, 2.4, 3.2], c: i % 2 ? '#2f7d32' : '#3b8c3a' }, { p: [x, 4.8, z], s: [2, 1, 2], c: '#46993f' })
  })
  return { trunks, crowns }
}

/** A winding pool: rounded basins in a chain (each a disc stretched), turquoise. */
const POOLS: { at: [number, number]; r: [number, number]; rot: number }[] = [
  { at: [32, -2], r: [7, 4.5], rot: 0.3 },
  { at: [40, -8], r: [8, 5], rot: -0.4 },
  { at: [49, -12], r: [6, 4], rot: 0.2 },
  { at: [44, -20], r: [9, 5.5], rot: 0.9 },
  { at: [36, -26], r: [6, 4], rot: -0.2 },
  { at: [26, -22], r: [5, 3.5], rot: 0.5 },
]

/** The walks (thin white slabs over the lawn): [x, z, length, width, turn]. */
const WALKS: [number, number, number, number, number][] = [
  [-4, 18, 30, 3, -0.25], // from the porch to the Palais's forecourt
  [24, 6, 16, 2.5, 0.6], // the porch to the pools
  [42, -26, 30, 2.5, 0.9], // round the pools
  [20, -40, 40, 2.5, 0.1], // along the lagoon side, to the jetty
  [40, -54, 22, 2.5, -1.45], // down to the jetty
  [-10, -6, 18, 2.5, 1.2], // the tower to the walk
]
const PATHS: Block[] = WALKS.map(([x, z, l, w, ry]) => ({ p: [x, 0.06, z], s: [l, 0.08, w], ry }))
const LAMPS = (() => {
  const posts: Block[] = []
  const heads: Block[] = []
  for (const [x, z, l, , ry] of WALKS)
    for (let k = -l / 2 + 2; k <= l / 2; k += 7) {
      const [px, pz] = [x + Math.cos(ry) * k + Math.sin(ry) * 2, z - Math.sin(ry) * k + Math.cos(ry) * 2]
      posts.push({ p: [px, 1.6, pz], s: [0.12, 3.2, 0.12] })
      heads.push({ p: [px, 3.3, pz], s: [0.45, 0.35, 0.45] })
    }
  return { posts, heads }
})()
/** What a guest walking the grounds can't go through (the grounds' own frame):
 * the tower and its lobby, the main block on its podium, the Palais des
 * Congrès, the pools (their middles: the edges and the footbridges stay
 * walkable), the pavilions, the hedges, the lagoon wall. */
export const IVOIRE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 10, z: -6, hw: 10.5, hd: 8.5, rot: 0, top: 100 },
  { x: -30, z: -36, hw: 35, hd: 15, rot: 0, top: 6.2 },
  { x: -42, z: 14, r: 21.5 },
  ...POOLS.map((p) => ({ x: p.at[0], z: p.at[1], hw: p.r[0] * 0.7, hd: p.r[1] * 0.7, rot: p.rot })),
  ...[[60, -12], [63, 2], [56, -38]].map(([x, z]) => ({ x, z, r: 4.2 })),
  { x: 0, z: -66, hw: 70, hd: 0.3, rot: 0, top: 1 },
]
const HEDGES: Block[] = [
  { p: [31, 0.5, 21.5], s: [48, 1, 0.8] },
  { p: [31, 0.5, 50.5], s: [48, 1, 0.8] },
  { p: [7, 0.5, 36], s: [0.8, 1, 28] },
  { p: [55, 0.5, 36], s: [0.8, 1, 28] },
  { p: [-12, 0.5, 40], s: [0.8, 1, 18] },
]
IVOIRE_SOLID.push(...HEDGES.map((h) => ({ x: h.p[0], z: h.p[2], hw: h.s[0] / 2, hd: h.s[2] / 2, rot: 0, top: 1 })))
const FLOWERS: Block[] = (() => {
  const r = rng('ivoire-fleurs')
  const out: Block[] = []
  for (const [cx, cz] of [[0, 30], [20, 14], [-4, -2], [56, 8], [60, -40], [-62, 0], [24, -50], [-20, -60]])
    for (let i = 0; i < 14; i++) out.push({ p: [cx + (r() - 0.5) * 6, 0.25, cz + (r() - 0.5) * 4], s: [0.5, 0.5, 0.5], c: ['#e8432f', '#f2c94c', '#d6336c', '#ffffff', '#ff7a00'][Math.floor(r() * 5)] })
  return out
})()
const LOUNGERS: Block[] = [
  [28, 4, 0.3], [30, 6, 0.3], [44, 0, -0.4], [46, -1, -0.4], [54, -8, 0.2], [56, -10, 0.2], [50, -26, 0.9], [30, -31, -0.2], [32, -32, -0.2], [22, -26, 0.5],
].map(([x, z, ry]) => ({ p: [x, 0.3, z] as [number, number, number], s: [0.8, 0.15, 2] as [number, number, number], ry, c: '#ffffff' }))
const POOL_PARASOLS: [number, number][] = [[29, 7.5], [45, 1.5], [55, -11.5], [31, -33.5]]

export function HotelIvoire({ night }: { night: boolean }) {
  const H = 100 // the tower
  const tower = useMemo(() => facade('strips', 9, 28), [])
  const towerSide = useMemo(() => facade('strips', 7, 28), [])
  const block = useMemo(() => facade('grid', 16, 13), [])
  const blockEnd = useMemo(() => facade('grid', 5, 13), [])
  const water = useMemo(() => new THREE.MeshLambertMaterial({ color: '#3cc6d0', emissive: '#22b6d6', emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), [])
  const disc = useMemo(() => new THREE.CircleGeometry(1, 20), [])
  for (const m of [tower, towerSide, block, blockEnd]) m.emissiveIntensity = night ? 0.75 : 0
  water.emissiveIntensity = night ? 0.6 : 0
  gold.emissiveIntensity = night ? 0.8 : 0
  glassDark.emissiveIntensity = night ? 0.45 : 0
  lampHead.emissiveIntensity = night ? 1.2 : 0

  // The tower's vertical piers, standing proud of the facade.
  const piers = useMemo(() => {
    const out: Block[] = []
    for (let x = -9; x <= 9.01; x += 2.25) for (const s of [-1, 1]) out.push({ p: [x, 5 + (H - 5) / 2, s * 8.2], s: [0.45, H - 5, 0.5] })
    for (let z = -7; z <= 7.01; z += 2.33) for (const s of [-1, 1]) out.push({ p: [s * 10.2, 5 + (H - 5) / 2, z], s: [0.5, H - 5, 0.45] })
    return out
  }, [])
  const greenery = useMemo(() => {
    const p = palms(
      [[26, 6], [30, -12], [38, 2], [46, -2], [54, -6], [52, -18], [46, -30], [34, -34], [22, -30], [20, -14], [58, -26], [28, 12], [24, 18], [-6, -12], [-64, -8], [-64, 34], [62, 30], [62, -6], [66, -20], [60, -50], [48, -46], [12, -56], [-4, -50], [-40, -62], [-60, -58], [-66, 18], [64, 8], [36, 10]],
      'ivoire-palmes',
    )
    const t = trees([[18, 26], [42, 24], [60, 18], [22, 46], [38, 46], [54, 46], [6, 40], [-10, 46], [-60, -40], [-50, -52], [62, -44], [66, -32], [56, 52], [64, 44], [-66, 48], [-50, 52], [2, -40], [-12, -36], [8, -62], [28, -62]])
    return { trunks: [...p.trunks, ...t.trunks], crowns: [...p.crowns, ...t.crowns] }
  }, [])
  // The car park in front: lawns in geometric beds between the rows of cars.
  const parking = useMemo(() => {
    const r = rng('ivoire-parking')
    const beds: Block[] = []
    for (const [x, z, w, d, ry] of [[14, 22, 10, 5, 0.6], [44, 21, 9, 6, 0.2], [26, 48, 30, 3, 0], [52, 34, 4, 14, 0], [10, 34, 4, 14, 0]] as const)
      beds.push({ p: [x, 0.08, z], s: [w, 0.16, d], ry, c: r() < 0.5 ? '#5ea845' : '#6fb24e' })
    const cars: { p: [number, number, number]; r: number; c: string }[] = []
    for (let i = 0; i < 12; i++) cars.push({ p: [17 + (i % 6) * 5.5, 0, 31 + Math.floor(i / 6) * 9], r: Math.PI / 2, c: ['#f8f9fa', '#212529', '#adb5bd', '#c92a2a', '#1c7ed6'][Math.floor(r() * 5)] })
    return { beds, cars }
  }, [])
  const people = useMemo(() => {
    const r = rng('ivoire-gens')
    const one = (p: [number, number, number], ry: number, pose: Pose, lie = false) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { p, ry, pose, lie, gender, look: randomLook(gender, r), seed: r() * 100 }
    }
    return [
      one([33, -1.05, -2], Math.PI, 'wave'),
      one([41, -1.05, -9], 0.6, 'idle'),
      one([44, -1.05, -20], -0.8, 'talk'),
      one([26.5, 0.35, -7.4], 0, 'sleep', true),
      one([52, 0.35, -16.6], 0, 'sleep', true),
      one([37, 0, -31.5], Math.PI, 'phone'),
      one([6, 0, 9], 0, 'idle'), // the doorman
      one([9, 0, 10.5], 0.4, 'phone'),
      one([-36, 0, 44], 0.3, 'talk'),
      one([-33, 0, 45], -2.6, 'talk'),
      one([-8, 0.1, 17], 1.3, 'walk'),
      one([22, 0.1, 5], -0.9, 'talk'),
      one([20, 0.1, -40.5], 0, 'phone'),
      one([40, 0.7, -67], Math.PI, 'idle'),
      one([-2, 0.1, -19], 0.5, 'talk'),
    ]
  }, [])
  return (
    <group>
      {/* The grounds: lawns all round, the white forecourt of the Palais, the car park, the drive */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -2]} scale={[144, 136, 1]} geometry={PLANE} material={lawn} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-40, 0.04, 30]} scale={[56, 40, 1]} geometry={PLANE} material={paving} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[31, 0.04, 36]} scale={[48, 28, 1]} geometry={PLANE} material={tarmac} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[10, 0.05, 11]} scale={[20, 10, 1]} geometry={PLANE} material={paving} receiveShadow />
      <Blocks at={parking.beds} material={lawnLight} color />

      {/* The tower: slender, nearly square in plan, white piers up its faces, the windows in strips; the top and its emblem */}
      <group position={[10, 0, -6]}>
        <mesh position={[0, 5 + (H - 5) / 2, 0]} castShadow receiveShadow material={[towerSide, towerSide, white, white, tower, tower]}>
          <boxGeometry args={[20, H - 5, 16]} />
        </mesh>
        {/* The lobby at its foot: glass all round, under a white band; the corner pillars */}
        <mesh position={[0, 2.5, 0]} geometry={BOX} scale={[18.6, 5, 14.6]} material={glassDark} />
        <mesh position={[0, 5.2, 0]} geometry={BOX} scale={[21, 0.6, 17]} material={white} castShadow />
        {[[-9.8, -7.8], [9.8, -7.8], [-9.8, 7.8], [9.8, 7.8]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 2.5, z]} geometry={BOX} scale={[0.8, 5, 0.8]} material={white} />
        ))}
        <Blocks at={piers} material={white} />
        {/* The top floors, Le Toit d'Abidjan: a darker band, a white crown, the emblem on two faces */}
        <mesh position={[0, H + 1.5, 0]} geometry={BOX} scale={[20.6, 3, 16.6]} material={shade} castShadow />
        <mesh position={[0, H + 4.5, 0]} geometry={BOX} scale={[17, 3, 13]} material={white} castShadow />
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, H + 4.5, s * 6.6]} rotation={[Math.PI / 2, 0, 0]} material={gold}>
            <cylinderGeometry args={[1.3, 1.3, 0.3, 16]} />
          </mesh>
        ))}
        {/* At its foot, the entrance under a red-roofed porch */}
        <mesh position={[0, 3.6, 12]} geometry={BOX} scale={[16, 0.6, 8]} material={red} castShadow />
        {[-7, 7].map((x) => (
          <mesh key={x} position={[x, 1.7, 15.5]} geometry={BOX} scale={[0.6, 3.4, 0.6]} material={white} />
        ))}
      </group>
      {/* The red-roofed walk from the tower to the main building */}
      <group position={[-5, 0, -22]} rotation={[0, 0.5, 0]}>
        <mesh position={[0, 3.1, 0]} geometry={BOX} scale={[24, 0.5, 4]} material={red} castShadow />
        <mesh position={[0, 0.08, 0]} geometry={BOX} scale={[24, 0.16, 3.4]} material={paving} receiveShadow />
        {[-11, -7, -3, 1, 5, 9].flatMap((x) => [-1.7, 1.7].map((z) => <mesh key={`${x}${z}`} position={[x, 1.5, z]} geometry={BOX} scale={[0.2, 3, 0.2]} material={white} />))}
      </group>

      {/* The main building: a white block of thirteen floors on its dark podium trimmed in red */}
      <group position={[-30, 0, -40]}>
        <mesh position={[0, 3.1, 4]} geometry={BOX} scale={[70, 6.2, 30]} material={podium} castShadow receiveShadow />
        {/* The red trim round its top edge only; the roof itself grey */}
        <mesh position={[0, 6.25, 4]} geometry={BOX} scale={[69.8, 0.1, 29.8]} material={shade} />
        {[-1, 1].map((k) => (
          <group key={k}>
            <mesh position={[0, 6.6, 4 + k * 15]} geometry={BOX} scale={[70.4, 0.8, 0.5]} material={red} />
            <mesh position={[k * 35, 6.6, 4]} geometry={BOX} scale={[0.5, 0.8, 30.4]} material={red} />
          </group>
        ))}
        {/* Its windows in long strips, the entrances on the garden side */}
        {[1.6, 4.3].map((y) => (
          <group key={y}>
            <mesh position={[0, y, 19.04]} geometry={BOX} scale={[66, 1.4, 0.1]} material={glassDark} />
            {[-1, 1].map((sx) => (
              <mesh key={sx} position={[sx * 35.04, y, 4]} geometry={BOX} scale={[0.1, 1.4, 26]} material={glassDark} />
            ))}
          </group>
        ))}
        {[-20, 0, 20].map((x) => (
          <group key={x} position={[x, 0, 19.2]}>
            <mesh position={[0, 1.6, 0]} geometry={BOX} scale={[5, 3.2, 0.2]} material={glassDark} />
            <mesh position={[0, 3.5, 1.2]} geometry={BOX} scale={[6.5, 0.3, 2.6]} material={red} castShadow />
          </group>
        ))}
        {/* On the roof: the terrace, its pool and slide, loungers, a red-roofed pavilion */}
        <mesh position={[18, 6.36, 12]} geometry={BOX} scale={[30, 0.1, 12]} material={paving} />
        <mesh position={[16, 6.45, 12]} geometry={BOX} scale={[16, 0.1, 6.5]} material={water} />
        <mesh position={[26, 7.6, 10]} rotation={[0, 0, 0.35]} geometry={BOX} scale={[6, 0.4, 1.2]} material={red} castShadow />
        <mesh position={[28.6, 7.3, 10]} geometry={BOX} scale={[1.2, 2.2, 1.2]} material={white} />
        {[6, 9, 12, 15, 18, 21, 24].map((x) => (
          <mesh key={x} position={[x, 6.65, 17]} geometry={BOX} scale={[0.8, 0.2, 1.9]} material={white} />
        ))}
        <group position={[-22, 6.3, 12]}>
          <mesh position={[0, 1.6, 0]} geometry={BOX} scale={[16, 3.2, 8]} material={glassDark} />
          <mesh position={[0, 3.45, 0]} geometry={BOX} scale={[18, 0.5, 10]} material={red} castShadow />
        </group>
        {/* On the block's roof: the lift housing, machines, a mast */}
        <mesh position={[-8, 50.2, 0]} geometry={BOX} scale={[8, 3, 6]} material={shade} castShadow />
        {[6, 10, 14].map((x) => (
          <mesh key={x} position={[x, 49.5, 2]} geometry={BOX} scale={[2.4, 1.6, 2.4]} material={steel} />
        ))}
        <mesh position={[18, 53, -3]} material={steel}>
          <cylinderGeometry args={[0.15, 0.15, 8, 6]} />
        </mesh>
        <mesh position={[0, 7 + 20.5, 0]} castShadow receiveShadow material={[blockEnd, blockEnd, white, white, block, block]}>
          <boxGeometry args={[48, 41, 16]} />
        </mesh>
        <mesh position={[0, 48.3, 0]} geometry={BOX} scale={[48.6, 0.8, 16.6]} material={shade} />
      </group>

      {/* The Palais des Congrès: the great white shell, the red band at its foot */}
      <group position={[-42, 0, 14]}>
        <mesh position={[0, 1.5, 0]} material={red}>
          <cylinderGeometry args={[21.5, 21.5, 3, 24]} />
        </mesh>
        {/* Folded in panels, as on the photo: few facets, each lit on its own */}
        <mesh position={[0, 3, 0]} scale={[1, 0.42, 1]} material={shell} castShadow receiveShadow>
          <sphereGeometry args={[23, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>

      {/* The Palais's entrances: glass doors round the front of its red base, the steps */}
      <group position={[-42, 0, 14]}>
        {[-0.7, -0.35, 0, 0.35, 0.7].map((a) => (
          <group key={a} position={[Math.sin(a) * 21.7, 0, Math.cos(a) * 21.7]} rotation={[0, a, 0]}>
            <mesh position={[0, 1.4, 0]} geometry={BOX} scale={[4.6, 2.8, 0.2]} material={glassDark} />
            <mesh position={[0, 0.12, 1.4]} geometry={BOX} scale={[6, 0.24, 2.6]} material={white} receiveShadow />
          </group>
        ))}
      </group>

      {/* Paths: white walks joining the porch, the forecourt, the pools and the lagoon; lamps along them; hedges and flowers */}
      <Blocks at={PATHS} material={paving} />
      <Blocks at={LAMPS.posts} material={steel} />
      <Blocks at={LAMPS.heads} material={lampHead} />
      <Blocks at={HEDGES} material={hedge} />
      <Blocks at={FLOWERS} material={colored} color />
      <Blocks at={LOUNGERS} material={colored} color />
      {POOL_PARASOLS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.2, 0]} material={steel}>
            <cylinderGeometry args={[0.04, 0.04, 2.4, 5]} />
          </mesh>
          <mesh position={[0, 2.35, 0]}>
            <coneGeometry args={[1.3, 0.4, 8, 1, true]} />
            <meshLambertMaterial color={i % 2 ? '#c0262d' : '#f3f1ec'} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* The lagoon's edge: the low wall, the jetty, two boats at it */}
      <mesh position={[0, 0.5, -66]} geometry={BOX} scale={[140, 1, 0.6]} material={white} castShadow />
      <mesh position={[40, 0.6, -71]} geometry={BOX} scale={[3, 0.25, 10]} material={wood} castShadow />
      {[[37, -72, 0], [43.5, -73, Math.PI]].map(([x, z, ry]) => (
        <group key={`${x}`} position={[x, 0.3, z]} rotation={[0, ry, 0]}>
          <mesh position={[0, 0.3, 0]} geometry={BOX} scale={[2.2, 0.6, 6]} material={white} castShadow />
          <mesh position={[0, 0.9, -0.6]} geometry={BOX} scale={[1.6, 0.6, 2]} material={shade} />
          <mesh position={[0, 0.62, 0]} geometry={BOX} scale={[2.3, 0.1, 6.1]} material={red} />
        </group>
      ))}

      {/* The pools winding at the tower's foot, the footbridges over them, the round pavilions */}
      {POOLS.map((p, i) => (
        <group key={i}>
          <mesh geometry={disc} material={paving} rotation={[-Math.PI / 2, 0, p.rot]} position={[p.at[0], 0.05, p.at[1]]} scale={[p.r[0] + 1.6, p.r[1] + 1.6, 1]} />
          <mesh geometry={disc} material={water} rotation={[-Math.PI / 2, 0, p.rot]} position={[p.at[0], 0.07, p.at[1]]} scale={[p.r[0], p.r[1], 1]} />
        </group>
      ))}
      {[[36, -5, 0.8], [45, -15, -0.6], [31, -24, 0.2]].map(([x, z, ry]) => (
        <mesh key={`${x}${z}`} position={[x, 0.45, z]} rotation={[0, ry, 0]} geometry={BOX} scale={[5, 0.3, 1.6]} material={white} castShadow />
      ))}
      {[[60, -12], [63, 2], [56, -38]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 1.6, 0]} material={white}>
            <cylinderGeometry args={[4.2, 4.2, 3.2, 14]} />
          </mesh>
          <mesh position={[0, 5, 0]} material={hutRoof} castShadow>
            <coneGeometry args={[5.4, 3.8, 14]} />
          </mesh>
        </group>
      ))}

      {/* Palms and garden trees; cars in the car park, a taxi at the door; the flags */}
      <Blocks at={greenery.trunks} material={trunk} />
      <Blocks at={greenery.crowns} material={leaves} color />
      {parking.cars.map((c, i) => (
        <Vehicle key={i} p={c.p} r={c.r} kind="car" color={c.c} seed={i} />
      ))}
      <Vehicle p={[14, 0, 10]} r={Math.PI} kind="taxi" seed={2} />
      <Blocks at={[0, 4, 8].map((x) => ({ p: [x, 4, 18] as [number, number, number], s: [0.12, 8, 0.12] as [number, number, number] }))} material={steel} />
      <Blocks at={[0, 4, 8].flatMap((x) => ['#ff8200', '#ffffff', '#009a44'].map((c, k) => ({ p: [x + 0.4 + k * 0.5, 7.3, 18] as [number, number, number], s: [0.5, 1.0, 0.04] as [number, number, number], c })))} material={colored} color />

      <NoShadows>
        {people.map((g, i) => (
          <group key={i} position={g.p} rotation={g.lie ? [-Math.PI / 2, 0, g.ry] : [0, g.ry, 0]}>
            <Human look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}
