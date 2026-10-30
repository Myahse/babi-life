import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { pointAt } from '../../../kart/track'
import { Vehicle, setVehicleNight } from '../../../world3d/vehicles'
import { holdScenes } from '../../../world3d/hold'
import { rng } from '../../../world3d/themes'
import type { Race, RaceEvent } from './engine'
import { t as tl } from '../../../lib/i18n'

// The street race's city at dusk: the road (four lanes, its lines), the
// concrete walls (red and white in the bends), the pavements, the street
// lamps coming on, the towers of the Plateau with their windows lit, the
// lagoon along the bottom straight with its palms and the bridge across,
// the start's gantry. The camera rides behind the player's car, widening
// with the speed, shaking on a crash.

type Props = { R: React.RefObject<Race>; onFrame: (dt: number) => RaceEvent[] }

export function RaceCanvas({ R, onFrame }: Props) {
  const release = useRef<(() => void) | null>(null)
  useEffect(() => () => release.current?.(), [])
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 62, near: 0.3, far: 1400, position: [0, 4, -8] }} gl={{ antialias: true }} onCreated={({ gl }) => void (release.current = holdScenes(gl.domElement))}>
      <fog attach="fog" args={['#e38a5c', 140, 700]} />
      <City R={R} onFrame={onFrame} />
    </Canvas>
  )
}

function City({ R, onFrame }: Props) {
  const shake = useRef(0)
  const sparks = useRef<RaceEvent[]>([])
  useFrame((_, dt) => {
    for (const e of onFrame(dt)) {
      if (e.me && (e.kind === 'crash' || (e.kind === 'wall' && e.big))) shake.current = 0.5
      else if (e.me && (e.kind === 'wall' || e.kind === 'bump')) shake.current = Math.max(shake.current, 0.18)
      if (e.kind === 'wall' || e.kind === 'crash' || e.kind === 'bump') sparks.current.push(e)
    }
  }, -1)
  useEffect(() => {
    setVehicleNight(true)
    return () => setVehicleNight(false)
  }, [])
  return (
    <>
      <Chase R={R} shake={shake} />
      <Sky />
      <hemisphereLight args={['#ffc49a', '#3a3046', 1.0]} />
      <SunLight R={R} />
      <Road R={R} />
      <Walls R={R} />
      <Lamps R={R} />
      <Towers R={R} />
      <Lagoon />
      <Gantry R={R} />
      <Cars R={R} />
      <Sparks fx={sparks} />
      {/* The ground between the streets. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[1400, 1400]} />
        <meshLambertMaterial color="#6b6158" />
      </mesh>
    </>
  )
}

/* ---------- The camera ---------- */

function Chase({ R, shake }: { R: React.RefObject<Race>; shake: React.RefObject<number> }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3())
  const started = useRef(false)
  useFrame((_, dt) => {
    const c = R.current?.cars[0]
    if (!c) return
    const cam = camera as THREE.PerspectiveCamera
    // Behind and above, a little behind the turn; wider as it goes faster.
    const back = 7.2 + c.speed * 0.04
    const want = new THREE.Vector3(c.x - Math.sin(c.heading) * back, 2.6 + c.speed * 0.012, c.z - Math.cos(c.heading) * back)
    const k = started.current ? Math.min(1, dt * 6) : 1
    started.current = true
    camera.position.lerp(want, k)
    look.current.lerp(new THREE.Vector3(c.x + Math.sin(c.heading) * 7, 1.1, c.z + Math.cos(c.heading) * 7), Math.min(1, dt * 9))
    const fov = 62 + Math.min(16, c.speed * 0.25) + (c.boost > 0 ? 8 : 0)
    if (Math.abs(cam.fov - fov) > 0.1) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 4)
      cam.updateProjectionMatrix()
    }
    const s = shake.current ?? 0
    if (s > 0) {
      camera.position.x += (Math.random() - 0.5) * s
      camera.position.y += (Math.random() - 0.5) * s * 0.6
      shake.current = Math.max(0, s - dt * 1.5)
    }
    camera.lookAt(look.current)
  })
  return null
}

/* ---------- Sky and sun ---------- */

