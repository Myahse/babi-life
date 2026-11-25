import { useMemo } from 'react'
import * as THREE from 'three'
import { Blocks } from './ruePrincesse'
import type { At } from './shoreline'
import { seeded } from './kit3d'
import { People, usePeople } from './villeKit'
import { dome, octo, ring, spire, useBlocks, streetLife, clockFace } from './paysKit'

// Montréal's landmarks (the update « pays-canada », backend world/pays.go), at their real size where known:
// the Basilique Notre-Dame and its two towers (69 m) on the place d'Armes, the Oratoire Saint-Joseph and
// its great copper dome on the flank of the mountain, the Hôtel de ville and its mansard roofs, the cross of
// the mont Royal lit at night, the Tour de l'Horloge of the Vieux-Port, the tower of the Université de
// Montréal. Proportions from photographs; the details are the game's. Frames: +z the street.

const GREYSTONE = '#9fa3a6'
const GREYSTONE_D = '#868a8d'
const COPPER = '#5f9e8a'
const COPPER_D = '#4c8574'

/**
 * The Basilique Notre-Dame (1829): the neo-Gothic front of grey stone between its two square towers (69 m,
 * the Persévérance and the Tempérance), the three arches of the porch and its statues, the windows, the
 * nave behind under its green copper roof; the place d'Armes in front, its monument.
 */
