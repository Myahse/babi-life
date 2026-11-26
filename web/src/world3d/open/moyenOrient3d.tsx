import { useMemo } from 'react'
import { Blocks } from './ruePrincesse'
import type { At } from './shoreline'
import { seeded } from './kit3d'
import { People, usePeople, type Who } from './villeKit'
import { dome, octo, ring, spire, useBlocks } from './paysKit'

// The Middle East's and Oceania's landmarks in blocks (the updates « pays-moyen-orient », « pays-oceanie »,
// backend world/moyenOrient.go, world/oceanie.go), at their real size where known, proportions from
// photographs, the details the game's: Dubai's Burj Khalifa and the souk of Deira; Mecca's Great Mosque, its
// courtyard and the Kaaba seen from outside, with the pilgrims in white; Medina's Prophet's Mosque under its green
// dome and its umbrellas; Abu Dhabi's Sheikh Zayed mosque; Riyadh's Kingdom Centre; Jerusalem's Dome of the Rock
// above the Western Wall; Petra's Treasury; Tehran's Azadi tower; Isfahan's Imam mosque; Beirut's Raouché rocks;
// Sydney's Opera House and Harbour Bridge; Auckland's Sky Tower. Frames: +z the street.

type Props = { night: boolean }
const WHITE = '#f4f1ea'
const MARBLE = '#ecebe6'
const SAND = '#e3d3b0'
const GOLD = '#c9a227'

/** A minaret: its square foot, its shaft in drums, its balconies, its cap and crescent. */
function minaret(out: At[], [x, z]: [number, number], h: number, w: number, c: string, cap = c, trim = GOLD) {
  out.push({ p: [x, h * 0.12, z], s: [w * 1.3, h * 0.24, w * 1.3], c })
  octo(out, [x, h * 0.55, z], w, h * 0.62, c)
  for (const f of [0.45, 0.72, 0.86]) octo(out, [x, h * f, z], w * 1.45, 0.8, trim, c)
  octo(out, [x, h * 0.92, z], w * 0.8, h * 0.1, c)
  spire(out, [x, h * 0.97, z], w * 0.9, h * 0.06, 3, cap)
  out.push({ p: [x, h * 1.04, z], s: [0.3, h * 0.03, 0.3], c: trim })
}

/** A row of arches (a riwaq, an arcade): piers and their arches' tops, a roof over, along x, facing +z. */
function arcade(out: At[], [x0, z]: [number, number], len: number, h: number, depth: number, c: string, shadow = '#cfc8b8', ry = 0) {
  const n = Math.max(2, Math.round(len / 5))
  const step = len / n
  const rot = (x: number, zz: number): [number, number] => (ry ? [x * Math.cos(ry) + zz * Math.sin(ry), -x * Math.sin(ry) + zz * Math.cos(ry)] : [x, zz])
  for (let i = 0; i <= n; i++) {
    const [px, pz] = rot(x0 + i * step, z)
    out.push({ p: [px, h / 2, pz], s: [1.2, h, 1.2], ry, c })
  }
  for (let i = 0; i < n; i++) {
    const [px, pz] = rot(x0 + (i + 0.5) * step, z)
    out.push({ p: [px, h - 0.6, pz], s: [step - 1.2, 1.2, 1.1], ry, c })
  }
  const [mx, mz] = rot(x0 + len / 2, z - depth / 2)
  out.push({ p: [mx, h + 0.5, mz], s: [len + 1.2, 1, Math.abs(depth)], ry, c }, { p: [mx, 0.05, mz], s: [len, 0.1, Math.abs(depth) - 1], ry, c: shadow })
}

/** A date palm: its ringed trunk, its crown of fronds. */
function palm(out: At[], x: number, z: number, h: number, r: () => number) {
  for (let i = 0; i < h; i++) out.push({ p: [x, i + 0.5, z], s: [0.5, 1, 0.5], c: i % 2 ? '#8a6a44' : '#7a5c3a' })
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + r()
    out.push({ p: [x + Math.sin(a) * 1.4, h + 0.2, z + Math.cos(a) * 1.4], s: [0.5, 0.25, 3], ry: a, c: k % 2 ? '#4f7f3a' : '#5e8f42' })
  }
}

/** Pilgrims in white (the men in the ihram's white, the women in white abayas): walking round, at prayer. */
const PILGRIM_M = { outfit: 'imam', outfitColor: '#f8f9fa' }
const PILGRIM_F = { outfit: 'abaya', outfitColor: '#f1f3f5' }
function pilgrims(cx: number, cz: number, r0: number, n: number, seed: number, pose: Who['pose'] = 'walk', facing = false): Who[] {
  const r = seeded(seed)
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + r() * 0.3
    const rr = r0 + r() * 5
    const femme = r() < 0.4
    // Walking round anticlockwise seen from above (the tawaf), or facing the middle.
    const ry = facing ? a + Math.PI : a - Math.PI / 2
    return { p: [cx + Math.sin(a) * rr, 0.1, cz + Math.cos(a) * rr], ry, pose, gender: femme ? 'femme' : 'homme', dress: femme ? PILGRIM_F : PILGRIM_M } as Who
  })
}

