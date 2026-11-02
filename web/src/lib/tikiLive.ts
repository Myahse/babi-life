import { useSyncExternalStore } from 'react'
import type { Pose } from '../avatar/Human'
import { useSession } from '../store/session'
import { lang } from './i18n'

// Tikitoko Live (backend internal/live/tiki.go): a live is a room of the game's WebSocket. The streamer's
// phone sends what its Sim is doing every couple of seconds, and, its microphone open, its voice: coded
// small with the phone's own Opus encoder (WebCodecs, a voice call's rate), one packet each 20 ms, sent as
// is; the server hands each on to the viewers, whose phones decode it and play it a moment behind (a
// little buffer, so the voice doesn't stutter on a slow network). No video, no media server.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

export type TikiLive = { id: string; name: string; title: string; gender: 'femme' | 'homme'; look: Record<string, string>; stage: string; commune: string; started: number; viewers: number; hearts: number; doing: string; mic: boolean }
export type LiveSay = { id: string; n: string; s: string; host?: boolean; at: number }

const token = () => useSession.getState().token ?? ''
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(BASE + path, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${token()}`, 'accept-language': lang() } })
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${r.status}`)
  return r.status === 204 ? (undefined as T) : ((await r.json()) as T)
}
export const tikiLives = () => call<TikiLive[]>('/tikilive')
export const startLive = (sim: string, title: string, stage: string) => call<TikiLive>(`/sims/${sim}/tikilive`, { method: 'POST', body: JSON.stringify({ title, stage }) })
export const stopLive = (sim: string) => call<void>(`/sims/${sim}/tikilive`, { method: 'DELETE' })

/** Can this phone speak (code its voice) and hear (decode the others')? */
export const canSpeak = () => typeof window !== 'undefined' && 'AudioEncoder' in window && !!navigator.mediaDevices?.getUserMedia
export const canHear = () => typeof window !== 'undefined' && 'AudioDecoder' in window

/* ---------- A connection to a live ---------- */

export type LiveHandlers = {
  onSay?: (s: LiveSay) => void
  onHeart?: (hearts: number) => void
  onDoing?: (d: { s: string; p: Pose; mic: boolean; viewers: number; hearts: number }) => void
  onEnd?: () => void
  onVoice?: (packet: ArrayBuffer) => void
  onError?: (why: string) => void
}

export class LiveConn {
  private ws: WebSocket | null = null
  private closed = false
  private retry = 1000
  constructor(
    private sim: string,
    private live: string,
    private on: LiveHandlers,
  ) {
    this.open()
  }
  private open() {
    const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/live')
    ws.binaryType = 'arraybuffer'
    this.ws = ws
    ws.onopen = () => {
      this.retry = 1000
      ws.send(JSON.stringify({ t: 'hello', token: token(), sim: this.sim, mode: 'tikilive', race: this.live, lang: lang() }))
    }
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) return this.on.onVoice?.(e.data)
      let m: Record<string, unknown>
      try {
        m = JSON.parse(e.data as string)
      } catch {
        return
      }
      if (m.t === 'say') this.on.onSay?.({ id: m.id as string, n: m.n as string, s: m.s as string, host: !!m.host, at: Date.now() })
      else if (m.t === 'heart') this.on.onHeart?.(m.hearts as number)
      else if (m.t === 'doing') this.on.onDoing?.({ s: m.s as string, p: m.p as Pose, mic: !!m.mic, viewers: m.viewers as number, hearts: m.hearts as number })
      else if (m.t === 'tikiend') {
        this.closed = true
        this.on.onEnd?.()
      }
    }
    ws.onclose = (e) => {
      this.ws = null
      if (this.closed) return
      // Ended or full: said once; else (the network) again in a moment.
      if (e.reason) {
        this.closed = true
        return this.on.onError?.(e.reason)
      }
      setTimeout(() => !this.closed && this.open(), this.retry)
      this.retry = Math.min(this.retry * 2, 15000)
    }
  }
  private sendJSON(v: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(v))
  }
  say(s: string) {
    this.sendJSON({ t: 'say', s })
  }
  heart() {
    this.sendJSON({ t: 'heart' })
  }
  doing(s: string, p: Pose, mic: boolean) {
    this.sendJSON({ t: 'doing', s, p, mic })
  }
  voice(packet: Uint8Array) {
    if (this.ws?.readyState === WebSocket.OPEN && this.ws.bufferedAmount < 64000) this.ws.send(packet)
  }
  close() {
    this.closed = true
    this.ws?.close()
  }
}

/* ---------- The streamer's microphone, coded to Opus ---------- */

