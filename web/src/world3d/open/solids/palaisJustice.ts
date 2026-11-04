// palaisJustice.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

export const W = 27 // half the building's length
export const D = 11 // half its depth
export const H = 17.5
export const FRONT = D // the facade's z
export const FORECOURT = 14 // from the facade to the gate on the boulevard
/** What a visitor can't walk through: the building and the gate's pillars (its frame). */
export const PALAIS_SOLID = [
  { x: 0, z: 0, hw: W + 1, hd: D + 1, rot: 0, top: H },
  { x: -7, z: FRONT + FORECOURT + 1, hw: 0.6, hd: 0.6, rot: 0, top: 2.8 },
  { x: 7, z: FRONT + FORECOURT + 1, hw: 0.6, hd: 0.6, rot: 0, top: 2.8 },
]
