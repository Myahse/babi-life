import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Bicycle, Vehicle, setVehicleNight, type CarModel, type VehicleKind } from '../world3d/vehicles'
import { LumiereRig, Fill } from '../world3d/open/lumiereRig'
import { useLumiere } from '../world3d/open/lumiere'
import { Human } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { buildModel, type ModelKey } from '../world3d/voituresModels'

// The vehicles' lab (city.html?view=voitures): every kind side by side, close up, by day or night
// (&night), with « voitures réalistes » open (the lab's default) or shut (&shut=voitures-realistes);
// &scene=traffic puts &n vehicles on a long road, half of them driving, to measure the draws
// (window.__info, the last frame's) and the frame time (window.__frames).

const q = new URLSearchParams(location.search)
const night = q.has('night')
type One = { kind: VehicleKind; model?: CarModel; color?: string; trim?: string; skirt?: string; clear?: boolean; seed?: number }
const ROW1: One[] = [
  { kind: 'taxi', seed: 1 },
  { kind: 'woro', color: '#2a6cf0', trim: '#f8f9fa', seed: 2 },
  { kind: 'car', model: 'saloon', color: '#c92a2a', seed: 3 },
  { kind: 'car', model: 'berline', color: '#1b2a4a', seed: 0 },
  { kind: 'car', model: 'suv', color: '#212529', seed: 1 },
  { kind: 'car', model: '4x4', color: '#f8f9fa', seed: 2 },
]
const ROW2: One[] = [
  { kind: 'car', model: 'limo', seed: 1 },
  { kind: 'car', model: 'cruiser', color: '#9aa0a6', seed: 2 },
  { kind: 'car', model: 'pickup', color: '#c9b48a', seed: 3 },
  { kind: 'car', model: 'hyper', color: '#1c7ed6', seed: 0 },
  { kind: 'moto', color: '#c92a2a' },
  { kind: 'moto', color: '#2b2b30' },
]
const ROW3: One[] = [
  { kind: 'gbaka', seed: 1 },
  { kind: 'gbaka', color: '#1f9a4a', trim: '#f4c20d', seed: 2 },
  { kind: 'sotra', seed: 1 },
  { kind: 'sotra', skirt: '#c92a2a', seed: 2 },
]
const SPACING: Partial<Record<VehicleKind, number>> = { sotra: 13, gbaka: 7, moto: 3 }

function Row({ list, z }: { list: One[]; z: number }) {
  let x = 0
  const at = list.map((o) => {
    const w = SPACING[o.kind] ?? 6
    const p = x + w / 2
    x += w
    return p
  })
  return (
    <>
      {list.map((o, i) => (
        <Vehicle key={i} p={[at[i] - x / 2, 0, z]} r={-0.6} kind={o.kind} model={o.model} color={o.color} trim={o.trim} skirt={o.skirt} seed={o.seed} clear={o.clear} />
      ))}
    </>
  )
}

/** A taxi driving round a circle (its wheels roll and steer), a moto-taxi with its passenger. */
function Driving() {
  const g = useRef<THREE.Group>(null)
  const m = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.4
    g.current?.position.set(32 + Math.cos(t) * 8, 0, Math.sin(t) * 8)
    if (g.current) g.current.rotation.y = -t - Math.PI
    const u = clock.elapsedTime * 0.5
    m.current?.position.set(-30 + Math.cos(u) * 5, 0, Math.sin(u) * 5)
    if (m.current) m.current.rotation.y = -u - Math.PI
  })
  return (
    <>
      <group ref={g}>
        <Vehicle p={[0, 0, 0]} kind="taxi" seed={2} clear />
      </group>
      <group ref={m}>
        <Vehicle p={[0, 0, 0]} kind="moto" color="#2b2b30" />
        {/* The moto-taxi's passenger behind the rider, as the Walker seats the Sim. */}
        <group position={[-0.65, 0.45, 0]} rotation={[0, Math.PI / 2, 0]}>
          <Human look={randomLook('femme', () => 0.3)} gender="femme" pose="sit" seed={7} />
        </group>
      </group>
      <group position={[10, 0, 10]} rotation={[0, 0.5, 0]}>
        <Bicycle color="#2b8a3e" />
      </group>
    </>
  )
}

