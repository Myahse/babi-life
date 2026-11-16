import * as THREE from 'three'
import { extend, type ThreeElement } from '@react-three/fiber'
import { featuresKnown, keyOpenNow, onFeatures } from '../lib/features'
import { weakDevice } from '../lib/device'
import { lightPhoneNow } from '../lib/lightPhone'

// « Blocs arrondis » (the update « blocs-arrondis », step 2 of the « blocs réalistes » look, concept
// in the lab's kit.ts): the shared kits' boxes get a small chamfer on their twelve edges, so the sun
// draws a thin bright line along every edge and the blocks read as solid things instead of flat
// cards. 44 triangles a box instead of 12. While the update is shut, every helper here hands back the
// plain box, exactly as before.
//
// The chamfered box keeps BoxGeometry's contract: same size and bounding box, same six groups (a
// material array dresses each face as before), and each face's UVs in the same place: a point of a
// face reads the same texel as on the plain box. The edge strips and the corners take the border of
// one of their faces (the side's, so a Sim's face and a car's front aren't stretched). Collisions
// (Solid.tsx) take it as a box, by its bounds, as they took the plain one.

export const BLOCS = 'blocs-arrondis'
const HEARD_KEY = 'babi.blocs.ouvert'

function read(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const open = () => (featuresKnown() ? keyOpenNow(BLOCS) : read(HEARD_KEY) === '1')
onFeatures(() => {
  if (!featuresKnown()) return
  try {
    localStorage.setItem(HEARD_KEY, keyOpenNow(BLOCS) ? '1' : '0')
  } catch {
    // Private mode: as the server says, once it has.
  }
})

/**
 * How much of it a device draws.
 * - `proche`: the small phones (« Légère », « Téléphone léger »): the Sims, the cars, the furniture and the small props; the big boxes (filler buildings, walls) stay plain.
 * - `plein`: every box of the shared kits.
 */
export type BlocsTier = 'off' | 'proche' | 'plein'

// In development, ?blocs=off|proche|plein forces a tier (to compare them).
const FORCED = import.meta.env.DEV && typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('blocs') as BlocsTier | null) : null

/** The tier now. Read when a thing is made: what is already drawn keeps its boxes until it is made again. */
export function blocsTier(): BlocsTier {
  if (FORCED) return FORCED
  if (!open()) return 'off'
  return weakDevice || lightPhoneNow() ? 'proche' : 'plein'
}

/** On `proche`, boxes longer than this (m) stay plain: the buildings, seen from afar, where a chamfer costs triangles and can't be seen. */
const NEAR_MAX = 5
/** Thinner than this (m), no chamfer: it couldn't be seen (a sheet of paper, a line painted on the floor). */
const THIN = 0.03

/** Whether a box w×h×d gets its chamfer now. */
export function bevels(w: number, h: number, d: number, tier = blocsTier()) {
  if (tier === 'off') return false
  const lo = Math.min(Math.abs(w), Math.abs(h), Math.abs(d))
  if (lo < THIN) return false
  return tier === 'plein' || Math.max(Math.abs(w), Math.abs(h), Math.abs(d)) <= NEAR_MAX
}

/** The chamfer of a box: 5 % of its smallest side, from 4 mm to 5 cm. */
export const chamferOf = (w: number, h: number, d: number) => Math.min(0.05, Math.max(0.004, Math.min(w, h, d) * 0.05))

/* ---------- The chamfered box ---------- */

/** Face index in BoxGeometry's order (+x, -x, +y, -y, +z, -z) for axis a, sign s. */
const faceOf = (a: number, s: number) => a * 2 + (s > 0 ? 0 : 1)

/** u, v of a point on face f of a box of half sizes h, exactly as BoxGeometry lays them out (0..1 over the whole face). */
function uvOn(f: number, p: number[], h: number[]): [number, number] {
  const [x, y, z] = p
  const [hx, hy, hz] = h
  switch (f) {
    case 0: return [(hz - z) / (2 * hz), (y + hy) / (2 * hy)]
    case 1: return [(z + hz) / (2 * hz), (y + hy) / (2 * hy)]
    case 2: return [(x + hx) / (2 * hx), (hz - z) / (2 * hz)]
    case 3: return [(x + hx) / (2 * hx), (z + hz) / (2 * hz)]
    case 4: return [(x + hx) / (2 * hx), (y + hy) / (2 * hy)]
    default: return [(hx - x) / (2 * hx), (y + hy) / (2 * hy)]
  }
}

/**
 * A box w×h×d whose twelve edges are cut at 45° by `b` (chamferOf by default). Indexed, flat
 * normals, six groups like BoxGeometry; `userData.faces` holds each vertex's face (for faceUVs).
 */
