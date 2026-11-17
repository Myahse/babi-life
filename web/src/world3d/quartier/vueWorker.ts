/// <reference lib="webworker" />
import { infoJob, vueJob, type VueReply, type VueRequest } from './vueBuild'

// The quartier's world laid out off the main thread (vueBuild.ts): its plan, or its view's arrays handed over, not copied.

self.onmessage = (e: MessageEvent<VueRequest>) => {
  try {
    if (e.data.info) return void self.postMessage({ id: e.data.id, info: infoJob(e.data) } satisfies VueReply)
    const data = vueJob(e.data)
    const msg: VueReply = { id: e.data.id, data }
    self.postMessage(msg, { transfer: [data.solid.position.buffer, data.solid.color.buffer, data.solid.index.buffer, data.flat.position.buffer, data.flat.color.buffer, data.flat.index.buffer] as ArrayBuffer[] })
  } catch (err) {
    self.postMessage({ id: e.data.id, error: err instanceof Error ? err.message : String(err) } satisfies VueReply)
  }
}
