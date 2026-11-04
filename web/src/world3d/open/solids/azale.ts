// azale.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

export const STOREY = 3.5
export const FLOORS = 16
export const TOWER = { x0: -9, x1: 9, z0: -18, z1: -4 }
export const TOP = 6 + FLOORS * STOREY
/** The copper block over the entrance, standing in front of the tower. */
export const FRONT = { x0: -7, x1: 7, z0: -4, z1: 2, h: 22 }
export const WINGS = [
  { x0: -30, x1: -13, z0: -14, z1: 0, h: 10, c: '#d8c6a2' },
  { x0: 7, x1: 30, z0: -16, z1: 2, h: 14, c: '#e8dcc4' },
] as const
/** What one can't walk through: the tower and its shafts, the copper block, the wings, the railing. */
export const AZALE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 1, z: (TOWER.z0 + TOWER.z1) / 2, hw: 15, hd: (TOWER.z1 - TOWER.z0) / 2 + 0.5, rot: 0, top: TOP + 3 },
  { x: 0, z: (FRONT.z0 + FRONT.z1) / 2, hw: (FRONT.x1 - FRONT.x0) / 2 + 0.4, hd: (FRONT.z1 - FRONT.z0) / 2 + 0.4, rot: 0, top: FRONT.h },
  ...WINGS.map((w) => ({ x: (w.x0 + w.x1) / 2, z: (w.z0 + w.z1) / 2, hw: (w.x1 - w.x0) / 2 + 0.4, hd: (w.z1 - w.z0) / 2 + 0.4, rot: 0, top: w.h })),
  { x: -12, z: 12, hw: 18, hd: 0.3, rot: 0, top: 2 },
  { x: 24, z: 12, hw: 10, hd: 0.3, rot: 0, top: 2 },
]
