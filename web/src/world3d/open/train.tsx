import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { moveObstacle } from '../obstacles'
import { whereabouts } from '../whereabouts'
import type { XZ } from './geo'
import type { Nav } from './nav'
import type { Poi } from './poiMatch'
import { Roamer } from './roam'
import { CAR, Coach, Locomotive } from './trainCars'
import { report } from './trafficFlow'
import { TalkHuman } from '../Talkable'
import { NoShadows } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { sfx } from '../../lib/sfx'

// The train in the street: the real railway's tracks (the map's rail lines, tiles.ts) laid on their
// ballast with sleepers and two rails, a platform at each real station and halt (the map's railway
// stations: Gare de Treichville, du Plateau, d'Adjamé…), and the banlieue train of Ébène Rail running on
// them: a locomotive and four coaches, on and on along the line (roam.ts), slowing into each station,
// a moment at the platform, then off again. Where the line ends (or the map loaded so far), it goes back
// the other way, as trains do at a terminus. One in each direction. Nobody walks through it.

const GAUGE = 1.0
const BALLAST = 3.2
const SPEED = 13
const DWELL = 18
const COACHES = 4

/** The rail lines of the loaded map as a graph the roamer goes along (the same shape as the streets' Nav). */
class RailNet {
  nodes: XZ[] = []
  ys: number[] = []
  adj: { to: number; len: number; width: number; walled?: boolean }[][] = []
  edges: { a: number; b: number; len: number; width: number }[] = []
  private at = new Map<string, number>()
  constructor(lines: XZ[][]) {
    for (const pts of lines)
      for (let i = 1; i < pts.length; i++) {
        const [a, b] = [this.node(pts[i - 1]), this.node(pts[i])]
        const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        if (a === b || len < 0.2) continue
        this.edges.push({ a, b, len, width: 10 })
        this.adj[a].push({ to: b, len, width: 10 })
        this.adj[b].push({ to: a, len, width: 10 })
      }
  }
  private node(p: XZ) {
    // (Lines from two tiles meet at the same point, a few centimetres apart.)
    const k = `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`
    let i = this.at.get(k)
    if (i === undefined) {
      i = this.nodes.push(p) - 1
      this.ys.push(0)
      this.adj.push([])
      this.at.set(k, i)
    }
    return i
  }
  nearest(p: XZ, radius = 400): { at: XZ; edge: number; t: number; dist: number } | null {
    let best: { at: XZ; edge: number; t: number; dist: number } | null = null
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i]
      const [a, b] = [this.nodes[e.a], this.nodes[e.b]]
      const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)))
      const at: XZ = [a[0] + dx * t, a[1] + dz * t]
      const dist = Math.hypot(p[0] - at[0], p[1] - at[1])
      if (dist < radius && (!best || dist < best.dist)) best = { at, edge: i, t, dist }
    }
    return best
  }
}

const ballastMat = new THREE.MeshLambertMaterial({ color: '#7d746a', side: THREE.DoubleSide })
const railMat = new THREE.MeshLambertMaterial({ color: '#8b9098', side: THREE.DoubleSide })
const sleeperMat = new THREE.MeshLambertMaterial({ color: '#4a3527' })
const platformMat = new THREE.MeshLambertMaterial({ color: '#c9c3b6' })
const edgeMat = new THREE.MeshLambertMaterial({ color: '#f2c14b' })
const roofMat = new THREE.MeshLambertMaterial({ color: '#1f5f3f' })
const postMat = new THREE.MeshLambertMaterial({ color: '#3a3f47' })
const BOX = new THREE.BoxGeometry(1, 1, 1)

/** A flat strip along a line, `half` wide each side of it, `off` to its side, at height y (one geometry). */
function strip(lines: XZ[][], half: number, off: number, y: number, height: (x: number, z: number) => number) {
  const pos: number[] = []
  for (const pts of lines)
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (len < 0.01) continue
      const [nx, nz] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]
      const q = (p: XZ, s: number) => [p[0] + nx * (off + s), height(p[0], p[1]) + y, p[1] + nz * (off + s)]
      const [a0, a1, b0, b1] = [q(a, -half), q(a, half), q(b, -half), q(b, half)]
      pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** The tracks: ballast, sleepers every 1.2 m, the two rails. */
