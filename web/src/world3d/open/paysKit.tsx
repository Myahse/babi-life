import { useMemo } from 'react'
import * as THREE from 'three'
import type { At } from './shoreline'
import { blocksMat, put, seeded, type Part } from './kit3d'

// The countries' landmarks' kit (the updates « pays-burkina », « pays-usa », « pays-canada »; ouaga.tsx,
// newYork.tsx, montreal.tsx): what the blocks of kit3d.ts don't do well. A tower's walls of windows as one
// box with its window grid painted (a texture repeated to the real floors and bays, lit at night), rings and
// domes and octagons of blocks (stacked, turned), all drawn in few calls.

/** The coloured blocks' material, faintly lit from inside at night. */
export function useBlocks(night: boolean, glow = '#ffe8c0', k = 0.08) {
  const m = useMemo(() => {
    const x = blocksMat()
    x.emissive = new THREE.Color(glow)
    return x
  }, [glow])
  m.emissiveIntensity = night ? k : 0
  return m
}

/** An octagonal prism (two squares turned 45°): a drum, a tower's shaft, a roundabout. */
export function octo(out: At[], [x, y, z]: [number, number, number], w: number, h: number, c: string, c2 = c) {
  out.push({ p: [x, y, z], s: [w * 0.83, h, w * 0.83], c }, { p: [x, y, z], s: [w * 0.83, h, w * 0.83], ry: Math.PI / 4, c: c2 })
}

/** A dome of `steps` octagons narrowing to its top, from y (r: its radius at the bottom). */
export function dome(out: At[], [x, y, z]: [number, number, number], r: number, steps: number, c: string, c2 = c, rise = 1) {
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * (Math.PI / 2)
    const a2 = ((i + 1) / steps) * (Math.PI / 2)
    const w = 2 * r * Math.cos((a + a2) / 2)
    const h = r * rise * (Math.sin(a2) - Math.sin(a))
    octo(out, [x, y + r * rise * Math.sin(a) + h / 2, z], w, h + 0.02, i % 2 ? c2 : c, i % 2 ? c : c2)
  }
}

/** A round ring of `n` blocks (a colonnade, a rim, a globe's meridian), radius r, each block w×h×d. */
export function ring(out: At[], [x, y, z]: [number, number, number], r: number, n: number, [w, h, d]: [number, number, number], c: string, from = 0, to = Math.PI * 2) {
  for (let i = 0; i < n; i++) {
    const a = from + ((to - from) * (i + 0.5)) / n
    out.push({ p: [x + Math.sin(a) * r, y, z + Math.cos(a) * r], s: [w, h, d], ry: a, c })
  }
}

/** A stepped spire (a belfry's top, a minaret's cap): `steps` squares narrowing, from y. */
export function spire(out: At[], [x, y, z]: [number, number, number], w: number, h: number, steps: number, c: string, c2 = c) {
  for (let i = 0; i < steps; i++) out.push({ p: [x, y + (h / steps) * (i + 0.5), z], s: [w * (1 - i / steps), h / steps, w * (1 - i / steps)], c: i % 2 ? c2 : c })
}

/* ---------- Walls of windows ---------- */

const windowTex = new Map<string, THREE.CanvasTexture>()
/** One bay of one floor, painted: the wall round a window (a mullion down its middle on wide ones); `lit`: only the glass, for the night's glow. */
function bayTexture(wall: string, glass: string, kind: 'strip' | 'grid' | 'arch', lit = false) {
  const key = `${wall}|${glass}|${kind}|${lit}`
  let t = windowTex.get(key)
  if (t) return t
  if (lit) [wall, glass] = ['#000000', '#ffffff']
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 32
  const g = c.getContext('2d')!
  g.fillStyle = wall
  g.fillRect(0, 0, 32, 32)
  g.fillStyle = glass
  if (kind === 'strip') g.fillRect(9, 4, 14, 24)
  else if (kind === 'grid') g.fillRect(3, 6, 26, 20)
  else {
    g.fillRect(9, 10, 14, 18)
    g.beginPath()
    g.arc(16, 10, 7, Math.PI, 0)
    g.fill()
  }
  g.fillStyle = wall
  if (kind !== 'strip') g.fillRect(15, 6, 2, 22)
  t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  windowTex.set(key, t)
  return t
}

