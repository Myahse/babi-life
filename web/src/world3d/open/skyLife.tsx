import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Origin, XZ } from './geo'
import { worldTime } from '../../lib/worldClock'
import { aloftAt, makeAloft, CRUISE, type Leg } from '../../lib/airTraffic'
import { airlinerParts } from './airport'
import { weakDevice } from '../../lib/device'

// Life in the sky over the street (the update « camera-vie »), in the game's blocks and cheap on a small phone:
// - flocks of birds (cattle egrets, pied crows, weavers, pigeons) crossing over, some landing on a roof or a tree
//   top for a while, then off again: all the birds are two draws (bodies, wings), their wings beating;
// - Air Lagune's planes on their real lines (lib/airTraffic.ts: the same timetable as the big map), climbing out
//   of Port-Bouët over the town, cruising, coming down: a handful of draws for the planes in sight;
// - now and then a helicopter crossing; by the lagoon and the sea, kites (three draws).
// Nothing is allocated frame after frame: the matrices, vectors and planes are made once and reused.

const M_PER_DEG_LAT = 110574
/** The shared clock (in development, window.__skyShift moves the sky's timetable on: tests wait for no plane). */
const skyNow = () => worldTime() + (import.meta.env.DEV ? ((globalThis as { __skyShift?: number }).__skyShift ?? 0) : 0)

/** A number in [0, 1) for a few integers (a flock, its round, which draw). */
function rand(a: number, b: number, c: number) {
  let h = Math.imul(a + 0x9e3779b9, 2654435761) ^ Math.imul(b + 0x85ebca6b, 2246822519) ^ Math.imul(c + 0xc2b2ae35, 3266489917)
  h = Math.imul(h ^ (h >>> 15), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))

// ---------------------------------------------------------------------------------------------------------
// Birds

/** The kinds of birds: colour, size, how fast the wings beat (per second), how high they fly (m). */
const KINDS = [
  { color: '#f3f1ea', scale: 1.4, beat: 4.2, high: 16, ground: true }, // cattle egrets, white, slow wingbeats (they walk the verges)
  { color: '#1c1c20', scale: 1.15, beat: 5.5, high: 20, ground: false }, // pied crows
  { color: '#e3bf1c', scale: 0.7, beat: 11, high: 10, ground: false }, // village weavers
  { color: '#8c919b', scale: 0.95, beat: 7, high: 12, ground: true }, // pigeons, pecking in the street
]
const PER_FLOCK = weakDevice ? 7 : 9
const FLOCKS = weakDevice ? 2 : 4
const BIRDS = PER_FLOCK * FLOCKS
/** A crossing's length (m), passing near the Sim. */
const CROSS = 420

type Flock = {
  round: number
  kind: number
  /** When this round starts (s, on the scene's clock), and its kind: crossing over, or landing a while. */
  t0: number
  land: boolean
  // Where it comes from, where it lands (or passes), where it goes (x, y, z).
  a: THREE.Vector3
  p: THREE.Vector3
  b: THREE.Vector3
  speed: number
  /** How long it sits (s), and how far apart the birds sit (m, along a roof's ridge or round a tree top). */
  sit: number
  spread: number
  /** Gap before the round (s): the sky isn't always full. */
  gap: number
}
type Bird = { ox: number; oy: number; oz: number; phase: number; px: number; pz: number; face: number; hop: number }

const birdBody = new THREE.BoxGeometry(0.13, 0.12, 0.42)
// The wing, its root at the body's side (x = 0): out along +x; the left one is the same, mirrored.
const birdWing = new THREE.BoxGeometry(0.42, 0.025, 0.17).translate(0.21, 0, 0)
const birdMat = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const birdWingMat = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide })

type Perch = (x: number, z: number) => number

