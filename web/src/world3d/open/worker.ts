/// <reference lib="webworker" />
import { buildChunk } from './meshes'
import { fetchChunk } from './tiles'
import { PLACE_CLEARANCE, type Origin } from './geo'
import { resolvePlaces, type PlaceSpot } from './places'

// Chunks are fetched, decoded and turned into geometry here, off the main
// thread, so walking stays smooth while the world loads around the Sim.

export type ChunkRequest = { id: number; origin: Origin; tx: number; ty: number; token: string; places: PlaceSpot[] }
export type Arrays = { position: Float32Array; uv: Float32Array; normal: Float32Array; color?: Float32Array; index: Uint32Array }

self.onmessage = async (e: MessageEvent<ChunkRequest>) => {
  const { id, origin, tx, ty, token, places } = e.data
  try {
    const data = await fetchChunk(origin, tx, ty, token)
    // Places in this chunk go on its streets; the real buildings where they
    // stand make way (a place near a chunk's edge may clear the next one too).
    const resolved = resolvePlaces(data, places)
    const clear = [...resolved.map((r) => r.center), ...places.map((p) => p.at)]
    const meshes = buildChunk(data, (c) => clear.some((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) < PLACE_CLEARANCE))
    const out: Record<string, Arrays> = {}
    const transfer: ArrayBuffer[] = []
    for (const [name, g] of Object.entries(meshes)) {
      if (!g) continue
      const arr = (n: string) => g.getAttribute(n)?.array as Float32Array | undefined
      const a: Arrays = { position: arr('position')!, uv: arr('uv')!, normal: arr('normal')!, color: arr('color'), index: new Uint32Array(g.getIndex()!.array) }
      out[name] = a
      for (const v of [a.position, a.uv, a.normal, a.color, a.index]) if (v) transfer.push(v.buffer as ArrayBuffer)
    }
    self.postMessage({ id, data, meshes: out, resolved }, { transfer })
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
