import * as THREE from 'three'
import type { XZ } from './geo'

/** Collects one material's triangles; colours are RGB, or RGBA with `alpha`. */
export class Builder {
  constructor(readonly alpha = false) {}
  pos: number[] = []
  uv: number[] = []
  nor: number[] = []
  col: number[] = []
  idx: number[] = []
  vertex(x: number, y: number, z: number, u: number, v: number, n: [number, number, number], c?: THREE.Color, a = 1) {
    this.pos.push(x, y, z)
    this.uv.push(u, v)
    this.nor.push(...n)
    if (c) {
      this.col.push(c.r, c.g, c.b)
      if (this.alpha) this.col.push(a)
    }
    return this.pos.length / 3 - 1
  }
  /** A box turned by `rot` around Y, one colour, its faces textured per metre. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, rot: number, c: THREE.Color) {
    const [cs, sn] = [Math.cos(rot), Math.sin(rot)]
    const at = (x: number, z: number): [number, number] => [cx + x * cs - z * sn, cz + x * sn + z * cs]
    const [hx, hy, hz] = [sx / 2, sy / 2, sz / 2]
    const faces: [number, number, number, [number, number][]][] = [
      // normal (local x, y, z) and the face's corners (local x, z) at bottom
      [0, 0, 1, [[-hx, hz], [hx, hz]]],
      [0, 0, -1, [[hx, -hz], [-hx, -hz]]],
      [1, 0, 0, [[hx, hz], [hx, -hz]]],
      [-1, 0, 0, [[-hx, -hz], [-hx, hz]]],
    ]
    for (const [nx, , nz, [[x1, z1], [x2, z2]]] of faces) {
      const n: [number, number, number] = [nx * cs - nz * sn, 0, nx * sn + nz * cs]
      const [ax, az] = at(x1, z1)
      const [bx, bz] = at(x2, z2)
      const w = Math.hypot(bx - ax, bz - az)
      const p0 = this.vertex(ax, cy - hy, az, 0, 0, n, c)
      const p1 = this.vertex(bx, cy - hy, bz, w, 0, n, c)
      const p2 = this.vertex(bx, cy + hy, bz, w, sy, n, c)
      const p3 = this.vertex(ax, cy + hy, az, 0, sy, n, c)
      this.quad(p0, p1, p2, p3)
    }
    for (const y of [cy + hy, cy - hy]) {
      const up = y > cy
      const n: [number, number, number] = [0, up ? 1 : -1, 0]
      const corners = [[-hx, hz], [hx, hz], [hx, -hz], [-hx, -hz]].map(([x, z]) => at(x, z))
      const ids = corners.map(([x, z], k) => this.vertex(x, y, z, k === 1 || k === 2 ? sx : 0, k >= 2 ? sz : 0, n, c))
      if (up) this.quad(ids[0], ids[1], ids[2], ids[3])
      else this.quad(ids[0], ids[3], ids[2], ids[1])
    }
  }
  /** An upright cylinder (a water tank). */
  cylinder(cx: number, y0: number, cz: number, r: number, h: number, c: THREE.Color, sides = 10) {
    const ring: number[][] = []
    for (let k = 0; k <= sides; k++) {
      const t = (k / sides) * Math.PI * 2
      const n: [number, number, number] = [Math.cos(t), 0, Math.sin(t)]
      ring.push([this.vertex(cx + n[0] * r, y0, cz + n[2] * r, k / sides * 4, 0, n, c), this.vertex(cx + n[0] * r, y0 + h, cz + n[2] * r, k / sides * 4, h, n, c)])
    }
    for (let k = 0; k < sides; k++) this.quad(ring[k][0], ring[k][1], ring[k + 1][1], ring[k + 1][0])
    const top = this.vertex(cx, y0 + h + r * 0.25, cz, 0, 0, [0, 1, 0], c)
    for (let k = 0; k < sides; k++) {
      const a = this.vertex(this.pos[ring[k][1] * 3], y0 + h, this.pos[ring[k][1] * 3 + 2], 0, 0, [0, 1, 0], c)
      const b = this.vertex(this.pos[ring[k + 1][1] * 3], y0 + h, this.pos[ring[k + 1][1] * 3 + 2], 1, 0, [0, 1, 0], c)
      this.idx.push(top, b, a)
    }
  }
  /** A flat polygon (with holes) at height y, textured in world space. */
  flat(rings: XZ[][], y: number, scale: number, c?: THREE.Color) {
    const [outer, ...holes] = rings.map((r) => r.map(([x, z]) => new THREE.Vector2(x, z)))
    if (outer.length < 3) return
    let faces: number[][]
    try {
      faces = THREE.ShapeUtils.triangulateShape(outer, holes)
    } catch {
      return
    }
    const base = this.pos.length / 3
    for (const p of [outer, ...holes].flat()) this.vertex(p.x, y, p.y, p.x / scale, -p.y / scale, [0, 1, 0], c)
    // Rings are drawn from above: keep every triangle facing up.
    for (const [a, b, d] of faces) {
      const pa = this.pos.slice((base + a) * 3, (base + a) * 3 + 3)
      const pb = this.pos.slice((base + b) * 3, (base + b) * 3 + 3)
      const pd = this.pos.slice((base + d) * 3, (base + d) * 3 + 3)
      const up = (pb[0] - pa[0]) * (pd[2] - pa[2]) - (pb[2] - pa[2]) * (pd[0] - pa[0]) < 0
      this.idx.push(base + a, ...(up ? [base + b, base + d] : [base + d, base + b]))
    }
  }
  quad(a: number, b: number, c: number, d: number) {
    this.idx.push(a, b, c, a, c, d)
  }
  /** A triangle wound so its front faces along n, whatever order it came in. */
  facing(n: [number, number, number], a: number, b: number, c: number) {
    const p = (i: number) => [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]]
    const [pa, pb, pc] = [p(a), p(b), p(c)]
    const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]]
    const v = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]]
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const along = cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2]
    this.idx.push(a, ...(along >= 0 ? [b, c] : [c, b]))
  }
  geometry() {
    if (!this.idx.length) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    if (this.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, this.alpha ? 4 : 3))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    return g
  }
}

