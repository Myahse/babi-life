import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Plot, Sim, World } from '../lib/types'
import { Character } from './Character'
import { CutHouse } from './build/CutHouse'
import { FurnitureSet } from './build/Furniture'
import { Zones, LotGround } from './build/Zones'
import { LotFence, ownerColor } from './build/Fence'
import { homeSpotsOf } from './homeSpots'
import { gridWay } from './gridPath'
import type { HomeSpot } from './Walker'
import { Pot, TvOn, Zzz } from './interior/ActionProps'
import { Hammer } from 'lucide-react'
import { Snapper } from './snapshot'
import { Swimmer } from './Swimmer'
import { listenKeys, moveInput } from './input'

// Inside one's own house, on a screen of its own: the house itself (the one
// of the family's plan, or the one built on a bought lot), its rooms, its
// furniture, the garden, the pool and the clôture, and nothing of the street
// but the road in front. The roof and the floors above are off, to see in;
// on a duplex or a triplex, buttons look at each floor. The Sim comes in by
// the gate and walks round the walls and the furniture to where the thing is
// done (the bed, the shower, the gazinière, the sofa, the table); just come
// in, a tap on the ground walks it there.

type XZ = [number, number]

/** A level of the house is this many blocks high (game/plans.go Storey). */
const STOREY = 4
const SPEED = 1.7

/** The cells one can't walk through on the ground floor: walls, furniture, the pool. */
function useBlocked(plot: Plot, w: number, d: number, world: World) {
  return useMemo(() => {
    const taken = new Set<string>()
    for (const b of plot.blocks) if (b[1] === 1) taken.add(`${b[0]},${b[2]}`)
    for (const p of plot.furniture ?? []) {
      if (p[1] > 0) continue
      const f = world.furniture?.find((x) => x.id === p[4])
      if (!f) continue
      const [fw, fd] = p[3] % 2 ? [f.d, f.w] : [f.w, f.d]
      for (let i = 0; i < fw; i++) for (let j = 0; j < fd; j++) taken.add(`${p[0] + i},${p[2] + j}`)
    }
    for (const z of plot.zones ?? []) if (z[4] === 'piscine') for (let i = 0; i < z[2]; i++) for (let j = 0; j < z[3]; j++) taken.add(`${z[0] + i},${z[1] + j}`)
    // In the lot's own metres from its middle (as the Sim walks).
    return (x: number, z: number) => {
      const [u, v] = [x + w / 2, z + d / 2]
      if (u < 0.25 || v < 0.25 || u > w - 0.25 || v > d + 2.5) return false
      return !taken.has(`${Math.floor(u)},${Math.floor(v)}`)
    }
  }, [plot, w, d, world.furniture])
}

