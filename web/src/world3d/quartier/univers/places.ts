import type { Place, World } from '../../../lib/types'
import { toLatLng, type XZ } from '../../open/geo'
import { UNIV_ORIGIN, type UniversInfo } from './gen'

// The places of « mon-quartier »'s own world (gen.ts slots): its maquis, its boutiques, its pharmacy, its salon, its
// grin, its market, its school, its terrain, its church or mosque… are the commune's own places (the game's, then
// the map's round the quartier: their names, their menus, their prices, the server knows them), each set where the
// world has room for it. A kind the commune hasn't got leaves its spot to the houses.

/** A place of the world: the commune's, at the world's spot (lat/lng round UNIV_ORIGIN, what the street reads), and that spot. */
export type UPlace = Place & { at: XZ; tag: string }

/** Places one doesn't put elsewhere: inside another, the game's own spots, the far landmarks (a stadium, an airport…). */
const NOT_HERE = new Set(['home', 'plot', 'zone', 'happening', 'soiree', 'aeroport', 'stade', 'presidence', 'assemblee', 'caserne', 'universite', 'zoo', 'karting', 'lagune', 'village', 'rue', 'carrefour', 'mairie', 'prefecture', 'tribunal', 'police', 'nature', 'beach', 'excursion', 'golf', 'plantation', 'peche', 'sacre', 'riviere', 'empt', 'chantier', 'mall', 'hotel', 'cinema', 'culture', 'artisans'])

export function universPlaces(u: UniversInfo, world: World, own: Place[], map: Place[]): UPlace[] {
  const used = new Set<string>()
  const out: UPlace[] = []
  const pool = [...own, ...map].filter((p) => !p.parent && !NOT_HERE.has(p.kind) && !p.id.startsWith('quartier:') && !!world.kinds[p.kind] && !p.closed)
  for (const s of u.slots) {
    let pick: Place | undefined
    for (const k of s.kinds) {
      pick = pool.find((p) => !used.has(p.id) && (p.kind === k || (k === 'church' && p.kind === 'worship' && p.faith !== 'musulman') || (k === 'mosque' && p.kind === 'worship' && p.faith === 'musulman')))
      if (pick) break
    }
    if (!pick) continue
    used.add(pick.id)
    const ll = toLatLng(UNIV_ORIGIN, s.at)
    out.push({ ...pick, lat: ll.lat, lng: ll.lng, at: s.at, tag: s.tag })
  }
  return out
}

/** A point of the world as the street's places carry it. */
export const universLatLng = (at: XZ) => toLatLng(UNIV_ORIGIN, at)
