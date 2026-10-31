import type { Look } from '../../lib/types'
import { tint } from '../textures'
import { waxPx } from '../BlockHuman'
import { frontness, type F, type Paint, type V3 } from './atlas'

// The detailed Sim's pixels: grain, prints, the 16-texel face and the hair's
// layer. Everything is painted in code, texel by texel.

export function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}
export const grain = (c: string, x: number, y: number, k = 0.08) => tint(c, (hash(x, y) - 0.5) * k)
export function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}
/** Mixes two hex colours. */
export function mix(a: string, b: string, k: number) {
  const [x, y] = [parseInt(a.slice(1), 16), parseInt(b.slice(1), 16)]
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k)
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}
export const isSide = (f: F) => f !== 'py' && f !== 'ny'

/** Plain cloth, a little grain. */
export const clothP = (c: string, k = 0.07): Paint => (_f, _x, _y, _w, _h, ax, ay) => grain(c, ax, ay, k)
/** Denim: a diagonal twill, a little fade. */
export const denimPx = (c: string, ax: number, ay: number) => ((ax + ay) % 3 === 0 ? tint(c, 0.12) : grain(c, ax, ay, 0.08))

/** Prints whose shapes are drawn by distance: sampled at half a print pixel, their edges come out rounder. */
const SMOOTH = new Set(['cercles', 'losanges', 'points', 'fleurs', 'adinkra'])
/**
 * A wax print at the detailed Sim's scale: the same print as BlockHuman's, at the same size on the
 * body (a print pixel is two texels), so it reads from afar as it always did; the round motifs get
 * smoother edges from the finer texels.
 */
export function waxBig(color: string, motif: string, ax: number, ay: number) {
  if (SMOOTH.has(motif)) return waxPx(color, motif, ax / 2 - 0.25, ay / 2 - 0.25)
  return waxPx(color, motif, Math.floor(ax / 2), Math.floor(ay / 2))
}
export const waxP = (c: string, motif: string): Paint => (_f, _x, _y, _w, _h, ax, ay) => waxBig(c, motif, ax, ay)

/* ---------- Hair ---------- */

/** Hair, each style woven its own way. */
export function hairPx(style: string, c: string, ax: number, ay: number) {
  const n = hash(ax + 3, ay + 11)
  switch (style) {
    case 'braids':
    case 'nattes-perles':
      return ax % 3 === 0 ? tint(c, -0.4) : tint(c, (ay + (ax % 3)) % 3 === 0 ? 0.12 : -0.08)
    case 'cornrows':
      return ax % 3 === 0 ? tint(c, -0.45) : tint(c, (ay + Math.floor(ax / 3)) % 2 ? 0.07 : -0.12)
    case 'locks':
    case 'twists':
      return (ax + ay) % 3 === 0 ? tint(c, -0.34) : tint(c, (n - 0.5) * 0.26 + ((ax + ay) % 3 === 1 ? 0.06 : 0))
    case 'weave':
    case 'bob':
    case 'ponytail':
      // Long strands down, a band of shine.
      return ax % 3 === 0 ? tint(c, -0.18) : ay % 12 === 4 ? tint(c, 0.16) : tint(c, (n - 0.5) * 0.12)
    default:
      // Coils: light tips, dark hollows.
      return n < 0.16 ? tint(c, 0.2) : n > 0.8 ? tint(c, -0.34) : tint(c, (n - 0.5) * 0.18)
  }
}

/** Rows of the hair layer covered: [front, sides at the front, back] (17 texels a side). */
const SHELL_LINE: Record<string, V3> = {
  short: [3, 5, 9],
  degrade: [3, 4, 9],
  afro: [4, 6, 12],
  locks: [4, 8, 16],
  twists: [4, 6, 12],
  braids: [3, 6, 16],
  'nattes-perles': [3, 6, 16],
  cornrows: [2, 5, 12],
  puffs: [2, 5, 9],
  couettes: [2, 5, 9],
  bantu: [2, 5, 10],
  bun: [2, 5, 9],
  ponytail: [2, 5, 9],
  weave: [4, 16, 16],
  bob: [6, 14, 14],
  touffe: [2, 4, 7],
}

