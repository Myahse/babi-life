import { useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { XZ } from './geo'
import type { Nav } from './nav'

// What moves in the street is the same on every screen. Nobody sends the
// passers-by, cars and boats over the network: each one belongs to a square
// of the map (a cell) and follows a schedule worked out from its seed, the
// map and the shared clock (lib/worldClock.ts). Two players looking at the
// same corner compute the same people at the same spot.
//
// The schedule is an out-and-back: from the cell's anchor, along a route
// drawn for this round, a pause, back the same way, a pause. Every round
// starts and ends at the anchor, so a new route never makes anyone jump.

/** The cells of `size` metres around the focus (radius in cells), as it moves. */
export function useCellsAround(focus: React.RefObject<XZ>, size: number, radius = 1) {
  const cellOf = () => {
    const [x, z] = focus.current ?? [0, 0]
    return `${Math.floor(x / size)},${Math.floor(z / size)}`
  }
  const [at, setAt] = useState(cellOf)
  useFrame(() => {
    const c = cellOf()
    if (c !== at) setAt(c)
  })
  return useMemo(() => {
    const [cx, cz] = at.split(',').map(Number)
    const out: { key: string; x0: number; z0: number }[] = []
    for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) out.push({ key: `${cx + dx},${cz + dz}`, x0: (cx + dx) * size, z0: (cz + dz) * size })
    return out
  }, [at, size, radius])
}

export type Round = { n: number; d: number; forward: boolean; moving: boolean }

/**
 * Where on its route something is at time t: rounds of `cycle` seconds,
 * shifted by `offset`; it goes out for at most 42% of the round (less if
 * the route is short), waits, comes back, waits.
 */
export function round(t: number, cycle: number, offset: number, routeLen: (n: number) => number, speed: number): Round {
  const u = t + offset
  const n = Math.floor(u / cycle)
  const k = u - n * cycle
  const go = Math.min(routeLen(n) / speed, cycle * 0.42)
  const wait = (cycle - 2 * go) / 2
  if (k < go) return { n, d: k * speed, forward: true, moving: true }
  if (k < go + wait) return { n, d: go * speed, forward: true, moving: false }
  if (k < 2 * go + wait) return { n, d: (go - (k - go - wait)) * speed, forward: false, moving: true }
  return { n, d: 0, forward: false, moving: false }
}

export const routeLength = (path: XZ[]) => path.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) : 0), 0)

/** The point `d` metres along a route, and which way the route runs there. */
export function along(path: XZ[], d: number): { x: number; z: number; r: number } {
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1]
    const [bx, bz] = path[i]
    const len = Math.hypot(bx - ax, bz - az)
    if (d <= len || i === path.length - 1) {
      const k = len ? Math.min(1, Math.max(0, d / len)) : 0
      return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, r: Math.atan2(bx - ax, bz - az) }
    }
    d -= len
  }
  const [x, z] = path[0] ?? [0, 0]
  return { x, z, r: 0 }
}

/** The street node nearest a point, for an anchor; null where the map has no street. */
export function anchorNode(nav: Nav, p: XZ, minWidth = 0): number | null {
  const n = nav.nearest(p, 120, minWidth)
  if (!n) return null
  const e = nav.edges[n.edge]
  return n.t < 0.5 ? e.a : e.b
}

/** Eases an angle towards another, the short way round. */
export function turnTo(from: number, to: number, k: number) {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  return from + d * k
}

/** The narrowest street a vehicle takes (a service road, 4.5 m): not a track over the plots, nor a footpath between the houses. */
export const DRIVABLE = 4.2
