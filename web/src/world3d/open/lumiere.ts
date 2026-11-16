import * as THREE from 'three'
import { useSyncExternalStore } from 'react'
import { featuresKnown, keyOpenNow, onFeatures } from '../../lib/features'
import { quality, weakDevice } from '../../lib/device'
import { useLightPhone } from '../../lib/lightPhone'

// « Lumière réaliste » (the update « lumiere-realiste », step 1 of the « blocs réalistes » look,
// concept in the lab's look.ts): the open world lit like the concept. The sun moves with the
// game's clock (low and orange at the golden hours, long shadows), the sky, the haze and the
// fill follow it, the materials take their sky light from the sky itself (an environment map),
// and a colour grade (a touch more colour and contrast) runs inside the tone mapping, so it
// costs no extra pass. The expensive parts (ambient occlusion, bloom by day, a bigger shadow
// map, a vignette) only on the devices that can afford them. While the update is shut, nothing
// here runs and the game draws as it always did.

export const LUMIERE = 'lumiere-realiste'
const HEARD_KEY = 'babi.lumiere.ouvert'

/**
 * How much of it a device draws.
 * - `simple`: the small phones (« Légère », « Téléphone léger »): the grade, the light's colours by the hour, the sky and haze; no environment map.
 * - `normal`: + the sky as environment light, softer shadows.
 * - `haute`: + ambient occlusion, a faint bloom by day too, a 4096 shadow map, a vignette (« Belle » in Réglages, or a strong computer by itself).
 */
export type LumiereTier = 'off' | 'simple' | 'normal' | 'haute'

function read(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const open = () => (featuresKnown() ? keyOpenNow(LUMIERE) : read(HEARD_KEY) === '1')
onFeatures(() => {
  if (!featuresKnown()) return
  try {
    localStorage.setItem(HEARD_KEY, keyOpenNow(LUMIERE) ? '1' : '0')
  } catch {
    // Private mode: as the server says, once it has.
  }
})

/** A computer with a real graphics card (not a phone, not a software renderer): « haute » by itself. */
let strong: boolean | undefined
export function strongMachine() {
  if (strong !== undefined) return strong
  strong = false
  try {
    const fine = typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches && !matchMedia('(pointer: coarse)').matches
    if (!fine || (navigator.hardwareConcurrency ?? 4) < 8) return strong
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return strong
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    strong = !!name && !/swiftshader|llvmpipe|software|mali|adreno|powervr|intel\(r\) (hd|uhd) graphics [2-6]\d{2}\b/i.test(name)
  } catch {
    strong = false
  }
  return strong
}

// In development, ?lumiere=off|simple|normal|haute forces a tier (to compare them).
const FORCED = import.meta.env.DEV && typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('lumiere') as LumiereTier | null) : null

/** Dropped for this session when the street ran slow with everything on (the performance monitor). */
let dropped = false
const listeners = new Set<() => void>()
/** Follows what changes the tiers: the updates opening or shutting, « haute » dropped. */
export const subscribeTier = (f: () => void) => {
  listeners.add(f)
  const off = onFeatures(f)
  return () => {
    listeners.delete(f)
    off()
  }
}
/** The street can't keep up with « haute »: back to « normal » until the game opens again. */
export function dropLumiere() {
  if (dropped) return
  dropped = true
  listeners.forEach((f) => f())
}

/** What this device can afford, the update aside (the water's « eau-realiste » takes the same tiers: eau.ts). */
export function deviceTier(light: boolean): Exclude<LumiereTier, 'off'> {
  if (light || weakDevice) return 'simple'
  if ((quality === 'beau' || (quality === 'auto' && strongMachine())) && !dropped) return 'haute'
  return 'normal'
}

function tierOf(light: boolean): LumiereTier {
  if (FORCED) return FORCED
  if (!open()) return 'off'
  return deviceTier(light)
}

/** The tier the street draws now (followed: the update can open, the phone go light, « haute » be dropped). */
export function useLumiere(): LumiereTier {
  const light = useLightPhone()
  return useSyncExternalStore(subscribeTier, () => tierOf(light))
}
/** Just open or not, for the rooms (they keep their own lights and only take the grade). */
export function useLumiereOpen() {
  return useSyncExternalStore(subscribeTier, () => (FORCED ? FORCED !== 'off' : open()))
}

// ---------------------------------------------------------------------------
// The grade, inside the tone mapping: the scene's colours (linear) through ACES, then a
// touch more saturation and contrast (around mid grey, so the blacks don't crush). Three's
// CustomToneMapping is only used where a renderer asks for it, so patching it changes nothing
// elsewhere. The same function runs in the high tier's post pass (effects.tsx), so both look alike.