export class BevelBoxGeometry extends THREE.BufferGeometry {
  override type = 'BevelBoxGeometry'
  parameters: { width: number; height: number; depth: number; bevel: number }
  constructor(width = 1, height = 1, depth = 1, bevel?: number) {
    super()
    const h = [width / 2, height / 2, depth / 2]
    const b = Math.min(bevel ?? chamferOf(width, height, depth), ...h.map((v) => v * 0.45))
    this.parameters = { width, height, depth, bevel: b }
    const pos: number[] = []
    const nrm: number[] = []
    const uv: number[] = []
    const faces: number[] = []
    // Triangles by the face that paints them (a group each).
    const byFace: number[][] = [[], [], [], [], [], []]
    const vert = (p: number[], n: number[], f: number) => {
      pos.push(p[0], p[1], p[2])
      nrm.push(n[0], n[1], n[2])
      uv.push(...uvOn(f, p, h))
      faces.push(f)
      return faces.length - 1
    }
    // A flat polygon (3 or 4 corners) painted by face f, wound to face outwards.
    const poly = (pts: number[][], f: number) => {
      const [p0, p1, p2] = pts
      const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]
      const v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]]
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      const g = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length)
      const flip = n[0] * g[0] + n[1] * g[1] + n[2] * g[2] < 0
      if (flip) n = n.map((x) => -x)
      const l = Math.hypot(n[0], n[1], n[2]) || 1
      n = n.map((x) => x / l)
      const ids = pts.map((p) => vert(p, n, f))
      const tri = (a: number, c: number, d: number) => (flip ? byFace[f].push(ids[a], ids[d], ids[c]) : byFace[f].push(ids[a], ids[c], ids[d]))
      tri(0, 1, 2)
      if (ids.length === 4) tri(0, 2, 3)
    }
    // Corner c (signs per axis) pushed out along axis a: on the face of axis a, inset by b on the others.
    const vtx = (c: number[], a: number) => c.map((s, k) => (k === a ? s * h[k] : s * (h[k] - b)))
    // The six faces' flat parts.
    for (let a = 0; a < 3; a++)
      for (const s of [1, -1]) {
        const [i, j] = [0, 1, 2].filter((k) => k !== a)
        const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([si, sj]) => {
          const c = [0, 0, 0]
          c[a] = s
          c[i] = si
          c[j] = sj
          return vtx(c, a)
        })
        poly(q, faceOf(a, s))
      }
    // The twelve edge strips, between the faces of axes a and c: painted by the side (x, then z), not the top or the front.
    const owner = (a: number, sa: number, c: number, sc: number) => (a === 1 ? faceOf(c, sc) : c === 1 ? faceOf(a, sa) : a === 0 ? faceOf(a, sa) : faceOf(c, sc))
    for (let a = 0; a < 3; a++)
      for (let c = a + 1; c < 3; c++) {
        const e = 3 - a - c
        for (const sa of [1, -1])
          for (const sc of [1, -1]) {
            const corner = (se: number) => {
              const k = [0, 0, 0]
              k[a] = sa
              k[c] = sc
              k[e] = se
              return k
            }
            poly([vtx(corner(-1), a), vtx(corner(1), a), vtx(corner(1), c), vtx(corner(-1), c)], owner(a, sa, c, sc))
          }
      }
    // The eight corners, painted by the x side.
    for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) poly([vtx([sx, sy, sz], 0), vtx([sx, sy, sz], 1), vtx([sx, sy, sz], 2)], faceOf(0, sx))
    const index: number[] = []
    byFace.forEach((list, f) => {
      this.addGroup(index.length, list.length, f)
      index.push(...list)
    })
    this.setIndex(index)
    this.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    this.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
    this.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    this.userData.faces = Uint8Array.from(faces)
  }
  override copy(source: BevelBoxGeometry) {
    super.copy(source)
    this.parameters = { ...source.parameters }
    this.userData.faces = source.userData.faces
    return this
  }
}

// <bevelBoxGeometry args={[w, h, d]} /> beside <boxGeometry />: made and disposed with its mesh, like it.
extend({ BevelBoxGeometry })
declare module '@react-three/fiber' {
  interface ThreeElements {
    bevelBoxGeometry: ThreeElement<typeof BevelBoxGeometry>
  }
}

/**
 * Each vertex's face-local u, v (0..1, as BoxGeometry has them) handed to `to` with its face, and
 * the uv set to what it returns: for the kits that point each face at its own part of a texture (the
 * Sims' sheets). Works on a plain BoxGeometry too (four vertices a face).
 */
export function faceUVs(g: THREE.BufferGeometry, to: (f: number, u: number, v: number) => [number, number]) {
  const uv = g.attributes.uv as THREE.BufferAttribute
  const faces = g.userData.faces as Uint8Array | undefined
  for (let k = 0; k < uv.count; k++) {
    const [u, v] = to(faces ? faces[k] : Math.floor(k / 4), uv.getX(k), uv.getY(k))
    uv.setXY(k, u, v)
  }
  uv.needsUpdate = true
}

/** A box w×h×d for a kit: chamfered when the update says so, else the plain box. Not cached: the caller owns it. */
export function newBox(w: number, h: number, d: number, tier = blocsTier()): THREE.BufferGeometry {
  return bevels(w, h, d, tier) ? new BevelBoxGeometry(w, h, d) : new THREE.BoxGeometry(w, h, d)
}

/* ---------- The kits' unit boxes ---------- */

/** The plain unit box, shared (the kits scale it to each block's size). */
export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1)
const sizedCache = new Map<string, BevelBoxGeometry>()
/** Past this many sizes the cache stops growing (sizes drawn at random); the rest keep the plain box. */
const SIZED_MAX = 4000

/**
 * For the kits that draw a block as the unit box scaled to its size (`<mesh geometry={BOX} scale={s}>`):
 * a chamfered box of that size, shared and kept, with no scale (a scaled unit box would stretch its
 * chamfer), or the plain unit box and the size as its scale. Spread it on the mesh: `{...sizedBox(s)}`.
 * Only for blocks whose scale nothing animates.
 */
export function sizedBox(s: [number, number, number], tier = blocsTier()): { geometry: THREE.BufferGeometry; scale: [number, number, number] } {
  const [w, h, d] = s
  if (!bevels(w, h, d, tier) || w <= 0 || h <= 0 || d <= 0) return { geometry: UNIT_BOX, scale: s }
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`
  let g = sizedCache.get(key)
  if (!g) {
    if (sizedCache.size >= SIZED_MAX) return { geometry: UNIT_BOX, scale: s }
    sizedCache.set(key, (g = new BevelBoxGeometry(w, h, d)))
  }
  return { geometry: g, scale: ONE }
}
const ONE: [number, number, number] = [1, 1, 1]
