import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Bird } from 'lucide-react'
import { weakDevice } from '../../lib/device'
import { worldTime } from '../../lib/worldClock'
import { t as tr } from '../../lib/i18n'
import { clearObstacles, setObstacles } from '../obstacles'
import { Box } from '../props'
import { RoostingBats, type Roost } from '../bats'
import { whereabouts } from '../whereabouts'
import { CAR_COLORS } from '../vehicles'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'
import type { StreetDensity } from './density'
import { setKerbCars } from './trafficFlow'
import type { Stop } from './sotra'
import { JoinBubble, placeIn } from './joinIn'

// The Plateau alive (the update « plateau-vivant »), as its density says (density.ts):
// - the cars parked along the kerbs of the big streets, bumper to bumper, aligned, never on a
//   crossing nor a junction (their zebras), a bus stop, a driveway or a place's door, never one on
//   another; the traffic keeps its lane beside them (only streets wide enough for both) and turns off
//   where it is when its kerb is full (trafficFlow.tsx kerbTaken);
// - the crowd of the offices on the pavements, suits and pagnes, the badge on its lanyard, the
//   briefcase, the phone at the ear; at lunch the groups round the tanties' stalls; on the weekend only
//   a few guards at the doors and a jogger;
// - the colony of fruit bats in the big trees, famous there; on a weekend's daytime, one can chase
//   them off with a lance-pierre (backend sims/street.go « chauves »).
// All of it instanced (a few meshes for hundreds of things), a hard cap, the far ones cheaper; from
// the shared clock and the map: the same street on every screen.

const LANE_CLEAR = 12 // metres kept clear of a crossing's middle along a street (its zebras, the turn)
const PITCH = 5.3 // a parked car's place along the kerb
const PARK_W = 10 // only streets this wide: the parked lane and the traffic's never meet
const SLOT_RADIUS = 380 // the kerb places worked out round the Sim
const DRAWN = 230 // metres: the parked cars drawn round the Sim
const MAX_CARS = weakDevice ? 110 : 220
const DETAIL = 110 // metres: past it, a parked car is only its body (no glass, no wheels)
const CROWD_MAX = weakDevice ? 110 : 190
const CROWD_RADIUS = 100
const STALLS_MAX = 5

/** A place along a kerb: its middle, its heading (along the street), its seed. */
type Slot = { x: number; z: number; r: number; seed: number; w: number }

/** The local edges, in a grid of 40 m, for what's near a point. */
function edgeGrid(nav: Nav, near: XZ, radius: number) {
  const grid = new Map<string, number[]>()
  const keep: number[] = []
  nav.edges.forEach((e, i) => {
    const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
    const [mx, mz] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    if (Math.hypot(mx - near[0], mz - near[1]) > radius + e.len / 2 + 30) return
    keep.push(i)
    for (let cx = Math.floor((Math.min(a[0], b[0]) - 8) / 40); cx <= Math.floor((Math.max(a[0], b[0]) + 8) / 40); cx++)
      for (let cz = Math.floor((Math.min(a[1], b[1]) - 8) / 40); cz <= Math.floor((Math.max(a[1], b[1]) + 8) / 40); cz++) {
        const k = `${cx},${cz}`
        const cell = grid.get(k)
        if (cell) cell.push(i)
        else grid.set(k, [i])
      }
  })
  const around = (x0: number, z0: number, x1: number, z1: number) => {
    const out = new Set<number>()
    for (let cx = Math.floor(x0 / 40); cx <= Math.floor(x1 / 40); cx++) for (let cz = Math.floor(z0 / 40); cz <= Math.floor(z1 / 40); cz++) for (const i of grid.get(`${cx},${cz}`) ?? []) out.add(i)
    return out
  }
  return { keep, around }
}

/** Distance from a point to a segment. */
function toSegment(p: XZ, a: XZ, b: XZ) {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
  const L = dx * dx + dz * dz || 1
  const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L))
  return Math.hypot(p[0] - a[0] - dx * k, p[1] - a[1] - dz * k)
}

/** Where along edge `e` (metres from its start) the other streets and paths cross or meet it, straight continuations aside. */
function crossings(nav: Nav, e: number, others: Iterable<number>) {
  const E = nav.edges[e]
  const [a, b] = [nav.nodes[E.a], nav.nodes[E.b]]
  const u: XZ = [(b[0] - a[0]) / E.len, (b[1] - a[1]) / E.len]
  const out: number[] = []
  // The ends where the street goes on another way, or meets others: a junction.
  for (const [end, t] of [[E.a, 0], [E.b, E.len]] as const) if (nav.adj[end].length !== 2) out.push(t)
  for (const f of others) {
    if (f === e) continue
    const F = nav.edges[f]
    const [c, d] = [nav.nodes[F.a], nav.nodes[F.b]]
    const [vx, vz] = [d[0] - c[0], d[1] - c[1]]
    const den = u[0] * vz - u[1] * vx
    // (The same street going on straight: not a crossing.)
    if (Math.abs(den) < 0.2 * Math.hypot(vx, vz)) continue
    const t = ((c[0] - a[0]) * vz - (c[1] - a[1]) * vx) / den
    const s = ((c[0] - a[0]) * u[1] - (c[1] - a[1]) * u[0]) / den
    if (t >= -F.width && t <= E.len + F.width && s >= -0.05 && s <= 1.05) out.push(t)
  }
  return out
}

