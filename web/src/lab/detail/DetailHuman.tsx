import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../../lib/types'
import { accessoryColor, defaultColors, fullLook, hasAcc } from '../../avatar/options'
import { tint } from '../../avatar/textures'
import { useCastShadows, usePoseRig, type Pose, type RigStyle } from '../../avatar/Human'
import { waxPx } from '../../avatar/BlockHuman'
import { worldTime } from '../../lib/worldClock'
import { Kit, TX, frontness, type F, type Paint, type V3 } from './atlas'

// PROTOTYPE (lab only, not in the game): « le Sim détaillé ». The same blocky
// Sim as BlockHuman (the same proportions, joints and poses), with more to it:
// a 16-texel face (eyes with whites, iris and catchlight, lids, brows, the
// nose's shading, two-tone lips), ears and a thumb as little blocks, shoes with
// a sole, cuffs, collars, belts and buckles, pockets, the pagne's knot and
// folds, hair in layered blocks (afro volume, hanging locks, beaded braids, the
// foulard's knot), and a bevel and ambient occlusion baked into every box.
// Every box of a body segment is merged into one mesh over one atlas per look,
// so it costs about the same draw calls as today's Sim (see the lab's counter).

type Props = { look: Look; gender: Sim['gender']; pose?: Pose; seed?: number; headScale?: number; speed?: number }

/* ---------- Proportions: today's (BlockHuman) ---------- */

const H = 0.32
const SHELL = 0.34 // the hair layer, a texel bigger all round
const HIP_Y = 0.84
const THIGH = 0.42
const SHIN = 0.42
const TORSO_BOTTOM = 0.82
const WAIST_Y = 1.06
const NECK_Y = 1.36
/** The chest's top: lower than today's, so a short neck shows under the head. */
const TOP = 1.32
const SHOULDER_Y = 1.3
const UPPER_ARM = 0.25
const FOREARM = 0.27
const BODY: Record<string, { w: number; limb: number; depth: number }> = {
  mince: { w: 0.88, limb: 0.88, depth: 0.9 },
  moyen: { w: 1, limb: 1, depth: 1 },
  fort: { w: 1.15, limb: 1.16, depth: 1.1 },
  rond: { w: 1.2, limb: 1.12, depth: 1.28 },
}
const STYLE: RigStyle = { snap: 1.1, swing: 1, elbow: 1, knee: 1, headBob: 0.4 }

/* ---------- Pixels ---------- */

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}
const grain = (c: string, x: number, y: number, k = 0.08) => tint(c, (hash(x, y) - 0.5) * k)
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}
/** Mixes two hex colours. */
function mix(a: string, b: string, k: number) {
  const [x, y] = [parseInt(a.slice(1), 16), parseInt(b.slice(1), 16)]
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k)
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}
const isSide = (f: F) => f !== 'py' && f !== 'ny'

const clothP = (c: string, k = 0.07): Paint => (_f, _x, _y, _w, _h, ax, ay) => grain(c, ax, ay, k)
const waxP = (c: string, motif: string): Paint => (_f, _x, _y, _w, _h, ax, ay) => waxPx(c, motif, ax, ay)
/** Denim: a diagonal twill, a little fade. */
const denimP = (c: string): Paint => (_f, _x, _y, _w, _h, ax, ay) => ((ax + ay) % 3 === 0 ? tint(c, 0.12) : grain(c, ax, ay, 0.08))

/** Hair, each style woven its own way. */
function hairPx(style: string, c: string, ax: number, ay: number) {
  const n = hash(ax + 3, ay + 11)
  switch (style) {
    case 'braids':
    case 'nattes-perles':
      return ax % 3 === 0 ? tint(c, -0.4) : tint(c, (ay + (ax % 3)) % 3 === 0 ? 0.12 : -0.08)
    case 'locks':
    case 'twists':
      return (ax + ay) % 3 === 0 ? tint(c, -0.34) : tint(c, (n - 0.5) * 0.26 + ((ax + ay) % 3 === 1 ? 0.06 : 0))
    default:
      // Coils: light tips, dark hollows.
      return n < 0.16 ? tint(c, 0.2) : n > 0.8 ? tint(c, -0.34) : tint(c, (n - 0.5) * 0.18)
  }
}

/* ---------- The face, 16 texels ---------- */

function headPaint(l: Required<Look>, femme: boolean, young: boolean): Paint {
  const skin = l.skin
  const brow = tint(l.hairColor, -0.1)
  const lash = '#160c08'
  // Lips: the upper one in shade, the lower one catching the light (rosier for women).
  const lipUp = femme ? mix(tint(skin, -0.3), '#6a1f2a', 0.32) : mix(tint(skin, -0.3), '#4a2024', 0.15)
  const lipLow = femme ? mix(tint(skin, -0.02), '#b0505c', 0.38) : mix(tint(skin, -0.08), '#8a4a4a', 0.16)
  const blush = mix(skin, '#c0504a', femme || young ? 0.16 : 0.07)
  const beard = !young ? l.beard : 'none'
  const bc = (x: number, y: number) => grain(tint(l.hairColor, 0.05), x, y, 0.24)
  const face = (x: number, y: number, ax: number, ay: number) => {
    const mx = x < 8 ? x : 15 - x // mirrored column, 0 at the edge
    const right = x >= 8
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
    // The upper lid: a crease in shade for men, lashes for women (winged past the corner).
    if (y === 6 && mx >= 3 && mx <= 6) return femme ? (mx === 6 ? tint(skin, -0.3) : lash) : mx === 6 ? tint(skin, -0.22) : tint(skin, -0.45)
    if (y === 6 && mx === 2 && femme) return lash
    if (y === 7 || y === 8) {
      if (mx >= 3 && mx <= 6) {
        // From the inside: white, iris (catchlight top), white; the pupil inside.
        const col = x < 8 ? x - 3 : x - 9 // 0..3 left to right
        if (col === 0 || col === 3) return y === 7 ? '#fbf8f3' : '#e8e1d6'
        if (y === 7 && col === 1) return '#ffffff'
        return col === 2 && y === 8 ? tint(l.eyes, -0.5) : y === 8 ? l.eyes : tint(l.eyes, -0.25)
      }
    }
    if (y === 9 && mx >= 3 && mx <= 6) return tint(skin, -0.07) // under the eyes
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
    if (beard === 'full' || beard === 'longue') {
      const fr = frontness(f, x, w)
      if (f !== 'nz' && fr > 0.72 && y >= 10 - (fr > 0.9 ? 4 : 0)) return bc(ax, ay)
    }
    return y === h - 1 ? tint(skin, -0.1) : grain(skin, ax, ay, 0.025)
  }
}

/* ---------- Hair ---------- */

