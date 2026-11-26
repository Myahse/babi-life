import { useContext, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look } from '../lib/types'
import { tint } from './textures'
import { canvasTexture, newCanvas } from '../lib/canvas'
import { BROWS, CHEEKS, FIXED_EYES, GAZED, GAZES, MOUTHS, faceAt, gazeFor, newFaceState, useFaceMood, type FaceOut } from './expressions'
import { fidgetAt, talkAt, type Pose } from './Human'
import { worldTime } from '../lib/worldClock'
import { FullDetail } from './Human'
import { bevels, chamferOf } from '../world3d/bevel'
import { matte } from './detail/real'

// The faces' expressions, painted (avatar/expressions.ts says which shows when). For each look, once,
// a small atlas of the face's three bands in every state: the brows (rows 2-5 of the 16-texel face),
// the eyes (rows 6-9) and the mouth with the cheeks (rows 10-15), each tile started from the look's
// own face as painted (its skin, beard, bobos) with the features rubbed out and drawn again. On the
// head, one mesh of three quads just in front of the face shows a tile of each band: changing the
// expression only moves the quads' UVs (a few floats, only when it changes). Nothing is repainted per
// frame, one draw call a face; far away the overlay goes (the face painted on the head stays).

const W = 128 // the atlas: 8 tiles across, 16 texels each
const TILE = 16
const BROW_Y = 0 // brows: 4 rows a tile, one row of tiles
const EYE_Y = 4 // eyes: 4 rows a tile
const MOUTH_Y = 24 // mouths: 6 rows used of 8 (so every tile starts on a multiple of 8: mipmaps stay in their tile)
const BANDS = [
  { from: 2, rows: 4, y0: BROW_Y, h: 4 },
  { from: 6, rows: 4, y0: EYE_Y, h: 4 },
  { from: 10, rows: 6, y0: MOUTH_Y, h: 8 },
]
/** Faces past this (metres from the camera) show the head's own painted face. */
const FACE_FAR = 22

type Kind = 'block' | 'detail'
/** Where each renderer's features sit on the 16×16 face. */
const SPEC = {
  block: { eye: [2, 10], brow: [2, 10], tear: [3, 12] },
  detail: { eye: [3, 9], brow: [3, 9], tear: [4, 11] },
} as const

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
const mixHex = (a: string, b: string, k: number) => {
  const [x, y] = [rgb(a), rgb(b)]
  return '#' + x.map((v, i) => Math.round(v * (1 - k) + y[i] * k).toString(16).padStart(2, '0')).join('')
}

/* ---------- The tiles, as little maps ---------- */

// Brows, outer end to inner, rows 2-5 ('B' the brow).
const BROW_MAPS: Record<Kind, Record<string, string[]>> = {
  block: {
    neutral: ['....', '....', '.BB.', 'BBBB'],
    up: ['....', '.BB.', 'BBBB', '....'],
    high: ['.BB.', 'BBBB', '....', '....'],
    sad: ['....', '..BB', '.BB.', 'B...'],
    angry: ['....', 'BB..', '.BB.', '..BB'],
    flat: ['....', '....', '....', 'BBBB'],
    knit: ['....', '....', 'BB..', '.BBB'],
  },
  detail: {
    neutral: ['....', '....', '.BBB', 'B...'],
    up: ['....', '.BBB', 'B...', '....'],
    high: ['.BBB', 'B...', '....', '....'],
    sad: ['....', '...B', '.BB.', 'B...'],
    angry: ['....', 'B...', '.BB.', '...B'],
    flat: ['....', '....', '....', 'BBBB'],
    knit: ['....', '....', 'BBB.', '...B'],
  },
}

// Eyes: five columns (one past the outer corner, then the eye's four, outer to inner), rows 6-9.
// '?' shows the eye itself (white, iris, catchlight) where it looks; the lids round it:
// 'z' the lash's wing (women), 'Z' the lid's line, 'Y' its inner end, 'l' a light lid, 'L' a heavy one,
// 'M' the lid's skin (shut), 'K' a dark line, 'W'/'w' whites, 'H'/'h' a heart, 'T'/'t' tears, 'S' bags.
const EYE_MAPS: Record<Kind, Record<string, string[]>> = {
  block: {
    open: ['.llll', '.????', '.....', '.....'],
    wide: ['.lWWl', '.????', '..WW.', '.....'],
    half: ['.LLLL', '.????', '.....', '.....'],
    angry: ['.llLK', '.???K', '.....', '.....'],
    sad: ['.KLll', '.K???', '.....', '.....'],
    focus: ['.LLLL', '.????', '..ll.', '.....'],
    closed: ['.MMMM', '.KKKK', '.....', '.....'],
    happy: ['.MKKM', '.KMMK', '.....', '.....'],
    squeeze: ['.KMMK', '.MKKM', '.....', '.....'],
    heart: ['.H.H.', 'HhHHH', '.HHH.', '..H..'],
    cry: ['.KLll', '.K???', '.tTT.', '..T..'],
    sob: ['.KMMK', '.MKKM', '.T..T', '.T...'],
    sick: ['.LLLL', '.????', '.SSSS', '.....'],
  },
  detail: {
    open: ['zZZZY', '.????', '.????', '.....'],
    wide: ['zZZZY', '.????', '.????', '..ww.'],
    half: ['.MMMM', 'zKKKK', '.????', '.....'],
    angry: ['.ZZMM', '.??KK', '.????', '.....'],
    sad: ['.MMZZ', 'zKK??', '.????', '.....'],
    focus: ['zZZZY', '.????', '.llll', '.....'],
    closed: ['.MMMM', '.MMMM', 'zKKKK', '.....'],
    happy: ['.MMMM', '.MKKM', '.KMMK', '.....'],
    squeeze: ['.MMMM', '.KMMK', '.MKKM', '.....'],
    heart: ['.H.H.', 'HhHHH', '.HHH.', '..H..'],
    cry: ['.MMZZ', 'zKK??', '.????', '.tTT.'],
    sob: ['.MMMM', '.KMMK', '.MKKM', '.T..T'],
    sick: ['.MMMM', 'zKKKK', '.????', '.SSSS'],
  },
}

