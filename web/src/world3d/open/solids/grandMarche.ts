// grandMarche.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

export const W = 52 // half its length
export const D = 40 // half its depth
export const G = 5 // the ground floor's height
export const WAY = 12 // the way in's width
/** What a walker can't go through: the market's block (in by the way in), the pavement's tables (its frame). */
export const GRAND_MARCHE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: -(W + WAY / 2) / 2, z: 0, hw: (W - WAY / 2) / 2, hd: D, rot: 0, top: G },
  { x: (W + WAY / 2) / 2, z: 0, hw: (W - WAY / 2) / 2, hd: D, rot: 0, top: G },
  { x: 0, z: -D / 2 - 1, hw: WAY / 2, hd: D / 2 + 1, rot: 0, top: G },
  ...[-38, -30, -22, 22, 30, 38].map((x) => ({ x, z: D + 5, hw: 1.6, hd: 0.9, rot: 0, top: 1 })),
]
