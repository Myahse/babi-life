// rabisson.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

export const W = 84
export const DEPTH = 18
export const GROUND = 4.5
export const FLOORS = 4
export const STOREY = 3.6
export const TOP = GROUND + FLOORS * STOREY
/** What one can't walk through: the slab, the colonnade's roof line, the pool, the sign's post. */
export const RABISSON_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 0, z: -DEPTH / 2, hw: W / 2 + 0.3, hd: DEPTH / 2 + 0.6, rot: 0, top: TOP + 1 },
  { x: 0, z: -DEPTH - 16, hw: 15, hd: 6, rot: 0, top: 0.6 },
  { x: -W / 2 + 2, z: 18, r: 0.6 },
]
