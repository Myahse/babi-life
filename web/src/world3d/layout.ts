import type { Field } from './open/places'
import type { Commune } from '../lib/types'
import { rng, themeFor, weighted, type Filler } from './themes'
import { t } from '../lib/i18n'

// Lays out a commune as a district, in metres. A boulevard runs along X with
// sidewalks; cross streets cut it at x = ±CROSS_X (with lights) and
// x = ±FAR_CROSS_X, back streets run at z = ±BACK_STREET_Z. Lots (14 m square) line both sides of the boulevard in
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
  /** A real building from the map (the open world): its height. */
  height?: number
  /** A place of worship's faith: a minaret, a belfry or a cross, and its services. */
  faith?: string
  /** Inside a landmark that draws it (a club in the Rue Princesse): only its name here. */
  child?: boolean
  /** A pitch or a court (the open world): the place is played on it. */
  field?: Field
  /** A fuel station drawn with the map (open/station.tsx): only its label here. */
  station?: boolean
}

export const HOME_ID = 'home'
export const STREET_HALF = 5 // boulevard half-width (two lanes each way)
export const SIDEWALK = 6.2 // where people walk, either side
export const CROSS_X = 56
export const FAR_CROSS_X = 136
export const BACK_STREET_Z = 40
export const EXTENT_X = 216
/** How much longer the boulevard is than the first one (120 m): street life scales with it. */
export const STRETCH = EXTENT_X / 120

const FRONT_Z = 14.5
const BACK_Z = 30
// Lot columns, by block between the cross streets.
const INNER = [8, 24, 40]
const OUTER = [72, 88, 104, 120]
const FAR = [152, 168, 184, 200]
export const LOT_XS = [...INNER, ...OUTER, ...FAR].flatMap((x) => [-x, x]).sort((a, b) => a - b)

/** Front-row slots, nearest the centre first, alternating sides. */
const PLACE_SLOTS: [number, number][] = [...INNER, ...OUTER, ...FAR].flatMap((x): [number, number][] => [[-x, -1], [x, 1], [x, -1], [-x, 1]])

function lotAt(x: number, side: number, back = false) {
  const z = side * (back ? BACK_Z : FRONT_Z)
  // Front rows face the boulevard; back rows face the back street.
  const facing = back ? side : -side
  return { x, z, rot: facing > 0 ? 0 : Math.PI, door: [x, z + facing * 7.2] as [number, number] }
}

export function layoutCommune(commune: Commune, withHome: boolean): Lot[] {
  const theme = themeFor(commune.id)
  const r = rng(commune.id)
  const places = [...(withHome ? [{ id: HOME_ID, kind: 'home', name: t('Chez toi') }] : []), ...commune.places].slice(0, PLACE_SLOTS.length)
  const taken = new Set<string>()
  // Beaches go on the far side, where the sea is; everything else fills in.
  const free = [...PLACE_SLOTS]
  const claim = (side?: number) => {
    const i = side === undefined ? 0 : Math.max(0, free.findIndex(([, s]) => s === side))
    return free.splice(i, 1)[0]
  }
  const order = [...places].sort((a, b) => Number(b.kind === 'beach') - Number(a.kind === 'beach'))
  const slot = new Map(order.map((p) => [p.id, claim(p.kind === 'beach' && theme.water ? -1 : undefined)]))
  const lots: Lot[] = places.map((p, i) => {
    const [x, side] = slot.get(p.id)!
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
    for (const x of LOT_XS) {
      if (!taken.has(`${x}|${side}|f`)) filler(x, side, false)
      if (!(theme.waterfront && side < 0)) filler(x, side, true) // the water takes the far back row
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
