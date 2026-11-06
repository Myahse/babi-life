import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOX, Blocks, lettering, signMaterial } from './ruePrincesse'
import { BUFFALO, CROCODILE, ELEPHANT, Flock, GUINEAFOWL, HARTEBEEST, HIPPO, Herd, KOB_SPECIES, MONKEY, Perched, RHINO, Riders, WARTHOG, Waders, crocBrain, follower, grazer, herdLife, hippoBrain, makeHerd, monkeyBrain, wary, withYoung } from './wildlife'
import { Fireflies, SwayGrass, useHerdDays, type Grounds, type Tuft } from './nziLife'
import { gazeTargetAt } from '../../avatar/expressions'
import { ambience } from '../../audio/ambience'
import { LowHuman } from '../../avatar/LowHuman'
import { NoShadows } from '../../avatar/Human'
import { TalkHuman } from '../Talkable'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { t as tr } from '../../lib/i18n'

// La Réserve de la N'Zi (the update « bouake-vivant »), by N'Dokro in the commune of Brobo, 30 km
// north-east of Bouaké: the wooded savanna of the centre (the « V baoulé »), tall dry grass, rôniers
// and shea trees, red termite mounds, and the N'Zi winding through it with its sandbanks. The herds as
// the reserve's guides show them: the elephants down by the river, the buffalo in the open grass, the
// kobs, the green monkeys round the trees by the lodge; the hippos in the river, a crocodile on the
// sand, herons in the shallows, egrets wheeling. At the road, the gate with its name and the rangers'
// hut, the open 4x4 of the game drives; the laterite track looping out into the savanna; the
// watchtower; and the lodge (Lodge des Rives de la N'Zi, the game's) on the bank: its round thatched
// bungalows, the main house and its terrace over the water, the pool. All of it the game's own
// layout, not surveyed.
//
// The animals are those the reserve itself keeps (its foundation's own list and the news): elephants,
// buffalo, kobs, hartebeest (bubales), warthogs, green monkeys, guineafowl, and its one white rhinoceros,
// brought in 2017 with its horn cut off; the hippos and the crocodile are the river's. No giraffes nor
// zebras: the reserve has none. Each herd lives its day on the shared clock (nziLife.tsx): out grazing
// at dawn, down to the river to drink, lying in the kapok's shade at noon, back out at dusk, bedded down
// at night (their eyes shining). On foot, the Sim is seen: the antelopes and the warthogs bolt, the
// buffalo stare, an elephant spreads its ears and trumpets. The grass and the reeds sway, the vultures
// circle, the weavers bustle round their nests in the lodge's fig, fireflies over the grass at night, and
// the bush has its own sounds (audio/ambience.ts wild).
//
// Frame: +z the road and the gate, the river across the back (−z).

/** The river's line (its middle) across the back, and its half-width. */
const RIVER: [number, number][] = [[-170, -92], [-110, -78], [-50, -84], [0, -98], [50, -90], [110, -76], [170, -86]]
const RIVER_HALF = 11
/** The lodge's reception, where its door is (landmarks.tsx slotIn), and its grounds. */
export const LODGE_DOOR: [number, number] = [-62, -10]
const LODGE: [number, number] = [-70, -40]

/** The river's middle at x (its line, eased between the points). */
export function riverZ(x: number) {
  const i = Math.max(1, RIVER.findIndex((p) => p[0] >= x))
  const [a, b] = [RIVER[i - 1], RIVER[i] ?? RIVER[i - 1]]
  const k = b[0] > a[0] ? Math.min(1, Math.max(0, (x - a[0]) / (b[0] - a[0]))) : 0
  return a[1] + (b[1] - a[1]) * (0.5 - Math.cos(k * Math.PI) / 2)
}
/** On dry land (not in the river nor on its banks), in the reserve. */
const dry = (x: number, z: number) => Math.abs(x) < 150 && z < 70 && z > riverZ(x) + RIVER_HALF + 5 && Math.hypot(x - LODGE[0], z - LODGE[1]) > 34

