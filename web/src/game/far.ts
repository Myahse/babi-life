import { useSyncExternalStore } from 'react'
import type { Place, Sim, World } from '../lib/types'
import { km } from './rules'

// The places out of town (the update « bouake-vivant », « sanpedro-vivant »): the N'Zi's reserve and its
// lodge stand in Brobo, 30 km from Bouaké; the Baie des Sirènes and its campement in Grand-Béréby, 30 km
// from San-Pédro. Each is a commune of its own, so the town's « Où aller ? » didn't list them and one
// got there only by finding them on the map. Here: the destinations out of town listed from the town
// (and the town from them, « Rentrer à Bouaké »), each gone to by the trip to its commune, and the place
// one meant to reach remembered across a trip that lands elsewhere (the coach at Bouaké's gare).

/** The communes out in the bush, entered by one place when one has no home there (the Sim arrives at its gate). */
export const ARRIVE_AT: Record<string, string> = { brobo: 'nzi-reserve', 'grand-bereby': 'bereby-sirenes' }
/** What one goes out there for, listed from the town (not the village's school or mairie, kilometres off). */
const OUT_THERE: Record<string, string[]> = { brobo: ['nzi-reserve', 'nzi-lodge'], 'grand-bereby': ['bereby-sirenes', 'bereby-campement'] }

/** A destination out of town: a place of another commune of the city (or the town's middle, going back). */
export type FarSpot = { id: string; kind: string; name: string; cityId: string; communeId: string; km: number; /** back to the town's own commune */ back?: boolean }

/** The town's own commune: the city's first (Bouaké's centre, San-Pédro's). */
const townOf = (world: World, cityId: string) => world.cities.find((c) => c.id === cityId)?.communes.find((c) => !ARRIVE_AT[c.id])

/** The places out of town from where the Sim is, the nearest first: the bush communes' places from the town, and from one of them the town and the others. */
export function farSpots(world: World, sim: Pick<Sim, 'city' | 'commune'>): FarSpot[] {
  const city = world.cities.find((c) => c.id === sim.city)
  const here = city?.communes.find((c) => c.id === sim.commune)
  if (!city || !here) return []
  const out: FarSpot[] = []
  for (const c of city.communes) {
    if (c.id === here.id || !ARRIVE_AT[c.id]) continue
    const way = c.places.find((p) => p.id === ARRIVE_AT[c.id])
    if (!way) continue
    // (Those an update holds back aren't in the world the server sends.)
    for (const id of OUT_THERE[c.id] ?? []) {
      const p = c.places.find((x) => x.id === id)
      if (p) out.push(spot(p, city.id, c.id, km(here, way)))
    }
  }
  // Out in the bush: back to town.
  const town = ARRIVE_AT[here.id] ? townOf(world, city.id) : null
  if (town) out.unshift({ id: `ville:${town.id}`, kind: 'mairie', name: city.name, cityId: city.id, communeId: town.id, km: Math.max(1, Math.round(km(here, town))), back: true })
  return out
}

const spot = (p: Place, cityId: string, communeId: string, d: number): FarSpot => ({ id: p.id, kind: p.kind, name: p.name, cityId, communeId, km: Math.max(1, Math.round(d)) })

/** Where a place is, when it's out of town in the Sim's city (another commune than the Sim's): null else. */
export function farOf(world: World, sim: Pick<Sim, 'city' | 'commune'>, placeId: string): FarSpot | null {
  return farSpots(world, sim).find((s) => s.id === placeId) ?? null
}

/**
 * The place a trip was for, when the trip lands elsewhere (the coach from Abidjan at Bouaké's gare, for the
 * reserve; the taxi at the reserve's gate, for the lodge): what's next is said there, or walked to.
 */
export type Then = { cityId: string; communeId: string; placeId: string; name: string; /** when (ms): a trip of hours ago is forgotten */ at?: number }
const THEN = 'babi.tripThen'
const read = (): Then | null => {
  try {
    const s = localStorage.getItem(THEN)
    return s ? (JSON.parse(s) as Then) : null
  } catch {
    return null
  }
}
let then = read()
const listeners = new Set<() => void>()
export function setTripThen(t: Then | null) {
  then = t && { ...t, at: Date.now() }
  try {
    if (then) localStorage.setItem(THEN, JSON.stringify(then))
    else localStorage.removeItem(THEN)
  } catch {
    /* private mode: kept for this visit only */
  }
  listeners.forEach((f) => f())
}
/** Kept a few hours: the coach to Bouaké takes five, the player may stop on the way. */
const KEEP = 6 * 3600_000
export const tripThen = () => (then && Date.now() - (then.at ?? 0) < KEEP ? then : null)
export const useTripThen = () => useSyncExternalStore((f) => (listeners.add(f), () => void listeners.delete(f)), tripThen)

/** A commune out of town (Brobo): how far from its town's own commune, the one the coach and the plane land in. */
export function outOfTown(world: World, cityId: string, communeId: string): { km: number; town: string } | null {
  if (!ARRIVE_AT[communeId]) return null
  const city = world.cities.find((c) => c.id === cityId)
  const c = city?.communes.find((x) => x.id === communeId)
  const town = townOf(world, cityId)
  return c && town ? { km: Math.max(1, Math.round(km(town, c))), town: town.name } : null
}
