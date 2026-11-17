import { lazy, Suspense, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { featuresKnown, keyOpenNow, onFeatures } from '../lib/features'
import { useLightPhone } from '../lib/lightPhone'
import { serverNow } from '../lib/worldClock'
import { deviceTier, gradeOff, gradeOn, subscribeTier } from './open/lumiere'

// « Mini-jeux réalistes » (the update « minijeux-realistes », the « blocs réalistes » look in the
// played scenes: the sports, the défis' tables, the gestes, the baby's games, the combat, the race).
// One component, <MiniLook>, set inside a scene's Canvas, does it all without touching how the
// scene plays (no geometry, camera, physics or hitbox changes; only how things are lit and shaded):
// - the light: a preset per kind of scene. The outdoor sports follow Abidjan's hour (day, golden
//   hour, night under floodlights); the défis' tables share one warm studio light; the scenes with
//   their own lighting (the combat's stage, the race's sunset, the Palais' hall) keep it;
// - the grade (lumiere.ts), inside the tone mapping, so no extra pass;
// - the blocks' pixel finish (the concept's textures, kit.ts): each surface gets crisp texel noise
//   at a fixed number of texels per metre in the object's own space (it moves with it), the top
//   faces a touch lighter and the undersides darker, and the walls of every block darkened near the
//   floor (a baked, cheap ambient occlusion where the post one is off);
// - on « normal »: the materials become standard ones lit by the preset's sky (environment light,
//   soft reflections on glass, balls and paint);
// - on « haute »: + ambient occlusion and a faint bloom (the floodlights, the lamps), the vignette.
// The Sims are left as they are (their own kit). When it unmounts, every material and light is
// given back exactly as it was. While the update is shut, nothing here runs.

export const MINIJEUX = 'minijeux-realistes'
const HEARD_KEY = 'babi.minijeux.ouvert'

function read(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const open = () => (featuresKnown() ? keyOpenNow(MINIJEUX) : read(HEARD_KEY) === '1')
onFeatures(() => {
  if (!featuresKnown()) return
  try {
    localStorage.setItem(HEARD_KEY, keyOpenNow(MINIJEUX) ? '1' : '0')
  } catch {
    // Private mode: as the server says, once it has.
  }
})

/**
 * How much of it a device draws (the same tiers as « lumière réaliste »).
 * - `simple`: the small phones: the light preset, the grade, the painted textures read texel by texel, the edge and foot shade (per vertex and one smoothstep: no texel noise), the scene's own materials (Lambert) kept, so no frame is lost.
 * - `normal`: + the materials lit by the preset's sky (environment map).
 * - `haute`: + ambient occlusion, bloom, vignette (opaque scenes only).
 */
export type MiniTier = 'off' | 'simple' | 'normal' | 'haute'

// In development, ?minijeux=off|simple|normal|haute forces a tier, ?heure=21 the hour of the outdoor sports.
const Q = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search) : null
const FORCED = (Q?.get('minijeux') as MiniTier | null) ?? null
const HOUR = Q?.get('heure') ? Number(Q.get('heure')) : undefined

function tierOf(light: boolean): MiniTier {
  if (FORCED) return FORCED
  if (!open()) return 'off'
  return deviceTier(light)
}
/** The tier the played scenes draw now (followed: the update can open or shut, the phone go light). */
export function useMiniTier(): MiniTier {
  const light = useLightPhone()
  return useSyncExternalStore(subscribeTier, () => tierOf(light))
}

/* ---------- The presets ---------- */

/** `sport`: outdoors, by the hour. `table`: the défis' shared studio light. `keep`: the scene's own lights. */
export type MiniKind = 'sport' | 'table' | 'keep'
export type MiniPreset = 'jour' | 'dore' | 'nuit' | 'table' | 'keep'

type Preset = {
  /** The key light's colour, its intensity × the scene's, its height above the horizon (degrees; undefined: where the scene put it). */
  sun?: string
  sunK: number
  elev?: number
  /** The sky/ground fill: colours (the ground blended half with the scene's), intensity × the scene's. */
  hemiSky?: string
  hemiGround?: string
  hemiK: number
  ambK: number
  /** The environment map's sky (top, horizon, ground) and its strength. */
  env: [string, string, string]
  envI: number
  exposure: number
  /** Outdoors: the sky dome (top, middle, horizon), the haze and the background. */
  sky?: [string, string, string]
  fog?: string
  bloom: { threshold: number; intensity: number }
  warm: number
}
const PRESETS: Record<MiniPreset, Preset> = {
  // A high, warm-white sun; Abidjan's humid haze pales the horizon (lumiere.ts' day).
  jour: { sun: '#fff0d8', sunK: 1.05, hemiSky: '#c4d6ee', hemiGround: '#b29470', hemiK: 0.95, ambK: 1, env: ['#2a72c4', '#cfe4ee', '#6e5a44'], envI: 0.6, exposure: 1.04, sky: ['#2a72c4', '#86c0ea', '#d4e6ee'], fog: '#d4e4ec', bloom: { threshold: 1.1, intensity: 0.2 }, warm: 0 },
  // The golden hour: low orange sun, long shadows, blue-teal sky over a warm haze.
  dore: { sun: '#ffb062', sunK: 1.1, elev: 17, hemiSky: '#a9b8d0', hemiGround: '#a8714a', hemiK: 1, ambK: 0.9, env: ['#2f5f96', '#f2b880', '#5a3a26'], envI: 0.6, exposure: 1.14, sky: ['#2f5f96', '#9db4cc', '#f2b880'], fog: '#e8b88e', bloom: { threshold: 1.05, intensity: 0.28 }, warm: 1 },
  // Night under the floodlights: white light from high up, the sky deep blue, the lamps glowing.
  nuit: { sun: '#eef2ff', sunK: 0.78, elev: 52, hemiSky: '#7a86c4', hemiGround: '#34344c', hemiK: 0.85, ambK: 0.6, env: ['#04071a', '#1d2552', '#141420'], envI: 0.15, exposure: 1.12, sky: ['#03061a', '#0e1640', '#1d2552'], fog: '#1a2150', bloom: { threshold: 0.72, intensity: 0.8 }, warm: 0 },
  // The défis' tables: a warm key from the front and above, a cream fill, a soft room around.
  table: { sun: '#fff1dc', sunK: 1.02, hemiSky: '#fff3e0', hemiGround: '#7a5a3a', hemiK: 0.85, ambK: 0.95, env: ['#f4ead8', '#e6d4bc', '#6b4a2a'], envI: 0.38, exposure: 0.92, bloom: { threshold: 1.1, intensity: 0.18 }, warm: 0.3 },
  // The scene's own lights; a neutral room for the reflections.
  keep: { sunK: 1, hemiK: 1, ambK: 1, env: ['#9aa6bc', '#8c8478', '#3a3028'], envI: 0.3, exposure: 1, bloom: { threshold: 0.85, intensity: 0.45 }, warm: 0 },
}

/** The hour in Abidjan (UTC, with its minutes). */
const abidjanHour = () => {
  if (HOUR !== undefined) return HOUR
  const d = new Date(serverNow())
  return d.getUTCHours() + d.getUTCMinutes() / 60
}
/** An outdoor match's light by the hour: day, the golden hours, night. */
export function presetAt(hour = abidjanHour()): 'jour' | 'dore' | 'nuit' {
  if (hour >= 6.6 && hour < 16.4) return 'jour'
  if ((hour >= 16.4 && hour < 18.6) || (hour >= 5.9 && hour < 6.6)) return 'dore'
  return 'nuit'
}
/** The preset a kind of scene takes now (read once when the scene opens: a match keeps its light). */
export function usePreset(kind: MiniKind): MiniPreset {
  return useMemo(() => (kind === 'sport' ? presetAt() : kind), [kind])
}

/* ---------- The pixel finish (a shader patch on the scene's own materials) ---------- */

/** Shared by every patched material: one played scene at a time. */
const U = {
  mjTpm: { value: 20 },
  mjAmt: { value: 0.09 },
  mjFoot: { value: 0.32 },
  mjFootH: { value: 0.35 },
  mjFloor: { value: 0 },
  mjNear: { value: 6 },
  mjFar: { value: 26 },
  /** At night: the floodlights' pool (centre x, z, radius) and how dark past it. */
  mjPool: { value: new THREE.Vector3(0, 0, 1e4) },
  mjPoolK: { value: 0 },
}

const VERT_DECL = /* glsl */ `
varying vec3 mjQ;
varying vec3 mjW;
varying vec3 mjF;
uniform float mjTpm;
uniform float mjNear;
uniform float mjFar;
`
// Most of it per vertex (it is linear over a face, or constant on it): the fragment only hashes.
const VERT_MAIN = /* glsl */ `
{
  // The texel grid in the object's own space, in metres (its scale kept, so a texel is the same size
  // on every block), half a texel inside the face (no flicker on the face's own plane).
  vec3 mjS = vec3( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ), length( modelMatrix[ 2 ].xyz ) );
  mjQ = position * mjS * mjTpm - normal * 0.5;
  #ifdef USE_INSTANCING
    mat4 mjM = modelMatrix * instanceMatrix;
  #else
    mat4 mjM = modelMatrix;
  #endif
  vec4 mjWP = mjM * vec4( transformed, 1.0 );
  mjW = mjWP.xyz;
  vec3 mjWN = normalize( mat3( mjM ) * normal );
  // The concept's edge shading (tops a touch lighter, undersides darker), the walls' share of the foot shade, the noise's fade with distance.
  mjF = vec3( 1.0 + 0.03 * step( 0.7, mjWN.y ) - 0.1 * step( 0.7, -mjWN.y ), 1.0 - smoothstep( 0.45, 0.8, abs( mjWN.y ) ), 1.0 - smoothstep( mjNear, mjFar, length( ( viewMatrix * mjWP ).xyz ) ) );
}
`
const FRAG_DECL = /* glsl */ `
varying vec3 mjQ;
varying vec3 mjW;
varying vec3 mjF;
uniform float mjAmt;
uniform float mjFoot;
uniform float mjFootH;
uniform float mjFloor;
uniform vec3 mjPool;
uniform float mjPoolK;
float mjHash( vec3 p3 ) {
  p3 = fract( p3 * 0.1031 );
  p3 += dot( p3, p3.zyx + 31.32 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
`
const FRAG_MAIN = /* glsl */ `
{
  #ifdef USE_MAP
    float mjK = mjAmt * 0.45 * mjF.z;
  #else
    float mjK = mjAmt * mjF.z;
  #endif
  // Texel noise: a cell per texel, and a coarser one for the wear.
  #ifdef MJ_LITE
    // (The small phones: no noise, so not a frame is lost; the painted textures read texel by texel instead.)
    float mjG = 1.0;
  #else
    float mjG = 1.0 + ( ( mjHash( floor( mjQ ) ) - 0.5 ) + ( mjHash( floor( mjQ * 0.25 ) + 17.0 ) - 0.5 ) * 0.7 ) * mjK;
  #endif
  // Edge shading; the walls of every block darker near the floor (baked occlusion).
  mjG *= mjF.x * ( 1.0 - mjFoot * mjF.y * ( 1.0 - smoothstep( 0.0, mjFootH, mjW.y - mjFloor ) ) );
  #ifdef MJ_POOL
    // At night the light falls off past the floodlights' pool (they aim down: the walls darker as they rise, too).
    float mjD = length( vec2( length( mjW.xz - mjPool.xy ), max( mjW.y - 2.0, 0.0 ) * 1.6 ) );
    mjG *= 1.0 - mjPoolK * smoothstep( mjPool.z, mjPool.z * 1.8, mjD );
  #endif
  diffuseColor.rgb *= mjG;
}
`

/** `lite`: the small phones' cheaper noise; `pool`: the night's fall-off compiled in (only at night). */
function patch(m: THREE.Material, lite: boolean, pool: boolean) {
  const defs = `${lite ? '#define MJ_LITE\n' : ''}${pool ? '#define MJ_POOL\n' : ''}`
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U)
    s.fragmentShader = defs + s.fragmentShader
    s.vertexShader = defs + s.vertexShader
    s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>\n${VERT_DECL}`).replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_MAIN}`)
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\n${FRAG_DECL}`).replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_MAIN}`)
  }
  m.customProgramCacheKey = () => `minijeux1${lite ? 'l' : ''}${pool ? 'p' : ''}`
}

