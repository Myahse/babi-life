import { useSyncExternalStore } from 'react'
import { featuresKnown, keyOpenNow, onFeatures } from '../lib/features'
import { useLightPhone } from '../lib/lightPhone'
import { deviceTier, subscribeTier } from '../world3d/open/lumiere'
import { Q_PERSOS_CAP, wholeNow } from '../world3d/quartier/detail'

// « Persos réalistes » (the update « persos-realistes », step 3 of the « blocs réalistes » look):
// which Sims are drawn as the realistic Sim (avatar/RealHuman.tsx). Only the nearest few, and the
// player's own and the creator's always: past REAL_NEAR metres, or past the device's cap, a Sim stays
// as it is drawn today (BlockHuman, DetailHuman, then LowHuman far away). While the update is shut,
// nothing here is used.

export const PERSOS = 'persos-realistes'
const HEARD_KEY = 'babi.persos.ouvert'

/**
 * How much of it a device draws (the same device tiers as « lumiere-realiste », lumiere.ts deviceTier).
 * - `simple`: up to 4 realistic Sims, no swinging hair or earrings.
 * - `normal`: up to 10.
 * - `haute`: up to 20.
 */
export type PersosTier = 'off' | 'simple' | 'normal' | 'haute'
export const CAP: Record<Exclude<PersosTier, 'off'>, number> = { simple: 4, normal: 10, haute: 20 }
/** Up to here (metres from the camera), the realistic Sim; past it, today's (with some slack each way, so none flickers at the border). */
export const REAL_NEAR = 14
/** How many realistic Sims now: more in « mon-quartier »'s small world (quartier/detail.ts), where they are anywhere in it. */
export const capOf = (tier: Exclude<PersosTier, 'off'>) => (wholeNow() ? Q_PERSOS_CAP[tier] : CAP[tier])
const SLACK = 1.5

function read(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const open = () => (featuresKnown() ? keyOpenNow(PERSOS) : read(HEARD_KEY) === '1')
onFeatures(() => {
  if (!featuresKnown()) return
  try {
    localStorage.setItem(HEARD_KEY, keyOpenNow(PERSOS) ? '1' : '0')
  } catch {
    // Private mode: as the server says, once it has.
  }
})

// In development, ?persos=off|simple|normal|haute forces a tier (to compare them).
const FORCED = import.meta.env.DEV && typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('persos') as PersosTier | null) : null

function tierOf(light: boolean): PersosTier {
  if (FORCED) return FORCED
  if (!open()) return 'off'
  return deviceTier(light)
}
/** The tier now (followed: the update can open, the phone go light). */
export function usePersos(): PersosTier {
  const light = useLightPhone()
  return useSyncExternalStore(subscribeTier, () => tierOf(light))
}
/** Just open or not (the creator's lights). */
export const persosOpenNow = () => (FORCED ? FORCED !== 'off' : open())

/* ---------- Who gets the realistic Sim ---------- */

/** One Sim asking for the realistic body: how far it is, whether it must have it, whether it has it. */
export type Slot = { d: number; prio: boolean; ok: boolean }
const slots = new Set<Slot>()
const order: Slot[] = []
let rankedAt = 0
/** How many Sims are realistic now (the lab's counter). */
export let realNow = 0

export function joinSlots(s: Slot) {
  slots.add(s)
}
export function leaveSlots(s: Slot) {
  slots.delete(s)
}

/**
 * Hands out the realistic bodies, five times a second at most: the player's own and the creator's
 * first, then the nearest within REAL_NEAR, up to the device's cap. One who has it keeps it a little
 * further (SLACK), so two Sims at the same distance don't swap back and forth.
 */
export function rankSlots(now: number, cap: number) {
  if (now - rankedAt < 200) return
  rankedAt = now
  order.length = 0
  for (const s of slots) order.push(s)
  const score = (s: Slot) => (s.prio ? -1 : s.ok ? s.d - SLACK : s.d)
  order.sort((a, b) => score(a) - score(b))
  let n = 0
  // (In the quartier's own world, the nearest anywhere in it: the cap alone says how many.)
  const near = wholeNow() ? Infinity : REAL_NEAR
  for (const s of order) {
    const want = s.prio || s.d < (s.ok ? near + SLACK : near - SLACK)
    s.ok = want && (n < cap || s.prio)
    if (s.ok) n++
  }
  realNow = n
}
