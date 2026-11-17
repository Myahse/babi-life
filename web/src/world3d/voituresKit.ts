import * as THREE from 'three'
import { useSyncExternalStore } from 'react'
import { featuresKnown, keyOpenNow, onFeatures } from '../lib/features'
import { useLightPhone } from '../lib/lightPhone'
import { deviceTier, subscribeTier } from './open/lumiere'
import { BevelBoxGeometry } from './bevel'

// « Voitures réalistes » (the update « voitures-realistes », step 5 of the « blocs réalistes » look,
// concept in the lab's cars.ts and moto.ts): the street's vehicles rebuilt in detailed blocks. Each
// vehicle is a few merged meshes (body, glass, wheels instanced) dressed by one small shared atlas
// (plates, grilles, lamps, stickers, dust) and one material per paint, so a car costs three draws up
// close instead of a dozen, and one far off. While the update is shut, vehicles.tsx draws as before.

export const VOITURES = 'voitures-realistes'
const HEARD_KEY = 'babi.voitures.ouvert'

/**
 * How much of it a device draws (the same device split as « lumière réaliste »).
 * - `simple`: the new shapes, cheap (Lambert) materials, the detailed model only within 25 m.
 * - `normal`: paint and glass that reflect the sky (the lumière's environment map), detail within 40 m.
 * - `haute`: clear-coated paint, the small parts (wipers, handles, antenna, exhaust), detail within 55 m.
 */
export type VoituresTier = 'off' | 'simple' | 'normal' | 'haute'

function read(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
// The labs show every update (lib/features.ts), the server or not; ?shut=voitures-realistes shuts it there.
const LAB = typeof location !== 'undefined' && /\/(city|avatar|lab|poster)\.html$/.test(location.pathname)
const open = () => (featuresKnown() || LAB ? keyOpenNow(VOITURES) : read(HEARD_KEY) === '1')
onFeatures(() => {
  if (!featuresKnown()) return
  try {
    localStorage.setItem(HEARD_KEY, keyOpenNow(VOITURES) ? '1' : '0')
  } catch {
    // Private mode: as the server says, once it has.
  }
})

// In development, ?voitures=off|simple|normal|haute forces a tier (to compare them).
const FORCED = import.meta.env.DEV && typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('voitures') as VoituresTier | null) : null

function tierOf(light: boolean): VoituresTier {
  if (FORCED) return FORCED
  if (!open()) return 'off'
  return deviceTier(light)
}

/** The tier the vehicles draw now (followed: the update can open, the phone go light). */
export function useVoitures(): VoituresTier {
  const light = useLightPhone()
  return useSyncExternalStore(subscribeTier, () => tierOf(light))
}

/** Up to how far (m) the detailed model is drawn; past it, the one-draw far model. */
export const DETAIL_WITHIN: Record<Exclude<VoituresTier, 'off'>, number> = { simple: 25, normal: 40, haute: 55 }

/* ---------- The atlas: 256×256, painted once ---------- */

