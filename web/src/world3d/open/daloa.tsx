import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Blocks } from './ruePrincesse'
import type { At } from './shoreline'
import { put, blocksMat, seeded, strawRoof, type Part } from './kit3d'
import { Flock } from './wildlife'
import { t as tr } from '../../lib/i18n'
import { Club, Maquis, Market, Near, People, Sign, SmallHotel, usePeople, useSign, type ClubSpec, type MaquisSpec, type MarketSpec } from './villeKit'

// Daloa's landmarks (the update « daloa-vivant », backend game/villes3.go), in the game's blocks, each mostly
// drawn at once (kit3d.ts):
// - the grand marché and, by its gate, the corner where the pisteurs weigh the planters' cocoa;
// - the Gnaoré family's cocoa plantation: the trees with their pods on the trunks, the banana trees for
//   shade, the heap of pods split open, the beans fermenting under the leaves, the claies where they dry;
// - the bank of the Lobo: the fishermen's pirogues, their nasses, the reeds;
// - the Cour des Anciens bétés: the yard under the bâches, the drums, the dancers;
// - the Cathédrale du Christ-Roi, the great mosque, the maquis, the club, the hotel.
// All layouts are the game's own, not surveyed. Frames: +z the street (the place's door).

const GREENS = ['#2f6a30', '#3c7a36', '#28592a', '#4c8a3a']
const JUTE = ['#b08a56', '#a47f4c', '#bc9662']
/** A cocoa tree: the low fork, the big leaves, the pods straight on the trunk and branches (yellow, orange, green). */
function cocoaTree(r: () => number): Part[] {
  const out: Part[] = [
    [0, 1, 0, 0.26, 2, 0.26, '#6e5640'],
    [0.5, 2.2, 0, 0.16, 1.2, 0.16, '#6e5640', 0.4],
    [-0.5, 2.2, 0, 0.16, 1.2, 0.16, '#6e5640', -0.4],
    [0, 3, 0, 2.6, 1.2, 2.2, GREENS[Math.floor(r() * 4)]],
    [0.3, 3.6, 0.2, 1.6, 0.6, 1.4, GREENS[Math.floor(r() * 4)]],
  ]
  for (let k = 0; k < 4; k++) out.push([Math.cos(k * 1.7) * 0.2, 0.7 + k * 0.38, Math.sin(k * 1.7) * 0.2, 0.2, 0.36, 0.2, ['#e8b81a', '#e0701a', '#5c9e31', '#d9a017'][(k + Math.floor(r() * 4)) % 4]])
  return out
}
/** A banana tree for the shade: its trunk, its long leaves. */
const banana = (): Part[] => [[0, 1.6, 0, 0.3, 3.2, 0.3, '#7d8f4a'], ...[0, 1, 2, 3, 4].map((k): Part => [Math.cos(k * 1.25) * 0.9, 3.4, Math.sin(k * 1.25) * 0.9, 2, 0.06, 0.5, '#5c9e31', -k * 1.25]), [0.3, 2.6, 0.3, 0.3, 0.5, 0.3, '#4c7a2a']]
/** A claie: the drying table raised on its legs, the beans spread brown on its mat. */
const claie = (beans: string): Part[] => [
  ...[-1.6, 1.6].flatMap((x): Part[] => [
    [x, 0.45, -0.6, 0.1, 0.9, 0.1, '#6b4a2a'],
    [x, 0.45, 0.6, 0.1, 0.9, 0.1, '#6b4a2a'],
  ]),
  [0, 0.92, 0, 3.6, 0.06, 1.5, '#c8a86a'],
  [0, 0.97, 0, 3.3, 0.05, 1.3, beans],
]

/* ---------- The grand marché and the cocoa's scales ---------- */

/** The pisteur's corner: the platform scale, the bags waiting, his table and his ledger, the weights. In the market's frame. */
const SCALES: Part[] = [
  [10, 0.06, 18, 6, 0.12, 4, '#9a9a92'],
  [9, 0.25, 18, 1.4, 0.3, 1.4, '#3a5a7a'],
  [9, 1.1, 17.4, 0.12, 1.6, 0.12, '#3a5a7a'],
  [9, 1.9, 17.4, 0.7, 0.5, 0.1, '#e9ecef'],
  [9, 1.9, 17.46, 0.5, 0.06, 0.02, '#c92a2a'],
  [9, 0.75, 18, 0.7, 0.5, 0.9, JUTE[0]],
  ...[0, 1, 2, 3, 4, 5].map((i): Part => [11 + (i % 3) * 0.8, 0.3 + Math.floor(i / 3) * 0.48, 19.2, 0.7, 0.46, 0.9, JUTE[i % 3]]),
  [12, 0.8, 16.8, 1.8, 0.08, 0.9, '#8a6a3c'],
  [12, 0.4, 16.8, 1.6, 0.8, 0.06, '#7a5a32'],
  [11.7, 0.88, 16.8, 0.5, 0.06, 0.36, '#f4f1e6'],
  [12.4, 0.92, 16.8, 0.18, 0.12, 0.18, '#495057'],
]
const DALOA_MARCHE: MarketSpec = {
  gate: 'GRAND MARCHÉ DE DALOA',
  sign: ['#7a3b1a', '#fff3bf'],
  seed: 53,
  w: 32,
  d: 28,
  // Plantain green and yellow, attiéké, tomatoes, okra, cocoa beans, palm oil, onions, pagnes.
  goods: ['#5c9e31', '#e8c33a', '#f4f1e6', '#e03131', '#4c8a3a', '#6b3a1a', '#c2410c', '#c9a46a', '#1c7ed6'],
  // Wax pagnes hung to sell.
  hangings: ['#1c7ed6', '#e8590c', '#2f9e44', '#c92a2a'].map((c): Part[] => [
    [0, 1.4, 0, 1.4, 1.6, 0.04, c],
    [0, 1.4, 0.03, 1.2, 0.3, 0.02, '#ffd43b'],
  ]),
  hall: { w: 22, d: 14, h: 5, roof: '#9aa3aa' },
  extra: SCALES,
}
export function MarcheDaloa({ night }: { night: boolean }) {
  const pisteur = usePeople('daloa-pisteur', [
    { p: [12, 0, 16.1], ry: 0, pose: 'write', gender: 'homme' },
    { p: [9.9, 0, 18.6], ry: -1.4, pose: 'point', gender: 'homme' },
    { p: [8.2, 0, 19.2], ry: 1.8, pose: 'talk', gender: 'homme' },
    { p: [11.4, 0, 20.4], ry: Math.PI, pose: 'carry', gender: 'homme' },
  ])
  return (
    <group>
      <Market spec={DALOA_MARCHE} night={night} />
      <People list={pisteur} />
    </group>
  )
}

