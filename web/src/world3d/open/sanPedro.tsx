import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOX, Blocks, lettering, signMaterial } from './ruePrincesse'
import { alongShore, type At } from './shoreline'
import { put, blocksMat, seeded, strawRoof, type Part } from './kit3d'
import { SEA_TURTLE, Flock, Herd, grazer, makeHerd } from './wildlife'
import { SafariTruck } from './nziReserve'
import { LowHuman } from '../../avatar/LowHuman'
import { NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { t as tr } from '../../lib/i18n'
import { Beat, Bulbs, Club, Maquis, People as KitPeople, Sign, stringLights, usePeople as usePeopleKit, useSign, type ClubSpec, type MaquisSpec } from './villeKit'

// San-Pédro's landmarks (the update « sanpedro-vivant », backend game/villes2.go), in the game's blocks,
// most of each drawn at once (kit3d.ts):
// - the Port autonome, the first cocoa port in the world: the quay, a cargo alongside with its hatches
//   open, the mobile cranes slewing their slings of jute bags into the holds, the warehouses full of
//   bags, the container yard, the lorries, the dockers carrying the bags on their heads;
// - the fishing port: the big painted pirogues pulled up on the sand, others coming in on the swell, the
//   nets drying on their poles, the women's smoking ovens and their fish;
// - the beaches: Monogaga's sand under the coconut palms and its paillotes, the Baie des Sirènes' rocks
//   and the sea turtles that come up at night with the ecoguards;
// - Taï Forêt Excursions (the game's agency): its kiosk and its 4x4 for the road to Taï.
// - the Cathédrale Saint-Pierre, the Bardot, the Maquis Le Mérou Braisé and Le Cargo Club (below; the
//   maquis and the club from villeKit.tsx).
// All layouts are the game's own, not surveyed. Frames: −z the water (places.ts ON_SHORE).

const M = {
  water: new THREE.MeshLambertMaterial({ color: '#2f6f8f', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  quay: new THREE.MeshLambertMaterial({ color: '#a9a79c', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  wet: new THREE.MeshLambertMaterial({ color: '#cdb27a', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  dry: new THREE.MeshLambertMaterial({ color: '#e7d3a1', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  lamp: new THREE.MeshLambertMaterial({ color: '#fff4d0', emissive: '#ffcf70', emissiveIntensity: 0 }),
  smoke: new THREE.MeshLambertMaterial({ color: '#d8d4cc', transparent: true, opacity: 0.45, depthWrite: false }),
}

/* ---------- The pieces ---------- */

const JUTE = ['#b08a56', '#a47f4c', '#bc9662']
/** A stack of cocoa bags on its pallet, `w` by `d` bags, `h` high. */
function bagStack(w: number, d: number, h: number): Part[] {
  const out: Part[] = [[0, 0.07, 0, w * 0.62 + 0.2, 0.14, d * 0.8 + 0.2, '#7a5a3a']]
  for (let i = 0; i < h; i++) for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) out.push([(x - (w - 1) / 2) * 0.62, 0.36 + i * 0.44, (z - (d - 1) / 2) * 0.8, 0.58, 0.42, 0.74, JUTE[(i + x + z) % 3]])
  return out
}
/** A container: its colour, its ribs. */
const container = (c: string, l = 6): Part[] => [[0, 1.3, 0, l, 2.6, 2.44, c], [l / 2 + 0.01, 1.3, 0, 0.04, 2.4, 2.2, '#2a2a2a']]
/** A pirogue: long, the painted bands, the high bow. Facing +z (its bow). */
function pirogue(len: number, a: string, b: string): Part[] {
  return [
    [0, 0.35, 0, 1.3, 0.7, len, a],
    [0, 0.66, 0, 1.36, 0.16, len - 0.4, b],
    [0, 0.5, 0, 1.38, 0.08, len - 0.6, '#f4f1e6'],
    [0, 0.6, len / 2 + 0.5, 0.7, 0.7, 1.4, a, 0],
    [0, 0.6, -len / 2 - 0.3, 0.8, 0.6, 1, a],
    [0, 0.45, 0, 1.1, 0.06, 0.25, '#6b4a2a'],
  ]
}
const PIROGUES: [string, string][] = [['#1c7ed6', '#f0b429'], ['#c92a2a', '#2f9e44'], ['#f0b429', '#1c7ed6'], ['#2f9e44', '#c92a2a'], ['#f4f1e6', '#e8590c'], ['#7048e8', '#ffd43b']]
/** A coconut palm, its trunk leaning a little. */
function palm(h: number, lean: number): Part[] {
  const out: Part[] = [[lean * 0.5, h / 2, 0, 0.4, h, 0.4, '#8a7a64', 0]]
  for (let k = 0; k < 6; k++) out.push([lean + Math.cos(k * 1.05) * 1.5, h, Math.sin(k * 1.05) * 1.5, 3.4, 0.14, 0.8, '#4e8a3a', -k * 1.05])
  out.push([lean, h - 0.4, 0, 0.6, 0.5, 0.6, '#6b5a2a'])
  return out
}
/** A paillote: four posts, the straw cone, a table and its chairs under it. */
function paillote(): Part[] {
  const out: Part[] = [[-2.5, 1.4, -2.5, 0.2, 2.8, 0.2, '#6b4a2a'], [2.5, 1.4, -2.5, 0.2, 2.8, 0.2, '#6b4a2a'], [-2.5, 1.4, 2.5, 0.2, 2.8, 0.2, '#6b4a2a'], [2.5, 1.4, 2.5, 0.2, 2.8, 0.2, '#6b4a2a']]
  out.push(...strawRoof(3.6, 1.8, 2.7))
  out.push([0, 0.72, 0, 1.2, 0.06, 1.2, '#f4f1e6'], [0, 0.36, 0, 0.12, 0.72, 0.12, '#f4f1e6'], [-1, 0.24, 0, 0.45, 0.48, 0.45, '#f4f1e6'], [1, 0.24, 0, 0.45, 0.48, 0.45, '#f4f1e6'])
  return out
}
/** The women's smoking oven: the banco box, the grill of fish on top. */
const oven = (): Part[] => [[0, 0.5, 0, 2.4, 1, 1.4, '#9a5a32'], [0, 1.04, 0, 2.2, 0.08, 1.2, '#3a3a3a'], ...[...Array(6)].map((_, i) => [-0.9 + i * 0.36, 1.12, 0, 0.3, 0.06, 0.9, '#c9a36a'] as Part), [-1.25, 0.35, 0, 0.1, 0.5, 0.6, '#ff7a2a']]

/** People of the place, standing or working: their looks drawn once. */
function usePeople(seed: string, spots: { p: [number, number, number]; ry: number; pose: Pose; dress?: { outfit: string; outfitColor: string } }[]) {
  return useMemo(() => {
    const r = rng(seed)
    return spots.map((s) => {
      const gender: 'femme' | 'homme' = s.dress?.outfit === 'pagne' || r() < 0.4 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      return { ...s, gender, look: s.dress ? { ...look, ...s.dress } : look, seed: r() * 100 }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
function People({ list }: { list: ReturnType<typeof usePeople> }) {
  return (
    <NoShadows>
      {list.map((p, i) => (
        <group key={i} position={p.p} rotation={[0, p.ry, 0]}>
          <LowHuman look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
        </group>
      ))}
    </NoShadows>
  )
}

/* ---------- The Port autonome ---------- */

const QUAY_Z = -20
const SHIP_Z = QUAY_Z - 9.5
/** The cranes on the quay (x), and where each swings its sling (between the warehouse side and the ship's hold). */
const CRANES = [-34, 6]

export function PortSanPedro({ night }: { night: boolean }) {
  M.lamp.emissiveIntensity = night ? 1.3 : 0
  const sign = useMemo(() => {
    const l = lettering(tr('PORT AUTONOME DE SAN-PÉDRO'), '#0b4f6c', '#ffffff', '#f0b429')
    return { m: signMaterial(l.t), aspect: l.aspect }
  }, [])
  sign.m.emissiveIntensity = night ? 0.7 : 0
  const mat = useMemo(blocksMat, [])
  const at = useMemo(() => {
    const out: At[] = []
    // The cargo alongside: the hull (black over red), the deck, the hatches open over the holds, the bridge aft.
    put(out, [0, SHIP_Z, 0], [
      [0, -0.6, 0, 112, 3, 16, '#a23a2a'],
      [0, 2.6, 0, 112, 3.4, 16, '#1d2733'],
      [0, 4.35, 0, 110, 0.1, 15.6, '#7a7f86'],
      [56.5, 2.6, 0, 2, 3.2, 12, '#1d2733'],
      [-48, 9, 0, 12, 9.4, 14, '#f1f0ea'],
      [-48, 11.5, 7.05, 11, 1, 0.05, '#2b4a66'],
      [-50, 15.6, 0, 3, 4, 3, '#d9480f'],
      [-50, 17.2, 0, 3.1, 0.6, 3.1, '#1d2733'],
      ...[-30, -12, 6, 24, 42].flatMap((x): Part[] => [
        [x, 4.8, 0, 12, 0.9, 11, '#c9a227'],
        [x, 4.9, 0, 10, 1, 9, '#14181e'],
      ]),
      // The ship's own derricks between the holds.
      ...[-21, -3, 15, 33].flatMap((x): Part[] => [[x, 9, 0, 0.6, 9, 0.6, '#f0f0e6'], [x + 3, 12.5, 0, 7, 0.4, 0.4, '#f0f0e6', 0.3]]),
    ])
    // A tug off the bow.
    put(out, [70, SHIP_Z - 14, 0.3], [[0, 0.6, 0, 14, 2, 5, '#c92a2a'], [-2, 2.6, 0, 5, 2.4, 4, '#f4f1e6'], [-2, 4.4, 0, 1.2, 1.4, 1.2, '#1d2733']])
    // The quay's edge, its yellow line and its bollards.
    out.push({ p: [0, 0.3, QUAY_Z + 0.6], s: [150, 0.6, 1.2], c: '#8e8c82' }, { p: [0, 0.62, QUAY_Z + 2.4], s: [150, 0.03, 0.25], c: '#f0b429' })
    for (let x = -70; x <= 70; x += 14) out.push({ p: [x, 0.8, QUAY_Z + 1], s: [0.6, 0.6, 0.6], c: '#2a2a2a' })
    // The warehouses at the back: long sheds, their roofs of corrugated iron, their open doors on the bags.
    for (const x of [-48, -16, 16]) {
      put(out, [x, 22, 0], [[0, 4, 0, 28, 8, 16, '#d8d2c2'], [0, 8.4, 0, 29, 0.6, 17, '#8f979e'], [0, 3, -8.02, 10, 6, 0.1, '#2a2622'], [0, 6.8, -8.05, 18, 1, 0.1, '#0b4f6c']])
      put(out, [x - 3, 13.2, 0], bagStack(4, 2, 3))
      put(out, [x + 4, 12.6, 0], bagStack(3, 2, 2))
    }
    // The slings waiting at each crane's foot, the lorries backed up to them.
    for (const x of CRANES) {
      put(out, [x - 6, -6, 0], bagStack(5, 3, 3))
      put(out, [x + 8, -2, Math.PI / 2], [[0, 1.4, 0, 2.4, 2.2, 2.6, '#e9ecef'], [0, 1.5, -6, 2.5, 2, 9, '#2f6db3'], [0, 0.5, -1, 2.2, 0.6, 12, '#2a2a2a']])
      put(out, [x + 8, -2, Math.PI / 2], bagStack(3, 4, 2), 1.4)
    }
    // The container yard to the east.
    const r = seeded(7)
    const cols = ['#1971c2', '#e8590c', '#2f9e44', '#c92a2a', '#7048e8', '#495057', '#f0b429']
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
      const n = 1 + Math.floor(r() * 3)
      for (let k = 0; k < n; k++) put(out, [44 + j * 3, -10 + i * 6.8, Math.PI / 2], container(cols[Math.floor(r() * cols.length)]), k * 2.6)
    }
    // The lamp masts.
    for (const x of [-60, -20, 20, 60]) out.push({ p: [x, 9, 6], s: [0.4, 18, 0.4], c: '#9aa0a6' })
    return out
  }, [])
  const lamps = useMemo<At[]>(() => [-60, -20, 20, 60].map((x) => ({ p: [x, 18.2, 6], s: [2.4, 0.5, 1], c: '#fff4d0' })), [])
  const dockers = usePeople('sp-dockers', [
    { p: [-40, 0, -8], ry: 0.4, pose: 'carry', dress: { outfit: 'casual', outfitColor: '#f08c00' } },
    { p: [-37, 0, -10], ry: -0.3, pose: 'point', dress: { outfit: 'uniforme', outfitColor: '#f0b429' } },
    { p: [2, 0, -9], ry: 2.8, pose: 'carry', dress: { outfit: 'casual', outfitColor: '#e03131' } },
    { p: [9, 0, -7], ry: 0, pose: 'whistle', dress: { outfit: 'uniforme', outfitColor: '#f0b429' } },
    { p: [-20, 0, 12], ry: Math.PI, pose: 'carry', dress: { outfit: 'casual', outfitColor: '#1c7ed6' } },
    { p: [12, 0, 12], ry: Math.PI, pose: 'talk' },
  ])
  return (
    <group>
      {/* The quay's concrete, the basin's water alongside */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 10]} material={M.quay} receiveShadow>
        <planeGeometry args={[152, 60]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, QUAY_Z - 30]} material={M.water}>
        <planeGeometry args={[220, 60]} />
      </mesh>
      <Blocks at={at} material={mat} color />
      <Blocks at={lamps} material={M.lamp} />
      {CRANES.map((x, i) => (
        <Crane key={x} x={x} phase={i * 2.3} />
      ))}
      {/* The gate on the road, its name */}
      <group position={[0, 0, 39]}>
        <mesh geometry={BOX} position={[-9, 3, 0]} scale={[0.8, 6, 0.8]} material={mat} />
        <mesh geometry={BOX} position={[9, 3, 0]} scale={[0.8, 6, 0.8]} material={mat} />
        <mesh geometry={BOX} position={[0, 6.2, 0]} scale={[19, 1.4, 0.6]} material={mat} />
        <mesh position={[0, 6.2, 0.32]} material={sign.m}>
          <planeGeometry args={[17, 17 / sign.aspect]} />
        </mesh>
      </group>
      <People list={dockers} />
      <Flock centre={[0, QUAY_Z - 20]} radius={30} height={18} n={8} seed="sp-mouettes" />
    </group>
  )
}

/** A mobile harbour crane: the tower, the boom, its sling of cocoa bags slewed from the quay to the hold and back, lowered and raised. */
function Crane({ x, phase }: { x: number; phase: number }) {
  const top = useRef<THREE.Group>(null)
  const hook = useRef<THREE.Group>(null)
  const cable = useRef<THREE.Mesh>(null)
  const mat = useMemo(blocksMat, [])
  const parts = useMemo(() => {
    const base: At[] = []
    put(base, [0, 0, 0], [[0, 1.2, 0, 8, 2.4, 6, '#f0b429'], [0, 2.6, 0, 6, 0.6, 5, '#1d2733'], [0, 9, 0, 2.2, 12, 2.2, '#f0b429'], [3.6, 0.6, 3.4, 1.4, 1.2, 1.4, '#2a2a2a'], [-3.6, 0.6, 3.4, 1.4, 1.2, 1.4, '#2a2a2a'], [3.6, 0.6, -3.4, 1.4, 1.2, 1.4, '#2a2a2a'], [-3.6, 0.6, -3.4, 1.4, 1.2, 1.4, '#2a2a2a']])
    const boom: At[] = []
    // The boom runs along the top's +x: out 26 m, raised; the cab and the counterweight behind.
    put(boom, [0, 0, 0], [[13, 1.6, 0, 27, 0.9, 1, '#f0b429', 0], [-3, 0.2, 0, 4, 2.4, 3.4, '#e0a21a'], [1.6, -0.6, 1.4, 2, 1.8, 1.6, '#f4f1e6'], [2.6, -0.6, 1.4, 0.05, 1.2, 1.4, '#5c8fb3']])
    const sling: At[] = []
    put(sling, [0, 0, 0], bagStack(3, 2, 2), -1.8)
    sling.push({ p: [0, 0.1, 0], s: [0.1, 0.3, 1.8], c: '#d9480f' })
    return { base, boom, sling }
  }, [])
  const box = BOX
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.12 + phase
    // Slew from over the quay (+z) out over the hold (−z) and back; the hook goes down at each end.
    const k = (Math.sin(t) + 1) / 2
    if (top.current) top.current.rotation.y = -Math.PI / 2 + k * Math.PI
    // (The boom's tip, raised 0.18 rad, is some 25.6 m out and 6.2 m over the top.)
    const drop = 4 + Math.max(0, Math.abs(Math.sin(t)) - 0.85) * 90
    if (hook.current) hook.current.position.set(25.4, 5.6 - drop, 0)
    if (cable.current) {
      cable.current.position.set(25.4, (6.2 + 5.6 - drop) / 2, 0)
      cable.current.scale.set(0.08, drop + 0.6, 0.08)
    }
  })
  return (
    <group position={[x, 0, -8]}>
      <Blocks at={parts.base} material={mat} color />
      <group ref={top} position={[0, 15, 0]}>
        <group rotation={[0, 0, 0.18]}>
          <Blocks at={parts.boom} material={mat} color />
        </group>
        <mesh ref={cable} geometry={box} material={mat} />
        <group ref={hook}>
          <Blocks at={parts.sling} material={mat} color />
        </group>
      </group>
    </group>
  )
}

/* ---------- The fishing port ---------- */

export function PortPeche({ night, shore }: { night: boolean; shore?: [number, number][] }) {
  M.lamp.emissiveIntensity = night ? 1.2 : 0
  const mat = useMemo(blocksMat, [])
  const sign = useMemo(() => {
    const l = lettering(tr('PORT DE PÊCHE'), '#f4f1e6', '#1c7ed6', '#c92a2a')
    return { m: signMaterial(l.t), aspect: l.aspect }
  }, [])
  sign.m.emissiveIntensity = night ? 0.6 : 0
  const b = useMemo(() => {
    const s = alongShore(shore ?? [[-80, -30], [80, -30]])
    const out: At[] = []
    // Pirogues pulled up on the sand, side by side, bows to the sea.
    let i = 0
    for (let d = s.dMid - 60; d < s.dMid + 60; d += 4.2) {
      if (d < 4 || d > s.total - 4) continue
      const [x, z, ry] = s.at(d, 6 + (i % 3))
      const [a, c] = PIROGUES[i++ % PIROGUES.length]
      put(out, [x, z, ry + Math.PI + ((i * 13) % 7 - 3) * 0.03], pirogue(10 + (i % 3) * 1.5, a, c))
    }
    // The nets drying on their poles, behind; the smoking ovens; the fish tables and their basins.
    for (let d = s.dMid - 50; d < s.dMid + 50; d += 16) {
      const [x, z, ry] = s.at(d, 20)
      put(out, [x, z, ry], [[-3, 1.2, 0, 0.12, 2.4, 0.12, '#6b4a2a'], [3, 1.2, 0, 0.12, 2.4, 0.12, '#6b4a2a'], [0, 1.6, 0, 6, 1.4, 0.05, '#2f6db3'], [0, 0.9, 0, 6, 0.2, 0.06, '#f0b429']])
    }
    const ovens: [number, number, number][] = []
    for (let d = s.dMid - 36; d < s.dMid + 40; d += 9) ovens.push(s.at(d, 30))
    for (const o of ovens) put(out, o, oven())
    for (let d = s.dMid - 20; d < s.dMid + 20; d += 8) {
      const [x, z, ry] = s.at(d, 13)
      put(out, [x, z, ry], [[0, 0.8, 0, 2, 0.08, 1, '#8a6a3c'], [0, 0.4, 0, 0.1, 0.8, 0.1, '#6b4a2a'], [0, 0.92, 0, 1.2, 0.2, 0.7, '#c9d6e0'], [1.6, 0.2, 0.8, 0.8, 0.4, 0.8, '#e03131']])
    }
    // A shed of the cooperative, its tin roof and its name.
    const shed = s.at(s.dMid, 40)
    put(out, shed, [[0, 2, 0, 14, 4, 7, '#e9e2cf'], [0, 4.2, 0, 15, 0.3, 8, '#8f979e'], [0, 1.4, -3.52, 3, 2.8, 0.05, '#3a2a1a']])
    for (let d = s.dMid - 70; d < s.dMid + 70; d += 14) put(out, s.at(d, 46 + ((d * 3) % 5)), palm(8 + ((d * 7) % 3), 0.6))
    return { wet: s.ribbon(-1, 9, 0.035), dry: s.ribbon(9, 50, 0.025), out, ovens, shed, coming: [s.at(s.dMid - 25, -18), s.at(s.dMid + 30, -32), s.at(s.dMid + 5, -48)] }
  }, [shore])
  const smoke = useMemo<At[]>(() => b.ovens.map(([x, z]) => ({ p: [x, 2.4, z], s: [1.6, 1.6, 1.2] })), [b])
  const women = usePeople(
    'sp-fumeuses',
    b.ovens.slice(0, 5).map(([x, z, ry], i) => ({ p: [x + Math.sin(ry) * 1.4, 0, z + Math.cos(ry) * 1.4], ry: ry + Math.PI, pose: (i % 2 ? 'cook' : 'idle') as Pose, dress: { outfit: 'pagne', outfitColor: ['#e8590c', '#1c7ed6', '#f0b429', '#2f9e44', '#c92a2a'][i] } })),
  )
  return (
    <group>
      <mesh geometry={b.wet} material={M.wet} receiveShadow />
      <mesh geometry={b.dry} material={M.dry} receiveShadow />
      <Blocks at={b.out} material={mat} color />
      <Blocks at={smoke} material={M.smoke} />
      {b.coming.map((p, i) => (
        <Bobbing key={i} at={p} seed={i} />
      ))}
      <mesh position={[b.shed[0] - Math.sin(b.shed[2]) * 3.6, 4.9, b.shed[1] - Math.cos(b.shed[2]) * 3.6]} rotation={[0, b.shed[2] + Math.PI, 0]} material={sign.m}>
        <planeGeometry args={[9, 9 / sign.aspect]} />
      </mesh>
      <People list={women} />
      <Flock centre={[0, -40]} radius={22} height={10} n={9} seed="peche-mouettes" />
    </group>
  )
}

/** A pirogue out on the swell, coming in: it rocks and rides the waves, its crew aboard. */
function Bobbing({ at, seed }: { at: [number, number, number]; seed: number }) {
  const g = useRef<THREE.Group>(null)
  const mat = useMemo(blocksMat, [])
  const parts = useMemo(() => {
    const out: At[] = []
    const [a, c] = PIROGUES[(seed * 2 + 1) % PIROGUES.length]
    put(out, [0, 0, 0], pirogue(13, a, c))
    put(out, [0, 0, 0], [[0, 1.2, 1.5, 0.5, 0.8, 0.4, '#2a2a2a'], [0, 1.6, -2, 0.5, 1.4, 0.5, '#e8590c'], [0, 1.6, 0.6, 0.5, 1.4, 0.5, '#1c7ed6'], [0, 2.4, -2, 0.36, 0.36, 0.36, '#5a3a22'], [0, 2.4, 0.6, 0.36, 0.36, 0.36, '#5a3a22'], [0, 1.0, -6.6, 0.4, 0.9, 0.4, '#2a2a2a']])
    return out
  }, [seed])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 2
    if (!g.current) return
    g.current.position.y = -0.25 + Math.sin(t * 1.2) * 0.15
    g.current.rotation.z = Math.sin(t * 0.9) * 0.06
    g.current.rotation.x = Math.sin(t * 1.1 + 1) * 0.04
  })
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, at[2], 0]}>
      <group ref={g}>
        <Blocks at={parts} material={mat} color />
      </group>
    </group>
  )
}

/* ---------- The beaches: Monogaga, the Baie des Sirènes ---------- */

export function PlageSud({ night, shore, kind }: { night: boolean; shore?: [number, number][]; kind: 'monogaga' | 'sirenes' }) {
  const mat = useMemo(blocksMat, [])
  const b = useMemo(() => {
    const s = alongShore(shore ?? [[-90, -30], [90, -30]])
    const out: At[] = []
    const r = seeded(kind === 'sirenes' ? 11 : 5)
    // The coconut palms, thick at the back of the sand.
    for (let d = 3; d < s.total - 3; d += 7) put(out, s.at(d, 34 + r() * 16), palm(8 + r() * 4, (r() - 0.5) * 2))
    if (kind === 'monogaga') {
      // The paillotes and their tables in a row, a pirogue or two on the sand.
      for (let d = s.dMid - 45; d < s.dMid + 50; d += 18) put(out, s.at(d, 24), paillote())
      put(out, s.at(s.dMid + 62, 8), pirogue(9, '#1c7ed6', '#f0b429'))
      put(out, s.at(s.dMid - 60, 9), pirogue(10, '#c92a2a', '#2f9e44'))
    } else {
      // The bay's rocks: grey granite heaped at the water, a few out in the sea.
      for (const [d, o, sz] of [[-40, 1, 5], [-34, -3, 3], [-28, 2, 4], [34, -2, 6], [40, 1, 4], [46, -6, 3], [0, -14, 2.5], [8, -18, 3.5]] as const) {
        const [x, z, ry] = s.at(s.dMid + d, o)
        put(out, [x, z, ry + d], [[0, sz * 0.3, 0, sz, sz * 0.7, sz * 0.8, '#7d7a72'], [sz * 0.3, sz * 0.55, 0.2, sz * 0.6, sz * 0.5, sz * 0.5, '#8d8a82'], [-sz * 0.3, sz * 0.2, -0.3, sz * 0.7, sz * 0.4, sz * 0.6, '#6d6a62']])
      }
      // The ecoguards' shelter, its sign of the turtles' nests.
      put(out, s.at(s.dMid + 14, 26), [[0, 1.3, 0, 4, 2.6, 3, '#e9e2cf'], ...strawRoof(3, 1.6, 2.5)])
      for (const d of [-8, -2, 5]) put(out, s.at(s.dMid + d, 14), [[0, 0.3, 0, 0.1, 0.6, 0.1, '#e8590c'], [0, 0.04, 0, 1.2, 0.04, 1.2, '#d8c08a']])
    }
    return { wet: s.ribbon(-1, 8, 0.035), dry: s.ribbon(8, 56, 0.025), out, turtles: s.at(s.dMid, 10), guard: s.at(s.dMid + 4, 16) }
  }, [shore, kind])
  // The sea turtles: up the sand at night (laying), gone back to the sea by day.
  const turtles = useMemo(() => {
    const [x, z] = b.turtles
    const centre = { x, z }
    return { a: makeHerd(`turtles-${kind}`, 3, [x, z], 6, [0.9, 1.15]), b: grazer(centre, 4) }
  }, [b, kind])
  const people = usePeople(`plage-${kind}`, kind === 'sirenes' ? (night ? [{ p: [b.guard[0], 0, b.guard[1]], ry: b.guard[2] + Math.PI, pose: 'phone' as Pose, dress: { outfit: 'uniforme', outfitColor: '#2b8a3e' } }] : [{ p: [b.guard[0], 0, b.guard[1]], ry: b.guard[2], pose: 'idle' as Pose }]) : [{ p: [b.guard[0], 0, b.guard[1]], ry: b.guard[2] + Math.PI, pose: 'idle' as Pose }, { p: [b.guard[0] + 3, 0, b.guard[1] + 1], ry: b.guard[2], pose: 'talk' as Pose }])
  return (
    <group>
      <mesh geometry={b.wet} material={M.wet} receiveShadow />
      <mesh geometry={b.dry} material={M.dry} receiveShadow />
      <Blocks at={b.out} material={mat} color />
      {kind === 'sirenes' && night && <Herd species={SEA_TURTLE} animals={turtles.a} brain={turtles.b} far={80} />}
      <People list={people} />
    </group>
  )
}

/* ---------- Taï Forêt Excursions ---------- */

export function TaiAgence({ night }: { night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const sign = useMemo(() => {
    const l = lettering(tr('TAÏ FORÊT EXCURSIONS'), '#2b8a3e', '#fff6d6', '#ffd43b')
    return { m: signMaterial(l.t), aspect: l.aspect }
  }, [])
  sign.m.emissiveIntensity = night ? 0.7 : 0
  const at = useMemo(() => {
    const out: At[] = []
    put(out, [0, -2, 0], [[0, 1.6, 0, 7, 3.2, 5, '#f4f1e6'], [0, 3.3, 0.4, 7.6, 0.2, 6.2, '#2b8a3e'], [0, 1.2, 2.52, 2.2, 2.4, 0.05, '#3a2a1a'], [2.4, 1.8, 2.52, 1.6, 1.2, 0.05, '#5c8fb3']])
    return out
  }, [])
  const guide = usePeople('tai-agence', [{ p: [3.5, 0, 6], ry: -0.6, pose: 'talk', dress: { outfit: 'uniforme', outfitColor: '#4f5e36' } }])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <mesh position={[0, 4.1, 3.75]} material={sign.m}>
        <planeGeometry args={[6.4, 6.4 / sign.aspect]} />
      </mesh>
      <SafariTruck p={[-5, 0, 7]} ry={0.2} />
      <People list={guide} />
    </group>
  )
}

/* ---------- The Cathédrale Saint-Pierre ---------- */

// The town's cathedral (route de Tabou, where the map has it, some 38 by 42 m): as the game draws it, a nave
// under one great roof whose gable faces the street, its triangle of stained glass blue as the sea with the
// fisherman's boat (Peter was one), the cross on the apex, the porch, the bell tower beside it, the keys
// of Saint Peter in gold over the door. The shapes are the game's estimate, not a survey.

/** A triangle `w` wide, `h` high, pushed `d` deep along +z from z 0. */
function gable(w: number, h: number, d: number) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false })
}

