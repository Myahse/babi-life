import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { featuresKnown, keyOpenNow, onFeatures } from '../../lib/features'
import { weakDevice } from '../../lib/device'
import { BevelBoxGeometry } from '../bevel'
import { BRIDGE_BUILD, type BridgeKind } from './bridgeNames'
import { bridgeWay, wayAt, type Way } from './bridgeLine'
import { BRIDGE_HEIGHT, pointInRing, type XZ } from './geo'
import type { ChunkData } from './tiles'

// « Ponts réalistes » (the update « ponts-realistes », a step of the « blocs réalistes » look, concept
// in the lab's blocs/bridge.ts): Abidjan's big bridges drawn whole, each the way it is built, in
// chamfered blocks. The chunks keep only the deck (asphalt, pavements, markings: what one walks and
// drives on, so the ways and the traffic don't change); the rest is here, along the bridge's middle
// line (bridgeLine.ts), so it runs on unbroken across the chunks:
// - the 1er pont (FHB, 1957): a deep box girder in old weathered concrete, the railway on its lower
//   level seen through the openings along its sides, blade piers with cutwaters, a concrete
//   balustrade, old sodium lamps on alternate sides;
// - the 2e pont (De Gaulle, 1967): a girder deeper over each pier than mid-span (the soffit arched
//   in steps), twin square columns, a steel railing of three tubes, sodium lamps both sides;
// - the 3e pont (HKB, 2014): two precast box girders side by side on one crosshead carried by two
//   round 2 m piles (Bouygues TP), concrete barriers, a footway and cycle path behind a steel
//   balustrade, tall double LED lamps on the median;
// - the 5e pont (Alassane-Ouattara): one white pylon whose two legs meet above the deck into a mast
//   leaning back, 19 stays (lit at night, as the real ones), lamps both sides;
// - the 4e pont: a modern box girder on round piers, double lamps on the median.
// Draw calls: one merged mesh for the structure (a second for the 5e pont's pylon, floodlit at night),
// the repeating parts instanced (railing bays, lamp posts, lamp heads, stays), the near details
// (lane dashes, joints, studs, railing bays) only within a few hundred metres, and at night one
// sprite cloud for the lamps' halos: the string of lights seen across the lagoon.

export const PONTS = 'ponts-realistes'
const HEARD_KEY = 'babi.ponts.ouvert'
function read(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
// In development, ?ponts=0|1 forces it (to compare both).
const FORCED = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('ponts') : null
/** The update is open (before the server has answered: as it said last time, so the chunks asked first agree). */
export function pontsOpen() {
  if (FORCED) return FORCED !== '0'
  // (Never heard either: as the features say before the server answers, shut in the game, open in the labs.)
  const heard = featuresKnown() ? null : read(HEARD_KEY)
  return heard === null ? keyOpenNow(PONTS) : heard === '1'
}
onFeatures(() => {
  if (!featuresKnown()) return
  try {
    localStorage.setItem(HEARD_KEY, keyOpenNow(PONTS) ? '1' : '0')
  } catch {
    // Private mode: as the server says, once it has.
  }
})

/* ---------- A kit of blocks merged into one geometry ---------- */

const V1 = new THREE.Vector3()
const N3 = new THREE.Matrix3()
const C1 = new THREE.Color()
class Kit {
  pos: number[] = []
  nrm: number[] = []
  col: number[] = []
  idx: number[] = []
  /** Adds `g` moved by `m`, all of it in colour `c`. */
  add(g: THREE.BufferGeometry, m: THREE.Matrix4, c: THREE.Color) {
    const p = g.attributes.position
    const n = g.attributes.normal
    const base = this.pos.length / 3
    N3.getNormalMatrix(m)
    for (let k = 0; k < p.count; k++) {
      V1.fromBufferAttribute(p, k).applyMatrix4(m)
      this.pos.push(V1.x, V1.y, V1.z)
      V1.fromBufferAttribute(n, k).applyMatrix3(N3).normalize()
      this.nrm.push(V1.x, V1.y, V1.z)
      this.col.push(c.r, c.g, c.b)
    }
    if (g.index) for (let k = 0; k < g.index.count; k++) this.idx.push(base + g.index.getX(k))
    else for (let k = 0; k < p.count; k++) this.idx.push(base + k)
  }
  geometry() {
    const g = new THREE.BufferGeometry()
    if (!this.pos.length) return g
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1))
    g.computeBoundingSphere()
    return g
  }
}

const UNIT = new THREE.BoxGeometry(1, 1, 1)
const OCT = new THREE.CylinderGeometry(0.5, 0.5, 1, 8)
const M1 = new THREE.Matrix4()
const S1 = new THREE.Vector3()
const X = new THREE.Vector3()
const Y = new THREE.Vector3()
const Z = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

/**
 * A block of size l (along `dir`) × h × w (across), centred on `c`. `dir` may slope; the block stays
 * upright across. `bev`: a chamfer in metres (the big concrete parts), 0 for a plain box.
 */