/* ---------- Dressing the scene: materials ---------- */

const PLAIN_COMPILE = THREE.Material.prototype.onBeforeCompile

/** A material we can dress: the scene's plain lit ones (not the shaders, the sprites, the unlit ones, or one already patched by its own kit). */
function dressable(m: THREE.Material): m is THREE.MeshLambertMaterial | THREE.MeshStandardMaterial | THREE.MeshPhongMaterial {
  if (m.userData.noMini) return false
  if (!(m instanceof THREE.MeshLambertMaterial || m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhongMaterial)) return false
  return m.onBeforeCompile === PLAIN_COMPILE
}

/** The dressed copy of a material: the same kind on « simple » (no frame lost), a standard one lit by the sky above. */
function dressOf(m: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial | THREE.MeshPhongMaterial, std: boolean, round: boolean, lite: boolean, pool: boolean): THREE.Material {
  let d: THREE.Material
  if (std && !(m instanceof THREE.MeshStandardMaterial)) {
    const glass = m.transparent && m.opacity < 0.75
    const s = new THREE.MeshStandardMaterial({
      color: m.color,
      map: m.map,
      emissive: m.emissive,
      emissiveIntensity: m.emissiveIntensity,
      emissiveMap: m.emissiveMap,
      alphaMap: m.alphaMap,
      transparent: m.transparent,
      opacity: m.opacity,
      alphaTest: m.alphaTest,
      side: m.side,
      vertexColors: m.vertexColors,
      flatShading: m.flatShading,
      depthWrite: m.depthWrite,
      depthTest: m.depthTest,
      fog: m.fog,
      wireframe: m.wireframe,
      polygonOffset: m.polygonOffset,
      polygonOffsetFactor: m.polygonOffsetFactor,
      polygonOffsetUnits: m.polygonOffsetUnits,
      // Glass and the balls (a round thing alone: the ball, a fruit) catch the sky; the rest is matt paint, wood, earth.
      roughness: glass ? 0.12 : round ? 0.42 : 0.82,
      metalness: 0,
    })
    s.name = m.name
    d = s
  } else d = m.clone()
  d.userData = { mjOf: m }
  patch(d, lite, pool)
  return d
}

