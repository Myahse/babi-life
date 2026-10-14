import * as THREE from 'three'
import { Builder } from './builder'
import { hash, pointInRing, type XZ } from './geo'
import { BLOCK, type Building } from './tiles'

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
  universite: 'institution', school: 'institution', health: 'hospital', mairie: 'civic', office: 'civic', culture: 'civic', worship: 'civic', police: 'civic',
  hotel: 'hotel', mall: 'commerce', market: 'commerce', restaurant: 'commerce', maquis: 'commerce', club: 'commerce', barbier: 'commerce', salon: 'commerce', transport: 'commerce', home: 'home',
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
  contact: Builder // the shade on the ground around the walls (RGBA)
}

export function newBuildingBuilders(): BuildingBuilders {
  return { walls: new Builder(), inst: new Builder(), entrance: new Builder(), shop: new Builder(), house: new Builder(), trim: new Builder(), roofs: new Builder(), tin: new Builder(), contact: new Builder(true) }
}

// Façades of Abidjan: whites, creams, ochres, pastels.
const FACADES = ['#ffffff', '#fff3e0', '#ffe0b2', '#fff9c4', '#ffe8cc', '#e3f2fd', '#f8d7e3', '#e8f5e9', '#f1e3c8', '#ffd6a5', '#eeeeee', '#fbe7c6'].map((c) => new THREE.Color(c))
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

