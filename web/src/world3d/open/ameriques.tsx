import { useMemo } from 'react'
import * as THREE from 'three'
import { Blocks } from './ruePrincesse'
import type { At } from './shoreline'
import { put, seeded, type Part } from './kit3d'
import { People, usePeople } from './villeKit'
import { WindowBox, clockFace, dome, octo, ring, spire, useBlocks } from './paysKit'

// The Americas' landmarks (the updates « pays-canada » and « pays-ameriques », backend world/ameriques.go), in
// blocks at their real size where it is known: Toronto's CN Tower (553 m, seen from all over the city), Ottawa's
// Parliament and its Peace Tower, Québec's Château Frontenac; Rio's Christ the Redeemer on the Corcovado, São
// Paulo's MASP on its red frames, Salvador's Largo do Pelourinho and its Lacerda lift, Brasília's Congress;
// Mexico's Palacio de Bellas Artes and Angel of Independence; Port-au-Prince's Marron inconnu; Havana's
// Capitolio; Cartagena's Torre del Reloj; Buenos Aires's Obelisco and Casa Rosada. Proportions from
// photographs, the details the game's. Frames: +z the street (the place's door).

/* ---------- The street round them: lamps, palms or plane trees, benches ---------- */

const LAMP: Part[] = [
  [0, 2.4, 0, 0.14, 4.8, 0.14, '#2f3a33'],
  [0, 4.9, 0, 0.5, 0.5, 0.5, '#fff3bf'],
]
const PALM = (r: () => number): Part[] => [
  [0, 2.5, 0, 0.4, 5, 0.4, '#8a6a3c'],
  [0, 5.4, 0, 0.36, 1.2, 0.36, '#7a5a30'],
  [1.2, 6, 0, 2.6, 0.2, 0.8, r() < 0.5 ? '#2f9e44' : '#37b24d'],
  [-1.2, 6, 0, 2.6, 0.2, 0.8, '#2f9e44'],
  [0, 6, 1.2, 0.8, 0.2, 2.6, '#2b8a3e'],
  [0, 6, -1.2, 0.8, 0.2, 2.6, '#37b24d'],
]
const TREE = (r: () => number): Part[] => [
  [0, 1.8, 0, 0.36, 3.6, 0.36, '#5a4632'],
  [0, 4.6, 0, 3.6, 2.8, 3.6, r() < 0.5 ? '#3c7a36' : '#4c8a3a'],
]
const BENCH: Part[] = [
  [0, 0.45, 0, 1.8, 0.08, 0.5, '#8a6a3c'],
  [0, 0.75, -0.22, 1.8, 0.4, 0.06, '#8a6a3c'],
]
/** Lamps, trees (palms where it's hot) and benches along a landmark's front, from x0 to x1 at depth z. */
function street(out: At[], palms: boolean, x0: number, x1: number, z: number, seed: number) {
  const r = seeded(seed)
  for (let x = x0; x <= x1; x += 8) {
    put(out, [x, z, 0], LAMP)
    put(out, [x + 4, z - 1.2, r() * 3], palms ? PALM(r) : TREE(r))
    if (r() < 0.5) put(out, [x + 2, z + 0.4, Math.PI], BENCH)
  }
}

const WHITE = '#eceae4'
const CONCRETE = '#b9b6ae'
const COPPER = '#5f9e8a'
const COPPER_D = '#4c8574'

/* ---------- Canada ---------- */

