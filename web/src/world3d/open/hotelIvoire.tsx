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

  // The tower's vertical piers, standing proud of the facade.
  const piers = useMemo(() => {
    const out: Block[] = []
    for (let x = -9; x <= 9.01; x += 2.25) for (const s of [-1, 1]) out.push({ p: [x, H / 2, s * 8.2], s: [0.45, H, 0.5] })
    for (let z = -7; z <= 7.01; z += 2.33) for (const s of [-1, 1]) out.push({ p: [s * 10.2, H / 2, z], s: [0.5, H, 0.45] })
    return out
  }, [])
  const greenery = useMemo(() => {
    const p = palms(
      [[26, 6], [30, -12], [38, 2], [46, -2], [54, -6], [52, -18], [46, -30], [34, -34], [22, -30], [20, -14], [58, -26], [28, 12], [24, 18], [-6, -12], [-64, -8], [-64, 34], [62, 30]],
      'ivoire-palmes',
    )
    const t = trees([[18, 26], [42, 24], [60, 18], [22, 46], [38, 46], [54, 46], [6, 40], [-10, 46], [-60, -40], [-50, -52], [62, -44]])
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
        <mesh position={[0, H / 2, 0]} castShadow receiveShadow material={[towerSide, towerSide, white, white, tower, tower]}>
          <boxGeometry args={[20, H, 16]} />
        </mesh>
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
      <mesh position={[-5, 3.1, -22]} rotation={[0, 0.5, 0]} geometry={BOX} scale={[24, 0.5, 4]} material={red} castShadow />

      {/* The main building: a white block of thirteen floors on its dark podium trimmed in red */}
      <group position={[-30, 0, -40]}>
        <mesh position={[0, 3.5, 4]} geometry={BOX} scale={[70, 7, 30]} material={podium} castShadow receiveShadow />
        <mesh position={[0, 6.6, 4]} geometry={BOX} scale={[70.4, 0.8, 30.4]} material={red} />
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
