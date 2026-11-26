import type { Flight, World } from './types'
import { distanceKm, flightBetween } from '../game/voyages'

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

type LatLng = { lat: number; lng: number }
export type Leg = {
  id: string
  from: LatLng
  to: LatLng
  /** flight time (s) */ dur: number
  /** its first departure on the clock (s, in 0..EVERY) */ offset: number
  km: number
  /** The airports' places at either end (world places' IDs). */
  fromPlace?: string
  toPlace?: string
  /** The way flown when it isn't straight (onRunways): from the runway's end, along it, ..., the approach and the runway; from first to last. */
  via?: LatLng[]
  /** (via's lengths so far, worked out once: equirectangular, fine for the few points.) */
  cum?: number[]
}
/** A plane in the air now: where, how high (m), which way (radians from north, clockwise), how far along (0..1). */
export type Aloft = { id: string; lat: number; lng: number; alt: number; bearing: number; t: number }

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

/** How many of its nearest airports each one has planes to in the sky (besides Abidjan's). */
const NEIGHBOURS = 2

/**
 * The routes seen flying: the world's whole timetable would be one plane per pair of airports (tens of
 * thousands once the planet is in), so the sky shows each airport's flights to Abidjan and to its nearest
 * airports, both ways. `open`: a route's update is open.
 */
function skyFlights(world: Pick<World, 'flights' | 'airports' | 'flightRules'>, open: (key: string) => boolean): Flight[] {
  if (world.flights) return world.flights
  const rules = world.flightRules
  const ports = (world.airports ?? []).filter((a) => !a.key || open(a.key))
  const hub = ports.find((a) => a.city === 'abidjan')
  if (!rules) return []
  const pairs = new Map<string, Flight>()
  const add = (a: (typeof ports)[number], b: (typeof ports)[number]) => {
    if (a.city === b.city || pairs.has(`${a.city}>${b.city}`)) return
    pairs.set(`${a.city}>${b.city}`, flightBetween(a, b, rules))
    pairs.set(`${b.city}>${a.city}`, flightBetween(b, a, rules))
  }
  for (const a of ports) {
    if (hub) add(a, hub)
    ports
      .filter((b) => b !== a)
      .map((b) => [b, distanceKm(a, b)] as const)
      .sort((x, y) => x[1] - y[1])
      .slice(0, NEIGHBOURS)
      .forEach(([b]) => add(a, b))
  }
  return [...pairs.values()]
}

/** The routes flown, from the world's airports' places; `open`: a route's update is open. */
export function airLegs(world: Pick<World, 'flights' | 'airports' | 'flightRules' | 'cities'>, open: (key: string) => boolean): Leg[] {
  const flights = skyFlights(world, open)
  const where = new Map<string, { lat: number; lng: number }>()
  const wanted = new Set<string>()
  for (const f of flights) wanted.add(f.place).add(f.toPlace ?? '')
  for (const c of world.cities) for (const m of c.communes) for (const p of m.places) if (wanted.has(p.id)) where.set(p.id, { lat: p.lat, lng: p.lng })
  const out: Leg[] = []
  for (const f of flights) {
    if (f.key && !open(f.key)) continue
    const a = where.get(f.place)
    const b = where.get(f.toPlace ?? '')
    if (!a || !b) continue
    const id = `${f.from}>${f.to}`
    out.push({ id, from: a, to: b, dur: Math.max(8, f.game ?? 20) * 60, offset: hash(id) * EVERY, km: f.km, fromPlace: f.place, toPlace: f.toPlace })
  }
  return out
}

const KM_LAT = 110.574
/** Metres east and north from a point (equirectangular, at its latitude). */
const offsetBy = (p: LatLng, east: number, north: number): LatLng => ({ lat: p.lat + north / (KM_LAT * 1000), lng: p.lng + east / (111320 * Math.cos((p.lat * Math.PI) / 180)) })

/**
 * The flights in and out of the airports whose runway is known here (the street's: the map's runway or the one
 * the game laid out, world3d/open/airportSite.ts): a plane leaving rolls from the runway's end along it and
 * climbs out straight ahead before turning for where it goes; one coming in turns onto the runway's line some
 * 9 km out and comes down it to touch down past the threshold. `runways`: by airport place, its ends (the
 * planes land and take off from `a` toward `b`).
 */
export function onRunways(legs: Leg[], runways: Map<string, { a: LatLng; b: LatLng }>): Leg[] {
  if (!runways.size) return legs
  return legs.map((l) => {
    const out = l.fromPlace ? runways.get(l.fromPlace) : undefined
    const into = l.toPlace ? runways.get(l.toPlace) : undefined
    if (!out && !into) return l
    const unit = (r: { a: LatLng; b: LatLng }) => {
      const k = Math.cos((r.a.lat * Math.PI) / 180) * 111320
      const [e, n] = [(r.b.lng - r.a.lng) * k, (r.b.lat - r.a.lat) * KM_LAT * 1000]
      const len = Math.hypot(e, n) || 1
      return [e / len, n / len] as const
    }
    const via: LatLng[] = []
    if (out) {
      const [e, n] = unit(out)
      via.push(out.a, out.b, offsetBy(out.b, e * 4000, n * 4000))
    } else via.push(l.from)
    if (into) {
      const [e, n] = unit(into)
      via.push(offsetBy(into.a, -e * 9000, -n * 9000), into.a, offsetBy(into.a, e * 400, n * 400))
    } else via.push(l.to)
    return { ...l, from: via[0], to: via[via.length - 1], via }
  })
}

/** Where along its way a plane is (0..1 of it): the point, and its bearing (radians from north, clockwise). */
function along(l: Leg, t: number, a: Aloft) {
  const via = l.via!
  if (!l.cum) {
    l.cum = [0]
    for (let i = 1; i < via.length; i++) {
      const k = Math.cos((via[i].lat * Math.PI) / 180)
      l.cum.push(l.cum[i - 1] + Math.hypot((via[i].lng - via[i - 1].lng) * k, via[i].lat - via[i - 1].lat))
    }
  }
  const cum = l.cum
  const d = t * cum[cum.length - 1]
  let i = 1
  while (i < cum.length - 1 && cum[i] < d) i++
  const [p, q] = [via[i - 1], via[i]]
  const u = cum[i] > cum[i - 1] ? (d - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0
  a.lat = p.lat + (q.lat - p.lat) * u
  a.lng = p.lng + (q.lng - p.lng) * u
  a.bearing = Math.atan2((q.lng - p.lng) * Math.cos((p.lat * Math.PI) / 180), q.lat - p.lat)
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
    const m = l.km * 1000
    a.alt = Math.min(CRUISE, m * t * CLIMB, m * (1 - t) * DESCENT)
    if (l.via) {
      along(l, t, a)
      continue
    }
    a.lat = l.from.lat + (l.to.lat - l.from.lat) * t
    a.lng = l.from.lng + (l.to.lng - l.from.lng) * t
    const k = Math.cos((l.from.lat * Math.PI) / 180)
    a.bearing = Math.atan2((l.to.lng - l.from.lng) * k, l.to.lat - l.from.lat)
  }
  return n
}
