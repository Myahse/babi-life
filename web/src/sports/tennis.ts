import type { Pose } from '../avatar/Human'
import { t as tr } from '../lib/i18n'
import { DT, aim, clamp, fly, gauss, seeded, type Air, type Ball } from './phys'

// Tennis, singles, at the real size: the court 23,77 × 8,23 m (10,97 m with the doubles alleys,
// drawn), the net 0,914 m at the centre strap and 1,07 m at the posts, the service boxes 6,40 m
// deep. The real scoring: 15-30-40, deuce and advantage, games, a set with its tie-break at
// games-all (a short set to 4 by default, ITF's short set, or to 6), ends changed after the odd
// games and every six points of a tie-break. The serve: from behind the baseline, to the right of
// the centre mark at an even count, into the box across; a fault, the second ball, the double
// fault; the let (off the net into the box). The ball: a real ball's drag and the spin's dip or
// float (phys.ts), its bounce on clay (slow, high, the mark left) or hard court (quicker, lower),
// called in or out on its first bounce (on the line is in), two bounces lose the point, into the
// net loses it. The strokes: forehand or backhand by the ball's side, the volley before the
// bounce, the smash over the head; topspin, slice, lob, drop shot; hold a button for the power,
// release it just before the ball comes for the timing. The player is right-handed; the court's
// x runs across (+x is the near player's right), z along it (the net at 0), y up.

export const LEN = 23.77
export const HL = LEN / 2
export const SINGLES = 8.23
export const HW = SINGLES / 2
export const DOUBLES = 10.97
export const DW = DOUBLES / 2
export const SERVICE = 6.4
export const NET_MID = 0.914
export const NET_POST = 1.07
/** The posts stand 0,914 m outside the doubles lines. */
export const POST_X = DW + 0.914
export const BALL_R = 0.0335
/** A tennis ball's air (57 g, 6,7 cm): ½ ρ Cd A / m, and its Magnus push. */
export const AIR: Air = { k: 0.0185, magnus: 0.00055 }

export type Surface = 'clay' | 'hard'
export type Shot = 'top' | 'slice' | 'lob' | 'drop' | 'flat'
export type Stroke = 'fh' | 'bh' | 'volley' | 'smash' | 'serve'
export type TennisRules = {
  /** Games to take the set (4: the short set, tie-break at 4-4; 6: tie-break at 6-6). */ games?: number
  /** Sets in the match (1 or 3: best of). */ sets?: number
  surface?: Surface
  /** The opponent's level, 0 débutant … 3 pro. */ level?: number
  /** The player moves alone to the ball (the phone's default); the stick still takes over. */ assist?: boolean
}
/** The hands: the stick, and which stroke button is held (null: none). */
export type TInput = { mx: number; mz: number; hold: Shot | null }
export const NO_TINPUT: TInput = { mx: 0, mz: 0, hold: null }

/** A level: top speed (m/s), the first step's push (acc, m/s²), the reaction (s), the power, the errors' spread, the serve (m/s), the first serves in, the taste for the net. */
type Level = { speed: number; acc: number; react: number; power: number; err: number; serve: number; first: number; net: number }
export const LEVELS: Level[] = [
  { speed: 4.6, acc: 9, react: 0.34, power: 0.5, err: 1.05, serve: 29, first: 0.55, net: 0.04 },
  { speed: 5.2, acc: 10.5, react: 0.26, power: 0.66, err: 0.78, serve: 34, first: 0.62, net: 0.1 },
  { speed: 5.7, acc: 12, react: 0.2, power: 0.82, err: 0.56, serve: 39, first: 0.66, net: 0.18 },
  { speed: 6.2, acc: 13.5, react: 0.14, power: 0.95, err: 0.4, serve: 44, first: 0.7, net: 0.25 },
]
/** The release's best moment before the ball (s), and how far off it still counts (the human's strokes). */
export const RELEASE_LEAD = 0.2
export const RELEASE_SPAN = 0.38

/** How far a player gets in t seconds from a standstill: the first step's push up to its top speed. */
export function runReach(t: number, vmax: number, acc: number, v0 = 0) {
  if (t <= 0) return 0
  const u = clamp(v0, 0, vmax)
  const tA = (vmax - u) / acc
  return t < tA ? u * t + 0.5 * acc * t * t : u * tA + 0.5 * acc * tA * tA + vmax * (t - tA)
}

export type TPlayer = {
  id: 0 | 1
  name: string
  human: boolean
  x: number
  z: number
  vx: number
  vz: number
  face: number
  pose: Pose
  /** Seconds into the pose (the Human's clock). */
  at: number
  take: number
  lvl: Level
  /** The ball this player will strike: when (match time), where, how. */
  plan: { t: number; x: number; y: number; z: number; stroke: Stroke; bounced: boolean; /** How far it had to run for it (1: flat out): a stretched stroke is a worse one. */ stretch: number; /** The coming ball's speed. */ pace: number } | null
  /** The stroke under way: when it began, and what it will do. */
  swing: { t0: number; stroke: Stroke } | null
  /** A button held: since when, which (the human's; the AI's chosen shot). */
  press: { t: number; shot: Shot } | null
  /** Released: when, the power, the shot, the aim (the stick then). */
  shot: { t: number; shot: Shot; power: number; mx: number; mz: number } | null
  /** Where to go back to between strokes. */
  home: [number, number]
  /** The last split-step (match time): the little hop as the other one strikes. */
  split: number
  /** Turned to run (a sprint faces where it goes), else facing the net (the shuffle). */
  sprint: boolean
  /** The human's stick now, in its own frame (+x its right, +z deep): the aim the scene shows while a stroke is held. */
  aim: [number, number]
}

export type TMoment = {
  kind: 'ace' | 'df' | 'fault' | 'let' | 'winner' | 'out' | 'net' | 'volley' | 'smash' | 'lob' | 'drop' | 'game' | 'break' | 'set' | 'match' | 'deuce' | 'adv' | 'tiebreak' | 'rally' | 'serve' | 'hit' | 'bounce' | 'cord' | 'change'
  by: number
  t: number
  text?: string
  v?: number
}