const S = 256
/** A rectangle of the atlas, in texels. */
export type Reg = readonly [number, number, number, number]
const cell = (i: number): Reg => [i * 16 + 4, 4, 8, 8]
/** The plain surfaces (a solid cell each: the colour comes from the vertex or the paint). */
export const R = {
  paint: cell(0),
  chrome: cell(1),
  rubber: cell(2),
  plastic: cell(3),
  interior: cell(4),
  metal: cell(5),
  head: cell(6),
  tail: cell(7),
  amber: cell(8),
  glassFar: cell(9),
  seat: cell(10),
  mud: cell(11),
  matte: cell(12),
  lit: cell(13),
  reflector: cell(14),
  // Fitted on a face (the texture stretched over it).
  side: [0, 16, 64, 32] as Reg,
  grille: [64, 16, 64, 16] as Reg,
  headLens: [128, 16, 32, 16] as Reg,
  tailLens: [160, 16, 32, 16] as Reg,
  taxiSign: [192, 16, 64, 16] as Reg,
  taxiNumber: [[192, 32, 32, 16], [224, 32, 32, 16]] as Reg[],
  plates: [[0, 48, 64, 16], [0, 64, 64, 16], [0, 80, 64, 16], [0, 96, 64, 16]] as Reg[],
  mottos: [[64, 48, 128, 16], [64, 64, 128, 16], [64, 80, 128, 16]] as Reg[],
  busLine: [64, 96, 128, 16] as Reg,
  grilleBus: [192, 48, 64, 16] as Reg,
  slats: [192, 64, 64, 16] as Reg,
  rimAlloy: [0, 112, 64, 64] as Reg,
  rimSteel: [64, 112, 64, 64] as Reg,
  rimSpoke: [128, 112, 64, 64] as Reg,
  tread: [192, 112, 64, 16] as Reg,
  cloth: [192, 128, 64, 64] as Reg,
  sack: [0, 176, 64, 64] as Reg,
  roofLed: [64, 176, 64, 16] as Reg,
}

/** The texture of each region: its roughness and metalness, and how much it glows (0..1). */
const SURF: [Reg, number, number, number][] = [
  [R.paint, 0.34, 0, 0],
  [R.chrome, 0.22, 1, 0],
  [R.rubber, 0.92, 0, 0],
  [R.plastic, 0.62, 0, 0],
  [R.interior, 0.9, 0, 0],
  [R.metal, 0.4, 0.8, 0],
  [R.head, 0.15, 0, 1],
  [R.tail, 0.2, 0, 0.7],
  [R.amber, 0.2, 0, 0.5],
  [R.glassFar, 0.08, 0.5, 0],
  [R.seat, 0.85, 0, 0],
  [R.mud, 0.95, 0, 0],
  [R.matte, 0.6, 0, 0],
  [R.lit, 0.3, 0, 0.8],
  [R.reflector, 0.2, 0, 0.35],
]

/* A 3×5 pixel font (plates, numbers, mottos): invented numbers and words only. */
const GLYPHS: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101', S: '011100010001110',
  T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  É: '111100110100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001',
  '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110', '-': '000000111000000', ' ': '000000000000000',
}
const textWidth = (t: string, k = 1) => t.length * 4 * k - k

const hash = (x: number, y: number, s = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
  return n - Math.floor(n)
}

type Img = { set: (x: number, y: number, c: [number, number, number]) => void }
const shade = (c: [number, number, number], k: number): [number, number, number] => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)]

function fill(img: Img, [x0, y0, w, h]: Reg, c: (x: number, y: number) => [number, number, number]) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.set(x0 + x, y0 + y, c(x, y))
}
function text(img: Img, t: string, x: number, y: number, c: [number, number, number], k = 1) {
  let cx = x
  for (const ch of t.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[' ']
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) img.set(cx + i * k + a, y + j * k + b, c)
    cx += 4 * k
  }
}
/** A label centred in a region (the region's top-left is its y 0: the canvas runs down, the UVs up). */
function label(img: Img, r: Reg, t: string, c: [number, number, number], k = 1, dx = 0) {
  text(img, t, r[0] + dx + Math.floor((r[2] - dx - textWidth(t, k)) / 2), r[1] + Math.floor((r[3] - 5 * k) / 2), c, k)
}
/** A wheel's face: the tyre's ring, the rim and its spokes (or a steel wheel's holes), the hub. */
function rim(img: Img, r: Reg, kind: 'alloy' | 'steel' | 'spoke') {
  const [x0, y0, w] = r
  const c = w / 2
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - c
      const dy = y + 0.5 - c
      const d = Math.hypot(dx, dy) / c
      const a = Math.atan2(dy, dx)
      let col: [number, number, number]
      if (kind === 'spoke') {
        // A moto's or a bike's wheel: a thin tyre, a rim, wire spokes, the hub.
        if (d > 0.86) col = shade([34, 33, 32], 0.9 + hash(x, y, 3) * 0.2)
        else if (d > 0.76) col = [178, 182, 188]
        else if (d < 0.16) col = [150, 154, 160]
        else col = Math.abs(Math.sin(a * 9)) < 0.12 ? [190, 194, 200] : [26, 26, 28]
      } else {
        const tyre = kind === 'steel' ? 0.62 : 0.66
        if (d > 0.97) col = [22, 22, 22]
        else if (d > tyre) col = shade([36, 35, 34], (d > 0.9 ? 0.85 : 1) * (0.92 + hash(x, y, 1) * 0.16))
        else if (d > tyre - 0.05) col = kind === 'steel' ? [60, 62, 66] : [212, 216, 222]
        else if (kind === 'alloy') {
          // Five spokes, dark between.
          const spoke = Math.cos(a * 5) > 0.35 || d < 0.2
          col = spoke ? shade([200, 204, 210], 0.86 + (1 - d) * 0.2) : [28, 29, 31]
          if (d < 0.1) col = [120, 124, 130]
        } else {
          // A steel wheel: painted dark grey, a ring of holes, the hub's nuts.
          col = [70, 73, 78]
          if (d > 0.36 && d < 0.46 && Math.cos(a * 8) > 0.5) col = [24, 24, 26]
          if (d < 0.16) col = [110, 114, 120]
        }
      }
      img.set(x0 + x, y0 + y, col)
    }
}

