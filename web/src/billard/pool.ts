// American pool (the 8-ball) on the maquis's table: the balls, the six pockets, the cushions, the rules,
// and the regular who plays against the player (components/defi/Billard.tsx draws it). No React, no
// three.js (its words through lib/i18n); units are metres, the table's centre at 0, its long side along x.

import { t } from '../lib/i18n'

export const TABLE = { w: 2.24, h: 1.12 } // the playing surface (an 8-foot bar table)
export const R = 0.0286 // a ball's radius
// (The pockets' mouths: a little over two balls across, as on a bar table.)
const POCKET_CORNER = 0.054
const POCKET_SIDE = 0.057
const DECEL = 0.2 // rolling friction (m/s²)
const DAMP = 0.25 // and a little more, faster balls slowing faster (1/s)
const CUSHION = 0.78 // what a cushion gives back
const BALLS = 0.94 // what a ball gives another
export const MAX_SPEED = 4.6 // the cue ball's speed at full power (m/s)

export type Group = 'pleines' | 'rayees'
export type Ball = { n: number; x: number; z: number; vx: number; vz: number; in: boolean }
export type Pocket = { x: number; z: number; r: number }
export const POCKETS: Pocket[] = [
  { x: -TABLE.w / 2, z: -TABLE.h / 2, r: POCKET_CORNER },
  { x: 0, z: -TABLE.h / 2 - 0.012, r: POCKET_SIDE },
  { x: TABLE.w / 2, z: -TABLE.h / 2, r: POCKET_CORNER },
  { x: -TABLE.w / 2, z: TABLE.h / 2, r: POCKET_CORNER },
  { x: 0, z: TABLE.h / 2 + 0.012, r: POCKET_SIDE },
  { x: TABLE.w / 2, z: TABLE.h / 2, r: POCKET_CORNER },
]
/** Where the cue ball is put down (the head spot), and where the rack's apex stands (the foot spot). */
export const HEAD = { x: -TABLE.w / 4, z: 0 }
const FOOT = { x: TABLE.w / 4, z: 0 }

export const groupOf = (n: number): Group | null => (n >= 1 && n <= 7 ? 'pleines' : n >= 9 ? 'rayees' : null)

export type Game = {
  balls: Ball[]
  /** Whose shot: 0 the player, 1 the regular. */
  turn: 0 | 1
  groups: [Group | null, Group | null]
  /** The balls are running (a shot being played). */
  moving: boolean
  /** What the shot did so far: the first ball the cue ball touched, the balls pocketed (in order), a cushion after the contact. */
  shot: { first: number | null; potted: number[]; rail: boolean }
  /** The cue ball to be put down by the side to play (after a foul). */
  inHand: boolean
  winner: 0 | 1 | null
  /** What the last shot came to, said on the screen. */
  said: string
  /** The shots each side played. */
  shots: [number, number]
  breakShot: boolean
  /**
   * The cue ball's spin for this shot (-1 draw, the « rétro », to +1 follow, the « coulé »): at its first
   * contact, the cue ball comes back or rolls on along its way, as much as it was struck low or high.
   */
  spin: number
  /**
   * The side spin, the « effet » left or right (-1 to +1): at each cushion the cue ball comes off it pushed
   * to that side of its way (spent by half at each one).
   */
  side: number
  /** What made a sound since the screen last looked (it plays them and puts them back to 0): balls clicking, cushions, pockets. */
  fx: { click: number; rail: number; pocket: number; hard: number }
}

/** A new game: the fifteen balls racked in their triangle (the 8 in the middle, a solid and a stripe in the back corners), the cue ball behind. */
export function newGame(seed = 1): Game {
  let s = seed * 9301 + 49297
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  const rest = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15].sort(() => rnd() - 0.5)
  // Rows 1..5 from the apex; the 8 in the middle of row 3; a solid and a stripe in the back corners.
  const order: number[] = []
  const solid = rest.findIndex((n) => n < 8)
  const backA = rest.splice(solid, 1)[0]
  const stripe = rest.findIndex((n) => n > 8)
  const backB = rest.splice(stripe, 1)[0]
  let k = 0
  const balls: Ball[] = [{ n: 0, x: HEAD.x, z: HEAD.z, vx: 0, vz: 0, in: false }]
  const dx = R * 2 * Math.cos(Math.PI / 6) + 0.0004
  for (let row = 0; row < 5; row++)
    for (let i = 0; i <= row; i++) {
      let n: number
      if (row === 2 && i === 1) n = 8
      else if (row === 4 && i === 0) n = backA
      else if (row === 4 && i === 4) n = backB
      else n = rest[k++]
      order.push(n)
      balls.push({ n, x: FOOT.x + row * dx, z: (i - row / 2) * (R * 2 + 0.0004), vx: 0, vz: 0, in: false })
    }
  return { balls, turn: 0, groups: [null, null], moving: false, shot: { first: null, potted: [], rail: false }, inHand: false, winner: null, said: '', shots: [0, 0], breakShot: true, spin: 0, side: 0, fx: { click: 0, rail: 0, pocket: 0, hard: 0 } }
}