function Tracks({ lines, nav }: { lines: XZ[][]; nav: Nav }) {
  const h = (x: number, z: number) => nav.heightAt(x, z)
  const geos = useMemo(() => ({ ballast: strip(lines, BALLAST / 2, 0, 0.09, h), left: strip(lines, 0.06, -GAUGE / 2 - 0.2, 0.3, h), right: strip(lines, 0.06, GAUGE / 2 + 0.2, 0.3, h) }), [lines]) // eslint-disable-line react-hooks/exhaustive-deps
  const sleepers = useMemo(() => {
    const out: THREE.Matrix4[] = []
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    for (const pts of lines) {
      let carry = 0
      for (let i = 1; i < pts.length; i++) {
        const [a, b] = [pts[i - 1], pts[i]]
        const len = Math.hypot(b[0] - a[0], b[1] - a[1])
        q.setFromAxisAngle(up, Math.atan2(b[0] - a[0], b[1] - a[1]))
        for (let d = carry; d < len; d += 1.2) {
          const [x, z] = [a[0] + ((b[0] - a[0]) * d) / len, a[1] + ((b[1] - a[1]) * d) / len]
          out.push(m.compose(new THREE.Vector3(x, h(x, z) + 0.17, z), q, new THREE.Vector3(2.4, 0.12, 0.25)).clone())
        }
        carry = Math.max(0, carry - len + Math.ceil((len - carry) / 1.2) * 1.2)
      }
    }
    return out
  }, [lines]) // eslint-disable-line react-hooks/exhaustive-deps
  const inst = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const im = inst.current
    if (!im) return
    sleepers.forEach((m, i) => im.setMatrixAt(i, m))
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [sleepers])
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos])
  return (
    <group>
      <mesh geometry={geos.ballast} material={ballastMat} receiveShadow />
      <mesh geometry={geos.left} material={railMat} />
      <mesh geometry={geos.right} material={railMat} />
      {sleepers.length > 0 && <instancedMesh key={sleepers.length} ref={inst} args={[BOX, sleeperMat, sleepers.length]} />}
    </group>
  )
}

/** A platform beside the track at a station, its shelter and its name. */
function Platform({ name, at, rot, side }: { name: string; at: XZ; rot: number; side: number }) {
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, rot, 0]}>
      <group position={[side * 3.6, 0, 0]}>
        <mesh geometry={BOX} material={platformMat} position={[0, 0.45, 0]} scale={[3.2, 0.9, 60]} receiveShadow />
        <mesh geometry={BOX} material={edgeMat} position={[-side * 1.5, 0.91, 0]} scale={[0.2, 0.02, 60]} />
        {[-12, 0, 12].map((z) => (
          <mesh key={z} geometry={BOX} material={postMat} position={[side * 0.9, 2.1, z]} scale={[0.15, 2.4, 0.15]} />
        ))}
        <mesh geometry={BOX} material={roofMat} position={[0.2 * side, 3.35, 0]} scale={[3.4, 0.15, 30]} castShadow />
        <Html position={[0, 4.2, 0]} center zIndexRange={[10, 0]} distanceFactor={40}>
          <div className="rounded-md bg-[#1f5f3f] px-2 py-0.5 text-[12px] font-extrabold whitespace-nowrap text-white shadow">🚆 {name}</div>
        </Html>
      </group>
    </group>
  )
}

type Pose = { x: number; z: number; r: number }

