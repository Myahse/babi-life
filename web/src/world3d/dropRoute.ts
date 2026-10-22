import { useSyncExternalStore } from 'react'

// On the way to a place, a tap elsewhere on the ground: the Sim doesn't drop the way at once (a
// slip of the finger, the moto-taxi paid for…); the player is asked first (Play's DropRouteAsk), and
// the Walker goes there only once they say so.

type Spot = { x: number; z: number; /** The place the Sim was going to. */ from: string; moto: boolean }
let ask: Spot | null = null
let go: Spot | null = null
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((f) => f())

/** A tap on the ground on the way: ask before going there. */
export const askDrop = (s: Spot) => ((ask = s), changed())
/** The answer: go there (dropping the way), or keep on. */
export const answerDrop = (drop: boolean) => {
  if (!ask) return
  go = drop ? ask : null
  ask = null
  changed()
}
/** Read in the frame loop: where to go, once the player said yes. */
export const takeDrop = () => {
  const g = go
  go = null
  return g
}
const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))
export const useDropAsk = () => useSyncExternalStore(subscribe, () => ask)
