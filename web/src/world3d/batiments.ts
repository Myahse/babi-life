import * as THREE from 'three'
import { useSyncExternalStore } from 'react'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { featuresKnown, keyOpenNow, onFeatures } from '../lib/features'
import { lightPhoneNow, useLightPhone } from '../lib/lightPhone'
import { deviceTier, subscribeTier } from './open/lumiere'

// « Bâtiments réalistes » (the update « batiments-realistes », the « blocs réalistes » look inside
// the buildings and on the named landmarks). Everything stays made of blocks; the blocks get the
// concept's materials: pixel textures at a finer texel (tiles with their grout and chipped corners,
// terrazzo, parquet, painted plaster with its wear), the rooms lit by a preset (warm, neon,
// daylight…), the glossy floors and the glass reflecting a room (an environment map) and, on the
// strong devices, the sun's shafts through the windows. While the update is shut, nothing here
// runs and every room draws exactly as before.

export const BATIMENTS = 'batiments-realistes'
const HEARD_KEY = 'babi.batiments.ouvert'

/**
 * How much of it a device draws (the same device tiers as « lumière réaliste », open/lumiere.ts).
 * - `simple`: the finer textures and the room's light preset.
 * - `normal`: + the reflections (an environment map on the floors, the glass, the polished stone), more props on the walls.
 * - `haute`: + the sun's shafts through the windows (the rooms' ambient occlusion is the lumière's).
 */
export type BatTier = 'off' | 'simple' | 'normal' | 'haute'

function read(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const open = () => (featuresKnown() ? keyOpenNow(BATIMENTS) : read(HEARD_KEY) === '1')
onFeatures(() => {
  if (!featuresKnown()) return
  try {
    localStorage.setItem(HEARD_KEY, keyOpenNow(BATIMENTS) ? '1' : '0')
  } catch {
    // Private mode: as the server says, once it has.
  }
})

// In development, ?batiments=off|simple|normal|haute forces a tier (to compare them).
const FORCED = import.meta.env.DEV && typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('batiments') as BatTier | null) : null

function tierOf(light: boolean): BatTier {
  if (FORCED) return FORCED
  if (!open()) return 'off'
  return deviceTier(light)
}
/** The tier now, outside React (read when a thing is made). */
export const batimentsTier = () => tierOf(lightPhoneNow())
/** The tier, followed (the update can open, the phone go light). */
export function useBatiments(): BatTier {
  const light = useLightPhone()
  return useSyncExternalStore(subscribeTier, () => tierOf(light))
}
export const reflects = (t: BatTier) => t === 'normal' || t === 'haute'

/* ---------- Pixel textures ---------- */

const hash = (x: number, y: number, s = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
  return n - Math.floor(n)
}
/** A grey level 0..255 → '#vvvvvv'-like rgb array. */
type RGB = [number, number, number]
const g = (v: number): RGB => [v, v, v]
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))

function canvasTex(w: number, h: number, paint: (x: number, y: number) => RGB, color = true) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, gg, b] = paint(x, y)
      const i = (y * w + x) * 4
      img.data[i] = clamp(r)
      img.data[i + 1] = clamp(gg)
      img.data[i + 2] = clamp(b)
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  // Crisp up close like the street's pixels; smoothed from afar (no shimmer on a big floor).
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.anisotropy = 4
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (color) t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * The surfaces. Light (near white) textures, tinted by the colour the room already gives its floor
 * or wall, so every room keeps its colours. `m`: metres one texture covers.
 */
export type SurfaceKind = 'carrelage' | 'marbre' | 'terrazzo' | 'parquet' | 'beton' | 'terre' | 'sombre' | 'enduit' | 'moquette' | 'pierre' | 'bois'
type Surface = { size: number; m: number; rough: number; reflect: number; paint: (x: number, y: number) => RGB; rmap?: (x: number, y: number) => number }

