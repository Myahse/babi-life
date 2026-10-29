import { SpotActions } from './SpotActions'
import { sceneDpr } from '../lib/device'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Friend, Look, Plot, Sim, World } from '../lib/types'
import { randomLook } from '../avatar/options'
import { rng } from './themes'
import { Character } from './Character'
import { NeedsAura } from './NeedsAura'
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
import { familyCast } from '../avatar/Family'
import { Talkable } from './Talkable'
import { doingOf } from './talk'
import { clock, weekdayOf } from '../game/rules'
import { carer } from './carer'
import { setHomeArrived, useGesture, useHomeStep } from './gesture'
import { tint } from '../avatar/textures'
import { GiftChest } from '../components/GiftDrawer'

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
function Walking({ sim, stage, way, spot, doing, onThere, steer, onMoved, onLevel, follow }: { /** The camera keeps on the Sim, close (a played action's steps: from the bed to the basin and back). */ follow?: boolean; sim: Sim; stage: string; way: P[]; spot: HomeSpot | null; /** What it does there: what shows it round it (ActionProps). */ doing?: string; onThere: (there: boolean) => void; /** Walking about: the keys or the pad move the Sim, where the ground is free. */ steer?: (x: number, z: number) => boolean; onMoved?: (at: XZ) => void; /** The floor the Sim is on now (going up or down the stairs). */ onLevel?: (level: number) => void }) {
  const g = useRef<THREE.Group>(null)
  const camera = useThree((st) => st.camera)
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  const manual = useRef(false)
  const at = useRef<{ x: number; y: number; z: number; rot: number }>({ x: way[0]?.[0] ?? 0, y: way[0]?.[2] ?? 0, z: way[0]?.[1] ?? 0, rot: Math.PI })
  const level = useRef(Math.round((way[0]?.[2] ?? 0) / STOREY))
  const step = useRef(1)
  const settle = useRef(0)
  const [walking, setWalking] = useState(way.length > 1)
  const [settled, setSettled] = useState(false)
  // Following: the camera close on the Sim wherever it goes, at its angle.
  useFrame((_, dt) => {
    const o = g.current
    if (!follow || !o || !controls) return
    const k = Math.min(1, dt * 3)
    // From where the camera already looks (its bearing kept), 40° up, 6.5 m off: the Sim and what's round it.
    const flat = camera.position.clone().sub(controls.target).setY(0)
    if (flat.lengthSq() < 0.01) flat.set(0, 0, 1)
    flat.normalize()
    const want = flat.multiplyScalar(6.5 * Math.cos(0.7)).setY(6.5 * Math.sin(0.7))
    controls.target.x += (o.position.x - controls.target.x) * k
    controls.target.y += (0.9 + o.position.y - controls.target.y) * k
    controls.target.z += (o.position.z - controls.target.z) * k
    const off = camera.position.clone().sub(controls.target).lerp(want, k)
    camera.position.copy(controls.target).add(off)
    controls.update()
  })
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
  // A gesture played (the home's gestures, components/defi/Gestes.tsx): made a moment over the action's pose (not lying in bed).
  const gestureNow = useGesture()
  const pose = gestureNow && !spot?.lying ? gestureNow : spot?.pose
  const look = spot?.pose === 'wash' ? { ...sim.look, outfit: 'serviette', accessory: 'none' } : sim.look
  return (
    <group ref={g} name="me">
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
          <Character look={look} gender={sim.gender} pose={pose} stage={stage} marker={!spot.lying} />
          <ActionProps id={doing} kind="house" lying={spot.lying} stage={stage} {...(sim.family ? babyCare(sim.family, sim.look) : {})} />
        </group>
      ) : (
        <NeedsAura needs={sim.needs} stage={stage} walking={walking}>
          <Character look={sim.look} gender={sim.gender} walking={walking} stage={stage} speed={SPEED} />
        </NeedsAura>
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

/** The arrival's moment at home (components/Arrival.tsx): the camera turning slowly round the Sim, close, its family about it. */
function CloseUp({ at }: { at: React.RefObject<XZ | null> }) {
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  useFrame(({ camera, clock }) => {
    const [x, z] = at.current ?? [0, 0]
    const a = 0.5 + clock.elapsedTime * 0.12
    const r = Math.max(3.6, 6.5 - clock.elapsedTime * 0.5)
    camera.position.set(x + Math.sin(a) * r, 2.6 + r * 0.25, z + Math.cos(a) * r)
    if (controls) {
      controls.target.set(x, 0.7, z)
      controls.update()
    } else camera.lookAt(x, 0.7, z)
  })
  return null
}

export function HomeInside({ sim, world, plot, interactionId, roam, night, stage, onBuild, partner, parents, closeUp, drawer }: { /** The friends' gifts (update « parrainage »): the drawer that holds them, how many wait, a tap opens it. */ drawer?: { count: number; onOpen: () => void }; /** The arrival: the camera close on the Sim, turning round it. */ closeUp?: boolean; sim: Sim; world: World; plot: Plot; interactionId?: string; /** Just come in: tap the ground to walk. */ roam?: boolean; night: boolean; stage: string; /** Change the house: walls, furniture (components/BuildMode). */ onBuild?: () => void; /** The boyfriend or girlfriend living here. */ partner?: Friend; /** Still a child at the family's home: papa and maman are there. */ parents?: boolean }) {
  const [w, d] = [plot.lot?.w ?? 12, plot.lot?.d ?? 12]
  const span = Math.max(w, d)
  const floors = useMemo(() => {
    const top = Math.max(0, ...plot.blocks.map((b) => b[1]))
    return Math.max(1, Math.ceil((top + 1) / STOREY) - (top % STOREY === 0 && top > 0 ? 1 : 0))
  }, [plot.blocks])
  // Where the Sim last stood in the house (this browser): back there when the page opens again, not at the gate.
  const memKey = `babi.home.${sim.id}.${plot.key ?? plot.id}`
  const [kept] = useState<[number, number, number] | null>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(memKey) ?? 'null')
      return Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? (v as [number, number, number]) : null
    } catch {
      return null
    }
  })
  const keep = (p: XZ, level: number) => {
    try {
      localStorage.setItem(memKey, JSON.stringify([Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100, level]))
    } catch {
      // No storage: from the gate next time.
    }
  }
  const [floor, setFloor] = useState(kept?.[2] ?? 0)
  // Doing something: down on the ground floor, where it's done.
  useEffect(() => {
    if (interactionId) setFloor(0)
  }, [interactionId])
  const levels = useLevels(plot, w, d, world)
  const flights = useFlights(plot, w, d, levels)
  // The floor the Sim is on (where it walks); the one looked at follows it.
  const lvl = useRef(kept?.[2] ?? 0)
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
  // The drawer of gifts: against a wall under the roof, out of the way of where things are done; else in the yard.
  const drawerAt = useMemo(() => {
    if (!drawer) return null
    const free = levels(0)
    const solid = new Set(plot.blocks.map((b) => `${b[0]},${b[1]},${b[2]}`))
    const roof = new Set(plot.blocks.filter((b) => b[1] >= 2).map((b) => `${b[0]},${b[2]}`))
    const used = Object.values(spots).flatMap((p) => [p.from, p.at])
    const clear = (u: number, v: number) => free(u, v) && used.every((q) => Math.hypot(q[0] - u, q[1] - v) > 0.9) && Math.hypot(u, d / 2 + 1.5 - v) > 2.5
    // The best spot: under the roof against one wall, then against a wall (even outside), then the yard near the middle.
    let best: { at: XZ; rot: number; score: number } | null = null
    for (let cz = 0; cz < d; cz++)
      for (let cx = 0; cx < w; cx++) {
        const [u, v] = [cx + 0.5 - w / 2, cz + 0.5 - d / 2]
        if (!clear(u, v)) continue
        // The wall behind it (a block at body height next to it): it faces away from it, into the room.
        const walls = ([[0, -1], [0, 1], [-1, 0], [1, 0]] as const).filter(([dx, dz]) => solid.has(`${cx + dx},1,${cz + dz}`))
        const open = ([[0, -1], [0, 1], [-1, 0], [1, 0]] as const).filter(([dx, dz]) => free(u + dx, v + dz)).length
        if (open < 2) continue
        const score = (roof.has(`${cx},${cz}`) ? 100 : 0) + (walls.length ? 50 : 0) - Math.hypot(u, v)
        if (!best || score > best.score) best = { at: [u, v], rot: walls.length ? Math.atan2(-walls[0][0], -walls[0][1]) : 0, score }
      }
    return best
  }, [!!drawer, plot, w, d, levels, spots]) // eslint-disable-line react-hooks/exhaustive-deps
  // Where the Sim can walk: the house's floors, less the drawer of gifts (its 0.96 × 0.56 top, and a little room round it).
  const walk = useMemo(() => {
    if (!drawerAt) return levels
    const [x, z] = drawerAt.at
    const [c, sn] = [Math.cos(drawerAt.rot), Math.sin(drawerAt.rot)]
    return (level: number) => {
      const free = levels(level)
      if (level !== 0) return free
      return (u: number, v: number) => {
        const [du, dv] = [u - x, v - z]
        return free(u, v) && !(Math.abs(du * c - dv * sn) < 0.68 && Math.abs(du * sn + dv * c) < 0.48)
      }
    }
  }, [levels, drawerAt])
  // A Garbaya meal (golvo-garba…): at the table; no table, on a seat. Something from the fridge: a drink at its door, a dish at the table.
  const fromFridge = interactionId?.startsWith('frigo-') ? world.groceries?.find((g) => `frigo-${g.id}` === interactionId) : undefined
  const atTable = spots.golvo ?? (spots['watch-tv'] && { ...spots['watch-tv'], pose: 'eat' as const })
  // A baby sleeps in its cot.
  const cot = stage === 'bebe' && /^(sleep|nap)$/.test(interactionId ?? '') ? spots.berceau : undefined
  // A played action's step (components/defi/Gestes.tsx): done where it's done in the house, standing
  // by the bed to make it, at the basin for the teeth, under the shower: the Sim walks there.
  const step = useHomeStep()
  // (Kept the same object while the step is the same: a new one each render would send the Sim off again and again.)
  const stepSpot = useMemo(() => (step && spots[step.at] ? { ...spots[step.at], pose: step.pose, ...(step.standing ? { at: spots[step.at].from, y: 0, lying: false } : {}) } : null), [step, spots])
  const spot = stepSpot ?? cot ?? (interactionId ? ((interactionId.startsWith('golvo-') ? atTable : fromFridge ? (fromFridge.drink ? spots.frigo : (atTable ?? spots.frigo)) : spots[interactionId]) ?? null) : null)
  const gate: XZ = [0, d / 2 + 1.5]
  // Where to walk to (a tap on the floor, a floor's button), and on which floor.
  const [tapped, setTapped] = useState<{ at: XZ; level: number } | null>(null)
  useEffect(() => setTapped(null), [interactionId])
  // (Come in while doing something already, the app just opened: there already, not walking from the gate.)
  const [back] = useState(() => {
    const ok = kept && kept[2] < floors && walk(kept[2])(kept[0], kept[1]) ? kept : null
    if (!ok) lvl.current = 0
    return ok
  })
  const where = useRef<XZ>(spot ? spot.from : back ? [back[0], back[1]] : gate)
  const way = useMemo<P[]>(() => {
    const to = spot ? { at: spot.from, level: 0 } : tapped
    const from = where.current
    const fromL = lvl.current
    // Round the walls, always: the house's grid first; a big house, a finer search close round the two
    // ends, then a coarser one over the whole house (never straight through a wall unless all fail).
    const flat = (a: XZ, b: XZ, level: number): P[] => {
      const free = walk(level)
      return (gridWay(a, b, free, 0.4, span, 200 * 200) ?? gridWay(a, b, free, 0.3, 8, 400 * 400) ?? gridWay(a, b, free, 0.6, span, 600 * 600) ?? [a, b]).map(([x, z]) => [x, z, level * STOREY])
    }
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
    keep(where.current, lvl.current)
  }, [way]) // eslint-disable-line react-hooks/exhaustive-deps
  const [there, setThere] = useState(false)
  // A played action's step: its arrows wait until the Sim is there (components/defi/Gestes.tsx).
  useEffect(() => {
    if (!stepSpot) return setHomeArrived(null)
    setHomeArrived(there)
  }, [there, !!stepSpot]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setHomeArrived(null), [])
  // A night together: once both are in the bed, the screen goes slowly to black.
  const night2 = interactionId === 'passer-nuit'
  const [dark, setDark] = useState(false)
  useEffect(() => {
    if (!night2 || !there) return setDark(false)
    const t = setTimeout(() => setDark(true), 1500)
    return () => clearTimeout(t)
  }, [night2, there])
  // The floors above the one looked at are off; its own walls full height, but down to one block between the camera and the Sim (build/CutHouse).
  // (Doing something: lower still, the tin roof of a small house off too, to see inside.)
  const cut = floor * STOREY + (interactionId ? 2 : 3)
  const pieces = useMemo(() => (plot.furniture ?? []).filter((p) => p[1] < cut), [plot.furniture, cut])
  const name = sim.firstName
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={sceneDpr} camera={{ position: [span * 0.55, span * 0.85, span * 0.95], fov: 42 }} style={{ background: night ? '#0b1026' : '#a9d3f0' }}>
        <Snapper />
        {import.meta.env.DEV && <DevCam spot={spot} where={where} />}
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
                if (walk(floor)(p[0], p[1])) setTapped({ at: p, level: floor })
              }}
            >
              <planeGeometry args={[w, d]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          )}
          {drawer && drawerAt && (
            <group position={[drawerAt.at[0], 0, drawerAt.at[1]]} rotation={[0, drawerAt.rot, 0]}>
              <GiftChest count={drawer.count} onOpen={drawer.onOpen} />
            </group>
          )}
          {partner && <Partner friend={partner} spots={spots} doing={interactionId} spot={spot} />}
          {stage === 'bebe' && spots.berceau && (
            <group position={[spots.berceau.at[0], 0, spots.berceau.at[1]]} rotation={[0, spots.berceau.rot, 0]}>
              <Crib />
            </group>
          )}
          {parents && sim.family && <Parents sim={sim} spots={spots} doing={interactionId} spot={spot} free={walk(0)} span={span} />}
          <Walking sim={sim} stage={stage} way={way} spot={spot} follow={!!stepSpot} doing={interactionId} onThere={setThere} steer={roam && !interactionId ? walk(lvl.current) : undefined} onMoved={(p) => ((where.current = p), keep(p, lvl.current), setTapped(null))} onLevel={setFloor} />
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
          <FocusOn at={spot ? [spot.at[0], spot.y + 0.4, spot.at[1]] : null} />
          <OrbitControls makeDefault target={[0, 0, 0]} enablePan={false} minDistance={4} maxDistance={span * 2.2} minPolarAngle={0.3} maxPolarAngle={1.2} enableDamping />
          {closeUp ? <CloseUp at={where} /> : stepSpot ? null : <Focus on={there && spot ? [spot.at[0], 0, spot.at[1]] : null} span={span} />}
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

