import { useEffect, useState } from 'react'
import type { World } from '../../lib/types'
import type { LngLat } from '../../game/roads'

// The trip on the real streets. The game's road network only knows the hubs
// (the communes, each end of a bridge), so its path is a few straight lines
// across blocks and water. With a Mapbox token, the map asks Mapbox's driving
// directions for the way through the same points (the start, the middle of
// each bridge the trip takes, the destination) and the taxi follows that.
// Without a token, or if the request fails, the straight lines stay.

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
const MAX_WAYPOINTS = 25 // Mapbox's limit for driving directions
const cache = new Map<string, Promise<LngLat[] | null>>()

/** The points the drive must go through: start, each bridge's middle, end. */
export function waypointsOf(world: World, city: string, path: LngLat[] | undefined, from: LngLat, to: LngLat): LngLat[] {
  const net = world.roads?.[city]
  const out: LngLat[] = [from]
  if (net && path) {
    const pos = new Map(net.nodes.map((n) => [n.id, [n.lng, n.lat] as LngLat]))
    const same = (p: LngLat, q?: LngLat) => !!q && Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6
    for (let i = 1; i < path.length; i++) {
      const bridge = net.roads.find((r) => r.bridge && ((same(path[i - 1], pos.get(r.a)) && same(path[i], pos.get(r.b))) || (same(path[i - 1], pos.get(r.b)) && same(path[i], pos.get(r.a)))))
      if (bridge) out.push([(path[i - 1][0] + path[i][0]) / 2, (path[i - 1][1] + path[i][1]) / 2])
    }
  }
  out.push(to)
  return out.slice(0, MAX_WAYPOINTS - 1).concat(out.length > MAX_WAYPOINTS - 1 ? [to] : [])
}

function keyOf(points: LngLat[]) {
  return points.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';')
}

/** The driving route through these points, as [lng, lat]; null when it can't be had. */
export function drivingRoute(points: LngLat[], token = TOKEN): Promise<LngLat[] | null> {
  if (!token || points.length < 2) return Promise.resolve(null)
  const key = keyOf(points)
  const saved = (() => {
    try {
      return sessionStorage.getItem(`drive:${key}`)
    } catch {
      return null
    }
  })()
  if (saved) return Promise.resolve(JSON.parse(saved) as LngLat[])
  let p = cache.get(key)
  if (!p) {
    p = fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${key}?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const line = d?.routes?.[0]?.geometry?.coordinates as LngLat[] | undefined
        if (!line || line.length < 2) return null
        try {
          sessionStorage.setItem(`drive:${key}`, JSON.stringify(line))
        } catch {
          // Storage full or blocked: the route is only kept for this page.
        }
        return line
      })
      .catch(() => null)
    cache.set(key, p)
    // A failure may be the network: try again next time.
    p.then((line) => line || cache.delete(key))
  }
  return p
}

/** The driving route for these points once it has arrived (undefined until then, or without a token). */
export function useDrivingRoute(points: LngLat[] | null): LngLat[] | undefined {
  const key = points ? keyOf(points) : ''
  const [route, setRoute] = useState<{ key: string; line: LngLat[] } | null>(null)
  useEffect(() => {
    if (!points) return
    let live = true
    drivingRoute(points).then((line) => live && line && setRoute({ key, line }))
    return () => {
      live = false
    }
    // The points are keyed by their text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return route?.key === key ? route.line : undefined
}
