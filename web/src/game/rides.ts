import { withToll } from './rules'
import type { Commune, RideClass, TripMode, World } from '../lib/types'

/** How a ride looks: its name, the "En …" line, the car's colours. */
export type RideLook = { name: string; how: string; color: string; trim?: string; app: boolean }

const ORANGE = '#ff7a00'
const WHITE = '#f1f3f5'
const INK = '#161a2b'

/**
 * Street taxis in Abidjan: the woro-woro wears its commune's colour (blue in
 * Yopougon, yellow in Cocody…), the taxi compteur is orange. The apps' cars
 * are drawn dark. Mirrors backend/internal/world/taxis.go.
 */
export function rideLook(world: World, mode: TripMode | string, from?: Commune, cls?: string): RideLook {
  const app = world.rideApps?.find((a) => a.id === ({ yango: 'gnango', indrive: 'idrive' } as Record<string, string>)[mode] || a.id === mode)
  if (app) {
    const c = app.classes?.find((x) => x.id === cls)
    const name = c ? `${app.name} ${c.name}` : app.name
    return { name, how: `En ${name}`, color: c ? CLASS_COLOR[c.id] ?? INK : INK, app: true }
  }
  if (mode === 'car') return { name: 'Car', how: 'En car', color: '#00b86b', app: false }
  if (mode === 'compteur') return { name: 'Taxi compteur', how: 'En taxi compteur', color: world.compteur?.color ?? ORANGE, app: false }
  if (mode === 'woro' || (mode === 'taxi' && from?.woro && !from.woro.none)) {
    return { name: 'Woro-woro', how: 'En woro-woro', color: from?.woro?.color ?? WHITE, trim: from?.woro?.trim, app: false }
  }
  return { name: 'Taxi', how: 'En taxi', color: ORANGE, app: false }
}

/** The colour the app's car shows on the map, by class. */
const CLASS_COLOR: Record<string, string> = { eco: '#868e96', confort: '#f1f3f5', confortplus: '#161a2b' }

/** Mirrors world.ClassFare: the fare in that class, rounded to 50 Djai. */
export function classFare(fare: number, c?: RideClass) {
  return c && c.factor > 0 ? Math.round((fare * c.factor) / 50) * 50 : fare
}

/** Mirrors world.CompteurQuote: a bit quicker than the woro-woro, about twice the fare. */
export function compteurQuote(t: { minutes: number; fare: number; toll?: number }) {
  return { minutes: Math.round(t.minutes * 0.85), fare: withToll(t.fare, t.toll ?? 0, 2, 500, 50) }
}

/** A readable text colour on a car colour. */
export function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return l > 0.62 ? INK : '#ffffff'
}
