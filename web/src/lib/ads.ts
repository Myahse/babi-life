import { useEffect, useState } from 'react'
import { API_BASE } from './env'

// Babi Pub in the apps (backend ads, features « pubs-applis »): the day's
// ads of the Sim's commune, between Tikitoko's videos, in Babigram's feed,
// and the advertisers' apps on the phone's home screen. Fetched once for
// everyone that shows them, again every five minutes; the views counted
// here go up with the billboards' (by commune and day: nobody is tracked).

export type Place = 'panneaux' | 'tikitoko' | 'babigram' | 'telephone'
export type LiveAd = { id: string; advertiser: string; title: string; type: 'image' | 'video'; url: string; places?: Place[]; link?: string; appName?: string; icon?: string }

const cache = new Map<string, { at: number; ads: Promise<LiveAd[]> }>()
function load(commune: string) {
  const c = cache.get(commune)
  if (c && Date.now() - c.at < 5 * 60_000) return c.ads
  const ads = fetch(`${API_BASE}/ads/live?commune=${encodeURIComponent(commune)}`)
    .then((r) => (r.ok ? r.json() : []))
    .then((l: unknown) => (Array.isArray(l) ? (l as LiveAd[]) : []))
    .catch(() => [] as LiveAd[])
  cache.set(commune, { at: Date.now(), ads })
  return ads
}

/** The ads running now in the commune, for one place (an ad from before places shows on the billboards). */
export function useAds(commune: string | undefined, place: Place) {
  const [ads, setAds] = useState<LiveAd[]>([])
  useEffect(() => {
    if (!commune) return
    let live = true
    const get = () => void load(commune).then((l) => live && setAds(l.filter((a) => (a.places?.length ? a.places : ['panneaux']).includes(place))))
    get()
    const t = setInterval(get, 5 * 60_000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [commune, place])
  return ads
}

// The views, by commune, sent once a minute (and when the page goes).
const pending = new Map<string, Record<string, number>>()
function flush() {
  for (const [commune, views] of pending) void fetch(`${API_BASE}/ads/views`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commune, views }), keepalive: true }).catch(() => undefined)
  pending.clear()
}
if (typeof window !== 'undefined') {
  setInterval(flush, 60_000)
  window.addEventListener('pagehide', flush)
}
/** An ad seen once more. */
export function seen(commune: string, id: string) {
  const v = pending.get(commune) ?? {}
  v[id] = (v[id] ?? 0) + 1
  pending.set(commune, v)
}

/** Opens the advertiser's link, outside the game. */
export function openAd(ad: LiveAd) {
  if (ad.link) window.open(ad.link, '_blank', 'noopener,noreferrer')
}
