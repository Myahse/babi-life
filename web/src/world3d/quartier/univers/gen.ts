import { centroid, clipLine, clipRing, pointInRing, tileBox, tilePoint, type Origin, type XZ } from '../../open/geo'
import { blockRing } from '../../open/voxel'
import { finishChunk, type Area, type Building, type ChunkData, type Road } from '../../open/tiles'
import { presetOf, type EdgeKind, type Preset } from './presets'
import { applyTerrain, terrainKey, type TerrainWorld } from './terrain'

// « Mon quartier »'s own world (update « mon-quartier »): a whole neighbourhood generated from its seed and its
// commune's style (presets.ts), the same on every phone, laid out in the street's own terms (roads, buildings,
// grounds, trees: tiles.ts ChunkData) so the street draws it, walks it and fills it with life like any other part
// of the city (meshes.ts, nav.ts, the traffic, the passers-by, the train on its rails). Not a piece of the map:
// its own streets (a main road, an avenue, a rond-point at the carrefour, side streets), its market square, its
// school, its terrain, its places, its 30 lots and the home, and on its four sides what closes it (the lagoon or
// the sea, the forest, the motorway on its wall, the railway, a boulevard), the far city beyond (backdrop.tsx).
//
// It stands in the sea south of Abidjan, out of the map's way (UNIV_ORIGIN), on the corner of four of the
// street's tiles: four chunks are the whole of it.

/** Bumped when the layout changes: the phone's kept chunks and views of the worlds are built again. */
export const UNIV_GEN = 4

/** The z14 tile whose north-west corner the worlds stand on (open sea, 75 km south of Abidjan). */
const CORNER = { x: 8000, y: 7982, z: 14 }
export const UNIV_ORIGIN: Origin = tilePoint(CORNER.x, CORNER.y, CORNER.z, 0, 0, 1)
/** The four chunks round it (z16 tiles). */
export const UNIV_TILES: [number, number][] = [
  [CORNER.x * 4 - 1, CORNER.y * 4 - 1],
  [CORNER.x * 4, CORNER.y * 4 - 1],
  [CORNER.x * 4 - 1, CORNER.y * 4],
  [CORNER.x * 4, CORNER.y * 4],
]
/** How far the four chunks reach from the middle (the nearest of their outer sides). */
export const UNIV_EXT = Math.min(...UNIV_TILES.map(([tx, ty]) => tileBox(UNIV_ORIGIN, tx, ty)).map((b) => Math.min(Math.max(Math.abs(b.x0), Math.abs(b.x1)), Math.max(Math.abs(b.z0), Math.abs(b.z1)))))

/** terrain: the ground its owner shaped (terrain.ts, « x,y,t;… »). */
export type UniversSpec = { seed: number; preset: string; variant: number; terrain?: string }
export type Side = 'n' | 'e' | 's' | 'w'
export const SIDES: Side[] = ['n', 'e', 's', 'w']

/** A spot by a street (a lot, a place, the home): its middle, the street's point in front, the way the street runs. */
export type Front = { at: XZ; street: XZ; dir: number; cls: string }
/** The places of the world: what kind of place stands there (the first kind the commune has, univers/places.ts). */
export type Slot = Front & { kinds: string[]; tag: string }
export type Special = { tag: 'market' | 'school' | 'pitch' | 'worship'; at: XZ; ring: XZ[]; front: Front }

export type Univers = {
  key: string
  preset: Preset
  variant: number
  edges: Record<Side, EdgeKind>
  /** Where each side's edge starts (m from the middle), and where one may walk to. */
  lim: Record<Side, number>
  walk: Record<Side, number>
  roads: Road[]
  buildings: Building[]
  areas: Area[]
  trees: XZ[]
  palms: XZ[]
  rails: XZ[][]
  forests: XZ[][][]
  /** The carrefour (its rond-point's middle). */
  carrefour: XZ
  home: Front
  lots: Front[]
  neighbours: Front[]
  slots: Slot[]
  specials: Special[]
  /** Ground the game's houses keep off (the lots, the places). */
  clear: { at: XZ; r: number }[]
}

/** A world's plan without its geometry: what the screen needs (the lots, the places, the home, the edges), small enough to pass from a worker. */
export type UniversInfo = Pick<Univers, 'key' | 'preset' | 'variant' | 'edges' | 'lim' | 'walk' | 'carrefour' | 'home' | 'lots' | 'neighbours' | 'slots'>
export const universInfo = (u: Univers): UniversInfo => ({ key: u.key, preset: u.preset, variant: u.variant, edges: u.edges, lim: u.lim, walk: u.walk, carrefour: u.carrefour, home: u.home, lots: u.lots, neighbours: u.neighbours, slots: u.slots })

const WIDTH: Record<string, number> = { motorway: 16, trunk: 14, primary: 12, secondary: 10, tertiary: 9, street: 7, track: 4, service: 4.5 }

/** A seeded draw (mulberry32). */
function rngOf(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const strHash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** A side's point: `t` along it (west to east, north to south), `d` out from the middle. */
const sidePt = (side: Side, t: number, d: number): XZ => (side === 'n' ? [t, -d] : side === 's' ? [t, d] : side === 'e' ? [d, t] : [-d, t])
/** A point's place for a side: how far out, and where along. */
const sideOf = (side: Side, [x, z]: XZ): [d: number, t: number] => (side === 'n' ? [-z, x] : side === 's' ? [z, x] : side === 'e' ? [x, z] : [-x, z])

const dist = (a: XZ, b: XZ) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** The distance from p to a segment. */
function segDist(p: XZ, a: XZ, b: XZ) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const l2 = dx * dx + dz * dz
  const k = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0
  return Math.hypot(a[0] + dx * k - p[0], a[1] + dz * k - p[1])
}

/** Where two segments cross (the fraction along each), if they do. */
function cross(a: XZ, b: XZ, c: XZ, d: XZ): [number, number] | null {
  const r0 = b[0] - a[0]
  const r1 = b[1] - a[1]
  const s0 = d[0] - c[0]
  const s1 = d[1] - c[1]
  const den = r0 * s1 - r1 * s0
  if (Math.abs(den) < 1e-9) return null
  const t = ((c[0] - a[0]) * s1 - (c[1] - a[1]) * s0) / den
  const u = ((c[0] - a[0]) * r1 - (c[1] - a[1]) * r0) / den
  return t > 0 && t < 1 && u > 0 && u < 1 ? [t, u] : null
}

