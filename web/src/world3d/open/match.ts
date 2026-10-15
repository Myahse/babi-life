import type { Pose } from '../../avatar/Human'
import type { Field } from './places'

// A match on a pitch or a court, as a pure function of the shared clock: the
// same passes, shots and goals on every screen. Each three minutes of play
// is written in advance from the field and the clock (a « script » of
// dribbles, passes, shots, saves, goals and kick-offs) and every player's
// place at any instant follows from it: the one with the ball runs with it,
// the one it's passed to runs to meet it, the others keep their shape
// round the ball (a maracana's keeper, defender, wingers and striker; the
// five of a basketball team, each defender on his man).
//
// In the field's own frame: u along its length (team 0 attacks +u), v across.

export type Slot = { u: number; v: number; face: number; pose: Pose }
type P = [number, number]
type Kind = 'kickoff' | 'dribble' | 'pass' | 'shot' | 'goal' | 'save' | 'hold' | 'out' | 'reset'
type Ev = {
  kind: Kind
  t0: number
  t1: number
  /** Team with the ball during the event. */
  team: 0 | 1
  /** Who has (or kicks) the ball, who it goes to (-1: nobody). */
  from: number
  to: number
  a: P
  b: P
  /** A shot: in or not. */
  scored?: boolean
}

/** How long a written stretch of play lasts, in seconds. */
const CYCLE = 180
/** Players per team: a maracana is five a side, basketball too. */
export const PER_TEAM = 5

const rand = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const hashStr = (s: string) => {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}
const smooth = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k))
const lerp = (a: P, b: P, k: number): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1])

export class Match {
  readonly field: Field
  private key: number
  private cycles = new Map<number, Ev[]>()
  readonly half: boolean
  constructor(key: string, field: Field) {
    this.field = field
    this.key = hashStr(key)
    // A court too short for two baskets: everyone plays on the one.
    this.half = field.sport === 'basket' && field.len < 20
  }

  get L() {
    return this.field.len
  }
  get W() {
    return this.field.wid
  }
  /** Which way a team attacks (+1: towards +u). */
  dir(team: 0 | 1) {
    return this.half ? 1 : team === 0 ? 1 : -1
  }
  /** Where a team scores: the goal mouth or the hoop. */
  target(team: 0 | 1): P {
    const end = this.L / 2 - (this.field.sport === 'basket' ? 1.575 : 0)
    return [this.dir(team) * end, 0]
  }
  private clamp([u, v]: P, m = 1): P {
    return [Math.max(-this.L / 2 + m, Math.min(this.L / 2 - m, u)), Math.max(-this.W / 2 + m, Math.min(this.W / 2 - m, v))]
  }

  /**
   * A player's place in the team's shape, with the ball at `ball`: forward
   * when the team has it, back when it defends, drawn towards the ball.
   */
  shape(team: 0 | 1, role: number, ball: P, attacking: boolean): P {
    const d = this.dir(team)
    const [hl, hw] = [this.L / 2, this.W / 2]
    // The ball in this team's frame (its attack is +x).
    const bx = (ball[0] * d) / hl
    const bz = ball[1] / hw
    if (this.field.sport === 'foot') {
      const ATT: P[] = [
        [-0.9, 0],
        [-0.3, 0],
        [0.15, -0.6],
        [0.15, 0.6],
        [0.55, 0.1],
      ]
      const DEF: P[] = [
        [-0.9, 0],
        [-0.62, 0],
        [-0.3, -0.42],
        [-0.3, 0.42],
        [0.02, 0],
      ]
      const [x, z] = (attacking ? ATT : DEF)[role]
      // The keeper: on his line, following the ball across.
      if (role === 0) return [-d * (hl - 0.8), Math.max(-1.3, Math.min(1.3, bz * hw * 0.4))]
      return this.clamp([d * (x + bx * 0.35) * hl, (z + bz * 0.3) * hw], 1.2)
    }
    // Basketball: five round the key when attacking; each defender between his man and the basket.
    const ATT: P[] = [
      [0.15, 0],
      [0.55, -0.7],
      [0.55, 0.7],
      [0.78, -0.3],
      [0.86, 0.25],
    ]
    const half = this.half
    const at = (r: number): P => {
      const [x, z] = ATT[r]
      // On a half-court the basket is at +u for everyone; full court, at the team's end.
      const xx = half ? x * 2 - 1 : x
      return this.clamp([d * xx * hl, z * hw * 0.85 + bz * hw * 0.1], 0.8)
    }
    if (attacking) return at(role)
    const other: 0 | 1 = team === 0 ? 1 : 0
    const man = this.shapeAttackOf(other, role)
    const hoop = this.target(other)
    return this.clamp(lerp(man, hoop, 0.3), 0.8)
  }
  private shapeAttackOf(team: 0 | 1, role: number) {
    return this.shape(team, role, [0, 0], true)
  }

