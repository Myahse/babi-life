import type { Pose } from '../avatar/Human'
import { fly } from './phys'
import { r2 } from './net'
import type { Shot, TInput, Tennis, TMoment } from './tennis'
import type { VInput, Volley, VMoment } from './volley'

// The matches on the wire (net.ts): tennis and volleyball each in a few rows of numbers (at most 16 a row,
// 26 rows: the live hub's limits), what the other phones need to draw it; the hands as numbers; and the
// coasting between two states (the ball flown on, the players carried on their run).

const POSES: Pose[] = ['idle', 'walk', 'run', 'mark', 'bounce', 'forehand', 'backhand', 'volleyhit', 'serve', 'bump', 'setball', 'spike', 'block', 'dive', 'cheer', 'ready', 'splitstep', 'shuffle', 'netblock']
const T_PHASES: Tennis['phase'][] = ['count', 'serve', 'toss', 'rally', 'dead', 'change', 'over']
const T_KINDS: TMoment['kind'][] = ['ace', 'df', 'fault', 'let', 'winner', 'out', 'net', 'volley', 'smash', 'lob', 'drop', 'game', 'break', 'set', 'match', 'deuce', 'adv', 'tiebreak', 'rally', 'serve', 'hit', 'bounce', 'cord', 'change']
const V_PHASES: Volley['phase'][] = ['count', 'serve', 'toss', 'rally', 'dead', 'switch', 'over']
const V_KINDS: VMoment['kind'][] = ['ace', 'kill', 'block', 'stuff', 'dig', 'set', 'spike', 'serve', 'out', 'net', 'fault', 'point', 'setwon', 'match', 'rotate', 'switch', 'tip', 'bump', 'free', 'floor', 'touch', 'rally']
const SHOTS: (Shot | null)[] = [null, 'top', 'slice', 'lob', 'drop', 'flat']

const pose = (p: Pose) => Math.max(0, POSES.indexOf(p))

/** The last moments (up to three), so the others hear and see them. */
function moments<M extends { kind: string; by: number; t: number; v?: number }>(list: M[], kinds: string[]) {
  const row = [list.length]
  for (const m of list.slice(-3)) row.push(kinds.indexOf(m.kind), m.by, r2(m.t), r2(m.v ?? 0))
  return row
}
function unmoments<M>(have: M[], row: number[], kinds: string[], make: (kind: string, by: number, t: number, v: number) => M) {
  const n = row[0]
  const got = (row.length - 1) / 4
  for (let i = Math.max(have.length, n - got); i < n; i++) {
    const o = 1 + (i - (n - got)) * 4
    have.push(make(kinds[row[o]], row[o + 1], row[o + 2], row[o + 3]))
  }
}

export const tennisWire = {
  encode(g: Tennis): number[][] {
    const s = g.score
    const b = g.ball
    return [
      [r2(g.time), T_PHASES.indexOf(g.phase), g.server, g.fault, s.pts[0], s.pts[1], s.games[0], s.games[1], s.sets[0], s.sets[1], s.tb ? 1 : 0, g.end[0], g.winner ?? -1, g.won ?? -1, r2(g.since)],
      s.done.flat().slice(0, 12),
      [r2(b.x), r2(b.y), r2(b.z), r2(b.vx), r2(b.vy), r2(b.vz), r2(b.spin), b.bounces, b.hitBy, b.held ? 1 : 0, g.mark ? r2(g.mark.x) : 0, g.mark ? r2(g.mark.z) : 0, g.mark ? r2(g.mark.t) : -99, g.mark?.out ? 1 : 0],
      moments(g.moments, T_KINDS),
      ...g.ps.map((p) => [r2(p.x), r2(p.z), r2(p.vx), r2(p.vz), r2(p.face), pose(p.pose), r2(p.at), p.take]),
      [g.stats.aces[0], g.stats.aces[1], g.stats.df[0], g.stats.df[1], g.stats.winners[0], g.stats.winners[1], g.stats.fastest[0], g.stats.fastest[1], g.stats.longest, g.stats.points[0], g.stats.points[1]],
    ]
  },
  decode(g: Tennis, rows: number[][]) {
    const [t, done, b, ms, p0, p1, st] = rows
    g.time = t[0]
    g.phase = T_PHASES[t[1]] ?? g.phase
    g.server = t[2] as 0 | 1
    g.fault = t[3] as 0 | 1
    g.score.pts = [t[4], t[5]]
    g.score.games = [t[6], t[7]]
    g.score.sets = [t[8], t[9]]
    g.score.tb = t[10] > 0
    g.end = [t[11], -t[11]]
    g.winner = t[12] >= 0 ? (t[12] as 0 | 1) : null
    g.won = t[13] >= 0 ? (t[13] as 0 | 1) : null
    g.since = t[14]
    g.score.done = []
    for (let i = 0; i + 1 < done.length; i += 2) g.score.done.push([done[i], done[i + 1]])
    Object.assign(g.ball, { x: b[0], y: b[1], z: b[2], vx: b[3], vy: b[4], vz: b[5], spin: b[6], bounces: b[7], hitBy: b[8], held: b[9] > 0 })
    g.mark = b[12] > -99 ? { x: b[10], z: b[11], t: b[12], out: b[13] > 0 } : null
    unmoments(g.moments, ms, T_KINDS, (kind, by, tt, v) => ({ kind: kind as TMoment['kind'], by, t: tt, v }))
    ;[p0, p1].forEach((r, i) => {
      const p = g.ps[i]
      if (!r) return
      ;[p.x, p.z, p.vx, p.vz, p.face] = r
      p.pose = POSES[r[5]] ?? 'idle'
      p.at = r[6]
      p.take = r[7]
    })
    if (st) {
      g.stats.aces = [st[0], st[1]]
      g.stats.df = [st[2], st[3]]
      g.stats.winners = [st[4], st[5]]
      g.stats.fastest = [st[6], st[7]]
      g.stats.longest = st[8]
      g.stats.points = [st[9], st[10]]
    }
  },
}