// Mouths: ten columns (3-12), rows 10-15. 'U'/'O' the upper and lower lip, 'x' the line between,
// 'c' a corner in shade, 'K' the inside, 'E' teeth, 'G' the tongue.
const MOUTH_MAPS: Record<string, string[]> = {
  smile: ['..........', '..........', '.x......x.', '..x....x..', '...xxxx...', '....OO....'],
  grin: ['..........', '..........', '.x......x.', '.xEEEEEEx.', '..xKKKKx..', '...OOOO...'],
  laugh: ['..........', '..........', '..UUUUUU..', '.xEEEEEEx.', '.xKKKKKKx.', '..xGGGGx..'],
  sad: ['..........', '..........', '...UUUU...', '..xxxxxx..', '.x......x.', '..........'],
  frown: ['..........', '..........', '..UUUUUU..', '..xxxxxx..', '..cOOOOc..', '..........'],
  tight: ['..........', '..........', '..........', '..xxxxxx..', '...cccc...', '..........'],
  grit: ['..........', '..........', '.xxxxxxxx.', '.xEEEEEEx.', '.xxxxxxxx.', '..........'],
  o: ['..........', '..........', '....UU....', '...xKKx...', '...xKKx...', '....OO....'],
  O: ['..........', '....UU....', '...xKKx...', '..xKKKKx..', '..xKGGKx..', '...xOOx...'],
  yawn: ['..........', '...xUUx...', '..xKKKKx..', '..xKKKKx..', '..xKGGKx..', '...xxxx...'],
  wavy: ['..........', '..........', '..........', '.x..xx..x.', '..xx..xx..', '..........'],
  disgust: ['..........', '..........', '......xx..', '..xxxxEEx.', '.x.....xx.', '..........'],
  bite: ['..........', '..........', '..xxxxxx..', '..OEEEEO..', '...OOOO...', '..........'],
  smirk: ['..........', '..........', '........x.', '..xxxxxx..', '...OOOO...', '..........'],
  chew1: ['..........', '..........', '..........', '...xxxx...', '...OOOO...', '..........'],
  chew2: ['..........', '..........', '....xxxx..', '....OOOO..', '..........', '..........'],
  pout: ['..........', '..........', '....UU....', '...xOOx...', '....OO....', '..........'],
  cry: ['..........', '..........', '...UUUU...', '..xKKKKx..', '.xKKGGKKx.', '.x......x.'],
  a: ['..........', '..........', '..UUUUUU..', '..xKKKKx..', '...xOOx...', '..........'],
  e: ['..........', '..........', '.xxxxxxxx.', '.xEEEEEEx.', '..OOOOOO..', '..........'],
  m: ['..........', '..........', '..UUUUUU..', '..xxxxxx..', '..OOOOOO..', '..........'],
  f: ['..........', '..........', '..UUUUUU..', '..xEEEEx..', '..OOOOOO..', '..........'],
}

/* ---------- The finer face (« persos-realistes »): eyes and mouths at 1 cm a texel ---------- */

type Dot = (x: number, y: number, key: string) => void
/** The eyes on the 32-texel face: six texels wide, the left from x 7, the right from x 19; the lid's line on row 13. */
const EYE_X = [7, 19]
const EW6 = 6

/**
 * One eye state, both eyes, at 1 cm: a fine lid line (lashes winged for women), big whites, a round
 * iris of the look's colour with its pupil and one catchlight: open and friendly, readable on dark skin.
 */
