import { useMemo } from 'react'
import * as THREE from 'three'
import { Blocks } from './ruePrincesse'
import type { At } from './shoreline'
import { seeded } from './kit3d'
import { People, usePeople } from './villeKit'
import { dome, octo, spire, useBlocks, streetLife, disc, clockFace } from './paysKit'

// The great cities of France (the update « pays-france », backend world/france.go): Marseille's Bonne Mère on her
// hill and the Vieux-Port, Lyon's Fourvière, Toulouse's Capitole, Bordeaux's place de la Bourse and its water
// mirror, Lille's Grand-Place, Nice's promenade des Anglais, Strasbourg's cathedral, Nantes's château. At their
// real size where known; proportions from photographs, the details the game's. Frames: +z the street.

/** Notre-Dame-de-la-Garde (1864), « la Bonne Mère »: the basilica of striped stone on its rock 150 m over the city, the bell tower (41 m) and the gilded Virgin on top. (The rock drawn lower: the game's hills are gentler.) */
export function BonneMere({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.2)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -40
    const rock = 26
    const r = seeded(13)
    // The rock and its terraces, the pines.
    for (let i = 0; i < 5; i++) out.push({ p: [0, (rock * (i + 0.5)) / 5, z + 10 - i * 4], s: [70 - i * 10, rock / 5, 60 - i * 8], c: i % 2 ? '#c8bfa8' : '#b8ae96' })
    for (let i = 0; i < 12; i++) {
      const a = r() * Math.PI * 2
      const d = 22 + r() * 10
      out.push({ p: [Math.sin(a) * d, 4, z + Math.cos(a) * d], s: [0.5, 8, 0.5], c: '#6b4a2a' }, { p: [Math.sin(a) * d, 8.6, z + Math.cos(a) * d], s: [5, 1.6, 5], c: '#3f6b35' })
    }
    // The basilica: its nave in bands of white and green stone, the dome, the bell tower and the statue.
    for (let k = 0; k < 8; k++) out.push({ p: [0, rock + 1 + k * 2, z - 8], s: [14, 2, 30], c: k % 2 ? '#5b7a5a' : '#ece5d3' })
    dome(out, [0, rock + 17, z - 14], 6, 5, '#ece5d3', '#5b7a5a', 1.2)
    for (let k = 0; k < 12; k++) out.push({ p: [0, rock + 1.5 + k * 3, z + 9], s: [9, 3, 9], c: k % 2 ? '#5b7a5a' : '#ece5d3' })
    octo(out, [0, rock + 38, z + 9], 7, 4, '#ece5d3')
    out.push({ p: [0, rock + 42, z + 9], s: [3.4, 4, 3.4], c: '#d4a62a' })
    out.push({ p: [0, rock + 47, z + 9], s: [2, 6, 1.8], c: '#e9be3a' }, { p: [0, rock + 50.8, z + 9], s: [1.2, 1.4, 1.2], c: '#e9be3a' })
    streetLife(out, 'paris', -24, 24, 14, 981)
    return out
  }, [])
  const people = usePeople('bonne-mere', [
    { p: [2, 0.1, 6], ry: Math.PI, pose: 'film' },
    { p: [-5, 0.1, 10], ry: 0.4, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Vieux-Port: the quai des Belges, the fishermen's stalls of the morning, Foster's mirror canopy (« l'Ombrière », 46 × 22 m of polished steel), the boats moored in rows, the forts at the harbour's mouth far off. */
export function VieuxPort({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.14)
  const mirror = useMemo(() => new THREE.MeshPhongMaterial({ color: '#d7dde2', shininess: 120, specular: new THREE.Color('#ffffff') }), [])
  const at = useMemo(() => {
    const out: At[] = []
    const z = -16
    // The quay and the water.
    out.push({ p: [0, 0.3, z + 8], s: [70, 0.6, 16], c: '#cfc6b2' }, { p: [0, 0.05, z - 30], s: [90, 0.1, 60], c: '#2f6f8f' })
    // The boats in rows along the pontoons.
    const r = seeded(29)
    for (let row = 0; row < 3; row++) {
      out.push({ p: [-10 + row * 18, 0.3, z - 20], s: [1.4, 0.3, 34], c: '#9a8f84' })
      for (let i = 0; i < 7; i++)
        for (const s of [-1, 1]) {
          const x = -10 + row * 18 + s * 3.4
          const zz = z - 6 - i * 4.6
          out.push({ p: [x, 0.6, zz], s: [4.4, 1, 1.8], c: r() < 0.5 ? '#ffffff' : '#e9ecef' }, { p: [x, 1.3, zz], s: [1.6, 0.6, 1.2], c: '#dee2e6' })
          if (r() < 0.6) out.push({ p: [x, 5, zz], s: [0.12, 8, 0.12], c: '#adb5bd' })
        }
    }
    // The fishermen's stalls on the quay.
    for (let i = 0; i < 4; i++) out.push({ p: [-18 + i * 4, 0.9, z + 4], s: [2.4, 0.9, 1.4], c: '#3b5f8a' }, { p: [-18 + i * 4, 1.4, z + 4], s: [2.2, 0.1, 1.2], c: '#dbe4ec' })
    // The canopy's four thin columns.
    for (const x of [-21, 21]) for (const dz of [-9, 9]) out.push({ p: [x + 10, 3, z + 8 + dz * 0.6], s: [0.4, 6, 0.4], c: '#adb5bd' })
    streetLife(out, 'paris', -30, 30, 18, 991)
    return out
  }, [])
  const people = usePeople('vieux-port', [
    { p: [-17, 0.6, -10], ry: Math.PI, pose: 'pay' },
    { p: [-13, 0.6, -10], ry: 0, pose: 'rant' },
    { p: [10, 0.6, -6], ry: 0, pose: 'film' },
    { p: [4, 0.6, -4], ry: 2.6, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <mesh position={[10, 6.2, -8]} material={mirror}>
        <boxGeometry args={[46, 0.3, 22]} />
      </mesh>
      <People list={people} />
    </group>
  )
}

/** Notre-Dame de Fourvière (1896): the white basilica on its hill over Lyon, its four octagonal towers at the corners, the golden Virgin of the chapel's bell tower beside it. */
export function Fourviere({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.2)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -30
    const W = '#ede8dc'
    const hill = 14
    out.push({ p: [0, hill / 2, z], s: [80, hill, 70], c: '#6e8f55' })
    out.push({ p: [0, hill + 14, z], s: [32, 28, 56], c: W })
    for (let i = 0; i < 4; i++) out.push({ p: [0, hill + 28.6 + i, z], s: [32 - i * 7, 1, 56], c: '#c9c1ae' })
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        octo(out, [sx * 16, hill + 22, z + sz * 26], 8, 44, W, '#e2dccd')
        out.push({ p: [sx * 16, hill + 45, z + sz * 26], s: [8.4, 1.2, 8.4], c: '#c9c1ae' })
        for (let k = 0; k < 4; k++) out.push({ p: [sx * 16 + (k % 2 ? 0 : 4.1) * (k < 2 ? 1 : -1), hill + 47, z + sz * 26 + (k % 2 ? 4.1 : 0) * (k < 2 ? 1 : -1)], s: [0.8, 3, 0.8], c: W })
      }
    // The porch's columns and pediment.
    for (let k = 0; k < 6; k++) out.push({ p: [-10 + k * 4, hill + 8, z + 29], s: [1.6, 16, 1.6], c: '#d6cfc0' })
    out.push({ p: [0, hill + 17, z + 29], s: [26, 2, 3], c: '#d6cfc0' })
    // The chapel's bell tower and the golden Virgin.
    out.push({ p: [-30, hill + 15, z - 10], s: [7, 30, 7], c: W })
    dome(out, [-30, hill + 30, z - 10], 3.6, 4, '#c9c1ae')
    out.push({ p: [-30, hill + 36, z - 10], s: [1.6, 4, 1.4], c: '#e9be3a' })
    streetLife(out, 'paris', -30, 30, 10, 1001)
    return out
  }, [])
  const people = usePeople('fourviere', [
    { p: [3, 0.1, 4], ry: Math.PI, pose: 'film' },
    { p: [-5, 0.1, 8], ry: 0.3, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Capitole of Toulouse (1750): the long front of pink brick and white stone, its eight columns of pink marble, the eight flags on the balustrade; the great square before it with the Occitan cross. */
export function CapitoleToulouse({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.16)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -20
    out.push({ p: [0, 11, z], s: [128, 22, 18], c: '#c8705a' })
    for (let k = 0; k < 30; k++) for (const y of [5, 13]) out.push({ p: [-60 + k * 4.1, y, z + 9.05], s: [1.6, 3.6, 0.1], c: '#3b4a5a' })
    out.push({ p: [0, 12, z + 2], s: [36, 24, 18], c: '#e9e1cf' })
    for (let k = 0; k < 8; k++) out.push({ p: [-14 + k * 4, 13, z + 11.4], s: [1.6, 18, 1.6], c: '#d77c7c' })
    out.push({ p: [0, 23.5, z + 11], s: [36, 2, 2], c: '#e9e1cf' }, { p: [0, 25.5, z + 2], s: [38, 1.4, 18], c: '#e9e1cf' })
    for (let k = 0; k < 8; k++) out.push({ p: [-14 + k * 4, 28.5, z + 10], s: [0.15, 5, 0.15], c: '#ddd' }, { p: [-14 + k * 4 + 0.7, 30, z + 10], s: [1.3, 0.9, 0.04], c: k % 2 ? '#e03131' : '#f2c230' })
    out.push({ p: [0, 0.05, z + 45], s: [110, 0.1, 64], c: '#d6c8b0' })
    // The Occitan cross inlaid in the square.
    out.push({ p: [0, 0.12, z + 45], s: [18, 0.04, 3], c: '#c9a24a' }, { p: [0, 0.12, z + 45], s: [3, 0.04, 18], c: '#c9a24a' })
    for (const [x, zz] of [
      [-6, -6],
      [6, -6],
      [-6, 6],
      [6, 6],
    ])
      out.push({ p: [x, 0.12, z + 45 + zz], s: [1.6, 0.04, 1.6], c: '#c9a24a' })
    streetLife(out, 'paris', -50, 50, 12, 1011)
    return out
  }, [])
  const people = usePeople('capitole', [
    { p: [2, 0.1, 18], ry: Math.PI, pose: 'film' },
    { p: [-8, 0.1, 22], ry: 0.4, pose: 'walk' },
    { p: [10, 0.1, 26], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The place de la Bourse (1755) and the miroir d'eau (2006): the royal façades in a U on the Garonne, the fountain of the Three Graces, and before them the great shallow mirror of water on the quay. */
export function MiroirEau({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.18)
  const water = useMemo(() => new THREE.MeshPhongMaterial({ color: '#9fb8c8', shininess: 140, specular: new THREE.Color('#ffffff'), transparent: true, opacity: 0.85 }), [])
  const at = useMemo(() => {
    const out: At[] = []
    const z = -50
    const S = '#e9dfc7'
    out.push({ p: [0, 10, z], s: [80, 20, 16], c: S })
    for (const s of [-1, 1]) out.push({ p: [s * 46, 10, z + 20], s: [16, 20, 48], c: S })
    for (const [x, zz, w, d] of [
      [0, z, 80, 16],
      [-46, z + 20, 16, 48],
      [46, z + 20, 16, 48],
    ])
      out.push({ p: [x, 21.5, zz], s: [w, 3, d - 4], c: '#4f5862' })
    for (let k = 0; k < 18; k++) for (const y of [5, 13]) out.push({ p: [-36 + k * 4.2, y, z + 8.05], s: [1.6, 4, 0.1], c: '#3b4a5a' })
    // The fountain of the Three Graces.
    octo(out, [0, 0.5, z + 26], 10, 1, '#bdb6a6')
    out.push({ p: [0, 3, z + 26], s: [1.6, 4, 1.6], c: '#5c636a' }, { p: [0, 5.6, z + 26], s: [2.4, 1.6, 2.4], c: '#3f6f5f' })
    // The quay round the mirror.
    out.push({ p: [0, 0.04, z + 66], s: [130, 0.08, 46], c: '#c8c3b8' })
    streetLife(out, 'paris', -40, 40, 92, 1021)
    return out
  }, [])
  const people = usePeople('miroir-eau', [
    { p: [2, 0.2, 14], ry: Math.PI, pose: 'walk' },
    { p: [-6, 0.2, 18], ry: 0.4, pose: 'film' },
    { p: [9, 0.2, 10], ry: 2.6, pose: 'run' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <mesh position={[0, 0.12, 16]} material={water}>
        <boxGeometry args={[110, 0.04, 40]} />
      </mesh>
      <People list={people} />
    </group>
  )
}

/** The Grand-Place of Lille: the column of the Goddess (1845) in the middle, the Flemish gables round it, the Vieille Bourse's ornate front, the belfry of the Chamber of Commerce (76 m) and its clock. */
export function GrandPlaceLille({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.16)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -10
    out.push({ p: [0, 0.05, z], s: [80, 0.1, 60], c: '#bfb6a5' })
    // The Goddess on her column.
    octo(out, [0, 1, z], 5, 2, '#bdb6a6')
    out.push({ p: [0, 10, z], s: [1.6, 16, 1.6], c: '#d6cfc0' }, { p: [0, 18.6, z], s: [1.3, 2.4, 1.1], c: '#c9a24a' })
    // The fronts round the square: stepped Flemish gables of red brick and white stone.
    const r = seeded(59)
    for (let i = 0; i < 10; i++) {
      const x = -36 + i * 8
      const h = 14 + r() * 5
      out.push({ p: [x, h / 2, z - 32], s: [7.6, h, 8], c: r() < 0.5 ? '#b5583f' : '#c8705a' })
      for (let k = 0; k < 3; k++) out.push({ p: [x, h + 0.75 + k * 1.5, z - 32], s: [6 - k * 2, 1.5, 7], c: '#e9dfc7' })
      for (const y of [4, 8, 12]) out.push({ p: [x, y, z - 27.95], s: [2, 2.4, 0.1], c: '#3b4a5a' })
    }
    // The belfry behind, its clock, its crown.
    out.push({ p: [34, 30, z - 44], s: [10, 60, 10], c: '#b5583f' })
    clockFace(out, [34, 50, z - 38.9], 2, '#c9a24a')
    octo(out, [34, 64, z - 44], 8, 8, '#e9dfc7')
    spire(out, [34, 68, z - 44], 6, 10, 4, '#5c7a6a', '#4c6a5a')
    streetLife(out, 'paris', -30, 30, 22, 1031)
    return out
  }, [])
  const people = usePeople('grand-place-lille', [
    { p: [3, 0.1, 4], ry: Math.PI, pose: 'snack' },
    { p: [-6, 0.1, 8], ry: 0.4, pose: 'walk' },
    { p: [8, 0.1, 2], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The promenade des Anglais: the wide walk along the Baie des Anges, its famous blue chairs, the palms, the pebble beach and the blue sea; the Negresco's pink dome far along. */
export function PromenadeAnglais({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.14)
  const at = useMemo(() => {
    const out: At[] = []
    // The walk, its rail, the pebbles, the sea.
    out.push({ p: [0, 0.1, -4], s: [120, 0.2, 10], c: '#e2ddd2' }, { p: [0, 0.6, -9], s: [120, 0.12, 0.12], c: '#e9ecef' })
    out.push({ p: [0, -0.2, -16], s: [120, 0.3, 14], c: '#bdb6a6' }, { p: [0, -0.3, -50], s: [140, 0.2, 54], c: '#2b7fb8' })
    const r = seeded(37)
    for (let i = 0; i < 16; i++) {
      const x = -56 + i * 7.4
      // The blue chairs, turned to the sea.
      out.push({ p: [x, 0.45, -7], s: [0.6, 0.08, 0.6], c: '#4dabf7' }, { p: [x, 0.8, -7.3], s: [0.6, 0.6, 0.08], c: '#4dabf7' })
      if (i % 2 === 0) out.push({ p: [x + 3, 3.5, -1], s: [0.5, 7, 0.5], c: '#8a6a3c' }, ...[0, 1, 2, 3].map((k) => ({ p: [x + 3 + (k % 2 ? 1.2 : -1.2), 7.2, -1 + (k < 2 ? 1.2 : -1.2)] as [number, number, number], s: [2.6, 0.3, 0.8] as [number, number, number], ry: k * 0.8, c: r() < 0.5 ? '#3c7a36' : '#4c8a3a' })))
    }
    // The Negresco's dome, far along.
    out.push({ p: [50, 14, 14], s: [30, 28, 16], c: '#f3ecdc' })
    dome(out, [38, 28, 14], 5, 5, '#f783ac', '#e64980', 1.2)
    streetLife(out, 'paris', -50, 50, 4, 1041)
    return out
  }, [])
  const people = usePeople('promenade-anglais', [
    { p: [-20, 0.2, -7], ry: Math.PI, pose: 'sit' },
    { p: [6, 0.2, -3], ry: Math.PI / 2, pose: 'run' },
    { p: [-4, 0.2, -2], ry: -Math.PI / 2, pose: 'walk' },
    { p: [16, 0.2, -4], ry: 0.4, pose: 'film' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The cathedral of Strasbourg (1439): the pink sandstone of the Vosges, the lace of its west front, the great rose, its one spire of 142 m (the tallest building in the world for two centuries); the square and its half-timbered houses. */
export function CathedraleStrasbourg({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.16)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -30
    const P = '#b4746a'
    const P2 = '#a3655c'
    out.push({ p: [0, 20, z - 50], s: [40, 40, 90], c: P2 })
    for (let i = 0; i < 4; i++) out.push({ p: [0, 40.6 + i * 1.6, z - 50], s: [40 - i * 9, 1.6, 90], c: '#6d4a3e' })
    // The west front, its lace of thin uprights, the portals, the rose.
    out.push({ p: [0, 33, z], s: [50, 66, 8], c: P })
    for (let k = 0; k < 24; k++) out.push({ p: [-23 + k * 2, 30, z + 4.1], s: [0.3, 50, 0.3], c: P2 })
    for (const x of [-14, 0, 14]) out.push({ p: [x, 7, z + 4.2], s: [7, 14, 0.4], c: '#3b2a24' })
    disc(out, [0, 30, z + 4.3], 7, '#8a4a40', 9, 0.2)
    disc(out, [0, 30, z + 4.45], 5.6, '#3b5f8a', 9, 0.1)
    // The north tower and its spire, the stub of the south one.
    out.push({ p: [-14, 76, z], s: [14, 20, 10], c: P })
    octo(out, [-14, 92, z], 10, 12, P, P2)
    spire(out, [-14, 98, z], 9, 44, 12, P, P2)
    out.push({ p: [14, 69, z], s: [14, 6, 10], c: P })
    // The square, its half-timbered houses (the Maison Kammerzell).
    out.push({ p: [0, 0.05, z + 28], s: [60, 0.1, 40], c: '#c8c0ad' })
    for (let i = 0; i < 5; i++) {
      const x = -28 + i * 14
      out.push({ p: [x, 8, z + 52], s: [12, 16, 8], c: '#efe6d2' })
      for (let k = 0; k < 4; k++) out.push({ p: [x - 4.5 + k * 3, 8, z + 47.95], s: [0.4, 16, 0.1], c: '#6b4a2a' })
      for (const y of [5, 10]) out.push({ p: [x, y, z + 47.95], s: [12, 0.4, 0.1], c: '#6b4a2a' })
      out.push({ p: [x, 17.5, z + 52], s: [12, 3, 6], c: '#9c4a36' }, { p: [x, 20, z + 52], s: [8, 2, 3], c: '#9c4a36' })
    }
    streetLife(out, 'paris', -30, 30, 14, 1051)
    return out
  }, [])
  const people = usePeople('cathedrale-strasbourg', [
    { p: [3, 0.1, 6], ry: Math.PI, pose: 'film' },
    { p: [-6, 0.1, 12], ry: 0.4, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The château des ducs de Bretagne (15th c.): the ramparts of pale tufa and granite and their round towers, the moat in grass, the drawbridge, the white palace's dormers inside. */
export function ChateauNantes({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.14)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -40
    const G = '#d9d2c0'
    out.push({ p: [0, 0.05, z], s: [110, 0.1, 90], c: '#6aa84f' })
    // The walls round the court, the round towers at the corners and along.
    for (const [x, zz, w, d] of [
      [0, z + 30, 80, 4],
      [0, z - 30, 80, 4],
      [-40, z, 4, 60],
      [40, z, 4, 60],
    ])
      out.push({ p: [x, 8, zz], s: [w, 16, d], c: G }, { p: [x, 16.6, zz], s: [w + 0.6, 1.2, d + 0.6], c: '#c9c1ae' })
    for (const [x, zz] of [
      [-40, z + 30],
      [40, z + 30],
      [-40, z - 30],
      [40, z - 30],
      [-12, z + 30],
      [12, z + 30],
    ]) {
      octo(out, [x, 10, zz], 10, 20, G, '#cfc8b5')
      dome(out, [x, 20, zz], 5.4, 3, '#4f5862', '#424a53', 1.4)
    }
    // The gate and its drawbridge, the palace inside.
    out.push({ p: [0, 4, z + 32.1], s: [5, 8, 0.2], c: '#3b2a24' }, { p: [0, 0.4, z + 37], s: [5, 0.3, 8], c: '#8a6a3c' })
    out.push({ p: [0, 10, z - 8], s: [50, 20, 14], c: '#f3efe6' })
    for (let k = 0; k < 6; k++) out.push({ p: [-20 + k * 8, 22, z - 1], s: [2.4, 3.6, 2], c: '#f3efe6' }, { p: [-20 + k * 8, 24.6, z - 1], s: [2.8, 1.4, 2.4], c: '#4f5862' })
    out.push({ p: [0, 21.5, z - 8], s: [50, 3, 12], c: '#4f5862' })
    streetLife(out, 'paris', -40, 40, 12, 1061)
    return out
  }, [])
  const people = usePeople('chateau-nantes', [
    { p: [2, 0.1, 6], ry: Math.PI, pose: 'walk' },
    { p: [-6, 0.1, 10], ry: 0.4, pose: 'film' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Machines de l'île's grand éléphant (12 m tall, 48 tonnes of wood and steel), walking out of its hall with its passengers on its back; the hall's metal sheds. */
export function ElephantNantes({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.14)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -14
    const W = '#8a6a48'
    const S = '#5c5f66'
    // The legs, the body, the head and its trunk raised, the ears, the platform on its back and its rail.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push({ p: [sx * 2.6, 2.8, z + sz * 4], s: [1.8, 5.6, 1.8], c: W }, { p: [sx * 2.6, 0.3, z + sz * 4], s: [2.2, 0.6, 2.2], c: S })
    out.push({ p: [0, 7, z], s: [7, 3.4, 11], c: W }, { p: [0, 7, z], s: [7.2, 0.4, 11.2], c: S })
    out.push({ p: [0, 8, z + 7], s: [4.6, 4, 3.4], c: W })
    for (const s of [-1, 1]) out.push({ p: [s * 3.4, 8.2, z + 6.6], s: [0.4, 4, 3.4], c: '#a08060' })
    for (let k = 0; k < 6; k++) out.push({ p: [0, 7 - k * 0.4 + (k > 3 ? (k - 3) * 1.4 : 0), z + 9 + k * 0.7], s: [1.1 - k * 0.08, 1, 0.9], c: W })
    out.push({ p: [0, 9.1, z - 1], s: [6, 0.3, 8], c: S })
    for (const s of [-1, 1]) out.push({ p: [s * 3, 9.8, z - 1], s: [0.1, 1.2, 8], c: S })
    // The hall behind.
    out.push({ p: [0, 9, z - 30], s: [50, 18, 30], c: '#9aa0a6' }, { p: [0, 18.4, z - 30], s: [50, 1, 30], c: '#6c7480' })
    out.push({ p: [0, 0.05, z + 6], s: [60, 0.1, 40], c: '#bdb6a6' })
    streetLife(out, 'paris', -28, 28, 16, 1071)
    return out
  }, [])
  const people = usePeople('elephant-nantes', [
    { p: [1, 9.3, -15], ry: 0, pose: 'cheer' },
    { p: [-1, 9.3, -13], ry: 0, pose: 'film' },
    { p: [6, 0.1, 2], ry: 2.6, pose: 'film' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

