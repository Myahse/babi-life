import { VectorTile, classifyRings } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import type { Poi } from './poiMatch'
import { CHUNK_ZOOM, centroid, clipLine, clipRing, hash, pointInRing, tileBox, tilePoint, toLocal, type Box, type Origin, type XZ } from './geo'
import { blockRing } from './voxel'
import { fillQuarters } from './fill'

// A chunk of the open world: one map tile of real Abidjan (OpenStreetMap data
// served by Mapbox), turned into game metres. Roads keep their class (a
// boulevard is wider than a back street), buildings their outline and
// height, rounded to whole 3 m blocks like in Minecraft.

export type Road = { cls: string; pts: XZ[]; width: number; paved: boolean; bridge: boolean; /** a bridge's name on the map */ name?: string }
/** An airport's runway or taxiway (not a street: nobody walks there). */
export type Aeroway = { cls: 'runway' | 'taxiway'; pts: XZ[] }
export type Building = { ring: XZ[]; holes: XZ[][]; height: number; c: XZ; tint: number; /** a house the game built (fill.ts): under tin */ tin?: boolean }
export type Area = { kind: 'water' | 'green' | 'sand' | 'pitch' | 'campus' | 'hospital' | 'apron'; rings: XZ[][] }
export type ChunkData = { key: string; tx: number; ty: number; box: Box; roads: Road[]; buildings: Building[]; areas: Area[]; trees: XZ[]; palms: XZ[]; aeroways: Aeroway[]; pois: Poi[]; /** big rainforest trees, close together (the Banco) */ forest?: XZ[] }

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
  if (!token) return fetchOpenChunk(o, tx, ty, signal, z)
  const res = await fetch(tileUrl(token, tx, ty, z), { signal })
  if (res.status === 404) return emptyChunk(o, tx, ty, z) // nothing mapped there (open sea)
  if (!res.ok) throw new Error(`tile ${tx}/${ty}: ${res.status}`)
  return decodeChunk(o, tx, ty, new Uint8Array(await res.arrayBuffer()), z)
}

function emptyChunk(o: Origin, tx: number, ty: number, z = CHUNK_ZOOM): ChunkData {
  return { key: z === CHUNK_ZOOM ? `${tx}/${ty}` : `${z}:${tx}/${ty}`, tx, ty, box: tileBox(o, tx, ty, z), roads: [], buildings: [], areas: [], trees: [], palms: [], aeroways: [], pois: [], forest: [] }
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

  const neighbours: XZ[][] = []
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
      if (c[0] < box.x0 || c[0] >= box.x1 || c[1] < box.z0 || c[1] >= box.z1) {
        if (c[0] > box.x0 - 40 && c[0] < box.x1 + 40 && c[1] > box.z0 - 40 && c[1] < box.z1 + 40) neighbours.push(ring)
        continue
      }
      const h = Number(f.properties.height) || 0
      const height = Math.max(BLOCK, Math.round((h || BLOCK * (1 + Math.floor(hash(c[0], c[1]) * 3))) / BLOCK) * BLOCK)
      // In blocks, like Minecraft: the outline laid on the world's grid (voxel.ts).
      chunk.buildings.push({ ring: blockRing(open(ring), poly.slice(1).map((r) => open(r.map(xz))), c), holes: [], height, c, tint: hash(c[1], c[0]) })
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

  if (!far) fillQuarters(chunk, neighbours)
  plant(chunk, far)
  return chunk
}

