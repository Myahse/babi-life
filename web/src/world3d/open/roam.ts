import { rng } from '../themes'
import type { XZ } from './geo'
import type { Nav } from './nav'

// The people and the cars of a commune, each one somebody: they go on through the streets, crossroads
// after crossroads, never back and forth along the same bit of road, never gone out of sight to come back
// from nowhere. A roamer is where it is because of where it was: the same taxi, the same passer-by, met
// again further on, or coming back round the block. Only the near ones are drawn (OpenWorld's traffic,
// the passers-by); the others go on all the same.

/** A street node, found again by where it is: the graph is rebuilt as the map's tiles come in (new indexes). */
const nodeKeys = new WeakMap<Nav, Map<string, number>>()
const keyOf = (p: XZ) => `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`
function nodeAt(nav: Nav, p: XZ): number | undefined {
  let m = nodeKeys.get(nav)
  if (!m) {
    m = new Map()
    nav.nodes.forEach((n, i) => m!.set(keyOf(n), i))
    nodeKeys.set(nav, m)
  }
  return m.get(keyOf(p))
}
const angle = (from: XZ, to: XZ) => Math.atan2(to[0] - from[0], to[1] - from[1])
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

export type RoamKind = { /** the narrowest street it takes (m): 7 for the cars, 0 on foot */ minWidth: number }

/** How far before and after a crossroads the turn is eased (m). */
const BEND = 4

export class Roamer {
  /** The bit of street it's on: from `a` to `b`, `d` metres along; `c`, where it goes after `b`. */
  a: XZ = [0, 0]
  b: XZ = [0, 0]
  c: XZ | null = null
  len = 1
  width = 8
  d = 0
  /** The heading of the bit of street before this one (its turn eased out of it). */
  before = 0
  private rand: () => number
  constructor(
    readonly id: string,
    readonly kind: RoamKind,
    nav: Nav,
    seed: string,
  ) {
    this.rand = rng(`roam|${seed}|${id}`)
    this.place(nav)
  }

  /** Somewhere on the streets it takes, by its own luck. */
  place(nav: Nav) {
    const ok = nav.edges.filter((e) => e.width >= this.kind.minWidth && !nav.ys[e.a] && !nav.ys[e.b])
    if (!ok.length) return
    const e = ok[Math.floor(this.rand() * ok.length)]
    const fwd = this.rand() < 0.5
    this.set(nav, nav.nodes[fwd ? e.a : e.b], nav.nodes[fwd ? e.b : e.a], e.len, e.width)
    this.d = this.rand() * this.len
    this.before = angle(this.a, this.b)
  }

  private set(nav: Nav, a: XZ, b: XZ, len: number, width: number) {
    this.a = a
    this.b = b
    this.len = Math.max(0.5, len)
    this.width = width
    this.d = 0
    this.c = this.choose(nav, a, b)
  }

  /** At `b`, coming from `a`: the next street, mostly straight on, never back (but at a dead end). */
  private choose(nav: Nav, a: XZ, b: XZ): XZ | null {
    const n = nodeAt(nav, b)
    if (n === undefined) return null
    const back = keyOf(a)
    const ways = nav.adj[n].filter((w) => w.width >= this.kind.minWidth && !w.walled && keyOf(nav.nodes[w.to]) !== back)
    if (!ways.length) return a
    if (ways.length === 1) return nav.nodes[ways[0].to]
    const heading = angle(a, b)
    const weights = ways.map((w) => {
      const turn = Math.abs(wrap(angle(b, nav.nodes[w.to]) - heading))
      return (turn < 0.5 ? 3 : turn < 1.9 ? 1.2 : 0.3) * (w.width >= 9 ? 1.4 : 1)
    })
    let u = this.rand() * weights.reduce((s, x) => s + x, 0)
    return nav.nodes[ways[Math.max(0, weights.findIndex((x) => (u -= x) < 0))].to]
  }

  /** Where it is, and which way it goes (eased round the crossroads). */
  get at(): { x: number; z: number; r: number } {
    const k = Math.min(1, this.d / this.len)
    const r = angle(this.a, this.b)
    let h = r
    const toEnd = this.len - this.d
    if (this.c && toEnd < BEND) h = r + wrap(angle(this.b, this.c) - r) * 0.5 * (1 - toEnd / BEND)
    else if (this.d < BEND) h = this.before + wrap(r - this.before) * (0.5 + 0.5 * (this.d / BEND))
    return { x: this.a[0] + (this.b[0] - this.a[0]) * k, z: this.a[1] + (this.b[1] - this.a[1]) * k, r: h }
  }

  /** On by `dist` metres, crossroads after crossroads. */
  advance(nav: Nav, dist: number) {
    this.d += dist
    for (let guard = 0; this.d >= this.len && guard < 20; guard++) {
      const over = this.d - this.len
      const was = angle(this.a, this.b)
      const n = this.c ? nodeAt(nav, this.b) : undefined
      const to = this.c && n !== undefined ? nav.adj[n].find((w) => keyOf(nav.nodes[w.to]) === keyOf(this.c!)) : undefined
      if (to) this.set(nav, this.b, this.c!, to.len, to.width)
      else this.rejoin(nav)
      this.before = was
      this.d = over
    }
  }

  /** The graph changed under it (tiles came in or went): onto the nearest street it takes, from where it is. */
  private rejoin(nav: Nav) {
    const at = this.at
    const near = nav.nearest([at.x, at.z], 80, this.kind.minWidth)
    if (!near) return this.place(nav)
    const e = nav.edges[near.edge]
    const fwd = Math.cos(angle(nav.nodes[e.a], nav.nodes[e.b]) - at.r) >= 0
    this.set(nav, nav.nodes[fwd ? e.a : e.b], nav.nodes[fwd ? e.b : e.a], e.len, e.width)
    this.d = (fwd ? near.t : 1 - near.t) * this.len
  }
}

/** How many a commune's streets hold, by their length: so many per metre, up to `max`. */
export function howMany(nav: Nav, kind: RoamKind, perMetre: number, max: number) {
  let total = 0
  for (const e of nav.edges) if (e.width >= kind.minWidth) total += e.len
  return Math.min(max, Math.round(total * perMetre))
}
