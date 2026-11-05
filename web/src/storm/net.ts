import { clockSample, localNow } from '../lib/worldClock'
import { t } from '../lib/i18n'
import { NO_PAD, type Act, type ArenaId, type Fight, type Fighter, type MoveId, type Pad, type Phase, type SpecialId } from './engine'

// Adjamé Storm 4 between two players (a match of « Jouer contre un joueur »,
// backend sims/pvp.go, the game « storm »): both phones in the live hub's own
// "storm" room (backend live/live.go stormOK: three rows of 32 numbers at most,
// sixteen for the hands). The first player runs the fight (its own fighter
// first) and sends it whole as often as the hub lets it; the other sends its
// hands (the stick on the ground, held buttons, and how many times each button
// was pressed, so a press is never lost or played twice) and its fighter's
// style, steps the fight on its own between two sends so it never stalls, and
// takes the host's fight each time one comes, seen from its side.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'
/** The other one not heard from for this long: gone. */
const GONE = 8000

const PHASES: Phase[] = ['intro', 'fight', 'ko', 'timeup', 'over']
const ACTS: Act[] = ['stance', 'walk', 'run', 'jump', 'dash', 'backstep', 'roll', 'charge', 'attack', 'block', 'hit', 'air', 'down', 'getup', 'thrown', 'ko', 'win']
const MOVE_IDS: (MoveId | null)[] = [null, 'jab', 'cross', 'hook', 'finisher', 'rush', 'dive', 'grab', 'coupe', 'tourbillon', 'envol', 'marteau']
const SPS: SpecialId[] = ['coupe', 'tourbillon', 'envol', 'marteau']
export const ARENA_IDS: ArenaId[] = ['terrain', 'treichville', 'cour', 'plage']
const SAYS = ['', t('Dernier round'), 'Combat !', t('Double K.O. !'), t('K.O. !'), t('Temps écoulé'), 'Victoire !', t('Match nul'), 'Défaite']
/** Seen from the other side: the one's victory is the other's defeat. */
const FLIP: Record<string, string> = { 'Victoire !': 'Défaite', Défaite: 'Victoire !' }

const r3 = (v: number) => Math.round(v * 1000) / 1000
const sayCode = (s: string) => (s.startsWith('Round ') ? 100 + Number(s.slice(6)) : Math.max(0, SAYS.indexOf(s)))
const sayText = (n: number) => (n >= 100 ? t('Round {0}', { 0: n - 100 }) : (SAYS[n] ?? ''))

/** A fighter as 27 numbers. */
function packFighter(f: Fighter): number[] {
  return [r3(f.x), r3(f.y), r3(f.z), r3(f.vx), r3(f.vy), r3(f.vz), r3(f.h), r3(f.hp), r3(f.meter), ACTS.indexOf(f.act), r3(f.t), MOVE_IDS.indexOf(f.move), f.hit ? 1 : 0, r3(f.stun), f.guard ? 1 : 0, f.combo, f.juggle, f.take, r3(f.invuln), f.dead ? 1 : 0, r3(f.esc), r3(f.roll), f.fly ? 1 : 0, f.chase ? 1 : 0, SPS.indexOf(f.sp), r3(f.pow), r3(f.spd)]
}

function unpackFighter(f: Fighter, v: number[]) {
  Object.assign(f, {
    x: v[0],
    y: v[1],
    z: v[2],
    vx: v[3],
    vy: v[4],
    vz: v[5],
    h: v[6],
    hp: v[7],
    meter: v[8],
    act: ACTS[v[9]] ?? 'stance',
    t: v[10],
    move: MOVE_IDS[v[11]] ?? null,
    hit: v[12] > 0,
    stun: v[13],
    guard: v[14] > 0,
    combo: v[15],
    juggle: v[16],
    take: v[17],
    invuln: v[18],
    dead: v[19] > 0,
    esc: v[20],
    roll: v[21],
    fly: v[22] > 0,
    chase: v[23] > 0,
    sp: SPS[v[24]] ?? 'coupe',
    pow: v[25] || 1,
    spd: v[26] || 1,
  })
}

