import { buildChunk } from './meshes'
import { BLOCK, fetchChunk } from './tiles'
import type { Origin, XZ } from './geo'
import { inTheWay, onFieldGround, resolvePlaces, type PlaceSpot, type Resolved } from './places'
import { STYLE_OF_KIND, type Style } from './buildings'
import { clipLine, pointInRing, tileBox } from './geo'
import { chunkKey, getChunk, keepKey, openCache, putChunk } from './chunkCache'
import { tileStats } from '../../lib/tileCache'
import type { Building, ChunkData } from './tiles'
import type { Keep } from './chunkCache'
import { ALSO_WHOLE, CELLED, cellName, splitCells } from './cells'
import type { FacadesBuild } from './facades'
import { shopKinds, streetFront } from './facadeProps'

// A chunk of the street fetched, decoded and turned into geometry. In the
// browser it's done off the main thread (worker.ts), so walking stays smooth
// while the world loads around the Sim; the phone has no workers, and does it
// on its own thread (chunkWorker.native.ts). A chunk built once is kept in the
// browser (chunkCache): next time it comes back from there at once, and only
// the missing ones are fetched and built.

export type ChunkRequest = { id: number; origin: Origin; tx: number; ty: number; token: string; places: PlaceSpot[]; z?: number; /** Another commune's landmark drawn from afar (the Tour F seen from Adjamé): the map's buildings and trees go from its ground here too. */ clear?: { at: XZ; r: number }[]; /** The walls' corners chamfered (the update « blocs-arrondis »; a near chunk only): kept in the cache apart. */ round?: boolean; /** « facades-realistes » (facades.ts): the towers' shapes, and the walls' props too: kept in the cache apart. */ facades?: FacadesBuild; /** « mon-quartier »'s lot: only what stands within r of it is built (its street front), the rest of the tile left out (keepKey). */ keep?: Keep; /** The big bridges' deck only, the rest drawn by ponts.tsx (the update « ponts-realistes »): kept in the cache apart. */ ponts?: boolean }
export type { Keep } from './chunkCache'
/** A mesh's arrays: normals in bytes, colours in bytes (floats when brighter than white), the index in 16 bits when it can be (builder.ts). */
export type Arrays = { position: Float32Array; uv: Float32Array; normal: Int8Array; color?: Uint8Array | Float32Array; colorSize?: number; /** The building each vertex belongs to, in whole metres (lotClip.ts). */ lotBc?: Int16Array; index: Uint16Array | Uint32Array }
/** What comes back for a chunk: its data, meshes and places, or why not. */
export type ChunkReply = { id: number; data?: ChunkData; meshes?: Record<string, Arrays>; resolved?: Resolved[]; cached?: boolean; error?: string; /** How long its meshes took to build (ms; not for one from the cache). */ buildMs?: number; /** The map tiles this thread found kept or downloaded since its last reply (lib/mesures.ts). */ tiles?: TileCount }
type TileCount = { hit: number; miss: number; bytes: number }

/** What this thread's tile counts gained since the last reply: summed on the main thread, whichever worker answers. */
const told: TileCount = { hit: 0, miss: 0, bytes: 0 }
function tilesSince(): TileCount {
  const d = { hit: tileStats.hit - told.hit, miss: tileStats.miss - told.miss, bytes: tileStats.bytes - told.bytes }
  Object.assign(told, tileStats)
  return d
}

/** A chunk fetched (or found in the cache) and built: the message for the street, and its arrays to hand over (a worker's transfer). */
/** « mon-quartier »: a chunk cut to a lot and its street front (keep): the buildings, trees and the rest whose middle
 * is out of reach left out, the roads cut to the lot's square. A lot is a few buildings instead of a whole tile's
 * thousands, so it stands in a moment; the haze round it (world3d/quartier/scene.tsx) hides the cut. */