/** A box `s` (w, h, d) whose sides are a grid of windows `bay` m wide and `floor` m tall; its top and bottom plain. Lit at night. */
export function WindowBox({ s, p, wall, glass, bay = 1.6, floor = 3.8, kind = 'strip', night, ry = 0 }: { s: [number, number, number]; p: [number, number, number]; wall: string; glass: string; bay?: number; floor?: number; kind?: 'strip' | 'grid' | 'arch'; night: boolean; ry?: number }) {
  const [w, h, d] = s
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(w, h, d)
    const uv = g.attributes.uv as THREE.BufferAttribute
    // BoxGeometry's faces, 4 vertices each: +x, -x, +y, -y, +z, -z.
    const size: [number, number][] = [
      [d, h],
      [d, h],
      [0, 0],
      [0, 0],
      [w, h],
      [w, h],
    ]
    for (let f = 0; f < 6; f++)
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k
        const [fw, fh] = size[f]
        uv.setXY(i, fw ? (uv.getX(i) * fw) / bay : 0.02, fh ? (uv.getY(i) * fh) / floor : 0.02)
      }
    return g
  }, [w, h, d, bay, floor])
  const mat = useMemo(() => {
    return new THREE.MeshLambertMaterial({ map: bayTexture(wall, glass, kind), emissive: new THREE.Color('#ffd98a'), emissiveMap: bayTexture(wall, glass, kind, true) })
  }, [wall, glass, kind])
  mat.emissiveIntensity = night ? 0.45 : 0
  return <mesh geometry={geo} material={mat} position={p} rotation={[0, ry, 0]} castShadow receiveShadow />
}

/* ---------- The street's life round a landmark ---------- */

