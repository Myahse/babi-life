import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Blocks } from './ruePrincesse'
import type { At } from './shoreline'
import { put, seeded, type Part } from './kit3d'
import { Market, People, Sign, usePeople, useSign, type MarketSpec } from './villeKit'
import { WindowBox, dome, octo, ring, spire, useBlocks, streetLife, clockFace } from './paysKit'
import { worldTime } from '../../lib/worldClock'

// New York's landmarks (the update « pays-usa », backend world/pays.go), at their real size where it's known:
// the Empire State Building (381 m to its roof, its setbacks, its mast; seen from all over the city), Times
// Square and its screens, Grand Central Terminal's front, the Apollo Theater's sign in Harlem, City Hall, the
// African market of 116th Street, Yankee Stadium, the Unisphere of Flushing Meadows. The streets and the
// other buildings are the map's (OpenStreetMap, with their heights). Proportions from photographs; the
// screens show the game's own ads, never a real brand. Frames: +z the street (the place's door).

const LIMESTONE = '#d9d2c3'
const LIMESTONE_D = '#c4bba8'
const GLASS = '#3d4f63'
const STEEL = '#aab2bb'
const CAB = '#f7c600'

/** A yellow cab, facing +x. */
const cab: Part[] = [
  [0, 0.55, 0, 4.6, 0.7, 1.8, CAB],
  [-0.2, 1.1, 0, 2.6, 0.55, 1.6, CAB],
  [-0.2, 1.1, 0, 2.4, 0.45, 1.65, '#2b3440'],
  [-0.2, 1.45, 0, 0.6, 0.18, 0.3, '#f8f9fa'],
  ...[-1.5, 1.5].flatMap((x): Part[] => [
    [x, 0.3, 0.86, 0.6, 0.6, 0.2, '#1a1a1a'],
    [x, 0.3, -0.86, 0.6, 0.6, 0.2, '#1a1a1a'],
  ]),
]

/* ---------- The Empire State Building ---------- */

/**
 * The Empire State Building (1931): the five-storey base on the whole block, then the setbacks (floors 6,
 * 21, 30), the long shaft to the 72nd, the steps to the 86th's observatory, the mooring mast and its spire,
 * the antenna. Limestone and its vertical strips of windows; at night the top lit in colours (white, blue,
 * red, slowly turning).
 */
export function EmpireState({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff3d6', 0.1)
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), [])
  useFrame(() => {
    if (!night) return glow.color.set('#f1ece0')
    const t = worldTime() / 40
    glow.color.setHSL((Math.floor(t) % 3) * 0.33 + 0.6, 0.7, 0.62)
  })
  const z = -36
  const tiers: [number, number, number, number][] = [
    // width, depth, from, to (metres)
    [120, 56, 0, 25],
    [94, 48, 25, 82],
    [78, 42, 82, 112],
    [58, 36, 112, 262],
    [46, 30, 262, 296],
    [32, 22, 296, 320],
  ]
  const at = useMemo(() => {
    const out: At[] = []
    // The piers up the shaft's corners, the cornices of each step.
    for (const [w, d, y0, y1] of tiers) {
      out.push({ p: [0, y1 + 0.4, z], s: [w + 0.6, 0.8, d + 0.6], c: LIMESTONE_D })
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push({ p: [(sx * w) / 2, (y0 + y1) / 2, z + (sz * d) / 2], s: [1.4, y1 - y0, 1.4], c: LIMESTONE })
    }
    // The 86th's observatory deck and its railing.
    out.push({ p: [0, 321.4, z], s: [36, 0.4, 26], c: STEEL })
    ring(out, [0, 322.4, z], 15, 32, [2.8, 1.6, 0.15], STEEL)
    // The entrance on Fifth Avenue: the canopy, the doors, the flags.
    out.push({ p: [0, 5, z + 28.2], s: [16, 9, 0.4], c: '#2a2a2a' }, { p: [0, 9.6, z + 29], s: [18, 0.6, 2.2], c: '#c9a24a' })
    for (const x of [-12, -8, 8, 12]) out.push({ p: [x, 6, z + 29], s: [0.12, 12, 0.12], c: '#ccc' }, { p: [x + 1.1, 11, z + 29], s: [2, 1.3, 0.04], c: x < 0 ? '#1c3f94' : '#bf0a30' })
    streetLife(out, 'newyork', -60, 60, 0, 571)
    return out
  }, [])
  // The mast and the spire (lit at night), the antenna.
  const lit = useMemo(() => {
    const out: At[] = []
    octo(out, [0, 328, z], 18, 16, '#e8e2d4', '#dcd5c5')
    octo(out, [0, 342, z], 13, 12, '#e8e2d4', '#dcd5c5')
    octo(out, [0, 353, z], 9, 10, '#e8e2d4', '#dcd5c5')
    octo(out, [0, 363, z], 6, 10, '#e8e2d4', '#dcd5c5')
    spire(out, [0, 368, z], 5, 6, 4, '#dcd5c5')
    return out
  }, [])
  const antenna = useMemo<At[]>(
    () => [
      { p: [0, 400, z], s: [1.2, 60, 1.2], c: '#9aa3aa' },
      { p: [0, 432, z], s: [0.5, 12, 0.5], c: '#e03131' },
    ],
    [],
  )
  return (
    <group>
      {tiers.map(([w, d, y0, y1], i) => (
        <WindowBox key={i} s={[w, y1 - y0, d]} p={[0, (y0 + y1) / 2, z]} wall={LIMESTONE} glass={GLASS} bay={1.5} floor={3.8} night={night} />
      ))}
      <Blocks at={at} material={mat} color />
      <Blocks at={lit} material={glow} color />
      <Blocks at={antenna} material={mat} color />
    </group>
  )
}