export type Tennis = {
  rules: Required<TennisRules>
  r: () => number
  time: number
  phase: 'count' | 'serve' | 'toss' | 'rally' | 'dead' | 'change' | 'over'
  /** When the phase began. */
  since: number
  ps: [TPlayer, TPlayer]
  me: 0 | 1
  ball: Ball & { bounces: number; hitBy: number; serve: boolean; cord: boolean; held: boolean; out: boolean; shots: number; speed: number }
  /** Each player's end: +1 the near half (z > 0), -1 the far one. */
  end: [number, number]
  server: 0 | 1
  /** 0: the first serve, 1: the second. */
  fault: 0 | 1
  score: { pts: [number, number]; games: [number, number]; sets: [number, number]; done: [number, number][]; tb: boolean; tbFirst: 0 | 1 }
  moments: TMoment[]
  /** The umpire's word on the screen (« 15-0 », « Faute ! »…). */
  call: { text: string; t: number } | null
  /** Where the ball last touched the court (clay keeps the mark). */
  mark: { x: number; z: number; t: number; out: boolean } | null
  /** The point's winner, once it's decided (dead ball). */
  won: 0 | 1 | null
  winner: 0 | 1 | null
  stats: { aces: [number, number]; df: [number, number]; winners: [number, number]; errors: [number, number]; firstIn: [number, number]; firstAll: [number, number]; fastest: [number, number]; longest: number; points: [number, number] }
  /** The ball's flight from the last stroke, foreseen (the plans read it). */
  path: Float32Array
  pathN: number
  pathT: number
  /** The human's last stroke, judged: « Parfait », « En retard »… */
  judge: { text: string; t: number } | null
}

const PATH_MAX = 520
/** The player's right on the court (its end's sign: facing the net from the near end, +x). */
const rightOf = (end: number) => end
/** The racket's side on the court: the avatar holds things in the hand at its own +x (avatar/Human.tsx hold), which faces the net from the near end at -x. */
const handOf = (end: number) => -end

/** A new match: the player (index 0) against the AI, the player at the near end serving first or not (a coin). */
export function createTennis(name: string, foe: string, r: () => number, rules: TennisRules = {}): Tennis {
  const rr: Required<TennisRules> = { games: rules.games ?? 4, sets: rules.sets ?? 1, surface: rules.surface ?? 'hard', level: clamp(rules.level ?? 1, 0, 3), assist: rules.assist ?? true }
  const player = (id: 0 | 1, nm: string, human: boolean, lvl: Level): TPlayer => ({ id, name: nm, human, x: 0, z: 0, vx: 0, vz: 0, face: 0, pose: 'idle', at: 0, take: 0, lvl, plan: null, swing: null, press: null, shot: null, home: [0, 0], split: -9, sprint: false, aim: [0, 0] })
  const g: Tennis = {
    rules: rr,
    r,
    time: -3,
    phase: 'count',
    since: -3,
    // The player's own level: a good club player's legs and hands (the timing does the rest).
    ps: [player(0, name, true, { ...LEVELS[2], acc: 14, err: 0.5 }), player(1, foe, false, LEVELS[rr.level])],
    me: 0,
    ball: { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, bounces: 0, hitBy: -1, serve: false, cord: false, held: true, out: false, shots: 0, speed: 0 },
    end: [1, -1],
    server: r() < 0.5 ? 0 : 1,
    fault: 0,
    score: { pts: [0, 0], games: [0, 0], sets: [0, 0], done: [], tb: false, tbFirst: 0 },
    moments: [],
    call: null,
    mark: null,
    won: null,
    winner: null,
    stats: { aces: [0, 0], df: [0, 0], winners: [0, 0], errors: [0, 0], firstIn: [0, 0], firstAll: [0, 0], fastest: [0, 0], longest: 0, points: [0, 0] },
    path: new Float32Array(PATH_MAX * 4),
    pathN: 0,
    pathT: 0,
    judge: null,
  }
  setupPoint(g)
  return g
}

export { seeded }

/** The net's height across the court (the strap pulls the middle down to 0,914 m). */
export function netH(x: number) {
  const u = Math.min(1, Math.abs(x) / POST_X)
  return NET_MID + (NET_POST - NET_MID) * u * u
}

const other = (i: number): 0 | 1 => (i === 0 ? 1 : 0)
const say = (g: Tennis, text: string) => void (g.call = { text, t: g.time })
const moment = (g: Tennis, kind: TMoment['kind'], by: number, text?: string, v?: number) => g.moments.push({ kind, by, t: g.time, text, v })

/** The points of the game now, as the umpire says them. */
export function pointWords(g: Tennis, server = g.server): string {
  const s = g.score
  const [a, b] = [s.pts[server], s.pts[other(server)]]
  if (s.tb) return `${a}-${b}`
  const w = ['0', '15', '30', '40']
  if (a >= 3 && b >= 3) return a === b ? 'deuce' : a > b ? 'adv-s' : 'adv-r'
  return `${w[Math.min(a, 3)]}-${w[Math.min(b, 3)]}`
}

/** Points played in this game (or tie-break): which court the serve goes from. */
const played = (g: Tennis) => g.score.pts[0] + g.score.pts[1]

/** Places for a new point: the server behind the baseline, the receiver back across, the ball in the server's hand. */
function setupPoint(g: Tennis) {
  const s = g.server
  const rcv = other(s)
  const even = played(g) % 2 === 0
  const [ps, pr] = [g.ps[s], g.ps[rcv]]
  const es = g.end[s]
  // Deuce court (an even count): the server to the right of the centre mark.
  const side = even ? 1 : -1
  ps.x = rightOf(es) * side * 0.75
  ps.z = es * (HL + 0.25)
  const er = g.end[rcv]
  pr.x = rightOf(er) * side * 2.7
  pr.z = er * (HL + 0.6 + (1 - pr.lvl.power) * 0.6)
  for (const p of g.ps) {
    p.vx = p.vz = 0
    p.face = g.end[p.id] > 0 ? Math.PI : 0
    p.plan = p.swing = p.press = p.shot = null
    p.pose = 'ready'
    p.sprint = false
    p.home = [p.x, p.z]
  }
  ps.pose = 'bounce'
  const b = g.ball
  Object.assign(b, { bounces: 0, hitBy: -1, serve: true, cord: false, held: true, out: false, shots: 0, spin: 0, vx: 0, vy: 0, vz: 0 })
  holdBall(g)
  g.won = null
  g.pathN = 0
}

/** The ball in the server's left hand. */
function holdBall(g: Tennis) {
  const p = g.ps[g.server]
  const e = g.end[p.id]
  Object.assign(g.ball, { x: p.x - handOf(e) * 0.32, y: 1.0, z: p.z - e * 0.25, vx: 0, vy: 0, vz: 0 })
}

/** One step of the match: dt real seconds; `input` the phone's hands; `others` the other humans' (online). */
export function stepTennis(g: Tennis, dt: number, input: TInput, others?: Map<number, TInput>) {
  if (g.phase === 'over') {
    g.time += dt
    return
  }
  let left = Math.min(dt, 0.1)
  while (left > 1e-6) {
    const h = Math.min(DT, left)
    left -= h
    tick(g, h, input, others)
  }
}