type Atlas = { map: THREE.Texture; orm: THREE.Texture; glow: THREE.Texture }
let atlas: Atlas | null = null
/** The vehicles' one atlas (colour, roughness/metalness, glow), painted the first time a vehicle needs it. */
export function vehicleAtlas(): Atlas {
  if (atlas) return atlas
  const make = () => {
    const c = document.createElement('canvas')
    c.width = c.height = S
    const g = c.getContext('2d')!
    const data = g.createImageData(S, S)
    const img: Img = {
      set: (x, y, [r, gg, b]) => {
        if (x < 0 || y < 0 || x >= S || y >= S) return
        const i = (y * S + x) * 4
        data.data[i] = r
        data.data[i + 1] = gg
        data.data[i + 2] = b
        data.data[i + 3] = 255
      },
    }
    return { c, g, data, img }
  }
  const col = make()
  const orm = make()
  const glow = make()
  const W: [number, number, number] = [255, 255, 255]
  const K: [number, number, number] = [0, 0, 0]
  // Defaults: white colour (the vertex's), the paint's roughness, no glow.
  fill(col.img, [0, 0, S, S], () => W)
  fill(orm.img, [0, 0, S, S], () => [255, 87, 0])
  fill(glow.img, [0, 0, S, S], () => K)
  // The solid cells (16×16 each, used at their middle): a little grain on the colour.
  for (const [r, rough, metal, lit] of SURF) {
    const big: Reg = [r[0] - 4, r[1] - 4, 16, 16]
    fill(col.img, big, (x, y) => shade(W, r === R.paint ? 1 : 0.97 + hash(x, y, r[0]) * 0.03))
    fill(orm.img, big, () => [255, Math.round(rough * 255), Math.round(metal * 255)])
    fill(glow.img, big, () => [Math.round(lit * 255), Math.round(lit * (r === R.tail ? 0.2 : r === R.amber ? 0.6 : 1) * 255), Math.round(lit * (r === R.head || r === R.lit ? 0.85 : 0.1) * 255)])
  }
  // The body's sides: a faint grain, the road's dust low down, a darker sill line.
  fill(col.img, R.side, (x, y) => {
    const up = 1 - y / (R.side[3] - 1) // 1 at the top of the region (the face's top)
    let k = 0.985 + hash(x, y, 7) * 0.03
    if (up < 0.3 && hash(x, y, 9) < 0.8) k -= (0.3 - up) * 0.9 * (0.5 + hash(x, y, 2))
    const c = shade(W, k)
    // Dust is brown, not grey.
    return up < 0.3 ? [c[0], c[1] * 0.95, c[2] * 0.86] : c
  })
  fill(orm.img, R.side, (_x, y) => [255, y > R.side[3] * 0.72 ? 190 : 87, 0])
  // The grille: dark slats with a bright frame.
  fill(col.img, R.grille, (x, y) => (y === 0 || y === 15 || x === 0 || x === 63 ? [150, 154, 160] : y % 3 === 0 ? [70, 72, 76] : [18, 18, 20]))
  fill(orm.img, R.grille, (x, y) => (y === 0 || y === 15 || x === 0 || x === 63 ? [255, 60, 230] : [255, 150, 40]))
  fill(col.img, R.grilleBus, (_x, y) => (y % 4 < 2 ? [40, 42, 46] : [14, 14, 16]))
  fill(col.img, R.slats, (x) => (x % 6 < 3 ? [235, 235, 235] : [150, 150, 150]))
  // The lamps: a lens with its reflector, bright in the middle; the tail lamp in segments.
  fill(col.img, R.headLens, (x, y) => {
    const d = Math.hypot((x - 8) / 8, (y - 8) / 8)
    const d2 = Math.hypot((x - 23) / 6, (y - 8) / 6)
    return d < 0.8 || d2 < 0.8 ? [255, 252, 240] : x === 0 || x === 31 || y === 0 || y === 15 ? [120, 124, 130] : [196, 202, 210]
  })
  fill(glow.img, R.headLens, (x, y) => {
    const d = Math.min(Math.hypot((x - 8) / 8, (y - 8) / 8), Math.hypot((x - 23) / 6, (y - 8) / 6))
    return d < 0.8 ? [255, 240, 205] : [60, 58, 50]
  })
  fill(orm.img, R.headLens, () => [255, 30, 60])
  fill(col.img, R.tailLens, (x, y) => (x === 0 || x === 31 || y === 0 || y === 15 ? [60, 20, 24] : x < 10 ? [255, 150, 60] : x > 26 ? [240, 240, 240] : [210, 30, 44]))
  fill(glow.img, R.tailLens, (x, y) => (x === 0 || x === 31 || y === 0 || y === 15 ? K : x < 10 ? [110, 50, 0] : x > 26 ? [20, 20, 20] : [180, 20, 30]))
  fill(orm.img, R.tailLens, () => [255, 40, 0])
  // The taxi compteur's sign: TAXI in black on yellow, lit at night.
  fill(col.img, R.taxiSign, () => [247, 211, 59])
  label(col.img, R.taxiSign, 'TAXI', [21, 21, 21], 2)
  fill(glow.img, R.taxiSign, () => [150, 120, 20])
  label(glow.img, R.taxiSign, 'TAXI', K, 2)
  R.taxiNumber.forEach((r, i) => {
    fill(col.img, r, () => [245, 242, 234])
    label(col.img, r, ['T 214', 'T 087'][i], [17, 17, 17])
  })
  // Number plates: white, the blue band with CI, black numbers (invented), a little road dirt.
  const PLATES = ['2547 GH 01', '0918 FK 01', '7312 EJ 01', '4460 HB 03']
  R.plates.forEach((r, i) => {
    fill(col.img, r, (x, y) => (x === 0 || y === 0 || x === r[2] - 1 || y === r[3] - 1 ? [26, 26, 26] : x < 10 ? [31, 74, 168] : y > 11 && hash(x, y, i) < 0.3 ? [200, 190, 170] : [244, 244, 239]))
    text(col.img, 'CI', r[0] + 2, r[1] + 5, W)
    label(col.img, r, PLATES[i], [22, 22, 22], 1, 10)
    fill(orm.img, r, () => [255, 100, 0])
  })
  // The gbakas' mottos on the back (invented words, as they paint them), the SITRA bus's line, lit.
  const MOTTOS = ['MERCI MAMAN', 'DIEU EST GRAND', 'PATIENCE']
  R.mottos.forEach((r, i) => {
    fill(col.img, r, () => [247, 243, 232])
    label(col.img, r, MOTTOS[i], [200, 16, 46], 2)
  })
  fill(col.img, R.busLine, () => [16, 16, 18])
  label(col.img, R.busLine, '81 ADJAME', [255, 170, 40], 2)
  fill(glow.img, R.busLine, () => K)
  label(glow.img, R.busLine, '81 ADJAME', [255, 150, 30], 2)
  fill(orm.img, R.busLine, () => [255, 60, 0])
  // The roof light bar of a police car or a moto-taxi's lamp: segments.
  fill(col.img, R.roofLed, (x) => (x % 8 < 6 ? [255, 255, 255] : [60, 60, 60]))
  // The wheels: alloy, steel, wire; the tread across the tyre.
  rim(col.img, R.rimAlloy, 'alloy')
  rim(col.img, R.rimSteel, 'steel')
  rim(col.img, R.rimSpoke, 'spoke')
  for (const [r, kind] of [[R.rimAlloy, 'alloy'], [R.rimSteel, 'steel'], [R.rimSpoke, 'spoke']] as const)
    fill(orm.img, r, (x, y) => {
      const d = Math.hypot(x + 0.5 - r[2] / 2, y + 0.5 - r[3] / 2) / (r[2] / 2)
      const tyre = kind === 'spoke' ? 0.86 : kind === 'steel' ? 0.62 : 0.66
      return d > tyre ? [255, 235, 0] : [255, kind === 'steel' ? 120 : 70, kind === 'steel' ? 120 : 230]
    })
  fill(col.img, R.tread, (x, y) => shade([40, 39, 38], (x + (y > 7 ? 2 : 0)) % 4 < 2 ? 0.7 : 1))
  fill(orm.img, R.tread, () => [255, 240, 0])
  // Cloth on the roof racks (a bundle's weave, the rope round it), sacks.
  fill(col.img, R.cloth, (x, y) => (x % 21 < 2 || y % 17 < 2 ? [110, 92, 60] : shade(W, 0.82 + hash(x, y, 4) * 0.18)))
  fill(orm.img, R.cloth, () => [255, 240, 0])
  fill(col.img, R.sack, (x, y) => (y % 22 < 2 ? [120, 100, 70] : shade(W, (x + y) % 3 === 0 ? 0.84 : 0.96)))
  fill(orm.img, R.sack, () => [255, 245, 0])
  const tex = (m: ReturnType<typeof make>, srgb: boolean) => {
    m.g.putImageData(m.data, 0, 0)
    const t = new THREE.CanvasTexture(m.c)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.flipY = false
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  atlas = { map: tex(col, true), orm: tex(orm, false), glow: tex(glow, true) }
  return atlas
}
/** Texture memory of the atlas (three maps, with their mipmaps), in bytes: for the measures. */
export const ATLAS_BYTES = Math.round(S * S * 4 * 3 * 1.333)

/* ---------- The materials: one per paint, one program for all ---------- */

// Each vertex says what colours it: its own colour (0), the body's paint (1) or the second paint
// (2: a woro-woro's band, a gbaka's stripe, a bus's skirt). The paints are the material's, so every
// taxi shares one geometry, and every car of one colour one material (and all of them one program).
const PATCH_V = ['#include <color_vertex>', '#include <color_vertex>\n\tvPaint = paint;']
const PATCH_F = ['#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb *= vPaint < 0.5 ? vec3( 1.0 ) : vPaint < 1.5 ? uPaintA : uPaintB;']
function patch(m: THREE.Material, a: THREE.Color, b: THREE.Color) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uPaintA = { value: a }
    s.uniforms.uPaintB = { value: b }
    s.vertexShader = 'attribute float paint;\nvarying float vPaint;\n' + s.vertexShader.replace(PATCH_V[0], PATCH_V[1])
    s.fragmentShader = 'uniform vec3 uPaintA;\nuniform vec3 uPaintB;\nvarying float vPaint;\n' + s.fragmentShader.replace(PATCH_F[0], PATCH_F[1])
  }
  m.customProgramCacheKey = () => 'babi-voiture'
}

