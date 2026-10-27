import * as THREE from 'three'
import type { ChunkData } from './tiles'
import { BRIDGE_HEIGHT, bridgeHeights, pointInRing, type XZ } from './geo'
import * as Three from 'three'

// One chunk's geometry, merged per material so a whole chunk is a handful
// of draw calls: walls, roofs, roads, pavements, water, grass, sand.

import { Builder } from './builder'
import { addBuilding, newBuildingBuilders, type Style } from './buildings'
import { BRIDGE_BUILD, bridgeKind, deckTop, type BridgeKind } from './bridgeNames'
import { deckWidth, joinedEnds, twinOffset } from './bridgeLine'

// Roads draw in order, the bigger on top where they meet.
const RANK: Record<string, number> = { motorway: 9, trunk: 8, primary: 7, secondary: 6, tertiary: 5, street: 4, street_limited: 3, service: 2, pedestrian: 2, track: 1, path: 0 }

export type ChunkMeshes = {
  walls: THREE.BufferGeometry | null
  shop: THREE.BufferGeometry | null
  inst: THREE.BufferGeometry | null
  entrance: THREE.BufferGeometry | null
  house: THREE.BufferGeometry | null
  trim: THREE.BufferGeometry | null
  roofs: THREE.BufferGeometry | null
  tin: THREE.BufferGeometry | null
  tinLow: THREE.BufferGeometry | null
  contact: THREE.BufferGeometry | null
  asphalt: THREE.BufferGeometry | null
  laterite: THREE.BufferGeometry | null
  pavement: THREE.BufferGeometry | null
  water: THREE.BufferGeometry | null
  foam: THREE.BufferGeometry | null
  paint: THREE.BufferGeometry | null
  kerb: THREE.BufferGeometry | null
  green: THREE.BufferGeometry | null
  sand: THREE.BufferGeometry | null
  pitch: THREE.BufferGeometry | null
}

/** A kerb: just its top and its two long sides (nobody sees the rest). */
function kerb(b: Builder, cx: number, cz: number, len: number, rot: number) {
  const [c, s] = [Math.cos(rot), Math.sin(rot)]
  const at = (u: number, v: number): [number, number] => [cx + u * c - v * s, cz + u * s + v * c]
  const [h, w] = [len / 2, 0.12]
  for (const side of [1, -1]) {
    const n: [number, number, number] = [-s * side, 0, c * side]
    const [p, q] = [at(-h, w * side), at(h, w * side)]
    const ids = [b.vertex(p[0], 0, p[1], 0, 0, n, KERB), b.vertex(q[0], 0, q[1], len, 0, n, KERB), b.vertex(q[0], 0.2, q[1], len, 0.2, n, KERB), b.vertex(p[0], 0.2, p[1], 0, 0.2, n, KERB)]
    b.facing(n, ids[0], ids[1], ids[2])
    b.facing(n, ids[0], ids[2], ids[3])
  }
  const n: [number, number, number] = [0, 1, 0]
  const ids = [at(-h, -w), at(h, -w), at(h, w), at(-h, w)].map(([x, z], k) => b.vertex(x, 0.2, z, k === 1 || k === 2 ? len : 0, k >= 2 ? 0.24 : 0, n, KERB))
  b.facing(n, ids[0], ids[1], ids[2])
  b.facing(n, ids[0], ids[2], ids[3])
}