function block(kit: Kit, c: THREE.Vector3, dir: THREE.Vector3, l: number, h: number, w: number, color: THREE.Color, bev = 0) {
  X.copy(dir).normalize()
  Z.crossVectors(X, UP)
  if (Z.lengthSq() < 1e-6) Z.set(0, 0, 1)
  Z.normalize()
  Y.crossVectors(Z, X).normalize()
  if (bev > 0 && Math.min(l, h, w) > bev * 3) {
    const g = new BevelBoxGeometry(l, h, w, bev)
    M1.makeBasis(X, Y, Z).setPosition(c)
    kit.add(g, M1, color)
    g.dispose()
  } else {
    M1.makeBasis(X, Y, Z).scale(S1.set(l, h, w)).setPosition(c)
    kit.add(UNIT, M1, color)
  }
}
/** An upright octagonal column of radius r from y0 to y1 at (x, z). */
function column(kit: Kit, x: number, z: number, y0: number, y1: number, r: number, color: THREE.Color) {
  M1.makeScale(r * 2, y1 - y0, r * 2).setPosition(x, (y0 + y1) / 2, z)
  kit.add(OCT, M1, color)
}
/** A block from point a to point b (its long side), w × d across. */
function beam(kit: Kit, a: THREE.Vector3, b: THREE.Vector3, w: number, d: number, color: THREE.Color, bev = 0) {
  const dir = b.clone().sub(a)
  const len = dir.length()
  // Upright along the beam: its long side as the block's y.
  Y.copy(dir).normalize()
  X.crossVectors(Y, Math.abs(Y.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : UP).normalize()
  Z.crossVectors(X, Y).normalize()
  const c = a.clone().add(b).multiplyScalar(0.5)
  if (bev > 0 && Math.min(w, d) > bev * 3) {
    const g = new BevelBoxGeometry(w, len, d, bev)
    M1.makeBasis(X, Y, Z).setPosition(c)
    kit.add(g, M1, color)
    g.dispose()
  } else {
    M1.makeBasis(X, Y, Z).scale(S1.set(w, len, d)).setPosition(c)
    kit.add(UNIT, M1, color)
  }
}

/* ---------- How each bridge is built ---------- */

const col = (h: string) => new THREE.Color(h)
const PAL = {
  concrete: col('#bdbab3'),
  old: col('#ada795'),
  fascia: col('#e6e3dc'),
  white: col('#eef0f2'),
  under: col('#97948d'),
  barrier: col('#d9d8d2'),
  kerb: col('#c9c5bb'),
  dark: col('#3a3c40'),
  paint: col('#f2f2ee'),
  stud: col('#fff1b0'),
  ballast: col('#4a4440'),
  pole: col('#8d939b'),
  poleOld: col('#6f7479'),
  red: col('#d12a2a'),
}

type Look = {
  /** The girder under the slab: boxes across (o: offset, w: width), from `top` down to `bot` (metres under the deck). */
  girder: { o: number; w: number; top: number; bot: number; c?: THREE.Color }[]
  /** How deep it goes over a pier (the piers stand under that). */
  depth: number
  stone: THREE.Color
  rail: 'balustrade' | 'tubes' | 'bars' | 'plain'
  railColor: THREE.Color
  /** A concrete barrier between the road and the footway (else a kerb). */
  barrier: boolean
  lamp: 'old' | 'arm' | 'double'
  /** Lamps on both edges, opposite (else alternating), or on the median. */
  lampsBoth?: boolean
  glow: THREE.Color
}

function looks(kind: BridgeKind, W: number): Look {
  switch (kind) {
    case 'fhb':
      return {
        girder: [
          { o: 0, w: W - 0.6, top: -5.7, bot: -6.3 },
          { o: 0, w: 2.8, top: -5.6, bot: -5.7, c: PAL.ballast },
          ...[-1, 1].flatMap((s) => [
            { o: s * (W / 2 - 0.55), w: 0.5, top: -4.9, bot: -5.75 },
            { o: s * (W / 2 - 0.55), w: 0.5, top: -0.9, bot: -2.5 },
          ]),
        ],
        depth: 6.3,
        stone: PAL.old,
        rail: 'balustrade',
        railColor: col('#d8d1c1'),
        barrier: false,
        lamp: 'old',
        glow: col('#ffb05a'),
      }
    case 'cdg':
      // (the arched soffit is drawn apart: haunches)
      return { girder: [], depth: 4.2, stone: col('#b9b7b0'), rail: 'tubes', railColor: col('#cfd3d7'), barrier: false, lamp: 'arm', lampsBoth: true, glow: col('#ffbe6a') }
    case 'hkb': {
      const bw = W / 2 - 2.6
      return {
        girder: [-1, 1].flatMap((s) => [
          { o: (s * W) / 4, w: bw, top: -0.9, bot: -1.7 },
          { o: (s * W) / 4, w: bw * 0.62, top: -1.7, bot: -3.1 },
        ]),
        depth: 3.1,
        stone: PAL.concrete,
        rail: 'bars',
        railColor: col('#dfe4e8'),
        barrier: true,
        lamp: 'double',
        glow: col('#f4f2ff'),
      }
    }
    case 'ado':
      return {
        girder: [
          { o: 0, w: W * 0.55, top: -0.9, bot: -2.4 },
          { o: 0, w: W * 0.4, top: -2.4, bot: -2.8 },
        ],
        depth: 2.8,
        stone: PAL.concrete,
        rail: 'plain',
        railColor: col('#e9ecef'),
        barrier: true,
        lamp: 'arm',
        lampsBoth: true,
        glow: col('#fff6e6'),
      }
    default:
      return {
        girder: [{ o: 0, w: W * 0.6, top: -0.9, bot: -2.7 }],
        depth: 2.7,
        stone: PAL.concrete,
        rail: 'plain',
        railColor: col('#e9ecef'),
        barrier: true,
        lamp: 'double',
        glow: col('#fff6e6'),
      }
  }
}

/** One railing bay, `BAY` long along x (centred), standing on y = 0. */
const BAY = 2.5
function railBay(rail: Look['rail'], c: THREE.Color) {
  const k = new Kit()
  const o = new THREE.Vector3()
  const along = new THREE.Vector3(1, 0, 0)
  const at = (x: number, y: number) => o.set(x, y, 0)
  if (rail === 'balustrade') {
    // Old concrete: a post, two balusters, the top and bottom rails.
    block(k, at(-BAY / 2 + 0.16, 0.5), along, 0.32, 1, 0.32, c)
    for (const x of [-0.25, 0.45]) block(k, at(x, 0.5), along, 0.14, 0.7, 0.14, c)
    block(k, at(0, 0.18), along, BAY, 0.14, 0.26, c)
  } else if (rail === 'tubes') {
    block(k, at(-BAY / 2 + 0.06, 0.52), along, 0.12, 1.04, 0.12, c)
    for (const y of [0.35, 0.7]) block(k, at(0, y), along, BAY, 0.07, 0.07, c)
  } else if (rail === 'bars') {
    block(k, at(-BAY / 2 + 0.07, 0.6), along, 0.14, 1.2, 0.14, c)
    for (const x of [-0.4, 0.6]) block(k, at(x, 0.6), along, 0.05, 1.1, 0.05, c)
    block(k, at(0, 0.1), along, BAY, 0.08, 0.08, c)
  } else {
    block(k, at(-BAY / 2 + 0.05, 0.6), along, 0.08, 1.2, 0.08, c)
    block(k, at(0, 0.8), along, BAY, 0.06, 0.06, c)
  }
  return k.geometry()
}

/** A lamp post standing at the origin, its arm(s) along -z (over the road); the lens points in its own frame. */
function lampPost(lamp: Look['lamp']): { geo: THREE.BufferGeometry; lenses: THREE.Vector3[] } {
  const k = new Kit()
  const along = new THREE.Vector3(1, 0, 0)
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const lenses: THREE.Vector3[] = []
  if (lamp === 'old') {
    // A tapered pole, a swan neck bent over the road, the old lantern.
    block(k, v(0, 0.4, 0), along, 0.5, 0.8, 0.5, PAL.poleOld)
    block(k, v(0, 4.4, 0), along, 0.24, 7.2, 0.24, PAL.poleOld)
    beam(k, v(0, 7.8, 0), v(0, 8.9, -0.7), 0.18, 0.18, PAL.poleOld)
    beam(k, v(0, 8.9, -0.7), v(0, 9.2, -2.0), 0.16, 0.16, PAL.poleOld)
    block(k, v(0, 9.15, -2.3), along, 0.5, 0.35, 0.9, PAL.poleOld)
    lenses.push(v(0, 8.95, -2.3))
  } else if (lamp === 'arm') {
    block(k, v(0, 0.3, 0), along, 0.45, 0.6, 0.45, PAL.pole)
    block(k, v(0, 5, 0), along, 0.22, 10, 0.22, PAL.pole)
    block(k, v(0, 9.9, -1.1), along, 0.14, 0.14, 2.2, PAL.pole)
    block(k, v(0, 9.85, -2.3), along, 0.4, 0.18, 0.75, PAL.pole)
    lenses.push(v(0, 9.72, -2.3))
  } else {
    // On the median: a tall mast, an arm and a flat LED head over each carriageway.
    block(k, v(0, 0.4, 0), along, 0.55, 0.8, 0.55, PAL.pole)
    block(k, v(0, 6, 0), along, 0.26, 12, 0.26, PAL.pole)
    for (const s of [-1, 1]) {
      beam(k, v(0, 11.2, 0), v(0, 11.9, s * 2.4), 0.14, 0.14, PAL.pole)
      block(k, v(0, 11.9, s * 2.9), along, 0.45, 0.16, 1.0, PAL.pole)
      lenses.push(v(0, 11.78, s * 2.9))
    }
  }
  return { geo: k.geometry(), lenses }
}

/* ---------- Building a bridge ---------- */

type Water = { rings: XZ[][]; box: [number, number, number, number] }
type Built = {
  base: THREE.BufferGeometry
  pylon: THREE.BufferGeometry | null
  detail: THREE.BufferGeometry
  bay: THREE.BufferGeometry
  bays: THREE.Matrix4[]
  lamp: THREE.BufferGeometry
  lamps: THREE.Matrix4[]
  lenses: THREE.Matrix4[]
  stays: THREE.Matrix4[]
  glows: number[]
  red: number[]
  /** Points along the bridge, every 20 m (how near the camera is, for the details). */
  probe: number[]
}

/** Where the 5e pont's pylon stands and which way the bridge runs there. */
type Pylon = { x: number; z: number; ux: number; uz: number; y: number }

/**
 * A bridge from its middle line. `skip`: stretches drawn by another way (the far horizon's coarse
 * line where the near chunks have the bridge already). `far`: the far horizon's: no details.
 */
function build(kind: BridgeKind, way: Way, inWater: (x: number, z: number) => boolean, pylon: Pylon | null, skip: (x: number, z: number) => boolean, far: boolean): Built {
  const how = BRIDGE_BUILD[kind]
  const W = how.width ?? 20
  const L = looks(kind, W)
  const top = Math.max(...way.pts.map((p) => p.y))
  const base = new Kit()
  const detail = new Kit()
  const bays: THREE.Matrix4[] = []
  const lamps: THREE.Matrix4[] = []
  const lenses: THREE.Matrix4[] = []
  const glows: number[] = []
  const probe: number[] = []
  const { geo: lampGeo, lenses: lensAt } = lampPost(L.lamp)
  // A point on the bridge, `o` across (+ on the left), `dy` above the deck.
  const P = (s: number, o = 0, dy = 0) => {
    const p = wayAt(way, s)
    return new THREE.Vector3(p.x - p.dz * o, p.y + dy, p.z + p.dx * o)
  }
  const frame = (s: number) => wayAt(way, s)
  // Standing high enough to be a bridge here (the chunk draws the low ends on their embankment).
  const raised = (s: number) => {
    const p = frame(s)
    if (p.y < 0.6 || skip(p.x, p.z)) return false
    return inWater(p.x, p.z) || p.y >= Math.min(top, BRIDGE_HEIGHT) * 0.7
  }
  // A long block from s1 to s2 along the bridge, offset across.
  const run = (kit: Kit, s1: number, s2: number, o: number, t: number, b: number, w: number, c: THREE.Color, bev = 0) => {
    const a = P(s1, o, (t + b) / 2)
    const e = P(s2, o, (t + b) / 2)
    const dir = e.clone().sub(a)
    const len = dir.length()
    if (len < 0.05) return
    block(kit, a.add(e).multiplyScalar(0.5), dir, len + 0.04, t - b, w, c, bev)
  }
  const tone = (c: THREE.Color, s: number) => C1.copy(c).multiplyScalar(0.95 + 0.07 * Math.abs(Math.sin(s * 0.137 + 1.3))).clone()
  const roadHalf = (how.median ? 1.4 : 0.6) + how.lanes * 3.4 + 0.3
  // 20 m blocks: the curves of the map's line stay smooth, the girder costs half (the arched soffit in eighths of a span).
  const STEP = kind === 'cdg' ? how.span / 8 : 20
  for (let s = 0; s < way.len - 0.5; s += STEP) {
    const s2 = Math.min(way.len, s + STEP)
    if (!raised((s + s2) / 2)) continue
    if (Math.floor(s / 20) !== Math.floor(s2 / 20) || s === 0) {
      const p = frame(s)
      probe.push(p.x, p.y, p.z)
    }
    const stone = tone(L.stone, s)
    // The slab, its white edges (the line seen from the shore), the girder.
    run(base, s, s2, 0, -0.02, -0.9, W - 0.4, stone)
    for (const sd of [-1, 1]) run(base, s, s2, sd * (W / 2 - 0.2), 0.3, -1.15, 0.4, PAL.fascia)
    for (const g of L.girder) run(base, s, s2, g.o, g.top, g.bot, g.w, g.c ?? stone.clone().multiplyScalar(0.86), 0.12)
    if (kind === 'cdg') {
      // Deeper over the piers, shallow mid-span: the soffit arches between them, in steps.
      const u = ((((s + STEP / 2 - (way.len % how.span) / 2) % how.span) + how.span) % how.span) / how.span
      const d = 1.5 + 2.7 * (2 * u - 1) ** 2
      run(base, s, s2, 0, -0.9, -0.9 - d, W - 4.5, stone.clone().multiplyScalar(0.86), 0.1)
    }
    // The top rail all along (the railing's line from afar; the bays are near only).
    const railTop = L.rail === 'balustrade' ? 1.05 : L.rail === 'bars' ? 1.2 : L.rail === 'tubes' ? 1.06 : 1.2
    for (const sd of [-1, 1]) run(base, s, s2, sd * (W / 2 - 0.25), 0.3 + railTop, 0.3 + railTop - 0.1, L.rail === 'balustrade' ? 0.34 : 0.1, L.railColor)
    // Between the road and the footway: a concrete barrier, or a kerb.
    for (const sd of [-1, 1]) {
      if (L.barrier) {
        run(base, s, s2, sd * (roadHalf + 0.3), 0.45, 0, 0.6, PAL.barrier)
        run(base, s, s2, sd * (roadHalf + 0.3), 0.85, 0.45, 0.25, PAL.barrier)
      } else run(detail, s, s2, sd * (roadHalf + 0.15), 0.22, 0, 0.3, PAL.kerb)
    }
    if (how.median) {
      run(base, s, s2, 0, 0.45, 0, 0.6, PAL.barrier)
      run(base, s, s2, 0, 0.85, 0.45, 0.25, PAL.barrier)
    }
    if (far) continue
    // Near only: lane dashes, light studs.
    const mid = how.median ? 1.4 : 0.6
    for (let d = s + 1; d < s2 - 3.2; d += 9)
      for (let lane = 1; lane < how.lanes; lane++) for (const sd of [-1, 1]) run(detail, d, d + 3, sd * (mid + lane * 3.4), 0.1, 0.06, 0.15, PAL.paint)
    if (how.studs) for (let d = s + 2; d < s2; d += 4) for (const sd of [-1, 1]) run(detail, d, d + 0.3, sd * (roadHalf - 0.4), 0.12, 0.04, 0.3, PAL.stud)
  }
  // The FHB's lower level: posts between the openings, the train seen through them.
  if (kind === 'fhb')
    for (let s = 3; s < way.len; s += 6) {
      if (!raised(s)) continue
      for (const sd of [-1, 1]) run(base, s - 0.7, s + 0.7, sd * (W / 2 - 0.55), -2.5, -4.9, 0.5, tone(L.stone, s).multiplyScalar(0.92))
    }
  // Railing bays (instanced), near only.
  const q = new THREE.Quaternion()
  if (!far)
    for (let s = 0; s + BAY <= way.len; s += BAY) {
      if (!raised(s + BAY / 2)) continue
      for (const sd of [-1, 1]) {
        const a = P(s, sd * (W / 2 - 0.25), 0.3)
        const b = P(s + BAY, sd * (W / 2 - 0.25), 0.3)
        X.copy(b).sub(a).normalize()
        Z.crossVectors(X, UP).normalize()
        Y.crossVectors(Z, X)
        bays.push(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(a.add(b).multiplyScalar(0.5)))
      }
    }
  // Lamp posts: on the median (double), on both edges, or alternating.
  const lampEvery = kind === 'ado' ? 25 : (how.lamps ?? 36)
  const lampMat = (s: number, o: number, flip: boolean) => {
    const p = frame(s)
    const at = P(s, o, 0)
    // Its arm (-z) over the road: towards the middle.
    const rot = Math.atan2(p.dx, p.dz) + (flip ? Math.PI : 0) - Math.PI / 2
    q.setFromAxisAngle(UP, rot)
    return new THREE.Matrix4().compose(at, q, S1.set(1, 1, 1))
  }
  let n = 0
  for (let s = (way.len % lampEvery) / 2; s < way.len; s += lampEvery, n++) {
    if (!raised(s)) continue
    const where: [number, boolean][] = L.lamp === 'double' ? [[0, false]] : L.lampsBoth ? [[W / 2 - 0.9, false], [-(W / 2 - 0.9), true]] : [[n % 2 ? W / 2 - 0.9 : -(W / 2 - 0.9), n % 2 === 0]]
    for (const [o, flip] of where) {
      const m = lampMat(s, o, flip)
      lamps.push(m)
      for (const l of lensAt) {
        const at = l.clone().applyMatrix4(m)
        lenses.push(new THREE.Matrix4().compose(at, q.setFromRotationMatrix(m), S1.set(1, 1, 1)))
        glows.push(at.x, at.y - 0.4, at.z)
      }
    }
  }
  // The piers, every span, down into the lagoon (none under the 5e pont's main span).
  const span = how.span
  const red: number[] = []
  for (let s = (way.len % span) / 2; s < way.len; s += span) {
    if (!raised(s)) continue
    const p = frame(s)
    if (pylon) {
      const t = (p.x - pylon.x) * pylon.ux + (p.z - pylon.z) * pylon.uz
      if (t > -82 && t < 114 && Math.hypot(p.x - pylon.x, p.z - pylon.z) < 130) continue
    }
    const wet = inWater(p.x, p.z)
    const foot = wet ? -4 : 0
    const topY = p.y - L.depth
    if (topY - foot < 1.5) continue
    const dir = new THREE.Vector3(p.dx, 0, p.dz)
    const stone = tone(L.stone, s).multiplyScalar(0.88)
    const at = (o: number, y: number) => new THREE.Vector3(p.x - p.dz * o, y, p.z + p.dx * o)
    if (!far) run(detail, s - 0.11, s + 0.11, 0, 0.09, 0.05, W - 0.6, PAL.dark)
    if (kind === 'fhb') {
      // A blade wall with pointed cutwaters at both ends, under its cap.
      block(base, at(0, (topY + foot) / 2), dir, 1.8, topY - foot, W * 0.66, stone, 0.12)
      for (const sd of [-1, 1]) {
        const c = at(sd * W * 0.33, (topY - 0.8 + foot) / 2)
        const d45 = new THREE.Vector3(p.dx - p.dz, 0, p.dz + p.dx)
        block(base, c, d45, 1.27, topY - 0.8 - foot, 1.27, stone, 0.08)
      }
      block(base, at(0, topY - 0.4), dir, 2.6, 0.8, W * 0.78, stone, 0.12)
    } else if (kind === 'cdg') {
      block(base, at(0, topY - 0.7), dir, 2.6, 1.4, W * 0.82, stone, 0.12)
      for (const sd of [-1, 1]) block(base, at((sd * W) / 4, (topY - 1.4 + foot) / 2), dir, 1.8, topY - 1.4 - foot, 1.8, stone, 0.12)
    } else if (kind === 'hkb') {
      // One crosshead on two round 2 m piles, their steel casing at the water.
      block(base, at(0, topY - 1.1), dir, 3, 2.2, W * 0.94, stone, 0.15)
      for (const sd of [-1, 1]) {
        const c = at((sd * W) / 4, 0)
        column(base, c.x, c.z, foot, topY - 2.2, 1, stone)
        if (wet) column(base, c.x, c.z, -0.6, 1.2, 1.35, PAL.under)
        block(base, at((sd * W) / 4, topY - 2.5), dir, 2.6, 0.6, 2.6, stone, 0.1)
      }
    } else if (kind === 'ado') {
      block(base, at(0, topY - 0.7), dir, 3, 1.4, W - 1, stone, 0.15)
      for (const sd of [-1, 1]) block(base, at((sd * W) / 4, (topY - 1.4 + foot) / 2), dir, 2.4, topY - 1.4 - foot, 2.4, stone, 0.2)
    } else {
      block(base, at(0, topY - 0.7), dir, 2.4, 1.4, W * 0.75, stone, 0.12)
      column(base, p.x, p.z, foot, topY - 1.4, 1.4, stone)
    }
  }
  // The 5e pont's pylon and stays.
  let pylonGeo: THREE.BufferGeometry | null = null
  const stays: THREE.Matrix4[] = []
  if (pylon) {
    const k = new Kit()
    const H = 108
    const LEAN = 0.16
    const JOIN = 42
    const { x, z, ux, uz, y: deckY } = pylon
    const [vx, vz] = [uz, -ux]
    const mastAt = (h: number) => new THREE.Vector3(x - ux * Math.tan(LEAN) * Math.max(0, h - JOIN * 0.6), h, z - uz * Math.tan(LEAN) * Math.max(0, h - JOIN * 0.6))
    const join = mastAt(JOIN)
    for (const sd of [-1, 1]) {
      // Each leg in three blocks, narrowing towards the join.
      const foot = new THREE.Vector3(x + vx * 15 * sd + ux * 1.5, -3, z + vz * 15 * sd + uz * 1.5)
      const end = join.clone().add(new THREE.Vector3(vx * sd * 1.2, 0, vz * sd * 1.2))
      const pts = [foot, foot.clone().lerp(end, 0.36), foot.clone().lerp(end, 0.7), end]
      for (let i = 0; i < 3; i++) beam(k, pts[i], pts[i + 1], 3.8 - i * 0.5, 3.4 - i * 0.4, PAL.white, 0.25)
    }
    // The cross-beam under the deck, between the legs.
    beam(k, new THREE.Vector3(x - vx * 15, deckY - 2.4, z - vz * 15), new THREE.Vector3(x + vx * 15, deckY - 2.4, z + vz * 15), 2.4, 2.6, PAL.white, 0.2)
    const steps = 5
    for (let i = 0; i < steps; i++) beam(k, mastAt(JOIN + ((H - JOIN) * i) / steps), mastAt(JOIN + ((H - JOIN) * (i + 1)) / steps), 4.2 - i * 0.45, 3.4 - i * 0.3, PAL.white, 0.25)
    const tip = mastAt(H)
    block(k, tip.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3(ux, 0, uz), 1.6, 3, 1.6, PAL.white, 0.2)
    block(k, tip.clone().add(new THREE.Vector3(0, 3.3, 0)), new THREE.Vector3(ux, 0, uz), 0.5, 0.5, 0.5, PAL.red)
    red.push(tip.x, tip.y + 3.3, tip.z)
    // The 19 stays, each two cables, from the mast down to the median (10 over the main span, 9 behind).
    for (let i = 0; i < 19; i++) {
      const side = i % 2 ? -1 : 1
      const m = Math.floor(i / 2)
      const d = 16 + m * (side > 0 ? 10 : 7.5)
      const hi = mastAt(H - 8 - m * 3.6)
      const lo = new THREE.Vector3(x + ux * d * side, deckY + 0.6, z + uz * d * side)
      block(k, lo, new THREE.Vector3(ux, 0, uz), 1, 0.6, 1.4, PAL.white)
      for (const sz of [-0.35, 0.35]) {
        const a = hi.clone().add(new THREE.Vector3(vx * sz, 0, vz * sz))
        const b = lo.clone().add(new THREE.Vector3(vx * sz, 0, vz * sz))
        const dir = a.clone().sub(b)
        Y.copy(dir).normalize()
        X.crossVectors(Y, UP).normalize()
        Z.crossVectors(X, Y).normalize()
        stays.push(new THREE.Matrix4().makeBasis(X, Y, Z).scale(S1.set(0.2, dir.length(), 0.2)).setPosition(a.add(b).multiplyScalar(0.5)))
      }
    }
    pylonGeo = k.geometry()
    probe.push(x, deckY, z)
  }
  return { base: base.geometry(), pylon: pylonGeo, detail: detail.geometry(), bay: railBay(L.rail, L.railColor), bays, lamp: lampGeo, lamps, lenses, stays, glows, red, probe }
}

/* ---------- Drawing it ---------- */

const KINDS: BridgeKind[] = ['fhb', 'cdg', 'hkb', 'yop', 'ado']
const LENS_GEO = new THREE.BoxGeometry(0.55, 0.06, 0.85)

/** A soft round halo for the lamps seen at night (made once, no picture). */
let haloTex: THREE.DataTexture | null = null
function halo() {
  if (haloTex) return haloTex
  const N = 32
  const d = new Uint8Array(N * N * 4)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const r = Math.hypot(x - N / 2 + 0.5, y - N / 2 + 0.5) / (N / 2)
      const a = Math.max(0, 1 - r) ** 2.2
      d.set([255, 255, 255, Math.round(a * 255)], (y * N + x) * 4)
    }
  haloTex = new THREE.DataTexture(d, N, N)
  haloTex.needsUpdate = true
  return haloTex
}