/** The locomotive and its coaches, following its head along the line, stopping at the stations. */
function Train({ net, stations, seed, start, nav, night }: { net: RailNet; stations: XZ[]; seed: string; start: number; nav: Nav; night: boolean }) {
  // The doors (0 shut … 1 open), opened a moment after it stops, shut before it goes.
  const doors = useRef(0)
  const horned = useRef(0)
  // (Made once: as more of the map loads, the line grows and the train goes on along it, roam.ts rejoin.)
  const netRef = useRef(net)
  netRef.current = net
  const roam = useMemo(() => new Roamer(`train${start}`, { minWidth: 0 }, netRef.current as unknown as Nav, seed), [seed, start])
  // Where the head has been, a point every half metre: the coaches go where it went.
  const trail = useRef<Pose[]>([])
  const v = useRef(1)
  const stop = useRef({ until: 0, last: -1 })
  const refs = useRef<(THREE.Group | null)[]>([])
  useEffect(() => {
    trail.current = []
    // Already a whole train on the line: the head driven on a train's length first.
    for (let k = 0; k < ((COACHES + 1) * CAR) / 0.5 + 4; k++) {
      roam.advance(netRef.current as unknown as Nav, 0.5)
      const p = roam.at
      trail.current.unshift({ x: p.x, z: p.z, r: p.r })
    }
  }, [roam])
  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const t = clock.elapsedTime
    const head = roam.at
    // A station just ahead: slow down into it and stand a moment at the platform.
    let want = t < stop.current.until ? 0 : 1
    if (want) {
      for (let i = 0; i < stations.length; i++) {
        const d = Math.hypot(stations[i][0] - head.x, stations[i][1] - head.z)
        if (d < 40 && i !== stop.current.last) want = Math.min(want, Math.max(0.12, d / 40))
        if (d < 4 && i !== stop.current.last) {
          stop.current = { until: t + DWELL, last: i }
          want = 0
        }
      }
    }
    // At the platform: the doors open after a moment, close a few seconds before it leaves; then the horn.
    const atStation = t < stop.current.until
    const open = atStation && t > stop.current.until - DWELL + 1.5 && t < stop.current.until - 3
    doors.current += Math.max(-dt * 1.2, Math.min(dt * 1.2, (open ? 1 : 0) - doors.current))
    trainsAt.set(start, atStation && open ? stop.current.last : -1)
    const d = Math.hypot(head.x - whereabouts.sim[0], head.z - whereabouts.sim[1])
    if (atStation && t > stop.current.until - 1 && horned.current < stop.current.until) {
      horned.current = stop.current.until
      sfx.horn(1 - d / 260)
    }
    // And now and then on the way, at a crossing ahead (crossings.ts below), for whoever is near.
    if (!atStation && t - horned.current > 25 && nearCrossing(head.x, head.z, 70)) {
      horned.current = t
      sfx.horn(1 - d / 260)
    }
    trainHeads.set(start, { x: head.x, z: head.z, r: head.r })
    v.current += Math.max(-0.8 * dt, Math.min(0.25 * dt, want - v.current))
    const dist = SPEED * Math.max(0, v.current) * dt
    let moved = 0
    while (moved < dist) {
      const step = Math.min(0.5, dist - moved)
      roam.advance(netRef.current as unknown as Nav, step)
      moved += step
      const p = roam.at
      const last = trail.current[0]
      if (!last || Math.hypot(p.x - last.x, p.z - last.z) >= 0.5) {
        trail.current.unshift({ x: p.x, z: p.z, r: p.r })
        if (trail.current.length > 400) trail.current.pop()
      }
    }
    // Each car: the trail's point its distance behind the head (its middle).
    for (let c = 0; c <= COACHES; c++) {
      const g = refs.current[c]
      if (!g) continue
      const k = Math.min(trail.current.length - 1, Math.round((c * CAR + CAR / 2) / 0.5))
      const front = trail.current[Math.max(0, k - 14)]
      const back = trail.current[Math.min(trail.current.length - 1, k + 14)]
      const p = trail.current[k]
      if (!p || !front || !back) continue
      g.position.set(p.x, nav.heightAt(p.x, p.z) + 0.3, p.z)
      g.rotation.y = Math.atan2(front.x - back.x, front.z - back.z)
      moveObstacle(`train:${start}:${c}`, { x: p.x, z: p.z, hw: 1.6, hd: CAR / 2, rot: g.rotation.y })
    }
    if (import.meta.env.DEV) ((globalThis as { __trains?: Record<number, Pose> }).__trains ??= {})[start] = { x: head.x, z: head.z, r: head.r }
  })
  useEffect(
    () => () => {
      ;[...Array(COACHES + 1)].forEach((_, c) => moveObstacle(`train:${start}:${c}`, null))
      trainsAt.delete(start)
      trainHeads.delete(start)
    },
    [start],
  )
  return (
    <group>
      {[...Array(COACHES + 1)].map((_, c) => (
        <group key={c} ref={(g) => void (refs.current[c] = g)}>
          {c === 0 ? <Locomotive night={night} /> : <Coach doors={doors} seed={c * 31 + start * 7} />}
        </group>
      ))}
    </group>
  )
}

