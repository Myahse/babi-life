import { centroid, pointInRing, type XZ } from './geo'
import type { Building, ChunkData } from './tiles'

// The game's places on the real map. A place is the real building standing
// where the map puts it (or the closest one): the building keeps its real
// outline and height, and gets a door on the side facing the nearest street.
// Only where the map has no building at all does the game put up its own,
// on empty ground beside the street, without removing anything real.

export type PlaceSpot = { id: string; at: XZ; kind?: string; /** a landmark the game draws itself, clearing this many metres */ landmark?: number }
export type Resolved = {
  id: string
  door: XZ
  center: XZ
  /** Which way the door faces (radians, the game's convention: 0 = +z). */
  rot: number
  /** Direction of the street in front (radians from +x). */
  roadAngle: number
  /** The real building that is the place, if there is one: its height. */
  real?: { height: number }
  /** A campus's gate on the street, when the place stands in one. */
  gate?: { at: XZ; rot: number; width: number }
}

/** How far the map's position may be from a building and still mean it. */
const NEAR_BUILDING = 30
/** A game-made building stands this far back from the middle of the street. */
const SETBACK = 11
/** Homes are ordinary houses, not a tower or a shed. */
const HOME_AREA: [number, number] = [35, 400]

type Road = { at: XZ; d: number; angle: number; width: number }

function nearestRoad(chunk: ChunkData, [x, z]: XZ): Road | null {
  let best: Road | null = null
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
  return best
}

/** The point of a ring closest to p, and the outward normal of that side. */
function closestOnRing(ring: XZ[], p: XZ): { at: XZ; d: number; n: XZ } {
  let best = { at: ring[0], d: Infinity, n: [0, 1] as XZ }
  const inside = pointInRing(p, ring)
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]
    const [bx, bz] = ring[(i + 1) % ring.length]
    const l2 = (bx - ax) ** 2 + (bz - az) ** 2
    if (!l2) continue
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * (bx - ax) + (p[1] - az) * (bz - az)) / l2))
    const at: XZ = [ax + (bx - ax) * t, az + (bz - az) * t]
    const d = Math.hypot(at[0] - p[0], at[1] - p[1])
    if (d < best.d) {
      const len = Math.sqrt(l2)
      best = { at, d, n: [(bz - az) / len, -(bx - ax) / len] }
    }
  }
  // Rings may wind either way: the outward side is away from the centre.
  const c = centroid(ring)
  if ((best.at[0] - c[0]) * best.n[0] + (best.at[1] - c[1]) * best.n[1] < 0) best.n = [-best.n[0], -best.n[1]]
  return inside ? { ...best, d: 0 } : best
}

function area(ring: XZ[]) {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i]
    const [x2, z2] = ring[(i + 1) % ring.length]
    a += x1 * z2 - x2 * z1
  }
  return Math.abs(a / 2)
}

