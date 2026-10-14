import { VectorTile, classifyRings } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import type { Poi } from './poiMatch'
import { CHUNK_ZOOM, centroid, clipLine, clipRing, hash, pointInRing, tileBox, tilePoint, toLocal, type Box, type Origin, type XZ } from './geo'

// A chunk of the open world: one map tile of real Abidjan (OpenStreetMap data
// served by Mapbox), turned into game metres. Roads keep their class (a
// boulevard is wider than a back street), buildings their outline and
// height, rounded to whole 3 m blocks like in Minecraft.

export type Road = { cls: string; pts: XZ[]; width: number; paved: boolean; bridge: boolean; /** a bridge's name on the map */ name?: string }
/** An airport's runway or taxiway (not a street: nobody walks there). */
export type Aeroway = { cls: 'runway' | 'taxiway'; pts: XZ[] }
export type Building = { ring: XZ[]; holes: XZ[][]; height: number; c: XZ; tint: number }
export type Area = { kind: 'water' | 'green' | 'sand' | 'pitch' | 'campus' | 'hospital' | 'apron'; rings: XZ[][] }
export type ChunkData = { key: string; tx: number; ty: number; box: Box; roads: Road[]; buildings: Building[]; areas: Area[]; trees: XZ[]; palms: XZ[]; aeroways: Aeroway[]; pois: Poi[] }

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

/** The far horizon: bigger, plainer tiles (water, beaches, the big roads and bridges). */
export const FAR_ZOOM = 14
const FAR_ROADS = new Set(['motorway', 'trunk', 'primary', 'secondary'])

export async function fetchChunk(o: Origin, tx: number, ty: number, token: string, signal?: AbortSignal, z = CHUNK_ZOOM): Promise<ChunkData> {
  const res = await fetch(tileUrl(token, tx, ty, z), { signal })
  if (res.status === 404) return emptyChunk(o, tx, ty, z) // nothing mapped there (open sea)
  if (!res.ok) throw new Error(`tile ${tx}/${ty}: ${res.status}`)
  return decodeChunk(o, tx, ty, new Uint8Array(await res.arrayBuffer()), z)
}

function emptyChunk(o: Origin, tx: number, ty: number, z = CHUNK_ZOOM): ChunkData {
  return { key: z === CHUNK_ZOOM ? `${tx}/${ty}` : `${z}:${tx}/${ty}`, tx, ty, box: tileBox(o, tx, ty, z), roads: [], buildings: [], areas: [], trees: [], palms: [], aeroways: [], pois: [] }
}

export function decodeChunk(o: Origin, tx: number, ty: number, data: Uint8Array, z = CHUNK_ZOOM): ChunkData {
  const tile = new VectorTile(new Pbf(data))
  const chunk = emptyChunk(o, tx, ty, z)
  const box = chunk.box
  const far = z !== CHUNK_ZOOM

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
    if (far && !FAR_ROADS.has(cls) && f.properties.structure !== 'bridge') continue
    const xz = toXZ(f.extent)
    for (const line of f.loadGeometry()) {
      for (let pts of clipLine(line.map(xz), box)) {
        const bridge = f.properties.structure === 'bridge'
        // A bridge drawn as its two ends gets points along it, so its deck
        // can climb from the banks and stay up over the water.
        if (bridge) pts = densify(pts, 10)
        chunk.roads.push({ cls, pts, width, paved: !UNPAVED.has(cls) && f.properties.surface !== 'unpaved', bridge, name: bridge && f.properties.name ? String(f.properties.name) : undefined })
      }
    }
  }

  // The points of interest, with their name: where the game's real places are.
  const pois = tile.layers.poi_label
  for (let i = 0; i < (pois?.length ?? 0); i++) {
    const f = pois!.feature(i)
    const name = String(f.properties.name_fr ?? f.properties.name ?? '')
    if (f.type !== 1 || !name) continue
    const xz = toXZ(f.extent)
    for (const pts of f.loadGeometry())
      for (const p of pts) {
        const at = xz(p)
        if (at[0] < box.x0 || at[0] >= box.x1 || at[1] < box.z0 || at[1] >= box.z1) continue
        chunk.pois.push({ name, cls: String(f.properties.class ?? ''), maki: String(f.properties.maki ?? ''), type: String(f.properties.type ?? ''), at })
      }
  }

  // The airport: runways and taxiways are lines, aprons are areas.
  const aeroway = tile.layers.aeroway
  for (let i = 0; i < (aeroway?.length ?? 0); i++) {
    const f = aeroway!.feature(i)
    const type = String(f.properties.type ?? '')
    if (f.type !== 2 || (type !== 'runway' && type !== 'taxiway') || (far && type !== 'runway')) continue
    const xz = toXZ(f.extent)
    for (const line of f.loadGeometry()) for (const pts of clipLine(line.map(xz), box)) chunk.aeroways.push({ cls: type, pts })
  }

  const buildings = far ? undefined : tile.layers.building
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
  if (tile.layers.aeroway) {
    const l = tile.layers.aeroway
    for (let i = 0; i < l.length; i++) {
      const f = l.feature(i)
      if (f.type !== 3 || !['apron', 'runway', 'taxiway'].includes(String(f.properties.type))) continue
      const xz = toXZ(f.extent)
      for (const poly of classifyRings(f.loadGeometry())) {
        const rings = poly.map((r) => clipRing(open(r.map(xz)), box)).filter((r) => r.length >= 3)
        if (rings.length && rings[0].length >= 3) chunk.areas.push({ kind: 'apron', rings })
      }
    }
  }
  areas('landuse_overlay', (cls) => (cls.startsWith('wetland') ? 'green' : null))

  // Trees in the parks and gardens, a few per block of green.
  for (const a of far ? [] : chunk.areas) {
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
  // Coconut palms along the beaches, scattered, never in the water.
  for (const a of far ? [] : chunk.areas) {
    if (a.kind !== 'sand') continue
    const ring = a.rings[0]
    let [minX, minZ, maxX, maxZ] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, zz] of ring) [minX, minZ, maxX, maxZ] = [Math.min(minX, x), Math.min(minZ, zz), Math.max(maxX, x), Math.max(maxZ, zz)]
    const n = Math.min(80, Math.floor(((maxX - minX) * (maxZ - minZ)) / 260))
    for (let k = 0; k < n; k++) {
      const p: XZ = [minX + hash(k, minX, 3) * (maxX - minX), minZ + hash(minZ, k, 5) * (maxZ - minZ)]
      if (pointInRing(p, ring) && !chunk.areas.some((w) => w.kind === 'water' && pointInRing(p, w.rings[0]))) chunk.palms.push(p)
    }
  }
  return chunk
}

/** A line with extra points so no stretch is longer than `step` metres. */
function densify(pts: XZ[], step: number): XZ[] {
  const out: XZ[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]]
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  }
  return out
}

/** Rings come closed (last point = first); the game wants them open. */
function open(r: XZ[]): XZ[] {
  const [a, b] = [r[0], r[r.length - 1]]
  return r.length > 1 && a[0] === b[0] && a[1] === b[1] ? r.slice(0, -1) : r
}