  /** The script of one stretch of play. */
  private script(n: number): Ev[] {
    const cached = this.cycles.get(n)
    if (cached) return cached
    const r = rand(this.key ^ Math.imul(n + 1, 2654435761))
    const foot = this.field.sport === 'foot'
    const evs: Ev[] = []
    let t = 0
    let team: 0 | 1 = 0
    const kick = foot ? 4 : 0 // who starts: the striker; in basketball the point guard
    let owner = kick
    let ball: P = [0, 0]
    const push = (e: Omit<Ev, 't0' | 't1'>, d: number) => {
      evs.push({ ...e, t0: t, t1: t + d })
      t += d
    }
    push({ kind: 'kickoff', team, from: owner, to: -1, a: ball, b: ball }, 1.2)
    let passes = 0
    while (t < CYCLE - 14) {
      const d = this.dir(team)
      const goal = this.target(team)
      // Run with the ball, forward and a little across.
      const fwd = foot ? 3 + r() * 6 : 2 + r() * 4
      const to = this.clamp([ball[0] + d * fwd, ball[1] + (r() - 0.5) * (foot ? 6 : 4)], foot ? 1.5 : 1)
      push({ kind: 'dribble', team, from: owner, to: -1, a: ball, b: to }, (foot ? 0.9 : 1.2) + r() * 1.3)
      ball = to
      const near = dist(ball, goal) < (foot ? this.L * 0.32 : 6.8)
      if (near && (r() < 0.6 || passes > 3)) {
        // The shot.
        const roll = r()
        const scored = roll < (foot ? 0.34 : 0.48)
        const saved = !scored && foot && roll < 0.8
        const aim: P = scored
          ? [goal[0] + d * (foot ? 0.6 : 0), foot ? (r() - 0.5) * 2.4 : 0]
          : saved
            ? [goal[0] - d * 0.9, (r() - 0.5) * 1.6]
            : [goal[0] + d * (foot ? 1.5 : 0.6), (r() < 0.5 ? -1 : 1) * (foot ? 2.6 : 1.2)]
        const other: 0 | 1 = team === 0 ? 1 : 0
        push({ kind: 'shot', team, from: owner, to: saved ? 0 : -1, a: ball, b: aim, scored }, foot ? 0.55 : 1.1)
        passes = 0
        if (scored) {
          push({ kind: 'goal', team, from: owner, to: -1, a: aim, b: aim }, 4)
          // Back to the middle; the others kick off (in basketball: inbound under the basket).
          const restart: P = foot ? [0, 0] : this.clamp([goal[0] + d * 0.5, 0], 0.5)
          push({ kind: 'reset', team: other, from: foot ? 4 : 0, to: -1, a: aim, b: restart }, foot ? 3 : 1.5)
          team = other
          owner = foot ? 4 : 0
          ball = restart
          if (foot) push({ kind: 'kickoff', team, from: owner, to: -1, a: ball, b: ball }, 1)
        } else if (saved) {
          // The keeper holds it, then throws it out to a team-mate.
          push({ kind: 'hold', team: other, from: 0, to: -1, a: aim, b: aim }, 1.4)
          team = other
          owner = 0
          ball = aim
        } else if (foot) {
          push({ kind: 'out', team: other, from: 0, to: -1, a: aim, b: this.clamp([goal[0] - d * 1.5, 0], 1) }, 2.2)
          team = other
          owner = 0
          ball = this.clamp([goal[0] - d * 1.5, 0], 1)
        } else {
          // Off the rim: the rebound, one side or the other.
          const reb: P = this.clamp([goal[0] - d * (1 + r() * 2.5), (r() - 0.5) * 5], 0.8)
          const keep = r() < 0.35
          const side: 0 | 1 = keep ? team : other
          const who = 3 + Math.floor(r() * 2)
          push({ kind: 'pass', team: side, from: -1, to: who, a: aim, b: reb }, 0.9)
          team = side
          owner = who
          ball = reb
        }
        continue
      }
      // The pass: to a team-mate (not the keeper), sometimes cut out.
      let mate = 1 + Math.floor(r() * (PER_TEAM - 1))
      if (mate === owner) mate = mate === PER_TEAM - 1 ? 1 : mate + 1
      if (!foot && mate === owner) mate = (owner + 1) % PER_TEAM
      const spot = this.shape(team, mate, ball, true)
      const q = this.clamp([spot[0] + d * (foot ? 2 : 1), spot[1]], foot ? 1.2 : 0.8)
      const cut = r() < (foot ? 0.22 : 0.15)
      const other: 0 | 1 = team === 0 ? 1 : 0
      // Cut out: the opponent closest to where it's going.
      let thief = 1
      if (cut) {
        let best = Infinity
        for (let i = foot ? 1 : 0; i < PER_TEAM; i++) {
          const dd = dist(this.shape(other, i, ball, false), q)
          if (dd < best) [best, thief] = [dd, i]
        }
      }
      const len = dist(ball, q)
      const where: P = cut ? lerp(ball, q, 0.6 + r() * 0.3) : q
      push({ kind: 'pass', team: cut ? other : team, from: owner, to: cut ? thief : mate, a: ball, b: where }, Math.max(0.45, len / (foot ? 13 : 10)))
      passes = cut ? 0 : passes + 1
      if (cut) team = other
      owner = cut ? thief : mate
      ball = where
    }
    // The end of the stretch: back to the middle, team 0 to kick off (as the next one starts).
    push({ kind: 'reset', team: 0, from: kick, to: -1, a: ball, b: [0, 0] }, CYCLE - t)
    this.cycles.set(n, evs)
    if (this.cycles.size > 3) this.cycles.delete(this.cycles.keys().next().value!)
    return evs
  }

