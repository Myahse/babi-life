import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { featuresKnown, keyOpenNow, onFeatures } from '../../lib/features'
import { useLightPhone } from '../../lib/lightPhone'
import { serverNow, worldTime } from '../../lib/worldClock'
import { Pirogue } from './boats'
import { pointInRing, type XZ } from './geo'
import { useCellsAround } from './shared'
import { daylight, deviceTier, HEURE, setDaylight, subscribeTier, type LumiereTier } from './lumiere'

// « Eau réaliste » (the update « eau-realiste », a step of the « blocs réalistes » look, concept
// in the lab's water.ts): the lagoon and the sea drawn as water, not as a blue floor. Fresnel
// (the water shows its own deep green looking down, the sky and the far bank at a grazing angle),
// ripples from a normal map that drift, read in 25 cm squares near the camera so the water keeps
// the world's blocky grain (smooth further off), the sun's glint and its path at the golden hour,
// the city's lights in streaks at night, a choppier grey in the rain. Colours follow the light's
// clock (lumiere.ts). One shader for the whole lagoon; on the high tier it also reflects the
// world itself (a mirror drawn at a fraction of the screen's size, only while water is in view).
// While the update is shut, nothing here runs and the water is drawn as it always was.

export const EAU = 'eau-realiste'
const HEARD_KEY = 'babi.eau.ouvert'

/**
 * How much of it a device draws, the light's tiers (lumiere.ts `deviceTier`):
 * - `simple` (small phones, « Téléphone léger »): the water as before;
 * - `normal`: the shader, the sky reflected (computed, no extra pass);
 * - `haute`: + the world reflected in a mirror pass at reduced size.
 */
export type EauTier = LumiereTier

function read(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const open = () => (featuresKnown() ? keyOpenNow(EAU) : read(HEARD_KEY) === '1')
onFeatures(() => {
  if (!featuresKnown()) return
  try {
    localStorage.setItem(HEARD_KEY, keyOpenNow(EAU) ? '1' : '0')
  } catch {
    // Private mode: as the server says, once it has.
  }
})

// In development, ?eau=off|simple|normal|haute forces a tier (to compare them).
const FORCED = import.meta.env.DEV && typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('eau') as EauTier | null) : null

/** The water's tier now (followed: the update can open, the phone go light, « haute » be dropped). */
export function useEau(): EauTier {
  const light = useLightPhone()
  return useSyncExternalStore(subscribeTier, () => FORCED ?? (open() ? deviceTier(light) : 'off'))
}

// ---------------------------------------------------------------------------
// The ripples: a sum of waves with whole numbers of periods across the tile (so it tiles), as a
// normal map. Made once, the first time the water is drawn this way.

let ripples: THREE.Texture | null = null
function rippleMap() {
  if (ripples) return ripples
  const N = 128
  const c = document.createElement('canvas')
  c.width = c.height = N
  const g = c.getContext('2d')!
  const img = g.createImageData(N, N)
  let seed = 11
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const waves: [number, number, number, number][] = []
  for (let i = 0; i < 14; i++) waves.push([1 + Math.floor(r() * 7), Math.floor((r() - 0.5) * 9), r() * Math.PI * 2, 0.5 + r()])
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let [dx, dy] = [0, 0]
      for (const [fx, fy, ph, a] of waves) {
        const d = Math.cos(((fx * x + fy * y) / N) * Math.PI * 2 + ph) * a
        dx += d * fx
        dy += d * fy
      }
      const [nx, ny] = [-dx * 0.03, -dy * 0.03]
      const l = Math.hypot(nx, ny, 1)
      const i = (y * N + x) * 4
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255
      img.data[i + 2] = (0.5 / l + 0.5) * 255
      img.data[i + 3] = 255
    }
  g.putImageData(img, 0, 0)
  ripples = new THREE.CanvasTexture(c)
  ripples.wrapS = ripples.wrapT = THREE.RepeatWrapping
  ripples.anisotropy = 4
  return ripples
}

// ---------------------------------------------------------------------------
// The shader. Lit by the scene's own lights only for the sun's shadow on the water (the bridges',
// the boats'); the rest from uniforms set by the hour.

const VERT = /* glsl */ `
varying vec3 vWorld;
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <logdepthbuf_vertex>
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  #include <fog_vertex>
  vWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
}
`

