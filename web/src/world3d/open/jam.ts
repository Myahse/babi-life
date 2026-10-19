import type { Road } from './tiles'

type XZ = [number, number]

/**
 * A traffic jam laid along the real street: from the point of the street
 * nearest `at`, both ways along it (and on into the street that carries on
 * where a piece of the map ends), a car every `gap` metres on each side of
 * the middle line. Each car: where it stands and its heading (radians from +x).
 */
export function jamAlong(roads: Road[], at: XZ, gap: number, each: number): { p: XZ; angle: number; lane: 1 | -1; width: number }[] {
  const ok = roads.filter((r) => r.cls !== 'path' && r.cls !== 'motorway' && !r.bridge && r.pts.length > 1)
  let best: { r: Road; i: number; p: XZ; d: number } | null = null
  for (const r of ok)
    for (let i = 1; i < r.pts.length; i++) {
      const [a, b] = [r.pts[i - 1], r.pts[i]]
      const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
      const t = Math.max(0, Math.min(1, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)))
      const p: XZ = [a[0] + dx * t, a[1] + dz * t]
      const d = Math.hypot(p[0] - at[0], p[1] - at[1])
      if (!best || d < best.d) best = { r, i, p, d }
    }
  if (!best || best.d > 40) return []
  const width = best.r.width
  // The street ahead from the start, as a list of points (dir 1: toward the polyline's end).
  const ahead = (dir: 1 | -1): XZ[] => {
    const out: XZ[] = [best!.p]
    let road = best!.r
    let pts = dir === 1 ? road.pts.slice(best!.i) : road.pts.slice(0, best!.i).reverse()
    for (let hops = 0; hops < 4; hops++) {
      out.push(...pts)
      const end = out[out.length - 1]
      // The street carrying on from there (the next piece of the map, or the next stretch).
      const next = ok.find((r) => r !== road && (near(r.pts[0], end) || near(r.pts[r.pts.length - 1], end)))
      if (!next) break
      road = next
      pts = near(next.pts[0], end) ? next.pts.slice(1) : next.pts.slice(0, -1).reverse()
    }
    return out
  }
  const cars: { p: XZ; angle: number; lane: 1 | -1; width: number }[] = []
  for (const dir of [1, -1] as const) {
    const line = ahead(dir)
    let want = dir === 1 ? gap / 2 : gap / 2
    let walked = 0
    let n = 0
    for (let i = 1; i < line.length && n < each; i++) {
      const [a, b] = [line[i - 1], line[i]]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      while (want <= walked + len && n < each) {
        const t = (want - walked) / (len || 1)
        // The heading the street runs, toward the polyline's end (dir 1) or back.
        const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) + (dir === 1 ? 0 : Math.PI)
        cars.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], angle, lane: 1, width })
        cars.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], angle, lane: -1, width })
        want += gap
        n++
      }
      walked += len
    }
  }
  return cars
}

const near = (a: XZ, b: XZ) => Math.abs(a[0] - b[0]) < 1.5 && Math.abs(a[1] - b[1]) < 1.5
