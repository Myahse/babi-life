// cathedral.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.
import type { Obstacle } from '../../obstacles'

/** The plan: half-width FW at the front (z F), BW at the back (z B, the tower); the roof H0 high at the front, H1 at the back. */
export const NAVE = { F: 34, B: -50, FW: 40, BW: 6, H0: 11, H1: 36 }
/** The great tower: its foot, its height, how far it leans out (radians, toward -z). */
export const TOWER = { z: NAVE.B - 2, H: 70, lean: 0.16, arm: 52 }
/** Half the triangle's width at z. */
export const naveHalf = (z: number) => NAVE.BW + ((z - NAVE.B) / (NAVE.F - NAVE.B)) * (NAVE.FW - NAVE.BW)
/** The roof's height at z. */
export const roofAt = (z: number) => NAVE.H1 + ((z - NAVE.B) / (NAVE.F - NAVE.B)) * (NAVE.H0 - NAVE.H1)
/** What a walker can't go through: the triangle in slices, the towers. */
export const CATHEDRAL_SOLID: Obstacle[] = [
  ...[...Array(12)].map((_, i) => {
    const [z0, z1] = [NAVE.B + (i * (NAVE.F - NAVE.B)) / 12, NAVE.B + ((i + 1) * (NAVE.F - NAVE.B)) / 12]
    return { x: 0, z: (z0 + z1) / 2, hw: naveHalf((z0 + z1) / 2) + 0.6, hd: (z1 - z0) / 2, rot: 0, top: roofAt(z1) }
  }),
  { x: 0, z: TOWER.z, r: 4.5 },
  { x: -(NAVE.FW - 3), z: NAVE.F - 3, r: 2 },
  { x: NAVE.FW - 3, z: NAVE.F - 3, r: 2 },
  ...[-13, -6.5, 6.5, 13].map((x) => ({ x, z: NAVE.F + 5.5, r: 0.5 })),
]
