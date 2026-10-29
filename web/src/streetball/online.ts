import { clockSample, localNow, serverNow } from '../lib/worldClock'
import type { Look } from '../lib/types'
import type { Pose } from '../avatar/Human'
import { GESTES, NO_INPUT, type Act, type Game, type Input, type Moment } from './game'

// Playing at a court with other players. The API puts everyone who starts
// playing at the same pitch or court in one match, up to the sport's places
// (backend/internal/court): ten for football, six for basketball, twenty-two
// at the stadium's eleven against eleven (foot11, on the console's rules,
// each in its own place), the rest AI. Over the live WebSocket (mode "match") every phone sends its hands
// (the stick, and how many times each button was pressed, so a press is
// never lost or played twice); the first player still there runs the match
// for everyone, the AI included, and sends it whole about thirteen times a
// second. The others draw what it sends. If it goes, the next one takes over
// from the last state it had.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'
/** A player not heard from for this long has left the court. */
const GONE = 4000

export type CourtEntry = { sim: string; name: string; gender: 'femme' | 'homme'; look: Look; slot: number }
export type CourtMatch = { id: string; place: string; sport: 'foot' | 'basket' | 'foot11'; start: number; end: number; cap: number; entries: CourtEntry[] }

/** The poses and moves, by number on the wire. */
const POSES: Pose[] = ['idle', 'walk', 'run', 'dribble', 'pass', 'bouncepass', 'shoot', 'dunk', 'layup', 'crossover', 'steal', 'block', 'slide', 'stumble', 'kick', 'keeper', 'dive', 'airplane', 'cheer', 'guard', 'mark', 'touch', 'hang', 'leap', 'stepover', 'roulette', 'poke', 'rainbow', 'feint', 'flick', 'backheel', 'juggle', 'nutmegged', 'lookup', 'flinch']
const ACTS: Act[] = ['none', 'pass', 'shoot', 'dunk', 'layup', 'cross', 'steal', 'block', 'slide', 'beaten', 'kick', 'dive', 'hold', 'celebrate', 'cheer', 'head', 'throw', 'geste', 'juggle']
const MOMENTS: Moment['kind'][] = ['dunk', 'basket', 'three', 'goal', 'block', 'steal', 'ankle', 'save', 'tackle', 'post', 'geste', 'gbe']
const PHASES: Game['phase'][] = ['count', 'play', 'dead', 'over']
const SETS: NonNullable<Game['set']>['kind'][] = ['free', 'pen', 'corner', 'throw', 'goal']

/**
 * The buttons, counted: what a phone sends (k) and what the host makes of it.
 * The console's (the stadium's eleven): the through ball and the lob counted
 * too, the sprint and Tir held (undefined: the street's tap). Le foot de rue:
 * the moves counted (and the last one's kind), the keepy-ups held.
 */
type Hands = { mx: number; mz: number; pass: number; shoot: number; skill: number; defend: number; guard: boolean; through: number; lob: number; sprint?: boolean; charge?: boolean; geste: number; kind: number; juggle: boolean }