/** The hair's layer, a texel bigger than the head all round: its hairline, partings and fades. */
export function shellPaint(style: string, c: string, femme: boolean): Paint {
  const [front, side, back] = SHELL_LINE[style] ?? SHELL_LINE.short
  const part = (ax: number, ay: number) => hairPx(style, c, ax, ay)
  return (f, x, y, w, _h, ax, ay) => {
    if (f === 'ny') return null
    if (f === 'py') {
      // Partings: the scalp shows between braids and cornrows, a side parting on a weave.
      if ((style === 'braids' || style === 'nattes-perles' || style === 'cornrows') && x % 3 === 0) return tint(c, -0.5)
      if ((style === 'puffs' || style === 'couettes') && x === 8) return '#5a3a2a'
      if (style === 'weave' && x === 5 && y < 9) return tint(c, -0.45)
      if (style === 'degrade' && (x === 0 || x === w - 1)) return tint(c, 0.2)
      return part(ax, ay)
    }
    if (f === 'pz') {
      if (style === 'bob') {
        // The fringe straight across, curving down to the cheeks.
        const rows = x <= 1 || x >= w - 2 ? 9 : x <= 3 || x >= w - 4 ? 7 : front
        return y < rows ? part(ax, ay) : null
      }
      if (style === 'weave') {
        // A side parting sweeping down over the left of the forehead.
        const rows = x < 7 ? front + Math.max(0, 3 - Math.floor(x / 2)) : x >= w - 2 ? front + 2 : front
        return y < rows ? part(ax, ay) : null
      }
      // A soft hairline: every other texel on the last row, the temples a row lower.
      const rows = front + (x <= 1 || x >= w - 2 ? 1 : 0)
      if (y < rows - 1) return part(ax, ay)
      if (y === rows - 1) return (x + y) % 2 ? part(ax, ay) : null
      return null
    }
    const fr = frontness(f, x, w)
    let rows = f === 'nz' ? back : Math.round(back + (side - back) * fr)
    // Sideburns in front of the ears (men's short hair).
    if (!femme && (style === 'short' || style === 'degrade') && (f === 'px' || f === 'nx') && fr > 0.75 && fr < 0.95) rows = 10
    if (y >= rows) return null
    if (style === 'degrade' && f !== 'nz' && y >= 2) {
      // The fade: lighter going down, sparse at the bottom, a line shaved in on the left.
      if (f === 'nx' && y === 3 && fr > 0.3 && fr < 0.8) return null
      return y === rows - 1 ? ((x + y) % 2 ? tint(c, 0.4) : null) : tint(c, 0.12 + (y - 2) * 0.08)
    }
    if (f === 'nz' && style === 'bantu' && y < back && x % 6 === 2) return '#5a3a2a'
    if (style !== 'weave' && style !== 'bob' && y === rows - 1 && (x + y) % 2) return null
    return part(ax, ay)
  }
}

/* ---------- The face, 16 texels ---------- */

/** What the face shows besides itself: the age (child, elder), the shades, the bobos. */
export type FaceOpts = { femme: boolean; child: boolean; elder: boolean; beard: string; shades: boolean; marks: string }