const FRAG = /* glsl */ `
uniform float uTime;
uniform sampler2D uNormals;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunCol;
uniform vec3 uSunDir;
uniform float uGlow;
uniform float uCity;
uniform vec3 uBody;
uniform vec3 uAmb;
uniform float uChop;
uniform float uGrain;
#ifdef MIRROR
uniform sampler2D uMirror;
uniform mat4 uMirrorMatrix;
#endif
varying vec3 vWorld;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

// The sky as the dome draws it (sky.tsx), the sun's disc left to the glint.
vec3 eauSky( vec3 d ) {
  float h = clamp( d.y, 0.0, 1.0 );
  vec3 c = mix( uHorizon, uTop, pow( h, 0.55 ) );
  float s = max( dot( d, uSunDir ), 0.0 );
  c += uGlow * pow( s, 6.0 ) * vec3( 0.25, 0.2, 0.1 );
  float low = 1.0 - clamp( d.y * 5.0, 0.0, 1.0 );
  c += uCity * low * low * vec3( 0.42, 0.2, 0.08 );
  return c;
}
float eauHash( float n ) { return fract( sin( n * 127.1 ) * 43758.5453 ); }

void main() {
  #include <logdepthbuf_fragment>
  vec3 toEye = cameraPosition - vWorld;
  float dist = length( toEye );
  vec3 V = toEye / dist;
  // Near the camera the ripples are read at the middle of 25 cm squares: the water in blocks.
  vec2 w = vWorld.xz * uGrain;
  float smoothOut = smoothstep( 22.0, 60.0, dist );
  vec2 p = mix( ( floor( w * 4.0 ) + 0.5 ) * 0.25, w, smoothOut );
  // Two layers that drift across each other (the second turned), a third, finer, in the rain;
  // the mip level from the unsquared position (no seams at the squares' edges).
  vec2 dx = dFdx( w );
  vec2 dy = dFdy( w );
  mat2 turn = mat2( 0.8, 0.6, -0.6, 0.8 );
  vec2 a = p * 0.09 + vec2( uTime * 0.021, uTime * 0.013 );
  vec2 b = turn * p * 0.23 - vec2( uTime * 0.017, -uTime * 0.029 );
  vec2 s1 = textureGrad( uNormals, a, dx * 0.09, dy * 0.09 ).xy * 2.0 - 1.0;
  vec2 s2 = textureGrad( uNormals, b, turn * dx * 0.23, turn * dy * 0.23 ).xy * 2.0 - 1.0;
  vec2 slope = s1 + s2 * 0.6;
  if ( uChop > 0.01 ) {
    vec2 c = turn * turn * p * 0.61 + vec2( uTime * 0.053, uTime * 0.041 );
    slope += ( textureGrad( uNormals, c, turn * turn * dx * 0.61, turn * turn * dy * 0.61 ).xy * 2.0 - 1.0 ) * uChop;
  }
  // Calmer far off (a glassy lagoon to the horizon, and no shimmer of sub-pixel ripples).
  slope *= mix( 0.55, 0.9, uChop ) * mix( 1.0, 0.35, smoothstep( 40.0, 900.0, dist ) );
  // Larger squares (a mini-game seen close up) lie flatter too: calm water, not a mosaic.
  slope *= 0.3 + 0.7 * min( uGrain, 1.0 );
  vec3 N = normalize( vec3( -slope.x, 1.0, -slope.y ) );
  vec3 R = reflect( -V, N );
  R.y = abs( R.y );
  float cosT = clamp( dot( N, V ), 0.0, 1.0 );
  float fres = 0.02 + 0.98 * pow( 1.0 - cosT, 5.0 );
  vec3 refl = eauSky( R );
  #ifdef MIRROR
  // The world reflected (the mirror pass), its picture moved by the ripples.
  vec4 mq = uMirrorMatrix * vec4( vWorld.x, 0.0, vWorld.z, 1.0 );
  vec2 muv = clamp( mq.xy / mq.w + slope * 0.035, 0.001, 0.999 );
  refl = texture2D( uMirror, muv ).rgb;
  #endif
  float lit = getShadowMask();
  // The lagoon's own colour, lit from above: the sky's light, the sun's (in the shadow of a bridge, less).
  vec3 body = uBody * ( uAmb + uSunCol * max( uSunDir.y, 0.0 ) * mix( 0.35, 1.0, lit ) );
  vec3 col = mix( body, refl, fres );
  // The sun's glint: a sharp sparkle on each facing ripple (in squares, near) and a softer path.
  float sd = max( dot( R, uSunDir ), 0.0 );
  col += uSunCol * ( pow( sd, 900.0 ) * 30.0 + pow( sd, 80.0 ) * 0.35 ) * lit * ( 1.0 - 0.85 * uChop );
  // At night the city's lights in long streaks on the far water, here and there, flickering with the ripples.
  float city = smoothstep( 0.4, 1.0, uCity );
  if ( city > 0.0 ) {
    float cell = floor( atan( R.z, R.x ) * 150.0 );
    float on = step( 0.84, eauHash( cell ) );
    vec3 lc = mix( vec3( 1.0, 0.5, 0.16 ), vec3( 1.0, 0.86, 0.62 ), eauHash( cell + 7.0 ) );
    col += city * on * smoothstep( 0.2, 0.0, R.y ) * lc * ( 0.55 + 0.45 * sin( uTime * 2.3 + cell ) ) * 0.8;
  }
  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`