function tick(g: Tennis, dt: number, input: TInput, others?: Map<number, TInput>) {
  g.time += dt
  const hands = (p: TPlayer) => (p.id === g.me ? input : (others?.get(p.id) ?? null))
  switch (g.phase) {
    case 'count':
      if (g.time >= 0) phase(g, 'serve')
      break
    case 'serve':
      serveWait(g, hands(g.ps[g.server]))
      break
    case 'toss':
      toss(g, hands(g.ps[g.server]))
      break
    case 'rally':
      // (Never stuck: a ball rolling dead with no second bounce counted.)
      if (g.time - g.pathT > 6) endPoint(g, g.ball.hitBy >= 0 ? (g.ball.hitBy as 0 | 1) : 0, 'winner')
      break
    case 'dead':
      if (g.time - g.since > 2.2) nextPoint(g)
      break
    case 'change':
      if (g.time - g.since > 2.6) {
        phase(g, 'serve')
        setupPoint(g)
      }
      break
  }
  if (g.phase === 'rally' || g.phase === 'dead') ballStep(g, dt)
  for (const p of g.ps) move(g, p, dt, hands(p))
}

function phase(g: Tennis, ph: Tennis['phase']) {
  g.phase = ph
  g.since = g.time
}

/* ---------- The serve ---------- */

function serveWait(g: Tennis, h: TInput | null) {
  const p = g.ps[g.server]
  holdBall(g)
  p.pose = 'bounce'
  const wait = g.time - g.since
  if (p.human && h) {
    // A button pressed: the toss goes up. (The rally's buttons are the serve's here: À plat, Lifté, Slicé.)
    if (h.hold && wait > 0.4) {
      p.press = { t: g.time, shot: h.hold === 'lob' || h.hold === 'drop' ? 'flat' : h.hold }
      startToss(g)
    } else if (wait > 25) {
      // The 25 seconds: served for them (a phone left on the table doesn't stop the match).
      p.press = { t: g.time, shot: 'top' }
      startToss(g)
    }
  } else if (!p.human && wait > 1.4 + g.r() * 0.8) {
    // The AI: a flat first ball now and then, else the kick; the second ball always the kick.
    const shot: Shot = g.fault === 1 ? 'top' : g.r() < 0.45 + p.lvl.power * 0.3 ? 'flat' : g.r() < 0.5 ? 'slice' : 'top'
    p.press = { t: g.time, shot }
    startToss(g)
  }
}

function startToss(g: Tennis) {
  const p = g.ps[g.server]
  const e = g.end[p.id]
  phase(g, 'toss')
  p.pose = 'serve'
  p.take++
  p.at = 0
  Object.assign(g.ball, { x: p.x + handOf(e) * 0.22, y: 1.55, z: p.z - e * 0.35, vx: 0, vy: 5.55, vz: 0, spin: 0, held: false })
  moment(g, 'serve', p.id)
}

/** The toss is up: the ball rises to about 3 m; released near its top, the serve is struck. */
function toss(g: Tennis, h: TInput | null) {
  const p = g.ps[g.server]
  const b = g.ball
  const t = g.time - g.since
  b.vy -= 9.81 * DT
  b.y += b.vy * DT
  p.at = Math.min(t, 0.55)
  let go = false
  if (p.human && h) go = !h.hold && t > 0.12
  else if (!p.human) go = t > 0.56 + gauss(g.r) * (0.03 + p.lvl.err * 0.06)
  if (go && b.y > 1.9) return strikeServe(g, p, t, p.human && h ? h.mx : 0)
  // Let fall: caught, served again (no fault).
  if (b.y < 1.5 && b.vy < 0) {
    phase(g, 'serve')
    p.press = null
    say(g, tr('Balle rattrapée'))
  }
}

function strikeServe(g: Tennis, p: TPlayer, t: number, mx: number) {
  const e = g.end[p.id]
  const b = g.ball
  const shot = p.press?.shot ?? 'top'
  // The timing: the ball at its top (0,57 s up) is the best.
  const q = clamp(1 - Math.abs(t - 0.6) / 0.28, 0, 1)
  const second = g.fault === 1
  const lvl = p.lvl
  const human = p.human
  // Where: the box across; the stick (the human's) or the AI's pick, out wide, at the body, down the T.
  const even = played(g) % 2 === 0
  const boxSide = -rightOf(e) * (even ? 1 : -1)
  let wide: number
  if (human) wide = clamp(0.5 + mx * rightOf(e) * boxSide * 0.42, 0.08, 0.92)
  else wide = second ? 0.3 + g.r() * 0.4 : g.r() < 0.4 ? 0.9 : g.r() < 0.5 ? 0.1 : 0.5
  const depth = SERVICE - (second ? 0.8 : 0.5)
  let tx = boxSide * (0.25 + wide * (HW - 0.5))
  let tz = -e * depth
  // The errors: a worse timing and a harder ball spread wider; the second ball is kept safe.
  const speedK = shot === 'flat' ? 1 : shot === 'slice' ? 0.86 : 0.76
  const base = human ? 34 + q * 14 : lvl.serve
  const v = (second ? base * 0.78 : base) * speedK * (human ? 1 : 0.94 + g.r() * 0.1)
  const sigma = (human ? 0.3 + (1 - q) * 1.0 : 0.45 + lvl.err * 0.55) * (second ? 0.62 : 1) * (shot === 'flat' ? 1.2 : 0.85)
  tx += gauss(g.r) * sigma * 0.8
  tz += -e * gauss(g.r) * sigma
  const spin = shot === 'top' ? 260 : shot === 'slice' ? 70 : 25
  const from: [number, number, number] = [b.x, b.y, b.z]
  const dist = Math.hypot(tx - from[0], tz - from[2])
  const T = dist / (v * 0.86)
  const vel = aim(from, [tx, BALL_R, tz], T, spin, AIR)
  // The human: a sliver of the speed shows the timing (too early or late hits it into the net).
  Object.assign(b, { vx: vel[0], vy: vel[1], vz: vel[2], spin, bounces: 0, hitBy: p.id, serve: true, cord: false, held: false, out: false, shots: 1, speed: Math.hypot(...vel) })
  if (!second) g.stats.firstAll[p.id]++
  g.stats.fastest[p.id] = Math.max(g.stats.fastest[p.id], Math.round(b.speed * 3.6))
  p.swing = { t0: g.time - 0.6, stroke: 'serve' }
  p.shot = null
  p.press = null
  if (human) g.judge = { text: q > 0.8 ? 'Parfait' : t < 0.6 ? 'Trop tôt' : 'Trop tard', t: g.time }
  moment(g, 'hit', p.id, 'serve', b.speed)
  phase(g, 'rally')
  foresee(g)
}

/* ---------- The ball ---------- */

