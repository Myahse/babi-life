import type { Look } from '../../lib/types'
import { FEMME_OUTFITS, defaultColors } from '../options'
import { tint } from '../textures'
import type { F, Kit, Paint } from './atlas'
import { clothP, denimPx, grain, isSide, luminance, waxBig } from './paint'

// What the detailed Sim wears: every outfit of avatar/options.ts, cut as
// BlockHuman cuts it (the same colours, prints, lengths and shoes), with more
// to it: collars, cuffs, buttons, belts and buckles, pockets, seams, folds.
// Each outfit is a list of layers per body part: the first layer that covers
// a texel paints it, bare skin shows where none does.

/* ---------- The body's measures (BlockHuman's) ---------- */

export const TOP = 1.32 // the chest's top
export const WAIST_Y = 1.06
export const TORSO_BOTTOM = 0.82
export const HIP_Y = 0.84
export const THIGH = 0.42
export const SHIN = 0.42
export const UPPER_ARM = 0.25
export const FOREARM = 0.27
/** Down from the chest's top: the waist, the hips. */
export const WAIST = TOP - WAIST_Y
export const HIPS = TOP - TORSO_BOTTOM
/** Where a belt sits, down from the chest's top. */
const BELT = 0.38

export type Dims = { tw: number; td: number; ww: number; wd: number; lw: number; ld: number; aw: number; hipX: number; shX: number }

/** Bare skin, and skin in shade (a neckline's edge): the builder paints them, never worn out. */
export const SKIN = '@s'
export const SHADE = '@d'

type Px = string | ((ax: number, ay: number) => string)
const px = (c: Px, ax: number, ay: number) => (typeof c === 'string' ? c : c(ax, ay))

/** A layer of the torso: f the face, cx the texel from the middle (k the same, -1..1 edge to edge), m metres down from the chest's top. */
export type TL = (f: F, cx: number, k: number, m: number, ax: number, ay: number) => string | undefined
/** A layer of an arm or a leg: m metres down from the shoulder or the hip; side -1 on the Sim's right (-x), 1 on its left. */
export type LL = (f: F, m: number, side: number, x: number, w: number, ax: number, ay: number) => string | undefined

/** The face on the outside of a limb. */
export const outer = (f: F, side: number) => (side < 0 ? f === 'nx' : f === 'px')

/* Torso layers. */
const band = (m0: number, m1: number, c: Px): TL => (_f, _cx, _k, m, ax, ay) => (m >= m0 && m < m1 ? px(c, ax, ay) : undefined)
const front = (test: (cx: number, m: number, k: number) => boolean, c: Px): TL => (f, cx, k, m, ax, ay) => (f === 'pz' && test(cx, m, k) ? px(c, ax, ay) : undefined)
const back = (test: (cx: number, m: number, k: number) => boolean, c: Px): TL => (f, cx, k, m, ax, ay) => (f === 'nz' && test(cx, m, k) ? px(c, ax, ay) : undefined)
const sides = (test: (m: number) => boolean, c: Px): TL => (f, _cx, _k, m, ax, ay) => ((f === 'px' || f === 'nx') && test(m) ? px(c, ax, ay) : undefined)
/** The top of the shoulders (the chest's top face). */
const shoulders = (test: (cx: number, k: number) => boolean, c: Px): TL => (f, cx, k, _m, ax, ay) => (f === 'py' && test(cx, k) ? px(c, ax, ay) : undefined)
/** Necklines, cut in the cloth (skin, its edge in shade). */
const crew = (c: string): TL => (f, cx, _k, m) => (f === 'pz' && m < 0.02 && Math.abs(cx) < 3 ? SHADE : f === 'pz' && ((m < 0.02 && Math.abs(cx) < 4) || (m < 0.04 && Math.abs(cx) < 3)) ? c : undefined)
const vee = (depth: number, open = SKIN): TL => (f, cx, _k, m) => (f === 'pz' && m < depth && Math.abs(cx) < 2.6 * (1 - m / depth) + 0.4 ? (m > depth - 0.025 ? SHADE : open) : undefined)
const scoop = (wide: number, deep: number): TL => (f, cx, _k, m) => (f === 'pz' && m < deep && Math.abs(cx) < wide - (m / deep) * 2 ? SKIN : undefined)
/** Shirt buttons down the front. */
const buttons = (c: string, to = BELT - 0.04, x = 0): TL => (f, cx, _k, m) => (f === 'pz' && Math.abs(cx - x) < 0.6 && m > 0.03 && m < to && Math.round(m / TXM) % 4 === 1 ? c : undefined)
const TXM = 0.02
/** A belt, its buckle in front. */
const belt = (c = '#4a2f1d', buckle = '#d8b25a', at = BELT): TL => (f, cx, _k, m) => (m >= at && m < at + 0.04 ? (f === 'pz' && Math.abs(cx) < 1.6 ? buckle : isSide(f) && Math.round(cx) % 5 === 0 ? tint(c, -0.15) : c) : undefined)

/* Limb layers. */
/** Covers the limb down to `to` metres. */
const down = (to: number, c: Px, from = -1): LL => (_f, m, _s, _x, _w, ax, ay) => (m >= from && m < to ? px(c, ax, ay) : undefined)
/** A stripe down the outside of a limb, to `to`. */
const stripe = (to: number, c: string, wide = 1): LL => (f, m, side, x, w) => (m < to && outer(f, side) && Math.abs(x - (w - 1) / 2) < wide ? c : undefined)

/* ---------- The outfits ---------- */

export type Shoe = 'sneaker' | 'dress' | 'sandal' | 'boot' | 'heel' | 'slide' | 'none'
export type Skirt = { paint: Paint; w: number; d: number; hem: number; band?: string; wrap?: boolean; frill?: string; folds?: boolean }
export type Dress = {
  torso: TL[]
  arm: LL[]
  leg: LL[]
  /** How far down the arm the sleeves go (metres from the shoulder's top). */
  sleeve: number
  /** How far down the leg the trousers go (metres from the hip). */
  legs: number
  /** A cuff block where the sleeve ends. */
  cuff?: string
  /** Puffed sleeves: a bigger block at the shoulder. */
  puff?: Paint
  /** The boubou's wide sleeves. */
  bell?: Paint
  /** The trousers' hem, a block round the ankle. */
  hem?: string
  shoe: Shoe
  shoeC: string
  skirt?: Skirt
  /** A collar block round the neck. */
  collar?: Paint
  /** Collars, ties, pockets, bags: blocks on the chest. */
  extras?: (k: Kit, d: Dims) => void
}

/** The outfit as worn: a man who picked a women's outfit gets the nearest men's one (as BlockHuman). */
export function outfitOf(l: Required<Look>, femme: boolean) {
  return !femme && FEMME_OUTFITS.has(l.outfit) ? (l.outfit === 'kaba' ? 'boubou' : l.outfit === 'abaya' ? 'imam' : l.outfit === 'soeur' ? 'soutane' : 'casual') : l.outfit
}

