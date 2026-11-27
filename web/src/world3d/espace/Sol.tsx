import { useMemo } from 'react'
import * as THREE from 'three'

// The ground of the Moon and of Mars in blocks (Lune.tsx, Mars.tsx): a grid of columns whose height a function
// gives (the craters, the rims, the delta's steps), coloured by height and a little noise; one mesh of the faces that can be seen.

export type Crater = { x: number; z: number; r: number; depth: number }

/** A crater's dent with its rim: what it adds to the height at (x, z). */
export function crater(c: Crater, x: number, z: number) {
  const d = Math.hypot(x - c.x, z - c.z) / c.r
  if (d > 1.6) return 0
  if (d < 1) return -c.depth * (1 - d * d) + c.depth * 0.35 * d ** 6
  return c.depth * 0.35 * Math.max(0, 1 - (d - 1) / 0.6) ** 2
}

export const noise = (x: number, z: number) => {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return n - Math.floor(n)
}

export function Sol({ size = 140, cell = 2, height, colors, step = 0.5 }: { size?: number; cell?: number; height: (x: number, z: number) => number; colors: string[]; step?: number }) {
  // One mesh of the faces that can be seen: each column's top, and its sides only where the neighbour is lower
  // (down to the ground's base at the edge); never the bottoms nor the sides hidden against a taller neighbour.
  const mesh = useMemo(() => {
    const n = Math.floor(size / cell)
    const base = -6
    const hs = new Float32Array(n * n)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) hs[i * n + j] = Math.round(height(-size / 2 + (i + 0.5) * cell, -size / 2 + (j + 0.5) * cell) / step) * step
    const at = (i: number, j: number) => (i < 0 || j < 0 || i >= n || j >= n ? base : hs[i * n + j])
    const cs = colors.map((c) => new THREE.Color(c))
    const tmp = new THREE.Color()
    const pos: number[] = []
    const nor: number[] = []
    const col: number[] = []
    // A quad from four corners (counter-clockwise seen from outside), its normal, the cell's colour.
    const quad = (q: number[][], nx: number, ny: number, nz: number) => {
      for (const k of [0, 1, 2, 0, 2, 3]) {
        pos.push(q[k][0], q[k][1], q[k][2])
        nor.push(nx, ny, nz)
        col.push(tmp.r, tmp.g, tmp.b)
      }
    }
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const h = hs[i * n + j]
        const x0 = -size / 2 + i * cell
        const z0 = -size / 2 + j * cell
        const x1 = x0 + cell
        const z1 = z0 + cell
        tmp.copy(cs[Math.floor(noise(i, j) * cs.length) % cs.length]).multiplyScalar(0.9 + Math.min(0.25, Math.max(-0.3, h * 0.03)))
        quad([[x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0]], 0, 1, 0)
        let lo = at(i + 1, j)
        if (lo < h) quad([[x1, lo, z0], [x1, h, z0], [x1, h, z1], [x1, lo, z1]], 1, 0, 0)
        lo = at(i - 1, j)
        if (lo < h) quad([[x0, lo, z1], [x0, h, z1], [x0, h, z0], [x0, lo, z0]], -1, 0, 0)
        lo = at(i, j + 1)
        if (lo < h) quad([[x1, lo, z1], [x1, h, z1], [x0, h, z1], [x0, lo, z1]], 0, 0, 1)
        lo = at(i, j - 1)
        if (lo < h) quad([[x0, lo, z0], [x0, h, z0], [x1, h, z0], [x1, lo, z0]], 0, 0, -1)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.computeBoundingSphere()
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }))
    m.userData.live = true
    return m
  }, [size, cell, height, colors, step])
  return <primitive object={mesh} />
}
