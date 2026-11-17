import * as THREE from 'three'
import type { Builder } from './builder'
import { hash, type XZ } from './geo'
import { BLOCK } from './tiles'
import { normal, wallRuns } from './buildings'

// « Façades réalistes » (facades.ts): the small things on the walls of the chunks round the view,
// built with the chunk (in the worker) into two meshes a square of the chunk (cells.ts): `facade`
// (drawn on « normal » and « haute ») and `facade2` (the extras of « haute »). Each is a box whose
// faces read a cell of one atlas (facadeAtlas.ts propsAtlas): the AC units with their fan and their
// drain pipe, the claustra of the balconies, the shops' signs with their invented names, blade signs,
// dishes, downpipes. A few dozen triangles a building, one draw a square.

/** The props' atlas: PROP_SIZE texels square, cells of PROP_CELL; the first three rows are signs SIGN_W wide. */
export const PROP_SIZE = 512
export const PROP_CELL = 32
export const SIGN_W = 128
export const SIGNS_N = 12
/** Where each prop's picture is in the atlas (column, row of cells). */
export const PROP = {
  acFront: [0, 3],
  white: [1, 3],
  claustra: [2, 3],
  metal: [3, 3],
  dish: [4, 3],
  cage: [5, 3],
  blade: [6, 3],
  cross: [7, 3],
  cabine: [8, 3],
  wood: [9, 3],
  slab: [10, 3],
  stripes: [11, 3],
  stripes2: [12, 3],
} as const
/** A rectangle of the atlas, as u0, v0, u1, v1 (half a texel in from its edges). */
export type UvRect = [number, number, number, number]
const rectOf = (x: number, y: number, w: number, h: number): UvRect => {
  const e = 0.5
  return [(x + e) / PROP_SIZE, 1 - (y + h - e) / PROP_SIZE, (x + w - e) / PROP_SIZE, 1 - (y + e) / PROP_SIZE]
}
export const cellUv = (cell: readonly [number, number]) => rectOf(cell[0] * PROP_CELL, cell[1] * PROP_CELL, PROP_CELL, PROP_CELL)
export const signUv = (i: number) => rectOf((i % 4) * SIGN_W, Math.floor(i / 4) * PROP_CELL, SIGN_W, PROP_CELL)

const WHITE = new THREE.Color('#ffffff')
const UV_WHITE = cellUv(PROP.white)
const UV_METAL = cellUv(PROP.metal)

/**
 * A box against a wall, its front (local +z) facing out along the wall's normal `n`, its width along
 * the wall: the front face reads `front`, the others `rest`. `c` tints it (vertex colour).
 */
export function wallBox(b: Builder, cx: number, cy: number, cz: number, w: number, h: number, d: number, n: XZ, front: UvRect, rest: UvRect = UV_WHITE, c: THREE.Color = WHITE) {
  // (Along the wall to the right of someone facing it: the atlas reads left to right.)
  const [ux, uz] = [n[1], -n[0]]
  const [hx, hy, hz] = [w / 2, h / 2, d / 2]
  const P = (a: number, y: number, o: number): [number, number, number] => [cx + ux * a + n[0] * o, cy + y, cz + uz * a + n[1] * o]
  const face = (nrm: [number, number, number], q: [number, number, number][], uv: UvRect) => {
    const [u0, v0, u1, v1] = uv
    const ids = [b.vertex(...q[0], u0, v0, nrm, c), b.vertex(...q[1], u1, v0, nrm, c), b.vertex(...q[2], u1, v1, nrm, c), b.vertex(...q[3], u0, v1, nrm, c)]
    b.facing(nrm, ids[0], ids[1], ids[2])
    b.facing(nrm, ids[0], ids[2], ids[3])
  }
  const out: [number, number, number] = [n[0], 0, n[1]]
  const back: [number, number, number] = [-n[0], 0, -n[1]]
  const right: [number, number, number] = [ux, 0, uz]
  const left: [number, number, number] = [-ux, 0, -uz]
  face(out, [P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)], front)
  face(back, [P(hx, -hy, -hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz)], rest)
  face(right, [P(hx, -hy, hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz)], rest)
  face(left, [P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz)], rest)
  face([0, 1, 0], [P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), P(-hx, hy, -hz)], rest)
  face([0, -1, 0], [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz)], rest)
}

/** What dressWalls needs to know of a building (worked out by addBuilding). */
export type Dress = { H: number; c: XZ; shops: boolean; pitched: boolean; kind: string | undefined }