/* ---------- The Gnaoré cocoa plantation ---------- */

export function PlantationCacao({ night }: { night: boolean }) {
  void night
  const mat = useMemo(blocksMat, [])
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(271)
    // The cocoa trees in rows behind (−z), under the banana trees and a few big forest trees kept for shade.
    for (let i = 0; i < 40; i++) put(out, [-18 + (i % 10) * 4 + r() * 0.8, -4 - Math.floor(i / 10) * 4.2, r() * 3], cocoaTree(r))
    for (let i = 0; i < 8; i++) put(out, [-16 + i * 4.6 + r(), -6 - (i % 3) * 4, r() * 3], banana())
    for (let i = 0; i < 3; i++)
      put(
        out,
        [-14 + i * 14, -20, 0],
        [
          [0, 6, 0, 1, 12, 1, '#7d6a55'],
          [0, 13, 0, 9, 3, 8, GREENS[i]],
          [1, 15, 0.6, 6, 2, 6, GREENS[i + 1]],
        ],
      )
    // The yard in front: the heap of pods brought in, the split husks, the beans fermenting under banana leaves.
    for (let i = 0; i < 18; i++) out.push({ p: [-7 + (r() - 0.5) * 2.4, 0.15 + (i % 3) * 0.16, 2 + (r() - 0.5) * 2], s: [0.24, 0.2, 0.42], ry: r() * 3, c: ['#e8b81a', '#e0701a', '#d9a017'][i % 3] })
    for (let i = 0; i < 12; i++) out.push({ p: [-3.6 + (r() - 0.5) * 2, 0.08, 3 + (r() - 0.5) * 1.6], s: [0.3, 0.12, 0.4], ry: r() * 3, c: i % 2 ? '#a8601a' : '#8a4a12' })
    out.push({ p: [-0.5, 0.25, 1.4], s: [2.4, 0.5, 1.8], c: '#f2ead6' }, { p: [-0.5, 0.52, 1.4], s: [2.8, 0.1, 2.2], c: '#5c9e31' }, { p: [-0.3, 0.6, 1.2], s: [1.2, 0.08, 2.4], c: '#4c8a3a', ry: 0.4 })
    // The claies in two rows, the beans on them brown (dry) or paler (just out of the fermenting).
    for (let i = 0; i < 6; i++) put(out, [3 + (i % 3) * 4.4, 4 + Math.floor(i / 3) * 3, 0], claie(i % 3 === 0 ? '#9a6a3a' : '#6b3a1a'))
    // The appatam where the planters rest, the jute bags filled, the moto that takes them to the pisteur.
    put(
      out,
      [-10, 7, 0.3],
      [
        ...[-2, 2].flatMap((x): Part[] => [
          [x, 1.3, -1.6, 0.18, 2.6, 0.18, '#6b4a2a'],
          [x, 1.3, 1.6, 0.18, 2.6, 0.18, '#6b4a2a'],
        ]),
        ...strawRoof(2.8, 1.4, 2.6),
        [0, 0.45, 0, 2.6, 0.1, 0.8, '#8a6a3c'],
      ],
    )
    for (let i = 0; i < 6; i++) out.push({ p: [-4.6 + (i % 3) * 0.75, 0.3 + Math.floor(i / 3) * 0.46, 8], s: [0.68, 0.44, 0.9], c: JUTE[i % 3] })
    put(
      out,
      [-1.6, 8.6, 0.3],
      [
        [0, 0.5, 0, 0.25, 0.4, 1.7, '#c92a2a'],
        [0, 0.3, 0.75, 0.1, 0.6, 0.1, '#1c1c1e'],
        [0, 0.3, -0.75, 0.1, 0.6, 0.1, '#1c1c1e'],
        [0, 0.85, 0.5, 0.6, 0.06, 0.06, '#8a8a8a'],
        [0, 0.95, -0.5, 0.7, 0.44, 0.9, JUTE[1]],
      ],
    )
    // The path in, the ground of dead leaves.
    out.push({ p: [0, 0.03, 9], s: [2.4, 0.06, 6], c: '#8a6a45' })
    for (let i = 0; i < 30; i++) out.push({ p: [(r() - 0.5) * 36, 0.02, -2 - r() * 16], s: [0.5, 0.03, 0.3], ry: r() * 3, c: ['#8a5a2a', '#a0703a', '#5e3e1e'][i % 3] })
    return out
  }, [])
  const people = usePeople('plantation-gens', [
    { p: [-12, 0, -4.6], ry: 0.2, pose: 'pick', gender: 'homme' },
    { p: [-7, 0, 3.4], ry: Math.PI, pose: 'busy', gender: 'homme' },
    { p: [-6, 0, 1], ry: -0.4, pose: 'carry', dress: { outfit: 'pagne', outfitColor: '#2f9e44' } },
    { p: [7.4, 0, 2.8], ry: 0, pose: 'sweep', dress: { outfit: 'pagne', outfitColor: '#e8590c' } },
    { p: [-10, 0, 7.2], ry: 0.6, pose: 'sitground', gender: 'homme' },
    { p: [6, 0, -8], ry: 2.4, pose: 'pick', gender: 'femme' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
      <Flock centre={[0, -10]} radius={18} height={16} n={6} color="#2a2624" seed="plantation-calaos" />
    </group>
  )
}

/* ---------- The bank of the Lobo ---------- */

/** A pirogue dug out of one trunk: long, low, dark; facing +x. */
const pirogue = (len: number): Part[] => [
  [0, 0.25, 0, len, 0.5, 0.9, '#5a3e24'],
  [0, 0.46, 0, len - 0.4, 0.06, 0.7, '#3a2814'],
  [len / 2 + 0.2, 0.32, 0, 0.6, 0.4, 0.5, '#5a3e24'],
  [-len / 2 - 0.2, 0.32, 0, 0.6, 0.4, 0.5, '#5a3e24'],
]

export function BordLobo({ night }: { night: boolean }) {
  void night
  const mat = useMemo(blocksMat, [])
  const water = useMemo(() => new THREE.MeshLambertMaterial({ color: '#3f7a78', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [])
  const glide = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    // A pirogue going down the river, the fisherman poling, and back up again.
    if (!glide.current) return
    const t = clock.elapsedTime * 0.05
    const k = t % 2 < 1 ? t % 1 : 2 - (t % 2)
    glide.current.position.set(-40 + k * 80, 0.02 + Math.sin(clock.elapsedTime * 1.4) * 0.04, -12)
    glide.current.rotation.y = t % 2 < 1 ? 0 : Math.PI
  })
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(281)
    // The bank sloping down to the water (the river runs along x at −z), the far bank's forest.
    out.push({ p: [0, -0.3, -4], s: [100, 0.6, 3], c: '#7a5a3a' })
    for (let i = 0; i < 24; i++) out.push({ p: [(r() - 0.5) * 96, 0.4, -5 - r() * 1.6], s: [0.12, 0.8 + r() * 0.8, 0.12], c: i % 2 ? '#7aa83a' : '#5c8a2a' })
    for (let i = 0; i < 20; i++)
      put(
        out,
        [(r() - 0.5) * 100, -24 - r() * 6, r() * 3],
        [
          [0, 4, 0, 0.6, 8, 0.6, '#6e5640'],
          [0, 8.6, 0, 4 + r() * 2, 2.4, 4, GREENS[i % 4]],
        ],
        -0.2,
      )
    for (let i = 0; i < 30; i++) out.push({ p: [(r() - 0.5) * 100, 0.6, -20 - r() * 2], s: [2.4, 1.4 + r(), 1.4], c: GREENS[(i + 2) % 4] })
    // The landing: the pirogues pulled up, the paddles, the nets drying on their poles, the fishermen's shelter.
    for (let i = 0; i < 3; i++) put(out, [-6 + i * 3.4, -2.6 - (i % 2) * 0.6, 0.15 * i], pirogue(5.4))
    for (let i = 0; i < 3; i++) out.push({ p: [-6 + i * 3.4 + 1.2, 0.5, -2.2], s: [0.1, 0.06, 2.4], ry: 0.3, c: '#8a6a3c' })
    for (const x of [6, 9, 12]) out.push({ p: [x, 1.1, 1], s: [0.12, 2.2, 0.12], c: '#6b4a2a' })
    out.push({ p: [9, 2.1, 1], s: [6, 0.04, 0.04], c: '#3a2a1a' }, { p: [9, 1.5, 1.02], s: [5.6, 1.1, 0.03], c: '#c9d6e0' })
    put(
      out,
      [-12, 3, 0],
      [
        [0, 0.04, 0, 3.4, 0.06, 3, '#a0703a'],
        ...strawRoof(2.2, 1.2, 2.3),
        ...[-1.4, 1.4].flatMap((x): Part[] => [
          [x, 1.2, -1.2, 0.14, 2.4, 0.14, '#6b4a2a'],
          [x, 1.2, 1.2, 0.14, 2.4, 0.14, '#6b4a2a'],
        ]),
      ],
    )
    // The nasses (the long cone traps of woven palm) set in the shallows, stakes marking them.
    for (let i = 0; i < 6; i++)
      put(
        out,
        [-20 + i * 7, -9 - (i % 2) * 3, 0.4],
        [
          [0, -0.05, 0, 1.6, 0.4, 0.5, '#c8a86a'],
          [0.9, -0.05, 0, 0.3, 0.26, 0.3, '#a8884a'],
          [-0.9, 0.4, 0, 0.08, 1.2, 0.08, '#6b4a2a'],
        ],
      )
    // The basins of the day's catch on the bank.
    for (let i = 0; i < 3; i++) out.push({ p: [2 + i * 1.1, 0.2, 3], s: [0.9, 0.3, 0.9], c: ['#1c7ed6', '#e03131', '#f08c00'][i] }, { p: [2 + i * 1.1, 0.38, 3], s: [0.6, 0.06, 0.6], c: '#b8c4cc' })
    return out
  }, [])
  const boat = useMemo(() => {
    const out: At[] = []
    put(out, [0, 0, 0], pirogue(5))
    return out
  }, [])
  const people = usePeople('lobo-gens', [
    { p: [-12, 0, 3], ry: 0.4, pose: 'sitground', gender: 'homme' },
    { p: [4, 0, 3.8], ry: Math.PI, pose: 'busy', dress: { outfit: 'pagne', outfitColor: '#1c7ed6' } },
    { p: [8, 0, 2], ry: 0, pose: 'busy', gender: 'homme' },
  ])
  const poler = usePeople('lobo-perche', [{ p: [1.4, 0.4, 0], ry: Math.PI / 2, pose: 'push', gender: 'homme' }])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, -13]} material={water}>
        <planeGeometry args={[110, 14]} />
      </mesh>
      <Blocks at={at} material={mat} color />
      <Near within={150}>
        <group ref={glide}>
          <Blocks at={boat} material={mat} color />
          <People list={poler} within={150} />
        </group>
      </Near>
      <People list={people} />
      <Flock centre={[0, -14]} radius={26} height={6} n={6} color="#f4f1e6" seed="lobo-aigrettes" />
    </group>
  )
}