/**
 * The kerb places round a point: along each street wide enough, both sides, every PITCH metres in
 * the stretches clear of the crossings; not by a bus stop, a door or a driveway; not on another
 * street; never one on another.
 */
export function kerbSlots(nav: Nav, near: XZ, avoid: XZ[], stops: Stop[]): Slot[] {
  const { keep, around } = edgeGrid(nav, near, SLOT_RADIUS)
  const out: Slot[] = []
  const taken = new Map<string, Slot[]>()
  const clash = (x: number, z: number) => {
    const [cx, cz] = [Math.floor(x / 8), Math.floor(z / 8)]
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const s of taken.get(`${cx + i},${cz + j}`) ?? []) if (Math.hypot(s.x - x, s.z - z) < PITCH - 0.4) return true
    return false
  }
  for (const i of keep) {
    const E = nav.edges[i]
    if (E.width < PARK_W || E.walled || E.fast || E.deck || nav.ys[E.a] || nav.ys[E.b] || E.len < 2 * LANE_CLEAR + PITCH) continue
    const [a, b] = [nav.nodes[E.a], nav.nodes[E.b]]
    const u: XZ = [(b[0] - a[0]) / E.len, (b[1] - a[1]) / E.len]
    const n: XZ = [u[1], -u[0]]
    const box = [Math.min(a[0], b[0]) - 20, Math.min(a[1], b[1]) - 20, Math.max(a[0], b[0]) + 20, Math.max(a[1], b[1]) + 20] as const
    const others = around(...box)
    const marks = crossings(nav, i, others)
    // The streets near it that aren't it going on: a parked car never stands in one.
    const beside = [...others].filter((f) => {
      if (f === i) return false
      const F = nav.edges[f]
      const shared = F.a === E.a || F.a === E.b || F.b === E.a || F.b === E.b
      if (!shared) return true
      const [c, d] = [nav.nodes[F.a], nav.nodes[F.b]]
      return Math.abs(((d[0] - c[0]) * u[0] + (d[1] - c[1]) * u[1]) / (F.len || 1)) < 0.97
    })
    const off = E.width / 2 - 0.8
    for (const side of [1, -1]) {
      for (let t = LANE_CLEAR + PITCH / 2; t <= E.len - LANE_CLEAR - PITCH / 2; t += PITCH) {
        if (marks.some((m) => Math.abs(m - t) < LANE_CLEAR + PITCH / 2)) continue
        const p: XZ = [a[0] + u[0] * t + n[0] * off * side, a[1] + u[1] * t + n[1] * off * side]
        if (Math.hypot(p[0] - near[0], p[1] - near[1]) > SLOT_RADIUS) continue
        // A bus stop (its bay, a car's length either side), a door, a driveway.
        if (stops.some((s) => Math.hypot(s.at[0] - p[0], s.at[1] - p[1]) < 11)) continue
        if (avoid.some((d) => Math.hypot(d[0] - p[0], d[1] - p[1]) < 7.5)) continue
        // Its front and back both on this street, off every other one.
        const ends: XZ[] = [p, [p[0] + u[0] * 2.4, p[1] + u[1] * 2.4], [p[0] - u[0] * 2.4, p[1] - u[1] * 2.4]]
        if (beside.some((f) => ends.some((q) => toSegment(q, nav.nodes[nav.edges[f].a], nav.nodes[nav.edges[f].b]) < nav.edges[f].width / 2 + 0.6))) continue
        if (clash(p[0], p[1])) continue
        const s: Slot = { x: p[0], z: p[1], r: Math.atan2(u[0], u[1]) + (side > 0 ? 0 : Math.PI), seed: hash(Math.round(p[0] * 2), Math.round(p[1] * 2), 31), w: E.width }
        out.push(s)
        const k = `${Math.floor(p[0] / 8)},${Math.floor(p[1] / 8)}`
        const cell = taken.get(k)
        if (cell) cell.push(s)
        else taken.set(k, [s])
      }
    }
  }
  return out
}

const unit = new THREE.BoxGeometry(1, 1, 1)
const white = () => new THREE.MeshLambertMaterial({ color: '#ffffff' })
const GLASS = new THREE.Color('#2a3a4a')
const TYRE = new THREE.Color('#16171a')

/** Which of the parked cars are drawn now: the nearest MAX_CARS filled places within DRAWN metres, nearest first. */
function nearestFilled(slots: Slot[], share: number, at: XZ) {
  return slots
    .filter((s) => s.seed < share)
    .map((s) => ({ s, d: Math.hypot(s.x - at[0], s.z - at[1]) }))
    .filter((x) => x.d < DRAWN)
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_CARS)
}

