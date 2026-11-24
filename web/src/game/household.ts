import { useSyncExternalStore } from 'react'
import type { Interaction, Look, Needs } from '../lib/types'
import { actionLength } from './rules'
import { chooseFree, type Candidate } from './lifeMode'
import { t as tr } from '../lib/i18n'
import { api, type MemberAct } from '../lib/api'
import type { PieOption } from './lifeMode'

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
      const own = freeActsFor(m)
      const cands: Candidate[] = [...FREE.filter((f) => homeSpotIds.has(f.id)).map((f) => ({ id: f.id, effect: f.effect, cost: 0, minutes: f.minutes })), ...own.map((a) => ({ id: a.id, effect: a.effect, cost: 0, minutes: a.minutes }))]
      const pick = chooseFree(cands, needs[m.id] ?? FULL, [], hour, 0, null)
      const mine = own.find((x) => x.id === pick)
      const f = FREE.find((x) => x.id === pick) ?? (mine && { id: mine.id, label: tr(mine.label), icon: mine.icon, effect: mine.effect, minutes: mine.minutes })
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

/* ---------- La famille jouable (the update « famille-jouable », backend sims/famillejouable.go) ---------- */

// Each one of the house directed has things of their own (the child's homework, the elder's tale, the
// adult's meal for all…), alone or with another (« aider-devoirs@kid:k12 »; « @self »: the Sim). The server
// gives the list (and checks who may), once.
let acts: MemberAct[] = []
let actsAsked = false
export function loadMemberActs() {
  if (actsAsked) return
  actsAsked = true
  api.familleActes().then(
    (r) => void (acts = r.acts),
    () => void (actsAsked = false),
  )
}
export const memberActsLoaded = () => acts.length > 0

/** What one of the house is: a child by its stage, an elder, an adult. */
export function roleOf(m: Pick<Member, 'kin' | 'stage'>): string {
  if (m.kin === 'enfant') return m.stage === 'enfant' || m.stage === 'ado' ? m.stage : 'adulte'
  return m.kin === 'ancien' ? 'ancien' : 'adulte'
}

const FAMILY: [string, string] = ['#ffd8a8', '#e8590c']
const TOGETHER: [string, string] = ['#fcc2d7', '#d6336c']

/** The wheel of a member directed: their own things (with: none), or what they can do with another (its id and role; « self »: the Sim). */
export function memberActOptions(member: Member, withWho?: { id: string; name: string; role: string }): PieOption[] {
  const role = roleOf(member)
  const list = acts.filter((a) => a.roles.includes(role) && (withWho ? a.pair && (!a.targetRoles?.length || a.targetRoles.includes(withWho.role)) : !a.pair))
  return list.map((a) => {
    const id = withWho ? `${a.id}@${withWho.id}` : a.id
    const colors = withWho ? TOGETHER : FAMILY
    const label = withWho ? `${tr(a.label)} (${withWho.name})` : tr(a.label)
    return {
      id,
      label: tr(a.label),
      icon: a.icon,
      colors,
      order: { kind: 'act', id, label, icon: a.icon, colors },
      run: () => orderMember(member.id, { id, label, icon: a.icon, minutes: a.minutes, effect: a.effect }, colors),
    }
  })
}

/** Free will's own things for a member (the homework, the tale…), as the house's pieces are. */
export const freeActsFor = (m: Member) => acts.filter((a) => !a.pair && a.roles.includes(roleOf(m)))

/** Where in the house a member's own thing is done (its spot and its pose), from the house's spots. */
export function actSpot<S extends { at: [number, number]; from: [number, number]; y: number; rot: number; pose: string; lying: boolean }>(spots: Record<string, S>, orderId: string): S | undefined {
  const a = acts.find((x) => x.id === orderId.split('@')[0])
  if (!a) return spots[orderId]
  const seat = Object.keys(spots).filter((k) => k.startsWith('seat:')).sort()[0]
  const stand = (s?: S) => s && ({ ...s, at: s.from, y: 0, lying: false } as S)
  const s = a.spot === 'seat' ? spots[seat] : a.spot === 'free' ? stand(spots['watch-tv'] ?? spots[seat]) : (spots[a.spot] ?? spots[seat])
  return s && ({ ...s, pose: a.pose } as S)
}
