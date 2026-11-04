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

/* ---------- Painting a look's atlas ---------- */

/** What the atlas needs to know of the look, besides its painted face. */
export type FaceLook = { kind: Kind; look: Required<Look>; femme: boolean; beard: string; shades: boolean; elder?: boolean }

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
    g: mixHex(skin, '#8fc25a', 0.38),
  }
  // The mouth's inside reads 'K' in the maps (the eyes' 'K' is a line): swapped on paint.
  const col = new Map<string, [number, number, number]>()
  for (const [k, v] of Object.entries(pal)) if (v) col.set(k, rgb(v))
  const out = new Uint8ClampedArray(W * W * 4)

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
      out.set(src.subarray(fy * 64, fy * 64 + 64), ((ty + r) * W + tx) * 4)
    }
  }
  const put = (x: number, fy: number, key: string) => {
    if (x < 0 || x > 15 || fy < from || fy >= from + rows) return
    const c = col.get(key)
    if (!c) return
    const i = ((ty + fy - from) * W + tx + x) * 4
    out[i] = c[0]
    out[i + 1] = c[1]
    out[i + 2] = c[2]
    out[i + 3] = 255
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
          put(x, 2 + r, femme && (i === 0 || i === 3) ? 'b' : 'B')
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
    const map = em[eye]
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
  for (const e of GAZED) for (const g of GAZES) eyeAt(e, g, n++)
  for (const e of FIXED_EYES) eyeAt(e, 'c', n++)

  /* Mouths, with each cheek */
  CHEEKS.forEach((ck, ci) =>
    MOUTHS.forEach((m, mi) => {
      const idx = ci * MOUTHS.length + mi
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
  const c = newCanvas(W, W)
  c.getContext('2d')!.putImageData(new ImageData(data, W, W), 0, 0)
  const t = canvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 4
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  // Just in front of the face: nudged forward in depth too, so it never flickers with it.
  m = new THREE.MeshLambertMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })
  atlasCache.set(owner, m)
  return m
}

/** The 16×16 face painted on a BlockHuman sheet (its canvas, at twice the sheet's pixels), read back once. */
export function sheetFace(canvas: HTMLCanvasElement, x: number, y: number) {
  return new Uint8ClampedArray(canvas.getContext('2d')!.getImageData(x * 2, y * 2, 16, 16).data)
}

/* ---------- The quads on the head ---------- */

const posCache = new Map<string, { pos: THREE.BufferAttribute; normal: THREE.BufferAttribute; index: THREE.BufferAttribute }>()
function quadsFor(size: number, z: number) {
  const key = `${size.toFixed(4)}|${z.toFixed(4)}`
  let q = posCache.get(key)
  if (!q) {
    const row = size / 16
    const pos: number[] = []
    for (const b of BANDS) {
      const top = size - b.from * row
      const bot = size - (b.from + b.rows) * row
      pos.push(-size / 2, top, z, size / 2, top, z, -size / 2, bot, z, size / 2, bot, z)
    }
    const index = [0, 2, 1, 1, 2, 3, 4, 6, 5, 5, 6, 7, 8, 10, 9, 9, 10, 11]
    q = { pos: new THREE.Float32BufferAttribute(pos, 3), normal: new THREE.Float32BufferAttribute(new Array(12).fill([0, 0, 1]).flat(), 3), index: new THREE.Uint16BufferAttribute(index, 1) }
    posCache.set(key, q)
  }
  return q
}
/** Points band k's quad at its tile `index`. */
function setTile(uv: THREE.BufferAttribute, k: number, index: number) {
  const b = BANDS[k]
  const x0 = (index % 8) * TILE
  const y0 = b.y0 + Math.floor(index / 8) * b.h
  // A hair inside the tile's edges: the next tile's texels never bleed in along the quad's border.
  const e = 0.04
  const u0 = (x0 + e) / W
  const u1 = (x0 + TILE - e) / W
  const v0 = 1 - (y0 + e) / W
  const v1 = 1 - (y0 + b.rows - e) / W
  const a = uv.array as Float32Array
  a.set([u0, v0, u1, v0, u0, v1, u1, v1], k * 8)
}

const scratch = new THREE.Vector3()
const EYE_Y_K = 0.55 // the eyes, from the bottom of the head (in head heights)

/**
 * The expressions on a head: three quads in front of its face (size: the head's edge, its bottom at
 * y = 0 and its face at z = size / 2, as both Sims' heads are), the tiles chosen every frame.
 */
export function FaceOverlay({ material, size, pose, seed, faceId, head }: { material: THREE.Material | null; size: number; pose: Pose; seed: number; faceId?: string; head: React.RefObject<THREE.Object3D | null> }) {
  const mood = useFaceMood()
  const full = useContext(FullDetail)
  const geo = useMemo(() => {
    const q = quadsFor(size, size / 2 + 0.0025)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', q.pos)
    g.setAttribute('normal', q.normal)
    g.setIndex(q.index)
    const uv = new THREE.Float32BufferAttribute(new Float32Array(24), 2)
    g.setAttribute('uv', uv)
    for (let k = 0; k < 3; k++) setTile(uv, k, 0)
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, size / 2, size / 2), size)
    return g
  }, [size])
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
    if (s[0] !== o.brow) (setTile(uv, 0, o.brow), (s[0] = o.brow), (changed = true))
    if (s[1] !== o.eye) (setTile(uv, 1, o.eye), (s[1] = o.eye), (changed = true))
    if (s[2] !== o.mouth) (setTile(uv, 2, o.mouth), (s[2] = o.mouth), (changed = true))
    if (changed) uv.needsUpdate = true
  })
  if (!material) return null
  return <mesh ref={mesh} geometry={geo} material={material} />
}
