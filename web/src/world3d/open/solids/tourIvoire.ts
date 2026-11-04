// tourIvoire.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

/** The slab: half its width; from its back to where its rounded end starts (that end's middle). */
export const SW = 11
export const SZ = { back: -24, round: 2 }
/** The podium under it, wider: x from, to; z from, to (its front under the rounded end's). */
export const POD = { x0: -19, x1: 15, z0: -24, z1: SZ.round + SW }
export const FRONT = POD.z1
export const PODIUM = 9 // the shops, then the louvred floor
/** The store next door, with its red frames. */
export const STORE = { x: POD.x1 + 11, z: 3, w: 18, d: 14, h: 9 }
/** What stands in the way: the podium under the tower, the store next door, the totem. */
export const TOUR_IVOIRE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: (POD.x0 + POD.x1) / 2, z: (POD.z0 + POD.z1) / 2, hw: (POD.x1 - POD.x0) / 2 + 0.3, hd: (POD.z1 - POD.z0) / 2 + 0.3, rot: 0, top: PODIUM },
  { x: STORE.x, z: STORE.z, hw: STORE.w / 2 + 0.3, hd: STORE.d / 2 + 1.2, rot: 0, top: STORE.h },
  { x: 11, z: FRONT + 2.2, r: 1 },
]
