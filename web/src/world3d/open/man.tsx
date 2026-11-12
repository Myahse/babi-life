import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOX, Blocks } from './ruePrincesse'
import type { At } from './shoreline'
import { put, blocksMat, seeded, strawRoof, type Part } from './kit3d'
import { MONKEY, Flock, Herd, grazer, makeHerd } from './wildlife'
import { SafariTruck } from './nziReserve'
import { t as tr } from '../../lib/i18n'
import { Club, Maquis, Near, People, Sign, SmallHotel, usePeople, useSign, type ClubSpec, type MaquisSpec } from './villeKit'

// Man's landmarks (the update « man-vivant », backend game/villes3.go), in the game's blocks, each mostly
// drawn at once (kit3d.ts):
// - the Dent de Man: the tooth of granite standing over the forested hills, the path up through the coffee;
// - Mont Tonkpi: the long ridge, the track to the antennas, the belvédère and its rail over the mist;
// - the Cascade: the water down the rocks under the forest, the pool, the bamboo grove on the path;
// - the sacred forest of Gbêpleu and its monkeys;
// - the Cour des Masques: the yard where the stilt dancers and the masks dance to the drums;
// - the Gueu family's coffee plantation, the excursion agency, the maquis, the club, the hotel.
// All layouts are the game's own, not surveyed; heights far below the real ones (the world is flat).
// Frames: +z the street (the place's door), the mountain behind (−z).

const ROCK = ['#7d7a72', '#8d8a82', '#6f6c64', '#9c988f']
const GREENS = ['#2f6a30', '#3c7a36', '#28592a', '#4c8a3a']
/** A forest tree: its trunk, its crown in two blocks. */
const tree = (h: number, r: number, crown = '#3f7a35'): Part[] => [
  [0, h / 2, 0, 0.6, h, 0.6, '#6e5640'],
  [0, h + 0.8, 0, r * 2, 2.2, r * 2, crown],
  [0.6, h + 1.8, 0.4, r * 1.3, 1.4, r * 1.3, crown],
]
/** A coffee bush: low, dense, its red cherries. */
const coffee = (): Part[] => [
  [0, 0.6, 0, 0.12, 1.2, 0.12, '#6e5640'],
  [0, 1.2, 0, 1.4, 0.9, 1.4, '#2f6a30'],
  [0.5, 1.1, 0.5, 0.14, 0.14, 0.14, '#c92a2a'],
  [-0.4, 1.3, 0.6, 0.14, 0.14, 0.14, '#e03131'],
  [0.6, 1.4, -0.3, 0.14, 0.14, 0.14, '#5c9e31'],
]

/** Hills of forest stepping up behind (−z): wide green tiers, a few trees standing out. */
function hills(out: At[], r: () => number, z0: number, w: number, tiers: number, step = 3) {
  for (let i = 0; i < tiers; i++) out.push({ p: [r() * 4 - 2, step * (i + 0.5), z0 - i * 4], s: [w - i * (w / (tiers + 1)), step, 14], ry: (r() - 0.5) * 0.2, c: GREENS[i % 4] })
  for (let i = 0; i < 14; i++) put(out, [(r() - 0.5) * w * 0.8, z0 + 6 - r() * 6, r() * 3], tree(4 + r() * 3, 1.6 + r(), GREENS[i % 4]))
}

/* ---------- The Dent de Man ---------- */