export function headPaint(l: Required<Look>, o: FaceOpts): Paint {
  const { femme, child, elder, beard, shades } = o
  const skin = l.skin
  const brow = elder ? tint(l.hairColor, -0.25) : tint(l.hairColor, -0.1)
  const lash = '#160c08'
  // Lips: the upper one in shade, the lower one catching the light (rosier for women).
  const lipUp = femme ? mix(tint(skin, -0.3), '#6a1f2a', 0.32) : mix(tint(skin, -0.3), '#4a2024', 0.15)
  const lipLow = femme ? mix(tint(skin, -0.02), '#b0505c', 0.38) : mix(tint(skin, -0.08), '#8a4a4a', 0.16)
  const blush = mix(skin, '#c0504a', femme || child ? 0.16 : 0.07)
  const bc = (x: number, y: number) => grain(tint(l.hairColor, 0.05), x, y, 0.24)
  const plaster = o.marks === 'pansement' || o.marks === 'bagarre'
  const scratch = o.marks === 'griffures' || o.marks === 'bagarre'
  const face = (x: number, y: number, ax: number, ay: number) => {
    const mx = x < 8 ? x : 15 - x // mirrored column, 0 at the edge
    const right = x >= 8
    // The bobos: a plaster on the right cheek, scratches on the left.
    if (plaster && x >= 11 && x <= 13 && y >= 9 && y <= 11) return x === 12 && y === 10 ? '#d9a96e' : '#ecc996'
    if (scratch && x <= 3 && y >= 9 && y <= 11 && (x + y) % 3 === 0) return '#a8322a'
    // Beards first (they cover the skin).
    if (beard !== 'none') {
      const stache = y === 11 && mx >= 5 && mx <= 7
      const chin = y >= 14 && mx >= (beard === 'bouc' ? 5 : 4)
      const jaw = (y >= 11 && mx === 0) || (y >= 13 && mx <= 2) || (y === 15 && mx >= 2)
      if ((beard === 'moustache' || beard === 'bouc' || beard === 'full' || beard === 'longue') && stache) return bc(ax, ay)
      if ((beard === 'bouc' || beard === 'full' || beard === 'longue') && (chin || (beard !== 'bouc' && y === 13 && mx === 4))) return bc(ax, ay)
      if ((beard === 'full' || beard === 'longue') && jaw) return bc(ax, ay)
      if (beard === 'collier' && (y === 15 || (mx === 0 && y >= 9))) return bc(ax, ay)
    }
    // Brows: an arch, its tail dropping at the outer end; the upper lid's line, lashes past the corner.
    if (y === 4 && mx >= 4 && mx <= 6) return femme && mx === 6 ? tint(brow, 0.2) : brow
    if (y === 5 && mx === 3) return femme ? tint(brow, 0.25) : brow
    if (!shades) {
      // The upper lid: a crease in shade for men, lashes for women (winged past the corner).
      if (y === 6 && mx >= 3 && mx <= 6) return femme ? (mx === 6 ? tint(skin, -0.3) : lash) : mx === 6 ? tint(skin, -0.22) : tint(skin, -0.45)
      if (y === 6 && mx === 2 && femme) return lash
      if ((y === 7 || y === 8) && mx >= 3 && mx <= 6) {
        // From the inside: white, iris (catchlight top), white; the pupil inside.
        const col = x < 8 ? x - 3 : x - 9 // 0..3 left to right
        if (col === 0 || col === 3) return y === 7 ? '#fbf8f3' : '#e8e1d6'
        if (y === 7 && col === 1) return '#ffffff'
        return col === 2 && y === 8 ? tint(l.eyes, -0.5) : y === 8 ? l.eyes : tint(l.eyes, -0.25)
      }
    }
    if (y === 9 && mx >= 3 && mx <= 6) return tint(skin, elder ? -0.14 : -0.07) // under the eyes
    // An elder's forehead lines, the creases by the mouth.
    if (elder && (y === 2 || y === 3) && mx >= 3 && (x + y) % 2 === 0) return tint(skin, -0.14)
    if (elder && y >= 11 && y <= 12 && mx === 3) return tint(skin, -0.16)
    // The nose: a lit bridge, the wings in shade, two nostrils.
    if (mx === 7 && y >= 7 && y <= 9) return tint(skin, 0.1)
    if (y === 10 && mx === 6) return tint(skin, -0.2)
    if (y === 10 && mx === 7) return tint(skin, 0.14)
    if (y === 11 && mx === 6) return tint(skin, -0.42)
    if (y === 11 && mx === 7) return tint(skin, -0.12)
    if (y === 9 && mx === 6) return tint(skin, -0.06)
    // Cheeks.
    if ((y === 10 || y === 11) && (mx === 2 || mx === 3)) return blush
    if (y === 9 && mx === 2) return tint(skin, 0.05)
    // The mouth: two-tone lips, corners in shade.
    if (y === 12 && mx === 4) return tint(skin, -0.24)
    if (y === 12 && mx >= 5) return lipUp
    if (y === 13 && mx >= 5) return mx === 6 && !right ? tint(lipLow, 0.2) : lipLow
    if (y === 14 && mx >= 5) return tint(skin, -0.09)
    // Round the face: the sides and the jaw a little in shade, the forehead lit.
    if (y === 15) return tint(skin, -0.1)
    if (mx === 0) return tint(skin, -0.06)
    if (y <= 2) return tint(skin, 0.03)
    return grain(skin, ax, ay, 0.025)
  }
  return (f, x, y, w, h, ax, ay) => {
    if (f === 'pz') return face(x, y, ax, ay)
    if (f === 'ny') return tint(skin, -0.2)
    if (f === 'py') return tint(skin, -0.12) // stubble on a shaved head, hidden under hair
    if (beard === 'full' || beard === 'longue' || beard === 'collier') {
      const fr = frontness(f, x, w)
      if (f !== 'nz' && beard === 'collier' && fr > 0.85 && y >= 9) return bc(ax, ay)
      if (f !== 'nz' && beard !== 'collier' && fr > 0.72 && y >= 10 - (fr > 0.9 ? 4 : 0)) return bc(ax, ay)
    }
    return y === h - 1 ? tint(skin, -0.1) : grain(skin, ax, ay, 0.025)
  }
}

/* ---------- Worn clothes ---------- */

const MUD = '#7a6850'
/** Clothes worn out: a muddy fade and stains; torn, holes where the skin shows. */
export function wearPx(c: string, wear: string, skin: string, ax: number, ay: number) {
  if (wear !== 'use' && wear !== 'dechire') return c
  const torn = wear === 'dechire'
  const h = hash(ax * 1.55 + 7, ay * 0.85)
  if (torn && h > 0.95) return tint(skin, -0.12)
  const faded = mix(c, MUD, torn ? 0.42 : 0.22)
  return h < (torn ? 0.14 : 0.07) ? tint(faded, -0.38) : faded
}
