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
const CAR = 16.5
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

const ballastMat = new THREE.MeshLambertMaterial({ color: '#7d746a' })
const railMat = new THREE.MeshLambertMaterial({ color: '#5b5f66' })
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
function Train({ net, stations, seed, start, nav }: { net: RailNet; stations: XZ[]; seed: string; start: number; nav: Nav }) {
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
    if (import.meta.env.DEV) ((globalThis as { __trains?: Record<number, Pose> }).__trains ??= {})[start] = { x: head.x, z: head.z, r: v.current }
  })
  useEffect(() => () => [...Array(COACHES + 1)].forEach((_, c) => moveObstacle(`train:${start}:${c}`, null)), [start])
  return (
    <group>
      {[...Array(COACHES + 1)].map((_, c) => (
        <group key={c} ref={(g) => void (refs.current[c] = g)}>
          {c === 0 ? <Locomotive /> : <Coach />}
        </group>
      ))}
    </group>
  )
}

const bodyMat = new THREE.MeshLambertMaterial({ color: '#1f5f3f' })
const bandMat = new THREE.MeshLambertMaterial({ color: '#f2c14b' })
const glassMat = new THREE.MeshLambertMaterial({ color: '#1d2733' })
const roofTop = new THREE.MeshLambertMaterial({ color: '#9aa1a8' })
const wheelMat = new THREE.MeshLambertMaterial({ color: '#202328' })
const lampMat = new THREE.MeshBasicMaterial({ color: '#fff4c2' })

function Bogies() {
  return (
    <>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={wheelMat} position={[0, 0.45, s * (CAR / 2 - 3)]} scale={[2.2, 0.8, 2.6]} />
      ))}
    </>
  )
}

/** A coach: green, the yellow band, a row of windows each side. */
function Coach() {
  return (
    <group>
      <Bogies />
      <mesh geometry={BOX} material={bodyMat} position={[0, 2.2, 0]} scale={[2.9, 2.9, CAR - 0.8]} castShadow />
      <mesh geometry={BOX} material={roofTop} position={[0, 3.75, 0]} scale={[2.7, 0.25, CAR - 1]} />
      <mesh geometry={BOX} material={bandMat} position={[0, 1.35, 0]} scale={[2.94, 0.3, CAR - 0.85]} />
      {[...Array(6)].map((_, i) => (
        <mesh key={i} geometry={BOX} material={glassMat} position={[0, 2.55, (i - 2.5) * 2.4]} scale={[2.95, 0.9, 1.6]} />
      ))}
    </group>
  )
}

/** The locomotive: a longer bonnet, the cab at the front, its lamps. */
function Locomotive() {
  return (
    <group>
      <Bogies />
      <mesh geometry={BOX} material={bodyMat} position={[0, 2.0, -1]} scale={[2.8, 2.5, CAR - 3]} castShadow />
      <mesh geometry={BOX} material={bandMat} position={[0, 1.35, -1]} scale={[2.84, 0.35, CAR - 2.9]} />
      <mesh geometry={BOX} material={bodyMat} position={[0, 2.4, CAR / 2 - 2.6]} scale={[2.9, 3.3, 3]} castShadow />
      <mesh geometry={BOX} material={glassMat} position={[0, 3.2, CAR / 2 - 1.08]} scale={[2.5, 0.9, 0.05]} />
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} geometry={BOX} material={lampMat} position={[x, 1.6, CAR / 2 - 1.07]} scale={[0.35, 0.25, 0.05]} />
      ))}
    </group>
  )
}

/** The railway of the loaded chunks: its tracks, its stations' platforms, and two trains on it. */
export function Railway({ lines, pois, nav, seed }: { lines: XZ[][]; pois: Poi[]; nav: Nav; seed: string }) {
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
  if (import.meta.env.DEV) Object.assign(globalThis, { __railway: { edges: net.edges.length, stations: stations.map((s) => s.name) } })
  if (!net.edges.length) return null
  void whereabouts
  return (
    <group>
      <Tracks lines={lines} nav={nav} />
      {stations.map((s) => (
        <Platform key={s.name} {...s} />
      ))}
      <Train net={net} stations={stops} seed={seed} start={0} nav={nav} />
      {net.edges.length > 200 && <Train net={net} stations={stops} seed={`${seed}b`} start={1} nav={nav} />}
    </group>
  )
}
