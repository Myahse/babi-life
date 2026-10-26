import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rng } from '../world3d/themes'

// The grounds' finish (scene.tsx, stadium.tsx): the grass's blades, the sky
// and its clouds, the soft shadow under each player, the goals' netting.
// The textures are drawn once on a canvas and shared; nothing here changes
// how a match plays.

const made = new Map<string, THREE.Texture>()
function once(key: string, draw: (c: HTMLCanvasElement) => void, size: [number, number], repeat = true) {
  const had = made.get(key)
  if (had) return had
  const c = document.createElement('canvas')
  ;[c.width, c.height] = size
  draw(c)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  made.set(key, t)
  return t
}

/** A seeded random, so the grass is the same on every phone. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Grass: thousands of blades and a few clumps, in greys round white, so the
 * material's colour gives the green (the mown stripes are the same blades,
 * lighter). It tiles: what goes over an edge comes back on the other side.
 */
export function grassTexture() {
  return once(
    'grass',
    (c) => {
      const g = c.getContext('2d')!
      const N = c.width
      const r = seeded(225)
      g.fillStyle = '#dcdcdc'
      g.fillRect(0, 0, N, N)
      // Clumps, lighter and darker, soft.
      for (let i = 0; i < 26; i++) {
        const [x, y, rad] = [r() * N, r() * N, 18 + r() * 40]
        const light = r() < 0.5
        for (const [ox, oy] of [
          [0, 0],
          [N, 0],
          [-N, 0],
          [0, N],
          [0, -N],
        ]) {
          const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad)
          grad.addColorStop(0, light ? 'rgba(255,255,255,0.22)' : 'rgba(90,90,90,0.18)')
          grad.addColorStop(1, 'rgba(0,0,0,0)')
          g.fillStyle = grad
          g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2)
        }
      }
      // The blades.
      g.lineWidth = 1
      g.lineCap = 'round'
      for (let i = 0; i < 9000; i++) {
        const [x, y] = [r() * N, r() * N]
        const len = 1.5 + r() * 3.5
        const a = -Math.PI / 2 + (r() - 0.5) * 1.1
        const v = Math.round(170 + r() * 85)
        g.strokeStyle = `rgb(${v},${v},${v})`
        // Near an edge, drawn again over the other one.
        const offs: [number, number][] = [[0, 0]]
        if (x < 6) offs.push([N, 0])
        else if (x > N - 6) offs.push([-N, 0])
        if (y < 6) offs.push([0, N])
        else if (y > N - 6) offs.push([0, -N])
        for (const [ox, oy] of offs) {
          g.beginPath()
          g.moveTo(x + ox, y + oy)
          g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len)
          g.stroke()
        }
      }
    },
    [256, 256],
  )
}

/** A grass material in a colour (the pitch's green, a stripe's lighter one). */
const grassMats = new Map<string, THREE.MeshLambertMaterial>()
export function grassMaterial(color: string) {
  let m = grassMats.get(color)
  if (!m) grassMats.set(color, (m = new THREE.MeshLambertMaterial({ color, map: grassTexture() })))
  return m
}

/**
 * A flat piece of ground w × d centred on (cx, cz), its texture laid in the
 * world's metres (a tile every `tile` m) so pieces side by side, and baked
 * together, line up.
 */
export function turf(w: number, d: number, cx: number, cz: number, tile = 4) {
  const geo = new THREE.PlaneGeometry(w, d)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + cx) / tile, (pos.getZ(i) + cz) / tile)
  return geo
}

/** The soft dark round under a player. */
function blobTexture() {
  return once(
    'blob',
    (c) => {
      const g = c.getContext('2d')!
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, 'rgba(0,0,0,0.55)')
      grad.addColorStop(0.55, 'rgba(0,0,0,0.3)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
    },
    [64, 64],
    false,
  )
}
let blobMat: THREE.MeshBasicMaterial | null = null
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)

/** A player's shadow on the grass, whatever the light (the far players at the stadium have none of their own). */
export function Blob({ size = 1.25 }: { size?: number }) {
  if (!blobMat) blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, color: '#ffffff' })
  return <mesh geometry={blobGeo} material={blobMat} position={[0, 0.042, 0]} scale={[size, 1, size]} renderOrder={1} />
}

/** The netting: thin white cords in squares. */
function netTexture() {
  return once(
    'net',
    (c) => {
      const g = c.getContext('2d')!
      g.clearRect(0, 0, 32, 32)
      g.fillStyle = 'rgba(255,255,255,0.95)'
      g.fillRect(0, 0, 32, 2)
      g.fillRect(0, 0, 2, 32)
    },
    [32, 32],
  )
}

/** A net's side, its squares about 12 cm whatever its size. */
function netMaterial(w: number, h: number) {
  const t = netTexture().clone()
  t.repeat.set(w / 0.12, h / 0.12)
  t.needsUpdate = true
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide })
}