export const GRADE_GLSL = /* glsl */ `
vec3 babiGrade( vec3 c, float sat, float contrast, float warm ) {
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  c = max( mix( vec3( l ), c, sat ), 0.0 );
  c = pow( c / 0.18, vec3( contrast ) ) * 0.18;
  c *= mix( vec3( 1.0 ), vec3( 1.05, 1.0, 0.9 ), warm );
  return clamp( c, 0.0, 1.0 );
}
`
/** The grade: the open world's and the rooms' alike. */
export const SAT = 1.08
export const CONTRAST = 1.06

const chunk = THREE.ShaderChunk as unknown as Record<string, string>
if (!chunk.tonemapping_pars_fragment.includes('babiGrade')) {
  chunk.tonemapping_pars_fragment = chunk.tonemapping_pars_fragment.replace(
    'vec3 CustomToneMapping( vec3 color ) { return color; }',
    `${GRADE_GLSL}
vec3 CustomToneMapping( vec3 color ) { return babiGrade( ACESFilmicToneMapping( color ), ${SAT.toFixed(3)}, ${CONTRAST.toFixed(3)}, 0.0 ); }`,
  )
}

/** Puts the grade on a renderer (ACES + grade, at this exposure); `undo` gives it back plain ACES. */
export function gradeOn(gl: THREE.WebGLRenderer, exposure: number) {
  if (gl.toneMapping !== THREE.CustomToneMapping && gl.toneMapping !== THREE.NoToneMapping) gl.toneMapping = THREE.CustomToneMapping
  gl.toneMappingExposure = exposure
}
export function gradeOff(gl: THREE.WebGLRenderer) {
  if (gl.toneMapping === THREE.CustomToneMapping) gl.toneMapping = THREE.ACESFilmicToneMapping
  gl.toneMappingExposure = 1
}

// ---------------------------------------------------------------------------
// The day's light by the hour. Key moments, blended: the light's colours are linear (THREE.Color).

type Key = { h: number; sun: string; sunI: number; hemiSky: string; hemiGround: string; hemiI: number; top: string; horizon: string; fog: string; cloud: string; envI: number; exposure: number; glow: number; city: number; warm: number }
const KEYS: Key[] = [
  // Night (the same blue, readable night as before: the moon, the city's glow on the haze; a little
  // more exposure, as the grade's contrast deepens the darks).
  { h: 0, sun: '#8fa8ff', sunI: 0.6, hemiSky: '#7484c4', hemiGround: '#3a3a56', hemiI: 1.35, top: '#04071a', horizon: '#1d2552', fog: '#1d2552', cloud: '#5a6890', envI: 0.15, exposure: 1.12, glow: 0, city: 1, warm: 0 },
  { h: 5.2, sun: '#8fa8ff', sunI: 0.6, hemiSky: '#7484c4', hemiGround: '#3a3a56', hemiI: 1.35, top: '#04071a', horizon: '#1d2552', fog: '#1d2552', cloud: '#5a6890', envI: 0.15, exposure: 1.12, glow: 0, city: 1, warm: 0 },
  // Dawn: the sky pales from the east, pink haze.
  { h: 6, sun: '#ffa070', sunI: 0.9, hemiSky: '#8a94c0', hemiGround: '#5a4a50', hemiI: 0.95, top: '#2e3f7a', horizon: '#e8a080', fog: '#c8968a', cloud: '#f0b8a8', envI: 0.4, exposure: 1, glow: 0.6, city: 0.3, warm: 0.6 },
  // Morning gold.
  { h: 7.3, sun: '#ffc890', sunI: 1.9, hemiSky: '#b8c8dc', hemiGround: '#a07e60', hemiI: 0.85, top: '#3a74b8', horizon: '#f0d0aa', fog: '#e2cfb4', cloud: '#fff0dc', envI: 0.6, exposure: 1.05, glow: 0.8, city: 0, warm: 0.5 },
  // Day: a high, warm-white sun; Abidjan's humid haze pales the horizon.
  { h: 9, sun: '#fff0d8', sunI: 2.5, hemiSky: '#c4d6ee', hemiGround: '#b29470', hemiI: 0.85, top: '#2a72c4', horizon: '#cfe4ee', fog: '#d4e0e2', cloud: '#ffffff', envI: 0.65, exposure: 1.05, glow: 1, city: 0, warm: 0 },
  { h: 15.5, sun: '#fff0d8', sunI: 2.5, hemiSky: '#c4d6ee', hemiGround: '#b29470', hemiI: 0.85, top: '#2a72c4', horizon: '#cfe4ee', fog: '#d4e0e2', cloud: '#ffffff', envI: 0.65, exposure: 1.05, glow: 1, city: 0, warm: 0 },
  // The golden hour: low orange sun, long shadows, blue-teal sky over a warm haze.
  { h: 17.2, sun: '#ffb062', sunI: 2.3, hemiSky: '#a9b8d0', hemiGround: '#a8714a', hemiI: 0.95, top: '#2f5f96', horizon: '#f2b880', fog: '#e6b48a', cloud: '#ffe0c2', envI: 0.7, exposure: 1.18, glow: 0.9, city: 0.1, warm: 1 },
  // Sunset.
  { h: 18.4, sun: '#ff7e45', sunI: 1.5, hemiSky: '#8a8fb8', hemiGround: '#7a5040', hemiI: 0.95, top: '#2a3a78', horizon: '#ff9a62', fog: '#d89878', cloud: '#ffc0a0', envI: 0.55, exposure: 1.15, glow: 0.8, city: 0.3, warm: 1 },
  // Night falls at 19 h (the game's night: the lamps, the windows).
  { h: 19, sun: '#8fa8ff', sunI: 0.6, hemiSky: '#7484c4', hemiGround: '#3a3a56', hemiI: 1.35, top: '#04071a', horizon: '#1d2552', fog: '#1d2552', cloud: '#5a6890', envI: 0.15, exposure: 1.12, glow: 0, city: 1, warm: 0 },
  { h: 24, sun: '#8fa8ff', sunI: 0.6, hemiSky: '#7484c4', hemiGround: '#3a3a56', hemiI: 1.35, top: '#04071a', horizon: '#1d2552', fog: '#1d2552', cloud: '#5a6890', envI: 0.15, exposure: 1.12, glow: 0, city: 1, warm: 0 },
]
const COLORS = ['sun', 'hemiSky', 'hemiGround', 'top', 'horizon', 'fog', 'cloud'] as const
const NUMBERS = ['sunI', 'hemiI', 'envI', 'exposure', 'glow', 'city', 'warm'] as const
const parsed = KEYS.map((k) => ({ h: k.h, c: COLORS.map((n) => new THREE.Color(k[n])), n: NUMBERS.map((n) => k[n]) }))

