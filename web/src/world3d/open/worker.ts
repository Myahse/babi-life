/// <reference lib="webworker" />
import { chunkJob, type ChunkRequest } from './chunkJob'

// The street's chunks built off the main thread (chunkJob.ts), their arrays handed over, not copied.

export type { Arrays, ChunkReply, ChunkRequest } from './chunkJob'

self.onmessage = async (e: MessageEvent<ChunkRequest>) => {
  const { msg, transfer } = await chunkJob(e.data)
  self.postMessage(msg, { transfer })
}