/** The keys of Saint Peter, crossed: two diagonal rows of small gold blocks and their bits. In the xy plane. */
function keys(): Part[] {
  const out: Part[] = []
  for (const s of [-1, 1]) {
    for (let i = -4; i <= 4; i++) out.push([i * 0.22 * s, i * 0.22, 0, 0.24, 0.24, 0.08, '#d9b34a'])
    out.push([4.6 * 0.22 * s, 4.6 * 0.22, 0, 0.5, 0.5, 0.08, '#d9b34a'], [-4.2 * 0.22 * s - 0.25 * s, -4.2 * 0.22, 0, 0.3, 0.2, 0.08, '#d9b34a'])
  }
  return out
}

export function CathedraleSP({ night }: { night: boolean }) {
  const mat = useMemo(() => {
    const m = blocksMat()
    m.emissive = new THREE.Color('#ffe8c0')
    return m
  }, [])
  mat.emissiveIntensity = night ? 0.12 : 0
  const mats = useMemo(
    () => ({
      roof: new THREE.MeshLambertMaterial({ color: '#46586a' }),
      wall: new THREE.MeshLambertMaterial({ color: '#f4efe3', emissive: '#ffe8c0', emissiveIntensity: 0 }),
      glass: (() => {
        const c = document.createElement('canvas')
        c.width = c.height = 32
        const g = c.getContext('2d')!
        const r = seeded(13)
        for (let y = 0; y < 32; y += 2) for (let x = 0; x < 32; x += 2) ((g.fillStyle = ['#1f4fa8', '#2a6fd6', '#16357a', '#3b82d8', '#1aa3b8'][Math.floor(r() * 5)]), g.fillRect(x, y, 2, 2))
        // The boat on the waves, its sail, the sun over it.
        g.fillStyle = '#8a4a1a'
        g.fillRect(8, 22, 16, 3)
        g.fillRect(10, 25, 12, 2)
        g.fillStyle = '#f4f1e6'
        g.fillRect(15, 10, 2, 12)
        g.fillRect(17, 12, 5, 8)
        g.fillStyle = '#f2b51d'
        g.fillRect(14, 4, 4, 4)
        const t = new THREE.CanvasTexture(c)
        t.magFilter = THREE.NearestFilter
        t.colorSpace = THREE.SRGBColorSpace
        return new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.1 })
      })(),
      paving: new THREE.MeshLambertMaterial({ color: '#d9d3c4', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    }),
    [],
  )
  mats.wall.emissiveIntensity = night ? 0.12 : 0
  mats.glass.emissiveIntensity = night ? 1 : 0.1
  const geo = useMemo(() => ({ roof: gable(34, 13, 37), front: gable(30, 11.5, 0.6), window: gable(16, 7.5, 0.1) }), [])
  const b = useMemo(() => {
    const out: At[] = []
    // The nave's walls, the tall slits of coloured glass down both sides, the base.
    out.push({ p: [0, 4.5, 0], s: [30, 9, 36], c: '#f4efe3' }, { p: [0, 0.4, 0], s: [30.4, 0.8, 36.4], c: '#c9bfa9' })
    for (let z = -14; z <= 14; z += 4) for (const x of [-15.03, 15.03]) out.push({ p: [x, 4.6, z], s: [0.08, 6, 1], c: ['#2a6fd6', '#d62f2f', '#f2b51d', '#1aa3b8'][((z + 14) / 4) % 4] })
    // The porch on four columns, the doors, the keys over them; the cross on the apex.
    put(out, [0, 20.5, 0], [[0, 4.6, 0, 12, 0.6, 5, '#f4efe3'], ...[-5.4, -1.8, 1.8, 5.4].map((x): Part => [x, 2.2, 2.2, 0.6, 4.4, 0.6, '#f4efe3']), [0, 0.15, 0, 12, 0.3, 5, '#c9bfa9']])
    out.push({ p: [0, 2.4, 18.1], s: [4, 4.8, 0.2], c: '#6b4426' }, { p: [0, 2.4, 18.22], s: [0.1, 4.6, 0.05], c: '#3a2416' })
    put(out, [0, 18.7, 0], keys(), 6.3)
    out.push({ p: [0, 9 + 11.5 + 2.6, 18.6], s: [0.5, 5.2, 0.5], c: '#f4efe3' }, { p: [0, 9 + 11.5 + 3.4, 18.6], s: [2.8, 0.5, 0.5], c: '#f4efe3' })
    // The bell tower beside the front: the shaft, the open belfry on its four posts, the bell, the cross.
    put(out, [19.5, 14, 0], [[0, 10, 0, 4, 20, 4, '#f4efe3'], ...[[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]].map(([x, z]): Part => [x, 22.5, z, 0.6, 5, 0.6, '#f4efe3']), [0, 25.3, 0, 4.6, 0.6, 4.6, '#f4efe3'], [0, 22.6, 0, 1.4, 1.6, 1.4, '#c9a14a'], [0, 26.6, 0, 2, 2, 2, '#46586a'], [0, 29, 0, 0.3, 3, 0.3, '#d9b34a'], [0, 29.6, 0, 1.4, 0.3, 0.3, '#d9b34a'], [0, 6, 2.02, 1.2, 1.8, 0.05, '#2a6fd6']])
    // Saint Peter on his plinth in the forecourt, his key raised.
    put(out, [-10, 24, 0], [[0, 0.8, 0, 1.6, 1.6, 1.6, '#c9bfa9'], [0, 2.3, 0, 0.9, 1.4, 0.6, '#f4f1ea'], [0, 3.3, 0, 0.5, 0.5, 0.5, '#f4f1ea'], [0.6, 2.9, 0.2, 0.2, 0.9, 0.2, '#f4f1ea'], [0.6, 3.5, 0.2, 0.3, 0.4, 0.1, '#d9b34a']])
    return out
  }, [])
  const people = usePeopleKit('sp-cathedrale', [
    { p: [-2, 0, 24], ry: Math.PI, pose: 'walk', gender: 'femme', dress: { outfit: 'pagne', outfitColor: '#1c7ed6' } },
    { p: [-1, 0, 25], ry: Math.PI, pose: 'walk', gender: 'homme', dress: { outfit: 'chemise', outfitColor: '#f4f1ea' } },
    { p: [3, 0, 21.5], ry: 0.4, pose: 'talk', gender: 'homme', dress: { outfit: 'soutane', outfitColor: '#f4f1ea' } },
    { p: [-9, 0, 26.5], ry: Math.PI, pose: 'pray', gender: 'femme' },
  ])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 4]} material={mats.paving} receiveShadow>
        <planeGeometry args={[48, 50]} />
      </mesh>
      <Blocks at={b} material={mat} color />
      <mesh geometry={geo.roof} position={[0, 9, -19]} material={mats.roof} castShadow />
      <mesh geometry={geo.front} position={[0, 9, 18]} material={mats.wall} castShadow />
      <mesh geometry={geo.window} position={[0, 10.2, 18.62]} material={mats.glass} />
      <KitPeople list={people} />
    </group>
  )
}

