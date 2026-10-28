import { create } from 'zustand'

/**
 * A lot being set in the 3D world (an update: lot-carte): the camera goes up
 * over the quarter, the lot is drawn where the view's middle is, beside its
 * street as the house will stand, and the player slides the view under it
 * (world3d/open/lotGhost.tsx, screens/Play.tsx's LotPlaceHud). Bought (or an
 * empty lot moved) where it is.
 */
export type LotPlacing = {
  w: number
  d: number
  /** What the button says and costs. */
  label: string
  price?: number
  /** An empty lot moved: its key (its own spot doesn't count as taken). */
  moving?: string
  onPick: (spot: { lat: number; lng: number }) => Promise<boolean>
}

/** Where the lot is now, and whether it can go there (why not, else ''). */
export type LotGhost = { lat: number; lng: number; why: string; near: string }

type State = {
  placing: LotPlacing | null
  ghost: LotGhost | null
  /** The commune the 3D world shows (null: not the open world), where a lot can be set this way. */
  shown: string | null
  start: (p: LotPlacing) => void
  stop: () => void
}

export const useLotPlace = create<State>((set) => ({
  placing: null,
  ghost: null,
  shown: null,
  start: (placing) => set({ placing, ghost: null }),
  stop: () => set({ placing: null, ghost: null }),
}))