export const cue = (g: Game) => g.balls[0]
const live = (g: Game) => g.balls.filter((b) => !b.in)

/** The shot: the cue ball sent at an angle (radians, 0 along +x) with a power (0–1). */
export function shoot(g: Game, angle: number, power: number, spin = 0, side = 0) {
  if (g.moving || g.winner !== null) return
  g.spin = Math.max(-1, Math.min(1, spin))
  g.side = Math.max(-1, Math.min(1, side))
  const c = cue(g)
  const v = Math.max(0.05, Math.min(1, power)) * MAX_SPEED
  c.vx = Math.cos(angle) * v
  c.vz = Math.sin(angle) * v
  g.moving = true
  g.inHand = false
  g.shot = { first: null, potted: [], rail: false }
  g.shots[g.turn]++
}

/** The table moved on dt seconds (in small steps); true while anything still runs. */
export function step(g: Game, dt: number): boolean {
  if (!g.moving) return false
  const n = Math.max(1, Math.ceil(dt / (1 / 480)))
  const h = dt / n
  for (let k = 0; k < n; k++) tick(g, h)
  if (live(g).every((b) => b.vx === 0 && b.vz === 0)) {
    g.moving = false
    settle(g)
  }
  return g.moving
}

function tick(g: Game, h: number) {
  const bs = live(g)
  for (const b of bs) {
    const v = Math.hypot(b.vx, b.vz)
    if (v === 0) continue
    const nv = Math.max(0, v - (DECEL + DAMP * v) * h)
    if (nv < 0.004) {
      b.vx = b.vz = 0
      continue
    }
    b.vx *= nv / v
    b.vz *= nv / v
    b.x += b.vx * h
    b.z += b.vz * h
  }
  // Into a pocket: its centre within the pocket's mouth.
  for (const b of bs)
    for (const p of POCKETS)
      if (Math.hypot(b.x - p.x, b.z - p.z) < p.r) {
        b.in = true
        b.vx = b.vz = 0
        g.shot.potted.push(b.n)
        g.fx.pocket++
        break
      }
  const on = bs.filter((b) => !b.in)
  // The cushions (but at the pockets' mouths, where the ball falls in).
  const hx = TABLE.w / 2 - R
  const hz = TABLE.h / 2 - R
  for (const b of on) {
    const nearPocket = POCKETS.some((p) => Math.hypot(b.x - p.x, b.z - p.z) < p.r + R * 1.2)
    if (nearPocket) continue
    if (b.x < -hx || b.x > hx) {
      b.x = Math.max(-hx, Math.min(hx, b.x))
      if (Math.abs(b.vx) > 0.15) g.fx.rail++
      if (b.n === 0) english(g, b, Math.abs(b.vx))
      b.vx = -b.vx * CUSHION
      if (g.shot.first !== null) g.shot.rail = true
    }
    if (b.z < -hz || b.z > hz) {
      b.z = Math.max(-hz, Math.min(hz, b.z))
      if (Math.abs(b.vz) > 0.15) g.fx.rail++
      if (b.n === 0) english(g, b, Math.abs(b.vz))
      b.vz = -b.vz * CUSHION
      if (g.shot.first !== null) g.shot.rail = true
    }
  }
  // Ball on ball: equal masses, along the line of centres.
  for (let i = 0; i < on.length; i++)
    for (let j = i + 1; j < on.length; j++) {
      const a = on[i]
      const b = on[j]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const d = Math.hypot(dx, dz)
      if (d >= 2 * R || d === 0) continue
      const nx = dx / d
      const nz = dz / d
      // Apart again first.
      const push = (2 * R - d) / 2
      a.x -= nx * push
      a.z -= nz * push
      b.x += nx * push
      b.z += nz * push
      const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz
      if (rel <= 0) continue
      const imp = (rel * (1 + BALLS)) / 2
      // The cue ball's way before the contact (for its spin).
      const c = a.n === 0 ? a : b.n === 0 ? b : null
      const before = c ? { vx: c.vx, vz: c.vz } : null
      a.vx -= imp * nx
      a.vz -= imp * nz
      b.vx += imp * nx
      b.vz += imp * nz
      if (rel > 0.05) g.fx.click++
      if (rel > 2) g.fx.hard++
      if (g.shot.first === null && c) {
        g.shot.first = a.n === 0 ? b.n : a.n
        // Its spin at the first contact: struck high it rolls on along its way (coulé), low it comes back (rétro).
        if (g.spin && before) {
          const k = g.spin > 0 ? 0.5 : 0.75
          const sp = Math.hypot(before.vx, before.vz)
          if (sp > 0) {
            c.vx += (before.vx / sp) * rel * k * g.spin
            c.vz += (before.vz / sp) * rel * k * g.spin
          }
        }
      }
    }
}

