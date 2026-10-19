import { centroid, pointInRing, type XZ } from './geo'
import type { Building, ChunkData } from './tiles'

// The game's places on the real map. A place is the real building standing
// where the map puts it (or the closest one): the building keeps its real
// outline and height, and gets a door on the side facing the nearest street.
// Only where the map has no building at all does the game put up its own,
// on empty ground beside the street, without removing anything real.

export type PlaceSpot = { id: string; at: XZ; kind?: string; /** a landmark the game draws itself, clearing this many metres */ landmark?: number; /** for a sports place: its name and what the map calls it */ name?: string; type?: string; /** a sports place too close to another: played on the map's own pitch if it has one, never on one the game lays out */ noLayout?: boolean }

/** A pitch or a court: its middle, the direction of its length (radians from +x), its size. */
export type Field = { at: XZ; angle: number; len: number; wid: number; sport: 'foot' | 'basket'; /** the map's own pitch (drawn by the map), or one the game lays out */ map: boolean }
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
  /** A sports place played on a pitch or a court. */
  field?: Field
  /** A fuel station the map lays out (tiles.ts): drawn with its chunk. */
  station?: boolean
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
      // Off the street if the map point is on it; a big one (a stadium)
      // stands on its point, its own streets running round it.
      const back = Math.min(s.landmark, 40)
      const center: XZ = d < back ? [road.at[0] + ux * back, road.at[1] + uz * back] : s.at
      out.push({ id: s.id, door, center, rot: Math.atan2(door[0] - center[0], door[1] - center[1]), roadAngle: road.angle })
      continue
    }
    // A sports ground: played on its pitch, not in a house.
    const sport = s.kind === 'sport' ? sportOf(s.name ?? '', s.type) : null
    const field = sport && road ? (mapPitch(chunk, s.at, sport) ?? (s.noLayout ? null : layOut(chunk, s.at, sport, road))) : null
    if (field) {
      // The door: the middle of the touchline on the street's side.
      const [nx, nz] = [-Math.sin(field.angle), Math.cos(field.angle)]
      const side = (road!.at[0] - field.at[0]) * nx + (road!.at[1] - field.at[1]) * nz >= 0 ? 1 : -1
      const door: XZ = [field.at[0] + nx * side * (field.wid / 2 + 1.5), field.at[1] + nz * side * (field.wid / 2 + 1.5)]
      out.push({ id: s.id, door, center: field.at, rot: Math.atan2(door[0] - field.at[0], door[1] - field.at[1]), roadAngle: road!.angle, field })
      continue
    }
    // A fuel station: at the one the map lays out nearby, its door at the shop.
    if (s.kind === 'station') {
      const st = (chunk.stations ?? []).find((q) => Math.hypot(q.at[0] - x, q.at[1] - z) < 60)
      if (st) {
        const [nx, nz] = [-Math.sin(st.angle), Math.cos(st.angle)]
        const shop: XZ = [st.at[0] + nx * st.side * 10, st.at[1] + nz * st.side * 10]
        const door: XZ = [st.at[0] + nx * st.side * 5.8, st.at[1] + nz * st.side * 5.8]
        out.push({ id: s.id, door, center: shop, rot: Math.atan2(door[0] - shop[0], door[1] - shop[1]), roadAngle: st.angle, station: true })
        continue
      }
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

/** Two pitches the game lays out itself are at least this far apart: Abidjan doesn't have one on every street. */
export const FIELD_SPACING = 900

/**
 * Sports places too close to one already kept (the list in a fixed order,
 * the same on every screen): no pitch laid out for them, only the map's own.
 */
export function spaceFields<T extends PlaceSpot>(spots: T[]): T[] {
  const kept: XZ[] = []
  const tight = new Set<string>()
  for (const s of [...spots].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (s.kind !== 'sport' || s.landmark || sportOf(s.name ?? '', s.type) !== 'foot') continue
    if (kept.some((k) => Math.hypot(k[0] - s.at[0], k[1] - s.at[1]) < FIELD_SPACING)) tight.add(s.id)
    else kept.push(s.at)
  }
  return spots.map((s) => (tight.has(s.id) ? { ...s, noLayout: true } : s))
}

/**
 * What is played at a sports place, from its name and the map's type: a
 * maracana (football, five a side) or basketball; nothing for a pool, a gym
 * or a club house, which are buildings.
 */
export function sportOf(name: string, type = ''): Field['sport'] | null {
  const n = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/swimming|fitness|tennis|golf|horse|equestrian|american|gaelic|rugby|sports_centre/.test(type) || /piscine|natation|fitness|gym|salle|tennis|golf|palais/.test(n)) return null
  if (type === 'basketball' || /basket|agora/.test(n)) return 'basket'
  if (/pitch|soccer|stadium|football|multi/.test(type) || /maracana|terrain|foot|stade|calcio|five|city ?stade/.test(n)) return 'foot'
  return null
}

/** The smallest rectangle round a ring (tried along each of its sides). */
function rectOf(ring: XZ[]): { at: XZ; angle: number; len: number; wid: number } {
  let best = { at: centroid(ring), angle: 0, len: 0, wid: 0, area: Infinity }
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]
    const [bx, bz] = ring[(i + 1) % ring.length]
    const a = Math.atan2(bz - az, bx - ax)
    const [c, s] = [Math.cos(a), Math.sin(a)]
    let [u0, v0, u1, v1] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, z] of ring) {
      const u = x * c + z * s
      const v = -x * s + z * c
      ;[u0, v0, u1, v1] = [Math.min(u0, u), Math.min(v0, v), Math.max(u1, u), Math.max(v1, v)]
    }
    const area = (u1 - u0) * (v1 - v0)
    if (area > 0 && area < best.area) {
      const [mu, mv] = [(u0 + u1) / 2, (v0 + v1) / 2]
      const long = u1 - u0 >= v1 - v0
      best = { at: [mu * c - mv * s, mu * s + mv * c], angle: long ? a : a + Math.PI / 2, len: Math.max(u1 - u0, v1 - v0), wid: Math.min(u1 - u0, v1 - v0), area }
    }
  }
  return best
}