function Birds({ focus, roofAt, trees }: { focus: React.RefObject<XZ>; roofAt?: Perch; trees: { x: number; z: number; h: number }[] }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const wings = useRef<THREE.InstancedMesh>(null)
  const flocks = useMemo<Flock[]>(() => Array.from({ length: FLOCKS }, (_, i) => ({ round: i * 7, kind: i % KINDS.length, t0: -1, land: false, a: new THREE.Vector3(), p: new THREE.Vector3(), b: new THREE.Vector3(), speed: 10, sit: 0, spread: 2, gap: 0 })), [])
  const birds = useMemo<Bird[]>(
    () =>
      Array.from({ length: BIRDS }, (_, i) => {
        const r = (k: number) => rand(i, 11, k)
        return { ox: (r(1) - 0.5) * 7, oy: (r(2) - 0.5) * 2.4, oz: (r(3) - 0.5) * 7, phase: r(4) * Math.PI * 2, px: r(5) - 0.5, pz: r(6) - 0.5, face: r(7) * Math.PI * 2, hop: r(8) * 9 }
      }),
    [],
  )
  // Reused frame after frame.
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), w: new THREE.Matrix4(), l: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ'), v: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(), d: new THREE.Vector3(), pos: new THREE.Vector3() }), [])
  const colored = useRef<number[]>([])

  // A new round for a flock: across the sky near the Sim, or down onto a roof or a tree top near it a while.
  const plan = (f: Flock, now: number) => {
    const [fx, fz] = focus.current ?? [0, 0]
    f.round++
    const r = (k: number) => rand(f.round, flocks.indexOf(f), k)
    f.kind = Math.floor(r(1) * KINDS.length)
    const kind = KINDS[f.kind]
    f.speed = 8 + r(2) * 4
    f.gap = 3 + r(3) * 12
    f.t0 = now + f.gap
    const dir = r(4) * Math.PI * 2
    const [ux, uz] = [Math.sin(dir), Math.cos(dir)]
    f.land = false
    // Down in the street a little way ahead of the Sim (pigeons, egrets): pecking about till it comes near.
    const way = r(5)
    if (way < 0.35 && kind.ground) {
      for (let k = 0; k < 6 && !f.land; k++) {
        const ang = r(50 + k) * Math.PI * 2
        const dist = 7 + r(60 + k) * 9
        const x = fx + Math.sin(ang) * dist
        const z = fz + Math.cos(ang) * dist
        if ((roofAt?.(x, z) ?? 0) > 0.5) continue
        f.p.set(x, 0.02, z)
        f.spread = 2.2
        f.land = true
      }
    }
    // Else on a roof or a tree top, 12 to 45 m off.
    if (!f.land && way < 0.7) {
      for (let k = 0; k < 10 && !f.land; k++) {
        const ang = r(10 + k) * Math.PI * 2
        const dist = 12 + r(30 + k) * 33
        const x = fx + Math.sin(ang) * dist
        const z = fz + Math.cos(ang) * dist
        const roof = roofAt?.(x, z) ?? 0
        if (roof > 3) {
          f.p.set(x, roof + 0.08, z)
          f.spread = 3.2
          f.land = true
          break
        }
        let best = 14
        for (const t of trees) {
          const d = Math.hypot(t.x - x, t.z - z)
          if (d < best) {
            best = d
            f.p.set(t.x, t.h + 2.72, t.z)
            f.spread = 2.6
            f.land = true
          }
        }
      }
    }
    if (f.land) {
      f.sit = 12 + r(6) * 16
      f.a.set(f.p.x - ux * 170, f.p.y + 22 + r(7) * 10, f.p.z - uz * 170)
      const out = dir + (r(8) - 0.5) * 2
      f.b.set(f.p.x + Math.sin(out) * 200, f.p.y + 30, f.p.z + Math.cos(out) * 200)
    } else {
      const side = (r(9) - 0.5) * 90
      const h = kind.high + r(7) * 14
      f.a.set(fx - ux * (CROSS / 2) + uz * side, h, fz - uz * (CROSS / 2) - ux * side)
      f.b.set(fx + ux * (CROSS / 2) + uz * side, h + (r(8) - 0.5) * 8, fz + uz * (CROSS / 2) - ux * side)
      f.p.copy(f.b)
    }
  }

  useFrame(({ clock, camera }) => {
    const bm = bodies.current
    const wm = wings.current
    if (!bm || !wm) return
    // From high above (the view over the town) or far off, birds are specks: not drawn.
    const far = camera.position.y > 260
    bm.visible = wm.visible = !far
    if (far) return
    const now = clock.elapsedTime
    const { m, w, l, q, e, v, s, c, d, pos } = tmp
    let n = 0
    for (let fi = 0; fi < flocks.length; fi++) {
      const f = flocks[fi]
      if (f.t0 < 0) plan(f, now - 5 - fi * 4)
      const kind = KINDS[f.kind]
      let tau = now - f.t0
      // The round's parts (s): flying in (to the perch, or across), sitting, flying off.
      const inLen = f.a.distanceTo(f.p) / f.speed
      const outLen = f.land ? f.p.distanceTo(f.b) / f.speed : 0
      const total = inLen + (f.land ? f.sit : 0) + outLen
      if (tau > total) {
        plan(f, now)
        tau = now - f.t0
      }
      if (tau < 0) continue
      // Its colour, once per round.
      if (colored.current[fi] !== f.round) {
        colored.current[fi] = f.round
        c.set(kind.color)
        for (let i = 0; i < PER_FLOCK; i++) {
          bm.setColorAt(fi * PER_FLOCK + i, c)
          wm.setColorAt((fi * PER_FLOCK + i) * 2, c)
          wm.setColorAt((fi * PER_FLOCK + i) * 2 + 1, c)
        }
        if (bm.instanceColor) bm.instanceColor.needsUpdate = true
        if (wm.instanceColor) wm.instanceColor.needsUpdate = true
      }
      // The flock's centre now, the way it flies, and how far into its landing (0 flying, 1 sat).
      let sat = 0
      let flap = 1
      if (tau < inLen) {
        const u = tau / inLen
        v.lerpVectors(f.a, f.p, u)
        if (f.land) {
          // Down a curve: level at first, gliding the last part (the wings held out), settling.
          v.y = f.a.y + (f.p.y - f.a.y) * smooth(u * 1.15 - 0.1)
          sat = smooth((u - 0.82) / 0.18)
          flap = u > 0.7 && u < 0.92 ? 0 : 1
        } else v.y += Math.sin(u * 9) * 1.2
        d.subVectors(f.p, f.a)
      } else if (tau < inLen + f.sit) {
        // The Sim walks up to them: off they go, now.
        const [sx, sz] = focus.current ?? [0, 0]
        if (Math.hypot(sx - f.p.x, sz - f.p.z) < 3.5) f.sit = tau - inLen
        v.copy(f.p)
        sat = 1
        d.subVectors(f.p, f.a)
      } else {
        const u = (tau - inLen - f.sit) / outLen
        v.lerpVectors(f.p, f.b, u)
        v.y = f.p.y + (f.b.y - f.p.y) * smooth(u * 1.6)
        sat = 1 - smooth(u * 5)
        d.subVectors(f.b, f.p)
      }
      const heading = Math.atan2(d.x, d.z)
      for (let i = 0; i < PER_FLOCK; i++) {
        const b = birds[fi * PER_FLOCK + i]
        // Flying: its place in the flock (round the centre, turned with it); sat: its spot on the ridge or the tree.
        const ch = Math.cos(heading)
        const sh = Math.sin(heading)
        const fly = 1 - sat
        const sx = b.px * f.spread * 2
        const sz = b.pz * f.spread * (f.spread > 3 ? 0.35 : 1)
        const x = v.x + (b.ox * ch + b.oz * sh) * fly + sx * sat
        const z = v.z + (-b.ox * sh + b.oz * ch) * fly + sz * sat
        // Sat: a little hop now and then, turning about.
        const hopT = (now + b.hop) % 9
        const y = v.y + b.oy * fly + (hopT < 0.35 ? Math.sin((hopT / 0.35) * Math.PI) * 0.12 : 0) * sat
        const face = sat > 0.5 ? b.face + Math.floor((now + b.hop) / 9) * 1.3 : heading
        const k = kind.scale
        // (Sat, it pecks now and then: the body tipped forward a moment.)
        const peck = Math.sin(now * 2.6 + b.phase * 3) > 0.75 ? 0.55 : 0
        e.set(sat > 0.5 ? peck : -0.08, face, 0)
        q.setFromEuler(e)
        m.compose(pos.set(x, y, z), q, s.set(k, k, k))
        bm.setMatrixAt(n, m)
        // The wings: beating (gliding: held out), folded along the back once sat.
        const beat = Math.sin(now * kind.beat * Math.PI * 2 + b.phase)
        const up = flap ? beat * 0.85 : 0.08
        for (let side = 0; side < 2; side++) {
          const sg = side ? -1 : 1
          // (The same turn both sides, the left wing the right one mirrored: they beat together. Folded: laid back along the body.)
          if (sat > 0.5) l.makeRotationY(1.45)
          else l.makeRotationZ(up)
          if (side) l.premultiply(w.makeScale(-1, 1, 1))
          l.setPosition(sg * 0.06, 0.03, 0.02)
          w.multiplyMatrices(m, l)
          wm.setMatrixAt(n * 2 + side, w)
        }
        n++
      }
    }
    bm.count = n
    wm.count = n * 2
    // (None in the air: no draw at all.)
    bm.visible = wm.visible = n > 0
    bm.instanceMatrix.needsUpdate = true
    wm.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={bodies} args={[birdBody, birdMat, BIRDS]} frustumCulled={false} />
      <instancedMesh ref={wings} args={[birdWing, birdWingMat, BIRDS * 2]} frustumCulled={false} />
    </>
  )
}