type Lit = THREE.MeshLambertMaterial | THREE.MeshStandardMaterial
const paints = new Map<string, Lit>()
const glowing = new Set<Lit>()
let night = false
const glowOf = () => (night ? 2.2 : 0.6)
/** The material of a vehicle painted `a` (and `b`), for a tier. Shared. */
export function paintMaterial(tier: Exclude<VoituresTier, 'off'>, a: string, b: string): Lit {
  const key = `${tier}|${a}|${b}`
  let m = paints.get(key)
  if (m) return m
  const { map, orm, glow } = vehicleAtlas()
  const common = { map, vertexColors: true, emissive: new THREE.Color('#ffffff'), emissiveMap: glow, emissiveIntensity: glowOf() }
  if (tier === 'simple') m = new THREE.MeshLambertMaterial(common)
  else if (tier === 'normal') m = new THREE.MeshStandardMaterial({ ...common, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, envMapIntensity: 1.1 })
  else m = new THREE.MeshPhysicalMaterial({ ...common, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, envMapIntensity: 1.2, clearcoat: 0.5, clearcoatRoughness: 0.16 })
  patch(m, new THREE.Color(a), new THREE.Color(b))
  paints.set(key, m)
  glowing.add(m)
  return m
}

const glasses = new Map<string, THREE.Material>()
/** The glass: dark and glossy (reflecting the sky on « normal » and « haute »), or see-through (one's own ride, the people inside seen). */
export function glassMaterial(tier: Exclude<VoituresTier, 'off'>, clear: boolean): THREE.Material {
  const key = `${tier}|${clear}`
  let m = glasses.get(key)
  if (m) return m
  const see = clear ? { transparent: true, opacity: 0.3, depthWrite: false } : {}
  if (tier === 'simple') m = new THREE.MeshPhongMaterial({ color: clear ? '#9fb4c8' : '#ffffff', vertexColors: !clear, shininess: 120, specular: new THREE.Color('#b9c8d8'), ...see })
  // (A clear coat on the glass even on « normal »: a plain dark dielectric reflects too little of the sky to be seen.)
  else m = new THREE.MeshPhysicalMaterial({ color: clear ? '#a9bccd' : '#ffffff', vertexColors: !clear, roughness: 0.04, metalness: clear ? 0.1 : 0.35, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4, ...see })
  glasses.set(key, m)
  return m
}