/** Whole bridges, from all the loaded chunks (the near ones first: they match the deck drawn up close). */
export function PontsRealistes({ chunks, night }: { chunks: ChunkData[]; night: boolean }) {
  const key = chunks.map((c) => c.key).join()
  const water = useMemo(() => {
    const out: Water[] = []
    for (const c of chunks)
      for (const a of c.areas)
        if (a.kind === 'water') {
          const r = a.rings[0]
          let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity]
          for (const [x, z] of r) [x0, z0, x1, z1] = [Math.min(x0, x), Math.min(z0, z), Math.max(x1, x), Math.max(z1, z)]
          out.push({ rings: a.rings, box: [x0, z0, x1, z1] })
        }
    return out
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const inWater = (x: number, z: number) => water.some((w) => x >= w.box[0] && x <= w.box[2] && z >= w.box[1] && z <= w.box[3] && pointInRing([x, z], w.rings[0]) && !w.rings.slice(1).some((h) => pointInRing([x, z], h)))
  const ways = useMemo(() => {
    const near = chunks.filter((c) => !c.key.includes(':'))
    const farOnes = chunks.filter((c) => c.key.includes(':'))
    return KINDS.flatMap((kind) => {
      const n = bridgeWay(near, kind)
      const f = bridgeWay(farOnes, kind)
      return n || f ? [{ kind, near: n, far: f }] : []
    })
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  // (In development: where each bridge is, for the tests' viewpoints.)
  if (import.meta.env.DEV) Object.assign(window, { __ponts: ways.map((w) => ({ kind: w.kind, ...[w.near, w.far].reduce((o, v, i) => (v ? { ...o, [i ? 'far' : 'near']: { len: Math.round(v.len), a: [v.pts[0].x, v.pts[0].z].map(Math.round), b: [v.pts[v.pts.length - 1].x, v.pts[v.pts.length - 1].z].map(Math.round), mid: ((m) => [m.x, m.y, m.z].map(Math.round))(wayAt(v, v.len / 2)) } } : o), {}) })) })
  return (
    <>
      {ways.map((w) => (
        <Pont key={w.kind} kind={w.kind} near={w.near} far={w.far} inWater={inWater} night={night} />
      ))}
    </>
  )
}

/** A way's shape in a few numbers: built again only when the bridge's line changes, not every chunk that loads. */
const sig = (w: Way | null) => (w ? [w.len, w.pts[0].x, w.pts[0].z, w.pts[w.pts.length - 1].x, w.pts[w.pts.length - 1].z].map((v) => Math.round(v)).join(',') : '-')

function Pont({ kind, near, far, inWater, night }: { kind: BridgeKind; near: Way | null; far: Way | null; inWater: (x: number, z: number) => boolean; night: boolean }) {
  const s = `${sig(near)}|${sig(far)}`
  const parts = useMemo(() => {
    // The 5e pont's pylon: in the middle of the whole bridge, on the near deck when it's there.
    let pylon: Pylon | null = null
    if (kind === 'ado') {
      const whole = !near || (far && far.len > near.len * 1.1) ? far! : near
      const m = wayAt(whole, whole.len / 2)
      pylon = { x: m.x, z: m.z, ux: m.dx, uz: m.dz, y: m.y > 1 ? m.y : BRIDGE_HEIGHT }
      if (near && whole !== near) {
        let best = { d: Infinity, s: 0 }
        for (let i = 0; i < near.pts.length; i++) {
          const d = Math.hypot(near.pts[i].x - m.x, near.pts[i].z - m.z)
          if (d < best.d) best = { d, s: near.cum[i] }
        }
        if (best.d < 30) {
          const p = wayAt(near, best.s)
          pylon = { x: p.x, z: p.z, ux: p.dx, uz: p.dz, y: p.y > 1 ? p.y : BRIDGE_HEIGHT }
        }
      }
    }
    const out: Built[] = []
    if (near) out.push(build(kind, near, inWater, pylon, () => false, false))
    if (far) {
      // The far horizon's line where the near one doesn't reach (the rest of a long bridge).
      const pts = near ? near.pts.filter((_, i) => i % 3 === 0) : []
      const covered = (x: number, z: number) => pts.some((p) => Math.abs(p.x - x) < 40 && Math.abs(p.z - z) < 40 && Math.hypot(p.x - x, p.z - z) < 40)
      if (!near || far.len > near.len + 40) out.push(build(kind, far, inWater, near ? null : pylon, covered, true))
    }
    return out
  }, [kind, s]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      for (const b of parts) for (const g of [b.base, b.pylon, b.detail, b.bay, b.lamp]) g?.dispose()
    },
    [parts],
  )
  return (
    <>
      {parts.map((b, i) => (
        <PontParts key={i} kind={kind} b={b} night={night} />
      ))}
    </>
  )
}

function useInstances(list: THREE.Matrix4[]) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = ref.current
    if (!m) return
    list.forEach((x, i) => m.setMatrixAt(i, x))
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [list])
  return ref
}

