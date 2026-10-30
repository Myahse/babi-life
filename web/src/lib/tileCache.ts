// The map's tiles kept on the phone (the streets, the buildings: world3d/open/tiles.ts,
// fetched in the street's worker too, so nothing here but the Cache Storage): a month
// once fetched, the old ones when there's no network (lib/offline.ts).

const TILES = 'babi-tiles-v1'
const MAX_TILES = 400
const TILE_DAYS = 30
const can = () => typeof caches !== 'undefined'
const keyUrl = (key: string) => `https://kept.babi.local/${encodeURIComponent(key)}`
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false

/**
 * A tile of the map: kept for a month once fetched (a phone plan doesn't pay
 * twice for the same streets), from the network when it's older, the old one
 * when there's no network. key: the tile without its version (a new version
 * of the map is the same streets).
 */
export async function tileFetch(key: string, url: string, signal?: AbortSignal): Promise<Response> {
  // The street's workers build side by side, and often want the same tile at once: one fetches
  // it and keeps it, the others then find it kept (not the same tile downloaded three times).
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  return locks && can() ? await locks.request(`babi-tile:${key}`, () => tileFetchNow(key, url, signal, true)) : tileFetchNow(key, url, signal, false)
}

async function tileFetchNow(key: string, url: string, signal: AbortSignal | undefined, wait: boolean): Promise<Response> {
  const c = can() ? await caches.open(TILES).catch(() => null) : null
  const hit = c ? await c.match(keyUrl(key)).catch(() => undefined) : undefined
  const age = hit ? Date.now() - Number(hit.headers.get('x-kept') ?? 0) : Infinity
  if (hit && (age < TILE_DAYS * 864e5 || !online())) return hit
  try {
    const res = await fetch(url, { signal })
    if (res.ok && c) {
      const body = await res.clone().arrayBuffer()
      const kept = c.put(keyUrl(key), new Response(body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/octet-stream', 'x-kept': String(Date.now()) } }))
      void kept.then(() => trim(c)).catch(() => undefined)
      // (Kept before the others waiting for it look.)
      if (wait) await kept.catch(() => undefined)
    }
    return res
  } catch (e) {
    if (hit) return hit
    throw e
  }
}

/** A small file the tiles hang on (the map's address book): from the network, the last copy without. */
export async function freshOrKept(key: string, url: string): Promise<Response> {
  const c = can() ? await caches.open(TILES).catch(() => null) : null
  try {
    const res = await fetch(url)
    if (res.ok && c) void c.put(keyUrl(key), res.clone()).catch(() => undefined)
    return res
  } catch (e) {
    const hit = c ? await c.match(keyUrl(key)).catch(() => undefined) : undefined
    if (hit) return hit
    throw e
  }
}

let trimming = false
/** No more than a few hundred tiles kept: the oldest go first. */
async function trim(c: Cache) {
  if (trimming) return
  trimming = true
  try {
    const keys = await c.keys()
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_TILES))) await c.delete(k)
  } finally {
    trimming = false
  }
}