/* ---------- The Bardot ---------- */

// The Bardot, San-Pédro's great popular quarter: as the game draws it, one of its lanes off the street,
// dense and alive, the little units side by side under their sheet roofs (the buvettes with their crates
// and their speakers, the garba stall, the boutique, the hairdresser, the phone-credit table, the
// tailor), the cables strung across, the bulbs at night, the motos. Every sign is the game's.

/** A unit of the lane, facing +x (the lane): its painted walls, its sheet roof sloping over the lane, what it is. */
function unit(kind: number, wall: string): Part[] {
  const out: Part[] = [[-1.8, 1.5, 0, 0.2, 3, 4, wall], [0, 1.5, -2, 3.8, 3, 0.2, wall], [0, 1.5, 2, 3.8, 3, 0.2, wall], [0.4, 3.15, 0, 4.8, 0.1, 4.4, ['#8f979e', '#a0522d', '#7a5a3a'][kind % 3], 0], [0, 0.04, 0, 3.6, 0.08, 4, '#8d8478']]
  if (kind === 0) out.push([0.6, 0.55, 0, 0.5, 1.1, 3, '#6b4a2a'], [-1.2, 0.45, -1, 0.6, 0.9, 0.7, '#f4f4f2'], ...[0, 1, 2].map((i): Part => [-1.3, 0.2 + i * 0.3, 1.2, 0.5, 0.28, 0.4, i % 2 ? '#c92a2a' : '#f0b429']), [1.7, 0.6, 1.6, 0.6, 1.2, 0.5, '#1c1c1e'], [2.6, 0.25, -1, 1.8, 0.1, 0.4, '#8a6a3c'])
  else if (kind === 1) out.push([1.2, 0.8, 0, 1, 0.08, 2.6, '#8a6a3c'], [1.2, 0.4, 0, 0.9, 0.8, 0.08, '#7a5a32'], [1.2, 0.95, -0.6, 0.5, 0.25, 0.5, '#f4f1e6'], [1.2, 0.9, 0.4, 0.5, 0.08, 0.3, '#a8805a'], [1.2, 0.9, 0.9, 0.5, 0.08, 0.3, '#a8805a'], [-0.6, 0.25, 0, 0.8, 0.5, 0.8, '#1c1c1e'], [-0.6, 0.55, 0, 0.6, 0.1, 0.6, '#e0b030'])
  else if (kind === 2) out.push([-1.5, 1.4, 0, 0.5, 2.6, 3.6, '#7a5a32'], ...[0.6, 1.2, 1.8, 2.4].flatMap((y, i): Part[] => [[-1.3, y, -0.8, 0.3, 0.4, 1, ['#e03131', '#1971c2', '#f08c00', '#2f9e44'][i]], [-1.3, y, 0.6, 0.3, 0.4, 1, ['#ffd43b', '#e03131', '#1971c2', '#f4f4f2'][i]]]), [1.0, 0.5, 0, 0.6, 1, 3, '#c9d6e0'])
  else if (kind === 3) out.push([-1.4, 1.4, 0, 0.1, 1.2, 1, '#c9d6e0'], [-0.6, 0.35, 0, 0.6, 0.7, 0.6, '#c92a2a'], [-0.6, 0.85, 0.25, 0.6, 0.6, 0.1, '#c92a2a'], [1, 0.3, 1.4, 0.4, 0.6, 0.4, '#f4f4f2'])
  else out.push([1.4, 0.75, 0, 0.8, 0.08, 1.2, '#8a6a3c'], [1.4, 0.37, 0, 0.1, 0.74, 0.1, '#8a6a3c'], [1.4, 0.9, 0, 0.4, 0.2, 0.3, '#1c1c1e'], [-0.8, 1.2, 0, 0.1, 1.6, 3, '#e9ecef'], ...[0, 1, 2].map((i): Part => [-0.7, 1.3, -1 + i, 0.06, 1.2, 0.7, ['#e8590c', '#1c7ed6', '#2f9e44'][i]]))
  return out
}
const WALLS = ['#f08c00', '#4dabf7', '#f4f1e6', '#69db7c', '#ffd43b', '#e599f7', '#ff8787', '#c9bfa9']

