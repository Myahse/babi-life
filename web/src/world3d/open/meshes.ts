import * as THREE from 'three'
import { BLOCK, type ChunkData } from './tiles'
import type { XZ } from './geo'

// One chunk's geometry, merged per material so a whole chunk is a handful
// of draw calls: walls, roofs, roads, pavements, water, grass, sand.

class Builder {
  pos: number[] = []
  uv: number[] = []
  nor: number[] = []
  col: number[] = []
  idx: number[] = []
  vertex(x: number, y: number, z: number, u: number, v: number, n: [number, number, number], c?: THREE.Color) {
    this.pos.push(x, y, z)
    this.uv.push(u, v)
    this.nor.push(...n)
    if (c) this.col.push(c.r, c.g, c.b)
    return this.pos.length / 3 - 1
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
  geometry() {
    if (!this.idx.length) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    if (this.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    return g
  }
}

// Façades of Abidjan: whites, creams, ochres, pastels.
const FACADES = ['#ffffff', '#fff3e0', '#ffe0b2', '#fff9c4', '#ffe8cc', '#e3f2fd', '#f8d7e3', '#e8f5e9', '#f1e3c8', '#ffd6a5', '#eeeeee', '#fbe7c6'].map((c) => new THREE.Color(c))

function signedArea(r: XZ[]) {
  let a = 0
  for (let i = 0; i < r.length; i++) {
    const [x1, z1] = r[i]
    const [x2, z2] = r[(i + 1) % r.length]
    a += x1 * z2 - x2 * z1
  }
  return a / 2
}

// Roads draw in order, the bigger on top where they meet.
const RANK: Record<string, number> = { motorway: 9, trunk: 8, primary: 7, secondary: 6, tertiary: 5, street: 4, street_limited: 3, service: 2, pedestrian: 2, track: 1, path: 0 }

export type ChunkMeshes = {
  walls: THREE.BufferGeometry | null
  roofs: THREE.BufferGeometry | null
  tin: THREE.BufferGeometry | null
  asphalt: THREE.BufferGeometry | null
  laterite: THREE.BufferGeometry | null
  pavement: THREE.BufferGeometry | null
  water: THREE.BufferGeometry | null
  green: THREE.BufferGeometry | null
  sand: THREE.BufferGeometry | null
  pitch: THREE.BufferGeometry | null
}

/** Buildings the game draws itself (its places) are left out of the map's. */
export function buildChunk(chunk: ChunkData, skip: (c: XZ) => boolean): ChunkMeshes {
  const walls = new Builder()
  const roofs = new Builder()
  const tin = new Builder()
  for (const b of chunk.buildings) {
    if (skip(b.c)) continue
    const ring = signedArea(b.ring) > 0 ? b.ring : [...b.ring].reverse()
    const tint = FACADES[Math.floor(b.tint * FACADES.length)]
    // Walls: one texture tile per 3 m block, along and up.
    let run = 0
    for (let i = 0; i < ring.length; i++) {
      const [x1, z1] = ring[i]
      const [x2, z2] = ring[(i + 1) % ring.length]
      const len = Math.hypot(x2 - x1, z2 - z1)
      if (len < 0.01) continue
      const n: [number, number, number] = [(z2 - z1) / len, 0, -(x2 - x1) / len]
      const u0 = Math.round(run / BLOCK)
      const u1 = u0 + Math.max(1, Math.round(len / BLOCK))
      const v = b.height / BLOCK
      const a = walls.vertex(x1, 0, z1, u0, 0, n, tint)
      const c = walls.vertex(x2, 0, z2, u1, 0, n, tint)
      const d = walls.vertex(x2, b.height, z2, u1, v, n, tint)
      const e = walls.vertex(x1, b.height, z1, u0, v, n, tint)
      walls.quad(a, e, d, c)
      run += len
    }
    // Low houses wear a tin roof; the rest, concrete.
    ;(b.height <= BLOCK ? tin : roofs).flat([b.ring, ...b.holes], b.height, BLOCK)
  }

  const asphalt = new Builder()
  const laterite = new Builder()
  const pavement = new Builder()
  const strip = (to: Builder, pts: XZ[], w: number, y: number, scale: number) => {
    for (let i = 1; i < pts.length; i++) {
      const [x1, z1] = pts[i - 1]
      const [x2, z2] = pts[i]
      const len = Math.hypot(x2 - x1, z2 - z1)
      if (len < 0.01) continue
      const [nx, nz] = [(-(z2 - z1) / len) * (w / 2), ((x2 - x1) / len) * (w / 2)]
      const up: [number, number, number] = [0, 1, 0]
      const p = [
        [x1 + nx, z1 + nz],
        [x2 + nx, z2 + nz],
        [x2 - nx, z2 - nz],
        [x1 - nx, z1 - nz],
      ].map(([x, z]) => to.vertex(x, y, z, x / scale, -z / scale, up))
      to.quad(p[0], p[1], p[2], p[3])
    }
    // Round the corners where segments meet.
    for (const [x, z] of pts) {
      const ring: XZ[] = [...Array(8)].map((_, k) => [x + Math.cos((k * Math.PI) / 4) * (w / 2), z + Math.sin((k * Math.PI) / 4) * (w / 2)])
      to.flat([ring], y, scale)
    }
  }
  for (const r of [...chunk.roads].sort((a, b) => (RANK[a.cls] ?? 0) - (RANK[b.cls] ?? 0))) {
    const rank = RANK[r.cls] ?? 0
    if (r.paved) {
      // A pavement on each side of the bigger streets.
      if (rank >= 4) strip(pavement, r.pts, r.width + 3.2, 0.03, 2)
      strip(asphalt, r.pts, r.width, 0.05 + rank * 0.002, 4)
    } else strip(laterite, r.pts, r.width, 0.04, 3)
  }

  const water = new Builder()
  const green = new Builder()
  const sand = new Builder()
  const pitch = new Builder()
  for (const a of chunk.areas) {
    const [to, y, scale] = a.kind === 'water' ? [water, 0.02, 4] : a.kind === 'green' ? [green, 0.012, 2] : a.kind === 'sand' ? [sand, 0.014, 2] : [pitch, 0.016, 2]
    to.flat(a.rings, y as number, scale as number)
  }

  return {
    walls: walls.geometry(),
    roofs: roofs.geometry(),
    tin: tin.geometry(),
    asphalt: asphalt.geometry(),
    laterite: laterite.geometry(),
    pavement: pavement.geometry(),
    water: water.geometry(),
    green: green.geometry(),
    sand: sand.geometry(),
    pitch: pitch.geometry(),
  }
}