function ballStep(g: Tennis, dt: number) {
  const b = g.ball
  if (b.held) return
  const z0 = b.z
  fly(b, AIR, dt)
  // The net: crossing it, below the tape it's stopped; on the tape it's the net cord.
  if (Math.sign(z0) !== Math.sign(b.z) && Math.abs(b.x) < POST_X) {
    const top = netH(b.x)
    if (b.y < top - BALL_R) {
      b.z = z0 > 0 ? 0.06 : -0.06
      b.vz *= -0.12
      b.vx *= 0.3
      b.vy = Math.min(b.vy, 0) * 0.3
      if (g.phase === 'rally') {
        say(g, tr('Filet !'))
        moment(g, 'net', b.hitBy)
        if (b.serve) fault(g)
        else endPoint(g, other(b.hitBy), 'error')
      }
    } else if (b.y < top + BALL_R) {
      // Over by a hair, slowed and kicked up.
      b.vz *= 0.55
      b.vx *= 0.8
      b.vy = Math.abs(b.vy) * 0.25 + 0.8
      b.cord = true
      if (g.phase === 'rally') moment(g, 'cord', b.hitBy)
      if (g.phase === 'rally') foresee(g)
    }
  }
  if (b.y < BALL_R && b.vy < 0) bounce(g)
  // The strokes due now.
  if (g.phase === 'rally') for (const p of g.ps) if (p.plan && g.time >= p.plan.t - 1e-6) strike(g, p)
}

/** The court's grip: clay slows the ball and sends it up, the hard court keeps it low and quick. */
const SURF = { clay: { e: 0.76, mu: 0.66 }, hard: { e: 0.74, mu: 0.48 } }

function bounce(g: Tennis) {
  const b = g.ball
  const s = SURF[g.rules.surface]
  b.y = BALL_R
  const vy = -b.vy
  const vh = Math.hypot(b.vx, b.vz)
  // Topspin kicks forward and up, slice skids low.
  const e = s.e * (1 + clamp(b.spin, -150, 300) / 2400)
  b.vy = vy * e
  const slow = vh > 0.01 ? clamp((s.mu * (1 + s.e) * vy) / vh, 0, 0.42) * (1 - clamp(b.spin, -150, 300) / 900) : 0
  b.vx *= 1 - slow
  b.vz *= 1 - slow
  b.spin *= 0.4
  if (vy < 0.6) {
    b.vy = 0
    b.vx *= 0.96
    b.vz *= 0.96
  }
  if (g.phase !== 'rally') return
  b.bounces++
  moment(g, 'bounce', b.hitBy, undefined, vy)
  const side = Math.sign(b.z) || 1
  const hitterSide = g.end[b.hitBy]
  const tol = BALL_R
  if (b.bounces === 1) {
    // On the hitter's own side (off the net): their point lost.
    if (side === hitterSide) return endPoint(g, other(b.hitBy), 'error')
    let ok: boolean
    if (b.serve) {
      const s0 = g.ps[b.hitBy]
      const even = played(g) % 2 === 0
      const boxSide = -rightOf(g.end[s0.id]) * (even ? 1 : -1)
      ok = Math.abs(b.z) <= SERVICE + tol && b.x * boxSide >= -tol && Math.abs(b.x) <= HW + tol
    } else ok = Math.abs(b.z) <= HL + tol && Math.abs(b.x) <= HW + tol
    g.mark = { x: b.x, z: b.z, t: g.time, out: !ok }
    if (!ok) {
      b.out = true
      say(g, tr('Faute !'))
      moment(g, 'out', b.hitBy)
      if (b.serve) return fault(g)
      return endPoint(g, other(b.hitBy), 'error')
    }
    if (b.serve && b.cord) {
      say(g, tr('Let !'))
      moment(g, 'let', b.hitBy)
      phase(g, 'dead')
      g.won = null
      return
    }
    if (b.serve && g.fault === 0) g.stats.firstIn[b.hitBy]++
  } else if (b.bounces >= 2) {
    // Twice on the receiver's side: the hitter's point (an ace if no one touched the serve).
    return endPoint(g, b.hitBy as 0 | 1, b.serve ? 'ace' : 'winner')
  }
}

/** A serve fault: the second ball, or the double fault. */
function fault(g: Tennis) {
  const s = g.server
  if (g.fault === 0) {
    g.fault = 1
    moment(g, 'fault', s)
    phase(g, 'dead')
    g.won = null
  } else {
    g.stats.df[s]++
    say(g, tr('Double faute'))
    moment(g, 'df', s)
    endPoint(g, other(s), 'df')
  }
}

function endPoint(g: Tennis, to: 0 | 1, how: 'error' | 'winner' | 'ace' | 'df') {
  if (g.phase !== 'rally') return
  phase(g, 'dead')
  g.won = to
  g.stats.points[to]++
  const loser = other(to)
  for (const p of g.ps) p.plan = null
  if (how === 'ace') {
    g.stats.aces[to]++
    say(g, tr('Ace !'))
    moment(g, 'ace', to)
  } else if (how === 'winner') {
    g.stats.winners[to]++
    moment(g, 'winner', to, undefined, g.ball.shots)
  } else if (how === 'error') g.stats.errors[loser]++
  if (g.ball.shots >= 9) moment(g, 'rally', to, undefined, g.ball.shots)
  g.stats.longest = Math.max(g.stats.longest, g.ball.shots)
}

/** After a dead ball: the second serve, the let again, or the point scored and the next one. */
function nextPoint(g: Tennis) {
  if (g.won === null) {
    phase(g, 'serve')
    setupPoint(g)
    return
  }
  g.fault = 0
  const changed = award(g, g.won)
  if (g.winner !== null) {
    phase(g, 'over')
    return
  }
  if (changed) {
    phase(g, 'change')
    g.end = [g.end[0] === 1 ? -1 : 1, g.end[1] === 1 ? -1 : 1]
    moment(g, 'change', 0)
    // The players walk over (drawn at their new ends straight away, the camera turns).
    setupPoint(g)
    g.phase = 'change'
    return
  }
  phase(g, 'serve')
  setupPoint(g)
}

/** A point to `to`: the game, the set, the match as they come; true when the ends change. */
function award(g: Tennis, to: 0 | 1): boolean {
  const s = g.score
  const lo = other(to)
  s.pts[to]++
  const [a, b] = [s.pts[to], s.pts[lo]]
  const name = g.ps[to].name
  if (s.tb) {
    const n = a + b
    // The tie-break: to 7 by two; the serve turns after the first point, then every two.
    if (a >= 7 && a - b >= 2) return winGame(g, to, true)
    if (n % 2 === 1) g.server = other(g.server)
    say(g, `${s.pts[0]}-${s.pts[1]}`)
    return n % 6 === 0
  }
  if (a >= 4 && a - b >= 2) return winGame(g, to, false)
  const w = pointWords(g)
  if (w === 'deuce') {
    say(g, tr('Égalité'))
    moment(g, 'deuce', to)
  } else if (w === 'adv-s' || w === 'adv-r') {
    say(g, tr('Avantage {name}', { name }))
    moment(g, 'adv', to, name)
  } else say(g, w)
  return false
}