function keepOnly(data: ChunkData, k: Keep) {
  const r = k.r
  const near = (q: XZ, m = 0) => Math.hypot(q[0] - k.at[0], q[1] - k.at[1]) <= r + m
  const box = { x0: k.at[0] - r - 30, x1: k.at[0] + r + 30, z0: k.at[1] - r - 30, z1: k.at[1] + r + 30 }
  data.buildings = data.buildings.filter((b) => near(b.c, 6))
  data.roads = data.roads.flatMap((rd) => clipLine(rd.pts, box).filter((pts) => pts.length > 1).map((pts) => ({ ...rd, pts })))
  data.trees = data.trees.filter((q) => near(q))
  data.palms = data.palms.filter((q) => near(q))
  if (data.forest) data.forest = data.forest.filter((q) => near(q))
  if (data.stations) data.stations = data.stations.filter((s) => near(s.at, 20))
  if (data.couloirs) data.couloirs = data.couloirs.filter((c) => near(c.mouth))
  if (data.rails) data.rails = data.rails.flatMap((pts) => clipLine(pts, box).filter((x) => x.length > 1))
  data.pois = data.pois.filter((p) => near(p.at, 40))
  data.aeroways = data.aeroways.flatMap((a) => clipLine(a.pts, box).filter((pts) => pts.length > 1).map((pts) => ({ ...a, pts })))
}

