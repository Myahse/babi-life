import type { VueArrays, VueData, VueReply, VueRequest } from './vueBuild'
import { UNIV_GEN, type Built, type UniversInfo, type UniversSpec } from './univers/gen'
import { terrainKey } from './univers/terrain'

// The quartier's world off the main thread (vueBuild.ts, its own worker): its plan (lots, places, home) and its
// view's data, kept: in memory while the page lives, and the view in the phone's cache (Cache Storage) for next
// time, so the view opens at once the second time.

const VERSION = 2
const CACHE = 'babi-vue'
const mem = new Map<string, Promise<VueData>>()
const infos = new Map<string, Promise<UniversInfo>>()
let worker: Worker | null = null
let nextId = 1
const waiting = new Map<number, { ok: (d: VueReply) => void; ko: (e: Error) => void }>()

const specKey = (s: UniversSpec) => `${UNIV_GEN}:${s.preset}:${s.seed}:${s.variant}${s.terrain ? `:t${terrainKey(s.terrain)}` : ''}`
const keyOf = (s: UniversSpec, built: Built[], light: boolean) => `v${VERSION}/${specKey(s)}:${built.map((b) => `${b.lot}${b.kind}`).join('.')}${light ? 'l' : ''}`

function ask(req: Omit<VueRequest, 'id'>): Promise<VueReply> {
  if (!worker) {
    worker = new Worker(new URL('./vueWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<VueReply>) => {
      const w = waiting.get(e.data.id)
      waiting.delete(e.data.id)
      if (!w) return
      if (e.data.error) w.ko(new Error(e.data.error))
      else w.ok(e.data)
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
  const parts = [d.solid.position, d.solid.color, d.solid.index, d.flat.position, d.flat.color, d.flat.index]
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
  const kinds = [Float32Array, Uint8Array, Uint32Array, Float32Array, Uint8Array, Uint32Array] as const
  const arrays = kinds.map((K, i) => {
    const a = new K(buf.slice(at, at + head.n[i] * K.BYTES_PER_ELEMENT))
    at += pad(head.n[i] * K.BYTES_PER_ELEMENT)
    return a
  })
  const mesh = (i: number): VueArrays => ({ position: arrays[i] as Float32Array, color: arrays[i + 1] as Uint8Array, index: arrays[i + 2] as Uint32Array })
  return { solid: mesh(0), flat: mesh(3), buildings: head.buildings, ms: 0 }
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

/** The world's plan (its lots, places, home, edges), laid out off the main thread, kept while the page lives. */
export function universInfoOf(spec: UniversSpec): Promise<UniversInfo> {
  const key = specKey(spec)
  let p = infos.get(key)
  if (!p) {
    p = ask({ spec, built: [], light: false, info: true }).then((r) => r.info!)
    p.catch(() => infos.delete(key))
    infos.set(key, p)
  }
  return p
}

/** The view's data of a world: in memory, else from the phone's cache, else built (and kept). The arrays are shared: never changed. */
export function vueData(spec: UniversSpec, built: Built[], light: boolean): Promise<VueData> {
  const key = keyOf(spec, built, light)
  let p = mem.get(key)
  if (!p) {
    p = (async () => {
      const t0 = performance.now()
      const had = await kept(key)
      if (had) return { ...had, ms: Math.round(performance.now() - t0) }
      const d = (await ask({ spec, built, light })).data!
      void keep(key, d)
      return d
    })()
    p.catch(() => mem.delete(key))
    mem.set(key, p)
  }
  return p
}
