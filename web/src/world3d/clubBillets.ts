import { useSyncExternalStore } from 'react'

// A handful of notes thrown over the dancers (backend sims/billets.go): the
// button (screens/Play) counts the throws, the club (world3d/clubDecor) sees
// each one fly from the Sim to the podiums, and the dancers answer it.

let state = { n: 0, amount: 0, at: 0 }
const listeners = new Set<() => void>()
/** A throw: how much (the bigger, the more notes fly). */
export const throwBillets = (amount: number) => ((state = { n: state.n + 1, amount, at: performance.now() }), listeners.forEach((f) => f()))
export const useBillets = () => useSyncExternalStore((f) => (listeners.add(f), () => void listeners.delete(f)), () => state)
/** Read in the frame loop. */
export const lastBillets = () => state