export function DentDeMan({ night }: { night: boolean }) {
  void night
  const mat = useMemo(blocksMat, [])
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(181)
    // The forested hills it stands on.
    hills(out, r, -18, 90, 6)
    // The tooth: a steep dome of granite, broad at its foot, its crown rounded and tilted, one face sheer.
    // Its lower flanks under the forest, the bare grey rock above with its dark streaks where the rain runs.
    const base = 6 * 3
    const N = 16
    for (let i = 0; i < N; i++) {
      const k = i / N
      const w = (34 * Math.pow(1 - k ** 2.4, 0.8) + 4) * (i < 5 ? 1.35 - i * 0.07 : 1)
      const z = -44 + k * 6
      const x = -3 + k * k * 6
      const forest = i < 5
      for (const [dx, dz, f, ry] of [
        [0, 0, 1, 0.12],
        [w * 0.12, -w * 0.08, 0.8, 0.5],
        [-w * 0.1, w * 0.05, 0.75, -0.3],
      ] as const)
        out.push({ p: [x + dx + (r() - 0.5), base + 3.2 * i + 1.6, z + dz], s: [w * f, 3.3, w * 0.7 * f], ry: ry + (r() - 0.5) * 0.1, c: forest ? GREENS[(i + Math.round(dx)) & 3] : ROCK[(i + Math.round(dz)) & 3] })
      if (!forest && i % 2) out.push({ p: [x + w * 0.18, base + 3.2 * i + 1.6, z + w * 0.36], s: [0.7, 3.4, 0.3], c: '#4a4a44' })
      if (forest) for (let t = 0; t < 4; t++) out.push({ p: [x + (r() - 0.5) * w, base + 3.2 * i + 3.6, z + w * 0.3], s: [2.6, 2, 2.2], ry: r(), c: GREENS[t & 3] })
    }
    // The shrubs clinging to its ledges higher up.
    for (let i = 0; i < 14; i++) out.push({ p: [-10 + r() * 20, base + 18 + r() * 26, -34 - r() * 4], s: [1.8, 1.1, 1.4], c: GREENS[i % 4] })
    // The trailhead: the path's beaten earth, the guides' shelter, the sign post, the coffee bushes either side.
    for (let i = 0; i < 9; i++) out.push({ p: [-1 + Math.sin(i * 0.7) * 2, 0.04 + i * 0.6, 8 - i * 3], s: [2, 0.12, 3.2], c: '#a0703a' })
    put(out, [6, 6, 0.2], [[-1.6, 1.2, -1.4, 0.2, 2.4, 0.2, '#6b4a2a'], [1.6, 1.2, -1.4, 0.2, 2.4, 0.2, '#6b4a2a'], [-1.6, 1.2, 1.4, 0.2, 2.4, 0.2, '#6b4a2a'], [1.6, 1.2, 1.4, 0.2, 2.4, 0.2, '#6b4a2a'], ...strawRoof(2.6, 1.4, 2.3), [0, 0.45, 0, 2, 0.1, 0.6, '#8a6a3c']])
    out.push({ p: [-3.4, 1.2, 9], s: [0.15, 2.4, 0.15], c: '#6b4a2a' }, { p: [-3.4, 2.2, 9.05], s: [1.8, 0.6, 0.08], c: '#2b8a3e' })
    for (let i = 0; i < 16; i++) put(out, [(i % 2 ? 1 : -1) * (4 + r() * 10), 6 - Math.floor(i / 2) * 2.4, r() * 3], coffee())
    return out
  }, [])
  const sign = useSign(tr('LA DENT DE MAN'), '#2b8a3e', '#fff6d6', false)
  const people = usePeople('dent-gens', [
    { p: [5, 0, 7], ry: -0.4, pose: 'talk', gender: 'homme', dress: { outfit: 'casual', outfitColor: '#4f5e36' } },
    { p: [-0.5, 1.2, 1], ry: Math.PI, pose: 'walk' },
    { p: [0.8, 2.4, -2.5], ry: Math.PI, pose: 'walk', gender: 'femme' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Sign s={sign} w={1.7} p={[-3.4, 2.2, 9.1]} />
      <People list={people} />
      <Flock centre={[0, -34]} radius={22} height={70} n={4} color="#3a3a3a" seed="dent-milans" glide size={2.4} />
    </group>
  )
}

/* ---------- Mont Tonkpi ---------- */

export function MontTonkpi({ night }: { night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const lamp = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ff4040', emissive: '#ff2020', emissiveIntensity: 0 }), [])
  lamp.emissiveIntensity = night ? 1.4 : 0.3
  const mist = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f1f4f2', transparent: true, opacity: 0.55, depthWrite: false }), [])
  const b = useMemo(() => {
    const out: At[] = []
    const r = seeded(211)
    // The long ridge (the summit here is a high rolling top, grass and rock), the other mountains beyond.
    for (let i = 0; i < 5; i++) out.push({ p: [r() * 6 - 3, 1 + i * 2, -10 - i * 5], s: [70 - i * 10, 2, 22], c: i % 2 ? '#6f9a4a' : '#5f8a3e' })
    for (let i = 0; i < 6; i++) {
      const x = -60 + i * 24 + r() * 6
      const h = 10 + r() * 14
      const z = -70 - r() * 20
      out.push(
        { p: [x, h / 2, z], s: [24 + r() * 10, h, 16], ry: r() * 0.4, c: GREENS[i % 4] },
        { p: [x + (r() - 0.5) * 6, h + 3, z], s: [12 + r() * 6, 6, 12], ry: r() * 0.4, c: GREENS[(i + 1) % 4] },
        { p: [x + (r() - 0.5) * 4, h + 7, z], s: [5, 3, 6], ry: r(), c: i % 2 ? ROCK[1] : GREENS[(i + 2) % 4] },
      )
    }
    for (let i = 0; i < 14; i++) out.push({ p: [(r() - 0.5) * 50, 2.2 + r() * 6, -6 - r() * 22], s: [1.5 + r() * 2, 1 + r(), 1.5 + r()], ry: r() * 3, c: ROCK[i % 4] })
    // The track up, laterite, in hairpins; the belvédère's platform and its rail at the front edge.
    for (let i = 0; i < 10; i++) {
      const y = 0.06 + i * 0.9
      out.push({ p: [0, y, 10 - i * 2], s: [12, 0.12, 1.6], c: '#b0643a' })
      // The hairpin at the end, climbing to the next leg.
      out.push({ p: [i % 2 ? -6.4 : 6.4, y + 0.45, 9 - i * 2], s: [1.6, 0.12, 2.6], c: '#a0582f' })
    }
    out.push({ p: [0, 9.3, -6], s: [12, 0.4, 6], c: '#a9a59a' })
    for (let x = -6; x <= 6; x += 1.5) out.push({ p: [x, 10, -3.1], s: [0.1, 1, 0.1], c: '#e9ecef' })
    out.push({ p: [0, 10.45, -3.1], s: [12, 0.08, 0.08], c: '#e9ecef' })
    // The antennas' masts and their huts, the lamps on top.
    const lit: At[] = []
    for (const [x, z, h] of [
      [-14, -18, 26],
      [8, -22, 20],
    ]) {
      out.push({ p: [x, 11 + h / 2, z], s: [0.6, h, 0.6], c: '#c9ced3' }, { p: [x + 2, 12, z], s: [3, 2.4, 2.4], c: '#f1f3f5' })
      for (let k = 1; k < 5; k++) out.push({ p: [x, 11 + (h * k) / 5, z], s: [1.4, 0.1, 0.1], c: k % 2 ? '#e03131' : '#f1f3f5' })
      lit.push({ p: [x, 11 + h + 0.3, z], s: [0.5, 0.5, 0.5] })
    }
    // The mist lying in the valley in front, below the rail.
    const fog: At[] = []
    for (let i = 0; i < 6; i++) fog.push({ p: [-40 + i * 16 + r() * 4, 2 + r() * 2, 26 + r() * 10], s: [20, 2, 10] })
    return { out, lit, fog }
  }, [])
  const fogRef = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (fogRef.current) fogRef.current.position.x = Math.sin(clock.elapsedTime * 0.05) * 6
  })
  const people = usePeople('tonkpi-gens', [
    { p: [-2, 9.5, -4.2], ry: 0, pose: 'film' },
    { p: [2.4, 9.5, -4.4], ry: 0.2, pose: 'lookup', gender: 'femme' },
    { p: [6, 0, 9], ry: Math.PI, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={b.out} material={mat} color />
      <Blocks at={b.lit} material={lamp} />
      <group ref={fogRef}>
        <Blocks at={b.fog} material={mist} />
      </group>
      <People list={people} />
      <Flock centre={[0, 10]} radius={30} height={30} n={4} color="#3a3a3a" seed="tonkpi-milans" glide size={2.4} />
    </group>
  )
}

/* ---------- The Cascade ---------- */

/** The falling water: a strip of stripes sliding down (one mesh, its texture moved). */
function useFallingWater() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 64
    const g = c.getContext('2d')!
    for (let y = 0; y < 64; y += 2) for (let x = 0; x < 16; x += 2) ((g.fillStyle = ['#e7f5ff', '#d0ebff', '#ffffff', '#a5d8ff'][(x * 3 + y * 7) % 4]), g.fillRect(x, y, 2, 2))
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.magFilter = THREE.NearestFilter
    t.colorSpace = THREE.SRGBColorSpace
    t.repeat.set(1, 3)
    return { t, m: new THREE.MeshLambertMaterial({ map: t, transparent: true, opacity: 0.88 }) }
  }, [])
}

