import { VectorTile, classifyRings } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import { CHUNK_ZOOM, centroid, clipLine, clipRing, hash, pointInRing, tileBox, tilePoint, toLocal, type Box, type Origin, type XZ } from './geo'

// A chunk of the open world: one map tile of real Abidjan (OpenStreetMap data
// served by Mapbox), turned into game metres. Roads keep their class (a
// boulevard is wider than a back street), buildings their outline and
// height, rounded to whole 3 m blocks like in Minecraft.

export type Road = { cls: string; pts: XZ[]; width: number; paved: boolean; bridge: boolean }
export type Building = { ring: XZ[]; holes: XZ[][]; height: number; c: XZ; tint: number }
export type Area = { kind: 'water' | 'green' | 'sand' | 'pitch' | 'campus' | 'hospital'; rings: XZ[][] }
export type ChunkData = { key: string; tx: number; ty: number; box: Box; roads: Road[]; buildings: Building[]; areas: Area[]; trees: XZ[] }

export const BLOCK = 3 // metres: one storey, one block

const ROAD_WIDTH: Record<string, number> = {
  motorway: 16, motorway_link: 8, trunk: 14, trunk_link: 8, primary: 12, primary_link: 7, secondary: 10, secondary_link: 6,
  tertiary: 9, tertiary_link: 6, street: 7, street_limited: 6, pedestrian: 4, service: 4.5, track: 4, path: 2.2, construction: 5,
}
const UNPAVED = new Set(['track', 'path'])

const GREEN = new Set(['park', 'grass', 'wood', 'scrub', 'agriculture', 'cemetery', 'garden', 'golf_course', 'wetland', 'wetland_noveg'])
const SAND = new Set(['sand', 'beach'])

export function tileUrl(token: string, tx: number, ty: number, z = CHUNK_ZOOM) {
  return `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${z}/${tx}/${ty}.vector.pbf?access_token=${encodeURIComponent(token)}`
}

export async function fetchChunk(o: Origin, tx: number, ty: number, token: string, signal?: AbortSignal): Promise<ChunkData> {
  const res = await fetch(tileUrl(token, tx, ty), { signal })
  if (res.status === 404) return emptyChunk(o, tx, ty) // nothing mapped there (open sea)
  if (!res.ok) throw new Error(`tile ${tx}/${ty}: ${res.status}`)
  return decodeChunk(o, tx, ty, new Uint8Array(await res.arrayBuffer()))
}

function emptyChunk(o: Origin, tx: number, ty: number): ChunkData {
  return { key: `${tx}/${ty}`, tx, ty, box: tileBox(o, tx, ty), roads: [], buildings: [], areas: [], trees: [] }
}

export function decodeChunk(o: Origin, tx: number, ty: number, data: Uint8Array): ChunkData {
  const tile = new VectorTile(new Pbf(data))
  const chunk = emptyChunk(o, tx, ty)
  const box = chunk.box
  const z = CHUNK_ZOOM

  const toXZ = (extent: number) => (p: { x: number; y: number }): XZ => {
    const ll = tilePoint(tx, ty, z, p.x, p.y, extent)
    return toLocal(o, ll.lat, ll.lng)
  }

  const roads = tile.layers.road
  for (let i = 0; i < (roads?.length ?? 0); i++) {
    const f = roads!.feature(i)
    if (f.type !== 2) continue
    const cls = String(f.properties.class ?? '')
    const width = ROAD_WIDTH[cls]
    if (!width || f.properties.structure === 'tunnel') continue
    const xz = toXZ(f.extent)
    for (const line of f.loadGeometry()) {
      for (const pts of clipLine(line.map(xz), box)) {
        chunk.roads.push({ cls, pts, width, paved: !UNPAVED.has(cls) && f.properties.surface !== 'unpaved', bridge: f.properties.structure === 'bridge' })
      }
    }
  }

  const buildings = tile.layers.building
  for (let i = 0; i < (buildings?.length ?? 0); i++) {
    const f = buildings!.feature(i)
    if (f.type !== 3 || f.properties.underground === 'true') continue
    const xz = toXZ(f.extent)
    for (const poly of classifyRings(f.loadGeometry())) {
      const ring = poly[0].map(xz)
      if (ring.length < 4) continue
      const c = centroid(ring)
      // A building crossing two chunks belongs to the one holding its centre.
      if (c[0] < box.x0 || c[0] >= box.x1 || c[1] < box.z0 || c[1] >= box.z1) continue
      const h = Number(f.properties.height) || 0
      const height = Math.max(BLOCK, Math.round((h || BLOCK * (1 + Math.floor(hash(c[0], c[1]) * 3))) / BLOCK) * BLOCK)
      chunk.buildings.push({ ring: open(ring), holes: poly.slice(1).map((r) => open(r.map(xz))), height, c, tint: hash(c[1], c[0]) })
    }
  }

  const areas = (layer: string, kindOf: (cls: string) => Area['kind'] | null) => {
    const l = tile.layers[layer]
    for (let i = 0; i < (l?.length ?? 0); i++) {
      const f = l!.feature(i)
      if (f.type !== 3) continue
      const kind = kindOf(String(f.properties.class ?? ''))
      if (!kind) continue
      const xz = toXZ(f.extent)
      for (const poly of classifyRings(f.loadGeometry())) {
        const rings = poly.map((r) => clipRing(open(r.map(xz)), box)).filter((r) => r.length >= 3)
        if (rings.length && rings[0].length >= 3) chunk.areas.push({ kind, rings })
      }
    }
  }
  areas('water', () => 'water')
  // Schools and universities, hospitals: their grounds, as the map draws them.
  areas('landuse', (cls) => (GREEN.has(cls) ? 'green' : SAND.has(cls) ? 'sand' : cls === 'pitch' ? 'pitch' : cls === 'school' ? 'campus' : cls === 'hospital' ? 'hospital' : null))
  areas('landuse_overlay', (cls) => (cls.startsWith('wetland') ? 'green' : null))

  // Trees in the parks and gardens, a few per block of green.
  for (const a of chunk.areas) {
    if (a.kind !== 'green' && a.kind !== 'campus') continue
    const ring = a.rings[0]
    let [minX, minZ, maxX, maxZ] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, zz] of ring) [minX, minZ, maxX, maxZ] = [Math.min(minX, x), Math.min(minZ, zz), Math.max(maxX, x), Math.max(maxZ, zz)]
    const n = Math.min(60, Math.floor(((maxX - minX) * (maxZ - minZ)) / (a.kind === 'campus' ? 900 : 500)))
    for (let k = 0; k < n; k++) {
      const p: XZ = [minX + hash(k, minX) * (maxX - minX), minZ + hash(minZ, k) * (maxZ - minZ)]
      // Not inside a building (a campus is full of them).
      if (pointInRing(p, ring) && !chunk.buildings.some((b) => Math.abs(b.c[0] - p[0]) < 40 && Math.abs(b.c[1] - p[1]) < 40 && pointInRing(p, b.ring))) chunk.trees.push(p)
    }
  }
  return chunk
}

/** Rings come closed (last point = first); the game wants them open. */
function open(r: XZ[]): XZ[] {
  const [a, b] = [r[0], r[r.length - 1]]
  return r.length > 1 && a[0] === b[0] && a[1] === b[1] ? r.slice(0, -1) : r
}
