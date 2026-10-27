import * as THREE from 'three'
import { Builder } from './builder'
import { hash, pointInRing, type XZ } from './geo'
import { BLOCK, type Building } from './tiles'
import { ATLAS } from './textures'
import { CELL } from './voxel'

// A real building made to read as a building: a darker plinth, a ground
// floor of shops (metal shutters) or of a house (door, window), storeys
// separated by a ledge, balconies on the tall ones, and on top either a
// sloping tin roof (small houses) or a flat roof behind a parapet, with the
// black water tanks, AC units and stair head of Abidjan rooftops. A soft dark
// band on the ground holds it down.

/**
 * How a building looks, from what it is: a campus or hospital building, a
 * town hall or office, a hotel, shops, a home. Ordinary buildings mix shops
 * and homes as the street goes.
 */
export type Style = 'default' | 'institution' | 'hospital' | 'civic' | 'hotel' | 'commerce' | 'home'

/** The look of each place kind of the game. */
export const STYLE_OF_KIND: Record<string, Style> = {
  universite: 'institution', school: 'institution', health: 'hospital', mairie: 'civic', office: 'civic', culture: 'civic', cinema: 'commerce', worship: 'civic', police: 'civic',
  hotel: 'hotel', mall: 'commerce', market: 'commerce', restaurant: 'commerce', maquis: 'commerce', club: 'commerce', barbier: 'commerce', salon: 'commerce', transport: 'commerce', aeroport: 'commerce', home: 'home',
  boutique: 'commerce', couture: 'commerce', pharmacie: 'commerce', gym: 'commerce',
}

export type BuildingBuilders = {
  walls: Builder // upper storeys (window texture)
  inst: Builder // upper storeys of public buildings: long bands of windows
  entrance: Builder // their ground floor: glazed doors
  shop: Builder // ground floor, shops
  house: Builder // ground floor, a home
  trim: Builder // plain plaster: plinth, ledges, parapets, gables, balconies, rooftop things
  roofs: Builder // flat concrete roofs
  tin: Builder // corrugated sheet metal roofs
  tinLow: Builder // the same roofs as two plain slopes: what's drawn of them further off (a few triangles instead of the steps)
  contact: Builder // the shade on the ground around the walls (RGBA)
}

export function newBuildingBuilders(): BuildingBuilders {
  return { walls: new Builder(), inst: new Builder(), entrance: new Builder(), shop: new Builder(), house: new Builder(), trim: new Builder(), roofs: new Builder(), tin: new Builder(), tinLow: new Builder(), contact: new Builder(true) }
}

// Façades of Abidjan: whites and creams, and the painted colours of the
// quarters: ochre, yellow, salmon, sky blue, mint, lilac.
const FACADES = ['#ffffff', '#fff3e0', '#f6d58e', '#fbe3a1', '#f4b89a', '#f7c9a8', '#cfe3f3', '#bfe3c6', '#e3d3ef', '#f1e3c8', '#ffd6a5', '#f2a99f', '#eeeeee', '#fbe7c6'].map((c) => new THREE.Color(c))
// The ground floor is often painted apart: a darker band, or a bold colour.
const GROUND = ['#c9b79c', '#b5654a', '#4f7fa8', '#6b8f5a', '#d8a24a', '#9a8f84'].map((c) => new THREE.Color(c))
const AWNINGS = ['#c0392b', '#1f6fb5', '#2e8b57', '#e67e22', '#8e44ad'].map((c) => new THREE.Color(c))
const DISH = new THREE.Color('#f2f2f0')
/** The soubassements' paints: brick red, ochre, a dark green, slate grey, maroon, the blue of the doors. */
const SOUBASSEMENT = ['#9c4a32', '#b8873e', '#3f6b4a', '#6b7078', '#6e3b32', '#3d5a80'].map((c) => new THREE.Color(c))
const PLINTH = new THREE.Color('#8f8372')
// Public buildings: whites, creams, pale grey-blue.
const PUBLIC = ['#fdfbf5', '#f3ead7', '#e8eef3', '#f6f1e6'].map((c) => new THREE.Color(c))
const CIVIC = ['#f1e3c8', '#ffe0b2', '#f3ead7'].map((c) => new THREE.Color(c))
const HOSPITAL_BAND = new THREE.Color('#4a90c2')
const SLAB = new THREE.Color('#c9c4bb')
const RAIL = new THREE.Color('#3d3f45')
const TANK = new THREE.Color('#202124')
const TANK_BLUE = new THREE.Color('#2a6cf0')
const AC = new THREE.Color('#e9ecef')
const BLACK = new THREE.Color('#000000')