/** What a dressed material keeps following of its original each frame (a prop's colour that changes, its glow, its fading). */
function follow(d: THREE.Material, m: THREE.Material) {
  const dm = d as THREE.MeshStandardMaterial
  const om = m as THREE.MeshLambertMaterial
  dm.color.copy(om.color)
  dm.emissive.copy(om.emissive)
  dm.emissiveIntensity = om.emissiveIntensity
  d.opacity = m.opacity
  d.visible = m.visible
  if (dm.map !== om.map) {
    if (!dm.map !== !om.map) d.needsUpdate = true
    dm.map = om.map
  }
  if (d.transparent !== m.transparent) {
    d.transparent = m.transparent
    d.needsUpdate = true
  }
}

/** Under a Sim: left alone (the Sims have their own kit). */
function inHuman(o: THREE.Object3D) {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.name === 'human' || p.userData.noMini) return true
  return false
}

type Dressed = { mesh: THREE.Mesh; was: THREE.Material | THREE.Material[]; now: THREE.Material | THREE.Material[] }

/** The painted grounds and walls read texel by texel up close, like the concept's (their filter given back after). */
const crisped = new Map<THREE.Texture, THREE.MagnificationTextureFilter>()
function crisp(m: THREE.Material) {
  const t = (m as THREE.MeshLambertMaterial).map
  if (!t || crisped.has(t) || !(t as THREE.CanvasTexture).isCanvasTexture || t.magFilter === THREE.NearestFilter) return
  crisped.set(t, t.magFilter)
  t.magFilter = THREE.NearestFilter
  t.needsUpdate = true
}
function uncrisp() {
  crisped.forEach((f, t) => {
    t.magFilter = f
    t.needsUpdate = true
  })
  crisped.clear()
}

