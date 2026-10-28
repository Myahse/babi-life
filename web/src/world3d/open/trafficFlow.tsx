import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'

// The street's traffic keeping its distances (OpenWorld RoadTraffic): every
// car says where it is each frame, and one that would run into the car
// ahead of it (or one crossing in front) waits behind it instead; at the big
// crossroads the traffic lights stop one road while the other goes. The
// lights run on the shared clock: the same colour on every screen.

/** A vehicle on the move this frame: where, which way it heads (along()'s angle), half its length; stopped, what it waits for ('red', 'papers', or the car it queues behind). */
type Moving = { x: number; z: number; h: number; half: number; wait?: string }
const moving = new Map<string, Moving>()
// (In development, for tests in the browser: where every vehicle is, and what it waits for.)
if (import.meta.env.DEV) Object.assign(globalThis, { __moving: moving })

export const report = (id: string, m: Moving | null) => (m ? moving.set(id, m) : moving.delete(id))
/** A vehicle stopped where it last said it was, and why. */
export const waiting = (id: string, why: string) => {
  const m = moving.get(id)
  if (m) m.wait = why
}

/** The gap kept to the car ahead, bumper to bumper (metres). */
const GAP = 1.6

/** The vehicle a vehicle at (x, z), heading h, would run into (one ahead of it in its lane, or crossing in front), if any; `look`: metres further ahead, to brake in time. */
export function blockedAhead(id: string, x: number, z: number, h: number, half: number, look = 0) {
  const [fx, fz] = [Math.sin(h), Math.cos(h)]
  for (const [other, o] of moving) {
    if (other === id) continue
    const [dx, dz] = [o.x - x, o.z - z]
    const ahead = dx * fx + dz * fz
    if (ahead <= 0 || ahead > half + o.half + GAP + 2 + look) continue
    // In its lane (the cars coming the other way keep to theirs, 4 m off), or across it.
    const side = Math.abs(dx * fz - dz * fx)
    if (side < 1.7) return other
  }
  return null
}

/**
 * What the queue ahead of a car waits for, down to its head: a red light or
 * a checkpoint (it waits its turn, however long), this very car (two cars
 * nose to nose at a crossing: one squeezes by), or nothing it knows of (a car
 * parked at the end of its round: it gets by after a while).
 */
export function queueOf(id: string, ahead: string): 'light' | 'jam' | 'other' {
  let cur = ahead
  for (let i = 0; i < 12; i++) {
    const w = moving.get(cur)?.wait
    if (!w) return 'other'
    // (A red light, a checkpoint, a stop, a crossroads given way at, someone crossing: it waits its turn behind.)
    if (w === 'red' || w === 'papers' || w === 'stop' || w === 'junction' || w === 'pieton') return 'light'
    if (w === id) return 'jam'
    cur = w
  }
  return 'other'
}

/**
 * A police checkpoint on the shoulder (streetlife.tsx PolicePost): where, the
 * way its road runs (the lane beside it heads the other way), and the car
 * being checked there now, for the officer to go to its window.
 */
export type Checkpoint = { id: string; x: number; z: number; rot: number; car: { id: string; x: number; z: number; h: number; /** when it last said it was there (a car gone from the street no longer holds the officer) */ seen: number } | null }
export const checkpoints = new Map<string, Checkpoint>()
/** When each car's papers began to be checked at each checkpoint (`car|checkpoint`): once checked, it drives on. */
const checked = new Map<string, number>()
/** How long the papers take (seconds). */
export const PAPERS = 8
/** A car at a checkpoint that hasn't said it's there for this long (seconds) is gone (a slow phone's frames can be far apart). */
export const STALE = 2
/** A number from 0 to 1 for a word (the same every time). */
const pick = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

/** Whether a vehicle at (x, z), heading h, is waved over at a checkpoint just ahead (one in two), and its papers aren't done yet. */
export function stopForPapers(id: string, x: number, z: number, h: number, half: number, t: number) {
  const [fx, fz] = [Math.sin(h), Math.cos(h)]
  for (const c of checkpoints.values()) {
    const [dx, dz] = [c.x - x, c.z - z]
    const ahead = dx * fx + dz * fz
    // Its front up to the officer, in the lane beside the post (heading against the road's way).
    if (ahead < half - 2 || ahead > half + 4 || Math.abs(dx * fz - dz * fx) > 6 || Math.cos(h - c.rot - Math.PI) < 0.7) continue
    if (pick(`${id}|${c.id}`) > 0.5) continue
    const key = `${id}|${c.id}`
    const began = checked.get(key)
    if (began === undefined) {
      // One car at a time: the next waits its turn.
      if (c.car && c.car.id !== id && t - c.car.seen < STALE) return true
      checked.set(key, t)
      if (checked.size > 2000) checked.clear()
    } else if (t - began >= PAPERS) {
      if (c.car?.id === id) c.car = null
      continue
    }
    c.car = { id, x, z, h, seen: t }
    return true
  }
  return false
}

