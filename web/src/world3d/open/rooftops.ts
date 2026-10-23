// Landmarks one goes up on (landmarks.tsx): the action that takes the Sim
// there, how high their top is, where it stands on it and how far it may
// walk about (in the landmark's own frame: +z its front, the street's side).
// Up there it's the street's own city all round, not a picture of one.

type XZ = [number, number]
export type Rooftop = { act: string; y: number; spot: XZ; half: number }

export const ROOFTOPS: Record<string, Rooftop> = {
  // La Pyramide's crown, on its fifteenth storey (10 m square, a rail round it).
  'plateau-pyramide': { act: 'terrasse-pyramide', y: 15 * 3.9 + 1, spot: [0, 3.6], half: 4.3 },
}

/** The rooftop an action takes the Sim up on, if any. */
export const rooftopFor = (place: string | null | undefined, act: string | undefined) => {
  const r = place ? ROOFTOPS[place] : undefined
  return r && r.act === act ? r : undefined
}