function PontParts({ kind, b, night }: { kind: BridgeKind; b: Built; night: boolean }) {
  const L = useMemo(() => looks(kind, BRIDGE_BUILD[kind].width ?? 20), [kind])
  const mats = useMemo(
    () => ({
      base: new THREE.MeshLambertMaterial({ vertexColors: true }),
      pylon: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#ffd9a8'), emissiveIntensity: 0 }),
      detail: new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      rail: new THREE.MeshLambertMaterial({ vertexColors: true }),
      lamp: new THREE.MeshLambertMaterial({ vertexColors: true }),
      lens: new THREE.MeshLambertMaterial({ color: '#e8e6df', emissive: L.glow, emissiveIntensity: 0 }),
      stay: new THREE.MeshLambertMaterial({ color: '#e4e7ea', emissive: new THREE.Color('#dfe9ff'), emissiveIntensity: 0 }),
      glow: new THREE.PointsMaterial({ size: weakDevice ? 7 : 6, map: halo(), color: L.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, opacity: 0.85 }),
      red: new THREE.PointsMaterial({ size: 5, map: halo(), color: '#ff3030', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
    }),
    [L],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  mats.lens.emissiveIntensity = night ? 1.6 : 0
  mats.pylon.emissiveIntensity = night ? 0.28 : 0
  mats.stay.emissiveIntensity = night ? 0.7 : 0
  const glowGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.glows, 3))
    return g
  }, [b])
  const redGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.red, 3))
    return g
  }, [b])
  useEffect(
    () => () => {
      glowGeo.dispose()
      redGeo.dispose()
    },
    [glowGeo, redGeo],
  )
  const bays = useInstances(b.bays)
  const lamps = useInstances(b.lamps)
  const lenses = useInstances(b.lenses)
  const stays = useInstances(b.stays)
  // The near details: only while the camera is within reach of the bridge (checked four times a second).
  const nearRef = useRef<THREE.Group>(null)
  const next = useRef(0)
  const reach = weakDevice ? 180 : 300
  useFrame(({ camera, clock }) => {
    if (!nearRef.current || clock.elapsedTime < next.current) return
    next.current = clock.elapsedTime + 0.25
    const { x, y, z } = camera.position
    let close = false
    for (let i = 0; i < b.probe.length && !close; i += 3) close = Math.hypot(b.probe[i] - x, b.probe[i + 1] - y, b.probe[i + 2] - z) < reach
    nearRef.current.visible = close
  })
  return (
    <group>
      <mesh geometry={b.base} material={mats.base} castShadow receiveShadow />
      {b.pylon && <mesh geometry={b.pylon} material={mats.pylon} castShadow />}
      {b.lamps.length > 0 && <instancedMesh ref={lamps} args={[b.lamp, mats.lamp, b.lamps.length]} />}
      {b.lenses.length > 0 && <instancedMesh ref={lenses} args={[LENS_GEO, mats.lens, b.lenses.length]} />}
      {b.stays.length > 0 && <instancedMesh ref={stays} args={[UNIT, mats.stay, b.stays.length]} />}
      {night && b.glows.length > 0 && <points geometry={glowGeo} material={mats.glow} />}
      {night && b.red.length > 0 && <points geometry={redGeo} material={mats.red} />}
      <group ref={nearRef} visible={false}>
        <mesh geometry={b.detail} material={mats.detail} />
        {b.bays.length > 0 && <instancedMesh ref={bays} args={[b.bay, mats.rail, b.bays.length]} />}
      </group>
    </group>
  )
}