type Style = 'sahel' | 'newyork' | 'montreal' | 'europe' | 'paris'
// (France: the dark green lamp-post and its lantern; the platane; a colonne Morris, a café table, a bike of the city's.)
const PARIS_LAMP: Part[] = [
  [0, 0.3, 0, 0.4, 0.6, 0.4, '#24382c'],
  [0, 2.6, 0, 0.14, 4.6, 0.14, '#24382c'],
  [0, 5, 0, 0.5, 0.6, 0.5, '#fff3bf'],
  [0, 5.4, 0, 0.6, 0.2, 0.6, '#24382c'],
]
const LAMP: Record<Style, Part[]> = {
  // Europe (europe3d.tsx): the old lantern on its cast-iron post.
  europe: [
    [0, 0.3, 0, 0.36, 0.6, 0.36, '#23282d'],
    [0, 2.4, 0, 0.14, 4, 0.14, '#23282d'],
    [0, 4.7, 0, 0.56, 0.7, 0.56, '#fff3bf'],
    [0, 5.15, 0, 0.7, 0.2, 0.7, '#23282d'],
  ],
  sahel: [
    [0, 2.5, 0, 0.14, 5, 0.14, '#5c5f66'],
    [0.5, 5, 0, 1, 0.1, 0.1, '#5c5f66'],
    [0.95, 4.9, 0, 0.4, 0.16, 0.3, '#fff3bf'],
  ],
  newyork: [
    [0, 0.3, 0, 0.4, 0.6, 0.4, '#2f3a33'],
    [0, 3.2, 0, 0.16, 6, 0.16, '#2f3a33'],
    [0.9, 6.2, 0, 1.8, 0.12, 0.12, '#2f3a33'],
    [1.7, 6, 0, 0.5, 0.25, 0.5, '#fff3bf'],
  ],
  paris: PARIS_LAMP,
  montreal: [
    [0, 2.2, 0, 0.14, 4.4, 0.14, '#1f2a24'],
    [0, 4.6, 0, 0.5, 0.6, 0.5, '#fff3bf'],
    [0, 5, 0, 0.6, 0.2, 0.6, '#1f2a24'],
  ],
}
const BENCH: Part[] = [
  [0, 0.45, 0, 1.8, 0.08, 0.5, '#8a6a3c'],
  [0, 0.75, -0.22, 1.8, 0.4, 0.06, '#8a6a3c'],
  [-0.8, 0.22, 0, 0.08, 0.44, 0.4, '#3a3a3a'],
  [0.8, 0.22, 0, 0.08, 0.44, 0.4, '#3a3a3a'],
]
const TREE: Record<Style, (r: () => number) => Part[]> = {
  europe: (r) => [
    [0, 1.8, 0, 0.34, 3.6, 0.34, '#5a4632'],
    [0, 4.8, 0, 3.4, 3, 3.4, r() < 0.5 ? '#4f7f3a' : '#5e8f42'],
    [0, 6.6, 0, 2.2, 1, 2.2, '#4f7f3a'],
  ],
  paris: (r) => [
    [0, 0.06, 0, 1.5, 0.12, 1.5, '#3a3a3a'],
    [0, 2.2, 0, 0.36, 4.4, 0.36, '#9c9a86'],
    [0, 5.6, 0, 4.2, 3.2, 4.2, r() < 0.5 ? '#6a8f3a' : '#7a9a48'],
    [0, 7.4, 0, 2.8, 1, 2.8, '#7a9a48'],
  ],
  sahel: (r) => [
    [0, 1.6, 0, 0.4, 3.2, 0.4, '#6b4a2a'],
    [0, 4, 0, 4.4, 1.6, 4.4, r() < 0.5 ? '#4c7a36' : '#5c8a3a'],
    [0, 5, 0, 3, 0.8, 3, '#5c8a3a'],
  ],
  newyork: (r) => [
    [0, 0.06, 0, 1.4, 0.12, 1.4, '#5a4a3a'],
    [0, 1.8, 0, 0.3, 3.6, 0.3, '#5a4632'],
    [0, 4.6, 0, 3, 2.8, 3, r() < 0.5 ? '#3c7a36' : '#4c8a3a'],
  ],
  montreal: (r) => [
    [0, 1.8, 0, 0.36, 3.6, 0.36, '#5a4632'],
    [0, 4.8, 0, 3.6, 3, 3.6, ['#c2611f', '#d9a21a', '#b8301f', '#3c7a36'][Math.floor(r() * 4)]],
    [0, 6.6, 0, 2.4, 1, 2.4, '#d9a21a'],
  ],
}
const EXTRA: Record<Style, Part[][]> = {
  // A café's table and its parasol, a rack of bikes, a bin, a flower box.
  europe: [
    [
      [0, 0.38, 0, 0.8, 0.06, 0.8, '#e9ecef'],
      [0, 0.19, 0, 0.1, 0.38, 0.1, '#3a3a3a'],
      [0, 1.2, 0, 0.06, 2.4, 0.06, '#3a3a3a'],
      [0, 2.3, 0, 2.2, 0.16, 2.2, '#c92a2a'],
    ],
    [
      [0, 0.45, 0, 1.8, 0.06, 0.06, '#5c5f66'],
      [-0.5, 0.45, 0.2, 0.06, 0.9, 1.1, '#1c7ed6'],
      [0.5, 0.45, 0.2, 0.06, 0.9, 1.1, '#2b2b2b'],
    ],
    [[0, 0.45, 0, 0.5, 0.9, 0.5, '#2f6a30']],
    [
      [0, 0.3, 0, 1.6, 0.6, 0.6, '#8a6a3c'],
      [0, 0.65, 0, 1.4, 0.2, 0.4, '#e64980'],
    ],
  ],
  // A colonne Morris, a café's table and its two chairs, a bike of the city's.
  paris: [
    [
      [0, 1.3, 0, 1, 2.6, 1, '#e9e2cf'],
      [0, 1.3, 0, 1.02, 2, 1.02, '#d9480f', Math.PI / 4],
      [0, 2.75, 0, 1.2, 0.3, 1.2, '#2f5a3f'],
    ],
    [
      [0, 0.72, 0, 0.62, 0.05, 0.62, '#d9d9d9'],
      [0, 0.36, 0, 0.06, 0.72, 0.06, '#2b2b2b'],
      [-0.55, 0.45, 0, 0.42, 0.06, 0.42, '#b08850'],
      [0.55, 0.45, 0, 0.42, 0.06, 0.42, '#b08850'],
    ],
    [
      [0, 0.38, 0, 0.06, 0.74, 0.74, '#343a40'],
      [0, 0.38, 0, 0.08, 0.1, 1.5, '#63e6be'],
      [0, 0.85, -0.45, 0.4, 0.06, 0.12, '#343a40'],
    ],
  ],
  // A mobylette, a seller's basin of oranges on her stool, a charcoal grill.
  sahel: [
    [
      [0, 0.5, 0, 0.3, 0.6, 1.5, '#1c7ed6'],
      [0, 0.95, 0.3, 0.5, 0.1, 0.1, '#222'],
      [0, 0.75, -0.3, 0.3, 0.2, 0.5, '#111'],
    ],
    [
      [0, 0.25, 0, 0.5, 0.5, 0.5, '#8a6a3c'],
      [0, 0.6, 0, 0.9, 0.2, 0.9, '#c0c4c8'],
      [0, 0.75, 0, 0.7, 0.16, 0.7, '#f08c00'],
    ],
    [
      [0, 0.4, 0, 0.8, 0.8, 0.5, '#3a3a3a'],
      [0, 0.85, 0, 0.7, 0.1, 0.4, '#e8590c'],
    ],
  ],
  // A fire hydrant, a trash basket, a newspaper box, a hot-dog cart.
  newyork: [
    [
      [0, 0.4, 0, 0.36, 0.8, 0.36, '#c92a2a'],
      [0, 0.85, 0, 0.26, 0.14, 0.26, '#c92a2a'],
    ],
    [[0, 0.45, 0, 0.6, 0.9, 0.6, '#3a5a3a']],
    [[0, 0.6, 0, 0.5, 1.2, 0.4, '#1c7ed6']],
    [
      [0, 0.6, 0, 1.6, 1, 0.8, '#d0d4d8'],
      [0, 2, 0, 1.8, 0.1, 1.2, '#1c7ed6'],
      [0, 1.4, 0, 0.06, 1.2, 0.06, '#888'],
    ],
  ],
  // A Bixi bike stand, a bin, a flower box.
  montreal: [
    [
      [0, 0.5, 0, 1.6, 0.08, 0.1, '#c92a2a'],
      [0, 0.45, 0.3, 1.5, 0.7, 0.06, '#c92a2a'],
    ],
    [[0, 0.5, 0, 0.6, 1, 0.6, '#2f6a30']],
    [
      [0, 0.3, 0, 1.6, 0.6, 0.6, '#8a6a3c'],
      [0, 0.65, 0, 1.4, 0.2, 0.4, '#e64980'],
    ],
  ],
}