/* ---------- The component ---------- */

const MiniPost = lazy(() => import('./effects').then((m) => ({ default: m.MiniPost })))

/**
 * The look of a played scene, set inside its Canvas (anywhere: it works on the whole scene).
 * `kind`: see MiniKind. `floor`: the height of the ground the blocks stand on (their foot shade).
 * `tpm`: texels per metre of the pixel finish (the tables' props are ~1 unit: more). `post`: false
 * where the canvas is see-through (the défis' squares over their panel: no post pass there).
 */
export function MiniLook({ tier, preset, floor = 0, tpm = 16, amt = 0.11, near = 10, far = 40, post = true, pool }: { tier: MiniTier; preset: MiniPreset; /** At night: the lit ground's centre (x, z) and radius; past it the light falls off. */ pool?: [number, number, number]; floor?: number; tpm?: number; /** How strong the texel noise is. */ amt?: number; /** From `near` to `far` (m from the camera) the noise fades out (no shimmer far away). */ near?: number; far?: number; post?: boolean }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const P = PRESETS[preset]
  const std = tier === 'normal' || tier === 'haute'
  const usePost = tier === 'haute' && post
  const night = preset === 'nuit' && !!pool
  const dressed = useRef<Dressed[]>([])
  const seen = useRef(new WeakSet<THREE.Object3D>())
  const lights = useRef<{ l: THREE.Light; restore: () => void }[]>([])
  const since = useRef(1)
  const scanRef = useRef<(() => void) | null>(null)

  // The environment: the preset's sky blurred, drawn once.
  const envTex = useMemo(() => {
    if (!std) return null
    const pm = new THREE.PMREMGenerator(gl)
    const s = new THREE.Scene()
    const [top, horizon, ground] = P.env.map((c) => new THREE.Color(c))
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { top: { value: top }, horizon: { value: horizon }, ground: { value: ground } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; varying vec3 vDir; void main() { vec3 d = normalize(vDir); vec3 c = d.y > 0.0 ? mix(horizon, top, pow(d.y, 0.55)) : mix(horizon, ground, clamp(-d.y * 4.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }',
    })
    const geo = new THREE.SphereGeometry(50, 24, 12)
    s.add(new THREE.Mesh(geo, mat))
    const rt = pm.fromScene(s, 0, 0.1, 100, { size: 64 })
    mat.dispose()
    geo.dispose()
    pm.dispose()
    return rt
  }, [std, gl, P])

  useEffect(() => {
    U.mjTpm.value = tpm
    U.mjFloor.value = floor
    U.mjAmt.value = amt
    U.mjNear.value = near
    U.mjFar.value = far
    if (pool) U.mjPool.value.set(...pool)
    U.mjPoolK.value = night ? 0.78 : 0
  }, [tpm, floor, amt, near, far, preset, pool])

  useEffect(() => {
    const had = { env: scene.environment, envI: scene.environmentIntensity, bg: scene.background instanceof THREE.Color ? scene.background.clone() : null, fog: scene.fog ? scene.fog.color.clone() : null }
    if (envTex) {
      scene.environment = envTex.texture
      scene.environmentIntensity = P.envI
    }
    const list = dressed.current
    const lit = lights.current
    const skies: { u: Record<string, THREE.IUniform>; was: THREE.Color[] }[] = []
    const indoor = preset === 'keep' || preset === 'table'

    // Dresses what isn't yet: run now and every half second (the props come and go).
    const scan = () => {
      scene.traverse((o) => {
        if (seen.current.has(o)) return
        // A light: retuned by the preset, kept to give back.
        if ((o as THREE.Light).isLight) {
          seen.current.add(o)
          lit.push({ l: o as THREE.Light, restore: tune(o as THREE.Light, P, !!envTex) })
          return
        }
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) {
          seen.current.add(o)
          return
        }
        const mat = mesh.material
        // The outdoor sky dome (streetball's Sky: a shader with top/mid/low): the preset's colours.
        if (!indoor && P.sky && mat instanceof THREE.ShaderMaterial && mat.uniforms.top && mat.uniforms.mid && mat.uniforms.low) {
          seen.current.add(o)
          const u = mat.uniforms
          skies.push({ u, was: [u.top.value.clone(), u.mid.value.clone(), u.low.value.clone()] })
          ;(['top', 'mid', 'low'] as const).forEach((k, i) => u[k].value.set(P.sky![i]))
          return
        }
        if (inHuman(o)) {
          seen.current.add(o)
          return
        }
        const arr = Array.isArray(mat) ? mat : [mat]
        if (!arr.some(dressable)) {
          seen.current.add(o)
          return
        }
        seen.current.add(o)
        const g = mesh.geometry as THREE.BufferGeometry & { type: string }
        const round = g.type === 'SphereGeometry'
        const now = arr.map((m) => (dressable(m) ? dressOf(m, std, round, tier === 'simple', night) : m))
        arr.forEach((m) => dressable(m) && crisp(m))
        list.push({ mesh, was: mat, now: Array.isArray(mat) ? now : now[0] })
        mesh.material = Array.isArray(mat) ? now : now[0]
      })
    }
    scan()
    scanRef.current = scan
    if (!indoor && P.fog && scene.fog) scene.fog.color.set(P.fog)
    if (!indoor && P.sky && scene.background instanceof THREE.Color) scene.background.set(P.fog ?? P.sky[2])
    return () => {
      scanRef.current = null
      for (const d of list) {
        // React may have given the mesh a new material since: only ours is taken back.
        if (d.mesh.material === d.now) d.mesh.material = d.was
        ;(Array.isArray(d.now) ? d.now : [d.now]).forEach((m) => m.userData.mjOf && m.dispose())
      }
      list.length = 0
      uncrisp()
      for (const { restore } of lit) restore()
      lit.length = 0
      for (const s of skies) (['top', 'mid', 'low'] as const).forEach((k, i) => s.u[k].value.copy(s.was[i]))
      seen.current = new WeakSet()
      scene.environment = had.env
      scene.environmentIntensity = had.envI
      if (had.bg && scene.background instanceof THREE.Color) scene.background.copy(had.bg)
      if (had.fog && scene.fog) scene.fog.color.copy(had.fog)
    }
  }, [scene, envTex, P, preset, std, tier, night])
  useEffect(() => () => envTex?.dispose(), [envTex])
  // The renderer's curve back to plain ACES when the scene goes.
  useEffect(() => () => gradeOff(gl), [gl])

  useFrame((_, dt) => {
    // New things are dressed before their first frame (no pop): every frame where props come and go
    // (the défis), every half second on the big still grounds (the sports: only the Sims move there).
    since.current += dt
    if (preset === 'table' || preset === 'keep' || since.current > 0.5) {
      since.current = 0
      scanRef.current?.()
    }
    // The dressed materials follow their originals (a colour that changes with the play, a fade).
    const list = dressed.current
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i]
      // Gone from the scene (a prop caught, a dish served): its copy freed, the mesh given back as it was.
      let top: THREE.Object3D = d.mesh
      while (top.parent) top = top.parent
      if (top !== scene && d.mesh.material === d.now) d.mesh.material = d.was
      if (d.mesh.material !== d.now) {
        // React replaced it (a new material): dressed again at the next scan.
        if (Array.isArray(d.now)) d.now.forEach((m) => m.userData.mjOf && m.dispose())
        else if (d.now.userData.mjOf) d.now.dispose()
        seen.current.delete(d.mesh)
        list.splice(i, 1)
        continue
      }
      if (Array.isArray(d.now)) d.now.forEach((m) => m.userData.mjOf && follow(m, m.userData.mjOf))
      else follow(d.now, d.now.userData.mjOf)
    }
    // (With the post pass, the composer does the curve and the grade itself.)
    if (!usePost) gradeOn(gl, P.exposure)
  })

  return usePost ? (
    <Suspense fallback={null}>
      <MiniPost exposure={P.exposure} warm={P.warm * 0.35} bloom={P.bloom} />
    </Suspense>
  ) : null
}

