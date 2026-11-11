import type { World } from './types'

// The airline's flights in the air (the update « camera-vie »): the same timetable on every screen, read from
// the shared clock. Each of Air Lagune's routes (backend world.FlightRoutes, both ways) has a plane leaving every
// EVERY seconds, at its own minute; it flies the timetable's time (the `game` minutes: about 850 km/h, a real
// airliner's pace), climbing out and coming down at real slopes. The street's sky (world3d/open/skyLife.tsx)
// and the big map (components/map/skyMap.ts) both draw it, so a plane seen over Marcory is on the map there too.

/** A plane leaves on each route this often (s): a departure every few minutes at Port-Bouët. */
export const EVERY = 40 * 60
/** How high the planes cruise (m). (Lower than a real 7 km: from the street, they still read as planes.) */
export const CRUISE = 2400
/** The climb out and the way down: height gained per metre flown, and lost. */
const CLIMB = 0.09
const DESCENT = 0.055

export type Leg = { id: string; from: { lat: number; lng: number }; to: { lat: number; lng: number }; /** flight time (s) */ dur: number; /** its first departure on the clock (s, in 0..EVERY) */ offset: number; km: number }
/** A plane in the air now: where, how high (m), which way (radians from north, clockwise), how far along (0..1). */
export type Aloft = { id: string; lat: number; lng: number; alt: number; bearing: number; t: number }

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

/** The routes flown, from the world's flights and its airports' places; `open`: a route's update is open. */
export function airLegs(world: Pick<World, 'flights' | 'cities'>, open: (key: string) => boolean): Leg[] {
  const where = new Map<string, { lat: number; lng: number }>()
  const wanted = new Set<string>()
  for (const f of world.flights ?? []) wanted.add(f.place).add(f.toPlace ?? '')
  for (const c of world.cities) for (const m of c.communes) for (const p of m.places) if (wanted.has(p.id)) where.set(p.id, { lat: p.lat, lng: p.lng })
  const out: Leg[] = []
  for (const f of world.flights ?? []) {
    if (f.key && !open(f.key)) continue
    const a = where.get(f.place)
    const b = where.get(f.toPlace ?? '')
    if (!a || !b) continue
    const id = `${f.from}>${f.to}`
    out.push({ id, from: a, to: b, dur: Math.max(8, f.game ?? 20) * 60, offset: hash(id) * EVERY, km: f.km })
  }
  return out
}

/** A pool of planes, filled in place frame after frame (nothing allocated once it is as big as the routes). */
export function makeAloft(n: number): Aloft[] {
  return Array.from({ length: n }, () => ({ id: '', lat: 0, lng: 0, alt: 0, bearing: 0, t: 0 }))
}

/** The planes in the air at `now` (s on the shared clock), written into `out`; how many there are. */
export function aloftAt(legs: Leg[], now: number, out: Aloft[]): number {
  let n = 0
  for (const l of legs) {
    // The last departure of this route; at most one plane on it at a time (a flight is shorter than EVERY).
    const since = (((now - l.offset) % EVERY) + EVERY) % EVERY
    if (since >= l.dur || n >= out.length) continue
    const t = since / l.dur
    const a = out[n++]
    a.id = l.id
    a.t = t
    a.lat = l.from.lat + (l.to.lat - l.from.lat) * t
    a.lng = l.from.lng + (l.to.lng - l.from.lng) * t
    const m = l.km * 1000
    a.alt = Math.min(CRUISE, m * t * CLIMB, m * (1 - t) * DESCENT)
    const k = Math.cos((l.from.lat * Math.PI) / 180)
    a.bearing = Math.atan2((l.to.lng - l.from.lng) * k, l.to.lat - l.from.lat)
  }
  return n
}
