import { useEffect } from 'react'
import { CHUNK_ZOOM, tileBox, tileOf } from '../../world3d/open/geo'

// « mon-quartier »: while the taxi rolls (a short trip, « trajet-court »), the streets where it sets the Sim
// down are fetched into the phone's cache, so the commune stands at once on arrival.

/** Metres around the arrival that are fetched (the street loads 700 m round the Sim). */
const AROUND = 700

/** The tiles round a point within `r` metres, nearest first. */
export function tilesAround(lat: number, lng: number, r: number): [number, number][] {
  const o = { lat, lng }
  const [cx, cy] = tileOf(lat, lng, CHUNK_ZOOM)
  const out: { t: [number, number]; d: number }[] = []
  for (let dx = -2; dx <= 2; dx++)
    for (let dy = -2; dy <= 2; dy++) {
      const b = tileBox(o, cx + dx, cy + dy)
      const d = Math.hypot(Math.max(b.x0, 0, -b.x1), Math.max(b.z0, 0, -b.z1))
      if (d <= r) out.push({ t: [cx + dx, cy + dy], d })
    }
  return out.sort((a, b) => a.d - b.d).map((x) => x.t)
}

/** During a ride to `to` (lat/lng of where it arrives; null: no ride), its streets fetched two at a time. */
export function usePreloadTrip(to: { lat: number; lng: number; r?: number } | null, token: string) {
  const key = to ? `${to.lat.toFixed(4)},${to.lng.toFixed(4)},${to.r ?? AROUND}` : ''
  useEffect(() => {
    if (!to) return
    let gone = false
    const t0 = performance.now()
    void import('../../world3d/open/tiles').then(async ({ prefetchChunk }) => {
      const list = tilesAround(to.lat, to.lng, to.r ?? AROUND)
      for (let i = 0; i < list.length && !gone; i += 2) await Promise.all(list.slice(i, i + 2).map(([tx, ty]) => prefetchChunk(tx, ty, token)))
      if (import.meta.env.DEV && !gone) console.info(`[quartier] ${list.length} tiles fetched for the arrival in ${Math.round(performance.now() - t0)} ms`)
    })
    return () => {
      gone = true
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
}
