import { clockSample, localNow, serverNow } from '../lib/worldClock'
import type { CourtEntry } from '../streetball/online'

// Tennis and volleyball against the other players at a court (backend/internal/court: two at a tennis
// court, twelve at the Palais' volleyball, four on a beach), as streetball/online.ts does football: over
// the live WebSocket (mode "match"), every phone sends its hands (the stick and the buttons held); the
// first player still there runs the match for everyone (the AI included) and sends it whole about fifteen
// times a second, in rows of numbers (each sport's encode). The others lay the latest on their game and
// coast between two (the ball flown, the players carried on their run: each sport's coast), so it moves
// smoothly; the host's word on the screen (a call) comes as a "drop".

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'
const GONE = 4000

export type Wire<G> = { encode: (g: G) => number[][]; decode: (g: G, rows: number[][]) => void }

export class SportNet {
  private ws: WebSocket | null = null
  private closed = false
  private timers: ReturnType<typeof setInterval>[] = []
  private heard = new Map<string, number>()
  private hands = new Map<string, number[]>()
  private snap: { from: string; at: number; b: number[][]; used: boolean } | null = null
  private flash: string | null = null
  private opened = serverNow()
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
      this.opened = serverNow()
      ws.send(JSON.stringify({ t: 'hello', token: this.token, sim: this.sim, mode: 'match', race: this.match }))
      const ping = () => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'ping', c: localNow() }))
      ;[200, 700, 1500].forEach((d) => setTimeout(ping, d))
      this.timers.push(setInterval(ping, 10000))
    }
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data as string)
      if (m.t === 'pong') clockSample(m.c, m.s, localNow())
      else if (m.t === 'leave') this.heard.delete(m.id)
      else if (m.t === 'drop' && typeof m.d?.f === 'string') this.flash = m.d.f
      else if (m.t === 'states')
        for (const s of m.players as { id: string; at: number; k?: number[]; b?: number[][] }[]) {
          if (s.id === this.sim) continue
          this.heard.set(s.id, s.at)
          if (s.k?.length) this.hands.set(s.id, s.k)
          if (s.b?.length && s.at > (this.snap?.at ?? 0)) this.snap = { from: s.id, at: s.at, b: s.b, used: false }
        }
    }
    ws.onclose = () => {
      this.connected = false
      this.timers.forEach(clearInterval)
      this.timers = []
      if (!this.closed) setTimeout(() => !this.closed && this.open(), 1000)
    }
  }

  here(sim: string) {
    if (sim === this.sim) return true
    const at = this.heard.get(sim)
    return at !== undefined && serverNow() - at < GONE
  }

  /** Who runs the match: the first in the list still there (nobody while the line isn't open a second yet). */
  host(entries: CourtEntry[]): string | null {
    if (!this.connected || serverNow() - this.opened < 1000) return null
    return entries.find((e) => e.sim === this.sim || this.here(e.sim))?.sim ?? this.sim
  }

  /** This phone's hands (numbers), and the whole match if it runs it. */
  send(k: number[], rows: number[][] | null) {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({ t: 'state', x: 0, y: 0, z: 0, h: 0, p: 'idle', k: k.map(r2), ...(rows ? { b: rows } : {}) }))
  }

  say(text: string) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'drop', d: { f: text } }))
  }

  /** The other humans' hands by slot. */
  inputs(entries: CourtEntry[]): Map<number, number[]> {
    const out = new Map<number, number[]>()
    for (const e of entries) if (e.sim !== this.sim && this.here(e.sim)) out.set(e.slot, this.hands.get(e.sim) ?? [])
    return out
  }

  /** The host's latest match, once (null if nothing new); `host` must have sent it. */
  take(host: string): number[][] | null {
    const s = this.snap
    if (!s || s.used || s.from !== host || serverNow() - s.at > GONE) return null
    s.used = true
    return s.b
  }

  /** The host's word since the last call. */
  word(): string | null {
    const f = this.flash
    this.flash = null
    return f
  }

  close() {
    this.closed = true
    this.timers.forEach(clearInterval)
    this.ws?.close()
  }
}

export const r2 = (v: number) => Math.round(v * 100) / 100
