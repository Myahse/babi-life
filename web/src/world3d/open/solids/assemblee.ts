// assemblee.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

export const W = 36 // half its width
export const D = 26 // half its depth
export const H = 10
export const COURT = 22 // the forecourt, from the colonnade to the gate
/** What a walker can't go through: the building and its colonnade, the gate, the guard boxes, the flags (its frame). */
export const ASSEMBLEE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 0, z: 0, hw: W + 1, hd: D + 1, rot: 0, top: H + 1.2 },
  ...[...Array(12)].map((_, i) => ({ x: -W + 4 + i * 6, z: D + 6, r: 0.8 })),
  { x: -9, z: D + 8 + COURT, r: 0.9 },
  { x: 9, z: D + 8 + COURT, r: 0.9 },
  { x: -12, z: D + 6 + COURT, hw: 1, hd: 1, rot: 0, top: 3 },
  { x: 12, z: D + 6 + COURT, hw: 1, hd: 1, rot: 0, top: 3 },
  { x: -20, z: D + 18, hw: 1.2, hd: 7.5, rot: 0, top: 1.6 },
]
