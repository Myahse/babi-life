import type { XZ } from './geo'
import type { ChunkData } from './tiles'

// The game's places on the real streets. Their positions are only roughly
// known, so each goes on the street nearest to where the map says it is: its
// door on the pavement, its building set back from the road, facing it.

export type PlaceSpot = { id: string; at: XZ }
export type Resolved = { id: string; door: XZ; center: XZ; rot: number; roadAngle: number }

/** How far a place's building stands back from the middle of the street. */
const SETBACK = 11

export function resolvePlaces(chunk: ChunkData, spots: PlaceSpot[]): Resolved[] {
  const { box } = chunk
  const out: Resolved[] = []
  for (const s of spots) {
    const [x, z] = s.at
    if (x < box.x0 || x >= box.x1 || z < box.z0 || z >= box.z1) continue
    let best: { at: XZ; d: number; angle: number; width: number } | null = null
    for (const r of chunk.roads) {
      if (r.cls === 'path' || r.cls === 'motorway') continue
      for (let i = 1; i < r.pts.length; i++) {
        const [ax, az] = r.pts[i - 1]
        const [bx, bz] = r.pts[i]
        const l2 = (bx - ax) ** 2 + (bz - az) ** 2
        const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2)) : 0
        const at: XZ = [ax + (bx - ax) * t, az + (bz - az) * t]
        const d = Math.hypot(at[0] - x, at[1] - z)
        if (!best || d < best.d) best = { at, d, angle: Math.atan2(bz - az, bx - ax), width: r.width }
      }
    }
    if (!best) {
      out.push({ id: s.id, door: s.at, center: [x, z - SETBACK], rot: 0, roadAngle: 0 })
      continue
    }
    // Which side of the street: the side the map puts the place on.
    const [nx, nz] = [-Math.sin(best.angle), Math.cos(best.angle)]
    const side = (x - best.at[0]) * nx + (z - best.at[1]) * nz >= 0 ? 1 : -1
    const off = best.width / 2 + 1.2
    const door: XZ = [best.at[0] + nx * side * off, best.at[1] + nz * side * off]
    const center: XZ = [best.at[0] + nx * side * (off + SETBACK - 3), best.at[1] + nz * side * (off + SETBACK - 3)]
    out.push({ id: s.id, door, center, rot: Math.atan2(door[0] - center[0], door[1] - center[1]), roadAngle: best.angle })
  }
  return out
}
