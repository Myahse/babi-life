import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../lib/types'
import { defaultColors, fullLook } from './options'
import { tint } from './textures'
import { useCastShadows, usePoseRig, type Pose } from './Human'

// A blocky Sim, Roblox / Minecraft style: a cube head, a box torso, and arms
// and legs split at the elbows and knees. Everything that is just colour (the
// face, the outfit, the prints, glasses, the chain, bobos, the hairline) is
// painted on one small pixel-art sheet per look, like a Minecraft skin, drawn
// with crisp unfiltered pixels and shared by every Sim with the same look.
// Hair, caps, earrings and skirts are extra boxes. Units are metres: feet on
// y=0, facing +Z, the same joints as the other Sims so the poses drive it.

type Props = { look: Look; gender: Sim['gender']; pose?: Pose; seed?: number; /** Children have bigger heads for their size (1 = adult). */ headScale?: number; /** Walking speed (m/s): the steps follow it. */ speed?: number }
type V3 = [number, number, number]

/* ---------- Proportions ---------- */

const HEAD = 0.32 // the head is a cube, eight sheet pixels a side
const P = HEAD / 8
const HAT = 1.125 // the hair layer, a slightly bigger second head (9 px over 8)
const HIP_Y = 0.84
const THIGH = 0.42
const SHIN = 0.42
const TORSO_BOTTOM = 0.82
const NECK_Y = 1.36
const SHOULDER_Y = 1.3
const UPPER_ARM = 0.25
const FOREARM = 0.27

/** Width scales: the torso, how thick arms and legs are, and the depth (belly). */
const BODY: Record<string, { w: number; limb: number; depth: number }> = {
  mince: { w: 0.88, limb: 0.88, depth: 0.9 },
  moyen: { w: 1, limb: 1, depth: 1 },
  fort: { w: 1.15, limb: 1.16, depth: 1.1 },
  rond: { w: 1.2, limb: 1.12, depth: 1.28 },
}

/* ---------- The sheet: where each box is painted (Minecraft-style layout) ---------- */

// For a box W×H×D pixels at (u, v): the top and bottom faces in the first D
// rows, then one strip going round the sides: -x, front (+z), +x, back (-z).
type Region = { u: number; v: number; W: number; D: number; H: number }
const SHEET = 64
const R = {
  head: { u: 0, v: 0, W: 8, D: 8, H: 8 },
  hat: { u: 32, v: 0, W: 8, D: 8, H: 8 },
  body: { u: 16, v: 16, W: 8, D: 4, H: 12 },
  /** Index 0 is the -x side, like the pose rig. */
  leg: [
    { u: 0, v: 32, W: 4, D: 4, H: 12 },
    { u: 0, v: 16, W: 4, D: 4, H: 12 },
  ],
  arm: [
    { u: 40, v: 32, W: 4, D: 4, H: 12 },
    { u: 40, v: 16, W: 4, D: 4, H: 12 },
  ],
  skirtTop: { u: 0, v: 48, W: 10, D: 5, H: 4 },
  skirtLeg: { u: 32, v: 48, W: 5, D: 5, H: 10 },
} satisfies Record<string, Region | Region[]>

/* ---------- Geometry: boxes whose faces read their part of the sheet ---------- */

const geoCache = new Map<string, THREE.BufferGeometry>()
/** A box sx×sy×sz metres showing region r, its sides from row0 for `rows` rows. */
function box(sx: number, sy: number, sz: number, r: Region, row0 = 0, rows = r.H) {
  const key = `${sx.toFixed(4)}|${sy.toFixed(4)}|${sz.toFixed(4)}|${r.u},${r.v},${r.W},${r.D}|${row0}|${rows}`
  let g = geoCache.get(key)
  if (g) return g
  g = new THREE.BoxGeometry(sx, sy, sz)
  const { u, v, W, D } = r
  const y = v + D + row0
  // BoxGeometry's faces: +x, -x, +y, -y, +z, -z; each as [x, y, w, h] in sheet pixels.
  const faces = [
    [u + D + W, y, D, rows],
    [u, y, D, rows],
    [u + D, v, W, D],
    [u + D + W, v, W, D],
    [u + D, y, W, rows],
    [u + 2 * D + W, y, W, rows],
  ]
  const uv = g.attributes.uv
  faces.forEach(([x0, y0, w, h], f) => {
    for (let k = f * 4; k < f * 4 + 4; k++) {
      const [a, b] = [uv.getX(k), uv.getY(k)]
      uv.setXY(k, (x0 + a * w) / SHEET, 1 - (y0 + (1 - b) * h) / SHEET)
    }
  })
  geoCache.set(key, g)
  return g
}
/** A plain box (hair, caps, earrings) with the whole of its texture on every face. */
const cube = (sx: number, sy: number, sz: number) => {
  const key = `cube|${sx.toFixed(4)}|${sy.toFixed(4)}|${sz.toFixed(4)}`
  let g = geoCache.get(key)
  if (!g) geoCache.set(key, (g = new THREE.BoxGeometry(sx, sy, sz)))
  return g
}