/** The cars parked along the kerbs: four instanced meshes (bodies, glass, roofs, axles), the far ones only their body. */
export function ParkedCars({ nav, focus, share, avoid, stops }: { nav: Nav; focus: React.RefObject<XZ>; share: number; avoid: XZ[]; stops: Stop[] }) {
  // The places, worked out again when the Sim has gone 150 m or the map changed.
  const [anchor, setAnchor] = useState<XZ>(() => [...(focus.current ?? [0, 0])] as XZ)
  const slots = useMemo(() => (share > 0 ? kerbSlots(nav, anchor, avoid, stops) : []), [nav, anchor, avoid, stops, share > 0]) // eslint-disable-line react-hooks/exhaustive-deps
  const meshes = { body: useRef<THREE.InstancedMesh>(null), glass: useRef<THREE.InstancedMesh>(null), roof: useRef<THREE.InstancedMesh>(null), axle: useRef<THREE.InstancedMesh>(null) }
  const mats = useMemo(() => [white(), white(), white(), white()], [])
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  const last = useRef<{ at: XZ; share: number; slots: Slot[] | null; t: number }>({ at: [Infinity, Infinity], share: -1, slots: null, t: 0 })
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(), up: new THREE.Vector3(0, 1, 0) }), [])
  useEffect(
    () => () => {
      setKerbCars([])
      clearObstacles('kerb-cars')
    },
    [],
  )
  useFrame(() => {
    const at = focus.current ?? whereabouts.sim
    const L = last.current
    const now = performance.now()
    if (now - L.t < 500) return
    L.t = now
    if (Math.hypot(at[0] - anchor[0], at[1] - anchor[1]) > 150) setAnchor([at[0], at[1]])
    if (L.slots === slots && L.share === share && Math.hypot(at[0] - L.at[0], at[1] - L.at[1]) < 12) return
    L.slots = slots
    L.share = share
    L.at = [at[0], at[1]]
    const cars = share > 0 ? nearestFilled(slots, share, at) : []
    const { m, q, v, s, c, up } = tmp
    const [body, glass, roof, axle] = [meshes.body.current, meshes.glass.current, meshes.roof.current, meshes.axle.current]
    if (!body || !glass || !roof || !axle) return
    let near = 0
    cars.forEach(({ s: slot, d }, i) => {
      const k = slot.seed / Math.max(share, 0.001)
      // The model from its seed: a saloon, a berline, a 4x4 (taller, longer), now and then a small one.
      const tall = (k * 7) % 1 < 0.22
      const len = tall ? 4.75 : 4.2 + ((k * 13) % 1) * 0.5
      const h = tall ? 1.2 : 1
      const y = nav.heightAt(slot.x, slot.z)
      q.setFromAxisAngle(up, slot.r)
      body.setMatrixAt(i, m.compose(v.set(slot.x, y + 0.56 * h, slot.z), q, s.set(1.76, 0.66 * h, len)))
      c.set(CAR_COLORS[Math.floor(((k * 31) % 1) * CAR_COLORS.length)])
      body.setColorAt(i, c)
      if (d < DETAIL) {
        // A little back of the middle: the bonnet in front, the boot behind.
        const back = -len * 0.06
        v.set(Math.sin(slot.r) * back, 0, Math.cos(slot.r) * back)
        glass.setMatrixAt(near, m.compose(v.set(slot.x + v.x, y + 1.13 * h, slot.z + v.z), q, s.set(1.62, 0.44 * h, len * 0.52)))
        glass.setColorAt(near, GLASS)
        roof.setMatrixAt(near, m.compose(v.set(v.x, y + 1.38 * h, v.z), q, s.set(1.56, 0.08, len * 0.46)))
        roof.setColorAt(near, c)
        for (const [j, sz] of [[0, 1], [1, -1]] as const) {
          const o = sz * len * 0.31
          axle.setMatrixAt(near * 2 + j, m.compose(v.set(slot.x + Math.sin(slot.r) * o, y + 0.3, slot.z + Math.cos(slot.r) * o), q, s.set(1.84, 0.56, 0.64)))
          axle.setColorAt(near * 2 + j, TYRE)
        }
        near++
      }
    })
    body.count = cars.length
    glass.count = roof.count = near
    axle.count = near * 2
    for (const x of [body, glass, roof, axle]) {
      x.instanceMatrix.needsUpdate = true
      if (x.instanceColor) x.instanceColor.needsUpdate = true
    }
    setKerbCars(cars.map(({ s: slot }) => [slot.x, slot.z]))
    // Nobody walks through the ones close by.
    setObstacles(
      'kerb-cars',
      cars.filter((x) => x.d < 60).map(({ s: slot }) => ({ x: slot.x, z: slot.z, hw: 0.9, hd: 2.35, rot: slot.r })),
    )
  })
  return (
    <>
      <instancedMesh ref={meshes.body} args={[unit, mats[0], MAX_CARS]} count={0} frustumCulled={false} />
      <instancedMesh ref={meshes.glass} args={[unit, mats[1], MAX_CARS]} count={0} frustumCulled={false} />
      <instancedMesh ref={meshes.roof} args={[unit, mats[2], MAX_CARS]} count={0} frustumCulled={false} />
      <instancedMesh ref={meshes.axle} args={[unit, mats[3], MAX_CARS * 2]} count={0} frustumCulled={false} />
    </>
  )
}

