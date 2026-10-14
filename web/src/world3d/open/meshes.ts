import * as THREE from 'three'
import type { ChunkData } from './tiles'
import type { XZ } from './geo'

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
    const [to, y, scale] = a.kind === 'water' ? [water, 0.02, 4] : a.kind === 'green' || a.kind === 'campus' ? [green, a.kind === 'campus' ? 0.008 : 0.012, 2] : a.kind === 'sand' ? [sand, 0.014, 2] : a.kind === 'hospital' ? [pavement, 0.009, 2] : [pitch, 0.016, 2]
    to.flat(a.rings, y as number, scale as number)
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
    green: green.geometry(),
    sand: sand.geometry(),
    pitch: pitch.geometry(),
  }
}
