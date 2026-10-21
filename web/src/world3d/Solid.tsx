import { useEffect, useId, useRef } from 'react'
import * as THREE from 'three'
import { clearObstacles, setObstacles, type Obstacle } from './obstacles'
import { whereabouts } from './whereabouts'

/**
 * What's inside can't be walked through: once drawn, it's measured in its
 * own frame (its turned box, so the door in front stays reachable) and put
 * in the obstacles until it goes.
 *
 * With `parts`, not one box round everything but each thing inside at body
 * height on its own (a table and its chairs, a bench, a stall, a billboard's
 * legs, a parasol's pole), so one walks between them: the people inside are
 * left out (they step aside), and so are what's under the knee (a step, a
 * mat) and what's over the head (a canopy, a panel up high). Measured again
 * now and then while the Sim is near, for what's drawn only when it is.
 */
export function Solid({ children, pad = 0, parts = false }: { children: React.ReactNode; pad?: number; parts?: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const key = useId()
  const remeasure = useRef<() => void>(() => {})
  useEffect(() => {
    const g = ref.current
    if (!g) return
    let last = ''
    let list: Obstacle[] = []
    const measure = () => {
      const t0 = import.meta.env.DEV ? performance.now() : 0
      list = parts ? pieces(g, pad) : whole(g, pad)
      if (import.meta.env.DEV) (measured.n++, (measured.ms += performance.now() - t0))
      // Only when it changed: the obstacles' index is built again on each change.
      const sig = list.map((o) => ('r' in o ? `${o.x.toFixed(2)},${o.z.toFixed(2)},${o.r}` : `${o.x.toFixed(2)},${o.z.toFixed(2)},${o.hw.toFixed(2)},${o.hd.toFixed(2)}`)).join(';')
      if (sig === last) return
      last = sig
      setObstacles(key, list)
    }
    // A frame later, once everything inside has its geometry.
    let id = requestAnimationFrame(measure)
    remeasure.current = () => {
      cancelAnimationFrame(id)
      id = requestAnimationFrame(measure)
    }
    // Near it or what it holds (the group may stand at the world's origin, its things placed far off), or while it holds nothing yet.
    const close = (x: number, z: number) => Math.hypot(x - whereabouts.sim[0], z - whereabouts.sim[1]) < 120
    const near = () => {
      const at = g.getWorldPosition(new THREE.Vector3())
      return !list.length || close(at.x, at.z) || list.some((o) => close(o.x, o.z))
    }
    const again = parts ? setInterval(() => near() && measure(), 2000) : undefined
    return () => {
      cancelAnimationFrame(id)
      clearInterval(again)
      clearObstacles(key)
    }
  }, [key, pad, parts])
  // What it holds drawn again (another spot, things added): measured again.
  useEffect(() => remeasure.current(), [children])
  return <group ref={ref}>{children}</group>
}

// In development: how many times things were measured (tests in the browser: __measured).
const measured = { n: 0, ms: 0 }
if (import.meta.env.DEV) Object.assign(globalThis, { __measured: measured })

/** Everything inside as one box, turned with the group; with its height, for the close camera. */
function whole(g: THREE.Group, pad: number): Obstacle[] {
  g.updateWorldMatrix(true, true)
  const inv = g.matrixWorld.clone().invert()
  const box = new THREE.Box3()
  const part = new THREE.Box3()
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.geometry) return
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
    part.copy(m.geometry.boundingBox!).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
    box.union(part)
  })
  if (box.isEmpty()) return []
  const c = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const at = g.localToWorld(c.clone())
  return [{ x: at.x, z: at.z, hw: size.x / 2 + pad, hd: size.z / 2 + pad, rot: turnOf(g), top: at.y + size.y / 2 }]
}

const KNEE = 0.45 // metres: lower, it's stepped over (a kerb, a mat, a low stool's top is just under)
const HEAD = 1.6 // higher, it's walked under (a parasol, an awning, a board up on its legs)
const TOUCH = 0.15 // parts this close are one thing (a table's top and legs, its chairs, the bottles on it)…
const ONE = 3 // …while it stays this small: a row of rails or of stalls stays a row, the alley between them open
const CROWD = 300