function fineEye(dot: Dot, eye: string, gaze: string, femme: boolean, hd = false, /** « persos-monde »: amande, bride, tombant ('' round). */ shape = '') {
  // « blocs-hd »: two texels wider and a row taller, the iris four across and four down with its ring and pupil.
  const EW = hd ? 8 : EW6
  const xs = hd ? [5, 19] : EYE_X
  for (const [side, x0] of xs.entries()) {
    // Columns counted from the outer corner (c = 0) to the inner one (5); x the face's column.
    const X = (c: number) => (side === 0 ? x0 + c : x0 + EW - 1 - c)
    const irisHd = (top: number, bottom: number) => {
      const w = 4
      const left = Math.floor((EW - w) / 2) + (gaze === 'l' ? -1 : gaze === 'r' ? 1 : 0)
      const up = gaze === 'u' ? -1 : gaze === 'd' ? 1 : 0
      for (let y = top; y <= bottom; y++)
        for (let i = 0; i < w; i++) {
          const yy = y + up
          if (yy < top || yy > bottom) continue
          const r = yy - top
          const edge = i === 0 || i === w - 1
          dot(x0 + left + i, yy, r === 0 ? 'i' : !edge && (r === 1 || r === 2) ? 'D' : edge && r < 3 ? 'i' : 'I')
        }
      // Two catchlights: a bright one top left of the pupil, a faint one under it on the right.
      const cy = Math.max(top, top + up) + 1
      if (cy <= bottom) dot(x0 + left + 1, cy, 'C')
      if (cy + 1 <= bottom) dot(x0 + left + 2, cy + 1, 'w')
    }
    const iris = (top: number, bottom: number) => {
      if (hd && bottom - top >= 3) return irisHd(top, bottom)
      // Four across (three when wide open), where the eyes look (the gaze is in the face's own frame: 'l' its -x).
      const w = eye === 'wide' ? 3 : 4
      const left = Math.floor((EW - w) / 2) + (gaze === 'l' ? -1 : gaze === 'r' ? 1 : 0)
      const up = gaze === 'u' ? -1 : gaze === 'd' ? 1 : 0
      for (let y = top; y <= bottom; y++)
        for (let i = 0; i < w; i++) {
          const yy = y + up
          if (yy < top || yy > bottom) continue
          const inner = i > 0 && i < w - 1 && yy > top
          dot(x0 + left + i, yy, inner ? 'D' : yy === top ? 'i' : 'I')
        }
      // The catchlight: one texel, top left of the pupil, the same on both eyes (one light).
      const cy = Math.max(top, top + up) + (eye === 'wide' ? 1 : 0)
      if (cy <= bottom) dot(x0 + left + 1, cy, 'C')
    }
    const lid = (y: number) => {
      for (let c = 0; c < EW; c++) dot(X(c), y, 'q')
      if (femme) {
        dot(X(-1), y - 1, 'q')
        dot(X(0), y - 1, 'q')
        // « blocs-hd »: fuller lashes, a second stroke over the outer half, the wing longer.
        if (hd) {
          dot(X(1), y - 1, 'q')
          dot(X(-2), y - 2, 'q')
        }
      }
    }
    const whites = (y0: number, y1: number) => {
      for (let y = y0; y <= y1; y++) for (let c = 0; c < EW; c++) dot(X(c), y, y === y1 ? 'w' : 'W')
    }
    const skinRows = (y0: number, y1: number) => {
      for (let y = y0; y <= y1; y++) for (let c = 0; c < EW; c++) dot(X(c), y, 'M')
    }
    const under = () => {
      for (let c = 1; c < EW - 1; c++) dot(X(c), 17, 's')
    }
    switch (eye) {
      case 'wide':
        whites(hd ? 12 : 13, 16)
        iris(hd ? 13 : 13, 16)
        lid(hd ? 11 : 12)
        break
      case 'half':
      case 'sick':
        skinRows(13, 14)
        whites(15, 16)
        iris(15, 16)
        lid(14)
        if (eye === 'sick') for (let c = 0; c < EW; c++) (dot(X(c), 17, 'S'), dot(X(c), 18, 'S'))
        break
      case 'angry':
      case 'sad':
        // The lid slanting: down at the inner corner (angry) or the outer one (sad).
        whites(14, 16)
        iris(14, 16)
        for (let c = 0; c < EW; c++) {
          const low = eye === 'angry' ? c >= 3 : c <= 2
          dot(X(c), 13, low ? 'M' : 'q')
          if (low) dot(X(c), 14, 'q')
        }
        under()
        break
      case 'closed':
        skinRows(13, 15)
        for (let c = 0; c < EW; c++) dot(X(c), c === 0 || c === EW - 1 ? 15 : 16, 'K')
        break
      case 'happy':
        // ^ ^ : the arc two texels thick in the middle, so it reads on dark skin from afar.
        skinRows(13, 16)
        for (let c = 0; c < EW; c++) {
          const y = c === 0 || c === EW - 1 ? 16 : c === 1 || c === EW - 2 ? 15 : 14
          dot(X(c), y, 'K')
          if (c > 0 && c < EW - 1) dot(X(c), y + 1, 'K')
        }
        break
      case 'squeeze':
      case 'sob':
        // > < : two strokes meeting at the inner corner.
        skinRows(13, 16)
        for (let c = 0; c < EW; c++) {
          const d = Math.round((EW - 1 - c) * 0.4)
          dot(X(c), 15 - d, 'K')
          dot(X(c), 15 + d, 'K')
        }
        break
      case 'heart': {
        const rowsH = ['.HH.HH.', 'HhHHHHH', 'HHHHHHH', '.HHHHH.', '..HHH..', '...H...']
        rowsH.forEach((row, r) => [...row].forEach((ch, i) => ch !== '.' && dot(x0 - 1 + i, 12 + r, ch)))
        break
      }
      default:
        if (shape === 'bride') {
          // « persos-monde »: the monolid: no crease, the lid's line a row lower, the inner corner under the epicanthic fold, the outer end lifting.
          skinRows(hd ? 12 : 13, hd ? 13 : 13)
          whites(hd ? 14 : 15, 16)
          iris(hd ? 14 : 15, 16)
          lid(hd ? 13 : 14)
          dot(X(-1), hd ? 12 : 13, 'q')
          dot(X(EW - 1), hd ? 14 : 15, 'M')
          dot(X(EW - 1), hd ? 13 : 14, 'Y')
          if (eye === 'focus') for (let c = 0; c < EW; c++) dot(X(c), 16, 'M')
          else under()
          break
        }
        // open, focus, cry: the lid, the whites, the iris; focus raises the lower lid (« blocs-hd »: a row taller).
        whites(hd ? 13 : 14, 16)
        iris(hd ? 13 : 14, 16)
        lid(hd ? 12 : 13)
        if (eye === 'focus') for (let c = 0; c < EW; c++) dot(X(c), 16, 'M')
        else under()
        // « persos-monde »: almond eyes, their corners pointed; hooded ones, the lid's fold over the outer corner.
        if (shape === 'amande') {
          dot(X(0), 16, 'M')
          dot(X(EW - 1), 16, 'M')
          dot(X(EW - 1), hd ? 13 : 14, 'q')
          dot(X(-1), hd ? 11 : 12, femme ? 'q' : 'M')
        }
        if (shape === 'tombant') {
          for (let c = 0; c < EW; c++) dot(X(c), hd ? 11 : 12, 'F')
          dot(X(0), hd ? 13 : 14, 'q')
          dot(X(1), hd ? 13 : 14, 'q')
        }
    }
    if (eye === 'cry' || eye === 'sob') for (const [y, k] of [[17, 'T'], [18, 'T'], [19, 't']] as const) dot(X(1), y, k)
  }
}

/** The mouths at 1 cm, fourteen texels wide (x 9-22), from row 24 (under the nose). U upper lip, O lower, o its light, x the line, s a crease, k inside, E teeth, G tongue. */
const FINE_MOUTHS: Record<string, string[]> = {
  neutral: ['..............', '..s........s..', '...xUUUUUUx...', '....xxxxxx....', '....OooooO....', '.....OOOO.....'],
  smile: ['.s..........s.', '..x........x..', '...xUUUUUUx...', '....xxxxxx....', '.....OooO.....', '......OO......'],
  grin: ['.s..........s.', '..xxxxxxxxxx..', '..xEEEEEEEEx..', '...xEEEEEEx...', '....xKKKKx....', '.....OooO.....'],
  laugh: ['..UUUUUUUUUU..', '.xEEEEEEEEEEx.', '.xKKKKKKKKKKx.', '.xKKKKKKKKKKx.', '..xKGGGGGGKx..', '...xGGGGGGx...', '....OOooOO....'],
  sad: ['..............', '....UUUUUU....', '...xxxxxxxx...', '..x.OooooO.x..', '.s..........s.'],
  frown: ['..............', '...UUUUUUUU...', '...xxxxxxxx...', '..sOOooooOOs..'],
  tight: ['..............', '..............', '...xxxxxxxx...', '....ssssss....'],
  grit: ['..xxxxxxxxxx..', '..xEEEEEEEEx..', '..xxxxxxxxxx..', '..xEEEEEEEEx..', '..xxxxxxxxxx..'],
  o: ['.....UUUU.....', '....xKKKKx....', '....xKKKKx....', '.....OooO.....'],
  O: ['.....UUUU.....', '....xKKKKx....', '...xKKKKKKx...', '...xKKKKKKx...', '...xKGGGGKx...', '....xGGGGx....', '.....OooO.....'],
  yawn: ['....xUUUUx....', '...xKKKKKKx...', '...xKKKKKKx...', '...xKKKKKKx...', '...xKKKKKKx...', '...xKGGGGKx...', '....xOooOx....'],
  wavy: ['..............', '..............', '..x..xx..xx...', '...xx..xx..x..'],
  disgust: ['..........s...', '.........xx...', '...xxxxxxEEx..', '..x.OoooOOx...'],
  bite: ['...xxxxxxxx...', '...UUUUUUUU...', '...xEEEEEEx...', '....OooooO....', '.....OOOO.....'],
  smirk: ['...........s..', '..........x...', '...xUUUUUx....', '....xxxxxx....', '....OoooO.....'],
  chew1: ['..............', '....UUUUUU....', '....xxxxxx....', '....OooooO....'],
  chew2: ['..............', '.....UUUUUU...', '.....xxxxxx...', '......OooO....'],
  pout: ['.....UUUU.....', '....UxxxxU....', '....OooooO....', '.....OOOO.....'],
  cry: ['....UUUUUU....', '...xKKKKKKx...', '..xKKKKKKKKx..', '..xKKGGGGKKx..', '.x..xxxxxx..x.'],
  a: ['....UUUUUU....', '...xKKKKKKx...', '...xKKKKKKx...', '....xGGGGx....', '.....OooO.....'],
  e: ['..xUUUUUUUUx..', '..xEEEEEEEEx..', '...xKKKKKKx...', '....OooooO....'],
  m: ['..............', '...UUUUUUUU...', '...xxxxxxxx...', '...OOooooOO...'],
  f: ['...UUUUUUUU...', '...xEEEEEEx...', '...OOooooOO...', '....OOOOOO....'],
}

