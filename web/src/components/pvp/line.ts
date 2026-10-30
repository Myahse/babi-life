import { clockSample, localNow } from '../../lib/worldClock'

// The line between the phones of a game against a player (update
// « jeux-en-ligne »): the live hub's "pvp" room (backend live.go). Each phone
// sends a few numbers (k: its hands, or its score) as often as the hub takes
// them; the one who runs the game (the first player) sends the game too (b).
// It opens again by itself if it drops; the other not heard for GONE: gone.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'
const GONE = 8000

export type Heard = { at: number; k: number[]; b: number[][] | null }

export class PvpLine {
  private ws: WebSocket | null = null
  private closed = false
  private timers: ReturnType<typeof setInterval>[] = []
  private heardAt = 0
  private opened = 0
  private lastSend = 0
  /** The other's latest: its numbers, and the game if it runs it. */
  heard: Heard | null = null
  connected = false

  constructor(
    private token: string,
    private sim: string,
    private match: string,
  ) {
    this.open()
  }

  private open() {
    const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/live')
    this.ws = ws
    ws.onopen = () => {
      this.connected = true
      this.opened = localNow()
      ws.send(JSON.stringify({ t: 'hello', token: this.token, sim: this.sim, mode: 'pvp', race: this.match }))
      const ping = () => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'ping', c: localNow() }))
      ;[200, 700].forEach((d) => setTimeout(ping, d))
      this.timers.push(setInterval(ping, 10000))
    }
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data as string)
      if (m.t === 'pong') clockSample(m.c, m.s, localNow())
      else if (m.t === 'states')
        for (const s of m.players as { id: string; at: number; k?: number[]; b?: number[][] }[]) {
          if (s.id === this.sim) continue
          this.heardAt = localNow()
          if (!this.heard || s.at > this.heard.at) this.heard = { at: s.at, k: s.k ?? [], b: s.b?.length ? s.b : (this.heard?.b ?? null) }
        }
    }
    ws.onclose = () => {
      this.connected = false
      this.timers.forEach(clearInterval)
      this.timers = []
      if (!this.closed) setTimeout(() => !this.closed && this.open(), 1000)
    }
  }

  /** The other one is there (heard lately). */
  get there() {
    return this.heardAt > 0 && localNow() - this.heardAt < GONE
  }
  /** Gone: heard once, then nothing for a while; or never heard, long after the line opened. */
  get gone() {
    const now = localNow()
    return this.heardAt > 0 ? now - this.heardAt > GONE : this.opened > 0 && now - this.opened > 30000
  }

  /** This phone's numbers, and the game if it runs it (at most every 55 ms: the hub takes 20 a second). */
  send(k: number[], b?: number[][]) {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    const now = localNow()
    if (now - this.lastSend < 55) return
    this.lastSend = now
    this.ws.send(JSON.stringify({ t: 'state', x: 0, y: 0, z: 0, h: 0, p: 'idle', k: k.map((v) => Math.round(v * 1000) / 1000), ...(b ? { b } : {}) }))
  }

  close() {
    this.closed = true
    this.timers.forEach(clearInterval)
    this.ws?.close()
  }
}