/** Light falls off near the ground: a cheap ambient occlusion on the walls. */
const ao = (y: number) => 0.68 + 0.32 * Math.min(1, y / 5)

function signedArea(r: XZ[]) {
  let a = 0
  for (let i = 0; i < r.length; i++) {
    const [x1, z1] = r[i]
    const [x2, z2] = r[(i + 1) % r.length]
    a += x1 * z2 - x2 * z1
  }
  return a / 2
}

/** Outward normal of the edge a→b of a ring wound the game's way. */
function normal(a: XZ, b: XZ): XZ {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  return [(b[1] - a[1]) / len, -(b[0] - a[0]) / len]
}

/** The ring pushed out (d > 0) or in (d < 0), corners mitred. */
export function offsetRing(ring: XZ[], d: number): XZ[] {
  return ring.map((p, i) => {
    const prev = ring[(i + ring.length - 1) % ring.length]
    const next = ring[(i + 1) % ring.length]
    const [n1x, n1z] = normal(prev, p)
    const [n2x, n2z] = normal(p, next)
    const dot = n1x * n2x + n1z * n2z
    let [mx, mz] = [n1x + n2x, n1z + n2z]
    if (1 + dot < 0.3) {
      const l = Math.hypot(mx, mz) || 1
      return [p[0] + (mx / l) * d, p[1] + (mz / l) * d]
    }
    mx /= 1 + dot
    mz /= 1 + dot
    return [p[0] + mx * d, p[1] + mz * d]
  })
}

/** The smallest rectangle around the ring, at the angle of one of its sides. */
function orientedRect(ring: XZ[]) {
  let best = { area: Infinity, angle: 0, cx: 0, cz: 0, w: 0, d: 0 }
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]
    const [bx, bz] = ring[(i + 1) % ring.length]
    const angle = Math.atan2(bz - az, bx - ax)
    const [c, s] = [Math.cos(angle), Math.sin(angle)]
    let [u0, v0, u1, v1] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, z] of ring) {
      const u = x * c + z * s
      const v = -x * s + z * c
      ;[u0, v0, u1, v1] = [Math.min(u0, u), Math.min(v0, v), Math.max(u1, u), Math.max(v1, v)]
    }
    const area = (u1 - u0) * (v1 - v0)
    if (area < best.area) {
      const [cu, cv] = [(u0 + u1) / 2, (v0 + v1) / 2]
      best = { area, angle, cx: cu * c - cv * s, cz: cu * s + cv * c, w: u1 - u0, d: v1 - v0 }
    }
  }
  return best
}

/** A band of wall from y0 to y1 all around, set out by `out`, with its top and bottom ledges when it sticks out. */
function band(b: Builder, ring: XZ[], y0: number, y1: number, out: number, c: THREE.Color, shade = true) {
  const r = out ? offsetRing(ring, out) : ring
  for (let i = 0; i < r.length; i++) {
    const p = r[i]
    const q = r[(i + 1) % r.length]
    const len = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (len < 0.05) continue
    const [nx, nz] = normal(p, q)
    const n: [number, number, number] = [nx, 0, nz]
    const cb = shade ? c.clone().multiplyScalar(ao(y0)) : c
    const ct = shade ? c.clone().multiplyScalar(ao(y1)) : c
    const a = b.vertex(p[0], y0, p[1], 0, y0, n, cb)
    const d = b.vertex(q[0], y0, q[1], len, y0, n, cb)
    const e = b.vertex(q[0], y1, q[1], len, y1, n, ct)
    const f = b.vertex(p[0], y1, p[1], 0, y1, n, ct)
    b.quad(a, f, e, d)
  }
  if (out > 0) {
    // The ledge's top and underside.
    b.flat([r, [...ring].reverse()], y1, 1, c)
    const under = b.idx.length
    b.flat([r, [...ring].reverse()], y0, 1, c.clone().multiplyScalar(0.7))
    // Underside faces down: flip the triangles just added.
    for (let k = under; k < b.idx.length; k += 3) [b.idx[k + 1], b.idx[k + 2]] = [b.idx[k + 2], b.idx[k + 1]]
  }
}