const SURFACES: Record<SurfaceKind, Surface> = {
  // Ceramic tiles of 50 cm (the floors of Abidjan's houses and offices), 1 px of grout, each tile
  // its own shade, a faint speckle in the glaze, now and then a chipped corner or a stain.
  carrelage: {
    size: 64,
    m: 1,
    rough: 0.32,
    reflect: 0.5,
    paint: (x, y) => {
      if (x % 32 === 0 || y % 32 === 0) return g(112)
      const tx = x >> 5
      const ty = y >> 5
      let v = 230 + (hash(tx, ty, 1) - 0.5) * 22 + (hash(x, y, 2) - 0.5) * 8
      if (hash(x >> 1, y >> 1, 3) > 0.93) v -= 10
      const cx = x % 32
      const cy = y % 32
      if (hash(tx, ty, 4) > 0.7 && cx < 3 && cy < 3 && cx + cy < 3) v = 175
      if (hash(tx, ty, 5) > 0.82 && Math.hypot(cx - 16, cy - 14) < 5 + hash(x, y, 6) * 2) v -= 14
      return [v, v - 1, v - 3]
    },
    rmap: (x, y) => (x % 32 === 0 || y % 32 === 0 ? 0.95 : 0.28 + hash(x >> 2, y >> 2, 7) * 0.12),
  },
  // Polished marble slabs of a metre: grey veins, a lighter cloud.
  marbre: {
    size: 128,
    m: 2,
    rough: 0.18,
    reflect: 0.85,
    paint: (x, y) => {
      if (x % 64 === 0 || y % 64 === 0) return g(196)
      const s = (x >> 6) * 3 + (y >> 6)
      const vein = Math.abs(Math.sin((x * 0.09 + y * 0.05 + s) * 2.1 + Math.sin(y * 0.07 + s) * 2.4))
      let v = 240 + (hash(x >> 3, y >> 3, s) - 0.5) * 8
      if (vein < 0.06) v -= 46
      else if (vein < 0.14) v -= 18
      return [v, v - 2, v - 5]
    },
    rmap: (x, y) => (x % 64 === 0 || y % 64 === 0 ? 0.6 : 0.14),
  },
  // Terrazzo (the halls, the hospitals, the schools): chips of marble in grey cement, brass strips.
  terrazzo: {
    size: 64,
    m: 1.5,
    rough: 0.3,
    reflect: 0.55,
    paint: (x, y) => {
      if (x % 64 === 0 || y % 64 === 0) return [200, 170, 110]
      const h = hash(x, y, 11)
      if (h > 0.9) return g(120 + hash(x, y, 12) * 40)
      if (h > 0.8) return [250, 246, 238]
      if (h > 0.76) return [190, 140, 110]
      const v = 222 + (hash(x >> 2, y >> 2, 13) - 0.5) * 10
      return [v, v - 1, v - 3]
    },
  },
  // Parquet: 12 cm planks, staggered ends, the grain, a darker plank now and then.
  parquet: {
    size: 64,
    m: 1,
    rough: 0.5,
    reflect: 0.3,
    paint: (x, y) => {
      const row = y >> 3
      const off = Math.floor(hash(row, 0, 21) * 64)
      const along = (x + off) % 64
      if (y % 8 === 0 || along === 0 || along === 37) return g(120)
      const plank = Math.floor((x + off) / 37) + row * 7
      let v = 214 + (hash(plank, row, 22) - 0.5) * 34
      v += Math.sin((x + off) * 0.6 + hash(row, plank, 23) * 6 + Math.sin(x * 0.11) * 3) * 6
      if (hash(x >> 2, y, 24) > 0.94) v -= 14
      return [v, v - 6, v - 14]
    },
    rmap: (_x, y) => (y % 8 === 0 ? 0.9 : 0.42),
  },
  // Concrete screed, painted or waxed: mottled, a hairline crack, scuffs where people walk.
  beton: {
    size: 64,
    m: 2,
    rough: 0.75,
    reflect: 0.15,
    paint: (x, y) => {
      let v = 224 + (hash(x >> 3, y >> 3, 31) - 0.5) * 16 + (hash(x, y, 32) - 0.5) * 12
      if (Math.abs(y - 20 - Math.sin(x * 0.2) * 3 - (x > 30 ? (x - 30) * 0.4 : 0)) < 0.6 && x > 8 && x < 50) v -= 40
      if (hash(x >> 1, y >> 1, 33) > 0.96) v -= 18
      return [v, v - 1, v - 2]
    },
  },
  // Beaten earth: grains, pebbles.
  terre: {
    size: 64,
    m: 2,
    rough: 0.95,
    reflect: 0,
    paint: (x, y) => {
      let v = 210 + (hash(x >> 2, y >> 2, 41) - 0.5) * 30 + (hash(x, y, 42) - 0.5) * 22
      if (hash(x, y, 43) > 0.95) v = 245
      if (hash(x >> 1, y >> 1, 44) > 0.97) v = 150
      return [v, v - 4, v - 8]
    },
  },
  // Dark glazed tiles (the club, the cinema, the salle de jeux): 50 cm, shinier.
  sombre: {
    size: 64,
    m: 1,
    rough: 0.22,
    reflect: 0.7,
    paint: (x, y) => {
      if (x % 32 === 0 || y % 32 === 0) return g(120)
      const v = 228 + (hash(x >> 5, y >> 5, 51) - 0.5) * 22 + (hash(x, y, 52) - 0.5) * 8
      return g(v)
    },
    rmap: (x, y) => (x % 32 === 0 || y % 32 === 0 ? 0.9 : 0.18),
  },
  // Painted plaster on the walls: a mottle under the paint, the trowel's marks, hairline cracks,
  // scuffs and a few darker patches (two metres a texture, so the wear doesn't repeat each metre).
  enduit: {
    size: 128,
    m: 2,
    rough: 0.88,
    reflect: 0,
    paint: (x, y) => {
      let v = 242 + (hash(x >> 4, y >> 4, 61) - 0.5) * 7 + (hash(x >> 1, y >> 1, 62) - 0.5) * 5 + (hash(x, y, 63) - 0.5) * 3
      // Trowel marks: long, faint diagonals.
      if (Math.abs(((x + y * 0.4 + hash(y >> 3, 0, 64) * 20) % 23) - 11) < 0.7) v -= 4
      // A hairline crack running down from a corner.
      if (Math.abs(x - 90 - Math.sin(y * 0.15) * 4 - y * 0.25) < 0.6 && y < 70) v -= 26
      // Scuffs and damp patches.
      if (hash(x >> 3, y >> 3, 65) > 0.97) v -= 7
      // A damp patch now and then, round and soft (not a square).
      const d = Math.hypot((x % 64) - 40, (y % 64) - 22)
      if (hash(x >> 6, y >> 6, 66) > 0.6 && d < 9) v -= (9 - d) * 1.4
      return [v, v - 1, v - 4]
    },
  },
  // Carpet: a fine loop pile.
  moquette: {
    size: 32,
    m: 0.5,
    rough: 1,
    reflect: 0,
    paint: (x, y) => g(212 + (hash(x, y, 71) - 0.5) * 34 + ((x + y) % 2 ? 6 : -6)),
  },
  // Dressed stone (the cathedral, the basilica): courses, a grain, weathering.
  pierre: {
    size: 64,
    m: 2,
    rough: 0.85,
    reflect: 0.05,
    paint: (x, y) => {
      const course = y >> 4
      const off = course % 2 ? 16 : 0
      if (y % 16 === 0 || (x + off) % 32 === 0) return g(170)
      const v = 226 + (hash((x + off) >> 5, course, 81) - 0.5) * 20 + (hash(x, y, 82) - 0.5) * 14
      return [v, v - 3, v - 8]
    },
  },
  // Wood (doors, frames, counters, pews): grain lines.
  bois: {
    size: 32,
    m: 0.5,
    rough: 0.55,
    reflect: 0.15,
    paint: (x, y) => {
      const v = 208 + Math.sin(x * 0.9 + Math.sin(y * 0.2) * 2) * 12 + (hash(x, y, 91) - 0.5) * 10 + (hash(x >> 2, 0, 92) - 0.5) * 16
      return [v, v - 8, v - 18]
    },
  },
}

