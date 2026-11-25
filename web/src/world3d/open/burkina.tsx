import { useMemo } from 'react'
import { Blocks } from './ruePrincesse'
import type { At } from './shoreline'
import { put, seeded, type Part } from './kit3d'
import { People, Sign, usePeople, useSign } from './villeKit'
import { dome, octo, ring, spire, useBlocks, streetLife, disc, clockFace } from './paysKit'

// Burkina Faso's landmarks (the update « pays-burkina », backend world/pays.go), in the game's blocks, each
// mostly one draw call (kit3d.ts, paysKit.tsx), at their real size where it's known:
// - Ouagadougou: the Monument des Héros nationaux on its great roundabout of Ouaga 2000, the Cathédrale de
//   l'Immaculée-Conception in its red earth bricks, the Grand marché Rood Woko and its neo-Sudanese front,
//   the great mosque, the railway station at the end of the line from Abidjan, the Place de la Nation;
// - Bobo-Dioulasso: the great mosque of Dioulassoba, in banco bristling with its wooden toron stakes, the
//   Grand marché and the station, in the neo-Sudanese style.
// Proportions from photographs; the details (the counts of stakes, of arches, the people) are the game's.
// Frames: +z the street (the place's door).

const BANCO = '#c9935a'
const BANCO_D = '#a8743f'
const BANCO_L = '#dcae78'
const LATERITE = '#a4482a'
const LATERITE_D = '#87381f'
const WHITE = '#f3efe6'
const FASO_RED = '#ce1126'
const FASO_GREEN = '#009e49'
const FASO_STAR = '#fcd116'

/** The Burkina flag on its pole (red over green, the yellow star), the pole's foot at p. */
function fasoFlag(out: At[], [x, y, z]: [number, number, number], h = 10) {
  out.push({ p: [x, y + h / 2, z], s: [0.18, h, 0.18], c: '#d0d0d0' })
  out.push({ p: [x + 1.3, y + h - 0.5, z], s: [2.4, 0.8, 0.05], c: FASO_RED }, { p: [x + 1.3, y + h - 1.3, z], s: [2.4, 0.8, 0.05], c: FASO_GREEN }, { p: [x + 1.3, y + h - 0.9, z + 0.03], s: [0.45, 0.45, 0.03], c: FASO_STAR })
}

/** Neo-Sudanese pilasters along a wall (x0..x1 at depth z, its top at y): each a pier in relief and its pointed top. */
function sudanPiers(out: At[], x0: number, x1: number, z: number, y: number, every: number, c: string, top = c) {
  for (let x = x0; x <= x1 + 0.01; x += every) {
    out.push({ p: [x, y / 2, z], s: [0.9, y, 0.7], c })
    spire(out, [x, y, z], 0.9, 1.6, 3, top)
  }
}

/** Toron stakes: wooden beams jutting out of a banco wall, in rows (the Sahel's mosques' scaffolding left in for the yearly re-plastering). */
function torons(out: At[], x0: number, x1: number, z: number, y0: number, y1: number, dir: 1 | -1, side = false) {
  for (let y = y0; y <= y1; y += 1.4) for (let x = x0; x <= x1; x += 1.3) out.push(side ? { p: [z, y, x], s: [0.9, 0.16, 0.16], c: '#6b4a2a' } : { p: [x, y, z + dir * 0.35], s: [0.16, 0.16, 0.9], c: '#6b4a2a' })
}

/* ---------- Ouagadougou ---------- */

/**
 * The Monument des Héros nationaux (Ouaga 2000): the slender shaft rising some fifty metres from its round
 * base in the middle of the great roundabout, the calabash at its top (lit at night), four lower columns
 * round it, the flags, the lawns and the ring of the road.
 */