function winGame(g: Tennis, to: 0 | 1, tb: boolean): boolean {
  const s = g.score
  const lo = other(to)
  const broke = !tb && g.server !== to
  s.games[to]++
  s.pts = [0, 0]
  const name = g.ps[to].name
  const n = s.games[0] + s.games[1]
  const target = g.rules.games
  const setWon = tb || (s.games[to] >= target && s.games[to] - s.games[lo] >= 2)
  // The next game's server: the other one (after a tie-break, the one who received first in it).
  g.server = tb ? other(s.tbFirst) : other(g.server)
  if (setWon) {
    s.sets[to]++
    s.done.push([s.games[0], s.games[1]])
    const odd = n % 2 === 1
    s.games = [0, 0]
    s.tb = false
    if (s.sets[to] > g.rules.sets / 2) {
      g.winner = to
      say(g, tr('Jeu, set et match {name}', { name }))
      moment(g, 'match', to, name)
      return false
    }
    say(g, tr('Jeu et set {name}', { name }))
    moment(g, 'set', to, name)
    return odd
  }
  say(g, broke ? tr('Jeu {name}, break !', { name }) : tr('Jeu {name}', { name }))
  moment(g, broke ? 'break' : 'game', to, name)
  if (s.games[0] === target && s.games[1] === target) {
    s.tb = true
    s.tbFirst = g.server
    moment(g, 'tiebreak', to)
    say(g, tr('Jeu décisif !'))
  }
  return n % 2 === 1
}

/* ---------- The foresight: the ball's flight from now, for the plans ---------- */

/** The ball flown ahead from now, bounces and all (not the net: past it already, or it stops there), into g.path. */
function foresee(g: Tennis) {
  const b: Ball = { ...g.ball }
  const s = SURF[g.rules.surface]
  let n = 0
  let bounces = 0
  g.pathT = g.time
  for (let i = 0; i < PATH_MAX && bounces < 2; i++) {
    fly(b, AIR)
    if (b.y < BALL_R && b.vy < 0) {
      bounces++
      b.y = BALL_R
      const vy = -b.vy
      const vh = Math.hypot(b.vx, b.vz)
      const e = s.e * (1 + clamp(b.spin, -150, 300) / 2400)
      b.vy = vy * e
      const slow = vh > 0.01 ? clamp((s.mu * (1 + s.e) * vy) / vh, 0, 0.42) * (1 - clamp(b.spin, -150, 300) / 900) : 0
      b.vx *= 1 - slow
      b.vz *= 1 - slow
      b.spin *= 0.4
    }
    g.path.set([b.x, b.y, b.z, bounces], n * 4)
    n++
  }
  g.pathN = n
  // The one who must play it: their plan (the AI after its reaction, the human straight away).
  const to = g.ps.find((p) => g.end[p.id] !== g.end[g.ball.hitBy])
  for (const p of g.ps) p.plan = null
  if (to) {
    plan(g, to)
    // The split-step: the little hop as the other one strikes (not off a net cord, the ball already close).
    if (!g.ball.cord && g.time - to.split > 0.6) to.split = g.time
  }
}

/** The stroke's reach: the racket's sweet spot about 0,8 m out from the body. */
const REACH = 0.8

/**
 * Choose where to strike the coming ball: the best spot it can run to in time (the first step's push, then its top
 * speed: a wide ball needs the whole sprint); none in reach, it still runs for the nearest (and lunges).
 */
function plan(g: Tennis, p: TPlayer) {
  const e = g.end[p.id]
  const P = g.path
  let bi = -1
  let bs = 0
  let bStretch = 0
  let fi = -1
  let fGap = 0
  // (The AI's reaction counts from the other's stroke; the human's plan is made again as it runs.)
  // (A fast ball is read later; a serve later still: the toss hides where it goes.)
  const react = p.human ? 0 : Math.max(0, p.lvl.react + Math.max(0, g.ball.speed - 24) * 0.012 + (g.ball.serve ? 0.12 : 0) - (g.time - g.pathT))
  const hand = handOf(e)
  for (let i = 0; i < g.pathN; i++) {
    const o = i * 4
    const x = P[o]
    const y = P[o + 1]
    const z = P[o + 2]
    const bn = P[o + 3]
    if (bn >= 2 || z * e < 0.4 || y < 0.22 || y > 3.15) continue
    const t = g.pathT + (i + 1) * DT - g.time
    if (t < 0.04) continue
    // Before the bounce: a volley near the net, a smash if high; at the back only the ball out of reach of a bounce (a lob coming down long).
    const volley = bn === 0
    if (volley && z * e > 7 && y < 2.3) continue
    // Out of the court on its way: let it go (the AI calls it out by leaving it).
    if (volley && !p.human && willBeOut(g)) continue
    // (Taken on the rise rather than far back behind the baseline: there's a fence there.)
    if (z * e > HL + 4) continue
    const fhSide = (x - p.x) * hand >= -0.3
    const dx = x - hand * (fhSide ? 1 : -1) * REACH - p.x
    const dz = z + e * 0.15 - p.z
    const need = Math.hypot(dx, dz)
    // Already running that way: the speed it has counts.
    const v0 = need > 0.01 ? (p.vx * dx + p.vz * dz) / need : 0
    const can = runReach(t - react, p.lvl.speed, p.lvl.acc, v0) + 0.3
    if (need > can + 0.25) {
      if (fi < 0 || need - can < fGap) [fi, fGap] = [i, need - can]
      continue
    }
    // A comfortable height after the bounce, coming down; a volley well above the net.
    const comfort = volley ? (y > 2.3 ? 0.5 : Math.abs(y - 1.2)) : Math.abs(y - 1.0) + (P[o + 5] > y ? 0.25 : 0)
    const score = comfort + (need > can ? 2 : 0) + t * 0.15 + (volley && z * e > 4 ? 0.4 : 0) + Math.max(0, z * e - HL - 1) * 1.2
    if (bi < 0 || score < bs) [bi, bs, bStretch] = [i, score, clamp(need / Math.max(0.3, can), 0, 1.2)]
  }
  // Out of reach everywhere: run for the nearest all the same (the lunge may get there; a clear winner is let go).
  if (bi < 0 && fi >= 0 && fGap < (g.ball.serve ? 0.5 : 1.6)) [bi, bStretch] = [fi, 1.2]
  if (bi < 0) return
  const o = bi * 4
  const [x, y, z, bn] = [P[o], P[o + 1], P[o + 2], P[o + 3]]
  const fh = (x - p.x) * hand >= -0.3
  const stroke: Stroke = bn === 0 ? (y > 2.3 ? 'smash' : 'volley') : fh ? 'fh' : 'bh'
  p.plan = { t: g.pathT + (bi + 1) * DT, x, y, z, stroke, bounced: bn > 0, stretch: bStretch, pace: g.ball.speed }
}

/** Will the ball in flight land out (its first bounce outside the singles court)? */
function willBeOut(g: Tennis) {
  for (let i = 0; i < g.pathN; i++)
    if (g.path[i * 4 + 3] >= 1) {
      const [x, z] = [g.path[i * 4], g.path[i * 4 + 2]]
      return Math.abs(x) > HW + BALL_R || Math.abs(z) > HL + BALL_R
    }
  return false
}

