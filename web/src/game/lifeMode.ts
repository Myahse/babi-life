import { useSyncExternalStore } from 'react'
import type { Interaction, Needs } from '../lib/types'
import type { Npc, Where } from '../world3d/talk'

// Le mode vie (the update « mode-vie », backend sims/lifemode.go): the player watches the Sim live and
// gives it orders. A tap on an object of the house (world3d/HomeInside.tsx) or on someone of the family
// opens a wheel of what can be done there (components/LifeHud.tsx); each thing picked is queued at the
// top of the screen and done in turn, the Sim walking there and doing it in 3D (Play.tsx runs the queue:
// every order is still the ordinary request, interact, fridge/eat or chat, the server deciding). With
// nothing asked, free will picks what to do from the needs (chooseFree), on a timer, never per frame.
// A store, not a context: the scene draws in its own canvas.

export type LifeOrder = {
  key: number
  /** act: a place's action (interact); fridge: eaten from the fridge; chat: a word with someone of the family; open: the fridge's sheet. */
  kind: 'act' | 'fridge' | 'chat' | 'open'
  id: string
  label: string
  icon: string
  colors: [string, string]
  /** The place's action itself (kind act). */
  it?: Interaction
  /** Its game played (« Jouer pour un meilleur résultat »), not left to play by itself. */
  play?: boolean
  /** Picked by free will (given way to as soon as the player asks something). */
  free?: boolean
  /** kind chat: who, where they stand, what is said. */
  npc?: Npc
  where?: Where
  topic?: string
  /** kind fridge: what is eaten. */
  item?: string
}

/** One of the wheel's choices: an order to queue (why: what stops it now; game: it has a game to play). */
export type PieOption = { id: string; label: string; icon: string; colors: [string, string]; note?: string; why?: string; game?: boolean; order: Omit<LifeOrder, 'key'>; /** Done at once instead of queued (a word to another player: backend sims/playersocial.go). */ run?: () => void }
export type Pie = { x: number; y: number; title: string; options: PieOption[] }

type State = { queue: LifeOrder[]; started: number | null; freeWill: boolean; alwaysPlay: boolean; pie: Pie | null }

const read = (k: string, d: boolean) => {
  try {
    const v = localStorage.getItem(k)
    return v === null ? d : v === '1'
  } catch {
    return d
  }
}
const write = (k: string, v: boolean) => {
  try {
    localStorage.setItem(k, v ? '1' : '0')
  } catch {
    // (No storage: kept for this page only.)
  }
}

let state: State = { queue: [], started: null, freeWill: read('babi.vie.libre', true), alwaysPlay: read('babi.vie.jeux', false), pie: null }
const subs = new Set<() => void>()
const set = (s: Partial<State>) => {
  state = { ...state, ...s }
  subs.forEach((f) => f())
}
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f))
export const useLife = () => useSyncExternalStore(subscribe, () => state)
export const lifeState = () => state

/** The household (components/LifeHome.tsx): an order goes to the member directed, if one is (true: taken). */
let toMember: ((o: Omit<LifeOrder, 'key'>) => boolean) | null = null
export const routeToMember = (f: typeof toMember) => void (toMember = f)

/** At most this many orders wait (as the queue's icons fit across a phone). */
export const QUEUE_MAX = 6
let nextKey = 1

/** The wishes' perk « file-plus » (backend sims/envies.go): more orders wait. */
let queueExtra = 0
export const setQueueExtra = (n: number) => void (queueExtra = n)
export const queueMax = () => QUEUE_MAX + queueExtra

/** An order asked: after the others; the player's give way to nothing, free will's to the player's. */
export function enqueue(o: Omit<LifeOrder, 'key'>): LifeOrder | null {
  // Someone else of the house directed (game/household.ts): the order is theirs.
  if (!o.free && toMember?.(o)) {
    set({ pie: null })
    return null
  }
  // The player asks: what free will queued and hasn't started goes.
  const queue = o.free ? state.queue : state.queue.filter((q) => !q.free || q.key === state.started)
  if (queue.length >= queueMax()) return null
  const order = { ...o, key: nextKey++ }
  set({ queue: [...queue, order], pie: null })
  return order
}

/** An order taken off (tapped in the queue). Returns whether it was the one under way (to be stopped). */
export function cancel(key: number): boolean {
  const was = state.started === key
  set({ queue: state.queue.filter((q) => q.key !== key), started: was ? null : state.started })
  return was
}

/** The first order, done (or failed): the next one's turn. */
export function dropHead() {
  set({ queue: state.queue.slice(1), started: null })
}

export function markStarted(key: number) {
  set({ started: key })
}

export function clearQueue() {
  if (state.queue.length || state.started !== null) set({ queue: [], started: null })
}

export function openPie(pie: Pie | null) {
  set({ pie })
}

export function setFreeWill(on: boolean) {
  write('babi.vie.libre', on)
  set({ freeWill: on })
}

export function setAlwaysPlay(on: boolean) {
  write('babi.vie.jeux', on)
  set({ alwaysPlay: on })
}

/** Where the last tap on the screen was: the wheel opens there (the 3D scene's clicks don't carry it). */
export const lastTap = { x: 0, y: 0, at: 0 }
if (typeof window !== 'undefined')
  window.addEventListener(
    'pointerdown',
    (e) => {
      lastTap.x = e.clientX
      lastTap.y = e.clientY
      lastTap.at = performance.now()
    },
    { capture: true, passive: true },
  )