/** A crossroads with lights: where, the heading of its main road, and where its cycle starts. */
export type Light = { x: number; y: number; z: number; axis: number; phase: number; width: number }

/** The cycle (seconds): the main road green, amber, then all red for a moment (1.5 s); the other road the same, half a cycle later. */
const CYCLE = 34
const GREEN = 13
const AMBER = 2.5

/** What a light shows to the road along `axis` (0) or across it (1) at time t. */
export function lightFor(l: Light, road: 0 | 1, t: number): 'green' | 'amber' | 'red' {
  const k = ((t + l.phase) % CYCLE + CYCLE) % CYCLE - road * (CYCLE / 2)
  if (k >= 0 && k < GREEN) return 'green'
  if (k >= GREEN && k < GREEN + AMBER) return 'amber'
  return 'red'
}
/** Which of a light's two roads a heading is on. */
const roadOf = (l: Light, h: number): 0 | 1 => (Math.abs(Math.cos(h - l.axis)) > 0.7 ? 0 : 1)

/** Whether a vehicle at (x, z), heading h, has a red (or amber) light just ahead: it stops at the line, before the crossing. */
export function redAhead(lights: Light[], x: number, z: number, h: number, half: number, t: number) {
  const [fx, fz] = [Math.sin(h), Math.cos(h)]
  for (const l of lights) {
    const [dx, dz] = [l.x - x, l.z - z]
    const ahead = dx * fx + dz * fz
    // Stopped at the line: from just before it (the crossing's half width) to a car's length further back.
    const line = l.width / 2 + 2 + half
    if (ahead < line || ahead > line + 9) continue
    if (Math.abs(dx * fz - dz * fx) > l.width / 2 + 3) continue
    if (lightFor(l, roadOf(l, h), t) !== 'green') return true
  }
  return false
}

/**
 * The crossroads with lights round a place: where the roads the traffic
 * takes meet, three or four ways, on a big road; one per crossing (a dual
 * carriageway's two nodes are one crossroads).
 */
export function lightsOf(nav: Nav, cells: { x0: number; z0: number }[], size: number): Light[] {
  const out: Light[] = []
  const inCells = (p: XZ) => cells.some((c) => p[0] >= c.x0 && p[0] < c.x0 + size && p[1] >= c.z0 && p[1] < c.z0 + size)
  for (let i = 0; i < nav.nodes.length; i++) {
    // Where three or four roads the traffic drives on (7 m and more) meet, one of them a big one (9 m).
    const big = nav.adj[i].filter((e) => e.width >= 7)
    if (big.length < 3 || !big.some((e) => e.width >= 9) || nav.ys[i]) continue
    const p = nav.nodes[i]
    if (!inCells(p)) continue
    if (out.some((l) => Math.hypot(l.x - p[0], l.z - p[1]) < 30)) continue
    // The main road: the widest way out of the crossroads.
    const main = big.reduce((a, b) => (b.width > a.width ? b : a))
    const q = nav.nodes[main.to]
    out.push({ x: p[0], y: nav.heightAt(p[0], p[1]), z: p[1], axis: Math.atan2(q[0] - p[0], q[1] - p[1]), phase: hash(Math.round(p[0]), Math.round(p[1]), 911) * CYCLE, width: main.width })
  }
  return out
}

const POLE = new THREE.CylinderGeometry(0.08, 0.1, 1, 8)
const LAMP = new THREE.SphereGeometry(0.17, 10, 8)
const HEAD = new THREE.BoxGeometry(0.5, 1.4, 0.36)
const poleMat = new THREE.MeshLambertMaterial({ color: '#3d4148' })
const headMat = new THREE.MeshLambertMaterial({ color: '#16181c' })
const OFF = '#2a2d33'
const ON = { red: '#ff3b30', amber: '#ffb020', green: '#2ee66b' } as const