/** Which sign a shop gets, by what the place is (when the game knows), else by the building. */
const SIGN_OF: Record<string, number> = { boutique: 2, pharmacie: 4, barbier: 5, salon: 5, couture: 6, maquis: 11, restaurant: 9, market: 2 }

/**
 * The split AC units on the walls (in place of addBuilding's plain boxes): a white case, its fan, the
 * pipe going into the wall and the drain pipe running down, here and there a floor at a time.
 */
export function airCons(b: Builder, ring: XZ[], H: number, c: XZ) {
  let n = 0
  const runs = wallRuns(ring)
  for (let i = 0; i < runs.length && n < 6; i++) {
    const [p, q] = runs[i]
    const len = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (len < 3.5) continue
    const nn = normal(p, q)
    for (let y = 0; y < H; y += BLOCK) {
      // (The same draw as the plain ones: the same walls get them.)
      if (hash(c[0] + i * 3.1, c[1] + y, 13) > 0.3) continue
      n++
      const t = 0.2 + 0.6 * hash(c[1] + i, c[0] - y, 17)
      const [x, z] = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
      const h = y + (y === 0 ? 2.15 : 1.7)
      wallBox(b, x + nn[0] * 0.17, h, z + nn[1] * 0.17, 0.82, 0.56, 0.3, nn, cellUv(PROP.acFront))
      // Its brackets, the pipes into the wall and the drain down it.
      for (const s of [-0.3, 0.3]) wallBox(b, x - nn[1] * s + nn[0] * 0.14, h - 0.32, z + nn[0] * s + nn[1] * 0.14, 0.04, 0.05, 0.28, nn, UV_METAL, UV_METAL)
      wallBox(b, x - nn[1] * 0.46 + nn[0] * 0.04, h + 0.05, z + nn[0] * 0.46 + nn[1] * 0.04, 0.12, 0.08, 0.08, nn, UV_WHITE)
      const drop = Math.min(h - 0.3, y === 0 ? 1.6 : 1.4)
      wallBox(b, x + nn[1] * 0.3 + nn[0] * 0.05, h - 0.28 - drop / 2, z - nn[0] * 0.3 + nn[1] * 0.05, 0.035, drop, 0.035, nn, UV_METAL, UV_METAL)
    }
  }
}

/** A flat picture on a wall, facing out along `n` (one quad): a cell of the atlas that repeats along a run is laid as several. */
export function wallPanel(b: Builder, cx: number, cy: number, cz: number, w: number, h: number, n: XZ, uv: UvRect, c: THREE.Color = WHITE) {
  const [ux, uz] = [n[1], -n[0]]
  const [u0, v0, u1, v1] = uv
  const nrm: [number, number, number] = [n[0], 0, n[1]]
  const ids = [b.vertex(cx - ux * w / 2, cy - h / 2, cz - uz * w / 2, u0, v0, nrm, c), b.vertex(cx + ux * w / 2, cy - h / 2, cz + uz * w / 2, u1, v0, nrm, c), b.vertex(cx + ux * w / 2, cy + h / 2, cz + uz * w / 2, u1, v1, nrm, c), b.vertex(cx - ux * w / 2, cy + h / 2, cz - uz * w / 2, u0, v1, nrm, c)]
  b.facing(nrm, ids[0], ids[1], ids[2])
  b.facing(nrm, ids[0], ids[2], ids[3])
}

/** A balcony's claustra parapet and its slab (in place of the plain slab and black rail). */
export function claustraBalcony(b: Builder, mx: number, mz: number, y: number, len: number, n: XZ) {
  wallBox(b, mx, y + 0.08, mz, len, 0.16, 1.2, n, cellUv(PROP.slab), cellUv(PROP.slab))
  wallBox(b, mx + n[0] * 0.53, y + 0.6, mz + n[1] * 0.53, len, 0.9, 0.14, n, cellUv(PROP.slab), cellUv(PROP.slab))
  // Its face in breeze blocks, a picture a metre wide each (the atlas doesn't repeat).
  const k = Math.max(1, Math.round(len / 0.9))
  const [ux, uz] = [n[1], -n[0]]
  for (let i = 0; i < k; i++) {
    const a = -len / 2 + (len / k) * (i + 0.5)
    wallPanel(b, mx + n[0] * 0.605 + ux * a, y + 0.6, mz + n[1] * 0.605 + uz * a, len / k, 0.9, n, cellUv(PROP.claustra))
  }
  // The parapet's ends back to the wall.
  for (const s of [-1, 1]) wallBox(b, mx - n[1] * s * (len / 2 - 0.07), y + 0.6, mz + n[0] * s * (len / 2 - 0.07), 0.14, 0.9, 1.06, n, cellUv(PROP.slab), cellUv(PROP.slab))
}

