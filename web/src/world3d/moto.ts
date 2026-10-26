import { useSyncExternalStore } from 'react'

// A ride on a long way in the commune. The Sim walks (runs, if it's far); a long way, a ride is
// offered (Walker publishes how far), the player picks one or walks (Play pays the fare: backend
// sims/moto.go), and the Sim rides the rest: behind a moto-taxi driver, in a taxi, in the
// commune's woro-woro, squeezed in a gbaka.

export type RideKind = 'moto' | 'taxi' | 'woro' | 'gbaka'

/** Each ride: its name, its fare (to get on, and every so many metres: backend rideFares says the same), how fast it goes (m/s). */
export const RIDES: Record<RideKind, { name: string; base: number; step: number; every: number; speed: number }> = {
  moto: { name: 'Moto-taxi', base: 200, step: 100, every: 500, speed: 9 },
  taxi: { name: 'Taxi', base: 300, step: 150, every: 500, speed: 8.5 },
  woro: { name: 'Woro-woro', base: 200, step: 50, every: 2000, speed: 8 },
  gbaka: { name: 'Gbaka', base: 150, step: 50, every: 3000, speed: 7 },
}

/** The fare for a ride this long (metres). */
export const rideFare = (kind: RideKind, metres: number) => RIDES[kind].base + Math.ceil(metres / RIDES[kind].every) * RIDES[kind].step
export const motoFare = (metres: number) => rideFare('moto', metres)

/** The ride taken: which, and its colours (the commune's woro-woro). */
export type Taken = { kind: RideKind; color: string; trim?: string }
/** `walk`: the player chose to go on foot. `since`: when the offer came (ms), the Sim waiting for the choice till then. */
type Moto = { offer: number | null; paid: Taken | null; walk: boolean; since: number }
let state: Moto = { offer: null, paid: null, walk: false, since: 0 }
const listeners = new Set<() => void>()
const set = (s: Moto) => ((state = s), listeners.forEach((f) => f()))

/** A long way ahead (metres), or none. */
export const offerMoto = (metres: number | null) => {
  if (metres !== state.offer || (metres === null && state.paid)) set({ offer: metres, paid: metres === null ? null : state.paid, walk: false, since: performance.now() })
}
/** The player paid: the Sim gets on. */
export const motoPaid = (taken: Taken = { kind: 'moto', color: '#c92a2a' }) => set({ ...state, paid: taken })
/** The player chose to walk it. */
export const motoWalk = () => set({ ...state, walk: true })
/** How long the Sim waits for the choice at most (the offer unseen: a screen without it). */
const WAIT = 20_000
/** Read in the frame loop: the way is long and the player hasn't chosen yet — the Sim waits to know how it goes. */
export const motoAsking = () => state.offer !== null && !state.paid && !state.walk && performance.now() - state.since < WAIT
/** Read in the frame loop: the ride paid for, if any. */
export const motoTaken = () => state.paid
const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))
export const useMoto = () => useSyncExternalStore(subscribe, () => state)
