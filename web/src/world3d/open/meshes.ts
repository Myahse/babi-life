import * as THREE from 'three'
import type { ChunkData } from './tiles'
import { bridgeHeights, type XZ } from './geo'
import * as Three from 'three'

// One chunk's geometry, merged per material so a whole chunk is a handful
// of draw calls: walls, roofs, roads, pavements, water, grass, sand.

import { Builder } from './builder'
import { addBuilding, newBuildingBuilders, type Style } from './buildings'
import { BRIDGE_BUILD, bridgeKind, type BridgeKind } from './bridgeNames'

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
    // Round the corners where segments meet (not along a straight line).
    pts.forEach(([x, z], i) => {
      if (i > 0 && i < pts.length - 1) {
        const [a, b] = [pts[i - 1], pts[i + 1]]
        const turn = Math.abs(Math.atan2(b[1] - z, b[0] - x) - Math.atan2(z - a[1], x - a[0]))
        if (Math.min(turn, Math.PI * 2 - turn) < 0.03) return
      }
      const ring: XZ[] = [...Array(8)].map((_, k) => [x + Math.cos((k * Math.PI) / 4) * (w / 2), z + Math.sin((k * Math.PI) / 4) * (w / 2)])
      to.flat([ring], y + (ys ? ys[i] : 0), scale)
    })
  }
  // A bridge: its deck's edges, the railings, the girder under it and its
  // piers in the water, built the way that bridge is (bridgeNames.ts).
  const CONCRETE = new Three.Color('#b9b4aa')
  const OLD = new Three.Color('#a9a49a')
  const RAILING = new Three.Color('#e9ecef')
  const GALLERY = new Three.Color('#2c2a28')
  const bridge = (pts: XZ[], w: number, ys: number[], kind: BridgeKind | null) => {
    const how = BRIDGE_BUILD[kind ?? 'default']
    const stone = kind === 'fhb' ? OLD : CONCRETE
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
      // The girder, down to where it can go above the water (and the ramps).
      const g = Math.min(how.girder, ym - 0.4)
      for (const s of [1, -1]) {
        B.trim.box(mx + nx * s * (w / 2), ym - 0.45, mz + nz * s * (w / 2), len, 0.9, 0.3, rot, stone)
        // the railing
        B.trim.box(mx + nx * s * (w / 2 - 0.1), ym + 0.55, mz + nz * s * (w / 2 - 0.1), len, 0.12, 0.12, rot, RAILING)
        B.trim.box(mx + nx * s * (w / 2 - 0.1), ym + 0.3, mz + nz * s * (w / 2 - 0.1), len, 0.5, 0.05, rot, stone)
      }
      if (how.twin) {
        // Two box girders side by side, a gap between them (the HKB).
        for (const s of [1, -1]) B.trim.box(mx + nx * s * (w / 4), ym - 0.9 - g / 2, mz + nz * s * (w / 4), len, g, w / 2 - 1.4, rot, stone.clone().multiplyScalar(0.8))
      } else {
        B.trim.box(mx, ym - 0.9 - g / 2, mz, len, g, w - 0.6, rot, stone.clone().multiplyScalar(0.8))
        // The FHB's lower level: the railway runs in the girder, under the road.
        if (how.rail && g > 1.6) for (const s of [1, -1]) B.trim.box(mx + nx * s * (w / 2 - 0.25), ym - 0.9 - g / 2, mz + nz * s * (w / 2 - 0.25), len, g * 0.45, 0.1, rot, GALLERY)
      }
      // The piers, every span, down into the lagoon.
      for (let d = Math.ceil(run / how.span) * how.span - run; d < len; d += how.span) {
        const t = d / len
        const h = ys[i - 1] + (ys[i] - ys[i - 1]) * t - 0.9 - g
        if (h < 0.8) continue
        const [px, pz] = [x1 + (x2 - x1) * t, z1 + (z2 - z1) * t]
        const pier = stone.clone().multiplyScalar(0.85)
        const top = h
        const foot = -4
        if (how.pier === 'wall') B.trim.box(px, (top + foot) / 2, pz, 1.6, top - foot, w * 0.75, rot, pier)
        else {
          // A crosshead under the girders, on columns.
          B.trim.box(px, top - 0.7, pz, 2.2, 1.4, w * 0.9, rot, pier)
          const cols = how.pier === 'round' ? [0] : [-w / 4, w / 4]
          for (const o of cols) {
            const [cx, cz] = [px + nx * o, pz + nz * o]
            if (how.pier === 'twin-square') B.trim.box(cx, (top - 1.4 + foot) / 2, cz, 1.4, top - 1.4 - foot, 1.4, rot, pier)
            else B.trim.cylinder(cx, foot, cz, how.pier === 'round' ? 1.3 : 1, top - 1.4 - foot, pier)
          }
        }
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
    if (ys) bridge(r.pts, r.width + 3.2, ys, bridgeKind(r.name))
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