/**
 * The street's life along a landmark's front (the street at +z): lamps, benches, trees, and the city's own
 * small things (mobylettes and sellers in the Sahel, hydrants and carts in New York, bike stands in Montréal),
 * from x0 to x1 at depth z.
 */
export function streetLife(out: At[], style: Style, x0: number, x1: number, z: number, seed: number) {
  const r = seeded(seed)
  for (let x = x0; x <= x1; x += 8) {
    put(out, [x, z, Math.PI / 2], LAMP[style])
    put(out, [x + 4, z - 1.2, 0], TREE[style](r))
    if (r() < 0.5) put(out, [x + 2, z + 0.4, Math.PI], BENCH)
    if (r() < 0.6) {
      const e = EXTRA[style]
      put(out, [x + 6, z + 0.6, r() * 3], e[Math.floor(r() * e.length)])
    }
  }
}

/** A round face standing upright toward +z (a clock, a rose window): rows of blocks, r its radius, at its middle p. */
export function disc(out: At[], [x, y, z]: [number, number, number], r: number, c: string, rows = 7, depth = 0.12) {
  for (let i = 0; i < rows; i++) {
    const yy = -r + ((i + 0.5) * 2 * r) / rows
    out.push({ p: [x, y + yy, z], s: [2 * Math.sqrt(Math.max(0, r * r - yy * yy)), (2 * r) / rows + 0.01, depth], c })
  }
}
/** A clock's face toward +z: its rim, the dial, the two hands. */
export function clockFace(out: At[], [x, y, z]: [number, number, number], r: number, rim = '#c9a24a') {
  disc(out, [x, y, z], r, rim, 7, 0.12)
  disc(out, [x, y, z + 0.07], r * 0.84, '#f8f9fa', 7, 0.06)
  out.push({ p: [x, y + r * 0.25, z + 0.12], s: [r * 0.08, r * 0.55, 0.04], c: '#111' }, { p: [x + r * 0.2, y, z + 0.12], s: [r * 0.42, r * 0.08, 0.04], c: '#111' })
}
