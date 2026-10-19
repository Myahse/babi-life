import { clockSample, localNow, serverNow } from '../lib/worldClock'
import type { Look } from '../lib/types'

// Racing other players at Babi Karting. The API puts the players who paid
// for a race in the same few seconds on one grid (backend/internal/kart);
// during the race each phone drives its own kart and sends it over the live
// WebSocket (mode "kart"), about fifteen times a second, and draws the
// others a moment in the past, between two of their updates. The empty
// places on the grid are the quarter's drivers: the first player on the
// grid drives them and sends them too; if that player goes, the next one
// takes the wheel. Bananas and coconuts are sent the moment they're thrown.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'
/** Others are drawn this far behind their latest news (ms). */
const DELAY = 160
/** A player not heard from for this long has left the race. */
const GONE = 6000

export type GridEntry = { sim: string; name: string; gender: 'femme' | 'homme'; look: Look; slot: number }
export type OnlineRace = { id: string; start: number; entries: GridEntry[] }

type Snap = { at: number; k: number[] }
type Drop = { kind: 'banane' | 'coco'; x: number; z: number; s: number; d: number; id: string }

export class KartNet {
  private ws: WebSocket | null = null
  private closed = false
  private timers: ReturnType<typeof setInterval>[] = []
  private snaps = new Map<string, Snap[]>()
  private bots: { at: number; b: number[][] }[] = []
  private heard = new Map<string, number>()
  /** Items the others threw, waiting to be put on the track here. */
  readonly drops: Drop[] = []
  connected = false

  constructor(
    private token: string,
    private sim: string,
    private race: string,
  ) {
    this.open()
  }

  private open() {
    const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/live')
    this.ws = ws
    ws.onopen = () => {
      this.connected = true
      ws.send(JSON.stringify({ t: 'hello', token: this.token, sim: this.sim, mode: 'kart', race: this.race }))
      const ping = () => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'ping', c: localNow() }))
      ;[200, 700, 1500].forEach((d) => setTimeout(ping, d))
      this.timers.push(setInterval(ping, 10000))
    }
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data as string)
      if (m.t === 'pong') clockSample(m.c, m.s, localNow())
      else if (m.t === 'leave') {
        this.snaps.delete(m.id)
        this.heard.delete(m.id)
      } else if (m.t === 'drop' && m.d) this.drops.push({ ...(m.d as Drop), id: `${m.id}:${(m.d as Drop).id}` })
      else if (m.t === 'states')
        for (const s of m.players as { id: string; at: number; k?: number[]; b?: number[][] }[]) {
          if (s.id === this.sim || !s.k) continue
          this.heard.set(s.id, s.at)
          const list = this.snaps.get(s.id) ?? []
          if (list.length && list[list.length - 1].at >= s.at) continue
          list.push({ at: s.at, k: s.k })
          if (list.length > 10) list.shift()
          this.snaps.set(s.id, list)
          if (s.b?.length) {
            this.bots.push({ at: s.at, b: s.b })
            if (this.bots.length > 10) this.bots.shift()
          }
        }
    }
    ws.onclose = () => {
      this.connected = false
      this.timers.forEach(clearInterval)
      this.timers = []
      if (!this.closed) setTimeout(() => !this.closed && this.open(), 1000)
    }
  }

  /** This phone's kart (and the drivers it drives, when it's the host). */
  send(k: number[], bots?: number[][]) {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({ t: 'state', x: k[0], y: 0, z: k[1], h: k[2], p: 'kart', k: k.map(r2), ...(bots?.length ? { b: bots.map((b) => b.map(r2)) } : {}) }))
  }

  drop(d: Drop) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'drop', d }))
  }

  /** Another player's kart now, on this screen (between two updates); null if not heard from. */
  sample(id: string): number[] | null {
    return lerpSnaps(this.snaps.get(id))
  }

  /** The drivers the host drives, now; null if nobody sends them. */
  sampleBots(): number[][] | null {
    const list = this.bots
    if (!list.length || serverNow() - list[list.length - 1].at > GONE) return null
    const t = serverNow() - DELAY
    let i = list.findIndex((s) => s.at > t)
    if (i === -1) return list[list.length - 1].b
    if (i === 0) return list[0].b
    const [a, b] = [list[i - 1], list[i]]
    const f = Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at || 1)))
    return a.b.map((v, j) => (b.b[j] ? lerpVec(v, b.b[j], f) : v))
  }

  /** Whether a player is still in the race (heard from lately). */
  here(id: string) {
    const at = this.heard.get(id)
    return at !== undefined && serverNow() - at < GONE
  }

  close() {
    this.closed = true
    this.timers.forEach(clearInterval)
    this.ws?.close()
  }
}

const r2 = (v: number) => Math.round(v * 100) / 100

function lerpSnaps(list: Snap[] | undefined): number[] | null {
  if (!list?.length) return null
  const t = serverNow() - DELAY
  if (t - list[list.length - 1].at > GONE) return null
  let i = list.findIndex((s) => s.at > t)
  if (i === -1) return list[list.length - 1].k
  if (i === 0) return list[0].k
  const [a, b] = [list[i - 1], list[i]]
  return lerpVec(a.k, b.k, Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at || 1))))
}

/** Between two kart vectors: positions and speeds blend, the heading the short way round, the rest jumps. */
function lerpVec(a: number[], b: number[], f: number) {
  return a.map((v, j) => {
    if (j === 2 || j === 7) return v + Math.atan2(Math.sin(b[j] - v), Math.cos(b[j] - v)) * f
    if (j <= 4 || j === 8) return v + (b[j] - v) * f
    return f < 0.5 ? v : b[j]
  })
}

/** Join the next grid at Babi Karting (the race must be paid for: the Sim's activity). */
export async function joinRace(token: string, simId: string): Promise<OnlineRace> {
  const res = await fetch(`${BASE}/sims/${simId}/kart/join`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Le karting ne répond pas')
  const { race, now } = (await res.json()) as { race: OnlineRace; now: number }
  clockSample(localNow(), now, localNow())
  return race
}

/** The grid as it fills, during the wait. */
export async function fetchRace(token: string, id: string): Promise<OnlineRace | null> {
  const res = await fetch(`${BASE}/kart/${id}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  return ((await res.json()) as { race: OnlineRace }).race
}