// ---------------------------------------------------------------------------------------------------------
// Planes

/** The planes drawn at once (the nearest in sight). */
const PLANES = weakDevice ? 2 : 4
/** Drawn up to this far from the camera (m): the scene's far plane is 6 km. */
const SEEN = 5800
/** A touch bigger than life: from the street, a real one kilometres up is a few pixels. */
const PLANE_SCALE = 1.5

// Never fogged: up in the sky, the street's haze doesn't hide them (it would, a few kilometres off).
const planeWhite = new THREE.MeshLambertMaterial({ color: '#f4f5f7', fog: false })
const planeGrey = new THREE.MeshLambertMaterial({ color: '#c3c8cf', fog: false, side: THREE.DoubleSide })
const trailMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false, fog: false })
const beaconMat = new THREE.MeshBasicMaterial({ color: '#ff3030', fog: false })
const tailplaneGeo = new THREE.BoxGeometry(12.5, 0.32, 2.6)
const engineGeo = new THREE.CylinderGeometry(1.15, 0.9, 4.6, 8).rotateX(Math.PI / 2)
const trailGeo = new THREE.BoxGeometry(1.4, 1.4, 1)
const beaconGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9)

function Planes({ legs, origin, night }: { legs: Leg[]; origin: Origin; night: boolean }) {
  const parts = airlinerParts()
  const finMat = useMemo(() => {
    const f = (parts.finMat as THREE.MeshLambertMaterial).clone()
    f.fog = false
    return f
  }, [parts.finMat])
  const body = useRef<THREE.InstancedMesh>(null)
  const wing = useRef<THREE.InstancedMesh>(null)
  const fin = useRef<THREE.InstancedMesh>(null)
  const tail = useRef<THREE.InstancedMesh>(null)
  const engine = useRef<THREE.InstancedMesh>(null)
  const trail = useRef<THREE.InstancedMesh>(null)
  const beacon = useRef<THREE.InstancedMesh>(null)
  // The parts, in the plane's frame (as airport.tsx's FarAirliner sets them).
  const local = useMemo(() => {
    const y = 3.2
    const at = (x: number, yy: number, z: number, sx = 1) => new THREE.Matrix4().makeScale(sx, 1, 1).setPosition(x, yy, z)
    return {
      body: at(0, y, 0),
      wings: [at(0, y - 1.05, 0), at(0, y - 1.05, 0, -1)],
      fin: at(0, y + 1.2, -13.6),
      tail: at(0, y + 1.1, -19.6),
      engines: [at(-6.5, y - 1.95, 1.6), at(6.5, y - 1.95, 1.6)],
      trails: [new THREE.Matrix4().makeScale(1, 1, 420).setPosition(-6, y - 1.9, -220), new THREE.Matrix4().makeScale(1, 1, 420).setPosition(6, y - 1.9, -220)],
      beacon: at(0, y + 1.9, 0),
    }
  }, [])
  const pool = useMemo(() => makeAloft(Math.max(8, legs.length)), [legs.length])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ'), v: new THREE.Vector3(), s: new THREE.Vector3(PLANE_SCALE, PLANE_SCALE, PLANE_SCALE), near: new Int32Array(PLANES), dist: new Float32Array(PLANES) }), [])
  // Development: window.__skyFind(m) moves the timetable on to the next plane within m metres (on the ground) of the camera.
  const cam = useRef<THREE.Camera | null>(null)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = globalThis as { __skyFind?: (m: number) => number; __skyShift?: number }
    w.__skyFind = (within: number) => {
      const c = cam.current
      if (!c) return -1
      const kx = Math.cos((origin.lat * Math.PI) / 180) * 111320
      const list = makeAloft(legs.length + 1)
      for (let dt = 0; dt < 86400; dt += 5) {
        const n = aloftAt(legs, worldTime() + dt, list)
        for (let i = 0; i < n; i++) {
          const a = list[i]
          if (Math.hypot((a.lng - origin.lng) * kx - c.position.x, -(a.lat - origin.lat) * M_PER_DEG_LAT - c.position.z) < within) return (w.__skyShift = dt)
        }
      }
      return -1
    }
  }, [legs, origin])
  useEffect(() => {
    planeWhite.color.set(night ? '#5d6470' : '#f4f5f7')
    planeGrey.color.set(night ? '#4a5059' : '#c3c8cf')
    trailMat.opacity = night ? 0.12 : 0.32
  }, [night])
  useFrame(({ camera, clock }) => {
    cam.current = camera
    const b = body.current
    const wg = wing.current
    const fn = fin.current
    const tl = tail.current
    const en = engine.current
    const tr = trail.current
    const bc = beacon.current
    if (!b || !wg || !fn || !tl || !en || !tr || !bc) return
    const { m, p, q, e, v, s, near, dist } = tmp
    const n = aloftAt(legs, skyNow(), pool)
    const kx = Math.cos((origin.lat * Math.PI) / 180) * 111320
    // The nearest planes in sight (a few: a short list kept in order).
    let k = 0
    for (let i = 0; i < n; i++) {
      const a = pool[i]
      const x = (a.lng - origin.lng) * kx
      const z = -(a.lat - origin.lat) * M_PER_DEG_LAT
      const dd = Math.hypot(x - camera.position.x, a.alt - camera.position.y, z - camera.position.z)
      if (dd > SEEN) continue
      let j = Math.min(k, PLANES - 1)
      if (k >= PLANES && dd >= dist[j]) continue
      while (j > 0 && dist[j - 1] > dd) {
        near[j] = near[j - 1]
        dist[j] = dist[j - 1]
        j--
      }
      near[j] = i
      dist[j] = dd
      if (k < PLANES) k++
    }
    let trails = 0
    const blink = night && clock.elapsedTime % 1.2 < 0.15
    for (let j = 0; j < k; j++) {
      const a = pool[near[j]]
      const x = (a.lng - origin.lng) * kx
      const z = -(a.lat - origin.lat) * M_PER_DEG_LAT
      // Climbing out the nose up, coming down a little nose down; level at cruise.
      const pitch = a.alt >= CRUISE - 1 ? 0 : a.t < 0.5 ? 0.12 : -0.045
      e.set(-pitch, Math.atan2(Math.sin(a.bearing), -Math.cos(a.bearing)), 0)
      q.setFromEuler(e)
      m.compose(v.set(x, a.alt, z), q, s)
      b.setMatrixAt(j, p.multiplyMatrices(m, local.body))
      wg.setMatrixAt(j * 2, p.multiplyMatrices(m, local.wings[0]))
      wg.setMatrixAt(j * 2 + 1, p.multiplyMatrices(m, local.wings[1]))
      fn.setMatrixAt(j, p.multiplyMatrices(m, local.fin))
      tl.setMatrixAt(j, p.multiplyMatrices(m, local.tail))
      en.setMatrixAt(j * 2, p.multiplyMatrices(m, local.engines[0]))
      en.setMatrixAt(j * 2 + 1, p.multiplyMatrices(m, local.engines[1]))
      bc.setMatrixAt(j, p.multiplyMatrices(m, local.beacon))
      // The white trails, high up only (the cold air at cruise).
      if (a.alt > CRUISE * 0.7) {
        tr.setMatrixAt(trails++, p.multiplyMatrices(m, local.trails[0]))
        tr.setMatrixAt(trails++, p.multiplyMatrices(m, local.trails[1]))
      }
    }
    b.count = fn.count = tl.count = k
    wg.count = en.count = k * 2
    tr.count = trails
    bc.count = blink ? k : 0
    b.visible = wg.visible = fn.visible = tl.visible = en.visible = k > 0
    tr.visible = trails > 0
    bc.visible = blink && k > 0
    b.instanceMatrix.needsUpdate = wg.instanceMatrix.needsUpdate = fn.instanceMatrix.needsUpdate = tl.instanceMatrix.needsUpdate = true
    en.instanceMatrix.needsUpdate = tr.instanceMatrix.needsUpdate = bc.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={body} args={[parts.body, planeWhite, PLANES]} frustumCulled={false} />
      <instancedMesh ref={wing} args={[parts.wing, planeGrey, PLANES * 2]} frustumCulled={false} />
      <instancedMesh ref={fin} args={[parts.fin, finMat, PLANES]} frustumCulled={false} />
      <instancedMesh ref={tail} args={[tailplaneGeo, planeGrey, PLANES]} frustumCulled={false} />
      <instancedMesh ref={engine} args={[engineGeo, planeWhite, PLANES * 2]} frustumCulled={false} />
      <instancedMesh ref={trail} args={[trailGeo, trailMat, PLANES * 2]} frustumCulled={false} />
      <instancedMesh ref={beacon} args={[beaconGeo, beaconMat, PLANES]} frustumCulled={false} />
    </>
  )
}

