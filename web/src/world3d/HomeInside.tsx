import { SpotActions } from './SpotActions'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Friend, Plot, Sim, World } from '../lib/types'
import { randomLook } from '../avatar/options'
import { rng } from './themes'
import { Character } from './Character'
import { CutHouse } from './build/CutHouse'
import { FurnitureSet } from './build/Furniture'
import { Zones, LotGround } from './build/Zones'
import { LotFence, ownerColor } from './build/Fence'
import { homeSpotsOf } from './homeSpots'
import { gridWay } from './gridPath'
import type { HomeSpot } from './Walker'
import { ActionProps, Pot, TvOn, Zzz } from './interior/ActionProps'
import { Hammer } from 'lucide-react'
import { Snapper } from './snapshot'
import { ChatFraming } from './chatFraming'
import { Swimmer } from './Swimmer'
import { listenKeys, moveInput } from './input'
import { RichAO } from './interior/bigPlace'

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

/** A point the Sim walks through: x, z (the lot's metres from its middle) and the height of its feet. */
type P = [number, number, number]

/**
 * Where one can walk on each level of the house (0 the ground floor, 1 the
 * first floor…): not where a wall stands at body height, nor furniture, nor
 * the pool; upstairs, only over the floor's slab. In the lot's metres from
 * its middle.
 */
function useLevels(plot: Plot, w: number, d: number, world: World) {
  return useMemo(() => {
    const has = new Set(plot.blocks.map((b) => `${b[0]},${b[1]},${b[2]}`))
    const cache = new Map<number, (x: number, z: number) => boolean>()
    return (level: number) => {
      const had = cache.get(level)
      if (had) return had
      const base = level * STOREY
      const taken = new Set<string>()
      for (const b of plot.blocks) if (b[1] === base + 1) taken.add(`${b[0]},${b[2]}`)
      for (const p of plot.furniture ?? []) {
        if (p[1] !== base) continue
        const f = world.furniture?.find((x) => x.id === p[4])
        if (!f) continue
        const [fw, fd] = p[3] % 2 ? [f.d, f.w] : [f.w, f.d]
        for (let i = 0; i < fw; i++) for (let j = 0; j < fd; j++) taken.add(`${p[0] + i},${p[2] + j}`)
      }
      if (level === 0) for (const z of plot.zones ?? []) if (z[4] === 'piscine') for (let i = 0; i < z[2]; i++) for (let j = 0; j < z[3]; j++) taken.add(`${z[0] + i},${z[1] + j}`)
      const free = (x: number, z: number) => {
        const [u, v] = [x + w / 2, z + d / 2]
        if (u < 0.25 || v < 0.25 || u > w - 0.25 || v > (level ? d - 0.25 : d + 2.5)) return false
        const [cx, cz] = [Math.floor(u), Math.floor(v)]
        if (taken.has(`${cx},${cz}`)) return false
        // Upstairs: on the slab (the roof of the floor below).
        return level === 0 || has.has(`${cx},${base - 1},${cz}`)
      }
      cache.set(level, free)
      return free
    }
  }, [plot, w, d, world.furniture])
}

/**
 * The flights of steps up to each floor (game/plans.go stairs: a step higher
 * each metre, four of them): where one starts (on the ground before the
 * first step), the steps with the height of each, and where one comes out
 * upstairs (the nearest free spot of the floor from the top step).
 */
