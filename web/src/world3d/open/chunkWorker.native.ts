import { chunkJob, type ChunkReply, type ChunkRequest } from './chunkJob'

// On the phone (React Native has no workers): the street's chunks built on
// the app's own thread, one after the other, the frames going on between them
// (each waits for its tiles, then builds). One at a time: the browser's two or
// three workers side by side (chunkWorker.ts) would share this one thread anyway.
// The compact arrays (normals and colours in bytes, 16-bit indices) are handed
// over as they are: expo-gl passes them to OpenGL ES 3 as the browser does.

/** As chunkWorker.ts's (written here too: the type checker reads this file for './chunkWorker' in the app). */
export type ChunkWorker = { onmessage: ((e: { data: ChunkReply }) => void) | null; postMessage: (req: ChunkRequest) => void; terminate: () => void }

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
