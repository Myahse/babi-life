import { centroid, hash, pointInRing, type XZ } from './geo'
import type { Building, ChunkData } from './tiles'
import { blockRing } from './voxel'
import { deckWidth } from './bridgeLine'

// The map has the streets of every quarter, but not always their houses:
// in much of Abidjan (whole blocks of Yopougon, Abobo…) OpenStreetMap draws
// the streets and leaves the blocks empty. Where a street has nothing along
// it, the game builds what stands along such streets: houses side by side,
// one storey under tin (the cours communes), a second row behind on the
// quiet streets. Along the big roads (the boulevards, the VGE), not little
// houses but what lines them: supermarkets and malls, showrooms, office
// blocks, now and then a hotel, set back behind their car park; buildings of
// two to four storeys with shops below between them.
// Now and then, on the quarters' streets, a couloir between two houses: a
// passage two or three metres wide from the street to the back of the cours
// (the nouchis hang about in some of them, nouchis.tsx).
// Never on a real building, a road, water, a forest, a park, a pitch, a
// campus, a hospital's grounds or an airfield (its runways all along). Everything comes from the place alone
// (hash of the position), so every player sees the same houses.

/** Occupancy grid: 1.5 m cells, the world's block grid. */
const CELL = 1.5
/** `shops`: the share of the frontage given to the big commercial buildings (the rest: buildings of a few storeys). */
const FILL_ROADS: Record<string, { storeys: number[]; second: boolean; shops?: number }> = {
  trunk: { storeys: [2, 3, 3, 4], second: false, shops: 0.75 },
  primary: { storeys: [2, 2, 3, 3, 4], second: false, shops: 0.6 },
  secondary: { storeys: [1, 2, 2, 3], second: false, shops: 0.3 },
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
  // Runways and taxiways all along, with their shoulders (the map has them as lines, two points for a runway).
  for (const a of chunk.aeroways) {
    const half = a.cls === 'runway' ? 40 : 18
    for (let i = 1; i < a.pts.length; i++) {
      const [ax, az] = a.pts[i - 1]
      const [bx, bz] = a.pts[i]
      const len = Math.hypot(bx - ax, bz - az)
      const [ux, uz] = len ? [(bx - ax) / len, (bz - az) / len] : [1, 0]
      for (let s = 0; s <= len; s += CELL)
        for (let w = -half; w <= half; w += CELL) mark(ax + ux * s - uz * w, az + uz * s + ux * w)
    }
  }
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
  /** Keeps a narrow strip free: sampled along its own sides (a strip thinner than a cell slips between the grid's points). */
  const keep = (c: XZ, u: XZ, n: XZ, w: number, d: number) => {
    for (let a = -w / 2; a <= w / 2; a += CELL / 3) for (let b = -d / 2; b <= d / 2; b += CELL / 3) mark(c[0] + u[0] * a + n[0] * b, c[1] + u[1] * a + n[1] * b)
  }
  const couloirs: NonNullable<ChunkData['couloirs']> = (chunk.couloirs = [])

  let made = 0
  const add = (c: XZ, u: XZ, n: XZ, w: number, d: number, storeys: number, style?: Building['style'], height = storeys * 3) => {
    const rect: XZ[] = [
      [c[0] - u[0] * w / 2 - n[0] * d / 2, c[1] - u[1] * w / 2 - n[1] * d / 2],
      [c[0] + u[0] * w / 2 - n[0] * d / 2, c[1] + u[1] * w / 2 - n[1] * d / 2],
      [c[0] + u[0] * w / 2 + n[0] * d / 2, c[1] + u[1] * w / 2 + n[1] * d / 2],
      [c[0] - u[0] * w / 2 + n[0] * d / 2, c[1] - u[1] * w / 2 + n[1] * d / 2],
    ]
    const ring = blockRing(rect, [], c)
    if (ring.length < 4) return
    take(rect)
    const b: Building = style
      ? { ring, holes: [], height, c: centroid(ring), tint: hash(c[1], c[0]), fill: true, style }
      : { ring, holes: [], height: storeys * 3, c: centroid(ring), tint: hash(c[1], c[0]), fill: true, tin: storeys <= 2 && hash(c[0], c[1], 41) < 0.9 }
    chunk.buildings.push(b)
    made++
  }

  for (const r of chunk.roads) {
    const rule = FILL_ROADS[r.cls]
    if (!rule || r.bridge) continue
    const later: (() => void)[] = []
    for (let i = 1; i < r.pts.length && made < MAX_FILL; i++) {
      const [ax, az] = r.pts[i - 1]
      const [bx, bz] = r.pts[i]
      const len = Math.hypot(bx - ax, bz - az)
      if (len < 6) continue
      const u: XZ = [(bx - ax) / len, (bz - az) / len]
      let s = 3
      while (s < len - 3 && made < MAX_FILL) {
        const h = hash(Math.round(ax + u[0] * s), Math.round(az + u[1] * s), 17)
        // A big road: a commercial building, behind its car park.
        if (rule.shops && hash(Math.round(ax + u[0] * s), Math.round(az + u[1] * s), 53) < rule.shops) {
          const w = 18 + Math.floor(h * 17) * 1.5 // 18 to 42 m of frontage
          let placed = false
          for (const side of [-1, 1]) {
            const n: XZ = [-u[1] * side, u[0] * side]
            const hs = hash(ax + u[0] * (s + w / 2), az + u[1] * (s + w / 2), side + 61)
            const d = 15 + Math.floor(hs * 11) * 1.5 // 15 to 30 m deep
            const back = 8 + Math.floor(hash(hs, w, 67) * 5) * 1.5 // the car park
            const p: XZ = [ax + u[0] * (s + w / 2), az + u[1] * (s + w / 2)]
            const c: XZ = [p[0] + n[0] * (r.width / 2 + back + d / 2), p[1] + n[1] * (r.width / 2 + back + d / 2)]
            if (!free(c, u, n, w, d)) continue
            // What it is: a supermarket or a mall (a tall box), a showroom, an office block, now and then a hotel.
            const what = hash(c[0], c[1], 71)
            if (what < 0.4) add(c, u, n, w - 0.5, d, 2, 'commerce', 7.5)
            else if (what < 0.62) add(c, u, n, w - 0.5, Math.min(d, 18), 1, 'commerce', 5)
            else if (what < 0.92) add(c, u, n, Math.min(w, 27) - 0.5, Math.min(d, 21), 3 + Math.floor(hash(c[1], c[0], 73) * 4), 'civic')
            else add(c, u, n, Math.min(w, 30) - 0.5, Math.min(d, 18), 5 + Math.floor(hash(c[1], c[0], 79) * 5), 'hotel')
            placed = true
          }
          s += (placed ? w : 9) + 3
          continue
        }
        // A couloir: a gap of 2.4 to 3 m between the last house's wall and the next one's (the eaves leave the middle open to the
        // sky), through both rows. Kept free once
        // the street is done (its houses side by side would find the coarse grid taken); whether it really ends up between two
        // walls, the street knows when it's drawn (nouchis.tsx).
        if (rule.second && s > 6 && hash(Math.round(ax + u[0] * s), Math.round(az + u[1] * s), 89) < 0.07) {
          const g = 2.4 + Math.floor(h * 3) * 0.3
          const s0 = s - 0.75
          const p: XZ = [ax + u[0] * (s0 + g / 2), az + u[1] * (s0 + g / 2)]
          const len = 17
          const off = r.width / 2 + 2.5
          for (const side of [-1, 1]) {
            const n: XZ = [-u[1] * side, u[0] * side]
            const c: XZ = [p[0] + n[0] * (off + len / 2), p[1] + n[1] * (off + len / 2)]
            if (cellOf(c[0], c[1]) < 0) continue
            later.push(() => keep(c, u, n, g - 0.6, len))
            couloirs.push({ mouth: [p[0] + n[0] * off, p[1] + n[1] * off], dir: n, w: g, len })
          }
          s = s0 + g - 0.25
          continue
        }
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
    for (const f of later) f()
  }
}