/** An object of the house tapped (HomeInside): its kind (the furniture's, 'self' for the Sim itself), its name, the things done at it (spot ids). */
export type Tapped = { kind: string; name: string; ids: string[] }
let onObject: ((o: Tapped) => void) | null = null
let onPerson: ((npc: Npc, where?: Where) => void) | null = null
/** Play's mode vie listens (one at a time); the returned function stops it. */
export function setLifeHandlers(object: (o: Tapped) => void, person: (npc: Npc, where?: Where) => void) {
  onObject = object
  onPerson = person
  return () => {
    if (onObject === object) onObject = null
    if (onPerson === person) onPerson = null
  }
}
export const lifeListening = () => !!onObject
export const tapObject = (o: Tapped) => onObject?.(o)
export const tapPerson = (npc: Npc, where?: Where) => onPerson?.(npc, where)
/** Another player's Sim tapped in a place (world3d/Interior.tsx): Play opens its wheel (or its card). */
let onPlayer: ((id: string) => void) | null = null
export const setPlayerTap = (f: typeof onPlayer) => void (onPlayer = f)
export const tapPlayer = (id: string) => onPlayer?.(id)
export const playerTappable = () => !!onPlayer

/** The family at home (HomeInside's Parents): who free will can go and talk to, and where they stand. */
export const people = new Map<string, { npc: Npc; where: Where; asleep?: boolean }>()
// (In development, a test talks to them without finding them on the screen.)
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __people: people })

/** Something free will may do: its id, what it does to the needs, what it costs and how long (game minutes). */
export type Candidate = { id: string; effect: Partial<Needs>; cost: number; minutes: number; /** It trains a skill (game/vie.ts SKILL_ACTS): done when all is well, more so in a good mood. */ skill?: boolean; /** Wanted for a reason of its own (the house dirty: the cleaning). */ bonus?: number }

const NEEDS: (keyof Needs)[] = ['hunger', 'energy', 'hygiene', 'social', 'fun']

/** How much a need asks to be seen to (0 full … 2.2 empty; below 15, urgent). */
const urge = (v: number) => (v < 15 ? 3 : ((100 - v) / 100) ** 2 * 2.2)

/** What each trait leans to (backend game/traits.go): a need weighed more. */
const LEAN: Record<string, Partial<Record<keyof Needs, number>>> = {
  gourmand: { hunger: 1.35 },
  dormeur: { energy: 1.35 },
  ambianceur: { social: 1.3, fun: 1.15 },
  artiste: { fun: 1.25 },
  dragueur: { social: 1.25 },
  sportif: { fun: 1.1, energy: 0.9 },
  travailleur: { fun: 0.85 },
}

/**
 * Free will: what the Sim does by itself now, from what it can do here, its needs, its traits, the hour
 * and its money; null when nothing is worth getting up for (it stays, idle). Weighted among the best few,
 * with some chance, the same thing twice in a row less likely. Cheap: called on a timer, a few candidates.
 */
export function chooseFree(cands: Candidate[], needs: Needs, traits: string[], hour: number, money: number, last: string | null, rnd: () => number = Math.random, /** The mood's score (le mode vie, game/vie.ts): low, it seeks comfort; high, it takes to its skills. */ mood = 0): string | null {
  const night = hour >= 22 || hour < 6
  const thrifty = traits.includes('econome')
  const scored: { id: string; s: number }[] = []
  for (const c of cands) {
    if (c.cost > 0 && c.cost > money * (thrifty ? 0.08 : 0.2)) continue
    const e = c.effect
    // A night's sleep only when tired (or at night and somewhat so).
    if ((e.energy ?? 0) >= 60 && !(needs.energy < 35 || (night && needs.energy < 75))) continue
    let s = 0
    for (const k of NEEDS) {
      const v = e[k] ?? 0
      let w = 1
      for (const t of traits) w *= LEAN[t]?.[k] ?? 1
      if (mood <= -2 && (k === 'fun' || k === 'social')) w *= 1.3
      if (v > 0) s += (Math.min(v, 100 - needs[k] + 10) * urge(needs[k]) * w) / 10
      // What it costs the needs counts more when that need is already low.
      else if (v < 0) s += v * (needs[k] < 30 ? 0.06 : 0.015)
    }
    if (c.cost > 0) s -= (c.cost / Math.max(1000, money)) * (thrifty ? 12 : 4)
    // A skill to work on (le mode vie): when nothing presses, more in a good mood, less in a bad one.
    if (c.skill && NEEDS.every((k) => needs[k] >= 45)) s += mood >= 2 ? 1.6 : mood <= -2 ? 0.4 : 1.1
    if (c.bonus) s += c.bonus
    if (c.id === last) s *= 0.4
    // Some chance in it: not the same choice every time.
    s *= 0.75 + rnd() * 0.5
    if (s > 0.9) scored.push({ id: c.id, s })
  }
  if (!scored.length) return null
  scored.sort((a, b) => b.s - a.s)
  const top = scored.slice(0, 3)
  let r = rnd() * top.reduce((t, x) => t + x.s, 0)
  for (const x of top) if ((r -= x.s) <= 0) return x.id
  return top[0].id
}