/** « persos-monde »: full lips (the lower lip a row deeper and wider, the upper one wider), thin ones (the lower lip's last row gone). */
function lipsOf(map: string[], lips: string): string[] {
  if (!lips) return map
  const last = map.map((r) => /[Oo]/.test(r)).lastIndexOf(true)
  if (last < 0) return map
  if (lips === 'fines') return map.length > 3 && /^[.O]*$/.test(map[last]) && map[last - 1] && /[Oo]/.test(map[last - 1]) ? map.map((r, i) => (i === last ? r.replace(/O/g, '.') : r)) : map
  const widen = (r: string, ch: string) => r.replace(new RegExp(`\\.(${ch})`), '$1$1').replace(new RegExp(`(${ch})\\.(?!.*${ch})`), '$1$1')
  const out = map.map((r) => (/U/.test(r) ? widen(r, 'U') : r))
  const below = map[last].replace(/[^Oo]/g, '.').replace(/o/g, 'O')
  out[last] = widen(out[last], 'O')
  if (last + 1 < out.length) out[last + 1] = [...out[last + 1]].map((ch, i) => (ch === '.' && below[i] === 'O' ? 'O' : ch)).join('')
  else out.push(below)
  return out
}

function fineMouth(dot: Dot, m: string, ck: string, lips = '') {
  const map = lipsOf(FINE_MOUTHS[m] ?? FINE_MOUTHS.neutral, lips)
  map.forEach((row, r) => [...row].forEach((ch, i) => ch !== '.' && dot(9 + i, 24 + r, ch === 'K' ? 'k' : ch)))
  // The cheeks: a soft round blush (a faint one always), tears down from the eyes, a sick green.
  const oval = (cx: number, key: string, rx = 2.6, ry = 1.4) => {
    for (let y = 19; y <= 23; y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x - cx) / rx) ** 2 + ((y - 21) / ry) ** 2 <= 1) dot(x, y, key)
  }
  if (ck === 'blush') for (const cx of [5.5, 26.5]) oval(cx, 'R')
  if (ck === 'green') for (const cx of [5.5, 26.5]) oval(cx, 'g', 3.2, 1.8)
  if (ck === 'plain') for (const cx of [5.5, 26.5]) oval(cx, 'r', 2.2, 1)
  if (ck === 'tears')
    for (const x of [8, 23]) {
      for (const y of [20, 21, 22]) dot(x, y, 'T')
      dot(x + (x < 16 ? -1 : 1), 23, 'T')
      dot(x + (x < 16 ? -1 : 1), 24, 't')
    }
}

/**
 * « persos-monde »: an eye map of the 16-texel faces in the look's shape (the open eyes only: the others are the
 * expression's own): the monolid's lid a row lower and its inner corner under the fold, the almond's pointed
 * corners, the hooded lid over the outer corner. Columns: one past the outer corner, then outer to inner.
 */
function shapeEyes(map: string[], eye: string, kind: Kind, shape: string): string[] {
  if (!shape || !['open', 'focus', 'cry'].includes(eye)) return map
  const set = (r: string, i: number, ch: string) => r.slice(0, i) + ch + r.slice(i + 1)
  const m = [...map]
  if (kind === 'block') {
    if (shape === 'bride') return [m[0].replace(/l/g, 'L'), set(m[1], 4, 'l'), m[2], m[3]]
    if (shape === 'amande') return [set(m[0], 1, '.'), m[1], m[2], m[3]]
    if (shape === 'tombant') return [m[0].replace(/l/g, 'L'), set(m[1], 1, 'L'), m[2], m[3]]
    return m
  }
  if (shape === 'bride') return ['.MMMM', m[0], set(m[1], 4, 'M'), m[3]]
  if (shape === 'amande') return [m[0], m[1], set(set(m[2], 1, 'M'), 4, 'M'), m[3]]
  if (shape === 'tombant') return [m[0], set(m[1], 1, 'Z'), m[2], m[3]]
  return m
}

/* ---------- Painting a look's atlas ---------- */

/** What the atlas needs to know of the look, besides its painted face. */
export type FaceLook = { kind: Kind; look: Required<Look>; femme: boolean; beard: string; shades: boolean; elder?: boolean; /** « persos-realistes »: the tiles at twice the texels (rounded by Scale2x), on a matte standard material like the body's. */ real?: boolean; /** « blocs-hd »: bigger eyes (fineEye). */ hd?: boolean }

