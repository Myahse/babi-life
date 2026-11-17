import type { Origin } from '../open/geo'
import type { VueArrays, VueData, VueReply, VueRequest } from './vueBuild'

// The quartier's view's data (vueBuild.ts), asked of its own worker and kept: in memory while the page lives,
// and in the phone's cache (Cache Storage) for next time, so the view opens at once the second time.

const VERSION = 1
const CACHE = 'babi-vue'
const mem = new Map<string, Promise<VueData>>()
let worker: Worker | null = null
let nextId = 1
const waiting = new Map<number, { ok: (d: VueData) => void; ko: (e: Error) => void }>()

const keyOf = (c: Origin, r: number, light: boolean) => `v${VERSION}/${c.lat.toFixed(5)},${c.lng.toFixed(5)},${Math.round(r)}${light ? 'l' : ''}`

function ask(req: Omit<VueRequest, 'id'>): Promise<VueData> {
  if (!worker) {
    worker = new Worker(new URL('./vueWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<VueReply>) => {
      const w = waiting.get(e.data.id)
      waiting.delete(e.data.id)
      if (!w) return
      if (e.data.data) w.ok(e.data.data)
      else w.ko(new Error(e.data.error ?? 'vue'))
    }
  }
  const id = nextId++
  return new Promise((ok, ko) => {
    waiting.set(id, { ok, ko })
    worker!.postMessage({ ...req, id } satisfies VueRequest)
  })
}

/** The arrays as one buffer (a little header, then each array on a 4-byte boundary), and back. */
function pack(d: VueData): ArrayBuffer {
  const parts = [d.solid.position, d.solid.color, d.solid.index, d.flat.position, d.flat.color, d.flat.index, d.segs]
  const head = new TextEncoder().encode(JSON.stringify({ n: parts.map((p) => p.length), buildings: d.buildings, ms: d.ms }))
  const pad = (n: number) => (n + 3) & ~3
  let size = 4 + pad(head.length)
  for (const p of parts) size += pad(p.byteLength)
  const out = new Uint8Array(size)
  new DataView(out.buffer).setUint32(0, head.length)
  out.set(head, 4)
  let at = 4 + pad(head.length)
  for (const p of parts) {
    out.set(new Uint8Array(p.buffer, p.byteOffset, p.byteLength), at)
    at += pad(p.byteLength)
  }
  return out.buffer
}

function unpack(buf: ArrayBuffer): VueData {
  const pad = (n: number) => (n + 3) & ~3
  const len = new DataView(buf).getUint32(0)
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, len))) as { n: number[]; buildings: number; ms: number }
  let at = 4 + pad(len)
  const kinds = [Float32Array, Uint8Array, Uint32Array, Float32Array, Uint8Array, Uint32Array, Float32Array] as const
  const arrays = kinds.map((K, i) => {
    const a = new K(buf.slice(at, at + head.n[i] * K.BYTES_PER_ELEMENT))
    at += pad(head.n[i] * K.BYTES_PER_ELEMENT)
    return a
  })
  const mesh = (i: number): VueArrays => ({ position: arrays[i] as Float32Array, color: arrays[i + 1] as Uint8Array, index: arrays[i + 2] as Uint32Array })
  return { solid: mesh(0), flat: mesh(3), segs: arrays[6] as Float32Array, buildings: head.buildings, ms: 0 }
}

async function kept(key: string): Promise<VueData | null> {
  try {
    const c = await caches.open(CACHE)
    const r = await c.match(`/__vue/${key}`)
    return r ? unpack(await r.arrayBuffer()) : null
  } catch {
    return null
  }
}

async function keep(key: string, d: VueData) {
  try {
    const c = await caches.open(CACHE)
    await c.put(`/__vue/${key}`, new Response(pack(d)))
  } catch {
    // (No cache: built again next time.)
  }
}

/** The view's data round a centre: in memory, else from the phone's cache, else built (and kept). The arrays are shared: never changed. */
export function vueData(center: Origin, r: number, token: string, light: boolean): Promise<VueData> {
  const key = keyOf(center, r, light)
  let p = mem.get(key)
  if (!p) {
    p = (async () => {
      const t0 = performance.now()
      const had = await kept(key)
      if (had) return { ...had, ms: Math.round(performance.now() - t0) }
      const d = await ask({ center, r, token, light })
      void keep(key, d)
      return d
    })()
    p.catch(() => mem.delete(key))
    mem.set(key, p)
  }
  return p
}
