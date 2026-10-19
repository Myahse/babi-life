import { bridgeHeights, pointInRing, type XZ } from './geo'
import { deckTop } from './bridgeNames'
import { deckWidth, joinedEnds } from './bridgeLine'
import type { ChunkData } from './tiles'

// Getting around the open world: a graph of the real streets of the loaded
// chunks (Sims walk along them to a place, by the shortest way), and what
// stops a Sim walking freely (buildings, water).

const SNAP = 1.5 // metres: ends of a street cut by two chunks join up
const CELL = 24 // metres: spatial index cell

type Edge = { a: number; b: number; len: number; width: number; /** a bridge's deck, wider than its roadway */ deck?: number }

export class Nav {
  nodes: XZ[] = []
  /** Each node's height: 0 on the ground, up on a bridge. */
  ys: number[] = []
  adj: { to: number; len: number; width: number }[][] = []
  edges: Edge[] = []
  private nodeGrid = new Map<string, number[]>()
  private edgeGrid = new Map<string, number[]>()
  private blockGrid = new Map<string, XZ[][]>()
  private heights = new Map<XZ[], number>()
  private water: XZ[][][] = []

  constructor(chunks: ChunkData[], skipBuilding: (c: XZ) => boolean = () => false) {
    for (const ch of chunks) {
      const joined = joinedEnds(ch.roads)
      for (const r of ch.roads) {
        const ys = r.bridge ? bridgeHeights(r.pts, ch.box, deckTop(r.cls, r.name), joined) : undefined
        let prev = this.node(r.pts[0], ys?.[0])
        for (let i = 1; i < r.pts.length; i++) {
          const cur = this.node(r.pts[i], ys?.[i])
          if (cur !== prev) this.edge(prev, cur, r.width, r.bridge ? deckWidth(r, 0) : undefined)
          prev = cur
        }
      }
      for (const b of ch.buildings) {
        if (skipBuilding(b.c)) continue
        this.heights.set(b.ring, b.height)
        for (const k of this.cellsOf(b.ring)) {
          const list = this.blockGrid.get(k)
          if (list) list.push(b.ring)
          else this.blockGrid.set(k, [b.ring])
        }
      }
      for (const a of ch.areas) if (a.kind === 'water') this.water.push(a.rings)
    }
  }

