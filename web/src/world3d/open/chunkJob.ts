import { buildChunk } from './meshes'
import { fetchChunk } from './tiles'
import type { Origin, XZ } from './geo'
import { inTheWay, onFieldGround, resolvePlaces, type PlaceSpot, type Resolved } from './places'
import { STYLE_OF_KIND, type Style } from './buildings'
import { pointInRing, tileBox } from './geo'
import { chunkKey, getChunk, openCache, putChunk } from './chunkCache'
import type { Building, ChunkData } from './tiles'
import { ALSO_WHOLE, CELLED, cellName, splitCells } from './cells'

// A chunk of the street fetched, decoded and turned into geometry. In the
// browser it's done off the main thread (worker.ts), so walking stays smooth
// while the world loads around the Sim; the phone has no workers, and does it
// on its own thread (chunkWorker.native.ts). A chunk built once is kept in the
// browser (chunkCache): next time it comes back from there at once, and only
// the missing ones are fetched and built.

export type ChunkRequest = { id: number; origin: Origin; tx: number; ty: number; token: string; places: PlaceSpot[]; z?: number; /** Another commune's landmark drawn from afar (the Tour F seen from Adjamé): the map's buildings and trees go from its ground here too. */ clear?: { at: XZ; r: number }[] }
/** A mesh's arrays: normals in bytes, colours in bytes (floats when brighter than white), the index in 16 bits when it can be (builder.ts). */
export type Arrays = { position: Float32Array; uv: Float32Array; normal: Int8Array; color?: Uint8Array | Float32Array; colorSize?: number; /** The building each vertex belongs to, in whole metres (lotClip.ts). */ lotBc?: Int16Array; index: Uint16Array | Uint32Array }
/** What comes back for a chunk: its data, meshes and places, or why not. */
export type ChunkReply = { id: number; data?: ChunkData; meshes?: Record<string, Arrays>; resolved?: Resolved[]; cached?: boolean; error?: string }

/** A chunk fetched (or found in the cache) and built: the message for the street, and its arrays to hand over (a worker's transfer). */
export async function chunkJob(req: ChunkRequest): Promise<{ msg: ChunkReply; transfer: ArrayBuffer[] }> {
  const { id, origin, tx, ty, token, places, z, clear = [] } = req
  try {
    const key = chunkKey(origin, tx, ty, z ?? 0, z ? tileBox(origin, tx, ty, z) : tileBox(origin, tx, ty), places, clear)
    const kept = await getChunk(key)
    if (kept) {
      const transfer = Object.values(kept.meshes).flatMap((a) => [a.position, a.uv, a.normal, a.color, a.lotBc, a.index].flatMap((v) => (v ? [v.buffer as ArrayBuffer] : [])))
      return { msg: { id, data: kept.data, meshes: kept.meshes, resolved: kept.resolved, cached: true }, transfer }
    }
    const data = await fetchChunk(origin, tx, ty, token, undefined, z)
    // Places take the real building where the map puts them; only a place
    // with no building on the map gets one made by the game, on its own lot.
    const styles = new Map<Building, Style>()
    const resolved = resolvePlaces(data, places, (b, kind) => styles.set(b, STYLE_OF_KIND[kind] ?? 'default'))
    const marks = new Set(places.filter((p) => p.landmark).map((p) => p.id))
    const made = resolved.filter((r) => !r.real && !r.field && !r.station && !marks.has(r.id)).map((r) => r.center)
    // A pitch the game lays out, or the map's: no house stands on it.
    const fields = resolved.flatMap((r) => (r.field ? [r.field] : []))
    // Not a corner of a house on it either (only its middle was looked at): gone from the
    // drawing and from the ways on foot, which use these buildings too.
    if (fields.length) data.buildings = data.buildings.filter((b) => !fields.some((f) => onFieldGround(f, b.c) || b.ring.some((p) => onFieldGround(f, p, 0.5))))
    // A landmark clears its ground in every chunk it reaches, not only its own.
    const landmarks = [...places.filter((p) => p.landmark).map((p) => ({ at: resolved.find((r) => r.id === p.id)?.center ?? p.at, r: p.landmark! })), ...clear]
    // Not only the buildings whose middle is on it: a big one whose corner reaches in
    // (a block of flats beside a house's lot) would stand across its walls.
    if (landmarks.length) data.buildings = data.buildings.filter((b) => !landmarks.some((l) => b.ring.some((q) => Math.hypot(q[0] - l.at[0], q[1] - l.at[1]) < l.r)))
    // A fairground: the map's halls stay, the game's own houses don't line its inner roads.
    const fairs = places.filter((p) => p.noFill).map((p) => ({ at: resolved.find((r) => r.id === p.id)?.center ?? p.at, r: p.noFill! }))
    if (fairs.length) data.buildings = data.buildings.filter((b) => !b.fill || !fairs.some((f) => Math.hypot(b.c[0] - f.at[0], b.c[1] - f.at[1]) < f.r))
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
    const meshes = buildChunk(data, (c, ring) => inTheWay(made, c, landmarks, ring) || fields.some((f) => onFieldGround(f, c) || ring.some((q) => onFieldGround(f, q, 0.3))), styleOf, (q, r) => fields.some((f) => onFieldGround(f, q, 2 + r)) || inTheWay(made, q, landmarks.map((l) => ({ at: l.at, r: l.r + r }))))
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
    return { msg: { id, data, meshes: out, resolved }, transfer }
  } catch (err) {
    return { msg: { id, error: err instanceof Error ? err.message : String(err) }, transfer: [] }
  }
}