/** Points every `step` metres along a line from a to b, wound sideways by `amp` (a quiet street isn't a ruler's line). */
function wound(a: XZ, b: XZ, amp: number, r: () => number, step = 20): XZ[] {
  const len = dist(a, b)
  const n = Math.max(1, Math.ceil(len / step))
  const nx = -(b[1] - a[1]) / (len || 1)
  const nz = (b[0] - a[0]) / (len || 1)
  const f1 = 0.5 + r() * 1.5
  const f2 = 1.5 + r() * 2.5
  const p1 = r() * 6
  const p2 = r() * 6
  const out: XZ[] = []
  for (let i = 0; i <= n; i++) {
    const k = i / n
    // (Still at both ends: the street meets its neighbours where they expect it.)
    const w = amp * Math.sin(Math.PI * k) * (0.7 * Math.sin(f1 * Math.PI * k + p1) + 0.3 * Math.sin(f2 * Math.PI * k + p2))
    out.push([a[0] + (b[0] - a[0]) * k + nx * w, a[1] + (b[1] - a[1]) * k + nz * w])
  }
  return out
}

/** A rectangle's corners (middle, along u, across n, width along, depth across). */
function rect(c: XZ, dir: number, w: number, d: number): XZ[] {
  const ux = Math.cos(dir)
  const uz = Math.sin(dir)
  const nx = -uz
  const nz = ux
  return [
    [c[0] - ux * w / 2 - nx * d / 2, c[1] - uz * w / 2 - nz * d / 2],
    [c[0] + ux * w / 2 - nx * d / 2, c[1] + uz * w / 2 - nz * d / 2],
    [c[0] + ux * w / 2 + nx * d / 2, c[1] + uz * w / 2 + nz * d / 2],
    [c[0] - ux * w / 2 + nx * d / 2, c[1] - uz * w / 2 + nz * d / 2],
  ]
}

const building = (ring: XZ[], height: number, extra: Partial<Building> = {}): Building | null => {
  const c = centroid(ring)
  const b = blockRing(ring, [], c)
  if (b.length < 4) return null
  return { ring: b, holes: [], height, c: centroid(b), tint: (Math.abs(Math.sin(c[0] * 12.9898 + c[1] * 78.233)) * 43758.5453) % 1, ...extra }
}

const MEM = new Map<string, Univers>()

/** A world, built once per page (the workers and the screen each keep theirs). */
export function genUnivers(spec: UniversSpec): Univers {
  const key = `${UNIV_GEN}:${spec.preset}:${spec.seed}:${spec.variant}${spec.terrain ? `:t${terrainKey(spec.terrain)}` : ''}`
  const had = MEM.get(key)
  if (had) return had
  const u = build(spec, key)
  if (MEM.size > 6) MEM.clear()
  MEM.set(key, u)
  return u
}