  private key(x: number, z: number) {
    return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`
  }
  private node(p: XZ, y = 0) {
    const [cx, cz] = [Math.floor(p[0] / CELL), Math.floor(p[1] / CELL)]
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (const i of this.nodeGrid.get(`${cx + dx},${cz + dz}`) ?? []) {
          if (Math.hypot(this.nodes[i][0] - p[0], this.nodes[i][1] - p[1]) < SNAP) return i
        }
    const i = this.nodes.push(p) - 1
    this.ys.push(y)
    this.adj.push([])
    const k = this.key(p[0], p[1])
    const list = this.nodeGrid.get(k)
    if (list) list.push(i)
    else this.nodeGrid.set(k, [i])
    return i
  }
  private edge(a: number, b: number, width: number, deck?: number) {
    const len = Math.hypot(this.nodes[a][0] - this.nodes[b][0], this.nodes[a][1] - this.nodes[b][1])
    const e = this.edges.push({ a, b, len, width, deck }) - 1
    this.adj[a].push({ to: b, len, width })
    this.adj[b].push({ to: a, len, width })
    for (const k of this.cellsOf([this.nodes[a], this.nodes[b]])) {
      const list = this.edgeGrid.get(k)
      if (list) list.push(e)
      else this.edgeGrid.set(k, [e])
    }
  }
  private cellsOf(pts: XZ[]) {
    let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, z] of pts) [x0, z0, x1, z1] = [Math.min(x0, x), Math.min(z0, z), Math.max(x1, x), Math.max(z1, z)]
    const keys: string[] = []
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) keys.push(`${cx},${cz}`)
    return keys
  }

  /** The closest point on a street, within `radius` metres. */
  nearest(p: XZ, radius = 400): { at: XZ; edge: number; t: number; dist: number } | null {
    type Hit = { at: XZ; edge: number; t: number; dist: number }
    let best = null as Hit | null
    const [cx, cz] = [Math.floor(p[0] / CELL), Math.floor(p[1] / CELL)]
    for (let ring = 0; ring <= Math.ceil(radius / CELL); ring++) {
      for (let dx = -ring; dx <= ring; dx++)
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue
          for (const e of this.edgeGrid.get(`${cx + dx},${cz + dz}`) ?? []) {
            const { a, b } = this.edges[e]
            const [ax, az] = this.nodes[a]
            const [bx, bz] = this.nodes[b]
            const l2 = (bx - ax) ** 2 + (bz - az) ** 2
            const t = l2 ? Math.max(0, Math.min(1, ((p[0] - ax) * (bx - ax) + (p[1] - az) * (bz - az)) / l2)) : 0
            const at: XZ = [ax + (bx - ax) * t, az + (bz - az) * t]
            const dist = Math.hypot(at[0] - p[0], at[1] - p[1])
            if (!best || dist < best.dist) best = { at, edge: e, t, dist }
          }
        }
      // Anything found in this ring beats what the next ring could hold.
      if (best && best.dist <= ring * CELL) break
    }
    return best && best.dist <= radius ? best : null
  }

  /** How high the ground is here: up on a bridge's deck, else 0. */
  heightAt(x: number, z: number) {
    const n = this.nearest([x, z], 14)
    if (!n) return 0
    const e = this.edges[n.edge]
    if (n.dist > (e.deck ?? e.width) / 2 + 2) return 0
    const [ya, yb] = [this.ys[e.a], this.ys[e.b]]
    return ya || yb ? ya + (yb - ya) * n.t : 0
  }

  /** On a street (or a bridge): always walkable, even over water. */
  onRoad(p: XZ) {
    const n = this.nearest(p, 20)
    const e = n && this.edges[n.edge]
    return !!e && n.dist <= (e.deck ? e.deck / 2 - 0.4 : e.width / 2 + 1.5)
  }

  /** How high the building standing here goes (its roof and parapet), 0 in the open. */
  roofAt(x: number, z: number) {
    const p: XZ = [x, z]
    let h = 0
    for (const ring of this.blockGrid.get(this.key(x, z)) ?? []) if (pointInRing(p, ring)) h = Math.max(h, (this.heights.get(ring) ?? 0) + 1)
    return h
  }

  /** Can a Sim stand here? Not inside a building, not in the water. */
  walkable(x: number, z: number) {
    const p: XZ = [x, z]
    for (const ring of this.blockGrid.get(this.key(x, z)) ?? []) if (pointInRing(p, ring)) return false
    return !this.wet(x, z)
  }

  /**
   * In the water (and not on a bridge over it)? Known by half-metre squares:
   * the lagoon's outline is long, and a way on foot asks about thousands of
   * points next to each other.
   */
  private wetAt = new Map<number, boolean>()
  private wet(x: number, z: number) {
    const k = Math.round(x * 2) * 1e6 + Math.round(z * 2)
    let w = this.wetAt.get(k)
    if (w === undefined) {
      const p: XZ = [x, z]
      w = false
      for (const rings of this.water) {
        if (pointInRing(p, rings[0]) && !rings.slice(1).some((h) => pointInRing(p, h))) {
          w = !this.onRoad(p)
          break
        }
      }
      if (this.wetAt.size > 400000) this.wetAt.clear()
      this.wetAt.set(k, w)
    }
    return w
  }

  /** The shortest walk along the streets from a to b (A*), or null. */
  path(from: XZ, to: XZ): XZ[] | null {
    const s = this.nearest(from)
    const g = this.nearest(to)
    if (!s || !g) return null
    if (s.edge === g.edge) return [from, s.at, g.at, to]
    const N = this.nodes.length
    const START = N
    const GOAL = N + 1
    const es = this.edges[s.edge]
    const eg = this.edges[g.edge]
    const extra = (i: number): { to: number; len: number }[] => {
      if (i === START) return [{ to: es.a, len: es.len * s.t }, { to: es.b, len: es.len * (1 - s.t) }]
      const out: { to: number; len: number }[] = [...this.adj[i]]
      if (i === eg.a) out.push({ to: GOAL, len: eg.len * g.t })
      if (i === eg.b) out.push({ to: GOAL, len: eg.len * (1 - g.t) })
      return out
    }
    const pos = (i: number): XZ => (i === START ? s.at : i === GOAL ? g.at : this.nodes[i])
    const h = (i: number) => Math.hypot(pos(i)[0] - g.at[0], pos(i)[1] - g.at[1])
    const dist = new Map<number, number>([[START, 0]])
    const prev = new Map<number, number>()
    const open = new Heap()
    open.push(START, h(START))
    const done = new Set<number>()
    let steps = 0
    while (open.size) {
      const i = open.pop()
      if (i === GOAL) break
      if (done.has(i)) continue
      done.add(i)
      if (++steps > 60000) return null
      for (const { to: j, len } of extra(i)) {
        const d = dist.get(i)! + len
        if (d < (dist.get(j) ?? Infinity)) {
          dist.set(j, d)
          prev.set(j, i)
          open.push(j, d + h(j))
        }
      }
    }
    if (!prev.has(GOAL)) return null
    const way: XZ[] = [to]
    for (let i: number | undefined = GOAL; i !== undefined; i = prev.get(i)) way.push(pos(i))
    way.push(from)
    return way.reverse()
  }

  /** A random walk of a few streets from a node, for passers-by and cars (the same for the same `r`). */
  wander(from: number, steps: number, r: () => number, minWidth = 0): XZ[] {
    const way: XZ[] = [this.nodes[from]]
    let at = from
    let came = -1
    for (let k = 0; k < steps; k++) {
      // In a fixed order (by where they lead), not the order chunks loaded in:
      // the same seed takes the same walk on every player's phone.
      const next = this.adj[at].filter((e) => e.to !== came && e.width >= minWidth).sort((p, q) => this.nodes[p.to][0] - this.nodes[q.to][0] || this.nodes[p.to][1] - this.nodes[q.to][1])
      if (!next.length) break
      const e = next[Math.floor(r() * next.length)]
      came = at
      at = e.to
      way.push(this.nodes[at])
    }
    return way
  }
}

/** A small binary heap of (item, priority). */
class Heap {
  private items: number[] = []
  private prio: number[] = []
  get size() {
    return this.items.length
  }
  push(item: number, p: number) {
    this.items.push(item)
    this.prio.push(p)
    let i = this.items.length - 1
    while (i > 0) {
      const up = (i - 1) >> 1
      if (this.prio[up] <= this.prio[i]) break
      this.swap(i, up)
      i = up
    }
  }
  pop() {
    const top = this.items[0]
    const last = this.items.length - 1
    this.swap(0, last)
    this.items.pop()
    this.prio.pop()
    let i = 0
    for (;;) {
      const l = 2 * i + 1
      const r = l + 1
      let m = i
      if (l < this.items.length && this.prio[l] < this.prio[m]) m = l
      if (r < this.items.length && this.prio[r] < this.prio[m]) m = r
      if (m === i) break
      this.swap(i, m)
      i = m
    }
    return top
  }
  private swap(a: number, b: number) {
    ;[this.items[a], this.items[b]] = [this.items[b], this.items[a]]
    ;[this.prio[a], this.prio[b]] = [this.prio[b], this.prio[a]]
  }
}