function paintAtlas(base: Uint8ClampedArray, o: FaceLook) {
  const { kind, look: l, femme, shades } = o
  const sp = SPEC[kind]
  const skin = l.skin
  // On dark skin, a line a shade darker doesn't show: the lines go nearer black and the lips lighter, warmer.
  const [sr, sg, sb] = rgb(skin)
  const dark = (0.299 * sr + 0.587 * sg + 0.114 * sb) / 255 < 0.32
  const pal: Record<string, string> = {
    B: kind === 'block' ? tint(l.hairColor, -0.15) : o.elder ? tint(l.hairColor, -0.25) : tint(l.hairColor, -0.1),
    b: kind === 'block' ? tint(tint(l.hairColor, -0.15), 0.2) : tint(tint(l.hairColor, -0.1), 0.2),
    z: femme ? '#160c08' : '',
    Z: kind === 'block' ? tint(skin, -0.34) : femme ? '#160c08' : tint(skin, -0.45),
    Y: kind === 'block' ? tint(skin, -0.34) : femme ? tint(skin, -0.3) : tint(skin, -0.22),
    l: dark ? tint(skin, -0.5) : tint(skin, -0.3),
    L: dark ? tint(skin, -0.65) : tint(skin, -0.45),
    M: tint(skin, -0.08),
    K: dark ? '#080302' : '#20110b',
    W: '#fbf8f3',
    w: '#e3d9cb',
    C: '#ffffff',
    I: l.eyes,
    i: tint(l.eyes, -0.25),
    D: tint(l.eyes, -0.5),
    H: '#e8344e',
    h: '#ff9aab',
    T: '#7cc8f5',
    t: '#d6f1ff',
    // Bags under sick eyes, a green tinge.
    S: tint(skin, -0.22),
    U: dark ? mixHex(skin, femme ? '#7a2a36' : '#5a2a2a', 0.3) : femme ? mixHex(tint(skin, -0.3), '#6a1f2a', 0.32) : mixHex(tint(skin, -0.3), '#4a2024', 0.15),
    O: dark ? mixHex(skin, femme ? '#c46a78' : '#a8665e', femme ? 0.5 : 0.38) : femme ? mixHex(tint(skin, -0.02), '#b0505c', 0.38) : mixHex(tint(skin, -0.08), '#8a4a4a', 0.16),
    x: dark ? '#0e0605' : tint(skin, -0.5),
    c: dark ? tint(skin, -0.55) : tint(skin, -0.24),
    k: dark ? '#120404' : '#3b1612',
    E: '#f2ede4',
    G: '#b5474f',
    R: mixHex(skin, '#e8505e', 0.42),
    // The finer face (« persos-realistes »): the lid's line dark on every skin, a lit lower lip, the smile's crease, a softer blush.
    q: femme ? '#140a06' : dark ? '#0c0504' : tint(skin, -0.55),
    o: dark ? mixHex(skin, femme ? '#e08a96' : '#c08478', 0.55) : femme ? mixHex(skin, '#d07080', 0.42) : mixHex(skin, '#b07a70', 0.3),
    s: dark ? tint(skin, -0.32) : tint(skin, -0.16),
    r: mixHex(skin, '#e8505e', dark ? 0.3 : 0.22),
    g: mixHex(skin, '#8fc25a', 0.38),
    // « persos-monde »: thick brows a whole cell; the hooded lid's fold.
    BF: kind === 'block' ? tint(l.hairColor, -0.15) : o.elder ? tint(l.hairColor, -0.25) : tint(l.hairColor, -0.1),
    F: tint(skin, -0.16),
  }
  // The mouth's inside reads 'K' in the maps (the eyes' 'K' is a line): swapped on paint.
  const col = new Map<string, [number, number, number]>()
  for (const [k, v] of Object.entries(pal)) if (v) col.set(k, rgb(v))
  // « persos-realistes »: two texels a side for each of the maps' (1 cm a texel), the lines drawn finer (see put).
  const S = o.real ? 2 : 1
  const WS = W * S
  const out = new Uint8ClampedArray(WS * WS * 4)

  // The face with its features rubbed out: skin taken from the forehead, same column (two rows to pick
  // from so an elder's lines don't come down with it).
  const blank = base.slice()
  const rub = (x: number, y: number) => {
    const sy = (x + 3) % 2 ? 3 : 2
    const s = (sy * 16 + x) * 4
    blank.set(base.subarray(s, s + 4), (y * 16 + x) * 4)
  }
  const beard = o.beard
  const chin = beard === 'bouc' || beard === 'full' || beard === 'longue'
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const mx = x < 8 ? x : 15 - x
      if (kind === 'block') {
        const browCell = (y === 4 || y === 5) && mx >= 2 && mx <= 5
        const eyeCell = (y === 6 || y === 7) && mx >= 2 && mx <= 5
        // Under a bouc or a full beard, the corners of the mouth are beard.
        const mouthCell = (y === 12 || y === 13) && mx >= 4 && !(chin && mx <= 5)
        if (browCell || (eyeCell && !shades) || mouthCell) rub(x, y)
      } else {
        const browCell = (y === 4 || y === 5) && mx >= 3 && mx <= 6
        const eyeCell = y >= 6 && y <= 8 && mx >= 2 && mx <= 6
        const mouthCell = ((y === 12 || y === 13) && mx >= 4) || (y === 14 && mx >= 5 && !chin) || (y === 13 && mx === 4 && (beard === 'full' || beard === 'longue'))
        if (browCell || (eyeCell && !shades) || (mouthCell && !(y === 13 && mx === 4 && (beard === 'full' || beard === 'longue')))) rub(x, y)
      }
    }

  // A tile: the band's rows of `src` copied at (tx, ty), then painted on with put().
  let tx = 0
  let ty = 0
  let from = 0
  let rows = 0
  const start = (src: Uint8ClampedArray, band: (typeof BANDS)[number], index: number) => {
    tx = (index % 8) * TILE
    ty = band.y0 + Math.floor(index / 8) * band.h
    from = band.from
    rows = band.rows
    for (let r = 0; r < band.h; r++) {
      const fy = Math.min(15, from + Math.min(r, rows - 1))
      if (S === 1) out.set(src.subarray(fy * 64, fy * 64 + 64), ((ty + r) * W + tx) * 4)
      else
        for (let x = 0; x < 16; x++)
          for (let k = 0; k < S * S; k++) out.set(src.subarray((fy * 16 + x) * 4, (fy * 16 + x) * 4 + 4), (((ty + r) * S + Math.floor(k / S)) * WS + (tx + x) * S + (k % S)) * 4)
    }
  }
  /** The finer tiles: which of a cell's four texels a key paints (top-left, top-right, bottom-left, bottom-right), and with what. */
  const FINE: Record<string, (string | null)[]> = {
    // The brows a texel thin, on the cell's top: arched, finer, further from the eyes (friendlier than a thick bar).
    B: ['B', 'B', null, null],
    b: ['b', 'b', null, null],
    // The lid a texel thin, the white showing under it (bigger, rounder eyes); the lashes' wing a fine stroke.
    Z: ['Z', 'Z', 'W', 'W'],
    Y: ['Y', 'Y', null, null],
    z: ['z', null, null, null],
    // The catchlight a single texel at the iris's top, the rest of the cell the iris.
    C: ['C', 'I', 'I', 'I'],
  }
  const put = (x: number, fy: number, key: string) => {
    if (x < 0 || x > 15 || fy < from || fy >= from + rows) return
    if (S === 2) {
      const keys = FINE[key] ?? [key, key, key, key]
      for (let k = 0; k < 4; k++) {
        const c = keys[k] && col.get(keys[k]!)
        if (!c) continue
        const i = (((ty + fy - from) * 2 + (k >> 1)) * WS + (tx + x) * 2 + (k & 1)) * 4
        out.set([c[0], c[1], c[2], 255], i)
      }
      return
    }
    const c = col.get(key)
    if (!c) return
    const i = ((ty + fy - from) * W + tx + x) * 4
    out[i] = c[0]
    out[i + 1] = c[1]
    out[i + 2] = c[2]
    out[i + 3] = 255
  }
  /** The finer face: one texel at (x, y) of the 32×32 face (1 cm), in the tile being painted, `key` from the palette. */
  const dot = (x: number, y: number, key: string) => {
    if (x < 0 || x > 31 || y < from * 2 || y >= (from + rows) * 2) return
    const c = col.get(key)
    if (!c) return
    out.set([c[0], c[1], c[2], 255], ((ty * 2 + y - from * 2) * WS + tx * 2 + x) * 4)
  }
  /** A map of one side's cell (outer to inner) at column `at` of the left eye, mirrored for the right. */
  const cell = (map: string[], y0: number, left: number, right: number, f: (ch: string, x: number, y: number, side: 0 | 1, c: number) => void) => {
    const w = map[0].length
    map.forEach((row, r) => {
      for (let i = 0; i < w; i++) {
        // Left side: outer is on the left; the map's 5th column (if any) starts one before the eye.
        const xl = left - (w - 4) + i
        const xr = right + 3 + (w - 4) - i
        f(row[i], xl, y0 + r, 0, i - (w - 4))
        f(row[i], xr, y0 + r, 1, 3 - (i - (w - 4)))
      }
    })
  }

  /* Brows */
  const bm = BROW_MAPS[kind]
  BROWS.forEach((b, n) => {
    start(blank, BANDS[0], n)
    const [L, R] = b === 'one' ? [bm.high, bm.knit] : [bm[b], bm[b]]
    for (const [side, map] of [[0, L], [1, R]] as [0 | 1, string[]][])
      map.forEach((row, r) => {
        for (let i = 0; i < 4; i++) {
          if (row[i] !== 'B') continue
          const x = side ? sp.brow[1] + 3 - i : sp.brow[0] + i
          // « persos-monde »: thick brows a texel deeper (a whole cell on the finer face), thin ones lighter.
          if (l.brows === 'epais') {
            put(x, 2 + r, S === 2 ? 'BF' : 'B')
            if (S === 1 && r < 3 && row[i] === 'B' && map[r + 1]?.[i] !== 'B') put(x, 3 + r, 'b')
            continue
          }
          put(x, 2 + r, l.brows === 'fins' || (femme && (i === 0 || i === 3)) ? 'b' : 'B')
        }
      })
  })

  /* Eyes */
  const em = EYE_MAPS[kind]
  const eyeAt = (eye: string, gaze: string, n: number) => {
    start(blank, BANDS[1], n)
    if (shades) {
      // Behind dark glasses, the eyes stay as painted.
      start(base, BANDS[1], n)
      return
    }
    const map = shapeEyes(em[eye], eye, kind, l.eyeShape ?? '')
    const o = gaze === 'l' ? 0 : gaze === 'r' ? 2 : 1
    // Rows of the eye itself (as many as the map has '?' rows), the first one counted 0.
    const firstEyeRow = map.findIndex((r) => r.includes('?'))
    const eyeRows = map.filter((r) => r.includes('?')).length
    const half = eye === 'half' || eye === 'sick'
    cell(map, 6, sp.eye[0], sp.eye[1], (ch, x, y, side, c) => {
      void side
      if (ch === '.') return
      if (ch !== '?') return put(x, y, ch)
      // The eye, in screen columns: c is 0..3 from the eye's left (both eyes look the same way).
      const sc = side ? x - sp.eye[1] : x - sp.eye[0]
      const r = y - 6 - firstEyeRow
      const lowerOnly = eyeRows === 1 && kind === 'detail'
      let k: string
      if (kind === 'block' || lowerOnly) {
        const up = gaze === 'u' && kind === 'block'
        if (gaze === 'd' && kind === 'block') k = sc === o || sc === o + 1 ? 'D' : 'w'
        else k = sc === o ? (up ? 'D' : lowerOnly ? 'I' : 'C') : sc === o + 1 ? 'D' : half ? 'w' : 'W'
        if (up) k = sc === o || sc === o + 1 ? 'W' : 'W'
      } else if (gaze === 'u') k = r === 0 ? (sc === o ? 'I' : sc === o + 1 ? 'D' : 'W') : 'w'
      else if (gaze === 'd') k = r === 0 ? (sc === o ? 'Z' : sc === o + 1 ? 'Z' : 'L') : sc === o ? 'C' : sc === o + 1 ? 'D' : 'w'
      else if (eye === 'wide') k = r === 0 ? (sc === o + 1 ? 'D' : sc === o ? 'C' : 'W') : sc === o + 1 ? 'D' : 'W'
      else k = r === 0 ? (sc === o ? 'C' : sc === o + 1 ? 'i' : 'W') : sc === o ? 'I' : sc === o + 1 ? 'D' : 'w'
      put(x, y, k)
      void c
    })
    // Block eyes looking up: the iris goes up into the lid's row.
    if (kind === 'block' && gaze === 'u' && map[0] !== undefined)
      for (const ex of sp.eye) for (let sc = 0; sc < 4; sc++) put(ex + sc, 6, sc === o ? 'C' : sc === o + 1 ? 'D' : 'W')
  }
  let n = 0
  const eyeFine = (e: string, g: string, k: number) => {
    start(blank, BANDS[1], k)
    if (!shades) fineEye(dot, e, g, femme, !!o.hd, l.eyeShape ?? '')
    else start(base, BANDS[1], k)
  }
  for (const e of GAZED) for (const g of GAZES) (S === 2 ? eyeFine : eyeAt)(e, g, n++)
  for (const e of FIXED_EYES) (S === 2 ? eyeFine : eyeAt)(e, 'c', n++)

  /* Mouths, with each cheek */
  CHEEKS.forEach((ck, ci) =>
    MOUTHS.forEach((m, mi) => {
      const idx = ci * MOUTHS.length + mi
      if (S === 2) {
        // The finer face draws every mouth (its neutral one too, a resting smile) and the cheeks at 1 cm a texel.
        start(blank, BANDS[2], idx)
        fineMouth(dot, m, ck, l.lips ?? '')
        return
      }
      // The neutral mouth is the look's own, as painted.
      start(m === 'neutral' ? base : blank, BANDS[2], idx)
      const map = MOUTH_MAPS[m]
      if (map)
        map.forEach((row, r) => {
          for (let i = 0; i < 10; i++) {
            const ch = row[i]
            if (ch === '.') continue
            put(3 + i, 10 + r, ch === 'K' ? 'k' : ch)
          }
        })
      if (ck === 'blush') for (const y of [10, 11]) for (const x of [1, 2, 3, 12, 13, 14]) if ((x + y) % 3 !== 0 || kind === 'detail') put(x, y, 'R')
      if (ck === 'green') for (const y of [10, 11]) for (const x of [1, 2, 3, 4, 11, 12, 13, 14]) put(x, y, 'g')
      if (ck === 'tears')
        for (const tx0 of sp.tear) {
          put(tx0, 10, 'T')
          put(tx0, 11, 'T')
          put(tx0 + (tx0 < 8 ? -1 : 1), 12, 'T')
          put(tx0 + (tx0 < 8 ? -1 : 1), 13, 't')
        }
    }),
  )
  return out
}

