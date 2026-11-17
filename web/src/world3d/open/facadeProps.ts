import * as THREE from 'three'
import type { Builder } from './builder'
import { hash, pointInRing, type XZ } from './geo'
import { BLOCK, type Building } from './tiles'
import { normal, wallRuns } from './buildings'
import type { Poi } from './poiMatch'

// « Façades réalistes » (facades.ts): the small things on the walls of the chunks round the view,
// built with the chunk (in the worker) into two meshes a square of the chunk (cells.ts): `facade`
// (drawn on « normal » and « haute ») and `facade2` (the extras of « haute »). Each is a box whose
// faces read a cell of one atlas (facadeAtlas.ts propsAtlas): the AC units with their fan and their
// drain pipe, the claustra of the balconies, the shops' signs with their invented names, blade signs,
// dishes, downpipes. A few dozen triangles a building, one draw a square.

/** The props' atlas: PROP_SIZE texels square, cells of PROP_CELL; rows 0-2 and 4-5 are signs SIGN_W wide (row 3 the props). */
export const PROP_SIZE = 512
export const PROP_CELL = 32
export const SIGN_W = 128
export const SIGNS_N = 20
/** Where sign `i`'s board is in the atlas (texels): four a row, the props' row skipped. */
export const signXY = (i: number): [number, number] => [(i % 4) * SIGN_W, (Math.floor(i / 4) + (i >= 12 ? 1 : 0)) * PROP_CELL]
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
  bar: [13, 3],
} as const
/** A rectangle of the atlas, as u0, v0, u1, v1 (half a texel in from its edges). */
export type UvRect = [number, number, number, number]
const rectOf = (x: number, y: number, w: number, h: number): UvRect => {
  const e = 0.5
  return [(x + e) / PROP_SIZE, 1 - (y + h - e) / PROP_SIZE, (x + w - e) / PROP_SIZE, 1 - (y + e) / PROP_SIZE]
}
export const cellUv = (cell: readonly [number, number]) => rectOf(cell[0] * PROP_CELL, cell[1] * PROP_CELL, PROP_CELL, PROP_CELL)
export const signUv = (i: number) => rectOf(...signXY(i), SIGN_W, PROP_CELL)

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

/** What dressWalls needs to know of a building (worked out by addBuilding): its shop's kind when known, the point of the street it faces. */
export type Dress = { H: number; c: XZ; shops: boolean; pitched: boolean; kind: string | undefined; front?: XZ }

/** The nearest point of a street (not a footpath, not a motorway) to `c`: the side a shop's sign faces. */
export function streetFront(roads: { cls: string; pts: XZ[] }[], [x, z]: XZ): XZ | undefined {
  let best: XZ | undefined
  let bestD = 60 * 60
  for (const r of roads) {
    if (r.cls === 'path' || r.cls === 'motorway') continue
    for (let i = 1; i < r.pts.length; i++) {
      const [ax, az] = r.pts[i - 1]
      const [bx, bz] = r.pts[i]
      const l2 = (bx - ax) ** 2 + (bz - az) ** 2
      const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2)) : 0
      const [px, pz] = [ax + (bx - ax) * t, az + (bz - az) * t]
      const d = (px - x) ** 2 + (pz - z) ** 2
      if (d < bestD) ((bestD = d), (best = [px, pz]))
    }
  }
  return best
}

/**
 * The signs (facadeAtlas.ts SIGN_NAMES, invented names) of each kind of shop: a building the game knows
 * to be one (a place of the commune on it, or the map's point of interest at its door) gets one of its
 * kind's; the others one of GENERIC (never a pharmacy's or a maquis's: their sign says what's there).
 */
const SIGNS_OF: Record<string, number[]> = { quincaillerie: [0, 18], boulangerie: [1], boutique: [2, 8, 16], cabine: [3], pharmacie: [4, 12, 13], barbier: [5], salon: [17, 5], couture: [6], pressing: [7], restaurant: [9, 19], electronique: [10], maquis: [11, 14, 15] }
const GENERIC = [0, 1, 2, 3, 5, 6, 7, 8, 10, 16, 18]
/** The signs with the pharmacies' green cross on their board. */
export const PHARMA_SIGNS = SIGNS_OF.pharmacie

