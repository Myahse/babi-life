import { centroid, hash, pointInRing, type XZ } from './geo'
import type { Building, ChunkData } from './tiles'
import { blockRing } from './voxel'
import { deckWidth } from './bridgeLine'

// The map has the streets of every quarter, but not always their houses:
// in much of Abidjan (whole blocks of Yopougon, Abobo…) OpenStreetMap draws
// the streets and leaves the blocks empty. Where a street has nothing along
// it, the game builds what stands along such streets: houses side by side,
// one storey under tin (the cours communes), a second row behind on the
// quiet streets, and on the big roads buildings of two or three storeys.
// Never on a real building, a road, water, a forest, a park, a pitch, a
// campus or a hospital's grounds. Everything comes from the place alone
// (hash of the position), so every player sees the same houses.

/** Occupancy grid: 1.5 m cells, the world's block grid. */
const CELL = 1.5
const FILL_ROADS: Record<string, { storeys: number[]; second: boolean }> = {
  primary: { storeys: [1, 2, 2, 3, 3, 4], second: false },
  secondary: { storeys: [1, 1, 2, 2, 3], second: false },
  tertiary: { storeys: [1, 1, 1, 2, 2, 3], second: true },
  street: { storeys: [1, 1, 1, 1, 1, 2], second: true },
  street_limited: { storeys: [1, 1, 1, 2], second: true },
  service: { storeys: [1, 1, 1, 1, 2], second: true },
  track: { storeys: [1, 1, 1, 1, 1, 1, 2], second: true },
  // In the quarters, a « path » on the map is often the alley between the cours.
  path: { storeys: [1], second: true },
}
/** No more game houses than this in a chunk (one 610 m tile). */
const MAX_FILL = 1100

/**
 * Builds the empty blocks of a chunk. `neighbours` are the real buildings
 * just over its edges (they belong to the next chunk but take room here).
 */