// ---------------------------------------------------------------------------------------------------------
// The helicopter

/** One pass every this many seconds (on the shared clock), lasting PASS. */
const HELI_EVERY = 420
const HELI_PASS = 75
const HELI_RUN = 2200 // m across

const heliBody = new THREE.MeshLambertMaterial({ color: '#1d4f91' })
const heliStripe = new THREE.MeshLambertMaterial({ color: '#f08a24' })
const heliGlass = new THREE.MeshLambertMaterial({ color: '#28394d', emissive: '#0d1622', emissiveIntensity: 0.3 })
const heliDark = new THREE.MeshLambertMaterial({ color: '#2b2f36' })

/** A helicopter crossing over the quarter now and then (the same on every screen), its rotor turning. */
function Helicopter({ focus }: { focus: React.RefObject<XZ> }) {
  const g = useRef<THREE.Group>(null)
  const rotor = useRef<THREE.Group>(null)
  const tailRotor = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const h = g.current
    if (!h) return
    const now = skyNow()
    const round = Math.floor(now / HELI_EVERY)
    const t = now - round * HELI_EVERY
    h.visible = t < HELI_PASS
    if (!h.visible) return
    // Its line for this pass, near the quarter's middle (snapped: the Sim walking about doesn't move it).
    const [fx, fz] = focus.current ?? [0, 0]
    const cx = Math.round(fx / 600) * 600
    const cz = Math.round(fz / 600) * 600
    const dir = rand(round, 3, 1) * Math.PI * 2
    const side = (rand(round, 3, 2) - 0.5) * 500
    const [ux, uz] = [Math.sin(dir), Math.cos(dir)]
    const d = (t / HELI_PASS - 0.5) * HELI_RUN
    h.position.set(cx + ux * d + uz * side, 140 + Math.sin(t * 0.4) * 6, cz + uz * d - ux * side)
    // Nose a little down, flying on; a slow bank.
    h.rotation.set(0.12, dir, Math.sin(t * 0.3) * 0.08, 'YXZ')
    if (rotor.current) rotor.current.rotation.y = clock.elapsedTime * 28
    if (tailRotor.current) tailRotor.current.rotation.x = clock.elapsedTime * 40
  })
  return (
    <group ref={g} name="heli" visible={false} scale={1.4}>
      {/* The cabin, its glass nose, the orange stripe, the tail boom and fin, the skids */}
      <mesh material={heliBody} position={[0, 1.4, 0]}>
        <boxGeometry args={[2.2, 2, 4.4]} />
      </mesh>
      <mesh material={heliGlass} position={[0, 1.55, 2.5]}>
        <boxGeometry args={[2, 1.5, 1.2]} />
      </mesh>
      <mesh material={heliStripe} position={[0, 1.1, 0]}>
        <boxGeometry args={[2.24, 0.35, 4.2]} />
      </mesh>
      <mesh material={heliBody} position={[0, 1.8, -4.4]}>
        <boxGeometry args={[0.5, 0.5, 5]} />
      </mesh>
      <mesh material={heliStripe} position={[0, 2.5, -6.7]}>
        <boxGeometry args={[0.2, 1.5, 0.9]} />
      </mesh>
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} material={heliDark} position={[x, 0, 0.2]}>
          <boxGeometry args={[0.15, 0.15, 4.4]} />
        </mesh>
      ))}
      {/* The main rotor: two long blades on the mast */}
      <group ref={rotor} position={[0, 2.65, 0]}>
        <mesh material={heliDark}>
          <boxGeometry args={[0.35, 0.08, 10.5]} />
        </mesh>
        <mesh material={heliDark}>
          <boxGeometry args={[10.5, 0.08, 0.35]} />
        </mesh>
      </group>
      <group ref={tailRotor} position={[0.3, 2.1, -6.6]}>
        <mesh material={heliDark}>
          <boxGeometry args={[0.06, 2, 0.22]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------------------------------------
// Kites

const KITES = weakDevice ? 2 : 3
const KITE_COLORS = ['#f08a24', '#1f9a4a', '#e0302f', '#2a6fdb', '#f2c230']
const kiteGeo = new THREE.BoxGeometry(1.5, 1.5, 0.06)
const tailGeo = new THREE.BoxGeometry(0.22, 0.22, 0.04)
const stringGeo = new THREE.BoxGeometry(0.03, 0.03, 1).translate(0, 0, 0.5)
const kiteMat = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide })
const stringMat = new THREE.MeshBasicMaterial({ color: '#e9e4d8' })
/** The sea breeze: from the south-west, the kites out to the north-east of who holds them. */
const WIND: XZ = [0.6, -0.8]
const TAIL = 4

