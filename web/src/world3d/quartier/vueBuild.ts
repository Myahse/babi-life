import { ShapeUtils, Vector2 } from 'three'
import { CHUNK_ZOOM, tileBox, tileOf, type Origin, type XZ } from '../open/geo'
import { fetchChunk, type ChunkData } from '../open/tiles'

// The quartier's view (update « mon-quartier », components/quartier/QuartierVue.tsx): the neighbourhood round
// the home as a plain city of blocks, seen from high up, cheap enough for any phone: the real map's tiles (the
// street's own, world3d/open/tiles.ts: its houses, the game's fill, the extra real footprints) reduced to
// boxes with their light baked in their colours, the streets as flat ribbons, the water and the green as flat
// shapes. Two meshes in all, no lights, no shadows. Built off the main thread (vueWorker.ts).

export type VueRequest = { id: number; center: Origin; r: number; token: string; /** A weak phone: fewer, bigger buildings. */ light: boolean }
/** Two meshes' arrays (position xyz, colour rgb in bytes, index) and the streets for the lots (lots.ts snapLots). */
export type VueArrays = { position: Float32Array; color: Uint8Array; index: Uint32Array }
export type VueData = { solid: VueArrays; flat: VueArrays; segs: Float32Array; buildings: number; ms: number }
export type VueReply = { id: number; data?: VueData; error?: string }

/** Buildings the view draws at most: the biggest kept. */
const MAX_BUILDINGS = 9000
const MAX_BUILDINGS_LIGHT = 3500
const MAX_TREES = 1600
const MAX_TREES_LIGHT = 500

/** The streets a lot may stand on, for snapLots (not the motorway, not a footpath). */
const LOT_STREETS = new Set(['street', 'street_limited', 'tertiary', 'tertiary_link', 'secondary', 'primary', 'service', 'track'])

class Builder {
  pos: number[] = []
  col: number[] = []
  idx: number[] = []
  quad(a: number[], b: number[], c: number[], d: number[], rgb: [number, number, number]) {
    const n = this.pos.length / 3
    this.pos.push(...a, ...b, ...c, ...d)
    for (let i = 0; i < 4; i++) this.col.push(rgb[0], rgb[1], rgb[2])
    this.idx.push(n, n + 1, n + 2, n, n + 2, n + 3)
  }
  tris(pts: XZ[], tri: number[][], y: number, rgb: [number, number, number]) {
    const n = this.pos.length / 3
    for (const [x, z] of pts) this.pos.push(x, y, z), this.col.push(rgb[0], rgb[1], rgb[2])
    for (const [a, b, c] of tri) this.idx.push(n + a, n + c, n + b)
  }
  done(): VueArrays {
    return { position: new Float32Array(this.pos), color: new Uint8Array(this.col), index: new Uint32Array(this.idx) }
  }
}

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const WALLS = ['#efe6d6', '#e9dcc3', '#f3f1ec', '#d9cbb0', '#f0d9b5', '#e8d2c0', '#e3e8ea', '#f2d8c8'].map(hex)
const TALL = hex('#c9d6e2')
const TIN = ['#a3a8aa', '#9c6a4c', '#8f989a', '#b07a55'].map(hex)
const FLAT_ROOF = ['#d8d0c2', '#cfc6b6', '#e0d8ca'].map(hex)
const ASPHALT = hex('#5d6066')
const BIG_ROAD = hex('#4c4f55')
const LATERITE = hex('#c47a4a')
const WATER = hex('#4f9cc4')
const GREEN = hex('#8fbf6a')
const SAND = hex('#e8d8a8')
const PITCH = hex('#6fae55')
const TREE = hex('#3f8a45')
const PALM = hex('#5a9a3c')

/** The sun from the south-east, high: how lit a wall facing (nx, nz) is. */
const SUN: XZ = [0.6, 0.8]
const shade = (rgb: [number, number, number], k: number): [number, number, number] => [Math.min(255, rgb[0] * k), Math.min(255, rgb[1] * k), Math.min(255, rgb[2] * k)]