/**
 * Walls textured one tile per storey and per 3 m, between y0 and y1. The
 * textures are atlases ATLAS tiles across (and `rows` tiles up): each 3 m
 * takes the next tile, starting at `shift` so buildings don't all match.
 */
function storeys(b: Builder, ring: XZ[], y0: number, y1: number, c: THREE.Color, rows = 1, shift = 0) {
  let run = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % ring.length]
    const len = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (len < 0.05) continue
    const [nx, nz] = normal(p, q)
    const n: [number, number, number] = [nx, 0, nz]
    const u0 = (Math.round(run / BLOCK) + shift) / ATLAS
    const u1 = u0 + Math.max(1, Math.round(len / BLOCK)) / ATLAS
    const [v0, v1] = [(y0 / BLOCK + (rows > 1 ? shift * 3 : 0)) / rows, (y1 / BLOCK + (rows > 1 ? shift * 3 : 0)) / rows]
    const a = b.vertex(p[0], y0, p[1], u0, v0, n, c.clone().multiplyScalar(ao(y0)))
    const d = b.vertex(q[0], y0, q[1], u1, v0, n, c.clone().multiplyScalar(ao(y0)))
    const e = b.vertex(q[0], y1, q[1], u1, v1, n, c.clone().multiplyScalar(ao(y1)))
    const f = b.vertex(p[0], y1, p[1], u0, v1, n, c.clone().multiplyScalar(ao(y1)))
    b.quad(a, f, e, d)
    run += len
  }
}