/** Each thing at body height in its own turned box. */
function pieces(g: THREE.Group, pad: number): Obstacle[] {
  g.updateWorldMatrix(true, true)
  const one = new THREE.Matrix4()
  const unturn = new THREE.Matrix4()
  const world = new THREE.Box3()
  const [pos, q, scale, e] = [new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3(), new THREE.Euler()]
  // Each part's box in a frame turned like it (about the world's origin), so parts turned alike share it.
  const parts: { b: THREE.Box3; rot: number }[] = []
  const add = (geo: THREE.BufferGeometry, m: THREE.Matrix4) => {
    if (!geo.boundingBox) geo.computeBoundingBox()
    world.copy(geo.boundingBox!).applyMatrix4(m)
    if (world.min.y > HEAD || world.max.y < KNEE) return
    // A deck or a raised floor, wide and low: the ground one stands on there.
    if (world.max.y - world.min.y < 0.7 && world.max.x - world.min.x > 6 && world.max.z - world.min.z > 6) return
    m.decompose(pos, q, scale)
    const rot = Math.round(e.setFromQuaternion(q, 'YXZ').y / 0.02) * 0.02
    unturn.makeRotationY(-rot).multiply(m)
    // Big and of no solid shape (a fence baked as one, a ring of stalls, a U of walls): its box would wall its open middle in.
    if (!SOLID_SHAPES.has(geo.type) && world.max.x - world.min.x > ONE && world.max.z - world.min.z > ONE) {
      for (const b of cellsOf(geo, unturn)) parts.push({ b, rot })
      return
    }
    parts.push({ b: geo.boundingBox!.clone().applyMatrix4(unturn), rot })
  }
  const visit = (o: THREE.Object3D) => {
    // People step aside; glows and shadows are light, not things. Baked together
    // (staticMerge.tsx): each block as it stands, hidden, not the one mesh drawn.
    if ((!o.visible && !o.userData.baked) || o.name === 'human' || o.userData.walkThrough || o.userData.merged) return
    const m = o as THREE.Mesh
    if (m.isMesh && m.geometry) {
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material | undefined
      if (!(mat && mat.transparent && mat.opacity < 0.6)) {
        const im = o as THREE.InstancedMesh
        // Thousands drawn as one (a stadium's crowd, smoke, rain): people and specks, not things.
        if (im.isInstancedMesh) for (let i = 0; i < (im.count > CROWD ? 0 : im.count); i++) add(m.geometry, new THREE.Matrix4().multiplyMatrices(m.matrixWorld, (im.getMatrixAt(i, one), one)))
        else add(m.geometry, m.matrixWorld)
      }
    }
    for (const c of o.children) visit(c)
  }
  visit(g)
  // Parts turned alike that touch are one thing, while it stays small.
  const near = (a: THREE.Box3, b: THREE.Box3) => a.min.x <= b.max.x + TOUCH && a.max.x >= b.min.x - TOUCH && a.min.z <= b.max.z + TOUCH && a.max.z >= b.min.z - TOUCH
  const small = (a: THREE.Box3, b: THREE.Box3) => Math.max(a.max.x, b.max.x) - Math.min(a.min.x, b.min.x) <= ONE && Math.max(a.max.z, b.max.z) - Math.min(a.min.z, b.min.z) <= ONE
  const merged: { b: THREE.Box3; rot: number }[] = []
  for (const p of parts) {
    const into = merged.find((m) => m.rot === p.rot && near(m.b, p.b) && small(m.b, p.b))
    if (!into) {
      merged.push({ b: p.b.clone(), rot: p.rot })
      continue
    }
    into.b.union(p.b)
    // It may reach others now: fold them in.
    for (let again = true; again; ) {
      again = false
      for (let i = merged.length - 1; i >= 0; i--) {
        const m = merged[i]
        if (m !== into && m.rot === into.rot && near(m.b, into.b) && small(m.b, into.b)) {
          into.b.union(m.b)
          merged.splice(i, 1)
          again = true
        }
      }
    }
  }
  return merged.map(({ b, rot }) => {
    // The box's middle, turned back into the world (a Three.js turn about y).
    const [u, v] = [(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2]
    const [c, s] = [Math.cos(rot), Math.sin(rot)]
    return { x: u * c + v * s, z: -u * s + v * c, hw: (b.max.x - b.min.x) / 2 + pad, hd: (b.max.z - b.min.z) / 2 + pad, rot }
  })
}

/** Shapes with no open middle: their box is what they fill. */
const SOLID_SHAPES = new Set(['BoxGeometry', 'CylinderGeometry', 'SphereGeometry', 'ConeGeometry', 'CapsuleGeometry', 'IcosahedronGeometry', 'OctahedronGeometry', 'DodecahedronGeometry', 'PlaneGeometry', 'CircleGeometry'])

const CELL = 0.5
const LEVELS = [0.6, 0.9, 1.2, 1.5] // where a body is cut across
const cellCache = new WeakMap<THREE.BufferGeometry, { key: string; boxes: THREE.Box3[] }>()

/**
 * What a shape holds at body height, by half-metre cells in the frame
 * `toFrame` brings it to: where its triangles cross the body's heights
 * (walls, posts, the sides of a counter), the cells of a row in a run joined.
 * Kept while the shape stays where it is.
 */
function cellsOf(geo: THREE.BufferGeometry, toFrame: THREE.Matrix4) {
  const key = toFrame.elements.map((v) => v.toFixed(3)).join(',')
  const known = cellCache.get(geo)
  if (known?.key === key) return known.boxes.map((b) => b.clone())
  const pos = geo.attributes.position as THREE.BufferAttribute
  const index = geo.index
  const count = index ? index.count : pos.count
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const rows = new Map<number, Set<number>>()
  const mark = (x: number, z: number) => {
    const cz = Math.floor(z / CELL)
    const row = rows.get(cz) ?? new Set<number>()
    row.add(Math.floor(x / CELL))
    rows.set(cz, row)
  }
  for (let t = 0; t + 2 < count; t += 3) {
    for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, index ? index.getX(t + k) : t + k).applyMatrix4(toFrame)
    const [lo, hi] = [Math.min(v[0].y, v[1].y, v[2].y), Math.max(v[0].y, v[1].y, v[2].y)]
    for (const h of LEVELS) {
      if (h < lo || h > hi) continue
      // The triangle cut at this height: a segment between two of its edges.
      const cut: [number, number][] = []
      for (let k = 0; k < 3; k++) {
        const [p, q] = [v[k], v[(k + 1) % 3]]
        if ((p.y - h) * (q.y - h) > 0 || p.y === q.y) continue
        const f = (h - p.y) / (q.y - p.y)
        cut.push([p.x + (q.x - p.x) * f, p.z + (q.z - p.z) * f])
      }
      if (cut.length < 2) continue
      const [[x0, z0], [x1, z1]] = cut
      const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (CELL / 2))
      for (let i = 0; i <= n; i++) mark(x0 + ((x1 - x0) * i) / Math.max(1, n), z0 + ((z1 - z0) * i) / Math.max(1, n))
    }
  }
  const boxes: THREE.Box3[] = []
  for (const [cz, row] of rows) {
    const xs = [...row].sort((a, b) => a - b)
    for (let i = 0; i < xs.length; ) {
      let k = i
      while (k + 1 < xs.length && xs[k + 1] === xs[k] + 1) k++
      boxes.push(new THREE.Box3(new THREE.Vector3(xs[i] * CELL, KNEE, cz * CELL), new THREE.Vector3((xs[k] + 1) * CELL, HEAD, (cz + 1) * CELL)))
      i = k + 1
    }
  }
  cellCache.set(geo, { key, boxes })
  return boxes.map((b) => b.clone())
}

const turnOf = (g: THREE.Object3D) => new THREE.Euler().setFromQuaternion(g.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y
