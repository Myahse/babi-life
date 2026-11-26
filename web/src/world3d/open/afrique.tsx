import { useMemo } from 'react'
import { Blocks } from './ruePrincesse'
import type { At } from './shoreline'
import { People, Sign, usePeople, useSign } from './villeKit'
import { dome, octo, spire, useBlocks, streetLife, disc } from './paysKit'

// Africa's landmarks (the update « pays-afrique », backend world/afriqueVilles.go), in the game's blocks, each
// mostly one draw call (kit3d.ts, paysKit.tsx), at their real size where it's known:
// - Dakar: the Monument de la Renaissance africaine on its hill of the Mamelles (49 m of bronze);
// - Accra: the Black Star Gate of Independence Square;
// - Lomé: the Monument de l'Indépendance;
// - Cotonou: the Amazone (30 m of bronze on her pedestal); Ouidah: the Porte du Non-Retour on its beach;
// - Agadez: the great mosque's minaret of banco (27 m), bristling with its stakes;
// - Gizeh: the Great Pyramid (138 m, 230 m a side) and the Sphinx (73 m long);
// - Casablanca: the Hassan II mosque and its 210 m minaret over the ocean.
// Proportions from photographs; the details (the counts of steps, of stakes, the people) are the game's.
// Frames: +z the street (the place's door).

const BRONZE = '#6b4f2e'
const BRONZE_D = '#54391f'
const BRONZE_L = '#8a6a3e'
const WHITE = '#f3efe6'
const CONCRETE = '#e3ddd0'
const BANCO = '#c9935a'
const BANCO_D = '#a8743f'
const BANCO_L = '#dcae78'
const LIMESTONE = '#d8c39a'
const LIMESTONE_D = '#c4ab7f'

/** A standing figure of blocks (a statue's): legs, body, head, at foot p, height h, facing +z. */
function figure(out: At[], [x, y, z]: [number, number, number], h: number, c: string, c2 = c, ry = 0) {
  const u = h / 8
  const cos = Math.cos(ry)
  const sin = Math.sin(ry)
  const at = (dx: number, dy: number, dz: number): [number, number, number] => [x + dx * cos + dz * sin, y + dy, z - dx * sin + dz * cos]
  out.push({ p: at(-0.55 * u, 2 * u, 0), s: [0.9 * u, 4 * u, 0.9 * u], ry, c: c2 }, { p: at(0.55 * u, 2 * u, 0), s: [0.9 * u, 4 * u, 0.9 * u], ry, c: c2 })
  out.push({ p: at(0, 5.3 * u, 0), s: [2.2 * u, 2.8 * u, 1.2 * u], ry, c })
  out.push({ p: at(0, 7.2 * u, 0), s: [1.1 * u, 1.1 * u, 1.1 * u], ry, c })
}

/* ---------- Dakar ---------- */

/**
 * The Monument de la Renaissance africaine (2010), on the top of the Mamelles: the man stepping out of the
 * volcano, the child on his arm pointing west to the ocean, the woman behind him, her hair and her robe in the
 * wind; the great stair up the hill, the pedestal.
 */
