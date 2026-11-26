import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Blocks } from './ruePrincesse'
import type { At } from './shoreline'
import { seeded } from './kit3d'
import { People, Sign, usePeople, useSign } from './villeKit'
import { dome, octo, ring, spire, useBlocks, streetLife, clockFace, disc } from './paysKit'
import { worldTime } from '../../lib/worldClock'
import { t as tr } from '../../lib/i18n'

// Paris's landmarks (the update « pays-france », backend world/france.go), at their real size where known: the
// tour Eiffel (330 m, its four legs, two platforms, gold at night and sparkling on the hour), the Arc de
// Triomphe, the Louvre's pyramid in the cour Napoléon, Notre-Dame, the Sacré-Cœur on its butte, the Hôtel de
// Ville, the Grande Arche of La Défense, the Stade de France, and the marché Dejean of Château-Rouge, its stalls
// of fish, plantain and wax. Proportions from photographs; the details are the game's. Frames: +z the street.

const IRON = '#6b5a45'
const IRON_D = '#56483a'
const STONE = '#e6dcc6'
const STONE_D = '#cfc3a8'
const SLATE = '#4f5862'
const SLATE_D = '#424a53'

/**
 * The tour Eiffel (1889): four lattice legs leaning in over a square of 125 m, the great arches between them,
 * the first platform at 57 m, the second at 115 m, the shaft to the top at 276 m and its antennas to 330 m;
 * the Champ-de-Mars's lawns before it. Lit gold at night, its thousands of bulbs sparkling for a while.
 */
