import { useSyncExternalStore } from 'react'
import { featuresKnown, keyOpenNow, onFeatures } from '../../lib/features'
import { lightPhoneNow, useLightPhone } from '../../lib/lightPhone'
import { deviceTier, subscribeTier } from './lumiere'

// « Façades réalistes » (the update « facades-realistes », a step of the « blocs réalistes » look,
// concept in the lab's street.ts): the map's buildings dressed like the concept's street. Mostly
// texture work: the façades' atlases painted at twice the resolution (stained painted concrete,
// aluminium and louvred « naco » windows, claustra, tiled shop fronts, AC units dripping down the
// wall), the same tiles in the same places, so a chunk's geometry doesn't change for them. Then a few
// small things on the walls of the chunks round the view (shop signs with invented names, AC units
// with their drain pipe, claustra balconies, a blade sign), merged into a mesh per square of a chunk
// (cells.ts) and drawn only within a few dozen metres. And the tall buildings (the Plateau's towers):
// glass or white concrete grids, setbacks, fins, crowns, a spire, rooftop plant, lit offices at dusk.
// While the update is shut, nothing changes: same textures, same chunks, same cache keys.

export const FACADES = 'facades-realistes'
const HEARD_KEY = 'babi.facades.ouvert'

function read(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const open = () => (featuresKnown() ? keyOpenNow(FACADES) : read(HEARD_KEY) === '1')
onFeatures(() => {
  if (!featuresKnown()) return
  try {
    localStorage.setItem(HEARD_KEY, keyOpenNow(FACADES) ? '1' : '0')
  } catch {
    // Private mode: as the server says, once it has.
  }
})

/**
 * How much of it a device draws.
 * - `simple`: the small phones: the new textures and the towers' shapes only (the towers' glass without reflections), no props on the walls.
 * - `normal`: + the props on the walls within PROPS_NEAR, the glass reflecting the sky.
 * - `haute`: + more props (blade signs, dishes, window cages), further, and the glass shinier.
 */
export type FacadesTier = 'off' | 'simple' | 'normal' | 'haute'

// In development, ?facades=off|simple|normal|haute forces a tier (to compare them).
const FORCED = import.meta.env.DEV && typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('facades') as FacadesTier | null) : null

function tierOf(light: boolean): FacadesTier {
  if (FORCED) return FORCED
  if (!open()) return 'off'
  return deviceTier(light)
}

/** The tier now, read when a chunk is asked for. */
export const facadesTier = () => tierOf(lightPhoneNow())
/** The tier the street draws now (followed: the update can open, the phone go light). */
export function useFacades(): FacadesTier {
  const light = useLightPhone()
  return useSyncExternalStore(subscribeTier, () => tierOf(light))
}

/** How far (m) the walls' props are drawn, by tier: a square of a chunk (cells.ts) whose nearest point is closer. */
export const PROPS_NEAR: Record<FacadesTier, number> = { off: 0, simple: 0, normal: 60, haute: 110 }

/** What a chunk is built with: the towers' shapes (`shape`), and the walls' props too (`props`, near chunks on `normal` and `haute`). */
export type FacadesBuild = 'shape' | 'props'
export const facadesBuild = (tier: FacadesTier, far: boolean): FacadesBuild | undefined => (tier === 'off' ? undefined : !far && tier !== 'simple' ? 'props' : 'shape')
