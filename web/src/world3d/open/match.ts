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
// The moves are the real ones: in basketball the ball bounced from the hand
// to the floor at the dribbler's side, crossovers that leave the man
// guarding off balance, chest and bounce passes, jump shots, layups, dunks
// (up to the ring, hanging on it, the ring shaking), blocks and rebounds;
// in football little touches, passes along the ground and into space, slide
// tackles, the keeper diving one way or the other, the scorer's celebration.
//
// In the field's own frame: u along its length (team 0 attacks +u), v across.

export type Slot = {
  u: number
  v: number
  face: number
  pose: Pose
  /** m/s, for the strides */ speed: number
  /** The keeper's dive the other way: the body mirrored (the 'dive' pose goes to one side). */
  flip?: boolean
}
type P = [number, number]
type Kind = 'kickoff' | 'dribble' | 'pass' | 'shot' | 'goal' | 'save' | 'hold' | 'out' | 'reset' | 'cross' | 'dunk' | 'layup' | 'block' | 'tackle'
type Ev = {
  kind: Kind
  t0: number
  t1: number
  /** Team with the ball during the event. */
  team: 0 | 1
  /** Who has (or kicks) the ball, who it goes to (-1: nobody). A crossover: `to` is the man beaten; a tackle: the one tackled; a block: the one who blocks. */
  from: number
  to: number
  a: P
  b: P
  /** A shot: in or not. */
  scored?: boolean
  /** Basketball: the dribbling hand (1 right, -1 left); a crossover ends in this hand. */
  side?: number
  /** A bounce pass (basketball), a ball played into space (football). */
  bounce?: boolean
}
type Mode = 'ball' | 'run' | 'keep' | 'cheer' | 'shape' | 'beaten'

