import { useSyncExternalStore } from 'react'

// What the player's Sim says (a bubble over its head, Walker.tsx): its needs, the hour, a tap on it, the
// player coming back. One line at a time, a few seconds each.

export const simVoice = { text: '', until: 0 }
const listeners = new Set<() => void>()
const tell = () => listeners.forEach((f) => f())
let timer: ReturnType<typeof setTimeout> | null = null

/** The Sim says it (over what it was saying). */
export function say(text: string, seconds = 4) {
  simVoice.text = text
  simVoice.until = Date.now() + seconds * 1000
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    simVoice.text = ''
    tell()
  }, seconds * 1000)
  tell()
}

const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))
/** What it's saying now ('' : nothing). */
export const useSaying = () => useSyncExternalStore(subscribe, () => simVoice.text)