export function addBuilding(B: BuildingBuilders, bd: Building, style: Style = 'default') {
  const ring = signedArea(bd.ring) > 0 ? bd.ring : [...bd.ring].reverse()
  if (ring.length < 3) return
  const H = bd.height
  const pub = style === 'institution' || style === 'hospital'
  const palette = pub ? (style === 'hospital' ? [new THREE.Color('#ffffff')] : PUBLIC) : style === 'civic' ? CIVIC : FACADES
  const tint = palette[Math.floor(bd.tint * palette.length)]
  const r1 = hash(bd.c[0] * 3, bd.c[1])
  const r2 = hash(bd.c[1] * 7, bd.c[0] * 2)
  const area = Math.abs(signedArea(ring))
  const rect = orientedRect(ring)
  const rectLike = area / Math.max(1, rect.w * rect.d) > 0.86
  const pitched = (style === 'default' || style === 'home') && H <= 2 * BLOCK && (bd.tin || (rectLike && r1 < 0.8)) && Math.min(rect.w, rect.d) < 20
  const shops = style === 'commerce' || (style === 'default' && H >= 2 * BLOCK && r2 < 0.5)

  // Plinth, ground floor, upper storeys. The small houses of the quarters most often have
  // their soubassement painted apart, a darker band at the foot of the walls (where the rain splashes the earth).
  const r4 = hash(bd.c[0] * 17, bd.c[1] * 19, 3)
  if (pitched && r4 < 0.65) band(B.trim, ring, 0, 0.62, 0.05, SOUBASSEMENT[Math.floor(r4 * 31) % SOUBASSEMENT.length], false)
  else band(B.trim, ring, 0, 0.45, 0.06, PLINTH, false)
  const glazed = pub || style === 'civic' || style === 'hotel'
  const shift = Math.floor(hash(bd.c[0], bd.c[1], 5) * 16)
  // Shops and homes often have their ground floor painted apart from the rest.
  const r3 = hash(bd.c[0] * 5, bd.c[1] * 3)
  const ground = !glazed && H > BLOCK && r3 < 0.45 ? tint.clone().lerp(GROUND[Math.floor(r3 * 13) % GROUND.length], 0.55) : tint
  if (glazed) storeys(B.entrance, ring, 0, BLOCK, tint)
  else storeys(shops ? B.shop : B.house, ring, 0, BLOCK, ground, 1, shift)
  if (H > BLOCK) {
    if (pub) storeys(B.inst, ring, BLOCK, H, tint)
    else storeys(B.walls, ring, BLOCK, H, tint, ATLAS, shift)
  }
  // Pilasters at the corners of the bigger buildings: they frame the façade.
  if (H >= 2 * BLOCK && ring.length <= 16) {
    const pil = tint.clone().multiplyScalar(0.9)
    for (let i = 0; i < ring.length; i++) {
      const [prev, p, next] = [ring[(i + ring.length - 1) % ring.length], ring[i], ring[(i + 1) % ring.length]]
      const [n1x, n1z] = normal(prev, p)
      const [n2x, n2z] = normal(p, next)
      if (n1x * n2x + n1z * n2z > 0.7) continue // not a real corner
      const [bx, bz] = [n1x + n2x, n1z + n2z]
      const l = Math.hypot(bx, bz) || 1
      const rot = Math.atan2(n2z, n2x) + Math.PI / 2
      B.trim.box(p[0] + (bx / l) * 0.12, BLOCK + (H - BLOCK) / 2, p[1] + (bz / l) * 0.12, 0.7, H - BLOCK, 0.7, rot, pil)
    }
  }
  // A ledge at every floor (a blue band on a hospital).
  const ledge = style === 'hospital' ? HOSPITAL_BAND : tint.clone().multiplyScalar(0.86)
  for (let y = BLOCK; y < H; y += BLOCK) band(B.trim, ring, y - 0.12, y + 0.1, 0.14, ledge, false)

  if (pitched) {
    // A tin roof in steps, like Minecraft's stairs: each layer half a block
    // up and half a block in from both long sides, overhanging the walls.
    let { w, d, angle } = rect
    if (d > w) {
      ;[w, d] = [d, w]
      angle += Math.PI / 2
    }
    const step = CELL / 2
    const o = step
    const tin = tinPaint(hash(bd.c[0] * 11, bd.c[1] * 13, 9))
    // The game's houses in the quarters (fill.ts) have the low roofs of
    // the cours: the same steps, a third as high (about 18°).
    const rise = bd.tin ? step / 3 : step
    let steps = 0
    for (let depth = d + 2 * o; depth > step / 2; steps++, depth -= 2 * step) {
      B.tin.box(rect.cx, H + steps * rise + rise / 2, rect.cz, w + 2 * o, rise, depth, angle, tin)
    }
    lowRoof(B.tinLow, rect.cx, rect.cz, (w + 2 * o) / 2, (d + 2 * o) / 2, angle, H, H + steps * rise, tin)
    // The gable ends, in the wall's colour, under the steps.
    B.trim.flat([ring], H, 1, tint.clone().multiplyScalar(0.6))
  } else {
    // Flat roof behind a parapet.
    const inner = offsetRing(ring, -0.25)
    band(B.trim, ring, H, H + 0.9, 0, tint)
    B.trim.flat([ring, [...inner].reverse()], H + 0.9, 1, tint.clone().multiplyScalar(0.92))
    // The parapet's inside faces the roof.
    for (let i = 0; i < inner.length; i++) {
      const p = inner[(i + 1) % inner.length]
      const q = inner[i]
      const len = Math.hypot(q[0] - p[0], q[1] - p[1])
      if (len < 0.05) continue
      const [nx, nz] = normal(p, q)
      const n: [number, number, number] = [nx, 0, nz]
      const col = tint.clone().multiplyScalar(0.8)
      const a = B.trim.vertex(p[0], H, p[1], 0, 0, n, col)
      const d = B.trim.vertex(q[0], H, q[1], len, 0, n, col)
      const e = B.trim.vertex(q[0], H + 0.9, q[1], len, 0.9, n, col)
      const f = B.trim.vertex(p[0], H + 0.9, p[1], 0, 0.9, n, col)
      B.trim.quad(a, f, e, d)
    }
    B.roofs.flat([inner], H + 0.02, BLOCK * 2)
    rooftop(B.trim, inner, H, bd.c, Math.sqrt(area))
  }

  // Tin awnings over the shop fronts, on the longer sides.
  if (shops) awnings(B, ring, bd.c)

  // Balconies on the bigger buildings, along their longest side.
  if ((H >= 3 * BLOCK && r1 > 0.45 && !pub) || (style === 'hotel' && H >= 2 * BLOCK)) {
    // (Along the longest whole wall: the outline comes in steps of a block.)
    let best = 0
    let run: [XZ, XZ] = [ring[0], ring[1]]
    for (const r of wallRuns(ring)) {
      const l = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1])
      if (l > best) [best, run] = [l, r]
    }
    const [p, q] = run
    const [nx, nz] = normal(p, q)
    const rot = Math.atan2(q[1] - p[1], q[0] - p[0])
    const len = Math.min(best * 0.6, 12)
    const [mx, mz] = [(p[0] + q[0]) / 2 + nx * 0.6, (p[1] + q[1]) / 2 + nz * 0.6]
    for (let y = BLOCK; y < H; y += BLOCK) {
      B.trim.box(mx, y + 0.08, mz, len, 0.16, 1.2, rot, SLAB)
      B.trim.box(mx + nx * 0.56, y + 0.6, mz + nz * 0.56, len, 0.9, 0.06, rot, RAIL)
    }
  }

  // The life on the walls and the roofs: the split air-conditioners, the
  // veranda in front of a small house's door, the washing drying up on a flat roof.
  if (!pub && style !== 'hotel') airCons(B.trim, ring, H, bd.c)
  if (pitched && r2 < 0.6) veranda(B, ring, tint, tinPaint(hash(bd.c[0] * 11, bd.c[1] * 13, 9)))
  if (!pitched && rectLike && H <= 4 * BLOCK && hash(bd.c[0] * 23, bd.c[1] * 29, 4) < 0.35) washing(B.trim, rect, H, bd.c)

  // Shade on the ground, darkest against the wall.
  const out = offsetRing(ring, 1.6)
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length
    const up: [number, number, number] = [0, 1, 0]
    const a = B.contact.vertex(ring[i][0], 0.025, ring[i][1], 0, 0, up, BLACK, 0.38)
    const b = B.contact.vertex(ring[j][0], 0.025, ring[j][1], 0, 0, up, BLACK, 0.38)
    const c = B.contact.vertex(out[j][0], 0.025, out[j][1], 0, 0, up, BLACK, 0)
    const d = B.contact.vertex(out[i][0], 0.025, out[i][1], 0, 0, up, BLACK, 0)
    B.contact.quad(a, d, c, b)
  }
}