export function Bardot({ night }: { night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const tube = useMemo(() => new THREE.MeshLambertMaterial({ color: '#d8dde2', emissive: '#eef6ff', emissiveIntensity: 0 }), [])
  tube.emissiveIntensity = night ? 1.2 : 0
  const glow = useMemo(() => [new THREE.MeshLambertMaterial({ color: '#ff6b6b', emissive: '#ff6b6b', emissiveIntensity: 0.15 })], [])
  const lane = useMemo(() => new THREE.MeshLambertMaterial({ color: '#8a6a45', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), [])
  const signs = [useSign(tr('BUVETTE LE RELAIS'), '#c92a2a', '#fff3bf', night), useSign(tr('GARBA CHEZ TANTIE'), '#f08c00', '#1c1c1e', night), useSign(tr('COIFFURE BÉNÉDICTION'), '#1971c2', '#ffffff', night), useSign(tr('CABINE · TRANSFERT'), '#2f9e44', '#ffffff', night)]
  const b = useMemo(() => {
    const r = seeded(29)
    const out: At[] = []
    const bulbs: At[] = []
    const cables: At[] = []
    const tubes: At[] = []
    // The units either side of the lane (x ±3, the lane between), from the street (+z) inward.
    for (let i = 0; i < 12; i++) {
      const z = 20 - i * 4.2
      for (const side of [-1, 1]) {
        const kind = (i * 2 + (side > 0 ? 1 : 0)) % 5
        put(out, [side * 5, z, side > 0 ? Math.PI : 0], unit(kind, WALLS[Math.floor(r() * WALLS.length)]))
        if (kind === 0 || kind === 2) tubes.push({ p: [side * 3.3, 2.9, z], s: [0.12, 0.08, 1.4] })
      }
      // Cables zigzagging across, bulbs on some.
      if (i % 2 === 0) stringLights(bulbs, cables, [-3, 3.6, z], [3, 3.6, z - 3], 6, i)
    }
    out.push(...cables)
    // The gutter down one side of the lane, motos parked, a pushcart, a water seller's barrow, kids' ball.
    out.push({ p: [-2.6, 0.03, -3], s: [0.5, 0.06, 50], c: '#4a5a52' })
    for (const [x, z, ry] of [[2.2, 14, 0.2], [-2, 4, -0.1], [2.4, -10, 0.1]]) put(out, [x, z, ry], [[0, 0.5, 0, 0.25, 0.4, 1.7, ['#c92a2a', '#1c1c1e', '#1971c2'][Math.abs(Math.round(z)) % 3]], [0, 0.3, 0.75, 0.1, 0.6, 0.1, '#1c1c1e'], [0, 0.3, -0.75, 0.1, 0.6, 0.1, '#1c1c1e'], [0, 0.85, 0.5, 0.6, 0.06, 0.06, '#8a8a8a']])
    put(out, [-1.6, -16, 0.3], [[0, 0.6, 0, 1.2, 0.5, 2, '#2f6db3'], [0, 0.25, 0.8, 0.5, 0.5, 0.1, '#1c1c1e'], ...[0, 1, 2, 3].map((i): Part => [-0.3 + (i % 2) * 0.6, 1.05, -0.5 + Math.floor(i / 2) * 0.8, 0.4, 0.4, 0.5, '#4dabf7'])])
    out.push({ p: [0.6, 0.15, 6], s: [0.3, 0.3, 0.3], c: '#f4f4f2' })
    return { out, bulbs, tubes }
  }, [])
  const people = usePeopleKit('bardot', [
    { p: [4.8, 0, 20], ry: -Math.PI / 2, pose: 'cook', gender: 'femme', dress: { outfit: 'pagne', outfitColor: '#e8590c' } },
    { p: [2.4, 0, 20.3], ry: Math.PI / 2, pose: 'pay' },
    { p: [-2.4, 0, 20.6], ry: -Math.PI / 2, pose: 'drink' },
    { p: [-1.6, 0, 18.8], ry: -Math.PI / 2, pose: 'dance' },
    { p: [0, 0, 10], ry: Math.PI, pose: 'walk', gender: 'femme', dress: { outfit: 'pagne', outfitColor: '#2f9e44' } },
    { p: [0.8, 0, 2], ry: 0, pose: 'carry', gender: 'femme', dress: { outfit: 'pagne', outfitColor: '#1c7ed6' } },
    { p: [-0.6, 0, -4], ry: Math.PI, pose: 'phone' },
    { p: [1.2, 0, 6.6], ry: 0.6, pose: 'kick', gender: 'homme' },
    { p: [3.6, 0, -7.4], ry: -Math.PI / 2, pose: 'busy', gender: 'homme' },
    { p: [-3.4, 0, -12], ry: Math.PI / 2, pose: 'sit' },
    { p: [0.2, 0, -14], ry: 0.2, pose: 'talk' },
  ])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -3]} material={lane} receiveShadow>
        <planeGeometry args={[18, 54]} />
      </mesh>
      <Blocks at={b.out} material={mat} color />
      <Bulbs at={b.bulbs} night={night} />
      <Blocks at={b.tubes} material={tube} />
      <Blocks at={BARDOT_NEON} material={glow[0]} />
      <Beat mats={glow} night={night} bpm={112} reach={60} />
      {signs.map((s, i) => (
        <Sign key={i} s={s} w={3.6} p={BARDOT_SIGNS[i]} ry={BARDOT_SIGNS[i][0] > 0 ? -Math.PI / 2 : Math.PI / 2} />
      ))}
      <KitPeople list={people} />
    </group>
  )
}
/** Where the signs hang, over the fronts of the buvette, the garba, the hairdresser, the cabine (x, y, z). */
const BARDOT_SIGNS: [number, number, number][] = [[-3.15, 2.75, 20], [3.15, 2.75, 20], [3.15, 2.75, 15.8], [-3.15, 2.75, 11.6]]
/** The buvette's strip of red neon over its counter, beating with its music. */
const BARDOT_NEON: At[] = [{ p: [-3.2, 3.0, 20], s: [0.1, 0.12, 3.6] }]

