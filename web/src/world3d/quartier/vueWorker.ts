/// <reference lib="webworker" />
import { vueJob, type VueReply, type VueRequest } from './vueBuild'

// The quartier's view built off the main thread (vueBuild.ts), its arrays handed over, not copied.

self.onmessage = async (e: MessageEvent<VueRequest>) => {
  try {
    const data = await vueJob(e.data)
    const msg: VueReply = { id: e.data.id, data }
    self.postMessage(msg, { transfer: [data.solid.position.buffer, data.solid.color.buffer, data.solid.index.buffer, data.flat.position.buffer, data.flat.color.buffer, data.flat.index.buffer, data.segs.buffer] as ArrayBuffer[] })
  } catch (err) {
    self.postMessage({ id: e.data.id, error: err instanceof Error ? err.message : String(err) } satisfies VueReply)
  }
}