export function TourEiffel({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffb347', 0.55)
  const z = -60
  // Half the width between the legs' outer edges at height y (m): the curve of the real one, stepped.
  const half = (y: number) => (y < 57 ? 62 - y * 0.62 : y < 115 ? 26.7 - (y - 57) * 0.22 : y < 276 ? 13.9 - (y - 115) * 0.075 : 1.8)
  const at = useMemo(() => {
    const out: At[] = []
    // The four legs: a stepped column of lattice from the ground to the second platform, braced crosswise.
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        for (let y = 0; y < 115; y += 3) {
          const h = half(y + 1.5)
          const w = y < 57 ? 14 - y * 0.12 : 6.5 - (y - 57) * 0.05
          const x = sx * (h - w / 2)
          const zz = z + sz * (h - w / 2)
          // The leg's dense web seen from afar (a darker core), its four corner chords, a cross bar each step (the lattice).
          out.push({ p: [x, y + 1.5, zz], s: [w * 0.72, 3.05, w * 0.72], c: '#4a3e32' })
          for (const cx of [-1, 1]) for (const cz of [-1, 1]) out.push({ p: [x + (cx * w) / 2, y + 1.5, zz + (cz * w) / 2], s: [1.6, 3.05, 1.6], c: IRON })
          if ((y / 3) % 2 === 0) out.push({ p: [x, y + 1.5, zz + (sz * w) / 2], s: [w, 0.45, 0.45], c: IRON_D }, { p: [x + (sx * w) / 2, y + 1.5, zz], s: [0.45, 0.45, w], c: IRON_D })
          else out.push({ p: [x, y + 1.5, zz - (sz * w) / 2], s: [w, 0.45, 0.45], c: IRON_D }, { p: [x - (sx * w) / 2, y + 1.5, zz], s: [0.45, 0.45, w], c: IRON_D })
        }
      }
    // The great arches between the legs, under the first platform.
    for (let i = 0; i < 4; i++) {
      const ry = (i * Math.PI) / 2
      for (let k = 0; k < 40; k++) {
        const a = (k / 39) * Math.PI
        const y = 18 + Math.sin(a) * 26
        const x = Math.cos(a) * (half(y) - 8)
        const d = half(y) - 1.5
        const [px, pz] = [Math.cos(ry) * x - Math.sin(ry) * d, Math.sin(ry) * x + Math.cos(ry) * d]
        out.push({ p: [px, y, z + pz], s: [2.6, 2.6, 1.2], ry, c: IRON_D })
      }
    }
    // The first platform (its gallery and its windows), the second.
    out.push({ p: [0, 57, z], s: [74, 3, 74], c: IRON_D }, { p: [0, 60, z], s: [72, 3, 72], c: '#8a7a62' })
    for (const s of [-1, 1]) out.push({ p: [s * 36.2, 59.5, z], s: [0.2, 2, 70], c: '#9ab4c6' }, { p: [0, 59.5, z + s * 36.2], s: [70, 2, 0.2], c: '#9ab4c6' })
    out.push({ p: [0, 115, z], s: [42, 2.5, 42], c: IRON_D }, { p: [0, 117.5, z], s: [38, 2.5, 38], c: '#8a7a62' })
    // The shaft up to the top: the four chords narrowing, braced; the top platform, its lantern, the antennas.
    for (let y = 120; y < 276; y += 4) {
      const h = half(y)
      out.push({ p: [0, y + 2, z], s: [h * 1.05, 4.05, h * 1.05], c: '#4a3e32' })
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push({ p: [sx * (h - 0.6), y + 2, z + sz * (h - 0.6)], s: [1.6, 4.05, 1.6], c: IRON })
      if ((y / 4) % 2 === 0) out.push({ p: [0, y + 2, z + h - 0.6], s: [h * 2, 0.4, 0.4], c: IRON_D }, { p: [0, y + 2, z - h + 0.6], s: [h * 2, 0.4, 0.4], c: IRON_D })
      else out.push({ p: [h - 0.6, y + 2, z], s: [0.4, 0.4, h * 2], c: IRON_D }, { p: [-h + 0.6, y + 2, z], s: [0.4, 0.4, h * 2], c: IRON_D })
    }
    out.push({ p: [0, 276, z], s: [16, 3, 16], c: IRON_D }, { p: [0, 281, z], s: [10, 7, 10], c: '#8a7a62' }, { p: [0, 287, z], s: [6, 5, 6], c: IRON })
    out.push({ p: [0, 300, z], s: [1.6, 22, 1.6], c: '#c9c9c9' }, { p: [0, 320, z], s: [0.8, 20, 0.8], c: '#e03131' })
    // The Champ-de-Mars before it (its lawns and paths), the kiosks, the trees.
    out.push({ p: [0, 0.06, z + 70], s: [80, 0.12, 30], c: '#6aa84f' }, { p: [0, 0.08, z + 70], s: [10, 0.14, 30], c: '#d9c9a3' })
    const r = seeded(75)
    for (let i = 0; i < 10; i++) {
      const x = (i % 2 ? 1 : -1) * (46 + r() * 6)
      const zz = z + 50 + Math.floor(i / 2) * 9
      out.push({ p: [x, 2.2, zz], s: [0.5, 4.4, 0.5], c: '#6b5a45' }, { p: [x, 6, zz], s: [5, 4, 5], c: '#4f7f36' })
    }
    streetLife(out, 'paris', -40, 40, 26, 901)
    return out
  }, [])
  // Sparkling (night, the first five minutes of every ten): two sets of bulbs blinking in turn.
  const sparkle = useMemo(() => {
    const r = seeded(331)
    const sets: At[][] = [[], []]
    for (let i = 0; i < 700; i++) {
      const y = 4 + r() * 300
      const h = half(y)
      const side = Math.floor(r() * 4)
      const t = (r() * 2 - 1) * h
      const p: [number, number, number] = side === 0 ? [t, y, z + h + 0.6] : side === 1 ? [t, y, z - h - 0.6] : side === 2 ? [h + 0.6, y, z + t] : [-h - 0.6, y, z + t]
      sets[i % 2].push({ p, s: [0.7, 0.7, 0.7] })
    }
    return sets
  }, [])
  const white = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), [])
  const a = useRef<THREE.Group>(null)
  const b = useRef<THREE.Group>(null)
  useFrame(() => {
    const on = night && worldTime() % 600 < 300
    const flip = Math.floor(worldTime() * 8) % 2 === 0
    if (a.current) a.current.visible = on && flip
    if (b.current) b.current.visible = on && !flip
  })
  const people = usePeople('tour-eiffel', [
    { p: [4, 0.1, 6], ry: Math.PI, pose: 'film' },
    { p: [-6, 0.1, 10], ry: 0.3, pose: 'walk' },
    { p: [10, 0.1, 4], ry: 2.6, pose: 'film' },
    { p: [-2, 0.1, 14], ry: 0, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <group ref={a} visible={false}>
        <Blocks at={sparkle[0]} material={white} />
      </group>
      <group ref={b} visible={false}>
        <Blocks at={sparkle[1]} material={white} />
      </group>
      <People list={people} />
    </group>
  )
}

/** The Arc de Triomphe (1836): 50 m high, 45 wide, 22 deep; its great arch, the small ones on the sides, the reliefs, the attic and its shields; the flame of the Unknown Soldier under it. */
export function ArcTriomphe({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.18)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -8
    // The four piers (the arch's 14.6 m between them, the side arches through them).
    for (const sx of [-1, 1]) {
      out.push({ p: [sx * 14.95, 15, z], s: [15.1, 30, 22], c: STONE })
      out.push({ p: [sx * 14.95, 9, z], s: [15.2, 18, 8.4], c: '#3b3428' })
      // The great reliefs on the piers' fronts (La Marseillaise and the others), the cornices.
      out.push({ p: [sx * 14.95, 9, z + 11.1], s: [9, 11, 0.4], c: STONE_D }, { p: [sx * 14.95, 9, z - 11.1], s: [9, 11, 0.4], c: STONE_D })
      for (const dz of [-11.2, 11.2]) out.push({ p: [sx * 14.95, 9.6, z + dz * 1.01], s: [6, 8, 0.2], c: '#bfb39a' })
    }
    // Over the arch: its vault in steps, the frieze, the cornice, the attic and its shields.
    for (let k = 0; k < 6; k++) out.push({ p: [0, 29.2 - k * 0.2 + k * 0.01, z], s: [14.6 - k * 2.4, 0.4 + k * 0.4, 22], c: STONE })
    out.push({ p: [0, 32, z], s: [45, 4, 22], c: STONE }, { p: [0, 34.4, z], s: [46, 0.8, 23], c: STONE_D })
    out.push({ p: [0, 37.5, z], s: [45, 5.4, 22], c: STONE }, { p: [0, 40.6, z], s: [45.6, 0.8, 22.6], c: STONE_D })
    for (let k = 0; k < 15; k++) for (const dz of [-11.25, 11.25]) out.push({ p: [-21 + k * 3, 37.5, z + dz], s: [1.6, 1.6, 0.2], c: '#bfb39a' })
    // The flame under it, the tomb.
    out.push({ p: [0, 0.2, z], s: [3, 0.4, 2], c: '#6b6b6b' }, { p: [0, 0.6, z], s: [0.5, 0.6, 0.5], c: '#ff922b' })
    // The place de l'Étoile's paving round it.
    out.push({ p: [0, 0.04, z], s: [70, 0.08, 50], c: '#c8c0ad' })
    streetLife(out, 'paris', -32, 32, 22, 911)
    return out
  }, [])
  const people = usePeople('arc-triomphe', [
    { p: [2, 0.1, 4], ry: Math.PI, pose: 'film' },
    { p: [-5, 0.1, 9], ry: 0.4, pose: 'walk' },
    { p: [7, 0.1, 12], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Louvre: the cour Napoléon between the palace's wings, I. M. Pei's glass pyramid (21.6 m, 35 m a side) and its three small ones, the fountains. */
export function Louvre({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.12)
  const glass = useMemo(() => new THREE.MeshLambertMaterial({ color: '#b9d4e6', transparent: true, opacity: 0.7, emissive: new THREE.Color('#ffe8a8') }), [])
  glass.emissiveIntensity = night ? 0.6 : 0
  const z = -40
  const at = useMemo(() => {
    const out: At[] = []
    // The palace's wings round the court (a U open to the street), their slate roofs and pavilions.
    const wing = (x: number, zz: number, w: number, d: number) => {
      out.push({ p: [x, 11, zz], s: [w, 22, d], c: STONE })
      out.push({ p: [x, 23, zz], s: [w, 2, d - 2], c: SLATE }, { p: [x, 24.8, zz], s: [w - 2, 1.6, d - 6], c: SLATE_D })
      const n = Math.floor(Math.max(w, d) / 4)
      for (let k = 0; k < n; k++)
        for (const y of [6, 14]) {
          if (w > d) out.push({ p: [x - w / 2 + 2 + k * 4, y, zz + d / 2 + 0.05], s: [1.6, 4, 0.1], c: '#3b4a5a' })
          else out.push({ p: [x + (x < 0 ? d / 2 : -d / 2) + (x < 0 ? 0.05 : -0.05), y, zz - d / 2 + 2 + k * 4], s: [0.1, 4, 1.6], c: '#3b4a5a' })
        }
    }
    wing(0, z - 50, 180, 20)
    wing(-80, z - 10, 20, 80)
    wing(80, z - 10, 20, 80)
    for (const x of [-80, 0, 80]) (out.push({ p: [x, 14, z - 50 + (x ? 0 : 0)], s: [26, 28, 24], c: STONE_D }), spire(out, [x, 28, z - 50], 22, 8, 4, SLATE, SLATE_D))
    // The court's paving, the fountains' basins round the pyramid.
    out.push({ p: [0, 0.05, z], s: [140, 0.1, 90], c: '#d6cfc0' })
    for (const [x, zz] of [
      [-34, 0],
      [34, 0],
      [0, 28],
    ])
      out.push({ p: [x, 0.25, z + zz], s: [26, 0.5, 14], c: '#bdb6a6' }, { p: [x, 0.45, z + zz], s: [24, 0.2, 12], c: '#3d7fa6' })
    streetLife(out, 'paris', -50, 50, 34, 921)
    return out
  }, [z])
  // The pyramids: stacked steps of glass, their steel ribs.
  const pyr = useMemo(() => {
    const out: At[] = []
    const step = (x: number, zz: number, base: number, h: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const w = base * (1 - i / n)
        out.push({ p: [x, (h / n) * (i + 0.5), zz], s: [w, h / n, w] })
      }
    }
    step(0, z, 35, 21.6, 14)
    step(-22, z + 6, 8, 5, 5)
    step(22, z + 6, 8, 5, 5)
    step(0, z - 24, 8, 5, 5)
    return out
  }, [z])
  const ribs = useMemo(() => {
    const out: At[] = []
    for (let i = 0; i < 14; i++) {
      const w = 35 * (1 - i / 14)
      const y = (21.6 / 14) * (i + 1)
      for (const s of [-1, 1]) out.push({ p: [0, y, z + (s * w) / 2], s: [w, 0.12, 0.12], c: '#5c636a' }, { p: [(s * w) / 2, y, z], s: [0.12, 0.12, w], c: '#5c636a' })
    }
    return out
  }, [z])
  const people = usePeople('louvre', [
    { p: [4, 0.1, -8], ry: Math.PI, pose: 'film' },
    { p: [-8, 0.1, -4], ry: 0.5, pose: 'walk' },
    { p: [12, 0.1, 2], ry: 2.2, pose: 'talk' },
    { p: [-3, 0.1, 6], ry: 0, pose: 'phone' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Blocks at={pyr} material={glass} />
      <Blocks at={ribs} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** Notre-Dame de Paris (1163-1345, rebuilt after the fire of 2019): the west front between its two square towers (69 m), the three portals, the rose window, the gallery of kings; the nave and its slate roof, the flying buttresses, the spire (96 m) put back. */
export function NotreDame({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.14)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -14
    const W = '#d8ceb6'
    // The nave behind, its roof, the buttresses along it; the transept; the apse.
    out.push({ p: [0, 17, z - 64], s: [30, 34, 100], c: W })
    for (let i = 0; i < 6; i++) out.push({ p: [0, 34.6 + i * 1.6, z - 64], s: [30 - i * 5, 1.6, 100], c: i % 2 ? SLATE_D : SLATE })
    out.push({ p: [0, 17, z - 60], s: [48, 34, 14], c: W })
    for (let k = 0; k < 10; k++)
      for (const s of [-1, 1]) {
        out.push({ p: [s * 22, 11, z - 22 - k * 9.4], s: [2, 22, 2], c: W })
        out.push({ p: [s * 18.5, 24, z - 22 - k * 9.4], s: [6, 1.2, 1.2], ry: 0, c: W })
      }
    // The spire at the crossing (its oak under lead), the rooster.
    octo(out, [0, 46, z - 60], 6, 8, SLATE)
    spire(out, [0, 50, z - 60], 5, 44, 11, SLATE, SLATE_D)
    out.push({ p: [0, 95, z - 60], s: [0.6, 1.4, 1.2], c: '#c9a24a' })
    // The west front: the three portals, the gallery of kings, the rose, the open gallery, the towers.
    out.push({ p: [0, 21, z], s: [42, 42, 6], c: W })
    for (const x of [-12, 0, 12]) {
      out.push({ p: [x, 6, z + 3.1], s: [8, 12, 1.2], c: '#c9bfa6' })
      out.push({ p: [x, 5, z + 3.75], s: [5, 9, 0.1], c: '#2f2a22' })
    }
    for (let k = 0; k < 14; k++) out.push({ p: [-18 + k * 2.75, 15.5, z + 3.1], s: [1.4, 2.6, 0.4], c: '#bdb39a' })
    disc(out, [0, 24, z + 3.05], 5, '#bdb39a', 9, 0.2)
    disc(out, [0, 24, z + 3.2], 4.3, '#3b5f8a', 9, 0.1)
    out.push({ p: [-1.2, 24, z + 3.3], s: [0.4, 8, 0.05], c: '#c92a2a' }, { p: [1.2, 24, z + 3.3], s: [0.4, 8, 0.05], c: '#c9a24a' })
    for (let k = 0; k < 16; k++) out.push({ p: [-19 + k * 2.55, 36, z + 3], s: [0.6, 6, 0.6], c: W })
    for (const s of [-1, 1]) {
      out.push({ p: [s * 14, 54.5, z], s: [13, 27, 12], c: W })
      for (const dz of [-6.1, 6.1]) out.push({ p: [s * 14 - 2.5, 55, z + dz], s: [2.2, 16, 0.2], c: '#2f2a22' }, { p: [s * 14 + 2.5, 55, z + dz], s: [2.2, 16, 0.2], c: '#2f2a22' })
      out.push({ p: [s * 14, 68.5, z], s: [14, 1, 13], c: '#bdb39a' })
    }
    // The parvis and its paving.
    out.push({ p: [0, 0.05, z + 26], s: [70, 0.1, 40], c: '#d9d2c2' })
    streetLife(out, 'paris', -34, 34, 36, 931)
    return out
  }, [])
  const people = usePeople('notre-dame-paris', [
    { p: [3, 0.1, 8], ry: Math.PI, pose: 'film' },
    { p: [-6, 0.1, 12], ry: 0.4, pose: 'walk' },
    { p: [8, 0.1, 16], ry: 2.6, pose: 'pray' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Sacré-Cœur (1914) on top of the butte: white travertine, the great dome (83 m) and its four small ones, the bell tower behind, the steps and the gardens down the hill. */
export function SacreCoeur({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffffff', 0.18)
  const at = useMemo(() => {
    const out: At[] = []
    const W = '#f4f1ea'
    const W2 = '#e6e1d6'
    const base = 14
    const z = -46
    // The terraces of the butte and the steps up them, the gardens.
    for (let i = 0; i < 5; i++) out.push({ p: [0, (base * (i + 0.5)) / 5, -8 - i * 7], s: [64 - i * 4, base / 5, 8], c: i % 2 ? '#6e9a52' : '#5f8a45' })
    for (let i = 0; i < 28; i++) out.push({ p: [0, 0.25 + i * 0.5, -4 - i * 1.25], s: [10, 0.5, 1.25], c: '#d6d0c4' })
    out.push({ p: [0, base / 2, z], s: [70, base, 40], c: '#5f8a45' })
    // The church: the porch and its three arches, the body, the four small domes, the great dome on its drum.
    out.push({ p: [0, base + 12, z], s: [36, 24, 30], c: W })
    out.push({ p: [0, base + 8, z + 17], s: [24, 16, 6], c: W2 })
    for (const x of [-7, 0, 7]) out.push({ p: [x, base + 5, z + 20.05], s: [4.4, 9, 0.1], c: '#3b3428' })
    for (const [x, zz] of [
      [-14, 10],
      [14, 10],
      [-14, -10],
      [14, -10],
    ]) {
      octo(out, [x, base + 27, z + zz], 6, 6, W)
      dome(out, [x, base + 30, z + zz], 3.2, 4, W, W2, 1.3)
    }
    octo(out, [0, base + 34, z], 18, 20, W, W2)
    ring(out, [0, base + 36, z], 8.6, 16, [1.6, 5, 0.3], '#3b4a5a')
    dome(out, [0, base + 44, z], 10, 8, W, W2, 1.5)
    octo(out, [0, base + 61, z], 3, 4, W)
    dome(out, [0, base + 63, z], 1.8, 3, W, W2, 1.4)
    out.push({ p: [0, base + 67, z], s: [0.4, 3, 0.4], c: '#c9a24a' })
    // The bell tower behind.
    out.push({ p: [0, base + 28, z - 22], s: [9, 56, 9], c: W })
    octo(out, [0, base + 58, z - 22], 7, 6, W2)
    dome(out, [0, base + 61, z - 22], 4, 4, W, W2, 1.3)
    streetLife(out, 'paris', -28, 28, 6, 941)
    return out
  }, [])
  const people = usePeople('sacre-coeur', [
    { p: [2, 1, -6], ry: Math.PI, pose: 'walk' },
    { p: [-4, 3, -10], ry: 0, pose: 'film' },
    { p: [5, 0.1, 2], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Hôtel de Ville de Paris (rebuilt 1873-1892, neo-Renaissance): the long front of pale stone, its pavilions under their steep slate roofs, the central belfry and its clock, the flags; the square before it. */
export function HotelVilleParis({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.16)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -24
    out.push({ p: [0, 13, z], s: [140, 26, 40], c: STONE })
    for (let i = 0; i < 4; i++) out.push({ p: [0, 27 + i * 2, z], s: [140 - i * 4, 2, 40 - i * 8], c: i % 2 ? SLATE_D : SLATE })
    for (let k = 0; k < 30; k++) for (const y of [5, 12, 19]) out.push({ p: [-66 + k * 4.55, y, z + 20.05], s: [1.6, 3.6, 0.1], c: '#3b4a5a' })
    for (const x of [-62, -30, 30, 62]) (out.push({ p: [x, 16, z + 1], s: [16, 32, 42], c: STONE_D }), spire(out, [x, 32, z + 1], 16, 10, 4, SLATE, SLATE_D))
    // The belfry, its clock, its lantern and flag.
    out.push({ p: [0, 20, z + 1], s: [20, 40, 42], c: STONE_D })
    clockFace(out, [0, 33, z + 22.1], 2.4, '#c9a24a')
    spire(out, [0, 40, z + 1], 18, 10, 4, SLATE, SLATE_D)
    octo(out, [0, 52, z + 1], 4, 6, STONE)
    out.push({ p: [0, 58, z + 1], s: [0.25, 6, 0.25], c: '#ddd' })
    for (const [x, c] of [
      [0.8, '#1c3f94'],
      [1.6, '#ffffff'],
      [2.4, '#e03131'],
    ] as const)
      out.push({ p: [x, 60, z + 1], s: [0.8, 1.4, 0.05], c })
    // The square, its fountains, its lamps.
    out.push({ p: [0, 0.05, z + 40], s: [120, 0.1, 38], c: '#d6cfc0' })
    for (const x of [-30, 30]) out.push({ p: [x, 0.3, z + 40], s: [8, 0.6, 8], c: '#bdb6a6' }, { p: [x, 0.6, z + 40], s: [7, 0.1, 7], c: '#3d7fa6' })
    streetLife(out, 'paris', -56, 56, 58, 951)
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/** The Grande Arche of La Défense (1989): a hollow cube of 110 m in white marble and glass, its « cloud » of canvas under the arch, the great steps; the towers of glass round the parvis. */
export function GrandeArche({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#e8f0ff', 0.2)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -50
    const M = '#eef0f2'
    // The frame: the two sides, the roof, the base; their glass grid inside.
    for (const s of [-1, 1]) out.push({ p: [s * 47, 55, z], s: [16, 110, 70], c: M }, { p: [s * 38.95, 55, z], s: [0.1, 106, 66], c: '#9fb6c8' })
    out.push({ p: [0, 102, z], s: [110, 16, 70], c: M }, { p: [0, 4, z], s: [110, 8, 70], c: M })
    for (let k = 0; k < 10; k++) out.push({ p: [-45 + k * 10, 102, z + 35.05], s: [0.3, 14, 0.1], c: '#b9c4cc' })
    // The cloud (« le nuage »), the steps.
    out.push({ p: [0, 30, z + 8], s: [40, 1.5, 28], c: '#fafafa' }, { p: [0, 31, z + 8], s: [30, 1, 20], c: '#f1f3f5' })
    for (let i = 0; i < 16; i++) out.push({ p: [0, 0.2 + i * 0.4, z + 50 - i * 1.2], s: [100, 0.4, 1.2], c: '#d6d6d6' })
    // The parvis, and towers of glass on both sides.
    out.push({ p: [0, 0.05, z + 80], s: [120, 0.1, 50], c: '#cfcfcf' })
    const r = seeded(17)
    for (const s of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const h = 90 + r() * 90
        out.push({ p: [s * (80 + i * 6), h / 2, z + 40 + i * 30], s: [24, h, 24], c: r() < 0.5 ? '#6f8fa8' : '#8aa4b8' })
      }
    streetLife(out, 'paris', -50, 50, 60, 961)
    return out
  }, [])
  const people = usePeople('grande-arche', [
    { p: [3, 6, -4], ry: Math.PI, pose: 'phone' },
    { p: [-6, 0.1, 8], ry: 0.4, pose: 'walk' },
    { p: [9, 0.1, 14], ry: 2.6, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Stade de France (1998): the oval of its stands round the pitch, the great floating roof ring on its masts, the blue seats; the forecourt. */
export function StadeDeFrance({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffffff', 0.2)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -110
    out.push({ p: [0, 0.1, z], s: [70, 0.2, 108], c: '#3f8f3a' })
    for (let i = 0; i < 9; i++) out.push({ p: [0, 0.22, z - 48 + i * 12], s: [68, 0.04, 6], c: i % 2 ? '#3a8536' : '#47993f' })
    // The stands: rings of seats rising, the outer wall.
    for (let t = 0; t < 6; t++) {
      const rx = 52 + t * 8
      ring(out, [0, 3 + t * 5, z], rx, 64, [10, 5, 10], t % 2 ? '#1c3f94' : '#2b4fb0')
    }
    ring(out, [0, 18, z], 100, 72, [10, 36, 3], '#cfd4da')
    // The roof's ring and its masts.
    ring(out, [0, 44, z], 92, 72, [10, 2, 26], '#e9ecef')
    ring(out, [0, 28, z], 104, 18, [1.2, 56, 1.2], '#adb5bd')
    out.push({ p: [0, 0.05, z + 120], s: [140, 0.1, 30], c: '#cfcfcf' })
    streetLife(out, 'paris', -60, 60, 10, 971)
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/**
 * The marché Dejean (Château-Rouge, 18e): the market street of the diaspora, its stalls on both sides under their
 * awnings, the fishmongers' ice, the plantain and the cassava, the yams, the spices, a stall of wax; the hair
 * salons' and shops' fronts behind, the crowd shopping.
 */
export function MarcheDejean({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.16)
  const sign = useSign(tr('MARCHÉ DEJEAN'), '#2f5a3f', '#ffffff', night)
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(77)
    const goods = ['#e9e9e9', '#e9b72f', '#8a5a2b', '#c0392b', '#f08c00', '#7a4a2a', '#2f9e44']
    const wax = ['#f08c00', '#1c7ed6', '#e03131', '#2f9e44', '#ae3ec9']
    for (const s of [-1, 1])
      for (let i = 0; i < 7; i++) {
        const z = -24 + i * 6
        const x = s * 5
        // The stall, its trestle, its goods in heaps, its awning; the shop's front behind.
        out.push({ p: [x, 0.45, z], s: [2, 0.9, 5], c: '#8a6a3c' })
        const fish = i % 3 === 0
        for (let k = 0; k < 4; k++) out.push({ p: [x + (r() - 0.5) * 1.2, 1.05, z - 1.8 + k * 1.2], s: [1.2, 0.3, 1], c: fish ? (k % 2 ? '#dbe4ec' : '#b8c4cc') : goods[Math.floor(r() * goods.length)] })
        out.push({ p: [x + s * 0.6, 2.6, z], s: [3.2, 0.1, 5.4], c: i % 2 ? '#c92a2a' : '#1c7ed6' })
        out.push({ p: [s * 9, 6, z], s: [2, 12, 6], c: ['#e2d4b7', '#d9cbae', '#efe6d2'][i % 3] })
        out.push({ p: [s * 7.95, 1.6, z], s: [0.1, 3, 4], c: i === 2 ? '#7b2d26' : '#2b2f36' })
        out.push({ p: [s * 7.9, 3.6, z], s: [0.1, 0.8, 5], c: i === 2 ? '#ae3ec9' : i === 5 ? '#f2c230' : '#495057' })
        for (const y of [5.5, 9]) out.push({ p: [s * 7.95, y, z], s: [0.1, 1.8, 1.4], c: '#3b4a5a' })
        if (i === 4) for (let k = 0; k < 5; k++) out.push({ p: [x - s * 0.9, 1.4, z - 2 + k], s: [0.06, 1.8, 0.9], c: wax[k] })
      }
    out.push({ p: [0, 0.04, -6], s: [8, 0.08, 46], c: '#8a8a8a' })
    return out
  }, [])
  const people = usePeople('marche-dejean', [
    { p: [-2.6, 0.1, -20], ry: -Math.PI / 2, pose: 'pick', dress: { outfit: 'pagne', outfitColor: '#f08c00' } },
    { p: [2.8, 0.1, -14], ry: Math.PI / 2, pose: 'pay' },
    { p: [-1, 0.1, -8], ry: 0.2, pose: 'walk', dress: { outfit: 'boubou', outfitColor: '#1c7ed6' } },
    { p: [1.4, 0.1, -2], ry: Math.PI, pose: 'talk' },
    { p: [-3, 0.1, 4], ry: -Math.PI / 2, pose: 'pick' },
    { p: [6.2, 0.1, -14], ry: -Math.PI / 2, pose: 'rant', dress: { outfit: 'pagne', outfitColor: '#e03131' } },
    { p: [-6.2, 0.1, 0], ry: Math.PI / 2, pose: 'idle' },
    { p: [0.5, 0.1, 10], ry: Math.PI, pose: 'phone' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Sign s={sign} w={6} p={[0, 4.4, 14]} />
      <People list={people} />
    </group>
  )
}
