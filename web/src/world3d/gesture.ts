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

// A played action's step at home (components/defi/Gestes.tsx): where in the house it's done (a spot
// of world3d/homeSpots.ts: the bed, the basin, the shower…), standing by it or as the spot has it,
// and the pose: the house's own scene shows the Sim there, walking from one to the next.
export type HomeStep = { at: string; pose: Pose; standing?: boolean }
let step: HomeStep | null = null
const stepSubs = new Set<() => void>()
export function setHomeStep(s: HomeStep | null) {
  if (step?.at === s?.at && step?.pose === s?.pose && step?.standing === s?.standing) return
  step = s
  stepSubs.forEach((f) => f())
  // A new place to go to: not there yet (when a house is showing).
  if (arrived !== null) setHomeArrived(false)
}
export function useHomeStep(): HomeStep | null {
  return useSyncExternalStore(
    (f) => (stepSubs.add(f), () => void stepSubs.delete(f)),
    () => step,
  )
}

// Whether the Sim has got to the step's place in the house (HomeInside walks it there): the step's
// arrows wait for it (components/defi/Gestes.tsx), so a quick player never leaves it halfway in a
// big house. null: no house showing (the lab, a hotel): nothing to wait for.
let arrived: boolean | null = null
const arrivedSubs = new Set<() => void>()
export function setHomeArrived(v: boolean | null) {
  if (arrived === v) return
  arrived = v
  arrivedSubs.forEach((f) => f())
}
export function useHomeArrived(): boolean | null {
  return useSyncExternalStore(
    (f) => (arrivedSubs.add(f), () => void arrivedSubs.delete(f)),
    () => arrived,
  )
}
