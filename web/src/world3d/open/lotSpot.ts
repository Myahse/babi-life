import { rng } from '../themes'
import type { Plot } from '../../lib/types'
import { toLocal, type Origin, type XZ } from './geo'

/** Where a lot is in the commune it was bought in, by its key (backend Plot.Key: the Sim's id for its first lot): the same on every phone. */
export function lotSpot(key: string): [number, number] {
  const r = rng(`lot${key}`)
  return [r() * Math.PI * 2, 140 + r() * 300]
}

/** Where a lot stands, in the commune's metres: where the player set it on the map, else the spot the game drew for its key. */
export function lotAt(origin: Origin, key: string, lot?: { lat?: number; lng?: number } | null): XZ {
  if (lot?.lat != null && lot.lng != null) return toLocal(origin, lot.lat, lot.lng)
  const [a, d] = lotSpot(key)
  return [Math.cos(a) * d, Math.sin(a) * d]
}

/** The same, for a plot. */
export const plotAt = (origin: Origin, p: Pick<Plot, 'key' | 'lot'>) => lotAt(origin, p.key, p.lot)