/* ---------- The crowd ---------- */

/** A stretch of pavement people walk up and down: from a, `len` metres along u, at height y. */
type Strip = { a: XZ; u: XZ; len: number; y: number; face: number; key: string }

/** The pavements along the streets round a point, clear of the crossings, on walkable ground only. */
function pavements(nav: Nav, near: XZ): Strip[] {
  const { keep, around } = edgeGrid(nav, near, CROWD_RADIUS + 60)
  const out: Strip[] = []
  for (const i of keep) {
    const E = nav.edges[i]
    if (E.width < 6 || E.walled || E.fast || E.deck || nav.ys[E.a] || nav.ys[E.b] || E.len < 26) continue
    const [a, b] = [nav.nodes[E.a], nav.nodes[E.b]]
    const u: XZ = [(b[0] - a[0]) / E.len, (b[1] - a[1]) / E.len]
    const marks = crossings(nav, i, around(Math.min(a[0], b[0]) - 20, Math.min(a[1], b[1]) - 20, Math.max(a[0], b[0]) + 20, Math.max(a[1], b[1]) + 20))
    const off = Math.min(7.3, Math.max(4.9, E.width / 2 + 1.5))
    for (const side of [1, -1]) {
      const n: XZ = [u[1] * side, -u[0] * side]
      // Every 2 m: walkable, off the crossings (they turn back before the corner).
      let start = -1
      const flush = (end: number) => {
        if (start >= 0 && end - start >= 12) {
          const p: XZ = [a[0] + u[0] * start + n[0] * off, a[1] + u[1] * start + n[1] * off]
          out.push({ a: p, u, len: end - start, y: nav.heightAt(p[0], p[1]), face: Math.atan2(-n[0], -n[1]), key: `${i}:${side}:${Math.round(start)}` })
        }
        start = -1
      }
      for (let t = 0; t <= E.len; t += 2) {
        const p: XZ = [a[0] + u[0] * t + n[0] * off, a[1] + u[1] * t + n[1] * off]
        const ok = !marks.some((m) => Math.abs(m - t) < 8.5) && nav.walkable(p[0], p[1]) && !nav.onRoadway(p, 0.8) && Math.hypot(p[0] - near[0], p[1] - near[1]) < CROWD_RADIUS + 40
        if (ok && start < 0) start = t
        if (!ok) flush(t - 2)
      }
      flush(E.len)
    }
  }
  return out
}

/** What one wears and does. */
type Who = {
  strip: number
  /** metres into its stroll, its speed (0: standing), its side offset */
  off: number
  speed: number
  lat: number
  /** Standing: where (along the strip) and facing where. */
  stand?: { t: number; face: number }
  coat: THREE.Color
  legs: THREE.Color
  skin: THREE.Color
  hair: THREE.Color
  arms: THREE.Color
  hairTall: boolean
  lanyard?: THREE.Color
  case?: boolean
  phone?: boolean
  eating?: boolean
  jog?: boolean
  seed: number
}

const SUITS = ['#1b2433', '#2b2f3a', '#3a3f4a', '#141519', '#4a4f5c', '#23304a', '#5b4a3a'].map((c) => new THREE.Color(c))
const PAGNES = ['#e8590c', '#2f9e44', '#f2c94c', '#1c7ed6', '#c2255c', '#7048e8', '#0ca678', '#f08c00', '#d9480f'].map((c) => new THREE.Color(c))
const SHIRTS = ['#f8f9fa', '#dbe4ff', '#e7f5ff', '#fff3bf', '#f1f3f5'].map((c) => new THREE.Color(c))
const SKINS = ['#3b2414', '#4a2c1a', '#5c3820', '#6e4428', '#7f5233', '#8f6240'].map((c) => new THREE.Color(c))
const HAIRS = ['#141414', '#1c1410', '#2a1d14'].map((c) => new THREE.Color(c))
const LANYARDS = ['#1c7ed6', '#c92a2a', '#2f9e44', '#f08c00'].map((c) => new THREE.Color(c))
const GUARD = new THREE.Color('#5a5a3c')
const GUARD_TROUSERS = new THREE.Color('#2b2f24')
/** The stall stands a little towards the road from the walkers' line (its customers on the other side). */
const STALL_LAT = -0.5
const pick = <T,>(xs: T[], u: number) => xs[Math.floor(u * xs.length) % xs.length]

