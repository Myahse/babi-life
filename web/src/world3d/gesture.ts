import { useSyncExternalStore } from 'react'
import type { Pose } from '../avatar/Human'

// A gesture the Sim makes for a moment at work (a job's task done: scanning
// at the till, pleading, carrying the bags): the scenes that show it working
// take it over its pose meanwhile, then it goes back to its work.

let now: { pose: Pose; until: number } | null = null
const subs = new Set<() => void>()
const tell = () => subs.forEach((f) => f())

/** The Sim makes this gesture for a few seconds. */
export function gesture(pose: Pose, ms = 4000) {
  now = { pose, until: Date.now() + ms }
  tell()
  setTimeout(() => {
    if (now && now.until <= Date.now()) {
      now = null
      tell()
    }
  }, ms + 50)
}

const subscribe = (f: () => void) => {
  subs.add(f)
  return () => void subs.delete(f)
}

/** The gesture being made, if any. */
export function useGesture(): Pose | null {
  return useSyncExternalStore(subscribe, () => now?.pose ?? null)
}