/**
 * The side spin at a cushion: the cue ball pushed to the right of its way (right english, seen from behind
 * it), or to the left, as much as it hits the cushion hard; then half of it spent.
 */
function english(g: Game, b: Ball, into: number) {
  if (!g.side) return
  const v = Math.hypot(b.vx, b.vz)
  if (v === 0) return
  // (Right of the way (dx, dz) is (-dz, dx): up the table, the right is across to +z.)
  const k = g.side * 0.42 * into
  const [ux, uz] = [b.vx / v, b.vz / v]
  b.vx += -uz * k
  b.vz += ux * k
  g.side *= 0.5
}

/** How many of a side's group are still on the table. */
export const left = (g: Game, side: 0 | 1) => {
  const grp = g.groups[side]
  return grp ? g.balls.filter((b) => !b.in && groupOf(b.n) === grp).length : 7
}

/** The shot over: fouls, the groups, whose turn, the 8. */
function settle(g: Game) {
  const me = g.turn
  const other = (1 - me) as 0 | 1
  const { first, potted, rail } = g.shot
  const scratch = potted.includes(0)
  const eight = potted.includes(8)
  const mine = g.groups[me]
  // Before the shot: was the side down to the 8?
  const ownBefore = mine ? g.balls.filter((b) => groupOf(b.n) === mine && (!b.in || potted.includes(b.n))).length : 7
  // (Down to the 8: none of one's group was on the table when the shot was played.)
  const onEight = !!mine && ownBefore === 0
  let foul: string | null = null
  if (scratch) foul = t('la blanche est tombée')
  else if (first === null) foul = t('aucune bille touchée')
  else if (!g.breakShot && mine && first !== 8 && groupOf(first) !== mine) foul = t('mauvaise bille touchée en premier')
  else if (!g.breakShot && mine && first === 8 && !onEight) foul = t('la noire touchée en premier')
  else if (!g.breakShot && !mine && first === 8) foul = t('la noire touchée en premier')
  else if (!g.breakShot && potted.length === 0 && !rail) foul = t('aucune bande après la touche')
  g.breakShot = false
  // The 8 in a pocket: the game's over, won only if it was the last ball and no foul.
  if (eight) {
    const won = !!mine && onEight && !foul
    g.winner = won ? me : other
    g.said = won ? t('La noire dans la poche : partie gagnée !') : t('La noire tombée trop tôt : partie perdue.')
    if (scratch) cue(g).in = false
    return
  }
  // The groups, on an open table: the first ball pocketed (no foul) gives its group.
  if (!mine && !foul) {
    const firstIn = potted.find((n) => groupOf(n))
    if (firstIn !== undefined) {
      const gr = groupOf(firstIn)!
      g.groups[me] = gr
      g.groups[other] = gr === 'pleines' ? 'rayees' : 'pleines'
    }
  }
  if (scratch) {
    const c = cue(g)
    c.in = false
    c.vx = c.vz = 0
    placeCue(g, HEAD.x, HEAD.z)
  }
  if (foul) {
    g.turn = other
    g.inHand = true
    g.said = t('Faute : {0}.', { 0: foul })
    return
  }
  const scored = potted.some((n) => (g.groups[me] ? groupOf(n) === g.groups[me] : groupOf(n) !== null))
  if (scored) g.said = potted.length > 1 ? t('{0} billes rentrées !', { 0: potted.length }) : t('Bien rentrée !')
  else {
    g.turn = other
    g.said = ''
  }
}

