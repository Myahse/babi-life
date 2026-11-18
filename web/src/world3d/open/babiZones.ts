import { create } from 'zustand'
import type { Commune } from '../../lib/types'
import { toLocal, type XZ } from './geo'
import { ZONES } from './quartiers'

// « babi-quartiers »: the world of Babi in real neighbourhoods instead of one open world. The Sim is
// in one neighbourhood at a time (about a kilometre across: the Rue Princesse, Sideci, the Plateau's
// towers, Treichville's market…), its real streets loaded alone and walked from one end to the
// other; the rest of the city is the horizon. At its edge, or from the map, one goes to another by
// taxi (the street loaded again there), never on foot across the whole city.

/** A neighbourhood: its middle and its radius in the commune's metres (round the commune's centre, the street's origin). */
export type BabiZone = { id: string; commune: string; name: string; at: XZ; r: number }

/** The neighbourhoods that stand round one of the game's places (the place's id, the neighbourhood's name, its radius). */
const AROUND: [string, string, number][] = [
  ['yop-rue-princesse', 'Rue Princesse', 420],
  ['yop-maquis', 'Sideci', 480],
  ['yop-gare-siporex', 'Siporex', 450],
  ['plateau-tours', 'Le Plateau des tours', 480],
  ['plateau-cathedrale', 'Le Plateau, côté lagune', 420],
  ['plateau-stade', 'Le stade Houphouët-Boigny', 380],
  ['cocody-danga', 'Danga', 420],
  ['cocody-chu-angre', 'Angré', 520],
  ['cocody-riviera', 'La Riviera', 520],
  ['cocody-hotel-ivoire', "L'hôtel Ivoire", 420],
  ['cocody-playce', 'La Palmeraie', 450],
  ['cocody-carrefour-vie', 'Le carrefour de la Vie', 420],
  ['adjame-forum', 'Le Forum des marchés', 380],
  ['adjame-mosquee', 'Adjamé Liberté', 420],
  ['marcory-capsud', 'Cap Sud', 420],
  ['marcory-karting', 'Marcory Résidentiel', 420],
  ['koumassi-marche', 'Le marché de Koumassi', 420],
  ['abobo-marche', "Le grand marché d'Abobo", 480],
  ['abobo-una', 'Abobo Baoulé', 480],
  ['attecoube-banco', 'Le Banco', 520],
  ['yakro-basilique', 'La Basilique', 520],
  ['yakro-lac', 'Le lac aux caïmans', 450],
  ['bouake-marche', 'Le grand marché', 480],
  ['bouake-universite', 'Le campus', 480],
  ['bassam-iugb', 'Bassam, côté campus', 450],
]

/** The smallest and largest neighbourhood (m): small enough to load at once, big enough to walk round. */
const R_MIN = 300
const R_MAX = 600
/** Two neighbourhoods closer than this (their middles, m): the second isn't one of its own. */
const APART = 320

/** A commune's neighbourhoods: its centre, its named zones (quartiers.ts), and the ones round its known places. */
export function zonesOf(commune: Commune): BabiZone[] {
  const origin = { lat: commune.lat, lng: commune.lng }
  const out: BabiZone[] = []
  const add = (z: BabiZone) => {
    if (out.some((o) => Math.hypot(o.at[0] - z.at[0], o.at[1] - z.at[1]) < APART)) return
    out.push({ ...z, r: Math.max(R_MIN, Math.min(R_MAX, z.r)) })
  }
  for (const [placeId, name, r] of AROUND) {
    const p = commune.places.find((x) => x.id === placeId)
    if (p) add({ id: `p:${placeId}`, commune: commune.id, name, at: toLocal(origin, p.lat, p.lng), r })
  }
  // (The industrial zones are too wide to be one: their own places stand in the neighbourhoods round them.)
  for (const z of ZONES) if (z.commune === commune.id && z.style !== 'industrie') add({ id: `z:${z.id}`, commune: commune.id, name: z.name, at: toLocal(origin, z.lat, z.lng), r: z.r })
  add({ id: `c:${commune.id}`, commune: commune.id, name: commune.places.length ? `${commune.name} centre` : commune.name, at: [0, 0], r: 520 })
  return out
}

/** The neighbourhood a point is in (the nearest middle of those that hold it), else none. */
export function zoneAt(zones: BabiZone[], at: XZ): BabiZone | null {
  let best: BabiZone | null = null
  let bd = Infinity
  for (const z of zones) {
    const d = Math.hypot(z.at[0] - at[0], z.at[1] - at[1])
    if (d < z.r && d < bd) [best, bd] = [z, d]
  }
  return best
}

/** The neighbourhood for a point: the one it's in, else one of its own round it, named after the nearest. */
export function zoneFor(commune: Commune, at: XZ, zones = zonesOf(commune)): BabiZone {
  const z = zoneAt(zones, at)
  if (z) return z
  const near = [...zones].sort((a, b) => Math.hypot(a.at[0] - at[0], a.at[1] - at[1]) - Math.hypot(b.at[0] - at[0], b.at[1] - at[1]))[0]
  const name = near && Math.hypot(near.at[0] - at[0], near.at[1] - at[1]) < 1600 ? `Vers ${near.name}` : commune.name
  return { id: `a:${Math.round(at[0] / 50)}:${Math.round(at[1] / 50)}`, commune: commune.id, name, at, r: 450 }
}

/** The neighbourhoods next to one, nearest first (the edge's « Aller à côté »). */
export function zonesNear(zones: BabiZone[], z: BabiZone, n = 3): BabiZone[] {
  return zones
    .filter((o) => o.id !== z.id)
    .sort((a, b) => Math.hypot(a.at[0] - z.at[0], a.at[1] - z.at[1]) - Math.hypot(b.at[0] - z.at[0], b.at[1] - z.at[1]))
    .slice(0, n)
}

export type BabiZoneState = {
  /** The neighbourhood played now (null: not yet chosen, or the update closed: the open world as ever). */
  zone: BabiZone | null
  /** Where the Sim is set down on arriving in it (the street's metres), once; null: where it would be anyway. */
  arrive: XZ | null
  /** Each jump to another neighbourhood: the street is loaded again for it. */
  trip: number
  /** The Sim is at the neighbourhood's edge. */
  outside: boolean
}

export const useBabiZone = create<BabiZoneState>(() => ({ zone: null, arrive: null, trip: 0, outside: false }))

/** The neighbourhood that bounds the street now (null: none). */
export const zonePlayed = () => useBabiZone.getState().zone

/** Go to a neighbourhood (by taxi: the street loaded again there), set down at `arrive` or its middle. */
export function goToZone(zone: BabiZone, arrive?: XZ) {
  useBabiZone.setState((s) => ({ zone, arrive: arrive ?? zone.at, trip: s.trip + 1, outside: false }))
}

/** The Sim's neighbourhood chosen where it stands (arriving in a commune, or set down somewhere outside it). */
export function settleZone(zone: BabiZone) {
  useBabiZone.setState({ zone, arrive: null, outside: false })
}

/** Leave the neighbourhoods (the update closed, Mon quartier played, another commune). */
export function clearZone() {
  useBabiZone.setState({ zone: null, arrive: null, outside: false })
}

/** Inside the neighbourhood (with `margin` metres more), from its middle. */
export const inZone = (z: BabiZone, x: number, zz: number, margin = 0) => Math.hypot(x - z.at[0], zz - z.at[1]) <= z.r + margin

// In development, for tests in the browser.
if (import.meta.env.DEV) Object.assign(globalThis, { __babiZone: useBabiZone })