/* ---------- Times Square ---------- */

/** The screens' ads, the game's own (never a real brand): the colours and words they cycle through. */
const ADS: [string, string, string][] = [
  ['BABI LIFE', '#ff7a00', '#ffffff'],
  ['GARBA EXPRESS', '#ffd43b', '#1b1b2f'],
  ['AIR LAGUNE · NY ↔ ABJ', '#1d4ed8', '#ffffff'],
  ['ZOUGLOU NIGHT', '#ae3ec9', '#ffffff'],
  ['ATTIÉKÉ CO.', '#2f9e44', '#ffffff'],
  ['BROADWAY TONIGHT', '#e03131', '#ffffff'],
]

/** A giant screen showing the ads in turn (each a few seconds), at p turned ry, w×h. */
function Screen({ p, ry = 0, w, h, seed, night }: { p: [number, number, number]; ry?: number; w: number; h: number; seed: number; night: boolean }) {
  const signs = ADS.map(([t, bg, ink]) => useSign(t, bg, ink, night, 1.2)) // eslint-disable-line react-hooks/rules-of-hooks
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const i = Math.floor(worldTime() / 6 + seed) % signs.length
    if (ref.current && ref.current.material !== signs[i].m) ref.current.material = signs[i].m
  })
  // (Bright by day too: they're screens.)
  for (const s of signs) (s.m as THREE.MeshLambertMaterial).emissiveIntensity = night ? 1.2 : 0.7
  return (
    <mesh ref={ref} position={p} rotation={[0, ry, 0]} material={signs[0].m}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

/**
 * Times Square: the pedestrian plaza in the bow of Broadway and Seventh Avenue, the red glass steps over
 * the ticket booth, the towers on each side covered in screens, the yellow cabs, the crowd.
 */
export function TimesSquare({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffe8c0', 0.12)
  const steps = useMemo(() => new THREE.MeshLambertMaterial({ color: '#c92a2a', emissive: new THREE.Color('#ff3b3b') }), [])
  steps.emissiveIntensity = night ? 0.8 : 0.15
  const at = useMemo(() => {
    const out: At[] = []
    // The plaza's paving, its red-tinted ground, the planters and the chairs.
    out.push({ p: [0, 0.05, -20], s: [30, 0.1, 64], c: '#8e5a52' })
    for (let i = 0; i < 6; i++) out.push({ p: [i % 2 ? 11 : -11, 0.5, -44 + i * 9], s: [3, 1, 1.2], c: '#5c9e31' })
    // The cabs on the avenues each side.
    const r = seeded(7)
    for (let i = 0; i < 8; i++) put(out, [i % 2 ? 20 : -20, -48 + i * 11 + r() * 3, i % 2 ? Math.PI / 2 : -Math.PI / 2], cab)
    return out
  }, [])
  const red = useMemo(() => {
    const out: At[] = []
    // The red steps (TKTS), rising to the back.
    for (let i = 0; i < 9; i++) out.push({ p: [0, 0.3 + i * 0.6, -14 - i * 1.1], s: [14, 0.6, 1.1], c: '#d63a3a' })
    return out
  }, [])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Blocks at={red} material={steps} color />
      {/* The towers each side, glass and stone, their screens. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <WindowBox s={[18, 120, 26]} p={[s * 34, 60, -26]} wall="#6c7480" glass="#22303d" bay={1.6} floor={3.6} kind="grid" night={night} />
          <WindowBox s={[20, 90, 22]} p={[s * 34, 45, -54]} wall="#8a7f74" glass="#2b3440" bay={1.8} floor={3.6} night={night} />
          <Screen p={[s * 24.9, 22, -26]} ry={-s * (Math.PI / 2)} w={24} h={14} seed={s + 2} night={night} />
          <Screen p={[s * 24.9, 42, -26]} ry={-s * (Math.PI / 2)} w={20} h={10} seed={s + 4} night={night} />
          <Screen p={[s * 23.9, 16, -54]} ry={-s * (Math.PI / 2)} w={20} h={12} seed={s + 7} night={night} />
        </group>
      ))}
      <Screen p={[0, 30, -64]} w={26} h={16} seed={9} night={night} />
      <WindowBox s={[30, 110, 14]} p={[0, 55, -72]} wall="#59616c" glass="#1f2a36" bay={1.6} floor={3.6} kind="grid" night={night} />
      <TimesPeople />
    </group>
  )
}
function TimesPeople() {
  const people = usePeople('times-square', [
    { p: [2, 0.1, -6], ry: Math.PI, pose: 'film' },
    { p: [-3, 0.1, -8], ry: 2.8, pose: 'walk' },
    { p: [5, 0.1, -10], ry: 0.4, pose: 'phone' },
    { p: [-6, 0.1, -4], ry: 3.6, pose: 'talk' },
    { p: [0, 3.3, -19], ry: 0, pose: 'sit' },
    { p: [3, 2.7, -18], ry: 0, pose: 'sit' },
  ])
  return <People list={people} />
}

/* ---------- Grand Central Terminal ---------- */

/** Grand Central Terminal (1913): the Beaux-Arts front on 42nd Street, its three great arched windows between paired columns, the clock and Mercury's sculpture over the cornice, the green copper roof; the building behind. */
export function GrandCentral({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.14)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -12
    out.push({ p: [0, 15, z - 30], s: [90, 30, 60], c: LIMESTONE })
    out.push({ p: [0, 30.6, z - 30], s: [91, 1.2, 61], c: '#5f8f7a' })
    // The front: the three arches (their windows), the paired columns.
    for (const x of [-18, 0, 18]) {
      out.push({ p: [x, 13, z + 0.1], s: [11, 20, 0.2], c: '#4a5a66' })
      for (let k = 1; k < 4; k++) out.push({ p: [x, 4 + k * 5, z + 0.2], s: [11, 0.25, 0.1], c: LIMESTONE_D })
      out.push({ p: [x, 23.5, z + 0.15], s: [9, 2, 0.2], c: '#4a5a66' })
    }
    for (const x of [-27, -9, 9, 27]) for (const dx of [-1.6, 1.6]) out.push({ p: [x + dx, 13, z + 1.2], s: [1.6, 24, 1.6], c: '#e6e0d2' })
    out.push({ p: [0, 26, z + 0.8], s: [86, 2.4, 2.2], c: LIMESTONE_D }, { p: [0, 28.8, z + 0.5], s: [80, 3, 1.6], c: LIMESTONE })
    // The clock and the sculpture group (Mercury, Hercules, Minerva) over the middle.
    out.push({ p: [0, 33, z + 1.2], s: [5.6, 5.6, 1], c: LIMESTONE_D })
    clockFace(out, [0, 33, z + 1.8], 2.1)
    out.push({ p: [0, 36.5, z + 0.8], s: [3, 4.4, 1.4], c: '#7fa08f' }, { p: [-4, 34.5, z + 0.8], s: [2.6, 3, 1.4], c: '#7fa08f' }, { p: [4, 34.5, z + 0.8], s: [2.6, 3, 1.4], c: '#7fa08f' })
    // The ramps and the taxis waiting.
    for (let i = 0; i < 4; i++) put(out, [-14 + i * 9, z + 6, 0], cab)
    streetLife(out, 'newyork', -44, 44, 0, 588)
    return out
  }, [])
  const people = usePeople('grand-central', [
    { p: [4, 0, -8], ry: Math.PI, pose: 'walk' },
    { p: [-6, 0, -9], ry: 0, pose: 'phone' },
    { p: [10, 0, -7], ry: 2.2, pose: 'carry' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/* ---------- Harlem ---------- */

/** The Apollo Theater on 125th Street: the narrow brick front, the great vertical sign and the marquee lit with bulbs, the Walk of Fame. */
export function Apollo({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffe8c0', 0.12)
  const bulbs = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff3bf' }), [])
  const marquee = useSign('APOLLO', '#c92a2a', '#fff3bf', night, 1.4)
  const letters = 'APOLLO'.split('').map((l) => useSign(l, '#c92a2a', '#fff3bf', night, 1.4)) // eslint-disable-line react-hooks/rules-of-hooks
  const at = useMemo(() => {
    const out: At[] = []
    out.push({ p: [0, 9, -6], s: [16, 18, 12], c: '#8a3b2a' }, { p: [0, 18.3, -6], s: [16.4, 0.6, 12.4], c: '#d9c4a8' })
    for (let f = 0; f < 4; f++) for (const x of [-5, -1.7, 1.7, 5]) out.push({ p: [x, 6 + f * 3.2, 0.02], s: [1.4, 2, 0.1], c: '#2b3440' })
    out.push({ p: [0, 4.6, 1.5], s: [15, 1.6, 3], c: '#c92a2a' }, { p: [0, 1.8, 0.05], s: [6, 3.4, 0.1], c: '#2a2a2a' })
    // The vertical sign's board, sticking out over the pavement.
    out.push({ p: [8.1, 11, 1.4], s: [0.4, 14, 2.8], c: '#b02020' })
    // The Walk of Fame's stars on the pavement.
    for (let i = 0; i < 5; i++) out.push({ p: [-6 + i * 3, 0.06, 4], s: [1, 0.04, 1], ry: Math.PI / 4, c: '#c9a24a' })
    return out
  }, [])
  const lights = useMemo(() => {
    const out: At[] = []
    for (let x = -7.2; x <= 7.2; x += 0.6) out.push({ p: [x, 3.75, 3.02], s: [0.16, 0.16, 0.16] }, { p: [x, 5.45, 3.02], s: [0.16, 0.16, 0.16] })
    return out
  }, [])
  bulbs.color.set(night ? '#fff3bf' : '#c8bfa0')
  const people = usePeople('apollo', [
    { p: [3, 0, 5], ry: Math.PI, pose: 'film' },
    { p: [-2, 0, 5.5], ry: 0.3, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Blocks at={lights} material={bulbs} />
      <Sign s={marquee} w={8} p={[0, 4.6, 3.02]} />
      {letters.map((s, i) => (
        <group key={i}>
          <Sign s={s} w={2.2} p={[8.36, 16.4 - i * 2.2, 1.4]} ry={Math.PI / 2} />
          <Sign s={s} w={2.2} p={[7.84, 16.4 - i * 2.2, 1.4]} ry={-Math.PI / 2} />
        </group>
      ))}
      <People list={people} />
    </group>
  )
}

/** The Malcolm Shabazz Harlem Market on 116th Street, in « Little Senegal »: its green pavilions, the wax and the masks, the shea butter and the drums. */
const SHABAZZ: MarketSpec = {
  gate: 'MARCHÉ MALCOLM SHABAZZ',
  sign: ['#2f6a30', '#ffd43b'],
  seed: 116,
  w: 22,
  d: 18,
  goods: ['#e8590c', '#1c7ed6', '#2f9e44', '#ffd43b', '#6b3a1a', '#f4f1e6', '#a61e4d'],
  hangings: ['#1c7ed6', '#e8590c', '#2f9e44', '#c92a2a', '#ffd43b'].map((c): Part[] => [
    [0, 1.4, 0, 1.4, 1.6, 0.04, c],
    [0, 1.4, 0.03, 1.2, 0.3, 0.02, '#1b1b2f'],
  ]),
  hall: { w: 16, d: 10, h: 5, roof: '#2f6a30' },
  gateColour: '#e9e2cf',
}
export function MarcheHarlem({ night }: { night: boolean }) {
  return <Market spec={SHABAZZ} night={night} />
}

/* ---------- City Hall, the Bronx, Queens ---------- */

/** New York City Hall (1812): the white marble front, its portico, its wings, the cupola and its clock, Justice on top; the park in front. */
export function CityHallNY({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.14)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -14
    out.push({ p: [0, 7, z], s: [50, 14, 20], c: '#f1ede4' }, { p: [0, 14.4, z], s: [51, 0.8, 21], c: '#dcd6c8' })
    for (const x of [-22, 22]) out.push({ p: [x, 8, z + 1.5], s: [8, 16, 22], c: '#ece7dc' })
    for (let k = 0; k < 9; k++) for (const y of [4, 10]) if (Math.abs(k - 4) > 1) out.push({ p: [-18 + k * 4.5, y, z + 10.05], s: [1.6, 3, 0.1], c: '#3b4f63' })
    // The portico and its columns, the steps.
    for (let k = 0; k < 6; k++) out.push({ p: [-6.25 + k * 2.5, 6, z + 12.5], s: [0.9, 10, 0.9], c: '#f8f6f0' })
    out.push({ p: [0, 11.4, z + 12.5], s: [15, 1, 5.5], c: '#ece7dc' })
    for (let i = 0; i < 4; i++) out.push({ p: [0, 0.2 + i * 0.4, z + 16.5 - i * 0.6], s: [16, 0.4, 2], c: '#e2dccd' })
    // The cupola: drum, columns, clock, dome, Justice.
    octo(out, [0, 17, z], 7, 5, '#f1ede4')
    ring(out, [0, 21.5, z], 3, 8, [0.5, 4, 0.5], '#f8f6f0')
    octo(out, [0, 24, z], 7, 1, '#dcd6c8')
    dome(out, [0, 24.5, z], 3, 4, '#c9b38a', '#b9a37a')
    clockFace(out, [0, 19, z + 3.55], 1, '#c9b38a')
    out.push({ p: [0, 28.4, z], s: [0.7, 2.2, 0.6], c: '#c9a24a' })
    // The park in front: the lawns, the fountain.
    out.push({ p: [-10, 0.1, z + 26], s: [14, 0.2, 10], c: '#5c9e31' }, { p: [10, 0.1, z + 26], s: [14, 0.2, 10], c: '#5c9e31' })
    octo(out, [0, 0.4, z + 26], 6, 0.8, '#d6cfc0')
    octo(out, [0, 0.7, z + 26], 5, 0.2, '#4dabf7')
    streetLife(out, 'newyork', -28, 28, 22, 622)
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/** Yankee Stadium (2009): the limestone ring and its tall arched openings, the gilded name's frieze, the stands in tiers, the diamond and its outfield. */
export function YankeeStadium({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffffff', 0.12)
  const sign = useSign('YANKEE STADIUM', '#1c2a4a', '#e9ecef', night)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -70
    // The field: grass, the infield's earth, the bases, the mound.
    out.push({ p: [0, 0.1, z], s: [120, 0.2, 120], c: '#3f8f3a' })
    out.push({ p: [0, 0.22, z + 30], s: [30, 0.04, 30], ry: Math.PI / 4, c: '#b07a4a' }, { p: [0, 0.24, z + 30], s: [20, 0.04, 20], ry: Math.PI / 4, c: '#3f8f3a' })
    out.push({ p: [0, 0.5, z + 30], s: [3, 0.6, 3], c: '#b07a4a' })
    // The stands: three tiers rising, round the field (an octagon of 24 sides).
    for (let tier = 0; tier < 3; tier++) ring(out, [0, 3 + tier * 7, z], 66 + tier * 7, 28, [16, 6, 7], tier % 2 ? '#2f4a7a' : '#3a5a8a')
    // The limestone outer wall, its arches, the frieze on top.
    ring(out, [0, 13, z], 88, 36, [16, 26, 2], LIMESTONE)
    ring(out, [0, 10, z], 89.2, 36, [8, 16, 0.4], '#3a3f46')
    ring(out, [0, 27, z], 88, 36, [16, 2, 3], '#e9e2cf')
    // The light towers.
    for (const a of [0.6, 1.6, 2.6, 3.6, 4.6, 5.6]) out.push({ p: [Math.sin(a) * 80, 32, z + Math.cos(a) * 80], s: [1, 14, 1], c: STEEL }, { p: [Math.sin(a) * 80, 39.5, z + Math.cos(a) * 80], s: [6, 2, 1], ry: a, c: '#f8f9fa' })
    streetLife(out, 'newyork', -40, 40, 26, 639)
    return out
  }, [])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Sign s={sign} w={24} p={[0, 22, 19.5]} />
    </group>
  )
}

/** The Unisphere (1964), Flushing Meadows: the steel globe of 37 m on its tripod, its meridians and parallels, the continents, the three orbits' rings, the pool and its fountains round it. */
export function Unisphere({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#e8f4ff', 0.14)
  const at = useMemo(() => {
    const out: At[] = []
    const c: [number, number, number] = [0, 26, -30]
    const R = 18.5
    // The pool round it, its fountains.
    octo(out, [0, 0.3, -30], 64, 0.6, '#d6cfc0')
    octo(out, [0, 0.5, -30], 58, 0.3, '#4dabf7', '#3b9be0')
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      out.push({ p: [Math.sin(a) * 26, 2, -30 + Math.cos(a) * 26], s: [0.4, 3, 0.4], c: '#e7f5ff' })
    }
    // The tripod.
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2
      out.push({ p: [Math.sin(a) * 2.2, 4.5, -30 + Math.cos(a) * 2.2], s: [1.6, 9, 1.6], ry: a, c: STEEL })
    }
    // The meridians (vertical circles) and the parallels (horizontal), in steel.
    for (let m = 0; m < 10; m++) {
      const phi = (m / 10) * Math.PI
      for (let i = 0; i < 72; i++) {
        const t = (i / 72) * Math.PI * 2
        // Each piece along the circle (its height the arc's step), turned to face out.
        out.push({ p: [c[0] + Math.cos(phi) * Math.cos(t) * R, c[1] + Math.sin(t) * R, c[2] + Math.sin(phi) * Math.cos(t) * R], s: [0.35, 1.7, 0.35], ry: -phi, c: STEEL })
      }
    }
    for (let l = -3; l <= 3; l++) {
      const y = (l / 4) * R
      const rr = Math.sqrt(R * R - y * y)
      ring(out, [c[0], c[1] + y, c[2]], rr, Math.ceil(rr * 3.4), [(2 * Math.PI * rr) / Math.ceil(rr * 3.4) + 0.05, 0.35, 0.35], STEEL)
    }
    // The continents: plates on the sphere's face (Africa toward the street, the Americas to its left).
    const plate = (lat: number, lon: number, w: number, h: number) => {
      for (let i = 0; i < w; i++)
        for (let j = 0; j < h; j++) {
          const la = lat + j * 0.12
          const lo = lon + i * 0.14
          out.push({ p: [c[0] + Math.cos(la) * Math.sin(lo) * R, c[1] + Math.sin(la) * R, c[2] + Math.cos(la) * Math.cos(lo) * R], s: [2.4, 2.2, 0.6], ry: lo, c: '#8a959f' })
        }
    }
    plate(-0.6, -0.25, 5, 9)
    plate(0.15, -0.4, 6, 4)
    plate(-0.8, -1.6, 4, 8)
    plate(0.2, -1.9, 6, 5)
    plate(0.25, 0.4, 9, 4)
    // The three orbits' rings, tilted.
    for (const [r, tilt, turn] of [
      [23, 0.35, 0.3],
      [21.5, -0.45, 1.4],
      [24, 0.2, 2.5],
    ] as const)
      for (let i = 0; i < 90; i++) {
        const t = (i / 90) * Math.PI * 2
        const [x0, y0, z0] = [Math.cos(t) * r, Math.sin(t) * r * Math.sin(tilt), Math.sin(t) * r * Math.cos(tilt)]
        out.push({ p: [c[0] + x0 * Math.cos(turn) - z0 * Math.sin(turn), c[1] + y0, c[2] + x0 * Math.sin(turn) + z0 * Math.cos(turn)], s: [1.7, 0.25, 0.25], ry: -t - turn, c: '#dee2e6' })
      }
    streetLife(out, 'newyork', -34, 34, 8, 656)
    return out
  }, [])
  const people = usePeople('unisphere', [
    { p: [4, 0.6, 2], ry: Math.PI, pose: 'film' },
    { p: [-3, 0.6, 3], ry: 2.8, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}