export function MonumentHeros({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.18)
  const at = useMemo(() => {
    const out: At[] = []
    // The roundabout's island: its kerb, its lawn, the paved ring round the monument.
    octo(out, [0, 0.15, -20], 56, 0.3, '#b9b2a4')
    octo(out, [0, 0.35, -20], 52, 0.2, '#5c9e31', '#64a83a')
    octo(out, [0, 0.5, -20], 26, 0.2, '#d6cfc0')
    // The base: a stepped drum.
    octo(out, [0, 1.5, -20], 18, 2, '#e8e2d4')
    octo(out, [0, 3.5, -20], 14, 2, '#ded6c4')
    octo(out, [0, 6, -20], 10, 3, '#e8e2d4')
    // The four columns round it, each its lamp.
    for (const [dx, dz] of [
      [-10, -10],
      [10, -10],
      [-10, 10],
      [10, 10],
    ] as const) {
      out.push({ p: [dx, 8, -20 + dz], s: [1.4, 16, 1.4], c: '#e8e2d4' }, { p: [dx, 16.4, -20 + dz], s: [2.2, 0.8, 2.2], c: '#c9a24a' })
    }
    // The shaft, narrowing in four stages, its ribs.
    const stages: [number, number, number][] = [
      [7, 6, 12],
      [6, 12, 12],
      [5, 24, 12],
      [4.2, 36, 10],
    ]
    for (const [w, y, h] of stages) {
      octo(out, [0, y + h / 2, -20], w, h, '#f1ece0', '#e6dfcf')
      for (const a of [0, 1, 2, 3]) out.push({ p: [Math.sin((a * Math.PI) / 2) * (w * 0.45), y + h / 2, -20 + Math.cos((a * Math.PI) / 2) * (w * 0.45)], s: [0.5, h, 0.5], ry: (a * Math.PI) / 2, c: '#c9a24a' })
    }
    // The calabash at the top: a round bowl of gold and bronze, its lip, a flame of light.
    dome(out, [0, 46, -20], 6, 5, '#c9a24a', '#b38a35', -0.9)
    octo(out, [0, 46.2, -20], 12.4, 0.6, '#e0b85a')
    dome(out, [0, 46.5, -20], 5.2, 4, '#d9b04f', '#c9a24a', 0.6)
    out.push({ p: [0, 50.6, -20], s: [0.8, 1.6, 0.8], c: '#ffd43b' })
    // The flags round the island.
    for (let i = 0; i < 6; i++) fasoFlag(out, [Math.sin(i * 1.05) * 22, 0.4, -20 + Math.cos(i * 1.05) * 22], 9)
    streetLife(out, 'sahel', -30, 30, 12, 418)
    return out
  }, [])
  const people = usePeople('ouaga-heros', [
    { p: [4, 0.5, -6], ry: Math.PI, pose: 'film' },
    { p: [-3, 0.5, -7], ry: Math.PI, pose: 'talk' },
    { p: [-5, 0.5, -5], ry: 2.6, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/**
 * The Cathédrale de l'Immaculée-Conception (1934-1936), built of the red earth's bricks: the nave and its
 * steep roof, the front between its two square towers and their pyramid tops with their crosses, the three
 * arched doors, the rose, the buttresses down the sides, the forecourt and the statue of the Virgin.
 */
export function CathedraleOuaga({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffd8a8', 0.08)
  const at = useMemo(() => {
    const out: At[] = []
    const z0 = -14
    // The nave, the aisles, the roof in steps.
    out.push({ p: [0, 9, z0 - 18], s: [16, 18, 40], c: LATERITE }, { p: [0, 5, z0 - 18], s: [26, 10, 38], c: LATERITE_D })
    for (let i = 0; i < 6; i++) out.push({ p: [0, 18.4 + i * 1.1, z0 - 18], s: [17 - i * 2.9, 1.1, 41], c: i % 2 ? '#6e2c1a' : '#7a3320' })
    for (let i = 0; i < 4; i++) out.push({ p: [0, 10.3 + i * 0.6, z0 - 18], s: [26.5 - i * 3, 0.6, 38.5], c: '#6e2c1a' })
    // The side windows and buttresses.
    for (let k = 0; k < 8; k++)
      for (const s of [-1, 1]) {
        out.push({ p: [s * 13.05, 5, z0 - 2 - k * 4.4], s: [0.08, 4.4, 1.4], c: '#2a4f8a' }, { p: [s * 13.6, 4, z0 - 4.2 - k * 4.4], s: [1.2, 8, 1.2], c: LATERITE })
        out.push({ p: [s * 8.05, 14, z0 - 2 - k * 4.4], s: [0.08, 3, 1], c: '#2a4f8a' })
      }
    // The front: the gable between the towers, the rose, the three doors under their arches.
    out.push({ p: [0, 10, z0 + 2], s: [16, 20, 1.6], c: '#b0532f' })
    for (let i = 0; i < 4; i++) out.push({ p: [0, 20.6 + i * 1.2, z0 + 2], s: [14 - i * 3.4, 1.2, 1.6], c: '#b0532f' })
    disc(out, [0, 14, z0 + 2.9], 2.4, '#f3efe6')
    disc(out, [0, 14, z0 + 3], 2, '#2a6fd6')
    disc(out, [0, 14, z0 + 3.06], 0.8, '#d62f2f', 4, 0.04)
    out.push({ p: [0, 14, z0 + 3.3], s: [0.3, 3.6, 0.05], c: '#f3efe6' }, { p: [0, 14, z0 + 3.3], s: [3.6, 0.3, 0.05], c: '#f3efe6' })
    for (const x of [-5, 0, 5]) {
      const big = x === 0
      out.push({ p: [x, big ? 3.2 : 2.6, z0 + 2.85], s: [big ? 3 : 2.2, big ? 6.4 : 5.2, 0.1], c: '#4a2a14' })
      out.push({ p: [x, big ? 6.8 : 5.6, z0 + 2.9], s: [big ? 3.8 : 2.8, 0.7, 0.2], c: '#f3efe6' })
    }
    // The two towers, their belfries, their pyramid tops and crosses.
    for (const s of [-1, 1]) {
      const x = s * 10.5
      out.push({ p: [x, 15, z0 + 1.5], s: [6, 30, 6], c: LATERITE })
      for (let f = 0; f < 4; f++) out.push({ p: [x, 6 + f * 6, z0 + 4.55], s: [1, 2.6, 0.1], c: '#2a4f8a' })
      out.push({ p: [x, 26, z0 + 4.56], s: [2.2, 3.4, 0.1], c: '#1d120b' }, { p: [x, 30.4, z0 + 1.5], s: [6.6, 0.8, 6.6], c: '#f3efe6' })
      spire(out, [x, 30.8, z0 + 1.5], 6, 7, 6, LATERITE_D, '#6e2c1a')
      out.push({ p: [x, 39, z0 + 1.5], s: [0.3, 2.4, 0.3], c: '#f1f3f5' }, { p: [x, 39.5, z0 + 1.5], s: [1.4, 0.3, 0.3], c: '#f1f3f5' })
    }
    // The forecourt, the flowerbeds, the Virgin on her pedestal.
    out.push({ p: [0, 0.05, z0 + 12], s: [30, 0.1, 16], c: '#d9c8ae' })
    for (const x of [-10, 10]) out.push({ p: [x, 0.3, z0 + 12], s: [6, 0.6, 8], c: '#4c8a3a' })
    out.push({ p: [-10, 1.4, z0 + 12], s: [1.4, 1.6, 1.4], c: WHITE }, { p: [-10, 3, z0 + 12], s: [0.8, 1.8, 0.6], c: '#dbe9ff' }, { p: [-10, 4.1, z0 + 12], s: [0.5, 0.5, 0.5], c: '#f4f1e6' })
    streetLife(out, 'sahel', -18, 18, 8, 435)
    return out
  }, [])
  const people = usePeople('ouaga-cathedrale', [
    { p: [2, 0, -3], ry: Math.PI, pose: 'walk', dress: { outfit: 'pagne', outfitColor: '#2a6fd6' } },
    { p: [-2, 0, -4], ry: 0.5, pose: 'talk', gender: 'homme', dress: { outfit: 'soutane', outfitColor: '#f4f1e6' } },
    { p: [5, 0, -1], ry: Math.PI, pose: 'pray' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/**
 * The Grand marché Rood Woko (rebuilt, reopened in 2009): its great hall behind a neo-Sudanese front of banco
 * colour, the piers and their pointed tops, the tall gate in the middle under its sign, the stalls and the
 * umbrellas outside, the mobylettes parked.
 */
export function GrandMarcheOuaga({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffe0b0', 0.06)
  const sign = useSign('MARCHÉ ROOD WOKO', '#7a3b1a', '#fff3bf', night)
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(91)
    // The hall: walls, the long sheet roofs in two ridges.
    out.push({ p: [0, 5, -26], s: [70, 10, 44], c: BANCO })
    for (const x of [-17.5, 17.5]) for (let i = 0; i < 3; i++) out.push({ p: [x, 10.4 + i * 0.8, -26], s: [35 - i * 9, 0.8, 45], c: i % 2 ? '#a9b0b6' : '#9aa3aa' })
    // The front: piers, a band of triangles, the windows, the gate.
    sudanPiers(out, -34, 34, -3.6, 11, 4, BANCO_D, BANCO_D)
    for (let x = -32; x <= 32; x += 4) out.push({ p: [x, 6.5, -3.7], s: [1.6, 2.6, 0.2], c: '#4a2a14' })
    for (let x = -33; x <= 33; x += 2) out.push({ p: [x, 9.6, -3.7], s: [0.9, 0.9, 0.2], ry: 0, c: BANCO_L })
    out.push({ p: [0, 8, -3.2], s: [12, 16, 2], c: BANCO_D }, { p: [0, 4, -2.1], s: [6, 8, 0.2], c: '#2a1a0e' })
    spire(out, [0, 16, -3.2], 12, 4, 4, BANCO_D, BANCO)
    // The stalls outside along the street, their umbrellas, the goods.
    const goods = ['#e03131', '#f08c00', '#ffd43b', '#5c9e31', '#f4f1e6', '#1c7ed6', '#a61e4d']
    for (let i = 0; i < 14; i++) {
      const x = -30 + i * 4.6 + (r() - 0.5)
      put(
        out,
        [x, 4, 0],
        [
          [0, 0.45, 0, 2.2, 0.9, 1.4, '#8a6a3c'],
          [0, 0.98, 0, 2, 0.14, 1.2, goods[i % goods.length]],
          [0, 1.6, 0, 0.08, 3.2, 0.08, '#666'],
          [0, 3.2, 0, 2.8, 0.2, 2.8, i % 2 ? FASO_RED : '#f08c00'],
        ],
      )
    }
    // Mobylettes parked by the kerb.
    for (let i = 0; i < 8; i++)
      put(
        out,
        [-26 + i * 7, 9, 1.6],
        [
          [0, 0.5, 0, 0.3, 0.6, 1.5, ['#1c7ed6', '#e03131', '#495057'][i % 3]],
          [0, 0.95, 0.3, 0.5, 0.1, 0.1, '#222'],
        ],
      )
    streetLife(out, 'sahel', -34, 34, 9, 452)
    return out
  }, [])
  const people = usePeople('rood-woko', [
    { p: [-12, 0, 5.5], ry: Math.PI, pose: 'carry', dress: { outfit: 'pagne', outfitColor: '#e8590c' } },
    { p: [6, 0, 5], ry: 0, pose: 'talk', dress: { outfit: 'pagne', outfitColor: '#2f9e44' } },
    { p: [14, 0, 5.4], ry: -1.2, pose: 'point' },
    { p: [-4, 0, 6.5], ry: 1.6, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Sign s={sign} w={10} p={[0, 12.2, -2.05]} />
      <People list={people} />
    </group>
  )
}

/** The great mosque of Ouagadougou (avenue Yennenga): the prayer hall, its arcade, the green dome, the two minarets, the courtyard and its ablutions. */
export function MosqueeOuaga({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#e8fff0', 0.1)
  const at = useMemo(() => {
    const out: At[] = []
    out.push({ p: [0, 5, -18], s: [36, 10, 26], c: '#f2ead8' }, { p: [0, 10.2, -18], s: [36.4, 0.5, 26.4], c: FASO_GREEN })
    for (let k = 0; k < 11; k++) out.push({ p: [-15 + k * 3, 3, -4.9], s: [1.8, 4.4, 0.1], c: '#2b5a3a' }, { p: [-15 + k * 3, 5.5, -4.85], s: [1.2, 0.6, 0.06], c: '#2b5a3a' })
    dome(out, [0, 10.5, -18], 7, 6, '#2f9e44', '#37b24d')
    out.push({ p: [0, 18.4, -18], s: [0.2, 1.4, 0.2], c: FASO_STAR }, { p: [0.3, 19.2, -18], s: [0.55, 0.22, 0.15], c: FASO_STAR })
    for (const s of [-1, 1]) {
      const x = s * 20
      octo(out, [x, 13, -6], 3.4, 26, '#f2ead8')
      octo(out, [x, 20, -6], 4.6, 0.6, FASO_GREEN)
      octo(out, [x, 25.8, -6], 2.6, 3, '#f2ead8')
      dome(out, [x, 27.3, -6], 1.4, 3, FASO_GREEN, '#37b24d')
      out.push({ p: [x, 29.2, -6], s: [0.14, 1, 0.14], c: FASO_STAR })
    }
    out.push({ p: [0, 0.05, 2], s: [40, 0.1, 12], c: '#e2dccd' })
    for (const x of [-20, 20]) out.push({ p: [x, 1, 2], s: [0.4, 2, 12], c: '#f2ead8' })
    put(out, [-8, 4, 0], [[0, 0.5, 0, 6, 1, 0.7, '#d8d2c4'], ...[-2, -1, 0, 1, 2].map((x): Part => [x, 0.9, 0.4, 0.08, 0.2, 0.2, '#adb5bd'])])
    for (let i = 0; i < 5; i++) out.push({ p: [3 + i * 1.6, 0.12, 0], s: [1.2, 0.04, 2], c: ['#a61e4d', '#1c7ed6', '#2f9e44', '#e8590c', '#7048e8'][i] })
    streetLife(out, 'sahel', -22, 22, 9, 469)
    return out
  }, [])
  const people = usePeople('ouaga-mosquee', [
    { p: [-8, 0, 5], ry: Math.PI, pose: 'wash', gender: 'homme' },
    { p: [4, 0, 0], ry: Math.PI, pose: 'salat', gender: 'homme' },
    { p: [7, 0, 6], ry: 2.4, pose: 'talk', gender: 'homme', dress: { outfit: 'boubou', outfitColor: '#f4f1e6' } },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** Ouagadougou's railway station, end of the line from Abidjan: the long two-storey building, its clock pavilion, the platform's canopy, the rails and a train standing. */
export function GareOuaga({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffe8c0', 0.1)
  const sign = useSign('GARE DE OUAGADOUGOU', '#f3efe6', '#7a3b1a', night)
  const at = useMemo(() => {
    const out: At[] = []
    out.push({ p: [0, 4, -8], s: [50, 8, 12], c: '#e7c79a' }, { p: [0, 8.3, -8], s: [51, 0.6, 13], c: LATERITE })
    for (let k = 0; k < 12; k++) for (const y of [2.2, 5.8]) out.push({ p: [-22 + k * 4, y, -1.95], s: [1.4, 2.2, 0.1], c: '#3b5f8a' })
    // The clock pavilion.
    out.push({ p: [0, 7, -7], s: [12, 14, 14], c: '#e7c79a' }, { p: [0, 14.4, -7], s: [12.6, 0.8, 14.6], c: LATERITE })
    clockFace(out, [0, 11, 0.05], 1.5)
    out.push({ p: [0, 2.5, -0.05], s: [4, 5, 0.1], c: '#4a2a14' })
    // Behind: the platform, its canopy, the rails, a train.
    out.push({ p: [0, 0.5, -18], s: [60, 1, 6], c: '#b9b2a4' })
    for (let x = -26; x <= 26; x += 6) out.push({ p: [x, 2.6, -18], s: [0.3, 4.2, 0.3], c: '#495057' })
    out.push({ p: [0, 4.8, -18], s: [60, 0.3, 7], c: '#9aa3aa' })
    for (const z of [-22.5, -24]) out.push({ p: [0, 0.1, z], s: [80, 0.15, 0.2], c: '#5c5f66' })
    for (let i = 0; i < 4; i++) out.push({ p: [-24 + i * 16, 2.2, -23.25], s: [15, 3.4, 3.2], c: i === 0 ? '#e8590c' : '#2b6cb0' }, { p: [-24 + i * 16, 2.6, -21.6], s: [13, 0.9, 0.1], c: '#cfe3f5' })
    fasoFlag(out, [-10, 0, 3], 9)
    streetLife(out, 'sahel', -26, 26, 6, 486)
    return out
  }, [])
  const people = usePeople('ouaga-gare', [
    { p: [3, 0, 2], ry: Math.PI, pose: 'carry' },
    { p: [-4, 0, 3], ry: 0.3, pose: 'phone' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Sign s={sign} w={12} p={[0, 9.4, 0.06]} />
      <People list={people} />
    </group>
  )
}

/** The Place de la Nation: the great paved square, its central monument and its flags, the benches, the trees, the vendors. */
export function PlaceNation({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.12)
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(17)
    out.push({ p: [0, 0.06, -16], s: [60, 0.12, 40], c: '#d6cfc0' })
    for (let x = -28; x <= 28; x += 4) out.push({ p: [x, 0.13, -16], s: [0.2, 0.02, 40], c: '#c4bcab' })
    // The monument: its steps, its stone, the two stylised hands raising the star.
    octo(out, [0, 0.6, -16], 14, 1, '#e8e2d4')
    octo(out, [0, 1.6, -16], 10, 1, '#ded6c4')
    out.push({ p: [0, 6, -16], s: [3.2, 8, 3.2], c: '#f1ece0' })
    for (const s of [-1, 1]) out.push({ p: [s * 2.2, 12, -16], s: [1.2, 6, 1.6], ry: s * 0.25, c: '#c9a24a' })
    out.push({ p: [0, 15.6, -16], s: [2.2, 2.2, 0.5], ry: Math.PI / 4, c: FASO_STAR })
    for (let i = 0; i < 8; i++) fasoFlag(out, [Math.sin(i * 0.785) * 12, 0.12, -16 + Math.cos(i * 0.785) * 12], 8)
    // Trees and benches round the edge.
    for (let i = 0; i < 12; i++) {
      const x = -27 + (i % 6) * 10.8
      const z = i < 6 ? -34 : 2
      put(
        out,
        [x, z, r() * 3],
        [
          [0, 2, 0, 0.5, 4, 0.5, '#6b4a2a'],
          [0, 5, 0, 4.4, 2.4, 4.4, '#3c7a36'],
          [0, 6.4, 0, 3, 1.2, 3, '#4c8a3a'],
          [2.6, 0.4, 0, 2, 0.15, 0.6, '#8a6a3c'],
        ],
      )
    }
    streetLife(out, 'sahel', -30, 30, 8, 503)
    return out
  }, [])
  const people = usePeople('place-nation', [
    { p: [6, 0.1, -6], ry: 2.6, pose: 'walk' },
    { p: [-7, 0.1, -4], ry: 0.3, pose: 'film' },
    { p: [10, 0.1, -2], ry: -2, pose: 'carry', dress: { outfit: 'pagne', outfitColor: '#c92a2a' } },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/* ---------- Bobo-Dioulasso ---------- */

/**
 * The great mosque of Dioulassoba (end of the 19th century), in banco: the long prayer hall and its walls
 * ribbed with piers, each crowned with its cone; the two great towers (the minaret over the mihrab, the
 * tower of the gate), their tiers of toron stakes; the walls' battlements of cones; the courtyard, its wall.
 */
export function MosqueeDioulassoba({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1d0', 0.1)
  const at = useMemo(() => {
    const out: At[] = []
    const z0 = -16
    // The hall, low and long, its parapet of cones every two metres.
    out.push({ p: [0, 3.5, z0], s: [36, 7, 20], c: BANCO })
    for (let x = -17; x <= 17; x += 2) for (const z of [z0 + 10.1, z0 - 10.1]) (out.push({ p: [x, 4, z], s: [0.9, 8, 0.8], c: BANCO_D }), spire(out, [x, 8, z], 0.9, 1.8, 3, BANCO_L, BANCO_D))
    for (let z = z0 - 9; z <= z0 + 9; z += 2) for (const x of [-18.1, 18.1]) (out.push({ p: [x, 4, z], s: [0.8, 8, 0.9], c: BANCO_D }), spire(out, [x, 8, z], 0.9, 1.8, 3, BANCO_L, BANCO_D))
    torons(out, -16, 16, z0 + 10, 2, 6.2, 1)
    // The doors on the front, dark under their lintels.
    for (const x of [-10, -3, 3, 10]) out.push({ p: [x, 1.6, z0 + 10.12], s: [1.6, 3.2, 0.1], c: '#3a2616' })
    // The two great towers: tapering in tiers, bristling with stakes, a cone and an ostrich egg on top.
    const tower = (x: number, z: number, h: number, w: number) => {
      const tiers = 4
      for (let i = 0; i < tiers; i++) {
        const tw = w * (1 - i * 0.16)
        const th = h / tiers
        out.push({ p: [x, th * (i + 0.5), z], s: [tw, th, tw], c: i % 2 ? BANCO : BANCO_L })
        for (let y = th * i + 0.8; y < th * (i + 1); y += 1.3)
          for (let k = -1; k <= 1; k++) {
            out.push({ p: [x + (k * tw) / 3, y, z + tw / 2 + 0.4], s: [0.16, 0.16, 0.9], c: '#6b4a2a' })
            out.push({ p: [x + tw / 2 + 0.4, y, z + (k * tw) / 3], s: [0.9, 0.16, 0.16], c: '#6b4a2a' })
            out.push({ p: [x - tw / 2 - 0.4, y, z + (k * tw) / 3], s: [0.9, 0.16, 0.16], c: '#6b4a2a' })
          }
      }
      spire(out, [x, h, z], w * 0.42, 3, 4, BANCO_D, BANCO)
      out.push({ p: [x, h + 3.3, z], s: [0.5, 0.6, 0.5], c: '#f4f1e6' })
    }
    tower(-8, z0 + 6, 20, 6)
    tower(13, z0 - 4, 15, 5)
    // The courtyard in front, its low wall with cones, the gate.
    out.push({ p: [0, 0.05, z0 + 17], s: [40, 0.1, 14], c: '#c8a878' })
    for (let x = -19; x <= 19; x += 2) {
      if (Math.abs(x) < 2) continue
      out.push({ p: [x, 1.1, z0 + 24], s: [2.05, 2.2, 0.6], c: BANCO })
      spire(out, [x, 2.2, z0 + 24], 0.6, 0.9, 2, BANCO_D)
    }
    for (const x of [-20, 20]) out.push({ p: [x, 1.1, z0 + 17], s: [0.6, 2.2, 14], c: BANCO })
    streetLife(out, 'sahel', -20, 20, 10, 520)
    return out
  }, [])
  const people = usePeople('dioulassoba', [
    { p: [3, 0, 2], ry: Math.PI, pose: 'salat', gender: 'homme' },
    { p: [-6, 0, 4], ry: 0.6, pose: 'talk', gender: 'homme', dress: { outfit: 'boubou', outfitColor: '#f4f1e6' } },
    { p: [8, 0, 5], ry: Math.PI, pose: 'film' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** Bobo-Dioulasso's Grand marché: its square neo-Sudanese hall in banco colours, the piers and the cones, the gates in the middle of each side, the stalls round it. */
export function MarcheBobo({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffe0b0', 0.06)
  const sign = useSign('GRAND MARCHÉ', '#6b2f12', '#fff3bf', night)
  const at = useMemo(() => {
    const out: At[] = []
    out.push({ p: [0, 4.5, -20], s: [40, 9, 34], c: BANCO_L }, { p: [0, 9.3, -20], s: [40.4, 0.6, 34.4], c: '#c08a52' })
    sudanPiers(out, -18, 18, -2.8, 10, 3, BANCO_D, '#9a6434')
    for (let x = -16.5; x <= 16.5; x += 3) out.push({ p: [x, 5.5, -2.9], s: [1.4, 3.6, 0.2], c: '#3a2616' })
    out.push({ p: [0, 7, -2.4], s: [9, 14, 1.6], c: BANCO_D }, { p: [0, 3.2, -1.55], s: [4.4, 6.4, 0.1], c: '#2a1a0e' })
    spire(out, [0, 14, -2.4], 9, 3.4, 4, '#9a6434', BANCO_D)
    const goods = ['#e03131', '#f08c00', '#5c9e31', '#f4f1e6', '#1c7ed6']
    for (let i = 0; i < 10; i++)
      put(
        out,
        [-20 + i * 4.4, 3, 0],
        [
          [0, 0.45, 0, 2.2, 0.9, 1.4, '#8a6a3c'],
          [0, 0.98, 0, 2, 0.14, 1.2, goods[i % 5]],
          [0, 2.2, 0, 2.6, 0.12, 2.2, '#c9b07a'],
        ],
      )
    streetLife(out, 'sahel', -22, 22, 7, 537)
    return out
  }, [])
  const people = usePeople('marche-bobo', [
    { p: [-6, 0, 4.6], ry: Math.PI, pose: 'carry', dress: { outfit: 'pagne', outfitColor: '#1c7ed6' } },
    { p: [5, 0, 4], ry: 0.3, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Sign s={sign} w={7} p={[0, 11.6, -1.55]} />
      <People list={people} />
    </group>
  )
}

/** Bobo-Dioulasso's railway station: the neo-Sudanese front of the line from Abidjan, white and ochre, its central tower and its pinnacles, the platform behind. */
export function GareBobo({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffe8c0', 0.1)
  const sign = useSign('GARE DE BOBO-DIOULASSO', '#f3efe6', '#6b2f12', night)
  const at = useMemo(() => {
    const out: At[] = []
    out.push({ p: [0, 3.5, -8], s: [46, 7, 10], c: WHITE }, { p: [0, 7.2, -8], s: [46.4, 0.4, 10.4], c: '#c08a52' })
    sudanPiers(out, -22, 22, -2.9, 8, 3.2, '#e8dcc4', '#c08a52')
    for (let x = -20.4; x <= 20.4; x += 3.2) out.push({ p: [x, 3.6, -2.95], s: [1.4, 3.6, 0.1], c: '#4a6a8a' })
    out.push({ p: [0, 7, -7], s: [10, 14, 12], c: WHITE }, { p: [0, 14.3, -7], s: [10.4, 0.6, 12.4], c: '#c08a52' })
    for (const s of [-1, 1]) (out.push({ p: [s * 4.6, 15.8, -1.2], s: [1, 3, 1], c: '#e8dcc4' }), spire(out, [s * 4.6, 17.3, -1.2], 1, 2, 3, '#c08a52'))
    out.push({ p: [0, 2.6, -0.95], s: [4, 5.2, 0.1], c: '#4a2a14' })
    ring(out, [0, 10.5, -0.9], 1.4, 12, [0.4, 0.4, 0.1], '#c08a52')
    out.push({ p: [0, 0.5, -17], s: [56, 1, 5], c: '#b9b2a4' })
    for (const z of [-21, -22.5]) out.push({ p: [0, 0.1, z], s: [70, 0.15, 0.2], c: '#5c5f66' })
    streetLife(out, 'sahel', -24, 24, 5, 554)
    return out
  }, [])
  const people = usePeople('gare-bobo', [{ p: [2, 0, 2], ry: Math.PI, pose: 'carry' }])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Sign s={sign} w={11} p={[0, 9.2, -0.9]} />
      <People list={people} />
    </group>
  )
}