/* ---------- The atlas, the material ---------- */

const atlasCache = new WeakMap<object, THREE.Material>()
/** One material per look (keyed by an object the look's sheet owns), painted the first time it's needed. */
export function faceMaterial(owner: object, base: () => Uint8ClampedArray | null, o: FaceLook) {
  let m = atlasCache.get(owner)
  if (m) return m
  const px = base()
  if (!px) return null
  const data = paintAtlas(px, o)
  const size = o.real ? W * 2 : W
  const c = newCanvas(size, size)
  c.getContext('2d')!.putImageData(new ImageData(data, size, size), 0, 0)
  const t = canvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 4
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  // Just in front of the face: nudged forward in depth too, so it never flickers with it.
  m = o.real ? matte(new THREE.MeshStandardMaterial({ map: t, roughness: 0.86, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })) : new THREE.MeshLambertMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })
  atlasCache.set(owner, m)
  return m
}

/** The 16×16 face painted on a BlockHuman sheet (its canvas, at twice the sheet's pixels), read back once. */
export function sheetFace(canvas: HTMLCanvasElement, x: number, y: number) {
  return new Uint8ClampedArray(canvas.getContext('2d')!.getImageData(x * 2, y * 2, 16, 16).data)
}

/* ---------- The quads on the head ---------- */