/** The cue ball put down at a spot, or the nearest free one about it. */
export function placeCue(g: Game, x: number, z: number) {
  const c = cue(g)
  const hx = TABLE.w / 2 - R * 1.5
  const hz = TABLE.h / 2 - R * 1.5
  for (let r = 0; r < 0.4; r += 0.01)
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const px = Math.max(-hx, Math.min(hx, x + Math.cos(a) * r))
      const pz = Math.max(-hz, Math.min(hz, z + Math.sin(a) * r))
      if (g.balls.every((b) => b === c || b.in || Math.hypot(b.x - px, b.z - pz) > 2 * R + 0.002)) {
        c.x = px
        c.z = pz
        c.in = false
        return
      }
      if (r === 0) break
    }
}

/** The balls a side may aim at now. */
export function targets(g: Game, side: 0 | 1): Ball[] {
  const grp = g.groups[side]
  const on = live(g).filter((b) => b.n !== 0)
  if (!grp) return on.filter((b) => b.n !== 8)
  const own = on.filter((b) => groupOf(b.n) === grp)
  return own.length ? own : on.filter((b) => b.n === 8)
}

/** The first ball on the cue ball's way at an angle (where it meets it), for the aiming line. */
export function aimHit(g: Game, angle: number): { ball: Ball | null; x: number; z: number; obj?: { x: number; z: number }; cue?: { x: number; z: number; k: number } } {
  const c = cue(g)
  const ux = Math.cos(angle)
  const uz = Math.sin(angle)
  let best: { ball: Ball | null; t: number } = { ball: null, t: Infinity }
  for (const b of live(g)) {
    if (b.n === 0) continue
    const fx = b.x - c.x
    const fz = b.z - c.z
    const along = fx * ux + fz * uz
    if (along <= 0) continue
    const off2 = fx * fx + fz * fz - along * along
    const rr = 4 * R * R
    if (off2 > rr) continue
    const t = along - Math.sqrt(rr - off2)
    if (t < best.t) best = { ball: b, t }
  }
  if (best.ball) {
    const x = c.x + ux * best.t
    const z = c.z + uz * best.t
    // The ball hit goes along the line of centres; the cue ball, without spin, at right angles to it.
    const nx = (best.ball.x - x) / (2 * R)
    const nz = (best.ball.z - z) / (2 * R)
    const along = ux * nx + uz * nz
    const tx = ux - along * nx
    const tz = uz - along * nz
    const tl = Math.hypot(tx, tz) || 1
    return { ball: best.ball, x, z, obj: { x: nx, z: nz }, cue: { x: tx / tl, z: tz / tl, k: Math.sqrt(Math.max(0, 1 - along * along)) } }
  }
  // Else to the cushion.
  const hx = TABLE.w / 2 - R
  const hz = TABLE.h / 2 - R
  const tx = ux > 0 ? (hx - c.x) / ux : ux < 0 ? (-hx - c.x) / ux : Infinity
  const tz = uz > 0 ? (hz - c.z) / uz : uz < 0 ? (-hz - c.z) / uz : Infinity
  const t = Math.min(tx, tz)
  return { ball: null, x: c.x + ux * t, z: c.z + uz * t }
}

/** Nothing in the way of a ball going from a to b (but the balls named). */
function clear(g: Game, ax: number, az: number, bx: number, bz: number, skip: number[]) {
  const dx = bx - ax
  const dz = bz - az
  const len = Math.hypot(dx, dz)
  if (len === 0) return true
  for (const o of live(g)) {
    if (skip.includes(o.n)) continue
    const t = Math.max(0, Math.min(len, ((o.x - ax) * dx + (o.z - az) * dz) / len))
    const px = ax + (dx / len) * t
    const pz = az + (dz / len) * t
    if (Math.hypot(o.x - px, o.z - pz) < 2 * R + 0.003) return false
  }
  return true
}

