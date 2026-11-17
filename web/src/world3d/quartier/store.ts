import { create } from 'zustand'
import type { XZ } from '../open/geo'
import type { QuartierView } from './types'
import type { Built, UniversInfo, UniversSpec } from './univers/gen'

// « Mon quartier » (update « mon-quartier »): what the 3D world needs to know about the quartier being
// played, set by the game's screen (components/quartier/useQuartier.ts) and read by the street
// (world3d/open/OpenWorld.tsx: the world it draws instead of the map) without three.js here.
//
// A quartier is its own world (univers/gen.ts), like a neighbourhood of The Sims: its view
// (components/quartier/QuartierVue.tsx), the whole world seen from high up, every lot marked; then the world
// itself in the street, walked freely from one end to the other (the lot one went to is where one starts).

/** What stands on a lot: one's home, one's quartier building or free lot, a place of the world, another player's building or home. */
export type LotKind = 'home' | 'mine' | 'free' | 'place' | 'player' | 'player-home'

/** A lot of the quartier's view (world3d/quartier/lots.ts), where it is in the world. */
export type QLot = {
  /** 'home', 'lot:<n>' (one's own), 'place:<id>', 'b:<owner>:<id>', 'home:<owner>', 'q:<owner>'. */
  id: string
  kind: LotKind
  /** Where it stands in the world (its metres), and the same as lat/lng (round univers/gen.ts UNIV_ORIGIN, what the street's places carry). */
  at: XZ
  lat: number
  lng: number
  /** The way the street in front of it runs (radians, in the world's metres). */
  dir: number
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
}

export type QuartierWorld = {
  /** Played now in the 3D world: the street draws the quartier's world. */
  active: boolean
  /** Whose quartier: its owner's Sim. */
  owner: string | null
  /** A friend's (a visit), not one's own. */
  visiting: boolean
  /** The quartier as last read. */
  view: QuartierView | null
  /** Its world: what it's drawn from, the world itself, and what the player built that the world draws (houses, flats). */
  spec: UniversSpec | null
  univ: UniversInfo | null
  built: Built[]
  /** The world seen from high up, or walked in the street. */
  scene: 'vue' | 'lot'
  /** The lot one went to from the view (where the Sim starts in the street). */
  lot: QLot | null
  /** The lot to show in the view (« À faire maintenant », a lot asked for): its card open, the camera there. */
  focus: string | null
  /** The Sim is at the world's edge (the lagoon, the forest, the motorway's wall): « Aller à Babi ? ». */
  outside: boolean
  /** Where « À faire maintenant » points, in the world's metres (null: nowhere to walk to). */
  target: XZ | null
}

export const useQuartierWorld = create<QuartierWorld>(() => ({ active: false, owner: null, visiting: false, view: null, spec: null, univ: null, built: [], scene: 'vue', lot: null, focus: null, outside: false, target: null }))

/** The quartier's world drawn in the street now (else the map, as ever). */
export const universPlayed = (q: QuartierWorld = useQuartierWorld.getState()) => (q.active && q.scene === 'lot' && q.univ ? q.univ : null)

/** Where the Sim starts in the world: by the lot it went to (its nearest ground one can stand on); else null (home, as ever). */
export function quartierSpawn(walkable: (x: number, z: number) => boolean): XZ | null {
  const q = useQuartierWorld.getState()
  if (!universPlayed(q) || !q.lot || q.lot.kind === 'home') return null
  // (In front of it, on its street's side: where one arrives.)
  const [cx, cz] = q.lot.at
  for (let r = 0; r <= 60; r += 3)
    for (let a = 0; a < 12; a++) {
      const x = cx + Math.cos((a / 12) * Math.PI * 2) * r
      const z = cz + Math.sin((a / 12) * Math.PI * 2) * r
      if (walkable(x, z)) return [x, z]
    }
  return q.lot.at
}
// In development, for tests in the browser.
if (import.meta.env.DEV) Object.assign(globalThis, { __quartier: useQuartierWorld })