/** How long a written stretch of play lasts, in seconds. */
const CYCLE = 180
/** Players per team: a maracana is five a side, basketball too. */
export const PER_TEAM = 5
/** A dunk: when the ball goes through, and when the dunker lets go of the rim (s into the move, as the 'dunk' pose). */
const DUNK_THROUGH = 0.55
const DUNK_LET_GO = 1.15

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
const clamp01 = (k: number) => Math.max(0, Math.min(1, k))
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
  /** Where a dunker hangs: just in front of the ring. */
  private rimFront(team: 0 | 1): P {
    const g = this.target(team)
    return [g[0] - this.dir(team) * 0.3, 0]
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
    // Basketball: the hand the ball is in.
    let hand = 1
    const push = (e: Omit<Ev, 't0' | 't1'>, d: number) => {
      evs.push({ ...e, t0: t, t1: t + d })
      t += d
    }
    // After a basket or a goal: back to the middle, the others kick off (in basketball: inbound under the basket).
    const restartAfter = (aim: P, d: number) => {
      const other: 0 | 1 = team === 0 ? 1 : 0
      const goal = this.target(team)
      const restart: P = foot ? [0, 0] : this.clamp([goal[0] + d * 0.5, 0], 0.5)
      push({ kind: 'reset', team: other, from: foot ? 4 : 0, to: -1, a: aim, b: restart }, foot ? 3 : 1.5)
      team = other
      owner = foot ? 4 : 0
      ball = restart
      hand = 1
      if (foot) push({ kind: 'kickoff', team, from: owner, to: -1, a: ball, b: ball }, 1)
    }
    // Off the rim: the rebound, one side or the other.
    const rebound = (from: P, d: number) => {
      const other: 0 | 1 = team === 0 ? 1 : 0
      const goal = this.target(team)
      const reb: P = this.clamp([goal[0] - d * (1 + r() * 2.5), (r() - 0.5) * 5], 0.8)
      const side: 0 | 1 = r() < 0.35 ? team : other
      const who = 3 + Math.floor(r() * 2)
      push({ kind: 'pass', team: side, from: -1, to: who, a: from, b: reb }, 0.9)
      team = side
      owner = who
      ball = reb
      hand = 1
    }
    push({ kind: 'kickoff', team, from: owner, to: -1, a: ball, b: ball }, 1.2)
    let passes = 0
    while (t < CYCLE - 14) {
      const d = this.dir(team)
      const goal = this.target(team)
      const other: 0 | 1 = team === 0 ? 1 : 0
      // Football: now and then a defender slides in and wins it.
      if (foot && owner !== 0 && r() < 0.13) {
        let thief = 1
        let best = Infinity
        for (let i = 1; i < PER_TEAM; i++) {
          const dd = dist(this.shape(other, i, ball, false), ball)
          if (dd < best) [best, thief] = [dd, i]
        }
        const to = this.clamp([ball[0] - d * (1.5 + r() * 1.5), ball[1] + (r() - 0.5) * 3], 1.5)
        push({ kind: 'tackle', team: other, from: thief, to: owner, a: ball, b: to }, 1.2)
        team = other
        owner = thief
        ball = to
        passes = 0
        continue
      }
      // Basketball: the man in front beaten with a crossover, the ball from one hand to the other.
      if (!foot && r() < 0.3) {
        const side = -hand
        const to = this.clamp([ball[0] + d * (0.8 + r()), ball[1] + side * (1.2 + r() * 0.8)], 1)
        push({ kind: 'cross', team, from: owner, to: owner, a: ball, b: to, side }, 0.6)
        hand = side
        ball = to
      }
      // Run with the ball, forward and a little across.
      const fwd = foot ? 3 + r() * 6 : 2 + r() * 4
      const to = this.clamp([ball[0] + d * fwd, ball[1] + (r() - 0.5) * (foot ? 6 : 4)], foot ? 1.5 : 1)
      push({ kind: 'dribble', team, from: owner, to: -1, a: ball, b: to, side: hand }, (foot ? 0.9 : 1.2) + r() * 1.3)
      ball = to
      const near = dist(ball, goal) < (foot ? this.L * 0.32 : 6.8)
      if (near && (r() < 0.6 || passes > 3)) {
        passes = 0
        if (!foot && (dist(ball, goal) < 3 || r() < 0.32)) {
          // The drive to the basket: a dunk, or a layup off the board; now and then the man guarding him gets a hand to it.
          const by: P = this.clamp([goal[0] - d * 1.7, (r() - 0.5) * 1.4], 0.8)
          push({ kind: 'dribble', team, from: owner, to: -1, a: ball, b: by, side: hand }, 0.7)
          ball = by
          if (r() < 0.12) {
            const away: P = this.clamp([by[0] - d * (2 + r() * 2), (r() < 0.5 ? -1 : 1) * (2 + r() * 2)], 0.8)
            push({ kind: 'block', team, from: owner, to: owner, a: by, b: away }, 1.1)
            // The one who blocked it picks it up.
            team = other
            ball = away
            hand = 1
            continue
          }
          const dunk = r() < 0.45
          const scored = dunk || r() < 0.65
          push({ kind: dunk ? 'dunk' : 'layup', team, from: owner, to: -1, a: by, b: dunk ? this.rimFront(team) : goal, scored }, dunk ? 1.7 : 1)
          if (scored) {
            push({ kind: 'goal', team, from: owner, to: -1, a: goal, b: goal }, dunk ? 3.2 : 2)
            restartAfter(goal, d)
          } else rebound(goal, d)
          continue
        }
        // The shot.
        const roll = r()
        const scored = roll < (foot ? 0.34 : 0.48)
        const saved = !scored && foot && roll < 0.8
        const aim: P = scored
          ? [goal[0] + d * (foot ? 0.6 : 0), foot ? (r() - 0.5) * 2.4 : 0]
          : saved
            ? [goal[0] - d * 0.9, (r() - 0.5) * 1.6]
            : [goal[0] + d * (foot ? 1.5 : 0.6), (r() < 0.5 ? -1 : 1) * (foot ? 2.6 : 1.2)]
        push({ kind: 'shot', team, from: owner, to: saved ? 0 : -1, a: ball, b: aim, scored }, foot ? 0.55 : 1.1)
        if (scored) {
          push({ kind: 'goal', team, from: owner, to: -1, a: aim, b: aim }, foot ? 4 : 2)
          restartAfter(aim, d)
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
        } else rebound(aim, d)
        continue
      }
      // The pass: to a team-mate (not the keeper), sometimes cut out.
      let mate = 1 + Math.floor(r() * (PER_TEAM - 1))
      if (mate === owner) mate = mate === PER_TEAM - 1 ? 1 : mate + 1
      if (!foot && mate === owner) mate = (owner + 1) % PER_TEAM
      const spot = this.shape(team, mate, ball, true)
      // Football: a ball played into space ahead of a team-mate further up, who runs onto it.
      const through = foot && (spot[0] - ball[0]) * d > 2 && r() < 0.35
      const q = this.clamp([spot[0] + d * (foot ? (through ? 6 : 2) : 1), spot[1]], foot ? 1.2 : 0.8)
      const cut = r() < (foot ? 0.22 : 0.15)
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
      // Basketball: a bounce pass under the hands now and then.
      push({ kind: 'pass', team: cut ? other : team, from: owner, to: cut ? thief : mate, a: ball, b: where, bounce: foot ? through : r() < 0.35 }, Math.max(0.45, len / (foot ? 13 : 10)))
      passes = cut ? 0 : passes + 1
      if (cut) team = other
      owner = cut ? thief : mate
      ball = where
      hand = 1
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
    const k = clamp01((local - e.t0) / (e.t1 - e.t0))
    const s = local - e.t0
    const foot = this.field.sport === 'foot'
    let [u, v] = this.ballAt(e, local)
    let y = foot ? 0.12 : 0.15
    if (foot) {
      if (e.kind === 'dribble') {
        // Little touches: pushed a stride ahead, the player catching up with it, again.
        const [du, dv] = [e.b[0] - e.a[0], e.b[1] - e.a[1]]
        const l = Math.hypot(du, dv) || 1
        const push = 0.42 * ((s * 1.7) % 1) - 0.12
        u += (du / l) * push
        v += (dv / l) * push
      }
      if (e.kind === 'shot') y += Math.sin(k * Math.PI) * 0.9
      // Passes along the ground; only the long ones in the air.
      if (e.kind === 'pass' && dist(e.a, e.b) > 14) y += Math.sin(k * Math.PI) * Math.min(1.6, dist(e.a, e.b) / 10)
      if (e.kind === 'tackle') y += Math.abs(Math.sin(k * Math.PI * 2)) * 0.3 * (1 - k)
      if (e.kind === 'hold') y = 1.1
      if (e.kind === 'goal') y = 0.4
      return { u, v, y }
    }
    // Basketball: bounced from the hand to the floor at the dribbler's side.
    if (e.kind === 'dribble' || e.kind === 'cross' || e.kind === 'kickoff') {
      const [du, dv] = e.kind === 'kickoff' ? [this.dir(e.team), 0] : [e.b[0] - e.a[0], e.b[1] - e.a[1]]
      const l = Math.hypot(du, dv) || 1
      // The right of the way he runs is (dv, -du); a crossover takes the ball across in front, low and quick.
      const hand = e.kind === 'cross' ? -(e.side ?? 1) * Math.cos(k * Math.PI) : (e.side ?? 1)
      u += (dv / l) * hand * 0.32 + (du / l) * 0.18
      v += (-du / l) * hand * 0.32 + (dv / l) * 0.18
      y = e.kind === 'cross' ? 0.12 + Math.abs(Math.sin(s * 11)) * 0.45 : 0.15 + Math.abs(Math.sin(s * 7)) * 0.8
    } else if (e.kind === 'pass') {
      // A chest pass straight across, or a bounce pass off the floor two-thirds of the way.
      y = e.bounce ? (k < 0.62 ? 1.1 - (1.0 * k) / 0.62 : 0.1 + ((k - 0.62) / 0.38) * 1.0) : 1.2 + Math.sin(k * Math.PI) * 0.3
    } else if (e.kind === 'shot') y = 2.1 + (3.35 - 2.1) * k + Math.sin(k * Math.PI) * 1.6
    else if (e.kind === 'layup') {
      const f = clamp01((s - 0.45) / 0.35)
      y = s < 0.45 ? 1.1 + (s / 0.45) * 1.3 : 2.4 + 0.8 * f + Math.sin(f * Math.PI) * 0.4
    } else if (e.kind === 'dunk') {
      // Carried up in the hands, thrown down through the ring, then onto the floor, bouncing.
      if (s < DUNK_THROUGH) y = 1.2 + 2.1 * smooth(s / DUNK_THROUGH)
      else {
        const f = s - DUNK_THROUGH
        y = Math.max(0.12, 3.25 - f * 5 - f * f * 6)
        if (y <= 0.12) y = 0.12 + Math.abs(Math.sin((f - 0.45) * 7)) * 0.6 * Math.exp(-(f - 0.45) * 2)
      }
    } else if (e.kind === 'block') {
      // Up from the shooter's hands, swatted away, down and bouncing.
      y = k < 0.25 ? 2.1 + k * 2 : Math.max(0.12, 2.6 - (k - 0.25) * 4) + (k > 0.6 ? Math.abs(Math.sin(k * 14)) * 0.5 * (1 - k) : 0)
    } else if (e.kind === 'goal') y = Math.max(0.15, 3.05 - s * 4)
    else if (e.kind === 'reset') y = 1.1
    return { u, v, y }
  }

  /** The ring of the basket shaking after a dunk (or a shot off the iron): which end, and how much (radians). */
  rimShake(time: number): { u: number; amp: number } | null {
    if (this.field.sport !== 'basket') return null
    const { e, prev, local } = this.at(time)
    const s = local - e.t0
    if (e.kind === 'dunk' && s > DUNK_THROUGH - 0.05) {
      const f = s - DUNK_THROUGH + 0.05
      // Pulled down while he hangs on it, then shaking back up.
      const amp = s < DUNK_LET_GO ? 0.12 + Math.sin(f * 30) * 0.04 : Math.sin(f * 34) * 0.14 * Math.exp(-(s - DUNK_LET_GO) * 4)
      return { u: this.target(e.team)[0], amp }
    }
    if (e.kind === 'goal' && prev.kind === 'dunk' && s < 1) return { u: this.target(e.team)[0], amp: Math.sin(s * 34) * 0.05 * Math.exp(-s * 4) }
    // Off the iron: the rebound starts at the ring.
    if (e.kind === 'pass' && e.from === -1 && s < 0.6) return { u: e.a[0] > 0 ? this.L / 2 - 1.575 : -this.L / 2 + 1.575, amp: Math.sin(s * 40) * 0.05 * (1 - s / 0.6) }
    return null
  }

  /** Where player `i` of `team` is in an event's way of seeing things, at `local`. */
  private place(e: Ev, team: 0 | 1, i: number, local: number): { p: P; mode: Mode } {
    const k = clamp01((local - e.t0) / (e.t1 - e.t0))
    const s = local - e.t0
    const mine = e.team === team
    const foot = this.field.sport === 'foot'
    const ballNow = this.ballAt(e, local)
    // The one with the ball runs with it, just behind it.
    if (mine && i === e.from && (e.kind === 'dribble' || e.kind === 'kickoff' || e.kind === 'hold' || e.kind === 'cross')) {
      const [du, dv] = [e.b[0] - e.a[0], e.b[1] - e.a[1]]
      const l = Math.hypot(du, dv) || 1
      const back = foot && e.kind !== 'hold' ? 0.55 : 0.3
      const d = this.dir(team)
      const [bu, bv] = e.kind === 'dribble' || e.kind === 'cross' ? [du / l, dv / l] : [d, 0]
      return { p: [ballNow[0] - bu * back, ballNow[1] - bv * back], mode: 'ball' }
    }
    // The dunker up to the ring (and hanging there), the layup off the last steps.
    if (mine && i === e.from && (e.kind === 'dunk' || e.kind === 'layup')) {
      const spot = e.kind === 'dunk' ? e.b : lerp(e.a, this.rimFront(team), 0.7)
      return { p: lerp(e.a, spot, smooth(s / (e.kind === 'dunk' ? 0.5 : 0.6))), mode: 'ball' }
    }
    // A block: the shooter where he went up, the man guarding him right in front, between him and the ring.
    if (e.kind === 'block' && i === e.from && mine) return { p: e.a, mode: 'ball' }
    if (e.kind === 'block' && !mine && i === e.to) {
      const hoop = this.target(e.team)
      const l = dist(hoop, e.a) || 1
      return { p: [e.a[0] + ((hoop[0] - e.a[0]) / l) * 0.75, e.a[1] + ((hoop[1] - e.a[1]) / l) * 0.75], mode: 'shape' }
    }
    // A slide tackle: in from his place, feet first through the ball; the one tackled left there.
    if (e.kind === 'tackle' && mine && i === e.from) {
      const was = this.shape(team, i, e.a, false)
      return { p: k < 0.35 ? lerp(was, e.a, smooth(k / 0.35)) : lerp(e.a, e.b, smooth((k - 0.35) / 0.65) * 0.8), mode: 'ball' }
    }
    if (e.kind === 'tackle' && !mine && i === e.to) return { p: e.a, mode: 'beaten' }
    // Crossed over: the man guarding stays where he was, wrong-footed.
    if (e.kind === 'cross' && !mine && i === e.to) return { p: this.shape(team, i, e.a, false), mode: 'beaten' }
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
    const k = clamp01((local - e.t0) / (e.t1 - e.t0))
    if (e.kind === 'dribble' || e.kind === 'pass' || e.kind === 'shot' || e.kind === 'cross') return lerp(e.a, e.b, k)
    if (e.kind === 'layup') return lerp(e.a, e.b, smooth(k * 1.25))
    // The dunk: in the hands up to the ring, then down through it.
    if (e.kind === 'dunk') return lerp(e.a, this.target(e.team), smooth((local - e.t0) / DUNK_THROUGH))
    if (e.kind === 'block') return lerp(e.a, e.b, k < 0.25 ? 0 : smooth((k - 0.25) / 0.75))
    if (e.kind === 'tackle') return lerp(e.a, e.b, k < 0.3 ? 0 : smooth((k - 0.3) / 0.7))
    if (e.kind === 'reset' || e.kind === 'out') return lerp(e.a, e.b, smooth(Math.min(1, k * 1.6)))
    return e.b
  }

  /** What's happening at `time`, for the crowd: the kind of moment, which team has the ball, and since when (s). */
  /**
   * The score of the match being played (each written stretch is a match:
   * kick-off at its start), and how far into it: football a goal each, a
   * basket two points, three from beyond the arc.
   */
  score(time: number): { goals: [number, number]; minute: number } {
    const n = Math.floor(time / CYCLE)
    const local = time - n * CYCLE
    const goals: [number, number] = [0, 0]
    const foot = this.field.sport === 'foot'
    const evs = this.script(n)
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i]
      if (e.t0 > local) break
      if (e.kind !== 'goal') continue
      // The shot that went in, just before: from how far.
      const shot = evs[i - 1]
      const three = !foot && !!shot && shot.kind === 'shot' && dist(shot.a, this.target(e.team)) > 6.75
      goals[e.team] += foot ? 1 : three ? 3 : 2
    }
    // Shown as a real match's clock: a maracana's 30 minutes, a basket game's 40.
    return { goals, minute: Math.floor((local / CYCLE) * (foot ? 30 : 40)) }
  }

  moment(time: number): { kind: string; team: 0 | 1; since: number; after: string } {
    const { e, prev, local } = this.at(time)
    return { kind: e.kind, team: e.team as 0 | 1, since: local - e.t0, after: prev.kind }
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
    const s = local - e.t0
    let pose: Pose = speed > 3 ? 'run' : speed > 0.7 ? 'walk' : 'idle'
    let flip = false
    const justFrom = s < (foot ? 0.45 : 0.7)
    const k = s / Math.max(0.01, e.t1 - e.t0)
    const near = dist(here.p, [b.u, b.v]) < (foot ? 4.5 : 3.2)
    // The scorer runs off with arms out like wings; the others jump with him.
    if (here.mode === 'cheer') pose = i === e.from ? 'airplane' : 'cheer'
    // The keeper: down on the grass after diving for a shot, still there as the ball goes in.
    else if (foot && i === 0 && !mine && ((e.kind === 'shot' && k > 0.45) || (e.kind === 'goal' && s < 1.6))) {
      pose = 'dive'
      // The dive goes to his own +x side; the other way, the body is mirrored. His +x is (sin face, -cos face).
      const aim = e.kind === 'shot' ? e.b : e.a
      flip = (aim[0] - here.p[0]) * Math.sin(face) - (aim[1] - here.p[1]) * Math.cos(face) < 0
    } else if (here.mode === 'keep' || (foot && i === 0 && !mine && Math.abs(b.u - this.target(team === 0 ? 1 : 0)[0]) < this.L * 0.3)) pose = 'keeper'
    else if (mine && i === e.from && (e.kind === 'dunk' || e.kind === 'layup')) pose = e.kind
    else if (mine && i === e.from && e.kind === 'cross') pose = 'crossover'
    else if (e.kind === 'block' && mine && i === e.from) pose = 'shoot'
    else if (e.kind === 'block' && !mine && i === e.to) pose = 'block'
    else if (e.kind === 'tackle' && mine && i === e.from && k > 0.2 && k < 0.8) pose = 'slide'
    else if (here.mode === 'beaten') pose = s > 0.15 ? 'stumble' : foot ? 'mark' : 'guard'
    else if (e.from === i && mine && (e.kind === 'pass' || e.kind === 'shot') && justFrom) pose = foot ? 'kick' : e.kind === 'shot' ? 'shoot' : e.bounce ? 'bouncepass' : 'pass'
    else if (here.mode === 'ball' && !foot) pose = 'dribble'
    else if (here.mode === 'ball' && foot && e.kind === 'hold') pose = 'keeper'
    // Running with the ball at the feet: little touches, eyes down.
    else if (here.mode === 'ball' && foot && speed > 0.7) pose = 'touch'
    // Off the rim: the ones under it go up for the rebound.
    else if (!foot && e.kind === 'pass' && e.from === -1 && s < 0.55 && dist(here.p, e.a) < 3) pose = 'block'
    // Close to the ball without it: marking (football), guarding (basketball).
    else if (!mine && here.mode === 'shape' && near && speed < 3 && e.kind !== 'goal' && e.kind !== 'reset') pose = foot ? 'mark' : 'guard'
    return { u: here.p[0], v: here.p[1], face, pose, speed, flip }
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

/** From the world's (x, z) to the field's frame (u along, v across). */
export function toField(field: Field, [x, z]: [number, number]): [number, number] {
  const [c, s] = [Math.cos(field.angle), Math.sin(field.angle)]
  const [dx, dz] = [x - field.at[0], z - field.at[1]]
  return [dx * c + dz * s, -dx * s + dz * c]
}

/** The fence round a field stands this far out from its lines. */
export const FENCE_OUT = 1.05
/** The benches along both touchlines, outside the fence (the gate in the middle left clear): 4 m each, four seats. */
export function benches(field: Field): { u: number; v: number; side: 1 | -1 }[] {
  const out: { u: number; v: number; side: 1 | -1 }[] = []
  const v = field.wid / 2 + FENCE_OUT + 1.6
  for (const side of [1, -1] as const)
    for (let u = 3.6; u + 2 < field.len / 2 + FENCE_OUT; u += 5.2) for (const k of [1, -1]) out.push({ u: k * u, v: side * v, side })
  return out
}
/** The seats on a bench, from its middle. */
export const SEATS = [-1.2, -0.4, 0.4, 1.2]
/** Where the Sim sits to watch: the bench nearest the gate on the street's side, its first seat. */
export function simSeat(field: Field, side: 1 | -1): [number, number] {
  return [3.6 - 1.2, side * (field.wid / 2 + FENCE_OUT + 1.6)]
}