function build(spec: UniversSpec, key: string): Univers {
  const pr = presetOf(spec.preset)
  const variant = ((spec.variant % 3) + 3) % 3
  const r = rngOf(spec.seed ^ Math.imul(variant + 1, 0x9e3779b1) ^ strHash(pr.id))
  const [en, ee, es, ew] = pr.layouts[variant]
  const edges: Record<Side, EdgeKind> = { n: en, e: ee, s: es, w: ew }
  const EXT = UNIV_EXT
  const lim = {} as Record<Side, number>
  for (const s of SIDES) lim[s] = 500 + Math.round(r() * 24)
  const water = (s: Side) => edges[s] === 'lagune' || edges[s] === 'mer'
  const green = (s: Side) => edges[s] === 'foret' || edges[s] === 'colline'

  // The shore of each water side: wavy, a bay of the lagoon coming in somewhere.
  const shoreFn: Partial<Record<Side, (t: number) => number>> = {}
  for (const s of SIDES) {
    if (!water(s)) continue
    const p1 = r() * 6
    const p2 = r() * 6
    const bay = edges[s] === 'lagune' ? (r() - 0.5) * 500 : 0
    const deep = edges[s] === 'lagune' ? 60 + r() * 50 : 0
    const L = lim[s]
    shoreFn[s] = (t) => L + 16 * Math.sin(t / 95 + p1) + 8 * Math.sin(t / 37 + p2) - deep * Math.exp(-((t - bay) ** 2) / (2 * 110 * 110))
  }
  /** How far out each side's edge street runs (the street that closes the town on that side). */
  const edgeD = (s: Side, t: number) => {
    switch (edges[s]) {
      case 'lagune':
        return shoreFn[s]!(t) - 16
      case 'mer':
        return shoreFn[s]!(t) - 64
      case 'foret':
      case 'colline':
        return lim[s] - 6
      case 'autoroute':
        return lim[s] - 2
      case 'rail':
        return lim[s]
      case 'ville':
        return lim[s] + 18
    }
  }
  /** Inside the town: on this side of every side's edge street (`slack` metres past it allowed). */
  const inside = (p: XZ, slack = 0, but?: Side) =>
    SIDES.every((s) => {
      if (s === but) return true
      const [d, t] = sideOf(s, p)
      return d <= edgeD(s, t) + slack
    })
  const walk = {} as Record<Side, number>
  for (const s of SIDES) walk[s] = { lagune: lim[s] + 60, mer: lim[s] + 90, foret: lim[s] + 40, colline: lim[s] + 40, autoroute: lim[s] + 10, rail: lim[s] + 12, ville: lim[s] + 26 }[edges[s]]

  const roads: Road[] = []
  const buildings: Building[] = []
  const areas: Area[] = []
  const trees: XZ[] = []
  const palms: XZ[] = []
  const rails: XZ[][] = []
  const forests: XZ[][][] = []
  const road = (cls: string, pts: XZ[]) => {
    if (pts.length < 2) return
    roads.push({ cls, pts, width: WIDTH[cls] ?? 7, paved: cls !== 'track', bridge: false })
  }
  /** A line kept to the town (cut where it leaves it, a metre past its edge street so it meets it). */
  const keepIn = (pts: XZ[], slack = 1.5, but?: Side): XZ[][] => {
    const out: XZ[][] = []
    let cur: XZ[] = []
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const inP = inside(p, slack, but)
      if (inP) {
        if (!cur.length && i > 0) cur.push(edgeCut(pts[i - 1], p, slack, but))
        cur.push(p)
      } else if (cur.length) {
        cur.push(edgeCut(p, pts[i - 1], slack, but))
        out.push(cur)
        cur = []
      }
    }
    if (cur.length > 1) out.push(cur)
    return out.filter((l) => l.length > 1)
  }
  /** Where a segment from outside (a) to inside (b) crosses the town's edge (by halving). */
  const edgeCut = (a: XZ, b: XZ, slack: number, but?: Side): XZ => {
    let [lo, hi] = [a, b]
    for (let k = 0; k < 18; k++) {
      const m: XZ = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2]
      if (inside(m, slack, but)) hi = m
      else lo = m
    }
    return hi
  }

  // The edges: water, beach, forest, motorway, railway, boulevard.
  for (const s of SIDES) {
    const L = lim[s]
    const along = (d: (t: number) => number, step = 15, t0 = -EXT - 80, t1 = EXT + 80) => {
      const pts: XZ[] = []
      for (let t = t0; t <= t1; t += step) pts.push(sidePt(s, t, d(t)))
      return pts
    }
    const band = (d0: (t: number) => number, d1: number, t0 = -EXT - 90, t1 = EXT + 90): XZ[] => {
      const inner = along(d0, 15, t0, t1)
      return [...inner, sidePt(s, t1, d1), sidePt(s, t0, d1)]
    }
    switch (edges[s]) {
      case 'lagune': {
        const shore = shoreFn[s]!
        areas.push({ kind: 'water', rings: [band(shore, EXT + 120)] })
        // A strip of grass and palms between the promenade and the water.
        areas.push({ kind: 'green', rings: [[...along((t) => shore(t) - 10, 15), ...along((t) => shore(t) + 1, 15).reverse()]] })
        for (let t = -EXT; t < EXT; t += 22 + r() * 20) (r() < 0.6 ? palms : trees).push(sidePt(s, t, shore(t) - 5))
        break
      }
      case 'mer': {
        const shore = shoreFn[s]!
        areas.push({ kind: 'water', rings: [band(shore, EXT + 120)] })
        areas.push({ kind: 'sand', rings: [[...along((t) => shore(t) - 58, 15), ...along((t) => shore(t) + 2, 15).reverse()]] })
        break
      }
      case 'foret':
      case 'colline': {
        const ring = band((t) => L + 2 + 6 * Math.sin(t / 40), EXT + 80)
        forests.push([ring])
        areas.push({ kind: 'green', rings: [ring] })
        break
      }
      case 'autoroute': {
        road('motorway', along(() => L + 34, 40))
        road('motorway', along(() => L + 54, 40))
        // The embankment's wall along the town side, in long blocks; grass between the carriageways.
        for (let t = -EXT - 40; t < EXT + 40; t += 48) buildings.push(...[building([sidePt(s, t, L + 15), sidePt(s, t + 48, L + 15), sidePt(s, t + 48, L + 18), sidePt(s, t, L + 18)], 4.5, { style: 'civic' })].flatMap((b) => (b ? [b] : [])))
        areas.push({ kind: 'green', rings: [[sidePt(s, -EXT - 90, L + 42), sidePt(s, EXT + 90, L + 42), sidePt(s, EXT + 90, L + 46), sidePt(s, -EXT - 90, L + 46)]] })
        areas.push({ kind: 'green', rings: [[sidePt(s, -EXT - 90, L + 64), sidePt(s, EXT + 90, L + 64), sidePt(s, EXT + 90, EXT + 120), sidePt(s, -EXT - 90, EXT + 120)]] })
        for (let t = -EXT; t < EXT; t += 18 + r() * 14) trees.push(sidePt(s, t, L + 70 + r() * 30))
        break
      }
      case 'rail': {
        rails.push(along(() => L + 28, 40))
        for (let t = -EXT - 40; t < EXT + 40; t += 48) buildings.push(...[building([sidePt(s, t, L + 15), sidePt(s, t + 48, L + 15), sidePt(s, t + 48, L + 16.5), sidePt(s, t, L + 16.5)], 2.4, { style: 'civic' })].flatMap((b) => (b ? [b] : [])))
        areas.push({ kind: 'green', rings: [[sidePt(s, -EXT - 90, L + 42), sidePt(s, EXT + 90, L + 42), sidePt(s, EXT + 90, EXT + 120), sidePt(s, -EXT - 90, EXT + 120)]] })
        for (let t = -EXT; t < EXT; t += 14 + r() * 12) trees.push(sidePt(s, t, L + 48 + r() * 60))
        break
      }
      case 'ville':
        // The boulevard: the game lines it with its shops and offices on both sides (fill.ts), the city beyond.
        road('trunk', along(() => L + 18, 40))
        break
    }
  }

  // The motorway, the boulevard and the railway stop at the water (no causeway across the lagoon).
  const wet = (p: XZ) => areas.some((a) => a.kind === 'water' && pointInRing(p, a.rings[0]))
  const dry = (pts: XZ[]): XZ[][] => {
    const dense: XZ[] = []
    for (let i = 0; i < pts.length; i++) {
      if (i) {
        const a = pts[i - 1]
        const n = Math.ceil(dist(a, pts[i]) / 8)
        for (let k = 1; k < n; k++) dense.push([a[0] + ((pts[i][0] - a[0]) * k) / n, a[1] + ((pts[i][1] - a[1]) * k) / n])
      }
      dense.push(pts[i])
    }
    const out: XZ[][] = [[]]
    for (const p of dense) {
      if (wet(p)) {
        if (out[out.length - 1].length) out.push([])
      } else out[out.length - 1].push(p)
    }
    // (Back to fewer points: every 40 m, and the ends.)
    return out.filter((l) => l.length > 1).map((l) => l.filter((_, i) => i === 0 || i === l.length - 1 || i % 5 === 0))
  }
  for (let i = roads.length - 1; i >= 0; i--) {
    const rd = roads[i]
    if (rd.cls !== 'motorway' && rd.cls !== 'trunk') continue
    roads.splice(i, 1, ...dry(rd.pts).map((pts) => ({ ...rd, pts })))
  }
  rails.splice(0, rails.length, ...rails.flatMap(dry))
  for (let i = buildings.length - 1; i >= 0; i--) if (wet(buildings[i].c)) buildings.splice(i, 1)

  // The main road and the avenue across, the carrefour where they meet (its rond-point).
  const across = !(water('e') && water('w')) && (water('n') || water('s') || r() < 0.5)
  const mainAxis: [Side, Side] = across ? ['w', 'e'] : ['n', 's']
  const aveAxis: [Side, Side] = across ? ['n', 's'] : ['w', 'e']
  const cx = (r() - 0.5) * 160
  const cz = (r() - 0.5) * 140
  const carrefour: XZ = [cx, cz]
  const far = EXT + 60
  const line = (axis: [Side, Side], off: number, amp: number, pass?: XZ): XZ[] => {
    // From one side to the other through `pass` (the carrefour), wound in two halves.
    const a = sidePt(axis[0], off, far)
    const b = sidePt(axis[1], off, far)
    const m = pass ?? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    return [...wound(a, m, amp, r), ...wound(m, b, amp, r).slice(1)]
  }
  const RING = 17
  const cutRing = (pts: XZ[]): XZ[][] => {
    const out: XZ[][] = []
    let cur: XZ[] = []
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const inR = dist(p, carrefour) < RING - 1.5
      if (!inR) cur.push(p)
      else if (cur.length) {
        // (A metre into the ring: it meets the ring's road there.)
        const q = pts[i - 1]
        let [lo, hi] = [q, p]
        for (let k = 0; k < 16; k++) {
          const m: XZ = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2]
          if (dist(m, carrefour) < RING - 1.5) hi = m
          else lo = m
        }
        cur.push(hi)
        out.push(cur)
        cur = []
      } else if (i + 1 < pts.length && dist(pts[i + 1], carrefour) >= RING - 1.5) {
        let [lo, hi] = [pts[i + 1], p]
        for (let k = 0; k < 16; k++) {
          const m: XZ = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2]
          if (dist(m, carrefour) < RING - 1.5) hi = m
          else lo = m
        }
        cur.push(hi)
      }
    }
    if (cur.length > 1) out.push(cur)
    return out
  }
  const mainPts = line(mainAxis, across ? cz : cx, 18 + pr.wobble, carrefour)
  const avePts = line(aveAxis, across ? cx : cz, 12 + pr.wobble, carrefour)
  for (const piece of cutRing(mainPts)) for (const l of keepIn(piece, 1.5)) road(pr.main, l)
  for (const piece of cutRing(avePts)) for (const l of keepIn(piece, 1.5)) road(pr.avenue === 'track' ? 'tertiary' : pr.avenue, l)
  const ringPts: XZ[] = []
  for (let k = 0; k <= 24; k++) ringPts.push([cx + Math.cos((k / 24) * Math.PI * 2) * RING, cz + Math.sin((k / 24) * Math.PI * 2) * RING])
  road('tertiary', ringPts)
  const island: XZ[] = []
  for (let k = 0; k < 16; k++) island.push([cx + Math.cos((k / 16) * Math.PI * 2) * 10, cz + Math.sin((k / 16) * Math.PI * 2) * 10])
  areas.push({ kind: 'green', rings: [island] })
  palms.push([cx + 2, cz - 1.5], [cx - 2.5, cz + 2])

  // The edge streets that close the town (the promenade, the forest's track, the service road, the boulevard's inner side).
  for (const s of SIDES) {
    if (edges[s] === 'ville') continue
    const pts: XZ[] = []
    for (let t = -EXT - 40; t <= EXT + 40; t += 15) pts.push(sidePt(s, t, edgeD(s, t)))
    const cls = green(s) ? 'track' : edges[s] === 'lagune' || edges[s] === 'mer' ? 'tertiary' : 'street'
    for (const l of keepIn(pts, 1.5, s)) road(cls, l)
  }

  // The side streets: a grid off the main road and the avenue, wound a little, some pieces left out (T junctions, bigger blocks).
  const B = pr.block
  const sideCls = () => (r() < pr.unpaved ? 'track' : pr.side)
  const grid = (c0: number) => {
    const ks: number[] = []
    for (let k = 1; c0 + k * B < EXT; k++) ks.push(c0 + k * B + (r() - 0.5) * B * 0.25)
    for (let k = 1; c0 - k * B > -EXT; k++) ks.push(c0 - k * B + (r() - 0.5) * B * 0.25)
    return ks
  }
  // Parallel to the main road (offsets along the avenue's axis), then across (along the main road's).
  const parallel = grid(across ? cz : cx)
  const crossing = grid(across ? cx : cz)
  const sideStreets: XZ[][] = []
  for (const off of parallel) {
    const pts = line(mainAxis, off, pr.wobble, undefined)
    for (const l of keepIn(pts, 1.5)) sideStreets.push(l)
  }
  for (const off of crossing) {
    const pts = line(aveAxis, off, pr.wobble, undefined)
    for (const l of keepIn(pts, 1.5)) {
      // Cut between two parallel streets now and then (never next to the main road: the carrefour's blocks stay whole).
      const pieces: XZ[][] = [[]]
      for (let i = 0; i < l.length; i++) {
        pieces[pieces.length - 1].push(l[i])
        if (i > 0 && i < l.length - 1 && r() < 0.035) pieces.push([l[i]])
      }
      for (const p of pieces) if (p.length > 1 && (r() > 0.22 || p.some((q) => dist(q, carrefour) < 140))) sideStreets.push(p)
    }
  }
  for (const l of sideStreets) road(sideCls(), l)

  knot(roads)
  trimStubs(roads)

  // Specials (the market square, the school, the terrain, the church or mosque) and the fronts along the streets.
  const taken: XZ[][] = []
  const clearOfRoads = (ring: XZ[], margin: number) => {
    let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, z] of ring) [x0, z0, x1, z1] = [Math.min(x0, x), Math.min(z0, z), Math.max(x1, x), Math.max(z1, z)]
    const pts: XZ[] = [...ring, centroid(ring)]
    for (let x = x0; x <= x1; x += 4) for (let z = z0; z <= z1; z += 4) if (pointInRing([x, z], ring)) pts.push([x, z])
    for (const rd of roads)
      for (let i = 1; i < rd.pts.length; i++) {
        const a = rd.pts[i - 1]
        const b = rd.pts[i]
        if (Math.max(a[0], b[0]) < x0 - 30 || Math.min(a[0], b[0]) > x1 + 30 || Math.max(a[1], b[1]) < z0 - 30 || Math.min(a[1], b[1]) > z1 + 30) continue
        for (const p of pts) if (segDist(p, a, b) < rd.width / 2 + margin) return false
      }
    return true
  }
  const bbox = (ring: XZ[]) => {
    let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, z] of ring) [x0, z0, x1, z1] = [Math.min(x0, x), Math.min(z0, z), Math.max(x1, x), Math.max(z1, z)]
    return [x0, z0, x1, z1]
  }
  const boxes = new Map<XZ[], number[]>()
  const overlapsTaken = (ring: XZ[]) => {
    const [x0, z0, x1, z1] = bbox(ring)
    return taken.some((t) => {
      let b = boxes.get(t)
      if (!b) boxes.set(t, (b = bbox(t)))
      if (b[0] > x1 || b[2] < x0 || b[1] > z1 || b[3] < z0) return false
      return ring.some((p) => pointInRing(p, t)) || t.some((p) => pointInRing(p, ring)) || pointInRing(centroid(ring), t)
    })
  }
  const inWater = (p: XZ) => areas.some((a) => a.kind === 'water' && pointInRing(p, a.rings[0]))
  /** The fronts along the town's streets: every `step` metres, each side, `back` metres from the roadway's edge. */
  const fronts = (classes: Set<string>, step: number, back: number): Front[] => {
    const out: Front[] = []
    for (const rd of roads) {
      if (!classes.has(rd.cls)) continue
      let acc = step / 2
      for (let i = 1; i < rd.pts.length; i++) {
        const a = rd.pts[i - 1]
        const b = rd.pts[i]
        const len = dist(a, b)
        if (!len) continue
        const dir = Math.atan2(b[1] - a[1], b[0] - a[0])
        const nx = -(b[1] - a[1]) / len
        const nz = (b[0] - a[0]) / len
        while (acc < len) {
          const p: XZ = [a[0] + ((b[0] - a[0]) * acc) / len, a[1] + ((b[1] - a[1]) * acc) / len]
          for (const sd of [1, -1]) {
            const at: XZ = [p[0] + nx * sd * (rd.width / 2 + back), p[1] + nz * sd * (rd.width / 2 + back)]
            if (inside(at, -8) && !inWater(at)) out.push({ at, street: p, dir, cls: rd.cls })
          }
          acc += step
        }
        acc -= len
      }
    }
    return out
  }
  const busy = new Set([pr.main, pr.avenue === 'track' ? 'tertiary' : pr.avenue, 'tertiary'])
  const quiet = new Set([pr.side, 'track', 'street', 'tertiary'])
  const specials: Special[] = []
  const placeSpecial = (tag: Special['tag'], w: number, d: number, near: number, classes: Set<string>) => {
    const list = fronts(classes, 12, 2)
      .map((f) => {
        const out = Math.atan2(f.at[1] - f.street[1], f.at[0] - f.street[0])
        const c: XZ = [f.at[0] + Math.cos(out) * d / 2, f.at[1] + Math.sin(out) * d / 2]
        return { f, c, ring: rect(c, f.dir, w, d), k: Math.abs(dist(c, carrefour) - near) + r() * 30 }
      })
      .sort((a, b) => a.k - b.k)
    for (const x of list) {
      if (!x.ring.every((p) => inside(p, -4)) || x.ring.some(inWater) || overlapsTaken(x.ring) || !clearOfRoads(x.ring, 1.2)) continue
      taken.push(x.ring)
      specials.push({ tag, at: x.c, ring: x.ring, front: x.f })
      return
    }
  }
  placeSpecial('market', 46, 36, 55, busy)
  placeSpecial('school', 64, 46, 210, quiet)
  placeSpecial('pitch', 68, 44, 280, quiet)
  placeSpecial('worship', 30, 30, 150, busy)
  for (const sp of specials) {
    if (sp.tag === 'school') areas.push({ kind: 'campus', rings: [sp.ring] })
    if (sp.tag === 'pitch') areas.push({ kind: 'pitch', rings: [rect(sp.at, sp.front.dir, 60, 38)] })
    if (sp.tag === 'market') areas.push({ kind: 'sand', rings: [sp.ring] })
  }

  // The fronts for the places, the lots, the home and the neighbours: 18 m squares by the street.
  const LOT = 18
  const fr = fronts(new Set([...busy, ...quiet]), 26, LOT / 2 + 1)
  const ok = (f: Front) => {
    const ring = rect(f.at, f.dir, LOT, LOT)
    return ring.every((p) => inside(p, -2)) && !ring.some(inWater) && !overlapsTaken(ring) && clearOfRoads(ring, 0.8)
  }
  const used: XZ[] = []
  const free = (f: Front, gap: number) => !used.some((q) => dist(q, f.at) < gap)
  const take = (f: Front) => {
    used.push(f.at)
    taken.push(rect(f.at, f.dir, LOT, LOT))
  }
  const good = fr.filter(ok)
  const byNear = (list: Front[], to: XZ) => [...list].sort((a, b) => dist(a.at, to) - dist(b.at, to))
  // The places: on the busy streets, round the carrefour.
  const SLOT_KINDS: [string, string[]][] = [
    ['maquis', ['maquis', 'restaurant']],
    ['boutique', ['boutique', 'supermarket', 'shop']],
    ['pharmacie', ['pharmacie']],
    ['salon', ['salon', 'barbier']],
    ['grin', ['grin', 'cafe']],
    ['maquis2', ['maquis', 'restaurant', 'club']],
    ['gare', ['transport', 'bus-stop', 'gbaka-stop']],
    ['boutique2', ['boutique', 'couture', 'mobile-money']],
    ['sante', ['health', 'creche']],
    ['barbier', ['barbier', 'salon']],
    ['banque', ['banque', 'mobile-money', 'office']],
    ['restaurant', ['restaurant', 'maquis']],
  ]
  const slots: Slot[] = []
  for (const f of byNear(good.filter((f) => busy.has(f.cls)), carrefour)) {
    if (slots.length >= SLOT_KINDS.length) break
    if (dist(f.at, carrefour) < RING + 12 || !free(f, 30)) continue
    const [tag, kinds] = SLOT_KINDS[slots.length]
    slots.push({ ...f, tag, kinds })
    take(f)
  }
  for (const sp of specials) slots.push({ ...sp.front, at: sp.at, tag: sp.tag, kinds: sp.tag === 'market' ? ['market'] : sp.tag === 'school' ? ['school', 'creche'] : sp.tag === 'pitch' ? ['field', 'pitch', 'sport'] : ['worship', 'church', 'mosque'] })
  // Lot 0 by the carrefour (« ta première boutique au carrefour »), the home on a quiet street, the other lots spread out from there.
  const lots: Front[] = []
  const first = byNear(good.filter((f) => busy.has(f.cls) && free(f, 34)), carrefour).find((f) => dist(f.at, carrefour) > RING + 12)
  if (first) (lots.push(first), take(first))
  const homeAt: XZ = [carrefour[0] + (r() - 0.5) * 300, carrefour[1] + (r() - 0.5) * 300]
  const home = byNear(good.filter((f) => !busy.has(f.cls) && free(f, 40)), homeAt)[0] ?? byNear(good.filter((f) => free(f, 30)), homeAt)[0]
  take(home)
  for (const f of byNear(good, [(carrefour[0] + home.at[0]) / 2, (carrefour[1] + home.at[1]) / 2])) {
    if (lots.length >= 30) break
    if (!free(f, 44)) continue
    lots.push(f)
    take(f)
  }
  // (Never fewer than 30: closer together if the town is small.)
  for (const f of byNear(good, carrefour)) {
    if (lots.length >= 30) break
    if (!free(f, 26)) continue
    lots.push(f)
    take(f)
  }
  const neighbours: Front[] = []
  for (const f of byNear(good, home.at)) {
    if (neighbours.length >= 10) break
    if (dist(f.at, home.at) < 120 || !free(f, 60)) continue
    neighbours.push(f)
    used.push(f.at)
  }

  // The town's own buildings: the Plateau's towers, the villas in their gardens, plots of green.
  const notTaken = (f: Front) => free(f, 20) && !overlapsTaken(rect(f.at, f.dir, 14, 14))
  if (pr.towers) {
    let n = 0
    for (const f of byNear(fronts(pr.id === 'plateau' ? new Set([...busy, ...quiet]) : busy, 34, 14), carrefour)) {
      if (n >= pr.towers) break
      if (!notTaken(f) || r() < 0.25) continue
      const w = 20 + Math.floor(r() * 7) * 1.5
      const d = 18 + Math.floor(r() * 6) * 1.5
      const ring = rect(f.at, f.dir, w, d)
      if (!ring.every((p) => inside(p, -2)) || overlapsTaken(ring) || !clearOfRoads(ring, 1)) continue
      const h = Math.round((pr.towerH[0] + r() ** 1.6 * (pr.towerH[1] - pr.towerH[0])) / 3) * 3
      const b = building(ring, h, { style: h > 30 ? undefined : 'civic' })
      if (!b) continue
      buildings.push(b)
      taken.push(ring)
      n++
    }
  }
  for (const f of fronts(quiet, 30, 12)) {
    const roll = r()
    if (roll >= pr.villas + pr.green || !notTaken(f)) continue
    const garden = rect(f.at, f.dir, 26, 22)
    if (!garden.every((p) => inside(p, -2)) || garden.some(inWater) || overlapsTaken(garden) || !clearOfRoads(garden, 0.6)) continue
    taken.push(garden)
    areas.push({ kind: 'green', rings: [garden] })
    if (roll < pr.villas) {
      // The villa a little back in its garden, a palm or two by the gate.
      const back = Math.atan2(f.at[1] - f.street[1], f.at[0] - f.street[0])
      const c: XZ = [f.at[0] + Math.cos(back) * 2, f.at[1] + Math.sin(back) * 2]
      const b = building(rect(c, f.dir, 12 + Math.floor(r() * 3) * 1.5, 9 + Math.floor(r() * 2) * 1.5), r() < 0.7 ? 6 : 3)
      if (b) buildings.push(b)
      palms.push([f.at[0] - Math.cos(back) * 9 + Math.cos(f.dir) * 10, f.at[1] - Math.sin(back) * 9 + Math.sin(f.dir) * 10])
    }
  }

  // Trees and palms along the streets, on the verge.
  for (const rd of roads) {
    if (rd.cls === 'motorway' || rd.cls === 'trunk') continue
    for (let i = 1; i < rd.pts.length; i++) {
      const a = rd.pts[i - 1]
      const b = rd.pts[i]
      const len = dist(a, b)
      for (let s = 6; s < len; s += 25) {
        if (r() >= pr.trees) continue
        const sd = r() < 0.5 ? 1 : -1
        const p: XZ = [a[0] + ((b[0] - a[0]) * s) / len - ((b[1] - a[1]) / len) * sd * (rd.width / 2 + 0.6), a[1] + ((b[1] - a[1]) * s) / len + ((b[0] - a[0]) / len) * sd * (rd.width / 2 + 0.6)]
        if (dist(p, carrefour) < RING + 4 || !inside(p, 0) || inWater(p)) continue
        ;(r() < pr.palms ? palms : trees).push(p)
      }
    }
  }

  // « Mon quartier » starts bare: its owner builds everything. The town above was laid out only to place the lots and
  // the home where they always were (the same seed, the same spots: the buildings players put up stay on their lot);
  // now it goes: its streets, its houses and towers, its gardens, its places, its market, school, pitch and place of
  // worship. What stays: the world's edges (the lagoon or the sea, the forest, the motorway on its wall, the railway,
  // the boulevard), the land's trees, the lots, the home, and one road from the home out to the edge (the way to
  // Babi). The owner lays the rest (« Aménager », terrain.ts).
  const edgeRoads = roads.filter((rd) => rd.cls === 'motorway' || rd.cls === 'trunk')
  roads.splice(0, roads.length, ...edgeRoads)
  for (let i = buildings.length - 1; i >= 0; i--) if (inside(buildings[i].c, 0)) buildings.splice(i, 1)
  for (let i = areas.length - 1; i >= 0; i--) if (areas[i].kind !== 'water' && areas[i].rings[0].every((p) => inside(p, 0))) areas.splice(i, 1)
  // The way out: from the home's front, straight to the nearest side that isn't water, clear of the lots if it can.
  const LOTR = LOT / 2 + 4
  const ways = SIDES.filter((s) => !water(s)).map((s) => {
    const [d0, t] = sideOf(s, home.street)
    const to = sidePt(s, t, edgeD(s, t) + (edges[s] === 'ville' ? 0 : 12))
    const hits = lots.filter((l) => segDist(l.at, home.street, to) < LOTR).length
    return { to, len: edgeD(s, t) - d0, hits }
  })
  ways.sort((a, b) => a.hits - b.hits || a.len - b.len)
  if (ways[0]) road('street', [home.street, ways[0].to])
  const wayOut = ways[0] ? roads[roads.length - 1] : undefined
  // The land's own trees: the town's go, a scattering over the open ground instead (none on a lot, the home or the way).
  const keepTree = (p: XZ) => !inside(p, 0)
  trees.splice(0, trees.length, ...trees.filter(keepTree))
  palms.splice(0, palms.length, ...palms.filter(keepTree))
  const spots = [...lots, home]
  const nTrees = Math.round((EXT * EXT) / 2600)
  for (let k = 0; k < nTrees; k++) {
    const p: XZ = [(r() * 2 - 1) * EXT, (r() * 2 - 1) * EXT]
    if (!inside(p, -6) || inWater(p) || spots.some((f) => dist(f.at, p) < LOTR + 2) || (wayOut && segDist(p, wayOut.pts[0], wayOut.pts[wayOut.pts.length - 1]) < 8)) continue
    ;(r() < pr.palms ? palms : trees).push(p)
  }
  slots.splice(0, slots.length)
  specials.splice(0, specials.length)
  const clear = lots.map((f) => ({ at: f.at, r: LOT / 2 + 1 }))
  clear.push({ at: home.at, r: LOT / 2 + 2 })
  const u = { key, preset: pr, variant, edges, lim, walk, roads, buildings, areas, trees, palms, rails, forests, carrefour, home, lots, neighbours, slots, specials, clear }
  // The ground its owner shaped, laid over it (terrain.ts).
  if (spec.terrain) applyTerrain(u, terrainWorld(u), spec.terrain, (p) => universWalkable(u, p[0], p[1]), inWater, knot)
  return u
}

