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
  /** A friends-only quartier of someone who isn't one: shown, not visited (one may ask to come in). */
  locked?: boolean
  /** Locked, and already asked: waiting for the owner. */
  asked?: boolean
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

/**
 * Where the Sim starts in the world, and which way it faces (as the Sim's heading: forward is (sin h, cos h)): on the
 * pavement in front of the lot it went to (one's home too), turned along the street towards the world's middle and a
 * little out to the road, the camera set behind it (Walker.tsx): one sees the street and the house beside it, not
 * the house's wall. Null outside the quartier's world.
 */
export function quartierSpawn(nav: { walkable: (x: number, z: number) => boolean; street?: (p: XZ, minWidth?: number) => { at: XZ; dir: number; width: number } | null }): { at: XZ; h: number } | null {
  const q = useQuartierWorld.getState()
  const u = universPlayed(q)
  const lot = q.lot
  if (!u || !lot) return null
  const [cx, cz] = lot.at
  // Its street: the road it was laid out along (univers/gen.ts fronts: `dir` as atan2(dz, dx)), not a path to its door.
  const along = lot.kind === 'place' ? null : Math.atan2(Math.cos(lot.dir), Math.sin(lot.dir))
  const st = nav.street?.(lot.at, 4)
  const mid = u.carrefour
  if (st && Math.hypot(st.at[0] - cx, st.at[1] - cz) < 45 && (along === null || Math.abs(Math.sin(st.dir - along)) < 0.5)) {
    // From the street's middle towards the lot, to the pavement's edge.
    const away = Math.hypot(cx - st.at[0], cz - st.at[1]) || 1
    const [nx, nz] = [(cx - st.at[0]) / away, (cz - st.at[1]) / away]
    // Along the street, the way to the world's middle.
    let h = st.dir
    if (Math.sin(h) * (mid[0] - st.at[0]) + Math.cos(h) * (mid[1] - st.at[1]) < 0) h += Math.PI
    // (A little out to the road, turned from the lot: the far side of the street in view as well as along it.)
    const side = Math.sin(h) * nz - Math.cos(h) * nx
    h += Math.sign(side || 1) * 0.3
    for (const k of [1.4, 0.9, 2.2, 0.4, 3.2]) {
      const x = st.at[0] + nx * (st.width / 2 + k)
      const z = st.at[1] + nz * (st.width / 2 + k)
      if (nav.walkable(x, z)) return { at: [x, z], h }
    }
  }
  // (No street found near it yet, the streets still coming: on the pavement in front of it all the same, from the
  // world's own plan of the lot; never in the lot's middle, where what is built on it stands.)
  const f = lot.id === 'home' ? u.home : lot.slot !== undefined && lot.id.startsWith('lot:') ? u.lots[lot.slot] : u.slots.find((x) => x.at[0] === cx && x.at[1] === cz)
  if (f) {
    const d0 = Math.hypot(f.at[0] - f.street[0], f.at[1] - f.street[1]) || 1
    const [ox, oz] = [(f.at[0] - f.street[0]) / d0, (f.at[1] - f.street[1]) / d0]
    let h = Math.atan2(Math.cos(f.dir), Math.sin(f.dir))
    if (Math.sin(h) * (mid[0] - f.street[0]) + Math.cos(h) * (mid[1] - f.street[1]) < 0) h += Math.PI
    for (const k of [8.6, 8, 9.4, 7.2]) {
      const [x, z] = [f.at[0] - ox * k, f.at[1] - oz * k]
      if (nav.walkable(x, z)) return { at: [x, z], h }
    }
  }
  // (Else the nearest ground one can stand on round it, along its street if it has one, else facing the world's middle.)
  const faceOf = (x: number, z: number) => (along === null ? Math.atan2(mid[0] - x, mid[1] - z) : Math.sin(along) * (mid[0] - x) + Math.cos(along) * (mid[1] - z) < 0 ? along + Math.PI : along)
  for (let r = 0; r <= 60; r += 3)
    for (let a = 0; a < 12; a++) {
      const x = cx + Math.cos((a / 12) * Math.PI * 2) * r
      const z = cz + Math.sin((a / 12) * Math.PI * 2) * r
      if (nav.walkable(x, z)) return { at: [x, z], h: faceOf(x, z) }
    }
  return { at: lot.at, h: faceOf(cx, cz) }
}
// In development, for tests in the browser.
if (import.meta.env.DEV) Object.assign(globalThis, { __quartier: useQuartierWorld })
