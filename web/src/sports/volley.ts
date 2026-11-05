import type { Pose } from '../avatar/Human'
import { t as tr } from '../lib/i18n'
import { DT, aim, clamp, fly, gauss, seeded, type Air, type Ball } from './phys'

// Volleyball, at the real sizes: indoors six against six on 18 × 9 m with the attack line 3 m from the
// net, the net 2,43 m for the men and 2,24 m for the women, the antennas on the side lines; on the
// beach two against two on 16 × 8 m of sand (no attack line), the same nets. The real rules: rally
// scoring (every rally is a point), a set to 25 (21 on the beach) by two, the deciding one to 15;
// three touches at most for a side (the block's touch not counted), never the same player twice in a
// row (except after the block); in on the line; out, outside the antennas, into the net, four touches:
// the point to the other side. The serve from behind the end line, the side that wins the rally
// serves; indoors the side winning back the serve rotates (the six places turn clockwise), the setter
// running to the right of the net from wherever it stands; on the beach the two take turns. The game:
// the reception (the bump) to the setter, the set to a hitter, the spike off a jump timed to the ball,
// the block at the net (stuffed back, touched, or off the hands and out), the dig; the tip over the
// block, the free ball. The ball: 0,27 kg, 21 cm, its drag and the spike's topspin (phys.ts), the
// float serve wobbling, a dead bounce on the sand. The court's x runs across (+x the near side's
// right), z along it (the net at 0), y up.

export const BALL_R = 0.105
export const AIR: Air = { k: 0.03, magnus: 0.0009 }

export type VKind = 'serve' | 'bump' | 'dig' | 'set' | 'spike' | 'tip' | 'free' | 'block'
export type Role = 'S' | 'OH' | 'MB' | 'OP' | 'B'
export type VolleyRules = { beach?: boolean; /** Points to take a set (a short match on phones: 15). */ points?: number; /** Sets in the match (1, or 3: best of, the third to 15). */ sets?: number; women?: boolean; level?: number; assist?: boolean }
/** The hands: the stick, and three buttons held (a: pass / bump / block / float serve; b: spike / jump serve; c: tip). */
export type VInput = { mx: number; mz: number; a: boolean; b: boolean; c: boolean }
export const NO_VINPUT: VInput = { mx: 0, mz: 0, a: false, b: false, c: false }

type Level = { speed: number; react: number; skill: number; power: number }
export const VLEVELS: Level[] = [
  { speed: 4.0, react: 0.32, skill: 0.45, power: 0.6 },
  { speed: 4.5, react: 0.25, skill: 0.62, power: 0.75 },
  { speed: 5.0, react: 0.19, skill: 0.78, power: 0.88 },
  { speed: 5.4, react: 0.14, skill: 0.9, power: 1 },
]

export type VPlayer = {
  id: number
  team: 0 | 1
  role: Role
  name: string
  human: boolean
  x: number
  z: number
  vx: number
  vz: number
  /** Off the ground (a jump). */
  y: number
  vy: number
  face: number
  pose: Pose
  at: number
  take: number
  lvl: Level
  /** The touch it will make: when, where (the ball there), what. */
  plan: { t: number; x: number; y: number; z: number; kind: VKind } | null
  /** A block's jump planned (when to leave the floor). */
  blockAt: number | null
  /** A button pressed for its touch (the human's): when, which. */
  press: { t: number; key: 'a' | 'b' | 'c' } | null
  /** Where to stand now. */
  spot: [number, number]
  /** Its last pose's start (match time), for the clock. */
  t0: number
  /** A human's stick across now (its spike's aim). */
  mx: number
}

export type VMoment = { kind: 'ace' | 'kill' | 'block' | 'stuff' | 'dig' | 'set' | 'spike' | 'serve' | 'out' | 'net' | 'fault' | 'point' | 'setwon' | 'match' | 'rotate' | 'switch' | 'tip' | 'bump' | 'free' | 'floor' | 'touch' | 'rally'; by: number; team: 0 | 1; t: number; text?: string; v?: number }

export type Volley = {
  rules: Required<VolleyRules>
  r: () => number
  time: number
  phase: 'count' | 'serve' | 'toss' | 'rally' | 'dead' | 'switch' | 'over'
  since: number
  ps: VPlayer[]
  me: number
  /** Each team's places in the rotation: [pos 1 … pos 6] player ids (indoors); the beach's two, the next server first. */
  rot: [number[], number[]]
  end: [number, number]
  serving: 0 | 1
  ball: Ball & { last: number; team: 0 | 1 | -1; touches: number; serve: boolean; afterBlock: boolean; speed: number; wobble: number; float: boolean; held: boolean }
  score: { pts: [number, number]; sets: [number, number]; done: [number, number][] }
  hw: number
  hl: number
  netY: number
  /** How high a spiker's hand gets (standing reach + the jump), the blockers' hands. */
  reach: { stand: number; spike: number; block: number }
  moments: VMoment[]
  call: { text: string; t: number } | null
  mark: { x: number; z: number; t: number; out: boolean } | null
  won: 0 | 1 | null
  winner: 0 | 1 | null
  stats: { aces: [number, number]; kills: [number, number]; blocks: [number, number]; errors: [number, number]; digs: [number, number]; rallies: number; longest: number; mine: { kills: number; blocks: number; aces: number; digs: number; sets: number } }
  /** The ball foreseen from the last touch (the plans read it). */
  path: Float32Array
  pathN: number
  pathT: number
  /** The attack coming (for the blocks and the human's hint). */
  attack: { by: number; t: number; x: number } | null
  judge: { text: string; t: number } | null
  /** The touches in the rally so far (for the stats and the commentary). */
  chain: VKind[]
  /** Who made each of them. */
  chainBy: number[]
  /** The deciding set's change of ends at 8 done (indoors). */
  switched: boolean
}

const PATH_MAX = 600

export { seeded }

const other = (t: number): 0 | 1 => (t === 0 ? 1 : 0)
const say = (g: Volley, text: string) => void (g.call = { text, t: g.time })
const moment = (g: Volley, kind: VMoment['kind'], by: number, text?: string, v?: number) => g.moments.push({ kind, by, team: by >= 0 ? g.ps[by].team : 0, t: g.time, text, v })