/** The lagoon's own colour (sRGB): the Ébrié's deep green, a little bluer out at sea. */
const BODY = new THREE.Color('#1d4f4c')
const RAIN_BODY = new THREE.Color('#3a4448')

// ---------------------------------------------------------------------------
// The mirror (high tier): the world drawn upside down from under the water's plane into a small
// target, every other frame, from inside the main render as the water is about to be drawn (three's
// Reflector, for a horizontal plane at a fixed height).

class Mirror {
  target = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType, samples: 0 })
  camera = new THREE.PerspectiveCamera()
  matrix = new THREE.Matrix4()
  private plane = new THREE.Plane()
  private clip = new THREE.Vector4()
  private q = new THREE.Vector4()
  private v = new THREE.Vector3()
  private look = new THREE.Vector3()
  private eye = new THREE.Vector3()
  private rot = new THREE.Matrix4()
  private size = new THREE.Vector2()
  private normal = new THREE.Vector3(0, 1, 0)
  /** The frame it was last drawn for. */
  frame = -9
  constructor(
    readonly height: number,
    readonly scale: number,
  ) {
    this.target.texture.generateMipmaps = false
  }
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, hide: THREE.Material[]) {
    renderer.getDrawingBufferSize(this.size)
    const [w, h] = [Math.max(64, Math.round(this.size.x * this.scale)), Math.max(64, Math.round(this.size.y * this.scale))]
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h)
    const { camera: cam, v, look, eye, rot, normal } = this
    eye.setFromMatrixPosition(camera.matrixWorld)
    if (eye.y <= this.height) return
    // The camera's place and aim, mirrored in the plane.
    v.set(eye.x, 2 * this.height - eye.y, eye.z)
    rot.extractRotation(camera.matrixWorld)
    look.set(0, 0, -1).applyMatrix4(rot).add(eye)
    look.y = 2 * this.height - look.y
    cam.position.copy(v)
    cam.up.set(0, 1, 0).applyMatrix4(rot)
    cam.up.y = -cam.up.y
    cam.lookAt(look)
    cam.far = (camera as THREE.PerspectiveCamera).far
    cam.updateMatrixWorld()
    cam.projectionMatrix.copy(camera.projectionMatrix)
    this.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
    this.matrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse)
    // An oblique near plane on the water: nothing under it is drawn (terathon.com/code/oblique.html).
    this.plane.setFromNormalAndCoplanarPoint(normal, v.set(0, this.height, 0)).applyMatrix4(cam.matrixWorldInverse)
    const { clip, q } = this
    clip.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant)
    const e = cam.projectionMatrix.elements
    q.set((Math.sign(clip.x) + e[8]) / e[0], (Math.sign(clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14])
    clip.multiplyScalar(2 / clip.dot(q))
    e[2] = clip.x
    e[6] = clip.y
    e[10] = clip.z + 1
    e[14] = clip.w
    // Drawn without the water (it would read its own target) nor the shore's foam, and without new shadows.
    const was = hide.map((m) => m.visible)
    hide.forEach((m) => (m.visible = false))
    const before = renderer.getRenderTarget()
    const shadows = renderer.shadowMap.autoUpdate
    renderer.shadowMap.autoUpdate = false
    renderer.setRenderTarget(this.target)
    renderer.state.buffers.depth.setMask(true)
    if (!renderer.autoClear) renderer.clear()
    renderer.render(scene, cam)
    renderer.shadowMap.autoUpdate = shadows
    renderer.setRenderTarget(before)
    hide.forEach((m, i) => (m.visible = was[i]))
  }
  dispose() {
    this.target.dispose()
  }
}

/** The water's materials for the near chunks and the horizon's (only drawn where no near chunk is: OpenWorld's stencil), sharing their uniforms. */
export type EauMaterials = { near: THREE.ShaderMaterial; far: THREE.ShaderMaterial; mirror: Mirror | null }