export function RenaissanceAfricaine({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.1)
  const at = useMemo(() => {
    const out: At[] = []
    const z0 = -34
    // The hill's top as a stepped mound, the stair up its face.
    for (let i = 0; i < 6; i++) out.push({ p: [0, 1 + i * 2, z0 - i * 3], s: [70 - i * 8, 2, 54 - i * 6], c: i % 2 ? '#8f7b5c' : '#9c8866' })
    for (let i = 0; i < 24; i++) out.push({ p: [0, 0.25 + i * 0.5, 10 - i * 1.6], s: [12, 0.5, 1.7], c: i % 2 ? '#d6cfc0' : '#e3ddd0' })
    // The pedestal.
    out.push({ p: [0, 14, z0 - 15], s: [16, 4, 14], c: '#c9c2b0' }, { p: [0, 16.5, z0 - 15], s: [13, 1, 11], c: '#b9b2a0' })
    // The rock they step out of, rough bronze.
    for (let i = 0; i < 4; i++) out.push({ p: [i % 2 ? -2 : 2, 18 + i * 1.5, z0 - 15 + (i % 2) * 1.5], s: [11 - i * 2, 1.6, 9 - i * 1.5], ry: i * 0.3, c: i % 2 ? BRONZE_D : BRONZE })
    // The man: broad, striding, his left arm raised high with the child.
    const fy = 22
    const mz = z0 - 13
    out.push({ p: [-2, fy + 6, mz], s: [3, 12, 3], ry: 0.15, c: BRONZE }, { p: [2.4, fy + 6, mz + 1.5], s: [3, 12, 3], ry: -0.2, c: BRONZE })
    out.push({ p: [0, fy + 17, mz], s: [8, 11, 4.4], c: BRONZE_L })
    out.push({ p: [0, fy + 25, mz + 0.5], s: [3.6, 4, 3.6], c: BRONZE })
    out.push({ p: [4.6, fy + 21, mz], s: [2, 10, 2], ry: 0, c: BRONZE }, { p: [4.6, fy + 28, mz], s: [2.2, 4, 2.2], c: BRONZE_D })
    out.push({ p: [-4.8, fy + 16, mz + 2], s: [2, 9, 2], ry: 0.4, c: BRONZE })
    // The child on his arm, pointing ahead.
    out.push({ p: [4.6, fy + 32, mz + 0.4], s: [2.6, 4, 2], c: BRONZE_L }, { p: [4.6, fy + 35, mz + 0.4], s: [1.8, 1.8, 1.8], c: BRONZE })
    out.push({ p: [4.6, fy + 33.4, mz + 3], s: [0.8, 0.8, 4.6], c: BRONZE_L })
    // The woman behind, her arm round him, her hair and robe flying back.
    out.push({ p: [-3.5, fy + 9, mz - 4.5], s: [5, 18, 3.2], ry: 0.3, c: BRONZE_D })
    out.push({ p: [-4, fy + 20, mz - 4.5], s: [5.4, 6, 3], ry: 0.3, c: BRONZE })
    out.push({ p: [-4.5, fy + 24.5, mz - 4.4], s: [3, 3, 3], c: BRONZE })
    out.push({ p: [-7, fy + 24.5, mz - 6], s: [4, 1.6, 2.4], ry: 0.5, c: BRONZE_D }, { p: [-7.5, fy + 8, mz - 7], s: [3, 10, 1.2], ry: 0.5, c: BRONZE_D })
    // The flags of Senegal at the stair's foot.
    for (const x of [-9, 9]) {
      out.push({ p: [x, 4, 8], s: [0.16, 8, 0.16], c: '#d0d0d0' })
      out.push({ p: [x + 0.5, 7.4, 8], s: [0.8, 1.2, 0.05], c: '#00853f' }, { p: [x + 1.3, 7.4, 8], s: [0.8, 1.2, 0.05], c: '#fdef42' }, { p: [x + 2.1, 7.4, 8], s: [0.8, 1.2, 0.05], c: '#e31b23' })
    }
    streetLife(out, 'sahel', -24, 24, 14, 1960)
    return out
  }, [])
  const people = usePeople('dakar-renaissance', [
    { p: [3, 0.6, 9], ry: Math.PI, pose: 'film' },
    { p: [-2, 2.2, 4], ry: Math.PI, pose: 'walk' },
    { p: [-4, 0.6, 11], ry: 2.8, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/* ---------- Accra ---------- */

/** The Black Star Gate (1961) of Independence Square: the great white arch, its black star on top, « Freedom and Justice », the parade ground before it, the flags of Ghana. */
export function BlackStarGate({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff6d8', 0.12)
  const sign = useSign('FREEDOM AND JUSTICE · AD 1957', '#f3efe6', '#1a1a1a', night, 0.3)
  const at = useMemo(() => {
    const out: At[] = []
    const z0 = -18
    // The parade ground, its paving.
    out.push({ p: [0, 0.05, z0 + 12], s: [60, 0.1, 30], c: '#cfc8b8' })
    for (let x = -28; x <= 28; x += 4) out.push({ p: [x, 0.11, z0 + 12], s: [0.15, 0.02, 30], c: '#b9b2a2' })
    // The gate: two great piers, the lintel, the central opening and two lower side ones.
    out.push({ p: [-12, 9, z0], s: [6, 18, 5], c: WHITE }, { p: [12, 9, z0], s: [6, 18, 5], c: WHITE })
    out.push({ p: [-5.5, 6, z0], s: [3, 12, 4.4], c: CONCRETE }, { p: [5.5, 6, z0], s: [3, 12, 4.4], c: CONCRETE })
    out.push({ p: [0, 20, z0], s: [32, 4, 5.4], c: WHITE }, { p: [0, 13.5, z0], s: [8, 3, 4.6], c: CONCRETE })
    out.push({ p: [-8.8, 13.5, z0], s: [3.6, 3, 4.6], c: CONCRETE }, { p: [8.8, 13.5, z0], s: [3.6, 3, 4.6], c: CONCRETE })
    // The black star on its plinth: five points of blocks.
    out.push({ p: [0, 23, z0], s: [6, 2, 3], c: WHITE })
    out.push({ p: [0, 27, z0], s: [2.6, 2.6, 1], c: '#111' })
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2
      out.push({ p: [Math.sin(a) * 2, 27 + Math.cos(a) * 2, z0], s: [1.3, 1.3, 0.9], c: '#111' }, { p: [Math.sin(a) * 3, 27 + Math.cos(a) * 3, z0], s: [0.7, 0.7, 0.9], c: '#111' })
    }
    // The flags of Ghana along the square.
    for (const x of [-26, -20, 20, 26]) {
      out.push({ p: [x, 5, z0 + 6], s: [0.16, 10, 0.16], c: '#d0d0d0' })
      out.push({ p: [x + 1.2, 9.4, z0 + 6], s: [2.2, 0.5, 0.05], c: '#ce1126' }, { p: [x + 1.2, 8.9, z0 + 6], s: [2.2, 0.5, 0.05], c: '#fcd116' }, { p: [x + 1.2, 8.4, z0 + 6], s: [2.2, 0.5, 0.05], c: '#006b3f' }, { p: [x + 1.2, 8.9, z0 + 6.03], s: [0.4, 0.4, 0.03], c: '#111' })
    }
    // The grandstand's long low roof to the side.
    out.push({ p: [-24, 3, z0 - 6], s: [16, 6, 8], c: '#d6cfc0' }, { p: [-24, 6.4, z0 - 6], s: [17, 0.6, 9], c: '#ffffff' })
    streetLife(out, 'sahel', -28, 28, 14, 1957)
    return out
  }, [])
  const people = usePeople('accra-black-star', [
    { p: [2, 0, -4], ry: Math.PI, pose: 'film' },
    { p: [-3, 0, -2], ry: 2.6, pose: 'talk' },
    { p: [6, 0, 0], ry: Math.PI, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Sign s={sign} w={14} p={[0, 20, -15.25]} />
      <People list={people} />
    </group>
  )
}

/* ---------- Lomé ---------- */

/** The Monument de l'Indépendance (1960) of Lomé: the tall white slab on its round island, the figure carved in its face, the flags of Togo. */
export function IndependanceLome({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff6d8', 0.12)
  const at = useMemo(() => {
    const out: At[] = []
    const z0 = -18
    octo(out, [0, 0.15, z0], 40, 0.3, '#b9b2a4')
    octo(out, [0, 0.35, z0], 36, 0.2, '#5c9e31', '#64a83a')
    octo(out, [0, 0.6, z0], 14, 0.5, '#d6cfc0')
    // The slab, its two wings framing the figure.
    out.push({ p: [0, 11, z0], s: [7, 22, 3], c: WHITE })
    out.push({ p: [-4.2, 9, z0], s: [1.4, 18, 2.6], c: CONCRETE }, { p: [4.2, 9, z0], s: [1.4, 18, 2.6], c: CONCRETE })
    out.push({ p: [0, 22.6, z0], s: [9, 1.2, 3.4], c: CONCRETE })
    // The figure in relief on the face, rising, arms up.
    figure(out, [0, 6, z0 + 1.6], 11, '#c9c2b0', '#bfb6a2')
    out.push({ p: [-1.7, 16.6, z0 + 1.6], s: [0.8, 3.4, 0.8], c: '#c9c2b0' }, { p: [1.7, 16.6, z0 + 1.6], s: [0.8, 3.4, 0.8], c: '#c9c2b0' })
    // The flags of Togo round the island.
    for (let i = 0; i < 6; i++) {
      const x = Math.sin(i * 1.05) * 16
      const z = z0 + Math.cos(i * 1.05) * 16
      out.push({ p: [x, 4.5, z], s: [0.16, 9, 0.16], c: '#d0d0d0' })
      for (let k = 0; k < 5; k++) out.push({ p: [x + 1.2, 8.6 - k * 0.3, z], s: [2.2, 0.3, 0.05], c: k % 2 ? '#ffce00' : '#006a4e' })
      out.push({ p: [x + 0.5, 8.3, z + 0.03], s: [0.8, 0.9, 0.03], c: '#d21034' })
    }
    streetLife(out, 'sahel', -22, 22, 12, 1960)
    return out
  }, [])
  const people = usePeople('lome-independance', [
    { p: [3, 0, -4], ry: Math.PI, pose: 'film' },
    { p: [-4, 0, -3], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/* ---------- Cotonou, Ouidah ---------- */

/** The Amazone (2022) of Cotonou: the warrior of the Dahomey kingdom, thirty metres of bronze, her sabre down at her side, on her round pedestal in the middle of the place. */
export function Amazone({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.14)
  const at = useMemo(() => {
    const out: At[] = []
    const z0 = -20
    octo(out, [0, 0.15, z0], 46, 0.3, '#b9b2a4')
    octo(out, [0, 0.35, z0], 42, 0.2, '#d6cfc0')
    // The pedestal, in three tiers.
    octo(out, [0, 2, z0], 18, 3.4, '#c9c2b0')
    octo(out, [0, 5, z0], 14, 2.6, '#d6cfc0')
    octo(out, [0, 7.3, z0], 10, 2, '#b9b2a0')
    // The warrior: her legs, her short tunic, her chest, her head and its cap.
    const y = 8.3
    out.push({ p: [-1.4, y + 5, z0], s: [2, 10, 2], c: BRONZE }, { p: [1.6, y + 5, z0 + 0.6], s: [2, 10, 2], ry: -0.15, c: BRONZE })
    out.push({ p: [0, y + 11, z0], s: [6, 3, 3.6], c: BRONZE_D })
    out.push({ p: [0, y + 16, z0], s: [5, 7, 3], c: BRONZE_L })
    out.push({ p: [0, y + 21.2, z0], s: [2.6, 3, 2.6], c: BRONZE }, { p: [0, y + 23, z0], s: [3, 0.8, 3], c: BRONZE_D })
    // The arms: the left at her side, the right holding the sabre down, its blade.
    out.push({ p: [-3.2, y + 15, z0], s: [1.4, 7, 1.4], c: BRONZE })
    out.push({ p: [3.2, y + 15, z0 + 0.4], s: [1.4, 7, 1.4], c: BRONZE }, { p: [3.4, y + 8.5, z0 + 0.8], s: [0.5, 7, 0.9], c: '#8d8070' })
    // The lamps round the place.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      out.push({ p: [Math.sin(a) * 19, 3, z0 + Math.cos(a) * 19], s: [0.2, 6, 0.2], c: '#5c5f66' }, { p: [Math.sin(a) * 19, 6.1, z0 + Math.cos(a) * 19], s: [0.6, 0.3, 0.6], c: '#fff3bf' })
    }
    streetLife(out, 'sahel', -26, 26, 10, 2022)
    return out
  }, [])
  const people = usePeople('cotonou-amazone', [
    { p: [4, 0.4, -3], ry: Math.PI, pose: 'film' },
    { p: [-3, 0.4, -2], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Porte du Non-Retour (1995), on Ouidah's beach, where the Route des Esclaves ends: the great arch of concrete, its reliefs of figures walking towards the sea, the bronze statues on either side. A place of memory. */
export function PorteNonRetour({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1c4', 0.08)
  const at = useMemo(() => {
    const out: At[] = []
    const z0 = -14
    // The sand round it.
    out.push({ p: [0, 0.04, z0], s: [50, 0.08, 34], c: '#e6d3a8' })
    // The arch: two thick piers, the lintel, its step.
    out.push({ p: [-6, 5, z0], s: [4, 10, 3], c: '#c9b9a0' }, { p: [6, 5, z0], s: [4, 10, 3], c: '#c9b9a0' })
    out.push({ p: [0, 11.5, z0], s: [16, 3, 3.4], c: '#bfae94' }, { p: [0, 0.3, z0], s: [18, 0.6, 5], c: '#d6c9b0' })
    // The reliefs on the lintel and the piers: small figures in a line, in bronze.
    for (let k = 0; k < 10; k++) figure(out, [-6.75 + k * 1.5, 10.2, z0 + 1.75], 2.4, BRONZE, BRONZE_D)
    for (const x of [-6, 6]) for (let k = 0; k < 3; k++) figure(out, [x, 1 + k * 3, z0 + 1.55], 2.4, BRONZE, BRONZE_D)
    // The bronze figures on either side, facing the sea.
    for (const x of [-12, 12]) {
      out.push({ p: [x, 0.8, z0], s: [3, 1.6, 3], c: '#c9b9a0' })
      figure(out, [x, 1.6, z0], 4, BRONZE, BRONZE_D, Math.PI)
    }
    return out
  }, [])
  const people = usePeople('ouidah-non-retour', [
    { p: [2, 0, -6], ry: Math.PI, pose: 'idle' },
    { p: [-3, 0, -5], ry: 2.8, pose: 'pray' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/* ---------- Agadez ---------- */

/** The great mosque of Agadez (its minaret rebuilt in 1844): the tapering square tower of banco, 27 metres, bristling with its 99 rows of wooden stakes, the low prayer hall at its foot. */
export function MosqueeAgadez({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff1d0', 0.1)
  const at = useMemo(() => {
    const out: At[] = []
    const z0 = -14
    out.push({ p: [0, 2.5, z0 - 4], s: [26, 5, 18], c: BANCO })
    for (let x = -12; x <= 12; x += 2) (out.push({ p: [x, 5.4, z0 + 5], s: [0.8, 0.8, 0.6], c: BANCO_D }), spire(out, [x, 5.8, z0 + 5], 0.7, 1, 2, BANCO_L))
    for (const x of [-8, 0, 8]) out.push({ p: [x, 1.6, z0 + 5.05], s: [1.6, 3.2, 0.1], c: '#3a2616' })
    // The minaret: tapering in 9 tiers, its stakes on every face.
    const tiers = 9
    const h = 27
    for (let i = 0; i < tiers; i++) {
      const w = 10 * (1 - i * 0.075)
      const th = h / tiers
      const y = th * (i + 0.5)
      out.push({ p: [0, y, z0 - 2], s: [w, th, w], c: i % 2 ? BANCO : BANCO_L })
      for (let k = -1; k <= 1; k++) {
        out.push({ p: [(k * w) / 3, y, z0 - 2 + w / 2 + 0.5], s: [0.18, 0.18, 1.1], c: '#5a3c20' })
        out.push({ p: [(k * w) / 3, y, z0 - 2 - w / 2 - 0.5], s: [0.18, 0.18, 1.1], c: '#5a3c20' })
        out.push({ p: [w / 2 + 0.5, y, z0 - 2 + (k * w) / 3], s: [1.1, 0.18, 0.18], c: '#5a3c20' })
        out.push({ p: [-w / 2 - 0.5, y, z0 - 2 + (k * w) / 3], s: [1.1, 0.18, 0.18], c: '#5a3c20' })
      }
    }
    spire(out, [0, h, z0 - 2], 3.4, 2.4, 3, BANCO_D, BANCO)
    streetLife(out, 'sahel', -20, 20, 8, 1844)
    return out
  }, [])
  const people = usePeople('agadez-mosquee', [
    { p: [3, 0, -6], ry: Math.PI, pose: 'salat', gender: 'homme' },
    { p: [-5, 0, -4], ry: 0.6, pose: 'talk', gender: 'homme', dress: { outfit: 'boubou', outfitColor: '#1c3f94' } },
    { p: [7, 0, 2], ry: Math.PI, pose: 'film' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/* ---------- Gizeh ---------- */

/** The Great Pyramid of Khufu (Khéops): 230 metres a side, 138 high today, its courses of limestone blocks in steps, its top gone, the entrance on the north face. */
export function PyramideKheops({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffe8c0', 0.04)
  const at = useMemo(() => {
    const out: At[] = []
    const z0 = -125
    out.push({ p: [0, 0.05, z0], s: [250, 0.1, 250], c: '#d9c49a' })
    const courses = 69
    for (let i = 0; i < courses; i++) {
      const w = 230 * (1 - i / 75)
      out.push({ p: [0, 1 + i * 2, z0], s: [w, 2.02, w], c: i % 3 === 0 ? LIMESTONE_D : i % 3 === 1 ? LIMESTONE : '#cfb88c' })
    }
    // The entrance, a dark notch on the north face (the street's side).
    out.push({ p: [0, 18, z0 + 230 * (1 - 9 / 75) / 2 + 0.3], s: [3, 4, 0.4], c: '#3a2e20' })
    // A few great blocks left at the foot.
    for (let k = 0; k < 6; k++) out.push({ p: [-40 + k * 16, 0.8, z0 + 122 + (k % 2) * 2], s: [2.2, 1.6, 1.6], ry: k * 0.4, c: LIMESTONE })
    return out
  }, [])
  const people = usePeople('gizeh-kheops', [
    { p: [4, 0, -4], ry: Math.PI, pose: 'film' },
    { p: [-6, 0, -3], ry: 2.6, pose: 'talk' },
    { p: [10, 0, -6], ry: Math.PI, pose: 'walk', dress: { outfit: 'abaya', outfitColor: '#f4efe6' }, gender: 'femme' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Great Sphinx of Gizeh: the lion's body of limestone, 73 metres long, its paws forward, its head with the nemes, 20 metres high, lying in its hollow. */
export function Sphinx({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#ffe8c0', 0.08)
  const at = useMemo(() => {
    const out: At[] = []
    const z0 = -40
    // The hollow it lies in.
    out.push({ p: [0, 0.05, z0], s: [40, 0.1, 90], c: '#cdb48a' })
    // The body, the back, the haunch.
    out.push({ p: [0, 5, z0 - 6], s: [16, 10, 50], c: LIMESTONE }, { p: [0, 11, z0 - 10], s: [13, 2, 38], c: LIMESTONE_D })
    out.push({ p: [0, 7, z0 - 30], s: [17, 14, 12], c: LIMESTONE_D })
    // The paws forward.
    out.push({ p: [-5, 1.6, z0 + 26], s: [4, 3.2, 14], c: LIMESTONE }, { p: [5, 1.6, z0 + 26], s: [4, 3.2, 14], c: LIMESTONE })
    // The chest, the head, the nemes falling on each side, the face.
    out.push({ p: [0, 9, z0 + 17], s: [12, 14, 6], c: LIMESTONE })
    out.push({ p: [0, 17, z0 + 18], s: [9, 6, 6], c: '#d2bb8c' })
    out.push({ p: [-5, 14, z0 + 18], s: [2, 8, 4], c: LIMESTONE_D }, { p: [5, 14, z0 + 18], s: [2, 8, 4], c: LIMESTONE_D })
    out.push({ p: [0, 20.5, z0 + 18], s: [8, 2, 6.4], c: LIMESTONE_D })
    out.push({ p: [0, 17, z0 + 21.1], s: [5, 4.4, 0.4], c: '#c9ae80' }, { p: [0, 16.4, z0 + 21.4], s: [1.2, 1.4, 0.6], c: '#b89a6a' })
    // The little stela between the paws.
    out.push({ p: [0, 2.5, z0 + 22], s: [4, 5, 0.8], c: '#bfa77c' })
    return out
  }, [])
  const people = usePeople('gizeh-sphinx', [
    { p: [3, 0, 4], ry: Math.PI, pose: 'film' },
    { p: [-4, 0, 6], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/* ---------- Casablanca ---------- */

/** The Hassan II mosque (1993) on its rock over the ocean: the minaret of 210 metres in green zellige and carved stone, its lantern and laser; the prayer hall's front, its arches and green roofs. */
export function MosqueeHassan2({ night }: { night: boolean }) {
  const mat = useBlocks(night, '#fff6d8', 0.1)
  const at = useMemo(() => {
    const out: At[] = []
    const z0 = -40
    // The great esplanade, its paving.
    out.push({ p: [0, 0.05, z0 + 18], s: [90, 0.1, 40], c: '#e9e3d4' })
    for (let x = -44; x <= 44; x += 4) out.push({ p: [x, 0.11, z0 + 18], s: [0.2, 0.02, 40], c: '#cfc8b8' })
    // The prayer hall's front: the long wall of arches, the green roofs in steps.
    out.push({ p: [8, 10, z0 - 10], s: [70, 20, 20], c: '#e8e0cc' })
    for (let x = -24; x <= 40; x += 6) out.push({ p: [x, 7, z0 + 0.05], s: [3.6, 12, 0.2], c: '#c9a24a' }, { p: [x, 13.6, z0 + 0.05], s: [3.6, 1.4, 0.2], c: '#1f7a5a' })
    for (let i = 0; i < 3; i++) out.push({ p: [8, 20.6 + i * 1.2, z0 - 10], s: [70 - i * 16, 1.2, 20 - i * 5], c: i % 2 ? '#1f7a5a' : '#2b8a6a' })
    // The minaret: a square shaft, its panels of zellige, the gallery, the lantern, its own small dome.
    const mx = -34
    const mz = z0 - 6
    out.push({ p: [mx, 90, mz], s: [25, 180, 25], c: '#e3d9c2' })
    for (let y = 10; y < 175; y += 14) for (const s of [-1, 1]) out.push({ p: [mx, y + 4, mz + s * 12.6], s: [12, 10, 0.3], c: '#1f7a5a' }, { p: [mx + s * 12.6, y + 4, mz], s: [0.3, 10, 12], c: '#1f7a5a' })
    out.push({ p: [mx, 181, mz], s: [27, 2, 27], c: '#c9a24a' })
    out.push({ p: [mx, 192, mz], s: [12, 20, 12], c: '#e3d9c2' })
    for (const s of [-1, 1]) out.push({ p: [mx, 192, mz + s * 6.1], s: [6, 12, 0.3], c: '#1f7a5a' }, { p: [mx + s * 6.1, 192, mz], s: [0.3, 12, 6], c: '#1f7a5a' })
    dome(out, [mx, 202, mz], 5, 4, '#1f7a5a', '#2b8a6a')
    // The jamour: three golden balls on its rod.
    out.push({ p: [mx, 209, mz], s: [0.3, 6, 0.3], c: '#c9a24a' })
    for (const y of [207, 208.8, 210.4]) out.push({ p: [mx, y, mz], s: [1.2, 1.2, 1.2], c: '#e0b85a' })
    // The fountains of the esplanade.
    for (const x of [-10, 10, 30]) {
      octo(out, [x, 0.4, z0 + 16], 6, 0.8, '#d6cfc0')
      octo(out, [x, 0.85, z0 + 16], 5, 0.1, '#4dabf7')
    }
    disc(out, [mx, 150, mz + 12.8], 4, '#f3efe6')
    return out
  }, [])
  const people = usePeople('casablanca-hassan2', [
    { p: [3, 0, -6], ry: Math.PI, pose: 'film' },
    { p: [-5, 0, -4], ry: 2.6, pose: 'talk', gender: 'femme', dress: { outfit: 'abaya', outfitColor: '#6d28d9' } },
    { p: [8, 0, -10], ry: Math.PI, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}