/** The CN Tower (1976): the concrete shaft of three legs to the main pod at 342 m, the SkyPod at 447 m, the antenna to 553 m. */
export function TourCN({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#e8f0ff', 0.12)
  const lit = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), [])
  lit.color.set(night ? '#d23cff' : '#c9ced3')
  const z = -26
  const at = useMemo(() => {
    const out: At[] = []
    // The three legs (Y) up the shaft, narrowing.
    for (let i = 0; i < 14; i++) {
      const y0 = i * 24
      const k = 1 - i / 18
      for (let l = 0; l < 3; l++) {
        const a = (l / 3) * Math.PI * 2
        out.push({ p: [Math.sin(a) * 5 * k, y0 + 12, z + Math.cos(a) * 5 * k], s: [7 * k, 24, 4 * k], ry: a, c: i % 2 ? CONCRETE : '#c4c1ba' })
      }
      octo(out, [0, y0 + 12, z], 7 * k, 24, '#c4c1ba')
    }
    // The main pod: its rings, the windows, the glass floor.
    octo(out, [0, 336, z], 30, 8, '#a8a59e')
    octo(out, [0, 344, z], 36, 8, '#8f8c86')
    ring(out, [0, 344, z], 16.5, 24, [4.2, 5, 0.3], '#3d4f63')
    octo(out, [0, 352, z], 28, 6, '#a8a59e')
    // The shaft above, the SkyPod.
    octo(out, [0, 400, z], 6, 96, CONCRETE)
    octo(out, [0, 447, z], 12, 8, '#8f8c86')
    // The base: the halls, the plaza, the street.
    out.push({ p: [0, 4, z + 6], s: [44, 8, 26], c: '#9aa0a6' }, { p: [0, 0.05, z + 30], s: [60, 0.1, 24], c: '#c8c3ba' })
    street(out, false, -26, 26, 22, 553)
    return out
  }, [z])
  const antenna = useMemo(() => [{ p: [0, 500, z], s: [2.2, 104, 2.2] }] as At[], [z])
  const people = usePeople('tour-cn', [
    { p: [4, 0.1, 18], ry: Math.PI, pose: 'film' },
    { p: [-5, 0.1, 20], ry: 0.3, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Blocks at={antenna} material={lit} />
      <People list={people} />
    </group>
  )
}

/** The Parliament's Centre Block (1927): the long Gothic front of sandstone under green copper roofs, the Peace Tower (92 m) in the middle, its clock; the lawn and the Centennial Flame. */
export function ParlementOttawa({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1d6', 0.12)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -40
    const STONE = '#c9bfa6'
    out.push({ p: [0, 12, z - 14], s: [140, 24, 28], c: STONE })
    for (let i = 0; i < 4; i++) out.push({ p: [0, 24.8 + i * 1.6, z - 14], s: [140 - i * 2, 1.6, 28 - i * 6], c: i % 2 ? COPPER_D : COPPER })
    for (let k = 0; k < 26; k++) for (const y of [6, 13, 19]) out.push({ p: [-65 + k * 5.2, y, z + 0.05], s: [1.6, 4, 0.1], c: '#3a4a5a' })
    for (const x of [-64, -36, 36, 64]) (out.push({ p: [x, 16, z - 12], s: [12, 32, 30], c: STONE }), spire(out, [x, 32, z - 12], 12, 10, 4, COPPER, COPPER_D))
    // The Peace Tower: the shaft, the clock on its four sides, the belfry, the copper spire and the flag.
    out.push({ p: [0, 32, z + 2], s: [12, 64, 12], c: '#d4cab0' })
    clockFace(out, [0, 56, z + 8.1], 2.6)
    for (let i = 0; i < 4; i++) out.push({ p: [0, 46 + i * 2.6, z + 8.05], s: [1.4, 6, 0.1], c: '#3a4a5a' })
    spire(out, [0, 64, z + 2], 12, 22, 6, COPPER, COPPER_D)
    out.push({ p: [0, 90, z + 2], s: [0.2, 6, 0.2], c: '#ddd' }, { p: [1.6, 92, z + 2], s: [3, 1.6, 0.05], c: '#d52b1e' })
    // The arch of the door, the lawn, the flame's fountain.
    out.push({ p: [0, 5, z + 8.1], s: [5, 9, 0.2], c: '#3a2a20' })
    out.push({ p: [0, 0.05, z + 40], s: [120, 0.1, 60], c: '#5c8a3a' })
    octo(out, [0, 0.5, z + 50], 8, 1, '#9aa3aa')
    out.push({ p: [0, 1.4, z + 50], s: [0.8, 0.8, 0.8], c: '#ff922b' })
    street(out, false, -50, 50, 74, 1927)
    return out
  }, [])
  const people = usePeople('parlement', [
    { p: [6, 0.1, 18], ry: Math.PI, pose: 'film' },
    { p: [-8, 0.1, 22], ry: 0.4, pose: 'walk' },
    { p: [2, 0.1, 26], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Château Frontenac (1893): the brick château on the cliff, its towers and steep green copper roofs, the great central tower; the Terrasse Dufferin's boardwalk and kiosks in front. */
export function ChateauFrontenac({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.16)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -34
    const BRICK = '#8a4a36'
    // The wings round the court.
    for (const [x, zz, w, d] of [[-30, z, 16, 40], [30, z, 16, 40], [0, z - 18, 76, 14]] as const) {
      out.push({ p: [x, 12, zz], s: [w, 24, d], c: BRICK })
      for (let i = 0; i < 5; i++) out.push({ p: [x, 24.8 + i * 2.2, zz], s: [w - i * 2.6, 2.2, d - i * 2.6], c: i % 2 ? COPPER_D : COPPER })
    }
    // The tower (80 m) and its roof, the turrets at the corners.
    out.push({ p: [0, 30, z - 4], s: [20, 60, 20], c: BRICK })
    for (let f = 0; f < 12; f++) for (const x of [-6, 0, 6]) out.push({ p: [x, 5 + f * 4.6, z + 6.05], s: [1.4, 2.6, 0.1], c: '#2f4458' })
    spire(out, [0, 60, z - 4], 22, 18, 6, COPPER, COPPER_D)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      octo(out, [sx * 37, 14, z + sz * 19], 7, 28, BRICK)
      spire(out, [sx * 37, 28, z + sz * 19], 7, 10, 4, COPPER, COPPER_D)
    }
    for (let k = 0; k < 14; k++) for (const y of [6, 12, 18]) for (const x of [-30, 30]) out.push({ p: [x + (x < 0 ? 8.05 : -8.05), y, z - 16 + k * 2.6], s: [0.1, 2.4, 1.2], c: '#2f4458' })
    // The terrace: boards, railing, the green-roofed kiosks.
    out.push({ p: [0, 0.2, z + 36], s: [90, 0.4, 16], c: '#a0825a' })
    for (let x = -44; x <= 44; x += 2) out.push({ p: [x, 1, z + 44], s: [0.12, 1.2, 0.12], c: '#2f3a33' })
    out.push({ p: [0, 1.6, z + 44], s: [90, 0.12, 0.12], c: '#2f3a33' })
    for (const x of [-30, 0, 30]) (octo(out, [x, 2, z + 34], 4, 4, '#e9ecef'), spire(out, [x, 4, z + 34], 5, 3, 3, COPPER, COPPER_D))
    return out
  }, [])
  const people = usePeople('frontenac', [
    { p: [4, 0.4, 2], ry: Math.PI, pose: 'film' },
    { p: [-8, 0.4, 4], ry: 0.6, pose: 'walk' },
    { p: [12, 0.4, 6], ry: 2.2, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/* ---------- Brésil ---------- */

/** Christ the Redeemer (1931) on the Corcovado: the statue of soapstone, 30 m tall and 28 m from hand to hand, on its 8 m pedestal; the summit's terraces and the forest round it. */
export function CristoRedentor({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffffff', 0.05)
  const lit = useMemo(() => new THREE.MeshLambertMaterial({ color: '#eae6dc', emissive: new THREE.Color('#ffffff') }), [])
  lit.emissiveIntensity = night ? 0.55 : 0
  const z = -20
  const top = 24
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(31)
    // The mountain's top: rock, the terraces and their railings, the stairs, the forest.
    for (let i = 0; i < 6; i++) octo(out, [0, (top * (i + 0.5)) / 6, z], 70 - i * 9, top / 6, i % 2 ? '#6b6a5e' : '#7d7a6e')
    out.push({ p: [0, top + 0.3, z], s: [26, 0.6, 26], c: '#d6d0c4' })
    for (let i = 0; i < 24; i++) out.push({ p: [0, 0.25 + i, 30 - i * 1.6], s: [6, 0.5, 1.6], c: '#c8c3ba' })
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2
      const d = 30 + r() * 12
      const x = Math.sin(a) * d
      const zz = z + Math.cos(a) * d
      out.push({ p: [x, 4, zz], s: [5, 6, 5], c: ['#2f6a30', '#3c7a36', '#2b8a3e'][i % 3] })
    }
    // The pedestal (a chapel inside), its door.
    out.push({ p: [0, top + 4, z], s: [9, 8, 9], c: '#cfc9bb' }, { p: [0, top + 2, z + 4.55], s: [2, 4, 0.1], c: '#3a2a20' })
    return out
  }, [z])
  const statue = useMemo(() => {
    const out: At[] = []
    const y = top + 8
    // The robe widening to the feet, the body, the arms open, the head, the folds.
    for (let i = 0; i < 8; i++) out.push({ p: [0, y + i * 2.4 + 1.2, z], s: [6.4 - i * 0.35, 2.4, 4.4 - i * 0.2] })
    out.push({ p: [0, y + 21, z], s: [4.6, 3.6, 3.2] })
    out.push({ p: [0, y + 22, z], s: [28, 2, 2.2] })
    for (const sx of [-1, 1]) out.push({ p: [sx * 14.2, y + 22, z], s: [1.4, 1.6, 2.2] })
    out.push({ p: [0, y + 24.6, z], s: [2.2, 3, 2.4] }, { p: [0, y + 26.4, z - 0.2], s: [2.4, 0.8, 2.6] })
    for (const x of [-1.6, 0, 1.6]) out.push({ p: [x, y + 9, z + 2.1], s: [0.3, 16, 0.3] })
    return out
  }, [z])
  const people = usePeople('cristo', [
    { p: [3, top + 0.6, z + 9], ry: Math.PI, pose: 'film' },
    { p: [-4, top + 0.6, z + 10], ry: 0.4, pose: 'pray' },
    { p: [6, top + 0.6, z + 8], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Blocks at={statue} material={lit} />
      <People list={people} />
    </group>
  )
}

/** The MASP (1968, Lina Bo Bardi): the glass-and-concrete box hanging 8 m over the Paulista on its two red frames, 74 m without a pillar between; the open belvedere under it. */
export function MASP({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff3d6', 0.1)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -14
    const RED = '#d0312d'
    for (const x of [-37, 37]) {
      for (const dz of [-14, 14]) out.push({ p: [x, 8.5, z + dz], s: [2.6, 17, 2.6], c: RED })
      out.push({ p: [x, 16, z], s: [2.6, 2.6, 31], c: RED })
    }
    out.push({ p: [0, 16, z], s: [77, 2.4, 2.4], c: RED }, { p: [0, 16, z - 14], s: [77, 2.4, 2.4], c: RED }, { p: [0, 16, z + 14], s: [77, 2.4, 2.4], c: RED })
    // The belvedere's paving, the stairs, the plaza's benches.
    out.push({ p: [0, 0.1, z], s: [80, 0.2, 34], c: '#c8c3ba' }, { p: [-20, 0.5, z - 8], s: [6, 1, 10], c: '#8a8780' })
    street(out, true, -38, 38, 10, 1968)
    return out
  }, [])
  const people = usePeople('masp', [
    { p: [0, 0.2, -10], ry: 0, pose: 'talk' },
    { p: [6, 0.2, -6], ry: 2, pose: 'walk' },
    { p: [-10, 0.2, -16], ry: 1.2, pose: 'sit' },
    { p: [14, 0.2, -12], ry: -0.4, pose: 'film' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <WindowBox s={[72, 10, 28]} p={[0, 13, -14]} wall="#7a7f84" glass="#2d3c4c" bay={3} floor={5} kind="grid" night={night} />
      <People list={people} />
    </group>
  )
}

/** The Largo do Pelourinho in Salvador: the sloping square of cobbles, the colonial houses painted every colour, the blue Igreja do Rosário dos Pretos (built by the Black brotherhood, 18th c.) at the bottom, the drummers. */
export function LargoPelourinho({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffe8c0', 0.12)
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(1549)
    const COLS = ['#f8f0e3', '#fcc419', '#ff8787', '#74c0fc', '#69db7c', '#e599f7', '#ffa94d', '#4dabf7', '#ffd8a8']
    // The square, rising away from the street.
    for (let i = 0; i < 10; i++) out.push({ p: [0, 0.15 + i * 0.3, -4 - i * 5], s: [24, 0.3 + i * 0.6, 5], c: i % 2 ? '#a39b8c' : '#b5ad9e' })
    // The houses on both sides, two or three floors, their windows and doors.
    for (const sx of [-1, 1])
      for (let k = 0; k < 7; k++) {
        const zz = -4 - k * 7
        const h = 9 + Math.floor(r() * 3) * 3.4
        const base = k * 2.1
        const c = COLS[Math.floor(r() * COLS.length)]
        out.push({ p: [sx * 17, base + h / 2, zz], s: [10, h, 7], c })
        for (let f = 0; f < Math.floor(h / 3.4); f++) for (const dz of [-2, 0, 2]) out.push({ p: [sx * 11.95, base + 2 + f * 3.4, zz + dz], s: [0.1, 2, 1.1], c: f === 0 && dz === 0 ? '#3a2a20' : '#2f4458' })
        out.push({ p: [sx * 17, base + h + 0.4, zz], s: [10.6, 0.8, 7.6], c: '#b5654a' })
      }
    // The Rosário dos Pretos: its blue front, the two towers, the white trims.
    const z = 6
    out.push({ p: [-30, 8, z - 6], s: [16, 16, 14], c: '#4c8dcf' })
    for (const x of [-36, -24]) (out.push({ p: [x, 13, z - 2], s: [4.5, 26, 4.5], c: '#4c8dcf' }), spire(out, [x, 26, z - 2], 4.5, 4, 3, '#f8f9fa', '#4c8dcf'))
    out.push({ p: [-30, 17, z + 0.3], s: [8, 2, 0.4], c: '#f8f9fa' }, { p: [-30, 4, z + 0.3], s: [3, 6, 0.2], c: '#3a2a20' })
    for (const x of [-34, -26]) out.push({ p: [x, 10, z + 0.3], s: [1.4, 3, 0.2], c: '#2f4458' })
    return out
  }, [])
  const people = usePeople('pelourinho', [
    { p: [-2, 0.4, -6], ry: 0.2, pose: 'idle', dress: { outfit: 'debardeur', outfitColor: '#fcc419' } },
    { p: [0, 0.4, -7], ry: -0.2, pose: 'idle', dress: { outfit: 'debardeur', outfitColor: '#2f9e44' } },
    { p: [2, 0.4, -6], ry: -0.4, pose: 'idle', dress: { outfit: 'debardeur', outfitColor: '#e03131' } },
    { p: [5, 0.4, -2], ry: 2.6, pose: 'film' },
    { p: [-6, 0.4, 0], ry: 0.6, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Elevador Lacerda (1873, Art déco since 1930): the white tower of 72 m up the cliff, its footbridge to the upper town. */
export function ElevadorLacerda({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.18)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -8
    // The cliff behind, the upper town's edge.
    out.push({ p: [0, 30, z - 30], s: [90, 60, 30], c: '#7d7a6e' })
    // The tower, its bands of windows, the top's cabin house.
    out.push({ p: [0, 36, z], s: [12, 72, 10], c: '#f1ece0' })
    for (let f = 0; f < 16; f++) out.push({ p: [0, 4 + f * 4.2, z + 5.05], s: [6, 1.8, 0.1], c: '#3a5f8a' })
    out.push({ p: [0, 74, z - 2], s: [18, 6, 14], c: WHITE }, { p: [0, 77.4, z - 2], s: [19, 0.8, 15], c: '#d6d0c4' })
    // The footbridge to the cliff top.
    out.push({ p: [0, 62, z - 12], s: [6, 4, 16], c: WHITE })
    out.push({ p: [0, 0.05, z + 16], s: [60, 0.1, 20], c: '#c8c3ba' })
    street(out, true, -28, 28, 18, 1873)
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/** The National Congress in Brasília (1960, Niemeyer): the two towers of 28 floors joined by a bridge, the Senate's dome and the Chamber's bowl on the long white slab; the reflecting pool. */
export function CongressoBrasilia({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff3d6', 0.12)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -40
    out.push({ p: [0, 4, z], s: [200, 8, 80], c: WHITE })
    // The Senate's dome (to the left) and the Chamber's bowl (to the right).
    dome(out, [-40, 8, z], 18, 6, WHITE, '#dcd9d1', 0.8)
    for (let i = 0; i < 5; i++) octo(out, [40, 9 + i * 2, z], 26 + i * 8, 2, i % 2 ? WHITE : '#dcd9d1')
    // The twin towers.
    for (const x of [-7.5, 7.5]) out.push({ p: [x, 8 + 50, z - 30], s: [6, 100, 22], c: '#9aa8b4' })
    out.push({ p: [0, 70, z - 30], s: [9, 6, 20], c: '#9aa8b4' })
    // The ramp, the pool.
    out.push({ p: [0, 4, z + 50], s: [12, 0.4, 20], c: '#d6d0c4' }, { p: [0, 0.05, z + 70], s: [180, 0.1, 30], c: '#4c8dcf' })
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/* ---------- Mexique ---------- */

/** The Palacio de Bellas Artes (1934): the white marble palace, its great dome of orange and yellow tiles crowned by the eagle, the smaller domes, the front's arches; the Alameda before it. */
export function BellasArtes({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1d6', 0.14)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -36
    const MARBLE = '#ece6d8'
    out.push({ p: [0, 14, z], s: [90, 28, 60], c: MARBLE })
    for (const x of [-28, 28]) out.push({ p: [x, 17, z + 22], s: [24, 34, 16], c: MARBLE })
    for (const x of [-16, -6, 6, 16]) out.push({ p: [x, 10, z + 30.1], s: [6, 16, 0.2], c: '#3a2a20' }, { p: [x, 19, z + 30.1], s: [7, 2, 0.6], c: '#c9b28a' })
    // The great dome: drum, the tiles in bands, the lantern, the eagle.
    octo(out, [0, 31, z - 4], 30, 6, MARBLE)
    dome(out, [0, 34, z - 4], 15, 8, '#f08c00', '#ffd43b', 1.2)
    octo(out, [0, 53, z - 4], 4, 4, '#f08c00')
    out.push({ p: [0, 56.5, z - 4], s: [2.6, 3, 1], c: '#9c7a3c' })
    for (const x of [-28, 28]) dome(out, [x, 34, z + 22], 7, 5, '#f08c00', '#ffd43b', 1.1)
    // The esplanade, the Alameda's trees.
    out.push({ p: [0, 0.05, z + 50], s: [100, 0.1, 30], c: '#c8c3ba' })
    street(out, false, -48, 48, 66, 1934)
    return out
  }, [])
  const people = usePeople('bellas-artes', [
    { p: [4, 0.1, 20], ry: Math.PI, pose: 'film' },
    { p: [-6, 0.1, 24], ry: 0.5, pose: 'walk' },
    { p: [10, 0.1, 26], ry: 2.4, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Angel of Independence (1910): the column of 36 m on its roundabout of the Paseo de la Reforma, the golden Victory on top, the statues round its base. */
export function AngelIndependencia({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.12)
  const gold = useMemo(() => new THREE.MeshLambertMaterial({ color: '#e0b030', emissive: new THREE.Color('#ffcc44') }), [])
  gold.emissiveIntensity = night ? 0.5 : 0.05
  const at = useMemo(() => {
    const out: At[] = []
    octo(out, [0, 0.2, 0], 40, 0.4, '#6b8f5a')
    octo(out, [0, 1, 0], 18, 2, '#c8c3ba')
    out.push({ p: [0, 4.5, 0], s: [10, 5, 10], c: '#d6d0c4' })
    for (const [x, zz] of [[5.6, 0], [-5.6, 0], [0, 5.6], [0, -5.6]]) out.push({ p: [x, 3.6, zz], s: [1.6, 3.2, 1.6], c: '#4d5a52' })
    octo(out, [0, 22, 0], 3.2, 30, '#ece6d8')
    for (const y of [12, 22, 32]) octo(out, [0, y, 0], 3.8, 0.8, '#c9b28a')
    octo(out, [0, 37.6, 0], 4.4, 1.2, '#ece6d8')
    return out
  }, [])
  const angel = useMemo(() => [{ p: [0, 40, 0], s: [1.2, 3.6, 1] }, { p: [0, 41, -0.6], s: [3.6, 2.4, 0.3] }, { p: [0, 42.4, 0.3], s: [0.7, 0.8, 0.7] }] as At[], [])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Blocks at={angel} material={gold} />
    </group>
  )
}

/* ---------- Haïti ---------- */

/** The Marron inconnu (Nèg Mawon, Albert Mangonès, 1967) on the Champ de Mars: the runaway kneeling, his broken chain, blowing the conch to call to freedom; the round basin and the plaza. */
export function MarronInconnu({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.12)
  const bronze = useMemo(() => new THREE.MeshLambertMaterial({ color: '#4a3a2a' }), [])
  const at = useMemo(() => {
    const out: At[] = []
    octo(out, [0, 0.1, 0], 36, 0.2, '#c8c3ba')
    octo(out, [0, 0.6, 0], 14, 1.2, '#e9ecef')
    octo(out, [0, 0.9, 0], 12, 0.4, '#4c8dcf')
    out.push({ p: [0, 2.2, 0], s: [4.4, 2.6, 3], c: '#e9ecef' })
    street(out, true, -16, 16, 16, 1804)
    return out
  }, [])
  const man = useMemo(() => {
    const y = 3.5
    return [
      // The leg stretched behind, the knee down, the body leaning back, the head up, the arm lifting the conch, the chain.
      { p: [0, y + 0.4, -1], s: [0.7, 0.6, 2.6] },
      { p: [0, y + 0.6, 0.8], s: [0.8, 1.2, 0.8] },
      { p: [0, y + 2, 0.2], s: [1.4, 2.2, 1], ry: 0.2 },
      { p: [0, y + 3.5, 0.1], s: [0.8, 0.9, 0.8] },
      { p: [0.5, y + 3.8, 0.6], s: [0.4, 0.4, 1.2] },
      { p: [0.6, y + 3.9, 1.3], s: [0.6, 0.5, 0.8] },
      { p: [-0.9, y + 1.2, 0.8], s: [0.3, 0.3, 1.6] },
    ] as At[]
  }, [])
  const people = usePeople('marron', [
    { p: [4, 0.2, 9], ry: Math.PI, pose: 'film' },
    { p: [-5, 0.2, 10], ry: 0.4, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Blocks at={man} material={bronze} />
      <People list={people} />
    </group>
  )
}

/* ---------- Cuba ---------- */

/** The Capitolio of Havana (1929): the long front of white stone, the stairs up to the portico of columns, the dome of 92 m. */
export function Capitolio({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1d6', 0.14)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -50
    const STONE = '#e2ddd0'
    out.push({ p: [0, 12, z], s: [200, 24, 60], c: STONE })
    for (let k = 0; k < 36; k++) for (const y of [6, 16]) out.push({ p: [-96 + k * 5.5, y, z + 30.05], s: [1.6, 4, 0.1], c: '#3a4a5a' })
    // The portico and its stairs.
    for (let k = 0; k < 12; k++) out.push({ p: [-22 + k * 4, 16, z + 40], s: [1.6, 24, 1.6], c: '#efeae0' })
    out.push({ p: [0, 29, z + 40], s: [52, 4, 4], c: STONE })
    for (let i = 0; i < 3; i++) out.push({ p: [0, 31.6 + i * 1.4, z + 40], s: [48 - i * 14, 1.4, 4], c: STONE })
    for (let i = 0; i < 12; i++) out.push({ p: [0, 0.4 + i * 0.4, z + 62 - i * 1.6], s: [40, 0.8 + i * 0.8, 1.6], c: '#d6d0c4' })
    // The drum, its columns, the dome, the lantern.
    octo(out, [0, 30, z], 36, 12, STONE)
    ring(out, [0, 40, z], 15, 24, [1.2, 10, 1.2], '#efeae0')
    octo(out, [0, 46, z], 32, 4, STONE)
    dome(out, [0, 48, z], 14, 9, '#dcd5c6', '#e9e4d8', 2.2)
    octo(out, [0, 81, z], 4, 6, STONE)
    dome(out, [0, 84, z], 2.4, 3, '#c9a24a', '#e0b030')
    out.push({ p: [0, 0.05, z + 80], s: [160, 0.1, 30], c: '#c8c3ba' })
    street(out, true, -70, 70, 84, 1929)
    return out
  }, [])
  const people = usePeople('capitolio', [
    { p: [6, 0.1, 24], ry: Math.PI, pose: 'film' },
    { p: [-8, 0.1, 28], ry: 0.5, pose: 'walk' },
    { p: [12, 0.1, 30], ry: 2.2, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/* ---------- Colombie ---------- */

/** The Torre del Reloj (1888) over the Boca del Puente, the main gate of Cartagena's walls: the three arches in the ramparts, the yellow tower and its clock. */
export function TorreReloj({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.16)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -6
    const WALL = '#c2a878'
    // The ramparts both sides, the arches through.
    out.push({ p: [-22, 5, z], s: [28, 10, 8], c: WALL }, { p: [22, 5, z], s: [28, 10, 8], c: WALL })
    out.push({ p: [0, 8, z], s: [16, 4, 8], c: WALL })
    for (const x of [-5.4, 0, 5.4]) out.push({ p: [x, 3, z], s: [1.4, 6, 8], c: WALL })
    // The tower: its yellow body, the clock on its front, the lantern.
    out.push({ p: [0, 15, z], s: [8, 10, 6], c: '#f2c94c' }, { p: [0, 20.6, z], s: [9, 1.2, 7], c: WHITE })
    clockFace(out, [0, 15.6, z + 3.1], 2)
    out.push({ p: [0, 23, z], s: [5, 3.6, 4], c: '#f2c94c' })
    spire(out, [0, 24.8, z], 5, 4, 3, '#e8590c', '#c2410c')
    out.push({ p: [0, 0.05, z + 18], s: [50, 0.1, 22], c: '#c8c3ba' })
    street(out, true, -24, 24, 22, 1888)
    return out
  }, [])
  const people = usePeople('torre-reloj', [
    { p: [2, 0.1, 6], ry: Math.PI, pose: 'walk' },
    { p: [-5, 0.1, 9], ry: 0.4, pose: 'film' },
    { p: [7, 0.1, 10], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/* ---------- Argentine ---------- */

/** The Obelisco (1936) in the middle of the Avenida 9 de Julio: 67.5 m of white stone, its square shaft narrowing, the pyramid on top; the lawn round it. */
export function Obelisco({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffffff', 0.1)
  const at = useMemo(() => {
    const out: At[] = []
    out.push({ p: [0, 0.1, 0], s: [40, 0.2, 30], c: '#6b8f5a' })
    for (let i = 0; i < 16; i++) {
      const w = 6.8 - i * 0.18
      out.push({ p: [0, 2 + i * 4, 0], s: [w, 4, w], c: i % 2 ? '#ece9e2' : WHITE })
    }
    spire(out, [0, 64, 0], 3.8, 3.5, 4, WHITE, '#dcd9d1')
    out.push({ p: [0, 2, 3.45], s: [1.6, 3, 0.1], c: '#3a2a20' })
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/** The Casa Rosada (1898): the pink palace of the government on the Plaza de Mayo, its great arch, its balconies and the flag. */
export function CasaRosada({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1d6', 0.14)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -24
    const PINK = '#e8a0a0'
    const PINK_D = '#d48a8a'
    out.push({ p: [0, 11, z], s: [110, 22, 30], c: PINK })
    for (let i = 0; i < 2; i++) out.push({ p: [0, 22.5 + i, z], s: [112 - i * 4, 1, 32 - i * 4], c: PINK_D })
    // The arch, the floors' windows, the balconies.
    out.push({ p: [0, 13, z + 16], s: [16, 26, 4], c: PINK }, { p: [0, 7, z + 18.1], s: [8, 12, 0.2], c: '#3a2a20' })
    out.push({ p: [0, 26.5, z + 16], s: [10, 3, 4], c: PINK_D })
    for (let k = 0; k < 20; k++) for (const y of [5, 12, 18]) if (Math.abs(-52 + k * 5.4) > 9) out.push({ p: [-52 + k * 5.4, y, z + 15.05], s: [1.6, 3.4, 0.1], c: '#2f4458' })
    for (const x of [-30, 30]) out.push({ p: [x, 10, z + 15.6], s: [10, 0.4, 1.2], c: PINK_D })
    out.push({ p: [0, 31, z + 16], s: [0.2, 6, 0.2], c: '#ddd' }, { p: [1.8, 33, z + 16], s: [3.4, 2, 0.05], c: '#74acdf' })
    // The Plaza de Mayo: its paving, the pyramid, the palms.
    out.push({ p: [0, 0.05, z + 50], s: [100, 0.1, 50], c: '#c8c3ba' })
    spire(out, [0, 0, z + 56], 3, 14, 5, WHITE, '#dcd9d1')
    street(out, true, -44, 44, 40, 1898)
    return out
  }, [])
  const people = usePeople('casa-rosada', [
    { p: [4, 0.1, 18], ry: Math.PI, pose: 'film' },
    { p: [-8, 0.1, 22], ry: 0.6, pose: 'walk' },
    { p: [10, 0.1, 26], ry: 2.4, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}