function useFlights(plot: Plot, w: number, d: number, levels: (level: number) => (x: number, z: number) => boolean) {
  return useMemo(() => {
    const has = new Set(plot.blocks.map((b) => `${b[0]},${b[1]},${b[2]}`))
    // How many blocks stand one on the other from a height, in a column.
    const stack = (x: number, z: number, from: number) => {
      let n = 0
      while (has.has(`${x},${from + n},${z}`)) n++
      return n
    }
    const at = (cx: number, cz: number, y: number): P => [cx + 0.5 - w / 2, cz + 0.5 - d / 2, y]
    const out = new Map<number, { start: P; steps: P[]; landing: P }>()
    for (let level = 1; level * STOREY <= Math.max(0, ...plot.blocks.map((b) => b[1])); level++) {
      const base = (level - 1) * STOREY
      search: for (const b of plot.blocks) {
        if (b[1] !== base || stack(b[0], b[2], base) !== 1) continue
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let ok = true
          for (let k = 1; k < STOREY && ok; k++) ok = stack(b[0] + dx * k, b[2] + dz * k, base) === k + 1
          if (!ok) continue
          const top = [b[0] + dx * (STOREY - 1), b[2] + dz * (STOREY - 1)]
          // Out upstairs: the nearest free spot of the floor from the top step.
          const free = levels(level)
          let landing: P | null = null
          let best = Infinity
          for (let i = -5; i <= 5; i++)
            for (let j = -5; j <= 5; j++) {
              const p = at(top[0] + i, top[1] + j, level * STOREY)
              const dist = Math.hypot(i, j)
              if (dist > 0 && dist < best && free(p[0], p[1])) [landing, best] = [p, dist]
            }
          if (!landing) continue
          out.set(level, {
            start: at(b[0] - dx, b[2] - dz, base),
            steps: [...Array(STOREY)].map((_, k) => at(b[0] + dx * k, b[2] + dz * k, base + k + 1)),
            landing,
          })
          break search
        }
      }
    }
    // The staircases put in as furniture (« escalier »): each one goes from its floor to the one above.
    for (const p of plot.furniture ?? []) {
      if (p[4] !== 'escalier' || p[1] % STOREY !== 0) continue
      const level = p[1] / STOREY + 1
      if (out.has(level)) continue
      const [L, T] = [STOREY, (-p[3] * Math.PI) / 2]
      const [fw, fd] = p[3] % 2 ? [L, 1] : [1, L]
      // From the piece's own frame (x 0..1, z 0..4, its foot at +z) to the lot's, from its middle.
      const lot = (lx: number, lz: number, y: number): P => {
        const [u, v] = [lx - 0.5, lz - L / 2]
        const [x, z] = [u * Math.cos(T) + v * Math.sin(T), -u * Math.sin(T) + v * Math.cos(T)]
        return [p[0] + fw / 2 + x - w / 2, p[2] + fd / 2 + z - d / 2, y]
      }
      out.set(level, {
        start: lot(0.5, L + 0.5, p[1]),
        steps: [...Array(STOREY)].map((_, k) => lot(0.5, L - 0.5 - k, p[1] + k + 1)),
        landing: lot(0.5, -0.5, p[1] + STOREY),
      })
    }
    return out
  }, [plot, w, d, levels])
}

