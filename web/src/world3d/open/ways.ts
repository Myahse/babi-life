import { useMemo } from 'react'
import { rng } from '../themes'
import type { XZ } from './geo'
import type { Nav } from './nav'

// The ways round the Sim the street's people and vehicles take (OpenWorld's traffic and passers-by, the
// living city's scenes: livingCity.tsx): a route of a few streets from an anchor, the same on every
// phone, and the pavement line along it (crossing on the zebras).

/** A route for this round: a few streets from the anchor, the same on every phone. */
export function useRoutes(nav: Nav) {
  // New streets loaded: routes are drawn again (the same ones, where the map was already there).
  return useMemo(() => new Map<string, XZ[]>(), [nav]) // eslint-disable-line react-hooks/exhaustive-deps
}
export function routeFor(routes: Map<string, XZ[]>, nav: Nav, key: string, anchor: number | null, steps: number, minWidth: number, reach: number): XZ[] {
  let path = routes.get(key)
  if (!path) {
    path = anchor === null ? [] : nav.wander(anchor, steps, rng(key), minWidth)
    // Only as far as the round has time for.
    let len = 0
    const cut: XZ[] = path.slice(0, 1)
    for (let i = 1; i < path.length && len < reach; i++) {
      len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])
      cut.push(path[i])
    }
    path = cut
    if (routes.size > 400) routes.clear()
    routes.set(key, path)
  }
  return path
}

/**
 * A walker's way on the pavement: the route's line (down the middle of the
 * streets) moved to one side, to the pavement of each street (its half width
 * and a metre and a half), its corners mitred. Along the streets the traffic
 * drives, never closer to a crossroads' middle than 4.9 m nor further than
 * 7.3 m: the zebra crossings are drawn 4.8 to 7.6 m from it (meshes.ts), so
 * the street it meets is crossed on its zebra. The side kept off the roadway
 * where it can (a boulevard's two carriageways: one side of each is the
 * other); and a crossing that still falls off a zebra (a path, a lane meeting
 * a street between two crossroads) is moved along the kerb to the nearest
 * zebra: across there, and back along the other kerb. (Before, a fixed 4.5 m:
 * on a big road, in the traffic; at a crossroads, across the corner.)
 */