/* ---------- The strokes ---------- */

function strike(g: Tennis, p: TPlayer) {
  const pl = p.plan!
  p.plan = null
  const e = g.end[p.id]
  const b = g.ball
  const fh = pl.stroke !== 'bh'
  const hx = p.x + handOf(e) * (fh ? 1 : -1) * REACH
  const reach = Math.hypot(b.x - hx, b.z - (p.z - e * 0.15))
  // Not there in time: the ball goes by (a lunge gets a little further, a worse stroke).
  if (reach > (b.serve ? 1.1 : 1.4)) return
  if (reach > 0.95) pl.stretch = Math.max(pl.stretch, 1 + (reach - 0.95))
  const lvl = p.lvl
  // The shot: the human's buttons (or a late block if none), the AI's choice.
  let shot: Shot
  let power: number
  let q: number
  let mx = 0
  let mz = 0
  let bias = 0
  let attack = false
  if (p.human) {
    const s = p.shot
    if (s && g.time - s.t < 0.9) {
      shot = s.shot
      power = s.power
      const early = pl.t - s.t
      q = clamp(1 - Math.abs(early - 0.2) / 0.38, 0, 1)
      mx = s.mx
      mz = s.mz
      g.judge = { text: q > 0.82 ? 'Parfait' : early > 0.2 ? 'Trop tôt' : 'En retard', t: g.time }
      // Early pulls the ball across, late pushes it out the other way.
      bias = (early > 0.2 ? -1 : 1) * (1 - q) * 1.3
    } else if (p.press) {
      // Still held as the ball came: struck anyway, late.
      shot = p.press.shot
      power = clamp((g.time - p.press.t) / 0.9, 0, 1.15)
      q = 0.25
      bias = 0.9
      g.judge = { text: 'En retard', t: g.time }
    } else {
      shot = 'slice'
      power = 0.25
      q = 0.08
      g.judge = { text: 'Trop tard', t: g.time }
    }
    p.press = null
    p.shot = null
  } else {
    ;[shot, mx, mz, attack] = aiChoice(g, p, pl)
    power = attack ? clamp(lvl.power + 0.15 + g.r() * 0.1, 0.2, 1) : clamp(lvl.power * (0.8 + g.r() * 0.35), 0.2, 1)
    q = clamp(1 - Math.abs(gauss(g.r)) * (0.3 + lvl.err * 0.55), 0, 1)
  }
  // On the run, or against a heavy ball, the stroke is worse; and a stretched one only gets the ball back, slower, shorter.
  q *= 1 - 0.55 * Math.max(0, pl.stretch - 0.45) ** 2 * 3
  q *= 1 - clamp((pl.pace - 22) / 60, 0, 0.3)
  shoot(g, p, shot, power, clamp(q, 0, 1), mx, mz, pl.stroke, bias, attack, clamp((pl.stretch - 0.7) / 0.5, 0, 1))
}

/** The AI's stroke: what, and where (as a stick would say it: x across to its right, z deep). */
function aiChoice(g: Tennis, p: TPlayer, pl: NonNullable<TPlayer['plan']>): [Shot, number, number, boolean] {
  const r = g.r
  const foe = g.ps[other(p.id)]
  const ef = g.end[foe.id]
  const atNet = Math.abs(foe.z) < 5
  const deepFoe = Math.abs(foe.z) > HL - 0.3
  const e = g.end[p.id]
  // To the side the opponent isn't (in the AI's own frame: its right is +).
  const open = Math.sign(-(foe.x - 0) * rightOf(e)) || (r() < 0.5 ? 1 : -1)
  if (pl.stroke === 'smash') return ['flat', open * 0.8, 0.4, true]
  if (pl.stroke === 'volley') return [r() < 0.25 && !atNet ? 'drop' : 'flat', open * (0.6 + r() * 0.4), r() < 0.5 ? 1 : -0.6, true]
  if (atNet) return r() < 0.35 ? ['lob', open * 0.3, 1, false] : ['top', open * 0.9, -0.2, true]
  // A short ball (it came in near the service line): the drop shot on a deep opponent, else the attack.
  const short = Math.abs(pl.z) < SERVICE + 2.5
  if (short && deepFoe && r() < 0.15) return ['drop', open * 0.5, -1, false]
  if (r() < 0.03 && deepFoe) return ['drop', open * 0.4, -1, false]
  // A ball to go for: short, slow and sitting up, or the opponent pulled off the court: to the open side, hard.
  const chance = short || pl.pace < 16 || Math.abs(foe.x) > 2.4
  if (chance && r() < 0.35 + p.lvl.power * 0.4) return [r() < 0.5 ? 'flat' : 'top', open * (0.8 + r() * 0.2), short ? 0.1 + r() * 0.5 : 0.4 + r() * 0.5, true]
  if (r() < 0.06) return ['lob', 0, 1, false]
  // The rally: mostly crosscourt and deep, sometimes down the line, sliced on a ball low on the backhand.
  const cross = Math.sign(pl.x * rightOf(e)) || 1
  const across = r() < 0.7 ? -cross * (0.4 + r() * 0.5) : cross * (0.5 + r() * 0.4)
  void ef
  const slice = pl.stroke === 'bh' && (pl.y < 0.7 || r() < 0.25)
  return [slice ? 'slice' : 'top', across, short ? 0.5 + r() * 0.5 : r() * 0.9 - 0.1, false]
}

/** Where a stroke is aimed on the other half, before its errors: the stick in the player's own frame (+mx its right, +mz deep). The scene shows it while the button is held. */
export function aimAt(e: number, shot: Shot, stroke: Stroke, mx: number, mz: number): [number, number] {
  const lat = clamp(mx, -1, 1)
  const deep = clamp(mz, -1, 1)
  let tx = rightOf(e) * lat * (HW - 0.55)
  const depth = shot === 'lob' ? HL - 1.6 + deep * 0.6 : shot === 'drop' ? 1.6 + Math.max(0, deep) * 1.2 : shot === 'slice' ? HL - 2.6 + deep * 2 : shot === 'flat' ? (stroke === 'volley' ? HL - 3 + deep * 3 : HL - 2.2 + deep * 2) : HL - 2.4 + deep * 1.9
  if (shot === 'drop') tx *= 0.7
  // A volley takes the pace of the ball and angles it short.
  else if (stroke === 'volley') tx *= 1.08
  return [tx, -e * depth]
}

