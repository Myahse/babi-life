import { create } from 'zustand'
import type { XZ } from '../open/geo'
import type { QuartierView } from './types'

// « Mon quartier » (update « mon-quartier »): what the 3D world needs to know about the quartier being
// played, set by the game's screen (components/quartier/useQuartier.ts) and read by the street
// (world3d/open/OpenWorld.tsx: the chunks it loads, the haze) without three.js here.
//
// The quartier is played like a neighbourhood of The Sims: its view (components/quartier/QuartierVue.tsx), the
// whole neighbourhood round the home seen from high up, every lot marked; then one lot at a time (« lot »
// scene), only that lot and its street front loaded at full detail. Going to another lot goes back by the view.

/** Metres round the home the quartier's view shows: the usual, and on a weak phone. */
export const QUARTIER_RADIUS = 600
export const QUARTIER_RADIUS_LIGHT = 420
/** Metres round a lot's middle loaded at full detail: its building and its street front. */
export const LOT_RADIUS = 75
export const LOT_RADIUS_LIGHT = 60

/** What stands on a lot: one's home, one's quartier building or free lot, a place of the commune, another player's building or home. */
export type LotKind = 'home' | 'mine' | 'free' | 'place' | 'player' | 'player-home'

/** A lot of the quartier's view (world3d/quartier/lots.ts), where it is in the street (lat/lng, as the street draws it). */
export type QLot = {
  /** 'home', 'lot:<n>' (one's own), 'place:<id>', 'b:<owner>:<id>', 'home:<owner>', 'q:<owner>'. */
  id: string
  kind: LotKind
  lat: number
  lng: number
  /** The way its front faces (radians, towards its street). */
  heading: number
  name: string
  /** What it is, in a few words (« Maquis », « Terrain libre »…). */
  what: string
  icon: string
  owner?: string
  ownerName?: string
  level?: number
  open?: boolean
  /** The street's place inside it, walked to on arrival. */
  placeId?: string
  /** One's own lot number (the server's slot) and the building on it. */
  slot?: number
  buildingId?: number
  friend?: boolean
  /** A friends-only quartier of someone who isn't one: shown, not visited. */
  locked?: boolean
  /** Snapped to its street from the map (a free lot: where it would be built). */
  snapped?: boolean
}

export type QuartierWorld = {
  /** Played now in the 3D world: the street loads only the quartier. */
  active: boolean
  /** Whose quartier: its owner's Sim. */
  owner: string | null
  /** A friend's (a visit), not one's own. */
  visiting: boolean
  /** The view's radius (m). */
  radius: number
  /** The centre as the server has it. */
  center: { lat: number; lng: number } | null
  /** The quartier as last read. */
  view: QuartierView | null
  /** The neighbourhood's view, or one lot played. */
  scene: 'vue' | 'lot'
  /** The lot played (scene « lot »). */
  lot: QLot | null
  /** Its radius at full detail. */
  lotR: number
  /** The lot to show in the view (« À faire maintenant », a lot asked for): its card open, the camera there. */
  focus: string | null
  /** The lot's middle in the street's metres (OpenWorld sets it once its origin is known). */
  local: XZ | null
  /** The home's place in the street (lat/lng) as the street drew it: one's quartier is set round it. */
  homeLL: { lat: number; lng: number } | null
  /** The Sim walked out of the lot. */
  outside: boolean
  /** Where « À faire maintenant » points, in the street's metres (null: nowhere to go in this lot). */
  target: XZ | null
}

export const useQuartierWorld = create<QuartierWorld>(() => ({ active: false, owner: null, visiting: false, radius: QUARTIER_RADIUS, center: null, view: null, scene: 'vue', lot: null, lotR: LOT_RADIUS, focus: null, local: null, homeLL: null, outside: false, target: null }))

/** Playing a lot of the quartier now (the street is drawn). */
export const lotPlayed = (q: QuartierWorld = useQuartierWorld.getState()) => q.active && q.scene === 'lot' && !!q.lot

/** Development (measures): a lot's radius, and whole chunks instead of its street front (?lotR=300&lotKeep=0: as the first version loaded its 300 m). */
const devParams = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search) : null
export const DEV_LOT_R = Number(devParams?.get('lotR')) || 0
const DEV_NO_KEEP = devParams?.get('lotKeep') === '0'

/** For the street's loading: the circle it keeps to (the lot played), and whether only that is built (else whole chunks); or null (the whole city, as ever). */
export function quartierLimit(): { at: XZ; r: number; keep: boolean } | null {
  const q = useQuartierWorld.getState()
  if (!lotPlayed(q) || !q.local) return null
  return { at: q.local, r: q.lotR, keep: !DEV_NO_KEEP }
}

/** The haze while on a lot: its street front clear, beyond lost in it. */
export function quartierFog(near: number, far: number): [number, number] {
  const q = useQuartierWorld.getState()
  if (!lotPlayed(q)) return [near, far]
  return [Math.min(near, q.lotR * 0.8), Math.min(far, q.lotR * 3 + 160)]
}

/** On a lot (not one's home): where the Sim starts, the nearest ground one can walk on by its middle; else null (home, as ever). */
export function quartierSpawn(walkable: (x: number, z: number) => boolean): XZ | null {
  const q = useQuartierWorld.getState()
  if (!lotPlayed(q) || !q.local || q.lot!.kind === 'home') return null
  const [cx, cz] = q.local
  for (let r = 0; r <= 60; r += 3)
    for (let a = 0; a < 12; a++) {
      const x = cx + Math.cos((a / 12) * Math.PI * 2) * r
      const z = cz + Math.sin((a / 12) * Math.PI * 2) * r
      if (walkable(x, z)) return [x, z]
    }
  return q.local
}
// In development, for tests in the browser.
if (import.meta.env.DEV) Object.assign(globalThis, { __quartier: useQuartierWorld })