/** <MiniLook> with the tier read here: one line in a scene's Canvas, nothing at all while the update is shut. */
export function MiniScene({ kind, ...rest }: { kind: MiniKind } & Omit<Parameters<typeof MiniLook>[0], 'tier' | 'preset'>) {
  const tier = useMiniTier()
  const preset = usePreset(kind)
  return tier === 'off' ? null : <MiniLook tier={tier} preset={preset} {...rest} />
}

const tmpV = new THREE.Vector3()
/** Retunes a light by the preset; returns how to give it back. */
function tune(l: THREE.Light, P: Preset, env: boolean): () => void {
  const was = { color: l.color.clone(), intensity: l.intensity }
  if (l instanceof THREE.HemisphereLight) {
    const ground = l.groundColor.clone()
    if (P.hemiSky) l.color.set(P.hemiSky)
    if (P.hemiGround) l.groundColor.lerp(new THREE.Color(P.hemiGround), 0.5)
    // Less of the fill where the sky's environment lights already.
    l.intensity *= P.hemiK * (env ? 1 - P.envI * 0.5 : 1)
    return () => {
      l.color.copy(was.color)
      l.groundColor.copy(ground)
      l.intensity = was.intensity
    }
  }
  if (l instanceof THREE.DirectionalLight) {
    const pos = l.position.clone()
    if (P.sun) l.color.set(P.sun)
    l.intensity *= P.sunK
    if (P.elev !== undefined) {
      // The same side of the sky, at the preset's height.
      tmpV.copy(l.position).sub(l.target.position)
      const len = tmpV.length()
      const az = Math.atan2(tmpV.z, tmpV.x)
      const e = THREE.MathUtils.degToRad(P.elev)
      l.position.set(Math.cos(az) * Math.cos(e) * len, Math.sin(e) * len, Math.sin(az) * Math.cos(e) * len).add(l.target.position)
    }
    return () => {
      l.color.copy(was.color)
      l.intensity = was.intensity
      l.position.copy(pos)
    }
  }
  if (l instanceof THREE.AmbientLight) {
    l.intensity *= P.ambK * (env ? 1 - P.envI * 0.5 : 1)
    return () => void (l.intensity = was.intensity)
  }
  return () => undefined
}

