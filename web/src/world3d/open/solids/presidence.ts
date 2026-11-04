// presidence.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

export const W = 30 // half the palace's length
export const D = 12 // half its depth
export const H = 11
export const FRONT = D
export const FORECOURT = 26 // from the facade to the gate on the boulevard
/** What a visitor can't walk through: the palace and the gate's pillars (its frame). */
export const PRESIDENCE_SOLID = [
  { x: 0, z: 0, hw: W + 1.5, hd: D + 1.5, rot: 0, top: H },
  { x: -7.5, z: FRONT + FORECOURT + 0.5, hw: 0.7, hd: 0.7, rot: 0, top: 3.6 },
  { x: 7.5, z: FRONT + FORECOURT + 0.5, hw: 0.7, hd: 0.7, rot: 0, top: 3.6 },
]