export function fillQuarters(chunk: ChunkData, neighbours: XZ[][] = [], keepClear: { at: XZ; r: number }[] = []) {
  const { box } = chunk
  const nx = Math.ceil((box.x1 - box.x0) / CELL)
  const nz = Math.ceil((box.z1 - box.z0) / CELL)
  const grid = new Uint8Array(nx * nz)
  const cellOf = (x: number, z: number) => {
    const i = Math.floor((x - box.x0) / CELL)
    const j = Math.floor((z - box.z0) / CELL)
    return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i
  }
  const mark = (x: number, z: number) => {
    const c = cellOf(x, z)
    if (c >= 0) grid[c] = 1
  }
  const bounds = (ring: XZ[]) => {
    let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, z] of ring) [x0, z0, x1, z1] = [Math.min(x0, x), Math.min(z0, z), Math.max(x1, x), Math.max(z1, z)]
    return [x0, z0, x1, z1]
  }
  // What's taken: buildings (with a step of air round them), the ground of
  // water, green, pitches, campuses, hospitals and aprons, and the roads.
  const fillRing = (ring: XZ[], pad: number) => {
    const [x0, z0, x1, z1] = bounds(ring)
    for (let x = x0 - pad; x <= x1 + pad; x += CELL)
      for (let z = z0 - pad; z <= z1 + pad; z += CELL) {
        if (pad > 0 || pointInRing([x, z], ring)) mark(x, z)
      }
  }
  for (const b of chunk.buildings) fillRing(b.ring, CELL)
  for (const r of neighbours) fillRing(r, CELL)
  for (const a of chunk.areas) fillRing(a.rings[0], 0)
  for (const r of chunk.roads) {
    // A bridge's deck (and the embankment of its ramps) is wider than its roadway.
    const half = (r.bridge ? deckWidth(r, 0) : r.width) / 2 + 1
    for (let i = 1; i < r.pts.length; i++) {
      const [ax, az] = r.pts[i - 1]
      const [bx, bz] = r.pts[i]
      const len = Math.hypot(bx - ax, bz - az)
      const [ux, uz] = len ? [(bx - ax) / len, (bz - az) / len] : [1, 0]
      for (let s = 0; s <= len; s += CELL / 2)
        for (let w = -half; w <= half; w += CELL / 2) mark(ax + ux * s - uz * w, az + uz * s + ux * w)
    }
  }
  for (const a of chunk.aeroways) for (const p of a.pts) mark(p[0], p[1])
  // Ground the game builds on itself (a toll plaza): nothing there.
  for (const { at: [cx, cz], r } of keepClear)
    for (let x = cx - r; x <= cx + r; x += CELL)
      for (let z = cz - r; z <= cz + r; z += CELL) if (Math.hypot(x - cx, z - cz) <= r) mark(x, z)

  /** A lot along the street: free, and wholly inside this chunk. */
  const free = (c: XZ, u: XZ, n: XZ, w: number, d: number) => {
    // Inset half a cell: the grid is coarse, a lot may touch its neighbours.
    for (let a = -w / 2 + CELL / 2; a <= w / 2 - CELL / 2; a += CELL / 2)
      for (let b = -d / 2 + CELL / 2; b <= d / 2 - CELL / 2; b += CELL / 2) {
        const x = c[0] + u[0] * a + n[0] * b
        const z = c[1] + u[1] * a + n[1] * b
        const k = cellOf(x, z)
        if (k < 0 || grid[k]) return false
      }
    return true
  }
  const take = (ring: XZ[]) => fillRing(ring, 0)

  let made = 0
  const add = (c: XZ, u: XZ, n: XZ, w: number, d: number, storeys: number) => {
    const rect: XZ[] = [
      [c[0] - u[0] * w / 2 - n[0] * d / 2, c[1] - u[1] * w / 2 - n[1] * d / 2],
      [c[0] + u[0] * w / 2 - n[0] * d / 2, c[1] + u[1] * w / 2 - n[1] * d / 2],
      [c[0] + u[0] * w / 2 + n[0] * d / 2, c[1] + u[1] * w / 2 + n[1] * d / 2],
      [c[0] - u[0] * w / 2 + n[0] * d / 2, c[1] - u[1] * w / 2 + n[1] * d / 2],
    ]
    const ring = blockRing(rect, [], c)
    if (ring.length < 4) return
    take(rect)
    const b: Building = { ring, holes: [], height: storeys * 3, c: centroid(ring), tint: hash(c[1], c[0]), tin: hash(c[0], c[1], 41) < 0.9 }
    chunk.buildings.push(b)
    made++
  }

  for (const r of chunk.roads) {
    const rule = FILL_ROADS[r.cls]
    if (!rule || r.bridge) continue
    for (let i = 1; i < r.pts.length && made < MAX_FILL; i++) {
      const [ax, az] = r.pts[i - 1]
      const [bx, bz] = r.pts[i]
      const len = Math.hypot(bx - ax, bz - az)
      if (len < 6) continue
      const u: XZ = [(bx - ax) / len, (bz - az) / len]
      let s = 3
      while (s < len - 3 && made < MAX_FILL) {
        const h = hash(Math.round(ax + u[0] * s), Math.round(az + u[1] * s), 17)
        // A frontage of 6 to 12 m, 7.5 to 10.5 m deep.
        const w = 6 + Math.floor(h * 5) * 1.5
        const p: XZ = [ax + u[0] * (s + w / 2), az + u[1] * (s + w / 2)]
        for (const side of [-1, 1]) {
          const n: XZ = [-u[1] * side, u[0] * side]
          const hs = hash(p[0], p[1], side + 23)
          if (hs < 0.07) continue // an empty lot, a yard, a way through
          const d = 7.5 + Math.floor(hs * 3) * 1.5
          const off = r.width / 2 + 2.5 + d / 2
          const c: XZ = [p[0] + n[0] * off, p[1] + n[1] * off]
          if (!free(c, u, n, w, d)) continue
          const storeys = rule.storeys[Math.floor(hash(c[0], c[1], 29) * rule.storeys.length)]
          add(c, u, n, w - 0.5, d, storeys)
          // Behind it, on a quiet street, the other houses of the cour.
          if (rule.second && hash(c[1], c[0], 31) < 0.75) {
            const d2 = 6 + Math.floor(hash(c[0], c[1], 37) * 3) * 1.5
            const c2: XZ = [c[0] + n[0] * (d / 2 + 3 + d2 / 2), c[1] + n[1] * (d / 2 + 3 + d2 / 2)]
            if (free(c2, u, n, w, d2)) add(c2, u, n, w - 0.5, d2, 1)
          }
        }
        s += w + 0.5
      }
    }
  }
}

