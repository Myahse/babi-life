import * as THREE from 'three'
import type { At } from './shoreline'

// A small kit for the landmarks built of many coloured blocks drawn at once (ruePrincesse.tsx Blocks):
// a piece (a pirogue, a hut, a loom) written once in its own frame, set down many times turned and
// moved, all of it ending in one list, one draw call. San-Pédro's and Korhogo's landmarks use it.

/** A block of a piece, in the piece's frame: middle, size, colour, its own turn. */
export type Part = [number, number, number, number, number, number, string, number?]

/** The piece's blocks set down at (x, z), turned ry, raised y, scaled k, pushed onto `out`. */
export function put(out: At[], [x, z, ry]: [number, number, number], parts: Part[], y = 0, k = 1) {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  for (const [px, py, pz, sx, sy, sz, col, r = 0] of parts) out.push({ p: [x + (px * c + pz * s) * k, y + py * k, z + (-px * s + pz * c) * k], s: [sx * k, sy * k, sz * k], ry: ry + r, c: col })
}

/** One white material for the coloured blocks (the colours are per block). */
export const blocksMat = () => new THREE.MeshLambertMaterial({ color: '#ffffff' })

/** A seeded stream of numbers (the same layout each time). */
export function seeded(seed: number) {
  let s = seed % 2147483647 || 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** A conical straw roof as stacked blocks (the round huts of the north, the paillotes). */
export function strawRoof(r: number, h: number, y: number, col = '#c9a25a', steps = 4): Part[] {
  const out: Part[] = []
  for (let i = 0; i < steps; i++) {
    const w = r * 2 * (1 - i / steps)
    out.push([0, y + (h / steps) * (i + 0.5), 0, w, h / steps, w, i % 2 ? col : shade(col, -0.08), (i * Math.PI) / 8])
  }
  return out
}

/** A round hut: its earth wall (an octagon of blocks), its door, its straw cone. */
export function roundHut(r = 2.2, wall = 2.2, col = '#b87a4b', door = '#3a2616'): Part[] {
  const out: Part[] = []
  for (let i = 0; i < 4; i++) out.push([0, wall / 2, 0, r * 1.7, wall, r * 0.72, col, (i * Math.PI) / 4])
  out.push([0, wall * 0.42, r * 0.85, 0.8, wall * 0.8, 0.1, door])
  return out.concat(strawRoof(r * 1.25, 2.2, wall - 0.1))
}

/** A colour a little lighter (+) or darker (−). */
export function shade(hex: string, k: number) {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + k)))
  return `#${c.getHexString()}`
}
