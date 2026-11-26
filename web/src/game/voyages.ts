import type { Airport, CoachCompany, CoachRoute, Flight, FlightRules, World } from '../lib/types'
import { t } from '../lib/i18n'

// From city to city (the update « voyages-villes », backend game/coaches.go,
// game/flights.go): the flights from each city's airport, the coach lines from
// its gare routière, their hours. Mirrors the server; the server decides.

export const TRAVEL_KEY = 'voyages-villes'
export const AIRLINE_APP = 'airlagune'

/** A place of the world by its ID: its city, its commune. */
export function findPlace(world: World, id: string | undefined) {
  if (!id) return null
  for (const city of world.cities)
    for (const commune of city.communes) {
      const place = commune.places.find((p) => p.id === id)
      if (place) return { city, commune, place }
    }
  return null
}

export const placeName = (world: World, id: string | undefined) => findPlace(world, id)?.place.name

/** km as the crow flies (backend world.distanceKm). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r
  const dLng = (b.lng - a.lng) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** backend game.Length: the real minutes an action of `m` game minutes lasts. */
const lengthOf = (m: number, max: number) => (m <= 30 ? Math.max(1, Math.floor((m + 19) / 20)) : Math.min(max, 2 + Math.floor(m / 60)))

/** One flight between two airports, priced as backend game.FlightQuote does (the server decides when one flies). */
export function flightBetween(a: Airport, b: Airport, rules: FlightRules): Flight {
  const km = distanceKm(a, b)
  const game = rules.boarding + Math.ceil(km / rules.kmPerMin)
  let price = rules.base + rules.perKm * Math.min(km, rules.longKm)
  if (km > rules.longKm) price += rules.longPerKm * (km - rules.longKm)
  return { from: a.city, place: a.place, to: b.city, toName: b.name, commune: b.commune, toPlace: b.place, minutes: lengthOf(game, rules.maxAction), game, fare: Math.round(price / 500) * 500, km: Math.trunc(km), airline: rules.airline, key: a.key || b.key || undefined }
}

const fromCache = new WeakMap<World, Map<string, Flight[]>>()
/** Every flight out of a city, its update aside (worked out once per world and city). */
function allFrom(world: World, city: string): Flight[] {
  if (world.flights) return world.flights.filter((f) => f.from === city)
  const rules = world.flightRules
  const here = world.airports?.find((a) => a.city === city)
  if (!rules || !here) return []
  let byCity = fromCache.get(world)
  if (!byCity) fromCache.set(world, (byCity = new Map()))
  let out = byCity.get(city)
  if (!out) byCity.set(city, (out = (world.airports ?? []).filter((a) => a.city !== city).map((b) => flightBetween(here, b, rules))))
  return out
}

/** The flights out of a city (those whose updates, both ends', are open: `open(key)`). */
export const flightsFrom = (world: World, city: string, open: (key: string) => boolean): Flight[] => {
  const keyOf = new Map((world.airports ?? []).map((a) => [a.city, a.key]))
  const ok = (k?: string) => !k || open(k)
  return allFrom(world, city).filter((f) => ok(f.key) && ok(keyOf.get(f.from)) && ok(keyOf.get(f.to)))
}

export const flightTo = (world: World, from: string, to: string, open: (key: string) => boolean) => flightsFrom(world, from, open).find((f) => f.to === to) ?? null

/** The coach lines out of a city's gare. */
export const coachesFrom = (world: World, city: string): CoachRoute[] => (world.coaches?.routes ?? []).filter((r) => r.from === city)

export const coachTo = (world: World, from: string, to: string) => coachesFrom(world, from).find((r) => r.to === to) ?? null

/** A city's airport and gare routière, where they are. */
export const airportOf = (world: World, city: string) => findPlace(world, world.airports?.find((a) => a.city === city)?.place ?? world.flights?.find((f) => f.from === city)?.place)
export const gareOf = (world: World, city: string) => findPlace(world, coachesFrom(world, city)[0]?.place)

const FALLBACK: CoachCompany = { id: 'car', name: t('Car'), body: '#f4f6f5', stripe: '#008f4c' }
/** A coach company by its ID or its name. */
export const coachCompany = (world: World, idOrName: string | undefined): CoachCompany => world.coaches?.companies.find((c) => c.id === idOrName || c.name === idOrName) ?? FALLBACK

/** The next coach on a line at or after this game minute (backend game.NextCoach), or null when the day's last has gone. */
export function nextCoach(r: Pick<CoachRoute, 'every' | 'first' | 'last'>, now: number): number | null {
  const day = now - (now % 1440)
  const at = now % 1440
  if (at > r.last) return null
  if (at <= r.first) return day + r.first
  return day + r.first + Math.ceil((at - r.first) / r.every) * r.every
}

/** A game minute as the boards write it (« 14 h 30 »; backend game.ClockLabel). */
export function clockLabel(m: number) {
  const h = Math.floor(m / 60) % 24
  const mn = Math.floor(m % 60)
  return mn ? `${h} h ${String(mn).padStart(2, '0')}` : `${h} h`
}
