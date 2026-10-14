import * as THREE from 'three'
import type { ChunkData } from './tiles'
import { bridgeHeights, type XZ } from './geo'
import * as Three from 'three'

// One chunk's geometry, merged per material so a whole chunk is a handful
// of draw calls: walls, roofs, roads, pavements, water, grass, sand.

import { Builder } from './builder'
import { addBuilding, newBuildingBuilders, type Style } from './buildings'

// Roads draw in order, the bigger on top where they meet.
const RANK: Record<string, number> = { motorway: 9, trunk: 8, primary: 7, secondary: 6, tertiary: 5, street: 4, street_limited: 3, service: 2, pedestrian: 2, track: 1, path: 0 }

export type ChunkMeshes = {
  walls: THREE.BufferGeometry | null
  shop: THREE.BufferGeometry | null
  inst: THREE.BufferGeometry | null
  entrance: THREE.BufferGeometry | null
  house: THREE.BufferGeometry | null
  trim: THREE.BufferGeometry | null
  roofs: THREE.BufferGeometry | null
  tin: THREE.BufferGeometry | null
  contact: THREE.BufferGeometry | null
  asphalt: THREE.BufferGeometry | null
  laterite: THREE.BufferGeometry | null
  pavement: THREE.BufferGeometry | null
  water: THREE.BufferGeometry | null
  foam: THREE.BufferGeometry | null
  paint: THREE.BufferGeometry | null
  green: THREE.BufferGeometry | null
  sand: THREE.BufferGeometry | null
  pitch: THREE.BufferGeometry | null
}