function makeEau(tier: EauTier): EauMaterials | null {
  if (tier === 'off' || tier === 'simple') return null
  const mirror = tier === 'haute' ? new Mirror(0.02, 0.35) : null
  const uniforms = {
    ...THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog]),
    uTime: { value: 0 },
    uNormals: { value: rippleMap() },
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunCol: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uGlow: { value: 1 },
    uCity: { value: 0 },
    uBody: { value: BODY.clone() },
    uAmb: { value: new THREE.Color() },
    uChop: { value: 0 },
    // The near squares' and ripples' scale (1: 25 cm; a mini-game seen close up draws them larger: mondesNature.tsx EauScene).
    uGrain: { value: 1 },
    uMirror: { value: mirror?.target.texture ?? null },
    uMirrorMatrix: { value: mirror?.matrix ?? new THREE.Matrix4() },
  }
  const near = new THREE.ShaderMaterial({ name: 'eau', uniforms, vertexShader: VERT, fragmentShader: FRAG, lights: true, fog: true, defines: mirror ? { MIRROR: '' } : {} })
  const far = near.clone()
  far.uniforms = uniforms
  Object.assign(far, { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilWriteMask: 0, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp })
  return { near, far, mirror }
}

/** The water's materials for this tier (null: the water as before). */
export function useEauMaterials(tier: EauTier) {
  const eau = useMemo(() => makeEau(tier), [tier])
  useEffect(
    () => () => {
      eau?.near.dispose()
      eau?.far.dispose()
      eau?.mirror?.dispose()
    },
    [eau],
  )
  return eau
}

const grey = new THREE.Color()
const tmp = new THREE.Color()

/**
 * Keeps the water's uniforms with the hour (the light's clock: lumiere.ts), the rain, and on the
 * high tier draws its mirror as the water is about to be drawn. With « lumière réaliste » shut,
 * it moves the light's clock itself (the water's colours need it; nothing else reads it then).
 */
export function EauRig({ eau, hour, rain, ownClock, foam }: { eau: EauMaterials; hour: number; rain: boolean; /** « Lumière réaliste » is shut: its clock isn't running. */ ownClock: boolean; /** The shore's foam: tinted by the hour, kept out of the mirror. */ foam: THREE.MeshBasicMaterial[] }) {
  const hourRef = useRef(hour)
  hourRef.current = hour
  const since = useRef(1)
  const chop = useRef(rain ? 1 : 0)
  const time = useRef(0)
  const frame = useRef(0)
  // The mirror, drawn when a water mesh is about to be drawn (none in view: none drawn).
  useEffect(() => {
    const { mirror, near, far } = eau
    if (!mirror) return
    const hide = [near, far, ...foam]
    const draw = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => {
      // Every other frame (half the cost; the ripples hide the frame's lag).
      if (frame.current - mirror.frame < 2 || !(camera as THREE.PerspectiveCamera).isPerspectiveCamera) return
      mirror.frame = frame.current
      mirror.render(renderer, scene, camera, hide)
    }
    near.onBeforeRender = draw
    far.onBeforeRender = draw
    return () => {
      near.onBeforeRender = () => {}
      far.onBeforeRender = () => {}
    }
  }, [eau, foam])
  // The foam back to its own colour when the water goes back to the old one.
  useEffect(
    () => () =>
      foam.forEach((m) => {
        if (!m.userData.eauColor) return
        m.color.copy(m.userData.eauColor as THREE.Color)
        delete m.userData.eauColor
      }),
    [foam],
  )
  useFrame((_, dt) => {
    frame.current++
    since.current += dt
    if (ownClock && since.current >= 1) {
      since.current = 0
      setDaylight(HEURE ?? hourRef.current + new Date(serverNow()).getUTCMinutes() / 60)
    }
    const d = Math.min(dt, 0.1)
    chop.current += ((rain ? 1 : 0) - chop.current) * Math.min(1, d * 0.5)
    const c = chop.current
    // Faster in the rain; wrapped at 1000 s, where every layer's drift is a whole number of tiles.
    time.current = (time.current + d * (1 + c * 1.2)) % 1000
    const u = eau.near.uniforms
    u.uTime.value = time.current
    u.uChop.value = c
    grey.copy(daylight.fog)
    u.uTop.value.copy(daylight.top).lerp(grey, 0.55 * c)
    u.uHorizon.value.copy(daylight.horizon).lerp(grey, 0.55 * c)
    const night = daylight.city > 0.5
    // The sun (by night the moon, fainter); under the rain's clouds, hardly.
    u.uSunCol.value.copy(daylight.sun).multiplyScalar(daylight.sunI * (night ? 0.35 : 1) * (1 - 0.85 * c))
    u.uSunDir.value.copy(daylight.dir)
    u.uGlow.value = daylight.glow * (1 - c)
    u.uCity.value = daylight.city
    u.uAmb.value.copy(daylight.hemiSky).multiplyScalar(daylight.hemiI * (night ? 0.25 : 0.6))
    u.uBody.value.copy(BODY).lerp(RAIN_BODY, c)
    // The foam takes the light's colour (orange at the golden hour, blue-grey at night).
    for (const m of foam) {
      if (!m.userData.eauColor) m.userData.eauColor = m.color.clone()
      m.color.copy(tmp.set('#ffffff').lerp(daylight.sun, 0.35)).multiplyScalar(night ? 0.55 : 1)
    }
  })
  return null
}