/* ---------- Night: floodlights round a ground ---------- */

const mastMat = new THREE.MeshLambertMaterial({ color: '#5b616b' })
const headMat = new THREE.MeshBasicMaterial({ color: '#fffbea' })
headMat.userData.noMini = true
const MAST_BOX = new THREE.BoxGeometry(1, 1, 1)

/**
 * Four floodlight masts at the corners of a ground hx × hz (half sizes), for the street grounds at
 * night (the stadium and the city court have their own): a steel pole, a frame, four lamps facing
 * the middle, glowing (they bloom on « haute »). Their light is the preset's key light from above.
 */
export function Floodlights({ hx, hz, h = 8, far }: { hx: number; hz: number; h?: number; /** Only the two far corners (a court the camera looks into from the near side). */ far?: boolean }) {
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        (far ? [-1] : [-1, 1]).map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * (hx + 0.9), 0, sz * (hz + 0.9)]} rotation={[0, Math.atan2(-sx, -sz), 0]}>
            <mesh geometry={MAST_BOX} material={mastMat} position={[0, h / 2, 0]} scale={[0.16, h, 0.16]} castShadow />
            <mesh geometry={MAST_BOX} material={mastMat} position={[0, h, 0.12]} scale={[1.5, 0.1, 0.1]} />
            <mesh geometry={MAST_BOX} material={mastMat} position={[0, h + 0.45, 0.12]} scale={[1.5, 0.1, 0.1]} />
            {[-0.5, 0.5].flatMap((x) =>
              [0.22, 0.67].map((y) => (
                <group key={`${x}${y}`} position={[x, h + y, 0.22]} rotation={[0.45, 0, 0]}>
                  <mesh geometry={MAST_BOX} material={mastMat} scale={[0.42, 0.34, 0.14]} />
                  <mesh geometry={MAST_BOX} material={headMat} position={[0, 0, 0.075]} scale={[0.34, 0.26, 0.02]} />
                </group>
              )),
            )}
          </group>
        )),
      )}
    </group>
  )
}