const DIGITS: Record<string, string[]> = { '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'] }
/** The number « 23 » on a basket jersey: each digit 3 texels by 5, at texel scale 2. */
function numberAt(cx: number, m: number) {
  const row = Math.floor((m - 0.12) / 0.03)
  if (row < 0 || row > 4) return false
  const col = Math.floor((cx + 7) / 2)
  if (col < 0 || col > 6 || col === 3) return false
  const d = col < 3 ? DIGITS['2'] : DIGITS['3']
  return d[row][col < 3 ? col : col - 4] === '1'
}

export function dressFor(l: Required<Look>, femme: boolean): Dress {
  const top = l.outfitColor
  const dc = defaultColors(l, femme)
  const bottom = l.bottomColor || dc.bottom
  const shoeC = l.shoeColor || dc.shoe
  const outfit = outfitOf(l, femme)
  const cloth = (c: string, k = 0.06) => (ax: number, ay: number) => grain(c, ax, ay, k)
  const wax = (c: string) => (ax: number, ay: number) => waxBig(c, l.pattern, ax, ay)
  const denim = (c: string) => (ax: number, ay: number) => denimPx(c, ax, ay)
  const thread = (c: string) => (luminance(c) > 0.6 ? tint(c, -0.4) : tint(c, 0.5))
  const ink = luminance(top) > 0.6 ? '#14213d' : '#f8f9fa'
  const light = luminance(top) > 0.6
  const fz = (d: Dims) => d.td / 2
  /** Trousers: the legs, and the torso from the belt down. */
  const trousers = (c: Px, len = 0.86, hips = true): { leg: LL[]; torso: TL[] } => ({ leg: [down(len, c)], torso: hips ? [band(BELT, 1, c)] : [] })
  /** Shirt sleeves (`n` metres), a crease where they end. */
  const sleeves = (n: number, c: Px): LL[] => [(f, m, _s, _x, _w, ax, ay) => (m < n ? (m > n - 0.02 && n < 0.45 && isSide(f) ? tint(px(c, ax, ay), -0.18) : px(c, ax, ay)) : undefined)]
  /** The crease down the front of trousers. */
  const crease = (len = 0.86, c = bottom): LL => (f, m, _s, x, w) => (f === 'pz' && m < len && x === Math.floor(w / 2) ? tint(c, -0.12) : undefined)
  /** Shorts' hem, in shade. */
  const shortHem = (len: number, c: string): LL => (f, m) => (isSide(f) && m >= len - 0.02 && m < len ? tint(c, -0.2) : undefined)
  const skirt = (paint: Px, w: number, d: number, hem: number, extra: Partial<Skirt> = {}): Skirt => ({ paint: (_f, _x, _y, _w, _h, ax, ay) => px(paint, ax, ay), w, d, hem, ...extra })
  const pleats = (c: Px, every = 4): Px => (ax, ay) => (ax % every === 0 ? tint(px(c, ax, ay), -0.14) : px(c, ax, ay))

  switch (outfit) {
    case 'suit': {
      const tie = top === '#b02e0c' || top === '#d6336c' ? '#14213d' : '#c2255c'
      const jacket = cloth(top, 0.05)
      const tr = trousers(cloth(bottom, 0.05))
      return {
        // The jacket open on the shirt, a V down to the button; the lapels lit on their edge, the flap pockets.
        torso: [
          front((cx, m) => m < 0.24 && Math.abs(cx) <= Math.max(0, 3.2 - (m / TXM) * 0.32), '#f4f5f7'),
          front((cx, m) => m < 0.22 && Math.abs(cx) <= Math.max(0, 3.2 - (m / TXM) * 0.32) + 1.2, tint(top, 0.16)),
          front((cx, m) => Math.abs(cx) < 0.6 && m > 0.24, tint(top, -0.3)),
          front((_cx, m, k) => m > 0.18 && m < 0.2 && Math.abs(Math.abs(k) - 0.62) < 0.18, tint(top, -0.3)),
          band(0, 1, jacket),
        ],
        arm: sleeves(0.47, jacket),
        leg: [crease(0.86, tint(bottom, 0.22)), ...tr.leg],
        sleeve: 0.47,
        legs: 0.86,
        cuff: '#f4f5f7',
        collar: (f, x) => (f === 'pz' && x === 4 ? '#d8dade' : '#f4f5f7'),
        shoe: 'dress',
        shoeC,
        extras: (k, d) => {
          const z = fz(d)
          // The tie and its knot, the lapels, the pocket square, the buttons, the jacket's tail.
          k.add('chest', { s: [0.05, 0.035, 0.022], p: [0, TOP - 0.03, z + 0.008], paint: tint(tie, -0.1), bevel: 0.5 })
          k.add('chest', { s: [0.045, 0.2, 0.012], p: [0, TOP - 0.15, z + 0.004], paint: (f, x, y) => (f === 'pz' && (x + y) % 4 === 0 ? tint(tie, 0.2) : tie) })
          for (const s of [-1, 1]) {
            k.add('chest', { s: [0.035, 0.2, 0.012], p: [s * 0.065, TOP - 0.11, z + 0.002], r: [0, 0, s * 0.42], paint: clothP(tint(top, 0.08), 0.04) })
            k.add('chest', { s: [0.085, 0.016, 0.014], p: [s * d.ww * 0.3, 0.94, d.wd / 2 + 0.004], paint: tint(top, -0.12), bevel: 0.6 })
          }
          k.add('chest', { s: [0.06, 0.022, 0.012], p: [d.tw * 0.3, TOP - 0.13, z + 0.003], paint: (f, x) => (f === 'pz' && x % 2 ? '#ffd8e4' : '#f4f5f7') })
          for (const y of [1.02, 0.95]) k.add('chest', { s: [0.018, 0.018, 0.008], p: [0, y, d.wd / 2 + 0.003], paint: tint(top, -0.4), bevel: 0 })
          k.add('chest', { s: [d.tw * 1.02, 0.09, d.td * 1.06], p: [0, TORSO_BOTTOM + 0.025, 0], paint: (f, x, _y, w, _h, ax, ay) => (f === 'pz' && Math.abs(x - (w - 1) / 2) < 0.6 ? tint(top, -0.3) : jacket(ax, ay)) })
        },
      }
    }
    case 'pagne': {
      const fabric = l.bottomColor || top
      if (femme) {
        // The fitted wax top with a square neck and puffed sleeves, the pagne wrapped to the ankles, its knot at the hip.
        return {
          torso: [
            front((_cx, m, k) => m < 0.06 && Math.abs(k) < 0.55, SKIN),
            front((_cx, m, k) => m >= 0.06 && m < 0.08 && Math.abs(k) < 0.62, tint(top, -0.35)),
            band(0, 1, wax(top)),
          ],
          arm: sleeves(0.13, wax(top)),
          leg: [],
          sleeve: 0.13,
          legs: 0,
          puff: (f, _x, y, _w, h, ax, ay) => (isSide(f) && y === h - 1 ? tint(top, -0.35) : waxBig(top, l.pattern, ax, ay)),
          shoe: 'sandal',
          shoeC,
          // Folds: every few texels a fold in shadow, its edge lit.
          skirt: {
            paint: (f, x, _y, _w, _h, ax, ay) => {
              const base = waxBig(fabric, l.pattern, ax, ay)
              if (!isSide(f)) return base
              const k = x % 5
              return k === 0 ? tint(base, -0.16) : k === 1 ? tint(base, 0.06) : base
            },
            w: 1.12,
            d: 1.3,
            hem: 0.06,
            band: tint(fabric, -0.3),
            wrap: true,
          },
          extras: (k, d) => {
            const x = d.ww * 0.5
            const knot = (f: F, xx: number, y: number, _w: number, _h: number, ax: number, ay: number) => (isSide(f) && (xx + y) % 3 === 0 ? tint(fabric, -0.3) : waxBig(fabric, l.pattern, ax, ay))
            k.add('chest', { s: [0.07, 0.06, 0.05], p: [x, 0.93, d.wd * 0.38], paint: knot })
            k.add('chest', { s: [0.035, 0.12, 0.014], p: [x - 0.012, 0.85, d.wd * 0.38 + 0.03], r: [0, 0, 0.18], paint: knot })
            k.add('chest', { s: [0.03, 0.09, 0.014], p: [x + 0.02, 0.86, d.wd * 0.38 + 0.026], r: [0, 0, -0.25], paint: knot })
          },
        }
      }
      // A man's pagne: the long wax shirt, closed at the neck, over plain trousers.
      const tr = trousers(cloth(bottom, 0.05))
      return {
        torso: [crew(tint(top, -0.3)), front((cx, m) => Math.abs(cx) < 0.6 && m < 0.12, tint(top, -0.3)), band(0, 1, wax(top))],
        arm: sleeves(0.13, wax(top)),
        leg: [crease(), ...tr.leg],
        sleeve: 0.13,
        legs: 0.86,
        cuff: tint(top, -0.3),
        hem: tint(bottom, -0.15),
        shoe: 'dress',
        shoeC,
        extras: (k, d) => k.add('chest', { s: [d.ww * 1.06, 0.07, d.wd * 1.08], p: [0, TORSO_BOTTOM + 0.02, 0], paint: (f, _x, y, _w, h, ax, ay) => (y === h - 1 && isSide(f) ? tint(top, -0.3) : waxBig(top, l.pattern, ax, ay)) }),
      }
    }
    case 'chemise-pagne': {
      // The wax shirt, open at the neck, its collar, short sleeves, worn out over the trousers.
      const tr = trousers(cloth(bottom, 0.05))
      return {
        torso: [
          front((cx, m) => m < 0.06 && Math.abs(cx) < 2.2 - (m / TXM) * 0.6, SKIN),
          front((cx, m) => Math.abs(cx) < 0.6 && m < HIPS, (_ax, ay) => (ay % 4 === 1 ? '#f4efe6' : tint(top, -0.22))),
          band(0, 1, wax(top)),
        ],
        arm: sleeves(0.17, wax(top)),
        leg: [crease(), ...tr.leg],
        sleeve: 0.17,
        legs: 0.86,
        cuff: tint(top, -0.3),
        hem: tint(bottom, -0.15),
        collar: (f, x, _y, w, _h, ax, ay) => (f === 'pz' && Math.abs(x - (w - 1) / 2) < 1.6 ? null : waxBig(tint(top, -0.15), l.pattern, ax, ay)),
        shoe: 'dress',
        shoeC,
        extras: (k, d) => {
          const z = fz(d)
          for (const s of [-1, 1]) k.add('chest', { s: [0.06, 0.05, 0.012], p: [s * 0.05, TOP - 0.03, z + 0.004], r: [0, 0, s * -0.5], paint: tint(top, -0.3) })
          k.add('chest', { s: [d.ww * 1.06, 0.07, d.wd * 1.08], p: [0, TORSO_BOTTOM + 0.02, 0], paint: (f, _x, y, _w, h, ax, ay) => (y === h - 1 && isSide(f) ? tint(top, -0.3) : waxBig(top, l.pattern, ax, ay)) })
        },
      }
    }
    case 'boubou':
    case 'bazin':
    case 'imam': {
      // The grand boubou (plain, gold embroidery), the bazin (shiny damask, embroidered in its own
      // thread), the imam's long white one: wide to the feet over trousers, wide sleeves.
      const bazin = outfit === 'bazin'
      const imam = outfit === 'imam'
      const gold = outfit === 'boubou' ? '#e8b93c' : thread(top)
      const sheen = bazin ? (ax: number, ay: number) => ((ax + ay) % 5 === 0 ? tint(top, 0.12) : grain(top, ax, ay, 0.05)) : cloth(top, 0.05)
      const embroider = (cx: number, m: number) => {
        const c = Math.abs(cx)
        const y = m / TXM
        if (y < 1 && c < 4) return true
        if (imam) return y < 8 && c < 1.6 && Math.floor(y) % 2 === (cx < 0 ? 0 : 1)
        if (y < 9 && c < 3 - y * 0.25 && (Math.round(cx) + Math.round(y)) % 2 === 0) return true
        return y < 11 && Math.abs(c - (3.2 - y * 0.25)) < 0.5
      }
      const tr = trousers(cloth(bottom, 0.05))
      const bellP: Paint = (f, x, y, _w, h, ax, ay) => (!imam && isSide(f) && y >= h - 2 ? (x % 2 ? gold : tint(top, -0.15)) : sheen(ax, ay))
      return {
        torso: [front(embroider, gold), back((cx, m) => bazin && m < 0.02 && Math.abs(cx) < 6, gold), band(0, 1, sheen)],
        arm: sleeves(0.47, sheen),
        leg: tr.leg,
        sleeve: 0.47,
        legs: 0.86,
        collar: (f, x) => (isSide(f) && x % 2 ? tint(gold, -0.2) : gold),
        bell: imam ? undefined : bellP,
        shoe: outfit === 'boubou' ? 'sandal' : 'slide',
        shoeC,
        skirt: { paint: (f, x, _y, _w, _h, ax, ay) => (isSide(f) && x % 5 === 0 ? tint(top, -0.12) : sheen(ax, ay)), w: bazin ? 1.26 : imam ? 1.2 : 1.24, d: bazin ? 1.48 : imam ? 1.4 : 1.45, hem: bazin ? 0.06 : imam ? 0.05 : 0.08 },
      }
    }
    case 'kaba': {
      // One long, loose wax dress to the ankles, wide short sleeves, a rounded neck.
      const fabric = l.bottomColor || top
      return {
        torso: [scoop(4, 0.05), band(0, 1, wax(top))],
        arm: sleeves(0.22, wax(top)),
        leg: [],
        sleeve: 0.22,
        legs: 0,
        cuff: tint(top, -0.25),
        puff: (f, _x, y, _w, h, ax, ay) => (isSide(f) && y === h - 1 ? tint(top, -0.25) : waxBig(top, l.pattern, ax, ay)),
        shoe: 'sandal',
        shoeC,
        skirt: { paint: (f, x, _y, _w, _h, ax, ay) => (isSide(f) && x % 6 === 0 ? tint(waxBig(fabric, l.pattern, ax, ay), -0.14) : waxBig(fabric, l.pattern, ax, ay)), w: 1.22, d: 1.4, hem: 0.05 },
      }
    }
    case 'robe': {
      // The evening dress in wax: bare shoulders and arms, thin straps, to the knee, heels.
      const fabric = l.bottomColor || top
      return {
        torso: [
          shoulders((_cx, k) => Math.abs(Math.abs(k) - 0.6) < 0.1, top),
          shoulders(() => true, SKIN),
          front((_cx, m, k) => m < 0.08 && Math.abs(Math.abs(k) - 0.6) >= 0.1, SKIN),
          back((_cx, m, k) => m < 0.08 && Math.abs(Math.abs(k) - 0.6) >= 0.1, SKIN),
          sides((m) => m < 0.08, SKIN),
          front((_cx, m) => m >= 0.08 && m < 0.1, tint(top, -0.3)),
          band(0, 1, wax(top)),
        ],
        arm: [],
        leg: [],
        sleeve: 0,
        legs: 0,
        shoe: 'heel',
        shoeC,
        skirt: { paint: (f, x, _y, _w, _h, ax, ay) => (isSide(f) && x % 4 === 0 ? tint(waxBig(fabric, l.pattern, ax, ay), -0.14) : waxBig(fabric, l.pattern, ax, ay)), w: 1.12, d: 1.3, hem: 0.45, band: tint(fabric, -0.3) },
      }
    }
    case 'jersey': {
      // The Éléphants' kit: orange, the green collar and badge, white shorts, green socks, boots.
      const green = '#009a44'
      return {
        torso: [
          crew(green),
          front((cx, m, k) => k > 0.3 && k < 0.6 && m > 0.06 && m < 0.1 && Math.abs(cx) > 0, (ax) => (ax % 2 ? green : '#f2b705')),
          sides((m) => m < 0.4, (_ax, ay) => (ay % 2 ? tint(top, -0.08) : top)),
          band(0, 0.41, cloth(top, 0.04)),
          band(0.41, 0.45, tint(bottom, -0.18)),
          band(0.45, 1, cloth(bottom, 0.04)),
        ],
        arm: [...sleeves(0.13, cloth(top, 0.04))],
        leg: [shortHem(0.28, bottom), down(0.28, cloth(bottom, 0.04)), down(0.72, (_ax, ay) => (ay % 3 === 0 ? tint(green, 0.1) : green), 0.44)],
        sleeve: 0.13,
        legs: 0.28,
        cuff: green,
        shoe: 'boot',
        shoeC,
      }
    }
    case 'debardeur':
    case 'basket':
    case 'souscorps': {
      // The ribbed vest (or the numbered basket jersey, or the thin sous-corps) and shorts.
      const basket = outfit === 'basket'
      const sous = outfit === 'souscorps'
      const trim = basket ? (luminance(top) > 0.69 ? '#14213d' : '#f8f9fa') : null
      const rib = (ax: number, ay: number) => (ax % 2 ? tint(top, sous ? -0.07 : -0.06) : grain(top, ax, ay, 0.04))
      const len = basket ? 0.49 : 0.28
      const torso: TL[] = [
        shoulders((_cx, k) => Math.abs(Math.abs(k) - 0.55) < (sous ? 0.08 : 0.16), basket ? trim! : top),
        shoulders(() => true, SKIN),
        sides((m) => m < (basket ? 0.12 : sous ? 0.12 : 0.08), SKIN),
        front((cx, m) => m < (sous ? 0.1 : 0.06) && Math.abs(cx) < (sous ? 6 : 5) - (m / TXM) * 0.6, SKIN),
        back((cx, m) => m < 0.04 && Math.abs(cx) < 4, SKIN),
      ]
      if (trim) {
        torso.push(front((cx, m) => m < 0.09 && Math.abs(cx) < 6 - (m / TXM) * 0.6 + 1, trim))
        torso.push(sides((m) => m >= 0.12 && m < 0.14, trim))
        torso.push((f, cx, _k, m) => ((f === 'pz' || f === 'nz') && numberAt(f === 'pz' ? cx : -cx, m) ? trim : undefined))
      }
      torso.push(band(0, 0.41, basket ? cloth(top, 0.04) : rib))
      torso.push(band(0.41, 0.45, basket ? trim! : tint(bottom, -0.25)))
      if (!basket && !sous) torso.push(front((cx, m) => m >= 0.45 && m < 0.5 && Math.abs(cx) < 1.5 && Math.abs(cx) > 0.4, '#f4f1ea'))
      torso.push(band(0.45, 1, cloth(bottom)))
      const sideStripe = basket ? trim! : sous ? undefined : tint(bottom, 0.85)
      return {
        torso,
        arm: [],
        leg: [shortHem(len, bottom), ...(sideStripe ? [stripe(len, sideStripe, basket ? 1.5 : 0.8)] : []), down(len, cloth(bottom))],
        sleeve: 0,
        legs: len,
        shoe: basket ? 'boot' : 'slide',
        shoeC,
      }
    }
    case 'survet': {
      // The tracksuit: the zip jacket, two stripes down the arms and legs, ankle cuffs, sneakers.
      const st = light ? '#14213d' : '#f8f9fa'
      return {
        torso: [front((cx, m) => Math.abs(cx + 1) < 0.6 && m < HIPS, '#c9ccd4'), crew(tint(top, -0.15)), band(0.46, 0.5, tint(top, -0.15)), band(0, 0.5, cloth(top)), band(0.5, 1, cloth(bottom))],
        arm: [stripe(0.45, st, 1.2), ...sleeves(0.47, cloth(top))],
        leg: [(f, m, side, x, w) => (m < 0.72 && outer(f, side) && Math.abs(x - Math.floor(w / 2)) === 1 ? st : undefined), down(0.86, cloth(bottom))],
        sleeve: 0.47,
        legs: 0.86,
        cuff: tint(top, -0.2),
        hem: tint(bottom, -0.2),
        shoe: 'sneaker',
        shoeC,
      }
    }
    case 'chemise': {
      // Shirt and trousers, for the office: the collar, buttons, a brown belt.
      const tr = trousers(cloth(bottom, 0.05))
      return {
        torso: [front((cx, m) => m < 0.04 && Math.abs(cx) < 1, SHADE), buttons(tint(top, -0.35)), belt('#2a1c12', '#c9b27a'), ...tr.torso, band(0, 1, cloth(top, 0.05))],
        arm: sleeves(0.47, cloth(top, 0.05)),
        leg: [crease(), ...tr.leg],
        sleeve: 0.47,
        legs: 0.86,
        cuff: tint(top, -0.12),
        collar: (f, x, _y, w) => (f === 'pz' && Math.abs(x - (w - 1) / 2) < 1 ? null : tint(top, 0.12)),
        shoe: 'dress',
        shoeC,
        extras: (k, d) => {
          for (const s of [-1, 1]) k.add('chest', { s: [0.06, 0.045, 0.012], p: [s * 0.045, TOP - 0.03, fz(d) + 0.004], r: [0, 0, s * -0.45], paint: tint(top, 0.18) })
        },
      }
    }
    case 'uniforme':
    case 'policier':
    case 'gendarme':
    case 'vigile': {
      // The school's khaki shirt and the uniforms: epaulettes, two pockets, buttons, the badge, the
      // belt; police: the tie and the red stripe; vigile: the yellow band, long sleeves.
      const school = outfit === 'uniforme'
      const seam = tint(top, -0.22)
      const long = outfit === 'vigile'
      const pocket = (cx: number, m: number, k: number) => m > 0.08 && m < 0.15 && Math.abs(Math.abs(k) - 0.55) < 0.22 && Math.abs(cx) > 1
      const torso: TL[] = [
        shoulders((_cx, k) => Math.abs(Math.abs(k) - 0.5) < 0.3, tint(top, -0.15)),
        front((cx, m, k) => pocket(cx, m, k) && (m < 0.095 || Math.abs(Math.abs(k) - 0.55) > 0.18), seam),
      ]
      if (!school) torso.push(front((_cx, m, k) => k < -0.3 && k > -0.7 && m > 0.06 && m < 0.08, long ? '#f2b705' : '#e8b93c'))
      if (outfit === 'policier') torso.push(front((cx, m) => Math.abs(cx) < 1 && m < 0.24, (_ax, ay) => (ay % 5 === 0 ? '#2b3a5c' : '#1f2a44')))
      if (long) torso.push(band(0.18, 0.21, '#f2b705'))
      torso.push(buttons(luminance(top) > 0.55 ? tint(top, -0.4) : tint(top, 0.45)))
      const girl = school && femme
      if (!girl) torso.push(belt(school ? '#2a1c12' : '#141416', school ? '#c9b27a' : '#c9ccd4'), band(BELT, 1, cloth(bottom)))
      torso.push(band(0, 1, cloth(top, 0.05)))
      const sleeve = long ? 0.47 : 0.18
      return {
        torso,
        arm: sleeves(sleeve, cloth(top, 0.05)),
        leg: girl
          ? [down(0.72, (ax, ay) => grain('#f4f4f4', ax, ay, 0.04), 0.48)]
          : [...(outfit === 'policier' ? [stripe(0.86, '#c92a2a', 0.7)] : []), crease(), down(0.86, cloth(bottom))],
        sleeve,
        legs: girl ? 0 : 0.86,
        cuff: long ? tint(top, -0.15) : undefined,
        hem: girl ? undefined : tint(bottom, -0.15),
        collar: (f, x, _y, w) => (f === 'pz' && Math.abs(x - (w - 1) / 2) < 1 ? null : tint(top, 0.1)),
        shoe: school ? 'dress' : 'boot',
        shoeC,
        skirt: girl ? { paint: (f, x, _y, _w, _h, ax, ay) => (isSide(f) && x % 4 === 0 ? tint(bottom, -0.16) : grain(bottom, ax, ay, 0.05)), w: 1.1, d: 1.25, hem: 0.36, band: tint(bottom, -0.25) } : undefined,
      }
    }
    case 'jupe': {
      // A fitted top with a rounded neck and a skirt to the knee, sandals.
      return {
        torso: [scoop(4, 0.04), band(0, 0.36, cloth(top)), band(0.36, 1, cloth(bottom))],
        arm: sleeves(0.09, cloth(top)),
        leg: [],
        sleeve: 0.09,
        legs: 0,
        shoe: 'sandal',
        shoeC,
        skirt: skirt(pleats(cloth(bottom)), 1.1, 1.22, 0.4, { band: tint(bottom, -0.2) }),
      }
    }
    case 'blouson': {
      // A jacket open on a white tee, and jeans: the zip's edges, cuffs, the jacket's band.
      const tr = trousers(denim(bottom))
      return {
        torso: [
          front((cx, m) => Math.abs(cx) < 2 && m < 0.46, cloth('#f4f4f4', 0.03)),
          front((cx, m) => Math.abs(cx) < 3 && m < 0.46, tint(top, -0.2)),
          band(0.42, 0.46, tint(top, -0.2)),
          band(0, 0.46, cloth(top)),
          belt(),
          ...tr.torso,
        ],
        arm: sleeves(0.47, cloth(top)),
        leg: [(f, m, _s, x, w) => (f === 'pz' && m < 0.86 && (x === 1 || x === w - 2) && m > 0.04 && m < 0.12 ? tint(bottom, 0.3) : undefined), ...tr.leg],
        sleeve: 0.47,
        legs: 0.86,
        cuff: tint(top, -0.25),
        hem: tint(bottom, 0.08),
        collar: (f, x, _y, w) => (f === 'pz' && Math.abs(x - (w - 1) / 2) < 2 ? null : tint(top, -0.12)),
        shoe: 'sneaker',
        shoeC,
      }
    }
    case 'salopette': {
      // Dungarees over a tee: the bib, the straps and their buttons, the pocket.
      const tee = '#f4efe6'
      const dung = denim(top)
      return {
        torso: [
          front((_cx, m, k) => m >= 0.16 && m < 0.18 && Math.abs(Math.abs(k) - 0.62) < 0.12, '#c9b27a'),
          front((cx, m) => m > 0.24 && m < 0.31 && Math.abs(cx) < 2.5, (_ax, ay) => (m0(ay) ? tint(top, -0.25) : tint(top, -0.12))),
          front((_cx, m, k) => (m >= 0.16 && Math.abs(k) < 0.75) || (m < 0.18 && Math.abs(Math.abs(k) - 0.62) < 0.12), dung),
          back((_cx, m, k) => (m >= 0.3 && Math.abs(k) < 0.8) || Math.abs(Math.abs(k) - 0.62) < 0.12 || Math.abs(k - (m * 2 - 0.3)) < 0.1, dung),
          shoulders((_cx, k) => Math.abs(Math.abs(k) - 0.62) < 0.12, dung),
          crew(tint(tee, -0.12)),
          band(0.3, 1, dung),
          band(0, 0.3, cloth(tee, 0.04)),
        ],
        arm: sleeves(0.13, cloth(tee, 0.04)),
        leg: [down(0.86, dung)],
        sleeve: 0.13,
        legs: 0.86,
        hem: tint(top, -0.2),
        shoe: 'sneaker',
        shoeC,
      }
    }
    case 'jogging':
    case 'sweat': {
      // A tee-shirt (or the hoodie: its kangaroo pocket, the drawstrings, the hood down behind the
      // neck) and the jogging: the waistband and its cord, cuffed at the ankle.
      const hoodie = outfit === 'sweat'
      const torso: TL[] = hoodie
        ? [
            front((cx, m) => Math.abs(Math.abs(cx) - 1.5) < 0.6 && m < 0.1, (_ax, ay) => (ay % 3 === 0 ? '#d8d4ca' : '#f4f1ea')),
            front((cx, m) => m > 0.26 && m < 0.38 && Math.abs(cx) < 4.5 - (0.38 - m) * 6, (_ax, ay) => (m0(ay) ? tint(top, -0.2) : tint(top, -0.1))),
            crew(tint(top, -0.2)),
            band(0.45, 0.5, tint(top, -0.2)),
            band(0, 0.5, cloth(top)),
            band(0.5, 1, cloth(bottom)),
          ]
        : [crew(tint(top, -0.18)), band(0, 0.36, cloth(top)), band(0.36, 0.41, tint(bottom, -0.15)), front((cx, m) => m >= 0.41 && m < 0.46 && Math.abs(cx) < 1.5 && Math.abs(cx) > 0.4, '#f4f1ea'), band(0.41, 1, cloth(bottom))]
      return {
        torso,
        arm: sleeves(hoodie ? 0.47 : 0.13, cloth(top)),
        leg: [down(0.86, cloth(bottom))],
        sleeve: hoodie ? 0.47 : 0.13,
        legs: 0.86,
        cuff: hoodie ? tint(top, -0.2) : undefined,
        hem: tint(bottom, -0.25),
        shoe: 'sneaker',
        shoeC,
        extras: hoodie
          ? (k, d) => {
              // The hood, down behind the neck, its opening in shade.
              k.add('chest', { s: [d.tw * 0.8, 0.12, 0.09], p: [0, TOP - 0.03, -d.td / 2 - 0.04], paint: (f, x, y, w, _h, ax, ay) => (f === 'py' && Math.abs(x - (w - 1) / 2) < w / 2 - 2 && y > 1 ? tint(top, -0.4) : grain(tint(top, -0.08), ax, ay, 0.05)) })
            }
          : undefined,
      }
    }
    case 'soutane':
    case 'soeur':
    case 'abaya': {
      // The priest's cassock (the white collar, a row of buttons), the sister's habit (the cross),
      // the abaya: long, plain, to the feet.
      const sister = outfit === 'soeur'
      const torso: TL[] = []
      if (outfit === 'soutane') torso.push(buttons(tint(top, 0.3), HIPS, 0))
      if (sister)
        torso.push(
          front((cx, m) => (Math.abs(cx) < 0.6 && m > 0.03 && m < 0.13) || (Math.abs(cx) < 2 && Math.abs(m - 0.06) < 0.011), '#e8b93c'),
          front((cx, m) => Math.abs(Math.abs(cx) - (2.4 - (m / TXM) * 0.4)) < 0.6 && m < 0.06, '#d8b25a'),
        )
      torso.push(band(0, 1, cloth(top, 0.05)))
      return {
        torso,
        arm: sleeves(0.47, cloth(top, 0.05)),
        leg: outfit === 'soutane' ? [down(0.86, cloth(top))] : [],
        sleeve: 0.47,
        legs: outfit === 'soutane' ? 0.86 : 0,
        collar: outfit === 'soutane' ? (f) => (f === 'nz' ? tint(top, -0.1) : '#f8f9fa') : sister ? () => tint(top, -0.12) : undefined,
        shoe: 'dress',
        shoeC,
        skirt: { paint: (f, x, _y, _w, _h, ax, ay) => (isSide(f) && x % 5 === 0 ? tint(top, -0.12) : grain(top, ax, ay, 0.05)), w: sister ? 1.14 : outfit === 'abaya' ? 1.16 : 1.12, d: sister ? 1.3 : outfit === 'abaya' ? 1.34 : 1.3, hem: outfit === 'soutane' ? 0.04 : 0.03 },
      }
    }
    case 'pasteur': {
      // The pastor: black shirt and suit, the lapels, the white tab at the throat.
      const tr = trousers(cloth(bottom, 0.05))
      return {
        torso: [front((cx, m) => Math.abs(cx) < 1 && m < 0.03, '#f8f9fa'), front((cx, m) => Math.abs(Math.abs(cx) - 3.4) < 1 && m < 0.44, tint(top, 0.14)), band(0, 1, cloth(top, 0.05))],
        arm: sleeves(0.47, cloth(top, 0.05)),
        leg: [crease(), ...tr.leg],
        sleeve: 0.47,
        legs: 0.86,
        cuff: tint(top, 0.12),
        collar: () => tint(top, 0.05),
        shoe: 'dress',
        shoeC,
      }
    }
    case 'blouse': {
      // The white coat, open on the clothes, to the knee; the stethoscope, the pocket and its pen.
      const under = l.bottomColor || '#74c0fc'
      const legsC = l.bottomColor || '#2b2f45'
      return {
        torso: [
          front((cx, m) => (Math.abs(Math.abs(cx) - 3) < 0.7 && m < 0.12) || (Math.abs(cx) < 3.6 && Math.abs(m - 0.13) < 0.012), '#3a3d42'),
          front((cx, m) => Math.abs(cx) < 0.8 && Math.abs(m - 0.16) < 0.03, '#9aa0a8'),
          front((_cx, m, k) => k > 0.45 && k < 0.85 && m > 0.2 && m < 0.27, tint(top, -0.12)),
          front((_cx, m, k) => k > 0.55 && k < 0.65 && m > 0.17 && m <= 0.2, '#2a6cf0'),
          front((cx) => Math.abs(cx) < 2.2, cloth(under)),
          front((cx) => Math.abs(cx) < 3, tint(top, -0.1)),
          band(0, 1, cloth(top, 0.04)),
        ],
        arm: sleeves(0.47, cloth(top, 0.04)),
        leg: [down(0.86, cloth(legsC))],
        sleeve: 0.47,
        legs: 0.86,
        collar: (f, x, _y, w) => (f === 'pz' && Math.abs(x - (w - 1) / 2) < 2 ? null : tint(top, -0.06)),
        shoe: 'sneaker',
        shoeC,
        skirt: { paint: (f, x, _y, w, _h, ax, ay) => (f === 'pz' && Math.abs(x - (w - 1) / 2) < 1.4 ? tint(top, -0.12) : grain(top, ax, ay, 0.04)), w: 1.08, d: 1.15, hem: 0.5 },
      }
    }
    case 'bleu': {
      // The mechanic's boiler suit, one colour from neck to ankle: the zip, the grey band, a pocket.
      return {
        torso: [
          front((cx, m) => Math.abs(cx) < 0.6 && m < HIPS, tint(top, -0.25)),
          front((_cx, m, k) => k < -0.3 && k > -0.75 && m > 0.08 && m < 0.15, tint(top, -0.18)),
          band(0.32, 0.35, '#b8bec7'),
          band(0, 1, cloth(top)),
        ],
        arm: sleeves(0.47, cloth(top)),
        leg: [down(0.52, '#b8bec7', 0.49), down(0.86, cloth(top))],
        sleeve: 0.47,
        legs: 0.86,
        cuff: tint(top, -0.2),
        hem: tint(top, -0.2),
        collar: () => tint(top, -0.1),
        shoe: 'boot',
        shoeC,
      }
    }
    case 'cuisinier': {
      // The chef's jacket: double-breasted, two rows of buttons, the collar band; checked trousers.
      const check = (ax: number, ay: number) => ((Math.floor(ax / 2) + Math.floor(ay / 2)) % 2 ? grain(bottom, ax, ay, 0.06) : tint(bottom, 0.5))
      return {
        torso: [
          front((cx, m) => Math.abs(Math.abs(cx - 0.8) - 3) < 0.6 && m > 0.06 && m < 0.4 && Math.round(m / TXM) % 5 === 2, tint(top, -0.3)),
          front((cx, m) => cx > -2 && cx < -1 && m < 0.44, tint(top, -0.08)),
          band(0, 1, cloth(top, 0.04)),
        ],
        arm: sleeves(0.47, cloth(top, 0.04)),
        leg: [down(0.86, check)],
        sleeve: 0.47,
        legs: 0.86,
        collar: () => tint(top, -0.08),
        shoe: 'dress',
        shoeC,
      }
    }
    case 'infirmier': {
      // The nurse's tunic: short sleeves, a V at the neck, the red cross on the chest; matching trousers.
      return {
        torso: [
          vee(0.08, tint(top, -0.15)),
          front((cx, m) => {
            const [x, y] = [cx - 4, m - 0.12]
            return (Math.abs(x) < 1.1 && Math.abs(y) < 0.05) || (Math.abs(y) < 0.016 && Math.abs(x) < 2.6)
          }, '#e03131'),
          band(0, 0.44, cloth(top, 0.04)),
          band(0.44, 1, cloth(bottom, 0.04)),
        ],
        arm: sleeves(0.18, cloth(top, 0.04)),
        leg: [down(0.86, cloth(bottom, 0.04))],
        sleeve: 0.18,
        legs: 0.86,
        cuff: tint(top, -0.1),
        shoe: 'sneaker',
        shoeC,
      }
    }
    case 'maillot': {
      // For the sea and the pool: a one-piece swimsuit, or swim trunks; barefoot.
      const suit = cloth(top, 0.05)
      if (femme)
        return {
          torso: [
            shoulders((_cx, k) => Math.abs(Math.abs(k) - 0.5) < 0.1, top),
            shoulders(() => true, SKIN),
            sides((m) => m < 0.12, SKIN),
            front((cx, m) => m < 0.07 && Math.abs(cx) < 6 - (m / TXM) * 0.8, SKIN),
            back((cx, m) => m < 0.1 && Math.abs(cx) < 5, SKIN),
            band(0, 1, suit),
          ],
          arm: [],
          leg: [down(0.03, suit)],
          sleeve: 0,
          legs: 0,
          shoe: 'none',
          shoeC,
        }
      return {
        torso: [band(0.44, 0.47, tint(top, -0.25)), band(0.44, 1, suit)],
        arm: [],
        leg: [shortHem(0.14, top), down(0.14, suit)],
        sleeve: 0,
        legs: 0.14,
        shoe: 'none',
        shoeC,
      }
    }
    case 'serviette': {
      // Out of the shower: wrapped in a towel, a blue band, barefoot.
      const towel = (ax: number, ay: number) => (ay % 8 === 0 ? '#74c0fc' : grain('#f8f9fa', ax, ay, 0.04))
      return {
        torso: femme ? [band(0, 0.08, SKIN), shoulders(() => true, SKIN), band(0.08, 1, towel)] : [band(0.42, 1, towel)],
        arm: [],
        leg: [],
        sleeve: 0,
        legs: 0,
        shoe: 'none',
        shoeC,
        skirt: skirt(towel, 1.08, 1.2, femme ? 0.5 : 0.45),
      }
    }
    case 'tee-short':
    case 'maillot-club': {
      // The child's tee-shirt with its round print and shorts; the club shirt with its stripes, the
      // sponsor's band, the badge, socks up.
      const club = outfit === 'maillot-club'
      const torso: TL[] = [crew(club ? ink : tint(top, -0.15))]
      if (club)
        torso.push(
          front((_cx, m, k) => k > 0.35 && k < 0.6 && m > 0.05 && m < 0.09, '#e8b93c'),
          front((_cx, m) => m > 0.13 && m < 0.18, ink),
          (f, _cx, k, m) => ((f === 'pz' || f === 'nz') && Math.abs(Math.abs(k) - 0.62) < 0.13 && m < 0.41 ? tint(top, 0.3) : undefined),
        )
      else
        torso.push(
          front((cx, m) => {
            const r = Math.hypot(cx, (m - 0.14) / TXM)
            return r < 2.2
          }, '#ff7a00'),
          front((cx, m) => {
            const r = Math.hypot(cx, (m - 0.14) / TXM)
            return r < 3.6
          }, ink),
        )
      torso.push(band(0, 0.41, cloth(top)), band(0.41, 0.45, tint(bottom, -0.25)), band(0.45, 1, cloth(bottom)))
      return {
        torso,
        arm: sleeves(0.13, cloth(top)),
        leg: [shortHem(0.28, bottom), down(0.28, cloth(bottom)), ...(club ? [down(0.72, (_ax, ay) => (ay % 3 === 0 ? tint(top, 0.15) : top), 0.42)] : [])],
        sleeve: 0.13,
        legs: 0.28,
        cuff: club ? ink : undefined,
        shoe: club ? 'boot' : 'sandal',
        shoeC,
      }
    }
    case 'robe-volants': {
      // The little girl's dress: puffed sleeves, a white collar, a ribbon at the waist and its bow,
      // a flared skirt with frills, white socks.
      const c = top
      return {
        torso: [front((cx, m) => m < 0.02 && Math.abs(cx) < 4, SHADE), band(0.28, 0.33, tint(c, -0.28)), band(0, 1, cloth(c, 0.05))],
        arm: sleeves(0.09, cloth(tint(c, 0.15))),
        leg: [down(0.72, (ax, ay) => grain('#f8f9fa', ax, ay, 0.04), 0.52)],
        sleeve: 0.09,
        legs: 0,
        collar: () => '#f8f9fa',
        puff: (f, _x, y, _w, h, ax, ay) => (isSide(f) && y === h - 1 ? '#f8f9fa' : (ax + ay) % 3 === 0 ? tint(c, 0.25) : tint(c, 0.12)),
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
          const z = fz(d)
          for (const s of [-1, 1]) k.add('chest', { s: [0.08, 0.045, 0.012], p: [s * 0.045, TOP - 0.03, z + 0.004], r: [0, 0, s * -0.2], paint: '#f8f9fa' })
          k.add('chest', { s: [0.14, 0.06, 0.03], p: [0, TOP - 0.3, -d.wd / 2 - 0.015], paint: (f, x) => (f === 'nz' && x % 7 === 3 ? tint(c, -0.5) : tint(c, -0.3)) })
        },
      }
    }
    case 'ensemble-pagne': {
      // A child's wax shirt over wax shorts (a wax skirt for the girls).
      const fabric = l.bottomColor || top
      return {
        torso: [crew(tint(top, -0.3)), band(0, 0.41, wax(top)), band(0.41, 0.45, tint(fabric, -0.3)), band(0.45, 1, wax(fabric))],
        arm: sleeves(0.13, wax(top)),
        leg: femme ? [] : [shortHem(0.35, fabric), down(0.35, wax(fabric))],
        sleeve: 0.13,
        legs: femme ? 0 : 0.35,
        shoe: 'sandal',
        shoeC,
        skirt: femme ? { paint: (_f, _x, _y, _w, _h, ax, ay) => waxBig(fabric, l.pattern, ax, ay), band: tint(fabric, -0.3), w: 1.14, d: 1.3, hem: 0.42 } : undefined,
      }
    }
    case 'pyjama': {
      // Top and trousers alike, little stars, the collar's piping; claquettes.
      const star = (ax: number, ay: number) => ((ax * 3 + ay * 5) % 13 === 0 ? tint(top, 0.55) : grain(top, ax, ay, 0.05))
      return {
        torso: [vee(0.06, tint(top, 0.4)), buttons(tint(top, 0.4), HIPS), band(0, 1, star)],
        arm: sleeves(0.47, star),
        leg: [down(0.86, star)],
        sleeve: 0.47,
        legs: 0.86,
        cuff: tint(top, 0.4),
        hem: tint(top, 0.4),
        shoe: 'slide',
        shoeC,
      }
    }
    case 'oversize': {
      // The teen's big tee down over the hips, a bold print, sleeves to the elbows; cargo trousers
      // with their side pockets, white sneakers.
      const pr = luminance(top) > 0.6 ? '#17171a' : '#f8f9fa'
      return {
        torso: [
          crew(tint(top, -0.15)),
          front((_cx, m, k) => Math.abs(k) < 0.75 && (Math.abs(m - 0.12) < 0.012 || Math.abs(m - 0.25) < 0.012), pr),
          front((_cx, m, k) => Math.abs(Math.abs(k) - 0.4) < 0.15 && m > 0.15 && m < 0.22, '#ff7a00'),
          band(0, 1, cloth(top)),
        ],
        arm: sleeves(0.22, cloth(top)),
        leg: [
          (f, m, side, x, w) => (outer(f, side) && m > 0.28 && m < 0.46 && Math.abs(x - (w - 1) / 2) < 2.5 ? (m < 0.3 ? tint(bottom, -0.3) : tint(bottom, -0.14)) : undefined),
          down(0.86, cloth(bottom)),
        ],
        sleeve: 0.22,
        legs: 0.86,
        hem: tint(bottom, -0.18),
        shoe: 'sneaker',
        shoeC,
        extras: (k, d) => k.add('chest', { s: [d.ww * 1.08, 0.06, d.wd * 1.1], p: [0, TORSO_BOTTOM + 0.0, 0], paint: (f, _x, y, _w, h, ax, ay) => (y === h - 1 && isSide(f) ? tint(top, -0.2) : grain(top, ax, ay, 0.06)) }),
      }
    }
    case 'crop': {
      // A crop top over the belly and a high-waisted jean, its band and button.
      return {
        torso: [
          scoop(4, 0.04),
          band(0, 0.23, cloth(top)),
          band(0.23, 0.32, SKIN),
          front((cx, m) => Math.abs(cx) < 0.8 && m >= 0.32 && m < 0.36, '#d8c27a'),
          band(0.32, 0.36, tint(bottom, -0.25)),
          band(0.36, 1, denim(bottom)),
        ],
        arm: sleeves(0.09, cloth(top)),
        leg: [down(0.86, denim(bottom))],
        sleeve: 0.09,
        legs: 0.86,
        hem: tint(bottom, 0.08),
        shoe: 'sneaker',
        shoeC,
      }
    }
    default: {
      // casual: the tee-shirt and the jean: a crew neck, a print across the chest (orange, white,
      // green), the belt and its buckle, the jean's pockets and seams, sneakers.
      const tee = cloth(top, 0.05)
      const pr = luminance(top) > 0.6 ? '#14213d' : '#f8f9fa'
      return {
        torso: [
          crew(tint(top, -0.2)),
          front((cx, m) => m >= 0.1 && m < 0.16 && Math.abs(cx) < 5, (_ax, ay) => (ay % 3 === 0 ? '#ff7a00' : ay % 3 === 1 ? pr : '#00a862')),
          belt(),
          front((_cx, m, k) => m > 0.42 && m < 0.48 && Math.abs(Math.abs(k) - 0.7) < 0.08, tint(bottom, 0.3)),
          back((_cx, m, k) => m > 0.42 && (Math.abs(Math.abs(k) - 0.75) < 0.07 || Math.abs(Math.abs(k) - 0.3) < 0.07), tint(bottom, 0.25)),
          band(0, BELT, tee),
          band(BELT, 1, denim(bottom)),
        ],
        arm: sleeves(0.13, tee),
        leg: [(f, m, side, x, w) => (outer(f, side) && m < 0.86 && x === Math.floor(w / 2) ? tint(bottom, 0.28) : undefined), down(0.86, denim(bottom))],
        sleeve: 0.13,
        legs: 0.86,
        cuff: tint(top, -0.12),
        hem: tint(bottom, 0.08),
        collar: (f, x) => (isSide(f) && x % 2 ? tint(top, -0.26) : tint(top, -0.16)),
        shoe: 'sneaker',
        shoeC,
      }
    }
  }
}

/** Every other row of a pocket's stitching. */
const m0 = (ay: number) => ay % 4 === 0