/** The game's place kinds that are shops with a sign (a few go by another's). */
const PLACE_SIGN: Record<string, string> = { boutique: 'boutique', market: 'boutique', pharmacie: 'pharmacie', barbier: 'barbier', salon: 'salon', couture: 'couture', maquis: 'maquis', club: 'maquis', restaurant: 'restaurant' }
/** What the map's points of interest are (OpenStreetMap's types, Mapbox's icons), as a kind of sign. */
const POI_SIGN: Record<string, string> = {
  pharmacy: 'pharmacie', chemist: 'pharmacie', bar: 'maquis', pub: 'maquis', beer: 'maquis', biergarten: 'maquis', nightclub: 'maquis', 'alcohol-shop': 'maquis', alcohol: 'maquis',
  restaurant: 'restaurant', 'fast-food': 'restaurant', cafe: 'restaurant', 'ice-cream': 'restaurant', food_court: 'restaurant',
  hairdresser: 'salon', beauty: 'salon', barber: 'barbier', hardware: 'quincaillerie', doityourself: 'quincaillerie', 'building-materials': 'quincaillerie', paint: 'quincaillerie',
  grocery: 'boutique', convenience: 'boutique', supermarket: 'boutique', shop: 'boutique', general: 'boutique', variety_store: 'boutique', kiosk: 'boutique',
  'clothing-store': 'couture', clothes: 'couture', tailor: 'couture', fabric: 'couture', bakery: 'boulangerie', laundry: 'pressing', dry_cleaning: 'pressing',
  'mobile-phone': 'electronique', mobile_phone: 'electronique', electronics: 'electronique', 'money-transfer': 'cabine', money_transfer: 'cabine', bureau_de_change: 'cabine',
  // (Common in Abidjan's streets on the map, seen in Yopougon: a shop's sign, not a pharmacy's or a maquis's.)
  computer: 'electronique', video_games: 'electronique', copyshop: 'boutique', cosmetics: 'boutique', perfumery: 'boutique', jewelry: 'boutique', shoes: 'boutique', department_store: 'boutique', greengrocer: 'boutique', beverages: 'boutique', stationery: 'boutique',
}
const poiSign = (p: Poi) => POI_SIGN[p.type] ?? POI_SIGN[p.maki] ?? POI_SIGN[p.type.replace(/_/g, '-')]

/** How far a point is from a building's walls (0 inside). */
function wallDistance(p: XZ, ring: XZ[]) {
  if (pointInRing(p, ring)) return 0
  let best = Infinity
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % ring.length]]
    const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)))
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz))
  }
  return best
}
/** A point of interest further than this from every wall stands alone (a kiosk, a stall): no building's sign. */
const POI_REACH = 8

/**
 * Which buildings of a chunk are which kind of shop, as far as the game knows: the commune's places
 * that stand on a map building (`places`, from resolvePlaces), then the map's points of interest, each
 * on the building it is in, or the one whose walls are nearest, a few metres off (at its door).
 * Built in the chunk's job (the places and the tile's points are in its cache key, so a sign changes
 * with them).
 *
 * The nearest by its walls, not by its middle less its size: in a real street (Yopougon, a bench with
 * the map's 1 300 points of 11 chunks) one point in five went to a long building behind instead of the
 * shop it stands in front of.
 */
export function shopKinds(buildings: Building[], pois: Poi[], places: Map<Building, string>): Map<Building, string> {
  const out = new Map<Building, string>()
  for (const [b, kind] of places) if (PLACE_SIGN[kind]) out.set(b, PLACE_SIGN[kind])
  const reach = new Map<Building, number>()
  const radius = (b: Building) => {
    let r = reach.get(b)
    if (r === undefined) reach.set(b, (r = Math.max(...b.ring.map(([x, z]) => Math.hypot(x - b.c[0], z - b.c[1])))))
    return r
  }
  for (const p of pois) {
    const kind = poiSign(p)
    if (!kind) continue
    let best: Building | null = null
    let bestD = POI_REACH
    for (const b of buildings) {
      // (Only the buildings that can be that near: their middle within their size of it.)
      if (Math.hypot(p.at[0] - b.c[0], p.at[1] - b.c[1]) - radius(b) > bestD) continue
      const d = wallDistance(p.at, b.ring)
      if (d > bestD || (best && d === bestD)) continue
      best = b
      bestD = d
      if (d === 0) break
    }
    if (best && !out.has(best)) out.set(best, kind)
  }
  return out
}

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
 * The rest of a building's dress: its shops' signs over the fronts (up to two, on the longer walls; the
 * kind of shop it is when the game knows, Dress.kind) and a blade sign out over the pavement by the door,
 * in `near` (« normal » and « haute »); in `extra` (« haute »): a dish on an upper wall, a downpipe from
 * the roof at a corner.
 */