function Sky() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, '#2b2d6e')
    grad.addColorStop(0.45, '#8a4f8f')
    grad.addColorStop(0.75, '#f08a5d')
    grad.addColorStop(1, '#ffd29a')
    g.fillStyle = grad
    g.fillRect(0, 0, 4, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const { camera } = useThree()
  const dome = useRef<THREE.Group>(null)
  useFrame(() => dome.current?.position.copy(camera.position))
  return (
    <group ref={dome}>
      <mesh>
        <sphereGeometry args={[900, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial map={tex} side={THREE.BackSide} fog={false} depthWrite={false} />
      </mesh>
      {/* The sun going down over the lagoon. */}
      <mesh position={[-520, 60, 600]}>
        <circleGeometry args={[34, 32]} />
        <meshBasicMaterial color="#ffe0a0" fog={false} />
      </mesh>
    </group>
  )
}

function SunLight({ R }: { R: React.RefObject<Race> }) {
  const sun = useRef<THREE.DirectionalLight>(null)
  useFrame(() => {
    const c = R.current?.cars[0]
    const l = sun.current
    if (!c || !l) return
    // The shadows only round the player's car: the light's box follows it.
    l.position.set(c.x - 60, 70, c.z + 70)
    l.target.position.set(c.x, 0, c.z)
    l.target.updateMatrixWorld()
  })
  return <directionalLight ref={sun} intensity={1.5} color="#ffb47a" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
}

/* ---------- The road ---------- */

/** The tarmac: dark, its edge lines and the dashes between the lanes. */
function roadTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#3d3d44'
  g.fillRect(0, 0, 256, 256)
  const r = rng('road')
  for (let k = 0; k < 900; k++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'
    g.fillRect(r() * 256, r() * 256, 2, 2)
  }
  g.fillStyle = '#f2f2f2'
  g.fillRect(6, 0, 5, 256)
  g.fillRect(245, 0, 5, 256)
  for (const u of [0.25, 0.75]) for (let v = 0; v < 256; v += 128) g.fillRect(u * 256 - 2, v, 4, 64)
  // The middle: two yellow lines.
  g.fillStyle = '#f2c230'
  g.fillRect(122, 0, 4, 256)
  g.fillRect(130, 0, 4, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

/** A band along the track from d0 to d1 (metres across), at height y, its v counted in metres / vScale. */
function band(R: Race, d0: number, d1: number, y: number, vScale: number) {
  const tr = R.track
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= tr.n; i++) {
    const [ax, az] = pointAt(tr, i, d0)
    const [bx, bz] = pointAt(tr, i, d1)
    pos.push(ax, y, az, bx, y, bz)
    uv.push(0, i / vScale, 1, i / vScale)
    if (i < tr.n) {
      const k = i * 2
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  // Wound one way or the other: seen from above either way.
  return geo
}

function Road({ R }: { R: React.RefObject<Race> }) {
  const race = R.current!
  const half = race.track.half
  const geos = useMemo(() => ({ road: band(race, -half, half, 0.02, 16), left: band(race, -half - 4.2, -half, 0.14, 4), right: band(race, half, half + 4.2, 0.14, 4) }), [race, half])
  const mats = useMemo(() => ({ road: new THREE.MeshLambertMaterial({ map: roadTexture(), side: THREE.DoubleSide }), walk: new THREE.MeshLambertMaterial({ color: '#9a958c', side: THREE.DoubleSide }) }), [])
  return (
    <>
      <mesh geometry={geos.road} material={mats.road} receiveShadow />
      <mesh geometry={geos.left} material={mats.walk} receiveShadow />
      <mesh geometry={geos.right} material={mats.walk} receiveShadow />
    </>
  )
}

/** Every `step` metres along both sides, `off` past the road: where things stand, the way the road goes there, how sharp it turns. */
function alongside(R: Race, step: number, off: number) {
  const tr = R.track
  const out: { x: number; z: number; rot: number; side: number; bend: number; s: number }[] = []
  for (let s = 0; s < tr.n; s += step) {
    const i = Math.floor(s)
    const j = (i + 25) % tr.n
    const bend = Math.abs(Math.atan2(Math.sin(Math.atan2(tr.tx[j], tr.tz[j]) - Math.atan2(tr.tx[i], tr.tz[i])), Math.cos(Math.atan2(tr.tx[j], tr.tz[j]) - Math.atan2(tr.tx[i], tr.tz[i]))))
    for (const side of [-1, 1]) {
      const [x, z] = pointAt(tr, s, side * (tr.half + off))
      out.push({ x, z, rot: Math.atan2(tr.tx[i], tr.tz[i]), side, bend, s })
    }
  }
  return out
}

/** Nothing too close to another part of the road (where the circuit comes back near itself). */
function clear(R: Race, x: number, z: number, room: number) {
  const tr = R.track
  for (let i = 0; i < tr.n; i += 3) if ((tr.x[i] - x) ** 2 + (tr.z[i] - z) ** 2 < room * room) return false
  return true
}

function Walls({ R }: { R: React.RefObject<Race> }) {
  const race = R.current!
  const mesh = useRef<THREE.InstancedMesh>(null)
  const spots = useMemo(() => alongside(race, 3, 1.15), [race])
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    spots.forEach((p, k) => {
      o.position.set(p.x, 0.45, p.z)
      o.rotation.set(0, p.rot, 0)
      o.scale.set(0.45, 0.9, 3.1)
      o.updateMatrix()
      m.setMatrixAt(k, o.matrix)
      // Red and white where the road turns hard, grey concrete elsewhere.
      m.setColorAt(k, col.set(p.bend > 0.5 ? (Math.floor(p.s / 3) % 2 ? '#e03131' : '#f8f9fa') : '#bdb9b0'))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [spots])
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, spots.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color="#ffffff" />
    </instancedMesh>
  )
}

function Lamps({ R }: { R: React.RefObject<Race> }) {
  const race = R.current!
  const poles = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const spots = useMemo(() => alongside(race, 34, 3.2), [race])
  useEffect(() => {
    const o = new THREE.Object3D()
    spots.forEach((p, k) => {
      o.position.set(p.x, 3.6, p.z)
      o.rotation.set(0, 0, 0)
      o.scale.set(0.16, 7.2, 0.16)
      o.updateMatrix()
      poles.current?.setMatrixAt(k, o.matrix)
      // The lamp hangs out over the road.
      const [x, z] = pointAt(race.track, p.s, p.side * (race.track.half + 1.6))
      o.position.set(x, 7.1, z)
      o.scale.set(0.7, 0.2, 0.7)
      o.updateMatrix()
      heads.current?.setMatrixAt(k, o.matrix)
    })
    for (const m of [poles.current, heads.current]) if (m) ((m.instanceMatrix.needsUpdate = true), m.computeBoundingSphere())
  }, [spots, race])
  return (
    <>
      <instancedMesh ref={poles} args={[undefined, undefined, spots.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#4a4e55" />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, spots.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#fff0c8" />
      </instancedMesh>
    </>
  )
}

/** A tower's windows: rows of them, many lit at this hour. */
function windowTexture(seed: string) {
  const r = rng(seed)
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, 128, 256)
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 8; x++) {
      const k = r()
      g.fillStyle = k < 0.42 ? '#ffd28a' : k < 0.5 ? '#9fd0ff' : '#08080c'
      g.fillRect(x * 16 + 3, y * 16 + 4, 10, 9)
    }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Towers({ R }: { R: React.RefObject<Race> }) {
  const race = R.current!
  // Buildings along the outside of the road, where there's room; the lagoon's side left open.
  const blocks = useMemo(() => {
    const r = rng('towers')
    const out: { x: number; z: number; rot: number; w: number; h: number; d: number; v: number }[] = []
    for (const p of alongside(race, 26, 14)) {
      if (p.z > 112) continue
      const w = 10 + r() * 10
      if (!clear(race, p.x, p.z, race.track.half + 4 + w * 0.6)) continue
      out.push({ x: p.x, z: p.z, rot: p.rot, w, h: 12 + r() * (r() < 0.2 ? 70 : 30), d: 10 + r() * 8, v: Math.floor(r() * 3) })
    }
    return out
  }, [race])
  const mats = useMemo(() => [0, 1, 2].map((v) => new THREE.MeshLambertMaterial({ color: ['#7d7a8c', '#8c7b6b', '#5e6f80'][v], emissive: '#ffffff', emissiveMap: windowTexture(`t${v}`), emissiveIntensity: 0.85 })), [])
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  useEffect(() => {
    const o = new THREE.Object3D()
    ;[0, 1, 2].forEach((v) => {
      const m = refs.current[v]
      if (!m) return
      blocks
        .filter((b) => b.v === v)
        .forEach((b, k) => {
          o.position.set(b.x, b.h / 2, b.z)
          o.rotation.set(0, b.rot, 0)
          o.scale.set(b.w, b.h, b.d)
          o.updateMatrix()
          m.setMatrixAt(k, o.matrix)
        })
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
    })
  }, [blocks])
  return (
    <>
      {[0, 1, 2].map((v) => (
        <instancedMesh key={v} ref={(el) => void (refs.current[v] = el)} args={[undefined, mats[v], Math.max(1, blocks.filter((b) => b.v === v).length)]}>
          <boxGeometry args={[1, 1, 1]} />
        </instancedMesh>
      ))}
      {/* La Pyramide, in the middle of the Plateau: its stepped sides. */}
      <group position={[-20, 0, 40]}>
        {[0, 1, 2, 3, 4].map((k) => (
          <mesh key={k} position={[0, 5 + k * 9, 0]}>
            <boxGeometry args={[40 - k * 7.5, 10, 40 - k * 7.5]} />
            <meshLambertMaterial color="#c9bba5" emissive="#ffcf8a" emissiveIntensity={k % 2 ? 0.15 : 0.05} />
          </mesh>
        ))}
      </group>
    </>
  )
}

/* ---------- The lagoon ---------- */

function Lagoon() {
  const palms = useMemo(() => {
    const out: [number, number][] = []
    for (let x = -190; x <= 120; x += 22) out.push([x, 145 + ((x * 7) % 5)])
    return out
  }, [])
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const o = new THREE.Object3D()
    palms.forEach(([x, z], k) => {
      o.position.set(x, 4, z)
      o.rotation.set(0.08, 0, 0.1)
      o.scale.set(0.5, 8, 0.5)
      o.updateMatrix()
      trunks.current?.setMatrixAt(k, o.matrix)
      // Six fronds round the top, drooping.
      for (let f = 0; f < 6; f++) {
        const a = k * 1.3 + (f / 6) * Math.PI * 2
        o.position.set(x + 0.3 + Math.cos(a) * 1.5, 7.7, z + 0.3 - Math.sin(a) * 1.5)
        o.rotation.set(0, a, -0.45, 'YXZ')
        o.scale.set(3.4, 0.14, 0.85)
        o.updateMatrix()
        crowns.current?.setMatrixAt(k * 6 + f, o.matrix)
      }
    })
    for (const m of [trunks.current, crowns.current]) if (m) ((m.instanceMatrix.needsUpdate = true), m.computeBoundingSphere())
  }, [palms])
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 520]}>
        <planeGeometry args={[1600, 740]} />
        <meshLambertMaterial color="#3c6f8f" emissive="#f08a5d" emissiveIntensity={0.18} />
      </mesh>
      {/* The bridge across, far off, its lights along it. */}
      <mesh position={[60, 9, 420]}>
        <boxGeometry args={[900, 2, 14]} />
        <meshLambertMaterial color="#9a958c" />
      </mesh>
      {Array.from({ length: 14 }, (_, k) => (
        <mesh key={k} position={[-380 + k * 64, 4, 420]}>
          <boxGeometry args={[3, 8, 6]} />
          <meshLambertMaterial color="#8a857c" />
        </mesh>
      ))}
      <instancedMesh ref={trunks} args={[undefined, undefined, palms.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#8d6e4a" />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, palms.length * 6]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#2f7a3a" />
      </instancedMesh>
    </>
  )
}

/* ---------- The start ---------- */

function Gantry({ R }: { R: React.RefObject<Race> }) {
  const race = R.current!
  const tr = race.track
  const lights = useRef<THREE.MeshBasicMaterial[]>([])
  const banner = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#ff7a00'
    g.fillRect(0, 0, 1024, 128)
    g.fillStyle = '#fff'
    g.font = "900 84px 'Baloo 2', Impact, sans-serif"
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(tl('BABI STREET RACE'), 512, 70)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const checker = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 16
    const g = c.getContext('2d')!
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 2; y++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#fff'
        g.fillRect(x * 8, y * 8, 8, 8)
      }
    const t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    return t
  }, [])
  // The lights: red, red, red, then all green.
  useFrame(() => {
    const t = R.current?.time ?? 0
    lights.current.forEach((m, k) => m?.color.set(t >= 0 ? '#2bd65a' : t >= -3 + k ? '#ff2a1a' : '#3a0d0a'))
  })
  const rot = Math.atan2(tr.tx[0], tr.tz[0])
  const [x, z] = pointAt(tr, 0, 0)
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <planeGeometry args={[tr.half * 2, 1.6]} />
        <meshBasicMaterial map={checker} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (tr.half + 1.4), 4, 0]}>
          <boxGeometry args={[0.5, 8, 0.5]} />
          <meshLambertMaterial color="#2b2f3a" />
        </mesh>
      ))}
      <mesh position={[0, 7.6, 0]}>
        <boxGeometry args={[tr.half * 2 + 3.4, 1.6, 0.4]} />
        <meshLambertMaterial color="#2b2f3a" />
      </mesh>
      <mesh position={[0, 7.6, -0.22]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[tr.half * 2 + 2, 1.3]} />
        <meshBasicMaterial map={banner} />
      </mesh>
      {[-1, 0, 1].map((k, i) => (
        <mesh key={k} position={[k * 1.2, 6.2, -0.25]}>
          <sphereGeometry args={[0.38, 12, 8]} />
          <meshBasicMaterial ref={(m) => void (m && (lights.current[i] = m))} color="#3a0d0a" />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- The cars ---------- */

function Cars({ R }: { R: React.RefObject<Race> }) {
  const race = R.current!
  const cars = useRef<(THREE.Group | null)[]>([])
  const flames = useRef<(THREE.Mesh | null)[]>([])
  const traffic = useRef<(THREE.Group | null)[]>([])
  useFrame((_, dt) => {
    const r = R.current
    if (!r) return
    r.cars.forEach((c, k) => {
      const g = cars.current[k]
      if (!g) return
      g.position.set(c.x, 0, c.z)
      // The model faces +x; the car's heading 0 faces +z. A drift swings the tail out.
      const yaw = c.heading - Math.PI / 2 + c.drift * 0.35
      g.rotation.y += Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * Math.min(1, dt * 14)
      g.rotation.z = -c.steer * Math.min(1, c.speed / 30) * 0.05
      const f = flames.current[k]
      if (f) {
        f.visible = c.boost > 0
        f.scale.setScalar(0.8 + Math.random() * 0.5)
      }
    })
    r.traffic.forEach((t, k) => {
      const g = traffic.current[k]
      if (!g) return
      const [x, z] = pointAt(r.track, t.s, t.d)
      const i = Math.floor(t.s) % r.track.n
      g.position.set(x, 0, z)
      g.rotation.y = Math.atan2(r.track.tx[i], r.track.tz[i]) - Math.PI / 2
    })
  })
  return (
    <>
      {race.cars.map((c, k) => (
        <group key={k} ref={(el) => void (cars.current[k] = el)}>
          <Vehicle p={[0, 0, 0]} kind="car" color={c.color} seed={k === 0 ? 2 : 5} />
          {/* The nitro's flames out of the exhaust. */}
          <mesh ref={(el) => void (flames.current[k] = el)} position={[-2.5, 0.45, 0]} rotation={[0, 0, Math.PI / 2]} visible={false}>
            <coneGeometry args={[0.22, 1.2, 10]} />
            <meshBasicMaterial color="#5ec8ff" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {race.traffic.map((t, k) => (
        <group key={`t${k}`} ref={(el) => void (traffic.current[k] = el)}>
          <Vehicle p={[0, 0, 0]} kind={t.kind} seed={t.seed} crew={t.kind === 'gbaka'} />
        </group>
      ))}
    </>
  )
}

/* ---------- Sparks on the walls ---------- */

function Sparks({ fx }: { fx: React.RefObject<RaceEvent[]> }) {
  const POOL = 6
  const N = 10
  const items = useRef<{ t: number; x: number; z: number; v: THREE.Vector3[] }[]>([])
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  useFrame((_, dt) => {
    for (const e of fx.current?.splice(0) ?? []) {
      items.current.push({ t: 0, x: e.x, z: e.z, v: Array.from({ length: N }, () => new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6)) })
      if (items.current.length > POOL) items.current.shift()
    }
    let m = 0
    for (const it of items.current) {
      it.t += dt
      for (const v of it.v) {
        const mesh = meshes.current[m++]
        if (!mesh) continue
        mesh.visible = it.t < 0.45
        mesh.position.set(it.x + v.x * it.t, 0.8 + v.y * it.t - 6 * it.t * it.t, it.z + v.z * it.t)
      }
    }
    for (; m < POOL * N; m++) if (meshes.current[m]) meshes.current[m]!.visible = false
  })
  return (
    <>
      {Array.from({ length: POOL * N }, (_, k) => (
        <mesh key={k} ref={(el) => void (meshes.current[k] = el)} visible={false}>
          <boxGeometry args={[0.08, 0.08, 0.08]} />
          <meshBasicMaterial color={k % 2 ? '#ffd43b' : '#ff922b'} />
        </mesh>
      ))}
    </>
  )
}
