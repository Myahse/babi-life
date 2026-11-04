// mosqueM6.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.
import type { Obstacle } from '../../obstacles'

/** The prayer hall: half-width, front and back. */
export const HALL = { hw: 36, front: 14, back: -34, h: 13 }
/** The courtyard before it, to the gate. */
export const COURT = { hw: 30, front: 44 }
/** The minaret: its corner, side, height. */
export const MINARET = { x: COURT.hw - 2, z: COURT.front - 4, side: 9, h: 69 }
/** What a walker can't go through: the hall, the galleries, the fountain, the minaret, the gate's wall (its arch open). */
export const MOSQUE_M6_SOLID: Obstacle[] = [
  { x: 0, z: (HALL.front + HALL.back) / 2, hw: HALL.hw, hd: (HALL.front - HALL.back) / 2, rot: 0, top: HALL.h },
  { x: -(COURT.hw + 3), z: (HALL.front + COURT.front) / 2, hw: 3, hd: (COURT.front - HALL.front) / 2, rot: 0, top: 8 },
  { x: COURT.hw + 3, z: (HALL.front + COURT.front) / 2, hw: 3, hd: (COURT.front - HALL.front) / 2, rot: 0, top: 8 },
  { x: 0, z: (HALL.front + COURT.front) / 2, r: 4.4 },
  { x: MINARET.x, z: MINARET.z, hw: MINARET.side / 2, hd: MINARET.side / 2, rot: 0, top: MINARET.h },
  { x: -5.5, z: COURT.front, hw: 2.5, hd: 1.5, rot: 0, top: 12 },
  { x: 5.5, z: COURT.front, hw: 2.5, hd: 1.5, rot: 0, top: 12 },
  ...[-1, 1].map((s): Obstacle => ({ x: s * (8 + (COURT.hw + 6 - 8) / 2), z: COURT.front, hw: (COURT.hw + 6 - 8) / 2, hd: 0.4, rot: 0, top: 4 })),
]