/**
 * The rest of a building's dress: its shops' signs over the fronts (up to two, on the longer walls) in
 * `near`, and in `extra` (« haute »): a blade sign by a shop's door, a dish on an upper wall, a downpipe
 * from the roof at a corner.
 */
export function dressWalls(near: Builder, extra: Builder, ring: XZ[], d: Dress) {
  const runs = wallRuns(ring)
    .map((r, i) => ({ r, i, len: Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]) }))
    .filter((x) => x.len >= 4)
    .sort((a, b) => b.len - a.len)
  const { c, H } = d
  if (d.shops) {
    runs.slice(0, 2).forEach(({ r: [p, q], i, len }, k) => {
      if (k && hash(c[0], c[1], 61 + i) < 0.4) return
      const n = normal(p, q)
      const w = Math.min(len - 1, 3.2 + hash(c[0] + i, c[1], 63) * 2.4)
      const h = Math.max(0.7, Math.min(1, w / 4.6))
      const m = 0.5 + (hash(c[1], c[0] + i, 65) - 0.5) * Math.max(0, 1 - w / len)
      const [x, z] = [p[0] + (q[0] - p[0]) * m, p[1] + (q[1] - p[1]) * m]
      const sign = (d.kind ? SIGN_OF[d.kind] : undefined) ?? Math.floor(hash(c[0] * 3 + i, c[1] * 5, 67) * SIGNS_N)
      wallBox(near, x + n[0] * 0.08, 3.0 + h / 2, z + n[1] * 0.08, w, h, 0.12, n, signUv(sign), UV_METAL)
      // « haute »: a blade sign by the door, out over the pavement on its bracket.
      if (k === 0 && hash(c[0], c[1] + i, 69) < 0.55) {
        const cell = sign === 4 ? PROP.cross : hash(c[1], c[0], 71) < 0.5 ? PROP.blade : PROP.cabine
        const [ux, uz] = [-n[1], n[0]]
        const s = (w / 2 + 0.4) * (hash(c[0] * 7, c[1], 73) < 0.5 ? -1 : 1)
        const [bx, bz] = [x + ux * s + n[0] * 0.45, z + uz * s + n[1] * 0.45]
        // Turned square to the wall: its face along the street.
        const along: XZ = [ux, uz]
        wallBox(extra, bx, 2.75, bz, 0.06, 0.7, 0.7, along, UV_METAL, UV_METAL)
        wallBox(extra, bx + ux * 0.04, 2.75, bz + uz * 0.04, 0.7, 0.7, 0.02, along, cellUv(cell), UV_METAL)
        wallBox(extra, bx - ux * 0.04, 2.75, bz - uz * 0.04, 0.7, 0.7, 0.02, [-ux, -uz], cellUv(cell), UV_METAL)
        wallBox(extra, x + ux * s + n[0] * 0.25, 3.14, z + uz * s + n[1] * 0.25, 0.04, 0.04, 0.5, n, UV_METAL, UV_METAL)
      }
    })
  }
  if (H >= 2 * BLOCK && runs.length) {
    // A dish on an upper wall, turned to the sky.
    if (hash(c[0] * 13, c[1] * 7, 75) < 0.45) {
      const { r: [p, q] } = runs[runs.length > 1 ? 1 : 0]
      const n = normal(p, q)
      const t = 0.15 + 0.7 * hash(c[1] * 3, c[0], 77)
      const y = BLOCK * (1 + Math.floor(hash(c[0], c[1] * 3, 79) * (H / BLOCK - 1))) + 2.2
      wallBox(extra, p[0] + (q[0] - p[0]) * t + n[0] * 0.3, Math.min(H - 0.5, y), p[1] + (q[1] - p[1]) * t + n[1] * 0.3, 0.75, 0.75, 0.1, n, cellUv(PROP.dish), cellUv(PROP.dish))
    }
    // A downpipe from the roof at the end of the longest wall.
    const { r: [p, q] } = runs[0]
    const n = normal(p, q)
    const [ux, uz] = [(q[0] - p[0]) / runs[0].len, (q[1] - p[1]) / runs[0].len]
    wallBox(extra, q[0] - ux * 0.35 + n[0] * 0.07, H / 2 + 0.2, q[1] - uz * 0.35 + n[1] * 0.07, 0.1, H - 0.4, 0.1, n, UV_METAL, UV_METAL)
  }
}