/* ---------- Pixels ---------- */

/** A stable 0..1 value per pixel, for the grain of hair and cloth. */
function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}
const grain = (c: string, x: number, y: number, amount = 0.12) => tint(c, (hash(x, y) - 0.5) * amount)

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

/** A wax print in pixels, repeating every 6 px; x, y are sheet pixels so neighbouring faces line up. */
function waxPx(color: string, motif: string, x: number, y: number) {
  const light = luminance(color) > 0.7
  const ink = light ? '#7a2e0e' : '#1d120b'
  const cream = light ? '#ff7a00' : '#fff3dc'
  const accent = light ? '#00a862' : tint(color, 0.45)
  const m6 = (n: number) => ((n % 6) + 6) % 6
  const cx = m6(x)
  const cy = m6(y + (Math.floor(x / 6) % 2) * 3)
  const [dx, dy] = [Math.abs(cx - 2.5), Math.abs(cy - 2.5)]
  switch (motif) {
    case 'losanges': {
      const d = dx + dy
      return d <= 1 ? accent : d <= 2 ? ink : d <= 3 ? cream : color
    }
    case 'feuilles': {
      const a = m6(x - y)
      const b = m6(x + y)
      return a === 0 && b < 4 ? ink : a <= 1 && b < 5 ? cream : b === 5 && a === 3 ? accent : color
    }
    case 'rayures': {
      const z = m6(y + Math.abs((((x % 4) + 4) % 4) - 2))
      return z === 0 ? cream : z === 3 ? ink : color
    }
    default: {
      // cercles
      const d = Math.max(dx, dy)
      return d < 1 ? ink : d < 2 ? (dx === dy ? accent : cream) : color
    }
  }
}

type Face = 'L' | 'F' | 'R' | 'B' // -x, front (+z), +x, back (-z)
type Paint = string | null | ((x: number, y: number) => string | null)

/** Paints a sheet: colours or per-pixel functions, by box region, face and row. */
class Painter {
  g: CanvasRenderingContext2D
  constructor(g: CanvasRenderingContext2D) {
    this.g = g
  }
  px(x: number, y: number, c: Paint) {
    const col = typeof c === 'function' ? c(x, y) : c
    if (!col) return
    this.g.fillStyle = col
    this.g.fillRect(x, y, 1, 1)
  }
  /** Where a face's column 0 is in the side strip, and how wide the face is. */
  face(r: Region, f: Face): [number, number] {
    return f === 'L' ? [0, r.D] : f === 'F' ? [r.D, r.W] : f === 'R' ? [r.D + r.W, r.D] : [2 * r.D + r.W, r.W]
  }
  /** One pixel of a side face. On L, column 0 is at the back; on R, at the front. */
  at(r: Region, f: Face, col: number, row: number, c: Paint) {
    const [x0] = this.face(r, f)
    this.px(r.u + x0 + col, r.v + r.D + row, c)
  }
  /** Rows [r0, r1) all the way round. */
  rows(r: Region, r0: number, r1: number, c: Paint, faces: Face[] = ['L', 'F', 'R', 'B']) {
    for (const f of faces) {
      const [x0, w] = this.face(r, f)
      for (let row = Math.max(0, r0); row < Math.min(r.H, r1); row++) for (let col = 0; col < w; col++) this.px(r.u + x0 + col, r.v + r.D + row, c)
    }
  }
  top(r: Region, c: Paint) {
    for (let y = 0; y < r.D; y++) for (let x = 0; x < r.W; x++) this.px(r.u + r.D + x, r.v + y, c)
  }
  bottom(r: Region, c: Paint) {
    for (let y = 0; y < r.D; y++) for (let x = 0; x < r.W; x++) this.px(r.u + r.D + r.W + x, r.v + y, c)
  }
  all(r: Region, c: Paint) {
    this.top(r, c)
    this.bottom(r, c)
    this.rows(r, 0, r.H, c)
  }
}

/** How the outfit is cut, so extra boxes and bobos know what is covered. */
type Cut = {
  skirt?: { paint: Paint; band?: string; w: number; d: number; hem: number }
  /** Wide boubou sleeves over the arms. */
  bell?: string
  /** Leg rows hidden by trousers (0 = bare legs). */
  legRows: number
  /** Arm rows covered by sleeves. */
  armRows: number
}

const DIGITS: Record<string, string[]> = { '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'] }

