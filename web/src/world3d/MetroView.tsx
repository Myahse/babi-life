import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Map as MapIcon, TrainFront } from 'lucide-react'
import { Human, NoShadows, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { Character } from './Character'
import { rng } from './themes'
import type { Sim, World } from '../lib/types'
import { METRO } from '../game/rides'
import { RichAO } from './interior/bigPlace'

// On the métro (a trip on line 1, backend world/metro.go): instead of the
// street, inside the carriage, the Sim on its seat among the passengers,
// the city going by in the windows (the line runs mostly on its viaduct),
// the screen over the doors with the next station; slowing at each one.

const CAR = { w: 2.8, h: 2.3, l: 18 }
const BLOCKS = 60

/** The city going by outside: blocks, palms, the lagoon now and then, streaming back. */
function Outside({ night, speed }: { night: boolean; speed: React.RefObject<number> }) {
  const inst = useRef<THREE.InstancedMesh>(null)
  const blocks = useMemo(() => {
    const r = rng('metro-ville')
    return [...Array(BLOCKS)].map((_, i) => ({ side: i % 2 ? 1 : -1, z: (r() - 0.5) * 240, off: 9 + r() * 30, w: 5 + r() * 10, h: 4 + r() * (r() < 0.15 ? 40 : 14), d: 5 + r() * 9, c: new THREE.Color(['#e9dcc3', '#f3f1ec', '#ffd29a', '#c9d6df', '#f7c6a5', '#d8e2dc'][Math.floor(r() * 6)]) }))
  }, [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const s = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  useFrame((_, dt) => {
    const g = inst.current
    if (!g) return
    blocks.forEach((b, i) => {
      b.z += speed.current! * Math.min(dt, 0.05)
      if (b.z > 120) b.z -= 240
      p.set(b.side * b.off, b.h / 2 - 8, b.z)
      s.set(b.w, b.h, b.d)
      m.compose(p, q, s)
      g.setMatrixAt(i, m)
      g.setColorAt(i, b.c)
    })
    g.instanceMatrix.needsUpdate = true
    if (g.instanceColor) g.instanceColor.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={inst} args={[undefined, undefined, BLOCKS]}>
        <boxGeometry />
        <meshLambertMaterial emissive={night ? '#3a2a10' : '#000000'} />
      </instancedMesh>
      {/* The ground far under the viaduct */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshLambertMaterial color={night ? '#1a2018' : '#8a9a5b'} />
      </mesh>
    </>
  )
}

/** The carriage: floor, seats along the sides, the bars, the windows, the doors in orange. */
function Carriage({ night }: { night: boolean }) {
  const seats = useMemo(() => [-1, 1].flatMap((side) => [-6, -3.5, 2.5, 5].map((z) => ({ side, z }))), [])
  return (
    <group>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[CAR.w, 0.1, CAR.l]} />
        <meshLambertMaterial color="#5b6470" />
      </mesh>
      <mesh position={[0, CAR.h, 0]}>
        <boxGeometry args={[CAR.w, 0.08, CAR.l]} />
        <meshBasicMaterial color={night ? '#d9dee3' : '#eef1f4'} />
      </mesh>
      {/* The lights along the ceiling */}
      {[-6, -2, 2, 6].map((z) => (
        <mesh key={z} position={[0, CAR.h - 0.06, z]}>
          <boxGeometry args={[0.5, 0.03, 2.6]} />
          <meshBasicMaterial color="#fffaf0" />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* Under and over the windows; the windows themselves left open to the city */}
          <mesh position={[side * (CAR.w / 2), 0.45, 0]}>
            <boxGeometry args={[0.06, 0.9, CAR.l]} />
            <meshLambertMaterial color="#dfe4ea" />
          </mesh>
          <mesh position={[side * (CAR.w / 2), CAR.h - 0.25, 0]}>
            <boxGeometry args={[0.06, 0.5, CAR.l]} />
            <meshLambertMaterial color="#dfe4ea" />
          </mesh>
          {/* The doors in the middle, the line's orange */}
          <mesh position={[side * (CAR.w / 2 - 0.02), CAR.h / 2, -0.5]}>
            <boxGeometry args={[0.05, CAR.h, 1.6]} />
            <meshLambertMaterial color={METRO} />
          </mesh>
          {[-4.75, 3.75, -8.5, 7.5].map((z) => (
            <mesh key={z} position={[side * (CAR.w / 2 - 0.02), 1.4, z]}>
              <boxGeometry args={[0.05, 1.0, 0.12]} />
              <meshLambertMaterial color="#dfe4ea" />
            </mesh>
          ))}
        </group>
      ))}
      {seats.map(({ side, z }) => (
        <group key={`${side}${z}`} position={[side * (CAR.w / 2 - 0.35), 0, z]}>
          <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[0.5, 0.08, 1.1]} />
            <meshLambertMaterial color="#1d3557" />
          </mesh>
          <mesh position={[side * 0.24, 0.75, 0]}>
            <boxGeometry args={[0.06, 0.65, 1.1]} />
            <meshLambertMaterial color="#1d3557" />
          </mesh>
        </group>
      ))}
      {/* The bars to hold on to */}
      {[-1.5, 0.5, 4].map((z) => (
        <mesh key={z} position={[0, CAR.h / 2, z]}>
          <cylinderGeometry args={[0.025, 0.025, CAR.h, 8]} />
          <meshLambertMaterial color="#c0c6cc" />
        </mesh>
      ))}
      <mesh position={[0, CAR.h - 0.35, 0]}>
        <boxGeometry args={[0.03, 0.03, CAR.l]} />
        <meshLambertMaterial color="#c0c6cc" />
      </mesh>
      {/* The ends of the car */}
      {[-1, 1].map((e) => (
        <mesh key={e} position={[0, CAR.h / 2, (e * CAR.l) / 2]}>
          <boxGeometry args={[CAR.w, CAR.h, 0.06]} />
          <meshLambertMaterial color="#dfe4ea" />
        </mesh>
      ))}
    </group>
  )
}

/** The passengers: seated, standing at the bars, on their phones. */
function Passengers() {
  const people = useMemo(() => {
    const r = rng('metro-passagers')
    const spots: { p: [number, number, number]; ry: number; pose: Pose }[] = [
      { p: [-0.95, 0.05, -6.3], ry: Math.PI / 2, pose: 'sit' },
      { p: [-0.95, 0.05, -3.2], ry: Math.PI / 2, pose: 'phone' },
      { p: [0.95, 0.05, -6], ry: -Math.PI / 2, pose: 'sit' },
      { p: [0.95, 0.05, 2.5], ry: -Math.PI / 2, pose: 'sit' },
      { p: [0.95, 0.05, 5.3], ry: -Math.PI / 2, pose: 'phone' },
      { p: [-0.95, 0.05, 5], ry: Math.PI / 2, pose: 'sit' },
      { p: [0.25, 0, -1.5], ry: 0.4, pose: 'idle' },
      { p: [-0.3, 0, 0.6], ry: Math.PI, pose: 'phone' },
      { p: [0.3, 0, 4.2], ry: -2.4, pose: 'talk' },
      { p: [-0.25, 0, 4.4], ry: 0.8, pose: 'talk' },
    ]
    return spots.map((s, i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { ...s, gender, look: randomLook(gender, r), seed: i * 3.1 }
    })
  }, [])
  return (
    <NoShadows>
      {people.map((h, i) => (
        <group key={i} position={h.p} rotation={[0, h.ry, 0]}>
          <Human look={h.look} gender={h.gender} pose={h.pose} seed={h.seed} />
        </group>
      ))}
    </NoShadows>
  )
}

/** The ride: the car rocking a little, the speed falling at each station and picking up again. */
function Ride({ sim, night, stops, share }: { sim: Sim; night: boolean; stops: number; share: number }) {
  const speed = useRef(14)
  const car = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    // Between two stations: up to speed, slowing as the next comes.
    const k = (share * stops) % 1
    const v = Math.min(1, k * 5, (1 - k) * 5)
    speed.current = 2 + 22 * v
    if (car.current) car.current.rotation.z = Math.sin(clock.elapsedTime * 2.3) * 0.004 * v
  })
  return (
    <>
      <color attach="background" args={[night ? '#0b1026' : '#9ccbea']} />
      <hemisphereLight args={[night ? '#4a5a8a' : '#ffffff', '#6b5a3a', night ? 0.6 : 1.1]} />
      <directionalLight position={[10, 20, 5]} intensity={night ? 0.2 : 1} />
      <pointLight position={[0, 2, 0]} intensity={night ? 6 : 2} distance={14} color="#fff4e0" />
      <Outside night={night} speed={speed} />
      <group ref={car}>
        <Carriage night={night} />
        <Passengers />
        <group position={[0.95, 0.05, -3.5]} rotation={[0, -Math.PI / 2, 0]}>
          <Character look={sim.look} gender={sim.gender} pose="sit" marker={false} />
        </group>
      </group>
    </>
  )
}

