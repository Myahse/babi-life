import { VectorTile, classifyRings } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import type { Poi } from './poiMatch'
import { CHUNK_ZOOM, centroid, clipLine, clipRing, hash, pointInRing, tileBox, tilePoint, toLocal, type Box, type Origin, type XZ } from './geo'
import { blockRing } from './voxel'
import { fillQuarters } from './fill'
import { bigBridgeName, bridgeKind } from './bridgeNames'

// A chunk of the open world: one map tile of real Abidjan (OpenStreetMap data
// served by Mapbox), turned into game metres. Roads keep their class (a
// boulevard is wider than a back street), buildings their outline and
// height, rounded to whole 3 m blocks like in Minecraft.

export type Road = { cls: string; pts: XZ[]; width: number; paved: boolean; bridge: boolean; /** a bridge's name on the map */ name?: string }
/** An airport's runway or taxiway (not a street: nobody walks there). */
export type Aeroway = { cls: 'runway' | 'taxiway'; pts: XZ[] }
export type Building = { ring: XZ[]; holes: XZ[][]; height: number; c: XZ; tint: number; /** a house the game built (fill.ts): under tin */ tin?: boolean }
export type Area = { kind: 'water' | 'green' | 'sand' | 'pitch' | 'campus' | 'hospital' | 'apron'; rings: XZ[][] }
export type ChunkData = { key: string; tx: number; ty: number; box: Box; roads: Road[]; buildings: Building[]; areas: Area[]; trees: XZ[]; palms: XZ[]; aeroways: Aeroway[]; pois: Poi[]; /** big rainforest trees, close together (the Banco) */ forest?: XZ[]; /** fuel stations, laid out by their street */ stations?: Station[] }
/** A fuel station: its canopy's middle by the street, the street's direction, which side of it, its name. */
export type Station = { at: XZ; angle: number; side: 1 | -1; name: string; /** room for the game's shop behind (else a map building stands there) */ shop: boolean }

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
        chunk.roads.push({ cls, pts, width, paved: !UNPAVED.has(cls) && f.properties.surface !== 'unpaved', bridge, name: bridge && f.properties.name ? bigBridgeName(String(f.properties.name), lineLength(line.map(xz))) : undefined })
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

  nameTwins(chunk)
  dropOverRoads(chunk)
  dropOverlaps(chunk)
  trimPaths(chunk)
  if (!far) fillQuarters(chunk, neighbours, layStations(chunk))
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

/**
 * A big bridge drawn as two roadways often has a name on one only, and the
 * map may name only part of a long deck: an unnamed bridge piece running
 * alongside a named big bridge (within 45 m, the same way), or carrying on
 * from its end, is the same bridge.
 */
function nameTwins(chunk: ChunkData) {
  nameLines(chunk.roads)
}

/** The same, on any lines (a whole tile's bridges, before they're cut into chunks). */
function nameLines(roads: { pts: XZ[]; name?: string; cls: string; bridge: boolean }[]) {
  const dir = (pts: XZ[]) => Math.atan2(pts[pts.length - 1][1] - pts[0][1], pts[pts.length - 1][0] - pts[0][0])
  const same = (a: XZ[], b: XZ[]) => Math.abs(Math.sin(dir(a) - dir(b))) < 0.3
  // Alongside (the other roadway), or end to end (the rest of the deck the
  // map left unnamed): again until nothing changes, the name runs along.
  for (let pass = 0; pass < 6; pass++) {
    const big = roads.filter((r) => r.bridge && bridgeKind(r.name))
    if (!big.length) return
    let changed = false
    for (const r of roads) {
      if (!r.bridge || bridgeKind(r.name) || r.cls === 'path' || lineLength(r.pts) < 30) continue
      const m = r.pts[Math.floor(r.pts.length / 2)]
      const ends = [r.pts[0], r.pts[r.pts.length - 1]]
      for (const b of big) {
        const beside = b.pts.some((p) => Math.hypot(p[0] - m[0], p[1] - m[1]) < 45)
        const bEnds = [b.pts[0], b.pts[b.pts.length - 1]]
        // End to end, or across a short gap the map didn't mark as bridge,
        // as long as the gap runs the same way as the deck.
        const touching = ends.some((e) =>
          bEnds.some((f) => {
            const d = Math.hypot(e[0] - f[0], e[1] - f[1])
            return d < 15 || (d < 160 && Math.abs(Math.sin(Math.atan2(e[1] - f[1], e[0] - f[0]) - dir(b.pts))) < 0.2)
          }),
        )
        if ((beside || touching) && same(r.pts, b.pts)) {
          r.name = b.name
          changed = true
          break
        }
      }
    }
    if (!changed) return
  }
}