/** Which station each train stands at with its doors open (its index in the stations), -1 on the way. */
const trainsAt = new Map<number, number>()
/** Where each train's head is now. */
const trainHeads = new Map<number, { x: number; z: number; r: number }>()
/** The level crossings of the line now (Railway sets them). */
let crossings: Crossing[] = []
const nearCrossing = (x: number, z: number, r: number) => crossings.some((c) => Math.hypot(c.at[0] - x, c.at[1] - z) < r)

type Crossing = { key: string; at: XZ; road: number; width: number }

/**
 * Where the line crosses a street: the street's segments cut by the track's (the bridges and the streets
 * too narrow for a car aside), one crossing per 40 m.
 */
function crossingsOf(lines: XZ[][], nav: Nav): Crossing[] {
  const out: Crossing[] = []
  const cut = (a: XZ, b: XZ, c: XZ, d: XZ): XZ | null => {
    const r = [b[0] - a[0], b[1] - a[1]]
    const q = [d[0] - c[0], d[1] - c[1]]
    const den = r[0] * q[1] - r[1] * q[0]
    if (Math.abs(den) < 1e-6) return null
    const t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / den
    const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + r[0] * t, a[1] + r[1] * t] : null
  }
  for (const e of nav.edges) {
    if (e.width < 6 || nav.ys[e.a] || nav.ys[e.b]) continue
    const [c, d] = [nav.nodes[e.a], nav.nodes[e.b]]
    for (const pts of lines)
      for (let i = 1; i < pts.length; i++) {
        const p = cut(pts[i - 1], pts[i], c, d)
        if (!p || out.some((o) => Math.hypot(o.at[0] - p[0], o.at[1] - p[1]) < 40)) continue
        out.push({ key: `${Math.round(p[0])}:${Math.round(p[1])}`, at: p, road: Math.atan2(d[0] - c[0], d[1] - c[1]), width: e.width })
      }
  }
  return out
}

const poleMat = new THREE.MeshLambertMaterial({ color: '#f4f4f4' })
const armRed = new THREE.MeshLambertMaterial({ color: '#d63a2f' })
const armWhite = new THREE.MeshLambertMaterial({ color: '#f4f4f4' })
const crossMat = new THREE.MeshLambertMaterial({ color: '#f4f4f4' })
const redOff = new THREE.MeshLambertMaterial({ color: '#4a1512' })
const redOn = new THREE.MeshBasicMaterial({ color: '#ff3b30' })

/**
 * A level crossing: on each side of the line, a post with its two red lamps blinking and the cross of
 * St Andrew, and a red-and-white barrier coming down across the road while a train comes (within 140 m,
 * not yet past by 25). Closed, the cars wait at it as at a red light (trafficFlow report, 'red').
 */