/** Rows of the hair layer covered: [front, sides at the front, back]; and how its hairline goes. */
const SHELL_LINE: Record<string, V3> = {
  short: [3, 6, 9],
  degrade: [3, 4, 9],
  afro: [4, 6, 12],
  locks: [3, 6, 13],
  twists: [3, 6, 12],
  braids: [3, 6, 13],
  'nattes-perles': [3, 6, 13],
  cornrows: [2, 6, 13],
  puffs: [2, 5, 10],
  bantu: [2, 5, 10],
  bun: [2, 5, 9],
  ponytail: [2, 5, 9],
}

function shellPaint(style: string, c: string, femme: boolean): Paint {
  const [front, side, back] = SHELL_LINE[style] ?? SHELL_LINE.short
  const part = (ax: number, ay: number) => hairPx(style, c, ax, ay)
  return (f, x, y, w, _h, ax, ay) => {
    if (f === 'ny') return null
    if (f === 'py') {
      // Partings: the scalp shows between braids, knots and puffs.
      if ((style === 'braids' || style === 'nattes-perles' || style === 'cornrows') && x % 3 === 0) return tint(c, -0.5)
      if (style === 'bantu' && (x % 6 === 2 || y % 6 === 2)) return '#5a3a2a'
      if (style === 'puffs' && x === 8) return '#5a3a2a'
      if (style === 'degrade' && (x === 0 || x === w - 1)) return tint(c, 0.2)
      return part(ax, ay)
    }
    if (f === 'pz') {
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
    if (y === rows - 1 && (x + y) % 2) return null
    return part(ax, ay)
  }
}

/* ---------- What is worn ---------- */

type Shoe = 'sneaker' | 'dress' | 'sandal' | 'boot'
type Skirt = { paint: Paint; w: number; d: number; hem: number; band?: string; wrap?: boolean; frill?: string }
type Dress = {
  top: Paint
  waist: Paint
  /** How far down the arm the sleeves go (metres from the shoulder's top; 0 sleeveless). */
  sleeve: number
  sleeveP: Paint
  /** A cuff or hem block where the sleeve ends. */
  cuff?: string
  /** Puffed sleeves: a bigger block at the shoulder. */
  puff?: Paint
  /** The boubou's wide sleeves. */
  bell?: Paint
  /** Trousers' length from the hip (0 bare legs). */
  legs: number
  legP: Paint
  /** The trousers' hem, a block round the ankle. */
  hem?: string
  socks?: string
  shoe: Shoe
  shoeC: string
  skirt?: Skirt
  /** A collar block round the neck. */
  collar?: Paint
  /** Collars, belts, ties, pockets: blocks on the chest. */
  extras: (k: Kit, d: Dims) => void
}
type Dims = { tw: number; td: number; ww: number; wd: number; lw: number; ld: number; aw: number; hipX: number; shX: number }

function dressFor(l: Required<Look>, femme: boolean): Dress {
  const skin = l.skin
  const top = l.outfitColor
  const dc = defaultColors(l, femme)
  const bottom = l.bottomColor || dc.bottom
  const shoeC = l.shoeColor || dc.shoe
  const skinP: Paint = (_f, _x, _y, _w, _h, ax, ay) => grain(skin, ax, ay, 0.025)
  const outfit = !femme && (l.outfit === 'kaba' || l.outfit === 'robe') ? 'boubou' : !femme && l.outfit === 'pagne' ? 'chemise-pagne' : l.outfit
  const front = (d: Dims) => d.td / 2
  const thread = (c: string) => (luminance(c) > 0.6 ? tint(c, -0.45) : '#e8b93c')

  switch (outfit) {
    case 'suit': {
      const tie = top === '#b02e0c' || top === '#d6336c' ? '#14213d' : '#c2255c'
      const jacket = clothP(top, 0.05)
      // The jacket open on the shirt, a V down to the button; the lapels lit on their edge.
      const vee = (f: F, x: number, y: number, w: number): string | null => {
        if (f !== 'pz') return null
        const c = (w - 1) / 2
        const half = Math.max(0, 3.2 - y * 0.32)
        if (Math.abs(x - c) <= half) return '#f4f5f7'
        if (Math.abs(x - c) <= half + 1.2 && y < 11) return tint(top, 0.16)
        return null
      }
      return {
        top: (f, x, y, w, h, ax, ay) => vee(f, x, y, w) ?? (f === 'pz' && y === 9 && (x === 3 || x === w - 4) ? tint(top, -0.3) : jacket(f, x, y, w, h, ax, ay)),
        waist: (f, x, y, w, h, ax, ay) => (f === 'pz' && Math.abs(x - (w - 1) / 2) < 0.6 && y < 3 ? tint(top, -0.25) : jacket(f, x, y, w, h, ax, ay)),
        sleeve: 0.52,
        sleeveP: jacket,
        cuff: '#f4f5f7',
        collar: (f, x, y) => (f === 'pz' && y === 0 && x > 3 && x < 5 ? '#d8dade' : '#f4f5f7'),
        legs: 0.86,
        legP: (f, x, _y, w, _h, ax, ay) => (f === 'pz' && x === Math.floor(w / 2) ? tint(bottom, 0.1) : grain(bottom, ax, ay, 0.05)),
        shoe: 'dress',
        shoeC,
        extras: (k, d) => {
          const z = front(d)
          // The tie and its knot, the lapels, the pocket square, the buttons, the flap pockets, the jacket's tail.
          k.add('chest', { s: [0.05, 0.035, 0.022], p: [0, TOP - 0.03, z + 0.008], paint: tint(tie, -0.1), bevel: 0.5 })
          k.add('chest', { s: [0.045, 0.2, 0.012], p: [0, TOP - 0.15, z + 0.004], paint: (f, x, y) => (f === 'pz' && (x + y) % 4 === 0 ? tint(tie, 0.2) : tie) })
          for (const s of [-1, 1]) {
            k.add('chest', { s: [0.035, 0.2, 0.012], p: [s * 0.065, TOP - 0.11, z + 0.002], r: [0, 0, s * 0.42], paint: clothP(tint(top, 0.08), 0.04) })
            k.add('chest', { s: [0.085, 0.016, 0.014], p: [s * d.ww * 0.3, 0.94, d.wd / 2 + 0.004], paint: tint(top, -0.12), bevel: 0.6 })
          }
          k.add('chest', { s: [0.06, 0.022, 0.012], p: [d.tw * 0.3, TOP - 0.13, z + 0.003], paint: (f, x) => (f === 'pz' && x % 2 ? '#ffd8e4' : '#f4f5f7') })
          for (const y of [1.02, 0.95]) k.add('chest', { s: [0.018, 0.018, 0.008], p: [0, y, d.wd / 2 + 0.003], paint: tint(top, -0.4), bevel: 0 })
          k.add('chest', { s: [d.tw * 1.02, 0.09, d.td * 1.06], p: [0, TORSO_BOTTOM + 0.025, 0], paint: (f, x, y, w, h, ax, ay) => (f === 'pz' && Math.abs(x - (w - 1) / 2) < 0.6 ? tint(top, -0.3) : jacket(f, x, y, w, h, ax, ay)) })
        },
      }
    }
    case 'chemise-pagne':
    case 'pagne':
    case 'kaba': {
      const wax = waxP(top, l.pattern)
      const fabric = l.bottomColor || top
      if (femme) {
        // The fitted wax top with a square neck and puffed sleeves, the pagne wrapped to the ankles.
        const neck = (f: F, x: number, y: number, w: number) => f === 'pz' && y < 3 && x >= 4 && x <= w - 5
        return {
          top: (f, x, y, w, h, ax, ay) => (neck(f, x, y, w) ? (y === 2 ? tint(skin, -0.12) : grain(skin, ax, ay, 0.02)) : f === 'pz' && y === 3 && x >= 3 && x <= w - 4 ? tint(top, -0.35) : wax(f, x, y, w, h, ax, ay)),
          waist: (f, x, y, w, h, ax, ay) => (y >= h - 2 ? wax(f, x, y, w, h, ax, ay + 40) : wax(f, x, y, w, h, ax, ay)),
          sleeve: 0.13,
          sleeveP: wax,
          puff: (f, x, y, w, h, ax, ay) => (isSide(f) && y === h - 1 ? tint(top, -0.35) : wax(f, x, y, w, h, ax, ay)),
          legs: 0,
          legP: skinP,
          shoe: 'sandal',
          shoeC,
          skirt: {
            // Folds: every few texels a fold in shadow, its edge lit.
            paint: (f, x, _y, _w, _h, ax, ay) => {
              const base = waxPx(fabric, l.pattern, ax, ay)
              if (!isSide(f)) return base
              const k = x % 4
              return k === 0 ? tint(base, -0.18) : k === 1 ? tint(base, 0.06) : base
            },
            w: 1.16,
            d: 1.3,
            hem: 0.06,
            band: tint(fabric, -0.3),
            wrap: true,
          },
          extras: (k, d) => {
            // The knot of the pagne at the left hip, its two ends hanging.
            const x = d.ww * 0.5
            const knot = (f: F, xx: number, y: number, _w: number, _h: number, ax: number, ay: number) => (isSide(f) && (xx + y) % 3 === 0 ? tint(fabric, -0.3) : waxPx(fabric, l.pattern, ax, ay))
            k.add('chest', { s: [0.07, 0.06, 0.05], p: [x, 0.93, d.wd * 0.38], paint: knot })
            k.add('chest', { s: [0.035, 0.12, 0.014], p: [x - 0.012, 0.85, d.wd * 0.38 + 0.03], r: [0, 0, 0.18], paint: knot })
            k.add('chest', { s: [0.03, 0.09, 0.014], p: [x + 0.02, 0.86, d.wd * 0.38 + 0.026], r: [0, 0, -0.25], paint: knot })
          },
        }
      }
      // The wax shirt, open at the neck, its collar, short sleeves, worn out over the trousers.
      const open = (f: F, x: number, y: number, w: number) => f === 'pz' && y < 3 && Math.abs(x - (w - 1) / 2) < 2.2 - y * 0.6
      return {
        top: (f, x, y, w, h, ax, ay) => (open(f, x, y, w) ? tint(skin, -0.05) : f === 'pz' && Math.abs(x - (w - 1) / 2) < 0.6 ? tint(top, -0.22) : wax(f, x, y, w, h, ax, ay)),
        waist: (f, x, y, w, h, ax, ay) => (f === 'pz' && Math.abs(x - (w - 1) / 2) < 0.6 ? (y % 4 === 1 ? '#f4efe6' : tint(top, -0.22)) : wax(f, x, y, w, h, ax, ay)),
        sleeve: 0.16,
        sleeveP: wax,
        cuff: tint(top, -0.3),
        collar: (f, x, _y, w, _h, ax, ay) => (f === 'pz' && Math.abs(x - (w - 1) / 2) < 1.6 ? null : waxPx(tint(top, -0.15), l.pattern, ax, ay)),
        legs: 0.86,
        legP: clothP(bottom, 0.05),
        hem: tint(bottom, -0.15),
        shoe: 'dress',
        shoeC,
        extras: (k, d) => {
          const z = front(d)
          // The collar's two points, the button at the top, the shirt's tail over the trousers.
          for (const s of [-1, 1]) k.add('chest', { s: [0.06, 0.05, 0.012], p: [s * 0.05, TOP - 0.03, z + 0.004], r: [0, 0, s * -0.5], paint: tint(top, -0.3) })
          k.add('chest', { s: [d.ww * 1.06, 0.07, d.wd * 1.08], p: [0, TORSO_BOTTOM + 0.02, 0], paint: (f, _x, y, _w, h, ax, ay) => (y === h - 1 && isSide(f) ? tint(top, -0.3) : waxPx(top, l.pattern, ax, ay)) })
        },
      }
    }
    case 'boubou':
    case 'bazin': {
      // The grand boubou: wide to the feet, embroidered at the neck and down the chest, wide sleeves.
      const gold = thread(top)
      const sheen: Paint = (_f, _x, _y, _w, _h, ax, ay) => ((ax + ay) % 5 === 0 ? tint(top, 0.1) : grain(top, ax, ay, 0.05))
      const embroider = (f: F, x: number, y: number, w: number) => {
        if (f !== 'pz') return false
        const c = Math.abs(x - (w - 1) / 2)
        if (y === 0 && c < 4) return true
        if (y < 9 && c < 3 - y * 0.25 && (x + y) % 2 === 0) return true
        return y < 11 && Math.abs(c - (3.2 - y * 0.25)) < 0.5
      }
      return {
        top: (f, x, y, w, h, ax, ay) => (embroider(f, x, y, w) ? gold : sheen(f, x, y, w, h, ax, ay)),
        waist: sheen,
        sleeve: 0.5,
        sleeveP: sheen,
        collar: (f, x) => (isSide(f) && x % 2 ? tint(gold, -0.2) : gold),
        bell: (f, x, y, w, h, ax, ay) => (isSide(f) && y >= h - 2 ? (x % 2 ? gold : tint(top, -0.15)) : sheen(f, x, y, w, h, ax, ay)),
        legs: 0.86,
        legP: clothP(bottom, 0.05),
        shoe: 'sandal',
        shoeC,
        skirt: { paint: (f, x, y, w, h, ax, ay) => (isSide(f) && x % 5 === 0 ? tint(top, -0.12) : sheen(f, x, y, w, h, ax, ay)), w: 1.26, d: 1.46, hem: 0.1 },
        extras: () => {},
      }
    }
    case 'robe-volants': {
      // The little girl's dress: puffed sleeves, a white collar, a ribbon, a skirt with frills.
      const c = top
      return {
        top: (f, x, y, w, _h, ax, ay) => (f === 'pz' && y === 0 && x > 3 && x < w - 4 ? tint(skin, -0.1) : grain(c, ax, ay, 0.05)),
        waist: (_f, _x, y, _w, _h, ax, ay) => (y < 3 ? tint(c, -0.3) : grain(c, ax, ay, 0.05)),
        sleeve: 0.1,
        sleeveP: clothP(tint(c, 0.15)),
        collar: () => '#f8f9fa',
        puff: (f, _x, y, _w, h, ax, ay) => (isSide(f) && y === h - 1 ? '#f8f9fa' : (ax + ay) % 3 === 0 ? tint(c, 0.25) : tint(c, 0.12)),
        legs: 0,
        legP: skinP,
        socks: '#f8f9fa',
        shoe: 'dress',
        shoeC,
        skirt: {
          paint: (f, x, _y, _w, _h, ax, ay) => (isSide(f) && x % 3 === 0 ? tint(c, -0.14) : (ax * 3 + ay * 5) % 11 === 0 ? '#ffffff' : grain(c, ax, ay, 0.05)),
          w: 1.36,
          d: 1.56,
          hem: 0.46,
          frill: '#f8f9fa',
        },
        extras: (k, d) => {
          const z = front(d)
          for (const s of [-1, 1]) k.add('chest', { s: [0.08, 0.045, 0.012], p: [s * 0.045, TOP - 0.03, z + 0.004], r: [0, 0, s * -0.2], paint: '#f8f9fa' })
          // The bow at the back of the ribbon.
          k.add('chest', { s: [0.14, 0.06, 0.03], p: [0, WAIST_Y - 0.04, -d.wd / 2 - 0.015], paint: (f, x) => (f === 'nz' && x % 7 === 3 ? tint(c, -0.5) : tint(c, -0.3)) })
        },
      }
    }
    default: {
      // The tee-shirt and the jean: a crew neck, a print across the chest (orange, white, green),
      // the belt and its buckle, the jean's pockets and seams, sneakers.
      const tee = clothP(top, 0.05)
      const ink = luminance(top) > 0.6 ? '#14213d' : '#f8f9fa'
      return {
        top: (f, x, y, w, h, ax, ay) => {
          if (f === 'pz') {
            const c = Math.abs(x - (w - 1) / 2)
            if (y === 0 && c < 3) return tint(skin, -0.1)
            if ((y === 0 && c < 4) || (y === 1 && c < 3)) return tint(top, -0.2)
            if (y >= 5 && y <= 7 && c < 5) return y === 5 ? '#ff7a00' : y === 6 ? ink : '#00a862'
          }
          return tee(f, x, y, w, h, ax, ay)
        },
        waist: (f, x, y, w, h, ax, ay) => {
          if (y < 5) return tee(f, x, y, w, h, ax, ay)
          const jean = denimP(bottom)(f, x, y, w, h, ax, ay)
          // Pockets: the stitched curve in front, the patches behind.
          if (f === 'pz' && y >= 7 && (x === 2 || x === w - 3) && y < 10) return tint(bottom, 0.3)
          if (f === 'nz' && y >= 7 && (x === 2 || x === 6 || x === w - 3 || x === w - 7)) return tint(bottom, 0.25)
          return jean
        },
        sleeve: 0.13,
        sleeveP: tee,
        cuff: tint(top, -0.12),
        collar: (f, x) => (isSide(f) && x % 2 ? tint(top, -0.26) : tint(top, -0.16)),
        legs: 0.86,
        legP: (f, x, y, w, h, ax, ay) => (isSide(f) && (f === 'px' || f === 'nx') && x === Math.floor(w / 2) ? tint(bottom, 0.28) : denimP(bottom)(f, x, y, w, h, ax, ay)),
        hem: tint(bottom, 0.08),
        shoe: 'sneaker',
        shoeC,
        extras: (k, d) => {
          k.add('chest', { s: [d.ww + 0.012, 0.035, d.wd + 0.012], p: [0, TORSO_BOTTOM + 0.115, 0], paint: (f, x) => (isSide(f) && x % 5 === 0 ? '#3a2416' : '#4a2f1d'), bevel: 0.6 })
          k.add('chest', { s: [0.05, 0.04, 0.012], p: [0, TORSO_BOTTOM + 0.115, d.wd / 2 + 0.008], paint: (f, x, y, w, h) => (f === 'pz' && x > 0 && x < w - 1 && y > 0 && y < h - 1 ? '#8a6a2a' : '#d8b25a'), bevel: 0.3 })
        },
      }
    }
  }
}

/* ---------- Building one look ---------- */

type Built = { material: THREE.Material; geos: Record<string, THREE.BufferGeometry>; boxes: number; loose: boolean; d: Dims }
const cache = new Map<string, Built>()

function build(l: Required<Look>, femme: boolean, young: boolean): Built {
  const key = JSON.stringify([l, femme, young])
  const hit = cache.get(key)
  if (hit) return hit
  const k = new Kit()
  const { w, limb, depth } = BODY[l.body] ?? BODY.moyen
  const tw = 0.34 * w * (femme ? 0.92 : 1)
  const td = 0.18 * depth
  const d: Dims = { tw, td, ww: tw * (femme ? 0.88 : 0.95), wd: td * 0.96, lw: (tw / 2) * 0.98, ld: 0.16 * limb, aw: (femme ? 0.115 : 0.13) * limb, hipX: tw / 4, shX: tw / 2 + ((femme ? 0.115 : 0.13) * limb) / 2 + 0.006 }
  const skin = l.skin
  const skinP: Paint = (_f, _x, _y, _w, _h, ax, ay) => grain(skin, ax, ay, 0.025)
  const dress = dressFor(l, femme)

  /* The head: the cube, the ears, the hair layer and the hair's blocks. */
  k.add('head', { s: [H, H, H], p: [0, H / 2, 0], paint: headPaint(l, femme, young), bevel: 0.4 })
  // The nose: a block one texel proud of the face, lit on top, the nostrils underneath.
  k.add('head', {
    s: [0.06, 0.05, 0.02],
    p: [0, H - 10.25 * TX, H / 2 + 0.01],
    t: [3, 3, 1],
    paint: (f, x, y) => (f === 'ny' ? (x === 1 ? tint(skin, -0.25) : tint(skin, -0.5)) : f === 'py' ? tint(skin, 0.12) : f === 'pz' ? (y === 2 ? (x === 1 ? tint(skin, -0.05) : tint(skin, -0.3)) : x === 1 ? tint(skin, 0.1) : skin) : tint(skin, -0.12)),
    bevel: 0,
  })
  for (const s of [-1, 1])
    k.add('head', {
      s: [0.026, 0.07, 0.05],
      p: [s * (H / 2 + 0.013), H * 0.47, -0.01],
      paint: (f, x, y) => ((f === 'px' && s > 0) || (f === 'nx' && s < 0) ? (x === 1 && y > 0 && y < 3 ? tint(skin, -0.3) : tint(skin, -0.04)) : tint(skin, -0.1)),
      bevel: 0.6,
    })
  const hc = tint(l.hairColor, 0.08)
  const hp: Paint = (_f, _x, _y, _w, _h, ax, ay) => hairPx(l.hair, hc, ax, ay)
  const style = l.hair
  const wrapped = style === 'headwrap'
  let loose = false
  if (style !== 'bald' && !wrapped) k.add('head', { s: [SHELL, SHELL, SHELL], p: [0, H / 2, 0], paint: shellPaint(style, hc, femme), bevel: 0.3 })
  const strands = (n: number, sz: number, len: number, bead?: string, front = 0) => {
    loose = true
    for (let i = 0; i < n; i++) {
      // Round the back from ear to ear, longer down the back; then a few framing the face.
      const a = (i / (n - 1) - 0.5) * Math.PI * 1.2
      const [x, z] = [Math.sin(a) * SHELL * 0.56, Math.min(-Math.cos(a) * SHELL * 0.56, -SHELL * 0.1)]
      const ln = len * (0.8 + Math.cos(a) * 0.2 + (hash(i, 7) - 0.5) * 0.14)
      k.add('hang', { s: [sz, ln, sz], p: [x, H * 0.62 - ln / 2, z], paint: (f, xx, y, ww, hh, ax, ay) => (y >= hh - 1 ? tint(hc, 0.22) : hp(f, xx, y, ww, hh, ax, ay)), bevel: 0.3 })
      if (bead) k.add('hang', { s: [sz * 1.4, sz * 1.2, sz * 1.4], p: [x, H * 0.62 - ln - sz * 0.5, z], paint: (_f, xx) => (xx === 0 ? tint(bead, 0.3) : bead), bevel: 0.5 })
    }
    for (let i = 0; i < front; i++)
      for (const s of [-1, 1]) {
        const ln = len * (0.55 + i * 0.1)
        const x = s * (SHELL / 2 + sz / 2 - 0.004)
        k.add('hang', { s: [sz, ln, sz], p: [x, H * 0.66 - ln / 2, 0.02 - i * (sz + 0.006)], paint: hp, bevel: 0.3 })
        if (bead) k.add('hang', { s: [sz * 1.4, sz * 1.2, sz * 1.4], p: [x, H * 0.66 - ln - sz * 0.5, 0.02 - i * (sz + 0.006)], paint: bead, bevel: 0.5 })
      }
  }
  switch (style) {
    case 'afro': {
      // Round volume in steps: a wide middle, a narrower crown, the sides down to the ears.
      k.add('head', { s: [0.5, 0.16, 0.46], p: [0, H + 0.03, -0.03], paint: hp, bevel: 0.6 })
      k.add('head', { s: [0.42, 0.08, 0.38], p: [0, H + 0.14, -0.03], paint: hp, bevel: 0.6 })
      k.add('head', { s: [0.54, 0.12, 0.42], p: [0, H - 0.08, -0.06], paint: hp, bevel: 0.6 })
      k.add('head', { s: [0.46, 0.1, 0.16], p: [0, H - 0.16, -0.17], paint: hp, bevel: 0.6 })
      break
    }
    case 'locks':
      k.add('head', { s: [SHELL + 0.02, 0.05, SHELL + 0.02], p: [0, H + 0.03, -0.004], paint: hp, bevel: 0.5 })
      strands(16, 0.046, 0.46, undefined, 2)
      break
    case 'twists':
      strands(14, 0.04, 0.2)
      break
    case 'braids':
    case 'nattes-perles':
      strands(style === 'braids' ? 17 : 13, style === 'braids' ? 0.034 : 0.04, style === 'braids' ? 0.5 : 0.32, style === 'braids' ? (femme ? '#e8b93c' : undefined) : '#f2b705', 2)
      break
    case 'puffs':
      for (const s of [-1, 1]) {
        k.add('head', { s: [0.16, 0.14, 0.16], p: [s * 0.13, H + 0.06, -0.03], paint: hp, bevel: 0.6 })
        k.add('head', { s: [0.12, 0.05, 0.12], p: [s * 0.13, H + 0.15, -0.03], paint: hp, bevel: 0.6 })
        k.add('head', { s: [0.1, 0.022, 0.1], p: [s * 0.13, H + 0.002, -0.03], paint: l.accessoryColor || '#f783ac', bevel: 0.3 })
      }
      break
    case 'bantu':
      // Bantu knots: small coiled knots in a grid, each a block and a smaller one on top.
      for (const [x, z] of [[-0.1, 0.08], [0.1, 0.08], [0, 0.0], [-0.1, -0.1], [0.1, -0.1], [0, 0.16]] as [number, number][]) {
        k.add('head', { s: [0.08, 0.06, 0.08], p: [x, H + 0.03, z - 0.01], paint: hp, bevel: 0.6 })
        k.add('head', { s: [0.05, 0.04, 0.05], p: [x, H + 0.075, z - 0.01], paint: hp, bevel: 0.6 })
      }
      break
    case 'bun':
      k.add('head', { s: [0.14, 0.12, 0.14], p: [0, H + 0.07, -0.06], paint: hp, bevel: 0.6 })
      break
    case 'degrade':
      k.add('head', { s: [SHELL - 0.02, 0.04, SHELL - 0.02], p: [0, H + 0.03, 0], paint: hp, bevel: 0.6 })
      break
    case 'headwrap': {
      // The foulard in the outfit's wax: wrapped round, high at the back, the knot and its fan in front.
      const c = l.outfit === 'pagne' || l.outfit === 'kaba' ? l.bottomColor || l.outfitColor : l.outfitColor
      const fold = (f: F, _x: number, y: number, _ww: number, _hh: number, ax: number, ay: number) => {
        const base = waxPx(c, l.pattern, ax, ay)
        if (!isSide(f)) return base
        return y % 4 === 0 ? tint(base, -0.22) : y % 4 === 1 ? tint(base, 0.08) : base
      }
      k.add('head', { s: [SHELL + 0.01, 0.15, SHELL + 0.01], p: [0, H - 0.03, -0.002], paint: fold, bevel: 0.6 })
      k.add('head', { s: [SHELL - 0.02, 0.12, SHELL + 0.03], p: [0, H + 0.1, -0.02], r: [-0.12, 0, 0], paint: fold, bevel: 0.6 })
      k.add('head', { s: [0.26, 0.08, 0.2], p: [0, H + 0.19, -0.06], r: [-0.2, 0, 0], paint: fold, bevel: 0.6 })
      k.add('head', { s: [0.1, 0.07, 0.07], p: [0, H + 0.08, SHELL / 2 + 0.01], paint: fold, bevel: 0.6 })
      for (const s of [-1, 1]) k.add('head', { s: [0.12, 0.1, 0.03], p: [s * 0.07, H + 0.14, SHELL / 2 - 0.01], r: [-0.3, 0, s * -0.6], paint: fold, bevel: 0.6 })
      break
    }
  }
  if (!young && (l.beard === 'full' || l.beard === 'longue'))
    k.add('head', { s: [0.2, l.beard === 'longue' ? 0.1 : 0.04, 0.04], p: [0, l.beard === 'longue' ? -0.03 : 0.004, H / 2 - 0.006], paint: (_f, _x, _y, _ww, _hh, ax, ay) => grain(tint(l.hairColor, 0.05), ax, ay, 0.24), bevel: 0.5 })
  if (!young && l.beard === 'bouc') k.add('head', { s: [0.08, 0.04, 0.03], p: [0, 0.005, H / 2 - 0.004], paint: (_f, _x, _y, _w, _h, ax, ay) => grain(tint(l.hairColor, 0.05), ax, ay, 0.24), bevel: 0.5 })
  const acc = (id: string) => !young && hasAcc(l, id)
  if (acc('glasses') || acc('sunglasses')) {
    // Frames as blocks: the front with its two lenses cut out (or dark), the arms back to the ears.
    const fc = accessoryColor(l, acc('glasses') ? 'glasses' : 'sunglasses')
    const dark = acc('sunglasses')
    k.add('head', { s: [0.3, 0.08, 0.012], p: [0, H - 8 * TX, H / 2 + 0.008], t: [15, 4, 1], paint: (f, x, y) => (f === 'pz' || f === 'nz') && y >= 1 && y <= 2 && ((x >= 2 && x <= 6) || (x >= 8 && x <= 12)) ? (dark ? (y === 1 && (x === 3 || x === 9) ? '#5a6878' : '#14181e') : null) : fc, bevel: 0.2 })
    for (const s of [-1, 1]) k.add('head', { s: [0.012, 0.015, 0.17], p: [s * (H / 2 + 0.008), H * 0.56, H / 2 - 0.08], paint: fc, bevel: 0 })
  }
  if (acc('earrings')) {
    // Big gold hoops: a stud, then a square ring of four small blocks.
    const g = accessoryColor(l, 'earrings')
    for (const s of [-1, 1]) {
      const x = s * (H / 2 + 0.03)
      const y = H * 0.33
      k.add('head', { s: [0.016, 0.016, 0.016], p: [x, y + 0.01, -0.01], paint: tint(g, 0.2), bevel: 0 })
      k.add('head', { s: [0.01, 0.01, 0.06], p: [x, y - 0.005, -0.01], paint: g, bevel: 0 })
      k.add('head', { s: [0.01, 0.01, 0.06], p: [x, y - 0.075, -0.01], paint: tint(g, -0.15), bevel: 0 })
      for (const z of [-0.035, 0.015]) k.add('head', { s: [0.01, 0.08, 0.01], p: [x, y - 0.04, z], paint: g, bevel: 0 })
    }
  }

  /* The torso: the chest, the waist, and what's on them. */
  k.add('chest', { s: [tw, TOP - WAIST_Y, td], p: [0, (TOP + WAIST_Y) / 2, 0], paint: dress.top })
  k.add('chest', { s: [0.13, 0.06, 0.12], p: [0, TOP + 0.02, -0.005], paint: (f, x, y, _ww, _hh, ax, ay) => (f === 'pz' && y === 0 ? tint(skin, -0.22) : f === 'pz' && x === 0 ? tint(skin, -0.1) : grain(tint(skin, -0.06), ax, ay, 0.02)), bevel: 0.4 })
  if (dress.collar) k.add('chest', { s: [0.17, 0.035, 0.15], p: [0, TOP + 0.012, -0.005], paint: dress.collar, bevel: 0.5 })
  k.add('chest', { s: [d.ww, WAIST_Y - TORSO_BOTTOM + 0.01, d.wd], p: [0, (WAIST_Y + TORSO_BOTTOM) / 2, 0], paint: dress.waist })
  dress.extras(k, d)
  if (acc('chain')) {
    // A gold chain: links as small blocks round the neck, a pendant.
    const g = accessoryColor(l, 'chain')
    const z = td / 2 + 0.004
    for (let i = 0; i < 7; i++) {
      const t = (i / 6 - 0.5) * 2
      k.add('chest', { s: [0.022, 0.014, 0.008], p: [t * 0.08, TOP - 0.02 - (1 - t * t) * 0.07, z], r: [0, 0, t * 0.7], paint: i % 2 ? tint(g, 0.2) : g, bevel: 0 })
    }
    k.add('chest', { s: [0.03, 0.04, 0.01], p: [0, TOP - 0.115, z + 0.002], paint: (f, x, y) => (f === 'pz' && x === 0 && y === 0 ? '#fff4c2' : g), t: [2, 2, 1], bevel: 0 })
  }
  const skirt = dress.skirt
  const skW = skirt ? tw * skirt.w : 0
  const skD = skirt ? td * skirt.d : 0
  if (skirt) {
    k.add('chest', { s: [skW, 0.17, skD], p: [0, 0.885, 0], paint: (f, x, y, ww, hh, ax, ay) => (skirt.band && y < 2 && isSide(f) ? skirt.band : skirt.paint(f, x, y, ww, hh, ax, ay)) })
    if (skirt.wrap) {
      // The wrapped edge of the pagne: a fold of cloth down the front, from the knot.
      k.add('chest', { s: [0.035, 0.17, 0.012], p: [skW * 0.3, 0.885, skD / 2 + 0.004], paint: (f, x, y, ww, hh, ax, ay) => (x === 0 ? tint(skirt.band ?? '#000000', -0.2) : skirt.paint(f, x, y, ww, hh, ax, ay)) })
    }
  }

  /* Legs: thigh and shin, the shoe on the shin; the skirt's halves swing with them. */
  const kneeY = HIP_Y - THIGH
  const legPaint = (from: number, len: number): Paint => (f, x, y, ww, hh, ax, ay) => {
    const m = f === 'py' ? from : f === 'ny' ? from + len : from + ((y + 0.5) / hh) * len
    if (m < dress.legs) return dress.legP(f, x, y, ww, hh, ax, ay)
    if (dress.socks && m > THIGH + 0.18) return grain(dress.socks, ax, ay, 0.04)
    // A knee in light, the ankle bone.
    return skinP(f, x, y, ww, hh, ax, ay)
  }
  for (const i of [0, 1]) {
    const side = i === 0 ? -1 : 1
    const thigh = `thigh${i}`
    const shin = `shin${i}`
    k.add(thigh, { s: [d.lw, THIGH + 0.04, d.ld], p: [0, (0.04 - THIGH) / 2, 0], paint: legPaint(-0.04, THIGH + 0.04), bevel: 0.6 })
    const ankle = SHIN - 0.075
    k.add(shin, { s: [d.lw * 0.96, ankle + 0.02, d.ld * 0.96], p: [0, (0.02 - ankle) / 2, 0], paint: legPaint(THIGH - 0.02, ankle + 0.02), bevel: 0.6 })
    if (dress.hem && dress.legs > THIGH) k.add(shin, { s: [d.lw * 1.04, 0.035, d.ld * 1.04], p: [0, -ankle + 0.012, 0], paint: (f, x) => (isSide(f) && x % 3 === 0 ? tint(dress.hem!, -0.1) : dress.hem!), bevel: 0.5 })
    // The shoe: an upper reaching forward past the shin, a sole a little wider.
    const sh = dress.shoe
    const sc = dress.shoeC
    const soleC = sh === 'sneaker' ? '#f4f4f4' : sh === 'sandal' ? tint(sc, -0.2) : '#1e140d'
    const fz = d.ld * 0.16
    if (sh === 'sandal') {
      // Bare feet on a sole, a strap across, the toes.
      k.add(shin, { s: [d.lw * 0.92, 0.06, d.ld * 1.18], p: [0, -SHIN + 0.04, fz], paint: (f, x, y, ww, hh, ax, ay) => (f === 'pz' && y >= hh - 2 && x % 2 ? tint(skin, -0.18) : skinP(f, x, y, ww, hh, ax, ay)), bevel: 0.5 })
      k.add(shin, { s: [d.lw * 0.96, 0.022, 0.035], p: [0, -SHIN + 0.05, fz + d.ld * 0.25], paint: sc, bevel: 0.4 })
    } else {
      k.add(shin, {
        s: [d.lw * 1.02, sh === 'boot' ? 0.12 : 0.075, d.ld * 1.26],
        p: [0, -SHIN + (sh === 'boot' ? 0.07 : 0.047), fz],
        paint: (f, x, y, ww, hh, ax, ay) => {
          if (sh === 'sneaker') {
            if (f === 'py' && y >= hh - 4 && (x === 1 || x === ww - 2) && y % 2 === 0) return '#ffffff'
            if (f === 'py' && y >= hh - 4 && x > 0 && x < ww - 1) return tint(sc, -0.1)
            if ((f === 'px' || f === 'nx') && y === 1 && x > 1 && x < ww - 2) return '#ff7a00' // the stripe
            return grain(sc, ax, ay, 0.04)
          }
          if (f === 'py' && x > 0 && x < ww - 1 && y >= hh - 3) return tint(sc, 0.28) // the shine on the toe
          return grain(sc, ax, ay, 0.03)
        },
        bevel: 0.7,
      })
    }
    k.add(shin, { s: [d.lw * 1.08, 0.022, d.ld * 1.34], p: [0, -SHIN + 0.001, fz], paint: (f, x) => (isSide(f) && x % 2 ? tint(soleC, -0.08) : soleC), bevel: 0.4 })
    if (skirt) {
      const skX = side * (skW / 4 - d.hipX)
      const len1 = Math.min(THIGH, HIP_Y - skirt.hem) + 0.05
      const sp = (f: F, x: number, y: number, ww: number, hh: number, ax: number, ay: number) => (skirt.band && y === hh - 1 && isSide(f) && !skirt.frill ? skirt.band : skirt.paint(f, x, y, ww, hh, ax, ay))
      k.add(thigh, { s: [skW / 2, len1, skD * 0.98], p: [skX, 0.05 - len1 / 2, 0], paint: sp, bevel: 0.6 })
      if (skirt.hem < kneeY) {
        const len2 = kneeY - skirt.hem + 0.03
        k.add(shin, { s: [skW / 2, len2, skD * 0.98], p: [skX, 0.03 - len2 / 2, 0], paint: sp, bevel: 0.6 })
      }
      if (skirt.frill) {
        // A frill at the hem, wider.
        const seg = skirt.hem < kneeY ? shin : thigh
        const y = skirt.hem < kneeY ? -(kneeY - skirt.hem) : -(HIP_Y - skirt.hem)
        k.add(seg, { s: [skW / 2 + 0.02, 0.05, skD + 0.02], p: [skX + side * 0.01, y + 0.02, 0], paint: (f, x) => (isSide(f) && x % 2 ? tint(skirt.frill!, -0.1) : skirt.frill!), bevel: 0.5 })
      }
    }
  }

  /* Arms: the sleeve, the forearm, the hand with its thumb. */
  const wrist = FOREARM - 0.06
  const armPaint = (from: number, len: number): Paint => (f, x, y, ww, hh, ax, ay) => {
    const m = f === 'py' ? from : f === 'ny' ? from + len : from + ((y + 0.5) / hh) * len
    return m < dress.sleeve ? dress.sleeveP(f, x, y, ww, hh, ax, ay) : skinP(f, x, y, ww, hh, ax, ay)
  }
  for (const i of [0, 1]) {
    const side = i === 0 ? -1 : 1
    const up = `upper${i}`
    const fo = `fore${i}`
    const aw = d.aw
    k.add(up, { s: [aw, UPPER_ARM + 0.04, aw], p: [0, (0.04 - UPPER_ARM) / 2, 0], paint: armPaint(0, UPPER_ARM + 0.04), bevel: 0.6 })
    k.add(fo, { s: [aw * 0.96, wrist + 0.02, aw * 0.96], p: [0, (0.02 - wrist) / 2, 0], paint: armPaint(UPPER_ARM + 0.02, wrist + 0.02), bevel: 0.6 })
    // Where the sleeve ends, a cuff (on the upper arm or at the wrist).
    if (dress.cuff && dress.sleeve > 0) {
      const onFore = dress.sleeve > UPPER_ARM + 0.04
      const y = onFore ? -(dress.sleeve - UPPER_ARM - 0.02) : 0.04 - dress.sleeve
      k.add(onFore ? fo : up, { s: [aw * 1.1, 0.03, aw * 1.1], p: [0, Math.max(y, -wrist) + 0.012, 0], paint: (f, x) => (isSide(f) && x % 3 === 1 ? tint(dress.cuff!, -0.08) : dress.cuff!), bevel: 0.5 })
    }
    if (dress.puff) k.add(up, { s: [aw * 1.32, 0.13, aw * 1.32], p: [0, -0.02, 0], paint: dress.puff, bevel: 0.7 })
    if (dress.bell) {
      k.add(up, { s: [aw * 1.4, UPPER_ARM, aw * 1.4], p: [0, -UPPER_ARM / 2 + 0.03, 0], paint: dress.bell, bevel: 0.6 })
      k.add(fo, { s: [aw * 1.9, 0.17, aw * 1.9], p: [0, -0.075, 0], paint: dress.bell, bevel: 0.6 })
    }
    // The hand: flatter than the arm, the fingers' lines, a thumb forward and in.
    const hand: Paint = (f, x, y, ww, hh, ax, ay) => {
      const outer = (f === 'px' && side > 0) || (f === 'nx' && side < 0)
      const inner = (f === 'nx' && side > 0) || (f === 'px' && side < 0)
      if ((outer || inner) && y >= hh - 3 && x % 2 === 1 && x < ww - 1) return tint(skin, -0.2)
      if (inner && y < 3) return tint(skin, 0.06) // the palm
      return skinP(f, x, y, ww, hh, ax, ay)
    }
    k.add(fo, { s: [aw * 0.66, 0.1, aw * 0.92], p: [0, -wrist - 0.04, 0], t: [3, 5, 5], paint: hand, bevel: 0.6 })
    k.add(fo, { s: [0.028, 0.05, 0.03], p: [-side * aw * 0.12, -wrist - 0.02, aw * 0.46 + 0.012], r: [0.2, 0, 0], paint: skinP, bevel: 0.5 })
    if (!young && i === 0 && hasAcc(l, 'watch')) k.add(fo, { s: [aw * 1.06, 0.024, aw * 1.06], p: [0, -wrist + 0.03, 0], paint: (f, x, y) => (f === 'nx' && x > 0 && x < 4 ? (y === 0 ? '#e7f5ff' : accessoryColor(l, 'watch')) : '#17171a'), bevel: 0.2 })
  }

  const built = k.finish()
  const out: Built = { material: new THREE.MeshLambertMaterial({ map: built.texture, alphaTest: 0.5 }), geos: built.geos, boxes: built.boxes, loose, d }
  cache.set(key, out)
  return out
}

/** How many boxes and draw calls one look costs (for the lab's counter). */
export function detailCost(look: Look, gender: Sim['gender'], young = false) {
  const b = build(fullLook(look), gender === 'femme', young)
  const tris = Object.values(b.geos).reduce((n, g) => n + (g.index ? g.index.count / 3 : 0), 0)
  return { boxes: b.boxes, meshes: Object.keys(b.geos).length, tris }
}

const lidMats = new Map<string, THREE.Material>()
const lidMat = (c: string) => {
  let m = lidMats.get(c)
  if (!m) lidMats.set(c, (m = new THREE.MeshLambertMaterial({ color: c })))
  return m
}
const LID = new THREE.BoxGeometry(4 * TX, 2 * TX, 0.004)

/* ---------- The Sim ---------- */

export function DetailHuman({ look, gender, pose = 'idle', seed = 0, headScale = 1, speed }: Props) {
  const young = headScale > 1
  const l = fullLook(look)
  const femme = gender === 'femme'
  const cast = useCastShadows()
  const b = useMemo(() => build(l, femme, young), [JSON.stringify(l), femme, young]) // eslint-disable-line react-hooks/exhaustive-deps
  const { d } = b
  const m = b.material

  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const chest = useRef<THREE.Group>(null)
  const hip = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const knee = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const shoulder = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const elbow = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  usePoseRig({ root, head, chest, hip, knee, shoulder, elbow }, pose, seed, speed, STYLE)

  // Blinking, and loose hair swaying.
  const lids = useRef<THREE.Group>(null)
  const sway = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = worldTime() + seed * 7.3
    const period = 3.2 + (Math.abs(seed) % 3)
    const k = (t % period) / period
    const shut = pose === 'sleep' ? 1 : k > 0.955 ? Math.sin(((k - 0.955) / 0.045) * Math.PI) : 0
    if (lids.current) {
      lids.current.visible = shut > 0.05
      for (const c of lids.current.children) c.scale.y = Math.max(0.01, shut)
    }
    const g = sway.current
    if (g) {
      const s = pose === 'run' || pose === 'dance' ? 1 : pose === 'walk' ? 0.5 : 0.18
      g.rotation.x = Math.sin(t * (2.2 + s * 4)) * 0.08 * s + s * 0.05
      g.rotation.z = Math.sin(t * (1.7 + s * 3) + 1) * 0.05 * s
    }
  })

  const seg = (name: string) => b.geos[name] && <mesh geometry={b.geos[name]} material={m} castShadow={cast} />
  return (
    <group scale={l.height * (femme ? 0.96 : 1)}>
      <group ref={root}>
        <group ref={chest}>{seg('chest')}</group>
        <group ref={head} position={[0, NECK_Y, 0]} scale={headScale}>
          {seg('head')}
          {b.loose && (
            <group ref={sway} position={[0, H * 0.62, 0]}>
              <group position={[0, -H * 0.62, 0]}>{seg('hang')}</group>
            </group>
          )}
          <group ref={lids} position={[0, H - 8 * TX, H / 2 + 0.003]} visible={false}>
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={LID} material={lidMat(tint(l.skin, -0.08))} position={[s * 3 * TX, 0, 0]} />
            ))}
          </group>
        </group>
        {[0, 1].map((i) => (
          <group key={`l${i}`} ref={hip[i]} position={[(i ? 1 : -1) * d.hipX, HIP_Y, 0]}>
            {seg(`thigh${i}`)}
            <group ref={knee[i]} position={[0, -THIGH, 0]}>
              {seg(`shin${i}`)}
            </group>
          </group>
        ))}
        {[0, 1].map((i) => (
          <group key={`a${i}`} ref={shoulder[i]} position={[(i ? 1 : -1) * d.shX, SHOULDER_Y, 0]}>
            {seg(`upper${i}`)}
            <group ref={elbow[i]} position={[0, -UPPER_ARM, 0]}>
              {seg(`fore${i}`)}
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}