/**
 * Where the toll plazas go (bridges.tsx puts one at each big bridge's toll
 * booth on the map): kept clear of the game's houses, from the whole tile
 * so a plaza on a chunk's edge is clear on both sides. The 3e pont's is 21
 * lanes wide, the 4e pont's smaller.
 */
function tollGrounds(tile: VectorTile, toXZ: (extent: number) => (p: { x: number; y: number }) => XZ) {
  const out: { at: XZ; r: number }[] = []
  const l = tile.layers.poi
  for (let i = 0; i < (l?.length ?? 0); i++) {
    const f = l!.feature(i)
    const n = String(f.properties['name:fr'] ?? f.properties.name ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
    if (!/peage|toll/.test(n)) continue
    const r = /hkb|konan/.test(n) ? 48 : 28
    const xz = toXZ(f.extent)
    for (const pts of f.loadGeometry()) for (const p of pts) out.push({ at: xz(p), r })
  }
  return out
}

/**
 * Buildings a big road runs through aren't houses: the map draws toll
 * canopies, petrol-station roofs over a road, gantries as buildings. Drawn
 * as solid blocks they'd wall the road off; they're left out (the game
 * draws the toll plazas itself, bridges.tsx).
 */
const THROUGH = new Set(['motorway', 'trunk', 'primary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary'])
function dropOverRoads(chunk: ChunkData) {
  const big = chunk.roads.filter((r) => THROUGH.has(r.cls) && !r.bridge)
  if (!big.length) return
  chunk.buildings = chunk.buildings.filter((b) => {
    let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, z] of b.ring) [x0, z0, x1, z1] = [Math.min(x0, x), Math.min(z0, z), Math.max(x1, x), Math.max(z1, z)]
    for (const r of big)
      for (let i = 1; i < r.pts.length; i++) {
        const [ax, az] = r.pts[i - 1]
        const [bx, bz] = r.pts[i]
        if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1 || Math.max(az, bz) < z0 || Math.min(az, bz) > z1) continue
        const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 3)
        for (let k = 0; k <= n; k++) if (pointInRing([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n], b.ring)) return false
      }
    return true
  })
}

function ringArea(ring: XZ[]) {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i]
    const [x2, z2] = ring[(i + 1) % ring.length]
    a += x1 * z2 - x2 * z1
  }
  return Math.abs(a / 2)
}

/** The buildings of a chunk, by 24 m cell, for quick neighbourhood checks. */
function buildingGrid(buildings: Building[]) {
  const grid = new Map<string, Building[]>()
  for (const b of buildings) {
    let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, z] of b.ring) [x0, z0, x1, z1] = [Math.min(x0, x), Math.min(z0, z), Math.max(x1, x), Math.max(z1, z)]
    for (let i = Math.floor(x0 / 24); i <= Math.floor(x1 / 24); i++)
      for (let j = Math.floor(z0 / 24); j <= Math.floor(z1 / 24); j++) {
        const k = `${i},${j}`
        const list = grid.get(k)
        if (list) list.push(b)
        else grid.set(k, [b])
      }
  }
  return (x: number, z: number) => grid.get(`${Math.floor(x / 24)},${Math.floor(z / 24)}`) ?? []
}

