import type { ChunkReply, ChunkRequest } from './chunkJob'
import { weakDevice } from '../../lib/device'

// Where the street's chunks are built: in the browser, workers of their own
// (worker.ts); the phone has none, chunkWorker.native.ts does it in the app.
// A chunk takes seconds to build on a phone: two or three are built side by
// side (a phone has the cores), so the quarter round the Sim stands sooner.

export type ChunkWorker = { onmessage: ((e: { data: ChunkReply }) => void) | null; postMessage: (req: ChunkRequest) => void; terminate: () => void }

/** Workers side by side: one core left for the page itself, three at most (each holds its own copy of the code and the tiles), two on a small phone. */
const POOL = Math.max(1, Math.min(weakDevice ? 2 : 3, (typeof navigator === 'undefined' ? 2 : navigator.hardwareConcurrency ?? 2) - 1))

export const startChunkWorker = (): ChunkWorker => {
  const workers = Array.from({ length: POOL }, () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }))
  // Each request goes to the worker with the fewest in hand; its answer comes back to the street's one handler.
  const busy = workers.map(() => 0)
  const owner = new Map<number, number>()
  const pool: ChunkWorker = {
    onmessage: null,
    postMessage(req) {
      const k = busy.indexOf(Math.min(...busy))
      busy[k]++
      owner.set(req.id, k)
      workers[k].postMessage(req)
    },
    terminate: () => workers.forEach((w) => w.terminate()),
  }
  workers.forEach((w) => {
    w.onmessage = (e: MessageEvent<ChunkReply>) => {
      const k = owner.get(e.data.id)
      owner.delete(e.data.id)
      if (k !== undefined) busy[k]--
      pool.onmessage?.(e)
    }
  })
  return pool
}
