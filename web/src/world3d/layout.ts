import type { Commune } from '../lib/types'
import { rng, themeFor, weighted, type Filler } from './themes'

// Lays out a commune as a district, in metres. A boulevard runs along X with
// sidewalks; cross streets cut it at x = ±CROSS_X, back streets run at
// z = ±BACK_STREET_Z. Lots (14 m square) line both sides of the boulevard in
// two rows. The places you can visit take the front-row lots nearest the
// centre; the rest is filled with buildings in the commune's style.

export type Lot = {
  id: string
  kind: string // place kind, or 'filler'
  name: string
  x: number
  z: number
  rot: number
  door: [number, number]
  filler?: Filler
  seed: number
}

export const HOME_ID = 'home'
export const STREET_HALF = 5 // boulevard half-width (two lanes each way)
export const SIDEWALK = 6.2 // where people walk, either side
export const CROSS_X = 56
export const BACK_STREET_Z = 40
export const EXTENT_X = 120

const FRONT_Z = 14.5
const BACK_Z = 30
const COLUMNS = [-40, -24, -8, 8, 24, 40]
const OUTER = [72, 88, 104]

/** Front-row slots, nearest the centre first. */
const PLACE_SLOTS: [number, number][] = [
  [-8, -1], [8, 1], [8, -1], [-8, 1], [-24, -1], [24, 1], [24, -1], [-24, 1], [-40, -1], [40, 1], [40, -1], [-40, 1],
]

function lotAt(x: number, side: number, back = false) {
  const z = side * (back ? BACK_Z : FRONT_Z)
  // Front rows face the boulevard; back rows face the back street.
  const facing = back ? side : -side
  return { x, z, rot: facing > 0 ? 0 : Math.PI, door: [x, z + facing * 7.2] as [number, number] }
}

export function layoutCommune(commune: Commune, withHome: boolean): Lot[] {
  const theme = themeFor(commune.id)
  const r = rng(commune.id)
  const places = [...(withHome ? [{ id: HOME_ID, kind: 'home', name: 'Chez toi' }] : []), ...commune.places].slice(0, PLACE_SLOTS.length)
  const taken = new Set<string>()
  const lots: Lot[] = places.map((p, i) => {
    const [x, side] = PLACE_SLOTS[i]
    taken.add(`${x}|${side}|f`)
    return { id: p.id, kind: p.kind, name: p.name, seed: i, ...lotAt(x, side) }
  })

  let n = 0
  const filler = (x: number, side: number, back: boolean) => {
    let f = weighted(r, theme.fillers)
    // The camera looks from +Z: only the far back row can hold towers.
    if (f === 'tower' && !(back && side < 0)) f = 'office'
    lots.push({ id: `f${n}`, kind: 'filler', name: '', filler: f, seed: Math.floor(r() * 1e6), ...lotAt(x, side, back) })
    n++
  }
  for (const side of [-1, 1])
    for (const x of [...COLUMNS, ...OUTER, ...OUTER.map((v) => -v)]) {
      if (!taken.has(`${x}|${side}|f`)) filler(x, side, false)
      filler(x, side, true)
    }
  return lots
}

/** Walk along the sidewalks from a point to a lot's door. */
export function route(from: [number, number], to: [number, number]): [number, number][] {
  const pts: [number, number][] = [from]
  const startSide = Math.sign(from[1]) || 1
  const endSide = Math.sign(to[1]) || 1
  pts.push([from[0], startSide * SIDEWALK])
  if (startSide !== endSide) pts.push([from[0], endSide * SIDEWALK])
  pts.push([to[0], endSide * SIDEWALK], to)
  return pts
}