/** The streets joined where they cross: a point added to both (the street's ways join at shared points, nav.ts). */
function knot(roads: Road[]) {
  type Seg = { r: number; i: number; a: XZ; b: XZ }
  for (let pass = 0; pass < 3; pass++) {
    const adds = new Map<number, { i: number; t: number; p: XZ }[]>()
    const segs: Seg[] = []
    roads.forEach((rd, ri) => {
      for (let i = 1; i < rd.pts.length; i++) segs.push({ r: ri, i, a: rd.pts[i - 1], b: rd.pts[i] })
    })
    const cell = 60
    const grid = new Map<string, Seg[]>()
    for (const s of segs) {
      const x0 = Math.floor(Math.min(s.a[0], s.b[0]) / cell)
      const x1 = Math.floor(Math.max(s.a[0], s.b[0]) / cell)
      const z0 = Math.floor(Math.min(s.a[1], s.b[1]) / cell)
      const z1 = Math.floor(Math.max(s.a[1], s.b[1]) / cell)
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) (grid.get(`${x},${z}`) ?? grid.set(`${x},${z}`, []).get(`${x},${z}`)!).push(s)
    }
    const seen = new Set<string>()
    for (const list of grid.values())
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const s = list[i]
          const q = list[j]
          if (s.r === q.r) continue
          const k = s.r < q.r ? `${s.r}:${s.i}:${q.r}:${q.i}` : `${q.r}:${q.i}:${s.r}:${s.i}`
          if (seen.has(k)) continue
          seen.add(k)
          const c = cross(s.a, s.b, q.a, q.b)
          if (!c) continue
          const p: XZ = [s.a[0] + (s.b[0] - s.a[0]) * c[0], s.a[1] + (s.b[1] - s.a[1]) * c[0]]
          for (const [seg, t] of [
            [s, c[0]],
            [q, c[1]],
          ] as const) {
            // (Not when a point of the line is already there.)
            if (dist(p, seg.a) < 1.2 || dist(p, seg.b) < 1.2) continue
            const l = adds.get(seg.r) ?? adds.set(seg.r, []).get(seg.r)!
            l.push({ i: seg.i, t, p })
          }
        }
    if (!adds.size) return
    for (const [ri, l] of adds) {
      const rd = roads[ri]
      l.sort((a, b) => b.i - a.i || b.t - a.t)
      const pts = [...rd.pts]
      for (const x of l) pts.splice(x.i, 0, x.p)
      rd.pts = pts
    }
  }
}

