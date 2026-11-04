// playceMarcory.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

/** The boxes, left to right: x from, x to, height, depth back from the front (z 0). */
export const MARKET = { x0: -46, x1: -8, h: 11, d: 34 }
export const CORE = { x0: -8, x1: 12, h: 15, d: 30 }
export const GALLERY = { x0: 12, x1: 46, h: 12.5, d: 30 }
export const BOXES = [MARKET, CORE, GALLERY]
/** The entrance's frame: its pillars' x, how high, how far it stands out. */
export const FRAME = { x0: -5, x1: 10, h: 18, out: 3 }
/** What one can't walk through: the boxes, the frame's pillars, the trolleys' shelter. */
export const PLAYCE_MARCORY_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  ...BOXES.map((b) => ({ x: (b.x0 + b.x1) / 2, z: -b.d / 2, hw: (b.x1 - b.x0) / 2 + 0.3, hd: b.d / 2 + 0.3, rot: 0, top: b.h })),
  ...[FRAME.x0 + 1, FRAME.x1 - 1].map((x) => ({ x, z: FRAME.out / 2 - 0.5, hw: 1.2, hd: (FRAME.out + 1) / 2 + 0.2, rot: 0, top: FRAME.h })),
  { x: -22, z: 2.6, hw: 2.3, hd: 0.9, rot: 0, top: 2.4 },
]