/** Trees in the green, palms on the beaches, the forest where there's forest. */
function plant(chunk: ChunkData, far: boolean, forests: XZ[][][] = []) {
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
  // The forest: big trees every few metres, a little off the grid, none in
  // the water, on a road or in a building.
  const planted = new Set<string>()
  if (!far)
    for (const rings of forests) {
      const ring = rings[0]
      let [minX, minZ, maxX, maxZ] = [Infinity, Infinity, -Infinity, -Infinity]
      for (const [x, zz] of ring) [minX, minZ, maxX, maxZ] = [Math.min(minX, x), Math.min(minZ, zz), Math.max(maxX, x), Math.max(maxZ, zz)]
      const step = FOREST_STEP
      for (let gx = Math.floor(minX / step) * step; gx < maxX; gx += step)
        for (let gz = Math.floor(minZ / step) * step; gz < maxZ; gz += step) {
          const p: XZ = [gx + (hash(gx, gz, 7) - 0.5) * step * 0.8, gz + (hash(gz, gx, 9) - 0.5) * step * 0.8]
          const key = `${gx},${gz}`
          if (planted.has(key)) continue
          if (!pointInRing(p, ring) || rings.slice(1).some((h) => pointInRing(p, h))) continue
          if (chunk.areas.some((w) => w.kind === 'water' && pointInRing(p, w.rings[0]))) continue
          if (nearRoad(chunk.roads, p, 4)) continue
          if (chunk.buildings.some((b) => Math.abs(b.c[0] - p[0]) < 30 && Math.abs(b.c[1] - p[1]) < 30 && pointInRing(p, b.ring))) continue
          planted.add(key)
          chunk.forest!.push(p)
        }
    }
}

/** Metres between two trees of the forest. */
const FOREST_STEP = 7

function nearRoad(roads: Road[], [x, z]: XZ, margin: number) {
  for (const r of roads)
    for (let i = 1; i < r.pts.length; i++) {
      const [ax, az] = r.pts[i - 1]
      const [bx, bz] = r.pts[i]
      if (Math.min(ax, bx) - r.width > x || Math.max(ax, bx) + r.width < x || Math.min(az, bz) - r.width > z || Math.max(az, bz) + r.width < z) continue
      const l2 = (bx - ax) ** 2 + (bz - az) ** 2
      const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2)) : 0
      if (Math.hypot(ax + (bx - ax) * t - x, az + (bz - az) * t - z) < r.width / 2 + margin) return true
    }
  return false
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

// ---------------------------------------------------------------------------
// Without a Mapbox token: the same OpenStreetMap data from OpenFreeMap, free
// and keyless, in the OpenMapTiles schema. Its tiles stop at zoom 14 with all
// the detail in them, so a chunk (zoom 16) is cut out of the zoom-14 tile
// holding it; one tile feeds sixteen chunks, so the decoded tiles are kept.

const OFM_TILEJSON = 'https://tiles.openfreemap.org/planet'
const OFM_ZOOM = 14
let ofmTiles: Promise<string> | null = null
const ofmCache = new Map<string, Promise<VectorTile | null>>()

function ofmTile(tx: number, ty: number, signal?: AbortSignal): Promise<VectorTile | null> {
  const key = `${tx}/${ty}`
  let p = ofmCache.get(key)
  if (!p) {
    ofmTiles ??= fetch(OFM_TILEJSON)
      .then((r) => r.json())
      .then((j: { tiles: string[] }) => j.tiles[0])
    p = ofmTiles
      .then((tpl) => fetch(tpl.replace('{z}', String(OFM_ZOOM)).replace('{x}', String(tx)).replace('{y}', String(ty)), { signal }))
      .then(async (res) => {
        if (res.status === 404 || res.status === 204) return null
        if (!res.ok) throw new Error(`tile ${tx}/${ty}: ${res.status}`)
        return new VectorTile(new Pbf(new Uint8Array(await res.arrayBuffer())))
      })
    p.catch(() => ofmCache.delete(key))
    ofmCache.set(key, p)
    // Keep the last few dozen tiles (a walk around the quarter and its horizon).
    if (ofmCache.size > 40) ofmCache.delete(ofmCache.keys().next().value!)
  }
  return p
}

async function fetchOpenChunk(o: Origin, tx: number, ty: number, signal?: AbortSignal, z = CHUNK_ZOOM): Promise<ChunkData> {
  const k = 2 ** Math.max(0, z - OFM_ZOOM)
  const [ptx, pty] = [Math.floor(tx / k), Math.floor(ty / k)]
  const tile = await ofmTile(ptx, pty, signal)
  if (!tile) return emptyChunk(o, tx, ty, z)
  return decodeOpenChunk(o, tx, ty, z, tile, ptx, pty)
}