/** The bits of street left past a junction at a street's ends (a few metres into nothing) taken off. */
function trimStubs(roads: Road[]) {
  const key = (p: XZ) => `${Math.round(p[0])},${Math.round(p[1])}`
  const count = new Map<string, number>()
  for (const rd of roads) for (const p of rd.pts) count.set(key(p), (count.get(key(p)) ?? 0) + 1)
  for (const rd of roads) {
    const shared = (p: XZ) => (count.get(key(p)) ?? 0) > 1
    for (const end of [0, 1]) {
      const pts = end ? [...rd.pts].reverse() : rd.pts
      if (pts.length < 3 || shared(pts[0]) || !shared(pts[1]) || dist(pts[0], pts[1]) > 6) continue
      rd.pts = end ? pts.slice(1).reverse() : pts.slice(1)
    }
  }
}

/**
 * What stands on a lot or a place's spot, drawn by the world itself: a house to rent, a block of flats (lot -1: a
 * friend's home, visited), and the walls of every place there (the player's maquis, boutique, salon…, the world's
 * own places on their spots: lot -2 - n is the world's n-th slot), by the street's place kind. The place's sign,
 * its terrace, its stalls and its people are the street's (OpenWorld's PlaceSign, dressing.tsx, quartier/life.tsx).
 */