/** The office people, the lunch groups at the stalls, or the weekend's few: who, where. */
function cast(strips: Strip[], density: StreetDensity, seed: string, near: XZ) {
  const people: Who[] = []
  const stalls: { strip: number; t: number }[] = []
  if (!strips.length) return { people, stalls }
  // Each stretch by its length, the near ones more (the crowd thick round the Sim, thinner further off).
  const weight = strips.map((x) => x.len / (1 + Math.hypot(x.a[0] + x.u[0] * x.len * 0.5 - near[0], x.a[1] + x.u[1] * x.len * 0.5 - near[1]) / 45))
  const total = weight.reduce((s, w) => s + w, 0)
  const at = (u: number) => {
    let x = u * total
    for (let i = 0; i < strips.length; i++) if ((x -= weight[i]) < 0) return i
    return strips.length - 1
  }
  const r = (k: number, salt: number) => hash(k, salt, seed.length)
  if (density.quiet) {
    // A few guards at the doors, standing; a jogger or two.
    for (let k = 0; k < 5; k++) {
      const i = at(r(k, 1))
      const s = strips[i]
      people.push({ strip: i, off: 0, speed: 0, lat: 0.9, stand: { t: r(k, 2) * s.len, face: s.face }, coat: GUARD, legs: GUARD_TROUSERS, arms: GUARD, skin: pick(SKINS, r(k, 3)), hair: GUARD_TROUSERS, hairTall: false, seed: k })
    }
    for (let k = 0; k < 2; k++) {
      const i = at(r(k + 9, 4))
      people.push({ strip: i, off: r(k, 5) * 80, speed: 2.7, lat: -0.4, coat: pick(PAGNES, r(k, 6)), legs: HAIRS[0], arms: pick(SKINS, r(k, 7)), skin: pick(SKINS, r(k, 7)), hair: HAIRS[0], hairTall: false, jog: true, seed: k + 50 })
    }
    return { people, stalls }
  }
  const n = Math.round(CROWD_MAX * Math.min(1, density.office))
  // At lunch: a stall every so often, a group round each.
  if (density.lunch)
    for (let k = 0; k < STALLS_MAX; k++) {
      const i = at(r(k, 21))
      if (strips[i].len < 16 || stalls.some((x) => x.strip === i)) continue
      stalls.push({ strip: i, t: 4 + r(k, 22) * (strips[i].len - 8) })
    }
  for (let k = 0; k < n; k++) {
    const woman = r(k, 8) < 0.5
    const pagne = r(k, 9) < (woman ? 0.6 : 0.25)
    const skin = pick(SKINS, r(k, 10))
    const coat = pagne ? pick(PAGNES, r(k, 11)) : r(k, 12) < 0.25 ? pick(SHIRTS, r(k, 13)) : pick(SUITS, r(k, 11))
    const short = coat !== undefined && (pagne || SHIRTS.includes(coat)) && r(k, 14) < 0.5
    const w: Who = {
      strip: at(r(k, 15)),
      off: r(k, 16) * 300,
      speed: 1.05 + r(k, 17) * 0.5,
      lat: (r(k, 18) - 0.5) * 1.6,
      coat,
      // A dress in pagne all the way down, a skirt and the legs, or the suit's trousers.
      legs: woman && pagne ? coat : woman && r(k, 19) < 0.5 ? skin : pagne ? coat : pick(SUITS, r(k, 20)),
      arms: short ? skin : coat,
      skin,
      hair: woman && pagne && r(k, 23) < 0.6 ? pick(PAGNES, r(k, 24)) : pick(HAIRS, r(k, 23)),
      hairTall: woman && pagne && r(k, 23) < 0.6,
      lanyard: r(k, 25) < 0.55 ? pick(LANYARDS, r(k, 26)) : undefined,
      case: r(k, 27) < 0.3,
      phone: r(k, 28) < 0.2,
      seed: k,
    }
    // At lunch, a third at the stalls, standing round them, eating.
    if (stalls.length && k % 3 === 0) {
      // In an arc on the side away from the road, facing the stall.
      const st = stalls[k % stalls.length]
      const s = strips[st.strip]
      const j = Math.floor(k / 3 / stalls.length)
      const ang = -1.25 + (j % 6) * 0.5
      const rad = 1.4 + Math.floor(j / 6) * 0.75
      const out: XZ = [-Math.sin(s.face), -Math.cos(s.face)]
      const dir: XZ = [-(s.u[0] * Math.sin(ang) + out[0] * Math.cos(ang)), -(s.u[1] * Math.sin(ang) + out[1] * Math.cos(ang))]
      w.strip = st.strip
      w.speed = 0
      w.case = false
      w.eating = !w.phone
      w.lat = STALL_LAT + Math.cos(ang) * rad
      w.stand = { t: st.t + Math.sin(ang) * rad, face: Math.atan2(dir[0], dir[1]) }
    } else if (r(k, 29) < 0.15) {
      // Standing a moment: on the phone, or two talking.
      const s = strips[w.strip]
      w.speed = 0
      w.stand = { t: (r(k, 30) * 0.8 + 0.1) * s.len, face: r(k, 31) * Math.PI * 2 }
    }
    people.push(w)
  }
  return { people, stalls }
}

// Parts of a person, in its own frame (facing +z, the feet at 0): half-sizes and where.
/** The middle of the square of 100 m a point is in. */
const cellMid = (p: XZ): XZ => [Math.floor(p[0] / 100) * 100 + 50, Math.floor(p[1] / 100) * 100 + 50]
const HIP = 0.86
const SHOULDER = 1.44