// ---------------------------------------------------------------------------
// Fishing pirogues near the bank: a few, still on the water, rocking, a fisherman with his net.
// Where the near chunks have a shore within a few hundred metres of the Sim; the same spots on
// every screen (from where the shore is).

const PIROGUES = 3
const hash2 = (x: number, z: number) => {
  const h = Math.sin(Math.round(x) * 12.9898 + Math.round(z) * 78.233) * 43758.5453
  return h - Math.floor(h)
}

export function ShorePirogues({ water, focus }: { water: XZ[][][]; focus: React.RefObject<XZ> }) {
  const cells = useCellsAround(focus, 200, 1)
  const spots = useMemo(() => {
    if (!water.length || !cells.length) return []
    const boxes = water.map((rings) => {
      let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity]
      for (const [x, z] of rings[0]) [x0, z0, x1, z1] = [Math.min(x0, x), Math.min(z0, z), Math.max(x1, x), Math.max(z1, z)]
      return { rings, x0, z0, x1, z1 }
    })
    const wet = (x: number, z: number) => boxes.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && pointInRing([x, z], b.rings[0]) && !b.rings.slice(1).some((h) => pointInRing([x, z], h)))
    const [cx, cz] = [(cells[0].x0 + cells[cells.length - 1].x0) / 2 + 100, (cells[0].z0 + cells[cells.length - 1].z0) / 2 + 100]
    const found: { x: number; z: number; r: number; k: number; seed: number }[] = []
    for (const { rings } of boxes)
      for (let i = 0; i < rings[0].length; i++) {
        const [a, b] = [rings[0][i], rings[0][(i + 1) % rings[0].length]]
        const len = Math.hypot(b[0] - a[0], b[1] - a[1])
        const [mx, mz] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        if (len < 6 || Math.hypot(mx - cx, mz - cz) > 280) continue
        const k = hash2(mx, mz)
        if (k > 0.35) continue
        // Out on the water, 14 m from a real bank (land on the other side, not a chunk's edge).
        const [nx, nz] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]
        for (const s of [1, -1]) {
          const [x, z] = [mx + nx * s * 14, mz + nz * s * 14]
          if (!wet(x, z) || wet(mx - nx * s * 6, mz - nz * s * 6) || !wet(x + nx * s * 8, z + nz * s * 8) || !wet(x + (b[0] - a[0]) / len * 6, z + (b[1] - a[1]) / len * 6) || !wet(x - (b[0] - a[0]) / len * 6, z - (b[1] - a[1]) / len * 6)) continue
          found.push({ x, z, r: Math.atan2(b[0] - a[0], b[1] - a[1]) + (k - 0.17) * 1.2, k, seed: k * 100 })
          break
        }
      }
    found.sort((p, q) => p.k - q.k)
    const out: typeof found = []
    for (const f of found) if (out.length < PIROGUES && out.every((o) => Math.hypot(o.x - f.x, o.z - f.z) > 60)) out.push(f)
    return out
  }, [water, cells])
  return (
    <>
      {spots.map((p) => (
        <Rocking key={`${p.x | 0},${p.z | 0}`} at={p} />
      ))}
    </>
  )
}

function Rocking({ at }: { at: { x: number; z: number; r: number; seed: number } }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const grp = g.current
    if (!grp) return
    const t = worldTime() % 1000
    grp.position.set(at.x, 0.04 + Math.sin(t * 1.1 + at.seed) * 0.06, at.z)
    grp.rotation.set(Math.sin(t * 0.8 + at.seed) * 0.025, at.r + Math.sin(t * 0.13 + at.seed) * 0.08, Math.sin(t * 1.3 + at.seed * 2) * 0.06)
  })
  return (
    <group ref={g} position={[at.x, 0.04, at.z]} rotation={[0, at.r, 0]}>
      <Pirogue motor={false} fishing />
    </group>
  )
}