/** The Sim: walks its way, then settles on the spot (lying, sitting…). */
function Walking({ sim, stage, way, spot, doing, onThere, steer, onMoved, onLevel }: { sim: Sim; stage: string; way: P[]; spot: HomeSpot | null; /** What it does there: what shows it round it (ActionProps). */ doing?: string; onThere: (there: boolean) => void; /** Walking about: the keys or the pad move the Sim, where the ground is free. */ steer?: (x: number, z: number) => boolean; onMoved?: (at: XZ) => void; /** The floor the Sim is on now (going up or down the stairs). */ onLevel?: (level: number) => void }) {
  const g = useRef<THREE.Group>(null)
  const camera = useThree((st) => st.camera)
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  const manual = useRef(false)
  const at = useRef<{ x: number; y: number; z: number; rot: number }>({ x: way[0]?.[0] ?? 0, y: way[0]?.[2] ?? 0, z: way[0]?.[1] ?? 0, rot: Math.PI })
  const level = useRef(0)
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
      o.position.set(a.x, a.y, a.z)
      o.rotation.set(0, a.rot, 0)
      return
    }
    if (manual.current) {
      manual.current = false
      setWalking(false)
      onMoved?.([a.x, a.z])
    }
    if (step.current < way.length) {
      const [tx, tz, ty] = way[step.current]
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
        // Up or down the steps as it goes.
        a.y += (ty - a.y) * (m / len)
        a.x += (dx / len) * m
        a.z += (dz / len) * m
        const want = Math.atan2(dx, dz)
        a.rot += Math.atan2(Math.sin(want - a.rot), Math.cos(want - a.rot)) * Math.min(1, dt * 10)
      }
      o.position.set(a.x, a.y, a.z)
      o.rotation.set(0, a.rot, 0)
      // Up (or down) a floor: the view goes with it.
      const now = Math.round(a.y / STOREY)
      if (now !== level.current) {
        level.current = now
        onLevel?.(now)
      }
    } else if (!spot) {
      o.position.set(a.x, a.y, a.z)
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
          <ActionProps id={doing} kind="house" lying={spot.lying} stage={stage} />
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

export function HomeInside({ sim, world, plot, interactionId, roam, night, stage, onBuild, partner }: { sim: Sim; world: World; plot: Plot; interactionId?: string; /** Just come in: tap the ground to walk. */ roam?: boolean; night: boolean; stage: string; /** Change the house: walls, furniture (components/BuildMode). */ onBuild?: () => void; /** The boyfriend or girlfriend living here. */ partner?: Friend }) {
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
  const levels = useLevels(plot, w, d, world)
  const flights = useFlights(plot, w, d, levels)
  // The floor the Sim is on (where it walks); the one looked at follows it.
  const lvl = useRef(0)
  // The arrow keys and WASD walk the Sim about the house.
  useEffect(() => (roam && !interactionId ? listenKeys() : undefined), [roam, interactionId])
  // Where each thing is done, in the lot's metres from its middle.
  const spots = useMemo(() => {
    const out = world.furniture ? homeSpotsOf(plot, [w, d], [0, 0], 0, world.furniture) : {}
    // Off to school: out at the gate, turned back to wave to the house, the bag on the back.
    out['aller-ecole'] = { at: [0, d / 2 + 1.2], from: [0, d / 2 + 1.2], y: 0, rot: Math.PI, pose: 'wave', lying: false }
    // Playing in the cour: the first free bit of the yard from the gate in, with room round it for the ball.
    const free = levels(0)
    search: for (let v = d / 2 - 2.5; v > -d / 2; v -= 0.5)
      for (const u of [0, 1, -1, 2, -2, 3, -3])
        if (free(u, v) && free(u, v - 0.7) && free(u + 0.6, v) && free(u - 0.6, v)) {
          out['jouer-cour'] = { at: [u, v], from: [u, v], y: 0, rot: Math.PI, pose: 'kick', lying: false }
          break search
        }
    return out
  }, [plot, w, d, world.furniture, levels])
  // A Golvo meal (golvo-garba…): at the table; no table, on a seat. Something from the fridge: a drink at its door, a dish at the table.
  const fromFridge = interactionId?.startsWith('frigo-') ? world.groceries?.find((g) => `frigo-${g.id}` === interactionId) : undefined
  const atTable = spots.golvo ?? (spots['watch-tv'] && { ...spots['watch-tv'], pose: 'eat' as const })
  const spot = interactionId ? ((interactionId.startsWith('golvo-') ? atTable : fromFridge ? (fromFridge.drink ? spots.frigo : (atTable ?? spots.frigo)) : spots[interactionId]) ?? null) : null
  const gate: XZ = [0, d / 2 + 1.5]
  // Where to walk to (a tap on the floor, a floor's button), and on which floor.
  const [tapped, setTapped] = useState<{ at: XZ; level: number } | null>(null)
  useEffect(() => setTapped(null), [interactionId])
  const where = useRef<XZ>(gate)
  const way = useMemo<P[]>(() => {
    const to = spot ? { at: spot.from, level: 0 } : tapped
    const from = where.current
    const fromL = lvl.current
    const flat = (a: XZ, b: XZ, level: number): P[] => (gridWay(a, b, levels(level), 0.4, span, 200 * 200) ?? [a, b]).map(([x, z]) => [x, z, level * STOREY])
    if (!to) return [[from[0], from[1], fromL * STOREY]]
    if (to.level === fromL) return flat(from, to.at, fromL)
    // Another floor: by the stairs, one floor at a time.
    const out: P[] = [[from[0], from[1], fromL * STOREY]]
    let [at, level] = [from, fromL]
    while (level !== to.level) {
      const up = to.level > level
      const f = flights.get(up ? level + 1 : level)
      if (!f) break
      if (up) {
        out.push(...flat(at, [f.start[0], f.start[1]], level), ...f.steps, f.landing)
        ;[at, level] = [[f.landing[0], f.landing[1]], level + 1]
      } else {
        out.push(...flat(at, [f.landing[0], f.landing[1]], level), ...[...f.steps].reverse(), f.start)
        ;[at, level] = [[f.start[0], f.start[1]], level - 1]
      }
    }
    if (level === to.level) out.push(...flat(at, to.at, level))
    return out
  }, [spot, tapped]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const last = way[way.length - 1]
    where.current = [last[0], last[1]]
    lvl.current = Math.round(last[2] / STOREY)
  }, [way])
  const [there, setThere] = useState(false)
  // A night together: once both are in the bed, the screen goes slowly to black.
  const night2 = interactionId === 'passer-nuit'
  const [dark, setDark] = useState(false)
  useEffect(() => {
    if (!night2 || !there) return setDark(false)
    const t = setTimeout(() => setDark(true), 1500)
    return () => clearTimeout(t)
  }, [night2, there])
  // The floors above the one looked at are off; its own walls full height, but down to one block between the camera and the Sim (build/CutHouse).
  const cut = floor * STOREY + 3
  const pieces = useMemo(() => (plot.furniture ?? []).filter((p) => p[1] < cut), [plot.furniture, cut])
  const name = sim.firstName
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [span * 0.55, span * 0.85, span * 0.95], fov: 42 }} style={{ background: night ? '#0b1026' : '#a9d3f0' }}>
        <Snapper />
        <ChatFraming />
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
            {plot.zones?.length ? <Zones zones={plot.zones} blocks={plot.blocks} furniture={plot.furniture ?? []} w={w} d={d} cut /> : <LotGround w={w} d={d} />}
            <LotFence w={w} d={d} color={ownerColor(sim.id)} name={`Chez ${name}`} />
          </group>
          {roam && !interactionId && (
            // The ground, to tap where to walk (a drag turns the camera instead).
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, floor * STOREY + 0.09, 0]}
              onClick={(e) => {
                if (e.delta > 6) return
                e.stopPropagation()
                const p: XZ = [e.point.x, e.point.z]
                if (levels(floor)(p[0], p[1])) setTapped({ at: p, level: floor })
              }}
            >
              <planeGeometry args={[w, d]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          )}
          {partner && <Partner friend={partner} spots={spots} doing={interactionId} spot={spot} />}
          <Walking sim={sim} stage={stage} way={way} spot={spot} doing={interactionId} onThere={setThere} steer={roam && !interactionId ? levels(lvl.current) : undefined} onMoved={(p) => ((where.current = p), setTapped(null))} onLevel={setFloor} />
          {there && interactionId === 'cook-attieke' && spot && (
            <group position={[spot.at[0] + Math.sin(spot.rot) * 0.6, 0, spot.at[1] + Math.cos(spot.rot) * 0.6]}>
              <Pot />
            </group>
          )}
          {there && spot?.screen && (
            <group position={[spot.screen.at[0], 0, spot.screen.at[1]]} rotation={[0, spot.screen.rot, 0]}>
              <TvOn y={spot.screen.y} w={spot.screen.w} h={spot.screen.h} />
            </group>
          )}
          {there && spot?.lying && /^(sleep|nap)$/.test(interactionId ?? '') && <Zzz at={[spot.at[0], spot.y + 0.8, spot.at[1]]} />}
          {/* What's done here, over where it's done (SpotActions): tap one, the Sim goes */}
          <SpotActions shown={!!roam && !interactionId} where={(id) => (spots[id] ? [spots[id].at[0], spots[id].y, spots[id].at[1]] : null)} entrance={[gate[0], 0, gate[1]]} />
          <OrbitControls makeDefault target={[0, 0, 0]} enablePan={false} minDistance={4} maxDistance={span * 2.2} minPolarAngle={0.3} maxPolarAngle={1.2} enableDamping />
          <Focus on={there && spot ? [spot.at[0], 0, spot.at[1]] : null} span={span} />
        </Suspense>
        <RichAO />
      </Canvas>
      {/* Fade to black: nothing is shown of the night */}
      {night2 && (
        <div className={`pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[#05060f] transition-opacity duration-[2500ms] ${dark ? 'opacity-100' : 'opacity-0'}`}>
          <div className="text-center text-white/85">
            <div className="text-5xl">🌙</div>
            <p className="mt-3 font-display text-xl font-extrabold">Bonne nuit…</p>
            {partner && <p className="mt-1 text-sm font-bold text-white/60">{sim.firstName} et {partner.name} passent la nuit ensemble</p>}
          </div>
        </div>
      )}
      {onBuild && (
        <button className="hud absolute top-[max(5rem,calc(env(safe-area-inset-top)+4.5rem))] left-3 z-10 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold" onClick={onBuild}>
          <Hammer size={17} strokeWidth={2.6} className="text-[var(--color-orange)]" /> Modifier la maison
        </button>
      )}
      {floors > 1 && (
        <div className="absolute top-1/2 right-3 z-10 flex -translate-y-1/2 flex-col gap-1.5">
          {[...Array(floors)].map((_, i) => floors - 1 - i).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFloor(f)
                // Just come in: the Sim goes up (or down) the stairs to that floor.
                const flight = flights.get(Math.max(f, 1))
                if (roam && !interactionId && f !== lvl.current && flight) setTapped({ at: f > 0 ? [flight.landing[0], flight.landing[1]] : [flight.start[0], flight.start[1]], level: f })
              }}
              className={`rounded-2xl px-3 py-2 text-xs font-extrabold shadow-md ${floor === f ? 'bg-[var(--color-orange)] text-white' : 'bg-white text-[var(--color-ink)]'}`}>
              {f === 0 ? 'Rez-de-chaussée' : f === 1 ? '1er étage' : `${f}e étage`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * One's partner at home: on the sofa (beside the Sim if it's there too), and
 * in the bed beside it for a night together. Their look is their own, kept
 * from their id.
 */
function Partner({ friend, spots, doing, spot }: { friend: Friend; spots: Record<string, HomeSpot>; doing?: string; spot: HomeSpot | null }) {
  const look = useMemo(() => friend.look ?? randomLook(friend.gender, rng(`partner${friend.id}`)), [friend.id, friend.gender, friend.look])
  // Beside the Sim on the same piece (the other half of the bed, the sofa), or on the sofa.
  const with_ = doing === 'passer-nuit' || doing === 'watch-tv' ? spot : null
  const at = with_ ?? spots['watch-tv'] ?? spots.sleep
  if (!at) return null
  const side = with_ ? 0.9 : 0
  const [x, z] = [at.at[0] + Math.cos(at.rot) * side, at.at[1] - Math.sin(at.rot) * side]
  return (
    <group position={[x, at.y, z]} rotation={[0, at.rot, 0]}>
      <group rotation={at.lying ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
        <Character look={look} gender={friend.gender} pose={at.pose} marker={false} moodColor="#e0245e" />
      </group>
    </group>
  )
}
