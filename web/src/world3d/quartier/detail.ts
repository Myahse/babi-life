import { universPlayed, useQuartierWorld } from './store'

// « Mon quartier »'s own world (update « mon-quartier ») is small: four chunks, about 1.2 km across, nothing loading
// past them. What the open city draws simpler or not at all past a few dozen metres (to keep its kilometres of
// streets fast) is drawn in full over the whole world there, so the far side of the quartier seen from the raised
// camera has the same detail as the street at one's feet. Only while that world is played: the city keeps its own
// distances.

/** The quartier's own world is drawn in the street now (read where React isn't: a frame loop, a filter). */
export const quartierNow = () => !!universPlayed()
/** The same, followed (a component re-drawn when one goes in or out of the quartier). */
export const useQuartierPlayed = () => useQuartierWorld((q) => !!universPlayed(q))

/** The whole world from anywhere in it (m): its far corner from the other is under 1 700 m. */
export const Q_WHOLE = 1800
/** A distance from the Sim things of the street are drawn within (doorsteps, sellers, stalls…): in the quartier the whole world (or `upTo`: a maquis's crowd of three dozen Sims, 260 m). */
export const qNear = (n: number, upTo = Q_WHOLE) => (quartierNow() ? Math.max(n, upTo) : n)

/**
 * The realistic Sims (avatar/persos.ts) in the quartier: anywhere in the world, the nearest up to this many by
 * device (the city: 4 / 10 / 20 within 14 m).
 */
export const Q_PERSOS_CAP = { simple: 12, normal: 30, haute: 60 } as const
/**
 * Up to here (m from the camera) a Sim is the whole animated one in the quartier (the city: 30 m, then the far
 * figure). Just short of where Human.tsx stops drawing anyone (125 m on a phone of four cores, 190 m past it), so
 * nobody turns into the far figure on the way: the raised camera is 20 to 140 m from the street.
 */
export const Q_PEOPLE = 116
/** The haze in the quartier (m: where it starts, where it hides all): only the air's, the far side of the world crisp. */
export const Q_FOG: [number, number] = [800, 5600]
/** The walls' props on a small phone (« simple »): round the view this far only (m), not the whole world. */
export const Q_PROPS_SIMPLE = 260
