import { clockSample, localNow } from '../../../lib/worldClock'
import { NO_PAD, type Act, type Fight, type Fighter, type MoveId, type Pad, type Phase } from './engine'

// The street fight between two players (update « combat-joueurs », backend
// sims/duel.go): both phones in the live hub's "fight" room. The one who
// challenged runs the fight (its own fighter first) and sends it whole as
// often as the hub lets it; the other sends its hands (the stick held, and
// how many times each button was pressed, so a press is never lost or played
// twice), steps the fight on its own between two sends so it never stalls,
// and takes the host's fight each time one comes, seen from its side (its
// fighter first).

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'
/** The other one not heard from for this long: gone. */
const GONE = 8000

const PHASES: Phase[] = ['intro', 'fight', 'ko', 'timeup', 'over']
const ACTS: Act[] = ['stance', 'walk', 'back', 'crouch', 'jump', 'dash', 'backdash', 'attack', 'block', 'hit', 'air', 'down', 'getup', 'thrown', 'ko', 'win']
const MOVE_IDS: (MoveId | null)[] = [null, 'jab', 'cross', 'uppercut', 'highkick', 'lowpunch', 'sweep', 'airpunch', 'airkick', 'throw', 'super']
const SAYS = ['', 'Dernier round', 'Combat !', 'Double K.O. !', 'K.O. !', 'Temps écoulé', 'Victoire !', 'Match nul', 'Défaite']
/** Seen from the other side: the one's victory is the other's defeat. */
const FLIP: Record<string, string> = { 'Victoire !': 'Défaite', Défaite: 'Victoire !' }

const r3 = (v: number) => Math.round(v * 1000) / 1000
const sayCode = (s: string) => (s.startsWith('Round ') ? 100 + Number(s.slice(6)) : Math.max(0, SAYS.indexOf(s)))
const sayText = (n: number) => (n >= 100 ? `Round ${n - 100}` : (SAYS[n] ?? ''))

function packFighter(f: Fighter): number[] {
  return [r3(f.x), r3(f.y), r3(f.vx), r3(f.vy), f.face, r3(f.hp), r3(f.meter), ACTS.indexOf(f.act), r3(f.t), MOVE_IDS.indexOf(f.move), f.hit ? 1 : 0, r3(f.stun), f.low ? 1 : 0, f.guard ? 1 : 0, f.combo, f.take, r3(f.invuln), f.dead ? 1 : 0]
}

function unpackFighter(f: Fighter, v: number[]) {
  const take = v[15]
  Object.assign(f, { x: v[0], y: v[1], vx: v[2], vy: v[3], face: v[4] < 0 ? -1 : 1, hp: v[5], meter: v[6], act: ACTS[v[7]] ?? 'stance', t: v[8], move: MOVE_IDS[v[9]] ?? null, hit: v[10] > 0, stun: v[11], low: v[12] > 0, guard: v[13] > 0, combo: v[14], invuln: v[16], dead: v[17] > 0 })
  // A new act there: a new pose here too (Scene.tsx starts it over when take changes).
  if (take !== f.take) f.take = take
}

/** The fight, as numbers: the round, the clock and what's said; each fighter. */
function pack(F: Fight): number[][] {
  return [[PHASES.indexOf(F.phase), r3(F.phaseT), F.round, F.wins[0], F.wins[1], r3(F.clock), r3(F.freeze), r3(F.slow), r3(F.flash), F.roundWinner, sayCode(F.said), r3(F.saidAt), r3(F.time), r3(F.dealt[0]), r3(F.dealt[1])], packFighter(F.f[0]), packFighter(F.f[1])]
}

/** The host's fight into this phone's, its own fighter first. */
function unpack(F: Fight, b: number[][]) {
  const [g, a, c] = b
  if (!g || !a || !c) return
  F.phase = PHASES[g[0]] ?? 'fight'
  F.phaseT = g[1]
  F.round = g[2]
  F.wins = [g[4], g[3]]
  F.clock = g[5]
  F.freeze = g[6]
  F.slow = g[7]
  F.flash = g[8]
  F.roundWinner = g[9] === -1 ? -1 : g[9] === 0 ? 1 : 0
  const said = sayText(g[10])
  F.said = FLIP[said] ?? said
  F.saidAt = g[11]
  F.time = g[12]
  F.dealt = [g[14], g[13]]
  unpackFighter(F.f[0], c)
  unpackFighter(F.f[1], a)
}