// Road markings and kerbs. They stop short of the junctions (points shared
// by two roads), where they would paint across the other road.
const KERB = new Three.Color('#d9d3c7')
// The asphalt's dusty edges and its clean middle (they tint its texture).
const DUST = new Three.Color(1.45, 1.28, 1.05)
const CLEAN = new Three.Color(1, 1, 1)
const CLEAR = 8 // metres kept clear around a junction
function markings(chunk: ChunkData, paint: Builder, trim: Builder) {
  const key = ([x, z]: XZ) => `${Math.round(x * 2)},${Math.round(z * 2)}`
  const count = new Map<string, number>()
  for (const r of chunk.roads) for (const k of new Set(r.pts.map(key))) count.set(k, (count.get(k) ?? 0) + 1)
  const cell = (x: number, z: number) => `${Math.floor(x / 20)},${Math.floor(z / 20)}`
  const grid = new Map<string, XZ[]>()
  for (const r of chunk.roads)
    for (const p of r.pts)
      if ((count.get(key(p)) ?? 0) >= 2) {
        const c = cell(p[0], p[1])
        if (!grid.get(c)?.some((q) => q[0] === p[0] && q[1] === p[1])) grid.set(c, [...(grid.get(c) ?? []), p])
      }
  // Roads that cross without sharing a point cross all the same: find where.
  const segs: { a: XZ; b: XZ; r: number }[] = []
  chunk.roads.forEach((r, ri) => {
    for (let i = 1; i < r.pts.length; i++) segs.push({ a: r.pts[i - 1], b: r.pts[i], r: ri })
  })
  const bucket = new Map<string, number[]>()
  segs.forEach((sg, i) => {
    const [x0, x1] = [Math.min(sg.a[0], sg.b[0]), Math.max(sg.a[0], sg.b[0])]
    const [z0, z1] = [Math.min(sg.a[1], sg.b[1]), Math.max(sg.a[1], sg.b[1])]
    for (let cx = Math.floor(x0 / 40); cx <= Math.floor(x1 / 40); cx++)
      for (let cz = Math.floor(z0 / 40); cz <= Math.floor(z1 / 40); cz++) bucket.set(`${cx},${cz}`, [...(bucket.get(`${cx},${cz}`) ?? []), i])
  })
  for (const list of bucket.values())
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const [p, q] = [segs[list[i]], segs[list[j]]]
        if (p.r === q.r) continue
        const [dx1, dz1, dx2, dz2] = [p.b[0] - p.a[0], p.b[1] - p.a[1], q.b[0] - q.a[0], q.b[1] - q.a[1]]
        const den = dx1 * dz2 - dz1 * dx2
        if (Math.abs(den) < 1e-6) continue
        const t = ((q.a[0] - p.a[0]) * dz2 - (q.a[1] - p.a[1]) * dx2) / den
        const u = ((q.a[0] - p.a[0]) * dz1 - (q.a[1] - p.a[1]) * dx1) / den
        if (t < 0 || t > 1 || u < 0 || u > 1) continue
        const x: XZ = [p.a[0] + dx1 * t, p.a[1] + dz1 * t]
        const c = cell(x[0], x[1])
        if (!grid.get(c)?.some((g) => Math.hypot(g[0] - x[0], g[1] - x[1]) < 1)) grid.set(c, [...(grid.get(c) ?? []), x])
      }
  const junctions = [...grid.values()].flat()
  const nearJunction = (x: number, z: number) => {
    const [cx, cz] = [Math.floor(x / 20), Math.floor(z / 20)]
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of grid.get(`${cx + i},${cz + j}`) ?? []) if (Math.hypot(p[0] - x, p[1] - z) < CLEAR) return p
    return null
  }
  /**
   * The stretches of a piece of road (0 → len) clear of junctions, sampled
   * every 2 m, each cut into lengths of at most `max` (bridges: so a line
   * follows the deck's slope).
   */
  const clearRuns = (len: number, at: (d: number) => XZ, max: number): [number, number][] => {
    const out: [number, number][] = []
    let start = -1
    for (let d = 0; d <= len + 0.001; d += 2) {
      const x = Math.min(d, len)
      const p = at(x)
      const ok = !nearJunction(p[0], p[1])
      if (ok && start < 0) start = x
      if ((!ok || x >= len) && start >= 0) {
        const end = ok ? x : Math.max(start, x - 2)
        for (let s = start; s < end - 0.05; s += max) out.push([s, Math.min(end, s + max)])
        start = -1
      }
      if (x >= len) break
    }
    return out
  }
  const up: [number, number, number] = [0, 1, 0]
  /** A painted quad from a to b, `w` wide, set across by `off`. */
  const quad = (a: XZ, b: XZ, off: number, w: number, y: number) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len < 0.05) return
    const [nx, nz] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]
    const c = (p: XZ, s: number): [number, number] => [p[0] + nx * (off + (s * w) / 2), p[1] + nz * (off + (s * w) / 2)]
    const ids = [c(a, -1), c(b, -1), c(b, 1), c(a, 1)].map(([x, z]) => paint.vertex(x, y, z, 0, 0, up))
    paint.facing(up, ids[0], ids[1], ids[2])
    paint.facing(up, ids[0], ids[2], ids[3])
  }
  // (The markings on a bridge at the height of its deck: the same joins as the deck, below.)
  const onDeck = joinedEnds(chunk.roads)
  for (const r of chunk.roads) {
    const rank = RANK[r.cls] ?? 0
    if (!r.paved || rank < 4 || r.width < 6) continue
    const ys = r.bridge ? bridgeHeights(r.pts, chunk.box, deckTop(r.cls, r.name), onDeck) : undefined
    const base = 0.065 + rank * 0.002
    const lines: { off: number; w: number; dash: number; gap: number }[] =
      rank >= 7
        ? [{ off: -0.18, w: 0.14, dash: 1, gap: 0 }, { off: 0.18, w: 0.14, dash: 1, gap: 0 }, { off: -(r.width / 2 - 0.45), w: 0.16, dash: 1, gap: 0 }, { off: r.width / 2 - 0.45, w: 0.16, dash: 1, gap: 0 }]
        : rank >= 5
          ? [{ off: 0, w: 0.15, dash: 3, gap: 5 }]
          : []
    let run = 0
    for (let i = 1; i < r.pts.length; i++) {
      const [a, b] = [r.pts[i - 1], r.pts[i]]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (len < 0.05) continue
      const at = (d: number): XZ => [a[0] + ((b[0] - a[0]) * d) / len, a[1] + ((b[1] - a[1]) * d) / len]
      const yAt = (d: number) => base + (ys ? ys[i - 1] + ((ys[i] - ys[i - 1]) * d) / len : 0)
      // The lines, in pieces of 1 m (or dashes), skipping the junctions.
      for (const l of lines) {
        if (l.gap) {
          const step = l.dash + l.gap
          for (let d = (step - (run % step)) % step; d < len; d += step) {
            const e = Math.min(len, d + l.dash)
            const [p, q] = [at(d), at(e)]
            if (nearJunction(p[0], p[1]) || nearJunction(q[0], q[1])) continue
            quad(p, q, l.off, l.w, (yAt(d) + yAt(e)) / 2)
          }
        } else for (const [d, e] of clearRuns(len, at, ys ? 10 : len)) quad(at(d), at(e), l.off, l.w, (yAt(d) + yAt(e)) / 2)
      }
      // Kerbs along the pavement, off the bridges: one piece per clear stretch.
      if (!ys) {
        const rot = Math.atan2(b[1] - a[1], b[0] - a[0])
        const [nx, nz] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]
        for (const [d, e] of clearRuns(len, at, len)) {
          const [p, q] = [at(d), at(e)]
          const [mx, mz] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
          for (const s of [1, -1]) kerb(trim, mx + nx * s * (r.width / 2 + 0.12), mz + nz * s * (r.width / 2 + 0.12), e - d, rot)
        }
      }
      run += len
    }
    // Zebra crossings just before the junctions this road meets.
    if (!ys)
      for (let i = 1; i < r.pts.length; i++) {
        const [a, b] = [r.pts[i - 1], r.pts[i]]
        const len = Math.hypot(b[0] - a[0], b[1] - a[1])
        if (len < 1) continue
        const [ux, uz] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
        for (const j of junctions) {
          const t = (j[0] - a[0]) * ux + (j[1] - a[1]) * uz
          if (t < -0.5 || t > len + 0.5 || Math.abs((j[0] - a[0]) * uz - (j[1] - a[1]) * ux) > 0.6) continue
          for (const dir of [-1, 1]) {
            // Room on this side of the junction, along this piece of road.
            if ((dir < 0 ? t : len - t) < CLEAR) continue
            const at = (d: number): XZ => [j[0] + ux * dir * d, j[1] + uz * dir * d]
            for (let k = -r.width / 2 + 0.7; k <= r.width / 2 - 0.6; k += 1.1) quad(at(CLEAR - 3.2), at(CLEAR - 0.4), k * dir, 0.55, base)
          }
        }
      }
  }
}

