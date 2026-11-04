import { useSyncExternalStore } from 'react'
import type * as THREE from 'three'

// What the street gestures (rueGestes.tsx, the update « rue-vivante-gestes ») share with the
// passers-by (OpenWorld's Passersby): where each one drawn now is, and the one greeted (or greeting
// in passing), who stops and answers in a bubble over its head.

/** The passers-by drawn now: their group (its position) and their name. */
export const passers = new Map<string, { g: THREE.Group; name: string }>()

/** A passer-by greeted (stops, turns to the Sim and answers) or greeting in passing (a word, walking on). */
export type Greet = { id: string; text: string; stop: boolean }
let greet: Greet | null = null
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()
const tell = () => listeners.forEach((f) => f())

export function greetPasser(id: string, text: string, stop: boolean, seconds: number) {
  greet = { id, text, stop }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => ((greet = null), tell()), seconds * 1000)
  tell()
}

const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))
/** The passer-by greeted now, for the one drawn. */
export const useGreeted = () => useSyncExternalStore(subscribe, () => greet)