const posCache = new Map<string, { pos: THREE.BufferAttribute; normal: THREE.BufferAttribute; index: THREE.BufferAttribute }>()
function quadsFor(size: number, z: number, inset = 0) {
  const key = `${size.toFixed(4)}|${z.toFixed(4)}|${inset.toFixed(4)}`
  let q = posCache.get(key)
  if (!q) {
    const row = size / 16
    const pos: number[] = []
    for (const b of BANDS) {
      const top = size - b.from * row
      const bot = size - (b.from + b.rows) * row
      const x = size / 2 - inset
      pos.push(-x, top, z, x, top, z, -x, bot, z, x, bot, z)
    }
    const index = [0, 2, 1, 1, 2, 3, 4, 6, 5, 5, 6, 7, 8, 10, 9, 9, 10, 11]
    q = { pos: new THREE.Float32BufferAttribute(pos, 3), normal: new THREE.Float32BufferAttribute(new Array(12).fill([0, 0, 1]).flat(), 3), index: new THREE.Uint16BufferAttribute(index, 1) }
    posCache.set(key, q)
  }
  return q
}
/** Points band k's quad at its tile `index` (`cut`: the share of the tile's width left out on each side, a chamfered head's edges). */
function setTile(uv: THREE.BufferAttribute, k: number, index: number, cut = 0) {
  const b = BANDS[k]
  const x0 = (index % 8) * TILE
  const y0 = b.y0 + Math.floor(index / 8) * b.h
  // A hair inside the tile's edges: the next tile's texels never bleed in along the quad's border.
  const e = 0.04
  const u0 = (x0 + Math.max(e, cut * TILE)) / W
  const u1 = (x0 + TILE - Math.max(e, cut * TILE)) / W
  const v0 = 1 - (y0 + e) / W
  const v1 = 1 - (y0 + b.rows - e) / W
  const a = uv.array as Float32Array
  a.set([u0, v0, u1, v0, u0, v1, u1, v1], k * 8)
}

const scratch = new THREE.Vector3()
const EYE_Y_K = 0.55 // the eyes, from the bottom of the head (in head heights)

/* ---------- The lips' relief (« persos-realistes ») ---------- */

// The realistic Sim's lips stand out of its face a little: each row of a lip, as the mouth tile paints
// it, is a thin block (a texel tall, as wide as that row of the lip), showing the same texels on its
// front as the face behind it and the lip's own colour on its sides. The lower lip is fuller (it stands
// out further in its middle row), the upper lip thinner. They follow the mouth: a new mouth tile moves
// them too, so a smile, a laugh, an « O » or speech keep their lips; the mouth's inside, teeth and
// tongue stay flat, set back between them. Part of the face's mesh (no extra draw call).
const LIPS = 8 // blocks at most (the fullest mouth has six rows of lip)
const LIP_VERTS = 20 // five faces of four (no back)
type Lip = { x0: number; x1: number; y: number; depth: number }
/** Each mouth's lip blocks, from its map (FINE_MOUTHS): the runs of U (upper) and O/o (lower) on each row. */
const LIP_ROWS: Record<string, Lip[]> = {}
for (const [m, rows] of Object.entries(FINE_MOUTHS)) {
  const out: Lip[] = []
  let lower = 0
  rows.forEach((row, r) => {
    const lowerRow = /[Oo]/.test(row)
    for (let i = 0; i < row.length; i++) {
      const up = row[i] === 'U'
      const lo = row[i] === 'O' || row[i] === 'o'
      if (!up && !lo) continue
      let j = i
      while (j + 1 < row.length && (up ? row[j + 1] === 'U' : row[j + 1] === 'O' || row[j + 1] === 'o')) j++
      // Metres for a grown-up's head (H 0.32): the upper lip 2.5 mm, the lower lip 4 mm then thinner as it curves under.
      out.push({ x0: 9 + i, x1: 9 + j + 1, y: 24 + r, depth: up ? 0.0025 : [0.004, 0.003, 0.002][Math.min(lower, 2)] })
      i = j
    }
    if (lowerRow) lower++
  })
  LIP_ROWS[m] = out.slice(0, LIPS)
}
const LIP_FACES: [number, number, number][][] = [
  // front, top, bottom, left, right: their corners as (x side, y side, z side), 0 or 1 each.
  [[0, 1, 1], [1, 1, 1], [0, 0, 1], [1, 0, 1]],
  [[0, 1, 0], [1, 1, 0], [0, 1, 1], [1, 1, 1]],
  [[0, 0, 1], [1, 0, 1], [0, 0, 0], [1, 0, 0]],
  [[0, 1, 0], [0, 1, 1], [0, 0, 0], [0, 0, 1]],
  [[1, 1, 1], [1, 1, 0], [1, 0, 1], [1, 0, 0]],
]
const LIP_NORMALS: [number, number, number][] = [[0, 0, 1], [0, 1, 0], [0, -1, 0], [-1, 0, 0], [1, 0, 0]]