export type Built = { lot: number; kind: string }

/** A lot's square (m), as laid out (genUnivers' fronts). */
const LOT_SIZE = 18

/** The walls each kind of place stands in on its 18 m lot (width along the street, depth, height). None: open-air (a market, a pitch, a stop). */
const SHELL: Record<string, { w: number; d: number; h: number; style?: Building['style'] }> = {
  maison: { w: 12, d: 10, h: 6 },
  immeuble: { w: 15, d: 13, h: 21, style: 'civic' },
  maquis: { w: 12, d: 7, h: 3, style: 'commerce' },
  restaurant: { w: 12, d: 8, h: 3, style: 'commerce' },
  boutique: { w: 10, d: 8, h: 3, style: 'commerce' },
  couture: { w: 8, d: 7, h: 3, style: 'commerce' },
  salon: { w: 9, d: 8, h: 3, style: 'commerce' },
  barbier: { w: 8, d: 7, h: 3, style: 'commerce' },
  pharmacie: { w: 11, d: 9, h: 6, style: 'commerce' },
  school: { w: 16, d: 9, h: 6, style: 'civic' },
  creche: { w: 12, d: 8, h: 3, style: 'civic' },
  club: { w: 15, d: 11, h: 6, style: 'commerce' },
  health: { w: 14, d: 10, h: 6, style: 'civic' },
  office: { w: 12, d: 10, h: 9, style: 'civic' },
  gym: { w: 12, d: 10, h: 6, style: 'commerce' },
  gaming: { w: 9, d: 8, h: 3, style: 'commerce' },
  worship: { w: 14, d: 12, h: 9, style: 'civic' },
  cinema: { w: 14, d: 12, h: 9, style: 'commerce' },
}
/** The open-air ones: their ground (a pitch's lines, the market's sand). */
const GROUND: Record<string, { kind: Area['kind']; w: number; d: number }> = { sport: { kind: 'pitch', w: 16, d: 10 }, market: { kind: 'sand', w: 17, d: 15 } }