const maps = new Map<string, THREE.Texture>()
/** A surface's pixel texture (shared, never disposed: a few small textures for the whole game). */
export function surfaceMap(kind: SurfaceKind) {
  let t = maps.get(kind)
  if (!t) {
    const s = SURFACES[kind]
    t = canvasTex(s.size, s.size, s.paint)
    maps.set(kind, t)
  }
  return t
}
function roughMap(kind: SurfaceKind) {
  const s = SURFACES[kind]
  if (!s.rmap) return null
  const k = `${kind}:r`
  let t = maps.get(k)
  if (!t) {
    t = canvasTex(s.size, s.size, (x, y) => g(s.rmap!(x, y) * 255), false)
    maps.set(k, t)
  }
  return t
}
/** Metres one texture covers (for a repeat: size / surfaceMetres). */
export const surfaceMetres = (kind: SurfaceKind) => SURFACES[kind].m

/* ---------- The room's environment (what the glossy things reflect) ---------- */

const envs = new WeakMap<THREE.WebGLRenderer, THREE.Texture>()
/** A neutral lit room, prefiltered once per renderer (three's RoomEnvironment): the floors and the glass reflect it. */
export function roomEnv(gl: THREE.WebGLRenderer) {
  let t = envs.get(gl)
  if (!t) {
    const pm = new THREE.PMREMGenerator(gl)
    const scene = new RoomEnvironment()
    t = pm.fromScene(scene, 0.04).texture
    scene.dispose()
    pm.dispose()
    envs.set(gl, t)
  }
  return t
}

