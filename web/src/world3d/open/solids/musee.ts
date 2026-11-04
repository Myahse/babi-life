// musee.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

export const W = 20 // half the hall's length
export const D = 8 // half its depth
export const H = 6.5
export const GARDEN = 16 // from the veranda to the gate
/** What a walker can't go through: the hall and its veranda, the U behind, the gate's pillars, the figure, the kapok (its frame). */
export const MUSEE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 0, z: 0, hw: W + 0.5, hd: D + 0.5, rot: 0, top: H },
  { x: -W + 7, z: -D - 9, hw: 7, hd: 4.5, rot: 0, top: 4.4 },
  { x: W - 7, z: -D - 9, hw: 7, hd: 4.5, rot: 0, top: 4.4 },
  { x: 0, z: -D - 18, hw: 17, hd: 4.5, rot: 0, top: 4.4 },
  { x: -4.5, z: D + GARDEN, r: 0.8 },
  { x: 4.5, z: D + GARDEN, r: 0.8 },
  { x: -6, z: D + 8, r: 1.3 },
  { x: 14, z: D + 10, r: 1.4 },
]