/**
 * Buildings drawn over each other on the map: the outline of a whole
 * compound over the houses in it (drawn as one big block it would bury
 * them under a roof), or the same house twice. The houses stay; the
 * compound, or the second copy, goes.
 */
function dropOverlaps(chunk: ChunkData) {
  const near = buildingGrid(chunk.buildings)
  const area = new Map(chunk.buildings.map((b) => [b, ringArea(b.ring)]))
  const gone = new Set<Building>()
  for (const a of chunk.buildings) {
    if (gone.has(a)) continue
    // The others whose middle is inside this one.
    const within: Building[] = []
    let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, z] of a.ring) [x0, z0, x1, z1] = [Math.min(x0, x), Math.min(z0, z), Math.max(x1, x), Math.max(z1, z)]
    const seen = new Set<Building>()
    for (let x = x0; x <= x1 + 24; x += 24)
      for (let z = z0; z <= z1 + 24; z += 24)
        for (const b of near(Math.min(x, x1), Math.min(z, z1))) {
          if (b === a || seen.has(b) || gone.has(b)) continue
          seen.add(b)
          if (pointInRing(b.c, a.ring)) within.push(b)
        }
    if (!within.length) continue
    const big = area.get(a)!
    // A compound round houses: it goes. One house inside another: the smaller goes.
    if (within.length >= 2 || within.every((b) => area.get(b)! * 2.5 < big)) gone.add(a)
    else for (const b of within) gone.add(area.get(b)! <= big ? b : a)
  }
  if (gone.size) chunk.buildings = chunk.buildings.filter((b) => !gone.has(b))
}

/**
 * The quarters' footpaths, cleaned up: the map's scraps (a few metres of
 * path on their own) are left out, and a path stops at a house's wall
 * instead of running through it.
 */
function trimPaths(chunk: ChunkData) {
  const near = buildingGrid(chunk.buildings)
  const inHouse = (p: XZ) => near(p[0], p[1]).some((b) => pointInRing(p, b.ring))
  const out: Road[] = []
  for (const r of chunk.roads) {
    if (r.paved || r.bridge) {
      out.push(r)
      continue
    }
    // Cut the path into the pieces that run between houses.
    let piece: XZ[] = []
    const flush = () => {
      if (piece.length >= 2 && lineLength(piece) >= 8) out.push({ ...r, pts: piece })
      piece = []
    }
    // Keep the map's own points; add one only where the path meets a wall.
    let inside = inHouse(r.pts[0])
    if (!inside) piece.push(r.pts[0])
    for (let i = 1; i < r.pts.length; i++) {
      const [a, p] = [r.pts[i - 1], r.pts[i]]
      const n = Math.max(1, Math.ceil(Math.hypot(p[0] - a[0], p[1] - a[1]) / 2))
      let last: XZ = a
      for (let k = 1; k <= n; k++) {
        const q: XZ = k === n ? p : [a[0] + ((p[0] - a[0]) * k) / n, a[1] + ((p[1] - a[1]) * k) / n]
        const now = inHouse(q)
        if (now && !inside) {
          piece.push(last)
          flush()
        } else if (!now && inside) piece.push(q)
        inside = now
        last = q
      }
      if (!inside && piece[piece.length - 1] !== p) piece.push(p)
    }
    flush()
  }
  chunk.roads = out
}

/**
 * The map's fuel stations, laid out by their street: the canopy over the
 * pumps right by the road, the shop behind it. Their ground is kept clear
 * of the houses the game builds, and a map building standing where the
 * canopy goes (often the canopy itself, drawn as a building) is left out.
 */