/** Buildings the game draws itself (its places) are left out of the map's. */
export function buildChunk(chunk: ChunkData, skip: (c: XZ) => boolean, styleOf: (b: ChunkData['buildings'][number]) => Style = () => 'default'): ChunkMeshes {
  const B = newBuildingBuilders()
  for (const b of chunk.buildings) if (!skip(b.c)) addBuilding(B, b, styleOf(b))

  const asphalt = new Builder()
  const laterite = new Builder()
  const pavement = new Builder()
  const strip = (to: Builder, pts: XZ[], w: number, y: number, scale: number, ys?: number[]) => {
    for (let i = 1; i < pts.length; i++) {
      const [x1, z1] = pts[i - 1]
      const [x2, z2] = pts[i]
      const [y1, y2] = ys ? [y + ys[i - 1], y + ys[i]] : [y, y]
      const len = Math.hypot(x2 - x1, z2 - z1)
      if (len < 0.01) continue
      const [nx, nz] = [(-(z2 - z1) / len) * (w / 2), ((x2 - x1) / len) * (w / 2)]
      const up: [number, number, number] = [0, 1, 0]
      const p = [
        [x1 + nx, z1 + nz],
        [x2 + nx, z2 + nz],
        [x2 - nx, z2 - nz],
        [x1 - nx, z1 - nz],
      ].map(([x, z], k) => to.vertex(x, k === 1 || k === 2 ? y2 : y1, z, x / scale, -z / scale, up))
      to.quad(p[0], p[1], p[2], p[3])
    }
    // Round the corners where segments meet.
    pts.forEach(([x, z], i) => {
      const ring: XZ[] = [...Array(8)].map((_, k) => [x + Math.cos((k * Math.PI) / 4) * (w / 2), z + Math.sin((k * Math.PI) / 4) * (w / 2)])
      to.flat([ring], y + (ys ? ys[i] : 0), scale)
    })
  }
  // A bridge: its deck's edges, the railings, and the pillars in the water.
  const CONCRETE = new Three.Color('#b9b4aa')
  const RAILING = new Three.Color('#e9ecef')
  const bridge = (pts: XZ[], w: number, ys: number[]) => {
    let run = 0
    for (let i = 1; i < pts.length; i++) {
      const [x1, z1] = pts[i - 1]
      const [x2, z2] = pts[i]
      const len = Math.hypot(x2 - x1, z2 - z1)
      if (len < 0.01) continue
      const rot = Math.atan2(z2 - z1, x2 - x1)
      const [nx, nz] = [-(z2 - z1) / len, (x2 - x1) / len]
      const ym = (ys[i - 1] + ys[i]) / 2
      if (ym < 0.6) {
        run += len
        continue
      }
      const [mx, mz] = [(x1 + x2) / 2, (z1 + z2) / 2]
      for (const s of [1, -1]) {
        // the deck's thickness, seen from the side
        B.trim.box(mx + nx * s * (w / 2), ym - 0.45, mz + nz * s * (w / 2), len, 0.9, 0.3, rot, CONCRETE)
        // the railing
        B.trim.box(mx + nx * s * (w / 2 - 0.1), ym + 0.55, mz + nz * s * (w / 2 - 0.1), len, 0.12, 0.12, rot, RAILING)
        B.trim.box(mx + nx * s * (w / 2 - 0.1), ym + 0.3, mz + nz * s * (w / 2 - 0.1), len, 0.5, 0.05, rot, CONCRETE)
      }
      // the underside
      B.trim.box(mx, ym - 0.85, mz, len, 0.1, w, rot, CONCRETE.clone().multiplyScalar(0.7))
      // a pillar every 30 m or so, down into the lagoon
      for (let d = Math.ceil(run / 30) * 30 - run; d < len; d += 30) {
        const t = d / len
        const h = ys[i - 1] + (ys[i] - ys[i - 1]) * t
        if (h < 1.5) continue
        const [px, pz] = [x1 + (x2 - x1) * t, z1 + (z2 - z1) * t]
        B.trim.box(px, (h - 0.9 - 4) / 2, pz, 1.4, h - 0.9 + 4, w * 0.7, rot, CONCRETE.clone().multiplyScalar(0.85))
      }
      run += len
    }
  }
  for (const r of [...chunk.roads].sort((a, b) => (RANK[a.cls] ?? 0) - (RANK[b.cls] ?? 0))) {
    const rank = RANK[r.cls] ?? 0
    const ys = r.bridge ? bridgeHeights(r.pts, chunk.box) : undefined
    if (r.paved) {
      // A pavement on each side of the bigger streets (and on bridges).
      if (rank >= 4 || ys) strip(pavement, r.pts, r.width + 3.2, 0.03, 2, ys)
      strip(asphalt, r.pts, r.width, 0.05 + rank * 0.002, 4, ys)
    } else strip(laterite, r.pts, r.width, 0.04, 3, ys)
    if (ys) bridge(r.pts, r.width + 3.2, ys)
  }

  const water = new Builder()
  const green = new Builder()
  const sand = new Builder()
  const pitch = new Builder()
  for (const a of chunk.areas) {
    const [to, y, scale] = a.kind === 'water' ? [water, 0.02, 4] : a.kind === 'green' || a.kind === 'campus' ? [green, a.kind === 'campus' ? 0.008 : 0.012, 2] : a.kind === 'sand' ? [sand, 0.014, 2] : a.kind === 'hospital' ? [pavement, 0.009, 2] : a.kind === 'apron' ? [pavement, 0.018, 3] : [pitch, 0.016, 2]
    to.flat(a.rings, y as number, scale as number)
  }

  // Runways and taxiways: wide asphalt and their white paint (the centre
  // line in dashes, the edges of a runway).
  const paint = new Builder()
  const along = (pts: XZ[], off: number) =>
    pts.map(([x, z], i) => {
      const [a, b] = [pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      return [x - ((b[1] - a[1]) / l) * off, z + ((b[0] - a[0]) / l) * off] as XZ
    })
  for (const w of chunk.aeroways) {
    const runway = w.cls === 'runway'
    strip(asphalt, w.pts, runway ? 45 : 20, runway ? 0.055 : 0.052, 4)
    if (runway) for (const off of [-20.5, 20.5]) strip(paint, along(w.pts, off), 0.9, 0.07, 4)
    // The centre line, in dashes.
    for (let i = 1; i < w.pts.length; i++) {
      const [a, b] = [w.pts[i - 1], w.pts[i]]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      const [dash, gap] = runway ? [30, 20] : [l, 0]
      for (let t = 0; t < l; t += dash + gap) {
        const e = Math.min(l, t + dash)
        strip(paint, [[a[0] + ((b[0] - a[0]) * t) / l, a[1] + ((b[1] - a[1]) * t) / l], [a[0] + ((b[0] - a[0]) * e) / l, a[1] + ((b[1] - a[1]) * e) / l]], runway ? 0.9 : 0.4, 0.07, 4)
      }
    }
  }

  // Foam where the water meets the land: the waves on the beaches and the
  // lagoon lapping at its banks. Not along the tile's edges, where the water
  // only goes on into the next chunk. (Far tiles are too far to see it.)
  const foam = new Builder()
  if (!chunk.key.includes(':')) {
    const b = chunk.box
    const onEdge = ([x, z]: XZ) => Math.min(Math.abs(x - b.x0), Math.abs(x - b.x1), Math.abs(z - b.z0), Math.abs(z - b.z1)) < 0.5
    for (const a of chunk.areas) {
      if (a.kind !== 'water') continue
      for (const ring of a.rings) {
        let along = 0
        for (let i = 0; i < ring.length; i++) {
          const [x1, z1] = ring[i]
          const [x2, z2] = ring[(i + 1) % ring.length]
          const len = Math.hypot(x2 - x1, z2 - z1)
          if (len < 0.01 || (onEdge(ring[i]) && onEdge(ring[(i + 1) % ring.length]))) continue
          const [nx, nz] = [(-(z2 - z1) / len) * 1.6, ((x2 - x1) / len) * 1.6]
          const up: [number, number, number] = [0, 1, 0]
          const p = [
            [x1 + nx, z1 + nz, along, 0],
            [x2 + nx, z2 + nz, along + len, 0],
            [x2 - nx, z2 - nz, along + len, 1],
            [x1 - nx, z1 - nz, along, 1],
          ].map(([x, z, u, v]) => foam.vertex(x, 0.035, z, u / 8, v, up))
          foam.quad(p[0], p[1], p[2], p[3])
          along += len
        }
      }
    }
  }

  return {
    walls: B.walls.geometry(),
    shop: B.shop.geometry(),
    inst: B.inst.geometry(),
    entrance: B.entrance.geometry(),
    house: B.house.geometry(),
    trim: B.trim.geometry(),
    roofs: B.roofs.geometry(),
    tin: B.tin.geometry(),
    contact: B.contact.geometry(),
    asphalt: asphalt.geometry(),
    laterite: laterite.geometry(),
    pavement: pavement.geometry(),
    water: water.geometry(),
    foam: foam.geometry(),
    paint: paint.geometry(),
    green: green.geometry(),
    sand: sand.geometry(),
    pitch: pitch.geometry(),
  }
}