/** Masjid al-Haram: the white marble courtyard, the Kaaba at its middle under its black kiswa and its gold band (seen from outside), the riwaqs round, the minarets, the pilgrims. */
function MasjidAlHaram({ night }: Props) {
  const mat = useBlocks(night, '#fff4d6', 0.3)
  const at = useMemo(() => {
    const out: At[] = []
    const z0 = -20
    out.push({ p: [0, 0.05, z0], s: [110, 0.1, 110], c: MARBLE })
    // The Kaaba: about 13 × 11 m, 13 m high; its gold band of calligraphy two thirds up, its door of gold raised on the north-east face.
    out.push({ p: [0, 6.5, z0], s: [12, 13, 10.5], c: '#141414' })
    out.push({ p: [0, 9.2, z0], s: [12.15, 1, 10.65], c: GOLD })
    out.push({ p: [2.5, 4, z0 + 5.3], s: [2, 4, 0.2], c: GOLD }, { p: [0, 0.35, z0], s: [12.8, 0.7, 11.3], c: '#c8c4bb' })
    // The Hijr Ismail's low half-round wall.
    ring(out, [0, 0.7, z0 - 8.5], 6, 10, [2.2, 1.4, 0.6], WHITE, Math.PI / 2, Math.PI * 1.5)
    // The Maqam Ibrahim's little golden shrine.
    out.push({ p: [-3, 1.2, z0 + 10], s: [1.4, 2.4, 1.4], c: GOLD }, { p: [-3, 2.6, z0 + 10], s: [0.8, 0.5, 0.8], c: GOLD })
    // The riwaqs round the court, two storeys of arches; the Mas'a gallery along one side.
    for (const [side, ry] of [[1, 0], [-1, Math.PI], [1, Math.PI / 2], [-1, -Math.PI / 2]] as const) {
      const off = 52
      if (ry === 0) {
        arcade(out, [-48, z0 + off], 96, 9, 10, WHITE)
        arcade(out, [-48, z0 + off - 2], 96, 17, 6, WHITE)
      } else if (ry === Math.PI) {
        arcade(out, [-48, z0 - off], 96, 9, -10, WHITE)
        arcade(out, [-48, z0 - off + 2], 96, 17, -6, WHITE)
      } else {
        for (let i = 0; i < 18; i++) {
          const zz = z0 - 48 + i * 5.6
          out.push({ p: [side * off, 4.5, zz], s: [1.2, 9, 1.2], c: WHITE }, { p: [side * off, 8.4, zz + 2.8], s: [1.1, 1.2, 4.4], c: WHITE })
        }
        out.push({ p: [side * (off + 5), 9.5, z0], s: [10, 1, 100], c: WHITE }, { p: [side * (off + 4), 13, z0], s: [8, 8, 100], c: '#e9e4d8' })
      }
    }
    // The minarets (89 m) at the gates.
    for (const [x, z] of [[-58, z0 + 58], [58, z0 + 58], [-58, z0 - 58], [58, z0 - 58], [-14, z0 + 62], [14, z0 + 62]] as const) minaret(out, [x, z], 89, 4, WHITE, '#d7c79a')
    // The lights on their poles round the mataf.
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      out.push({ p: [Math.sin(a) * 30, 6, z0 + Math.cos(a) * 30], s: [0.4, 12, 0.4], c: '#9a9a9a' }, { p: [Math.sin(a) * 30, 12.2, z0 + Math.cos(a) * 30], s: [1.4, 0.6, 1.4], c: '#fff3bf' })
    }
    return out
  }, [])
  const people = usePeople('haram', [...pilgrims(0, -20, 10, 26, 1, 'walk'), ...pilgrims(0, -20, 18, 22, 2, 'walk'), ...pilgrims(0, -20, 34, 20, 3, 'salat', true)])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} within={160} />
    </group>
  )
}

