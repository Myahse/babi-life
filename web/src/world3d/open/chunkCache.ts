/// <reference lib="webworker" />
// The chunks already built, kept in the browser (IndexedDB) from one visit to
// the next: the second time, the streets round the Sim come out of here at
// once instead of being fetched and built again; only the ones missing are.
//
// A chunk is found again only if nothing that made it has changed: the
// worker's own code (its file name changes with every build that touches the
// map's code), the map's origin, the tile, and the places, houses and fields
// standing on it or near it. Anything else is a new key, built afresh; the old
// entries go when there are too many (the least recently seen first).

import type { PlaceSpot } from './places'
import type { ChunkData } from './tiles'
import type { Arrays } from './worker'
import type { Resolved } from './places'

export type Cached = { data: ChunkData; meshes: Record<string, Arrays>; resolved: Resolved[] }

const DB = 'babi-chunks'
const STORE = 'chunks'
const SEEN = 'seen'
/** Chunks kept at most (each a few hundred kilobytes: about 100 MB in all). */
const MAX = 400

// In development the worker's file name doesn't change with its code: no cache there.
const ON = !import.meta.env.DEV && typeof indexedDB !== 'undefined'
const VERSION = `v1|${self.location.pathname}`

let opening: Promise<IDBDatabase | null> | null = null
function open(): Promise<IDBDatabase | null> {
  if (!ON) return Promise.resolve(null)
  opening ??= new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 1)
      r.onupgradeneeded = () => {
        r.result.createObjectStore(STORE)
        r.result.createObjectStore(SEEN)
      }
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => resolve(null)
      r.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return opening
}

const done = (t: IDBTransaction) => new Promise<void>((res) => ((t.oncomplete = () => res()), (t.onerror = () => res()), (t.onabort = () => res())))

/** A short fingerprint of a string (FNV-1a), enough to tell two inputs apart. */
function hash(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/**
 * The key of a chunk: the code's version, the origin, the tile, and the
 * places within reach of its box (a landmark clears its ground this far).
 */
export function chunkKey(origin: { lat: number; lng: number }, tx: number, ty: number, z: number, box: { x0: number; x1: number; z0: number; z1: number }, places: PlaceSpot[]) {
  const reach = 200
  const near = places
    .filter((p) => p.at[0] > box.x0 - reach && p.at[0] < box.x1 + reach && p.at[1] > box.z0 - reach && p.at[1] < box.z1 + reach)
    .map((p) => [p.id, Math.round(p.at[0] * 10), Math.round(p.at[1] * 10), p.kind ?? '', p.landmark ?? 0, p.name ?? '', p.type ?? '', p.noLayout ? 1 : 0].join(','))
    .sort()
    .join(';')
  return `${VERSION}|${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}|${z}|${tx}/${ty}|${hash(near)}`
}

export async function getChunk(key: string): Promise<Cached | null> {
  const db = await open()
  if (!db) return null
  try {
    const t = db.transaction([STORE, SEEN], 'readwrite')
    const got = await new Promise<Cached | null>((res) => {
      const r = t.objectStore(STORE).get(key)
      r.onsuccess = () => res((r.result as Cached | undefined) ?? null)
      r.onerror = () => res(null)
    })
    if (got) t.objectStore(SEEN).put(Date.now(), key)
    await done(t)
    return got
  } catch {
    return null
  }
}

let puts = 0
/** The database, opened (null: no cache here). */
export const openCache = open

/**
 * Kept for next time. The value is copied during this call, before it
 * returns: the arrays can be transferred away right after.
 */
export function putChunk(db: IDBDatabase | null, key: string, value: Cached) {
  if (!db) return
  try {
    const t = db.transaction([STORE, SEEN], 'readwrite')
    t.objectStore(STORE).put(value, key)
    t.objectStore(SEEN).put(Date.now(), key)
    if (++puts % 20 === 0) void done(t).then(() => prune(db))
  } catch {
    // Full or refused (private browsing): the chunk is simply built again next time.
  }
}

/** Too many: the least recently seen go, down to three quarters of the most. */
async function prune(db: IDBDatabase) {
  const t = db.transaction([STORE, SEEN], 'readwrite')
  const seen = t.objectStore(SEEN)
  const all = await new Promise<{ key: string; at: number }[]>((res) => {
    const out: { key: string; at: number }[] = []
    const r = seen.openCursor()
    r.onsuccess = () => {
      const c = r.result
      if (!c) return res(out)
      out.push({ key: String(c.key), at: Number(c.value) })
      c.continue()
    }
    r.onerror = () => res(out)
  })
  if (all.length > MAX) {
    all.sort((a, b) => a.at - b.at)
    for (const { key } of all.slice(0, all.length - Math.floor(MAX * 0.75))) {
      t.objectStore(STORE).delete(key)
      seen.delete(key)
    }
  }
  await done(t)
}
