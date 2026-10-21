import { useSyncExternalStore } from 'react'

// The moto-taxi on a long way. The Sim walks (runs, if it's far); a long way,
// a moto-taxi is offered (Walker publishes how far), the player takes it or
// not (Play pays the fare: backend sims/moto.go), and the Sim rides the rest.

/** The fare for a ride this long (metres): backend sims/moto.go says the same. */
export const motoFare = (metres: number) => 200 + Math.ceil(metres / 500) * 100

type Moto = { offer: number | null; paid: boolean }
let state: Moto = { offer: null, paid: false }
const listeners = new Set<() => void>()
const set = (s: Moto) => ((state = s), listeners.forEach((f) => f()))

/** A long way ahead (metres), or none. */
export const offerMoto = (metres: number | null) => {
  if (metres !== state.offer || (metres === null && state.paid)) set({ offer: metres, paid: metres === null ? false : state.paid })
}
/** The player paid: the Sim gets on. */
export const motoPaid = () => set({ ...state, paid: true })
/** Read in the frame loop: whether the ride is paid for. */
export const motoTaken = () => state.paid
const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))
export const useMoto = () => useSyncExternalStore(subscribe, () => state)
