// noum.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

/** The podium: six tall floors, the screen on the left, the panels on the right. */
export const POD = { x0: -30, x1: 26, front: 0, depth: 20, h: 24 }
/** The tower over the podium's left half, lifted on the pool deck's glass storey. */
export const TOWER = { x0: -26, x1: 2, z0: -18, z1: -4, base: POD.h + 5, floors: 18, storey: 3.3 }
export const TOWER_TOP = TOWER.base + TOWER.floors * TOWER.storey
/** What one can't walk through: the podium (the tower stands on it), the awning's posts. */
export const NOUM_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: (POD.x0 + POD.x1) / 2, z: POD.front - POD.depth / 2 + 0.6, hw: (POD.x1 - POD.x0) / 2 + 0.5, hd: POD.depth / 2 + 1.2, rot: 0, top: TOWER_TOP + 3 },
  { x: 13, z: POD.front + 6.5, r: 0.5 },
  { x: 21, z: POD.front + 6.5, r: 0.5 },
]