const M = {
  savanna: new THREE.MeshLambertMaterial({ color: '#b7a35c', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  track: new THREE.MeshLambertMaterial({ color: '#b5653a', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  sand: new THREE.MeshLambertMaterial({ color: '#dcc58e', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  water: new THREE.MeshLambertMaterial({ color: '#4c7f74', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  lawn: new THREE.MeshLambertMaterial({ color: '#6aa34f', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  wood: new THREE.MeshLambertMaterial({ color: '#7a5230' }),
  dark: new THREE.MeshLambertMaterial({ color: '#4a3220' }),
  thatch: new THREE.MeshLambertMaterial({ color: '#c79a52' }),
  wall: new THREE.MeshLambertMaterial({ color: '#d9b48a' }),
  pool: new THREE.MeshLambertMaterial({ color: '#3cb7d6', emissive: '#22b6d6', emissiveIntensity: 0 }),
  colored: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  truck: new THREE.MeshLambertMaterial({ color: '#4f6b3a' }),
  tyre: new THREE.MeshLambertMaterial({ color: '#1d1b1a' }),
  canvas: new THREE.MeshLambertMaterial({ color: '#d8c79a' }),
  lamp: new THREE.MeshLambertMaterial({ color: '#fff4d0', emissive: '#ffb84a', emissiveIntensity: 0 }),
}
const CONE = new THREE.ConeGeometry(1, 1, 10)
const DISC = new THREE.CylinderGeometry(1, 1, 1, 14)
const V = new THREE.Vector3()
const INV = new THREE.Matrix4()

/** A band along a line (the river, the track): one flat strip, `half` each side, at height y. */
function strip(line: [number, number][], half: number, y: number, steps = 8) {
  const pts: [number, number][] = []
  for (let i = 1; i < line.length; i++) for (let k = 0; k < steps; k++) {
    const x = line[i - 1][0] + ((line[i][0] - line[i - 1][0]) * k) / steps
    pts.push([x, riverOr(line, x, i, k / steps)])
  }
  pts.push(line[line.length - 1])
  const pos: number[] = []
  const idx: number[] = []
  pts.forEach(([x, z], i) => {
    const [a, b] = [pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]]
    const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
    const l = Math.hypot(dx, dz) || 1
    const [nx, nz] = [-dz / l, dx / l]
    pos.push(x + nx * half, y, z + nz * half, x - nx * half, y, z - nz * half)
    if (i) idx.push(i * 2 - 2, i * 2, i * 2 - 1, i * 2 - 1, i * 2, i * 2 + 1)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // Facing up whichever way the points went.
  if (g.attributes.normal.getY(0) < 0) {
    g.setIndex(idx.map((_, j) => idx[j - (j % 3) + 2 - (j % 3)]))
    g.computeVertexNormals()
  }
  return g
}
/** The river's own line is eased (riverZ); another line is straight between its points. */
function riverOr(line: [number, number][], x: number, i: number, k: number) {
  return line === RIVER ? riverZ(x) : line[i - 1][1] + (line[i][1] - line[i - 1][1]) * k
}

/** The game-drive's track: from the gate out round the savanna and back. */
const TRACK: [number, number][] = [[0, 62], [10, 30], [40, 10], [90, -10], [120, -40], [80, -60], [20, -62], [-20, -55], [-30, -20], [-10, 20], [0, 62]]
/** The bank's edge where a herd comes down to drink, at x. */
const DRINK = (x: number): [number, number] => [x, riverZ(x) + RIVER_HALF + 3]
/** The lodge's big fig, where the weavers hang their nests and the monkeys climb. */
const FIG: [number, number] = [-46, -20]
const FIG_H = 7

/**
 * Where each herd lives (nziLife.tsx useHerdDays): its grazing ground, its place on the bank to drink,
 * its shade at noon. The kobs' and the hartebeest's way down to the river crosses the track.
 */
const GROUNDS: Record<'elephants' | 'buffalo' | 'kobs' | 'hartebeest' | 'warthogs' | 'rhino', Grounds> = {
  elephants: { graze: [95, -40], drink: DRINK(70), shade: [116, -16], shift: 0 },
  buffalo: { graze: [35, -15], drink: DRINK(25), shade: [50, 0], shift: 40 },
  kobs: { graze: [-5, 15], drink: DRINK(-12), shade: [-12, 32], shift: -30 },
  hartebeest: { graze: [100, 22], drink: DRINK(112), shade: [122, 36], shift: 60 },
  warthogs: { graze: [58, 32], drink: DRINK(45), shade: [64, 44], shift: 20 },
  rhino: { graze: [-108, 12], drink: DRINK(-110), shade: [-124, 30], shift: 90 },
}
const GROUND_LIST = Object.values(GROUNDS)

type Box = { p: [number, number, number]; s: [number, number, number]; ry?: number; c: string }

export function NziReserve({ night }: { night: boolean }) {
  M.pool.emissiveIntensity = night ? 0.5 : 0
  M.lamp.emissiveIntensity = night ? 1.3 : 0
  const ground = useMemo(() => ({ river: strip(RIVER, RIVER_HALF, 0.05, 10), banks: strip(RIVER, RIVER_HALF + 4, 0.04, 10), track: strip(TRACK, 2.2, 0.06, 1) }), [])
  const signs = useMemo(() => {
    const g = lettering(tr("RÉSERVE DE LA N'ZI"), '#5a3a1e', '#fff1c9', '#e8b54a')
    const l = lettering(tr('LODGE DES RIVES DE LA N’ZI'), '#2f4d2a', '#fff6d6', '#e8c35a')
    const rules = lettering(tr('Restez dans le véhicule · Ne nourrissez pas les animaux'), '#2f4d2a', '#fff6d6', '#e8c35a')
    const way = lettering(tr('← Mirador · Cache au bord de l’eau →'), '#5a3a1e', '#fff1c9', '#e8b54a')
    return { gate: signMaterial(g.t), gateAspect: g.aspect, lodge: signMaterial(l.t), lodgeAspect: l.aspect, rules: signMaterial(rules.t), rulesAspect: rules.aspect, way: signMaterial(way.t), wayAspect: way.aspect }
  }, [])
  signs.gate.emissiveIntensity = night ? 0.5 : 0
  signs.lodge.emissiveIntensity = night ? 0.6 : 0

  // The savanna's trees (rôniers, shea trees, the odd big one), its termite mounds, its grass and reeds.
  const flora = useMemo(() => {
    const r = rng('nzi-savane')
    const trunks: Box[] = []
    const crowns: Box[] = []
    const mounds: { p: [number, number, number]; s: [number, number, number]; ry?: number }[] = []
    /** The leafy trees (x, z, the top of the crown): where the monkeys climb, the hornbills sit. */
    const trees: [number, number, number][] = []
    const onTrack = (x: number, z: number) => TRACK.some((p, i) => i > 0 && segDist([x, z], TRACK[i - 1], p) < 5)
    let n = 0
    for (let guard = 0; n < 70 && guard < 900; guard++) {
      const x = (r() - 0.5) * 300
      const z = 70 - r() * 165
      if (!dry(x, z) || onTrack(x, z) || (Math.abs(x) < 14 && z > 40)) continue
      n++
      const palm = r() < 0.4
      const h = palm ? 9 + r() * 5 : 4 + r() * 4
      trunks.push({ p: [x, h / 2, z], s: [palm ? 0.5 : 0.6, h, palm ? 0.5 : 0.6], c: palm ? '#8a7a64' : '#6e5640' })
      if (palm) {
        for (let k = 0; k < 5; k++) crowns.push({ p: [x, h, z], s: [4.2, 0.25, 1.1], ry: (k / 5) * Math.PI + r() * 0.3, c: '#5d8a3a' })
        // The rônier's swollen trunk, and its hanging dead fronds.
        trunks.push({ p: [x, h * 0.62, z], s: [0.75, h * 0.18, 0.75], c: '#8a7a64' })
        trunks.push({ p: [x, h - 0.9, z], s: [1.1, 1.2, 1.1], ry: r() * 3, c: '#9c8452' })
      } else {
        const R = 3 + r() * 3
        crowns.push({ p: [x, h + 0.6, z], s: [R * 1.7, 1.6, R * 1.7], ry: r() * 3, c: ['#6f8d3a', '#5d7f33', '#7c9a45'][Math.floor(r() * 3)] })
        trees.push([x, z, h + 1.4])
      }
    }
    for (let k = 0; k < 18; k++) {
      const x = (r() - 0.5) * 280
      const z = 60 - r() * 140
      if (!dry(x, z) || onTrack(x, z)) continue
      const h = 1.4 + r() * 2.2
      mounds.push({ p: [x, h / 2, z], s: [1.6 + r(), h, 1.6 + r()], ry: r() * 3 })
      mounds.push({ p: [x + 0.3, h + 0.4, z], s: [0.7, 0.9, 0.7] })
      // The cathedral mound's spires.
      mounds.push({ p: [x - 0.5, h + 0.2, z + 0.4], s: [0.45, h * 0.6, 0.45], ry: r() })
      mounds.push({ p: [x + 0.6, h * 0.8, z - 0.5], s: [0.5, h * 0.5, 0.5], ry: r() })
    }
    // The tall dry grass, in clumps, swaying (nziLife.tsx SwayGrass).
    const grass: Tuft[] = []
    for (let k = 0; k < 560; k++) {
      const x = (r() - 0.5) * 300
      const z = 70 - r() * 165
      if (!dry(x, z) || onTrack(x, z)) continue
      const w = 0.5 + r() * 0.9
      grass.push({ x, z, w, h: 0.6 + r() * 1.1, ry: r() * 3, c: ['#c9b26a', '#b39b52', '#d6c27c', '#9f9a4f', '#a8a85a'][Math.floor(r() * 5)] })
    }
    // Reeds along both banks, thick in places.
    const reeds: Tuft[] = []
    for (let k = 0; k < 200; k++) {
      const x = (r() - 0.5) * 320
      const side = r() < 0.5 ? 1 : -1
      const z = riverZ(x) + side * (RIVER_HALF - 0.5 + r() * 2.5)
      if (Math.hypot(x - LODGE[0], z - LODGE[1] + 18) < 12) continue
      reeds.push({ x, z, w: 1, h: 1.6 + r() * 1.4, ry: r() * 3, c: ['#6f8a3a', '#7f9a45', '#8f8a4a'][Math.floor(r() * 3)] })
    }
    // Fireflies over the grass by the river.
    const flies: [number, number][] = []
    for (let k = 0; k < 60; k++) {
      const x = (r() - 0.5) * 240
      flies.push([x, riverZ(x) + RIVER_HALF + 3 + r() * 30])
    }
    return { trunks, crowns, mounds, grass, reeds, trees, flies }
  }, [])

  // The rest, all in one instanced mesh of coloured blocks: the baobabs, the kapok trees, the granite
  // boulders, the sandbanks, the lodge's fig and its weavers' nests, the gate's barrier and flag, the
  // signposts, the picnic tables, the hide by the water, the watchtower's ladder.
  const props = useMemo(() => {
    const r = rng('nzi-details')
    const b: Box[] = []
    const add = (p: [number, number, number], s: [number, number, number], c: string, ry = 0) => b.push({ p, s, c, ry })
    // Baobabs: the fat trunk, the stubby branches spread at the top, a few tufts of leaves.
    for (const [x, z] of [[-96, 46], [128, 52], [-138, -18]] as [number, number][]) {
      add([x, 1.2, z], [3.6, 2.4, 3.6], '#9a8a78', 0.3)
      add([x, 4.2, z], [2.8, 4.4, 2.8], '#a08f7c', 0.6)
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + r()
        const L = 2.4 + r() * 1.4
        add([x + Math.cos(a) * L * 0.5, 6.6, z + Math.sin(a) * L * 0.5], [L, 0.45, 0.45], '#9a8a78', -a)
        add([x + Math.cos(a) * L, 7.3, z + Math.sin(a) * L], [0.35, 1.4, 0.35], '#9a8a78')
        add([x + Math.cos(a) * L, 8.2, z + Math.sin(a) * L], [1.4, 0.7, 1.4], '#6f8d3a', a)
      }
    }
    // Kapok trees (fromagers): the tall straight trunk on its buttresses, the branches in tiers, the flat top.
    for (const [x, z] of [GROUNDS.elephants.shade, [-34, 40], GROUNDS.buffalo.shade] as [number, number][]) {
      add([x, 9, z], [1.3, 18, 1.3], '#a39a8a')
      for (let k = 0; k < 4; k++) add([x, 1.3, z], [4, 2.6, 0.3], '#9a9080', (k / 4) * Math.PI + 0.3)
      for (const [y, L] of [[11, 9], [14, 7]]) for (let k = 0; k < 3; k++) add([x, y, z], [L, 0.35, 0.45], '#9a9080', (k / 3) * Math.PI + y)
      add([x, 18.4, z], [13, 1.3, 13], '#5d7f33', 0.4)
      add([x + 1, 15, z - 1], [9, 1.1, 9], '#6f8d3a', 1.1)
    }
    // Granite boulders, in heaps.
    for (const [x, z] of [[-60, 52], [75, 50], [130, -5], [-120, -50], [20, 48], [-85, 0]] as [number, number][]) {
      for (let k = 0; k < 4; k++) {
        const s = 1.2 + r() * 2.6
        add([x + (r() - 0.5) * 5, s * 0.4, z + (r() - 0.5) * 5], [s * 1.3, s * 0.85, s], r() < 0.5 ? '#9a948c' : '#8a847c', r() * 3)
      }
    }
    // Sandbanks in the river.
    for (const x of [-125, 15, 128]) add([x, 0.08, riverZ(x) + (x > 0 ? -3 : 3)], [20, 0.08, 4.5], '#dcc58e', 0.05)
    // The lodge's big fig, and the weavers' nests hanging from its crown.
    add([FIG[0], FIG_H / 2, FIG[1]], [1.1, FIG_H, 1.1], '#6e5640')
    add([FIG[0], FIG_H + 0.6, FIG[1]], [9, 2.2, 9], '#4f7a2e', 0.4)
    add([FIG[0], FIG_H + 1.9, FIG[1]], [6, 1.2, 6], '#5d8a3a', 1)
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2
      add([FIG[0] + Math.cos(a) * 4.2, FIG_H - 1, FIG[1] + Math.sin(a) * 4.2], [0.35, 0.55, 0.35], k % 3 ? '#b59a52' : '#a08a46', a)
      add([FIG[0] + Math.cos(a) * 4.2, FIG_H - 0.55, FIG[1] + Math.sin(a) * 4.2], [0.05, 0.4, 0.05], '#7a6a3a')
    }
    // At the gate: the barrier pole in red and white, the flag of Côte d'Ivoire, the rangers' bench.
    for (let k = 0; k < 7; k++) add([-4.2 + k * 1.2, 1.1, 64], [1.2, 0.18, 0.18], k % 2 ? '#f2efe6' : '#c8332e')
    add([-5, 0.6, 64], [0.3, 1.2, 0.3], '#4a3220')
    add([-14, 4, 54], [0.14, 8, 0.14], '#d8d8d8')
    add([-13.55, 7.2, 54], [0.6, 1.2, 0.05], '#f77f00')
    add([-12.95, 7.2, 54], [0.6, 1.2, 0.05], '#f6f4ee')
    add([-12.35, 7.2, 54], [0.6, 1.2, 0.05], '#009e60')
    add([-11, 0.45, 59.6], [2.6, 0.12, 0.6], '#7a5230')
    for (const x of [-12, -10]) add([x, 0.22, 59.6], [0.12, 0.44, 0.5], '#4a3220')
    // The signposts: by the gate (the rules) and at the fork (the way to the tower and the hide).
    for (const [x, z] of [[9, 62], [14, 24]] as [number, number][]) {
      for (const dx of [-2.8, 2.8]) add([x + dx, 1.3, z], [0.2, 2.6, 0.2], '#5a3a1e')
      add([x, 2.2, z + 0.02], [5.8, 0.95, 0.12], '#5a3a1e')
    }
    // The picnic tables under the kapok, the fire ring.
    for (const [x, z] of [[-30, 36], [-38, 44]] as [number, number][]) {
      add([x, 0.8, z], [2.4, 0.12, 1], '#7a5230')
      for (const dz of [-0.85, 0.85]) add([x, 0.45, z + dz], [2.4, 0.08, 0.35], '#7a5230')
      for (const dx of [-1, 1]) add([x + dx, 0.4, z], [0.12, 0.8, 1.9], '#4a3220')
    }
    for (let k = 0; k < 8; k++) add([-26 + Math.cos(k) * 1.1, 0.15, 44 + Math.sin(k) * 1.1], [0.45, 0.3, 0.4], '#8a847c', k)
    add([-26, 0.12, 44], [0.9, 0.08, 0.9], '#3a2e28')
    // The hide by the water, at the elephants' drinking place: low walls, a slit to look through, a thatch.
    const [hx, hz] = [GROUNDS.elephants.drink[0] - 15, GROUNDS.elephants.drink[1] + 2.5]
    add([hx, 0.5, hz - 1.6], [6, 1, 0.2], '#7a5230')
    add([hx, 1.75, hz - 1.6], [6, 0.5, 0.2], '#7a5230')
    for (const dx of [-3, 3]) add([hx + dx, 1, hz], [0.2, 2, 3.4], '#6a4628')
    for (const dx of [-2.9, 2.9]) for (const dz of [-1.6, 1.6]) add([hx + dx, 1.1, hz + dz], [0.2, 2.2, 0.2], '#4a3220')
    add([hx, 2.3, hz], [6.8, 0.3, 4], '#c79a52')
    add([hx, 0.4, hz + 0.6], [4, 0.1, 0.4], '#7a5230')
    // The watchtower's ladder and its rail.
    for (const dz of [-0.4, 0.4]) add([40 + 2.6, 3.6, -40 + dz], [0.1, 7.4, 0.1], '#4a3220')
    for (let k = 0; k < 12; k++) add([40 + 2.6, 0.5 + k * 0.58, -40], [0.08, 0.06, 0.8], '#7a5230')
    for (const [dx, dz, w, d] of [[0, -2.1, 4.4, 0.08], [0, 2.1, 4.4, 0.08], [-2.1, 0, 0.08, 4.4]] as [number, number, number, number][]) add([40 + dx, 7.9, -40 + dz], [w, 0.08, d], '#4a3220')
    return b
  }, [])

  // The lodge: the bungalows in an arc on the bank, the main house, the terrace on stilts over the water, the pool.
  const lodge = useMemo(() => {
    const huts = [...Array(7)].map((_, i) => {
      const a = -0.4 + i * 0.32
      return [LODGE[0] + Math.sin(a) * 30, LODGE[1] + 6 - Math.cos(a) * 4 + i * 0.5] as [number, number]
    })
    return { huts }
  }, [])

  // The herds, each with its day (nziLife.tsx): grazing, drinking, resting, and wary of a Sim on foot.
  const plans = useHerdDays(GROUND_LIST)
  const trumpetAt = useRef(0)
  const herds = useMemo(() => {
    const p = Object.fromEntries(Object.keys(GROUNDS).map((k, i) => [k, plans[i]])) as Record<keyof typeof GROUNDS, (typeof plans)[number]>
    const life = (k: keyof typeof GROUNDS, roam: number, w: Parameters<typeof wary>[1]) => follower(wary(herdLife(grazer(p[k].centre, roam, dry), p[k]), { inside: dry, ...w }))
    const at = (k: keyof typeof GROUNDS) => [p[k].centre.x, p[k].centre.z] as [number, number]
    const mon = { x: -44, z: -14 }
    // The monkeys' trees: the leafy ones near the troop, the lodge's fig, and the terrace's posts (they get onto it).
    const trees = flora.trees.filter(([x, z]) => Math.hypot(x - mon.x, z - mon.z) < 30)
    trees.push([FIG[0], FIG[1], FIG_H + 2.5], [LODGE[0] + 6.6, LODGE[1] - 15, 3.15], [LODGE[0] - 6.6, LODGE[1] - 15, 3.15])
    return {
      elephants: {
        a: withYoung(makeHerd('nzi-elephants', 8, at('elephants'), 9, [0.85, 1.05]), 2, 0.45),
        b: life('elephants', 16, {
          alert: 24,
          onAlarm: () => {
            const now = performance.now()
            if (now - trumpetAt.current < 7000) return
            trumpetAt.current = now
            ambience.trumpet(1)
          },
        }),
      },
      buffalo: { a: makeHerd('nzi-buffles', 10, at('buffalo'), 8, [0.85, 1.05]), b: life('buffalo', 14, { flee: 7, alert: 22 }) },
      kobs: { a: makeHerd('nzi-kobs', 14, at('kobs'), 9, [0.85, 1.1]), b: life('kobs', 18, { flee: 13, alert: 28 }) },
      hartebeest: { a: makeHerd('nzi-bubales', 9, at('hartebeest'), 8, [0.9, 1.08]), b: life('hartebeest', 18, { flee: 15, alert: 30 }) },
      warthogs: { a: withYoung(makeHerd('nzi-phacos', 10, at('warthogs'), 4, [0.95, 1.1]), 6, 0.45, 3), b: life('warthogs', 10, { flee: 9, alert: 18 }) },
      rhino: { a: makeHerd('nzi-rhino', 1, at('rhino'), 1, [1, 1]), b: life('rhino', 12, { alert: 16 }) },
      fowl: { a: makeHerd('nzi-pintades', 12, [22, 46], 3, [0.9, 1.1]), b: wary(grazer({ x: 22, z: 46 }, 10, dry), { flee: 6, alert: 10, inside: dry }) },
      monkeys: { a: makeHerd('nzi-singes', 10, [mon.x, mon.z], 6, [0.9, 1.1]), b: monkeyBrain(trees, grazer(mon, 9, dry)) },
      hippos: { a: makeHerd('nzi-hippos', 4, [-20, riverZ(-20)], 8, [0.9, 1.1], -1.1), b: hippoBrain((x, z) => [Math.max(-60, Math.min(30, x)), Math.max(riverZ(x) - RIVER_HALF + 3, Math.min(riverZ(x) + RIVER_HALF - 3, z))]) },
      crocs: {
        a: makeHerd('nzi-crocos', 3, [100, riverZ(100) + RIVER_HALF + 1], 4, [1, 1.2]),
        b: crocBrain(
          [[96, riverZ(96) + RIVER_HALF + 1.5], [104, riverZ(104) + RIVER_HALF + 1.2], [112, riverZ(112) + RIVER_HALF + 1.6]],
          (x) => [x, riverZ(x)],
        ),
      },
    }
  }, [plans, flora])
  // Hornbills in four of the trees.
  const perched = useMemo(() => flora.trees.filter((_, i) => i % 9 === 2).slice(0, 5).map(([x, z, h], i) => [x + 0.8, h + 0.05, z, i * 1.3] as [number, number, number, number]), [flora])

  // How deep in the bush the Sim is: the sound of the town gives way to the reserve's (audio/ambience.ts).
  const root = useRef<THREE.Group>(null)
  const lastWild = useRef(-1)
  useFrame(({ clock }) => {
    const sec = Math.floor(clock.elapsedTime)
    if (sec === lastWild.current || !root.current) return
    lastWild.current = sec
    const me = gazeTargetAt('me')
    if (!me) return ambience.wild(0)
    V.copy(me).applyMatrix4(INV.copy(root.current.matrixWorld).invert())
    const out = Math.max(Math.abs(V.x) - 150, V.z - 70, -110 - V.z, 0)
    ambience.wild(1 - out / 80)
  })
  useEffect(() => () => ambience.wild(0), [])

  // The people: the rangers at the gate, the guests on the terrace, a guide by the 4x4, visitors up the tower, in the hide, at the picnic.
  const people = useMemo(() => {
    const r = rng('nzi-gens')
    const one = (p: [number, number, number], ry: number, pose: 'idle' | 'talk' | 'sit' | 'drink' | 'film' | 'phone' | 'eat', dress?: { outfit: string; outfitColor: string }) => {
      const gender: 'femme' | 'homme' = r() < 0.45 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      return { p, ry, pose, gender, look: dress ? { ...look, ...dress } : look, seed: r() * 100 }
    }
    const ranger = { outfit: 'uniforme', outfitColor: '#5c6b3a' }
    const [hx, hz] = [GROUNDS.elephants.drink[0] - 15, GROUNDS.elephants.drink[1] + 2.5]
    return [
      one([9, 0, 58], -Math.PI / 2, 'talk', ranger),
      one([-8, 0, 57], Math.PI / 2, 'idle', ranger),
      one([-11, 0, 59.6], Math.PI, 'sit', ranger),
      one([6.5, 0, 46], Math.PI, 'phone'),
      one([LODGE[0] - 6, 3.2, LODGE[1] - 20], Math.PI, 'film'),
      one([LODGE[0] + 2, 3.2, LODGE[1] - 19], Math.PI, 'drink'),
      one([LODGE[0] - 1, 3.2, LODGE[1] - 18], Math.PI, 'talk'),
      one([LODGE[0] + 10, 0, LODGE[1] + 6], 0.4, 'phone'),
      one([40.6, 7.15, -40.8], -Math.PI / 2, 'film'),
      one([hx - 1, 0, hz + 0.3], -Math.PI / 2, 'film'),
      one([-30, 0, 37.2], Math.PI, 'eat'),
    ]
  }, [])
  const guide = useMemo(() => randomLook('homme', rng('nzi-guide')), [])

  return (
    <group ref={root}>
      {/* The savanna's ground, the river, its sandy banks, the track */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -20]} material={M.savanna} receiveShadow>
        <planeGeometry args={[340, 200]} />
      </mesh>
      <mesh geometry={ground.banks} material={M.sand} receiveShadow />
      <mesh geometry={ground.river} material={M.water} />
      <mesh geometry={ground.track} material={M.track} receiveShadow />
      <Blocks at={flora.trunks} material={M.colored} color />
      <Blocks at={flora.crowns} material={M.colored} color />
      <Blocks at={flora.mounds} material={M.track} />
      <Blocks at={props} material={M.colored} color />
      <SwayGrass tufts={flora.grass} />
      <SwayGrass tufts={flora.reeds} reeds />
      <Fireflies spots={flora.flies} night={night} />
      {/* The gate at the road: two posts of logs, the beam, the name; the rangers' hut */}
      <group position={[0, 0, 60]}>
        {[-6, 6].map((x) => (
          <mesh key={x} geometry={BOX} position={[x, 3, 0]} scale={[0.9, 6, 0.9]} material={M.wood} castShadow />
        ))}
        <mesh geometry={BOX} position={[0, 6.2, 0]} scale={[14, 0.7, 0.8]} material={M.wood} castShadow />
        <mesh position={[0, 5, 0.45]} material={signs.gate}>
          <planeGeometry args={[9, 9 / signs.gateAspect]} />
        </mesh>
        <mesh geometry={BOX} position={[0, 0.9, -1]} scale={[12, 0.15, 0.15]} material={M.dark} />
        <group position={[-11, 0, -3]}>
          <mesh geometry={BOX} position={[0, 1.4, 0]} scale={[4, 2.8, 4]} material={M.wall} castShadow />
          <mesh geometry={CONE} position={[0, 3.6, 0]} scale={[3.6, 1.8, 3.6]} material={M.thatch} castShadow />
        </group>
      </group>
      {/* The signs: the rules by the gate, the way at the fork */}
      <mesh position={[9, 2.2, 62.16]} material={signs.rules}>
        <planeGeometry args={[5.4, 5.4 / signs.rulesAspect]} />
      </mesh>
      <mesh position={[14, 2.2, 24.16]} material={signs.way}>
        <planeGeometry args={[5.4, 5.4 / signs.wayAspect]} />
      </mesh>
      {/* The game drive's open 4x4, waiting by the gate */}
      <SafariTruck p={[6, 0, 44]} ry={Math.PI / 2} />
      {/* The watchtower over the savanna */}
      <group position={[40, 0, -40]}>
        {[-1.6, 1.6].flatMap((x) => [-1.6, 1.6].map((z) => <mesh key={`${x}${z}`} geometry={BOX} position={[x, 3.5, z]} scale={[0.3, 7, 0.3]} material={M.wood} />))}
        <mesh geometry={BOX} position={[0, 7, 0]} scale={[4.4, 0.3, 4.4]} material={M.wood} />
        <mesh geometry={CONE} position={[0, 9.4, 0]} scale={[3.6, 2, 3.6]} material={M.thatch} />
      </group>
      {/* The lodge */}
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[LODGE[0], 0.05, LODGE[1] + 8]} material={M.lawn} receiveShadow>
          <planeGeometry args={[70, 46]} />
        </mesh>
        {lodge.huts.map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <mesh geometry={DISC} position={[0, 1.4, 0]} scale={[3, 2.8, 3]} material={M.wall} castShadow />
            <mesh geometry={CONE} position={[0, 3.9, 0]} scale={[4, 2.6, 4]} material={M.thatch} castShadow />
            <mesh geometry={BOX} position={[0, 1, 3]} scale={[1, 2, 0.1]} material={M.dark} />
            <mesh geometry={BOX} position={[1.6, 1.6, 2.6]} scale={[0.25, 0.25, 0.25]} material={M.lamp} />
          </group>
        ))}
        {/* The main house: the reception at its door (the place's), the dining room under the big thatch */}
        <group position={[LODGE_DOOR[0], 0, LODGE_DOOR[1] - 7]}>
          <mesh geometry={BOX} position={[0, 2, 0]} scale={[16, 4, 12]} material={M.wall} castShadow receiveShadow />
          <mesh geometry={CONE} position={[0, 6.2, 0]} scale={[12, 4.4, 10]} material={M.thatch} castShadow />
          <mesh position={[0, 4.4, 6.05]} material={signs.lodge}>
            <planeGeometry args={[9, 9 / signs.lodgeAspect]} />
          </mesh>
          <mesh geometry={BOX} position={[0, 1.4, 6.05]} scale={[2.4, 2.8, 0.1]} material={M.dark} />
        </group>
        {/* The terrace on stilts over the river's bank, its tables */}
        <group position={[LODGE[0], 0, LODGE[1] - 18]}>
          {[-7, 0, 7].flatMap((x) => [-3, 3].map((z) => <mesh key={`${x}${z}`} geometry={BOX} position={[x, 1.5, z]} scale={[0.3, 3, 0.3]} material={M.wood} />))}
          <mesh geometry={BOX} position={[0, 3.05, 0]} scale={[16, 0.2, 8]} material={M.wood} receiveShadow />
          <mesh geometry={BOX} position={[0, 3.6, -3.95]} scale={[16, 0.08, 0.08]} material={M.dark} />
          {[-5, 0, 5].map((x) => (
            <mesh key={x} geometry={DISC} position={[x, 3.6, 0.5]} scale={[0.8, 0.08, 0.8]} material={M.dark} />
          ))}
          <mesh geometry={CONE} position={[0, 6.5, 0]} scale={[10, 2.5, 6]} material={M.thatch} castShadow />
          {[-7, 7].map((x) => (
            <mesh key={x} geometry={BOX} position={[x, 4.8, 0]} scale={[0.25, 3.4, 0.25]} material={M.wood} />
          ))}
        </group>
        <mesh geometry={BOX} position={[LODGE[0] + 18, 0.08, LODGE[1] + 2]} scale={[10, 0.1, 5]} material={M.pool} />
      </group>
      {/* The animals */}
      <Herd species={ELEPHANT} animals={herds.elephants.a} brain={herds.elephants.b} room far={420} night={night} />
      <Herd species={BUFFALO} animals={herds.buffalo.a} brain={herds.buffalo.b} room far={320} night={night} />
      <Riders animals={herds.buffalo.a} every={3} top={[-0.2, 2.13]} />
      <Herd species={KOB_SPECIES} animals={herds.kobs.a} brain={herds.kobs.b} room far={260} night={night} />
      <Herd species={HARTEBEEST} animals={herds.hartebeest.a} brain={herds.hartebeest.b} room far={260} night={night} />
      <Herd species={WARTHOG} animals={herds.warthogs.a} brain={herds.warthogs.b} room far={180} night={night} />
      <Herd species={RHINO} animals={herds.rhino.a} brain={herds.rhino.b} far={260} night={night} />
      <Herd species={GUINEAFOWL} animals={herds.fowl.a} brain={herds.fowl.b} room far={120} />
      <Herd species={MONKEY} animals={herds.monkeys.a} brain={herds.monkeys.b} room far={160} night={night} />
      <Herd species={HIPPO} animals={herds.hippos.a} brain={herds.hippos.b} far={300} night={night} />
      <Herd species={CROCODILE} animals={herds.crocs.a} brain={herds.crocs.b} far={200} night={night} />
      <Waders spots={[[-110, riverZ(-110) + RIVER_HALF - 1.5, 1.2], [-96, riverZ(-96) + RIVER_HALF - 2, 2.4], [30, riverZ(30) + RIVER_HALF - 1, 0.6], [60, riverZ(60) - RIVER_HALF + 1.5, 3.4]]} />
      {!night && <Flock centre={[10, -80]} radius={40} height={16} seed="nzi-aigrettes" />}
      {/* Vultures soaring high over the savanna; the weavers busy round their nests in the lodge's fig */}
      {!night && <Flock n={5} centre={[60, 0]} radius={28} height={48} color="#3b322b" size={2.8} flap={4} speed={0.45} glide seed="nzi-vautours" />}
      {!night && <Flock n={10} centre={FIG} radius={4.5} height={FIG_H - 0.5} color="#e8c22e" size={0.45} flap={22} speed={4} seed="nzi-tisserins" />}
      <Perched spots={perched} />
      <NoShadows>
        {people.map((p, i) => (
          <group key={i} position={p.p} rotation={[0, p.ry, 0]}>
            <LowHuman look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
      <group position={[3, 0, 46]} rotation={[0, Math.PI, 0]}>
        <TalkHuman id="nzi-guide" look={{ ...guide, outfit: 'uniforme', outfitColor: '#5c6b3a' }} gender="homme" pose="talk" seed={4} />
      </group>
    </group>
  )
}

const segDist = ([x, z]: [number, number], a: [number, number], b: [number, number]) => {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
  const L = dx * dx + dz * dz || 1
  const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L))
  return Math.hypot(x - a[0] - dx * k, z - a[1] - dz * k)
}

/** The game drives' open 4x4: olive green, the cab, the raised benches behind under a canvas roof, the spare wheel. Facing +x. */
export function SafariTruck({ p, ry = 0, roof = true }: { p: [number, number, number]; ry?: number; /** Its canvas roof (not when one rides on it: it would hide the view). */ roof?: boolean }) {
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <mesh geometry={BOX} position={[0, 1.1, 0]} scale={[5.2, 1, 2.1]} material={M.truck} castShadow />
      <mesh geometry={BOX} position={[1.6, 1.9, 0]} scale={[1.6, 0.8, 2]} material={M.truck} castShadow />
      <mesh geometry={BOX} position={[2.42, 1.9, 0]} scale={[0.05, 0.6, 1.8]} material={M.tyre} />
      {[-0.4, -1.6].map((x) => (
        <mesh key={x} geometry={BOX} position={[x, 1.9 + (x < -1 ? 0.3 : 0), 0]} scale={[0.5, 0.15, 1.9]} material={M.wood} />
      ))}
      {[-2.4, 0.6].flatMap((x) => [-0.95, 0.95].map((z) => <mesh key={`${x}${z}`} geometry={BOX} position={[x, 2.6, z]} scale={[0.08, 1.6, 0.08]} material={M.dark} />))}
      {roof && <mesh geometry={BOX} position={[-0.9, 3.4, 0]} scale={[3.3, 0.08, 2.2]} material={M.canvas} />}
      {[-1.7, 1.7].flatMap((x) => [-1.05, 1.05].map((z) => <mesh key={`w${x}${z}`} geometry={DISC} position={[x, 0.5, z]} rotation={[Math.PI / 2, 0, 0]} scale={[0.5, 0.3, 0.5]} material={M.tyre} />))}
      <mesh geometry={DISC} position={[-2.7, 1.3, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.45, 0.25, 0.45]} material={M.tyre} />
    </group>
  )
}