export async function chunkJob(req: ChunkRequest): Promise<{ msg: ChunkReply; transfer: ArrayBuffer[] }> {
  const { id, origin, tx, ty, token, z, clear = [], keep } = req
  // (A lot: only the places within its reach are laid out.)
  const places = keep ? req.places.filter((p) => Math.hypot(p.at[0] - keep.at[0], p.at[1] - keep.at[1]) < keep.r + 40) : req.places
  const round = !!req.round && !z
  const facades = z ? undefined : req.facades
  const ponts = !!req.ponts
  try {
    // (« facades-realistes »'s props: « props2 » since the signs follow the places and the map's points of interest.)
    const key = chunkKey(origin, tx, ty, z ?? 0, z ? tileBox(origin, tx, ty, z) : tileBox(origin, tx, ty), places, clear) + (round ? '|arrondi' : '') + (facades ? `|facades-${facades === 'props' ? 'props2' : facades}` : '') + keepKey(keep) + (ponts ? '|ponts' : '')
    const kept = await getChunk(key)
    if (kept) {
      const transfer = Object.values(kept.meshes).flatMap((a) => [a.position, a.uv, a.normal, a.color, a.lotBc, a.index].flatMap((v) => (v ? [v.buffer as ArrayBuffer] : [])))
      return { msg: { id, data: kept.data, meshes: kept.meshes, resolved: kept.resolved, cached: true, tiles: tilesSince() }, transfer }
    }
    const data = await fetchChunk(origin, tx, ty, token, undefined, z)
    if (keep && !z) keepOnly(data, keep)
    // Places take the real building where the map puts them; only a place
    // with no building on the map gets one made by the game, on its own lot.
    const styles = new Map<Building, Style>()
    const kinds = new Map<Building, string>()
    const resolved = resolvePlaces(data, places, (b, kind) => (styles.set(b, STYLE_OF_KIND[kind] ?? 'default'), kinds.set(b, kind)))
    const marks = new Set(places.filter((p) => p.landmark).map((p) => p.id))
    const made = resolved.filter((r) => !r.real && !r.field && !r.station && !marks.has(r.id)).map((r) => r.center)
    // A pitch the game lays out, or the map's: no house stands on it.
    const fields = resolved.flatMap((r) => (r.field ? [r.field] : []))
    // Not a corner of a house on it either (only its middle was looked at): gone from the
    // drawing and from the ways on foot, which use these buildings too.
    if (fields.length) data.buildings = data.buildings.filter((b) => !fields.some((f) => onFieldGround(f, b.c) || b.ring.some((p) => onFieldGround(f, p, 0.5))))
    // A landmark clears its ground in every chunk it reaches, not only its own.
    // A landmark along the water (its promenade, its lawn, its pitches): its ground all along the shore, a circle every 18 m, 25 m in from the edge.
    const along = resolved.flatMap((r) => {
      if (!r.shore) return []
      const [c, sn] = [Math.cos(r.rot), Math.sin(r.rot)]
      return r.shore.filter((_, i) => i % 3 === 0).map(([x, z]) => ({ at: [r.center[0] + x * c + (z + 25) * sn, r.center[1] - x * sn + (z + 25) * c] as XZ, r: 29 }))
    })
    const landmarks = [...places.filter((p) => p.landmark).map((p) => ({ at: resolved.find((r) => r.id === p.id)?.center ?? p.at, r: p.landmark! })), ...along, ...clear]
    // Not only the buildings whose middle is on it: a big one whose corner reaches in
    // (a block of flats beside a house's lot) would stand across its walls.
    if (landmarks.length) data.buildings = data.buildings.filter((b) => !landmarks.some((l) => b.ring.some((q) => Math.hypot(q[0] - l.at[0], q[1] - l.at[1]) < l.r)))
    // A fairground: the map's halls stay, the game's own houses don't line its inner roads.
    const fairs = places.filter((p) => p.noFill).map((p) => ({ at: resolved.find((r) => r.id === p.id)?.center ?? p.at, r: p.noFill! }))
    if (fairs.length) data.buildings = data.buildings.filter((b) => !b.fill || !fairs.some((f) => Math.hypot(b.c[0] - f.at[0], b.c[1] - f.at[1]) < f.r))
    // A village out of town (Koni, Monogaga…): its houses of the map one storey under tin, not the town's guess.
    const villages = places.filter((p) => p.village).map((p) => ({ at: resolved.find((r) => r.id === p.id)?.center ?? p.at, r: p.village! }))
    if (villages.length) for (const b of data.buildings) if (!b.fill && villages.some((v) => Math.hypot(b.c[0] - v.at[0], b.c[1] - v.at[1]) < v.r)) (b.height = BLOCK), (b.tin = true)
    // A building in a campus or a hospital's grounds looks the part.
    const grounds = data.areas.filter((a) => a.kind === 'campus' || a.kind === 'hospital')
    const styleOf = (b: Building): Style => {
      const s = styles.get(b)
      if (s) return s
      const g = grounds.find((a) => pointInRing(b.c, a.rings[0]))
      return g ? (g.kind === 'campus' ? 'institution' : 'hospital') : (b.style ?? 'default')
    }
    // No tree on a pitch, in a game-made lot or on a landmark's ground (it draws its own).
    const bare = (q: XZ) => fields.some((f) => onFieldGround(f, q, 2.5)) || inTheWay(made, q, landmarks)
    data.trees = data.trees.filter((q) => !bare(q))
    data.palms = data.palms.filter((q) => !bare(q))
    if (data.forest) data.forest = data.forest.filter((q) => !bare(q))
    // The shops the game knows (its places, the map's points of interest): their signs say what they are.
    const shops = facades === 'props' ? shopKinds(data.buildings, data.pois, kinds) : null
    const t0 = performance.now()
    const meshes = buildChunk(data, (c, ring) => inTheWay(made, c, landmarks, ring) || fields.some((f) => onFieldGround(f, c) || ring.some((q) => onFieldGround(f, q, 0.3))), styleOf, (q, r) => fields.some((f) => onFieldGround(f, q, 2 + r)) || inTheWay(made, q, landmarks.map((l) => ({ at: l.at, r: l.r + r }))), round, facades && { tower: true, props: facades === 'props', shopOf: shops ? (b) => shops.get(b) : undefined, frontOf: (b) => streetFront(data.roads, b.c) }, ponts)
    const buildMs = performance.now() - t0
    const out: Record<string, Arrays> = {}
    const transfer: ArrayBuffer[] = []
    for (const [name, g] of Object.entries(meshes)) {
      if (!g) continue
      const a = {
        position: g.getAttribute('position').array,
        uv: g.getAttribute('uv').array,
        normal: g.getAttribute('normal').array,
        color: g.getAttribute('color')?.array,
        colorSize: g.getAttribute('color')?.itemSize,
        lotBc: g.getAttribute('lotBc')?.array,
        index: g.getIndex()!.array,
      } as Arrays
      // A near chunk's small parts, in squares (cells.ts).
      const parts = !z && CELLED.has(name) ? [...(ALSO_WHOLE.has(name) ? [[name, a] as const] : []), ...[...splitCells(a, data.box)].map(([c, p]) => [cellName(name, c), p] as const)] : [[name, a] as const]
      for (const [n, p] of parts) {
        out[n] = p
        for (const v of [p.position, p.uv, p.normal, p.color, p.lotBc, p.index]) if (v) transfer.push(v.buffer as ArrayBuffer)
      }
    }
    // Kept for next time: copied right here, before the arrays are handed over.
    putChunk(await openCache(), key, { data, meshes: out, resolved })
    return { msg: { id, data, meshes: out, resolved, tiles: tilesSince(), buildMs }, transfer }
  } catch (err) {
    return { msg: { id, error: err instanceof Error ? err.message : String(err), tiles: tilesSince() }, transfer: [] }
  }
}