const mats = new Map<string, THREE.Material>()
/**
 * A surface's material for this tier: its texture tinted by `color`, repeated for a face of
 * `w`×`h` metres. `simple` stays matte (Lambert, as the rooms are); from `normal`, physical with
 * its roughness, reflecting the room's environment. Cached by everything that makes it.
 */
export function surfaceMaterial(kind: SurfaceKind, color: string, tier: BatTier, w: number, h: number, env?: THREE.Texture | null, extra?: { emissive?: string; side?: THREE.Side }) {
  const s = SURFACES[kind]
  const ru = Math.max(0.25, Math.round((w / s.m) * 4) / 4)
  const rv = Math.max(0.25, Math.round((h / s.m) * 4) / 4)
  const shiny = reflects(tier) && !!env
  const key = `${kind}|${color}|${shiny ? 'std' : 'lam'}|${ru}|${rv}|${extra?.emissive ?? ''}|${extra?.side ?? 0}`
  let m = mats.get(key)
  if (m) return m
  const map = surfaceMap(kind).clone()
  map.repeat.set(ru, rv)
  map.needsUpdate = true
  if (shiny) {
    const rm = roughMap(kind)?.clone() ?? null
    if (rm) {
      rm.repeat.set(ru, rv)
      rm.needsUpdate = true
    }
    m = new THREE.MeshStandardMaterial({ color, map, roughness: rm ? 1 : s.rough, roughnessMap: rm, metalness: 0, envMap: env, envMapIntensity: 0.06 + s.reflect * 0.3, emissive: extra?.emissive, side: extra?.side })
  } else m = new THREE.MeshLambertMaterial({ color, map, emissive: extra?.emissive, side: extra?.side })
  mats.set(key, m)
  return m
}

/* ---------- Light presets ---------- */

/**
 * The rooms' lights by what they are. `sky`/`ground`/`i`: the fill (day, night); `lamp`: the colour of
 * the lamps; `env`: how much the glossy things reflect.
 */