/** A new match: the player (id 0, an outside hitter indoors) with its side against the AI's. */
export function createVolley(name: string, names: string[], r: () => number, rules: VolleyRules = {}): Volley {
  const beach = !!rules.beach
  const rr: Required<VolleyRules> = { beach, points: rules.points ?? 15, sets: rules.sets ?? 1, women: !!rules.women, level: clamp(rules.level ?? 1, 0, 3), assist: rules.assist ?? true }
  const n = beach ? 2 : 6
  const roles: Role[] = beach ? ['B', 'B'] : ['OH', 'MB', 'OP', 'OH', 'MB', 'S']
  const ps: VPlayer[] = []
  for (let team = 0; team < 2; team++)
    for (let k = 0; k < n; k++) {
      const id = team * n + k
      const lvl = team === 0 ? VLEVELS[Math.max(1, rr.level)] : VLEVELS[rr.level]
      ps.push({ id, team: team as 0 | 1, role: roles[k], name: id === 0 ? name : (names[id % names.length] ?? `J${id}`), human: id === 0, x: 0, z: 0, vx: 0, vz: 0, y: 0, vy: 0, face: 0, pose: 'idle', at: 0, take: 0, lvl, plan: null, blockAt: null, press: null, spot: [0, 0], t0: 0, mx: 0 })
    }
  // The rotation: pos 1 (back right, serving) … pos 6 (back centre). The player starts front left-ish (pos 2 → the outside hitter).
  // Indoors, by id within the team: 0 OH, 1 MB, 2 OP, 3 OH, 4 MB, 5 S. Pos 1 S, 2 OH, 3 MB, 4 OP, 5 OH, 6 MB (the 5-1).
  const rot = (t: number): number[] => (beach ? [t * n, t * n + 1] : [5, 0, 1, 2, 3, 4].map((k) => t * n + k))
  const men = !rr.women
  const g: Volley = {
    rules: rr,
    r,
    time: -3,
    phase: 'count',
    since: -3,
    ps,
    me: 0,
    rot: [rot(0), rot(1)],
    end: [1, -1],
    serving: r() < 0.5 ? 0 : 1,
    ball: { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, last: -1, team: -1, touches: 0, serve: false, afterBlock: false, speed: 0, wobble: 0, float: false, held: true },
    score: { pts: [0, 0], sets: [0, 0], done: [] },
    hw: beach ? 4 : 4.5,
    hl: beach ? 8 : 9,
    netY: men ? 2.43 : 2.24,
    reach: men ? { stand: 2.35, spike: 3.15, block: 3.0 } : { stand: 2.2, spike: 2.85, block: 2.72 },
    moments: [],
    call: null,
    mark: null,
    won: null,
    winner: null,
    stats: { aces: [0, 0], kills: [0, 0], blocks: [0, 0], errors: [0, 0], digs: [0, 0], rallies: 0, longest: 0, mine: { kills: 0, blocks: 0, aces: 0, digs: 0, sets: 0 } },
    path: new Float32Array(PATH_MAX * 4),
    pathN: 0,
    pathT: 0,
    attack: null,
    judge: null,
    chain: [],
    chainBy: [],
    switched: false,
  }
  setupRally(g)
  return g
}

/** The points a set is played to: the last (deciding) one of three to 15. */
export const setTo = (g: Volley) => (g.rules.sets > 1 && g.score.sets[0] + g.score.sets[1] === g.rules.sets - 1 ? 15 : g.rules.points)

/* ---------- Places ---------- */

/** A spot in a team's own frame (lx: to its right, d: metres back from the net) to the court's. */
function at(g: Volley, team: number, lx: number, d: number): [number, number] {
  const e = g.end[team]
  return [e * lx, e * d]
}

/** The rotation's place of a player (1…6), indoors. */
const posOf = (g: Volley, p: VPlayer) => g.rot[p.team].indexOf(p.id) + 1
const front = (g: Volley, p: VPlayer) => g.rules.beach || [2, 3, 4].includes(posOf(g, p))
/** Base places by rotation: pos 1 back right … pos 6 back centre. */
const BASE: Record<number, [number, number]> = { 1: [3, 6.5], 2: [3, 1.8], 3: [0, 1.8], 4: [-3, 1.8], 5: [-3, 6.5], 6: [0, 7] }
/** The functional side by role: the setter and the opposite on the right, the outside hitter left, the middle in the middle. */
const SIDE: Record<Role, number> = { S: 2.6, OP: 3.2, OH: -3.2, MB: 0, B: 0 }

/** Where each player of a team stands, by what the rally needs now. */
function spots(g: Volley, team: 0 | 1, mode: 'serve' | 'receive' | 'attack' | 'defend') {
  const ps = g.ps.filter((p) => p.team === team)
  if (g.rules.beach) {
    const [a, b] = g.rot[team].map((id) => g.ps[id])
    if (mode === 'serve') {
      a.spot = at(g, team, 1.2, g.hl + 1)
      b.spot = at(g, team, -1, 2.5)
    } else if (mode === 'receive') {
      a.spot = at(g, team, 1.8, 5)
      b.spot = at(g, team, -1.8, 5)
    } else if (mode === 'defend') {
      // One blocks (the one nearer the net), the other covers deep.
      const [bl, df] = Math.abs(a.z) < Math.abs(b.z) ? [a, b] : [b, a]
      const ax = g.attack ? g.ps[g.attack.by].x : 0
      bl.spot = [ax * 0.8, g.end[team] * 0.5]
      // (The defender in the middle of what the block leaves open, a little deep: from there a dive reaches most of it.)
      df.spot = at(g, team, -ax * g.end[team] * 0.2, 4.4)
    }
    return
  }
  for (const p of ps) {
    const pos = posOf(g, p)
    const isFront = [2, 3, 4].includes(pos)
    const base = BASE[pos]
    if (mode === 'serve') p.spot = pos === 1 ? at(g, team, 2.5, g.hl + 1) : at(g, team, base[0], isFront ? 1.6 : 5.8)
    else if (mode === 'receive') {
      // Three passers back (the outside hitters and the back-row middle: the libero's job), the setter hidden at the net right, the front middle at the net.
      if (p.role === 'S') p.spot = at(g, team, 1.5, isFront ? 1 : 3)
      else if (p.role === 'MB' && isFront) p.spot = at(g, team, -0.5, 1.5)
      else if (p.role === 'OP') p.spot = at(g, team, 3.4, isFront ? 2.5 : 6.5)
      else p.spot = at(g, team, base[0] * 0.95, 6)
    } else if (mode === 'attack') {
      if (p.role === 'S') p.spot = at(g, team, 1.2, 0.9)
      else if (isFront) p.spot = at(g, team, SIDE[p.role], p.role === 'MB' ? 2.6 : 3.6)
      else p.spot = at(g, team, SIDE[p.role] * 0.7, p.role === 'MB' ? 7 : 5.8)
    } else {
      if (isFront) p.spot = at(g, team, p.role === 'S' ? 2.6 : SIDE[p.role] * 0.85, 0.55)
      else p.spot = at(g, team, p.role === 'MB' ? 0 : p.role === 'OH' ? -3 : 3, p.role === 'MB' ? 7.3 : 6.3)
    }
  }
}

/** A new rally: the server behind its end line with the ball, the others in their places. */
function setupRally(g: Volley) {
  spots(g, g.serving, 'serve')
  spots(g, other(g.serving), 'receive')
  for (const p of g.ps) {
    ;[p.x, p.z] = p.spot
    p.vx = p.vz = p.y = p.vy = 0
    p.plan = null
    p.blockAt = null
    p.press = null
    p.face = g.end[p.team] > 0 ? Math.PI : 0
    p.pose = 'ready'
  }
  const s = server(g)
  s.pose = 'bounce'
  Object.assign(g.ball, { last: -1, team: -1, touches: 0, serve: true, afterBlock: false, held: true, spin: 0, vx: 0, vy: 0, vz: 0, wobble: 0, float: false })
  hold(g)
  g.attack = null
  g.won = null
  g.pathN = 0
  g.chain = []
  g.chainBy = []
}

/** A touch into the rally's chain. */
function link(g: Volley, kind: VKind, by: number) {
  g.chain.push(kind)
  g.chainBy.push(by)
}

/** The attack that won the rally, if one did: the last spike or tip of the winners, with only the other side's block or a dig gone wrong after it. */
function killer(g: Volley, to: 0 | 1): number | null {
  for (let i = g.chain.length - 1; i >= 0; i--) {
    const k = g.chain[i]
    const team = g.ps[g.chainBy[i]].team
    if ((k === 'spike' || k === 'tip') && team === to) return g.chainBy[i]
    if (team === to || (k !== 'block' && k !== 'dig')) return null
  }
  return null
}