/** One crossroads' lights: a pole at two opposite corners, each with a head for either road (lamps on both faces). */
function Crossroads({ l }: { l: Light }) {
  const mats = useMemo(() => [0, 1].map(() => (['red', 'amber', 'green'] as const).map(() => new THREE.MeshBasicMaterial({ color: OFF, toneMapped: false }))), [])
  useFrame(() => {
    const t = worldTime()
    for (const road of [0, 1] as const) {
      const on = lightFor(l, road, t)
      mats[road].forEach((m, i) => m.color.set(['red', 'amber', 'green'][i] === on ? ON[on] : OFF))
    }
  })
  // On the sidewalk's corner, clear of the crossing.
  const corner = l.width / 2 + 2.2
  return (
    <group position={[l.x, l.y, l.z]} rotation={[0, l.axis, 0]}>
      {[1, -1].map((s) => (
        <group key={s} position={[s * corner, 0, s * corner]}>
          <mesh geometry={POLE} material={poleMat} position={[0, 1.9, 0]} scale={[1, 3.8, 1]} />
          {/* The head for the main road (facing along it, both ways), and the one for the road across */}
          {([0, 1] as const).map((road) => (
            <group key={road} position={[0, 3.3, 0]} rotation={[0, road * (Math.PI / 2), 0]}>
              <mesh geometry={HEAD} material={headMat} position={[road ? 0.32 : -0.32, 0, 0]} />
              {[0, 1, 2].map((i) =>
                [1, -1].map((face) => <mesh key={`${i}${face}`} geometry={LAMP} material={mats[road][i]} position={[road ? 0.32 : -0.32, 0.44 - i * 0.44, face * 0.17]} scale={[1, 1, 0.5]} />),
              )}
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

/** The traffic lights of the crossroads round the Sim. */
export function TrafficLights({ lights }: { lights: Light[] }) {
  return (
    <>
      {lights.map((l) => (
        <Crossroads key={`${Math.round(l.x)},${Math.round(l.z)}`} l={l} />
      ))}
    </>
  )
}

/**
 * A crossroads without lights: where, how far it reaches, the widest road at
 * it. The code de la route there: coming out of a small street onto a bigger
 * one, a stop (a full stop at the line, then go when the way is clear); between
 * roads alike, priority to the right; and nobody goes into it while another car
 * is crossing it.
 */
export type Junction = { key: string; x: number; z: number; r: number; major: number }

export function junctionsOf(nav: Nav, cells: { x0: number; z0: number }[], size: number, lights: Light[]): Junction[] {
  const out: Junction[] = []
  const inCells = (p: XZ) => cells.some((c) => p[0] >= c.x0 && p[0] < c.x0 + size && p[1] >= c.z0 && p[1] < c.z0 + size)
  for (let i = 0; i < nav.nodes.length; i++) {
    const roads = nav.adj[i].filter((e) => e.width >= 7 && !e.fast)
    if (roads.length < 3 || nav.ys[i]) continue
    const p = nav.nodes[i]
    if (!inCells(p) || lights.some((l) => Math.hypot(l.x - p[0], l.z - p[1]) < 30) || out.some((j) => Math.hypot(j.x - p[0], j.z - p[1]) < 14)) continue
    const major = Math.max(...roads.map((e) => e.width))
    out.push({ key: `${Math.round(p[0])},${Math.round(p[1])}`, x: p[0], z: p[1], r: major / 2 + 2.5, major })
  }
  return out
}

/** Who is in each crossroads now, and who is coming up to it (with which way they come and on how wide a road). */
const inside = new Map<string, { id: string; seen: number }>()
const coming = new Map<string, Map<string, { x: number; z: number; width: number; seen: number }>>()
/** Where each car made its stop (`car|junction`), and since when it has been standing there. */
const stopped = new Map<string, number>()

/**
 * Whether a car at (x, z), heading h, on a road `width` wide, must wait before
 * the crossroads just ahead: a car in it, a stop not made yet, a car coming
 * from its right on a road as wide, or one on a bigger road. `v`: how fast it
 * goes now (0 to 1), for the stop.
 */
export function giveWay(id: string, js: Junction[], x: number, z: number, h: number, half: number, width: number, v: number, t: number): string | null {
  const [fx, fz] = [Math.sin(h), Math.cos(h)]
  const [rx, rz] = [-Math.cos(h), Math.sin(h)]
  for (const j of js) {
    const [dx, dz] = [j.x - x, j.z - z]
    if (Math.abs(dx) > 40 || Math.abs(dz) > 40) continue
    const d = Math.hypot(dx, dz)
    if (d < j.r) {
      inside.set(j.key, { id, seen: t })
      coming.get(j.key)?.delete(id)
      continue
    }
    const ahead = dx * fx + dz * fz
    if (ahead <= 0 || ahead > half + j.r + 8 || Math.abs(dx * fz - dz * fx) > j.r + 2) continue
    let near = coming.get(j.key)
    if (!near) coming.set(j.key, (near = new Map()))
    near.set(id, { x, z, width, seen: t })
    const busy = inside.get(j.key)
    if (busy && busy.id !== id && t - busy.seen < 0.5) return 'junction'
    // At the line (it's close): the stop, coming from the small street.
    const key = `${id}|${j.key}`
    if (width < j.major - 1.5 && ahead < half + j.r + 3) {
      if (v > 0.05) return 'stop'
      const since = stopped.get(key) ?? t
      stopped.set(key, since)
      if (stopped.size > 3000) stopped.clear()
      if (t - since < 1.2) return 'stop'
    }
    for (const [other, o] of near) {
      if (other === id || t - o.seen > 0.4) continue
      // A bigger road goes first; on roads alike, the one coming from the right.
      const right = (o.x - j.x) * rx + (o.z - j.z) * rz > 2
      if (o.width > width + 1.5 || (Math.abs(o.width - width) <= 1.5 && right)) return other
    }
  }
  return null
}
