/// <reference lib="webworker" />
import { buildChunk } from './meshes'
import { fetchChunk } from './tiles'
import type { Origin } from './geo'
import { inTheWay, resolvePlaces, type PlaceSpot } from './places'
import { STYLE_OF_KIND, type Style } from './buildings'
import { pointInRing } from './geo'
import type { Building } from './tiles'

// Chunks are fetched, decoded and turned into geometry here, off the main
// thread, so walking stays smooth while the world loads around the Sim.

export type ChunkRequest = { id: number; origin: Origin; tx: number; ty: number; token: string; places: PlaceSpot[]; z?: number }
export type Arrays = { position: Float32Array; uv: Float32Array; normal: Float32Array; color?: Float32Array; colorSize?: number; index: Uint32Array }

self.onmessage = async (e: MessageEvent<ChunkRequest>) => {
  const { id, origin, tx, ty, token, places, z } = e.data
  try {
    const data = await fetchChunk(origin, tx, ty, token, undefined, z)
    // Places take the real building where the map puts them; only a place
    // with no building on the map gets one made by the game, on its own lot.
    const styles = new Map<Building, Style>()
    const resolved = resolvePlaces(data, places, (b, kind) => styles.set(b, STYLE_OF_KIND[kind] ?? 'default'))
    const marks = new Set(places.filter((p) => p.landmark).map((p) => p.id))
    const made = resolved.filter((r) => !r.real && !marks.has(r.id)).map((r) => r.center)
    // A landmark clears its ground in every chunk it reaches, not only its own.
    const landmarks = places.filter((p) => p.landmark).map((p) => ({ at: resolved.find((r) => r.id === p.id)?.center ?? p.at, r: p.landmark! }))
    // A building in a campus or a hospital's grounds looks the part.
    const grounds = data.areas.filter((a) => a.kind === 'campus' || a.kind === 'hospital')
    const styleOf = (b: Building): Style => {
      const s = styles.get(b)
      if (s) return s
      const g = grounds.find((a) => pointInRing(b.c, a.rings[0]))
      return g ? (g.kind === 'campus' ? 'institution' : 'hospital') : 'default'
    }
    const meshes = buildChunk(data, (c) => inTheWay(made, c, landmarks), styleOf)
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