/** Al-Masjid an-Nabawi: the long white prayer halls, the green dome over the Prophet's tomb, the minarets, the courtyard's great umbrellas opened over the faithful. */
function MasjidNabawi({ night }: Props) {
  const mat = useBlocks(night, '#fff4d6', 0.25)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -30
    out.push({ p: [0, 0.05, 10], s: [120, 0.1, 60], c: MARBLE })
    out.push({ p: [0, 9, z], s: [100, 18, 40], c: '#efe9dc' })
    for (let i = 0; i < 20; i++) out.push({ p: [-47.5 + i * 5, 6, z + 20.1], s: [2.4, 8, 0.3], c: '#b9a77c' })
    // The little domes on the roof, the green dome.
    for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) dome(out, [-42 + i * 12, 18, z - 12 + j * 12], 3, 3, '#d9d2c2')
    octo(out, [-30, 21, z + 8], 12, 6, '#3e8e5a')
    dome(out, [-30, 24, z + 8], 6.5, 5, '#2f9e44', '#37b24d')
    out.push({ p: [-30, 31.5, z + 8], s: [0.4, 3, 0.4], c: GOLD })
    for (const [x, zz] of [[-52, z + 22], [52, z + 22], [-52, z - 22], [52, z - 22], [-20, z + 22], [20, z + 22]] as const) minaret(out, [x, zz], 104, 3.6, WHITE, '#d7c79a')
    // The umbrellas (sunshades), open: a stem, a square canopy.
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 2; j++) {
        const x = -45 + i * 18
        const zz = 2 + j * 18
        out.push({ p: [x, 7, zz], s: [0.8, 14, 0.8], c: '#e9ecef' })
        for (let k = 0; k < 4; k++) out.push({ p: [x, 13.6 - k * 0.6, zz], s: [16 - k * 3, 0.5, 16 - k * 3], ry: Math.PI / 4, c: k % 2 ? '#f1ede4' : '#e3dccd' })
      }
    return out
  }, [])
  const people = usePeople('nabawi', [...pilgrims(-20, 6, 4, 10, 4, 'walk'), ...pilgrims(25, 14, 4, 10, 5, 'salat', true), ...pilgrims(0, 22, 6, 8, 6, 'walk')])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} within={140} />
    </group>
  )
}