/** The crowd: seven instanced meshes (legs, torsos, arms, heads, hair, the little things: badges, briefcases, phones), each one walking from the shared clock. */
export function Crowd({ nav, focus, density, seed }: { nav: Nav; focus: React.RefObject<XZ>; density: StreetDensity; seed: string }) {
  // Round the middle of the Sim's square of 100 m: everyone in it sees the same crowd.
  const [anchor, setAnchor] = useState<XZ>(() => cellMid(focus.current ?? [0, 0]))
  const strips = useMemo(() => (density.office > 0 || density.quiet ? pavements(nav, anchor) : []), [nav, anchor, density.office > 0 || density.quiet]) // eslint-disable-line react-hooks/exhaustive-deps
  const { people, stalls } = useMemo(() => cast(strips, density, seed, anchor), [strips, anchor, seed, Math.round(density.office * 20), density.lunch, density.quiet]) // eslint-disable-line react-hooks/exhaustive-deps
  const N = people.length
  // (In development, for tests in the browser: how many, on how many stretches.)
  if (import.meta.env.DEV) Object.assign(globalThis, { __crowd: { strips: strips.length, people: N, stalls: stalls.map((st) => strips[st.strip] && [Math.round(strips[st.strip].a[0] + strips[st.strip].u[0] * st.t), Math.round(strips[st.strip].a[1] + strips[st.strip].u[1] * st.t)]) } })
  const refs = { legs: useRef<THREE.InstancedMesh>(null), torso: useRef<THREE.InstancedMesh>(null), arms: useRef<THREE.InstancedMesh>(null), head: useRef<THREE.InstancedMesh>(null), hair: useRef<THREE.InstancedMesh>(null), bits: useRef<THREE.InstancedMesh>(null) }
  const mats = useMemo(() => [white(), white(), white(), white(), white(), white()], [])
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  const tmp = useMemo(() => ({ base: new THREE.Matrix4(), part: new THREE.Matrix4(), out: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(), zero: new THREE.Matrix4().makeScale(0, 0, 0) }), [])
  const frame = useRef(0)
  // Colours, once per cast.
  useEffect(() => {
    const [legs, torso, arms, head, hair, bits] = [refs.legs.current, refs.torso.current, refs.arms.current, refs.head.current, refs.hair.current, refs.bits.current]
    if (!legs || !torso || !arms || !head || !hair || !bits) return
    const dark = new THREE.Color('#3a2616')
    const black = new THREE.Color('#111214')
    people.forEach((p, i) => {
      legs.setColorAt(i * 2, p.legs)
      legs.setColorAt(i * 2 + 1, p.legs)
      torso.setColorAt(i, p.coat)
      arms.setColorAt(i * 2, p.arms)
      arms.setColorAt(i * 2 + 1, p.arms)
      head.setColorAt(i, p.skin)
      hair.setColorAt(i, p.hair)
      bits.setColorAt(i * 3, p.lanyard ?? black)
      bits.setColorAt(i * 3 + 1, dark)
      bits.setColorAt(i * 3 + 2, black)
    })
    for (const x of [legs, torso, arms, head, hair, bits]) if (x.instanceColor) x.instanceColor.needsUpdate = true
  }, [people]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    const at = focus.current ?? whereabouts.sim
    const mid = cellMid(at)
    if (mid[0] !== anchor[0] || mid[1] !== anchor[1]) setAnchor(mid)
    const [legs, torso, arms, head, hair, bits] = [refs.legs.current, refs.torso.current, refs.arms.current, refs.head.current, refs.hair.current, refs.bits.current]
    if (!legs || !torso || !arms || !head || !hair || !bits || !N) return
    const f = frame.current++
    const t0 = import.meta.env.DEV ? performance.now() : 0
    const t = worldTime()
    const { base, part, out, q, e, v, s, zero } = tmp
    const put = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, pivot = 0) => {
      // A part hung from a pivot (a hip, a shoulder) `pivot` above its middle, turned rx about x there.
      if (rx) {
        part.makeRotationX(rx)
        part.setPosition(x, y + pivot, z)
        out.makeTranslation(0, -pivot, 0)
        part.multiply(out)
      } else part.makeTranslation(x, y, z)
      part.multiply(out.makeScale(sx, sy, sz))
      mesh.setMatrixAt(i, out.multiplyMatrices(base, part))
    }
    people.forEach((p, i) => {
      const st = strips[p.strip]
      if (!st) return
      // Far ones: moved a few times a second only.
      const far = Math.hypot(st.a[0] + st.u[0] * st.len * 0.5 - at[0], st.a[1] + st.u[1] * st.len * 0.5 - at[1]) > 80
      if (far && (f + i) % 4) return
      let along: number
      let heading: number
      if (p.stand) {
        along = p.stand.t
        heading = p.stand.face
      } else {
        // Up and down its stretch of pavement.
        const L = st.len
        const d = (t * p.speed + p.off) % (2 * L)
        along = d < L ? d : 2 * L - d
        heading = Math.atan2(st.u[0], st.u[1]) + (d < L ? 0 : Math.PI)
      }
      // Across: away from the road for a positive `lat`.
      const x = st.a[0] + st.u[0] * along - Math.sin(st.face) * p.lat
      const z = st.a[1] + st.u[1] * along - Math.cos(st.face) * p.lat
      q.setFromEuler(e.set(0, heading, 0))
      base.compose(v.set(x, st.y, z), q, s.set(1, 1, 1))
      const walking = !p.stand
      const ph = t * (p.jog ? 9 : p.speed * 5.2) + p.seed
      const swing = walking ? Math.sin(ph) * (p.jog ? 0.8 : 0.42) : 0
      const bob = walking ? Math.abs(Math.cos(ph)) * 0.04 : 0
      // Legs from the hips; the arms from the shoulders, swinging the other way (or the phone up, the briefcase held).
      put(legs, i * 2, -0.1, HIP / 2 + bob, 0, 0.17, HIP, 0.19, swing, HIP / 2)
      put(legs, i * 2 + 1, 0.1, HIP / 2 + bob, 0, 0.17, HIP, 0.19, -swing, HIP / 2)
      put(torso, i, 0, (HIP + SHOULDER) / 2 + 0.03 + bob, 0, 0.46, SHOULDER - HIP + 0.06, 0.27)
      const armL = p.case ? swing * 0.25 : -swing * 0.8
      const armR = p.phone ? -2.7 : p.eating ? -1.5 : -swing * -0.8
      put(arms, i * 2, -0.3, SHOULDER - 0.29 + bob, 0, 0.12, 0.6, 0.14, armL, 0.29)
      // (The phone: the arm bent up to the ear, shorter.)
      if (p.phone) put(arms, i * 2 + 1, 0.27, SHOULDER - 0.21 + bob, 0, 0.12, 0.42, 0.14, armR, 0.21)
      else put(arms, i * 2 + 1, 0.3, SHOULDER - 0.29 + bob, 0, 0.12, 0.6, 0.14, armR, 0.29)
      put(head, i, 0, 1.62 + bob, 0.01, 0.24, 0.27, 0.25)
      put(hair, i, 0, (p.hairTall ? 1.84 : 1.78) + bob, 0, 0.26, p.hairTall ? 0.18 : 0.07, 0.27)
      // The badge on its lanyard, the briefcase in the left hand, the phone at the right ear.
      if (p.lanyard) put(bits, i * 3, 0, 1.25 + bob, 0.14, 0.07, 0.11, 0.02)
      else bits.setMatrixAt(i * 3, zero)
      if (p.case) put(bits, i * 3 + 1, -0.36, 0.62 + bob, Math.sin(armL) * 0.5, 0.1, 0.32, 0.42)
      else bits.setMatrixAt(i * 3 + 1, zero)
      if (p.phone) put(bits, i * 3 + 2, 0.17, 1.64 + bob, 0.02, 0.04, 0.13, 0.07)
      else bits.setMatrixAt(i * 3 + 2, zero)
    })
    legs.count = arms.count = N * 2
    torso.count = head.count = hair.count = N
    bits.count = N * 3
    for (const x of [legs, torso, arms, head, hair, bits]) x.instanceMatrix.needsUpdate = true
    // (In development: what moving the crowd costs a frame, in ms, smoothed.)
    if (import.meta.env.DEV) {
      const g = globalThis as unknown as { __crowdMs?: number }
      g.__crowdMs = (g.__crowdMs ?? 0) * 0.95 + (performance.now() - t0) * 0.05
    }
  })
  return (
    <>
      <instancedMesh ref={refs.legs} args={[unit, mats[0], CROWD_MAX * 2]} count={0} frustumCulled={false} />
      <instancedMesh ref={refs.torso} args={[unit, mats[1], CROWD_MAX]} count={0} frustumCulled={false} />
      <instancedMesh ref={refs.arms} args={[unit, mats[2], CROWD_MAX * 2]} count={0} frustumCulled={false} />
      <instancedMesh ref={refs.head} args={[unit, mats[3], CROWD_MAX]} count={0} frustumCulled={false} />
      <instancedMesh ref={refs.hair} args={[unit, mats[4], CROWD_MAX]} count={0} frustumCulled={false} />
      <instancedMesh ref={refs.bits} args={[unit, mats[5], CROWD_MAX * 3]} count={0} frustumCulled={false} />
      {stalls.map((st) => {
        const s = strips[st.strip]
        if (!s) return null
        const out: XZ = [-Math.sin(s.face), -Math.cos(s.face)]
        return <LunchStall key={`${s.key}:${Math.round(st.t)}`} at={[s.a[0] + s.u[0] * st.t + out[0] * STALL_LAT, s.a[1] + s.u[1] * st.t + out[1] * STALL_LAT]} y={s.y} rot={Math.atan2(s.u[0], s.u[1])} />
      })}
    </>
  )
}