export function resolvePlaces(chunk: ChunkData, spots: PlaceSpot[], onReal?: (b: Building, kind: string) => void): Resolved[] {
  const { box } = chunk
  const out: Resolved[] = []
  const taken = new Set<Building>()
  for (const s of spots) {
    const [x, z] = s.at
    if (x < box.x0 || x >= box.x1 || z < box.z0 || z >= box.z1) continue
    const road = nearestRoad(chunk, s.at)

    // A landmark stands where the map says, facing its street.
    if (s.landmark && road) {
      const d = Math.hypot(road.at[0] - x, road.at[1] - z) || 1
      const [ux, uz] = [(x - road.at[0]) / d, (z - road.at[1]) / d]
      const door: XZ = [road.at[0] + ux * (road.width / 2 + 1.2), road.at[1] + uz * (road.width / 2 + 1.2)]
      const center: XZ = d < s.landmark ? [road.at[0] + ux * s.landmark, road.at[1] + uz * s.landmark] : s.at
      out.push({ id: s.id, door, center, rot: Math.atan2(door[0] - center[0], door[1] - center[1]), roadAngle: road.angle })
      continue
    }
    // The real building there, unless it's a street event.
    if (s.kind !== 'happening') {
      let found: { b: Building; d: number } | null = null
      for (const b of chunk.buildings) {
        if (taken.has(b)) continue
        if (s.kind === 'home') {
          const a = area(b.ring)
          if (a < HOME_AREA[0] || a > HOME_AREA[1]) continue
        }
        const d = closestOnRing(b.ring, s.at).d
        if (d <= (s.kind === 'home' ? 120 : NEAR_BUILDING) && (!found || d < found.d)) found = { b, d }
      }
      if (found) {
        taken.add(found.b)
        onReal?.(found.b, s.kind ?? '')
        const c = centroid(found.b.ring)
        // The door: on the side facing the nearest street.
        const toward = nearestRoad(chunk, c)?.at ?? road?.at ?? s.at
        const side = closestOnRing(found.b.ring, toward)
        const door: XZ = [side.at[0] + side.n[0] * 1.2, side.at[1] + side.n[1] * 1.2]
        out.push({ id: s.id, door, center: c, rot: Math.atan2(side.n[0], side.n[1]), roadAngle: road?.angle ?? 0, real: { height: found.b.height }, gate: s.kind === 'universite' || s.kind === 'school' ? campusGate(chunk, c) : undefined })
        continue
      }
    }

    if (!road) {
      out.push({ id: s.id, door: s.at, center: [x, z - SETBACK], rot: 0, roadAngle: 0 })
      continue
    }
    // No building on the map here: the game builds one beside the street,
    // on the side the map puts the place.
    const [nx, nz] = [-Math.sin(road.angle), Math.cos(road.angle)]
    const side = (x - road.at[0]) * nx + (z - road.at[1]) * nz >= 0 ? 1 : -1
    const off = road.width / 2 + 1.2
    const door: XZ = [road.at[0] + nx * side * off, road.at[1] + nz * side * off]
    const center: XZ = [road.at[0] + nx * side * (off + SETBACK - 3), road.at[1] + nz * side * (off + SETBACK - 3)]
    out.push({ id: s.id, door, center, rot: Math.atan2(door[0] - center[0], door[1] - center[1]), roadAngle: road.angle })
  }
  return out
}

/** Real buildings in the way of a game-made one (a 14 m lot, or a landmark's ground). */
export function inTheWay(made: XZ[], c: XZ, landmarks: { at: XZ; r: number }[] = []) {
  return made.some((p) => Math.abs(p[0] - c[0]) < 9 && Math.abs(p[1] - c[1]) < 9) || landmarks.some((l) => Math.hypot(l.at[0] - c[0], l.at[1] - c[1]) < l.r)
}

/**
 * Where a campus meets its main street: the gate. The map doesn't say where
 * the real gate is, so it goes where the grounds come closest to a big road.
 */
function campusGate(chunk: ChunkData, c: XZ): Resolved['gate'] {
  const campus = chunk.areas.find((a) => a.kind === 'campus' && pointInRing(c, a.rings[0]))
  if (!campus) return undefined
  const ring = campus.rings[0]
  const { box } = chunk
  let best: { at: XZ; road: XZ; d: number } | null = null
  for (const r of chunk.roads) {
    if (r.width < 9) continue
    for (const q of r.pts) {
      const on = closestOnRing(ring, q)
      // Not on a side of the grounds cut by the chunk's edge.
      const edge = Math.min(Math.abs(on.at[0] - box.x0), Math.abs(on.at[0] - box.x1), Math.abs(on.at[1] - box.z0), Math.abs(on.at[1] - box.z1)) < 0.5
      if (!edge && (!best || on.d < best.d)) best = { at: on.at, road: q, d: on.d }
    }
  }
  if (!best || best.d > 40) return undefined
  return { at: best.at, rot: Math.atan2(best.road[0] - best.at[0], best.road[1] - best.at[1]), width: 9 }
}