/* ---------- The Cour des Anciens bétés ---------- */

export function CourBete({ night }: { night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const sign = useSign(tr('LA COUR DES ANCIENS BÉTÉS'), '#5e3a1e', '#fff3bf', night, 0.8)
  const lamp = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f8f4e6', emissive: '#ffe08a', emissiveIntensity: 0 }), [])
  lamp.emissiveIntensity = night ? 1.1 : 0
  const b = useMemo(() => {
    const out: At[] = []
    const lit: At[] = []
    const r = seeded(293)
    // The family's house at the back, its veranda; the yard of beaten earth.
    put(
      out,
      [0, -11, 0],
      [
        [0, 1.6, 0, 16, 3.2, 5, '#d8c4a0'],
        [0, 3.35, 0, 16.6, 0.25, 5.8, '#9aa3aa'],
        [0, 0.35, 2.6, 16, 0.7, 0.4, '#b08a5a'],
        [0, 1.2, 2.52, 1.2, 2.4, 0.04, '#3a2616'],
        [-4.5, 1.6, 2.52, 1.2, 1, 0.04, '#5c8fb3'],
        [4.5, 1.6, 2.52, 1.2, 1, 0.04, '#5c8fb3'],
      ],
    )
    // The bâches: the striped awnings on their poles over rows of plastic chairs, both sides of the dance ground.
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) for (const z of [-5, 5]) out.push({ p: [s * (6 + k * 3), 1.4, z * 0.8], s: [0.12, 2.8, 0.12], c: '#c0c6cc' })
      for (let k = 0; k < 4; k++) out.push({ p: [s * 9, 2.9 + (k % 2) * 0.06, -3 + k * 2], s: [8, 0.08, 2], c: k % 2 ? '#e9ecef' : s > 0 ? '#1971c2' : '#c92a2a' })
      for (let row = 0; row < 3; row++)
        for (let k = 0; k < 6; k++)
          out.push({ p: [s * (6.5 + row * 2), 0.24, -3.6 + k * 1.4], s: [0.45, 0.48, 0.45], c: ['#ffffff', '#1971c2', '#c92a2a'][(row + k) % 3] }, { p: [s * (6.5 + row * 2 + 0.22), 0.65, -3.6 + k * 1.4], s: [0.06, 0.5, 0.45], c: ['#ffffff', '#1971c2', '#c92a2a'][(row + k) % 3] })
    }
    // The drums at the back of the dance ground: the big talking drum on its stand, the smaller ones.
    out.push({ p: [-1.5, 0.7, -6.4], s: [0.9, 1.4, 0.9], c: '#6b4a2a' }, { p: [-1.5, 1.42, -6.4], s: [0.94, 0.04, 0.94], c: '#e9dcc0' })
    for (let i = 0; i < 3; i++) out.push({ p: [0.4 + i * 1, 0.45, -6.2], s: [0.5, 0.9, 0.5], c: '#8a5a2a' }, { p: [0.4 + i * 1, 0.92, -6.2], s: [0.52, 0.04, 0.52], c: '#e9dcc0' })
    // The dust of the dance ground, the bulbs strung over it.
    for (let i = 0; i < 8; i++) out.push({ p: [(r() - 0.5) * 7, 0.03, (r() - 0.5) * 8], s: [1.2, 0.03, 0.9], ry: r() * 3, c: '#b07a4a' })
    for (let i = 0; i < 10; i++) lit.push({ p: [-4.5 + i, 3.3 - Math.sin((i / 9) * Math.PI) * 0.5, 0], s: [0.22, 0.22, 0.22] })
    out.push({ p: [0, 3.25, 0], s: [10, 0.03, 0.03], c: '#1c1c1e' })
    // The gate on the street, the low wall.
    for (const x of [-2.4, 2.4]) out.push({ p: [x, 1.4, 9], s: [0.7, 2.8, 0.7], c: '#d8c4a0' })
    out.push({ p: [0, 3, 9], s: [6, 0.5, 0.8], c: '#d8c4a0' }, { p: [-9, 0.6, 9], s: [13, 1.2, 0.3], c: '#d8c4a0' }, { p: [9, 0.6, 9], s: [13, 1.2, 0.3], c: '#d8c4a0' })
    return { out, lit }
  }, [])
  const people = usePeople('bete-gens', [
    // The drummers, the dancers in the middle (the women's line, the young men's), the elders seated.
    { p: [-1.5, 0, -7.2], ry: 0, pose: 'balafon', gender: 'homme' },
    { p: [0.9, 0, -7], ry: 0, pose: 'clap', gender: 'homme' },
    ...[-2, -0.7, 0.6, 1.9].map((x, i) => ({ p: [x, 0, -2.4 + (i % 2) * 0.4] as [number, number, number], ry: 0, pose: 'dance' as never, gender: 'femme' as const, dress: { outfit: 'pagne', outfitColor: ['#c92a2a', '#f0b429', '#2f9e44', '#1971c2'][i] } })),
    ...[-1.2, 1.2].map((x) => ({ p: [x, 0, 1.4] as [number, number, number], ry: Math.PI, pose: 'zouglou' as never, gender: 'homme' as const })),
    ...[-3, -0.2, 2.6].map((z, i) => ({ p: [-6.5, 0, z] as [number, number, number], ry: Math.PI / 2, pose: (['sitclap', 'sit', 'sitlaugh'] as never[])[i] })),
    ...[-1.6, 1.2].map((z, i) => ({ p: [6.5, 0, z] as [number, number, number], ry: -Math.PI / 2, pose: (['sit', 'sitclap'] as never[])[i] })),
  ])
  return (
    <group>
      <Blocks at={b.out} material={mat} color />
      <Blocks at={b.lit} material={lamp} />
      <Sign s={sign} w={5.6} p={[0, 3, 9.42]} />
      <People list={people} />
    </group>
  )
}

