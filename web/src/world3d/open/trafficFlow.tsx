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

/** A vehicle on the move this frame: where, which way it heads (along()'s angle), half its length. */
type Moving = { x: number; z: number; h: number; half: number }
const moving = new Map<string, Moving>()

export const report = (id: string, m: Moving | null) => (m ? moving.set(id, m) : moving.delete(id))

/** The gap kept to the car ahead, bumper to bumper (metres). */
const GAP = 1.6

/** Whether a vehicle at (x, z), heading h, would run into another one: one ahead of it in its lane, or crossing in front. */
export function blockedAhead(id: string, x: number, z: number, h: number, half: number) {
  const [fx, fz] = [Math.sin(h), Math.cos(h)]
  for (const [other, o] of moving) {
    if (other === id) continue
    const [dx, dz] = [o.x - x, o.z - z]
    const ahead = dx * fx + dz * fz
    if (ahead <= 0 || ahead > half + o.half + GAP + 2) continue
    // In its lane (the cars coming the other way keep to theirs, 4 m off), or across it.
    const side = Math.abs(dx * fz - dz * fx)
    if (side < 1.7) return true
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
    if (ahead < line || ahead > line + 6) continue
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
