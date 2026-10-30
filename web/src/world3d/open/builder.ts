import * as THREE from 'three'
import type { XZ } from './geo'

/** A growing array of floats: written in place, doubled when full (no number[] to convert at the end). */
class Floats {
  a = new Float32Array(1024)
  n = 0
  room(k: number) {
    if (this.n + k <= this.a.length) return
    const b = new Float32Array(Math.max(this.a.length * 2, this.n + k))
    b.set(this.a.subarray(0, this.n))
    this.a = b
  }
}

/**
 * Collects one material's triangles; colours are RGB, or RGBA with `alpha`.
 * The arrays come out small: normals in bytes, colours in bytes (unless one
 * is brighter than white), the building tags in whole metres, the index in
 * 16 bits when it can be. A chunk's street weighed tens of megabytes in floats.
 */
export class Builder {
  constructor(readonly alpha = false) {}
  private p = new Floats()
  private t = new Floats()
  private o = new Floats()
  private c = new Floats()
  private b = new Floats()
  private i = new Uint32Array(1024)
  private ni = 0
  private colours = false
  /** The building being added (its middle x, z and how far its outline reaches): every vertex carries it (lotClip.ts). */
  tag: [number, number, number] | null = null
  private tagged = 0
  /** How many vertices so far. */
  get vertices() {
    return this.p.n / 3
  }
  /** How many indices so far (three a triangle). */
  get indices() {
    return this.ni
  }
  /** The triangles added since index `from` turned to face the other way. */
  flipFrom(from: number) {
    const i = this.i
    for (let k = from; k < this.ni; k += 3) [i[k + 1], i[k + 2]] = [i[k + 2], i[k + 1]]
  }
  private push(...ids: number[]) {
    if (this.ni + ids.length > this.i.length) {
      const b = new Uint32Array(Math.max(this.i.length * 2, this.ni + ids.length))
      b.set(this.i.subarray(0, this.ni))
      this.i = b
    }
    for (const id of ids) this.i[this.ni++] = id
  }
  vertex(x: number, y: number, z: number, u: number, v: number, n: [number, number, number], c?: THREE.Color, a = 1) {
    const { p, t, o } = this
    p.room(3)
    t.room(2)
    o.room(3)
    const k = p.n / 3
    p.a[p.n] = x
    p.a[p.n + 1] = y
    p.a[p.n + 2] = z
    p.n += 3
    t.a[t.n] = u
    t.a[t.n + 1] = v
    t.n += 2
    o.a[o.n] = n[0]
    o.a[o.n + 1] = n[1]
    o.a[o.n + 2] = n[2]
    o.n += 3
    if (this.tag) {
      const b = this.b
      b.room(3)
      b.a[b.n] = this.tag[0]
      b.a[b.n + 1] = this.tag[1]
      b.a[b.n + 2] = this.tag[2]
      b.n += 3
      this.tagged++
    }
    if (c) {
      const col = this.c
      const size = this.alpha ? 4 : 3
      // (A vertex without a colour among coloured ones keeps black, in its own place.)
      col.room(k * size + size - col.n)
      col.n = k * size
      col.a[col.n] = c.r
      col.a[col.n + 1] = c.g
      col.a[col.n + 2] = c.b
      if (this.alpha) col.a[col.n + 3] = a
      col.n += size
      this.colours = true
    }
    return k
  }
  /**
   * A beam from (x1, z1) to (x2, z2), `w` wide, its bottom and top at each end
   * (b1, t1 and b2, t2): a box that follows a slope (a ramp's girder, its
   * railing, its embankment) instead of a flat block in steps.
   */
  ramp(x1: number, z1: number, x2: number, z2: number, b1: number, t1: number, b2: number, t2: number, w: number, c: THREE.Color) {
    const len = Math.hypot(x2 - x1, z2 - z1)
    if (len < 0.01) return
    const [ux, uz] = [(x2 - x1) / len, (z2 - z1) / len]
    const [nx, nz] = [-uz * (w / 2), ux * (w / 2)]
    const face = (n: [number, number, number], v: [number, number, number, number, number][]) => {
      const ids = v.map(([x, y, z, u, t]) => this.vertex(x, y, z, u, t, n, c))
      this.facing(n, ids[0], ids[1], ids[2])
      this.facing(n, ids[0], ids[2], ids[3])
    }
    // The two long sides.
    for (const s of [1, -1]) {
      const [ax, az, bx, bz] = [x1 + nx * s, z1 + nz * s, x2 + nx * s, z2 + nz * s]
      face([-uz * s, 0, ux * s], [[ax, b1, az, 0, b1], [bx, b2, bz, len, b2], [bx, t2, bz, len, t2], [ax, t1, az, 0, t1]])
    }
    // The two ends.
    for (const [px, pz, b, t, s] of [[x1, z1, b1, t1, -1], [x2, z2, b2, t2, 1]] as [number, number, number, number, number][])
      face([ux * s, 0, uz * s], [[px - nx, b, pz - nz, 0, b], [px + nx, b, pz + nz, w, b], [px + nx, t, pz + nz, w, t], [px - nx, t, pz - nz, 0, t]])
    // The top and the bottom.
    for (const [y1, y2, up] of [[t1, t2, 1], [b1, b2, -1]] as [number, number, number][])
      face([0, up, 0], [[x1 - nx, y1, z1 - nz, 0, 0], [x2 - nx, y2, z2 - nz, len, 0], [x2 + nx, y2, z2 + nz, len, w], [x1 + nx, y1, z1 + nz, 0, w]])
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
      const a = this.vertex(this.p.a[ring[k][1] * 3], y0 + h, this.p.a[ring[k][1] * 3 + 2], 0, 0, [0, 1, 0], c)
      const b = this.vertex(this.p.a[ring[k + 1][1] * 3], y0 + h, this.p.a[ring[k + 1][1] * 3 + 2], 1, 0, [0, 1, 0], c)
      this.push(top, b, a)
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
    const base = this.vertices
    for (const p of [outer, ...holes].flat()) this.vertex(p.x, y, p.y, p.x / scale, -p.y / scale, [0, 1, 0], c)
    // Rings are drawn from above: keep every triangle facing up.
    const P = this.p.a
    for (const [a, b, d] of faces) {
      const [ia, ib, id] = [(base + a) * 3, (base + b) * 3, (base + d) * 3]
      const up = (P[ib] - P[ia]) * (P[id + 2] - P[ia + 2]) - (P[ib + 2] - P[ia + 2]) * (P[id] - P[ia]) < 0
      this.push(base + a, ...(up ? [base + b, base + d] : [base + d, base + b]))
    }
  }
  quad(a: number, b: number, c: number, d: number) {
    this.push(a, b, c, a, c, d)
  }
  /** A triangle wound so its front faces along n, whatever order it came in. */
  facing(n: [number, number, number], a: number, b: number, c: number) {
    const P = this.p.a
    const [ia, ib, ic] = [a * 3, b * 3, c * 3]
    const u = [P[ib] - P[ia], P[ib + 1] - P[ia + 1], P[ib + 2] - P[ia + 2]]
    const v = [P[ic] - P[ia], P[ic + 1] - P[ia + 1], P[ic + 2] - P[ia + 2]]
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const along = cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2]
    this.push(a, ...(along >= 0 ? [b, c] : [c, b]))
  }
  geometry() {
    if (!this.ni) return null
    const nv = this.vertices
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.p.a.slice(0, nv * 3), 3))
    g.setAttribute('uv', new THREE.BufferAttribute(this.t.a.slice(0, nv * 2), 2))
    // Unit normals in bytes (-127…127), read back as -1…1 by the GPU.
    const nor = new Int8Array(nv * 3)
    for (let k = 0; k < nv * 3; k++) nor[k] = Math.round(this.o.a[k] * 127)
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true))
    if (this.colours) {
      const size = this.alpha ? 4 : 3
      const col = new Float32Array(nv * size)
      col.set(this.c.a.subarray(0, Math.min(this.c.n, nv * size)))
      // In bytes, unless a colour is brighter than white (the dust on the streets' edges).
      let bright = false
      for (let k = 0; k < col.length && !bright; k++) bright = col[k] > 1
      if (bright) g.setAttribute('color', new THREE.BufferAttribute(col, size))
      else {
        const bytes = new Uint8Array(nv * size)
        for (let k = 0; k < col.length; k++) bytes[k] = Math.round(Math.max(0, col[k]) * 255)
        g.setAttribute('color', new THREE.BufferAttribute(bytes, size, true))
      }
    }
    // The buildings' tags in whole metres (their reach rounded up: a lot clears a little more, never less).
    if (this.tagged && this.tagged === nv) {
      const bc = new Int16Array(nv * 3)
      const b = this.b.a
      const metres = (v: number) => Math.max(-32768, Math.min(32767, v))
      for (let k = 0; k < nv * 3; k += 3) {
        bc[k] = metres(Math.round(b[k]))
        bc[k + 1] = metres(Math.round(b[k + 1]))
        bc[k + 2] = metres(Math.ceil(b[k + 2]))
      }
      g.setAttribute('lotBc', new THREE.BufferAttribute(bc, 3))
    }
    const idx = this.i.subarray(0, this.ni)
    g.setIndex(new THREE.BufferAttribute(nv <= 65535 ? Uint16Array.from(idx) : idx.slice(), 1))
    g.computeBoundingSphere()
    return g
  }
}