/** Buildings the game draws itself (its places) are left out of the map's. */
export function buildChunk(chunk: ChunkData, skip: (c: XZ, ring: XZ[]) => boolean, styleOf: (b: ChunkData['buildings'][number]) => Style = (b) => b.style ?? 'default'): ChunkMeshes {
  const B = newBuildingBuilders()
  for (const b of chunk.buildings) if (!skip(b.c, b.ring)) addBuilding(B, b, styleOf(b))

  const asphalt = new Builder()
  const laterite = new Builder()
  const pavement = new Builder()
  /**
   * A ribbon of road along `pts`. `dusty` (the asphalt): its edges go
   * lighter, the dust of the verge blown onto it, fading out a metre in
   * (vertex colours: every vertex of that builder has one).
   */
  const strip = (to: Builder, pts: XZ[], w: number, y: number, scale: number, ys?: number[], dusty = false) => {
    // Round the corners where segments meet (not along a straight line), first:
    // the ribbon drawn after them covers them, they only fill the outside of a bend.
    pts.forEach(([x, z], i) => {
      if (i > 0 && i < pts.length - 1) {
        const [a, b] = [pts[i - 1], pts[i + 1]]
        const turn = Math.abs(Math.atan2(b[1] - z, b[0] - x) - Math.atan2(z - a[1], x - a[0]))
        if (Math.min(turn, Math.PI * 2 - turn) < 0.03) return
      }
      const ring: XZ[] = [...Array(8)].map((_, k) => [x + Math.cos((k * Math.PI) / 4) * (w / 2), z + Math.sin((k * Math.PI) / 4) * (w / 2)])
      to.flat([ring], y + (ys ? ys[i] : 0), scale, dusty ? DUST : undefined)
    })
    // Across the ribbon: its two edges, and with the dust, where it has faded out.
    const fade = Math.min(1, w * 0.18)
    const across: [number, THREE.Color | undefined][] = dusty
      ? [
          [-1, DUST],
          [-1 + (2 * fade) / w, CLEAN],
          [1 - (2 * fade) / w, CLEAN],
          [1, DUST],
        ]
      : [
          [-1, undefined],
          [1, undefined],
        ]
    for (let i = 1; i < pts.length; i++) {
      const [x1, z1] = pts[i - 1]
      const [x2, z2] = pts[i]
      const [y1, y2] = ys ? [y + ys[i - 1], y + ys[i]] : [y, y]
      const len = Math.hypot(x2 - x1, z2 - z1)
      if (len < 0.01) continue
      const [nx, nz] = [(-(z2 - z1) / len) * (w / 2), ((x2 - x1) / len) * (w / 2)]
      const up: [number, number, number] = [0, 1, 0]
      const at = (k: number) => {
        const [o, c] = across[k]
        return [to.vertex(x1 + nx * o, y1, z1 + nz * o, (x1 + nx * o) / scale, -(z1 + nz * o) / scale, up, c), to.vertex(x2 + nx * o, y2, z2 + nz * o, (x2 + nx * o) / scale, -(z2 + nz * o) / scale, up, c)]
      }
      for (let k = 1; k < across.length; k++) {
        const [a1, a2] = at(k - 1)
        const [b1, b2] = at(k)
        to.quad(b1, b2, a2, a1)
      }
    }
  }
  // A bridge: its deck's edges, the railings, the girder under it and its
  // piers in the water, built the way that bridge is (bridgeNames.ts).
  const CONCRETE = new Three.Color('#b4b2ad')
  const OLD = new Three.Color('#a9a49a')
  const RAILING = new Three.Color('#e9ecef')
  const GALLERY = new Three.Color('#2c2a28')
  const STUD = new Three.Color('#fff3bf')
  const LAMP = new Three.Color('#8d939b')
  const waters = chunk.areas.filter((a) => a.kind === 'water')
  const inWater = (x: number, z: number) => waters.some((a) => pointInRing([x, z], a.rings[0]) && !a.rings.slice(1).some((h) => pointInRing([x, z], h)))
  /** twin: which side the other carriageway is (+1 left, -1 right), 0 when the deck is all one. */
  const bridge = (pts: XZ[], w: number, ys: number[], kind: BridgeKind | null, twin = 0) => {
    const how = BRIDGE_BUILD[kind ?? 'default']
    const stone = kind === 'fhb' ? OLD : CONCRETE
    const top = Math.max(...ys) // the deck's height (a flyover's is higher)
    let run = 0
    for (let i = 1; i < pts.length; i++) {
      const [x1, z1] = pts[i - 1]
      const [x2, z2] = pts[i]
      const len = Math.hypot(x2 - x1, z2 - z1)
      if (len < 0.01) continue
      const rot = Math.atan2(z2 - z1, x2 - x1)
      const [nx, nz] = [-(z2 - z1) / len, (x2 - x1) / len]
      const ym = (ys[i - 1] + ys[i]) / 2
      if (ym < 0.6) {
        run += len
        continue
      }
      const [mx, mz] = [(x1 + x2) / 2, (z1 + z2) / 2]
      // Over land, the low end of a ramp stands on an embankment (higher up it
      // stays on piers: a flyover crosses a road there).
      if (ym < Math.min(top, BRIDGE_HEIGHT) * 0.7 && !inWater(mx, mz)) {
        B.trim.box(mx, (ym - 0.9) / 2, mz, len + 0.05, ym - 0.9, w - 0.2, rot, stone.clone().multiplyScalar(0.92))
        run += len
        continue
      }
      // The girder, down to where it can go above the water (and the ramps).
      const g = Math.min(how.girder, ym - 0.4)
      for (const s of [1, -1]) {
        B.trim.box(mx + nx * s * (w / 2), ym - 0.45, mz + nz * s * (w / 2), len, 0.9, 0.3, rot, stone)
        // the railing
        B.trim.box(mx + nx * s * (w / 2 - 0.1), ym + 0.55, mz + nz * s * (w / 2 - 0.1), len, 0.12, 0.12, rot, RAILING)
        B.trim.box(mx + nx * s * (w / 2 - 0.1), ym + 0.3, mz + nz * s * (w / 2 - 0.1), len, 0.5, 0.05, rot, stone)
      }
      const under = stone.clone().multiplyScalar(0.8)
      if (how.twin) {
        // Two box girders side by side, a gap between them (the HKB).
        for (const s of [1, -1]) B.trim.box(mx + nx * s * (w / 4), ym - 0.9 - g / 2, mz + nz * s * (w / 4), len, g, w / 2 - 1.4, rot, under)
      } else if (how.beams) {
        // Precast prestressed beams side by side under a thin slab (the 2e pont).
        B.trim.box(mx, ym - 1.1, mz, len, 0.4, w - 0.6, rot, under)
        for (let k = -2; k <= 2; k++) B.trim.box(mx + nx * k * (w / 5.5), ym - 1.3 - (g - 0.4) / 2, mz + nz * k * (w / 5.5), len, g - 0.4, 0.5, rot, under)
      } else if (how.rail && g > 1.6) {
        // The FHB: the road on the top slab, the railway on the bottom one,
        // the gallery between them open to the lagoon (the train shows).
        B.trim.box(mx, ym - 1.2, mz, len, 0.6, w - 0.6, rot, under)
        B.trim.box(mx, ym - 0.9 - g + 0.3, mz, len, 0.6, w - 0.6, rot, under)
        // The track on the bottom slab: ballast and rails.
        B.trim.box(mx, ym - 0.9 - g + 0.65, mz, len, 0.1, 2.6, rot, GALLERY)
        for (let d = 3; d < len; d += 6) {
          const [px, pz] = [x1 + ((x2 - x1) * d) / len, z1 + ((z2 - z1) * d) / len]
          for (const s of [1, -1]) B.trim.box(px + nx * s * (w / 2 - 0.5), ym - 0.9 - g / 2, pz + nz * s * (w / 2 - 0.5), 0.6, g - 1.2, 0.6, rot, under)
        }
      } else {
        B.trim.box(mx, ym - 0.9 - g / 2, mz, len, g, w - 0.6, rot, under)
      }
      // A concrete barrier down the middle, between the two directions (with two carriageways: on the inner edge).
      const mid = twin * (w / 2 - 0.3)
      if (how.median) B.trim.box(mx + nx * mid, ym + 0.4, mz + nz * mid, len, 0.8, 0.5, rot, RAILING.clone().multiplyScalar(0.92))
      // Light studs along both edges, every 4 m.
      if (how.studs)
        for (let d = 2; d < len; d += 4) {
          const [px, pz] = [x1 + ((x2 - x1) * d) / len, z1 + ((z2 - z1) * d) / len]
          for (const s of [1, -1]) B.trim.box(px + nx * s * (w / 2 - 2.2), ym + 0.1, pz + nz * s * (w / 2 - 2.2), 0.3, 0.12, 0.3, rot, STUD)
        }
      // Lamp posts, alternating sides (on the median when there is one).
      if (how.lamps)
        for (let d = Math.ceil(run / how.lamps) * how.lamps - run; d < len; d += how.lamps) {
          const [px, pz] = [x1 + ((x2 - x1) * d) / len, z1 + ((z2 - z1) * d) / len]
          const side = twin || (how.median ? 0 : Math.round((run + d) / how.lamps) % 2 ? 1 : -1)
          const [lx, lz] = [px + nx * side * (w / 2 - 0.4), pz + nz * side * (w / 2 - 0.4)]
          B.trim.box(lx, ym + 4.8, lz, 0.25, 9.6, 0.25, rot, LAMP)
          for (const arm of how.median && !twin ? [1, -1] : [-side]) B.trim.box(lx + nx * arm * 1.3, ym + 9.5, lz + nz * arm * 1.3, 0.35, 0.2, 2.6, rot, LAMP)
        }
      // The piers, every span, down into the lagoon.
      for (let d = Math.ceil(run / how.span) * how.span - run; d < len; d += how.span) {
        const t = d / len
        const h = ys[i - 1] + (ys[i] - ys[i - 1]) * t - 0.9 - g
        if (h < 0.8) continue
        const [px, pz] = [x1 + (x2 - x1) * t, z1 + (z2 - z1) * t]
        const pier = stone.clone().multiplyScalar(0.85)
        const top = h
        const foot = -4
        if (how.pier === 'wall') B.trim.box(px, (top + foot) / 2, pz, 1.6, top - foot, w * 0.75, rot, pier)
        else {
          // A crosshead under the girders, on columns.
          B.trim.box(px, top - 0.7, pz, 2.2, 1.4, w * 0.9, rot, pier)
          const cols = how.pier === 'round' ? [0] : [-w / 4, w / 4]
          for (const o of cols) {
            const [cx, cz] = [px + nx * o, pz + nz * o]
            if (how.pier === 'twin-square') B.trim.box(cx, (top - 1.4 + foot) / 2, cz, 1.4, top - 1.4 - foot, 1.4, rot, pier)
            else B.trim.cylinder(cx, foot, cz, how.pier === 'round' ? 1.3 : 1, top - 1.4 - foot, pier)
          }
        }
      }
      run += len
    }
  }
  const paint = new Builder()
  // Where two bridge pieces meet mid-lagoon the deck goes on (it doesn't ramp down to the water).
  const joined = joinedEnds(chunk.roads)
  for (const r of [...chunk.roads].sort((a, b) => (RANK[a.cls] ?? 0) - (RANK[b.cls] ?? 0))) {
    const rank = RANK[r.cls] ?? 0
    const ys = r.bridge ? bridgeHeights(r.pts, chunk.box, deckTop(r.cls, r.name), joined) : undefined
    // One of a big bridge's two one-way carriageways: half the deck each, side by side.
    const kind = r.bridge ? bridgeKind(r.name) : null
    const twin = kind && BRIDGE_BUILD[kind].median ? Math.sign(twinOffset(r.pts, chunk.roads.filter((o) => o !== r && o.bridge && bridgeKind(o.name) === kind).map((o) => o.pts))) : 0
    const deck = ys ? deckWidth(r, twin) : 0
    if (r.paved) {
      // A pavement on each side of the bigger streets (and on bridges).
      if (rank >= 4 || ys) strip(pavement, r.pts, ys ? deck : r.width + 3.2, 0.03, 2, ys)
      strip(asphalt, r.pts, r.width, 0.05 + rank * 0.002, 4, ys, true)
    } else strip(laterite, r.pts, r.width, 0.04, 3, ys)
    if (ys) bridge(r.pts, deck, ys, kind, twin)
  }
  const kerbs = new Builder()
  markings(chunk, paint, kerbs)

  const water = new Builder()
  const green = new Builder()
  const sand = new Builder()
  const pitch = new Builder()
  for (const a of chunk.areas) {
    const [to, y, scale] = a.kind === 'water' ? [water, 0.02, 4] : a.kind === 'green' || a.kind === 'campus' || a.kind === 'airport' ? [green, a.kind === 'campus' ? 0.008 : a.kind === 'airport' ? 0.006 : 0.012, 2] : a.kind === 'sand' ? [sand, 0.014, 2] : a.kind === 'hospital' ? [pavement, 0.009, 2] : a.kind === 'apron' ? [pavement, 0.018, 3] : [pitch, 0.016, 2]
    to.flat(a.rings, y as number, scale as number)
  }

  // Runways and taxiways: wide asphalt and their white paint (the centre
  // line in dashes, the edges of a runway).
  const along = (pts: XZ[], off: number) =>
    pts.map(([x, z], i) => {
      const [a, b] = [pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      return [x - ((b[1] - a[1]) / l) * off, z + ((b[0] - a[0]) / l) * off] as XZ
    })
  for (const w of chunk.aeroways) {
    const runway = w.cls === 'runway'
    strip(asphalt, w.pts, runway ? 45 : 20, runway ? 0.055 : 0.052, 4, undefined, true)
    if (runway) for (const off of [-20.5, 20.5]) strip(paint, along(w.pts, off), 0.9, 0.07, 4)
    // The centre line, in dashes.
    for (let i = 1; i < w.pts.length; i++) {
      const [a, b] = [w.pts[i - 1], w.pts[i]]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      const [dash, gap] = runway ? [30, 20] : [l, 0]
      for (let t = 0; t < l; t += dash + gap) {
        const e = Math.min(l, t + dash)
        strip(paint, [[a[0] + ((b[0] - a[0]) * t) / l, a[1] + ((b[1] - a[1]) * t) / l], [a[0] + ((b[0] - a[0]) * e) / l, a[1] + ((b[1] - a[1]) * e) / l]], runway ? 0.9 : 0.4, 0.07, 4)
      }
    }
  }

  // Foam where the water meets the land: the waves on the beaches and the
  // lagoon lapping at its banks. Not along the tile's edges, where the water
  // only goes on into the next chunk. (Far tiles are too far to see it.)
  const foam = new Builder()
  if (!chunk.key.includes(':')) {
    const b = chunk.box
    const onEdge = ([x, z]: XZ) => Math.min(Math.abs(x - b.x0), Math.abs(x - b.x1), Math.abs(z - b.z0), Math.abs(z - b.z1)) < 0.5
    for (const a of chunk.areas) {
      if (a.kind !== 'water') continue
      for (const ring of a.rings) {
        let along = 0
        for (let i = 0; i < ring.length; i++) {
          const [x1, z1] = ring[i]
          const [x2, z2] = ring[(i + 1) % ring.length]
          const len = Math.hypot(x2 - x1, z2 - z1)
          if (len < 0.01 || (onEdge(ring[i]) && onEdge(ring[(i + 1) % ring.length]))) continue
          const [nx, nz] = [(-(z2 - z1) / len) * 1.6, ((x2 - x1) / len) * 1.6]
          const up: [number, number, number] = [0, 1, 0]
          const p = [
            [x1 + nx, z1 + nz, along, 0],
            [x2 + nx, z2 + nz, along + len, 0],
            [x2 - nx, z2 - nz, along + len, 1],
            [x1 - nx, z1 - nz, along, 1],
          ].map(([x, z, u, v]) => foam.vertex(x, 0.035, z, u / 8, v, up))
          foam.quad(p[0], p[1], p[2], p[3])
          along += len
        }
      }
    }
  }

  return {
    walls: B.walls.geometry(),
    shop: B.shop.geometry(),
    inst: B.inst.geometry(),
    entrance: B.entrance.geometry(),
    house: B.house.geometry(),
    trim: B.trim.geometry(),
    roofs: B.roofs.geometry(),
    tin: B.tin.geometry(),
    tinLow: B.tinLow.geometry(),
    contact: B.contact.geometry(),
    asphalt: asphalt.geometry(),
    laterite: laterite.geometry(),
    pavement: pavement.geometry(),
    water: water.geometry(),
    foam: foam.geometry(),
    paint: paint.geometry(),
    kerb: kerbs.geometry(),
    green: green.geometry(),
    sand: sand.geometry(),
    pitch: pitch.geometry(),
  }
}