/** The map's pitch at the place (or within 40 m of it), when there is one big enough to play on. */
function mapPitch(chunk: ChunkData, p: XZ, sport: Field['sport']): Field | null {
  let found: { f: Field; d: number } | null = null
  for (const a of chunk.areas) {
    if (a.kind !== 'pitch') continue
    const d = closestOnRing(a.rings[0], p).d
    if (d > 40 || (found && d >= found.d)) continue
    const r = rectOf(a.rings[0])
    // The map's outline is rarely a true rectangle, and houses can stand at its
    // edge: the lines go in from it until none is in the way.
    const blocks = chunk.buildings.filter((b) => Math.abs(b.c[0] - r.at[0]) < r.len && Math.abs(b.c[1] - r.at[1]) < r.len)
    let k = 0.96
    const clear = (f: Field) => !blocks.some((b) => onFieldGround(f, b.c, 0.5) || b.ring.some((q) => onFieldGround(f, q, 0.3)))
    while (k > 0.6 && !clear({ ...r, len: r.len * k, wid: r.wid * k, sport, map: true })) k -= 0.04
    const f: Field = { ...r, len: r.len * k, wid: r.wid * k, sport, map: true }
    if (f.len < 12 || f.wid < 7 || !clear(f)) continue
    found = { f, d }
  }
  return found?.f ?? null
}

const SIZES: Record<Field['sport'], [number, number][]> = {
  // A maracana: about 40 × 20 m, or smaller where the quarter is tight.
  foot: [
    [40, 20],
    [30, 16],
    [22, 13],
  ],
  // A basketball court is 28 × 15 m; a half-court where there's no room.
  basket: [
    [28, 15],
    [15, 14],
  ],
}

/**
 * Where the map has no pitch, the game lays one out on free ground near
 * the place: never on a road, a building or water, lined up with the
 * street. Nothing if there's no room (then the place is a building).
 */
function layOut(chunk: ChunkData, p: XZ, sport: Field['sport'], road: Road): Field | null {
  const [ux, uz] = [Math.cos(road.angle), Math.sin(road.angle)]
  const [nx, nz] = [-uz, ux]
  const side = (p[0] - road.at[0]) * nx + (p[1] - road.at[1]) * nz >= 0 ? 1 : -1
  const near = chunk.roads.filter((r) => r.pts.some(([x, z]) => Math.abs(x - p[0]) < 120 && Math.abs(z - p[1]) < 120))
  const blocks = chunk.buildings.filter((b) => Math.abs(b.c[0] - p[0]) < 120 && Math.abs(b.c[1] - p[1]) < 120)
  const blocked = (q: XZ) => {
    for (const r of near)
      for (let i = 1; i < r.pts.length; i++) {
        const [ax, az] = r.pts[i - 1]
        const [bx, bz] = r.pts[i]
        const l2 = (bx - ax) ** 2 + (bz - az) ** 2
        const t = l2 ? Math.max(0, Math.min(1, ((q[0] - ax) * (bx - ax) + (q[1] - az) * (bz - az)) / l2)) : 0
        if (Math.hypot(ax + (bx - ax) * t - q[0], az + (bz - az) * t - q[1]) < r.width / 2 + 2) return true
      }
    if (blocks.some((b) => pointInRing(q, b.ring))) return true
    return chunk.areas.some((a) => (a.kind === 'water' || a.kind === 'campus' || a.kind === 'hospital') && pointInRing(q, a.rings[0]))
  }
  for (const [len, wid] of SIZES[sport])
    // Back from the street on the place's side, then a little along it either way.
    for (const along of [0, -12, 12, -24, 24])
      for (const back of [road.width / 2 + 2 + wid / 2, road.width / 2 + 8 + wid / 2]) {
        const at: XZ = [road.at[0] + ux * along + nx * side * back, road.at[1] + uz * along + nz * side * back]
        // Every 2 m over the whole pitch and a step round it (a narrow street
        // slipped between the old, sparser points), and all of it in this chunk.
        let free = true
        const [hl, hw] = [len / 2 + 1, wid / 2 + 1]
        for (let a = -hl; a <= hl + 0.01 && free; a += Math.min(2, hl))
          for (let b = -hw; b <= hw + 0.01 && free; b += Math.min(2, hw)) {
            const q: XZ = [at[0] + ux * a + nx * b, at[1] + uz * a + nz * b]
            if (q[0] < chunk.box.x0 || q[0] > chunk.box.x1 || q[1] < chunk.box.z0 || q[1] > chunk.box.z1 || blocked(q)) free = false
          }
        if (free) return { at, angle: road.angle, len, wid, sport, map: false }
      }
  return null
}

/** Is this point on a field's ground (its lines, and a step round them)? */
export function onFieldGround(f: Field, [x, z]: XZ, pad = 1.5) {
  const [dx, dz] = [x - f.at[0], z - f.at[1]]
  const [c, s] = [Math.cos(f.angle), Math.sin(f.angle)]
  return Math.abs(dx * c + dz * s) <= f.len / 2 + pad && Math.abs(-dx * s + dz * c) <= f.wid / 2 + pad
}
