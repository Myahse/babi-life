import { useMemo } from 'react'
import { Blocks } from './ruePrincesse'
import type { At } from './shoreline'
import { seeded } from './kit3d'
import { People, usePeople } from './villeKit'
import { clockFace, dome, octo, ring, spire, streetLife, useBlocks } from './paysKit'

// Europe's landmarks in blocks (the update « pays-europe », backend world/europe.go), at their real size where
// known, proportions from photographs, the details the game's: Brussels' Atomium, its town hall on the
// Grand-Place and Matonge's street at the Porte de Namur; London's Big Ben, Tower Bridge and Peckham's Rye Lane;
// Berlin's Brandenburg Gate and TV tower; Rome's Colosseum; Barcelona's Sagrada Família; Lisbon's Belém Tower;
// Geneva's Jet d'Eau; Moscow's St Basil's; Athens' Parthenon. Frames: +z the street.

type Props = { night: boolean }
const STONE = '#d9cfb8'
const STONE_D = '#bfb49b'
const SLATE = '#4a5560'

/** The Atomium (1958, 102 m): nine steel spheres of 18 m, a cube standing on a corner, joined by tubes. */
function Atomium({ night }: Props) {
  const mat = useBlocks(night, '#dbe8ff', 0.25)
  const at = useMemo(() => {
    const out: At[] = []
    const s = 22 // the cube's half-diagonal scale
    const ball = (x: number, y: number, z: number) => {
      dome(out, [x, y, z], 9, 5, '#c9d1d9', '#aeb8c2')
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * (Math.PI / 2)
        const a2 = ((i + 1) / 5) * (Math.PI / 2)
        const w = 18 * Math.cos((a + a2) / 2)
        const h = 9 * (Math.sin(a2) - Math.sin(a))
        octo(out, [x, y - 9 * Math.sin(a) - h / 2, z], w, h + 0.02, i % 2 ? '#aeb8c2' : '#c9d1d9')
      }
      for (let k = 0; k < 8; k++) out.push({ p: [x + Math.sin((k / 8) * Math.PI * 2) * 8.4, y, z + Math.cos((k / 8) * Math.PI * 2) * 8.4], s: [1.2, 1.2, 1.2], ry: (k / 8) * Math.PI * 2, c: '#7d8a96' })
    }
    const top = 92
    const mid = top / 2 + 5
    const pts: [number, number, number][] = [
      [0, top, 0],
      [0, 10, 0],
      [s, mid + 18, 0],
      [-s, mid + 18, 0],
      [0, mid + 18, s],
      [0, mid - 18, -s],
      [s, mid - 18, 0],
      [-s, mid - 18, 0],
      [0, mid, 0],
    ]
    for (const [x, y, z] of pts) ball(x, y, z)
    // The tubes (the escalators inside): from the middle sphere to each, and the central lift shaft.
    for (const [x, y, z] of pts) {
      if (x === 0 && z === 0) continue
      const n = 6
      for (let i = 1; i < n; i++) out.push({ p: [(x * i) / n, mid + ((y - mid) * i) / n, (z * i) / n], s: [3, 3, 3], c: '#9aa5b1' })
    }
    out.push({ p: [0, mid / 2 + 2, 0], s: [3.4, mid - 4, 3.4], c: '#9aa5b1' }, { p: [0, (mid + top) / 2, 0], s: [3, top - mid - 16, 3], c: '#9aa5b1' })
    // The three legs under the low spheres, the forecourt.
    for (const [x, z] of [[14, 10], [-14, 10], [0, -16]] as const) out.push({ p: [x * 0.7, 14, z * 0.7], s: [1.6, 28, 1.6], c: '#7d8a96' })
    out.push({ p: [0, 0.05, 30], s: [60, 0.1, 34], c: '#cfc9be' })
    streetLife(out, 'europe', -26, 26, 44, 1958)
    return out
  }, [])
  const people = usePeople('atomium', [
    { p: [4, 0.1, 26], ry: Math.PI, pose: 'film' },
    { p: [-6, 0.1, 30], ry: 0.3, pose: 'walk' },
    { p: [9, 0.1, 34], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Hôtel de ville de Bruxelles on the Grand-Place: the Gothic front, its arcade, rows of statues, the 96 m tower and Saint Michael at its top; the guild houses' gilded gables round the square. */
function HotelVilleBruxelles({ night }: Props) {
  const mat = useBlocks(night, '#ffe6b0', 0.18)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -14
    out.push({ p: [0, 12, z], s: [64, 24, 16], c: STONE })
    for (let i = 0; i < 16; i++) out.push({ p: [-30 + i * 4, 3.5, z + 8.2], s: [2.4, 7, 0.3], c: '#3b3328' })
    for (let row = 0; row < 3; row++) for (let i = 0; i < 20; i++) out.push({ p: [-30 + i * 3.15, 10 + row * 4.4, z + 8.1], s: [1.2, 2.6, 0.3], c: row === 1 ? '#3b4f6b' : STONE_D })
    for (let i = 0; i < 4; i++) out.push({ p: [0, 25 + i * 1.6, z], s: [62 - i * 10, 1.6, 15], c: SLATE })
    for (let i = 0; i < 12; i++) spire(out, [-30 + i * 5.4, 24, z + 8], 0.8, 4, 3, STONE_D)
    // The tower: square, then the octagons narrowing, the spire, the archangel.
    out.push({ p: [0, 30, z + 2], s: [10, 60, 10], c: STONE })
    for (let f = 0; f < 6; f++) out.push({ p: [0, 30 + f * 5, z + 7.1], s: [2, 3.4, 0.2], c: '#3b4f6b' })
    octo(out, [0, 66, z + 2], 8.5, 12, STONE, STONE_D)
    octo(out, [0, 76, z + 2], 6.5, 8, STONE, STONE_D)
    spire(out, [0, 80, z + 2], 4.4, 12, 6, STONE_D, STONE)
    out.push({ p: [0, 93.5, z + 2], s: [0.8, 2.6, 0.6], c: '#d4a017' }, { p: [0, 94.2, z + 2], s: [2.2, 0.4, 0.3], c: '#d4a017' })
    clockFace(out, [0, 52, z + 7.2], 1.6)
    // The Grand-Place: the cobbles, the guild houses' tall gables with their gold.
    out.push({ p: [0, 0.05, 22], s: [70, 0.1, 50], c: '#a9a196' })
    const r = seeded(1695)
    for (const side of [-1, 1])
      for (let i = 0; i < 5; i++) {
        const x = side * 40
        const zz = -2 + i * 9
        const h = 16 + r() * 8
        out.push({ p: [x, h / 2, zz], s: [10, h, 8.4], ry: 0, c: ['#5b4a3a', '#7a6247', '#3e3a36', '#8c7a5c'][i % 4] })
        for (let k = 0; k < 4; k++) out.push({ p: [x, h + 1 + k * 1.4, zz], s: [10 - k * 2.4, 1.4, 8.4], c: k % 2 ? '#d4a017' : '#5b4a3a' })
        for (let fl = 0; fl < 3; fl++) out.push({ p: [x - side * 5.05, 4 + fl * 4.2, zz], s: [0.2, 2.4, 5], c: '#c9b26a' })
      }
    return out
  }, [])
  const people = usePeople('grand-place', [
    { p: [3, 0.1, 10], ry: Math.PI, pose: 'film' },
    { p: [-8, 0.1, 18], ry: 0.5, pose: 'walk' },
    { p: [12, 0.1, 24], ry: 2.2, pose: 'talk' },
    { p: [-2, 0.1, 28], ry: 3, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** A street of shops along +z: fronts of the given colours, awnings, the goods out (cloth, pots, crates), people shopping. */
function shopRow(out: At[], seed: number, fronts: string[], awnings: string[], goods: string[], len = 64) {
  const r = seeded(seed)
  for (let x = -len / 2; x < len / 2; x += 8) {
    const h = 10 + Math.floor(r() * 3) * 3
    out.push({ p: [x + 4, h / 2, -6], s: [7.8, h, 10], c: fronts[Math.floor(r() * fronts.length)] })
    for (let fl = 1; fl < h / 3.2; fl++) for (const dx of [-2, 2]) out.push({ p: [x + 4 + dx, 1.8 + fl * 3.1, -0.95], s: [1.4, 1.6, 0.1], c: '#3d5a80' })
    out.push({ p: [x + 4, 1.6, -0.95], s: [6, 2.8, 0.1], c: '#2b2b2b' })
    out.push({ p: [x + 4, 3.4, 0.2], s: [7, 0.2, 2.4], c: awnings[Math.floor(r() * awnings.length)] })
    for (let k = 0; k < 3; k++) if (r() < 0.7) out.push({ p: [x + 1.6 + k * 2.4, 0.5 + r() * 0.4, 1], s: [1.4, 0.9 + r() * 0.8, 0.8], c: goods[Math.floor(r() * goods.length)] })
  }
  out.push({ p: [0, 0.05, 6], s: [len + 8, 0.1, 8], c: '#a6a39c' })
}

/** Matonge at the Porte de Namur: the shops of the chaussée de Wavre and the galerie — wax prints hung out, hair salons, African grocers, the restaurants' signs — and the people. */
function Matonge({ night }: Props) {
  const mat = useBlocks(night, '#ffd9a0', 0.2)
  const at = useMemo(() => {
    const out: At[] = []
    shopRow(out, 243, ['#c9b79c', '#b5654a', '#e3d3ef', '#f4b89a', '#d9d2c3', '#8b4a3a'], ['#f08c00', '#2f9e44', '#c92a2a', '#1c7ed6', '#fab005'], ['#f08c00', '#2f9e44', '#c92a2a', '#7048e8', '#fab005', '#e64980'])
    // The galerie's entrance (Galerie d'Ixelles), its glass roof.
    out.push({ p: [0, 4, -0.9], s: [6, 8, 0.2], c: '#1f2a36' }, { p: [0, 9, -2], s: [7, 1, 3], c: '#e9ecef' })
    // Wax hung out to sell, the pagnes on their rails.
    const r = seeded(77)
    for (let i = 0; i < 10; i++) out.push({ p: [-28 + i * 6, 2.2, 1.6], s: [0.1, 2.2, 1.4], c: ['#f08c00', '#2f9e44', '#c92a2a', '#7048e8', '#fab005'][Math.floor(r() * 5)] })
    streetLife(out, 'europe', -30, 30, 9, 1960)
    return out
  }, [])
  const people = usePeople('matonge', [
    { p: [2, 0.1, 4], ry: 0, pose: 'talk', dress: { outfit: 'pagne', outfitColor: '#f08c00' } },
    { p: [3.4, 0.1, 4.6], ry: Math.PI, pose: 'talk' },
    { p: [-10, 0.1, 5], ry: 1.2, pose: 'walk', dress: { outfit: 'boubou', outfitColor: '#1c7ed6' } },
    { p: [14, 0.1, 3], ry: -1, pose: 'phone' },
    { p: [-20, 0.1, 6], ry: 2, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** Rye Lane, Peckham: the fishmongers and the African and Caribbean grocers, the barbers, the station's arch. */
function RyeLane({ night }: Props) {
  const mat = useBlocks(night, '#ffd9a0', 0.2)
  const at = useMemo(() => {
    const out: At[] = []
    shopRow(out, 1865, ['#8b4a3a', '#a0553f', '#7a3b2e', '#c4bba8', '#5a4a42'], ['#1c7ed6', '#c92a2a', '#2f9e44', '#fab005'], ['#e8590c', '#2f9e44', '#f8f9fa', '#fab005', '#8a6a3c'])
    // The railway bridge across the lane, brick arches.
    out.push({ p: [0, 7, 10], s: [80, 2.4, 6], c: '#6e3b2e' })
    for (let x = -36; x <= 36; x += 12) out.push({ p: [x, 3, 10], s: [2.4, 6, 6], c: '#7a3b2e' })
    streetLife(out, 'europe', -30, 30, 16, 2000)
    return out
  }, [])
  const people = usePeople('rye-lane', [
    { p: [-4, 0.1, 4], ry: 0.3, pose: 'walk' },
    { p: [6, 0.1, 5], ry: Math.PI, pose: 'talk' },
    { p: [7.2, 0.1, 4.2], ry: 0, pose: 'talk' },
    { p: [18, 0.1, 3], ry: -1.4, pose: 'phone' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** Big Ben (the Elizabeth Tower, 96 m): the yellow stone shaft, the four clock faces, the belfry, the slate spire; a wing of the palace of Westminster beside. */
function BigBen({ night }: Props) {
  const mat = useBlocks(night, '#ffe8b0', 0.2)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -10
    const Y = '#d8c48f'
    const Yd = '#b9a46e'
    out.push({ p: [0, 30, z], s: [12, 60, 12], c: Y })
    for (let f = 0; f < 12; f++) for (const dx of [-3, 0, 3]) out.push({ p: [dx, 5 + f * 4.6, z + 6.05], s: [1, 3, 0.1], c: Yd })
    out.push({ p: [0, 61, z], s: [13, 2, 13], c: Yd })
    out.push({ p: [0, 66, z], s: [12.6, 8, 12.6], c: Y })
    clockFace(out, [0, 66, z + 6.4], 3.4, '#c9a24a')
    for (const s of [-1, 1]) {
      // (the side faces: dials as flat plates)
      out.push({ p: [s * 6.4, 66, z], s: [0.12, 6.8, 6.8], c: '#f8f9fa' })
      out.push({ p: [s * 6.5, 67, z], s: [0.1, 2.8, 0.4], c: '#111' })
    }
    out.push({ p: [0, 66, z - 6.4], s: [6.8, 6.8, 0.12], c: '#f8f9fa' })
    out.push({ p: [0, 71, z], s: [13.2, 1.6, 13.2], c: Yd })
    out.push({ p: [0, 75, z], s: [11, 6, 11], c: Y })
    for (let i = 0; i < 3; i++) out.push({ p: [-3 + i * 3, 75, z + 5.55], s: [1.4, 4, 0.1], c: '#3a3a3a' })
    spire(out, [0, 78, z], 10, 16, 8, SLATE, '#3a4550')
    out.push({ p: [0, 95, z], s: [0.5, 3, 0.5], c: '#d4a017' })
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) spire(out, [dx * 5.2, 78, z + dz * 5.2], 1.4, 6, 4, Y, Yd)
    // A wing of the palace, its pinnacles.
    out.push({ p: [-36, 11, z - 4], s: [56, 22, 16], c: Y })
    for (let i = 0; i < 14; i++) {
      out.push({ p: [-62 + i * 4, 10, z + 4.1], s: [1.4, 12, 0.1], c: '#5d6b78' })
      spire(out, [-62 + i * 4, 22, z + 4], 0.9, 5, 3, Yd)
    }
    out.push({ p: [-36, 23, z - 4], s: [56, 2, 14], c: SLATE })
    out.push({ p: [-14, 0.05, 16], s: [70, 0.1, 18], c: '#9a9690' })
    streetLife(out, 'europe', -40, 10, 22, 1859)
    return out
  }, [])
  const people = usePeople('big-ben', [
    { p: [2, 0.1, 12], ry: Math.PI, pose: 'film' },
    { p: [-8, 0.1, 14], ry: 0.4, pose: 'walk' },
    { p: [6, 0.1, 18], ry: 2.4, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** Tower Bridge (1894): the two Gothic towers on their piers, the blue walkways high between, the bascules, the blue chains of the side spans. */
function TowerBridge({ night }: Props) {
  const mat = useBlocks(night, '#fff1d0', 0.2)
  const at = useMemo(() => {
    const out: At[] = []
    const T = '#c9c2ae'
    const B = '#3f7fbf'
    out.push({ p: [0, -1, 0], s: [260, 0.4, 70], c: '#3d5a6a' }) // the Thames
    for (const s of [-1, 1]) {
      const x = s * 38
      out.push({ p: [x, 2, 0], s: [24, 6, 22], c: '#8a8576' })
      out.push({ p: [x, 30, 0], s: [16, 56, 16], c: T })
      for (let f = 0; f < 6; f++) out.push({ p: [x, 10 + f * 8, 8.05], s: [3, 4.4, 0.1], c: '#3a4550' })
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) spire(out, [x + dx * 7, 58, dz * 7], 2.4, 8, 4, T, '#a39c88')
      spire(out, [x, 58, 0], 9, 12, 6, SLATE, '#3a4550')
      // The side span's chains, curving down to the bank.
      for (let i = 0; i < 28; i++) {
        const t = i / 27
        const y = 8 + 42 * (1 - t) ** 2
        for (const dz of [6, -6]) out.push({ p: [x + s * (8 + t * 70), y, dz], s: [3.2, 1.6, 1.4], c: B })
        if (i % 3 === 1) for (const dz of [6, -6]) out.push({ p: [x + s * (8 + t * 70), (y + 6) / 2, dz], s: [0.3, y - 6, 0.3], c: '#2f5f8f' })
      }
      out.push({ p: [x + s * 48, 6, 0], s: [80, 1.2, 18], c: '#6b6b6b' })
    }
    // The high walkways, the bascules (down: the road across).
    for (const dz of [-5, 5]) out.push({ p: [0, 52, dz], s: [60, 5, 4], c: B })
    out.push({ p: [0, 6, 0], s: [60, 1.2, 18], c: '#6b6b6b' }, { p: [0, 6.7, 0], s: [60, 0.2, 12], c: '#3a3a3a' })
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/** The Brandenburg Gate (1791, 26 m): six pairs of Doric columns, the attic, the Quadriga on top; the Pariser Platz before it. */
function Brandebourg({ night }: Props) {
  const mat = useBlocks(night, '#fff1d6', 0.22)
  const at = useMemo(() => {
    const out: At[] = []
    const S = '#e2d6b8'
    out.push({ p: [0, 0.6, 0], s: [66, 1.2, 14], c: S })
    for (let i = 0; i < 6; i++)
      for (const dz of [-4, 4]) {
        const x = -27.5 + i * 11
        octo(out, [x, 8.7, dz], 2.4, 15, S)
        out.push({ p: [x, 1.6, dz], s: [3.4, 0.8, 3.4], c: S })
      }
    for (const s of [-1, 1]) out.push({ p: [s * 25, 8.7, 0], s: [8, 15, 6], c: '#d6c9a8' })
    out.push({ p: [0, 17.5, 0], s: [66, 2.6, 13], c: S }, { p: [0, 19.4, 0], s: [64, 1.2, 12], c: '#d6c9a8' })
    out.push({ p: [0, 22, 0], s: [40, 4, 10], c: S })
    // The Quadriga: the goddess on her chariot, four horses, in green bronze.
    out.push({ p: [0, 25, 0], s: [6, 2, 3], c: '#4c7a6a' })
    for (let i = 0; i < 4; i++) out.push({ p: [-3 + i * 2, 25.6, 3], s: [1.2, 2.8, 4], c: '#5c8a78' })
    out.push({ p: [0, 28, -0.5], s: [1.2, 4, 1], c: '#4c7a6a' }, { p: [0.8, 30.5, -0.5], s: [0.3, 3, 0.3], c: '#4c7a6a' })
    // The Pariser Platz.
    out.push({ p: [0, 0.05, 30], s: [80, 0.1, 40], c: '#c8c3ba' })
    streetLife(out, 'europe', -36, 36, 46, 1989)
    return out
  }, [])
  const people = usePeople('brandebourg', [
    { p: [3, 0.1, 14], ry: Math.PI, pose: 'film' },
    { p: [-9, 0.1, 18], ry: 0.4, pose: 'walk' },
    { p: [10, 0.1, 22], ry: 2.6, pose: 'talk' },
    { p: [0, 0.1, 2], ry: 0, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Fernsehturm (1969, 368 m): the concrete shaft, the sphere with its panorama ring, the red-and-white mast. */
function Fernsehturm({ night }: Props) {
  const mat = useBlocks(night, '#ffe8c0', 0.3)
  const at = useMemo(() => {
    const out: At[] = []
    octo(out, [0, 6, 0], 18, 12, '#cfd4d8')
    octo(out, [0, 105, 0], 10, 200, '#e9ecef', '#dee2e6')
    dome(out, [0, 214, 0], 16, 6, '#b8c0c8', '#9aa5b1')
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * (Math.PI / 2)
      const a2 = ((i + 1) / 6) * (Math.PI / 2)
      octo(out, [0, 214 - 16 * Math.sin((a + a2) / 2), 0], 32 * Math.cos((a + a2) / 2), 16 * (Math.sin(a2) - Math.sin(a)) + 0.05, i % 2 ? '#9aa5b1' : '#b8c0c8')
    }
    ring(out, [0, 210, 0], 15.6, 24, [3.6, 2.4, 0.3], '#2a3a4a')
    octo(out, [0, 236, 0], 4, 12, '#dee2e6')
    for (let i = 0; i < 12; i++) out.push({ p: [0, 246 + i * 6, 0], s: [1.6 - i * 0.08, 6, 1.6 - i * 0.08], c: i % 2 ? '#c92a2a' : '#f8f9fa' })
    out.push({ p: [0, 0.05, 30], s: [60, 0.1, 40], c: '#c8c3ba' })
    streetLife(out, 'europe', -26, 26, 40, 1969)
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/** The Colosseum (AD 80, 48 m): the oval of four storeys of arches, the outer wall broken on one side down to the second ring. */
function Colisee({ night }: Props) {
  const mat = useBlocks(night, '#ffe0b0', 0.2)
  const at = useMemo(() => {
    const out: At[] = []
    const T = '#cdb48a'
    const Td = '#b39b72'
    const n = 64
    const [A, B] = [94, 78] // the outer oval's axes (half: 47 × 39, in metres ×2)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const x = Math.sin(a) * (A / 2)
      const z = Math.cos(a) * (B / 2)
      const ry = Math.atan2(Math.sin(a) * (B / A), Math.cos(a))
      // The broken side (north-west): only the lower storeys.
      const broken = a > 3.6 && a < 5.6
      const floors = broken ? 2 + Math.round(Math.abs(Math.sin(a * 3))) : 4
      for (let f = 0; f < floors; f++) {
        const h = f === 3 ? 10 : 10.5
        const y = f * 10.5 + h / 2
        out.push({ p: [x, y, z], s: [1.6, h, 2.6], ry, c: f % 2 ? T : Td })
        out.push({ p: [x * 0.965, y, z * 0.965], s: [4.8, h, 1], ry, c: '#7d6a48' })
        if (f < 3) out.push({ p: [x + Math.sin(a + Math.PI / n) * 0.1, y + h / 2 - 1, z + Math.cos(a + Math.PI / n) * 0.1], s: [4.8, 2, 2.6], ry: ry + Math.PI / n, c: T })
      }
      // The inner ring, lower, the seating steps.
      for (let k = 0; k < 4; k++) out.push({ p: [x * (0.86 - k * 0.07), 3 + k * 5, z * (0.86 - k * 0.07)], s: [4.6, 6 + (3 - k) * 4, 4], ry, c: k % 2 ? '#b8a07a' : '#a88f68' })
    }
    // The arena's floor and the hypogeum's walls.
    out.push({ p: [0, 0.3, 0], s: [40, 0.6, 26], c: '#c9a878' })
    for (let i = -3; i <= 3; i++) out.push({ p: [i * 5, 1.2, 0], s: [0.8, 2.4, 22], c: '#9c8460' })
    out.push({ p: [0, 0.05, 60], s: [110, 0.1, 30], c: '#c8c0b0' })
    streetLife(out, 'europe', -50, 50, 72, 80)
    return out
  }, [])
  const people = usePeople('colisee', [
    { p: [3, 0.1, 50], ry: Math.PI, pose: 'film' },
    { p: [-10, 0.1, 54], ry: 0.4, pose: 'walk' },
    { p: [12, 0.1, 56], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Sagrada Família (Gaudí, from 1882): the Nativity front's four bell towers like honeycombs, the tall central towers (the highest 172 m), the cranes still working. */
function Sagrada({ night }: Props) {
  const mat = useBlocks(night, '#ffe6c0', 0.22)
  const at = useMemo(() => {
    const out: At[] = []
    const S = '#c8b48e'
    const Sd = '#a8946e'
    const z = -20
    out.push({ p: [0, 20, z - 30], s: [46, 40, 90], c: Sd })
    for (let i = 0; i < 8; i++) for (const s of [-1, 1]) out.push({ p: [s * 23.1, 22, z - 70 + i * 10], s: [0.1, 18, 3], c: '#3b4f6b' })
    // The Nativity front: its three portals, the four towers (round, tapering, pierced, a mosaic finial).
    out.push({ p: [0, 18, z + 14], s: [50, 36, 4], c: S })
    for (const x of [-14, 0, 14]) out.push({ p: [x, 10, z + 16.1], s: [8, 18, 0.2], c: '#3a2f25' }, { p: [x, 22, z + 16.2], s: [10, 6, 0.4], c: '#6b8f5a' })
    for (const x of [-21, -8, 8, 21]) {
      const h = Math.abs(x) > 10 ? 98 : 107
      for (let i = 0; i < 14; i++) {
        const w = 8 - i * 0.42
        octo(out, [x, 36 + (i * (h - 40)) / 14, z + 14], w, (h - 40) / 14 + 0.05, i % 2 ? S : Sd)
      }
      for (let i = 0; i < 10; i++) out.push({ p: [x, 40 + i * 5, z + 14 + 4.1 - i * 0.2], s: [1, 2, 0.1], c: '#3a2f25' })
      const top = 36 + 13.5 * ((h - 40) / 14)
      out.push({ p: [x, top + 3, z + 14], s: [2.4, 6, 2.4], c: '#e03131' }, { p: [x, top + 6.5, z + 14], s: [3, 2, 3], c: '#fab005' })
    }
    // The central towers: Jesus (with its cross) and the Virgin, the evangelists.
    for (let i = 0; i < 18; i++) octo(out, [0, 40 + i * 7, z - 30], 18 - i * 0.8, 7.05, i % 2 ? '#d9c9a8' : S)
    out.push({ p: [0, 168, z - 30], s: [1.4, 12, 1.4], c: '#f8f9fa' }, { p: [0, 170, z - 30], s: [7, 1.4, 1.4], c: '#f8f9fa' })
    for (const [x, zz] of [[-14, -14], [14, -14], [-14, -46], [14, -46]] as const) for (let i = 0; i < 12; i++) octo(out, [x, 40 + i * 7, z + zz], 8 - i * 0.5, 7.05, i % 2 ? S : Sd)
    // A crane.
    out.push({ p: [30, 70, z - 50], s: [2, 140, 2], c: '#f08c00' }, { p: [10, 139, z - 50], s: [60, 2, 2], c: '#f08c00' })
    out.push({ p: [0, 0.05, 20], s: [80, 0.1, 30], c: '#c8c3ba' })
    streetLife(out, 'europe', -38, 38, 32, 1882)
    return out
  }, [])
  const people = usePeople('sagrada', [
    { p: [2, 0.1, 14], ry: Math.PI, pose: 'film' },
    { p: [-9, 0.1, 18], ry: 0.4, pose: 'walk' },
    { p: [11, 0.1, 20], ry: 2.6, pose: 'film' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Belém Tower (1520, 30 m): the white bastion on the Tagus, its battlements of shields, the four-storey tower, the turrets. */
function TourBelem({ night }: Props) {
  const mat = useBlocks(night, '#fff1d6', 0.2)
  const at = useMemo(() => {
    const out: At[] = []
    const W = '#ece4d2'
    const Wd = '#d6ccb6'
    out.push({ p: [0, -0.8, -10], s: [140, 0.4, 80], c: '#3d6a7a' }) // the Tagus
    octo(out, [0, 4, -14], 22, 8, W, Wd)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      out.push({ p: [Math.sin(a) * 10.4, 8.8, -14 + Math.cos(a) * 10.4], s: [1.6, 1.6, 0.6], ry: a, c: i % 2 ? '#2f6a48' : W })
    }
    out.push({ p: [0, 17, -20], s: [12, 26, 12], c: W })
    for (let f = 0; f < 3; f++) out.push({ p: [0, 12 + f * 6, -13.95], s: [3.4, 3, 0.1], c: '#5a5040' }, { p: [0, 12 + f * 6 - 1.8, -13.6], s: [5, 0.4, 0.8], c: Wd })
    for (let i = 0; i < 8; i++) out.push({ p: [-5.25 + i * 1.5, 30.6, -14], s: [0.9, 1.4, 0.6], c: W })
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
      octo(out, [dx * 6.6, 28, -20 + dz * 6.6], 2.2, 4, W)
      dome(out, [dx * 6.6, 30, -20 + dz * 6.6], 1.2, 3, Wd, W)
    }
    // The walkway from the bank, the lawn.
    out.push({ p: [0, 0.5, 4], s: [6, 1, 20], c: Wd }, { p: [0, 0.05, 28], s: [80, 0.1, 30], c: '#6e9a4f' })
    streetLife(out, 'europe', -30, 30, 38, 1520)
    return out
  }, [])
  const people = usePeople('belem', [
    { p: [2, 0.1, 18], ry: Math.PI, pose: 'film' },
    { p: [-6, 0.1, 22], ry: 0.4, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Jet d'Eau (140 m): the white column of water out of the lake, its spray, the jetty out to it with its lighthouse. */
function JetEau({ night }: Props) {
  const mat = useBlocks(night, '#e8f4ff', 0.35)
  const at = useMemo(() => {
    const out: At[] = []
    out.push({ p: [0, -0.8, -40], s: [200, 0.4, 120], c: '#3b7ea1' })
    const r = seeded(1891)
    for (let i = 0; i < 28; i++) {
      const y = i * 5
      const w = 1.4 + i * 0.05 + (i > 22 ? (i - 22) * 0.6 : 0)
      out.push({ p: [Math.sin(i) * 0.3 + (i > 20 ? (i - 20) * 0.5 : 0), y + 2.5, -60], s: [w, 5.2, w], c: i % 3 ? '#f1f8ff' : '#dbeefc' })
    }
    for (let i = 0; i < 30; i++) out.push({ p: [8 + r() * 10, 2 + r() * 120, -60 + (r() - 0.5) * 8], s: [1.2, 1.2, 1.2], c: '#e7f3fd' })
    out.push({ p: [-6, 0.6, -30], s: [4, 1.2, 60], c: '#bfb49b' })
    out.push({ p: [-6, 4, -58], s: [2, 7, 2], c: '#f8f9fa' }, { p: [-6, 8, -58], s: [2.6, 1, 2.6], c: '#c92a2a' })
    out.push({ p: [0, 0.05, 10], s: [90, 0.1, 18], c: '#c8c3ba' })
    streetLife(out, 'europe', -40, 40, 16, 1951)
    return out
  }, [])
  const people = usePeople('jet-eau', [
    { p: [-6, 1.2, -20], ry: Math.PI, pose: 'film' },
    { p: [-5, 1.2, -8], ry: Math.PI, pose: 'walk' },
    { p: [6, 0.1, 8], ry: 0.4, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** St Basil's Cathedral (1561): the central tent roof, the eight chapels round it under their onion domes, each its colours and stripes. */
function SaintBasile({ night }: Props) {
  const mat = useBlocks(night, '#ffe8c0', 0.25)
  const at = useMemo(() => {
    const out: At[] = []
    const R = '#a33a2a'
    out.push({ p: [0, 5, -20], s: [44, 10, 44], c: R })
    for (let i = 0; i < 12; i++) out.push({ p: [-21 + i * 3.8, 5, 2.05], s: [1.4, 6, 0.1], c: '#f1e3c8' })
    octo(out, [0, 20, -20], 12, 22, R, '#b8472f')
    spire(out, [0, 31, -20], 11, 18, 8, '#e9c46a', '#2a9d8f')
    out.push({ p: [0, 52, -20], s: [1.2, 4, 1.2], c: '#d4a017' })
    const domes: [number, number, string, string][] = [
      [0, -4, '#2a9d8f', '#e9c46a'],
      [0, -36, '#e76f51', '#2a9d8f'],
      [-16, -20, '#e9c46a', '#264653'],
      [16, -20, '#e63946', '#f1faee'],
      [-12, -8, '#2a9d8f', '#f1faee'],
      [12, -8, '#e9c46a', '#e63946'],
      [-12, -32, '#457b9d', '#e9c46a'],
      [12, -32, '#2a9d8f', '#e76f51'],
    ]
    domes.forEach(([x, z, a, b], i) => {
      const big = i < 4
      const h = big ? 20 : 14
      octo(out, [x, 10 + h / 2, z], big ? 7 : 5, h, R, '#b8472f')
      // The onion: swelling then narrowing, striped.
      const w0 = big ? 7 : 5
      for (let k = 0; k < 6; k++) {
        const w = w0 * [1.05, 1.3, 1.35, 1.15, 0.8, 0.4][k]
        octo(out, [x, 10 + h + 1 + k * 1.6, z], w, 1.65, k % 2 ? a : b, k % 2 ? b : a)
      }
      out.push({ p: [x, 10 + h + 11.4, z], s: [0.4, 2.4, 0.4], c: '#d4a017' })
    })
    // Red Square's cobbles.
    out.push({ p: [0, 0.05, 30], s: [90, 0.1, 50], c: '#8f8a84' })
    streetLife(out, 'europe', -36, 36, 50, 1561)
    return out
  }, [])
  const people = usePeople('saint-basile', [
    { p: [3, 0.1, 16], ry: Math.PI, pose: 'film' },
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

/** The Parthenon on the Acropolis (438 BC): the rock and its walls, the temple's peristyle of 8 × 17 columns, what's left of its pediments. */
function Parthenon({ night }: Props) {
  const mat = useBlocks(night, '#ffe8b8', 0.28)
  const at = useMemo(() => {
    const out: At[] = []
    const M = '#e8dcc0'
    const base = 20
    out.push({ p: [0, base / 2, -30], s: [150, base, 90], c: '#a89a80' })
    for (let i = 0; i < 3; i++) out.push({ p: [0, base + 0.5 + i, -30], s: [72 - i * 2, 1, 34 - i * 2], c: M })
    for (let i = 0; i < 8; i++) for (const dz of [-15, 15]) octo(out, [-31.5 + i * 9, base + 13, -30 + dz], 2, 20, M)
    for (let i = 1; i < 16; i++) for (const dx of [-31.5, 31.5]) if (i % 4) octo(out, [dx, base + 13, -30 - 15 + i * 2], 2, 20, M)
    out.push({ p: [0, base + 24.5, -30], s: [68, 3, 32], c: M })
    for (let i = 0; i < 3; i++) out.push({ p: [0, base + 26.6 + i * 1.4, -46 + 0.4], s: [52 - i * 18, 1.4, 1.6], c: M })
    out.push({ p: [0, base + 10, -36], s: [40, 16, 14], c: '#d6c9a8' })
    // The path up, the olive trees.
    for (let i = 0; i < 20; i++) out.push({ p: [-30 + i, (i * base) / 20, 16 - i * 0.6], s: [3, 1, 4], c: '#c9bea6' })
    const r = seeded(438)
    for (let i = 0; i < 8; i++) {
      const x = -40 + i * 11
      out.push({ p: [x, 1.4, 22 + r() * 4], s: [0.6, 2.8, 0.6], c: '#6b5a44' }, { p: [x, 3.6, 22 + r() * 4], s: [3.4, 2, 3.4], c: '#8a9a6a' })
    }
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/** Europe's landmarks, by place (lib: europeLandmarks.ts gives their ground). */
export function EuropeLandmark({ id, night }: { id: string; night: boolean }) {
  switch (id) {
    case 'brux-laeken-atomium':
      return <Atomium night={night} />
    case 'mairie-brux-centre':
      return <HotelVilleBruxelles night={night} />
    case 'brux-matonge-porte-namur':
      return <Matonge night={night} />
    case 'ldn-peckham-rye-lane':
      return <RyeLane night={night} />
    case 'ldn-big-ben':
      return <BigBen night={night} />
    case 'ldn-peckham-tower-bridge':
      return <TowerBridge night={night} />
    case 'ber-brandebourg':
      return <Brandebourg night={night} />
    case 'ber-alexanderplatz':
      return <Fernsehturm night={night} />
    case 'rome-colisee':
      return <Colisee night={night} />
    case 'bcn-eixample-sagrada':
      return <Sagrada night={night} />
    case 'lis-belem-tour':
      return <TourBelem night={night} />
    case 'gva-jet-eau':
      return <JetEau night={night} />
    case 'moscou-saint-basile':
      return <SaintBasile night={night} />
    case 'athenes-acropole':
      return <Parthenon night={night} />
    default:
      return null
  }
}

