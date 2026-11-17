import { useEffect, type ReactNode } from 'react'
import { create } from 'zustand'

// One overlay system for the game's screen (components/OverlayHost.tsx draws it). Three kinds of things used to
// pop up over the street on their own and stack on one another, over the HUD's buttons and indicators:
//  - cards (a « NOUVEAU », « Active les notifications », the baptism, an invitation…): a priority queue, exactly
//    one on screen at a time, the others waiting their turn (useCard);
//  - toasts (a result, an event, a mention): one at a time, queued, the same one never twice (toast);
//  - pops (a wish fulfilled, a skill rising, a « première fois »): the short celebrations over the scene, one at a
//    time too (pop).
// Toasts and pops sit in the free space between the HUD's clusters, found by the host from the HUD's real layout.

export type ToastTone = 'random' | 'done' | 'error' | 'promo' | 'event'
export type Toast = {
  id: number
  /** Same key, same toast: a new one replaces the one waiting or on screen (by default the tone, title and text). */
  key?: string
  title: string
  text?: string
  money: number
  tone: ToastTone
  kind?: string
  icon?: string
  /** A tap on it opens what it tells of (a mention in the grin). */
  onTap?: () => void
  /** Said at once, even over the phone or a mini-game (an error is too): what explains what comes next. */
  urgent?: boolean
}

/** The cards' order (higher first): what must be answered, then the tutorial, the rewards, the invitations, the news, the notifications last. */
export const CARD = {
  arrival: 100,
  grown: 96,
  tuto: 90,
  bapteme: 88,
  growUp: 87,
  pionnier: 84,
  family: 80,
  firstStory: 75,
  farewell: 70,
  duel: 66,
  door: 65,
  invite: 62,
  // A lot's card in « mon-quartier »'s view (components/quartier/QuartierVue.tsx): light, a higher card takes its place.
  lot: 58,
  news: 50,
  notify: 10,
} as const

type Want = { prio: number; seq: number; dim: boolean; first: boolean }
type Queued<T> = T & { at: number; shownAt: number; ms: number; keep: boolean }
export type Pop = { key: string; node: ReactNode; ms: number; onShow?: () => void }

type State = {
  wants: Record<string, Want>
  /** The card on screen: a darkened one keeps its place till it's answered (no card yanked away); a light one gives it to a higher one. */
  holder: string | null
  /** The toasts, the first on screen (unless paused). */
  toasts: Queued<Toast>[]
  pops: Queued<Pop & { id: number }>[]
  /** Why toasts and pops wait (the phone, a mini-game, a sheet over the street): set by screens/Play. */
  hold: Record<string, boolean>
  /** Where a card that isn't dim is drawn (components/OverlayHost's place, <LaneCard>). */
  cardEl: HTMLElement | null
  /** No free place for the toast but the steady card's (the next goal, « À faire maintenant »): it steps aside while the toast is there. */
  yielded: boolean
  /** Where the steady card is drawn (components/OverlayHost's <Steady>), and whether only its short form fits (a small phone, sideways). */
  steadyEl: HTMLElement | null
  steadyShort: boolean
}

export const useOverlays = create<State>()(() => ({ wants: {}, holder: null, toasts: [], pops: [], hold: {}, cardEl: null, yielded: false, steadyEl: null, steadyShort: false }))
const get = useOverlays.getState
const set = useOverlays.setState

let seq = 1
// When the card on screen got its place: in its first moments (several asking at once, as the game loads) the highest still wins it.
let since = 0
const SETTLE = 400
const pick = (wants: Record<string, Want>, holder: string | null) => {
  let best: string | null = null
  for (const [id, w] of Object.entries(wants)) if (!best || w.prio > wants[best].prio || (w.prio === wants[best].prio && w.seq < wants[best].seq)) best = id
  // A darkened card keeps its place till it's answered; a light one (an invitation, a hint) gives it to a higher one and waits.
  const h = holder ? wants[holder] : undefined
  if (h && Date.now() - since > SETTLE && (h.dim || !best || wants[best].prio <= h.prio)) return holder
  return best
}

