import type { ChunkReply, ChunkRequest } from './chunkJob'

// Where the street's chunks are built: in the browser, a worker of their own
// (worker.ts); the phone has none, chunkWorker.native.ts does it in the app.

export type ChunkWorker = { onmessage: ((e: { data: ChunkReply }) => void) | null; postMessage: (req: ChunkRequest) => void; terminate: () => void }

export const startChunkWorker = (): ChunkWorker => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as unknown as ChunkWorker