/** A box (centre x z, width w along `rot`, depth d, height h) with its light baked: the roof full, the walls by the sun. */
function box(g: Builder, x: number, z: number, w: number, d: number, h: number, rot: number, wall: [number, number, number], roof: [number, number, number]) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const corner = (u: number, v: number): XZ => [x + u * c - v * s, z + u * s + v * c]
  const p = [corner(-w / 2, -d / 2), corner(w / 2, -d / 2), corner(w / 2, d / 2), corner(-w / 2, d / 2)]
  g.quad([p[0][0], h, p[0][1]], [p[3][0], h, p[3][1]], [p[2][0], h, p[2][1]], [p[1][0], h, p[1][1]], roof)
  for (let i = 0; i < 4; i++) {
    const a = p[i]
    const b = p[(i + 1) % 4]
    const ex = b[0] - a[0]
    const ez = b[1] - a[1]
    const l = Math.hypot(ex, ez) || 1
    // Outward normal of this wall (the corners go round clockwise on a map, north up: x east, z south).
    const nx = ez / l
    const nz = -ex / l
    const lit = 0.62 + 0.36 * Math.max(0, nx * SUN[0] + nz * SUN[1])
    g.quad([a[0], 0, a[1]], [a[0], h, a[1]], [b[0], h, b[1]], [b[0], 0, b[1]], shade(wall, lit))
  }
}

/** A building's outline as one turned box: along its longest wall, the box round it. */
function blockOf(ring: XZ[]): [number, number, number, number, number] | null {
  let best = 0
  let rot = 0
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]
    const [bx, bz] = ring[(i + 1) % ring.length]
    const l = Math.hypot(bx - ax, bz - az)
    if (l > best) ((best = l), (rot = Math.atan2(bz - az, bx - ax)))
  }
  const ux = Math.cos(rot)
  const uz = Math.sin(rot)
  let [u0, u1, v0, v1] = [Infinity, -Infinity, Infinity, -Infinity]
  for (const [x, z] of ring) {
    const u = x * ux + z * uz
    const v = -x * uz + z * ux
    u0 = Math.min(u0, u)
    u1 = Math.max(u1, u)
    v0 = Math.min(v0, v)
    v1 = Math.max(v1, v)
  }
  const w = u1 - u0
  const d = v1 - v0
  if (w * d < 12) return null
  const cu = (u0 + u1) / 2
  const cv = (v0 + v1) / 2
  return [cu * ux - cv * uz, cu * uz + cv * ux, w, d, rot]
}

const rand = (x: number, z: number) => {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return v - Math.floor(v)
}

/** The tiles (the street's chunks) the view's circle reaches. */
export function vueTiles(center: Origin, r: number): [number, number][] {
  const [cx, cy] = tileOf(center.lat, center.lng, CHUNK_ZOOM)
  const out: [number, number][] = []
  const n = Math.ceil(r / 600) + 1
  for (let dx = -n; dx <= n; dx++)
    for (let dy = -n; dy <= n; dy++) {
      const b = tileBox(center, cx + dx, cy + dy)
      if (Math.hypot(Math.max(b.x0, 0, -b.x1), Math.max(b.z0, 0, -b.z1)) <= r) out.push([cx + dx, cy + dy])
    }
  return out
}