function want(id: string, prio: number, dim: boolean, first: boolean) {
  const { wants, holder } = get()
  const next = { ...wants, [id]: { prio, dim, first, seq: wants[id]?.seq ?? seq++ } }
  // (What must come first, the arrival's film, a Sim made an adult, takes the place from a lower card at once: that one waits again.)
  const now = first && holder && holder !== id && (wants[holder]?.prio ?? 0) < prio ? id : pick(next, holder)
  if (now !== holder) since = Date.now()
  set({ wants: next, holder: now })
  schedule()
}
function drop(id: string) {
  const { wants, holder } = get()
  if (!wants[id]) return
  const next = { ...wants }
  delete next[id]
  const now = pick(next, holder === id ? null : holder)
  if (now !== holder) since = Date.now()
  set({ wants: next, holder: now })
  schedule()
}

/**
 * A card over the game: it asks for the one place while `on`, and shows only when this returns true. `dim` (the
 * default) for a card over a darkened game: toasts and pops wait under it. Not dim (an invitation, the tutorial):
 * they go on beside it. `first`: it takes the place at once from a lower card (which waits again).
 */
export function useCard(id: string, prio: number, on: boolean, dim = true, first = false) {
  useEffect(() => {
    if (!on) return
    want(id, prio, dim, first)
    return () => drop(id)
  }, [id, prio, on, dim, first])
  const mine = useOverlays((s) => s.holder === id)
  return on && mine
}

/** A card is on screen (the steady cards, the next goal and « À faire maintenant », step aside for it). */
export const useCardUp = () => useOverlays((s) => s.holder !== null)

/** The steady cards' place lent to a toast (components/OverlayHost.tsx): they're hidden meanwhile (kept in the layout, so nothing jumps). */
export const useYielded = () => useOverlays((s) => s.yielded)

/** Only the steady card's short form has room (components/OverlayHost.tsx measures it). */
export const useSteadyShort = () => useOverlays((s) => s.steadyShort)

/** Something keeps toasts and pops waiting (the phone open, a mini-game): screens/Play says so by its name. */
export function holdToasts(why: string, on: boolean) {
  if (!!get().hold[why] === on) return
  set({ hold: { ...get().hold, [why]: on } })
  schedule()
}

const paused = () => {
  const s = get()
  return (!!s.holder && !!s.wants[s.holder]?.dim) || Object.values(s.hold).some(Boolean)
}

// How long one stays: alone, its time; others waiting, shorter (never under MIN), so the queue gets through.
const BASE = 4500
const MIN = 2200
const MIN_POP = 1400
// (Dev only: times stretched for the bench on a slow machine, window.__overlays.slow(n).)
let slow = 1
// Waiting too long, an ordinary toast isn't news any more (the phone's journal keeps the server's events); one with a tap (a mention, a visit) waits for its turn whatever the time.
const STALE = 90_000
const MAX = 12

const atOnce = (t: Omit<Toast, 'id'>) => t.tone === 'error' || !!t.urgent
const keyOf = (t: Omit<Toast, 'id'>) => t.key ?? `${t.tone}|${t.title}|${t.text ?? ''}`
let ids = 1

/** A toast: queued, shown alone in the toasts' place, replaced by a newer one with the same key. */
export function toast(t: Omit<Toast, 'id'>) {
  const key = keyOf(t)
  const now = Date.now()
  const list = get().toasts
  const i = list.findIndex((x) => x.key === key)
  const ms = (t.tone === 'error' ? 5000 : BASE) * slow
  if (i >= 0) {
    // The same again: its words updated where it is (a money result added up), on screen a little longer.
    const old = list[i]
    const money = old.money && t.money && old.title === t.title ? old.money + t.money : t.money
    const next = [...list]
    next[i] = { ...old, ...t, key, money, ms: Math.max(old.ms, ms), shownAt: old.shownAt && now - old.shownAt > 1500 ? now - 1500 : old.shownAt }
    set({ toasts: next })
  } else {
    const item = { ...t, id: ids++, key, at: now, shownAt: 0, ms, keep: !!t.onTap || atOnce(t) }
    // (An error, an urgent one: first in line, the one on screen back in the queue with its whole time.)
    let next = atOnce(t) ? [item, ...list.map((x) => ({ ...x, shownAt: 0 }))] : [...list, item]
    // (Never more than MAX waiting: the oldest ordinary one goes first.)
    while (next.length > MAX) {
      const j = next.findIndex((x, k) => k > 0 && !x.keep)
      next = next.filter((_, k) => k !== (j > 0 ? j : 1))
    }
    set({ toasts: next })
  }
  schedule()
}

