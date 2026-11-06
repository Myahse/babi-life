import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { kindOf, type Furniture, type Look, type ObjState, type Plot, type Shift } from '../lib/types'
import { randomLook } from '../avatar/options'
import { Character } from './Character'
import { Vehicle } from './vehicles'
import { gridWay } from './gridPath'
import type { HomeSpot } from './Walker'
import { sfx } from '../lib/sfx'

// Le mode vie at home, in 3D (the update « mode-vie », components/LifeWork.tsx, backend sims/boulot.go and
// sims/objets.go): the ride to work at the gate (the gbaka, a woro-woro, the company's car, the school's
// car, or on foot down the road) and back; the house's broken things (sparks, a puddle, smoke, all in the
// game's blocks) and the repairman who comes in by the gate, mends and goes. Everything is a few boxes
// moved in useFrame, with nothing made per frame.

type XZ = [number, number]

/** The trip to work seen at home: leaving (the ride comes, the Sim gets in, it goes), or back (it comes, the Sim gets out). */
export type WorkTrip = { phase: 'leave' | 'back'; ride: Shift['ride']; key: string }

/** The road in front of the gate: the lane the ride stops in (HomeInside's road runs along x at z = d/2 + 6). */
const laneZ = (d: number) => d / 2 + 4.6

/** What each ride is drawn as (vehicles.tsx). */
const RIDES: Record<Exclude<Shift['ride'], 'marche'>, { kind: 'gbaka' | 'woro' | 'car'; color?: string; trim?: string }> = {
  gbaka: { kind: 'gbaka' },
  woro: { kind: 'woro', color: '#2f9e44', trim: '#ffd43b' },
  voiture: { kind: 'car', color: '#1d1f24' },
  'car-ecole': { kind: 'gbaka', color: '#ffd43b', trim: '#1c7ed6' },
}

/**
 * The ride at the gate. Leaving: it drives in and stops by the gate, hoots; once the Sim stands there
 * (there), it gets in (onBoard: the Sim's hidden), the door shuts and it drives off; then onDone.
 * Back: it drives in with the Sim inside, stops, the door, the Sim gets out at the gate (onAlight), it
 * goes; then onDone. On foot: the Sim walks off down the road (or back up it) by itself.
 */
export function WorkRide({ trip, d, there, look, gender, stage, onBoard, onAlight, onDone }: { trip: WorkTrip; d: number; there: boolean; look: Look; gender: 'femme' | 'homme'; stage: string; onBoard: () => void; onAlight: () => void; onDone: () => void }) {
  const g = useRef<THREE.Group>(null)
  const walker = useRef<THREE.Group>(null)
  const st = useRef({ t: 0, part: 'in' as 'in' | 'wait' | 'board' | 'out' | 'done', at: 0, honked: false })
  const [walking, setWalking] = useState(trip.ride === 'marche')
  const z = laneZ(d)
  const stopX = 1.6
  const foot = trip.ride === 'marche'
  useEffect(() => {
    st.current = { t: 0, part: 'in', at: 0, honked: false }
    setWalking(foot)
  }, [trip.key]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dtIn) => {
    const dt = Math.min(dtIn, 0.05)
    const s = st.current
    s.t += dt
    if (s.part === 'done') return
    if (foot) {
      // On foot: leaving, from the gate down the road once there; back, up the road to the gate.
      const o = walker.current
      if (!o) return
      if (trip.phase === 'leave') {
        if (s.part === 'in') {
          o.visible = false
          if (there) {
            s.part = 'out'
            s.at = s.t
            onBoard()
          }
          return
        }
        const k = s.t - s.at
        o.visible = true
        o.position.set(k > 1.2 ? (k - 1.2) * 1.7 : 0, 0, d / 2 + 1.2 + Math.min(1, k / 1.2) * (z - 0.8 - d / 2 - 1.2))
        o.rotation.set(0, k > 1.2 ? Math.PI / 2 : 0, 0)
        if (k > 9) {
          s.part = 'done'
          o.visible = false
          onDone()
        }
      } else {
        const k = s.t
        const along = Math.max(0, 9 - k * 1.7)
        const up = Math.min(1, Math.max(0, (k - 9 / 1.7) / 1.2))
        o.visible = true
        if (up < 1) {
          // Up the road, then in at the gate.
          o.position.set(-along, 0, z - 0.8 - up * (z - 0.8 - d / 2 - 1.2))
          o.rotation.set(0, along > 0 ? Math.PI / 2 : Math.PI, 0)
        } else {
          s.part = 'done'
          o.visible = false
          onAlight()
          onDone()
        }
      }
      return
    }
    const o = g.current
    if (!o) return
    if (s.part === 'in') {
      // In from the left, slowing to a stop by the gate.
      const k = Math.min(1, s.t / 2.8)
      o.position.set(-34 + (34 + stopX) * (1 - (1 - k) * (1 - k)), 0, z)
      if (k >= 1) {
        s.part = 'wait'
        s.at = s.t
        if (trip.phase === 'leave' && !s.honked) {
          s.honked = true
          sfx.horn(0.6)
        }
        if (trip.phase === 'back') {
          sfx.carDoor(false)
          onAlight()
          s.part = 'board'
          s.at = s.t
        }
      }
    } else if (s.part === 'wait') {
      // Waiting for the Sim at the gate (a while at most: then it goes in anyway).
      if (there || s.t - s.at > 14) {
        sfx.carDoor(false)
        onBoard()
        s.part = 'board'
        s.at = s.t
      }
    } else if (s.part === 'board') {
      if (s.t - s.at > 0.9) {
        sfx.carDoor(true)
        s.part = 'out'
        s.at = s.t
      }
    } else if (s.part === 'out') {
      // Off to the right, speeding up.
      const k = Math.min(1, (s.t - s.at) / 3)
      o.position.set(stopX + 44 * k * k, 0, z)
      if (k >= 1) {
        s.part = 'done'
        onDone()
      }
    }
  })
  if (foot)
    return (
      <group ref={walker} visible={false}>
        <Character look={look} gender={gender} walking={walking} stage={stage} speed={1.7} />
      </group>
    )
  const r = RIDES[trip.ride as keyof typeof RIDES] ?? RIDES.gbaka
  return (
    <group ref={g} name="work-ride" position={[-34, 0, z]}>
      <Vehicle p={[0, 0, 0]} kind={r.kind} color={r.color} trim={r.trim} seed={7} />
    </group>
  )
}