/* ---------- The Cathédrale du Christ-Roi, the Grande mosquée ---------- */

// Where the map has them (route d'Issia); their shapes are the game's estimate: the cathedral a long nave
// under a steep roof, its gable and its rose to the street, its bell tower and its cross; the mosque white
// and green, its dome, its minaret, its arches, the courtyard and the taps for the ablutions.

export function CathedraleDaloa({ night }: { night: boolean }) {
  const mat = useMemo(() => {
    const m = blocksMat()
    m.emissive = new THREE.Color('#ffe8c0')
    return m
  }, [])
  mat.emissiveIntensity = night ? 0.1 : 0
  const at = useMemo(() => {
    const out: At[] = []
    // The nave and its roof in steps (a steep roof, in blocks), the gable, the rose, the porch, the door.
    out.push({ p: [0, 5, -6], s: [14, 10, 26], c: '#f1ece2' })
    for (let i = 0; i < 6; i++) out.push({ p: [0, 10.4 + i * 0.8, -6], s: [15 - i * 2.6, 0.8, 26.6], c: i % 2 ? '#8a3a2a' : '#9c4434' })
    for (let i = 0; i < 5; i++) out.push({ p: [0, 10.4 + i * 0.8, 7.05], s: [13 - i * 2.6, 0.8, 0.3], c: '#f1ece2' })
    out.push({ p: [0, 8, 7.15], s: [2.6, 2.6, 0.1], c: '#2a6fd6' }, { p: [0, 8, 7.2], s: [0.3, 2.2, 0.06], c: '#ffd43b' }, { p: [0, 8, 7.2], s: [2.2, 0.3, 0.06], c: '#ffd43b' })
    out.push({ p: [0, 2, 8], s: [5, 4, 2], c: '#e9e2cf' }, { p: [0, 1.6, 9.02], s: [2, 3.2, 0.06], c: '#5a3a1e' })
    // The windows down the sides, the buttresses.
    for (let k = 0; k < 6; k++) for (const s of [-1, 1]) out.push({ p: [s * 7.02, 5, 4 - k * 4], s: [0.06, 4, 1.2], c: '#3b82d8' }, { p: [s * 7.3, 3, 2 - k * 4], s: [0.6, 6, 0.8], c: '#e2dccd' })
    // The bell tower beside, its belfry, its cross.
    out.push(
      { p: [9.5, 9, 3], s: [4, 18, 4], c: '#f1ece2' },
      { p: [9.5, 15.5, 3], s: [4.2, 2.4, 4.2], c: '#d8d2c4' },
      { p: [9.5, 15.5, 5.12], s: [1.6, 1.6, 0.06], c: '#2a2a2a' },
      { p: [9.5, 19, 3], s: [3, 2, 3], c: '#9c4434' },
      { p: [9.5, 21.2, 3], s: [0.3, 2.4, 0.3], c: '#ffd43b' },
      { p: [9.5, 21.6, 3], s: [1.4, 0.3, 0.3], c: '#ffd43b' },
    )
    // The forecourt, its flowerbeds, the statue of the Christ-Roi on its pedestal.
    out.push({ p: [0, 0.04, 13], s: [16, 0.08, 8], c: '#d8d2c4' }, { p: [-5.5, 0.25, 13], s: [3, 0.5, 4], c: '#4c8a3a' }, { p: [5.5, 0.25, 13], s: [3, 0.5, 4], c: '#4c8a3a' })
    out.push({ p: [-5.5, 0.9, 13], s: [1, 0.8, 1], c: '#e9e2cf' }, { p: [-5.5, 2, 13], s: [0.6, 1.4, 0.4], c: '#f4f1e6' }, { p: [-5.5, 2.9, 13], s: [0.36, 0.4, 0.36], c: '#f4f1e6' }, { p: [-5.5, 3.2, 13], s: [0.5, 0.12, 0.5], c: '#ffd43b' })
    return out
  }, [])
  const people = usePeople('christ-roi-gens', [
    { p: [1.6, 0, 11], ry: Math.PI, pose: 'walk', dress: { outfit: 'robe', outfitColor: '#f4f1e6' } },
    { p: [-2, 0, 12], ry: 0.4, pose: 'talk', gender: 'homme', dress: { outfit: 'soutane', outfitColor: '#f4f1e6' } },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

export function MosqueeDaloa({ night }: { night: boolean }) {
  const mat = useMemo(() => {
    const m = blocksMat()
    m.emissive = new THREE.Color('#e8fff0')
    return m
  }, [])
  mat.emissiveIntensity = night ? 0.12 : 0
  const at = useMemo(() => {
    const out: At[] = []
    // The prayer hall, its arcade of arches on the front, the green band.
    out.push({ p: [0, 3.5, -6], s: [18, 7, 14], c: '#f6f4ee' }, { p: [0, 7.2, -6], s: [18.4, 0.4, 14.4], c: '#2f9e44' })
    for (let k = 0; k < 7; k++) out.push({ p: [-7.2 + k * 2.4, 2, 1.04], s: [1.4, 3, 0.08], c: '#2b5a3a' }, { p: [-7.2 + k * 2.4, 3.7, 1.06], s: [1, 0.4, 0.06], c: '#2b5a3a' })
    // The dome in rings narrowing, its crescent.
    for (let i = 0; i < 5; i++) out.push({ p: [0, 7.8 + i * 0.9, -6], s: [8 - i * 1.5, 0.9, 8 - i * 1.5], c: i % 2 ? '#2f9e44' : '#37b24d' })
    out.push({ p: [0, 12.6, -6], s: [0.2, 1.2, 0.2], c: '#ffd43b' }, { p: [0.25, 13.3, -6], s: [0.5, 0.2, 0.15], c: '#ffd43b' })
    // The minaret: its square shaft, its balcony, its lantern.
    out.push({ p: [11, 9, -1], s: [2.6, 18, 2.6], c: '#f6f4ee' }, { p: [11, 15, -1], s: [3.6, 0.4, 3.6], c: '#2f9e44' }, { p: [11, 17.6, -1], s: [1.8, 2.4, 1.8], c: '#f6f4ee' }, { p: [11, 19.4, -1], s: [1.2, 1.2, 1.2], c: '#2f9e44' }, { p: [11, 20.4, -1], s: [0.15, 1, 0.15], c: '#ffd43b' })
    // The courtyard, its wall, the taps of the ablutions, the mats.
    out.push({ p: [0, 0.04, 6], s: [20, 0.08, 10], c: '#e2dccd' })
    for (const x of [-10, 10]) out.push({ p: [x, 0.8, 6], s: [0.3, 1.6, 10], c: '#f6f4ee' })
    put(out, [-6, 6, 0], [[0, 0.5, 0, 4, 1, 0.6, '#d8d2c4'], ...[-1.5, -0.5, 0.5, 1.5].map((x): Part => [x, 0.9, 0.35, 0.08, 0.2, 0.2, '#adb5bd'])])
    for (let i = 0; i < 4; i++) out.push({ p: [2 + i * 1.6, 0.1, 4], s: [1.2, 0.04, 2], c: ['#a61e4d', '#1c7ed6', '#2f9e44', '#e8590c'][i] })
    return out
  }, [])
  const people = usePeople('daloa-mosquee-gens', [
    { p: [-6, 0, 7], ry: Math.PI, pose: 'wash', gender: 'homme' },
    { p: [3, 0, 4], ry: Math.PI, pose: 'salat', gender: 'homme' },
    { p: [6, 0, 9], ry: 2.4, pose: 'talk', gender: 'homme', dress: { outfit: 'boubou', outfitColor: '#f4f1e6' } },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/* ---------- The rond-point du Commerce, the Zone industrielle's warehouses ---------- */

/** A woro-woro (the town's shared taxi), in Daloa's colours; facing +x. */
const woro = (c: string): Part[] => [
  [0, 0.75, 0, 4.2, 0.9, 1.8, c],
  [0, 1.45, -0.1, 2.2, 0.6, 1.6, '#2b3a4a'],
  [0, 1.85, 0, 0.6, 0.18, 0.3, '#f4f1e6'],
  [-1.3, 0.35, 0.9, 0.7, 0.7, 0.2, '#1c1c1e'],
  [1.3, 0.35, 0.9, 0.7, 0.7, 0.2, '#1c1c1e'],
  [-1.3, 0.35, -0.9, 0.7, 0.7, 0.2, '#1c1c1e'],
  [1.3, 0.35, -0.9, 0.7, 0.7, 0.2, '#1c1c1e'],
]
/** A moto-taxi, its rider's helmet; facing +x. */
const moto = (c: string): Part[] => [
  [0, 0.5, 0, 1.7, 0.4, 0.25, c],
  [0.75, 0.3, 0, 0.6, 0.6, 0.1, '#1c1c1e'],
  [-0.75, 0.3, 0, 0.6, 0.6, 0.1, '#1c1c1e'],
  [0.5, 0.85, 0, 0.06, 0.06, 0.6, '#8a8a8a'],
]

// The rond-point at the heart of the Commerce: its island of grass and flowers, the flag, the kerbs
// painted, the woro-woros and the motos turning round it, the sellers at its edge. The monument in its
// middle is the game's (an antelope, for the « cité des antilopes »), not surveyed.
export function RondPointDaloa({ night }: { night: boolean }) {
  void night
  const mat = useMemo(blocksMat, [])
  const turn = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (turn.current) turn.current.rotation.y = clock.elapsedTime * 0.12
  })
  const b = useMemo(() => {
    const out: At[] = []
    // The island: kerb blocks in a ring, black and white, the grass, the flowers.
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2
      out.push({ p: [Math.cos(a) * 6, 0.15, Math.sin(a) * 6], s: [1.9, 0.3, 0.4], ry: -a + Math.PI / 2, c: i % 2 ? '#f4f1e6' : '#1c1c1e' })
    }
    out.push({ p: [0, 0.12, 0], s: [8.4, 0.2, 8.4], ry: Math.PI / 4, c: '#4c8a3a' }, { p: [0, 0.12, 0], s: [8.4, 0.2, 8.4], c: '#4c8a3a' })
    for (let i = 0; i < 12; i++) out.push({ p: [Math.cos(i * 0.52) * 4.4, 0.3, Math.sin(i * 0.52) * 4.4], s: [0.5, 0.3, 0.5], c: ['#f03e3e', '#ffd43b', '#f783ac'][i % 3] })
    // The antelope on its plinth: the body, the legs, the neck, the long horns swept back.
    out.push({ p: [0, 0.9, 0], s: [2, 1.4, 1.4], c: '#e9e2cf' })
    put(
      out,
      [0, 0, 0.3],
      [
        [0, 2.6, 0, 1.6, 0.6, 0.5, '#c08a3a'],
        [-0.6, 1.95, 0.15, 0.14, 0.8, 0.14, '#c08a3a'],
        [0.6, 1.95, 0.15, 0.14, 0.8, 0.14, '#c08a3a'],
        [-0.6, 1.95, -0.15, 0.14, 0.8, 0.14, '#c08a3a'],
        [0.6, 1.95, -0.15, 0.14, 0.8, 0.14, '#c08a3a'],
        [0.9, 3.1, 0, 0.3, 0.8, 0.3, '#c08a3a'],
        [1.15, 3.5, 0, 0.5, 0.3, 0.3, '#c08a3a'],
        [0.95, 4.0, 0.08, 0.08, 0.9, 0.08, '#3a2a1a'],
        [0.95, 4.0, -0.08, 0.08, 0.9, 0.08, '#3a2a1a'],
      ],
      0,
    )
    out.push({ p: [-2.6, 3, -2.6], s: [0.12, 6, 0.12], c: '#c0c6cc' }, { p: [-2.1, 5.5, -2.6], s: [0.9, 0.2, 0.04], c: '#f77f00' }, { p: [-2.1, 5.3, -2.6], s: [0.9, 0.2, 0.04], c: '#f4f1e6' }, { p: [-2.1, 5.1, -2.6], s: [0.9, 0.2, 0.04], c: '#009e60' })
    // The sellers' tables and parasols at the edge.
    for (const [x, z, c] of [
      [11, 8, '#e03131'],
      [-11, 9, '#1c7ed6'],
      [12, -8, '#f08c00'],
    ] as const)
      put(
        out,
        [x, z, 0.3],
        [
          [0, 0.75, 0, 1.4, 0.08, 0.9, '#8a6a3c'],
          [0, 0.38, 0, 1.3, 0.75, 0.08, '#7a5a32'],
          [0, 1.4, 0, 0.06, 1.3, 0.06, '#e9ecef'],
          [0, 2.05, 0, 2.2, 0.12, 2.2, c],
          [0, 0.88, 0, 0.9, 0.14, 0.5, '#e8b81a'],
        ],
      )
    // The traffic round it: woro-woros and motos on the ring, turned along it.
    const ring: At[] = []
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      put(ring, [Math.cos(a) * 9, Math.sin(a) * 9, -a - Math.PI / 2], i % 2 ? moto(['#c92a2a', '#1971c2', '#1c1c1e'][i % 3]) : woro(i % 4 ? '#2f9e44' : '#f08c00'))
    }
    return { out, ring }
  }, [])
  const people = usePeople('rond-point-gens', [
    { p: [11, 0, 7.2], ry: Math.PI, pose: 'cook', dress: { outfit: 'pagne', outfitColor: '#e03131' } },
    { p: [-11, 0, 8.2], ry: Math.PI, pose: 'busy', dress: { outfit: 'pagne', outfitColor: '#1c7ed6' } },
    { p: [12.5, 0, 9.5], ry: -2.4, pose: 'phone' },
    { p: [9, 0, 12], ry: 3, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={b.out} material={mat} color />
      <Near within={160}>
        <group ref={turn}>
          <Blocks at={b.ring} material={mat} color />
        </group>
      </Near>
      <People list={people} />
    </group>
  )
}

// The exporters' warehouses of the Zone industrielle: the long sheds of corrugated iron behind their wall,
// the doors open on the stacks of jute bags to the roof, the lorries come in from the plantations, the
// porters running the bags in on their heads, the weighbridge at the gate.
export function ZoneCacao({ night }: { night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const lamp = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f8f4e6', emissive: '#ffe8b0', emissiveIntensity: 0 }), [])
  lamp.emissiveIntensity = night ? 1.2 : 0
  const b = useMemo(() => {
    const out: At[] = []
    const lit: At[] = []
    const r = seeded(307)
    for (const [x, c] of [
      [-14, '#9aa3aa'],
      [14, '#8f979e'],
    ] as const) {
      // A shed: walls, the roof in two slopes (blocks), the big door open, the bags inside.
      put(
        out,
        [x, -10, 0],
        [
          [0, 3.5, 0, 24, 7, 14, '#c9ced3'],
          [0, 7.4, -3.5, 25, 0.3, 7.6, c, 0],
          [0, 7.4, 3.5, 25, 0.3, 7.6, c, 0],
          [0, 7.9, 0, 25, 0.5, 1, c],
          [0, 2.8, 7.02, 6, 5.6, 0.06, '#2a2a2a'],
        ],
      )
      for (let i = 0; i < 24; i++) out.push({ p: [x - 2.2 + (i % 4) * 1.4, 0.3 + Math.floor(i / 4) * 0.5, -4 + (r() - 0.5) * 0.4], s: [1.3, 0.48, 1.8], c: JUTE[i % 3] })
      lit.push({ p: [x, 6.2, -2.9], s: [1.2, 0.3, 0.3] })
    }
    // The yard, the wall, the gate, the weighbridge and its hut.
    out.push({ p: [0, 0.03, 4], s: [56, 0.06, 18], c: '#8e8c82' })
    for (const x of [-28, 28]) out.push({ p: [x, 1.2, -1], s: [0.4, 2.4, 30], c: '#e9e2cf' })
    out.push({ p: [-17, 1.2, 13], s: [22, 2.4, 0.4], c: '#e9e2cf' }, { p: [17, 1.2, 13], s: [22, 2.4, 0.4], c: '#e9e2cf' })
    out.push({ p: [0, 0.08, 9], s: [3.4, 0.12, 9], c: '#5c636a' }, { p: [4, 1.3, 9], s: [2.4, 2.6, 2.4], c: '#f1ece2' }, { p: [4, 1.6, 10.22], s: [1.2, 0.8, 0.04], c: '#5c8fb3' })
    // The lorries: their cabs, their beds loaded with bags under the tarpaulin.
    for (const [x, z, ry] of [
      [0, 8, Math.PI / 2],
      [-8, 3, 0.1],
    ] as const)
      put(
        out,
        [x, z, ry],
        [
          [3, 1.4, 0, 2, 2.2, 2.3, '#c92a2a'],
          [3.6, 1.8, 0, 0.8, 0.8, 2.1, '#2b3a4a'],
          [-1.2, 1.1, 0, 6, 0.4, 2.4, '#5a4a3a'],
          ...[0, 1, 2, 3, 4, 5].map((k): Part => [-3.4 + (k % 3) * 1.6, 1.6 + Math.floor(k / 3) * 0.5, 0, 1.5, 0.48, 2.1, JUTE[k % 3]]),
          [-1.2, 2.7, 0, 6, 0.1, 2.4, '#2f6db3'],
          [2.6, 0.45, 1.2, 0.9, 0.9, 0.3, '#1c1c1e'],
          [2.6, 0.45, -1.2, 0.9, 0.9, 0.3, '#1c1c1e'],
          [-3, 0.45, 1.2, 0.9, 0.9, 0.3, '#1c1c1e'],
          [-3, 0.45, -1.2, 0.9, 0.9, 0.3, '#1c1c1e'],
        ],
      )
    return { out, lit }
  }, [])
  const people = usePeople('zone-cacao-gens', [
    { p: [-6, 0, 1], ry: -1.6, pose: 'carry', gender: 'homme' },
    { p: [-10, 0, -1.5], ry: Math.PI, pose: 'carry', gender: 'homme' },
    { p: [-13, 0, -3.2], ry: Math.PI, pose: 'carry', gender: 'homme' },
    { p: [4, 0, 7.5], ry: 0.4, pose: 'write', gender: 'homme' },
    { p: [12, 0, -3], ry: Math.PI, pose: 'point', gender: 'homme' },
  ])
  return (
    <group>
      <Blocks at={b.out} material={mat} color />
      <Blocks at={b.lit} material={lamp} />
      <People list={people} />
    </group>
  )
}

/* ---------- The Maquis La Cabosse d'Or, Le Ziglibithy Club, the Hôtel L'Antilope Dorée ---------- */

const CABOSSE: MaquisSpec = {
  name: 'LA CABOSSE D’OR',
  sign: ['#7a3b1a', '#ffd43b'],
  wall: '#e8c38a',
  roof: 'tin',
  food: 'meat',
  plastic: ['#ffffff', '#f08c00', '#7a3b1a'],
  seed: 61,
  // A giant cocoa pod painted gold on the front, the foutou's mortar and pestle, the pots of sauce graine.
  extra: [
    [5.2, 1.6, -3.9, 1, 2, 0.2, '#e0a21a'],
    [5.2, 1.6, -3.85, 0.6, 1.6, 0.2, '#f0c419'],
    [-3.4, 0.45, 6.2, 0.7, 0.9, 0.7, '#6b4a2a'],
    [-3.4, 1.3, 6.2, 0.14, 1.4, 0.14, '#8a6a3c'],
    [-2.2, 0.4, 6.2, 0.8, 0.8, 0.8, '#3a3a3a'],
    [-2.2, 0.82, 6.2, 0.6, 0.06, 0.6, '#c2410c'],
  ],
}
const ZIGLI: ClubSpec = {
  name: 'LE ZIGLIBITHY CLUB',
  neon: '#f783ac',
  neon2: '#ffd43b',
  wall: '#2a1a24',
  seed: 67,
  bpm: 118,
  // An antelope's head over the door, its long horns.
  motif: [
    [0, 7.9, 5.06, 1, 1.2, 0.2, '#c08a5a'],
    [-0.4, 9, 5.06, 0.16, 1.4, 0.16, '#e9dcc0', 0],
    [0.4, 9, 5.06, 0.16, 1.4, 0.16, '#e9dcc0', 0],
    [0, 7.3, 5.06, 0.6, 0.5, 0.2, '#a0703a'],
  ],
}
export const MaquisCabosse = ({ night }: { night: boolean }) => <Maquis spec={CABOSSE} night={night} />
export const ZigliClub = ({ night }: { night: boolean }) => <Club spec={ZIGLI} night={night} />
export const HotelAntilope = ({ night }: { night: boolean }) => <SmallHotel name={tr('HÔTEL L’ANTILOPE DORÉE')} sign={['#7a3b1a', '#ffd43b']} wall="#f6efe0" accent="#e0a21a" seed={71} night={night} />
