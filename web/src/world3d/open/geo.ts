// Real places to game metres. The open world is laid out in metres around an
// origin (the commune's centre): x grows east, z grows south, so the usual
// camera, from the south-east, sees north up and to the left.

export type XZ = [number, number]

/** Real buildings standing where the game puts its own (a place) are removed. */
export const PLACE_CLEARANCE = 16

/** Map tiles of this zoom are the open world's chunks: about 610 m wide here. */
export const CHUNK_ZOOM = 16

const M_PER_DEG_LAT = 110574

export type Origin = { lat: number; lng: number }

export function toLocal(o: Origin, lat: number, lng: number): XZ {
  return [(lng - o.lng) * Math.cos((o.lat * Math.PI) / 180) * 111320, -(lat - o.lat) * M_PER_DEG_LAT]
}

export function toLatLng(o: Origin, [x, z]: XZ): { lat: number; lng: number } {
  return { lat: o.lat - z / M_PER_DEG_LAT, lng: o.lng + x / (Math.cos((o.lat * Math.PI) / 180) * 111320) }
}

/** The tile (chunk) holding a point. */
export function tileOf(lat: number, lng: number, z = CHUNK_ZOOM): [number, number] {
  const n = 2 ** z
  const x = Math.floor(((lng + 180) / 360) * n)
  const r = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)
  return [x, y]
}

/** A point inside a tile (0..extent) to latitude and longitude. */
export function tilePoint(tx: number, ty: number, z: number, px: number, py: number, extent: number) {
  const n = 2 ** z
  const X = (tx + px / extent) / n
  const Y = (ty + py / extent) / n
  return { lng: X * 360 - 180, lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * Y))) * 180) / Math.PI }
}

/** A tile's box in local metres. */
export function tileBox(o: Origin, tx: number, ty: number, z = CHUNK_ZOOM) {
  const nw = tilePoint(tx, ty, z, 0, 0, 1)
  const se = tilePoint(tx, ty, z, 1, 1, 1)
  const [x0, z0] = toLocal(o, nw.lat, nw.lng)
  const [x1, z1] = toLocal(o, se.lat, se.lng)
  return { x0, z0, x1, z1 }
}

export type Box = { x0: number; z0: number; x1: number; z1: number }

/** Clip a polygon ring to a box (Sutherland–Hodgman). */
export function clipRing(ring: XZ[], b: Box): XZ[] {
  let out = ring
  const edges: [(p: XZ) => boolean, (a: XZ, c: XZ) => XZ][] = [
    [(p) => p[0] >= b.x0, (a, c) => cut(a, c, 0, b.x0)],
    [(p) => p[0] <= b.x1, (a, c) => cut(a, c, 0, b.x1)],
    [(p) => p[1] >= b.z0, (a, c) => cut(a, c, 1, b.z0)],
    [(p) => p[1] <= b.z1, (a, c) => cut(a, c, 1, b.z1)],
  ]
  for (const [inside, at] of edges) {
    const src = out
    out = []
    for (let i = 0; i < src.length; i++) {
      const a = src[(i + src.length - 1) % src.length]
      const c = src[i]
      if (inside(c)) {
        if (!inside(a)) out.push(at(a, c))
        out.push(c)
      } else if (inside(a)) out.push(at(a, c))
    }
    if (!out.length) break
  }
  return out
}

function cut(a: XZ, c: XZ, axis: 0 | 1, v: number): XZ {
  const t = (v - a[axis]) / (c[axis] - a[axis])
  return axis === 0 ? [v, a[1] + (c[1] - a[1]) * t] : [a[0] + (c[0] - a[0]) * t, v]
}

/** Clip a line to a box: the pieces inside (Liang–Barsky per segment). */
export function clipLine(line: XZ[], b: Box): XZ[][] {
  const parts: XZ[][] = []
  let cur: XZ[] = []
  for (let i = 1; i < line.length; i++) {
    const seg = clipSegment(line[i - 1], line[i], b)
    if (!seg) {
      if (cur.length > 1) parts.push(cur)
      cur = []
      continue
    }
    const [p, q] = seg
    if (!cur.length || cur[cur.length - 1][0] !== p[0] || cur[cur.length - 1][1] !== p[1]) {
      if (cur.length > 1) parts.push(cur)
      cur = [p]
    }
    cur.push(q)
  }
  if (cur.length > 1) parts.push(cur)
  return parts
}

function clipSegment(a: XZ, c: XZ, b: Box): [XZ, XZ] | null {
  let t0 = 0
  let t1 = 1
  const dx = c[0] - a[0]
  const dz = c[1] - a[1]
  for (const [p, q] of [
    [-dx, a[0] - b.x0],
    [dx, b.x1 - a[0]],
    [-dz, a[1] - b.z0],
    [dz, b.z1 - a[1]],
  ]) {
    if (p === 0) {
      if (q < 0) return null
    } else {
      const r = q / p
      if (p < 0) t0 = Math.max(t0, r)
      else t1 = Math.min(t1, r)
      if (t0 > t1) return null
    }
  }
  const at = (t: number): XZ => (t === 0 ? a : t === 1 ? c : [a[0] + dx * t, a[1] + dz * t])
  return [at(t0), at(t1)]
}

export function pointInRing([x, z]: XZ, ring: XZ[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i]
    const [xj, zj] = ring[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export function centroid(ring: XZ[]): XZ {
  let x = 0
  let z = 0
  for (const p of ring) {
    x += p[0]
    z += p[1]
  }
  return [x / ring.length, z / ring.length]
}

/** A cheap, stable hash of numbers, for per-building variety. */
export function hash(...n: number[]) {
  let h = 2166136261
  for (const v of n) h = Math.imul(h ^ Math.round(v * 10), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

/** How high a bridge's deck stands over the water. */
export const BRIDGE_HEIGHT = 4.5
const RAMP = 35 // metres to climb from the bank to the deck

/**
 * The deck's height at each point of a bridge: it climbs from its real ends
 * (where it meets the road on the bank) and stays up over the water. An end
 * cut by the chunk's edge isn't a real end: the deck stays up there.
 */
export function bridgeHeights(pts: XZ[], b: Box): number[] {
  const d: number[] = [0]
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const total = d[d.length - 1]
  const cut = ([x, z]: XZ) => Math.min(Math.abs(x - b.x0), Math.abs(x - b.x1), Math.abs(z - b.z0), Math.abs(z - b.z1)) < 0.5
  const startReal = !cut(pts[0])
  const endReal = !cut(pts[pts.length - 1])
  const ease = (t: number) => t * t * (3 - 2 * t)
  return d.map((s) => {
    let k = 1
    if (startReal) k = Math.min(k, s / RAMP)
    if (endReal) k = Math.min(k, (total - s) / RAMP)
    return BRIDGE_HEIGHT * ease(Math.max(0, Math.min(1, k)))
  })
}
