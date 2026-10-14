/// <reference lib="webworker" />
import { buildChunk } from './meshes'
import { fetchChunk } from './tiles'
import type { Origin } from './geo'
import { inTheWay, resolvePlaces, type PlaceSpot } from './places'

// Chunks are fetched, decoded and turned into geometry here, off the main
// thread, so walking stays smooth while the world loads around the Sim.

export type ChunkRequest = { id: number; origin: Origin; tx: number; ty: number; token: string; places: PlaceSpot[] }
export type Arrays = { position: Float32Array; uv: Float32Array; normal: Float32Array; color?: Float32Array; colorSize?: number; index: Uint32Array }

self.onmessage = async (e: MessageEvent<ChunkRequest>) => {
  const { id, origin, tx, ty, token, places } = e.data
  try {
    const data = await fetchChunk(origin, tx, ty, token)
    // Places take the real building where the map puts them; only a place
    // with no building on the map gets one made by the game, on its own lot.
    const resolved = resolvePlaces(data, places)
    const made = resolved.filter((r) => !r.real).map((r) => r.center)
    const meshes = buildChunk(data, (c) => inTheWay(made, c))
    const out: Record<string, Arrays> = {}
    const transfer: ArrayBuffer[] = []
    for (const [name, g] of Object.entries(meshes)) {
      if (!g) continue
      const arr = (n: string) => g.getAttribute(n)?.array as Float32Array | undefined
      const a: Arrays = { position: arr('position')!, uv: arr('uv')!, normal: arr('normal')!, color: arr('color'), colorSize: g.getAttribute('color')?.itemSize, index: new Uint32Array(g.getIndex()!.array) }
      out[name] = a
      for (const v of [a.position, a.uv, a.normal, a.color, a.index]) if (v) transfer.push(v.buffer as ArrayBuffer)
    }
    self.postMessage({ id, data, meshes: out, resolved }, { transfer })
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