/** Day or night for the vehicles' lamps (vehicles.tsx setVehicleNight calls it). */
export function setVoituresNight(on: boolean) {
  night = on
  for (const m of glowing) m.emissiveIntensity = glowOf()
}

/* ---------- The builder: boxes and shapes merged into one geometry ---------- */

export type V3 = [number, number, number]
/** What a part is made of: its region of the atlas (solid, or fitted on some faces), its colour or paint, a tint. */
export type Mat = { reg: Reg; c?: string; slot?: 0 | 1 | 2; tint?: number; fit?: { faces: number[]; reg: Reg } }

const tmpC = new THREE.Color()
const tmpM = new THREE.Matrix4()
const tmpN = new THREE.Matrix3()
const tmpV = new THREE.Vector3()
const tmpE = new THREE.Euler()

/** Face indices as BoxGeometry orders them. */
export const PX = 0
export const NX = 1
export const PY = 2
export const NY = 3
export const PZ = 4
export const NZ = 5

export class Kit {
  pos: number[] = []
  nrm: number[] = []
  uv: number[] = []
  col: number[] = []
  pnt: number[] = []
  idx: number[] = []
  /** Chamfers on the boxes at least `bevelMin` thick (0: none): thinner, the chamfer can't be seen and costs 32 triangles. */
  constructor(public bevelMin: number) {}