/** The Sim: walks its way, then settles on the spot (lying, sitting…). */
function Walking({ sim, stage, way, spot, onThere, steer, onMoved }: { sim: Sim; stage: string; way: XZ[]; spot: HomeSpot | null; onThere: (there: boolean) => void; /** Walking about: the keys or the pad move the Sim, where the ground is free. */ steer?: (x: number, z: number) => boolean; onMoved?: (at: XZ) => void }) {
  const g = useRef<THREE.Group>(null)
  const camera = useThree((st) => st.camera)
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  const manual = useRef(false)
  const at = useRef<{ x: number; z: number; rot: number }>({ x: way[0]?.[0] ?? 0, z: way[0]?.[1] ?? 0, rot: Math.PI })
  const step = useRef(1)
  const settle = useRef(0)
  const [walking, setWalking] = useState(way.length > 1)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    step.current = 1
    settle.current = 0
    setWalking(way.length > 1)
    setSettled(false)
    onThere(false)
  }, [way]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dtIn) => {
    const o = g.current
    if (!o) return
    const dt = Math.min(dtIn, 0.05)
    const a = at.current
    // The keys or the pad, as seen from the camera: forward is away from it.
    const m = steer && !spot ? moveInput() : null
    if (m && Math.hypot(m.x, m.y) > 0.15) {
      const f = new THREE.Vector3()
      camera.getWorldDirection(f)
      const fl = Math.hypot(f.x, f.z) || 1
      const [fx, fz] = [f.x / fl, f.z / fl]
      const [mx, mz] = [fx * m.y - fz * m.x, fz * m.y + fx * m.x]
      // Along each axis on its own, so the Sim slides along a wall instead of sticking to it.
      const nx = a.x + mx * SPEED * dt
      if (steer!(nx, a.z)) a.x = nx
      const nz = a.z + mz * SPEED * dt
      if (steer!(a.x, nz)) a.z = nz
      const want = Math.atan2(mx, mz)
      a.rot += Math.atan2(Math.sin(want - a.rot), Math.cos(want - a.rot)) * Math.min(1, dt * 10)
      step.current = way.length
      // The camera comes along, at the same distance and angle.
      if (controls) {
        const [ox, oz] = [(a.x - controls.target.x) * Math.min(1, dt * 4), (a.z - controls.target.z) * Math.min(1, dt * 4)]
        controls.target.x += ox
        controls.target.z += oz
        camera.position.x += ox
        camera.position.z += oz
        controls.update()
      }
      if (!manual.current) {
        manual.current = true
        setWalking(true)
      }
      o.position.set(a.x, 0, a.z)
      o.rotation.set(0, a.rot, 0)
      return
    }
    if (manual.current) {
      manual.current = false
      setWalking(false)
      onMoved?.([a.x, a.z])
    }
    if (step.current < way.length) {
      const [tx, tz] = way[step.current]
      const [dx, dz] = [tx - a.x, tz - a.z]
      const len = Math.hypot(dx, dz)
      if (len < 0.05) {
        step.current++
        if (step.current >= way.length) {
          setWalking(false)
          if (!spot) onThere(true)
        }
      } else {
        const m = Math.min(len, SPEED * dt)
        a.x += (dx / len) * m
        a.z += (dz / len) * m
        const want = Math.atan2(dx, dz)
        a.rot += Math.atan2(Math.sin(want - a.rot), Math.cos(want - a.rot)) * Math.min(1, dt * 10)
      }
      o.position.set(a.x, 0, a.z)
      o.rotation.set(0, a.rot, 0)
    } else if (!spot) {
      o.position.set(a.x, 0, a.z)
      o.rotation.set(0, a.rot, 0)
    } else {
      // From in front of the piece onto it: into the bed, onto the sofa.
      settle.current = Math.min(1, settle.current + dt * 1.6)
      const e = settle.current
      o.position.set(a.x + (spot.at[0] - a.x) * e, spot.y * e, a.z + (spot.at[1] - a.z) * e)
      const turn = Math.atan2(Math.sin(spot.rot - a.rot), Math.cos(spot.rot - a.rot))
      o.rotation.set(0, a.rot + turn * e, 0)
      if (e >= 1 && !settled) {
        a.x = spot.at[0]
        a.z = spot.at[1]
        a.rot = spot.rot
        setSettled(true)
        onThere(true)
      }
    }
  })
  const look = spot?.pose === 'wash' ? { ...sim.look, outfit: 'serviette', accessory: 'none' } : sim.look
  return (
    <group ref={g}>
      {settled && spot?.swim ? (
        <Swimmer len={spot.swim} look={{ ...sim.look, outfit: 'maillot', accessory: 'none' }} gender={sim.gender} stage={stage} />
      ) : settled && spot ? (
        <group rotation={spot.lying ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
          {spot.stool && (
            <mesh position={[0, 0.2 - spot.y, -0.05]}>
              <boxGeometry args={[0.38, 0.4, 0.38]} />
              <meshLambertMaterial color="#7a5233" />
            </mesh>
          )}
          <Character look={look} gender={sim.gender} pose={spot.pose} stage={stage} marker={!spot.lying} />
        </group>
      ) : (
        <Character look={sim.look} gender={sim.gender} walking={walking} stage={stage} speed={SPEED} />
      )}
    </group>
  )
}