/** Lays the mouth tile `index`'s lips out in the face mesh's buffers (after its three quads), on a head of `size`. */
function setLips(pos: THREE.BufferAttribute, uv: THREE.BufferAttribute, index: number, size: number, z0: number) {
  const lips = LIP_ROWS[MOUTHS[index % MOUTHS.length]] ?? []
  const P = pos.array as Float32Array
  const U = uv.array as Float32Array
  const b = BANDS[2]
  const tx = (index % 8) * TILE * 2 // the tile's corner on the finer atlas (texels)
  const ty = (b.y0 + Math.floor(index / 8) * b.h) * 2
  const k = size / 0.32
  for (let n = 0; n < LIPS; n++) {
    const base = 12 + n * LIP_VERTS
    const lip = lips[n]
    if (!lip) {
      // Unused: folded to a point (nothing drawn).
      P.fill(0, base * 3, (base + LIP_VERTS) * 3)
      continue
    }
    const xs = [-size / 2 + (lip.x0 * size) / 32, -size / 2 + (lip.x1 * size) / 32]
    const ys = [size - ((lip.y + 1) * size) / 32, size - (lip.y * size) / 32]
    const zs = [z0 - 0.001, z0 + lip.depth * k]
    // The front shows the texels; the sides take the lip's own (sampled a quarter texel inside it).
    const us = [(tx + lip.x0) / (W * 2), (tx + lip.x1) / (W * 2)]
    const vs = [1 - (ty + lip.y - b.from * 2 + 1) / (W * 2), 1 - (ty + lip.y - b.from * 2) / (W * 2)]
    const ins = 0.25 / (W * 2)
    LIP_FACES.forEach((face, f) =>
      face.forEach(([cx, cy, cz], c) => {
        const v = base + f * 4 + c
        P.set([xs[cx], ys[cy], zs[cz]], v * 3)
        const u = f === 3 ? us[0] + ins : f === 4 ? us[1] - ins : us[cx] + (cx ? -0.02 : 0.02) / (W * 2)
        const w = f === 1 ? vs[1] - ins : f === 2 ? vs[0] + ins : vs[cy] + (cy ? -0.02 : 0.02) / (W * 2)
        U.set([u, w], v * 2)
      }),
    )
  }
  pos.needsUpdate = true
  uv.needsUpdate = true
}

/**
 * The expressions on a head: three quads in front of its face (size: the head's edge, its bottom at
 * y = 0 and its face at z = size / 2, as both Sims' heads are), the tiles chosen every frame.
 */
export function FaceOverlay({ material, size, pose, seed, faceId, head, lips }: { material: THREE.Material | null; size: number; pose: Pose; seed: number; faceId?: string; head: React.RefObject<THREE.Object3D | null>; /** « persos-realistes »: the lips stand out of the face (setLips). */ lips?: boolean }) {
  const mood = useFaceMood()
  const full = useContext(FullDetail)
  // A chamfered head (« blocs-arrondis »): the quads stop where its front's flat part does, so they don't stand out past its edges.
  const inset = useMemo(() => (bevels(size, size, size) ? chamferOf(size, size, size) : 0), [size])
  const cut = inset / size
  const geo = useMemo(() => {
    const q = quadsFor(size, size / 2 + 0.0025, inset)
    const g = new THREE.BufferGeometry()
    if (lips) {
      // The quads, then the lips' blocks: positions and uvs of its own (they move with the mouth).
      const n = 12 + LIPS * LIP_VERTS
      const pos = new Float32Array(n * 3)
      pos.set(q.pos.array as Float32Array)
      const nor = new Float32Array(n * 3)
      nor.set(q.normal.array as Float32Array)
      const idx: number[] = Array.from(q.index.array as Uint16Array)
      for (let b = 0; b < LIPS; b++)
        for (let f = 0; f < 5; f++) {
          const v = 12 + b * LIP_VERTS + f * 4
          for (let c = 0; c < 4; c++) nor.set(LIP_NORMALS[f], (v + c) * 3)
          idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3)
        }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
      g.setIndex(idx)
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2))
    } else {
      g.setAttribute('position', q.pos)
      g.setAttribute('normal', q.normal)
      g.setIndex(q.index)
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(24), 2))
    }
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let k = 0; k < 3; k++) setTile(uv, k, 0, inset / size)
    if (lips) setLips(g.attributes.position as THREE.BufferAttribute, uv, 0, size, size / 2 + 0.0025)
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, size / 2, size / 2), size)
    return g
  }, [size, inset, lips])
  const mesh = useRef<THREE.Mesh>(null)
  const st = useRef(newFaceState())
  const out = useRef<FaceOut>({ brow: 0, eye: 0, mouth: 0 })
  const shown = useRef<[number, number, number]>([-1, -1, -1])
  const frame = useRef(Math.floor(Math.random() * 8))
  const far = useRef(false)
  const gaze = useRef<ReturnType<typeof gazeFor>>(null)
  const talk = useRef<ReturnType<typeof talkAt> | null>(null)
  const stretch = useRef(false)
  useFrame(({ camera }) => {
    const m = mesh.current
    const h = head.current
    if (!m || !h) return
    const f = ++frame.current
    // Far away: the face as painted on the head (checked every few frames).
    if (f % 8 === 0) far.current = !full && !mood?.still && h.getWorldPosition(scratch).distanceTo(camera.position) > FACE_FAR
    m.visible = !far.current
    if (far.current) return
    if (f % 6 === 0) gaze.current = mood?.still ? null : gazeFor(h, faceId ?? mood?.id, size * EYE_Y_K)
    const t = worldTime()
    // The conversation's turn (the same as the arms', Human.tsx talkAt), looked at every few frames.
    if (pose !== 'talk') talk.current = null
    else if (!talk.current || f % 6 === 0) talk.current = talkAt(t, seed)
    if (f % 6 === 0) stretch.current = pose === 'idle' && fidgetAt(t + seed, seed)?.kind === 'stretch'
    faceAt(out.current, st.current, t, performance.now(), pose, seed, mood, faceId, talk.current, gaze.current, stretch.current)
    const o = out.current
    const s = shown.current
    const uv = geo.attributes.uv as THREE.BufferAttribute
    let changed = false
    if (s[0] !== o.brow) (setTile(uv, 0, o.brow, cut), (s[0] = o.brow), (changed = true))
    if (s[1] !== o.eye) (setTile(uv, 1, o.eye, cut), (s[1] = o.eye), (changed = true))
    if (s[2] !== o.mouth) {
      setTile(uv, 2, o.mouth, cut)
      if (lips) setLips(geo.attributes.position as THREE.BufferAttribute, uv, o.mouth, size, size / 2 + 0.0025)
      s[2] = o.mouth
      changed = true
    }
    if (changed) uv.needsUpdate = true
  })
  if (!material) return null
  return <mesh ref={mesh} geometry={geo} material={material} />
}