  /** Adds a geometry placed by `m`, every vertex dressed by `mat` (its region chosen by `regOf(vertex)`). */
  private put(g: THREE.BufferGeometry, m: THREE.Matrix4, mat: Mat, uvOf: (k: number, u: number, v: number) => [number, number]) {
    const p = g.attributes.position
    const n = g.attributes.normal
    const uv = g.attributes.uv
    const base = this.pos.length / 3
    tmpN.getNormalMatrix(m)
    const c = mat.c ? tmpC.set(mat.c) : tmpC.setRGB(1, 1, 1)
    const t = mat.tint ?? 1
    for (let k = 0; k < p.count; k++) {
      tmpV.fromBufferAttribute(p, k).applyMatrix4(m)
      this.pos.push(tmpV.x, tmpV.y, tmpV.z)
      tmpV.fromBufferAttribute(n, k).applyMatrix3(tmpN).normalize()
      this.nrm.push(tmpV.x, tmpV.y, tmpV.z)
      const [u, v] = uvOf(k, uv ? uv.getX(k) : 0.5, uv ? uv.getY(k) : 0.5)
      this.uv.push(u, v)
      this.col.push(c.r * t, c.g * t, c.b * t)
      this.pnt.push(mat.slot ?? 0)
    }
    if (g.index) for (let k = 0; k < g.index.count; k++) this.idx.push(base + g.index.getX(k))
    else for (let k = 0; k < p.count; k++) this.idx.push(base + k)
  }