const AC_GRILLE = new THREE.Color('#9aa0a8')
/**
 * A building's walls as whole runs: the ring's segments that carry on the same
 * way joined into one (the outlines come in steps of a block, so a straight
 * wall is many short pieces of it).
 */
function wallRuns(ring: XZ[]): [XZ, XZ][] {
  const runs: [XZ, XZ][] = []
  const dir = (a: XZ, b: XZ) => Math.atan2(b[1] - a[1], b[0] - a[0])
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % ring.length]]
    const last = runs[runs.length - 1]
    if (last && Math.abs(Math.sin(dir(last[0], last[1]) - dir(a, b))) < 0.02 && Math.cos(dir(last[0], last[1]) - dir(a, b)) > 0) last[1] = b
    else runs.push([a, b])
  }
  // The last run may carry on into the first.
  if (runs.length > 1) {
    const [f, l] = [runs[0], runs[runs.length - 1]]
    if (l[1][0] === f[0][0] && l[1][1] === f[0][1] && Math.abs(Math.sin(dir(l[0], l[1]) - dir(f[0], f[1]))) < 0.02 && Math.cos(dir(l[0], l[1]) - dir(f[0], f[1])) > 0) {
      runs[0] = [l[0], f[1]]
      runs.pop()
    }
  }
  return runs
}
/**
 * The split air-conditioners hung on the walls (the street hears their hum):
 * a white box with its grille, here and there along the walls, a floor at a time.
 */
