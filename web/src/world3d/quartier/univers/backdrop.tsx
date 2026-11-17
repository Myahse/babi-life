import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { XZ } from '../../open/geo'
import { SIDES, UNIV_EXT, type Side, type UniversInfo } from './gen'

// What one sees past « mon-quartier »'s own world (gen.ts): never a wall of haze, but what lies round a quartier
// of Abidjan, far off and cheap: the lagoon or the sea to the horizon, the hills and the forest in blocks of
// green, the city's blocks, the Plateau's towers on the skyline, a bridge across the lagoon, a cargo ship out at
// sea. One mesh of plain boxes with their colours (lit and fogged like the street), and the far ground round the
// world's four chunks (the water in the street's own water). Built once per world.

const FAR = 5200

type Box = { x: number; z: number; w: number; d: number; h: number; y?: number; rot?: number; c: string }

/** A side's point: `t` along it, `d` out from the middle (gen.ts sidePt). */
const sidePt = (side: Side, t: number, d: number): XZ => (side === 'n' ? [t, -d] : side === 's' ? [t, d] : side === 'e' ? [d, t] : [-d, t])

function rngOf(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const HILL = ['#4f7f3a', '#5b8c42', '#476f35', '#628f48']
const CITY = ['#d9cdb5', '#cfc3ab', '#e3d9c6', '#c8b99c', '#bfb4a0']
const GLASS = ['#8fa7bd', '#9cb3c6', '#7f97ad', '#a9bccb']

/** The boxes past the world, side by side. */
function boxesOf(u: UniversInfo): Box[] {
  const r = rngOf(u.key.split('').reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261))
  const out: Box[] = []
  const E = UNIV_EXT
  let skyline = u.preset.skyline !== 'none'
  let bridge = false
  // The skyline goes past the city or across the water, never over the hills right behind the forest.
  const order: Side[] = [...SIDES].sort((a, b) => (u.edges[a] === 'lagune' || u.edges[a] === 'ville' ? 0 : 1) - (u.edges[b] === 'lagune' || u.edges[b] === 'ville' ? 0 : 1))
  for (const s of order) {
    const e = u.edges[s]
    if (e === 'foret' || e === 'colline' || (e === 'rail' && r() < 0.5)) {
      // Hills in steps of green, bigger behind the hills' side.
      const big = e === 'colline' ? 1.8 : 1
      for (let t = -2600; t < 2600; t += 160 + r() * 160) {
        const d = E + 260 + r() * 1400
        const [x, z] = sidePt(s, t, d)
        const w = (120 + r() * 220) * big
        const h = (18 + r() * 40) * big
        for (let k = 0; k < 4; k++) out.push({ x, z, w: w * (1 - k * 0.22), d: w * (0.8 - k * 0.17), h: h * (0.35 + k * 0.3), c: HILL[Math.floor(r() * HILL.length)], rot: r() * 0.5 })
      }
    }
    if (e === 'ville' || e === 'autoroute' || e === 'rail') {
      // The city goes on: its blocks, lower far off.
      for (let k = 0; k < 140; k++) {
        const t = (r() - 0.5) * 4200
        const d = E + 140 + r() ** 0.7 * 1800
        const [x, z] = sidePt(s, t, d)
        const h = 6 + Math.floor(r() * 5) * 3 + (r() < 0.08 ? 24 : 0)
        out.push({ x, z, w: 16 + r() * 30, d: 14 + r() * 24, h, c: CITY[Math.floor(r() * CITY.length)] })
      }
    }
    if (e === 'lagune' && !bridge) {
      // A bridge across the lagoon, far off: its deck on piers.
      bridge = true
      const d = E + 700 + r() * 500
      for (let t = -1800; t <= 1800; t += 70) {
        const [x, z] = sidePt(s, t, d + t * 0.18)
        out.push({ x, z, w: s === 'n' || s === 's' ? 72 : 14, d: s === 'n' || s === 's' ? 14 : 72, h: 2.5, y: 14, c: '#cfd3d6' })
        out.push({ x, z, w: 4, d: 4, h: 14, c: '#a9aeb3' })
      }
      // The far shore, its town low along the water.
      for (let k = 0; k < 90; k++) {
        const t = (r() - 0.5) * 4400
        const [x, z] = sidePt(s, t, E + 1500 + r() * 900)
        out.push({ x, z, w: 18 + r() * 26, d: 14 + r() * 20, h: 6 + Math.floor(r() * 4) * 3, c: CITY[Math.floor(r() * CITY.length)] })
      }
    }
    if (e === 'mer') {
      // A cargo ship waiting off the port.
      const [x, z] = sidePt(s, (r() - 0.5) * 1600, E + 1400 + r() * 800)
      const along = s === 'n' || s === 's'
      out.push({ x, z, w: along ? 150 : 22, d: along ? 22 : 150, h: 9, c: '#3d4a5a' })
      for (let k = -3; k <= 3; k++) out.push({ x: x + (along ? k * 16 : 0), z: z + (along ? 0 : k * 16), w: along ? 12 : 18, d: along ? 18 : 12, h: 6, y: 9, c: ['#b5452f', '#2f6db5', '#d9a12e', '#3a8a4a'][(k + 7) % 4] })
    }
    if (skyline && (e === 'ville' || e === 'lagune' || e === 'autoroute')) {
      // Abidjan's towers on the skyline (the Plateau's), far across.
      skyline = false
      const t0 = (r() - 0.5) * 1200
      const d0 = E + 2300 + r() * 900
      for (let k = 0; k < 26; k++) {
        const [x, z] = sidePt(s, t0 + (r() - 0.5) * 900, d0 + (r() - 0.5) * 500)
        const h = 40 + r() ** 1.5 * 120
        out.push({ x, z, w: 22 + r() * 22, d: 22 + r() * 22, h, c: GLASS[Math.floor(r() * GLASS.length)] })
      }
    }
  }
  return out
}