/** The fight as numbers: the round, the clock and what's said, the arena; each fighter. */
function pack(F: Fight, arena: number): number[][] {
  return [[PHASES.indexOf(F.phase), r3(F.phaseT), F.round, F.wins[0], F.wins[1], r3(F.clock), r3(F.freeze), r3(F.slow), r3(F.flash), F.roundWinner, sayCode(F.said), r3(F.saidAt), r3(F.time), r3(F.dealt[0]), r3(F.dealt[1]), arena], packFighter(F.f[0]), packFighter(F.f[1])]
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

export class StormNet {
  private ws: WebSocket | null = null
  private closed = false
  private timers: ReturnType<typeof setInterval>[] = []
  private heardAt = 0
  private opened = 0
  /** The other one's hands, and the presses already played. */
  private hands: number[] = []
  private used = [0, 0, 0, 0, 0]
  /** This phone's presses so far. */
  private presses = [0, 0, 0, 0, 0]
  private snap: { at: number; b: number[][] } | null = null
  private applied = 0
  private lastSend = 0
  connected = false
  /** The arena the host chose (the guest learns it from the first fight it gets). */
  arena: number | null

  constructor(
    private token: string,
    private sim: string,
    private match: string,
    /** This phone runs the fight (the match's first player). */
    readonly host: boolean,
    /** This phone's fighter's style (an index in the roster, Game.tsx). */
    readonly style: number,
    arena: number,
  ) {
    this.arena = host ? arena : null
    this.open()
  }

  private open() {
    const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/live')
    this.ws = ws
    ws.onopen = () => {
      this.connected = true
      this.opened = localNow()
      ws.send(JSON.stringify({ t: 'hello', token: this.token, sim: this.sim, mode: 'storm', race: this.match }))
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
          if (!this.host && s.b?.length && s.at > (this.snap?.at ?? 0)) {
            this.snap = { at: s.at, b: s.b }
            if (this.arena === null && s.b[0]?.[15] !== undefined) this.arena = s.b[0][15]
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

  /** The other one is there (heard lately). */
  get there() {
    return this.heardAt > 0 && localNow() - this.heardAt < GONE
  }
  /** Gone: heard once, then nothing for a while; or never heard, long after the line opened. */
  get gone() {
    const now = localNow()
    return this.heardAt > 0 ? now - this.heardAt > GONE : this.opened > 0 && now - this.opened > 30000
  }
  /** The other one's style, once heard (-1 before). */
  get otherStyle() {
    return this.hands.length > 10 ? this.hands[10] : -1
  }

  /** Count this phone's presses (before the pad's presses are cleared). */
  press(p: Pad) {
    if (p.attack) this.presses[0]++
    if (p.jump) this.presses[1]++
    if (p.dash) this.presses[2]++
    if (p.esc) this.presses[3]++
    if (p.sp) this.presses[4]++
  }

  /** The other one's pad for this step: a button counts once per press. */
  remote(): Pad {
    const k = this.hands
    if (!k.length || !this.there) return NO_PAD
    const pad: Pad = { x: k[0] ?? 0, z: k[1] ?? 0, guard: k[2] > 0, lock: k[3] > 0, charge: k[4] > 0, attack: false, jump: false, dash: false, esc: false, sp: false }
    const keys = ['attack', 'jump', 'dash', 'esc', 'sp'] as const
    keys.forEach((name, i) => {
      const n = k[5 + i] ?? 0
      if (n > this.used[i]) {
        pad[name] = true
        this.used[i] = n
      }
    })
    return pad
  }

  /** The host's fight, if a new one came: put in this one, from its side. */
  take(F: Fight): boolean {
    if (this.host || !this.snap || this.snap.at <= this.applied) return false
    this.applied = this.snap.at
    unpack(F, this.snap.b)
    return true
  }

  /** This phone's hands, and the whole fight if it runs it (as often as the hub takes them). */
  send(p: Pad, F?: Fight) {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    const now = localNow()
    if (now - this.lastSend < 55) return
    this.lastSend = now
    const k = [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100, p.guard ? 1 : 0, p.lock ? 1 : 0, p.charge ? 1 : 0, ...this.presses, this.style]
    this.ws.send(JSON.stringify({ t: 'state', x: 0, y: 0, z: 0, h: 0, p: 'idle', k, ...(this.host && F ? { b: pack(F, this.arena ?? 0) } : {}) }))
  }

  close() {
    this.closed = true
    this.timers.forEach(clearInterval)
    this.ws?.close()
  }
}