/** OpenMapTiles road classes to the game's (Mapbox's) ones. */
const OMT_ROAD: Record<string, string> = {
  motorway: 'motorway', trunk: 'trunk', primary: 'primary', secondary: 'secondary', tertiary: 'tertiary',
  minor: 'street', service: 'service', track: 'track', path: 'path', busway: 'street', raceway: 'service',
}
/** Map icons by OpenMapTiles subclass, where the class alone says too little. */
const OMT_MAKI: Record<string, string> = {
  marketplace: 'marketplace', nightclub: 'nightclub', bus_station: 'bus', stadium: 'stadium', pitch: 'pitch',
  swimming_pool: 'swimming', theatre: 'theatre', cinema: 'cinema', museum: 'museum', university: 'college', college: 'college',
}
const OMT_GREEN = new Set(['grass', 'farmland', 'wetland', 'park', 'garden', 'cemetery', 'playground', 'recreation_ground', 'golf_course', 'village_green', 'allotments', 'meadow', 'scrub'])
const OMT_FOREST = new Set(['wood', 'forest', 'national_park', 'nature_reserve'])

function decodeOpenChunk(o: Origin, tx: number, ty: number, z: number, tile: VectorTile, ptx: number, pty: number): ChunkData {
  const chunk = emptyChunk(o, tx, ty, z)
  const box = chunk.box
  const far = z !== CHUNK_ZOOM
  const toXZ = (extent: number) => (p: { x: number; y: number }): XZ => {
    const ll = tilePoint(ptx, pty, OFM_ZOOM, p.x, p.y, extent)
    return toLocal(o, ll.lat, ll.lng)
  }
  const inBox = ([x, zz]: XZ) => x >= box.x0 && x < box.x1 && zz >= box.z0 && zz < box.z1

  // Street names, for the big bridges (the road layer has no names here).
  const names: { name: string; pts: XZ[] }[] = []
  const nl = tile.layers.transportation_name
  for (let i = 0; i < (nl?.length ?? 0); i++) {
    const f = nl!.feature(i)
    const name = String(f.properties['name:fr'] ?? f.properties.name ?? '')
    if (f.type !== 2 || !name) continue
    const xz = toXZ(f.extent)
    for (const line of f.loadGeometry()) names.push({ name, pts: line.map(xz) })
  }
  const nameNear = (pts: XZ[]) => {
    const m = pts[Math.floor(pts.length / 2)]
    let best: { name: string; d: number } | null = null
    for (const n of names)
      for (const p of n.pts) {
        const d = Math.hypot(p[0] - m[0], p[1] - m[1])
        if (d < 60 && (!best || d < best.d)) best = { name: n.name, d }
      }
    return best?.name
  }

  const roads = tile.layers.transportation
  for (let i = 0; i < (roads?.length ?? 0); i++) {
    const f = roads!.feature(i)
    if (f.type !== 2 || f.properties.brunnel === 'tunnel') continue
    let cls = OMT_ROAD[String(f.properties.class ?? '')]
    if (!cls) continue
    if (f.properties.ramp === 1 && ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'].includes(cls)) cls += '_link'
    const width = ROAD_WIDTH[cls]
    const bridge = f.properties.brunnel === 'bridge'
    if (far && !FAR_ROADS.has(cls) && !bridge) continue
    const xz = toXZ(f.extent)
    for (const line of f.loadGeometry()) {
      const all = line.map(xz)
      for (let pts of clipLine(all, box)) {
        if (bridge) pts = densify(pts, 10)
        const surface = String(f.properties.surface ?? '')
        chunk.roads.push({ cls, pts, width, paved: !UNPAVED.has(cls) && surface !== 'unpaved', bridge, name: bridge ? nameNear(all) : undefined })
      }
    }
  }

  const pois = tile.layers.poi
  for (let i = 0; i < (pois?.length ?? 0); i++) {
    const f = pois!.feature(i)
    const name = String(f.properties['name:fr'] ?? f.properties.name ?? '')
    if (f.type !== 1 || !name) continue
    const cls = String(f.properties.class ?? '')
    const sub = String(f.properties.subclass ?? '')
    const xz = toXZ(f.extent)
    for (const pts of f.loadGeometry())
      for (const p of pts) {
        const at = xz(p)
        if (inBox(at)) chunk.pois.push({ name, cls, maki: OMT_MAKI[sub] ?? cls.replace(/_/g, '-'), type: sub, at })
      }
  }

  const aeroway = tile.layers.aeroway
  for (let i = 0; i < (aeroway?.length ?? 0); i++) {
    const f = aeroway!.feature(i)
    const cls = String(f.properties.class ?? '')
    const xz = toXZ(f.extent)
    if (f.type === 2 && (cls === 'runway' || cls === 'taxiway') && !(far && cls !== 'runway')) {
      for (const line of f.loadGeometry()) for (const pts of clipLine(line.map(xz), box)) chunk.aeroways.push({ cls, pts })
    } else if (f.type === 3 && ['apron', 'runway', 'taxiway'].includes(cls)) {
      for (const poly of classifyRings(f.loadGeometry())) {
        const rings = poly.map((r) => clipRing(open(r.map(xz)), box)).filter((r) => r.length >= 3)
        if (rings.length && rings[0].length >= 3) chunk.areas.push({ kind: 'apron', rings })
      }
    }
  }

  const neighbours: XZ[][] = []
  const buildings = far ? undefined : tile.layers.building
  for (let i = 0; i < (buildings?.length ?? 0); i++) {
    const f = buildings!.feature(i)
    if (f.type !== 3) continue
    const xz = toXZ(f.extent)
    const h = Number(f.properties.render_height) || 0
    const base = Number(f.properties.render_min_height) || 0
    if (base > 0 && h - base < BLOCK) continue // a canopy or an upper floor alone
    for (const poly of classifyRings(f.loadGeometry())) {
      const ring = open(poly[0].map(xz))
      if (ring.length < 3) continue
      const c = centroid(ring)
      if (!inBox(c)) {
        if (c[0] > box.x0 - 40 && c[0] < box.x1 + 40 && c[1] > box.z0 - 40 && c[1] < box.z1 + 40) neighbours.push(ring)
        continue
      }
      // OpenMapTiles gives 5 m to a building with no height: the game's own guess instead.
      const height = Math.max(BLOCK, Math.round((h && h !== 5 ? h : BLOCK * (1 + Math.floor(hash(c[0], c[1]) * 3))) / BLOCK) * BLOCK)
      chunk.buildings.push({ ring: blockRing(ring, poly.slice(1).map((r) => open(r.map(xz))), c), holes: [], height, c, tint: hash(c[1], c[0]) })
    }
  }

  const forests: XZ[][][] = []
  const areas = (layer: string, kindOf: (cls: string, sub: string) => Area['kind'] | 'forest' | null) => {
    const l = tile.layers[layer]
    for (let i = 0; i < (l?.length ?? 0); i++) {
      const f = l!.feature(i)
      if (f.type !== 3) continue
      const kind = kindOf(String(f.properties.class ?? ''), String(f.properties.subclass ?? ''))
      if (!kind) continue
      const xz = toXZ(f.extent)
      for (const poly of classifyRings(f.loadGeometry())) {
        const rings = poly.map((r) => clipRing(open(r.map(xz)), box)).filter((r) => r.length >= 3)
        if (!rings.length || rings[0].length < 3) continue
        if (kind === 'forest') {
          forests.push(rings)
          chunk.areas.push({ kind: 'green', rings })
        } else chunk.areas.push({ kind, rings })
      }
    }
  }
  areas('water', () => 'water')
  areas('landcover', (cls, sub) => (OMT_FOREST.has(cls) || OMT_FOREST.has(sub) ? 'forest' : cls === 'sand' || sub === 'beach' ? 'sand' : OMT_GREEN.has(cls) || OMT_GREEN.has(sub) ? 'green' : null))
  areas('park', (cls) => (OMT_FOREST.has(cls) ? 'forest' : cls === 'park' ? 'green' : null))
  areas('landuse', (cls) => (cls === 'pitch' || cls === 'stadium' ? 'pitch' : ['school', 'university', 'college', 'kindergarten'].includes(cls) ? 'campus' : cls === 'hospital' ? 'hospital' : OMT_GREEN.has(cls) ? 'green' : null))
  if (!far) fillQuarters(chunk, neighbours)
  plant(chunk, far, forests)
  return chunk
}