/**
 * The regular's shot: of every ball he may play and every pocket, the cut that's easiest (the ghost ball
 * reachable, the way to the pocket clear, a thin angle, short distances), aimed with a hand that shakes as
 * much as he's less good (skill 0–1); none: the ball nearest, hit full.
 */
export function aiShot(g: Game, skill: number, rnd: () => number = Math.random): { angle: number; power: number; spin: number } {
  const side = g.turn
  const c = cue(g)
  // The break: hard at the rack.
  if (g.breakShot) return { angle: Math.atan2(-c.z, FOOT.x - c.x) + (rnd() - 0.5) * 0.01, power: 0.95, spin: 0 }
  let best: { angle: number; power: number; score: number } | null = null
  for (const b of targets(g, side))
    for (const p of POCKETS) {
      const tx = p.x - b.x
      const tz = p.z - b.z
      const tl = Math.hypot(tx, tz)
      const gx = b.x - (tx / tl) * 2 * R
      const gz = b.z - (tz / tl) * 2 * R
      const cx = gx - c.x
      const cz = gz - c.z
      const cl = Math.hypot(cx, cz)
      const cut = Math.acos(Math.max(-1, Math.min(1, (cx * tx + cz * tz) / (cl * tl))))
      if (cut > 1.3) continue
      if (!clear(g, c.x, c.z, gx, gz, [0, b.n]) || !clear(g, b.x, b.z, p.x, p.z, [b.n])) continue
      const score = Math.cos(cut) ** 2 / (0.4 + cl + tl * 0.8)
      if (!best || score > best.score) best = { angle: Math.atan2(cz, cx), power: Math.min(1, 0.28 + (cl + tl) * 0.22 + cut * 0.2), score }
    }
  const shake = (1.15 - skill) * 0.035
  // (A good player draws the cue ball back off a straight shot, so it doesn't follow the ball in.)
  if (best) return { angle: best.angle + (rnd() - 0.5) * 2 * shake, power: best.power, spin: skill > 0.7 ? -0.4 : 0 }
  const t = targets(g, side).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0]
  return { angle: t ? Math.atan2(t.z - c.z, t.x - c.x) : rnd() * Math.PI * 2, power: 0.5, spin: 0 }
}

/** The défi's score (0–100): won, 70 and up for how many of his balls the regular still had; lost, 10 a ball of one's own pocketed. */
export function score(g: Game): number {
  if (g.winner === 0) return Math.round(70 + 30 * (left(g, 1) / 7))
  const mine = g.groups[0]
  const potted = mine ? 7 - left(g, 0) : 0
  return Math.min(60, potted * 10)
}

/* ---------- Against a player (components/pvp/play.tsx BillardPvp) ---------- */

/** The table as a shot left it, small enough to send: the balls (x, z in tenths of a millimetre), those down, whose turn, the groups, the winner, ball in hand, the break, what was said. */
export type Snap = { b: number[]; i: number; t: 0 | 1; g: [number, number]; w: number; h: boolean; k: boolean; s: string }
const GROUPS: (Group | null)[] = [null, 'pleines', 'rayees']

export function snapshot(g: Game): Snap {
  return {
    b: g.balls.flatMap((b) => [Math.round(b.x * 10000), Math.round(b.z * 10000)]),
    i: g.balls.reduce((m, b, k) => (b.in ? m | (1 << k) : m), 0),
    t: g.turn,
    g: [GROUPS.indexOf(g.groups[0]), GROUPS.indexOf(g.groups[1])],
    w: g.winner ?? -1,
    h: g.inHand,
    k: g.breakShot,
    s: g.said.slice(0, 80),
  }
}

/** The table put back as a snapshot says (the balls at rest). */
export function restore(g: Game, s: Snap) {
  g.balls.forEach((b, k) => {
    b.x = s.b[k * 2] / 10000
    b.z = s.b[k * 2 + 1] / 10000
    b.vx = b.vz = 0
    b.in = !!(s.i & (1 << k))
  })
  g.turn = s.t
  g.groups = [GROUPS[s.g[0]] ?? null, GROUPS[s.g[1]] ?? null]
  g.winner = s.w < 0 ? null : (s.w as 0 | 1)
  g.inHand = s.h
  g.breakShot = s.k
  g.said = s.s
  g.moving = false
}
