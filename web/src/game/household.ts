import { useSyncExternalStore } from 'react'
import type { Interaction, Look, Needs } from '../lib/types'
import { actionLength } from './rules'
import { chooseFree, type Candidate } from './lifeMode'
import { t as tr } from '../lib/i18n'

// Le mode vie: directing the others of the house (the update « mode-vie »). Papa and maman (a child at the
// family's home) and the partner who lives with the Sim aren't players' Sims in the game's data: they're the
// house's people (world3d/HomeInside.tsx Parents, Partner), so here they're household NPCs. Each has simple
// needs of its own, kept by the server (backend sims/foyer.go: they touch no money and no Sim's needs),
// its own orders and free will. A tap on a portrait of the household strip (components/Household.tsx) picks
// who the wheel's orders go to; the Sim itself lives on by its own free will meanwhile, and so do the others.

export type Member = { id: string; name: string; kin: 'papa' | 'maman' | 'partner' | 'enfant' | 'ancien'; gender: 'femme' | 'homme'; look: Look; /** A child of the house (game/famille.ts): its stage, for its portrait. */ stage?: string }
export type HouseOrder = { key: number; id: string; label: string; icon: string; colors: [string, string]; effect: Partial<Needs>; ms: number; free?: boolean }
type Doing = HouseOrder & { since: number }
type State = { members: Member[]; selected: string; queues: Record<string, HouseOrder[]>; doing: Record<string, Doing | undefined>; needs: Record<string, Needs> }

const FULL: Needs = { hunger: 80, energy: 80, hygiene: 80, social: 80, fun: 80 }
let state: State = { members: [], selected: 'self', queues: {}, doing: {}, needs: {} }
const subs = new Set<() => void>()
const set = (s: Partial<State>) => {
  state = { ...state, ...s }
  subs.forEach((f) => f())
}
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f))
export const useHousehold = () => useSyncExternalStore(subscribe, () => state)
export const householdState = () => state

// Their needs are the server's (backend sims/foyer.go, the Sim's life.house): the same on every phone. They
// come with each Sim the server sends (fromServer); what a member finishes is told to it (onDone), its
// good shown at once meanwhile.
let simKey = ''
/** The server's needs for the household, as the Sim last came back (life.house). */
export function fromServer(simId: string, house: Record<string, Needs> | undefined) {
  if (!house) return
  if (simId !== simKey) simKey = simId
  const needs = { ...state.needs }
  let changed = false
  for (const [k, n] of Object.entries(house)) {
    const was = needs[k]
    if (!was || NEEDS.some((x) => Math.abs(was[x] - n[x]) >= 0.5)) ((needs[k] = n), (changed = true))
  }
  if (changed) set({ needs })
}
const NEEDS: (keyof Needs)[] = ['hunger', 'energy', 'hygiene', 'social', 'fun']
/** Told when a member has done something (LifeHome sends it to the server). */
let onDone: ((member: string, action: string) => void) | null = null
export const setOnMemberDone = (f: typeof onDone) => void (onDone = f)

/** The household at home now (HomeInside tells who's there); the selection back to the Sim if its one left. */
export function setMembers(simId: string, members: Member[]) {
  const ids = members.map((m) => m.id).join()
  if (ids === state.members.map((m) => m.id).join() && simKey === simId) return
  simKey = simId
  const needs = { ...state.needs }
  for (const m of members) needs[m.id] ??= { ...FULL }
  set({ members, needs, selected: members.some((m) => m.id === state.selected) ? state.selected : 'self' })
}

export const selectMember = (id: string) => set({ selected: id })