/** The ball struck: aimed at a point on the other half, spread by the timing and the power, flown by phys.ts. */
function shoot(g: Tennis, p: TPlayer, shot: Shot, power: number, q: number, mx: number, mz: number, stroke: Stroke, bias = 0, attack = false, def = 0) {
  const e = g.end[p.id]
  const b = g.ball
  const from: [number, number, number] = [b.x, b.y, b.z]
  let v: number
  let spin: number
  let T: number | null = null
  const over = Math.max(0, power - 1)
  const pw = Math.min(1, power)
  switch (shot) {
    case 'lob':
      v = 13 + pw * 4
      spin = 140
      T = 1.65 + pw * 0.35
      break
    case 'drop':
      v = 9 + pw * 3
      spin = -160
      T = 0.95 + (1 - pw) * 0.2
      break
    case 'slice':
      v = 15 + pw * 9
      spin = -120
      break
    case 'flat':
      v = (stroke === 'smash' ? 26 : stroke === 'volley' ? 15 : 20) + pw * (stroke === 'smash' ? 14 : 12)
      spin = 30
      break
    default:
      v = 16 + pw * 15
      spin = 180 + pw * 120
  }
  // Going for it: flatter, harder.
  if (attack) v *= 1.1
  let [tx, tz] = aimAt(e, shot, stroke, mx, mz)
  // A poorly met ground stroke sits up short and slower (the other one's chance to attack it).
  if ((stroke === 'fh' || stroke === 'bh') && shot !== 'drop' && shot !== 'lob') {
    v *= 1 - (1 - q) * 0.25
    tz = -e * Math.max(SERVICE + 0.3, Math.abs(tz) - (1 - q) * (1 - q) * 4.5)
  }
  // Stretched: only a ball back, slower, shorter, nearer the middle.
  if (def > 0 && shot !== 'drop') {
    v *= 1 - 0.3 * def
    tz = -e * Math.max(SERVICE - 0.5, Math.abs(tz) - def * 3.5)
    tx *= 1 - 0.5 * def
  }
  // The errors. The human's: the timing (late hits push the ball the other way), power past the full meter (long), fast balls spread more.
  // The AI's: it aims inside the lines with a little scatter, and misses outright now and then, more when going for it,
  // stretched or against a heavy ball (into the net, long or wide), at its level's rate.
  let sig = (p.human ? 0.2 : 0.25) + (1 - q) * (p.human ? 1.2 : 0.35) + (v / 30) * (p.human ? 0.25 : 0.15) + over * 2.5
  let miss: 'net' | 'long' | 'wide' | null = null
  if (!p.human) {
    const m = 0.25 + sig * (attack ? 0.6 : 1)
    tx = clamp(tx, -(HW - m), HW - m)
    if (shot !== 'drop') tz = -e * Math.min(Math.abs(tz), HL - m)
    const pErr = (0.015 + p.lvl.err * 0.06) * (attack ? 1.7 : 1) * (1 + def * 1.5) * (1 + Math.max(0, b.speed - 24) / 25) * (1 + (1 - q) * 0.8)
    if (g.r() < pErr) {
      const k = g.r()
      miss = k < 0.4 ? 'net' : k < 0.75 ? 'long' : 'wide'
      if (miss === 'net') tz = -e * (0.3 + g.r() * 0.9)
      else if (miss === 'long') tz = -e * (HL + 0.15 + g.r() * 1.6)
      else tx = (Math.sign(tx) || 1) * (HW + 0.1 + g.r() * 1.3)
      sig *= 0.4
    }
  }
  tx += gauss(g.r) * sig * 0.75 + rightOf(e) * bias
  tz += -e * (gauss(g.r) * sig * 0.8 + over * 2.2)
  const dist = Math.hypot(tx - from[0], tz - from[2])
  const flight = T ?? dist / (v * 0.84)
  // A struck ball always clears the net when it can (the players aim over it): low hits, bad timings, the ones that can't, don't.
  let vel = aim(from, [tx, BALL_R, tz], flight, spin, AIR)
  const clear = netClearance(from, vel, spin)
  const need = shot === 'drop' ? 0.2 : 0.35 + q * 0.4
  if (miss !== 'net' && clear < need && (!p.human || q > 0.35 || g.r() < 0.5)) vel = aim(from, [tx, BALL_R, tz], flight * (1 + (need - clear) * 0.35), spin, AIR)
  Object.assign(b, { vx: vel[0], vy: vel[1], vz: vel[2], spin, bounces: 0, hitBy: p.id, serve: false, cord: false, out: false, speed: Math.hypot(...vel) })
  b.shots++
  p.swing = null
  moment(g, stroke === 'smash' ? 'smash' : stroke === 'volley' ? 'volley' : shot === 'lob' ? 'lob' : shot === 'drop' ? 'drop' : 'hit', p.id, shot, b.speed)
  // Home: back to the middle of the baseline, a step to the side the ball went; at the net after a volley or an approach.
  const toNet = stroke === 'volley' || stroke === 'smash' || (Math.abs(b.z) < SERVICE + 1 && !p.human && g.r() < p.lvl.net * 3)
  p.home = [-tx * 0.35, e * (toNet ? 2.6 : HL + 0.4 + (1 - p.lvl.power) * 0.5)]
  foresee(g)
}

/** How high over the tape a flight goes (negative: into the net). */
function netClearance(from: [number, number, number], v: [number, number, number], spin: number) {
  const b: Ball = { x: from[0], y: from[1], z: from[2], vx: v[0], vy: v[1], vz: v[2], spin }
  for (let i = 0; i < 400; i++) {
    const z0 = b.z
    fly(b, AIR)
    if (Math.sign(z0) !== Math.sign(b.z)) return b.y - BALL_R - netH(b.x)
    if (b.y < 0) return -1
  }
  return 9
}

/* ---------- The players' legs ---------- */

