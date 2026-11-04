// capsud.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

/** The box: x from, x to, height, depth back from the front (z 0). */
export const MALL = { x0: -42, x1: 42, h: 9, d: 32 }
/** The left entrance: the glass rotunda's middle and radius, the wave over it. */
export const ENTRY = { x: -29, r: 6.5, h: 6.5 }
/** What one can't walk through: the box, the glass rotunda, the sign's post, the billboard's legs. */
export const CAPSUD_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 0, z: -MALL.d / 2, hw: (MALL.x1 - MALL.x0) / 2 + 0.3, hd: MALL.d / 2 + 0.3, rot: 0, top: MALL.h },
  { x: ENTRY.x, z: 0, r: ENTRY.r + 0.3 },
  { x: -11, z: 2.4, r: 0.5 },
  { x: 38, z: 30, hw: 3, hd: 0.5, rot: -0.35, top: 7.8 },
]
