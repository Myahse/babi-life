import type { World } from '../lib/types'

export type LngLat = [number, number]
export type RoadNet = { nodes: { id: string; name?: string; lat: number; lng: number }[]; roads: { a: string; b: string; name?: string; bridge?: string; via?: [number, number][] }[] }
export type Path = { points: LngLat[]; km: number; bridges: string[] }

const WINDING = 1.25

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

/**
 * The shortest way between two communes on a city's roads, over its bridges.
 * Mirrors world.RouteIn (backend/internal/world/roads.go). null when the city
 * has no road network.
 */
export function routeIn(world: World, city: string, from: string, to: string): Path | null {
  const net = world.roads?.[city]
  if (!net) return null
  const pos = new Map(net.nodes.map((n) => [n.id, n]))
  const pts = (i: number) => {
    const r = net.roads[i]
    const a = pos.get(r.a)!, b = pos.get(r.b)!
    return [{ lat: a.lat, lng: a.lng }, ...(r.via ?? []).map(([lat, lng]) => ({ lat, lng })), { lat: b.lat, lng: b.lng }]
  }
  const len = net.roads.map((r, i) => {
    const p = pts(i)
    let d = 0
    for (let k = 1; k < p.length; k++) d += km(p[k - 1], p[k])
    return r.bridge ? d : d * WINDING
  })
  const adj = new Map<string, { to: string; road: number; fwd: boolean }[]>()
  net.roads.forEach((r, i) => {
    adj.set(r.a, [...(adj.get(r.a) ?? []), { to: r.b, road: i, fwd: true }])
    adj.set(r.b, [...(adj.get(r.b) ?? []), { to: r.a, road: i, fwd: false }])
  })
  const dist = new Map([[from, 0]])
  const prev = new Map<string, { from: string; road: number; fwd: boolean }>()
  const open = new Set([from])
  while (open.size) {
    let cur = ''
    for (const id of open) if (!cur || dist.get(id)! < dist.get(cur)!) cur = id
    open.delete(cur)
    if (cur === to) break
    for (const e of adj.get(cur) ?? []) {
      const nd = dist.get(cur)! + len[e.road]
      if (!dist.has(e.to) || nd < dist.get(e.to)!) {
        dist.set(e.to, nd)
        prev.set(e.to, { from: cur, road: e.road, fwd: e.fwd })
        open.add(e.to)
      }
    }
  }
  if (!dist.has(to)) return null
  const legs: { road: number; fwd: boolean }[] = []
  for (let at = to; at !== from; at = prev.get(at)!.from) legs.unshift(prev.get(at)!)
  const start = pos.get(from)!
  const path: Path = { points: [[start.lng, start.lat]], km: Math.round(dist.get(to)! * 10) / 10, bridges: [] }
  for (const leg of legs) {
    const p = pts(leg.road)
    if (!leg.fwd) p.reverse()
    for (const q of p.slice(1)) path.points.push([q.lng, q.lat])
    const b = net.roads[leg.road].bridge
    if (b) path.bridges.push(b)
  }
  return path
}