/** Where each piece of furniture that breaks stands (its middle, its height, its front), by object id (the piece's base). */
export function objectPieces(plot: Plot, catalog: Furniture[], w: number, d: number) {
  const out: Record<string, { at: XZ; h: number; front: XZ; size: XZ }> = {}
  for (const p of plot.furniture ?? []) {
    if (p[1] !== 0) continue
    const f = catalog.find((x) => x.id === p[4])
    if (!f) continue
    const kind = kindOf(f)
    if (out[kind]) continue
    const [fw, fd] = p[3] % 2 ? [f.d, f.w] : [f.w, f.d]
    // Its front is its +z, turned a quarter by r (FurnitureSet).
    const turn = (-p[3] * Math.PI) / 2
    out[kind] = { at: [p[0] + fw / 2 - w / 2, p[2] + fd / 2 - d / 2], h: f.h ?? 1, front: [Math.sin(turn), Math.cos(turn)], size: [fw, fd] }
  }
  return out
}

/** The objects that can break, by their piece's kind (backend game/objets.go HomeObjects). */
export const OBJECT_BREAKS: Record<string, 'etincelles' | 'fuite' | 'fumee'> = { tele: 'etincelles', console: 'etincelles', frigo: 'fuite', gaziniere: 'fumee', douche: 'fuite', wc: 'fuite', lavabo: 'fuite' }

/** Le mode vie's « Réparer » done standing at the piece, turned to it (the hands busy). */
export function repairSpots(plot: Plot, catalog: Furniture[], w: number, d: number, free: (x: number, z: number) => boolean): Record<string, HomeSpot> {
  const out: Record<string, HomeSpot> = {}
  const pieces = objectPieces(plot, catalog, w, d)
  for (const id of Object.keys(OBJECT_BREAKS)) {
    const p = pieces[id]
    if (!p) continue
    // In front of it; against a wall there, behind it, then at either side: the first side one can stand on.
    const [fx, fz] = p.front
    for (const [dx, dz] of [[fx, fz], [-fx, -fz], [fz, -fx], [-fz, fx]]) {
      const reach = (Math.abs(dx) > 0.5 ? p.size[0] : p.size[1]) / 2 + 0.55
      const at: XZ = [p.at[0] + dx * reach, p.at[1] + dz * reach]
      if (!free(at[0], at[1])) continue
      out[`reparer-${id}`] = { at, from: at, y: 0, rot: Math.atan2(-dx, -dz), pose: 'busy', lying: false }
      break
    }
  }
  return out
}

const BOX = new THREE.BoxGeometry(1, 1, 1)
const SPARK = new THREE.MeshBasicMaterial({ color: '#ffe066' })
const WATER = new THREE.MeshLambertMaterial({ color: '#4dabf7', transparent: true, opacity: 0.7, depthWrite: false })
const DROP = new THREE.MeshLambertMaterial({ color: '#74c0fc' })
const SMOKE = new THREE.MeshLambertMaterial({ color: '#868e96', transparent: true, opacity: 0.55, depthWrite: false })
const N = 10
const tmp = new THREE.Object3D()