/** The spot a built thing stands on (a lot, the home, a slot) and, for a special (the school's grounds, the market…), its size. */
function builtFront(u: Univers, lot: number): { f: Front; deep: number; wide: number } | null {
  if (lot === -1) return { f: u.home, deep: LOT_SIZE, wide: LOT_SIZE }
  if (lot >= 0) return u.lots[lot] ? { f: u.lots[lot], deep: LOT_SIZE, wide: LOT_SIZE } : null
  const s = u.slots[-2 - lot]
  if (!s) return null
  const sp = u.specials.find((x) => x.at === s.at || (x.at[0] === s.at[0] && x.at[1] === s.at[1]))
  if (!sp) return { f: s, deep: LOT_SIZE, wide: LOT_SIZE }
  const [x0, x1] = [Math.min(...sp.ring.map((p) => p[0])), Math.max(...sp.ring.map((p) => p[0]))]
  const [z0, z1] = [Math.min(...sp.ring.map((p) => p[1])), Math.max(...sp.ring.map((p) => p[1]))]
  // (The special's ring is turned along its street: its depth across it, its width along it.)
  const ux = Math.cos(s.dir)
  const along = Math.abs(ux) > 0.7 ? x1 - x0 : z1 - z0
  const across = Math.abs(ux) > 0.7 ? z1 - z0 : x1 - x0
  return { f: { ...s, at: sp.at, street: sp.front.street }, deep: across, wide: along }
}