let nextKey = 1
/** An order for a member (the wheel's, while they're selected; or their own free will's). */
export function orderMember(id: string, it: Pick<Interaction, 'id' | 'label' | 'icon' | 'minutes'> & { effect: Partial<Needs> }, colors: [string, string], free = false) {
  const q = state.queues[id] ?? []
  if (q.length >= 4) return
  // (What they choose themselves gives way to what they're told.)
  const kept = free ? q : q.filter((o) => !o.free)
  const order: HouseOrder = { key: nextKey++, id: it.id, label: it.label, icon: it.icon, colors, effect: it.effect, ms: actionLength(it.minutes) * 60_000, free }
  set({ queues: { ...state.queues, [id]: [...kept, order] } })
  // Told something while doing what it chose: it stops for it.
  if (!free && state.doing[id]?.free) set({ doing: { ...state.doing, [id]: undefined } })
}

/** An order taken off (tapped in their queue): the one under way stops. */
export function cancelMember(id: string, key: number) {
  const doing = state.doing[id]
  set({ queues: { ...state.queues, [id]: (state.queues[id] ?? []).filter((o) => o.key !== key) }, doing: doing?.key === key ? { ...state.doing, [id]: undefined } : state.doing })
}

/** What a member is doing now (HomeInside walks them there), if anything. */
export const doingOf = (s: State, id: string) => s.doing[id]

/** The household's things free will may pick (with a spot in the house, HomeInside's): eating, sleeping, washing, the TV… */
export const homeSpotIds = new Set<string>()
const FREE: { id: string; label: string; icon: string; effect: Partial<Needs>; minutes: number }[] = [
  { id: 'golvo', label: tr('Manger à table'), icon: 'utensils', effect: { hunger: 55 }, minutes: 30 },
  { id: 'nap', label: tr('Faire la sieste'), icon: 'bed', effect: { energy: 45 }, minutes: 60 },
  { id: 'shower', label: tr('Prendre une douche'), icon: 'shower-head', effect: { hygiene: 60 }, minutes: 20 },
  { id: 'watch-tv', label: tr('Regarder RTI 1'), icon: 'tv', effect: { fun: 35 }, minutes: 60 },
  { id: 'call-family', label: tr('Appeler la famille au village'), icon: 'smartphone', effect: { social: 35 }, minutes: 20 },
]

/** One beat of the household (every couple of seconds, not per frame): what's under way ends, the next starts, the needs go down, free will for the ones with nothing to do. */
export function householdTick(now: number, freeWill: boolean, hour: number) {
  let { doing, queues, needs } = state
  let changed = false
  for (const m of state.members) {
    const d = doing[m.id]
    if (d && now - d.since >= d.ms) {
      const n = { ...(needs[m.id] ?? FULL) }
      for (const [k, v] of Object.entries(d.effect) as [keyof Needs, number][]) if (v > 0) n[k] = Math.min(100, n[k] + v)
      needs = { ...needs, [m.id]: n }
      queues = { ...queues, [m.id]: (queues[m.id] ?? []).filter((o) => o.key !== d.key) }
      doing = { ...doing, [m.id]: undefined }
      changed = true
      // (The server counts it: its needs come back with the Sim.)
      onDone?.(m.id, d.id)
    }
    if (!doing[m.id] && queues[m.id]?.length) {
      doing = { ...doing, [m.id]: { ...queues[m.id][0], since: now } }
      changed = true
    }
    // Free will (the one being directed too, once its orders are done): what its needs ask for, now and then.
    if (freeWill && !doing[m.id] && !queues[m.id]?.length && Math.random() < 0.15) {
      const cands: Candidate[] = FREE.filter((f) => homeSpotIds.has(f.id)).map((f) => ({ id: f.id, effect: f.effect, cost: 0, minutes: f.minutes }))
      const pick = chooseFree(cands, needs[m.id] ?? FULL, [], hour, 0, null)
      const f = FREE.find((x) => x.id === pick)
      if (f) {
        const order: HouseOrder = { key: nextKey++, id: f.id, label: f.label, icon: f.icon, colors: ['#c3c8dc', '#7a8099'], effect: f.effect, ms: actionLength(f.minutes) * 60_000, free: true }
        queues = { ...queues, [m.id]: [order] }
        changed = true
      }
    }
  }
  // (The needs go down on the server, with the clock: they come back with the Sim.)
  if (changed) set({ doing, queues, needs })
}