/** Everything painted for one look: the face, the outfit, glasses, the chain, bobos, the hairline. */
function paintSheet(l: Required<Look>, femme: boolean, young: boolean) {
  const c = document.createElement('canvas')
  c.width = c.height = SHEET
  const p = new Painter(c.getContext('2d')!)
  const dc = defaultColors(l, femme)
  const skin = l.skin
  const shade = tint(skin, -0.12)
  const top = l.outfitColor
  const bottom = l.bottomColor || dc.bottom
  const shoe = l.shoeColor || dc.shoe
  const outfit = l.outfit === 'robe' && !femme ? 'casual' : l.outfit
  const cloth = (col: string) => (x: number, y: number) => grain(col, x, y, 0.06)
  const wax = (col: string) => (x: number, y: number) => waxPx(col, l.pattern, x, y)

  // Bare skin everywhere first; clothes go over it.
  for (const r of [R.head, R.body, ...R.leg, ...R.arm]) p.all(r, skin)

  /* The face (front of the head, 8×8): brows, eyes, nose, mouth. */
  const h = R.head
  for (const f of ['L', 'R'] as Face[]) for (const row of [3, 4]) p.at(h, f, f === 'L' ? 4 : 3, row, shade) // the ears
  const brow = tint(l.hairColor, -0.15)
  for (const x of [1, 2, 5, 6]) p.at(h, 'F', x, 2, femme && (x === 2 || x === 5) ? tint(brow, 0.2) : brow)
  p.at(h, 'F', 1, 3, '#fbfaf7')
  p.at(h, 'F', 2, 3, l.eyes)
  p.at(h, 'F', 5, 3, l.eyes)
  p.at(h, 'F', 6, 3, '#fbfaf7')
  if (femme) for (const x of [0, 7]) p.at(h, 'F', x, 3, '#1a0f0a') // lashes
  for (const x of [3, 4]) p.at(h, 'F', x, 4, shade) // the nose
  if (femme) for (const x of [1, 6]) p.at(h, 'F', x, 5, tint(skin, 0.06).replace(/^#(..)/, (_, r) => `#${Math.min(255, parseInt(r, 16) + 25).toString(16).padStart(2, '0')}`))
  const lip = tint(skin, -0.38)
  for (const x of [2, 3, 4, 5]) p.at(h, 'F', x, 6, x === 2 || x === 5 ? (femme ? lip : tint(skin, -0.25)) : femme ? tint(lip, 0.18).replace(/^#(..)/, (_, r) => `#${Math.min(255, parseInt(r, 16) + 35).toString(16).padStart(2, '0')}`) : lip)

  /* Beards. */
  const beardC = (x: number, y: number) => grain(tint(l.hairColor, 0.06), x, y, 0.2)
  if (!young && l.beard !== 'none') {
    for (const x of [2, 3, 4, 5]) p.at(h, 'F', x, 5, beardC)
    if (l.beard === 'bouc' || l.beard === 'full') {
      for (const x of [2, 3, 4, 5]) p.at(h, 'F', x, 7, beardC)
      for (const x of [2, 5]) p.at(h, 'F', x, 6, beardC)
    }
    if (l.beard === 'full') {
      for (const row of [5, 6, 7]) for (const x of [0, 1, 6, 7]) p.at(h, 'F', x, row, beardC)
      for (let x = 0; x < 8; x++) p.at(h, 'F', x, 7, beardC)
      // Up the jaw to the sideburns, and under the chin.
      for (let row = 2; row < 8; row++) for (const col of [5, 6, 7]) if (row > 4 || col === 7) p.at(h, 'L', col, row, beardC)
      for (let row = 2; row < 8; row++) for (const col of [0, 1, 2]) if (row > 4 || col === 0) p.at(h, 'R', col, row, beardC)
      for (let x = 0; x < 8; x++) for (let y = 4; y < 8; y++) p.px(h.u + h.D + h.W + x, h.v + y, beardC)
    }
  }

  /* Bobos on the face. */
  if (l.marks === 'pansement' || l.marks === 'bagarre') {
    for (const [x, y] of [[6, 4], [5, 5], [7, 5], [6, 6]]) p.at(h, 'F', x, y, '#ecc996')
    p.at(h, 'F', 6, 5, '#d9a96e')
  }
  if (l.marks === 'griffures' || l.marks === 'bagarre') for (const [x, y] of [[0, 4], [1, 5], [1, 4], [2, 5]]) p.at(h, 'F', x, y, x + y === 5 ? '#a8322a' : null)

  /* Glasses: the top of the frame, its sides and the bridge, arms back to the ears. */
  const acc = l.accessoryColor || dc.accessory
  if (!young && l.accessory === 'glasses') {
    for (const x of [1, 2, 5, 6]) p.at(h, 'F', x, 2, acc)
    for (const x of [0, 3, 4, 7]) p.at(h, 'F', x, 3, acc)
    for (let col = 4; col < 8; col++) p.at(h, 'L', col, 3, acc)
    for (let col = 0; col < 4; col++) p.at(h, 'R', col, 3, acc)
  }

  /* The hairline, on the second head layer (transparent elsewhere). */
  const capOn = !young && (l.accessory === 'cap' || l.accessory === 'capback')
  const hair = capOn && ['afro', 'bun', 'headwrap'].includes(l.hair) ? 'short' : l.hair
  const hairC = tint(l.hairColor, 0.08)
  const hairPx = (x: number, y: number) =>
    hair === 'braids' ? (x % 2 ? tint(hairC, -0.25) : grain(hairC, x, y, 0.2)) : hair === 'locks' ? grain(x % 3 ? hairC : tint(hairC, -0.3), x, y, 0.2) : hair === 'headwrap' ? waxPx(l.outfitColor, l.pattern, x, y) : grain(hairC, x, y, 0.3)
  const LINE: Record<string, [number, number, number] | undefined> = {
    // rows covered: [front, sides at the front, back]
    short: [1, 2, 4],
    afro: [2, 3, 6],
    braids: [1, 3, 8],
    locks: [2, 4, 8],
    bun: [1, 2, 4],
    weave: [2, 8, 8],
    headwrap: [3, 4, 5],
  }
  const line = LINE[hair]
  if (line) {
    const [front, side, back] = line
    const t = R.hat
    p.top(t, hairPx)
    p.rows(t, 0, front, hairPx, ['F'])
    p.rows(t, 0, back, hairPx, ['B'])
    for (let col = 0; col < 8; col++) {
      const k = col / 7 // L: 0 at the back; R: 0 at the front
      for (let row = 0; row < Math.round(back + (side - back) * k); row++) p.at(t, 'L', col, row, hairPx)
      for (let row = 0; row < Math.round(side + (back - side) * k); row++) p.at(t, 'R', col, row, hairPx)
    }
    if (hair === 'weave') p.at(t, 'F', 2, 2, hairPx) // a side parting sweeping down
  } else if (hair === 'bald') {
    // Shaved: a shadow of stubble on the scalp.
    const stubble = (x: number, y: number) => grain(tint(skin, -0.2), x, y, 0.1)
    p.top(h, stubble)
    p.rows(h, 0, 1, stubble, ['F'])
    p.rows(h, 0, 2, stubble, ['L', 'R'])
    p.rows(h, 0, 4, stubble, ['B'])
  }

  /* The outfit. */
  const b = R.body
  const cut: Cut = { legRows: 0, armRows: 0 }
  const sleeves = (n: number, col: Paint, cuff?: string) => {
    for (const a of R.arm) {
      p.rows(a, 0, n, col)
      p.top(a, col)
      if (cuff) p.rows(a, n - 1, n, cuff)
    }
    cut.armRows = n
  }
  const trousers = (n: number, col: Paint, hips = true) => {
    for (const g of R.leg) {
      p.rows(g, 0, n, col)
      p.top(g, col)
    }
    if (hips) p.rows(b, 10, 12, col)
    p.bottom(b, col)
    cut.legRows = n
  }
  const shoes = (kind: 'sneaker' | 'dress' | 'sandal' | 'boot' | 'heel' | 'slide') => {
    const sole = kind === 'sneaker' || kind === 'boot' ? '#f4f4f4' : kind === 'slide' ? tint(shoe, -0.15) : '#2a1c12'
    R.leg.forEach((g, i) => {
      p.bottom(g, sole)
      p.rows(g, 11, 12, kind === 'heel' || kind === 'sandal' ? shoe : sole)
      if (kind === 'sandal' || kind === 'slide') {
        // A strap over bare toes.
        p.rows(g, 10, 11, skin)
        for (let x = 0; x < 4; x++) p.at(g, 'F', x, 10, shoe)
      } else {
        p.rows(g, kind === 'boot' ? 9 : 10, 11, shoe)
        if (kind === 'sneaker') p.at(g, i ? 'R' : 'L', i ? 1 : 2, 10, '#ff7a00')
      }
    })
  }
  const shirt = (r1: number, col: Paint) => {
    p.rows(b, 0, r1, col)
    p.top(b, col)
  }

  switch (outfit) {
    case 'pagne': {
      shirt(12, wax(top))
      sleeves(3, wax(top))
      if (femme) {
        const fabric = l.bottomColor || top
        cut.skirt = { paint: wax(fabric), band: tint(fabric, -0.3), w: 1.08, d: 1.25, hem: 0.07 }
        shoes('sandal')
      } else {
        trousers(10, cloth(bottom))
        shoes('dress')
      }
      break
    }
    case 'boubou': {
      shirt(12, cloth(top))
      sleeves(10, cloth(top))
      trousers(10, cloth(bottom))
      const gold = '#e8b93c'
      for (const x of [2, 3, 4, 5]) {
        p.at(b, 'F', x, 0, gold)
        p.at(b, 'F', x, 5, gold)
      }
      for (let row = 1; row < 5; row++) for (const x of [3, 4]) p.at(b, 'F', x, row, gold)
      cut.skirt = { paint: cloth(top), w: 1.24, d: 1.45, hem: 0.08 }
      cut.bell = top
      shoes('sandal')
      break
    }
    case 'robe': {
      shirt(12, wax(top))
      // Bare shoulders and arms, thin straps.
      p.rows(b, 0, 2, skin, ['L', 'R'])
      for (const f of ['F', 'B'] as Face[]) for (let x = 0; x < 8; x++) if (x !== 1 && x !== 6) p.at(b, f, x, 0, skin)
      p.top(b, (x) => (x === 16 + 4 + 1 || x === 16 + 4 + 6 ? top : skin))
      const fabric = l.bottomColor || top
      cut.skirt = { paint: wax(fabric), w: 1.12, d: 1.3, hem: 0.45 }
      shoes('heel')
      break
    }
    case 'suit': {
      shirt(12, cloth(top))
      sleeves(10, cloth(top), '#f8f9fa')
      trousers(10, cloth(bottom))
      const tie = top === '#b02e0c' || top === '#d6336c' ? '#14213d' : '#d6336c'
      for (let row = 0; row < 3; row++) for (const x of [2, 5]) p.at(b, 'F', x, row, '#f8f9fa')
      p.at(b, 'F', 3, 0, '#f8f9fa')
      p.at(b, 'F', 4, 0, '#f8f9fa')
      for (let row = 1; row < 6; row++) for (const x of [3, 4]) p.at(b, 'F', x, row, tie)
      shoes('dress')
      break
    }
    case 'jersey': {
      const green = '#009a44'
      shirt(10, cloth(top))
      sleeves(3, cloth(top))
      for (const x of [2, 3, 4, 5]) p.at(b, 'F', x, 0, green)
      p.at(b, 'F', 5, 2, green) // the badge
      trousers(4, cloth(bottom))
      for (const g of R.leg) p.rows(g, 6, 10, green) // socks
      shoes('boot')
      break
    }
    case 'debardeur':
    case 'basket': {
      // The ribbed vest (or the numbered jersey) and sport shorts.
      const basket = outfit === 'basket'
      const light = parseInt(top.slice(1), 16) > 0xb0b0b0
      const trim = basket ? (light ? '#14213d' : '#f8f9fa') : null
      shirt(10, basket ? cloth(top) : (x, y) => (x % 2 ? tint(top, -0.06) : grain(top, x, y, 0.04)))
      p.rows(b, 0, basket ? 3 : 2, skin, ['L', 'R']) // armholes
      for (let x = 1; x < 7; x++) p.at(b, 'F', x, 0, skin) // scoop neck
      for (let x = 2; x < 6; x++) {
        p.at(b, 'F', x, 1, basket ? trim : skin)
        p.at(b, 'B', x, 0, skin)
      }
      if (trim) {
        p.at(b, 'F', 1, 0, trim)
        p.at(b, 'F', 6, 0, trim)
        p.rows(b, 3, 4, trim, ['L', 'R'])
        // The number, front and back.
        for (const f of ['F', 'B'] as Face[])
          ['2', '3'].forEach((d, k) => DIGITS[d].forEach((bits, row) => [...bits].forEach((bit, col) => bit === '1' && p.at(b, f, k * 4 + col, 3 + row, trim))))
      }
      p.top(b, skin)
      const band = basket ? trim! : tint(bottom, -0.25)
      p.rows(b, 9, 10, band)
      trousers(basket ? 7 : 4, cloth(bottom))
      if (!basket) for (const x of [3, 4]) p.at(b, 'F', x, 10, '#f4f1ea') // the drawstring
      // A stripe down the outside of the shorts.
      const stripe = basket ? trim! : tint(bottom, 0.85)
      R.leg.forEach((g, i) => {
        for (let row = 0; row < (basket ? 7 : 4); row++) p.at(g, i ? 'R' : 'L', i ? 1 : 2, row, stripe)
      })
      shoes(basket ? 'boot' : 'slide')
      break
    }
    case 'survet': {
      const light = parseInt(top.slice(1), 16) > 0xb0b0b0
      const stripe = light ? '#14213d' : '#f8f9fa'
      shirt(12, cloth(top))
      p.rows(b, 11, 12, tint(top, -0.15))
      for (let row = 0; row < 12; row++) p.at(b, 'F', 3, row, '#c9ccd4') // the zip
      sleeves(10, cloth(top), tint(top, -0.2))
      trousers(10, cloth(bottom), false)
      for (const g of R.leg) p.rows(g, 9, 10, tint(bottom, -0.2))
      // Three stripes down the outside of sleeves and legs (two pixels here).
      R.arm.forEach((a, i) => {
        for (let row = 0; row < 9; row++) p.at(a, i ? 'R' : 'L', i ? 1 : 2, row, stripe)
      })
      R.leg.forEach((g, i) => {
        for (let row = 0; row < 9; row++) p.at(g, i ? 'R' : 'L', i ? 1 : 2, row, stripe)
      })
      shoes('sneaker')
      break
    }
    default: {
      // Jeans and a tee-shirt, with a belt.
      shirt(9, cloth(top))
      sleeves(3, cloth(top))
      trousers(10, cloth(bottom))
      p.rows(b, 9, 10, '#4a2f1d')
      p.at(b, 'F', 3, 9, '#c9b27a')
      p.at(b, 'F', 4, 9, '#c9b27a')
      shoes('sneaker')
    }
  }
  // Hands are bare.
  for (const a of R.arm) {
    p.rows(a, 10, 12, skin)
    p.bottom(a, skin)
  }

  /* Skirts, the chain, bobos on the body. */
  if (cut.skirt) {
    p.all(R.skirtTop, cut.skirt.paint)
    p.all(R.skirtLeg, cut.skirt.paint)
    if (cut.skirt.band) p.rows(R.skirtTop, 0, 1, cut.skirt.band)
  }
  if (!young && l.accessory === 'chain') {
    const gold = l.accessoryColor || '#e8b93c'
    for (const [x, y] of [[1, 0], [6, 0], [2, 1], [5, 1], [3, 2], [4, 2]]) p.at(b, 'F', x, y, gold)
    p.at(b, 'F', 3, 3, gold)
  }
  if ((l.marks === 'genou' || l.marks === 'bagarre') && cut.legRows < 6 && !cut.skirt) p.rows(R.leg[0], 6, 8, '#f4f1ea')
  if ((l.marks === 'griffures' || l.marks === 'bagarre') && cut.armRows < 7) for (const [x, y] of [[1, 7], [2, 8], [1, 9]]) p.at(R.arm[1], 'R', x, y, '#a8322a')

  const t = new THREE.CanvasTexture(c)
  t.magFilter = t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  return { texture: t, cut, hair }
}

/* ---------- Materials, shared ---------- */

type Sheet = ReturnType<typeof paintSheet> & { material: THREE.Material }
const sheetCache = new Map<string, Sheet>()
/** One sheet per look: every Sim dressed the same shares it. */
function sheetFor(l: Required<Look>, femme: boolean, young: boolean) {
  const key = JSON.stringify([l.skin, l.hair, l.hairColor, l.outfit, l.outfitColor, l.eyes, l.beard, l.accessory, l.pattern, l.bottomColor, l.shoeColor, l.accessoryColor, l.marks, femme, young])
  let s = sheetCache.get(key)
  if (!s) {
    const painted = paintSheet(l, femme, young)
    // alphaTest: the hair layer is see-through where there is no hair.
    s = { ...painted, material: new THREE.MeshLambertMaterial({ map: painted.texture, alphaTest: 0.5 }) }
    sheetCache.set(key, s)
  }
  return s
}

const texCache = new Map<string, THREE.CanvasTexture>()
/** A small pixel texture for the extra boxes (hair, wraps, sleeves). */
function pixelTex(key: string, size: number, paint: (x: number, y: number) => string) {
  let t = texCache.get(key)
  if (!t) {
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d')!
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        g.fillStyle = paint(x, y)
        g.fillRect(x, y, 1, 1)
      }
    t = new THREE.CanvasTexture(c)
    t.magFilter = t.minFilter = THREE.NearestFilter
    t.generateMipmaps = false
    t.colorSpace = THREE.SRGBColorSpace
    texCache.set(key, t)
  }
  return t
}
const matCache = new Map<string, THREE.Material>()
function lambert(color: string, map?: THREE.Texture) {
  const key = `${color}|${map?.uuid ?? ''}`
  let m = matCache.get(key)
  if (!m) matCache.set(key, (m = new THREE.MeshLambertMaterial({ color: map ? '#ffffff' : color, map })))
  return m
}
const hairMat = (color: string, kind: string) =>
  lambert('#fff', pixelTex(`hair|${color}|${kind}`, 8, (x, y) => (kind === 'braids' || kind === 'locks' ? (x % 2 ? tint(color, -0.25) : grain(color, x, y, 0.2)) : grain(color, x, y, 0.3))))
const waxMat = (color: string, motif: string) => lambert('#fff', pixelTex(`wax|${color}|${motif}`, 12, (x, y) => waxPx(color, motif, x, y)))
const clothMat = (color: string) => lambert('#fff', pixelTex(`cloth|${color}`, 8, (x, y) => grain(color, x, y, 0.06)))

/* ---------- Hair, caps, earrings: extra boxes on the head ---------- */

function HeadBoxes({ l, hair, young, cast }: { l: Required<Look>; hair: string; young: boolean; cast: boolean }) {
  const H = HEAD
  const hc = tint(l.hairColor, 0.08)
  const m = hairMat(hc, hair)
  const B = ({ s, p, r, mat = m }: { s: V3; p: V3; r?: V3; mat?: THREE.Material }) => <mesh geometry={cube(...s)} material={mat} position={p} rotation={r} castShadow={cast} />
  const strands = (n: number, w: number, len: number) =>
    [...Array(n)].map((_, i) => {
      // Round the back of the head from one ear to the other, behind the ears.
      const a = (i / (n - 1) - 0.5) * Math.PI
      const [x, z] = [Math.sin(a) * H * 0.56, Math.min(-Math.cos(a) * H * 0.56, -H * 0.12)]
      return <B key={i} s={[w, len, w]} p={[x, H * 0.5 - len / 2, z]} />
    })
  let hairBoxes: React.ReactNode = null
  switch (hair) {
    case 'afro':
      hairBoxes = (
        <group>
          <B s={[H * 1.5, H * 0.72, H * 1.38]} p={[0, H * 1.1, -H * 0.12]} />
          {[-1, 1].map((s) => (
            <B key={s} s={[H * 0.26, H * 0.5, H * 0.9]} p={[s * H * 0.66, H * 0.66, -H * 0.2]} />
          ))}
        </group>
      )
      break
    case 'bun':
      hairBoxes = <B s={[H * 0.42, H * 0.36, H * 0.42]} p={[0, H * 1.18, -H * 0.22]} />
      break
    case 'braids':
      hairBoxes = <group>{strands(9, 0.04, 0.44)}</group>
      break
    case 'locks':
      hairBoxes = <group>{strands(7, 0.065, 0.26)}</group>
      break
    case 'weave':
      hairBoxes = (
        <group>
          <B s={[H * 1.14, 0.36, 0.06]} p={[0, H * 0.62 - 0.18, -H * 0.56]} />
          {[-1, 1].map((s) => (
            <B key={s} s={[0.06, 0.3, H * 0.7]} p={[s * H * 0.6, H * 0.62 - 0.15, -H * 0.18]} />
          ))}
        </group>
      )
      break
    case 'headwrap': {
      const fabric = waxMat(l.outfitColor, l.pattern)
      hairBoxes = (
        <group position={[0, H * 0.95, -H * 0.05]} rotation={[-0.28, 0, 0]}>
          <B s={[H * 1.18, H * 0.55, H * 1.18]} p={[0, H * 0.2, 0]} mat={fabric} />
          <B s={[H * 0.42, H * 0.34, H * 0.36]} p={[H * 0.16, H * 0.56, H * 0.26]} r={[0, 0, 0.5]} mat={fabric} />
          <B s={[H * 0.36, H * 0.3, H * 0.32]} p={[-H * 0.2, H * 0.52, H * 0.3]} r={[0, 0, -0.6]} mat={fabric} />
        </group>
      )
      break
    }
  }
  const acc = l.accessoryColor || defaultColors(l, false).accessory
  return (
    <group>
      {hairBoxes}
      {!young && (l.accessory === 'cap' || l.accessory === 'capback') && (
        <group rotation={[0, l.accessory === 'capback' ? Math.PI : 0, 0]}>
          <B s={[H * 1.17, H * 0.3, H * 1.17]} p={[0, H * 0.99, 0]} mat={clothMat(acc)} />
          <B s={[H * 0.92, H * 0.07, H * 0.46]} p={[0, H * 0.86, H * 0.78]} mat={lambert(tint(acc, -0.25))} />
          <B s={[H * 0.14, H * 0.05, H * 0.14]} p={[0, H * 1.16, 0]} mat={lambert(tint(acc, -0.25))} />
        </group>
      )}
      {!young &&
        l.accessory === 'earrings' &&
        [-1, 1].map((s) => (
          <group key={s} position={[s * (H / 2 + 0.012), H * 0.3, H * 0.04]}>
            <B s={[0.02, 0.02, 0.02]} p={[0, 0, 0]} mat={lambert(acc)} />
            <B s={[0.03, 0.03, 0.012]} p={[0, -0.032, 0]} mat={lambert(acc)} />
          </group>
        ))}
    </group>
  )
}

/* ---------- The whole Sim ---------- */

export function BlockHuman({ look, gender, pose = 'idle', seed = 0, headScale = 1, speed }: Props) {
  const young = headScale > 1
  const l = fullLook(look)
  const femme = gender === 'femme'
  const cast = useCastShadows()
  const sheet = sheetFor(l, femme, young)
  const sm = sheet.material
  const { w, limb, depth } = BODY[l.body] ?? BODY.moyen

  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const chest = useRef<THREE.Group>(null)
  const hip = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const knee = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const shoulder = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const elbow = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  usePoseRig({ root, head, chest, hip, knee, shoulder, elbow }, pose, seed, speed)

  // The face: eyelids blink every few seconds, the mouth opens when talking.
  const lids = useRef<THREE.Group>(null)
  const mouth = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 7.3
    const period = 3.2 + (Math.abs(seed) % 3)
    const k = (t % period) / period
    const shut = k > 0.955 ? Math.sin(((k - 0.955) / 0.045) * Math.PI) : 0
    if (lids.current) {
      lids.current.visible = shut > 0.05
      for (const c of lids.current.children) c.scale.y = Math.max(0.01, shut)
    }
    const talk = pose === 'talk' || pose === 'rant' || pose === 'cheer'
    const open = talk ? Math.max(0, Math.sin(t * 9 + seed)) * (pose === 'cheer' ? 1.6 : 1) : 0
    if (mouth.current) {
      mouth.current.visible = open > 0.08
      mouth.current.scale.y = Math.max(0.01, open)
    }
  })

  const d = useMemo(() => {
    const tw = 0.34 * w * (femme ? 0.92 : 1)
    const td = 0.18 * depth
    const lw = (tw / 2) * 0.98
    const ld = 0.16 * limb
    const aw = (femme ? 0.115 : 0.13) * limb
    return { tw, td, lw, ld, aw, hipX: tw / 4, shX: tw / 2 + aw / 2 + 0.006 }
  }, [w, depth, limb, femme])
  const { tw, td, lw, ld, aw, hipX, shX } = d
  const skirt = sheet.cut.skirt
  const skW = skirt ? tw * skirt.w : 0
  const skD = skirt ? td * skirt.d : 0
  const bell = sheet.cut.bell
  const kneeY = HIP_Y - THIGH
  const mesh = (g: THREE.BufferGeometry, p: V3, m: THREE.Material = sm) => <mesh geometry={g} material={m} position={p} castShadow={cast} />

  return (
    <group scale={l.height * (femme ? 0.96 : 1)}>
      <group ref={root}>
        {/* Torso */}
        <group ref={chest}>{mesh(box(tw, NECK_Y - TORSO_BOTTOM, td, R.body), [0, (NECK_Y + TORSO_BOTTOM) / 2, 0])}</group>
        {skirt && mesh(box(skW, 0.17, skD, R.skirtTop), [0, 0.885, 0])}

        {/* Head: the cube, the hair layer over it, eyelids, the mouth, hair and caps */}
        <group ref={head} position={[0, NECK_Y, 0]} scale={headScale}>
          {mesh(box(HEAD, HEAD, HEAD, R.head), [0, HEAD / 2, 0])}
          {sheet.hair !== 'bald' && mesh(box(HEAD * HAT, HEAD * HAT, HEAD * HAT, R.hat), [0, HEAD / 2, 0])}
          <group ref={lids} position={[0, HEAD - 3 * P, HEAD / 2 + 0.002]} visible={false}>
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={cube(2 * P, P, 0.004)} material={lambert(tint(l.skin, -0.06))} position={[s * 2 * P, -P / 2, 0]} />
            ))}
          </group>
          <group ref={mouth} position={[0, HEAD - 6 * P, HEAD / 2 + 0.002]} visible={false}>
            <mesh geometry={cube(2.4 * P, P, 0.004)} material={lambert('#3b1612')} position={[0, -P / 2, 0]} />
          </group>
          <HeadBoxes l={l} hair={sheet.hair} young={young} cast={cast} />
        </group>

        {/* Legs: hip → knee, the skirt's two halves swinging with them */}
        {[0, 1].map((i) => {
          const side = i === 0 ? -1 : 1
          const skX = side * (skW / 4 - hipX)
          return (
            <group key={i} ref={hip[i]} position={[side * hipX, HIP_Y, 0]}>
              {mesh(box(lw, THIGH + 0.04, ld, R.leg[i], 0, 6), [0, (0.04 - THIGH) / 2, 0])}
              {skirt && mesh(box(skW / 2, Math.min(THIGH, HIP_Y - skirt.hem) + 0.05, skD * 0.98, R.skirtLeg, 0, 5), [skX, 0.05 - (Math.min(THIGH, HIP_Y - skirt.hem) + 0.05) / 2, 0])}
              <group ref={knee[i]} position={[0, -THIGH, 0]}>
                {mesh(box(lw * 0.98, SHIN + 0.02, ld * 0.98, R.leg[i], 6, 6), [0, (0.02 - SHIN) / 2, 0])}
                {skirt && skirt.hem < kneeY && mesh(box(skW / 2, kneeY - skirt.hem + 0.03, skD * 0.98, R.skirtLeg, 5, 5), [skX, 0.03 - (kneeY - skirt.hem + 0.03) / 2, 0])}
              </group>
            </group>
          )
        })}

        {/* Arms: shoulder → elbow, the hand at the end */}
        {[0, 1].map((i) => {
          const side = i === 0 ? -1 : 1
          return (
            <group key={i} ref={shoulder[i]} position={[side * shX, SHOULDER_Y, 0]}>
              {mesh(box(aw, UPPER_ARM + 0.06, aw, R.arm[i], 0, 6), [0, (0.06 - UPPER_ARM) / 2, 0])}
              {bell && mesh(cube(aw * 1.4, UPPER_ARM, aw * 1.4), [0, -UPPER_ARM / 2 + 0.02, 0], clothMat(bell))}
              <group ref={elbow[i]} position={[0, -UPPER_ARM, 0]}>
                {mesh(box(aw * 0.98, FOREARM + 0.02, aw * 0.98, R.arm[i], 6, 6), [0, (0.02 - FOREARM) / 2, 0])}
                {bell && mesh(cube(aw * 1.9, 0.17, aw * 1.9), [0, -0.075, 0], clothMat(bell))}
              </group>
            </group>
          )
        })}
      </group>
    </group>
  )
}