/** One broken thing's sign: sparks spitting off its top, water dripping into a growing puddle, or smoke rising. */
function BrokenSign({ at, h, kind }: { at: XZ; h: number; kind: 'etincelles' | 'fuite' | 'fumee' }) {
  const inst = useRef<THREE.InstancedMesh>(null)
  const puddle = useRef<THREE.Group>(null)
  // Each bit: its start time, its direction (fixed per bit; nothing new per frame).
  const bits = useMemo(() => [...Array(N)].map((_, i) => ({ off: i / N, dx: Math.cos(i * 2.4) * (0.4 + (i % 3) * 0.2), dz: Math.sin(i * 2.4) * (0.4 + (i % 3) * 0.2) })), [])
  const born = useRef(performance.now())
  useFrame(({ clock }) => {
    const m = inst.current
    if (!m) return
    const t = clock.elapsedTime
    for (let i = 0; i < N; i++) {
      const b = bits[i]
      if (kind === 'etincelles') {
        // In bursts: a crackle every second or so, the bits flying out and falling.
        const k = (t * 1.3 + b.off) % 1
        const on = Math.sin(t * 7 + i) > -0.2
        tmp.position.set(at[0] + b.dx * k * 0.8, h + 0.15 + k * 0.9 - k * k * 1.4, at[1] + b.dz * k * 0.8)
        tmp.scale.setScalar(on ? 0.07 * (1 - k) + 0.02 : 0.0001)
      } else if (kind === 'fumee') {
        const k = (t * 0.35 + b.off) % 1
        tmp.position.set(at[0] + b.dx * 0.25 + Math.sin(t + i) * 0.1 * k, h + 0.2 + k * 1.8, at[1] + b.dz * 0.25)
        tmp.scale.setScalar(0.12 + k * 0.35)
      } else {
        // The drips: down from the piece to the floor, one after the other.
        const k = (t * 0.9 + b.off) % 1
        tmp.position.set(at[0] + b.dx * 0.3, Math.max(0.02, h * 0.7 * (1 - k * k)), at[1] + b.dz * 0.3)
        tmp.scale.setScalar(i < 4 ? 0.06 : 0.0001)
      }
      tmp.rotation.set(t + i, t * 0.7, 0)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    // The puddle grows a few seconds, then stays.
    if (puddle.current) puddle.current.scale.setScalar(Math.min(1, 0.3 + (performance.now() - born.current) / 6000))
  })
  return (
    <group>
      <instancedMesh ref={inst} args={[BOX, kind === 'etincelles' ? SPARK : kind === 'fumee' ? SMOKE : DROP, N]} frustumCulled={false} />
      {kind === 'fuite' && (
        <group ref={puddle} position={[at[0], 0.03, at[1]]}>
          {/* A puddle of a few flat blocks */}
          <mesh geometry={BOX} material={WATER} position={[0, 0, 0]} scale={[1.2, 0.03, 0.9]} />
          <mesh geometry={BOX} material={WATER} position={[0.5, 0, 0.45]} scale={[0.6, 0.03, 0.5]} />
          <mesh geometry={BOX} material={WATER} position={[-0.45, 0, -0.35]} scale={[0.5, 0.03, 0.45]} />
        </group>
      )}
    </group>
  )
}

/** The house's broken things, each with its sign. */
export function BrokenThings({ plot, catalog, w, d, objects }: { plot: Plot; catalog: Furniture[]; w: number; d: number; objects?: Record<string, ObjState> }) {
  const pieces = useMemo(() => objectPieces(plot, catalog, w, d), [plot, catalog, w, d])
  const broken = Object.entries(objects ?? {}).filter(([id, st]) => st.broken && pieces[id] && OBJECT_BREAKS[id])
  return (
    <>
      {broken.map(([id]) => (
        <BrokenSign key={id} at={pieces[id].at} h={pieces[id].h} kind={OBJECT_BREAKS[id]} />
      ))}
    </>
  )
}

const REPAIRMAN: Look = { ...randomLook('homme', () => 0.37), outfit: 'bleu', accessory: 'cap' }

/**
 * The repairman called (backend sims/objets.go: here from proAt, done at pro, in game minutes, the real
 * clock's): in at the gate, round the walls to the piece, at it with his hands until he's done (sparks
 * once more at the end), then back out by the gate. Shown once per call (its key).
 */
export function Repairmen({ plot, catalog, w, d, objects, free, gate }: { plot: Plot; catalog: Furniture[]; w: number; d: number; objects?: Record<string, ObjState>; free: (x: number, z: number) => boolean; gate: XZ }) {
  const pieces = useMemo(() => objectPieces(plot, catalog, w, d), [plot, catalog, w, d])
  const spots = useMemo(() => repairSpots(plot, catalog, w, d, free), [plot, catalog, w, d, free])
  const calls = Object.entries(objects ?? {}).filter(([id, st]) => st.pro && pieces[id])
  // A call stays shown after the server says it's mended, for him to walk out.
  const [kept, setKept] = useState<Record<string, { id: string; end: number }>>({})
  useEffect(() => {
    setKept((k) => {
      let changed = false
      const next = { ...k }
      for (const [id, st] of calls) {
        const key = `${id}:${st.proAt}`
        if (!next[key]) {
          next[key] = { id, end: performance.now() + Math.max(8000, ((st.pro ?? 0) - (st.proAt ?? 0)) * 60_000) }
          changed = true
        }
      }
      return changed ? next : k
    })
  }, [calls.map(([id, st]) => `${id}:${st.proAt}`).join()]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {Object.entries(kept).map(([key, c]) => {
        const p = pieces[c.id]
        if (!p) return null
        const sp = spots[`reparer-${c.id}`]
        if (!sp) return null
        return <Repairman key={key} gate={gate} to={sp.at} face={sp.rot} end={c.end} free={free} onGone={() => setKept((k) => Object.fromEntries(Object.entries(k).filter(([x]) => x !== key)))} />
      })}
    </>
  )
}

function Repairman({ gate, to, face, end, free, onGone }: { gate: XZ; to: XZ; face: number; end: number; free: (x: number, z: number) => boolean; onGone: () => void }) {
  const g = useRef<THREE.Group>(null)
  const way = useMemo(() => {
    const ok = (x: number, z: number) => free(x, z) || Math.hypot(x - to[0], z - to[1]) < 0.8 || z > gate[1] - 1.5
    return gridWay([gate[0], gate[1] + 1.5], to, ok, 0.4, 12, 200 * 200) ?? [[gate[0], gate[1] + 1.5] as XZ, to]
  }, [gate[0], gate[1], to[0], to[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  const st = useRef({ i: 1, back: false, x: way[0][0], z: way[0][1], rot: Math.PI, gone: false })
  const [mode, setMode] = useState<'walk' | 'busy'>('walk')
  useFrame((_, dtIn) => {
    const o = g.current
    const s = st.current
    if (!o || s.gone) return
    const dt = Math.min(dtIn, 0.05)
    const path = s.back ? [...way].reverse() : way
    if (s.i < path.length) {
      const [tx, tz] = path[s.i]
      const [dx, dz] = [tx - s.x, tz - s.z]
      const len = Math.hypot(dx, dz)
      if (len < 0.05) s.i++
      else {
        const m = Math.min(len, 1.5 * dt)
        s.x += (dx / len) * m
        s.z += (dz / len) * m
        const want = Math.atan2(dx, dz)
        s.rot += Math.atan2(Math.sin(want - s.rot), Math.cos(want - s.rot)) * Math.min(1, dt * 10)
      }
      if (s.i >= path.length) {
        if (s.back) {
          s.gone = true
          onGone()
        } else setMode('busy')
      }
    } else if (!s.back) {
      // At it: turned to the piece until his time's up (the server mends it then).
      s.rot += Math.atan2(Math.sin(face - s.rot), Math.cos(face - s.rot)) * Math.min(1, dt * 6)
      if (performance.now() > end) {
        sfx.pop()
        s.back = true
        s.i = 1
        setMode('walk')
      }
    }
    o.position.set(s.x, 0, s.z)
    o.rotation.set(0, s.rot, 0)
  })
  return (
    <group ref={g} position={[way[0][0], 0, way[0][1]]}>
      <Character look={REPAIRMAN} gender="homme" walking={mode === 'walk'} pose={mode === 'busy' ? 'busy' : undefined} speed={1.5} marker={false} />
    </group>
  )
}

/** While the ride comes and goes: the camera in the yard, looking out over the gate to the road (the ride and the Sim both seen). */
export function TripCamera({ d }: { d: number }) {
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  const camera = useThree((st) => st.camera)
  const want = useMemo(() => ({ target: new THREE.Vector3(0, 0.6, d / 2 + 3), pos: new THREE.Vector3(-5.5, 6.5, d / 2 - 4.5) }), [d])
  useFrame((_, dt) => {
    if (!controls) return
    const k = Math.min(1, dt * 1.8)
    controls.target.lerp(want.target, k)
    camera.position.lerp(want.pos, k)
    controls.update()
  })
  return null
}
