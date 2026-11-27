import { useMemo } from 'react'
import * as THREE from 'three'

// The ground of the Moon and of Mars in blocks (Lune.tsx, Mars.tsx): a grid of columns whose height a function
// gives (the craters, the rims, the delta's steps), coloured by height and a little noise; one instanced mesh.

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
  const mesh = useMemo(() => {
    const n = Math.floor(size / cell)
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), n * n)
    const o = new THREE.Object3D()
    const cs = colors.map((c) => new THREE.Color(c))
    const tmp = new THREE.Color()
    let k = 0
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x = -size / 2 + (i + 0.5) * cell
        const z = -size / 2 + (j + 0.5) * cell
        const h = Math.round(height(x, z) / step) * step
        const base = -6
        o.position.set(x, (h + base) / 2, z)
        o.scale.set(cell, h - base, cell)
        o.updateMatrix()
        m.setMatrixAt(k, o.matrix)
        const r = noise(i, j)
        tmp.copy(cs[Math.floor(r * cs.length) % cs.length]).multiplyScalar(0.9 + Math.min(0.25, Math.max(-0.3, h * 0.03)))
        m.setColorAt(k, tmp)
        k++
      }
    return m
  }, [size, cell, height, colors, step])
  return <primitive object={mesh} />
}
