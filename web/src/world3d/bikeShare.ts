import { useSyncExternalStore } from 'react'
import type { XZ } from './open/geo'

// Vélo Babi between the street and the screen: where the station of the commune stands (the street puts it
// there, open/bikeStation.tsx), how many bikes are in its racks (the screen reads it from the server,
// components/BikeShare.tsx), and the id a hired bike is driven under (drive.ts: not one of the garage's).

export const RENTED = -1

type State = { at: XZ | null; dock: string | null; free: number }
let state: State = { at: null, dock: null, free: 0 }
const listeners = new Set<() => void>()
const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))

export function setBikeStation(next: Partial<State>) {
  state = { ...state, ...next }
  listeners.forEach((f) => f())
}
export const bikeStation = () => state
export const useBikeStation = () => useSyncExternalStore(subscribe, () => state)