export function CascadeMan({ night }: { night: boolean }) {
  void night
  const mat = useMemo(blocksMat, [])
  const water = useFallingWater()
  const pool = useMemo(() => new THREE.MeshLambertMaterial({ color: '#4f8fa0', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [])
  const foam = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }), [])
  const foamRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    water.t.offset.y = (clock.elapsedTime * 1.6) % 1
    if (foamRef.current) foamRef.current.scale.set(7 + Math.sin(clock.elapsedTime * 3) * 0.4, 0.5, 3 + Math.cos(clock.elapsedTime * 2.6) * 0.3)
  })
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(233)
    // The cliff of dark wet rock the water comes down, the forest on its top and sides.
    for (let i = 0; i < 6; i++) out.push({ p: [(i % 2 ? -1 : 1) * (6 + r() * 3), 3 + i * 2.6, -14 - i * 0.6], s: [10 + r() * 3, 3, 6], c: ROCK[(i + 2) % 4] })
    out.push({ p: [0, 9, -17], s: [8, 18, 3], c: '#4f4d46' })
    for (let i = 0; i < 18; i++) put(out, [(r() - 0.5) * 36, -14 - r() * 10, r() * 3], tree(6 + r() * 6, 1.8 + r(), GREENS[i % 4]), Math.max(0, 6 + r() * 8))
    // The pool's rim of round boulders, the stream running out toward the path.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      if (Math.sin(a) > 0.6) continue
      out.push({ p: [Math.cos(a) * 9, 0.5, -8 + Math.sin(a) * 5], s: [2 + r() * 1.6, 1 + r() * 0.8, 1.8], ry: a, c: ROCK[i % 4] })
    }
    out.push({ p: [9, 0.03, 0], s: [3, 0.06, 14], c: '#4f8fa0' })
    // The bamboo grove on the path in: tall green canes in clumps, leaning over.
    for (let k = 0; k < 7; k++) {
      const x = (k % 2 ? 1 : -1) * (3 + r() * 2)
      const z = 12 - k * 2.4
      for (let j = 0; j < 6; j++) {
        const cx = x + (r() - 0.5) * 1.2
        const cz = z + (r() - 0.5) * 1.2
        const h = 7 + r() * 3
        out.push({ p: [cx, h / 2, cz], s: [0.16, h, 0.16], c: j % 2 ? '#7aa83a' : '#5c8a2a' })
        // The feathery leaves in sprays up the cane, more at the top.
        for (let l = 0; l < 4; l++) out.push({ p: [cx - Math.sign(x) * (0.3 + l * 0.25), h * (0.5 + l * 0.15), cz + (r() - 0.5) * 0.6], s: [1 + l * 0.3, 0.12, 0.4], ry: r() * 3, c: l % 2 ? '#6aa84f' : '#8cc152' })
      }
    }
    // The path, the little wooden bridge over the stream, the ticket hut, the benches.
    out.push({ p: [0, 0.04, 8], s: [2.2, 0.08, 16], c: '#a0703a' })
    put(
      out,
      [9, 2, 0],
      [
        [0, 0.5, 0, 4, 0.12, 1.6, '#8a6a3c'],
        [0, 0.9, 0.75, 4, 0.08, 0.08, '#6b4a2a'],
        [0, 0.9, -0.75, 4, 0.08, 0.08, '#6b4a2a'],
      ],
    )
    put(out, [-5, 14, 0.3], [[0, 1.2, 0, 2.6, 2.4, 2, '#e9e2cf'], ...strawRoof(2, 1.3, 2.4), [0, 1.2, 1.01, 1.2, 0.6, 0.04, '#2b8a3e']])
    for (const x of [-4, 4]) out.push({ p: [x, 0.4, -1.5], s: [2.4, 0.12, 0.6], c: '#8a6a3c' })
    return out
  }, [])
  const people = usePeople('cascade-gens', [
    { p: [-2, -0.4, -7], ry: 0, pose: 'swim' },
    { p: [2.2, -0.4, -8.6], ry: -0.8, pose: 'swim', gender: 'femme' },
    { p: [-6.5, 1.1, -6], ry: 0.8, pose: 'sitground' },
    { p: [4, 0, -1.6], ry: Math.PI, pose: 'film', gender: 'femme' },
    { p: [-4.6, 0, 15.4], ry: 0.6, pose: 'talk', gender: 'homme' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      {/* The water down the cliff, and its pool */}
      <mesh geometry={BOX} material={water.m} position={[0, 9, -15.3]} scale={[3.4, 18, 0.4]} />
      <mesh geometry={BOX} material={water.m} position={[-3.2, 6, -15]} scale={[1.2, 12, 0.3]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, -8]} material={pool}>
        <circleGeometry args={[8.5, 20]} />
      </mesh>
      <mesh ref={foamRef} geometry={BOX} material={foam} position={[0, 0.2, -13.6]} />
      <People list={people} />
    </group>
  )
}

