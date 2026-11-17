import * as THREE from 'three'
import { hash, type XZ } from './geo'
import { BLOCK } from './tiles'
import { band, contactShade, normal, orientedRect, signedArea, storeys, wallRuns, type BuildingBuilders } from './buildings'
import { TOWER_CONCRETE, TOWER_GLASS, towerKind, towerTint } from './towerKind'

// « Façades réalistes » (facades.ts): the tall buildings (the Plateau's towers, the high blocks
// elsewhere) as towers rather than tall boxes of windows, after the concept's five kinds:
// - `verre`: a glass tower with two setbacks;
// - `grille`: white concrete in a grid, deep fins every 2.4 m (the administrative towers);
// - `gradins`: stepped like a pyramid, bronze glass;
// - `couronne`: the tallest, glass, an open crown of fins over its roof and a spire;
// - `ailettes`: glass with vertical fins down its walls.
// The glass is its own mesh (`glass`: the sky reflected where the light gives an environment map,
// the offices lit at dusk and at night, out in a power cut); the concrete grid too (`tower`); fins,
// crowns, parapets and the rooftop plant one more (`towerTrim`). The setbacks only go in from the
// building's outline (its collisions and its door stay where they were), the fins start above the
// ground floor. A whole tower is a few hundred to two thousand triangles, merged with the chunk.

export { TOWER_FROM } from './towerKind'
const GLASS = TOWER_GLASS.map((c) => new THREE.Color(c))
const CONCRETE = TOWER_CONCRETE.map((c) => new THREE.Color(c))
const LOBBY = new THREE.Color('#e9edf0')
const FIN = new THREE.Color('#c9ced3')
const FIN_DARK = new THREE.Color('#8d959c')
const PLANT = new THREE.Color('#bfc3c6')
const ANTENNA = new THREE.Color('#d0d3d6')
const RED = new THREE.Color('#d0302a')
const PLINTH = new THREE.Color('#8f8372')

/** A rectangle (middle, half sides along `angle`) as an outline wound the game's way. */
function rectRing(cx: number, cz: number, hw: number, hd: number, angle: number): XZ[] {
  const [c, s] = [Math.cos(angle), Math.sin(angle)]
  const at = (u: number, v: number): XZ => [cx + u * c - v * s, cz + u * s + v * c]
  const r = [at(-hw, -hd), at(hw, -hd), at(hw, hd), at(-hw, hd)]
  return signedArea(r) > 0 ? r : r.reverse()
}

/** Vertical fins down the walls of `ring` from y0 to y1, every `gap` metres, `depth` out. */
function fins(b: BuildingBuilders['towerTrim'], ring: XZ[], y0: number, y1: number, gap: number, depth: number, col: THREE.Color, max = 160) {
  let n = 0
  for (const [p, q] of wallRuns(ring)) {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (len < 5) continue
    const [nx, nz] = normal(p, q)
    const rot = Math.atan2(q[1] - p[1], q[0] - p[0])
    const k = Math.floor(len / gap)
    for (let i = 1; i < k && n < max; i++, n++) {
      const t = (i * gap + (len - k * gap) / 2) / len
      b.box(p[0] + (q[0] - p[0]) * t + nx * depth / 2, (y0 + y1) / 2, p[1] + (q[1] - p[1]) * t + nz * depth / 2, 0.22, y1 - y0, depth, rot, col)
    }
  }
}

/** A section's top: the roof slab and a parapet round it. */
function top(B: BuildingBuilders, ring: XZ[], y: number, col: THREE.Color, parapet = 1.1) {
  B.roofs.flat([ring], y + 0.02, BLOCK * 2)
  band(B.towerTrim, ring, y, y + parapet, 0, col, false)
  // The parapet's inside, seen from the setback above.
  band(B.towerTrim, [...ring].reverse(), y, y + parapet, 0, col.clone().multiplyScalar(0.8), false)
}

/** What stands on a tower's roof: the plant room, cooling units, a tank, antennas with their red light. */
function plant(B: BuildingBuilders, ring: XZ[], y: number, c: XZ, big: boolean) {
  const r = orientedRect(ring)
  const [w, d] = [Math.max(2, r.w * 0.4), Math.max(2, r.d * 0.35)]
  B.towerTrim.box(r.cx, y + 1.8, r.cz, w, 3.6, d, r.angle, PLANT)
  const [ux, uz] = [Math.cos(r.angle), Math.sin(r.angle)]
  const [vx, vz] = [-uz, ux]
  for (const s of [-1, 1]) {
    const [x, z] = [r.cx + ux * s * (w / 2 + 1.4), r.cz + uz * s * (w / 2 + 1.4)]
    if (r.w > w + 4) {
      B.towerTrim.box(x, y + 0.9, z, 1.8, 1.8, 1.8, r.angle, CONCRETE[1])
      B.towerTrim.box(x, y + 1.85, z, 1.2, 0.1, 1.2, r.angle, FIN_DARK)
    }
  }
  if (big) {
    const [x, z] = [r.cx + vx * (d / 2 - 0.5), r.cz + vz * (d / 2 - 0.5)]
    B.towerTrim.box(x, y + 3.6 + 3, z, 0.18, 6, 0.18, r.angle, ANTENNA)
    B.towerTrim.box(x, y + 3.6 + 6.15, z, 0.3, 0.3, 0.3, r.angle, RED)
  }
  B.towerTrim.cylinder(r.cx - vx * (d / 2 + 1), y, r.cz - vz * (d / 2 + 1), 0.8, 1.6, FIN_DARK, 8)
  void c
}

