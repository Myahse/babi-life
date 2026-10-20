import { useSyncExternalStore } from 'react'
import type { Pose } from '../avatar/Human'

// The emote the player's Sim is playing (from the « Émotes » sheet,
// screens/EmoteSheet.tsx): Walker.tsx shows it while the Sim stands, and it
// goes to the other players as the live pose. It stops at its time, or as
// soon as the Sim walks off.

export const emoteNow = { pose: null as Pose | null, until: 0 }

const listeners = new Set<() => void>()
const tell = () => listeners.forEach((f) => f())
let timer: ReturnType<typeof setTimeout> | null = null

export function playEmote(pose: Pose, seconds: number) {
  emoteNow.pose = pose
  emoteNow.until = Date.now() + seconds * 1000
  if (timer) clearTimeout(timer)
  timer = setTimeout(stopEmote, seconds * 1000)
  tell()
}

export function stopEmote() {
  if (!emoteNow.pose) return
  emoteNow.pose = null
  if (timer) clearTimeout(timer)
  timer = null
  tell()
}

const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))
/** The emote playing now, for a component that shows it. */
export const useEmote = () => useSyncExternalStore(subscribe, () => emoteNow.pose)
