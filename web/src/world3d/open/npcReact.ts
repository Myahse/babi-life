import { useSyncExternalStore } from 'react'
import type { Pose } from '../../avatar/Human'

// How the passer-by you talk to takes what you said (components/ChatSheet.tsx):
// a laugh, a clap, a shrug… played on them for a few seconds, then back to
// talking. One at a time: there's only one person you talk to.

let now: { id: string; pose: Pose } | null = null
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()
const tell = () => listeners.forEach((f) => f())

const GOOD: Pose[] = ['laugh', 'clap', 'thumbsup', 'cheer']
const BAD: Pose[] = ['shrug', 'facepalm', 'rant']
const pick = (l: Pose[]) => l[Math.floor(Math.random() * l.length)]

/** Someone reacts: a pose of their own, or one for how they took it ("good", "bad", "bye", "hello"). */
export function npcReact(id: string, how: Pose | 'good' | 'bad' | 'bye' | 'hello', seconds = 3) {
  const pose = how === 'good' ? pick(GOOD) : how === 'bad' ? pick(BAD) : how === 'bye' || how === 'hello' ? 'wave' : how
  now = { id, pose }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => ((now = null), tell()), seconds * 1000)
  tell()
}

const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))
/** The reaction playing now (whose, and which). */
export const useNpcReaction = () => useSyncExternalStore(subscribe, () => now)