/**
 * The building as a tower, if it is one (true: drawn here; false: addBuilding draws it as before).
 * `ring` is wound the game's way.
 */
export function addTower(B: BuildingBuilders, ring: XZ[], H: number, c: XZ): boolean {
  const rect = orientedRect(ring)
  const area = Math.abs(signedArea(ring))
  const rectLike = area / Math.max(1, rect.w * rect.d) > 0.86
  // (The horizon's blocks pick the same kind and tint: towerKind.ts.)
  const kind = towerKind(c, H, Math.min(rect.w, rect.d), rectLike)
  if (!kind) return false
  const glass = kind !== 'grille'
  const tint = (glass ? GLASS : CONCRETE)[towerTint(c, kind)]
  const walls = glass ? B.glass : B.tower
  const shift = Math.floor(hash(c[0], c[1], 5) * 16)
  const trimCol = glass ? FIN : tint.clone().multiplyScalar(0.92)

  // The foot: a plinth, the lobby's glazed doors.
  band(B.trim, ring, 0, 0.45, 0.06, PLINTH, false)
  storeys(B.entrance, ring, 0, BLOCK, LOBBY)
  // A canopy over the lobby, on the longest wall.
  const runs = wallRuns(ring)
  let best = runs[0]
  for (const x of runs) if (Math.hypot(x[1][0] - x[0][0], x[1][1] - x[0][1]) > Math.hypot(best[1][0] - best[0][0], best[1][1] - best[0][1])) best = x
  {
    const [p, q] = best
    const len = Math.hypot(q[0] - p[0], q[1] - p[1])
    const [nx, nz] = normal(p, q)
    B.towerTrim.box((p[0] + q[0]) / 2 + nx * 1.5, BLOCK - 0.15, (p[1] + q[1]) / 2 + nz * 1.5, Math.min(len * 0.5, 10), 0.3, 3, Math.atan2(q[1] - p[1], q[0] - p[0]), FIN_DARK)
  }

  // The shaft in sections: each one's outline, its foot and its top.
  const sections: { ring: XZ[]; y0: number; y1: number }[] = []
  const snap = (y: number) => Math.max(2 * BLOCK, Math.round(y / BLOCK) * BLOCK)
  if (kind === 'verre' && rectLike && Math.min(rect.w, rect.d) >= 16) {
    const [a, b] = [snap(H * 0.62), snap(H * 0.84)]
    sections.push({ ring, y0: BLOCK, y1: a })
    sections.push({ ring: rectRing(rect.cx, rect.cz, rect.w / 2 - 2.4, rect.d / 2 - 2.4, rect.angle), y0: a, y1: Math.max(a + BLOCK, b) })
    sections.push({ ring: rectRing(rect.cx, rect.cz, rect.w / 2 - 4.8, rect.d / 2 - 4.8, rect.angle), y0: Math.max(a + BLOCK, b), y1: H })
  } else if (kind === 'gradins') {
    const steps = 4
    let y = BLOCK
    for (let i = 0; i < steps; i++) {
      const y1 = i === steps - 1 ? H : Math.max(y + BLOCK, snap(H * (0.45 + (0.55 * (i + 1)) / steps)))
      const inset = i * Math.min(2.6, (Math.min(rect.w, rect.d) / 2 - 3) / steps)
      sections.push({ ring: i ? rectRing(rect.cx, rect.cz, rect.w / 2 - inset, rect.d / 2 - inset, rect.angle) : ring, y0: y, y1 })
      y = y1
      if (y >= H) break
    }
  } else sections.push({ ring, y0: BLOCK, y1: H })

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    storeys(walls, s.ring, s.y0, s.y1, tint, 1, shift)
    // The slab at each setback (the next section stands on it), and the very top.
    top(B, s.ring, s.y1, trimCol, i === sections.length - 1 ? (kind === 'couronne' ? 0.6 : 1.2) : 1)
    // Floor bands of the glass ones (a thin metal line every three storeys), fins.
    if (kind === 'grille') fins(B.towerTrim, s.ring, s.y0 + 0.2, s.y1, 2.4, 0.7, trimCol)
    if (kind === 'ailettes') fins(B.towerTrim, s.ring, s.y0 + 0.2, s.y1, 3, 0.45, FIN)
  }
  const last = sections[sections.length - 1]
  const roof = last.ring
  if (kind === 'couronne') {
    // The open crown: fins rising 7 m round the roof, a ring tying them, the spire with its light.
    fins(B.towerTrim, roof, H, H + 7, 1.6, 0.5, FIN, 120)
    band(B.towerTrim, roof, H + 6.4, H + 7, 0.25, FIN, false)
    const rr = orientedRect(roof)
    B.towerTrim.box(rr.cx, H + 9, rr.cz, 0.9, 18, 0.9, rr.angle, FIN)
    B.towerTrim.box(rr.cx, H + 22, rr.cz, 0.35, 10, 0.35, rr.angle, ANTENNA)
    B.towerTrim.box(rr.cx, H + 27.2, rr.cz, 0.45, 0.45, 0.45, rr.angle, RED)
  } else plant(B, roof, H, c, H >= 45)
  contactShade(B, ring)
  return true
}