export type PresetName = 'chaud' | 'neon' | 'jour' | 'clinique' | 'sacre' | 'salle'
export type Preset = { sky: string; ground: string; i: [number, number]; amb: [number, number]; lamp: string; lampI: number; env: number; shaft: string }
export const PRESETS: Record<PresetName, Preset> = {
  // Homes, maquis, restaurants, hotels: warm bulbs, a warm fill.
  chaud: { sky: '#fff0d8', ground: '#4a3320', i: [0.72, 0.6], amb: [0.18, 0.14], lamp: '#ffcf8a', lampI: 1.1, env: 0.8, shaft: '#ffdcaa' },
  // The club, the salle de jeux: the dark and its neon, a violet fill.
  neon: { sky: '#8a6ad0', ground: '#1a1030', i: [0.5, 0.5], amb: [0.1, 0.1], lamp: '#c79bff', lampI: 1, env: 1, shaft: '#c0a0ff' },
  // Offices, schools, shops, the mairie: neutral daylight, fluorescent tubes.
  jour: { sky: '#f4f8ff', ground: '#5a5048', i: [0.85, 0.65], amb: [0.26, 0.16], lamp: '#f2f6ff', lampI: 1, env: 0.7, shaft: '#fff4e0' },
  // Hospitals: cool and even.
  clinique: { sky: '#eef8ff', ground: '#607080', i: [0.9, 0.7], amb: [0.28, 0.18], lamp: '#eaf6ff', lampI: 1.05, env: 0.6, shaft: '#f4fbff' },
  // Places of worship: soft daylight from high up, warm stone.
  sacre: { sky: '#fff6e6', ground: '#5a4630', i: [0.8, 0.55], amb: [0.22, 0.14], lamp: '#ffe2b0', lampI: 1, env: 0.6, shaft: '#fff0cc' },
  // The cinema: nearly dark.
  salle: { sky: '#6a5a8a', ground: '#1a1420', i: [0.45, 0.45], amb: [0.1, 0.1], lamp: '#ffd9a0', lampI: 0.8, env: 0.6, shaft: '#ffe0b0' },
}
/** A room kind's preset. */
export function presetOf(kind: string): PresetName {
  switch (kind) {
    case 'club':
    case 'gaming':
      return 'neon'
    case 'cinema':
      return 'salle'
    case 'health':
      return 'clinique'
    case 'worship':
      return 'sacre'
    case 'school':
    case 'office':
    case 'mairie':
    case 'universite':
    case 'mall':
    case 'boutique':
    case 'police':
    case 'couture':
    case 'barbier':
    case 'salon':
    case 'orphelinat':
      return 'jour'
    default:
      return 'chaud'
  }
}
/** A room kind's floor and wall surfaces, from what the room asked for. */
export function floorSurface(floorType: string, kind: string): SurfaceKind {
  switch (floorType) {
    case 'marble':
      return 'marbre'
    case 'wood':
      return 'parquet'
    case 'earth':
      return 'terre'
    case 'dark':
      return 'sombre'
    case 'concrete':
      return 'beton'
    default:
      return kind === 'health' || kind === 'school' || kind === 'universite' || kind === 'mairie' || kind === 'mall' ? 'terrazzo' : 'carrelage'
  }
}

/* ---------- The sun's shafts through a window (haute) ---------- */

