// hotelIvoire.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

export type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }
/** A winding pool: rounded basins in a chain (each a disc stretched), turquoise. */
export const POOLS: { at: [number, number]; r: [number, number]; rot: number }[] = [
  { at: [32, -2], r: [7, 4.5], rot: 0.3 },
  { at: [40, -8], r: [8, 5], rot: -0.4 },
  { at: [49, -12], r: [6, 4], rot: 0.2 },
  { at: [44, -20], r: [9, 5.5], rot: 0.9 },
  { at: [36, -26], r: [6, 4], rot: -0.2 },
  { at: [26, -22], r: [5, 3.5], rot: 0.5 },
]
/** What a guest walking the grounds can't go through (the grounds' own frame):
 * the tower and its lobby, the main block on its podium, the Palais des
 * Congrès, the pools (their middles: the edges and the footbridges stay
 * walkable), the pavilions, the hedges, the lagoon wall. */
export const IVOIRE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 10, z: -6, hw: 10.5, hd: 8.5, rot: 0, top: 100 },
  { x: -30, z: -36, hw: 35, hd: 15, rot: 0, top: 6.2 },
  { x: -42, z: 14, r: 21.5 },
  ...POOLS.map((p) => ({ x: p.at[0], z: p.at[1], hw: p.r[0] * 0.7, hd: p.r[1] * 0.7, rot: p.rot })),
  ...[
    [60, -12],
    [63, 2],
    [56, -38],
  ].map(([x, z]) => ({ x, z, r: 4.2 })),
  { x: 0, z: -66, hw: 70, hd: 0.3, rot: 0, top: 1 },
]
export const HEDGES: Block[] = [
  { p: [31, 0.5, 21.5], s: [48, 1, 0.8] },
  { p: [31, 0.5, 50.5], s: [48, 1, 0.8] },
  { p: [7, 0.5, 36], s: [0.8, 1, 28] },
  { p: [55, 0.5, 36], s: [0.8, 1, 28] },
  { p: [-12, 0.5, 40], s: [0.8, 1, 18] },
]
IVOIRE_SOLID.push(...HEDGES.map((h) => ({ x: h.p[0], z: h.p[2], hw: h.s[0] / 2, hd: h.s[2] / 2, rot: 0, top: 1 })))