/** The camera: over the whole house, then close on the Sim once it's doing something. */
function Focus({ on, span }: { on: [number, number, number] | null; span: number }) {
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  const camera = useThree((st) => st.camera)
  const goal = useRef<{ target: THREE.Vector3; pos: THREE.Vector3; t: number } | null>(null)
  const key = on ? on.map((v) => v.toFixed(1)).join() : 'all'
  useEffect(() => {
    const target = on ? new THREE.Vector3(on[0], 0.8, on[2]) : new THREE.Vector3(0, 0, 0)
    const dir = camera.position.clone().sub(controls?.target ?? new THREE.Vector3()).normalize()
    const dist = on ? 7.5 : span * 1.15
    goal.current = { target, pos: target.clone().add(dir.multiplyScalar(dist)), t: 0 }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const gl = goal.current
    if (!gl || !controls) return
    gl.t = Math.min(1, gl.t + dt * 1.2)
    const k = Math.min(1, dt * 3)
    controls.target.lerp(gl.target, k)
    camera.position.lerp(gl.pos, k)
    controls.update()
    if (gl.t >= 1) goal.current = null
  })
  return null
}

export function HomeInside({ sim, world, plot, interactionId, roam, night, stage, onBuild }: { sim: Sim; world: World; plot: Plot; interactionId?: string; /** Just come in: tap the ground to walk. */ roam?: boolean; night: boolean; stage: string; /** Change the house: walls, furniture (components/BuildMode). */ onBuild?: () => void }) {
  const [w, d] = [plot.lot?.w ?? 12, plot.lot?.d ?? 12]
  const span = Math.max(w, d)
  const floors = useMemo(() => {
    const top = Math.max(0, ...plot.blocks.map((b) => b[1]))
    return Math.max(1, Math.ceil((top + 1) / STOREY) - (top % STOREY === 0 && top > 0 ? 1 : 0))
  }, [plot.blocks])
  const [floor, setFloor] = useState(0)
  // Doing something: down on the ground floor, where it's done.
  useEffect(() => {
    if (interactionId) setFloor(0)
  }, [interactionId])
  const free = useBlocked(plot, w, d, world)
  // The arrow keys and WASD walk the Sim about the house.
  useEffect(() => (roam && !interactionId ? listenKeys() : undefined), [roam, interactionId])
  // Where each thing is done, in the lot's metres from its middle.
  const spots = useMemo(() => (world.furniture ? homeSpotsOf(plot, [w, d], [0, 0], 0, world.furniture) : {}), [plot, w, d, world.furniture])
  const spot = interactionId ? (spots[interactionId === 'golvo' ? 'golvo' : interactionId] ?? null) : null
  const gate: XZ = [0, d / 2 + 1.5]
  const [tapped, setTapped] = useState<XZ | null>(null)
  useEffect(() => setTapped(null), [interactionId])
  const where = useRef<XZ>(gate)
  const way = useMemo<XZ[]>(() => {
    const to: XZ | null = spot ? spot.from : tapped
    const from = where.current
    if (!to) return [from]
    const path = gridWay(from, to, free, 0.4, span, 200 * 200) ?? [from, to]
    return path
  }, [spot, tapped]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    where.current = way[way.length - 1]
  }, [way])
  const [there, setThere] = useState(false)
  // The floors above the one looked at are off; its own walls full height, but down to one block between the camera and the Sim (build/CutHouse).
  const cut = floor * STOREY + 3
  const pieces = useMemo(() => (plot.furniture ?? []).filter((p) => p[1] < cut), [plot.furniture, cut])
  const name = sim.firstName
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [span * 0.55, span * 0.85, span * 0.95], fov: 42 }} style={{ background: night ? '#0b1026' : '#a9d3f0' }}>
        <Snapper />
        <Suspense fallback={null}>
          <hemisphereLight args={[night ? '#5a6ab0' : '#ffffff', '#b8a27c', night ? 0.55 : 1.15]} />
          <directionalLight position={[20, 40, 25]} intensity={night ? 0.35 : 1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span} />
          {night && <pointLight position={[0, 2.6, 0]} intensity={18} distance={span * 1.4} color="#ffd9a0" />}
          {/* The earth round the lot, and the road in front of the gate */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
            <planeGeometry args={[400, 400]} />
            <meshLambertMaterial color="#b98b5c" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, d / 2 + 6]} receiveShadow>
            <planeGeometry args={[400, 7]} />
            <meshLambertMaterial color="#4a4a4f" />
          </mesh>
          <group position={[-w / 2, 0, -d / 2]}>
            {world.materials && <CutHouse blocks={plot.blocks} materials={world.materials} top={cut} base={floor * STOREY} />}
            {world.furniture && <FurnitureSet pieces={pieces} catalog={world.furniture} />}
            {plot.zones?.length ? <Zones zones={plot.zones} blocks={plot.blocks} furniture={plot.furniture ?? []} w={w} d={d} /> : <LotGround w={w} d={d} />}
            <LotFence w={w} d={d} color={ownerColor(sim.id)} name={`Chez ${name}`} />
          </group>
          {roam && !interactionId && (
            // The ground, to tap where to walk (a drag turns the camera instead).
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.09, 0]}
              onClick={(e) => {
                if (e.delta > 6) return
                e.stopPropagation()
                const p: XZ = [e.point.x, e.point.z]
                if (free(p[0], p[1])) setTapped(p)
              }}
            >
              <planeGeometry args={[w, d]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          )}
          <Walking sim={sim} stage={stage} way={way} spot={spot} onThere={setThere} steer={roam && !interactionId ? free : undefined} onMoved={(p) => ((where.current = p), setTapped(null))} />
          {there && interactionId === 'cook-attieke' && spot && (
            <group position={[spot.at[0] + Math.sin(spot.rot) * 0.6, 0, spot.at[1] + Math.cos(spot.rot) * 0.6]}>
              <Pot />
            </group>
          )}
          {there && spot?.screen && (
            <group position={[spot.screen.at[0], 0, spot.screen.at[1]]} rotation={[0, spot.screen.rot, 0]}>
              <TvOn />
            </group>
          )}
          {there && spot?.lying && /^(sleep|nap)$/.test(interactionId ?? '') && <Zzz at={[spot.at[0], spot.y + 0.8, spot.at[1]]} />}
          <OrbitControls makeDefault target={[0, 0, 0]} enablePan={false} minDistance={4} maxDistance={span * 2.2} minPolarAngle={0.3} maxPolarAngle={1.2} enableDamping />
          <Focus on={there && spot ? [spot.at[0], 0, spot.at[1]] : null} span={span} />
        </Suspense>
      </Canvas>
      {onBuild && (
        <button className="hud absolute top-[max(5rem,calc(env(safe-area-inset-top)+4.5rem))] left-3 z-10 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold" onClick={onBuild}>
          <Hammer size={17} strokeWidth={2.6} className="text-[var(--color-orange)]" /> Modifier la maison
        </button>
      )}
      {floors > 1 && (
        <div className="absolute top-1/2 right-3 z-10 flex -translate-y-1/2 flex-col gap-1.5">
          {[...Array(floors)].map((_, i) => floors - 1 - i).map((f) => (
            <button key={f} onClick={() => setFloor(f)} className={`rounded-2xl px-3 py-2 text-xs font-extrabold shadow-md ${floor === f ? 'bg-[var(--color-orange)] text-white' : 'bg-white text-[var(--color-ink)]'}`}>
              {f === 0 ? 'Rez-de-chaussée' : f === 1 ? '1er étage' : `${f}e étage`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