/** The Sheikh Zayed Grand Mosque: the white marble halls and their 82 domes, the four minarets of 107 m, the reflecting pools along the arcades. */
function ZayedMosque({ night }: Props) {
  const mat = useBlocks(night, '#e6f0ff', 0.35)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -40
    out.push({ p: [0, 1, z], s: [150, 2, 110], c: '#f8f9fa' }, { p: [0, 0.05, 30], s: [150, 0.1, 34], c: SAND })
    out.push({ p: [0, 9, z - 25], s: [90, 16, 40], c: '#ffffff' })
    dome(out, [0, 17, z - 25], 16, 7, '#ffffff', '#f1f3f5', 1.25)
    out.push({ p: [0, 37.5, z - 25], s: [0.6, 4, 0.6], c: GOLD })
    for (const dx of [-28, 28]) dome(out, [dx, 17, z - 25], 8, 5, '#ffffff', '#f1f3f5', 1.2)
    // The arcades round the court, and their little domes; the court's marble with its flowers.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 16; i++) {
        const zz = z - 40 + i * 6
        out.push({ p: [side * 66, 5, zz], s: [1.6, 8, 1.6], c: '#ffffff' })
        dome(out, [side * 69, 9, zz], 2.4, 3, '#ffffff')
      }
      out.push({ p: [side * 69, 8.5, z + 5], s: [6, 1, 96], c: '#ffffff' })
      // The pools along them.
      out.push({ p: [side * 76, 1.2, z + 5], s: [10, 0.3, 96], c: '#3b82c4' })
    }
    for (let i = 0; i < 9; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2) out.push({ p: [-40 + i * 10, 2.05, z + 8 + j * 9], s: [3, 0.1, 3], ry: Math.PI / 4, c: '#7a9a5a' })
    for (const [x, zz] of [[-70, z + 52], [70, z + 52], [-70, z - 46], [70, z - 46]] as const) minaret(out, [x, zz], 107, 5, '#ffffff', GOLD)
    // The date palms along the forecourt.
    const r = seeded(82)
    for (let i = 0; i < 12; i++) palm(out, -66 + i * 12, 22, 7 + Math.floor(r() * 3), r)
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/** The Burj Khalifa (828 m): three wings round a core, stepping back as they climb, the glass and steel, the spire. */
function BurjKhalifa({ night }: Props) {
  const mat = useBlocks(night, '#cfe6ff', 0.45)
  const at = useMemo(() => {
    const out: At[] = []
    out.push({ p: [0, 0.05, 20], s: [90, 0.1, 50], c: '#cfc9be' }, { p: [0, 0.08, 40], s: [70, 0.1, 18], c: '#3b82c4' })
    const wings = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]
    let y = 0
    for (let s = 0; s < 14; s++) {
      const h = 46
      const reach = 34 * (1 - s / 15)
      for (const a of wings) {
        const nn = Math.max(1, Math.round(reach / 8))
        for (let k = 0; k < nn; k++) {
          const d = ((k + 0.5) * reach) / nn
          out.push({ p: [Math.sin(a) * d, y + h / 2, Math.cos(a) * d - 10], s: [14 - s * 0.5, h, reach / nn + 0.4], ry: a, c: s % 2 ? '#a9bfd4' : '#9fb5cb' })
        }
      }
      octo(out, [0, y + h / 2, -10], 18 - s * 0.7, h, '#b7c9da', '#a6bacd')
      y += h
    }
    spire(out, [0, y, -10], 6, 180, 8, '#c9d4de', '#e9ecef')
    // The lake's fountains at its foot.
    for (let i = 0; i < 9; i++) out.push({ p: [-24 + i * 6, 3, 40], s: [0.6, 6, 0.6], c: '#e7f5ff' })
    return out
  }, [])
  const people = usePeople('burj', [
    { p: [4, 0.1, 30], ry: Math.PI, pose: 'film' },
    { p: [-6, 0.1, 31], ry: 0.3, pose: 'walk' },
    { p: [10, 0.1, 29], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The souk of Naif in Deira: the shops under their arcades (cloth and wax prints, phones, perfume, bags), the bales piled out for the traders from Africa, the carriers' trolleys, the people. */
function SoukDeira({ night }: Props) {
  const mat = useBlocks(night, '#ffd9a0', 0.22)
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(1830)
    const goods = ['#e8590c', '#1c7ed6', '#2f9e44', '#d6336c', '#f2b705', '#7b5cff', '#f1f3f5', '#343a40']
    // The lane runs back from the street (−z), the shops either side of it, their fronts facing in.
    for (const side of [-1, 1]) {
      for (let z = -60; z < 4; z += 8) {
        const x = side * 9
        const h = 9 + Math.floor(r() * 3) * 3
        out.push({ p: [x + side * 4, h / 2, z + 4], s: [8, h, 7.8], c: ['#efe2c4', '#e3d5b8', '#f3ead6', '#d8c49c'][Math.floor(r() * 4)] })
        out.push({ p: [x - side * 0.6, 3.6, z + 4], s: [2.2, 0.5, 7.6], c: '#a8744c' })
        for (let k = 0; k < 4; k++) out.push({ p: [x - side * 0.8, 1 + r() * 0.6, z + 1.6 + k * 1.6], s: [0.9, 1.4 + r() * 0.8, 1.2], c: goods[Math.floor(r() * goods.length)] })
        out.push({ p: [x - side * 0.1, 5.6, z + 4], s: [0.2, 1, 5], c: ['#c92a2a', '#2b8a3e', '#1971c2', '#5f3dc4'][Math.floor(r() * 4)] })
      }
    }
    // The bales and the trolleys in the lane, the souk's wooden roof beams.
    for (let i = 0; i < 10; i++) out.push({ p: [-2 + r() * 4, 0.7, -56 + i * 6 + r() * 2], s: [1.2, 1.4, 1.6], c: goods[Math.floor(r() * goods.length)] })
    for (let z = -60; z <= 4; z += 4) out.push({ p: [0, 9.5, z], s: [18, 0.5, 0.5], c: '#8a6a44' })
    out.push({ p: [0, 0.05, -28], s: [18, 0.1, 70], c: '#bcb5a6' })
    return out
  }, [])
  const people = usePeople('naif', [
    { p: [-1, 0.1, -10], ry: 0.4, pose: 'talk', gender: 'homme', dress: { outfit: 'boubou', outfitColor: '#1c7ed6' } },
    { p: [0.4, 0.1, -9.4], ry: -2.6, pose: 'pay', gender: 'homme', dress: { outfit: 'imam', outfitColor: '#f8f9fa' } },
    { p: [2, 0.1, -18], ry: 3, pose: 'carry', gender: 'femme', dress: { outfit: 'pagne', outfitColor: '#e8590c' } },
    { p: [-2, 0.1, -26], ry: 0, pose: 'push', gender: 'homme' },
    { p: [3, 0.1, -34], ry: 2.4, pose: 'phone', gender: 'homme', dress: { outfit: 'bazin', outfitColor: '#0f9d8a' } },
    { p: [-2.5, 0.1, -4], ry: Math.PI, pose: 'walk', gender: 'femme', dress: { outfit: 'abaya', outfitColor: '#14213d' } },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Kingdom Centre (302 m): the tapering tower, its great parabolic opening at the top and the sky bridge across it. */
function KingdomCentre({ night }: Props) {
  const mat = useBlocks(night, '#cfe6ff', 0.4)
  const at = useMemo(() => {
    const out: At[] = []
    const z = -14
    out.push({ p: [0, 0.05, 14], s: [80, 0.1, 30], c: '#cfc9be' }, { p: [0, 15, z - 20], s: [90, 30, 26], c: '#9aa8b4' })
    for (let i = 0; i < 60; i++) {
      const y = i * 5
      const t = y / 300
      const w = 60 * (1 - t * 0.55)
      if (y < 190) out.push({ p: [0, y + 2.5, z], s: [w, 5, 22 - t * 6], c: i % 2 ? '#7f93a6' : '#8aa0b4' })
      else {
        // The opening: two arms curving in to meet at the top.
        const open = Math.sqrt(Math.max(0, 1 - ((y - 190) / 112) ** 2)) * w * 0.8
        for (const sd of [-1, 1]) out.push({ p: [sd * (open / 2 + (w - open) / 4), y + 2.5, z], s: [Math.max(2, (w - open) / 2), 5, 14], c: i % 2 ? '#7f93a6' : '#8aa0b4' })
      }
    }
    out.push({ p: [0, 300, z], s: [6, 2, 12], c: '#5c6a76' }, { p: [0, 270, z], s: [34, 3, 6], c: '#4a5560' })
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/** The Dome of the Rock on its esplanade above the old city's wall: the octagon of blue and white faïence, the golden dome; below, the Western Wall's great stones and its plaza. */
function DomeOfTheRock({ night }: Props) {
  const mat = useBlocks(night, '#ffe8b8', 0.28)
  const at = useMemo(() => {
    const out: At[] = []
    const base = 12
    out.push({ p: [0, base / 2, -30], s: [120, base, 80], c: '#d9c9a8' })
    // The Western Wall facing the street, its courses of great pale stones, the plaza.
    for (let i = 0; i < 6; i++) out.push({ p: [0, 1 + i * 2, 10.1], s: [58, 1.9, 0.6], c: i % 2 ? '#e3d6b8' : '#d6c7a4' })
    out.push({ p: [0, 0.05, 20], s: [70, 0.1, 22], c: '#cfc3a8' }, { p: [0, 1, 18], s: [0.2, 2, 14], c: '#8a8070' })
    // The octagon, its drum, its golden dome.
    octo(out, [0, base + 6, -30], 22, 12, '#2f6db5', '#e9ecef')
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8
      out.push({ p: [Math.sin(a) * 9.3, base + 5, -30 + Math.cos(a) * 9.3], s: [3, 6, 0.3], ry: a, c: '#1c4f8f' })
    }
    out.push({ p: [0, base + 12.5, -30], s: [24, 1, 24], ry: Math.PI / 8, c: '#d9c9a8' })
    octo(out, [0, base + 15, -30], 13, 5, '#2f6db5', '#3d7cc9')
    dome(out, [0, base + 17.5, -30], 7, 6, GOLD, '#d4af37', 1.15)
    out.push({ p: [0, base + 26, -30], s: [0.4, 2, 0.4], c: GOLD })
    // The cypresses and the olive trees on the esplanade.
    const r = seeded(691)
    for (let i = 0; i < 10; i++) {
      const x = -50 + i * 11
      const zz = -55 + r() * 8
      out.push({ p: [x, base + 3, zz], s: [1.6, 6, 1.6], c: '#3f6b3a' })
    }
    return out
  }, [])
  const people = usePeople('kotel', [
    { p: [-6, 0.1, 13], ry: Math.PI, pose: 'pray', gender: 'homme', dress: { outfit: 'suit', outfitColor: '#111111' } },
    { p: [3, 0.1, 13.4], ry: Math.PI, pose: 'pray', gender: 'homme' },
    { p: [12, 0.1, 14], ry: Math.PI, pose: 'pray', gender: 'femme' },
    { p: [-14, 0.1, 22], ry: 0.4, pose: 'walk' },
    { p: [8, 0.1, 25], ry: 2.6, pose: 'film' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** Al-Khazneh, the Treasury of Petra: the pink cliff, the façade carved in it (40 m), its six columns, its pediment, the tholos and its urn above; the Siq's mouth beside. */
function Khazneh({ night }: Props) {
  const mat = useBlocks(night, '#ffd0a8', 0.15)
  const at = useMemo(() => {
    const out: At[] = []
    const R = '#c9785a'
    const R2 = '#b86a4e'
    const F = '#d98e6c'
    const z = -12
    out.push({ p: [0, 30, z - 8], s: [90, 60, 16], c: R }, { p: [-38, 30, z + 10], s: [14, 60, 30], c: R2 }, { p: [38, 30, z + 10], s: [14, 60, 30], c: R2 })
    out.push({ p: [0, 20, z - 0.5], s: [30, 40, 1], c: F })
    // The lower order: six columns, the doorway, the pediment.
    for (let i = 0; i < 6; i++) octo(out, [-12.5 + i * 5, 6.5, z + 1], 1.6, 13, '#e3a27f')
    out.push({ p: [0, 4, z + 0.2], s: [3, 8, 0.3], c: '#3a2418' }, { p: [0, 14, z + 1.2], s: [30, 2, 2.4], c: '#e3a27f' })
    for (let i = 0; i < 4; i++) out.push({ p: [0, 15.5 + i, z + 1.2], s: [24 - i * 6, 1, 2], c: '#e3a27f' })
    // The upper order: the tholos and its urn between the half-pediments.
    for (const sd of [-1, 1]) {
      octo(out, [sd * 11, 27, z + 1], 1.4, 10, '#e3a27f')
      octo(out, [sd * 7.5, 27, z + 1], 1.4, 10, '#e3a27f')
      out.push({ p: [sd * 9.2, 33, z + 1], s: [6, 1.6, 2], c: '#e3a27f' })
    }
    octo(out, [0, 28, z + 1.5], 6, 12, '#e3a27f', '#d98e6c')
    dome(out, [0, 34, z + 1.5], 3.2, 3, '#e3a27f')
    out.push({ p: [0, 38, z + 1.5], s: [1.4, 2, 1.4], c: '#e3a27f' })
    out.push({ p: [0, 0.05, 10], s: [60, 0.1, 30], c: '#d9a07a' })
    return out
  }, [])
  const people = usePeople('khazneh', [
    { p: [3, 0.1, 10], ry: Math.PI, pose: 'film' },
    { p: [-6, 0.1, 14], ry: 0.4, pose: 'walk' },
    { p: [10, 0.1, 12], ry: -2.4, pose: 'talk', gender: 'homme', dress: { outfit: 'imam', outfitColor: '#e9dcc0' } },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Azadi tower (45 m, 1971): the white marble legs rising from a wide base, the arch between them, the narrow top, on its great round square. */
function Azadi({ night }: Props) {
  const mat = useBlocks(night, '#e6f0ff', 0.3)
  const at = useMemo(() => {
    const out: At[] = []
    out.push({ p: [0, 0.05, 0], s: [110, 0.1, 110], c: '#cfc9be' })
    ring(out, [0, 0.12, 0], 50, 48, [6.6, 0.12, 2], '#9fc37a')
    for (let i = 0; i < 45; i++) {
      const y = i + 0.5
      const t = i / 45
      const spread = 16 * (1 - t) ** 1.6
      const w = 6 + 10 * (1 - t)
      const d = 22 * (1 - t * 0.75)
      if (y < 22) for (const sd of [-1, 1]) out.push({ p: [sd * (spread + w / 4), y, 0], s: [w / 2 + 2, 1, d], c: i % 2 ? '#efeae0' : '#e6e0d2' })
      else out.push({ p: [0, y, 0], s: [Math.max(4, 2 * spread + w / 2), 1, d], c: i % 2 ? '#efeae0' : '#e6e0d2' })
    }
    // The arch's turquoise tiles under its vault, the top's little windows.
    for (let i = 0; i < 6; i++) out.push({ p: [0, 18 + i * 0.8, 0], s: [14 - i * 2, 0.6, 3], c: '#3bc9db' })
    for (let i = 0; i < 4; i++) out.push({ p: [-3 + i * 2, 40, 5.4], s: [0.8, 2, 0.2], c: '#3d5a80' })
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/** The Imam mosque on Naqsh-e Jahan: the great iwan of the entrance under its two minarets, the blue dome on its drum behind, all faïence. */
function ImamMosque({ night }: Props) {
  const mat = useBlocks(night, '#cfe6ff', 0.3)
  const at = useMemo(() => {
    const out: At[] = []
    const B = '#1f6fb2'
    const B2 = '#2b8ac6'
    const Y = '#e9c46a'
    const z = -10
    out.push({ p: [0, 0.05, 20], s: [80, 0.1, 40], c: '#d9cfb8' }, { p: [0, 0.3, 26], s: [30, 0.5, 14], c: '#3b82c4' })
    // The portal: a tall frame with its pointed vault, the muqarnas in bands.
    out.push({ p: [0, 14, z], s: [26, 28, 6], c: B })
    out.push({ p: [0, 10, z + 2.6], s: [12, 20, 1.4], c: '#13385e' })
    for (let i = 0; i < 6; i++) out.push({ p: [0, 20 + i * 1.2, z + 3.1], s: [12 - i * 2, 1.2, 0.6], c: i % 2 ? Y : B2 })
    out.push({ p: [0, 28.5, z], s: [27, 1, 7], c: Y })
    for (const sd of [-1, 1]) minaret(out, [sd * 10, z], 42, 3, B, B2, Y)
    // The arcades either side, on two storeys.
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) {
      out.push({ p: [sd * (18 + i * 5), 6, z], s: [4.6, 12, 4], c: B2 }, { p: [sd * (18 + i * 5), 5, z + 2.1], s: [2.6, 6, 0.4], c: '#13385e' })
    }
    // The prayer hall behind (turned toward Mecca), its drum and blue dome (52 m), its own pair of minarets.
    out.push({ p: [8, 9, z - 44], s: [50, 18, 30], c: '#c9b48a' })
    octo(out, [8, 24, z - 44], 26, 12, B, B2)
    dome(out, [8, 30, z - 44], 14, 7, B2, B, 1.35)
    out.push({ p: [8, 50, z - 44], s: [0.6, 3, 0.6], c: Y })
    for (const sd of [-1, 1]) minaret(out, [8 + sd * 18, z - 30], 48, 3, B, B2, Y)
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/** The Raouché rocks (Pigeon Rocks), off Beirut's corniche: the two great arches of pale rock in the blue sea, the cliff and the promenade. */
function Raouche({ night }: Props) {
  const mat = useBlocks(night, '#ffe8c0', 0.1)
  const at = useMemo(() => {
    const out: At[] = []
    const C = '#d8cdb4'
    const C2 = '#c4b898'
    out.push({ p: [0, -1, -40], s: [140, 2, 70], c: '#2f7fbf' }, { p: [0, 3, 6], s: [140, 6, 14], c: C2 }, { p: [0, 6.1, 10], s: [140, 0.2, 8], c: '#bcb5a6' })
    // The big rock and its arch, the small one.
    const rock = (cx: number, cz: number, w: number, h: number, arch: number, seed: number) => {
      const r = seeded(seed)
      for (let y = 0; y < h; y += 3) {
        const ww = w * (1 - y / (h * 1.6))
        for (const sd of [-1, 1]) if (y < arch) out.push({ p: [cx + sd * (ww / 3), y + 1.5, cz], s: [ww / 3 + r() * 2, 3, w * 0.5], c: y % 6 ? C : C2 })
        if (y >= arch) out.push({ p: [cx + r() * 2 - 1, y + 1.5, cz], s: [ww, 3, w * 0.5 + r() * 2], c: y % 6 ? C : C2 })
      }
    }
    rock(-8, -36, 30, 40, 15, 3)
    rock(24, -48, 14, 18, 7, 4)
    // The railing of the corniche.
    for (let x = -64; x <= 64; x += 4) out.push({ p: [x, 6.8, 13.6], s: [0.15, 1.2, 0.15], c: '#e9ecef' })
    out.push({ p: [0, 7.4, 13.6], s: [130, 0.12, 0.12], c: '#e9ecef' })
    return out
  }, [])
  const people = usePeople('raouche', [
    { p: [-4, 6.3, 11], ry: Math.PI, pose: 'film' },
    { p: [6, 6.3, 12], ry: Math.PI, pose: 'talk', gender: 'femme' },
    { p: [14, 6.3, 10], ry: 1.4, pose: 'run' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Sydney Opera House: the platform on Bennelong Point, its shells of white tiles (the sails) in two rows, the stairs. */
function OperaSydney({ night }: Props) {
  const mat = useBlocks(night, '#fff4d6', 0.35)
  const at = useMemo(() => {
    const out: At[] = []
    out.push({ p: [0, -1, -20], s: [160, 2, 120], c: '#2f7fbf' })
    out.push({ p: [0, 3, -20], s: [70, 6, 120], c: '#c9a27a' }, { p: [0, 6.1, -20], s: [70, 0.2, 120], c: '#d9b48a' })
    for (let i = 0; i < 8; i++) out.push({ p: [0, 0.5 + i * 0.75, 42 + i * -1.2], s: [60, 0.75, 2], c: '#c9a27a' })
    // A shell: tilted slabs climbing to a crest, narrowing; facing the harbour (−z).
    const shell = (x: number, z: number, h: number, w: number) => {
      const n = 10
      for (let i = 0; i < n; i++) {
        const t = i / n
        const y = 6 + h * Math.sin(t * Math.PI * 0.55)
        out.push({ p: [x, y, z - t * h * 0.9], s: [w * (1 - t * 0.7), 3, h * 0.12], ry: 0, c: i % 2 ? '#f8f9fa' : '#eceae3' })
        out.push({ p: [x, (6 + y) / 2, z - t * h * 0.9 + 1], s: [w * (1 - t * 0.7) * 0.92, y - 6, 0.6], c: '#efece4' })
      }
    }
    for (const x of [-16, 16]) {
      shell(x, 30, 50, 26)
      shell(x, 2, 40, 22)
      shell(x, -22, 28, 16)
    }
    shell(0, -48, 18, 14)
    return out
  }, [])
  const people = usePeople('opera', [
    { p: [4, 0.1, 50], ry: Math.PI, pose: 'film' },
    { p: [-8, 6.3, 34], ry: 0.4, pose: 'walk' },
    { p: [12, 0.1, 52], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Sydney Harbour Bridge: the steel arch (503 m span, 134 m high) in its grey, the deck hung under it, the four granite pylons. */
function HarbourBridge({ night }: Props) {
  const mat = useBlocks(night, '#fff3bf', 0.3)
  const at = useMemo(() => {
    const out: At[] = []
    const G = '#7d8790'
    const span = 250
    out.push({ p: [0, -1, -40], s: [320, 2, 140], c: '#2f7fbf' })
    for (const sd of [-1, 1]) {
      for (const dz of [-14, 14]) out.push({ p: [sd * (span / 2 + 8), 30, -40 + dz], s: [14, 60, 12], c: '#c9b79c' })
      out.push({ p: [sd * (span / 2 + 40), 25, -40], s: [60, 2, 30], c: '#5c6670' })
    }
    // The arch: its top and bottom chords, the struts between.
    for (let i = 0; i <= 50; i++) {
      const t = i / 50
      const x = -span / 2 + t * span
      const yTop = 6 + 128 * (1 - (2 * t - 1) ** 2) * 0.62 + 38
      const yBot = 6 + 128 * (1 - (2 * t - 1) ** 2) * 0.62
      for (const dz of [-12, 12]) {
        out.push({ p: [x, yTop, -40 + dz], s: [span / 50 + 1, 3, 2.4], c: G })
        out.push({ p: [x, Math.max(6, yBot), -40 + dz], s: [span / 50 + 1, 3, 2.4], c: G })
        if (i % 2 === 0) out.push({ p: [x, (yTop + Math.max(6, yBot)) / 2, -40 + dz], s: [1.2, yTop - Math.max(6, yBot), 1.2], c: G })
        if (yBot > 52) out.push({ p: [x, (yBot + 50) / 2, -40 + dz], s: [0.5, yBot - 50, 0.5], c: G })
      }
      if (i % 5 === 0) out.push({ p: [x, yTop, -40], s: [1.4, 1.4, 24], c: G })
    }
    // The deck, 49 m over the water.
    out.push({ p: [0, 50, -40], s: [span + 40, 3, 28], c: '#5c6670' }, { p: [0, 51.6, -40], s: [span + 40, 0.2, 26], c: '#3a3f44' })
    for (const dz of [-13, 13]) out.push({ p: [0, 52.4, -40 + dz], s: [span + 40, 1.2, 0.3], c: G })
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/** Auckland's Sky Tower (328 m): the concrete shaft on its three legs, the pod of observation decks, the mast. */
function SkyTower({ night }: Props) {
  const mat = useBlocks(night, '#fff3bf', 0.35)
  const at = useMemo(() => {
    const out: At[] = []
    out.push({ p: [0, 0.05, 14], s: [60, 0.1, 30], c: '#cfc9be' }, { p: [0, 8, -14], s: [50, 16, 24], c: '#8a95a0' })
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2
      out.push({ p: [Math.sin(a) * 5, 30, -14 + Math.cos(a) * 5], s: [3, 60, 3], ry: a, c: '#d6d2c8' })
    }
    octo(out, [0, 100, -14], 10, 200, '#e0ddd4', '#d6d2c8')
    for (let i = 0; i < 5; i++) octo(out, [0, 186 + i * 4.5, -14], 20 - Math.abs(i - 2) * 3, 4.4, i % 2 ? '#3d5a80' : '#e0ddd4', '#d6d2c8')
    octo(out, [0, 222, -14], 8, 20, '#e0ddd4')
    spire(out, [0, 232, -14], 3, 96, 8, '#c9cfd6', '#e9ecef')
    return out
  }, [])
  return <Blocks at={at} material={mat} color />
}

/** The landmarks of the Middle East and Oceania, by place (moyenOrientLandmarks.ts gives their ground). */
export function MoyenOrientLandmark({ id, night }: { id: string; night: boolean }) {
  switch (id) {
    case 'mecque-masjid-al-haram':
      return <MasjidAlHaram night={night} />
    case 'medine-masjid-nabawi':
      return <MasjidNabawi night={night} />
    case 'auh-grande-mosquee':
      return <ZayedMosque night={night} />
    case 'dxb-burj-khalifa':
      return <BurjKhalifa night={night} />
    case 'dxb-deira-naif':
      return <SoukDeira night={night} />
    case 'ryd-kingdom-centre':
      return <KingdomCentre night={night} />
    case 'jlm-dome-rocher':
      return <DomeOfTheRock night={night} />
    case 'petra-tresor':
      return <Khazneh night={night} />
    case 'teh-azadi-tour':
      return <Azadi night={night} />
    case 'isf-mosquee-imam':
      return <ImamMosque night={night} />
    case 'bey-hamra-raouche':
      return <Raouche night={night} />
    case 'syd-opera':
      return <OperaSydney night={night} />
    case 'syd-harbour-bridge':
      return <HarbourBridge night={night} />
    case 'auckland-sky-tower':
      return <SkyTower night={night} />
    default:
      return null
  }
}