function layStations(chunk: ChunkData): { at: XZ; r: number }[] {
  const out: Station[] = []
  for (const p of chunk.pois) {
    if (p.cls !== 'fuel' && p.maki !== 'fuel') continue
    if (out.some((s) => Math.hypot(s.at[0] - p.at[0], s.at[1] - p.at[1]) < 30)) continue
    // The street it's on: the nearest paved one.
    let best: { at: XZ; d: number; angle: number; width: number } | null = null
    for (const r of chunk.roads) {
      if (!r.paved || r.bridge || r.width < 6) continue
      for (let i = 1; i < r.pts.length; i++) {
        const [ax, az] = r.pts[i - 1]
        const [bx, bz] = r.pts[i]
        const l2 = (bx - ax) ** 2 + (bz - az) ** 2
        const t = l2 ? Math.max(0, Math.min(1, ((p.at[0] - ax) * (bx - ax) + (p.at[1] - az) * (bz - az)) / l2)) : 0
        const at: XZ = [ax + (bx - ax) * t, az + (bz - az) * t]
        const d = Math.hypot(at[0] - p.at[0], at[1] - p.at[1])
        if (!best || d < best.d) best = { at, d, angle: Math.atan2(bz - az, bx - ax), width: r.width }
      }
    }
    if (!best || best.d > 70) continue
    const [nx, nz] = [-Math.sin(best.angle), Math.cos(best.angle)]
    const [ux, uz] = [Math.cos(best.angle), Math.sin(best.angle)]
    const side: 1 | -1 = (p.at[0] - best.at[0]) * nx + (p.at[1] - best.at[1]) * nz >= 0 ? 1 : -1
    // The map often draws the station's own canopy as a building, right at its point: that one goes.
    chunk.buildings = chunk.buildings.filter((b) => Math.hypot(b.c[0] - p.at[0], b.c[1] - p.at[1]) > 10 || ringArea(b.ring) > 400)
    const near = chunk.buildings.filter((b) => Math.hypot(b.c[0] - p.at[0], b.c[1] - p.at[1]) < 90)
    const otherRoads = chunk.roads.filter((r) => r.pts.some((q) => Math.hypot(q[0] - p.at[0], q[1] - p.at[1]) < 120))
    /** A rectangle (along the street du, away from it dv, from `at`) with nothing in it. */
    const clear = (at: XZ, du: number, dv0: number, dv1: number) => {
      const inRect = (q: XZ) => {
        const [dx, dz] = [q[0] - at[0], q[1] - at[1]]
        const v = (dx * nx + dz * nz) * side
        return Math.abs(dx * ux + dz * uz) < du && v > dv0 && v < dv1
      }
      if (near.some((b) => inRect(b.c) || b.ring.some(inRect))) return false
      // Corners and middle of the rectangle not inside a house either.
      for (const i of [-1, 0, 1])
        for (const j of [0, 0.5, 1]) {
          const v = dv0 + (dv1 - dv0) * j
          const q: XZ = [at[0] + ux * du * i + nx * side * v, at[1] + uz * du * i + nz * side * v]
          if (near.some((b) => pointInRing(q, b.ring))) return false
        }
      // No other street through it (its own runs in front).
      for (const r of otherRoads)
        for (const q of r.pts) {
          const [dx, dz] = [q[0] - at[0], q[1] - at[1]]
          const v = (dx * nx + dz * nz) * side
          if (Math.abs(dx * ux + dz * uz) < du && v > dv0 + 1 && v < dv1) return false
        }
      return true
    }
    // The canopy and its forecourt (15 × 11 m) on free ground, as close to the map's point as can be.
    let at: XZ | null = null
    for (const along of [0, -6, 6, -12, 12, -18, 18])
      for (const extra of [0, 3, 6]) {
        if (at) break
        const back = best.width / 2 + 7 + extra
        const c: XZ = [best.at[0] + ux * along + nx * side * back, best.at[1] + uz * along + nz * side * back]
        if (clear(c, 7.5, -5.5, 5.5)) at = c
      }
    if (!at) continue
    // The shop goes 10 m behind the canopy, if the ground is free there too.
    const shop = clear(at, 5.5, 6.5, 13.5)
    out.push({ at, angle: best.angle, side, name: p.name, shop })
  }
  chunk.stations = out
  if (!out.length) return []
  return out.flatMap((s) => {
    const [nx, nz] = [-Math.sin(s.angle), Math.cos(s.angle)]
    return [
      { at: s.at, r: 11 },
      ...(s.shop ? [{ at: [s.at[0] + nx * s.side * 10, s.at[1] + nz * s.side * 10] as XZ, r: 7 }] : []),
    ]
  })
}