function move(g: Tennis, p: TPlayer, dt: number, h: TInput | null) {
  const e = g.end[p.id]
  // The stroke's pose and its clock (the swing reaches the ball 0,3 s in).
  if (p.plan && g.phase === 'rally') {
    const lead = g.time - (p.plan.t - 0.3)
    if (lead >= 0 && !p.swing) {
      p.swing = { t0: p.plan.t - 0.3, stroke: p.plan.stroke }
      p.pose = p.plan.stroke === 'fh' ? 'forehand' : p.plan.stroke === 'bh' ? 'backhand' : p.plan.stroke === 'smash' ? 'serve' : 'volleyhit'
      p.take++
    }
  }
  if (p.swing) {
    // (A smash is the serve's motion: its contact 0,6 s in.)
    p.at = g.time - p.swing.t0 + (p.swing.stroke === 'smash' ? 0.3 : 0)
    if (p.at > (p.swing.stroke === 'serve' || p.swing.stroke === 'smash' ? 1.25 : 0.95)) p.swing = null
  }
  // The human's stroke spot, made again as the player moves (the stick can take it elsewhere).
  if (p.human && g.phase === 'rally' && g.ball.hitBy !== p.id && g.ball.hitBy >= 0 && !p.swing && Math.round(g.time / DT) % 12 === 0) plan(g, p)
  // The human's buttons: held (the power climbs), released (the stroke's aim and timing kept).
  if (p.human && h) {
    p.aim[0] = h.mx
    p.aim[1] = -h.mz
  }
  if (p.human && h && g.phase === 'rally') {
    if (h.hold && !p.press) p.press = { t: g.time, shot: h.hold }
    if (!h.hold && p.press) {
      const power = clamp((g.time - p.press.t) / 0.9, 0.15, 1.15)
      // The stick, turned into the player's frame: up the screen is deep, right is the player's right.
      p.shot = { t: g.time, shot: p.press.shot, power, mx: h.mx, mz: -h.mz }
      p.press = null
    }
  }
  if (g.phase === 'serve' || g.phase === 'toss' || g.phase === 'count') {
    p.vx = p.vz = 0
    if (g.phase !== 'toss' || p.id !== g.server) p.pose = p.id === g.server ? (g.phase === 'toss' ? 'serve' : 'bounce') : 'ready'
    p.face = e > 0 ? Math.PI : 0
    return
  }
  if (g.phase === 'change') {
    p.vx = p.vz = 0
    p.pose = 'walk'
    return
  }
  // Where to be: at the stroke's spot (the racket side to the ball), else home.
  let tx = p.home[0]
  let tz = p.home[1]
  if (p.plan) {
    const fh = p.plan.stroke !== 'bh'
    tx = p.plan.x - handOf(e) * (fh ? 1 : -1) * REACH
    tz = p.plan.z + e * 0.15
  }
  // The AI waits its reaction before going (to the plan) after the other's stroke.
  const late = !p.human && g.time - g.pathT < p.lvl.react && g.ball.hitBy !== p.id
  const clay = g.rules.surface === 'clay'
  // The brakes: a planted stop (a slide on clay) is quicker than the push off.
  const brake = clay ? 13 : 16
  let wx = 0
  let wz = 0
  const stick = p.human && h ? Math.hypot(h.mx, h.mz) : 0
  // A stroke button held with the ball coming: the stick aims, the legs go on to the ball alone (as on TV games).
  const aiming = p.human && !!p.press && !!p.plan && g.rules.assist
  if (p.human && h && !aiming && (stick > 0.2 || !g.rules.assist)) {
    // The stick, in the player's frame: up the screen is towards the net.
    wx = h.mx * rightOf(e)
    wz = h.mz * e
    const m = Math.hypot(wx, wz)
    if (m > 1) {
      wx /= m
      wz /= m
    }
    wx *= p.lvl.speed
    wz *= p.lvl.speed
  } else if (!late && g.phase === 'rally') {
    const dx = tx - p.x
    const dz = tz - p.z
    const d = Math.hypot(dx, dz)
    // Run in time and arrive a beat early, set: flat out when it's far, never faster than it can stop, small steps at the end.
    const left = p.plan ? p.plan.t - g.time - 0.12 : 0.9
    let v = Math.min(p.lvl.speed * (p.plan ? 1 : 0.8), Math.sqrt(2 * brake * 0.8 * Math.max(0, d - 0.06)))
    if (left > 0.05) v = Math.min(v, Math.max((d / left) * 1.6, d > 0.3 ? 1.4 : 0))
    if (d > 0.08) {
      wx = (dx / d) * v
      wz = (dz / d) * v
    }
  }
  // Mid-swing the feet are planted: only the last small step.
  if (p.swing) {
    const m = Math.hypot(wx, wz)
    if (m > 1.8) {
      wx *= 1.8 / m
      wz *= 1.8 / m
    }
  }
  // The push off (the first step's burst) and the brakes, as feet do: no jump in speed.
  const dvx = wx - p.vx
  const dvz = wz - p.vz
  const dv = Math.hypot(dvx, dvz)
  const slowing = wx * p.vx + wz * p.vz < p.vx * p.vx + p.vz * p.vz - 0.01
  const amax = (slowing ? brake : p.lvl.acc * (p.human ? 1.15 : 1)) * dt
  if (dv > amax) {
    p.vx += (dvx / dv) * amax
    p.vz += (dvz / dv) * amax
  } else {
    p.vx = wx
    p.vz = wz
  }
  p.x = clamp(p.x + p.vx * dt, -DW - 3, DW + 3)
  p.z += p.vz * dt
  // Never over the net.
  if (p.z * e < 0.6) {
    p.z = e * 0.6
    p.vz = 0
  }
  if (Math.abs(p.z) > HL + 6) p.z = Math.sign(p.z) * (HL + 6)
  // Facing: the net, turned a little to the ball; a sprint turns to where it runs (never the back to the net: running
  // back it turns side on), and turns back to the net for the stroke.
  const sp = Math.hypot(p.vx, p.vz)
  const base = e > 0 ? Math.PI : 0
  const soon = p.plan ? p.plan.t - g.time : 9
  p.sprint = !p.swing && soon > 0.42 && (p.sprint ? sp > 2.4 : sp > 3.6)
  let want: number
  if (p.sprint) {
    const run = Math.atan2(p.vx, p.vz)
    want = base + clamp(Math.atan2(Math.sin(run - base), Math.cos(run - base)), -1.75, 1.75)
  } else {
    const ball = Math.atan2(g.ball.x - p.x, g.ball.z - p.z)
    want = base + clamp(Math.atan2(Math.sin(ball - base), Math.cos(ball - base)), -0.7, 0.7)
  }
  // Turned at a body's pace, not snapped.
  const turn = Math.atan2(Math.sin(want - p.face), Math.cos(want - p.face))
  p.face += clamp(turn, -11 * dt, 11 * dt)
  if (!p.swing) {
    if (g.time - p.split < 0.42 && sp < 2.6) {
      if (p.pose !== 'splitstep') p.take++
      p.pose = 'splitstep'
    } else if (p.sprint) p.pose = sp > 2.6 ? 'run' : 'walk'
    else if (sp > 0.45) {
      // Side on to the way it goes: the shuffle; forward or back: small running steps.
      const side = Math.abs(Math.cos(p.face) * p.vx - Math.sin(p.face) * p.vz)
      p.pose = side > sp * 0.6 ? 'shuffle' : sp > 3 ? 'run' : 'walk'
    } else p.pose = 'ready'
  }
}

/** The score as the board shows it: sets done, games, points (as words in a game, numbers in a tie-break). */
export function boardOf(g: Tennis) {
  const s = g.score
  const w = ['0', '15', '30', '40']
  const pts: [string, string] = s.tb ? [String(s.pts[0]), String(s.pts[1])] : s.pts[0] >= 3 && s.pts[1] >= 3 ? (s.pts[0] === s.pts[1] ? ['40', '40'] : s.pts[0] > s.pts[1] ? ['AV', ''] : ['', 'AV']) : [w[Math.min(3, s.pts[0])], w[Math.min(3, s.pts[1])]]
  return { done: s.done, games: s.games, pts, tb: s.tb, server: g.server, sets: s.sets }
}

/** Whether the phone's player has the serve now and must toss. */
export const mustServe = (g: Tennis) => g.phase === 'serve' && g.server === g.me && g.ps[g.me].human
