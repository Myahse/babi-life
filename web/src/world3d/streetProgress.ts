import { useSyncExternalStore } from 'react'

// How far the street's 3D has come (world3d/open/OpenWorld reports, world3d/StreetComing shows it
// over the game's screen). No three.js here: the game's screen has it before the street's code.

export type StreetProgress = { /** The pieces of the map around the Sim drawn */ have: number; /** and asked for */ want: number }

let progress: StreetProgress = { have: 0, want: 0 }
let marked = false
const listeners = new Set<() => void>()

/** Told by the street each time it looks at what to load: how many pieces near the Sim are drawn, of how many. */
export function reportStreet(have: number, want: number) {
  if (have === progress.have && want === progress.want) return
  progress = { have, want }
  // For the load measurements (Performance panel, tools): when the street first stood.
  if (have > 0 && !marked) {
    marked = true
    performance.mark?.('babi:street')
  }
  listeners.forEach((f) => f())
}

const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => void listeners.delete(f)
}
export const useStreetProgress = () => useSyncExternalStore(subscribe, () => progress)