export class Mic {
  private stream: MediaStream | null = null
  private ctx: AudioContext | null = null
  private enc: AudioEncoder | null = null
  private node: ScriptProcessorNode | null = null
  private t = 0
  /** How loud it is now (0–1), for the little bars on screen. */
  level = 0
  constructor(private send: (packet: Uint8Array) => void) {}
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
    const enc = new AudioEncoder({
      output: (chunk) => {
        const b = new Uint8Array(chunk.byteLength)
        chunk.copyTo(b)
        this.send(b)
      },
      error: () => this.stop(),
    })
    enc.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 1, bitrate: 24000 })
    this.enc = enc
    // The microphone's samples, a block at a time (a script node: it works in every WebView).
    const ctx = new AudioContext({ sampleRate: 48000 })
    this.ctx = ctx
    const src = ctx.createMediaStreamSource(this.stream)
    const node = ctx.createScriptProcessor(2048, 1, 1)
    node.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0)
      let peak = 0
      for (let i = 0; i < data.length; i += 16) peak = Math.max(peak, Math.abs(data[i]))
      this.level = this.level * 0.7 + peak * 0.3
      if (enc.state !== 'configured') return
      const frame = new AudioData({ format: 'f32', sampleRate: ctx.sampleRate, numberOfFrames: data.length, numberOfChannels: 1, timestamp: this.t, data: new Float32Array(data) })
      this.t += (data.length / ctx.sampleRate) * 1e6
      enc.encode(frame)
      frame.close()
    }
    src.connect(node)
    // (A script node only runs connected to the output: through a silent gain.)
    const mute = ctx.createGain()
    mute.gain.value = 0
    node.connect(mute).connect(ctx.destination)
    this.node = node
  }
  stop() {
    this.node?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    if (this.enc && this.enc.state !== 'closed') this.enc.close()
    void this.ctx?.close()
    this.stream = this.ctx = this.enc = this.node = null
    this.level = 0
  }
}

/* ---------- A viewer's speaker: the streamer's voice decoded and played, a moment behind ---------- */

export class Speaker {
  private ctx: AudioContext
  private dec: AudioDecoder
  private at = 0
  private t = 0
  muted = false
  /** How many packets were decoded, and the decoder's error if it gave up (for tests). */
  decoded = 0
  failed = ''
  constructor() {
    this.ctx = new AudioContext({ sampleRate: 48000 })
    this.dec = new AudioDecoder({
      output: (d) => {
        // (Always released: the decoder holds only a few frames out at once, and stops when they aren't given back.)
        try {
          const buf = this.ctx.createBuffer(1, d.numberOfFrames, d.sampleRate)
          d.copyTo(buf.getChannelData(0), { planeIndex: 0, format: 'f32-planar' })
          this.decoded++
          if (this.muted) return
          const src = this.ctx.createBufferSource()
          src.buffer = buf
          src.connect(this.ctx.destination)
          // Played one after the other, 150 ms behind; caught up if it fell behind (a pause, a slow phone).
          const now = this.ctx.currentTime
          if (this.at < now + 0.05 || this.at > now + 0.8) this.at = now + 0.15
          src.start(this.at)
          this.at += buf.duration
        } catch (e) {
          this.failed = String(e)
        } finally {
          d.close()
        }
      },
      error: (e) => (this.failed = String(e)),
    })
    this.dec.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 1 })
  }
  /** On a tap (the phones play no sound before one). */
  wake() {
    void this.ctx.resume()
  }
  get waiting() {
    return this.ctx.state !== 'running'
  }
  play(packet: ArrayBuffer) {
    if (this.dec.state !== 'configured') return
    this.dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: this.t, data: packet }))
    this.t += 20000
  }
  close() {
    if (this.dec.state !== 'closed') this.dec.close()
    void this.ctx.close()
  }
}

/* ---------- The streamer's live, kept while it plays (Play's LiveBar) ---------- */

type Hosting = { live: TikiLive; conn: LiveConn; mic: Mic | null; says: LiveSay[]; viewers: number; hearts: number }
let hosting: Hosting | null = null
const listeners = new Set<() => void>()
const changed = () => {
  if (hosting) hosting = { ...hosting }
  listeners.forEach((f) => f())
}
export const useHosting = () =>
  useSyncExternalStore(
    (f) => (listeners.add(f), () => void listeners.delete(f)),
    () => hosting,
  )

/** Going live: the live made on the server, the connection to it opened. */
export async function goLive(sim: string, title: string, stage: string) {
  if (hosting) return hosting.live
  const live = await startLive(sim, title, stage)
  const conn = new LiveConn(sim, sim, {
    onSay: (s) => {
      if (!hosting) return
      hosting.says = [...hosting.says.slice(-40), s]
      changed()
    },
    onHeart: (h) => {
      if (!hosting) return
      hosting.hearts = h
      changed()
    },
    onDoing: (d) => {
      if (!hosting) return
      hosting.viewers = d.viewers
      hosting.hearts = d.hearts
      changed()
    },
    onEnd: () => endLive(sim, false),
  })
  hosting = { live, conn, mic: null, says: [], viewers: 0, hearts: 0 }
  changed()
  return live
}

/** The microphone on or off (asked for the first time it's opened). */
export async function setMic(on: boolean) {
  if (!hosting) return
  if (!on) {
    hosting.mic?.stop()
    hosting.mic = null
    return changed()
  }
  if (hosting.mic) return
  const h = hosting
  const mic = new Mic((p) => h.conn.voice(p))
  await mic.start()
  h.mic = mic
  changed()
}

/** What the Sim is doing now, to the viewers (Play's LiveBar, every couple of seconds). */
export function tellDoing(s: string, p: Pose) {
  hosting?.conn.doing(s, p, !!hosting.mic)
}

export async function endLive(sim: string, tellServer = true) {
  const h = hosting
  if (!h) return
  hosting = null
  h.mic?.stop()
  h.conn.close()
  changed()
  if (tellServer) await stopLive(sim).catch(() => undefined)
}
