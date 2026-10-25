import { useSyncExternalStore } from 'react'
import type { Pose } from '../avatar/Human'
import type { Look } from '../lib/types'

// Anyone in the world can be talked to: the passers-by, but also the people
// in the maquis, the club, the hotel lobby, the pasteur and his listeners.
// Grown-ups only: a new friend from the chat is an adult (romance can follow),
// so the children in a scene stay out of it. A tap calls talkTo; the game screen
// (screens/Play.tsx) opens the chat sheet. A store, not a prop: the people
// are drawn deep in many different scenes.

/** Someone you can talk to. `doing`: what they're at when you come up (« en train de danser »). */
export type Npc = { id: string; name: string; gender: 'femme' | 'homme'; seed: number; look: Look; doing?: string }

let handler: ((npc: Npc) => void) | null = null
/** The game screen listens; the returned function stops it. */
export function setTalkHandler(f: (npc: Npc) => void) {
  handler = f
  return () => {
    if (handler === f) handler = null
  }
}
/** Tapped: open the chat with them (nothing in the labs, where no one listens). */
export const talkTo = (npc: Npc) => handler?.(npc)
// In development, a test can open a chat without finding someone to tap.
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __talkTo: talkTo })

// Who the Sim is talking to now: they stop what they're doing to answer.
let talking: string | null = null
const listeners = new Set<() => void>()
export function setTalking(id: string | null) {
  if (talking === id) return
  talking = id
  listeners.forEach((f) => f())
}
const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))
export const useTalking = () => useSyncExternalStore(subscribe, () => talking)

export const NPC_NAMES = {
  femme: ['Awa', 'Aya', 'Mariam', 'Adjoua', 'Fatou', 'Akissi', 'Ruth', 'Affoué', 'Grâce', 'Nadège', 'Salimata', 'Ange', 'Tatiana', 'Bintou', 'Prisca', 'Clarisse'],
  homme: ['Kouadio', 'Yao', 'Moussa', 'Koffi', 'Serge', 'Ibrahim', 'Didier', 'Konan', 'Junior', 'Lassina', 'Arouna', 'Fabrice', 'Brice', 'Seydou', 'Hervé', 'Wilfried'],
}

/** A first name, always the same for the same person. */
export function nameFor(gender: 'femme' | 'homme', seed: number) {
  const l = NPC_NAMES[gender]
  return l[Math.abs(Math.floor(seed)) % l.length]
}

/** What someone is at, from their pose: shown in the chat sheet, and how they greet you. */
const DOING: Partial<Record<Pose, string>> = {
  dance: 'en train de danser',
  drink: 'en train de boire un verre',
  eat: 'en train de manger',
  talk: 'en train de causer',
  phone: 'au téléphone',
  sit: 'assis·e',
  pray: 'en prière',
  cheer: "en train d'ambiancer",
  throw: 'en train de travailler les billets',
  rant: 'en train de parler tout seul',
  busy: 'au travail',
  cook: 'en train de cuisiner',
  write: 'en train d’écrire',
  walk: 'en train de marcher',
  sleep: 'en train de dormir',
  wash: 'en train de se laver',
  hug: 'dans les bras de quelqu’un',
  idle: 'là, tranquille',
  film: 'en train de filmer',
  dj: 'aux platines',
}
export const doingOf = (pose: Pose): string | undefined => DOING[pose]