export class FightNet {
  private ws: WebSocket | null = null
  private closed = false
  private timers: ReturnType<typeof setInterval>[] = []
  private heardAt = 0
  private opened = 0
  /** The other one's hands, and the presses already played. */
  private hands: number[] = []
  private used = [0, 0, 0]
  /** This phone's presses so far. */
  private presses = [0, 0, 0]
  private snap: { at: number; b: number[][] } | null = null
  private applied = 0
  private lastSend = 0
  connected = false

  constructor(
    private token: string,
    private sim: string,
    private duel: string,
    /** This phone runs the fight (it challenged). */
    readonly host: boolean,
  ) {
    this.open()
  }

  private open() {
    const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/live')
    this.ws = ws
    ws.onopen = () => {
      this.connected = true
      this.opened = localNow()
      ws.send(JSON.stringify({ t: 'hello', token: this.token, sim: this.sim, mode: 'fight', race: this.duel }))
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
          if (s.k?.length) this.hands = s.k
          if (!this.host && s.b?.length && s.at > (this.snap?.at ?? 0)) this.snap = { at: s.at, b: s.b }
        }
    }
    ws.onclose = () => {
      this.connected = false
      this.timers.forEach(clearInterval)
      this.timers = []
      if (!this.closed) setTimeout(() => !this.closed && this.open(), 1000)
    }
  }

  /** The other one is there (heard lately); before it's been heard at all, waiting for it. */
  get there() {
    return this.heardAt > 0 && localNow() - this.heardAt < GONE
  }
  /** Gone: heard once, then nothing for a while; or never heard, long after the line opened. */
  get gone() {
    const now = localNow()
    return this.heardAt > 0 ? now - this.heardAt > GONE : this.opened > 0 && now - this.opened > 30000
  }

  /** Count this phone's presses (before the pad's presses are cleared). */
  press(p: Pad) {
    if (p.punch) this.presses[0]++
    if (p.kick) this.presses[1]++
    if (p.sup) this.presses[2]++
  }

  /** The other one's pad for this step: a button counts once per press. */
  remote(): Pad {
    const k = this.hands
    if (!k.length || !this.there) return NO_PAD
    const pad: Pad = { x: k[0] ?? 0, up: k[1] > 0, down: k[2] > 0, guard: k[3] > 0, punch: false, kick: false, sup: false }
    const keys = ['punch', 'kick', 'sup'] as const
    keys.forEach((name, i) => {
      const n = k[4 + i] ?? 0
      if (n > this.used[i]) {
        pad[name] = true
        this.used[i] = n
      }
    })
    // Seen from the host, the other one's left is the same screen left: both look at the street from the same side.
    return pad
  }

  /** The host's fight, if a new one came (the other phone): put in this one, from its side. */
  take(F: Fight): boolean {
    if (this.host || !this.snap || this.snap.at <= this.applied) return false
    this.applied = this.snap.at
    unpack(F, this.snap.b)
    return true
  }

  /** This phone's hands, and the whole fight if it runs it (as often as the hub takes them). */
  send(p: Pad, F: Fight) {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    const now = localNow()
    if (now - this.lastSend < 55) return
    this.lastSend = now
    const k = [Math.round(p.x * 100) / 100, p.up ? 1 : 0, p.down ? 1 : 0, p.guard ? 1 : 0, ...this.presses]
    this.ws.send(JSON.stringify({ t: 'state', x: 0, y: 0, z: 0, h: 0, p: 'idle', k, ...(this.host ? { b: pack(F) } : {}) }))
  }

  close() {
    this.closed = true
    this.timers.forEach(clearInterval)
    this.ws?.close()
  }
}