/* ---------- The sacred forest of Gbêpleu ---------- */

export function ForetGbepleu({ night }: { night: boolean }) {
  void night
  const mat = useMemo(blocksMat, [])
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(241)
    // The big trees of the sacred forest behind its edge: tall trunks, buttress roots, high crowns.
    for (let i = 0; i < 26; i++) {
      const x = (r() - 0.5) * 50
      const z = -6 - r() * 24
      put(out, [x, z, r() * 3], tree(9 + r() * 7, 2.4 + r() * 1.4, GREENS[i % 4]))
      if (i % 3 === 0) out.push({ p: [x + 0.6, 0.6, z], s: [0.3, 1.2, 1.6], c: '#6e5640' })
    }
    for (let i = 0; i < 30; i++) out.push({ p: [(r() - 0.5) * 50, 0.7, -4 - r() * 6], s: [1.6 + r(), 1.4, 1.4], ry: r() * 3, c: GREENS[(i + 1) % 4] })
    // The keeper's bench and his shelter at the edge, the path's line of stones, the banana sellers.
    out.push({ p: [0, 0.04, 4], s: [2, 0.08, 10], c: '#a0703a' })
    for (let i = 0; i < 8; i++) out.push({ p: [i % 2 ? 1.2 : -1.2, 0.15, 8 - i * 1.5], s: [0.4, 0.3, 0.4], c: '#f1ece2' })
    put(
      out,
      [5, 4, -0.3],
      [
        [0, 0.4, 0, 2.4, 0.12, 0.6, '#8a6a3c'],
        ...strawRoof(2.2, 1.2, 2.3),
        ...[-1.4, 1.4].flatMap((x): Part[] => [
          [x, 1.2, -1.2, 0.15, 2.4, 0.15, '#6b4a2a'],
          [x, 1.2, 1.2, 0.15, 2.4, 0.15, '#6b4a2a'],
        ]),
      ],
    )
    put(
      out,
      [-4, 6, 0.2],
      [
        [0, 0.4, 0, 1.6, 0.8, 0.8, '#8a6a3c'],
        [0, 0.9, 0, 1.4, 0.2, 0.6, '#f0c419'],
        [0.3, 1.05, 0, 0.5, 0.15, 0.3, '#e0b419'],
      ],
    )
    return out
  }, [])
  const monkeys = useMemo(() => ({ a: makeHerd('gbepleu-singes', 9, [0, 0], 5, [0.85, 1.1]), b: grazer({ x: 0, z: 0 }, 6) }), [])
  const people = usePeople('gbepleu-gens', [
    { p: [4.6, 0, 1.4], ry: -0.4, pose: 'talk', gender: 'homme' },
    { p: [-4, 0, 7.2], ry: Math.PI, pose: 'idle', dress: { outfit: 'pagne', outfitColor: '#f08c00' } },
    { p: [-0.6, 0, 1.6], ry: Math.PI * 0.9, pose: 'give', gender: 'femme' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Near within={120}>
        <Herd species={MONKEY} animals={monkeys.a} brain={monkeys.b} far={90} />
      </Near>
      <People list={people} />
    </group>
  )
}

/* ---------- The Cour des Masques ---------- */

// The yard where the masks dance for visitors: the drummers under their shelter, the benches and the
// plastic chairs round the beaten earth, the stilt dancers (the « masques longs », their faces hidden
// under cloth and the high headdress, their stilts in long striped trousers), a juggling mask, the
// raffia skirts. The masks of the sacred forest are never shown: only those danced in public.

/** A stilt dancer, in its own frame (feet at y 0): the long trousers over the stilts, the raffia, the body, the hidden face, the headdress. */
function stiltDancer(stripe: string): Part[] {
  const out: Part[] = []
  for (let i = 0; i < 6; i++) for (const x of [-0.18, 0.18]) out.push([x, 0.25 + i * 0.5, 0, 0.22, 0.5, 0.22, i % 2 ? stripe : '#f4f1e6'])
  out.push([0, 3.2, 0, 1.1, 0.5, 0.8, '#c9a25a'], [0, 3.05, 0, 1.3, 0.3, 1, '#b88f48'])
  out.push([0, 3.85, 0, 0.6, 0.9, 0.4, stripe], [-0.5, 3.8, 0, 0.5, 0.14, 0.14, stripe], [0.5, 3.8, 0, 0.5, 0.14, 0.14, stripe], [-0.78, 3.7, 0, 0.14, 0.4, 0.14, '#2a1a10'], [0.78, 3.7, 0, 0.14, 0.4, 0.14, '#2a1a10'])
  out.push([0, 4.5, 0, 0.42, 0.42, 0.42, '#1c1c1e'], [-0.1, 4.55, 0.22, 0.08, 0.08, 0.02, '#ffffff'], [0.1, 4.55, 0.22, 0.08, 0.08, 0.02, '#ffffff'])
  out.push([0, 4.95, 0, 0.7, 0.3, 0.7, '#c92a2a'], [0, 5.35, 0, 0.3, 0.6, 0.3, '#f4f1e6'], [0, 5.75, 0, 0.12, 0.3, 0.12, '#ffd43b'])
  return out
}
/** A juggling mask: the raffia skirt, the cloth body, the carved face (round eyes), the cowries. */
const juggler: Part[] = [
  [0, 0.6, 0, 1.1, 1.2, 1.1, '#c9a25a'],
  [0, 1.5, 0, 0.6, 0.8, 0.4, '#24386e'],
  [0, 2.1, 0, 0.42, 0.5, 0.36, '#3a2414'],
  [-0.1, 2.15, 0.19, 0.1, 0.1, 0.02, '#f4f1e6'],
  [0.1, 2.15, 0.19, 0.1, 0.1, 0.02, '#f4f1e6'],
  [0, 2.4, 0, 0.6, 0.18, 0.5, '#f4f1e6'],
  [0, 2.55, 0, 0.5, 0.12, 0.4, '#c92a2a'],
]

function Dancer({ parts, p, phase, k = 1 }: { parts: Part[]; p: [number, number, number]; phase: number; k?: number }) {
  const g = useRef<THREE.Group>(null)
  const mat = useMemo(blocksMat, [])
  const at = useMemo(() => {
    const out: At[] = []
    put(out, [0, 0, 0], parts)
    return out
  }, [parts])
  useFrame(({ clock }) => {
    if (!g.current) return
    const t = clock.elapsedTime * 2.2 + phase
    // Stepping and turning to the drums: the high bodies sway, a hop on the beat.
    g.current.position.set(p[0] + Math.sin(t * 0.4) * 2.2 * k, p[1] + Math.abs(Math.sin(t * 1.5)) * 0.25, p[2] + Math.cos(t * 0.3) * 1.2 * k)
    g.current.rotation.set(0, Math.sin(t * 0.5) * 1.2, Math.sin(t * 1.5) * 0.08)
  })
  return (
    <group ref={g}>
      <Blocks at={at} material={mat} color />
    </group>
  )
}

export function CourMasques({ night }: { night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const sign = useSign(tr('LA COUR DES MASQUES'), '#7a3a12', '#fff3bf', night, 0.8)
  const lamp = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f8f4e6', emissive: '#ffb347', emissiveIntensity: 0 }), [])
  lamp.emissiveIntensity = night ? 1 : 0
  const b = useMemo(() => {
    const out: At[] = []
    const lit: At[] = []
    const r = seeded(251)
    // The yard's low wall of banco, the gate on the street, the beaten earth.
    for (const [x, z, w, d] of [
      [0, -12, 28, 0.4],
      [-14, 0, 0.4, 24],
      [14, 0, 0.4, 24],
      [-8.5, 12, 11, 0.4],
      [8.5, 12, 11, 0.4],
    ])
      out.push({ p: [x, 0.7, z], s: [w, 1.4, d], c: '#c08a5a' })
    for (const x of [-3, 3]) out.push({ p: [x, 1.6, 12], s: [0.8, 3.2, 0.8], c: '#a8703a' })
    out.push({ p: [0, 3.4, 12], s: [7, 0.6, 0.9], c: '#a8703a' })
    // The drummers' shelter at the back: posts, a straw roof, the drums in a row.
    put(
      out,
      [0, -9, 0],
      [
        ...[-4, 0, 4].flatMap((x): Part[] => [
          [x, 1.3, -1.2, 0.2, 2.6, 0.2, '#6b4a2a'],
          [x, 1.3, 1.2, 0.2, 2.6, 0.2, '#6b4a2a'],
        ]),
        [0, 2.75, 0, 10, 0.3, 3.4, '#c9a25a'],
        [0, 3.05, 0, 8.6, 0.3, 2.4, '#b88f48'],
      ],
    )
    for (let i = 0; i < 5; i++) out.push({ p: [-3.2 + i * 1.6, 0.55, -8], s: [0.5, 1.1, 0.5], c: i % 2 ? '#6b4a2a' : '#8a5a2a' }, { p: [-3.2 + i * 1.6, 1.12, -8], s: [0.54, 0.04, 0.54], c: '#e9dcc0' })
    // The benches round the dance ground, the plastic chairs, a straw paillote for the elders.
    for (let i = 0; i < 6; i++) out.push({ p: [-11, 0.4, -6 + i * 2.6], s: [0.6, 0.12, 2], c: '#8a6a3c' }, { p: [11, 0.4, -6 + i * 2.6], s: [0.6, 0.12, 2], c: '#8a6a3c' })
    put(
      out,
      [-10, 8, 0],
      [
        [0, 0.04, 0, 3, 0.04, 3, '#a0703a'],
        ...strawRoof(2.2, 1.4, 2.4),
        ...[-1.2, 1.2].flatMap((x): Part[] => [
          [x, 1.2, -1.2, 0.14, 2.4, 0.14, '#6b4a2a'],
          [x, 1.2, 1.2, 0.14, 2.4, 0.14, '#6b4a2a'],
        ]),
      ],
    )
    // The carvers' table under a sheet by the gate: masks laid out, the adzes.
    put(
      out,
      [9, 9, 0],
      [
        [0, 0.8, 0, 3, 0.1, 1.2, '#8a6a3c'],
        [0, 0.4, 0, 2.8, 0.8, 0.08, '#7a5a32'],
        [0, 2.3, 0, 3.4, 0.08, 1.8, '#c92a2a'],
        ...[-1.4, 1.4].flatMap((x): Part[] => [
          [x, 1.1, -0.8, 0.1, 2.3, 0.1, '#6b4a2a'],
          [x, 1.1, 0.8, 0.1, 2.3, 0.1, '#6b4a2a'],
        ]),
        ...[-1, -0.35, 0.3, 0.95].map((x, i): Part => [x, 1.02, 0, 0.36, 0.5, 0.12, ['#3a2414', '#5a3a1e', '#2a1a10', '#4a2a14'][i]]),
      ],
    )
    // The dust of the dance ground, the strings of bulbs for the evening.
    for (let i = 0; i < 10; i++) out.push({ p: [(r() - 0.5) * 14, 0.03, (r() - 0.5) * 10], s: [1.4, 0.03, 1], ry: r() * 3, c: '#b07a4a' })
    for (let i = 0; i < 12; i++) lit.push({ p: [-11 + i * 2, 3.4 - Math.sin((i / 11) * Math.PI) * 0.6, 2], s: [0.22, 0.22, 0.22] })
    out.push({ p: [-13, 1.8, 2], s: [0.14, 3.6, 0.14], c: '#6b4a2a' }, { p: [13, 1.8, 2], s: [0.14, 3.6, 0.14], c: '#6b4a2a' }, { p: [0, 3.3, 2], s: [26, 0.03, 0.03], c: '#1c1c1e' })
    return { out, lit }
  }, [])
  const dancers = useMemo(() => [stiltDancer('#c92a2a'), stiltDancer('#1971c2')], [])
  const people = usePeople('masques-gens', [
    ...[-3.2, -1.6, 0, 1.6, 3.2].map((x, i) => ({ p: [x, 0, -8.8] as [number, number, number], ry: 0, pose: (i % 2 ? 'balafon' : 'clap') as never, gender: 'homme' as const })),
    ...[-6, -3.4, -0.8].map((z, i) => ({ p: [-10.6, 0, z] as [number, number, number], ry: Math.PI / 2, pose: (['sitclap', 'sit', 'sitlaugh'] as never[])[i] })),
    ...[-2, 0.6, 3.2].map((z, i) => ({ p: [10.6, 0, z] as [number, number, number], ry: -Math.PI / 2, pose: (['sitlaugh', 'sitclap', 'sit'] as never[])[i] })),
    { p: [-3, 0, 9], ry: Math.PI, pose: 'film' },
    { p: [9, 0, 8.2], ry: Math.PI, pose: 'serve', gender: 'homme' },
  ])
  return (
    <group>
      <Blocks at={b.out} material={mat} color />
      <Blocks at={b.lit} material={lamp} />
      <Sign s={sign} w={6.4} p={[0, 3.4, 12.46]} />
      <Near within={140}>
        <Dancer parts={dancers[0]} p={[-2.5, 0, 0]} phase={0} />
        <Dancer parts={dancers[1]} p={[2.5, 0, -1]} phase={2.1} />
        <Dancer parts={juggler} p={[0, 0, 3]} phase={4} k={0.6} />
      </Near>
      <People list={people} />
    </group>
  )
}

/* ---------- The Gueu family's coffee plantation ---------- */

export function PlantationCafe({ night }: { night: boolean }) {
  void night
  const mat = useMemo(blocksMat, [])
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(263)
    // The coffee bushes in rows under the forest's big trees left for shade.
    for (let i = 0; i < 36; i++) put(out, [-15 + (i % 9) * 3.6 + r() * 0.6, -4 - Math.floor(i / 9) * 4, r() * 3], coffee())
    for (let i = 0; i < 7; i++) put(out, [(r() - 0.5) * 34, -6 - r() * 14, r() * 3], tree(10 + r() * 5, 2.8 + r(), GREENS[i % 4]))
    // The yard in front: the coffee drying on mats, red then brown; the planter's house of banco and tin.
    for (let i = 0; i < 6; i++) {
      out.push({ p: [-8 + (i % 3) * 4.2, 0.03, 5 + Math.floor(i / 3) * 3.4], s: [3.6, 0.04, 2.6], c: '#c8b48a' })
      for (let k = 0; k < 10; k++) out.push({ p: [-9.4 + (i % 3) * 4.2 + (k % 5) * 0.7, 0.09, 4.2 + Math.floor(i / 3) * 3.4 + Math.floor(k / 5) * 1.4], s: [0.5, 0.06, 0.6], c: i < 3 ? '#8a2a1a' : '#6b4a2a' })
    }
    put(
      out,
      [8, 4, -0.2],
      [
        [0, 1.4, 0, 6, 2.8, 4, '#c08a5a'],
        [0, 2.95, 0, 6.8, 0.2, 4.8, '#9aa3aa'],
        [0, 1, 2.02, 1, 2, 0.04, '#3a2616'],
        [-2, 1.6, 2.02, 0.8, 0.8, 0.04, '#5c8fb3'],
      ],
    )
    // The jute bags of dried coffee by the door, the pestle and mortar.
    for (let i = 0; i < 5; i++) out.push({ p: [5 + (i % 3) * 0.7, 0.3 + Math.floor(i / 3) * 0.5, 7], s: [0.6, 0.5, 0.8], c: ['#b08a56', '#a47f4c', '#bc9662'][i % 3] })
    out.push({ p: [11.4, 0.4, 7.2], s: [0.6, 0.8, 0.6], c: '#6b4a2a' }, { p: [11.4, 1.1, 7.2], s: [0.12, 1.4, 0.12], c: '#8a6a3c' })
    return out
  }, [])
  const people = usePeople('cafe-gens', [
    { p: [-6, 0, -4], ry: 0.4, pose: 'pick', dress: { outfit: 'pagne', outfitColor: '#c92a2a' } },
    { p: [3, 0, -8], ry: -0.4, pose: 'pick', gender: 'homme' },
    { p: [-4, 0, 6.6], ry: 0.2, pose: 'sweep', dress: { outfit: 'pagne', outfitColor: '#2f9e44' } },
    { p: [7, 0, 6.6], ry: -0.8, pose: 'talk', gender: 'homme' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/* ---------- Lianes & Montagnes Excursions ---------- */

export function LianesAgence({ night }: { night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const sign = useSign(tr('LIANES & MONTAGNES EXCURSIONS'), '#5c4e24', '#fff6d6', night, 0.7, '#a9e34b')
  const at = useMemo(() => {
    const out: At[] = []
    put(
      out,
      [0, -2, 0],
      [
        [0, 1.6, 0, 7, 3.2, 5, '#f4f1e6'],
        [0, 3.3, 0.4, 7.6, 0.2, 6.2, '#5c4e24'],
        [0, 1.2, 2.52, 2.2, 2.4, 0.05, '#3a2a1a'],
        [2.4, 1.8, 2.52, 1.6, 1.2, 0.05, '#5c8fb3'],
      ],
    )
    // On the front, a woven bit of liana, rolled, and the photo board of the bridges.
    put(
      out,
      [-2.6, 1.6, 0],
      [
        [0, 1, 0, 1.8, 1.3, 0.08, '#2b2b2b'],
        [0, 1, 0.05, 1.6, 1.1, 0.02, '#5f8f6a'],
        [0, 0.95, 0.07, 1.4, 0.06, 0.02, '#6b5a2a'],
        [0, -0.2, 0, 0.1, 1.2, 0.1, '#6b4a2a'],
      ],
    )
    for (let i = 0; i < 5; i++) out.push({ p: [3.6, 0.15 + i * 0.12, 1.4], s: [1, 0.12, 1], ry: i * 0.5, c: i % 2 ? '#5e7a2a' : '#6b5a2a' })
    return out
  }, [])
  const guide = usePeople('lianes-agence', [{ p: [3.5, 0, 6], ry: -0.6, pose: 'talk', dress: { outfit: 'uniforme', outfitColor: '#5c4e24' } }])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Sign s={sign} w={6.4} p={[0, 4.1, 3.75]} />
      <SafariTruck p={[-5, 0, 7]} ry={0.2} />
      <People list={guide} />
    </group>
  )
}

/* ---------- The Place de la Paix ---------- */

// The square of the Kennedy quarter: its paving, the benches under the trees, the white pillar and its dove
// (the game's monument, not surveyed), the café Touba sellers with their kettles in the morning.
export function PlacePaix({ night }: { night: boolean }) {
  void night
  const mat = useMemo(blocksMat, [])
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(311)
    out.push({ p: [0, 0.04, 0], s: [22, 0.08, 18], c: '#cfc8b8' }, { p: [0, 0.06, 0], s: [8, 0.08, 8], ry: Math.PI / 4, c: '#e2dccd' })
    // The pillar and the dove.
    out.push({ p: [0, 0.5, 0], s: [2.4, 1, 2.4], c: '#f1ece2' }, { p: [0, 3.2, 0], s: [0.9, 4.4, 0.9], c: '#f8f4ea' })
    put(
      out,
      [0, 0, 0.6],
      [
        [0, 5.8, 0, 0.5, 0.4, 1, '#ffffff'],
        [0, 5.95, 0.55, 0.3, 0.3, 0.3, '#ffffff'],
        [0.6, 6, -0.1, 1, 0.08, 0.5, '#ffffff', 0.2],
        [-0.6, 6, -0.1, 1, 0.08, 0.5, '#ffffff', -0.2],
        [0, 5.95, 0.75, 0.08, 0.08, 0.2, '#f08c00'],
      ],
    )
    // The benches round it, the shade trees, the flowerbeds.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      out.push({ p: [Math.cos(a) * 6, 0.45, Math.sin(a) * 6], s: [2, 0.12, 0.6], ry: -a + Math.PI / 2, c: '#8a6a3c' })
      if (i % 2) put(out, [Math.cos(a) * 9, Math.sin(a) * 7.5, r()], tree(4 + r() * 2, 2 + r() * 0.6, GREENS[i % 4]))
      else out.push({ p: [Math.cos(a) * 8.6, 0.3, Math.sin(a) * 7], s: [2, 0.5, 1.2], c: '#4c8a3a' })
    }
    // The café Touba seller's table, her kettles and cups; a moto-taxi waiting.
    put(
      out,
      [6, 7, 0.4],
      [
        [0, 0.7, 0, 1.4, 0.08, 0.8, '#8a6a3c'],
        [0, 0.35, 0, 1.3, 0.7, 0.06, '#7a5a32'],
        [-0.4, 0.92, 0, 0.3, 0.36, 0.3, '#adb5bd'],
        [0.1, 0.92, 0, 0.3, 0.36, 0.3, '#adb5bd'],
        [0.5, 0.82, 0.1, 0.12, 0.16, 0.12, '#f4f1e6'],
      ],
    )
    put(
      out,
      [-8, 8, 0.2],
      [
        [0, 0.5, 0, 1.7, 0.4, 0.25, '#c92a2a'],
        [0.75, 0.3, 0, 0.6, 0.6, 0.1, '#1c1c1e'],
        [-0.75, 0.3, 0, 0.6, 0.6, 0.1, '#1c1c1e'],
      ],
    )
    return out
  }, [])
  const people = usePeople('paix-gens', [
    { p: [6, 0, 6.3], ry: Math.PI, pose: 'cook', dress: { outfit: 'pagne', outfitColor: '#1c7ed6' } },
    { p: [6.4, 0, 8], ry: 0, pose: 'drink', gender: 'homme' },
    { p: [-5.8, 0, -1.5], ry: 1.4, pose: 'sit' },
    { p: [2, 0, -5.6], ry: 0, pose: 'sit', gender: 'femme' },
    { p: [-8, 0, 9], ry: 0, pose: 'phone', gender: 'homme' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/* ---------- The Maquis Le Pied de la Dent, Le Sommet Club, the Hôtel La Brume du Tonkpi ---------- */

const PIED_DENT: MaquisSpec = {
  name: 'LE PIED DE LA DENT',
  sign: ['#2b8a3e', '#fff3bf'],
  wall: '#c08a5a',
  roof: 'tin',
  food: 'fish',
  plastic: ['#ffffff', '#c92a2a', '#2f9e44'],
  seed: 41,
  // The rice pots on the fire, the calabashes of bangui, a mask hung by the bar.
  extra: [
    [-3.6, 0.45, 6.2, 0.9, 0.9, 0.9, '#3a3a3a'],
    [-2.4, 0.45, 6.2, 0.9, 0.9, 0.9, '#3a3a3a'],
    [3.4, 0.8, 6.2, 2, 0.08, 0.9, '#8a6a3c'],
    [3.0, 0.95, 6.2, 0.4, 0.22, 0.4, '#d9a441'],
    [3.8, 0.95, 6.2, 0.4, 0.22, 0.4, '#d9a441'],
    [-4, 2.4, -3.96, 0.5, 0.7, 0.08, '#3a2414'],
  ],
}
const SOMMET: ClubSpec = {
  name: 'LE SOMMET CLUB',
  neon: '#69db7c',
  neon2: '#ffd43b',
  wall: '#1f2a24',
  seed: 43,
  bpm: 122,
  // A mountain's silhouette over the roof, in steps, its tooth.
  motif: [
    [0, 7.6, -2, 12, 0.8, 0.4, '#2f4a3a'],
    [-1, 8.4, -2, 8, 0.8, 0.4, '#2f4a3a'],
    [-1.6, 9.4, -2, 3, 1.2, 0.4, '#2f4a3a'],
    [-1.4, 10.6, -2, 1.6, 1.2, 0.4, '#2f4a3a'],
  ],
}
export const MaquisPiedDent = ({ night }: { night: boolean }) => <Maquis spec={PIED_DENT} night={night} />
export const SommetClub = ({ night }: { night: boolean }) => <Club spec={SOMMET} night={night} />
export const HotelBrume = ({ night }: { night: boolean }) => <SmallHotel name={tr('HÔTEL LA BRUME DU TONKPI')} sign={['#24386e', '#ffffff']} wall="#f1ece2" accent="#2b8a3e" seed={47} night={night} />