const server = (g: Volley) => g.ps[g.rot[g.serving][0]]

function hold(g: Volley) {
  const s = server(g)
  const e = g.end[s.team]
  Object.assign(g.ball, { x: s.x + e * 0.15, y: 1.1, z: s.z - e * 0.35 })
}

/* ---------- The step ---------- */

export function stepVolley(g: Volley, dt: number, input: VInput, others?: Map<number, VInput>) {
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

/** The human's buttons, edge to edge: pressed now (it was up). */
const was = new WeakMap<VPlayer, VInput>()
function pressed(p: VPlayer, h: VInput | null) {
  const before = was.get(p) ?? NO_VINPUT
  if (h) was.set(p, { ...h })
  if (!h) return null
  return h.a && !before.a ? 'a' : h.b && !before.b ? 'b' : h.c && !before.c ? 'c' : null
}

function tick(g: Volley, dt: number, input: VInput, others?: Map<number, VInput>) {
  g.time += dt
  const hands = (p: VPlayer) => (p.id === g.me ? input : p.human ? (others?.get(p.id) ?? null) : null)
  // The humans' presses, for their touch (kept until it's played).
  for (const p of g.ps)
    if (p.human) {
      p.mx = hands(p)?.mx ?? 0
      const k = pressed(p, hands(p))
      if (k) p.press = { t: g.time, key: k }
    }
  switch (g.phase) {
    case 'count':
      if (g.time >= 0) phase(g, 'serve')
      break
    case 'serve':
      serveWait(g)
      break
    case 'toss':
      toss(g, hands(server(g)))
      break
    case 'rally':
      if (g.time - g.pathT > 7) rallyEnd(g, other(g.ball.team === -1 ? g.serving : g.ball.team), 'floor')
      break
    case 'dead':
      if (g.time - g.since > 2.4) next(g)
      break
    case 'switch':
      if (g.time - g.since > 2.6) {
        phase(g, 'serve')
        setupRally(g)
      }
      break
  }
  if (g.phase === 'rally' || g.phase === 'dead') ballStep(g, dt)
  for (const p of g.ps) move(g, p, dt, hands(p))
}

function phase(g: Volley, ph: Volley['phase']) {
  g.phase = ph
  g.since = g.time
}

/* ---------- The serve ---------- */

function serveWait(g: Volley) {
  const s = server(g)
  hold(g)
  s.pose = 'bounce'
  const wait = g.time - g.since
  if (s.human) {
    const k = s.press
    // (The eight seconds: past them, the toss goes up for the player.)
    if ((k && k.t > g.since + 0.3 && (k.key === 'a' || k.key === 'b')) || wait > 8) startToss(g, k?.key === 'b')
    else s.press = null
  } else if (wait > 1.6 + g.r() * 1.2) startToss(g, g.r() < 0.2 + s.lvl.power * 0.3)
}

let jumpServe = false
function startToss(g: Volley, jump: boolean) {
  const s = server(g)
  const e = g.end[s.team]
  jumpServe = jump
  phase(g, 'toss')
  s.press = null
  s.pose = jump ? 'spike' : 'serve'
  s.take++
  // (The pose's clock: the float's contact comes 0,37 s up, at the serve pose's 0,6 s.)
  s.t0 = g.time - (jump ? -0.25 : 0.23)
  // The float: a little toss in front; the jump serve: high and forward, the run after it.
  Object.assign(g.ball, { held: false, x: s.x + e * 0.2, y: 1.6, z: s.z - e * (jump ? 0.9 : 0.35), vx: 0, vy: jump ? 6.2 : 3.6, vz: jump ? -e * 1.2 : 0, spin: 0 })
  moment(g, 'serve', s.id, jump ? 'jump' : 'float')
}

function toss(g: Volley, h: VInput | null) {
  const s = server(g)
  const b = g.ball
  const t = g.time - g.since
  b.vy -= 9.81 * DT
  b.x += b.vx * DT
  b.y += b.vy * DT
  b.z += b.vz * DT
  // The jump serve's run and leap under the ball.
  if (jumpServe) {
    const e = g.end[s.team]
    s.z = Math.max(s.z - e * 2.4 * DT, e * (g.hl + 0.1))
    if (t > 0.55 && s.y === 0) s.vy = 3.4
  }
  const top = jumpServe ? 0.63 : 0.37
  let go = false
  if (s.human) {
    // A second press (or the button let go) strikes it.
    go = (!!s.press && s.press.t > g.since + 0.1) || (!!h && !h.a && !h.b && t > 0.15)
  } else go = t > top + gauss(g.r) * (0.03 + (1 - s.lvl.skill) * 0.08)
  if (go && b.y > 1.8) return serveHit(g, s, clamp(1 - Math.abs(t - top) / 0.25, 0, 1), h?.mx ?? 0)
  if (b.y < 1.2 && b.vy < 0) {
    // Let fall: tossed again (a real referee would call it; the game is kind).
    phase(g, 'serve')
    s.press = null
  }
}

function serveHit(g: Volley, s: VPlayer, q: number, mx: number) {
  const e = g.end[s.team]
  const b = g.ball
  s.press = null
  const lvl = s.lvl
  const qq = s.human ? q : clamp(lvl.skill * 0.85 + gauss(g.r) * 0.15, 0, 1)
  const jump = jumpServe
  const v = (jump ? 16 + 9 * lvl.power : 12.5 + 4 * lvl.power) * (g.rules.women ? 0.9 : 1) * (0.85 + 0.15 * qq)
  // The target: deep in a zone across (the human's stick picks the side), a float to the seams.
  // (In the server's own frame: + its right, which is e·x on the court.)
  const side = s.human ? clamp(mx, -1, 1) : g.r() * 2 - 1
  const tx = e * side * (g.hw - 0.75)
  const tz = -e * (g.hl - 0.7 - g.r() * 2.4)
  const sig = 0.35 + (1 - qq) * 1.5 + (jump ? 0.6 : 0)
  const target: [number, number, number] = [tx + gauss(g.r) * sig, BALL_R, tz + -e * gauss(g.r) * sig]
  const from: [number, number, number] = [b.x, b.y, b.z]
  const spin = jump ? 90 : 0
  const T = Math.hypot(target[0] - from[0], target[2] - from[2]) / (v * 0.82)
  const vel = clearAim(g, from, target, T * (jump ? 1 : 1.12), spin, 0.1 + qq * 0.35, qq)
  Object.assign(b, { vx: vel[0], vy: vel[1], vz: vel[2], spin, last: s.id, team: s.team, touches: 0, serve: true, afterBlock: false, held: false, speed: Math.hypot(...vel), float: !jump, wobble: g.r() * 6 })
  s.pose = jump ? 'spike' : 'serve'
  s.t0 = g.time - (jump ? 0.38 : 0.6)
  if (s.human) g.judge = { text: q > 0.8 ? 'Parfait' : q > 0.45 ? 'Bien' : 'Raté', t: g.time }
  phase(g, 'rally')
  link(g, 'serve', s.id)
  foresee(g)
}

/* ---------- The ball ---------- */

function ballStep(g: Volley, dt: number) {
  const b = g.ball
  if (b.held) return
  const z0 = b.z
  // The float serve wobbles: a small push to the side that turns.
  if (b.float && b.speed > 8) {
    const w = Math.sin(g.time * 5 + b.wobble) * 1.3
    b.vx += w * dt
  }
  fly(b, AIR, dt)
  // The net: over it, or into it (it falls back), or outside the antennas.
  if (Math.sign(z0) !== Math.sign(b.z) && z0 !== 0) {
    const inside = Math.abs(b.x) <= g.hw + BALL_R * 0.5
    if (b.y < g.netY + BALL_R && b.y > 0 && Math.abs(b.x) < g.hw + 0.4) {
      if (b.y < g.netY - BALL_R) {
        // Into the mesh: it drops back on the side it came from.
        b.z = z0 > 0 ? 0.12 : -0.12
        b.vz *= -0.15
        b.vx *= 0.4
        b.vy = Math.min(0, b.vy) * 0.3
        if (g.phase === 'rally') moment(g, 'net', b.last)
      } else {
        // Over off the tape.
        b.vz *= 0.6
        b.vy = Math.abs(b.vy) * 0.3 + 0.6
      }
      if (g.phase === 'rally') foresee(g)
    } else if (g.phase === 'rally' && b.y > 0) {
      if (!inside) {
        say(g, tr('Faute ! Hors antenne'))
        moment(g, 'out', b.last)
        return rallyEnd(g, other(b.team as 0 | 1), 'out')
      }
      // Into the other side: their three touches start.
      b.touches = 0
      b.serve = b.serve && b.last === server(g).id
      b.afterBlock = false
      // The blocks: hands up at the net where it crosses.
      blockCheck(g, z0)
    }
  }
  if (b.y < BALL_R && b.vy < 0) {
    b.y = BALL_R
    const sand = g.rules.beach
    b.vy = -b.vy * (sand ? 0.12 : 0.55)
    b.vx *= sand ? 0.15 : 0.7
    b.vz *= sand ? 0.15 : 0.7
    if (g.phase === 'rally') land(g)
  }
  if (g.phase === 'rally') for (const p of g.ps) if (p.plan && g.time >= p.plan.t - 1e-6) touch(g, p)
}

/** The ball on the floor: in on a side, that side loses; out, the last to touch it loses. */
function land(g: Volley) {
  const b = g.ball
  const ok = Math.abs(b.x) <= g.hw + BALL_R && Math.abs(b.z) <= g.hl + BALL_R
  g.mark = { x: b.x, z: b.z, t: g.time, out: !ok }
  if (!ok) {
    say(g, tr('Out !'))
    moment(g, 'out', b.last)
    return rallyEnd(g, other(b.team === -1 ? g.serving : b.team), 'out')
  }
  const side: 0 | 1 = Math.sign(b.z) === g.end[0] ? 0 : 1
  moment(g, 'floor', b.last)
  const stuffed = g.chain[g.chain.length - 1] === 'block' && b.team !== side
  rallyEnd(g, other(side), b.serve && b.touches === 0 ? 'ace' : stuffed ? 'stuff' : b.team !== side ? 'kill' : 'floor')
}

function rallyEnd(g: Volley, to: 0 | 1, how: 'ace' | 'kill' | 'floor' | 'out' | 'stuff' | 'fault') {
  if (g.phase !== 'rally') return
  phase(g, 'dead')
  g.won = to
  for (const p of g.ps) {
    p.plan = null
    p.blockAt = null
  }
  const last = g.ball.last >= 0 ? g.ps[g.ball.last] : null
  // (An ace too: the serve's reception shanked or let fall.)
  const aced = how === 'ace' || (g.chain[0] === 'serve' && g.chain.length <= 2 && g.ps[g.chainBy[0]].team === to && how !== 'stuff')
  if (aced && last) {
    const sv = g.ps[g.chainBy[0]]
    g.stats.aces[to]++
    if (sv.id === g.me) g.stats.mine.aces++
    say(g, tr('Ace !'))
    moment(g, 'ace', sv.id)
  } else if (how !== 'stuff' && killer(g, to) !== null) {
    const k = killer(g, to)!
    g.stats.kills[to]++
    if (k === g.me) g.stats.mine.kills++
    moment(g, 'kill', k, g.chain[g.chainBy.lastIndexOf(k)])
  } else if (how === 'stuff' && last) {
    g.stats.blocks[to]++
    if (last.id === g.me) g.stats.mine.blocks++
  } else g.stats.errors[other(to)]++
  g.stats.rallies++
  const n = g.chain.length
  g.stats.longest = Math.max(g.stats.longest, n)
  if (n >= 9) moment(g, 'rally', last?.id ?? 0, undefined, n)
  moment(g, 'point', last?.id ?? 0, undefined, to)
}

/** After a dead ball: the point scored, the set, the serve and the rotation, the ends. */
function next(g: Volley) {
  const to = g.won!
  const s = g.score
  s.pts[to]++
  const target = setTo(g)
  const [a, b] = [s.pts[to], s.pts[other(to)]]
  const sideOut = g.serving !== to
  if (a >= target && a - b >= 2) {
    s.sets[to]++
    s.done.push([s.pts[0], s.pts[1]])
    s.pts = [0, 0]
    if (s.sets[to] > g.rules.sets / 2) {
      g.winner = to
      say(g, to === g.ps[g.me].team ? tr('Match gagné !') : tr('Match perdu…'))
      moment(g, 'match', g.rot[to][0])
      phase(g, 'over')
      return
    }
    say(g, to === g.ps[g.me].team ? tr('Set gagné !') : tr('Set perdu…'))
    g.switched = false
    moment(g, 'setwon', g.rot[to][0])
    // The ends change; the other side serves first in the next set.
    g.serving = other(g.serving)
    swapEnds(g)
    return
  }
  say(g, `${s.pts[0]} - ${s.pts[1]}`)
  if (sideOut) {
    g.serving = to
    // The side winning back the serve turns: indoors one place clockwise; on the beach the other one serves.
    const r = g.rot[to]
    g.rot[to] = [...r.slice(1), r[0]]
    if (!g.rules.beach) moment(g, 'rotate', g.rot[to][0])
  }
  // The ends: every 7 points on the beach (5 in a set to 15), at 8 in a deciding set indoors.
  const n = s.pts[0] + s.pts[1]
  const every = g.rules.beach ? (target <= 15 ? 5 : 7) : 0
  const deciding = !g.rules.beach && target === 15 && !g.switched && Math.max(...s.pts) === 8
  if ((every && n % every === 0) || deciding) {
    if (deciding) g.switched = true
    return swapEnds(g)
  }
  phase(g, 'serve')
  setupRally(g)
}

function swapEnds(g: Volley) {
  g.end = [-g.end[0], -g.end[1]]
  phase(g, 'switch')
  moment(g, 'switch', g.me)
  setupRally(g)
  g.phase = 'switch'
}

/* ---------- The plans: who plays the ball next, where ---------- */

function foresee(g: Volley) {
  const b: Ball = { ...g.ball }
  let n = 0
  g.pathT = g.time
  for (let i = 0; i < PATH_MAX; i++) {
    const z0 = b.z
    fly(b, AIR)
    // (Into the net: the foresight stops there; the touch after it is foreseen as it drops.)
    if (Math.sign(b.z) !== Math.sign(z0) && b.y < g.netY - BALL_R && Math.abs(b.x) < g.hw + 0.4) break
    g.path.set([b.x, b.y, b.z, 0], n * 4)
    n++
    if (b.y < BALL_R) break
  }
  g.pathN = n
  for (const p of g.ps) p.plan = null
  planNext(g)
}

/** The ball's side once it comes down to playing height: whose touch it is. */
function sideAt(g: Volley, i: number): 0 | 1 {
  return Math.sign(g.path[i * 4 + 2]) === g.end[0] ? 0 : 1
}

function planNext(g: Volley) {
  const b = g.ball
  // Whose touch: the side where it would come down.
  const i0 = g.pathN - 1
  if (i0 < 1) return
  const team = sideAt(g, i0)
  const same = team === b.team
  const touches = same ? b.touches : 0
  if (touches >= 3) return
  const kind: VKind = touches === 0 ? (b.speed > 15 && !b.serve ? 'dig' : 'bump') : touches === 1 ? 'set' : 'spike'
  // Going out: the side lets it fall (the AI reads it, now and then wrongly).
  if (touches === 0 && willOut(g)) {
    const close = closeOut(g)
    if (!(close && g.r() < 0.25)) return
  }
  const cands = g.ps.filter((p) => p.team === team && (p.id !== b.last || b.afterBlock || b.team !== team))
  let best: { p: VPlayer; i: number; s: number } | null = null
  const setter = cands.find((p) => p.role === 'S')
  for (const p of cands) {
    // (A set or a spike out of reach: whatever can still be played, a bump, a free ball.)
    const r = contact(g, p, kind) ?? (kind === 'spike' ? contact(g, p, 'free') : kind === 'set' ? contact(g, p, 'bump') : null)
    if (!r) continue
    let s = r.s
    // Indoors the setter keeps out of the first touch; the second is the setter's, the third a hitter's (the setter's pick, below).
    if (kind === 'bump' || kind === 'dig') s += p.role === 'S' ? 1.2 : 0
    if (kind === 'set') s += p.role === 'S' || (g.rules.beach && p.id !== b.last) ? -3 : setter && setter.id !== b.last ? 2 : 0
    if (!best || s < best.s) best = { p, i: r.i, s }
  }
  if (!best) return
  const p = best.p
  const i = best.i
  let k: VKind = kind
  // The third touch: a spike only for a hitter well placed (front row, or back row behind the 3 m line), else a free ball.
  const [x, y, z] = [g.path[i * 4], g.path[i * 4 + 1], g.path[i * 4 + 2]]
  if (k === 'spike' && (!(front(g, p) || Math.abs(z) > 3.2) || Math.abs(z) > 5 || y < g.netY + 0.15)) k = 'free'
  if (k === 'set' && y < 1.6) k = 'bump'
  p.plan = { t: g.pathT + (i + 1) * DT, x, y, z, kind: k }
  if (k === 'spike') {
    g.attack = { by: p.id, t: p.plan.t, x }
    spots(g, other(team), 'defend')
    planBlock(g, other(team))
  } else if (touches === 0) {
    g.attack = null
    spots(g, team, 'attack')
    spots(g, other(team), 'defend')
  }
}

/** The best sample for this player and touch: reachable in time, at the touch's height. Score: lower is better. */
function contact(g: Volley, p: VPlayer, kind: VKind): { i: number; s: number } | null {
  const e = g.end[p.team]
  const hY = kind === 'set' ? 2.25 : kind === 'spike' ? g.reach.spike - 0.05 : kind === 'free' ? 1.6 : 0.8
  const react = p.human ? 0.05 : p.lvl.react
  let best: { i: number; s: number } | null = null
  for (let i = 0; i < g.pathN; i++) {
    const [x, y, z] = [g.path[i * 4], g.path[i * 4 + 1], g.path[i * 4 + 2]]
    const t = g.pathT + (i + 1) * DT - g.time
    if (t < 0.1 || z * e < 0.25) continue
    const down = i > 0 && y < g.path[(i - 1) * 4 + 1]
    if (!down) continue
    if (Math.abs(y - hY) > (kind === 'spike' ? 0.25 : kind === 'set' ? 0.45 : kind === 'free' ? 0.9 : 0.55)) continue
    // Beyond the lines by more than 3 m: no one runs there.
    if (Math.abs(x) > g.hw + 3 || Math.abs(z) > g.hl + 3.5) continue
    const need = Math.hypot(x - p.x, z + e * (kind === 'spike' ? 0.35 : 0.3) - p.z)
    // (A hard-driven ball gives a dig no time: the first step comes late, only the lunge reaches.)
    const can = kind === 'dig' ? p.lvl.speed * 0.6 * Math.max(0, t - react - 0.12) + 0.4 + p.lvl.skill * 0.3 + (g.rules.beach ? 0.9 : 0) : p.lvl.speed * Math.max(0, t - react) + 0.55
    if (need > can) continue
    const s = Math.abs(y - hY) * 2 + t * 0.2 + need * 0.05
    if (!best || s < best.s) best = { i, s }
  }
  return best
}

function willOut(g: Volley) {
  const i = g.pathN - 1
  if (i < 0) return false
  const [x, z] = [g.path[i * 4], g.path[i * 4 + 2]]
  return g.path[i * 4 + 1] < 0.3 && (Math.abs(x) > g.hw + BALL_R || Math.abs(z) > g.hl + BALL_R)
}
function closeOut(g: Volley) {
  const i = g.pathN - 1
  const [x, z] = [g.path[i * 4], g.path[i * 4 + 2]]
  return Math.abs(x) < g.hw + 0.5 && Math.abs(z) < g.hl + 0.5
}

/** The defending side's block: the front row near the attack goes to the net there and jumps with the hitter. */
function planBlock(g: Volley, team: 0 | 1) {
  const a = g.attack!
  const e = g.end[team]
  const front0 = g.ps.filter((p) => p.team === team && front(g, p))
  // (On the beach the one nearer the net blocks, as spots() has it: the other stays back to dig.)
  const sorted = front0.sort((p, q) => (g.rules.beach ? Math.abs(p.z) - Math.abs(q.z) : Math.abs(p.x - a.x) - Math.abs(q.x - a.x)))
  const n = g.rules.beach ? 1 : sorted.length > 1 && Math.abs(sorted[1].x - a.x) < 3.2 ? 2 : 1
  sorted.slice(0, n).forEach((p, k) => {
    // (The human jumps itself: its hint says when.)
    const off = n === 2 ? (k === 0 ? -0.45 : 0.45) * Math.sign(a.x || 1) : 0
    p.spot = [clamp(a.x + off, -g.hw + 0.4, g.hw - 0.4), e * 0.45]
    if (!p.human) p.blockAt = a.t - 0.3 + gauss(g.r) * (0.05 + (1 - p.lvl.skill) * 0.12)
  })
}

/** The ball at the net after an attack: the block's hands there? Stuffed, touched, or off them out. */
function blockCheck(g: Volley, z0: number) {
  const b = g.ball
  const last = g.ps[b.last]
  if (!last || g.chain[g.chain.length - 1] !== 'spike') return
  const team = other(last.team)
  for (const p of g.ps) {
    if (p.team !== team || p.y < 0.15 || Math.abs(p.z) > 1.0) continue
    const top = g.reach.stand + p.y + 0.15
    const dx = Math.abs(b.x - p.x)
    if (dx > 0.62 || b.y > top + BALL_R || b.y < g.netY - 0.1) continue
    // (Fingertips: the ball through or past the hands untouched, more often at their edge.)
    if (g.r() < (g.rules.beach ? 0.1 : 0.25) + (dx / 0.62) * (g.rules.beach ? 0.25 : 0.35)) continue
    // Hands there: the closer the ball to the middle of the hands, the surer the stuff.
    const k = 1 - dx / 0.62
    const r = g.r()
    b.last = p.id
    b.team = team
    b.afterBlock = true
    b.touches = 0
    b.serve = false
    if (r < 0.1 + k * 0.22) {
      // Stuffed: straight down on the hitter's side.
      b.z = z0 > 0 ? 0.2 : -0.2
      b.vz = Math.sign(z0) * (2 + g.r() * 2)
      b.vy = -4 - g.r() * 3
      b.vx *= 0.3
      say(g, tr('Contré !'))
      moment(g, 'stuff', p.id)
      link(g, 'block', p.id)
    } else if (r < 0.72) {
      // Touched: it goes on, slowed and up, the defenders get their three touches.
      b.vz *= 0.35
      b.vy = Math.abs(b.vy) * 0.2 + 3.5
      b.vx *= 0.5
      moment(g, 'touch', p.id)
      link(g, 'block', p.id)
    } else {
      // Off the hands, wide: the hitter's point when it lands out (last touched by the block).
      b.vx += (b.x >= p.x ? 1 : -1) * 6
      b.vy = Math.abs(b.vy) * 0.3 + 2
      b.vz *= 0.7
      moment(g, 'block', p.id, 'tool')
      link(g, 'block', p.id)
    }
    foresee(g)
    return
  }
}

/* ---------- The touches ---------- */

function touch(g: Volley, p: VPlayer) {
  const pl = p.plan!
  p.plan = null
  const b = g.ball
  const e = g.end[p.team]
  const dist = Math.hypot(b.x - p.x, b.z + e * 0.3 - p.z)
  // (A dig's dive reaches further, further still on the sand where it's the defence's whole game.)
  const tol = pl.kind === 'dig' ? (g.rules.beach ? 2 : 1.25) : pl.kind === 'spike' ? 0.8 : 0.95
  // The spiker's hand must be up there: in the air at the right moment.
  const handY = pl.kind === 'spike' ? g.reach.stand + p.y + 0.1 : 9
  if (dist > tol || (pl.kind === 'spike' && b.y > handY + 0.35)) {
    if (p.human) g.judge = { text: 'Raté !', t: g.time }
    return
  }
  // The touches' rules: a fourth, or twice the same player.
  if (b.team === p.team && !b.afterBlock) {
    if (b.touches >= 3 || b.last === p.id) {
      say(g, b.touches >= 3 ? tr('Quatre touches !') : tr('Double touche !'))
      moment(g, 'fault', p.id)
      return rallyEnd(g, other(p.team), 'fault')
    }
  }
  if (b.team !== p.team) b.touches = 0
  b.touches++
  b.last = p.id
  b.team = p.team
  b.afterBlock = false
  b.serve = false
  b.float = false
  // The quality: the AI's level; the human's timing (pressed about 0,2 s before for a pass, the jump 0,35 s before a spike).
  let q: number
  let kind = pl.kind
  if (p.human) {
    const k = p.press
    const lead = pressLead(pl.kind)
    if (k && g.time - k.t < 0.9) {
      q = clamp(1 - Math.abs(g.time - k.t - lead) / 0.32, 0, 1)
      if (pl.kind === 'spike' || (b.touches === 3 && pl.kind !== 'free')) kind = k.key === 'c' ? 'tip' : k.key === 'a' ? 'free' : 'spike'
      else if (b.touches === 3) kind = k.key === 'c' ? 'tip' : 'free'
      g.judge = { text: q > 0.8 ? 'Parfait' : q > 0.45 ? 'Bien' : g.time - k.t > lead ? 'Trop tôt' : 'En retard', t: g.time }
    } else {
      // Not pressed: the player's legs and arms do it alone, a plain one.
      q = 0.35
      if (pl.kind === 'spike') kind = 'free'
      g.judge = { text: 'Auto', t: g.time }
    }
    p.press = null
  } else q = clamp(p.lvl.skill + gauss(g.r) * 0.18, 0, 1)
  // A dig off a hard spike is often a shank.
  if (pl.kind === 'dig') q *= clamp(1.25 - Math.hypot(b.vx, b.vy, b.vz) / 30, 0.3, 1)
  if (kind === 'spike' && !p.human && g.r() < 0.12) kind = 'tip'
  play(g, p, kind, q, e)
}

function play(g: Volley, p: VPlayer, kind: VKind, q: number, e: number) {
  const b = g.ball
  const from: [number, number, number] = [b.x, b.y, b.z]
  const incoming = Math.hypot(b.vx, b.vy, b.vz)
  let to: [number, number, number]
  let T: number
  let spin = 0
  const r = g.r
  const setter = g.ps.find((x) => x.team === p.team && (g.rules.beach ? x.id !== p.id : x.role === 'S'))
  const apexT = (y0: number, apex: number, y1: number) => Math.sqrt((2 * Math.max(0.05, apex - y0)) / 9.81) + Math.sqrt((2 * Math.max(0.05, apex - y1)) / 9.81)
  switch (kind) {
    case 'bump':
    case 'dig': {
      // To the setter's place at the net (or the middle on the beach), high enough for it to get under.
      const sp: [number, number] = g.rules.beach ? at(g, p.team, 0.3, 1.6) : at(g, p.team, 1.2, 1.0)
      const sig = 0.25 + (1 - q) * 1.6 + clamp((incoming - 10) / 20, 0, 1) * (kind === 'dig' ? 1.4 : 0.7)
      // A hard spike off the forearms, badly met: it flies off anywhere (out, into the stands).
      // (A dig: by the spike's pace off the hand, the better defender keeping more of them up.)
      const shank = kind === 'dig' ? clamp(0.3 + (b.speed - (g.rules.women ? 11.5 : 14)) / 20, 0.15, 0.75) * (1.3 - p.lvl.skill * 0.6) * (p.human ? 1.35 - q * 0.7 : 1) : clamp((incoming - 12) / 30, 0, 0.3) * (1.2 - q)
      if (r() < shank) {
        // (Off the arm fast and low: mostly out of anyone's reach, into the stands or the floor.)
        to = [b.x + (r() < 0.5 ? -1 : 1) * (2.5 + r() * 5), BALL_R, b.z + e * (1 + r() * 7)]
        T = 0.55 + r() * 0.35
        link(g, 'dig', p.id)
        moment(g, 'dig', p.id, 'shank')
        break
      }
      to = [sp[0] + gauss(r) * sig, 2.25, sp[1] + e * Math.abs(gauss(r)) * sig * 0.9 * (r() < 0.7 ? 1 : -0.6)]
      // (Never past the net by aim; a bad pass may go over on its own.)
      if (to[2] * e < 0.3) to[2] = e * 0.3
      T = apexT(from[1], kind === 'dig' ? 4.2 : 4.9 + r() * 0.6, 2.25)
      link(g, kind, p.id)
      if (kind === 'dig') {
        g.stats.digs[p.team]++
        if (p.id === g.me) g.stats.mine.digs++
      }
      moment(g, kind, p.id)
      break
    }
    case 'set': {
      // To a hitter: the setter's pick (the player's own sets often when it's on the front row).
      const hitters = g.ps.filter((x) => x.team === p.team && x.id !== p.id && (front(g, x) || x.role === 'OP' || x.role === 'OH'))
      let h = hitters[Math.floor(r() * hitters.length)]
      const me = g.ps[g.me]
      if (me.team === p.team && me.id !== p.id && hitters.includes(me) && (front(g, me) ? r() < 0.55 : r() < 0.2)) h = me
      if (!h) h = g.ps.find((x) => x.team === p.team && x.id !== p.id)!
      const isFront = front(g, h)
      const lx = g.rules.beach ? (h.x * e >= 0 ? 2 : -2) : h.role === 'MB' ? 0.4 : h.role === 'OP' ? 3.6 : h.role === 'OH' ? -3.6 : 0
      const quick = h.role === 'MB' && isFront && !g.rules.beach
      const d = isFront ? (quick ? 0.6 : 0.8) : 3.6
      const [tx, tz] = at(g, p.team, lx, d)
      const sig = 0.12 + (1 - q) * 0.9
      to = [tx + gauss(r) * sig, g.reach.spike - 0.05, tz + e * gauss(r) * sig * 0.6]
      T = apexT(from[1], quick ? g.reach.spike + 0.35 : g.reach.spike + 1.4 + r() * 0.5, to[1])
      link(g, 'set', p.id)
      if (p.id === g.me) g.stats.mine.sets++
      moment(g, 'set', p.id)
      // The hitter starts its run.
      h.spot = [tx, tz + e * 2.6]
      void setter
      break
    }
    case 'spike': {
      // At the open court: away from the block's hands, deep cross or down the line; the human's stick picks.
      const bl = g.ps.filter((x) => x.team !== p.team && Math.abs(x.z) < 1.2)
      const cover = bl.length ? bl.reduce((s, x) => s + x.x, 0) / bl.length : 99
      const me = p.human
      // (The stick in the hitter's own frame: its right is e·x on the court.)
      let tx: number
      let tz: number
      if (me) {
        tx = e * clamp(p.mx, -1, 1) * (g.hw - 0.9)
        tz = -e * (2.6 + (0.45 + r() * 0.3) * (g.hl - 4))
      } else {
        // The hitter reads the court: of a few spots, the one furthest from the diggers and away from the block's hands (a better hitter picks better).
        const diggers = g.ps.filter((x) => x.team !== p.team && Math.abs(x.z) > 1.2)
        let bestS = -1
        tx = 0
        tz = -e * 5
        for (const fx of [-0.9, -0.5, 0, 0.5, 0.9])
          for (const fd of [0.2, 0.5, 0.85]) {
            const cx = fx * (g.hw - 0.9)
            const cz = -e * (2.6 + fd * (g.hl - 4))
            const free = Math.min(...diggers.map((d) => Math.hypot(d.x - cx, d.z - cz)))
            const blocked = Math.abs(cover - (b.x + (cx - b.x) * 0.15)) < 0.8 ? 1.2 : 0
            const sc = free - blocked + gauss(r) * (1.4 - p.lvl.skill) * (g.rules.beach ? 2.2 : 1)
            if (sc > bestS) [bestS, tx, tz] = [sc, cx, cz]
          }
      }
      const v = (g.rules.women ? 17 : 21) + 8 * p.lvl.power * (0.6 + 0.4 * q)
      const sig = 0.25 + (1 - q) * 1.15
      to = [tx + gauss(r) * sig, BALL_R, tz - e * gauss(r) * sig]
      spin = 80
      T = Math.hypot(to[0] - from[0], to[2] - from[2]) / (v * 0.85)
      link(g, 'spike', p.id)
      moment(g, 'spike', p.id, undefined, v)
      break
    }
    case 'tip': {
      const lx = r() * 2 - 1
      to = [lx * (g.hw - 1.5), BALL_R, -e * (1.2 + r() * 1.8)]
      T = apexT(from[1], from[1] + 0.6, BALL_R)
      link(g, 'tip', p.id)
      moment(g, 'tip', p.id)
      break
    }
    default: {
      // A free ball: high and deep to the middle of the other side.
      to = [gauss(r) * 1.5, BALL_R, -e * (g.hl - 2.5 + gauss(r) * 1.2)]
      T = apexT(from[1], Math.max(from[1], g.netY) + 2.2, BALL_R)
      kind = 'free'
      link(g, 'free', p.id)
      moment(g, 'free', p.id)
    }
  }
  const vel = clearAim(g, from, to, T, spin, kind === 'spike' || kind === 'tip' || kind === 'free' ? 0.12 + q * 0.3 : -9, q)
  Object.assign(b, { vx: vel[0], vy: vel[1], vz: vel[2], spin, speed: Math.hypot(...vel) })
  p.pose = kind === 'set' ? 'setball' : kind === 'spike' || kind === 'tip' ? 'spike' : kind === 'dig' && Math.hypot(p.vx, p.vz) > 2.5 ? 'dive' : 'bump'
  p.take++
  // The pose's clock: at the contact's moment in it.
  p.t0 = g.time - (p.pose === 'spike' ? 0.38 : p.pose === 'setball' ? 0.25 : 0.2)
  foresee(g)
}

/**
 * The aim, lifted over the net when it would go into it: the hitter sees the tape and hits higher and
 * longer (`margin` over it); a poor touch (low q) does that only half the time (into the net, then).
 */
function clearAim(g: Volley, from: [number, number, number], to: [number, number, number], T: number, spin: number, margin: number, q: number): [number, number, number] {
  let vel = aim(from, to, T, spin, AIR)
  if (margin < -1 || (q < 0.4 && g.r() < 0.5)) return vel
  const t2: [number, number, number] = [...to]
  for (let k = 0; k < 7; k++) {
    if (overNet(g, from, vel, spin) >= margin) break
    T *= 1.12
    // (And a little deeper, still in the court.)
    if (Math.abs(t2[2]) < g.hl - 1.6) t2[2] += Math.sign(t2[2]) * 0.4
    vel = aim(from, t2, T, spin, AIR)
  }
  return vel
}

/** How far over the tape a flight goes (negative: into the net; big: it never reaches it). */
function overNet(g: Volley, from: [number, number, number], v: [number, number, number], spin: number) {
  const b: Ball = { x: from[0], y: from[1], z: from[2], vx: v[0], vy: v[1], vz: v[2], spin }
  for (let i = 0; i < 500; i++) {
    const z0 = b.z
    fly(b, AIR)
    if (Math.sign(z0) !== Math.sign(b.z)) return b.y - BALL_R - g.netY
    if (b.y < 0) return -1
  }
  return 9
}

/* ---------- The legs ---------- */

/** The human's press, this long before the ball for its best timing (« Parfait »): the spike's jump, the other touches. */
export const pressLead = (k: VKind) => (k === 'spike' ? 0.38 : 0.2)
/** The touches' poses start this long before the ball, so their contact (Human.tsx keyframes) meets it: never snapped in at the touch. */
const LEAD: Partial<Record<VKind, number>> = { bump: 0.2, dig: 0.2, free: 0.2, set: 0.25 }
/** The block's jump: up this long before the hitter's contact (the hands at their top as the ball crosses). */
export const BLOCK_LEAD = 0.3
/** The spike's approach: the last steps before the take-off (s), from this far back (m), and the drift forward in the air (m). */
const APPROACH = 0.8
const RUN_UP = 2.6
const DRIFT = 0.45

/** How long a spiker is in the air from the take-off to the hand at its top. */
export const rise = (g: Volley) => Math.sqrt((2 * (g.reach.spike - g.reach.stand)) / 9.81)

function move(g: Volley, p: VPlayer, dt: number, h: VInput | null) {
  const e = g.end[p.team]
  // In the air: up and down.
  if (p.y > 0 || p.vy > 0) {
    p.vy -= 9.81 * dt
    p.y = Math.max(0, p.y + p.vy * dt)
    if (p.y === 0) p.vy = 0
  }
  p.at = g.time - p.t0
  if (g.phase === 'serve' || g.phase === 'count' || g.phase === 'switch') {
    p.vx = p.vz = 0
    if (g.phase === 'switch') p.pose = 'walk'
    else if (p !== server(g)) p.pose = 'ready'
    p.face = e > 0 ? Math.PI : 0
    return
  }
  if (g.phase === 'toss' && p === server(g)) return
  const jump = (v: number, pose: Pose, lead: number, keep: number) => {
    if (p.y > 0) return
    p.vy = v
    p.pose = pose
    p.take++
    p.t0 = g.time - lead
    // (The run carried into the air, a little: a spiker drifts forward, a blocker goes straight up.)
    p.vx *= keep
    p.vz *= keep
  }
  const blockV = Math.sqrt(2 * 9.81 * (g.reach.block - g.reach.stand))
  // The block's jump (the AI's when planned; the human's on its press with an attack coming, judged on its timing).
  if (p.blockAt !== null && g.time >= p.blockAt) {
    p.blockAt = null
    jump(blockV, 'netblock', 0, 0.1)
  }
  if (p.human && p.press && g.attack && g.ps[g.attack.by].team !== p.team && Math.abs(p.z) < 1.6 && front(g, p) && g.time - p.press.t < 0.05) {
    if (p.y === 0) {
      const off = g.time - (g.attack.t - BLOCK_LEAD)
      g.judge = { text: Math.abs(off) < 0.08 ? 'Parfait' : off < 0 ? 'Trop tôt' : 'En retard', t: g.time }
    }
    jump(blockV, 'netblock', 0, 0.1)
    p.press = null
  }
  const pl = p.plan
  const up = rise(g)
  // The touch's pose, begun before the ball so the arms are there at the contact.
  const lead = pl ? LEAD[pl.kind] : undefined
  if (pl && lead !== undefined && p.y === 0 && g.time >= pl.t - lead && p.t0 !== pl.t - lead) {
    p.pose = pl.kind === 'set' ? 'setball' : 'bump'
    p.take++
    p.t0 = pl.t - lead
    p.at = g.time - p.t0
  }
  // The spiker's jump: timed so the hand is at the top as the ball comes (the human: on its press).
  const toJump = pl && pl.kind === 'spike' ? pl.t - up - g.time : 9
  if (pl && pl.kind === 'spike') {
    if (p.human) {
      if (p.press && p.press.key !== 'a' && g.time - p.press.t < 0.05) jump(9.81 * up, 'spike', 0, 0.4)
    } else if (toJump <= 0) jump(9.81 * up, 'spike', 0, 0.4)
  }
  // Where to be: the touch's place (behind the ball); for a spike, the run-up's start, then its take-off spot; else its spot.
  let [tx, tz] = p.spot
  let left = pl ? pl.t - g.time : 0.8
  let top = p.lvl.speed
  if (pl && pl.kind === 'spike') {
    const kz = pl.z + e * (0.35 + DRIFT)
    // (The wings come in from outside, the middle straight.)
    const wide = Math.abs(pl.x) > 1.2 ? Math.sign(pl.x) * 0.8 : 0
    if (toJump > APPROACH) {
      ;[tx, tz] = [pl.x + wide, kz + e * RUN_UP]
      left = toJump - APPROACH
    } else {
      // The approach: accelerating into the take-off (the last steps the fastest).
      ;[tx, tz] = [pl.x, kz]
      left = Math.max(0.05, toJump)
      top = p.lvl.speed * 1.15
    }
  } else if (pl) [tx, tz] = [pl.x, pl.z + e * 0.3]
  let wx = 0
  let wz = 0
  const stick = h ? Math.hypot(h.mx, h.mz) : 0
  const approach = !!pl && pl.kind === 'spike' && toJump <= APPROACH
  if (p.human && h && (stick > 0.2 || !g.rules.assist)) {
    wx = h.mx * e
    wz = h.mz * e
    const m = Math.hypot(wx, wz)
    if (m > 1) {
      wx /= m
      wz /= m
    }
    wx *= p.lvl.speed
    wz *= p.lvl.speed
  } else if (!(pl === null && !p.human && g.time - g.pathT < p.lvl.react)) {
    const dx = tx - p.x
    const dz = tz - p.z
    const d = Math.hypot(dx, dz)
    // In time, never faster than it can stop (except into the take-off), a step at the end.
    let v = approach ? Math.min(top, d / left) : Math.min(top, Math.sqrt(2 * 10 * Math.max(0, d - 0.08)), d / Math.max(0.1, left * 0.75) + 0.3)
    if (d < 0.1) v = 0
    if (d > 0.01) {
      wx = (dx / d) * v
      wz = (dz / d) * v
    }
  }
  if (p.y === 0) {
    // The push off and the brakes, as feet do (the sand holds them back).
    const acc = p.lvl.speed * (g.rules.beach ? 1.8 : 2.3) * (p.human ? 1.15 : 1)
    const brake = g.rules.beach ? 10 : 14
    const dvx = wx - p.vx
    const dvz = wz - p.vz
    const dv = Math.hypot(dvx, dvz)
    const amax = (wx * p.vx + wz * p.vz < p.vx * p.vx + p.vz * p.vz - 0.01 ? brake : acc) * dt
    if (dv > amax) {
      p.vx += (dvx / dv) * amax
      p.vz += (dvz / dv) * amax
    } else {
      p.vx = wx
      p.vz = wz
    }
  }
  p.x = clamp(p.x + p.vx * dt, -g.hw - 4, g.hw + 4)
  p.z += p.vz * dt
  // Not under the net (a foot on the centre line is let go).
  if (p.z * e < 0.25) {
    p.z = e * 0.25
    p.vz = 0
  }
  if (Math.abs(p.z) > g.hl + 5) p.z = Math.sign(p.z) * (g.hl + 5)
  // Facing the ball, mostly towards the net; a long run faces where it goes; turned at a body's pace.
  const sp = Math.hypot(p.vx, p.vz)
  const base = e > 0 ? Math.PI : 0
  const runFace = sp > 3.4 && p.y === 0 && !approach && (!pl || pl.t - g.time > 0.45)
  const look = runFace ? Math.atan2(p.vx, p.vz) : Math.atan2(g.ball.x - p.x, g.ball.z - p.z)
  const want = base + clamp(Math.atan2(Math.sin(look - base), Math.cos(look - base)), runFace ? -1.75 : -1.3, runFace ? 1.75 : 1.3)
  const turn = Math.atan2(Math.sin(want - p.face), Math.cos(want - p.face))
  p.face += clamp(turn, -10 * dt, 10 * dt)
  const busy = (p.pose === 'bump' || p.pose === 'setball' || p.pose === 'spike' || p.pose === 'netblock' || p.pose === 'dive') && p.at < (p.pose === 'dive' ? 1.3 : 0.8)
  if (!busy && p.y === 0) {
    const side = Math.abs(Math.cos(p.face) * p.vx - Math.sin(p.face) * p.vz)
    p.pose = sp > 2.6 ? 'run' : sp > 0.4 ? (side > sp * 0.6 && !runFace ? 'shuffle' : 'walk') : 'ready'
  }
}

/** Scoreboard: points, sets won, sets done. */
export function vboard(g: Volley) {
  return { pts: g.score.pts, sets: g.score.sets, done: g.score.done, serving: g.serving, to: setTo(g) }
}