export class MatchNet {
  private ws: WebSocket | null = null
  private closed = false
  private timers: ReturnType<typeof setInterval>[] = []
  private heard = new Map<string, number>()
  private hands = new Map<string, Hands>()
  private used = new Map<string, Hands>()
  /** The latest match each phone sent: only the host's is drawn (a newcomer may send one for a moment). */
  private snaps = new Map<string, { at: number; b: number[][] }>()
  private flash: string | null = null
  private opened = serverNow()
  /** This phone's presses so far. */
  private presses = { pass: 0, shoot: 0, skill: 0, defend: 0, through: 0, lob: 0, geste: 0, kind: 0 }
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
          if (s.k?.length) this.hands.set(s.id, { mx: s.k[0], mz: s.k[1], pass: s.k[2], shoot: s.k[3], skill: s.k[4], defend: s.k[5], guard: s.k[6] > 0, through: s.k[7] ?? 0, lob: s.k[8] ?? 0, ...(s.k.length > 10 ? { sprint: s.k[9] > 0, charge: s.k[10] < 0 ? undefined : s.k[10] > 0 } : {}), geste: s.k[11] ?? 0, kind: s.k[12] ?? 0, juggle: (s.k[13] ?? 0) > 0 })
          if (s.b?.length && s.at > (this.snaps.get(s.id)?.at ?? 0)) this.snaps.set(s.id, { at: s.at, b: s.b })
        }
    }
    ws.onclose = () => {
      this.connected = false
      this.timers.forEach(clearInterval)
      this.timers = []
      if (!this.closed) setTimeout(() => !this.closed && this.open(), 1000)
    }
  }

  /** Whether a player is still on the court (heard from lately). */
  here(sim: string) {
    if (sim === this.sim) return true
    const at = this.heard.get(sim)
    return at !== undefined && serverNow() - at < GONE
  }

  /**
   * Who runs the match: the first player in the list still there. Off the
   * line, and for the first second on it, nobody: the others haven't been
   * heard yet, and this phone would think it's alone and start a match of
   * its own (a slow network can take seconds to open the line).
   */
  host(entries: CourtEntry[]): string | null {
    if (!this.connected || serverNow() - this.opened < 1000) return null
    return entries.find((e) => e.sim === this.sim || this.here(e.sim))?.sim ?? this.sim
  }

  /** Count this phone's presses (called before the match steps them away). */
  press(i: Input) {
    if (i.pass) this.presses.pass++
    if (i.shoot) this.presses.shoot++
    if (i.skill) this.presses.skill++
    if (i.defend) this.presses.defend++
    if (i.through) this.presses.through++
    if (i.lob) this.presses.lob++
    if (i.geste) {
      this.presses.geste++
      this.presses.kind = GESTES.indexOf(i.geste)
    }
  }

  /** This phone's hands, and the whole match if it runs it. */
  send(i: Input, at: [number, number], g: Game | null) {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    const k = [r2(i.mx), r2(i.mz), this.presses.pass, this.presses.shoot, this.presses.skill, this.presses.defend, i.guard ? 1 : 0, this.presses.through, this.presses.lob, i.sprint ? 1 : 0, i.charge === undefined ? -1 : i.charge ? 1 : 0, this.presses.geste, this.presses.kind, i.juggle ? 1 : 0]
    this.ws.send(JSON.stringify({ t: 'state', x: r2(at[0]), y: 0, z: r2(at[1]), h: 0, p: 'idle', k, ...(g ? { b: encode(g) } : {}) }))
  }

  /** The host says what to read on everyone's screen (a goal, a dunk). */
  say(text: string) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'drop', d: { f: text } }))
  }

  /** The other humans' hands, by player index, for the host's step: a button counts once per press. */
  inputs(entries: CourtEntry[]): Map<number, Input> {
    const out = new Map<number, Input>()
    for (const e of entries) {
      if (e.sim === this.sim) continue
      const h = this.hands.get(e.sim)
      if (!h || !this.here(e.sim)) {
        out.set(e.slot, NO_INPUT)
        continue
      }
      const was = this.used.get(e.sim) ?? h
      out.set(e.slot, { mx: h.mx, mz: h.mz, guard: h.guard, pass: h.pass > was.pass, shoot: h.shoot > was.shoot, skill: h.skill > was.skill, defend: h.defend > was.defend, through: h.through > was.through, lob: h.lob > was.lob, sprint: h.sprint, charge: h.charge, geste: h.geste > was.geste ? (GESTES[h.kind] ?? null) : null, juggle: h.juggle })
      this.used.set(e.sim, h)
    }
    return out
  }

  /** Lay the host's latest match on this phone's game; false if none came lately. */
  apply(g: Game, host: string): boolean {
    const s = this.snaps.get(host)
    if (!s || serverNow() - s.at > GONE) return false
    decode(g, s.b)
    if (this.flash) {
      g.flash = { text: this.flash, t: g.time }
      this.flash = null
    }
    return true
  }

  close() {
    this.closed = true
    this.timers.forEach(clearInterval)
    this.ws?.close()
  }
}

const r2 = (v: number) => Math.round(v * 100) / 100

