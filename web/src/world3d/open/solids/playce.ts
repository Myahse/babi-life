// playce.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

/** The boxes, left to right: x from, x to, height, depth back from the front (z 0). */
export const LEFT_PORCH = { x0: -48, x1: -38, h: 9, d: 20 }
export const WING = { x0: -38, x1: -14, h: 8.5, d: 26 }
export const HALL = { x0: -14, x1: -2, h: 12, d: 24 }
export const MARKET = { x0: -2, x1: 40, h: 14, d: 32 }
export const END = { x0: 40, x1: 48, h: 11, d: 26 }
export const BOXES = [LEFT_PORCH, WING, HALL, MARKET, END]
/** What one can't walk through: the boxes, the porches' posts, the tent. */
export const PLAYCE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  ...BOXES.map((b) => ({ x: (b.x0 + b.x1) / 2, z: -b.d / 2, hw: (b.x1 - b.x0) / 2 + 0.3, hd: b.d / 2 + 0.3, rot: 0, top: b.h })),
  { x: -34, z: 11, hw: 3.2, hd: 2.2, rot: 0, top: 3 },
  { x: 22, z: 2.6, hw: 2.3, hd: 0.9, rot: 0, top: 2.4 },
]