function airCons(b: Builder, ring: XZ[], H: number, c: XZ) {
  let n = 0
  const runs = wallRuns(ring)
  for (let i = 0; i < runs.length && n < 6; i++) {
    const [p, q] = runs[i]
    const len = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (len < 3.5) continue
    const [nx, nz] = normal(p, q)
    const rot = Math.atan2(q[1] - p[1], q[0] - p[0])
    for (let y = 0; y < H; y += BLOCK) {
      const u = hash(c[0] + i * 3.1, c[1] + y, 13)
      if (u > 0.3) continue
      n++
      const t = 0.2 + 0.6 * hash(c[1] + i, c[0] - y, 17)
      const [x, z] = [p[0] + (q[0] - p[0]) * t + nx * 0.2, p[1] + (q[1] - p[1]) * t + nz * 0.2]
      const h = y + (y === 0 ? 2.15 : 1.7)
      b.box(x, h, z, 0.82, 0.56, 0.3, rot, AC)
      b.box(x + nx * 0.16, h - 0.02, z + nz * 0.16, 0.6, 0.4, 0.02, rot, AC_GRILLE)
    }
  }
}

/** The veranda before a small house's door: a sloping tin roof on two posts, along its longest wall. */
function veranda(B: BuildingBuilders, ring: XZ[], tint: THREE.Color, tin: THREE.Color) {
  let best = 0
  let run: [XZ, XZ] | null = null
  for (const r of wallRuns(ring)) {
    const l = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1])
    if (l > best) [best, run] = [l, r]
  }
  if (best < 5 || !run) return
  const [p, q] = run
  const [nx, nz] = normal(p, q)
  const rot = Math.atan2(q[1] - p[1], q[0] - p[0])
  const [ux, uz] = [(q[0] - p[0]) / best, (q[1] - p[1]) / best]
  const w = Math.min(best - 1.5, 4.2)
  const [mx, mz] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  const out = 1.9
  const post = tint.clone().multiplyScalar(0.55)
  for (const s of [-1, 1]) B.trim.box(mx + ux * s * (w / 2 - 0.15) + nx * (out - 0.15), 1.2, mz + uz * s * (w / 2 - 0.15) + nz * (out - 0.15), 0.18, 2.4, 0.18, rot, post)
  // The roof, in two steps down from the wall (blocky, like the house's own).
  B.tin.box(mx + nx * (out * 0.3), 2.62, mz + nz * (out * 0.3), w + 0.3, 0.16, out * 0.6 + 0.1, rot, tin)
  B.tin.box(mx + nx * (out * 0.8), 2.48, mz + nz * (out * 0.8), w + 0.3, 0.16, out * 0.45, rot, tin)
  // A step of concrete before the door.
  B.trim.box(mx + nx * (out / 2), 0.08, mz + nz * (out / 2), w, 0.16, out, rot, SLAB)
}

const CLOTHES = ['#e8590c', '#1c7ed6', '#f4f4f2', '#2f9e44', '#f08c00', '#c2255c', '#ffd43b', '#7048e8'].map((c) => new THREE.Color(c))
/** Washing drying on a flat roof: a line between two posts, and the pagnes and shirts pegged on it. */
function washing(b: Builder, rect: { cx: number; cz: number; w: number; d: number; angle: number }, H: number, c: XZ) {
  const span = Math.min(rect.w - 2.5, 5)
  if (span < 2 || rect.d < 4) return
  const [ux, uz] = [Math.cos(rect.angle), Math.sin(rect.angle)]
  const [nx, nz] = [-uz, ux]
  const off = (hash(c[0], c[1], 31) - 0.5) * (rect.d - 3)
  const [cx, cz] = [rect.cx + nx * off, rect.cz + nz * off]
  for (const s of [-1, 1]) b.box(cx + ux * s * (span / 2), H + 0.85, cz + uz * s * (span / 2), 0.08, 1.7, 0.08, rect.angle, RAIL)
  b.box(cx, H + 1.66, cz, span, 0.025, 0.025, rect.angle, RAIL)
  const n = Math.floor(span / 0.75)
  for (let k = 0; k < n; k++) {
    if (hash(c[0] + k, c[1], 37) < 0.25) continue
    const t = (k + 0.5) / n - 0.5
    const h = 0.4 + hash(c[1], c[0] + k, 41) * 0.45
    b.box(cx + ux * t * span, H + 1.64 - h / 2, cz + uz * t * span, 0.55, h, 0.03, rect.angle, CLOTHES[Math.floor(hash(k, c[0] + c[1], 43) * CLOTHES.length)])
  }
}