/**
 * Where a place built on a spot has its walls, and its door on the street: the walls at the back of the lot, its
 * front (and the terrace, the stalls before it) towards the street. Null for an open-air one.
 */
export function shellOf(u: Univers, b: Built): { ring: XZ[]; c: XZ; h: number; style?: Building['style']; door: XZ; out: XZ } | null {
  const at = builtFront(u, b.lot)
  if (!at) return null
  const { f, deep, wide } = at
  const d0 = Math.hypot(f.at[0] - f.street[0], f.at[1] - f.street[1]) || 1
  const out: XZ = [(f.at[0] - f.street[0]) / d0, (f.at[1] - f.street[1]) / d0]
  const s = SHELL[b.kind]
  if (!s) return null
  // A special's grounds are big: the school's or the church's walls at their back, wider.
  const big = deep > LOT_SIZE + 2
  const w = big ? Math.min(wide - 10, b.kind === 'school' ? 40 : 22) : s.w
  const d = big ? Math.min(deep - 14, b.kind === 'school' ? 12 : 16) : s.d
  const back = deep / 2 - 1 - d / 2
  const c: XZ = [f.at[0] + out[0] * back, f.at[1] + out[1] * back]
  const front = back - d / 2
  return { ring: rect(c, f.dir, w, d), c, h: big && b.kind === 'school' ? 9 : s.h, style: s.style, door: [f.at[0] + out[0] * (front - 1.2), f.at[1] + out[1] * (front - 1.2)], out }
}

/**
 * Where a place of the world stands, exactly (places.ts PlaceSpot.fixed): in its walls (its door on the street),
 * else in the open on its spot (its way in at the lot's front).
 */
export function spotOf(u: Univers, b: Built): { at: XZ; door: XZ; roadAngle: number } | null {
  const at = builtFront(u, b.lot)
  if (!at) return null
  const { f, deep } = at
  const s = shellOf(u, b)
  if (s) return { at: f.at, door: s.door, roadAngle: f.dir }
  const d0 = Math.hypot(f.at[0] - f.street[0], f.at[1] - f.street[1]) || 1
  // (A special's grounds, the world's market square: its way in at its edge on the street.)
  const k = deep > LOT_SIZE + 2 ? deep / 2 - 1 : Math.min(deep / 2 - 1, GROUND[b.kind] ? GROUND[b.kind].d / 2 + 0.8 : 6)
  return { at: f.at, door: [f.at[0] - ((f.at[0] - f.street[0]) / d0) * k, f.at[1] - ((f.at[1] - f.street[1]) / d0) * k], roadAngle: f.dir }
}

/** One of the world's four chunks, as the street's chunk of a map tile (tiles.ts ChunkData), its houses filled in. */
export function universChunk(u: Univers, o: Origin, tx: number, ty: number, built: Built[] = []): ChunkData {
  const box = tileBox(o, tx, ty)
  const inBox = (p: XZ) => p[0] >= box.x0 && p[0] < box.x1 && p[1] >= box.z0 && p[1] < box.z1
  const chunk: ChunkData = { key: `${tx}/${ty}`, tx, ty, box, roads: [], buildings: [], areas: [], trees: [], palms: [], aeroways: [], pois: [], forest: [], rails: [] }
  for (const rd of u.roads) for (const pts of clipLine(rd.pts, box)) if (pts.length > 1) chunk.roads.push({ ...rd, pts })
  for (const a of u.areas) {
    const rings = a.rings.map((ring) => clipRing(ring, box)).filter((ring) => ring.length >= 3)
    if (rings.length && rings[0].length >= 3) chunk.areas.push({ kind: a.kind, rings })
  }
  for (const b of u.buildings) if (inBox(b.c)) chunk.buildings.push({ ...b, ring: b.ring.slice() })
  // What stands on the lots and the places' spots: the houses and flats the player put up, the walls of every
  // place (the player's, the world's), the ground of the open-air ones.
  for (const x of built) {
    const at = builtFront(u, x.lot)
    if (!at || !inBox(at.f.at)) continue
    const g = GROUND[x.kind]
    if (g && at.deep <= LOT_SIZE + 2) chunk.areas.push({ kind: g.kind, rings: [rect(at.f.at, at.f.dir, g.w, g.d)] })
    const s = shellOf(u, x)
    if (!s) continue
    const b = building(s.ring, s.h, s.style ? { style: s.style } : {})
    if (b) chunk.buildings.push(b)
  }
  chunk.trees = u.trees.filter(inBox)
  chunk.palms = u.palms.filter(inBox)
  for (const pts of u.rails) for (const l of clipLine(pts, box)) if (l.length > 1) chunk.rails!.push(l)
  const forests = u.forests.map((rings) => rings.map((ring) => clipRing(ring, box)).filter((ring) => ring.length >= 3)).filter((rings) => rings.length && rings[0].length >= 3)
  const pad = 30
  const clear = u.clear.filter((c) => c.at[0] > box.x0 - pad && c.at[0] < box.x1 + pad && c.at[1] > box.z0 - pad && c.at[1] < box.z1 + pad)
  // (Bare: no houses of the game's along its streets, only what its owner builds.)
  finishChunk(chunk, clear, forests, false)
  return chunk
}

/** What the owner's ground keeps off (terrain.ts): the world's own streets, its lots and home, its places and their grounds. */
export function terrainWorld(u: Pick<Univers, 'roads' | 'clear' | 'specials'>): TerrainWorld {
  return { roads: u.roads.slice(), clear: [...u.clear, ...u.specials.map((sp) => ({ at: sp.at, r: Math.max(...sp.ring.map((p) => dist(p, sp.at))) }))] }
}

/** Whether a Sim may stand here in the world: inside its edges (the water, the forest's depth, the motorway's wall). */
export function universWalkable(u: Pick<Univers, 'walk'>, x: number, z: number) {
  const p: XZ = [x, z]
  return SIDES.every((s) => sideOf(s, p)[0] <= u.walk[s])
}

/** How near the world's edge (m: 0 at it, negative past it). */
export function universEdge(u: Pick<Univers, 'walk'>, x: number, z: number) {
  const p: XZ = [x, z]
  return Math.min(...SIDES.map((s) => u.walk[s] - sideOf(s, p)[0]))
}