export function MetroView({ world, sim, night, onMap }: { world: World; sim: Sim; night: boolean; onMap: () => void }) {
  const a = sim.activity!
  const t = a.trip!
  const left = Math.max(0, Math.ceil(a.end - sim.gameMinutes))
  const share = Math.min(1, Math.max(0, (sim.gameMinutes - a.start) / Math.max(1, a.end - a.start)))
  const line = world.metro?.stations ?? []
  const [i0, i1] = [line.findIndex((s) => s.commune === t.fromCommune), line.findIndex((s) => s.commune === t.commune)]
  const way = i0 >= 0 && i1 >= 0 ? (i0 <= i1 ? line.slice(i0, i1 + 1) : line.slice(i1, i0 + 1).reverse()) : []
  const stops = Math.max(1, way.length - 1)
  const next = way[Math.min(way.length - 1, Math.floor(share * stops) + 1)]
  return (
    <div className="absolute inset-0 z-20">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 62, near: 0.05, far: 600, position: [-0.6, 1.55, 7.6] }} onCreated={({ camera }) => camera.lookAt(0.3, 1.1, -4)}>
        <Ride sim={sim} night={night} stops={stops} share={share} />
        <RichAO />
      </Canvas>
      <div className="hud pointer-events-auto absolute top-[max(5.5rem,calc(env(safe-area-inset-top)+5rem))] left-1/2 w-[min(380px,calc(100vw-24px))] -translate-x-1/2 rounded-[22px] p-3">
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <TrainFront size={18} style={{ color: METRO }} />
          <span className="min-w-0 flex-1 truncate">{a.interaction.label}</span>
          <button className="icon-btn bg-[var(--color-canvas)] !h-9 !w-9" onClick={onMap} aria-label="Voir la carte">
            <MapIcon size={16} />
          </button>
        </div>
        {way.length > 1 && (
          <div className="mt-2 flex items-center">
            {way.map((s, i) => (
              <div key={s.commune} className="flex flex-1 items-center last:flex-none">
                <span className={`h-3 w-3 shrink-0 rounded-full border-2 ${i / stops <= share + 1e-6 ? 'border-[#f77f00] bg-[#f77f00]' : 'border-[#f77f00] bg-white'}`} title={s.name} />
                {i < way.length - 1 && <span className="h-[3px] flex-1" style={{ background: (i + 1) / stops <= share ? METRO : '#ffd8b0' }} />}
              </div>
            ))}
          </div>
        )}
        <div className="mt-1.5 text-xs font-bold text-[var(--color-ink-soft)]">{left > 0 && next ? `Prochaine station : ${next.name} · arrivée dans ${left} min` : 'Arrivée…'}</div>
      </div>
    </div>
  )
}
