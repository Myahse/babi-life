import type { Commune } from '../lib/types'

// Lays out a commune as a small neighbourhood: a main street along X, a cross
// street along Z, and lots on both sides. Every building faces the main street.

export type Lot = { id: string; kind: string; name: string; x: number; z: number; rot: number; door: [number, number] }

const SLOTS: [number, number][] = [
  [-11, -12], [11, -12], [-11, 12], [11, 12], [-31, -12], [31, 12], [-31, 12], [31, -12], [-51, -12], [51, 12],
]

export const HOME_ID = 'home'
export const STREET_HALF = 3.5 // main street half-width

export function layoutCommune(commune: Commune, withHome: boolean): Lot[] {
  const places = [...(withHome ? [{ id: HOME_ID, kind: 'home', name: 'Chez toi' }] : []), ...commune.places]
  return places.slice(0, SLOTS.length).map((p, i) => {
    const [x, z] = SLOTS[i]
    const facing = z < 0 ? 1 : -1 // towards the main street
    return { id: p.id, kind: p.kind, name: p.name, x, z, rot: z < 0 ? 0 : Math.PI, door: [x, z + facing * 6.5] }
  })
}

/** Route along the streets from a point to a lot's door. */
export function route(from: [number, number], to: [number, number]): [number, number][] {
  const pts: [number, number][] = [from]
  if (Math.abs(from[1]) > STREET_HALF) pts.push([from[0], 0])
  pts.push([to[0], 0], to)
  return pts
}