/** The light now (one shared object, changed in place: no allocation per frame). */
export const daylight = {
  hour: 12,
  sun: new THREE.Color(),
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
  top: new THREE.Color(),
  horizon: new THREE.Color(),
  fog: new THREE.Color(),
  cloud: new THREE.Color(),
  sunI: 1,
  hemiI: 1,
  envI: 0.5,
  exposure: 1,
  glow: 1,
  city: 0,
  warm: 0,
  /** Towards the light (the sun by day, the moon by night), unit. */
  dir: new THREE.Vector3(60, 110, 35).normalize(),
  /** Changes when the light changed enough to draw the environment map again. */
  version: 0,
}
const MOON_DIR = new THREE.Vector3(60, 110, 35).normalize()
const RISE = 6
const SET = 18.9

/** Sets `daylight` for an hour of the day (0..24, with its minutes). */
export function setDaylight(hour: number) {
  const h = ((hour % 24) + 24) % 24
  if (Math.abs(h - daylight.hour) < 1 / 240 && daylight.version) return
  let i = 0
  while (i < parsed.length - 2 && parsed[i + 1].h <= h) i++
  const [a, b] = [parsed[i], parsed[i + 1]]
  const raw = b.h > a.h ? (h - a.h) / (b.h - a.h) : 0
  const f = raw * raw * (3 - 2 * raw)
  COLORS.forEach((n, k) => daylight[n].copy(a.c[k]).lerp(b.c[k], f))
  NUMBERS.forEach((n, k) => (daylight[n] = a.n[k] + (b.n[k] - a.n[k]) * f))
  // The sun's arc: up in the east at 6 h, down in the west before 19 h; Abidjan is near the
  // equator (it passes almost overhead), held lower here so the blocks keep a readable shadow.
  if (h > RISE && h < SET) {
    const t = (h - RISE) / (SET - RISE)
    const elev = Math.max(0.17, Math.sin(Math.PI * t) * 0.8)
    const az = Math.PI * t
    daylight.dir.set(Math.cos(az) * Math.cos(elev), Math.sin(elev), 0.45 * Math.cos(elev)).normalize()
  } else daylight.dir.copy(MOON_DIR)
  const bucket = Math.round(h * 4)
  if (bucket !== Math.round(daylight.hour * 4) || !daylight.version) daylight.version++
  daylight.hour = h
}

// In development, ?heure=17.5 sets the light's hour exactly (?hour= only takes whole hours).
export const HEURE = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('heure') ? Number(new URLSearchParams(location.search).get('heure')) : undefined