/**
 * Sloping awnings over the shops: corrugated tin, or a painted canvas, 1.6 m
 * out from the wall over the pavement. Up to three a building.
 */
function awnings(B: BuildingBuilders, ring: XZ[], c: XZ) {
  let n = 0
  const runs = wallRuns(ring)
  for (let i = 0; i < runs.length && n < 3; i++) {
    const [p, q] = runs[i]
    const len = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (len < 7 || hash(c[0], i, 11) < 0.35) continue
    n++
    const [nx, nz] = normal(p, q)
    const [ux, uz] = [(q[0] - p[0]) / len, (q[1] - p[1]) / len]
    const w = Math.min(len - 2, 4 + hash(i, c[1]) * 8)
    const m = 0.5 + (hash(c[1], i) - 0.5) * (1 - w / len)
    const [cx, cz] = [p[0] + (q[0] - p[0]) * m, p[1] + (q[1] - p[1]) * m]
    const [ax, az, bx, bz] = [cx - (ux * w) / 2, cz - (uz * w) / 2, cx + (ux * w) / 2, cz + (uz * w) / 2]
    const [top, low, out] = [2.95, 2.45, 1.6]
    const up = Math.hypot(top - low, out)
    const nrm: [number, number, number] = [(nx * (top - low)) / up, out / up, (nz * (top - low)) / up]
    const tin = hash(c[0], c[1], i) < 0.5
    const to = tin ? B.tin : B.trim
    // (Every vertex of the tin has its paint: the roofs' colours, weathering.ts.)
    const col = tin ? tinPaint(hash(c[0] + i, c[1], 5)) : AWNINGS[Math.floor(hash(i, c[0], 3) * AWNINGS.length)]
    const ids = [
      to.vertex(ax, top, az, 0, 0, nrm, col),
      to.vertex(bx, top, bz, w / 2, 0, nrm, col),
      to.vertex(bx + nx * out, low, bz + nz * out, w / 2, out / 2, nrm, col),
      to.vertex(ax + nx * out, low, az + nz * out, 0, out / 2, nrm, col),
    ]
    to.facing(nrm, ids[0], ids[1], ids[2])
    to.facing(nrm, ids[0], ids[2], ids[3])
    // Seen from under it, too.
    const dn: [number, number, number] = [-nrm[0], -nrm[1], -nrm[2]]
    const shade = new THREE.Color('#5a5048')
    const jds = [B.trim.vertex(ax, top - 0.02, az, 0, 0, dn, shade), B.trim.vertex(bx, top - 0.02, bz, 1, 0, dn, shade), B.trim.vertex(bx + nx * out, low - 0.02, bz + nz * out, 1, 1, dn, shade), B.trim.vertex(ax + nx * out, low - 0.02, az + nz * out, 0, 1, dn, shade)]
    B.trim.facing(dn, jds[0], jds[1], jds[2])
    B.trim.facing(dn, jds[0], jds[2], jds[3])
  }
}

/**
 * The tin of a roof, one per house: painted orange or red, gone to rust,
 * the grey of galvanised sheet, a faded green (the texture's own shading is
 * kept, the colour is this: weathering.ts 'tin').
 */
const TIN_PAINTS: [string, number][] = [
  ['#c8643a', 0.3],
  ['#b5452f', 0.14],
  ['#9a5532', 0.18],
  ['#a3abb0', 0.2],
  ['#6f8f86', 0.1],
  ['#7a5640', 0.08],
]
const TIN_COLORS = TIN_PAINTS.map(([c]) => new THREE.Color(c))
function tinPaint(u: number) {
  let acc = 0
  for (let i = 0; i < TIN_PAINTS.length; i++) if (u < (acc += TIN_PAINTS[i][1])) return TIN_COLORS[i]
  return TIN_COLORS[0]
}

