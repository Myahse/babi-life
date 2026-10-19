import { BRIDGE_BUILD, bridgeKind, deckTop, type BridgeKind } from './bridgeNames'
import type { XZ } from './geo'
import type { ChunkData, Road } from './tiles'

// A big bridge as one line down the middle of its deck, for what stands and
// moves on it (the 5e pont's pylon, the traffic, the people on the
// pavements). The map has a bridge in pieces: cut by the chunks, split where
// a name or a lane count changes, and often as two one-way carriageways side
// by side. The pieces are chained end to end, the line moved halfway over to
// the other carriageway when there is one, and the deck's height worked out
// along the whole line (it only ramps down at the real ends, not where two
// pieces meet in the middle of the lagoon).

export type P = { x: number; y: number; z: number }
export type Way = { pts: P[]; cum: number[]; len: number }

const RAMP = 60
const JOIN = 2.5 // metres: two pieces' ends this close are one bridge going on

/** Where a bridge piece's end meets another bridge piece (not a real end of the bridge). */
export function joinedEnds(roads: Road[]): (p: XZ) => boolean {
  const ends: XZ[] = []
  for (const r of roads) if (r.bridge) ends.push(r.pts[0], r.pts[r.pts.length - 1])
  return (p) => ends.filter((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < JOIN).length > 1
}

/**
 * A carriageway's twin: the other one-way roadway of the same bridge, side
 * by side with it. Its offset across (metres, + on the left of the piece's
 * way), or 0 when there's none.
 */
export function twinOffset(pts: XZ[], others: XZ[][]): number {
  const found: number[] = []
  for (let i = 1; i < pts.length; i++) {
    const [x1, z1] = pts[i - 1]
    const [x2, z2] = pts[i]
    const len = Math.hypot(x2 - x1, z2 - z1)
    if (len < 1) continue
    const [tx, tz] = [(x2 - x1) / len, (z2 - z1) / len]
    const [mx, mz] = [(x1 + x2) / 2, (z1 + z2) / 2]
    let best = Infinity
    let side = 0
    for (const o of others)
      for (let j = 1; j < o.length; j++) {
        const [ax, az] = o[j - 1]
        const [bx, bz] = o[j]
        const l = Math.hypot(bx - ax, bz - az)
        if (l < 1 || Math.abs(((bx - ax) * tx + (bz - az) * tz) / l) < 0.85) continue // not parallel
        const t = Math.max(0, Math.min(1, ((mx - ax) * (bx - ax) + (mz - az) * (bz - az)) / (l * l)))
        const [px, pz] = [ax + (bx - ax) * t, az + (bz - az) * t]
        const d = Math.hypot(px - mx, pz - mz)
        if (d < best) [best, side] = [d, -tz * (px - mx) + tx * (pz - mz)]
      }
    if (best >= 5 && best <= 45) found.push(side)
  }
  // Alongside for at least a third of the way: a twin; its typical offset.
  if (found.length < Math.max(1, (pts.length - 1) / 3)) return 0
  found.sort((a, b) => a - b)
  return found[Math.floor(found.length / 2)]
}

/** The bridge `kind` as one line down the middle of its deck, from the loaded chunks, or null. */
export function bridgeWay(chunks: ChunkData[], kind: BridgeKind): Way | null {
  type Piece = { pts: XZ[]; cut: [boolean, boolean]; top: number }
  const pieces: Piece[] = []
  for (const c of chunks) {
    const b = c.box
    const cut = ([x, z]: XZ) => Math.min(Math.abs(x - b.x0), Math.abs(x - b.x1), Math.abs(z - b.z0), Math.abs(z - b.z1)) < 0.5
    for (const r of c.roads)
      if (r.bridge && bridgeKind(r.name) === kind) pieces.push({ pts: r.pts, cut: [cut(r.pts[0]), cut(r.pts[r.pts.length - 1])], top: deckTop(r.cls, r.name) })
  }
  if (!pieces.length) return null
  const length = (p: XZ[]) => p.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0)
  pieces.sort((a, b) => length(b.pts) - length(a.pts))
  // Chain from the longest; an end is cut (the bridge goes on in a chunk not loaded) or joined on.
  const first = pieces.shift()!
  let line = first.pts
  let cut = first.cut
  const top = first.top
  const close = (a: XZ, b: XZ) => Math.hypot(a[0] - b[0], a[1] - b[1]) < JOIN
  for (let grew = true; grew; ) {
    grew = false
    for (let i = 0; i < pieces.length; i++) {
      const q = pieces[i]
      const [h, t] = [line[0], line[line.length - 1]]
      const [q0, q1] = [q.pts[0], q.pts[q.pts.length - 1]]
      const rev = [...q.pts].reverse()
      if (close(t, q0)) [line, cut] = [[...line, ...q.pts.slice(1)], [cut[0], q.cut[1]]]
      else if (close(t, q1)) [line, cut] = [[...line, ...rev.slice(1)], [cut[0], q.cut[0]]]
      else if (close(h, q1)) [line, cut] = [[...q.pts, ...line.slice(1)], [q.cut[0], cut[1]]]
      else if (close(h, q0)) [line, cut] = [[...rev, ...line.slice(1)], [q.cut[1], cut[1]]]
      else continue
      pieces.splice(i, 1)
      grew = true
      break
    }
  }
  // The other carriageway (left over, side by side): the middle of the deck is halfway to it.
  const shift = twinOffset(line, pieces.map((p) => p.pts)) / 2
  const pts: XZ[] = line.map((p, i) => {
    const a = line[Math.max(0, i - 1)]
    const b = line[Math.min(line.length - 1, i + 1)]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [p[0] - ((b[1] - a[1]) / l) * shift, p[1] + ((b[0] - a[0]) / l) * shift]
  })
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const len = cum[cum.length - 1]
  if (len <= 80) return null
  const ramp = Math.max(RAMP, top * 7)
  const ease = (t: number) => t * t * (3 - 2 * t)
  return {
    pts: pts.map(([x, z], i) => {
      let k = 1
      if (!cut[0]) k = Math.min(k, cum[i] / ramp)
      if (!cut[1]) k = Math.min(k, (len - cum[i]) / ramp)
      return { x, y: top * ease(Math.max(0, Math.min(1, k))), z }
    }),
    cum,
    len,
  }
}

/** Where s metres along the way is, its height, and which way it runs there. */
export function wayAt(w: Way, s: number) {
  s = Math.max(0, Math.min(w.len - 0.01, s))
  let i = 1
  while (i < w.cum.length - 1 && w.cum[i] < s) i++
  const [a, b] = [w.pts[i - 1], w.pts[i]]
  const seg = w.cum[i] - w.cum[i - 1] || 1
  const t = (s - w.cum[i - 1]) / seg
  const [dx, dz] = [(b.x - a.x) / seg, (b.z - a.z) / seg]
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, dx, dz }
}

/** How wide the deck is drawn for a piece: half the bridge for one of two carriageways. */
export function deckWidth(r: Road, twin: number) {
  const full = Math.max(r.width + 3.2, BRIDGE_BUILD[bridgeKind(r.name) ?? 'default'].width ?? 0)
  return twin ? Math.max(r.width + 3.2, full / 2 + 1) : full
}