/** The tantie's lunch stall on the pavement: the table, the big pot, the plates, the parasol. */
function LunchStall({ at, y, rot }: { at: XZ; y: number; rot: number }) {
  return (
    <group position={[at[0], y, at[1]]} rotation={[0, rot, 0]}>
      <Box p={[0, 0.42, 0]} s={[0.9, 0.06, 1.5]} c="#8a5a32" />
      {[-0.4, 0.4].map((x) => [-0.65, 0.65].map((z) => <Box key={`${x}${z}`} p={[x, 0.2, z]} s={[0.06, 0.4, 0.06]} c="#5c3a1e" />))}
      <Box p={[0, 0.62, -0.35]} s={[0.46, 0.34, 0.46]} c="#adb5bd" />
      <Box p={[0, 0.8, -0.35]} s={[0.5, 0.04, 0.5]} c="#868e96" />
      {[0.15, 0.45].map((z) => <Box key={z} p={[0, 0.47, z]} s={[0.3, 0.04, 0.24]} c="#f8f9fa" />)}
      <Box p={[0, 0.5, 0.15]} s={[0.18, 0.06, 0.14]} c="#f2c94c" />
      <Box p={[0, 1.1, 0]} s={[0.05, 2.2, 0.05]} c="#495057" />
      <Box p={[0, 2.22, 0]} s={[2.2, 0.08, 2.2]} c="#e03131" />
      <Box p={[0, 2.18, 0]} s={[1.6, 0.06, 1.6]} c="#f8f9fa" />
    </group>
  )
}