/** One mesh of boxes, their colours in the vertices, their faces lit by their normals. */
function boxGeometry(boxes: Box[]): THREE.BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const c = new THREE.Color()
  const quad = (a: number[], b: number[], cc: number[], d: number[], n: number[], k: number) => {
    const i = pos.length / 3
    pos.push(...a, ...b, ...cc, ...d)
    for (let j = 0; j < 4; j++) nor.push(...n), col.push(c.r * k, c.g * k, c.b * k)
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }
  for (const b of boxes) {
    c.set(b.c)
    const y0 = b.y ?? 0
    const y1 = y0 + b.h
    const co = Math.cos(b.rot ?? 0)
    const si = Math.sin(b.rot ?? 0)
    const p = (u: number, v: number): [number, number] => [b.x + u * co - v * si, b.z + u * si + v * co]
    const [p0, p1, p2, p3] = [p(-b.w / 2, -b.d / 2), p(b.w / 2, -b.d / 2), p(b.w / 2, b.d / 2), p(-b.w / 2, b.d / 2)]
    quad([p0[0], y1, p0[1]], [p3[0], y1, p3[1]], [p2[0], y1, p2[1]], [p1[0], y1, p1[1]], [0, 1, 0], 1)
    const walls: [[number, number], [number, number]][] = [
      [p0, p1],
      [p1, p2],
      [p2, p3],
      [p3, p0],
    ]
    for (const [a, bb] of walls) {
      const ex = bb[0] - a[0]
      const ez = bb[1] - a[1]
      const l = Math.hypot(ex, ez) || 1
      quad([a[0], y0, a[1]], [bb[0], y0, bb[1]], [bb[0], y1, bb[1]], [a[0], y1, a[1]], [ez / l, 0, -ex / l], 0.92)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

/** The ground past the world's four chunks, side by side: the water's sides in water, the others in grass or the city's dust. */
function groundOf(u: UniversInfo): { water: THREE.BufferGeometry; land: THREE.BufferGeometry } {
  const E = UNIV_EXT
  const rects: Record<Side, [number, number, number, number]> = { n: [-FAR, -FAR, FAR, -E], s: [-FAR, E, FAR, FAR], e: [E, -E, FAR, E], w: [-FAR, -E, -E, E] }
  const make = (sides: Side[], tint: (s: Side) => string) => {
    const pos: number[] = []
    const uv: number[] = []
    const col: number[] = []
    const idx: number[] = []
    const c = new THREE.Color()
    for (const s of sides) {
      const [x0, z0, x1, z1] = rects[s]
      const i = pos.length / 3
      pos.push(x0, 0, z0, x0, 0, z1, x1, 0, z1, x1, 0, z0)
      for (const [x, z] of [
        [x0, z0],
        [x0, z1],
        [x1, z1],
        [x1, z0],
      ])
        uv.push(x / 40, -z / 40)
      c.set(tint(s))
      for (let k = 0; k < 4; k++) col.push(c.r, c.g, c.b)
      idx.push(i, i + 1, i + 2, i, i + 2, i + 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, k) => (k % 3 === 1 ? 1 : 0)), 3))
    g.setIndex(idx)
    return g
  }
  const wet = SIDES.filter((s) => u.edges[s] === 'lagune' || u.edges[s] === 'mer')
  const dry = SIDES.filter((s) => !wet.includes(s))
  return { water: make(wet, () => '#ffffff'), land: make(dry, (s) => (u.edges[s] === 'ville' || u.edges[s] === 'autoroute' ? '#bfae8c' : '#7f9f58')) }
}

const landMat = new THREE.MeshLambertMaterial({ vertexColors: true })
const boxMat = new THREE.MeshLambertMaterial({ vertexColors: true })

/** Past the world: its far ground and its boxes. `water`: the street's far water material. */
export function Backdrop({ u, water }: { u: UniversInfo; water: THREE.Material }) {
  const geo = useMemo(() => boxGeometry(boxesOf(u)), [u])
  const ground = useMemo(() => groundOf(u), [u])
  useEffect(() => () => (geo.dispose(), ground.water.dispose(), ground.land.dispose()), [geo, ground])
  return (
    <group>
      <mesh geometry={ground.water} material={water} position={[0, -0.03, 0]} renderOrder={-1} />
      <mesh geometry={ground.land} material={landMat} position={[0, -0.03, 0]} />
      <mesh geometry={geo} material={boxMat} />
    </group>
  )
}
