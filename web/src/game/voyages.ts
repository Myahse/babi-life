import type { CoachCompany, CoachRoute, Flight, World } from '../lib/types'
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

/** The flights out of a city (those whose update is open: `open(key)`). */
export const flightsFrom = (world: World, city: string, open: (key: string) => boolean): Flight[] => (world.flights ?? []).filter((f) => f.from === city && (!f.key || open(f.key)))

export const flightTo = (world: World, from: string, to: string, open: (key: string) => boolean) => flightsFrom(world, from, open).find((f) => f.to === to) ?? null

/** The coach lines out of a city's gare. */
export const coachesFrom = (world: World, city: string): CoachRoute[] => (world.coaches?.routes ?? []).filter((r) => r.from === city)

export const coachTo = (world: World, from: string, to: string) => coachesFrom(world, from).find((r) => r.to === to) ?? null

/** A city's airport and gare routière, where they are. */
export const airportOf = (world: World, city: string) => findPlace(world, (world.flights ?? []).find((f) => f.from === city)?.place)
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
