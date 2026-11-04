// palaisCulture.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

export const W = 44 // half its length
export const D = 20 // half its depth
export const H = 12
export const PORCH = 8 // the portico's depth
/** What a walker can't go through: the hall, the portico's pillars, the fountain, the ticket window (its frame). */
export const PALAIS_CULTURE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 0, z: 0, hw: W + 0.5, hd: D + 0.5, rot: 0, top: H },
  ...[...Array(14)].map((_, i) => ({ x: -26 + i * 4, z: D + PORCH - 0.6, r: 0.6 })),
  { x: 0, z: D + PORCH + 15, r: 4.2 },
  { x: 24, z: D + PORCH + 7, hw: 2.6, hd: 1.6, rot: 0, top: 3.4 },
]