/** A roof of two plain slopes over a rectangle (half-length hw along `rot`, half-depth hd), its ridge along the length, and its gable ends. */
function lowRoof(b: Builder, cx: number, cz: number, hw: number, hd: number, rot: number, y0: number, y1: number, c: THREE.Color) {
  const [cs, sn] = [Math.cos(rot), Math.sin(rot)]
  const at = (x: number, z: number): XZ => [cx + x * cs - z * sn, cz + x * sn + z * cs]
  const slope = Math.hypot(hd, y1 - y0)
  for (const side of [-1, 1]) {
    // The slope's normal: out on its side, and up.
    const [nx, nz] = [-sn * side * ((y1 - y0) / slope), cs * side * ((y1 - y0) / slope)]
    const n: [number, number, number] = [nx, hd / slope, nz]
    const [e1, e2, r1, r2] = [at(-hw, side * hd), at(hw, side * hd), at(hw, 0), at(-hw, 0)]
    const ids = [b.vertex(e1[0], y0, e1[1], 0, 0, n, c), b.vertex(e2[0], y0, e2[1], hw * 2, 0, n, c), b.vertex(r1[0], y1, r1[1], hw * 2, slope, n, c), b.vertex(r2[0], y1, r2[1], 0, slope, n, c)]
    b.facing(n, ids[0], ids[1], ids[2])
    b.facing(n, ids[0], ids[2], ids[3])
    // The gable end on this side of the length.
    const g: [number, number, number] = [cs * side, 0, sn * side]
    const [a, d, t] = [at(side * hw, -hd), at(side * hw, hd), at(side * hw, 0)]
    b.facing(g, b.vertex(a[0], y0, a[1], 0, 0, g, c), b.vertex(d[0], y0, d[1], hd * 2, 0, g, c), b.vertex(t[0], y1, t[1], hd, y1 - y0, g, c))
  }
}

/** What stands on an Abidjan roof: water tanks, AC units, the stair head. */
function rooftop(b: Builder, inner: XZ[], H: number, c: XZ, size: number) {
  const spots = [0, 1, 2, 3, 4, 5].map((k) => {
    const a = hash(c[0], k) * Math.PI * 2
    const r = hash(k, c[1]) * size * 0.32
    return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r] as XZ
  })
  const free = spots.filter((p) => pointInRing(p, inner) && offsetRing(inner, -1.2).length && pointInRing(p, offsetRing(inner, -1.2)))
  const [t1, t2, a1, a2, cage] = free
  const rot = hash(c[1], c[0]) * Math.PI
  if (t1) {
    b.box(t1[0], H + 0.25, t1[1], 1.5, 0.5, 1.5, rot, SLAB)
    b.cylinder(t1[0], H + 0.5, t1[1], 0.62, 1.3, hash(c[0], 9) < 0.8 ? TANK : TANK_BLUE, 4)
  }
  if (t2 && size > 14) {
    b.box(t2[0], H + 0.25, t2[1], 1.5, 0.5, 1.5, rot, SLAB)
    b.cylinder(t2[0], H + 0.5, t2[1], 0.62, 1.3, TANK, 4)
  }
  if (a1) b.box(a1[0], H + 0.35, a1[1], 0.9, 0.7, 0.6, rot, AC)
  if (a2 && size > 18) b.box(a2[0], H + 0.35, a2[1], 0.9, 0.7, 0.6, rot + 0.3, AC)
  if (cage && H >= 4 * BLOCK) b.box(cage[0], H + 1.3, cage[1], 2.6, 2.6, 2.6, rot, new THREE.Color('#d8d2c6'))
  // A satellite dish, tilted to the sky, on one roof in two.
  const dish = free[5] ?? free[4]
  if (dish && hash(c[1], 21) < 0.5) {
    b.box(dish[0], H + 0.5, dish[1], 0.12, 1, 0.12, rot, RAIL)
    b.box(dish[0], H + 1.1, dish[1], 1.1, 0.9, 0.12, rot + 0.6, DISH)
  }
}