const PAVED = new WeakMap<XZ[], Map<number, XZ[]>>()
/** The roadway (a street the traffic drives on) a point is on, if any: its edge. */
export function roadwayAt(nav: Nav, x: number, z: number) {
  const n = nav.nearest([x, z], 9, 6)
  return n && !nav.edges[n.edge].walled && n.dist < nav.edges[n.edge].width / 2 - 0.2 ? n.edge : null
}
function offsetLine(nav: Nav, way: XZ[], side: number) {
  const segs: { a: XZ; u: XZ; n: XZ; o: number; len: number }[] = []
  for (let i = 1; i < way.length; i++) {
    const [a, b] = [way[i - 1], way[i]]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len < 0.2) continue
    const u: XZ = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
    const e = nav.nearest([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], 6)
    const w = e ? nav.edges[e.edge].width : 7
    const o = side * (w >= 6 ? Math.min(7.3, Math.max(4.9, w / 2 + 1.5)) : w / 2 + 1.5)
    segs.push({ a, u, n: [u[1], -u[0]], o, len })
  }
  if (!segs.length) return way
  const at = (k: number, d: number): XZ => {
    const g = segs[k]
    return [g.a[0] + g.u[0] * d + g.n[0] * g.o, g.a[1] + g.u[1] * d + g.n[1] * g.o]
  }
  const out: XZ[] = [at(0, 0)]
  for (let k = 1; k < segs.length; k++) {
    const [p, q] = [segs[k - 1], segs[k]]
    const cross = p.u[0] * q.u[1] - p.u[1] * q.u[0]
    const dot = p.u[0] * q.u[0] + p.u[1] * q.u[1]
    if (Math.abs(cross) > 0.08) {
      // The corner: where the two pavements' lines meet (unless that's far off: a hairpin, cut short).
      const [ax, az] = at(k - 1, 0)
      const [bx, bz] = at(k, 0)
      const t = ((bx - ax) * q.u[1] - (bz - az) * q.u[0]) / cross
      const c: XZ = [ax + p.u[0] * t, az + p.u[1] * t]
      if (Math.hypot(c[0] - q.a[0], c[1] - q.a[1]) < 14) {
        out.push(c)
        continue
      }
    }
    if (dot < -0.5) {
      out.push(at(k - 1, p.len), at(k, 0))
      continue
    }
    // Straight on into a street of another width: from one pavement's line to the other over a few metres.
    out.push(at(k - 1, p.len - Math.min(2, p.len / 3)), at(k, Math.min(2, q.len / 3)))
  }
  out.push(at(segs.length - 1, segs[segs.length - 1].len))
  return out
}
/** The line in steps of a metre, each step on a roadway or not. */
function sampled(nav: Nav, line: XZ[]) {
  const pts: { p: XZ; road: number | null }[] = []
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]]
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])))
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const p: XZ = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]
      pts.push({ p, road: roadwayAt(nav, p[0], p[1]) })
    }
  }
  return pts
}
/** Along road edge `e`: how far from its start a point is, and its way. */
function alongEdge(nav: Nav, e: number, p: XZ) {
  const [a, b] = [nav.nodes[nav.edges[e].a], nav.nodes[nav.edges[e].b]]
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const u: XZ = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
  return { a, u, len, t: (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1] }
}
/** Where on road edge `e` (metres from its start) the other streets cross or meet it: its zebras are 4.8 to 7.6 m either side. */
function crossingsOn(nav: Nav, e: number) {
  const { a, u, len } = alongEdge(nav, e, [0, 0])
  const out: number[] = []
  for (const f of nav.edges) {
    const [c, d] = [nav.nodes[f.a], nav.nodes[f.b]]
    if (Math.min(c[0], d[0]) > Math.max(a[0], a[0] + u[0] * len) + 1 || Math.max(c[0], d[0]) < Math.min(a[0], a[0] + u[0] * len) - 1) continue
    if (Math.min(c[1], d[1]) > Math.max(a[1], a[1] + u[1] * len) + 1 || Math.max(c[1], d[1]) < Math.min(a[1], a[1] + u[1] * len) - 1) continue
    const [vx, vz] = [d[0] - c[0], d[1] - c[1]]
    const den = u[0] * vz - u[1] * vx
    if (Math.abs(den) < 0.2 * Math.hypot(vx, vz)) continue
    const t = ((c[0] - a[0]) * vz - (c[1] - a[1]) * vx) / den
    const s = ((c[0] - a[0]) * u[1] - (c[1] - a[1]) * u[0]) / den
    if (t >= -0.5 && t <= len + 0.5 && s >= -0.02 && s <= 1.02) out.push(t)
  }
  return out
}
export function pavementLine(nav: Nav, way: XZ[], side: number): XZ[] {
  let bySide = PAVED.get(way)
  if (!bySide) PAVED.set(way, (bySide = new Map()))
  const kept = bySide.get(side)
  if (kept) return kept
  // The side with the less of it on a roadway, away from the crossroads (where it crosses).
  const nearNode = (p: XZ) => way.some((v) => Math.hypot(v[0] - p[0], v[1] - p[1]) < 9)
  const score = (pts: ReturnType<typeof sampled>) => pts.filter((q) => q.road !== null && !nearNode(q.p)).length
  let pts = sampled(nav, offsetLine(nav, way, side))
  if (score(pts) > 2) {
    const other = sampled(nav, offsetLine(nav, way, -side))
    if (score(other) < score(pts)) pts = other
  }
  // Each crossing of a roadway off its zebras: moved along the kerb to the nearest one.
  const out: XZ[] = []
  for (let i = 0; i < pts.length; ) {
    if (pts[i].road === null) {
      out.push(pts[i].p)
      i++
      continue
    }
    let j = i
    while (j + 1 < pts.length && pts[j + 1].road !== null) j++
    const run = pts.slice(i, j + 1)
    const e = run[Math.floor(run.length / 2)].road!
    const mid = run[Math.floor(run.length / 2)].p
    const { u, t } = alongEdge(nav, e, mid)
    const marks = crossingsOn(nav, e)
    const onZebra = marks.some((m) => Math.abs(t - m) >= 4.6 && Math.abs(t - m) <= 7.8)
    // Only a crossing (a few metres of roadway), not a stretch along it.
    if (!onZebra && marks.length && run.length <= 22) {
      const targets = marks.flatMap((m) => [m - 6.2, m + 6.2])
      const goal = targets.reduce((best, x) => (Math.abs(x - t) < Math.abs(best - t) ? x : best), targets[0])
      const shift = goal - t
      if (Math.abs(shift) < 35) {
        const [inn, outt] = [out.length ? out[out.length - 1] : run[0].p, j + 1 < pts.length ? pts[j + 1].p : run[run.length - 1].p]
        out.push([inn[0] + u[0] * shift, inn[1] + u[1] * shift], [outt[0] + u[0] * shift, outt[1] + u[1] * shift])
        i = j + 1
        continue
      }
    }
    for (const q of run) out.push(q.p)
    i = j + 1
  }
  // It stands at both ends of its round for a while: never on a roadway (a big crossroads' corner can be).
  while (out.length > 3 && roadwayAt(nav, ...out[out.length - 1]) !== null) out.pop()
  while (out.length > 3 && roadwayAt(nav, ...out[0]) !== null) out.shift()
  // (Back to a line of corners: the points in a straight row dropped.)
  const thin: XZ[] = []
  for (const p of out) {
    const [a, b] = [thin[thin.length - 2], thin[thin.length - 1]]
    if (a && b && Math.abs((b[0] - a[0]) * (p[1] - b[1]) - (b[1] - a[1]) * (p[0] - b[0])) < 0.05 * Math.hypot(p[0] - b[0], p[1] - b[1])) thin[thin.length - 1] = p
    else thin.push(p)
  }
  bySide.set(side, thin)
  return thin
}