export function BasiliqueNotreDame({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#e8f0ff', 0.12)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -16
    // The nave and its roof.
    out.push({ p: [0, 13, z - 36], s: [34, 26, 66], c: GREYSTONE_D })
    for (let i = 0; i < 6; i++) out.push({ p: [0, 26.4 + i * 1.4, z - 36], s: [34 - i * 5.6, 1.4, 66.5], c: i % 2 ? COPPER_D : COPPER })
    for (let k = 0; k < 8; k++) for (const s of [-1, 1]) out.push({ p: [s * 17.05, 14, z - 8 - k * 7.4], s: [0.1, 12, 2.2], c: '#3a5f8a' })
    // The front: the gable, the three arches, the statues over them, the windows.
    out.push({ p: [0, 18, z], s: [22, 36, 3], c: GREYSTONE })
    for (const x of [-6.5, 0, 6.5]) {
      out.push({ p: [x, 6, z + 2.6], s: [5.4, 12, 2.2], c: GREYSTONE })
      out.push({ p: [x, 5, z + 3.75], s: [3.6, 9, 0.1], c: '#3a2a20' })
      out.push({ p: [x, 14, z + 3.8], s: [1.2, 2.6, 0.6], c: '#d6d9dc' })
    }
    for (const x of [-6.5, 0, 6.5]) out.push({ p: [x, 22, z + 1.55], s: [2.6, 9, 0.1], c: '#3a5f8a' })
    for (let i = 0; i < 4; i++) out.push({ p: [0, 36.6 + i * 1.2, z], s: [18 - i * 4.4, 1.2, 3], c: GREYSTONE })
    // The two towers, their lancets, the pinnacles round their tops.
    for (const s of [-1, 1]) {
      const x = s * 15
      out.push({ p: [x, 30, z], s: [9, 60, 9], c: GREYSTONE })
      for (let f = 0; f < 5; f++) out.push({ p: [x, 12 + f * 9, z + 4.55], s: [1.6, 6, 0.1], c: '#3a5f8a' })
      out.push({ p: [x, 54, z + 4.56], s: [3.2, 7, 0.1], c: '#26313b' })
      out.push({ p: [x, 60.5, z], s: [9.6, 1, 9.6], c: GREYSTONE_D })
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) spire(out, [x + dx * 4.2, 61, z + dz * 4.2], 1.2, 7, 4, GREYSTONE, GREYSTONE_D)
      out.push({ p: [x, 63, z], s: [6, 4, 6], c: GREYSTONE })
    }
    // The place d'Armes: its paving, the monument to Maisonneuve, the trees.
    out.push({ p: [0, 0.05, z + 22], s: [44, 0.1, 30], c: '#c8c3ba' })
    octo(out, [0, 1, z + 22], 6, 2, '#b5b0a6')
    out.push({ p: [0, 4, z + 22], s: [2, 4, 2], c: '#9aa3aa' }, { p: [0, 7, z + 22], s: [1.2, 2.4, 1], c: '#5c7a6a' })
    const r = seeded(31)
    for (let i = 0; i < 6; i++) {
      const x = (i % 2 ? 1 : -1) * (14 + r() * 4)
      const zz = z + 12 + Math.floor(i / 2) * 9
      out.push({ p: [x, 2, zz], s: [0.5, 4, 0.5], c: '#6b4a2a' }, { p: [x, 5.4, zz], s: [4.4, 3.2, 4.4], c: '#3c7a36' })
    }
    streetLife(out, 'montreal', -22, 22, 24, 673)
    return out
  }, [])
  const people = usePeople('notre-dame-mtl', [
    { p: [3, 0.1, 2], ry: Math.PI, pose: 'film' },
    { p: [-4, 0.1, 4], ry: 0.4, pose: 'walk' },
    { p: [6, 0.1, 6], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/**
 * The Oratoire Saint-Joseph (finished in 1967): the basilica on the flank of the mont Royal, its classical
 * front and columns, the great copper dome (the cross 97 m above the street), the long stairs up the
 * mountain (the pilgrims climb them on their knees), the trees round it.
 */
export function Oratoire({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1d6', 0.12)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -60
    const base = 22 // up the mountain
    // The terraces of the mountain and the stairs up them.
    for (let i = 0; i < 6; i++) out.push({ p: [0, (base * (i + 0.5)) / 6, -6 - i * 9], s: [70 - i * 3, base / 6, 10], c: i % 2 ? '#7a8a6a' : '#6e7f5f' })
    for (let i = 0; i < 44; i++) out.push({ p: [0, 0.25 + i * 0.5, -2 - i * 1.25], s: [12, 0.5, 1.25], c: '#d6d0c4' })
    out.push({ p: [0, base / 2, z], s: [80, base, 50], c: '#6e7f5f' })
    // The basilica: the body, the front, its columns, the pediment.
    out.push({ p: [0, base + 18, z - 4], s: [44, 36, 56], c: '#c9c2b2' })
    for (let k = 0; k < 8; k++) out.push({ p: [-17.5 + k * 5, base + 14, z + 25], s: [1.8, 28, 1.8], c: '#e2dccd' })
    out.push({ p: [0, base + 29, z + 25], s: [42, 2.4, 4], c: '#d6d0c4' })
    for (let i = 0; i < 4; i++) out.push({ p: [0, base + 30.8 + i * 1.2, z + 25], s: [40 - i * 10, 1.2, 4], c: '#d6d0c4' })
    for (let k = 0; k < 6; k++) out.push({ p: [-12.5 + k * 5, base + 10, z + 24], s: [2.4, 8, 0.1], c: '#2a2a2a' })
    // The dome: its drum, its windows, the copper, the lantern and the cross.
    octo(out, [0, base + 42, z - 6], 34, 12, '#d6d0c4')
    ring(out, [0, base + 42, z - 6], 15.6, 16, [2, 6, 0.3], '#3a5f8a')
    dome(out, [0, base + 48, z - 6], 17, 8, COPPER, COPPER_D, 1.15)
    octo(out, [0, base + 69, z - 6], 6, 4, '#d6d0c4')
    dome(out, [0, base + 71, z - 6], 3.2, 3, COPPER, COPPER_D)
    out.push({ p: [0, base + 76, z - 6], s: [0.5, 4, 0.5], c: '#e9ecef' }, { p: [0, base + 77, z - 6], s: [2.4, 0.5, 0.5], c: '#e9ecef' })
    // The trees round the terraces.
    const r = seeded(73)
    for (let i = 0; i < 16; i++) {
      const x = (i % 2 ? 1 : -1) * (24 + r() * 10)
      const zz = -8 - Math.floor(i / 2) * 7
      const y = (Math.min(5, Math.floor(-(zz + 6) / 9)) + 1) * (base / 6)
      out.push({ p: [x, y + 2, zz], s: [0.5, 4, 0.5], c: '#6b4a2a' }, { p: [x, y + 5, zz], s: [4.6, 3.6, 4.6], c: r() < 0.5 ? '#3c7a36' : '#c2611f' })
    }
    return out
  }, [])
  const people = usePeople('oratoire', [
    { p: [2, 1.5, -6], ry: Math.PI, pose: 'walk' },
    { p: [-3, 4, -10], ry: Math.PI, pose: 'pray' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Hôtel de ville (1878, Second Empire): the long front of grey stone, its pavilions under their copper mansards, the tower in the middle and its flag, the balcony of 1967. */
export function HotelVilleMtl({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.14)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -12
    out.push({ p: [0, 9, z - 10], s: [70, 18, 22], c: '#b9b4aa' })
    for (let i = 0; i < 3; i++) out.push({ p: [0, 18.6 + i * 1.6, z - 10], s: [70 - i * 3, 1.6, 22 - i * 4], c: i % 2 ? COPPER_D : COPPER })
    for (let k = 0; k < 16; k++) for (const y of [4, 9, 14]) out.push({ p: [-31 + k * 4.1, y, z + 1.05], s: [1.6, 3, 0.1], c: '#2f4458' })
    for (const x of [-30, 30]) (out.push({ p: [x, 11, z - 9], s: [12, 22, 24], c: '#c2bdb2' }), spire(out, [x, 22, z - 9], 12, 6, 3, COPPER, COPPER_D))
    // The central tower, its clock, its mansard, its flagpole.
    out.push({ p: [0, 16, z - 8], s: [14, 32, 16], c: '#c2bdb2' })
    clockFace(out, [0, 26, z + 0.05], 1.6, '#4c8574')
    spire(out, [0, 32, z - 8], 14, 9, 4, COPPER, COPPER_D)
    out.push({ p: [0, 44, z - 8], s: [0.25, 6, 0.25], c: '#ddd' }, { p: [1.3, 46, z - 8], s: [2.4, 1.4, 0.05], c: '#e03131' }, { p: [1.3, 46, z - 7.97], s: [0.8, 1.4, 0.04], c: '#ffffff' })
    out.push({ p: [0, 10, z + 2], s: [10, 0.4, 3], c: '#9aa3aa' }, { p: [0, 2.8, z + 1.1], s: [4, 5.6, 0.1], c: '#3a2a20' })
    streetLife(out, 'montreal', -36, 36, 5, 690)
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/** The cross of the mont Royal (1924): 31 m of steel lattice on the summit, lit white at night, over the woods of the park. */
export function CroixMontRoyal({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffffff', 0.08)
  const lit = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), [])
  lit.color.set(night ? '#ffffff' : '#c9ced3')
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(5)
    // The summit's rock and woods.
    octo(out, [0, 2, -24], 30, 4, '#7d7a6e')
    for (let i = 0; i < 30; i++) {
      const a = r() * Math.PI * 2
      const d = 8 + r() * 22
      const x = Math.sin(a) * d
      const zz = -24 + Math.cos(a) * d
      out.push({ p: [x, 2, zz], s: [0.5, 4, 0.5], c: '#6b4a2a' }, { p: [x, 5.5, zz], s: [4.2, 3.6, 4.2], c: ['#3c7a36', '#c2611f', '#d9a21a', '#2f6a30'][i % 4] })
    }
    return out
  }, [])
  const cross = useMemo(() => {
    const out: At[] = []
    const z = -24
    // The lattice: two uprights and their braces up the shaft, the arms.
    for (let y = 4; y < 35; y += 1.2) {
      for (const dx of [-0.7, 0.7]) out.push({ p: [dx, y, z], s: [0.18, 1.2, 0.18] })
      out.push({ p: [0, y, z], s: [1.4, 0.12, 0.12] })
    }
    for (let x = -5.5; x <= 5.5; x += 1.1) {
      for (const dy of [-0.5, 0.5]) out.push({ p: [x, 26 + dy, z], s: [1.1, 0.16, 0.16] })
      out.push({ p: [x, 26, z], s: [0.12, 1, 0.12] })
    }
    return out
  }, [])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Blocks at={cross} material={lit} />
    </group>
  )
}

/** The Tour de l'Horloge (1922) at the end of the Vieux-Port's quay: the white tower of 45 m and its four clocks, the lantern; the quay and the St. Lawrence. */
export function TourHorloge({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.14)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -20
    out.push({ p: [0, 0.6, z], s: [30, 1.2, 40], c: '#a9a59c' })
    out.push({ p: [0, 0.2, z - 30], s: [60, 0.4, 20], c: '#3d6f8f' })
    out.push({ p: [0, 4, z], s: [12, 8, 12], c: '#ece7dc' })
    octo(out, [0, 22, z], 7, 28, '#f3efe6', '#e8e2d4')
    out.push({ p: [0, 36.4, z], s: [8, 0.8, 8], c: '#d6d0c4' })
    // The four clocks: the one over the quay round, the others on the sides.
    clockFace(out, [0, 32, z + 3.5], 1.5, '#5c5f66')
    for (const [dx, dz, ry] of [
      [0, -3.55, 0],
      [3.55, 0, Math.PI / 2],
      [-3.55, 0, Math.PI / 2],
    ] as const) {
      out.push({ p: [dx, 32, z + dz], s: [3, 3, 0.12], ry, c: '#f8f9fa' })
      out.push({ p: [dx, 32.4, z + dz * 1.01], s: [0.14, 1.2, 0.05], ry, c: '#111' })
    }
    octo(out, [0, 39, z], 4.4, 4.6, '#f3efe6')
    dome(out, [0, 41.3, z], 2.2, 3, '#c9b38a', '#b9a37a')
    out.push({ p: [0, 44, z], s: [0.2, 2, 0.2], c: '#666' })
    streetLife(out, 'montreal', -16, 16, 4, 707)
    return out
  }, [])
  const people = usePeople('vieux-port', [
    { p: [3, 1.2, -6], ry: Math.PI, pose: 'film' },
    { p: [-4, 1.2, -8], ry: 0.4, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Université de Montréal's main building (Ernest Cormier, 1943): the long wings of yellow brick and the slim art deco tower in the middle, on the mountain's north flank. */
export function UdeM({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.12)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -30
    const brick = '#d9b46a'
    out.push({ p: [0, 10, z], s: [120, 20, 18], c: brick }, { p: [0, 20.4, z], s: [120.4, 0.8, 18.4], c: '#c4a058' })
    for (let k = 0; k < 28; k++) for (const y of [4, 9, 14]) out.push({ p: [-56 + k * 4.15, y, z + 9.05], s: [1.6, 3, 0.1], c: '#3b4f63' })
    for (const x of [-50, 50]) out.push({ p: [x, 8, z - 22], s: [16, 16, 30], c: brick })
    // The tower: its shaft in steps, its vertical strips, the lantern.
    out.push({ p: [0, 30, z], s: [14, 60, 14], c: brick })
    for (const dx of [-3, 0, 3]) out.push({ p: [dx, 36, z + 7.05], s: [1, 44, 0.1], c: '#3b4f63' })
    out.push({ p: [0, 62, z], s: [10, 4, 10], c: brick }, { p: [0, 66, z], s: [7, 4, 7], c: '#c4a058' })
    octo(out, [0, 70, z], 4, 4, '#e6e0d2')
    out.push({ p: [0, 74, z], s: [0.3, 4, 0.3], c: '#ccc' })
    // The lawn and the paths in front.
    out.push({ p: [0, 0.1, z + 22], s: [80, 0.2, 24], c: '#5c9e31' }, { p: [0, 0.22, z + 22], s: [6, 0.04, 24], c: '#d6cfc0' })
    streetLife(out, 'montreal', -40, 40, 12, 724)
    return out
  }, [])
  const people = usePeople('udem', [
    { p: [2, 0.2, -2], ry: Math.PI, pose: 'walk' },
    { p: [-5, 0.2, -4], ry: 0.6, pose: 'phone' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}