  /** A box: size, centre, what it is made of; `rot` turns it (radians about x, y, z, in that order). */
  box(s: V3, p: V3, mat: Mat, rot?: V3, bevel = true) {
    const thick = Math.min(s[0], s[1], s[2])
    const g = this.bevelMin > 0 && bevel && thick >= this.bevelMin ? new BevelBoxGeometry(s[0], s[1], s[2]) : new THREE.BoxGeometry(s[0], s[1], s[2])
    const faces = g.userData.faces as Uint8Array | undefined
    tmpM.makeRotationFromEuler(tmpE.set(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0)).setPosition(p[0], p[1], p[2])
    this.put(g, tmpM, mat, (k, u, v) => {
      const f = faces ? faces[k] : Math.floor(k / 4)
      const r = mat.fit && mat.fit.faces.includes(f) ? mat.fit.reg : mat.reg
      return mat.fit && mat.fit.faces.includes(f) ? at(r, u, v) : at(r, 0.5, 0.5)
    })
    g.dispose()
  }

  /** A prism: a polygon in the x-y plane (anticlockwise), `d` deep across z, centred on z = `z`. */
  prism(pts: [number, number][], d: number, z: number, mat: Mat) {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))
    const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false })
    tmpM.makeTranslation(0, 0, z - d / 2)
    this.put(g, tmpM, mat, () => at(mat.reg, 0.5, 0.5))
    g.dispose()
  }

  /** A cylinder along z (a wheel, a spare, a lamp): `sides` faces; its ends fitted with `cap`, its side with `side`. */
  cyl(r: number, w: number, p: V3, sides: number, cap: Mat, side: Reg, rot?: V3) {
    const g = new THREE.CylinderGeometry(r, r, w, sides)
    g.rotateX(Math.PI / 2)
    // CylinderGeometry: the side's vertices first, then each end's.
    const sideCount = (sides + 1) * 2
    tmpM.makeRotationFromEuler(tmpE.set(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0)).setPosition(p[0], p[1], p[2])
    this.put(g, tmpM, cap, (k, u, v) => (k < sideCount ? at(side, u, v) : at(cap.reg, u, v)))
    g.dispose()
  }

  /** The merged geometry. */
  finish(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setAttribute('paint', new THREE.Float32BufferAttribute(this.pnt, 1))
    const n = this.pos.length / 3
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1))
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
  get tris() {
    return this.idx.length / 3
  }
}

/** The atlas UV of a point (u, v in 0..1) of a region: the canvas runs down from the top, the texture isn't flipped. */
function at(r: Reg, u: number, v: number): [number, number] {
  return [(r[0] + u * r[2]) / S, (r[1] + (1 - v) * r[3]) / S]
}