const SHAFT_VERT = /* glsl */ `
attribute vec3 shaft;
varying vec3 vShaft;
varying vec3 vWorld;
void main() {
  vShaft = shaft;
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const SHAFT_FRAG = /* glsl */ `
uniform vec3 color;
uniform float strength;
uniform float time;
varying vec3 vShaft;
varying vec3 vWorld;
float h3( vec3 p ) { return fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 ); }
void main() {
  // Soft at the window's edges, fading as it goes down to the floor.
  // x: along the window's edge the side comes from (soft at its two ends), y: from the window down to the floor.
  float edge = smoothstep( 0.0, 0.25, vShaft.x ) * smoothstep( 1.0, 0.75, vShaft.x );
  float a = edge * ( 1.0 - vShaft.y * 0.8 ) * smoothstep( 0.0, 0.08, vShaft.y ) * strength;
  // Dust drifting in the light: a few motes, in blocks of 3 cm (the game's pixels).
  vec3 q = floor( vWorld * 33.0 + vec3( 0.0, time * 0.6, time * 0.25 ) );
  a += step( 0.997, h3( q ) ) * edge * 0.5 * strength;
  gl_FragColor = vec4( color * a, 1.0 );
}
`
/**
 * A shaft of light: from a window's four corners (`quad`, in order round it) along `dir`, each corner
 * carried down to the floor (y = 0), so the shaft lands where the sun's patch is.
 */
export function shaftGeometry(quad: [number, number, number][], dir: THREE.Vector3) {
  const pos: number[] = []
  const at: number[] = []
  const far = quad.map(([x, y, z]) => {
    const t = Math.max(0.5, y / -dir.y)
    return [x + dir.x * t, y + dir.y * t, z + dir.z * t]
  })
  // Four sides (the window's opening is open; the floor end too).
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    const v = [quad[i], quad[j], far[j], far[i]]
    const s = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ]
    for (const k of [0, 1, 2, 0, 2, 3]) {
      pos.push(...v[k])
      at.push(...s[k])
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('shaft', new THREE.Float32BufferAttribute(at, 3))
  geo.computeBoundingSphere()
  return geo
}
export function shaftMaterial(color: string, strength = 0.16) {
  return new THREE.ShaderMaterial({
    vertexShader: SHAFT_VERT,
    fragmentShader: SHAFT_FRAG,
    uniforms: { color: { value: new THREE.Color(color) }, strength: { value: strength }, time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

/* ---------- The patina: wear on the big surfaces of a room drawn its own way ---------- */

// The big places (the malls, the hotels, the cathedral…) each paint their own floors and walls.
// Rather than repaint each, the patina adds what the concept's materials have, in the materials'
// own shader, on the room's big surfaces only (a side of more than `BIG` m: floors, walls,
// columns, counters; never a Sim nor a small prop): a mottle under the paint, a grain in blocks of
// 3 cm (the game's pixels), the grime at the foot of the walls, and, from `normal`, the floors
// reflecting the room. Patched once per material.

const PATINA_FRAG = /* glsl */ `
float batH( vec3 p ) { return fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 ); }
float batN( vec3 p ) {
  vec3 i = floor( p ); vec3 f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( batH( i ), batH( i + vec3( 1, 0, 0 ) ), f.x ), mix( batH( i + vec3( 0, 1, 0 ) ), batH( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( batH( i + vec3( 0, 0, 1 ) ), batH( i + vec3( 1, 0, 1 ) ), f.x ), mix( batH( i + vec3( 0, 1, 1 ) ), batH( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
`
export const BIG = 1.6
const patched = new WeakSet<THREE.Material>()
const BASE_COMPILE = THREE.Material.prototype.onBeforeCompile

/** Adds the patina to a material (Lambert, Phong or Standard; anything else is left as it is). */
export function patinate(m: THREE.Material, base = 0) {
  if (patched.has(m)) return
  patched.add(m)
  if (!(m instanceof THREE.MeshLambertMaterial || m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhongMaterial)) return
  if (m.onBeforeCompile !== BASE_COMPILE || m.transparent) return
  m.onBeforeCompile = (sh) => {
    sh.uniforms.batBase = { value: base }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBatW;\nvarying vec3 vBatN;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
  vec4 batW = vec4( transformed, 1.0 );
  vec3 batN = objectNormal;
  #ifdef USE_INSTANCING
    batW = instanceMatrix * batW;
    batN = mat3( instanceMatrix ) * batN;
  #endif
  vBatW = ( modelMatrix * batW ).xyz;
  vBatN = normalize( mat3( modelMatrix ) * batN );`,
      )
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vBatW;\nvarying vec3 vBatN;\nuniform float batBase;\n${PATINA_FRAG}`).replace(
      '#include <map_fragment>',
      `#include <map_fragment>
  {
    vec3 q = vBatW;
    float k = 1.0 - 0.09 * ( batN( q * 0.45 ) - 0.5 ) * 2.0 - 0.035 * ( batH( floor( q * 33.0 ) ) - 0.5 ) * 2.0;
    k -= 0.05 * smoothstep( 0.62, 0.9, batN( q * 1.7 + 4.0 ) );
    float vert = 1.0 - abs( vBatN.y );
    k -= vert * 0.16 * ( 1.0 - smoothstep( 0.0, 0.35, q.y - batBase ) );
    diffuseColor.rgb *= clamp( k, 0.7, 1.05 );
  }`,
    )
  }
  m.customProgramCacheKey = () => 'batiments-patina'
  m.needsUpdate = true
}

const box = new THREE.Box3()
const size = new THREE.Vector3()
/** Patinates the big surfaces under `root` (meshes not yet seen; skinned meshes and sprites skipped). */
export function patinateTree(root: THREE.Object3D, seen: WeakSet<THREE.Object3D>, base = 0) {
  root.traverse((o) => {
    if (seen.has(o)) return
    seen.add(o)
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || (o as THREE.SkinnedMesh).isSkinnedMesh || (o as THREE.InstancedMesh).isInstancedMesh) return
    const geo = mesh.geometry
    if (!geo) return
    if (!geo.boundingBox) geo.computeBoundingBox()
    box.copy(geo.boundingBox!).getSize(size)
    size.multiply(mesh.scale)
    if (Math.max(size.x, size.y, size.z) < BIG) return
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of list) patinate(m, base)
  })
}