/* ---------- The Maquis Le Mérou Braisé, Le Cargo Club ---------- */

const MEROU: MaquisSpec = {
  name: 'LE MÉROU BRAISÉ',
  sign: ['#0b4f6c', '#ffd43b'],
  wall: '#f4f1e6',
  roof: 'straw',
  food: 'fish',
  plastic: ['#ffffff', '#1971c2', '#ffffff'],
  seed: 21,
  // The cool boxes of the day's fish, the table of mérous and capitaines laid out, a pirogue on its side, coconut palms.
  extra: [
    [-3.4, 0.45, 6.2, 1.2, 0.9, 0.8, '#1c7ed6'], [-3.4, 0.92, 6.2, 1.24, 0.08, 0.84, '#f4f4f2'], [-2.2, 0.4, 6.2, 1, 0.8, 0.7, '#f4f4f2'],
    [4.4, 0.8, 6.2, 2.4, 0.08, 1, '#8a6a3c'], [4.4, 0.4, 6.2, 2.2, 0.8, 0.08, '#7a5a32'], [3.8, 0.92, 6.2, 0.9, 0.18, 0.36, '#c4553a'], [4.8, 0.92, 6.1, 0.8, 0.14, 0.3, '#b8c4cc'], [5.2, 0.92, 6.4, 0.7, 0.14, 0.28, '#c4553a'],
    [9.5, 0.5, 2, 1.3, 0.7, 9, '#1c7ed6', 0.2], [9.5, 0.75, 2, 1.36, 0.16, 8.6, '#f0b429', 0.2],
    ...[[-9, -3], [9, -5], [-9.5, 6]].flatMap(([x, z]): Part[] => [[x, 4, z, 0.4, 8, 0.4, '#8a7a64'], ...[0, 1, 2, 3, 4].map((k): Part => [x + Math.cos(k * 1.26) * 1.5, 8, z + Math.sin(k * 1.26) * 1.5, 3.2, 0.14, 0.8, '#4e8a3a', -k * 1.26])]),
  ],
}
const CARGO: ClubSpec = {
  name: 'LE CARGO CLUB',
  neon: '#22b8cf',
  neon2: '#ff922b',
  wall: '#1b2a3a',
  seed: 13,
  bpm: 126,
  // Shipping containers stacked on its roof (the port's), a lifebuoy by the door, an anchor on the front.
  motif: [
    [-4, 8.7, -2, 6, 2.6, 2.44, '#e8590c'], [3, 8.7, -2, 6, 2.6, 2.44, '#1971c2'], [-0.5, 11.3, -2, 6, 2.6, 2.44, '#2f9e44'], [-0.5, 8.7, 1.2, 6, 2.6, 2.44, '#f0b429'],
    ...[-4, 3, -0.5].map((x, i): Part => [x + 3.02, i === 2 ? 11.3 : 8.7, -2, 0.04, 2.4, 2.2, '#2a2a2a']),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((k): Part => [3.2 + Math.cos((k / 8) * Math.PI * 2) * 0.6, 2.2 + Math.sin((k / 8) * Math.PI * 2) * 0.6, 5.1, 0.36, 0.36, 0.12, k % 2 ? '#ffffff' : '#ff6b00']),
    [-5, 4, 5.1, 0.3, 2.6, 0.1, '#c0c6cc'], [-5, 5.2, 5.1, 1.2, 0.25, 0.1, '#c0c6cc'], [-5, 2.8, 5.1, 2, 0.3, 0.1, '#c0c6cc'], [-5.9, 3.1, 5.1, 0.3, 0.6, 0.1, '#c0c6cc'], [-4.1, 3.1, 5.1, 0.3, 0.6, 0.1, '#c0c6cc'],
  ],
}

export const MaquisMerou = ({ night }: { night: boolean }) => <Maquis spec={MEROU} night={night} />
export const CargoClub = ({ night }: { night: boolean }) => <Club spec={CARGO} night={night} />