const KINDS: One[] = [{ kind: 'taxi' }, { kind: 'woro', color: '#2a6cf0' }, { kind: 'car' }, { kind: 'car', color: '#212529' }, { kind: 'gbaka' }, { kind: 'moto' }, { kind: 'taxi' }, { kind: 'car', color: '#f8f9fa' }, { kind: 'woro', color: '#ffd60a', trim: '#1c7ed6' }, { kind: 'sotra' }]
/** &scene=traffic: n vehicles on a 4-lane road 300 m long; the even ones drive. */
function Traffic({ n }: { n: number }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const list = useMemo(() => Array.from({ length: n }, (_, i) => ({ ...KINDS[i % KINDS.length], lane: (i % 4) - 1.5, x: -150 + ((i * 37) % 300), seed: i })), [n])
  useFrame((_, dt) => {
    list.forEach((v, i) => {
      const g = refs.current[i]
      if (!g || i % 2) return
      v.x += (v.lane > 0 ? 1 : -1) * 9 * Math.min(dt, 0.05)
      if (v.x > 150) v.x -= 300
      if (v.x < -150) v.x += 300
      g.position.x = v.x
    })
  })
  return (
    <>
      {list.map((v, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} position={[v.x, 0, v.lane * 3.4]} rotation={[0, v.lane > 0 ? 0 : Math.PI, 0]}>
          <Vehicle p={[0, 0, 0]} kind={v.kind} color={v.color} trim={v.trim} seed={v.seed} />
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[320, 14]} />
        <meshLambertMaterial color="#3d4147" />
      </mesh>
    </>
  )
}

/** Draws and triangles of the last frame, and the frames' times (ms), for the measures. */
function Info() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const times = useRef<number[]>([])
  const last = useRef(performance.now())
  useFrame(() => {
    const now = performance.now()
    times.current.push(now - last.current)
    if (times.current.length > 240) times.current.shift()
    last.current = now
    const w = window as unknown as Record<string, unknown>
    w.__info = { calls: gl.info.render.calls, triangles: gl.info.render.triangles, textures: gl.info.memory.textures, geometries: gl.info.memory.geometries, programs: gl.info.programs?.length }
    w.__frames = times.current
    w.__env = !!scene.environment
  })
  return null
}

// The models' triangles (detailed, far) per tier, for the measures: window.__models.
const KEYS: ModelKey[] = ['taxi', 'woro', 'saloon', 'berline', 'suv', '4x4', 'limo', 'cruiser', 'pickup', 'hyper', 'gbaka', 'sotra', 'moto']
;(window as unknown as Record<string, unknown>).__models = () =>
  Object.fromEntries((['simple', 'normal', 'haute'] as const).map((t) => [t, Object.fromEntries(KEYS.map((k) => [k, [buildModel(k, t, false, false, 0).tris, buildModel(k, t, false, true, 0).tris]]))]))

function Night() {
  useEffect(() => {
    setVehicleNight(night)
    return () => setVehicleNight(false)
  }, [])
  return null
}

export function VoituresLab() {
  const lumiere = useLumiere()
  const traffic = q.get('scene') === 'traffic'
  const cam = (q.get('cam') ?? (traffic ? '0,1.7,12' : '-2,9,30')).split(',').map(Number) as [number, number, number]
  const look = (q.get('look') ?? (traffic ? '-20,1,0' : '0,0.8,0')).split(',').map(Number) as [number, number, number]
  const hour = Number(q.get('hour') ?? (night ? 21 : 10))
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: cam, fov: Number(q.get('fov') ?? 45), far: 2000 }} style={{ width: '100vw', height: '100vh' }} gl={{ toneMapping: THREE.ACESFilmicToneMapping }}>
      <color attach="background" args={[night ? '#0b1030' : '#a9d3f0']} />
      {night && <fog attach="fog" args={['#1d2552', 40, 400]} />}
      {lumiere !== 'off' && <LumiereRig tier={lumiere} hour={hour} rain={false} />}
      {lumiere !== 'off' ? <Fill tier={lumiere} scale={1} /> : <hemisphereLight args={[night ? '#7484c4' : '#ffffff', night ? '#3a3a56' : '#b8a27c', night ? 1.3 : 1.2]} />}
      <directionalLight position={[-30, 40, 35]} intensity={night ? 0.6 : 2.2} color={night ? '#8fa8ff' : '#fff0d8'} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshLambertMaterial color={night ? '#2a2d36' : '#b9ad96'} />
      </mesh>
      <Night />
      <Info />
      {traffic ? (
        <Traffic n={Number(q.get('n') ?? 60)} />
      ) : (
        <>
          <Row list={ROW1} z={0} />
          <Row list={ROW2} z={-8} />
          <Row list={ROW3} z={-18} />
          <Driving />
        </>
      )}
      <OrbitControls target={look} />
    </Canvas>
  )
}