/**
 * Doing something: the camera turns to where it's done and comes a little
 * closer (on a phone, the whole house doesn't fit the screen and the baby by
 * the sofa was off it); done, it eases back over the middle of the lot.
 */
function FocusOn({ at }: { at: [number, number, number] | null }) {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  const camera = useThree((s) => s.camera)
  const off = useMemo(() => new THREE.Spherical(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  // When the action began: the camera comes over it for a moment, then it's the player's again (zoom, turn).
  const began = useRef({ key: '', t: 0 })
  useFrame((state, dt) => {
    if (!controls) return
    const key = at ? at.join(',') : ''
    if (key !== began.current.key) began.current = { key, t: state.clock.elapsedTime }
    const settling = !!at && state.clock.elapsedTime - began.current.t < 2.5
    const t = controls.target
    const k = 1 - Math.exp(-dt * 3)
    const [gx, gy, gz] = at ?? [0, 0, 0]
    const d = [(gx - t.x) * k, (gy - t.y) * k, (gz - t.z) * k]
    off.setFromVector3(v.subVectors(camera.position, t))
    // From above, over the walls, near enough to see the baby's face (never nearer than the player put it).
    const far = settling ? Math.max(0, off.radius - 6) * k : 0
    const up = settling ? Math.max(0, off.phi - 0.38) * k : 0
    if (Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) + far + up < 1e-4) return
    t.set(t.x + d[0], t.y + d[1], t.z + d[2])
    off.radius -= far
    off.phi -= up
    camera.position.copy(t).add(v.setFromSpherical(off))
    controls.update()
  })
  return null
}

/** Who looks after the baby (ActionProps Mother, BabyMess): a nounou at the laté's, a gouvernante at the debout's. */
export type Carer = 'maman' | 'nounou' | 'gouvernante'

/**
 * How a baby is looked after, by its family's means: the debout have a
 * gouvernante and the laté a nounou (the parents have no time); below,
 * maman does it herself. From the poignon up there are nappies; the coulé
 * and the gnambro can't buy many, so the caca and the pipi go on the floor.
 */
export function babyCare(family: string, look: Look): { mum: Look; carer: Carer; nappy: boolean } {
  const carer: Carer = family === 'debout' ? 'gouvernante' : family === 'late' ? 'nounou' : 'maman'
  const nappy = family !== 'gnambro' && family !== 'coule'
  if (carer === 'maman') return { mum: familyCast(family, look).maman.look, carer, nappy }
  // The nounou in her pink blouse, the gouvernante in navy: always the same one in the house.
  const her = randomLook('femme', rng(`${carer}:${look.skin}:${look.hair}`))
  return { mum: { ...her, outfit: 'blouse', outfitColor: carer === 'nounou' ? '#f783ac' : '#1f2a44', accessory: 'none' }, carer, nappy }
}

/** A baby's things done with maman (ActionProps Mother): she's there already, kneeling with it. */
const WITH_MUM = /^(biberon|bouillie|hochet|calin|coucou|cubes|premiers-pas|jouets|premier-mot|bain-bebe|caca|pipi|vomir|pleurer)$/
/** The baby's accidents: papa, if he's home and up, can't believe it either. */
const MESS = /^(caca|pipi|vomir)$/

/**
 * Papa and maman at home, while the Sim is a child there (its family's house): dressed as the family
 * can afford (avatar/Family), going about the day. Up early, maman at the stove for the meals and papa
 * at the table; papa at work on weekdays from 8 to 17; the evening on the sofa; at night in bed.
 * Never on the very spot the Sim is using: the next one along.
 */
function Parents({ sim, spots, doing, spot, free, span }: { sim: Sim; spots: Record<string, HomeSpot>; doing?: string; spot: HomeSpot | null; /** The ground floor's free ground, to walk about. */ free: (x: number, z: number) => boolean; span: number }) {
  const cast = useMemo(() => familyCast(sim.family!, sim.look), [sim.family, sim.look])
  const care = useMemo(() => babyCare(sim.family!, sim.look), [sim.family, sim.look])
  const { hour } = clock(sim.gameMinutes)
  const weekday = weekdayOf(sim.gameMinutes)
  const asleep = hour >= 22 || hour < 6
  const working = !asleep && weekday < 5 && hour >= 8 && hour < 17
  const meal = (hour >= 6 && hour < 8) || (hour >= 12 && hour < 14) || (hour >= 18 && hour < 21)
  const taken = (s?: HomeSpot) => !s || (!!spot && Math.hypot(s.at[0] - spot.at[0], s.at[1] - spot.at[1]) < 0.4)
  const first = (keys: string[], skip?: HomeSpot) => keys.map((k) => spots[k]).find((s) => !taken(s) && s !== skip)
  const beds = Object.keys(spots).filter((k) => k.startsWith('bed:')).sort()
  const seats = Object.keys(spots).filter((k) => k.startsWith('seat:')).sort()
  // The beds the Sim isn't in: the parents' (the last ones: the first bed is the child's).
  const bedsLeft = [...beds].reverse()
  let papa: HomeSpot | undefined
  let maman: HomeSpot | undefined
  // A baby's thing done with maman: she walks up to it (and its scene's maman takes over once she's there, carer.ts).
  const mumGoes = !asleep && WITH_MUM.test(doing ?? '') && care.carer === 'maman' && !!spot
  const toBaby: HomeSpot | undefined = spot ? (() => {
    const at: XZ = [spot.at[0] + Math.sin(spot.rot) * 0.65, spot.at[1] + Math.cos(spot.rot) * 0.65]
    return { ...spot, at, from: at, y: 0, rot: spot.rot + Math.PI, pose: 'idle', lying: false, stool: false, screen: undefined }
  })() : undefined
  useEffect(() => {
    carer.coming = mumGoes
    carer.here = false
    return () => {
      carer.coming = false
      carer.here = false
    }
  }, [mumGoes, doing])
  if (asleep) {
    papa = first(bedsLeft)
    maman = first(bedsLeft, papa)
  } else {
    maman = mumGoes ? toBaby : meal && doing !== 'cook-attieke' ? first(['cook-attieke', ...seats]) : first([...seats, 'golvo'])
    if (maman === spots['cook-attieke']) maman = maman && { ...maman, pose: 'cook' }
    else if (maman && !maman.lying) maman = { ...maman, pose: hour % 2 ? 'call' : 'sit' }
    if (!working) {
      papa = hour < 9 ? first(['golvo', ...seats], maman) : first([...seats, 'golvo'], maman)
      if (papa) papa = { ...papa, pose: papa === spots.golvo ? 'eat' : hour % 3 ? 'sit' : 'phone' }
      // Up from his seat, a step from the baby (not on it), hand to his head.
      if (papa && spot && MESS.test(doing ?? '') && (doing === 'vomir' || !care.nappy)) {
        const side: XZ = [spot.at[0] + Math.cos(spot.rot) * 1.1, spot.at[1] - Math.sin(spot.rot) * 1.1]
        papa = { ...papa, at: side, from: side, y: 0, rot: Math.atan2(spot.at[0] - side[0], spot.at[1] - side[1]), pose: 'facepalm', lying: false, stool: false }
      }
      // No seat in the house (a natte, a shack): standing by maman, chatting; else by the bed, on the phone.
      else {
        const near = maman ?? spots.sleep
        if (near) papa = { ...near, at: [near.from[0] + 0.9, near.from[1]], y: 0, rot: near.rot, pose: maman ? 'talk' : 'phone', lying: false, stool: false }
      }
    }
  }
  const who: [HomeSpot | undefined, (typeof cast)['papa'], number][] = [
    [papa, cast.papa, 1],
    [maman, cast.maman, 2],
  ]
  return (
    <>
      {who.map(([s, p, i]) =>
        s ? (
          <Stroll key={i} to={s} free={free} span={span} hide={i === 2 && mumGoes} onThere={i === 2 && mumGoes ? () => (carer.here = true) : undefined}>
            {(s, walking) => walking ? (
              <Character look={p.look} gender={p.gender} walking stage="adulte" marker={false} seed={i * 7.7} speed={STROLL} />
            ) : (
            <group rotation={s.lying ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
              {s.stool && !s.lying && (
                <mesh position={[0, 0.2 - s.y, -0.05]}>
                  <boxGeometry args={[0.38, 0.4, 0.38]} />
                  <meshLambertMaterial color="#7a5233" />
                </mesh>
              )}
              {/* Tapped: a word with papa or maman (asleep: not woken up) */}
              {s.lying ? (
                <Character look={p.look} gender={p.gender} pose="sleep" stage="adulte" marker={false} seed={i * 7.7} />
              ) : (
                <Talkable npc={{ id: `parent:${i === 1 ? 'papa' : 'maman'}`, name: i === 1 ? 'Papa' : 'Maman', gender: p.gender, seed: i, look: p.look, doing: doingOf(s.pose), kin: i === 1 ? 'papa' : 'maman' }} pose={s.pose}>
                  {(shown) => <Character look={p.look} gender={p.gender} pose={shown} stage="adulte" marker={false} seed={i * 7.7} />}
                </Talkable>
              )}
            </group>
            )}
          </Stroll>
        ) : null,
      )}
    </>
  )
}

/** Papa and maman walk about the house at this pace (m/s). */
const STROLL = 1.3

/**
 * Someone of the house going from one place to the next on foot, round the
 * furniture (never popping from the sofa to the kitchen): the new place's
 * way in, then into it. Where they first show, they're there already.
 * `hide`: gone once there (the baby's scene shows maman from then on).
 */
function Stroll({ to, free, span, hide, onThere, children }: { to: HomeSpot; free: (x: number, z: number) => boolean; span: number; hide?: boolean; onThere?: () => void; children: (s: HomeSpot, walking: boolean) => React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  const at = useRef({ x: to.at[0], z: to.at[1], y: to.y, rot: to.rot })
  const path = useRef<XZ[]>([])
  const [walking, setWalking] = useState(false)
  const [gone, setGone] = useState(false)
  const key = `${to.at[0].toFixed(2)},${to.at[1].toFixed(2)},${to.rot.toFixed(2)},${to.y}`
  const first = useRef(true)
  useEffect(() => {
    setGone(false)
    if (first.current) {
      // Where they first show: there already.
      first.current = false
      // (After the house's own effects: Parents marks maman on her way first.)
      setTimeout(() => onThere?.(), 0)
      if (hide) setGone(true)
      return
    }
    const a = at.current
    const from: XZ = [a.x, a.z]
    if (Math.hypot(from[0] - to.from[0], from[1] - to.from[1]) < 0.3 && Math.hypot(from[0] - to.at[0], from[1] - to.at[1]) < 0.6) {
      Object.assign(a, { x: to.at[0], z: to.at[1], y: to.y, rot: to.rot })
      setTimeout(() => onThere?.(), 0)
      if (hide) setGone(true)
      return
    }
    // Off the seat or out of bed first, to the floor; then round the furniture to the way in, then in.
    a.y = 0
    const way = gridWay(from, to.from, free, 0.35, span, 160 * 160) ?? [from, to.from]
    path.current = [...way.slice(1), to.at]
    setWalking(true)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dtIn) => {
    const o = g.current
    if (!o) return
    const a = at.current
    if (walking) {
      const dt = Math.min(dtIn, 0.05)
      const next = path.current[0]
      if (!next) {
        Object.assign(a, { x: to.at[0], z: to.at[1], y: to.y, rot: to.rot })
        setWalking(false)
        onThere?.()
        if (hide) setGone(true)
      } else {
        const [dx, dz] = [next[0] - a.x, next[1] - a.z]
        const d = Math.hypot(dx, dz)
        const stepLen = STROLL * dt
        if (d <= stepLen) {
          a.x = next[0]
          a.z = next[1]
          path.current.shift()
        } else {
          a.x += (dx / d) * stepLen
          a.z += (dz / d) * stepLen
          const want = Math.atan2(dx, dz)
          a.rot += Math.atan2(Math.sin(want - a.rot), Math.cos(want - a.rot)) * Math.min(1, dt * 8)
        }
      }
    }
    o.position.set(a.x, a.y, a.z)
    o.rotation.set(0, a.rot, 0)
  })
  if (gone) return null
  return <group ref={g}>{children(to, walking)}</group>
}

/**
 * The baby's cot, by the family's bed: a mattress raised in a frame of bars,
 * long the way the baby lies (its head towards -z from where it lies, like
 * a Sim in a bed).
 */
function Crib() {
  const wood = '#d9b48a'
  const bars = []
  for (let k = -0.42; k <= 0.42; k += 0.105) for (const x of [-0.3, 0.3]) bars.push(<Box3 key={`${x}${k}`} p={[x, 0.55, -0.25 + k]} s={[0.025, 0.4, 0.025]} c={wood} />)
  for (let k = -0.22; k <= 0.22; k += 0.11) for (const z of [-0.75, 0.25]) bars.push(<Box3 key={`e${z}${k}`} p={[k, 0.55, z]} s={[0.025, 0.4, 0.025]} c={wood} />)
  return (
    <group>
      {/* The four posts on their feet, the frame under the mattress */}
      {[[-0.31, 0.26], [0.31, 0.26], [-0.31, -0.76], [0.31, -0.76]].map(([x, z], i) => (
        <Box3 key={i} p={[x, 0.39, z]} s={[0.05, 0.78, 0.05]} c={tint(wood, -0.12)} />
      ))}
      <Box3 p={[0, 0.25, -0.25]} s={[0.62, 0.06, 1.02]} c={tint(wood, -0.08)} />
      {/* The mattress and its sheet, the little pillow at the head */}
      <Box3 p={[0, 0.3, -0.25]} s={[0.56, 0.06, 0.96]} c="#f8f9fa" />
      <Box3 p={[0, 0.35, -0.62]} s={[0.3, 0.05, 0.16]} c="#ffc8dd" />
      {/* The bars, and the rail along the top */}
      {bars}
      {[-0.3, 0.3].map((x) => <Box3 key={x} p={[x, 0.76, -0.25]} s={[0.04, 0.04, 1.04]} c={wood} />)}
      {[-0.75, 0.25].map((z) => <Box3 key={z} p={[0, 0.76, z]} s={[0.64, 0.04, 0.04]} c={wood} />)}
    </group>
  )
}

function Box3({ p, s, c }: { p: [number, number, number]; s: [number, number, number]; c: string }) {
  return (
    <mesh position={p} castShadow>
      <boxGeometry args={s} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
}

/** In development, for tests in the browser: the house's camera, and where the Sim does what it does. */
function DevCam({ spot, where }: { spot: HomeSpot | null; where: { current: XZ } }) {
  const camera = useThree((st) => st.camera)
  const controls = useThree((st) => st.controls)
  const scene = useThree((st) => st.scene)
  useEffect(() => void Object.assign(globalThis, { __home: { camera, controls, spot, where, scene } }), [camera, controls, spot, where, scene])
  return null
}