/** The view's two meshes and its streets from the map's chunks round the centre. */
export function buildVue(chunks: ChunkData[], r: number, light: boolean): Omit<VueData, 'ms'> {
  const solid = new Builder()
  const flat = new Builder()
  const segs: number[] = []
  const inside = (x: number, z: number, m = 0) => x * x + z * z <= (r + m) * (r + m)
  // The buildings, the biggest first when there are too many.
  type B = { x: number; z: number; w: number; d: number; h: number; rot: number; tin: boolean }
  const bs: B[] = []
  for (const c of chunks)
    for (const b of c.buildings) {
      if (!inside(b.c[0], b.c[1])) continue
      const k = blockOf(b.ring)
      if (!k) continue
      bs.push({ x: k[0], z: k[1], w: k[2], d: k[3], h: Math.max(3, b.height), rot: k[4], tin: !!b.tin || b.height <= 3 })
    }
  const max = light ? MAX_BUILDINGS_LIGHT : MAX_BUILDINGS
  if (bs.length > max) bs.sort((a, b) => b.w * b.d * b.h - a.w * a.d * a.h).length = max
  for (const b of bs) {
    const k = rand(b.x, b.z)
    const wall = b.h > 24 ? TALL : WALLS[Math.floor(k * WALLS.length)]
    const roof = b.tin ? TIN[Math.floor(rand(b.z, b.x) * TIN.length)] : FLAT_ROOF[Math.floor(k * FLAT_ROOF.length)]
    box(solid, b.x, b.z, b.w, b.d, b.h, b.rot, wall, roof)
  }
  // Trees and palms: small dark boxes, a few.
  const trees: [XZ, boolean][] = []
  for (const c of chunks) for (const [list, palm] of [[c.trees, false], [c.palms, true]] as const) for (const t of list) if (inside(t[0], t[1])) trees.push([t, palm])
  const maxT = light ? MAX_TREES_LIGHT : MAX_TREES
  const step = Math.max(1, Math.ceil(trees.length / maxT))
  for (let i = 0; i < trees.length; i += step) {
    const [[x, z], palm] = trees[i]
    const s = palm ? 2.2 : 3.6
    box(solid, x, z, s, s, palm ? 7 : 6, rand(x, z), palm ? PALM : TREE, palm ? PALM : TREE)
  }
  // The ground's water, green, sand and pitches, flat.
  for (const c of chunks)
    for (const a of c.areas) {
      const rgb = a.kind === 'water' ? WATER : a.kind === 'green' ? GREEN : a.kind === 'sand' ? SAND : a.kind === 'pitch' ? PITCH : null
      if (!rgb || !a.rings[0] || a.rings[0].length < 3) continue
      if (!a.rings[0].some(([x, z]) => inside(x, z, 200))) continue
      const outer = a.rings[0].map(([x, z]) => new Vector2(x, z))
      const holes = a.rings.slice(1).map((h) => h.map(([x, z]) => new Vector2(x, z)))
      try {
        const tri = ShapeUtils.triangulateShape(outer, holes)
        flat.tris([...a.rings[0], ...a.rings.slice(1).flat()], tri, a.kind === 'water' ? 0.04 : 0.06, rgb)
      } catch {
        // (A ring the triangulation can't take: left out.)
      }
    }
  // The streets, as ribbons (each piece a little longer at both ends, so the bends close).
  for (const c of chunks)
    for (const rd of c.roads) {
      const big = rd.width >= 10
      const rgb = !rd.paved ? LATERITE : big ? BIG_ROAD : ASPHALT
      const w = Math.max(3, rd.width) / 2
      const y = big ? 0.14 : 0.1
      for (let i = 0; i + 1 < rd.pts.length; i++) {
        const [ax, az] = rd.pts[i]
        const [bx, bz] = rd.pts[i + 1]
        if (!inside(ax, az, 40) && !inside(bx, bz, 40)) continue
        const l = Math.hypot(bx - ax, bz - az)
        if (l < 0.2) continue
        const ux = (bx - ax) / l
        const uz = (bz - az) / l
        const nx = -uz * w
        const nz = ux * w
        const ex = ux * w * 0.9
        const ez = uz * w * 0.9
        flat.quad([ax - ex + nx, y, az - ez + nz], [bx + ex + nx, y, bz + ez + nz], [bx + ex - nx, y, bz + ez - nz], [ax - ex - nx, y, az - ez - nz], rgb)
        if (LOT_STREETS.has(rd.cls) && !rd.bridge) segs.push(ax, az, bx, bz, rd.width)
      }
    }
  return { solid: solid.done(), flat: flat.done(), segs: new Float32Array(segs), buildings: bs.length }
}

/** The view's data: the chunks round the centre fetched (from the phone's cache when kept) and reduced. */
export async function vueJob(req: VueRequest): Promise<VueData> {
  const t0 = performance.now()
  const tiles = vueTiles(req.center, req.r)
  const chunks: ChunkData[] = []
  // Two at a time: the fetches overlap, the decoding goes on meanwhile.
  for (let i = 0; i < tiles.length; i += 2) {
    const got = await Promise.all(tiles.slice(i, i + 2).map(([tx, ty]) => fetchChunk(req.center, tx, ty, req.token).catch(() => null)))
    for (const c of got) if (c) chunks.push(c)
  }
  return { ...buildVue(chunks, req.r, req.light), ms: Math.round(performance.now() - t0) }
}