function LevelCrossing({ c }: { c: Crossing }) {
  const arms = useRef<(THREE.Group | null)[]>([])
  const lamps = useRef<(THREE.Mesh | null)[]>([])
  const shut = useRef(0)
  const rang = useRef(0)
  useFrame(({ clock }, dt) => {
    let coming = false
    for (const h of trainHeads.values()) {
      const d = Math.hypot(h.x - c.at[0], h.z - c.at[1])
      if (d < 140) {
        // Ahead of the train, or just past its head (its coaches still crossing).
        const ahead = (c.at[0] - h.x) * Math.sin(h.r) + (c.at[1] - h.z) * Math.cos(h.r)
        if (ahead > -(CAR * 5 + 10)) coming = true
      }
    }
    shut.current += Math.max(-dt * 0.6, Math.min(dt * 0.6, (coming ? 1 : 0) - shut.current))
    arms.current.forEach((g) => g && (g.rotation.z = (1 - shut.current) * (Math.PI / 2 - 0.05)))
    const blink = coming && Math.floor(clock.elapsedTime * 2) % 2 === 0
    lamps.current.forEach((m, i) => m && (m.material = coming && (i % 2 === 0) === blink ? redOn : redOff))
    // Closed: the cars stop at it, both ways (a car across the road, waiting at a red).
    if (shut.current > 0.3) report(`crossing:${c.key}`, { x: c.at[0], z: c.at[1], h: c.road + Math.PI / 2, half: c.width / 2 + 2, wait: 'red' })
    else report(`crossing:${c.key}`, null)
    if (coming && clock.elapsedTime - rang.current > 4) {
      rang.current = clock.elapsedTime
      const d = Math.hypot(c.at[0] - whereabouts.sim[0], c.at[1] - whereabouts.sim[1])
      if (d < 60) sfx.crossingBell(3.5, 1 - d / 60)
    }
  })
  useEffect(() => () => void report(`crossing:${c.key}`, null), [c.key])
  // The road's frame: its way along z; the posts on its kerbs, before and after the track.
  const half = c.width / 2 + 1.2
  return (
    <group position={[c.at[0], 0, c.at[1]]} rotation={[0, c.road, 0]}>
      {[-1, 1].map((s, i) => (
        <group key={s} position={[s * half, 0, s * 4]} rotation={[0, s > 0 ? Math.PI : 0, 0]}>
          <mesh geometry={BOX} material={poleMat} position={[0, 1.5, 0]} scale={[0.15, 3, 0.15]} />
          {/* The cross, the two lamps */}
          <mesh geometry={BOX} material={crossMat} position={[0, 2.9, 0.1]} rotation={[0, 0, 0.6]} scale={[1.1, 0.16, 0.04]} />
          <mesh geometry={BOX} material={crossMat} position={[0, 2.9, 0.1]} rotation={[0, 0, -0.6]} scale={[1.1, 0.16, 0.04]} />
          {[-0.3, 0.3].map((x, k) => (
            <mesh key={x} ref={(m) => void (lamps.current[i * 2 + k] = m)} geometry={BOX} material={redOff} position={[x, 2.2, 0.12]} scale={[0.26, 0.26, 0.06]} />
          ))}
          {/* The barrier, hinged at the post, across its half of the road when down */}
          <group ref={(g) => void (arms.current[i] = g)} position={[0, 1.1, 0.2]}>
            {[...Array(4)].map((_, k) => (
              <mesh key={k} geometry={BOX} material={k % 2 ? armWhite : armRed} position={[0.6 + k * 1.2 * (c.width / 2 / 4.6), 0, 0]} scale={[1.2 * (c.width / 2 / 4.6), 0.12, 0.08]} />
            ))}
          </group>
        </group>
      ))}
    </group>
  )
}

/**
 * The people on a platform: waiting while no train is in (on their phones, a bag at their feet), off to
 * its doors when one stands with its doors open, gone aboard; and a few getting off, walking away along
 * the platform. Only at the station near the Sim.
 */
