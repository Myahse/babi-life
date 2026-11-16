import { create } from 'zustand'
import type { XZ } from '../open/geo'
import type { QuartierView } from './types'

// « Mon quartier » (update « mon-quartier »): what the 3D world needs to know about the quartier being
// played, set by the game's screen (components/quartier/useQuartier.ts) and read by the street
// (world3d/open/OpenWorld.tsx: the chunks it loads, the haze) without three.js here.

/** Metres around the centre: the usual, and on a weak phone (« Téléphone léger »). */
export const QUARTIER_RADIUS = 300
export const QUARTIER_RADIUS_LIGHT = 150

export type QuartierWorld = {
  /** Played now in the 3D world: the street loads only the quartier. */
  active: boolean
  /** Whose quartier: its owner's Sim. */
  owner: string | null
  /** A friend's (a visit), not one's own. */
  visiting: boolean
  radius: number
  /** The centre as the server has it (a visit: there; one's own: the Sim's home in the street wins). */
  center: { lat: number; lng: number } | null
  /** The quartier as last read. */
  view: QuartierView | null
  /** The centre in the street's metres (OpenWorld sets it once its origin is known). */
  local: XZ | null
  /** Where the server's centre falls in the street's metres: the buildings keep their place around the real centre. */
  serverLocal: XZ | null
  /** The same centre in lat/lng (where the buildings are set from). */
  localLL: { lat: number; lng: number } | null
  /** The Sim walked out of it. */
  outside: boolean
  /** Where « À faire maintenant » points, in the street's metres (null: nowhere to go). */
  target: XZ | null
}

export const useQuartierWorld = create<QuartierWorld>(() => ({ active: false, owner: null, visiting: false, radius: QUARTIER_RADIUS, center: null, view: null, local: null, serverLocal: null, localLL: null, outside: false, target: null }))

/** For the street's loading: the circle it keeps to, or null (the whole city, as ever). */
export function quartierLimit(): { at: XZ; r: number } | null {
  const q = useQuartierWorld.getState()
  if (!q.active || !q.local) return null
  return { at: q.local, r: q.radius }
}

/** The haze while in a quartier: the far side of it still clear, beyond lost in it. */
export function quartierFog(near: number, far: number): [number, number] {
  const q = useQuartierWorld.getState()
  if (!q.active) return [near, far]
  return [Math.min(near, q.radius * 0.9), Math.min(far, q.radius * 2.6 + 200)]
}

/** A metre position of a lat/lng from the server, moved with the quartier (its centre where the street has it). */
export function quartierLocal(toLocal: (lat: number, lng: number) => XZ, lat: number, lng: number): XZ {
  const q = useQuartierWorld.getState()
  const p = toLocal(lat, lng)
  if (!q.local || !q.serverLocal) return p
  return [p[0] - q.serverLocal[0] + q.local[0], p[1] - q.serverLocal[1] + q.local[1]]
}

/** Visiting a friend's quartier: where the Sim starts (its centre, the nearest ground one can walk on), else null (home, as ever). */
export function quartierSpawn(walkable: (x: number, z: number) => boolean): XZ | null {
  const q = useQuartierWorld.getState()
  if (!q.active || !q.visiting || !q.local) return null
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
