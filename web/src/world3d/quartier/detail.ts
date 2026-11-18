import { universPlayed, useQuartierWorld } from './store'
import { useBabiZone } from '../open/babiZones'

// « Mon quartier »'s own world (update « mon-quartier ») is small: four chunks, about 1.2 km across, nothing loading
// past them. What the open city draws simpler or not at all past a few dozen metres (to keep its kilometres of
// streets fast) is drawn in full over the whole world there, so the far side of the quartier seen from the raised
// camera has the same detail as the street at one's feet. Only while that world is played: the city keeps its own
// distances.

/** The quartier's own world is drawn in the street now (read where React isn't: a frame loop, a filter). */
export const quartierNow = () => !!universPlayed()
/** The same, followed (a component re-drawn when one goes in or out of the quartier). */
export const useQuartierPlayed = () => useQuartierWorld((q) => !!universPlayed(q))

/**
 * Drawn in full over the whole world: in the quartier's world, and in a neighbourhood of Babi (« babi-quartiers »,
 * open/babiZones.ts), as small, its own streets alone loaded. What the distances below follow (not the quartier's
 * own things: its camera, its lots, its life).
 */
export const wholeNow = () => quartierNow() || !!useBabiZone.getState().zone
/** The same, followed. */
export const useWholePlayed = () => {
  const q = useQuartierPlayed()
  const z = useBabiZone((s) => !!s.zone)
  return q || z
}

/** The whole world from anywhere in it (m): its far corner from the other is under 1 700 m. */
export const Q_WHOLE = 1800
/** A distance from the Sim things of the street are drawn within (doorsteps, sellers, stalls…): in the quartier the whole world (or `upTo`: a maquis's crowd of three dozen Sims, 260 m). */
export const qNear = (n: number, upTo = Q_WHOLE) => (wholeNow() ? Math.max(n, upTo) : n)

/**
 * The realistic Sims (avatar/persos.ts) in the quartier: anywhere in the world, the nearest up to this many by
 * device (the city: 4 / 10 / 20 within 14 m).
 */
export const Q_PERSOS_CAP = { simple: 12, normal: 30, haute: 60 } as const
/**
 * Up to here (m from the camera) a Sim is the whole animated one in the quartier (the city: 30 m, then the far
 * figure); past it the simple far figure, at its size, over the whole world (Human.tsx GoneFrom = Q_WHOLE: the city
 * stops drawing anyone at 125 m, 190 m on a phone of more than four cores). The raised camera is 4 to 150 m from the Sim.
 */
export const Q_PEOPLE = 116
/** The haze in the quartier (m: where it starts, where it hides all): only the air's, the far side of the world crisp. */
export const Q_FOG: [number, number] = [800, 5600]
/** The walls' props on a small phone (« simple »): round the view this far only (m), not the whole world. */
export const Q_PROPS_SIMPLE = 260