export function dressWalls(near: Builder, extra: Builder, ring: XZ[], d: Dress) {
  const runs = wallRuns(ring)
    .map((r, i) => ({ r, i, len: Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]) }))
    .filter((x) => x.len >= 4)
    .sort((a, b) => b.len - a.len)
  const { c, H } = d
  const kinds = d.kind ? SIGNS_OF[d.kind] : undefined
  if (d.shops || kinds) {
    // The signs on the walls facing the street first (they used to land on a side wall, against the
    // neighbour's), then the longer ones.
    const front = d.front
    const facing = (r: XZ[]) => {
      if (!front) return 0
      const n = normal(r[0], r[1])
      const [mx, mz] = [(r[0][0] + r[1][0]) / 2, (r[0][1] + r[1][1]) / 2]
      const l = Math.hypot(front[0] - mx, front[1] - mz) || 1
      return ((front[0] - mx) * n[0] + (front[1] - mz) * n[1]) / l > 0.5 ? 1 : 0
    }
    const fronts = front ? [...runs].sort((a, b) => facing(b.r) - facing(a.r) || b.len - a.len) : runs
    fronts.slice(0, 2).forEach(({ r: [p, q], i, len }, k) => {
      if (k && hash(c[0], c[1], 61 + i) < 0.4) return
      const n = normal(p, q)
      // Big enough to read from across the street: 4 to 7 m long, about a metre high (lower over a
      // one-storey house's door, under its roof).
      const w = Math.min(len - 0.6, 4.2 + hash(c[0] + i, c[1], 63) * 2.8)
      const low = H <= BLOCK
      const h = low ? Math.min(0.8, w / 4.2) : Math.max(0.95, Math.min(1.35, w / 4.2))
      const y = low ? 2.15 + h / 2 : 3.0 + h / 2
      const m = 0.5 + (hash(c[1], c[0] + i, 65) - 0.5) * Math.max(0, 1 - w / len)
      const [x, z] = [p[0] + (q[0] - p[0]) * m, p[1] + (q[1] - p[1]) * m]
      const pool = kinds ?? GENERIC
      const sign = pool[Math.floor(hash(c[0] * 3 + i, c[1] * 5, 67) * pool.length)]
      wallBox(near, x + n[0] * 0.08, y, z + n[1] * 0.08, w, h, 0.12, n, signUv(sign), UV_METAL)
      // A blade sign by the door, out over the pavement on its bracket above the awnings, its two faces
      // along the street (seen walking or driving up it): the green cross of a pharmacy, a maquis's glass
      // of beer, a mobile-money kiosk's or a phone booth's.
      if (k === 0 && (kinds || hash(c[0], c[1] + i, 69) < 0.6)) {
        const cell = d.kind === 'pharmacie' ? PROP.cross : d.kind === 'maquis' || d.kind === 'restaurant' ? PROP.bar : hash(c[1], c[0], 71) < 0.5 ? PROP.blade : PROP.cabine
        const [ux, uz] = [-n[1], n[0]]
        const s = Math.min(w / 2 + 0.5, len / 2 - 0.3) * (hash(c[0] * 7, c[1], 73) < 0.5 ? -1 : 1)
        const by = low ? y : 3.0 + Math.max(h, 0.9) / 2 + 0.05
        const size = low ? 0.7 : 0.9
        const [bx, bz] = [x + ux * s + n[0] * (0.15 + size / 2), z + uz * s + n[1] * (0.15 + size / 2)]
        // Turned square to the wall: its face along the street.
        const along: XZ = [ux, uz]
        wallBox(near, bx, by, bz, 0.06, size, size, along, UV_METAL, UV_METAL)
        wallBox(near, bx + ux * 0.04, by, bz + uz * 0.04, size, size, 0.02, along, cellUv(cell), UV_METAL)
        wallBox(near, bx - ux * 0.04, by, bz - uz * 0.04, size, size, 0.02, [-ux, -uz], cellUv(cell), UV_METAL)
        wallBox(near, x + ux * s + n[0] * (0.1 + size / 2), by + size / 2 + 0.04, z + uz * s + n[1] * (0.1 + size / 2), 0.04, 0.04, size + 0.2, n, UV_METAL, UV_METAL)
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