/** Kites over the shore near the Sim (the lagoon's or the sea's), on a long string, swaying in the breeze. */
function Kites({ focus, water }: { focus: React.RefObject<XZ>; water: XZ[][][] }) {
  const kites = useRef<THREE.InstancedMesh>(null)
  const tails = useRef<THREE.InstancedMesh>(null)
  const strings = useRef<THREE.InstancedMesh>(null)
  // Where they're flown from: the nearest shore points to the Sim, found again now and then (not each frame).
  const anchors = useMemo(() => Array.from({ length: KITES }, () => ({ x: 0, z: 0, on: false })), [])
  const looked = useRef(-10)
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ'), v: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Color(), o: new THREE.Object3D() }), [])
  useEffect(() => {
    const k = kites.current
    if (!k) return
    for (let i = 0; i < KITES; i++) k.setColorAt(i, tmp.c.set(KITE_COLORS[i % KITE_COLORS.length]))
    if (k.instanceColor) k.instanceColor.needsUpdate = true
    const t = tails.current
    if (!t) return
    for (let i = 0; i < KITES * TAIL; i++) t.setColorAt(i, tmp.c.set(KITE_COLORS[(i + 2) % KITE_COLORS.length]))
    if (t.instanceColor) t.instanceColor.needsUpdate = true
  }, [tmp])
  useFrame(({ clock, camera }) => {
    const km = kites.current
    const tm = tails.current
    const sm = strings.current
    if (!km || !tm || !sm) return
    const now = clock.elapsedTime
    if (now - looked.current > 3) {
      looked.current = now
      // The shore's points 40 to 300 m from the Sim, a few apart.
      const [fx, fz] = focus.current ?? [0, 0]
      let found = 0
      for (const a of anchors) a.on = false
      // (The nearest first: within 120 m, then out to 300.)
      for (let band = 0; band < 2; band++)
        for (const area of water) {
          for (const ring of area) {
            for (let i = 0; i < ring.length && found < KITES; i += 3) {
              const [x, z] = ring[i]
              const d = Math.hypot(x - fx, z - fz)
              if (d < 40 || d > (band ? 300 : 120)) continue
              let apart = true
              for (let j = 0; j < found; j++) if (Math.hypot(anchors[j].x - x, anchors[j].z - z) < 25) apart = false
              if (!apart) continue
              const an = anchors[found++]
              an.x = x
              an.z = z
              an.on = true
            }
          }
        }
    }
    const shown = camera.position.y < 260
    let n = 0
    const { m, q, e, v, s, a, b, o } = tmp
    for (let i = 0; i < KITES; i++) {
      const an = anchors[i]
      if (!an.on || !shown) continue
      const ph = i * 2.1
      const sway = Math.sin(now * 0.7 + ph) * 3.5
      const lift = 22 + i * 4 + Math.sin(now * 1.1 + ph) * 1.6
      const out = 20 + i * 3
      v.set(an.x + WIND[0] * out - WIND[1] * sway, lift, an.z + WIND[1] * out + WIND[0] * sway)
      // Facing back to who holds it, leaning into the wind, rocking.
      e.set(-0.5, Math.atan2(-WIND[0], -WIND[1]), Math.PI / 4 + Math.sin(now * 2.3 + ph) * 0.25)
      q.setFromEuler(e)
      km.setMatrixAt(n, m.compose(v, q, s.set(1, 1.2, 1)))
      // Its tail: little bows hanging below, rippling.
      for (let t = 0; t < TAIL; t++) {
        const dy = -0.9 - t * 0.55
        const wob = Math.sin(now * 5 + t * 0.9 + ph) * 0.25 * (t + 1) * 0.4
        o.position.set(v.x + WIND[0] * (t * 0.35) + wob, v.y + dy, v.z + WIND[1] * (t * 0.35))
        o.rotation.set(0, Math.atan2(-WIND[0], -WIND[1]), now * 3 + t)
        o.updateMatrix()
        tm.setMatrixAt(n * TAIL + t, o.matrix)
      }
      // The string, from a hand on the shore up to the kite.
      a.set(an.x, 1.2, an.z)
      b.copy(v)
      o.position.copy(a)
      o.scale.set(1, 1, a.distanceTo(b))
      o.lookAt(b)
      o.updateMatrix()
      sm.setMatrixAt(n, o.matrix)
      o.scale.set(1, 1, 1)
      n++
    }
    km.count = sm.count = n
    tm.count = n * TAIL
    km.visible = tm.visible = sm.visible = n > 0
    km.instanceMatrix.needsUpdate = tm.instanceMatrix.needsUpdate = sm.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={kites} args={[kiteGeo, kiteMat, KITES]} frustumCulled={false} />
      <instancedMesh ref={tails} args={[tailGeo, kiteMat, KITES * TAIL]} frustumCulled={false} />
      <instancedMesh ref={strings} args={[stringGeo, stringMat, KITES]} frustumCulled={false} />
    </>
  )
}

// ---------------------------------------------------------------------------------------------------------

/** Development: the time the sky's frame work takes (window.__skyMs: total ms, __skyFrames), measured between two stamps. */
let stamped = 0
function Stamp({ start }: { start?: boolean }) {
  useFrame(() => {
    const w = globalThis as { __skyMs?: number; __skyFrames?: number }
    if (start) stamped = performance.now()
    else {
      w.__skyMs = (w.__skyMs ?? 0) + performance.now() - stamped
      w.__skyFrames = (w.__skyFrames ?? 0) + 1
    }
  })
  return null
}

/**
 * The sky over the street, alive: birds by day, the airline's planes day and night, a helicopter now and then,
 * kites by the water on a dry day.
 */
export function SkyLife({ focus, origin, legs, roofAt, trees, water, hour, night, rain }: { focus: React.RefObject<XZ>; origin: Origin; legs: Leg[]; roofAt?: Perch; trees: { x: number; z: number; h: number }[]; water: XZ[][][]; hour: number; night: boolean; rain: boolean }) {
  const day = hour >= 6 && hour < 19
  return (
    <>
      {import.meta.env.DEV && <Stamp start />}
      {day && !rain && <Birds focus={focus} roofAt={roofAt} trees={trees} />}
      {legs.length > 0 && <Planes legs={legs} origin={origin} night={night} />}
      <Helicopter focus={focus} />
      {day && !rain && water.length > 0 && <Kites focus={focus} water={water} />}
      {import.meta.env.DEV && <Stamp />}
    </>
  )
}