/* ---------- The bats ---------- */

/** A tree of the map and its canopy's height (the game's trees: OpenWorld Trees). */
export type MapTree = { x: number; z: number; h: number }

/** A colony: its trees, where it's joined from, its bats. */
type Colony = { id: string; at: XZ; trees: MapTree[]; roosts: Roost[] }

/** The colonies in the trees: where a tree has another close by (or, without, a few lone ones), always the same. */
export function colonies(trees: MapTree[]): Colony[] {
  const out: Colony[] = []
  const used = new Set<MapTree>()
  const grid = new Map<string, MapTree[]>()
  for (const tree of trees) {
    const k = `${Math.floor(tree.x / 16)},${Math.floor(tree.z / 16)}`
    const c = grid.get(k)
    if (c) c.push(tree)
    else grid.set(k, [tree])
  }
  const around = (tree: MapTree) => {
    const [cx, cz] = [Math.floor(tree.x / 16), Math.floor(tree.z / 16)]
    const near: MapTree[] = []
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const o of grid.get(`${cx + i},${cz + j}`) ?? []) if (o !== tree && Math.hypot(o.x - tree.x, o.z - tree.z) < 16) near.push(o)
    return near
  }
  for (const pass of [0, 1]) {
    for (const tree of trees) {
      if (used.has(tree) || hash(Math.round(tree.x), Math.round(tree.z), 77) > (pass ? 0.2 : 0.5)) continue
      const near = around(tree).filter((o) => !used.has(o))
      if (!pass && near.length < 1) continue
      const group = [tree, ...near.slice(0, 4)]
      group.forEach((g) => used.add(g))
      const roosts: Roost[] = []
      group.forEach((g, gi) => {
        const n = 5 + Math.floor(hash(g.x, g.z, 5) * 4)
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + gi
          const rad = 1.3 + hash(g.x, g.z, k) * 0.6
          roosts.push({ x: g.x + Math.cos(a) * rad, y: g.h - 0.3, z: g.z + Math.sin(a) * rad, r: a })
        }
      })
      out.push({ id: `${Math.round(tree.x)}:${Math.round(tree.z)}`, at: [tree.x, tree.z], trees: group, roosts })
    }
    // Clusters first; lone trees only where there are none at all.
    if (out.length) break
  }
  return out
}

const BAT_NEAR = 240
const BAT_MAX = 3

/** The colonies round the Sim (BAT_MAX nearest): their bats hanging; by day on the weekend, the bubble to chase them off. */
export function BatTrees({ trees, joinable }: { trees: MapTree[]; /** A weekend's daytime: the activity is on (and its update open). */ joinable: boolean }) {
  const all = useMemo(() => colonies(trees), [trees])
  // (In development, for tests in the browser: where the colonies are.)
  if (import.meta.env.DEV) Object.assign(globalThis, { __colonies: all.map((c) => ({ at: c.at.map(Math.round), trees: c.trees.length, bats: c.roosts.length })) })
  const [shown, setShown] = useState<Colony[]>([])
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 2) return
    tick.current = 0
    const [sx, sz] = whereabouts.sim
    const near = all
      .map((c) => ({ c, d: Math.hypot(c.at[0] - sx, c.at[1] - sz) }))
      .filter((x) => x.d < BAT_NEAR)
      .sort((a, b) => a.d - b.d)
      .slice(0, BAT_MAX)
      .map((x) => x.c)
    if (near.map((c) => c.id).join() !== shown.map((c) => c.id).join()) setShown(near)
  })
  const roosts = useMemo(() => shown.flatMap((c) => c.roosts), [shown])
  return (
    <>
      <RoostingBats roosts={roosts} />
      {joinable &&
        shown.map((c) => {
          const top = c.trees[0]
          return <JoinBubble key={c.id} j={{ vendor: `chauves:${c.id}`, activity: 'chasser-chauves-souris', at: c.at, y: top.h + 3.4, reach: 16, ask: tr('Faire fuir les chauves-souris'), icon: Bird, far: tr('Approche des grands arbres !'), spot: placeIn({ at: c.at, rot: 0 }, 0, -4.5, 0, 'lookup') }} />
        })}
    </>
  )
}