/** A phone's tennis hands: the stick, the button held. */
export const tHands = (i: TInput) => [i.mx, i.mz, SHOTS.indexOf(i.hold)]
export const tInput = (k: number[]): TInput => ({ mx: k[0] ?? 0, mz: k[1] ?? 0, hold: SHOTS[k[2] ?? 0] ?? null })

export const volleyWire = {
  encode(g: Volley): number[][] {
    const s = g.score
    const b = g.ball
    return [
      [r2(g.time), V_PHASES.indexOf(g.phase), g.serving, s.pts[0], s.pts[1], s.sets[0], s.sets[1], g.end[0], g.winner ?? -1, g.won ?? -1, b.touches, b.team, b.last, b.held ? 1 : 0, r2(g.since)],
      [r2(b.x), r2(b.y), r2(b.z), r2(b.vx), r2(b.vy), r2(b.vz), r2(b.spin), g.mark ? r2(g.mark.x) : 0, g.mark ? r2(g.mark.z) : 0, g.mark ? r2(g.mark.t) : -99, g.mark?.out ? 1 : 0],
      g.rot[0],
      g.rot[1],
      s.done.flat().slice(0, 12),
      moments(g.moments, V_KINDS),
      ...g.ps.map((p) => [r2(p.x), r2(p.z), r2(p.y), r2(p.vx), r2(p.vz), r2(p.vy), r2(p.face), pose(p.pose), r2(p.at), p.take]),
      [g.stats.kills[0], g.stats.kills[1], g.stats.aces[0], g.stats.aces[1], g.stats.blocks[0], g.stats.blocks[1], g.stats.digs[0], g.stats.digs[1], g.stats.longest],
    ]
  },
  decode(g: Volley, rows: number[][]) {
    const [t, b, r0, r1, done, ms] = rows
    g.time = t[0]
    g.phase = V_PHASES[t[1]] ?? g.phase
    g.serving = t[2] as 0 | 1
    g.score.pts = [t[3], t[4]]
    g.score.sets = [t[5], t[6]]
    g.end = [t[7], -t[7]]
    g.winner = t[8] >= 0 ? (t[8] as 0 | 1) : null
    g.won = t[9] >= 0 ? (t[9] as 0 | 1) : null
    Object.assign(g.ball, { touches: t[10], team: t[11], last: t[12], held: t[13] > 0, x: b[0], y: b[1], z: b[2], vx: b[3], vy: b[4], vz: b[5], spin: b[6] })
    g.since = t[14]
    g.mark = b[9] > -99 ? { x: b[7], z: b[8], t: b[9], out: b[10] > 0 } : null
    g.rot = [r0, r1]
    g.score.done = []
    for (let i = 0; i + 1 < done.length; i += 2) g.score.done.push([done[i], done[i + 1]])
    unmoments(g.moments, ms, V_KINDS, (kind, by, tt, v) => ({ kind: kind as VMoment['kind'], by, team: g.ps[by]?.team ?? 0, t: tt, v }))
    g.ps.forEach((p, i) => {
      const r = rows[6 + i]
      if (!r) return
      ;[p.x, p.z, p.y, p.vx, p.vz, p.vy, p.face] = r
      p.pose = POSES[r[7]] ?? 'idle'
      p.at = r[8]
      p.take = r[9]
    })
    const st = rows[6 + g.ps.length]
    if (st) {
      g.stats.kills = [st[0], st[1]]
      g.stats.aces = [st[2], st[3]]
      g.stats.blocks = [st[4], st[5]]
      g.stats.digs = [st[6], st[7]]
      g.stats.longest = st[8]
    }
  },
}

export const vHands = (i: VInput) => [i.mx, i.mz, i.a ? 1 : 0, i.b ? 1 : 0, i.c ? 1 : 0]
export const vInput = (k: number[]): VInput => ({ mx: k[0] ?? 0, mz: k[1] ?? 0, a: (k[2] ?? 0) > 0, b: (k[3] ?? 0) > 0, c: (k[4] ?? 0) > 0 })

/** Between two states on a phone that doesn't run the match: the ball flown on, the players carried on, the clocks on. */
export function coast(
  g: { time: number; ball: { x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number; held: boolean }; ps: { x: number; z: number; vx: number; vz: number; at: number; y?: number; vy?: number }[] },
  air: { k: number; magnus: number },
  r: number,
  dt: number,
) {
  g.time += dt
  const b = g.ball
  if (!b.held) {
    fly(b, air, dt)
    if (b.y < r && b.vy < 0) {
      b.y = r
      b.vy *= -0.6
    }
  }
  for (const p of g.ps) {
    p.x += p.vx * dt
    p.z += p.vz * dt
    p.at += dt
    if (p.y !== undefined && p.vy !== undefined && (p.y > 0 || p.vy > 0)) {
      p.vy -= 9.81 * dt
      p.y = Math.max(0, p.y + p.vy * dt)
    }
  }
}