/** The toast on screen gone (a tap, or its time up). */
export function dismissToast(id: number) {
  set({ toasts: get().toasts.filter((x) => x.id !== id) })
  schedule()
}

/** A short celebration over the scene (a wish, a skill, a first time): one at a time, queued. `onShow` when it comes on (its sound). */
export function pop(p: Pop) {
  const list = get().pops
  if (list.some((x) => x.key === p.key)) return
  set({ pops: [...list, { ...p, ms: p.ms * slow, id: ids++, at: Date.now(), shownAt: 0, keep: false }] })
  schedule()
}

/** What shows now: the first toast and pop, unless they wait (an error, an urgent one, never waits: it's said at once). */
export function useShown() {
  const s = useOverlays()
  const hold = paused()
  const t = s.toasts[0]
  return { toast: t && (!hold || atOnce(t)) ? t : null, pop: !hold && s.pops[0] ? s.pops[0] : null, waiting: Math.max(0, s.toasts.length - 1) }
}

// One timer for all: when the next thing is due (a toast's time up, a stale one to drop).
let timer: ReturnType<typeof setTimeout> | null = null
function schedule() {
  if (timer) clearTimeout(timer)
  timer = null
  const now = Date.now()
  const hold = paused()
  let { toasts, pops } = get()
  let changed = false
  // Stale ones waiting (never the one on screen, never one with a tap).
  const fresh = toasts.filter((x, i) => (i === 0 && x.shownAt) || x.keep || now - x.at < STALE)
  if (fresh.length !== toasts.length) ((toasts = fresh), (changed = true))
  let due = Infinity
  const head = toasts[0]
  if (head && (!hold || atOnce(head))) {
    if (!head.shownAt) ((toasts = [{ ...head, shownAt: now }, ...toasts.slice(1)]), (changed = true))
    const t = toasts[0]
    const ms = toasts.length > 1 ? Math.max(MIN * slow, t.ms * 0.55) : t.ms
    const end = t.shownAt + ms
    if (end <= now) {
      toasts = toasts.slice(1)
      changed = true
      if (toasts[0] && (!hold || atOnce(toasts[0]))) toasts = [{ ...toasts[0], shownAt: now }, ...toasts.slice(1)]
      due = now + (toasts[0] ? (toasts.length > 1 ? Math.max(MIN * slow, toasts[0].ms * 0.55) : toasts[0].ms) : Infinity)
    } else due = end
  } else if (head && head.shownAt) {
    // Paused with one on screen: it'll have its whole time again.
    toasts = [{ ...head, shownAt: 0 }, ...toasts.slice(1)]
    changed = true
  }
  if (toasts.length) due = Math.min(due, ...toasts.filter((x) => !x.keep && !x.shownAt).map((x) => x.at + STALE))
  const p = pops[0]
  if (p && !hold) {
    if (!p.shownAt) {
      pops = [{ ...p, shownAt: now }, ...pops.slice(1)]
      changed = true
      p.onShow?.()
    }
    const q = pops[0]
    const end = q.shownAt + (pops.length > 1 ? Math.max(MIN_POP * slow, q.ms * 0.6) : q.ms)
    if (end <= now) {
      pops = pops.slice(1)
      changed = true
      due = Math.min(due, now + 30)
    } else due = Math.min(due, end)
  } else if (p && p.shownAt) {
    pops = [{ ...p, shownAt: 0 }, ...pops.slice(1)]
    changed = true
  }
  if (changed) set({ toasts, pops })
  if (due !== Infinity) timer = setTimeout(schedule, Math.max(30, due - now))
}

// (Dev only: the bench puts several at once on screen through window.__overlays.)
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __overlays: unknown }).__overlays = { toast, pop, state: get, slow: (n: number) => void (slow = n) }