/**
 * A goal's net going back from the line at x = 0 towards `dir` (±1): the back,
 * the roof, the two sides; `mouth` the half-width, `bar` the height.
 */
export function Net({ mouth, bar, depth, dir }: { mouth: number; bar: number; depth: number; dir: 1 | -1 }) {
  const mats = useMemo(() => ({ back: netMaterial(mouth * 2, bar), roof: netMaterial(depth, mouth * 2), side: netMaterial(depth, bar) }), [mouth, bar, depth])
  return (
    <group>
      <mesh material={mats.back} position={[dir * depth, bar / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[mouth * 2, bar]} />
      </mesh>
      <mesh material={mats.roof} position={[(dir * depth) / 2, bar, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[depth, mouth * 2]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={mats.side} position={[(dir * depth) / 2, bar / 2, s * mouth]}>
          <planeGeometry args={[depth, bar]} />
        </mesh>
      ))}
    </group>
  )
}

/** A cloud: a few soft white puffs. */
function cloudTexture() {
  return once(
    'cloud',
    (c) => {
      const g = c.getContext('2d')!
      const r = seeded(7)
      for (let i = 0; i < 14; i++) {
        const [x, y, rad] = [40 + r() * 176, 52 + r() * 30, 22 + r() * 30]
        const grad = g.createRadialGradient(x, y, 0, x, y, rad)
        grad.addColorStop(0, 'rgba(255,255,255,0.85)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = grad
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
      }
    },
    [256, 128],
    false,
  )
}

/** The horizon's colour: the fog melts the far things into it. */
export const HAZE = '#cfe6f2'

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const skyFragment = /* glsl */ `
uniform vec3 top;
uniform vec3 mid;
uniform vec3 low;
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 c = mix(low, mid, smoothstep(-0.02, 0.16, h));
  c = mix(c, top, smoothstep(0.16, 0.75, h));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`

/** The sky round the ground: deep blue overhead to a pale haze at the horizon, a few clouds; it goes with the camera. */
export function Sky({ radius }: { radius: number }) {
  const camera = useThree((s) => s.camera)
  const root = useRef<THREE.Group>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { top: { value: new THREE.Color('#2f7fd3') }, mid: { value: new THREE.Color('#8cc7ee') }, low: { value: new THREE.Color(HAZE) } },
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  )
  const clouds = useMemo(() => {
    const r = seeded(31)
    const tex = cloudTexture()
    return Array.from({ length: 9 }, () => {
      const az = r() * Math.PI * 2
      const el = 0.08 + r() * 0.22
      const d = radius * 0.8
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.75 + r() * 0.2 })
      const w = radius * (0.22 + r() * 0.18)
      return { m, p: [Math.cos(az) * Math.cos(el) * d, Math.sin(el) * d, Math.sin(az) * Math.cos(el) * d] as [number, number, number], s: [w, w * 0.45, 1] as [number, number, number] }
    })
  }, [radius])
  useFrame(() => root.current?.position.copy(camera.position))
  return (
    <group ref={root}>
      <mesh material={mat} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[radius, 32, 16]} />
      </mesh>
      {clouds.map((c, i) => (
        <sprite key={i} material={c.m} position={c.p} scale={c.s} renderOrder={-1} />
      ))}
    </group>
  )
}

/** A canvas texture drawn once and kept (the grounds share them). */
const painted = new Map<string, THREE.CanvasTexture>()
export function paint(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const had = painted.get(key)
  if (had) return had
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(...repeat)
  }
  painted.set(key, t)
  return t
}

/** The court's asphalt: grey grain, cracks, oil stains, a patch mended darker. */
export function asphalt() {
  return paint('asphalt', 512, 512, (g) => {
    const r = rng('asphalt')
    g.fillStyle = '#56565c'
    g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 26000; i++) {
      const v = 70 + Math.floor(r() * 50)
      g.fillStyle = `rgb(${v},${v},${v + 4})`
      g.fillRect(r() * 512, r() * 512, 1.5, 1.5)
    }
    // Stains and patches.
    for (let i = 0; i < 9; i++) {
      const [x, y, rad] = [r() * 512, r() * 512, 20 + r() * 50]
      const grad = g.createRadialGradient(x, y, 0, x, y, rad)
      grad.addColorStop(0, 'rgba(25,25,30,0.35)')
      grad.addColorStop(1, 'rgba(25,25,30,0)')
      g.fillStyle = grad
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
    g.fillStyle = 'rgba(40,40,46,0.45)'
    g.fillRect(300, 60, 120, 70)
    // Cracks.
    g.strokeStyle = 'rgba(20,20,24,0.7)'
    g.lineWidth = 1.4
    for (let i = 0; i < 7; i++) {
      let [x, y] = [r() * 512, r() * 512]
      g.beginPath()
      g.moveTo(x, y)
      for (let k = 0; k < 9; k++) {
        x += (r() - 0.5) * 40
        y += (r() - 0.5) * 40
        g.lineTo(x, y)
      }
      g.stroke()
    }
  })
}