  private at(time: number): { e: Ev; prev: Ev; local: number } {
    const n = Math.floor(time / CYCLE)
    const local = time - n * CYCLE
    const evs = this.script(n)
    let lo = 0
    let hi = evs.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (evs[mid].t0 <= local) lo = mid
      else hi = mid - 1
    }
    const prev = lo > 0 ? evs[lo - 1] : this.script(n - 1)[this.script(n - 1).length - 1]
    return { e: evs[lo], prev: lo > 0 ? prev : { ...prev, t0: prev.t0 - CYCLE, t1: prev.t1 - CYCLE }, local }
  }

  /** Where the ball is, and how high (metres). */
  ball(time: number): { u: number; v: number; y: number } {
    const { e, local } = this.at(time)
    const k = Math.max(0, Math.min(1, (local - e.t0) / (e.t1 - e.t0)))
    const foot = this.field.sport === 'foot'
    const [u, v] =
      e.kind === 'dribble' || e.kind === 'pass' || e.kind === 'shot' || e.kind === 'reset' || e.kind === 'out' ? lerp(e.a, e.b, e.kind === 'reset' || e.kind === 'out' ? smooth(Math.min(1, k * 1.6)) : k) : e.b
    let y = foot ? 0.12 : 0.15
    if (foot) {
      if (e.kind === 'shot') y += Math.sin(k * Math.PI) * 0.9
      if (e.kind === 'pass') y += Math.sin(k * Math.PI) * Math.min(1.4, dist(e.a, e.b) / 12)
      if (e.kind === 'hold') y = 1.1
      if (e.kind === 'goal') y = 0.4
    } else {
      // Basketball: bounced while dribbling, chest passes, the arc to the basket, through the net.
      if (e.kind === 'dribble' || e.kind === 'kickoff') y = 0.15 + Math.abs(Math.sin(local * 7)) * 0.85
      else if (e.kind === 'pass') y = 1.2 + Math.sin(k * Math.PI) * 0.3
      else if (e.kind === 'shot') y = 2.1 + (3.35 - 2.1) * k + Math.sin(k * Math.PI) * 1.6
      else if (e.kind === 'goal') y = Math.max(0.15, 3.05 - (local - e.t0) * 4)
      else if (e.kind === 'reset') y = 1.1
    }
    return { u, v, y }
  }

  /** Where player `i` of `team` is in an event's way of seeing things, at `local`. */
  private place(e: Ev, team: 0 | 1, i: number, local: number): { p: P; mode: 'ball' | 'run' | 'keep' | 'cheer' | 'shape' } {
    const k = Math.max(0, Math.min(1, (local - e.t0) / (e.t1 - e.t0)))
    const mine = e.team === team
    const foot = this.field.sport === 'foot'
    const ballNow = this.ballAt(e, local)
    // The one with the ball runs with it, just behind it.
    if (mine && i === e.from && (e.kind === 'dribble' || e.kind === 'kickoff' || e.kind === 'hold')) {
      const [du, dv] = [e.b[0] - e.a[0], e.b[1] - e.a[1]]
      const l = Math.hypot(du, dv) || 1
      const back = foot && e.kind !== 'hold' ? 0.55 : 0.3
      const d = this.dir(team)
      const [bu, bv] = e.kind === 'dribble' ? [du / l, dv / l] : [d, 0]
      return { p: [ballNow[0] - bu * back, ballNow[1] - bv * back], mode: 'ball' }
    }
    // The one it's passed to runs to meet it.
    if (mine && i === e.to && e.kind === 'pass') {
      const from = this.shape(team, i, e.a, true)
      return { p: lerp(from, e.b, smooth(Math.min(1, k * 1.15))), mode: 'run' }
    }
    // The keeper on a shot at his goal: across to where it's going.
    if (foot && !mine && i === 0 && e.kind === 'shot') {
      const base = this.shape(team, 0, e.a, false)
      return { p: [base[0], base[1] + (e.b[1] - base[1]) * smooth(k)], mode: 'keep' }
    }
    // A goal: the scorer's team runs to him; the others stand.
    if (e.kind === 'goal') {
      if (mine) {
        const scorer = this.shape(team, e.from, e.a, true)
        const spot: P = [e.a[0] - this.dir(team) * 3, e.a[1] * 0.3]
        const meet: P = i === e.from ? spot : [spot[0] - this.dir(team) * (1 + (i % 2)), spot[1] + (i - 2) * 0.9]
        return { p: lerp(i === e.from ? scorer : this.shape(team, i, e.a, true), meet, smooth(k * 1.8)), mode: 'cheer' }
      }
      return { p: this.shape(team, i, e.a, false), mode: 'shape' }
    }
    // Everyone else: in the shape, round the ball.
    return { p: this.shape(team, i, ballNow, mine), mode: 'shape' }
  }
  private ballAt(e: Ev, local: number): P {
    const k = Math.max(0, Math.min(1, (local - e.t0) / (e.t1 - e.t0)))
    if (e.kind === 'dribble' || e.kind === 'pass' || e.kind === 'shot') return lerp(e.a, e.b, k)
    if (e.kind === 'reset' || e.kind === 'out') return lerp(e.a, e.b, smooth(Math.min(1, k * 1.6)))
    return e.b
  }

  /** Player `i` of `team` at `time`: place, which way he faces, what he's doing. */
  player(team: 0 | 1, i: number, time: number): Slot {
    const here = this.pos(team, i, time)
    const before = this.pos(team, i, time - 0.2)
    const speed = dist(here.p, before.p) / 0.2
    const b = this.ball(time)
    const face = speed > 0.6 ? Math.atan2(here.p[1] - before.p[1], here.p[0] - before.p[0]) : Math.atan2(b.v - here.p[1], b.u - here.p[0])
    const { e, local } = this.at(time)
    const foot = this.field.sport === 'foot'
    const mine = e.team === team
    let pose: Pose = speed > 3 ? 'run' : speed > 0.7 ? 'walk' : 'idle'
    const justFrom = local - e.t0 < (foot ? 0.35 : 0.5)
    if (here.mode === 'cheer') pose = 'cheer'
    else if (here.mode === 'keep' || (foot && i === 0 && !mine && Math.abs(b.u - this.target(team === 0 ? 1 : 0)[0]) < this.L * 0.3)) pose = 'keeper'
    else if (e.from === i && mine && (e.kind === 'pass' || e.kind === 'shot') && justFrom) pose = foot ? 'kick' : e.kind === 'shot' ? 'shoot' : 'throw'
    else if (here.mode === 'ball' && !foot) pose = 'dribble'
    else if (here.mode === 'ball' && foot && e.kind === 'hold') pose = 'keeper'
    return { u: here.p[0], v: here.p[1], face, pose }
  }
  private pos(team: 0 | 1, i: number, time: number) {
    const { e, prev, local } = this.at(time)
    const now = this.place(e, team, i, local)
    // From what he was doing in the last event to this one, smoothly.
    const k = smooth((local - e.t0) / 0.6)
    if (k >= 1) return now
    const was = this.place(prev, team, i, Math.min(local, prev.t1))
    return { p: lerp(was.p, now.p, k), mode: now.mode }
  }
}

const matches = new Map<string, Match>()
/** The match on a field (one per place). */
export function matchFor(key: string, field: Field) {
  let m = matches.get(key)
  if (!m || m.field !== field) {
    m = new Match(key, field)
    matches.set(key, m)
    if (matches.size > 24) matches.delete(matches.keys().next().value!)
  }
  return m
}

/** From the field's frame to the world's (x, z), and a facing to the world's rotation. */
export function onField(field: Field, u: number, v: number): [number, number] {
  const [c, s] = [Math.cos(field.angle), Math.sin(field.angle)]
  return [field.at[0] + u * c - v * s, field.at[1] + u * s + v * c]
}
export function worldFacing(field: Field, face: number) {
  // A Sim faces +z at rotation 0; the field's direction `face` is from its u axis.
  const a = field.angle + face
  return Math.atan2(Math.cos(a), Math.sin(a))
}

/** Which player the Sim is, when it plays: a winger, or a guard. */
export const SIM_SLOT: Record<Field['sport'], number> = { foot: 2, basket: 1 }
