import { chunkJob, type ChunkRequest } from './chunkJob'
import type { ChunkWorker } from './chunkWorker'

// On the phone (React Native has no workers): the street's chunks built on
// the app's own thread, one after the other, the frames going on between them
// (each waits for its tiles, then builds).

export function startChunkWorker(): ChunkWorker {
  let live = true
  let queue = Promise.resolve()
  const w: ChunkWorker = {
    onmessage: null,
    postMessage(req: ChunkRequest) {
      queue = queue.then(async () => {
        if (!live) return
        const { msg } = await chunkJob(req)
        if (live) w.onmessage?.({ data: msg })
      })
    },
    terminate() {
      live = false
    },
  }
  return w
}