/** A line's length, in metres. */
function lineLength(pts: XZ[]) {
  let l = 0
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return l
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
  const names: { name: string; cls: string; pts: XZ[] }[] = []
  const nl = tile.layers.transportation_name
  for (let i = 0; i < (nl?.length ?? 0); i++) {
    const f = nl!.feature(i)
    const name = String(f.properties['name:fr'] ?? f.properties.name ?? '')
    if (f.type !== 2 || !name) continue
    const xz = toXZ(f.extent)
    for (const line of f.loadGeometry()) names.push({ name, cls: String(f.properties.class ?? ''), pts: line.map(xz) })
  }
  // A bridge piece takes the name of the street line that runs along it
  // (the same way, the same class): measured at three points along it, not
  // the nearest name around (a footway beside the deck has its own).
  const segDist = ([x, z]: XZ, line: XZ[]) => {
    let best = Infinity
    for (let k = 1; k < line.length; k++) {
      const [ax, az] = line[k - 1]
      const [bx, bz] = line[k]
      const l2 = (bx - ax) ** 2 + (bz - az) ** 2
      const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2)) : 0
      best = Math.min(best, Math.hypot(ax + (bx - ax) * t - x, az + (bz - az) * t - z))
    }
    return best
  }
  const nameNear = (pts: XZ[], cls: string) => {
    const at = (k: number) => {
      const i = Math.min(pts.length - 2, Math.max(0, Math.floor((pts.length - 1) * k)))
      return [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2] as XZ
    }
    const samples = pts.length > 1 ? [at(0.25), at(0.5), at(0.75)] : pts
    let best: { name: string; d: number } | null = null
    for (const n of names) {
      const d = samples.reduce((sum, p) => sum + segDist(p, n.pts), 0) / samples.length + (n.cls === cls ? 0 : 6)
      if (d < 12 && (!best || d < best.d)) best = { name: n.name, d }
    }
    return best?.name
  }

  const roads = tile.layers.transportation
  // The tile's bridges first, whole: their names, then the names running on
  // to their other roadway and the rest of their deck (nameLines).
  const bridgeNames = new Map<string, string | undefined>()
  {
    const lines: { key: string; pts: XZ[]; name?: string; cls: string; bridge: boolean }[] = []
    for (let i = 0; i < (roads?.length ?? 0); i++) {
      const f = roads!.feature(i)
      if (f.type !== 2 || f.properties.brunnel !== 'bridge') continue
      const cls = OMT_ROAD[String(f.properties.class ?? '')]
      if (!cls) continue
      const xz = toXZ(f.extent)
      f.loadGeometry().forEach((line, k) => {
        const all = line.map(xz)
        lines.push({ key: `${i}:${k}`, pts: all, cls, bridge: true, name: bigBridgeName(nameNear(all, String(f.properties.class ?? '')), lineLength(all)) })
      })
    }
    nameLines(lines)
    for (const l of lines) bridgeNames.set(l.key, l.name)
  }
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
    f.loadGeometry().forEach((line, k) => {
      const all = line.map(xz)
      for (let pts of clipLine(all, box)) {
        if (bridge) pts = densify(pts, 10)
        const surface = String(f.properties.surface ?? '')
        chunk.roads.push({ cls, pts, width, paved: !UNPAVED.has(cls) && surface !== 'unpaved', bridge, name: bridge ? bridgeNames.get(`${i}:${k}`) : undefined })
      }
    })
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
  nameTwins(chunk)
  dropOverRoads(chunk)
  dropOverlaps(chunk)
  trimPaths(chunk)
  if (!far) fillQuarters(chunk, neighbours, [...tollGrounds(tile, toXZ), ...layStations(chunk)])
  plant(chunk, far, forests)
  return chunk
}