function PlatformCrowd({ index, name, at, rot, side }: { index: number; name: string; at: XZ; rot: number; side: number }) {
  const people = useMemo(() => {
    const r = rng(`quai|${name}`)
    return [...Array(6)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { i, gender, look: randomLook(gender, r), seed: r() * 100, z: (r() - 0.5) * 40, x: side * (3 + r() * 1.6), pose: (r() < 0.5 ? 'phone' : 'idle') as 'phone' | 'idle' }
    })
  }, [name, side])
  const refs = useRef<(THREE.Group | null)[]>([])
  const phase = useRef<{ open: boolean; since: number }>({ open: false, since: 0 })
  useFrame(({ clock }, dt) => {
    const open = [...trainsAt.values()].includes(index)
    if (open !== phase.current.open) phase.current = { open, since: clock.elapsedTime }
    const k = clock.elapsedTime - phase.current.since
    people.forEach((p, i) => {
      const g = refs.current[i]
      if (!g) return
      if (phase.current.open) {
        // The first four board: to the platform's edge, then gone; the others get off: from the edge, away.
        const boards = i < 4
        const [tx, tz] = boards ? [side * 1.9, p.z] : [side * 4.2, p.z + 12]
        const [dx, dz] = [tx - g.position.x, tz - g.position.z]
        const d = Math.hypot(dx, dz)
        if (!boards && k < 0.1) g.position.set(side * 1.9, 0.9, p.z)
        if (d > 0.1) {
          g.position.x += (dx / d) * Math.min(d, 1.4 * dt)
          g.position.z += (dz / d) * Math.min(d, 1.4 * dt)
          g.rotation.y = Math.atan2(dx, dz)
        }
        g.visible = boards ? d > 0.2 : k < 9
      } else {
        g.visible = true
        g.position.set(p.x, 0.9, p.z)
        g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
      }
    })
  })
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, rot, 0]}>
      <NoShadows>
        {people.map((p, i) => (
          <group key={i} ref={(g) => void (refs.current[i] = g)} position={[p.x, 0.9, p.z]}>
            <TalkHuman id={`quai:${name}:${i}`} look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}

/** The railway of the loaded chunks: its tracks, its stations' platforms, and two trains on it. */
export function Railway({ lines, pois, nav, seed, night }: { lines: XZ[][]; pois: Poi[]; nav: Nav; seed: string; night: boolean }) {
  const net = useMemo(() => new RailNet(lines), [lines])
  // The stations of the map (railway station or halt), on the line: the nearest point of the track, its way.
  const stations = useMemo(() => {
    const out: { name: string; at: XZ; rot: number; side: number }[] = []
    for (const p of pois) {
      if (p.cls !== 'railway' || (p.type !== 'station' && p.type !== 'halt')) continue
      const near = net.nearest(p.at, 60)
      if (!near || out.some((o) => o.name === p.name || Math.hypot(o.at[0] - near.at[0], o.at[1] - near.at[1]) < 80)) continue
      const e = net.edges[near.edge]
      const [a, b] = [net.nodes[e.a], net.nodes[e.b]]
      const rot = Math.atan2(b[0] - a[0], b[1] - a[1])
      // On the side of the track where the station is.
      const side = (p.at[0] - near.at[0]) * Math.cos(rot) - (p.at[1] - near.at[1]) * Math.sin(rot) >= 0 ? 1 : -1
      out.push({ name: p.name, at: near.at, rot, side })
    }
    return out
  }, [pois, net])
  const stops = useMemo(() => stations.map((s) => s.at), [stations])
  const crossingList = useMemo(() => crossingsOf(lines, nav), [lines, nav])
  useEffect(() => {
    crossings = crossingList
  }, [crossingList])
  if (import.meta.env.DEV) Object.assign(globalThis, { __railway: { edges: net.edges.length, stations: stations.map((s) => s.name), crossings: crossingList.length } })
  if (!net.edges.length) return null
  return (
    <group>
      <Tracks lines={lines} nav={nav} />
      {stations.map((s, i) => (
        <group key={s.name}>
          <Platform {...s} />
          {Math.hypot(s.at[0] - whereabouts.sim[0], s.at[1] - whereabouts.sim[1]) < 250 && <PlatformCrowd index={i} {...s} />}
        </group>
      ))}
      {crossingList.map((c) => (
        <LevelCrossing key={c.key} c={c} />
      ))}
      <Train net={net} stations={stops} seed={seed} start={0} nav={nav} night={night} />
      {net.edges.length > 200 && <Train net={net} stations={stops} seed={`${seed}b`} start={1} nav={nav} night={night} />}
    </group>
  )
}