/** The match in a few rows of numbers: the clock and the ball, the last big moment, each player; then the set piece waiting and the referee. */
function encode(g: Game): number[][] {
  const b = g.ball
  const last = g.moments[g.moments.length - 1]
  const sp = g.set
  return [
    [r2(g.time), PHASES.indexOf(g.phase), g.score[0], g.score[1], r2(b.x), r2(b.y), r2(b.z), r2(b.vx), r2(b.vz), b.owner, b.dead ? 1 : 0, r2(g.gbe), r2(g.rim.t), r2(g.rim.amp), r2(g.swish), g.poss * 2 + (g.cleared ? 1 : 0)],
    last ? [g.moments.length, MOMENTS.indexOf(last.kind), last.team, last.by, r2(last.t)] : [0],
    ...g.ps.map((p) => [r2(p.x), r2(p.z), r2(p.face), r2(p.vx), r2(p.vz), Math.max(0, POSES.indexOf(p.pose)), Math.max(0, ACTS.indexOf(p.act)), r2(p.at), p.flip ? 1 : 0, p.side, r2(p.call), r2(p.style), p.take]),
    [sp ? SETS.indexOf(sp.kind) + 1 : 0, sp?.team ?? 0, sp?.taker ?? -1, r2(g.ref.x), r2(g.ref.z), r2(g.ref.face)],
  ]
}

function decode(g: Game, rows: number[][]) {
  const [t, b, ps, more] = [rows[0], rows[1], rows.slice(2, 2 + g.ps.length), rows[2 + g.ps.length]]
  g.time = t[0]
  g.phase = PHASES[t[1]] ?? g.phase
  g.score = [t[2], t[3]]
  Object.assign(g.ball, { x: t[4], y: t[5], z: t[6], vx: t[7], vz: t[8], owner: t[9], dead: t[10] > 0 })
  // Not the flight itself (the host's step needs it whole, this phone only
  // draws): if this phone takes over the match, the ball falls from where it is.
  g.ball.flight = null
  if (t[11]) g.gbe = t[11]
  g.rim = { t: t[12], amp: t[13] }
  g.swish = t[14]
  g.poss = (t[15] >> 1) as 0 | 1
  g.cleared = (t[15] & 1) === 1
  // A new big moment: the crowd films it here too.
  while (b[0] > g.moments.length) g.moments.push({ kind: MOMENTS[b[1]] ?? 'basket', team: b[2] as 0 | 1, by: b[3], t: b[4] })
  ps.forEach((r, i) => {
    const p = g.ps[i]
    if (!p) return
    // Smoothly to where the host has it: updates come every 75 ms, the screen draws at 60 fps.
    const far = Math.hypot(r[0] - p.x, r[1] - p.z) > 3
    p.x = far ? r[0] : p.x + (r[0] - p.x) * 0.5
    p.z = far ? r[1] : p.z + (r[1] - p.z) * 0.5
    p.face = r[2]
    p.vx = r[3]
    p.vz = r[4]
    p.pose = POSES[r[5]] ?? 'idle'
    p.act = ACTS[r[6]] ?? 'none'
    p.at = r[7]
    p.flip = r[8] > 0
    p.side = r[9] < 0 ? -1 : 1
    p.call = r[10]
    if (r.length > 12) {
      p.style = r[11]
      p.take = r[12]
    }
  })
  // The set piece (for whoever takes it: what to do) and the referee where the host has him.
  if (more) {
    const kind = SETS[more[0] - 1]
    g.set = kind ? { kind, team: more[1] as 0 | 1, taker: more[2], at: [g.ball.x, g.ball.z], t: g.set?.kind === kind && g.set.taker === more[2] ? g.set.t : g.time } : null
    g.ref.x = more[3]
    g.ref.z = more[4]
    g.ref.face = more[5]
  }
}

async function call<T>(token: string, path: string, method = 'GET'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: method === 'POST' ? '{}' : undefined })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Le terrain ne répond pas')
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** The match at the court where the Sim plays (it took a place when it started playing). */
export async function joinMatch(token: string, simId: string): Promise<CourtMatch> {
  const { match, now } = await call<{ match: CourtMatch; now: number }>(token, `/sims/${simId}/court/join`, 'POST')
  clockSample(localNow(), now, localNow())
  return match
}

/** The match as it stands (players come during the wait, and during play). */
export async function fetchMatch(token: string, id: string): Promise<CourtMatch | null> {
  return call<{ match: CourtMatch }>(token, `/court/${id}`)
    .then((r) => r.match)
    .catch(() => null)
}

/** Off the court: the place goes to someone else. */
export function leaveMatch(token: string, simId: string, id: string) {
  return call(token, `/sims/${simId}/court/${id}/leave`, 'POST').catch(() => undefined)
}
