import { useSyncExternalStore } from 'react'
import { t } from './i18n'

// Without network (the 4G gone in the gbaka, the Wi-Fi cut): the game opens
// and goes on from what was kept on the phone (the game's data last read:
// the world, the Sim, the commune's places, the messages…: lib/api.ts says
// which; the account's own, wiped at sign-out; the map's tiles, the streets,
// the buildings, for a month: lib/tileCache.ts). The Sim is played on the
// phone and what's done is sent once online (lib/offlinePlay.ts); what
// can't be done without the server waits for the network.

export const OFFLINE_TEXT = t('Pas de réseau pour ça : réessaie une fois connecté·e.')

const DATA = 'babi-data-v1'
const can = () => typeof caches !== 'undefined'
const keyUrl = (key: string) => `https://kept.babi.local/${encodeURIComponent(key)}`

/* ---------- Online or not ---------- */

// (The app's own screens, React Native's, have no navigator.onLine: online until a request fails.)
let online = typeof navigator === 'undefined' || navigator.onLine !== false
/** When the network went (ms), or 0. */
let since = online ? 0 : Date.now()
const listeners = new Set<() => void>()
export function setOnline(on: boolean) {
  if (on === online) return
  online = on
  since = on ? 0 : Date.now()
  listeners.forEach((f) => f())
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('online', () => setOnline(true))
  window.addEventListener('offline', () => setOnline(false))
}
const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))
export const isOnline = () => online
/** Online, or since when not (ms). */
export const useOnline = () => useSyncExternalStore(subscribe, () => online)
export const offlineSince = () => since

/* ---------- The game's data, kept ---------- */

/** Kept: the latest copy of a read (key: the account and the address). */
export async function keepData(key: string, data: unknown) {
  if (!can()) return
  try {
    const c = await caches.open(DATA)
    await c.put(keyUrl(key), new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } }))
  } catch {
    // Full, or private mode: it's only for the times without network.
  }
}
export async function keptData<T>(key: string): Promise<T | undefined> {
  if (!can()) return undefined
  try {
    const hit = await (await caches.open(DATA)).match(keyUrl(key))
    return hit ? ((await hit.json()) as T) : undefined
  } catch {
    return undefined
  }
}
/** Signed out: nothing of the account stays on the phone. */
export function forgetData() {
  if (can()) void caches.delete(DATA).catch(() => undefined)
}
