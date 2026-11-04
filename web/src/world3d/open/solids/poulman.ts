// poulman.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

/** Ten floors of 3.3 m, the ground floor's lobby higher. */
export const FLOORS = 10
export const STOREY = 3.3
export const BASE = 4.5
export const TOP = BASE + FLOORS * STOREY
/** The two wings: x from–to, the front face's z, the depth. */
export const WINGS = [
  { x0: -30, x1: 3, front: 0, depth: 16 },
  { x0: 3, x1: 30, front: 4, depth: 16 },
] as const
/** What one can't walk through: the two wings, the canopy's pillars. */
export const POULMAN_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  ...WINGS.map((w) => ({ x: (w.x0 + w.x1) / 2, z: w.front - w.depth / 2, hw: (w.x1 - w.x0) / 2 + 0.5, hd: w.depth / 2 + 0.9, rot: 0, top: TOP + 2 })),
  { x: 3.5, z: 13.5, r: 1.1 },
  { x: 20.5, z: 13.5, r: 1.1 },
]