/** Walls textured one tile per storey and per 3 m, between y0 and y1. */
function storeys(b: Builder, ring: XZ[], y0: number, y1: number, c: THREE.Color) {
  let run = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % ring.length]
    const len = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (len < 0.05) continue
    const [nx, nz] = normal(p, q)
    const n: [number, number, number] = [nx, 0, nz]
    const u0 = Math.round(run / BLOCK)
    const u1 = u0 + Math.max(1, Math.round(len / BLOCK))
    const a = b.vertex(p[0], y0, p[1], u0, y0 / BLOCK, n, c.clone().multiplyScalar(ao(y0)))
    const d = b.vertex(q[0], y0, q[1], u1, y0 / BLOCK, n, c.clone().multiplyScalar(ao(y0)))
    const e = b.vertex(q[0], y1, q[1], u1, y1 / BLOCK, n, c.clone().multiplyScalar(ao(y1)))
    const f = b.vertex(p[0], y1, p[1], u0, y1 / BLOCK, n, c.clone().multiplyScalar(ao(y1)))
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
  const pitched = (style === 'default' || style === 'home') && H <= 2 * BLOCK && rectLike && Math.min(rect.w, rect.d) < 20 && r1 < 0.8
  const shops = style === 'commerce' || (style === 'default' && H >= 2 * BLOCK && r2 < 0.5)

  // Plinth, ground floor, upper storeys.
  band(B.trim, ring, 0, 0.45, 0.06, PLINTH, false)
  const glazed = pub || style === 'civic' || style === 'hotel'
  storeys(glazed ? B.entrance : shops ? B.shop : B.house, ring, 0, BLOCK, tint)
  if (H > BLOCK) storeys(pub ? B.inst : B.walls, ring, BLOCK, H, tint)
  // A ledge at every floor (a blue band on a hospital).
  const ledge = style === 'hospital' ? HOSPITAL_BAND : tint.clone().multiplyScalar(0.86)
  for (let y = BLOCK; y < H; y += BLOCK) band(B.trim, ring, y - 0.12, y + 0.1, 0.14, ledge, false)

  if (pitched) {
    // A sloping tin roof along the long side, with its gables.
    let { w, d, angle } = rect
    if (d > w) {
      ;[w, d] = [d, w]
      angle += Math.PI / 2
    }
    const [c, s] = [Math.cos(angle), Math.sin(angle)]
    const at = (u: number, v: number): XZ => [rect.cx + u * c - v * s, rect.cz + u * s + v * c]
    const rise = Math.max(0.8, Math.min(2.4, d * 0.3))
    const o = 0.45
    const drop = (o * rise) / (d / 2)
    for (const side of [1, -1]) {
      const [e1, e2, r1p, r2p] = [at(-w / 2 - o, side * (d / 2 + o)), at(w / 2 + o, side * (d / 2 + o)), at(w / 2 + o, 0), at(-w / 2 - o, 0)]
      const slope = Math.hypot(d / 2 + o, rise + drop)
      const ny = (d / 2) / Math.hypot(d / 2, rise)
      const nh = rise / Math.hypot(d / 2, rise)
      const n: [number, number, number] = [-s * side * nh, ny, c * side * nh]
      const ids = [
        B.tin.vertex(e1[0], H - drop, e1[1], 0, 0, n),
        B.tin.vertex(e2[0], H - drop, e2[1], (w + 2 * o) / 2, 0, n),
        B.tin.vertex(r1p[0], H + rise, r1p[1], (w + 2 * o) / 2, slope / 2, n),
        B.tin.vertex(r2p[0], H + rise, r2p[1], 0, slope / 2, n),
      ]
      B.tin.facing(n, ids[0], ids[1], ids[2])
      B.tin.facing(n, ids[0], ids[2], ids[3])
    }
    for (const end of [1, -1]) {
      const [a, b, top] = [at(end * w / 2, -d / 2), at(end * w / 2, d / 2), at(end * w / 2, 0)]
      const n: [number, number, number] = [c * end, 0, s * end]
      const g = tint.clone().multiplyScalar(0.95)
      const ia = B.trim.vertex(a[0], H, a[1], 0, 0, n, g)
      const ib = B.trim.vertex(b[0], H, b[1], 1, 0, n, g)
      const it = B.trim.vertex(top[0], H + rise, top[1], 0.5, 1, n, g)
      B.trim.facing(n, ia, ib, it)
    }
    // Under the eaves, a flat ceiling keeps the house closed.
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
    B.roofs.flat([inner], H + 0.02, BLOCK)
    rooftop(B.trim, inner, H, bd.c, Math.sqrt(area))
  }

  // Balconies on the bigger buildings, along their longest side.
  if ((H >= 3 * BLOCK && r1 > 0.45 && !pub) || (style === 'hotel' && H >= 2 * BLOCK)) {
    let best = 0
    let bi = 0
    for (let i = 0; i < ring.length; i++) {
      const l = Math.hypot(ring[(i + 1) % ring.length][0] - ring[i][0], ring[(i + 1) % ring.length][1] - ring[i][1])
      if (l > best) [best, bi] = [l, i]
    }
    const p = ring[bi]
    const q = ring[(bi + 1) % ring.length]
    const [nx, nz] = normal(p, q)
    const rot = Math.atan2(q[1] - p[1], q[0] - p[0])
    const len = Math.min(best * 0.6, 12)
    const [mx, mz] = [(p[0] + q[0]) / 2 + nx * 0.6, (p[1] + q[1]) / 2 + nz * 0.6]
    for (let y = BLOCK; y < H; y += BLOCK) {
      B.trim.box(mx, y + 0.08, mz, len, 0.16, 1.2, rot, SLAB)
      B.trim.box(mx + nx * 0.56, y + 0.6, mz + nz * 0.56, len, 0.9, 0.06, rot, RAIL)
    }
  }

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
    b.cylinder(t1[0], H + 0.5, t1[1], 0.62, 1.3, hash(c[0], 9) < 0.8 ? TANK : TANK_BLUE)
  }
  if (t2 && size > 14) {
    b.box(t2[0], H + 0.25, t2[1], 1.5, 0.5, 1.5, rot, SLAB)
    b.cylinder(t2[0], H + 0.5, t2[1], 0.62, 1.3, TANK)
  }
  if (a1) b.box(a1[0], H + 0.35, a1[1], 0.9, 0.7, 0.6, rot, AC)
  if (a2 && size > 18) b.box(a2[0], H + 0.35, a2[1], 0.9, 0.7, 0.6, rot + 0.3, AC)
  if (cage && H >= 4 * BLOCK) b.box(cage[0], H + 1.3, cage[1], 2.6, 2.6, 2.6, rot, new THREE.Color('#d8d2c6'))
}
