import type { StadiumEvent } from '../../lib/stadium'
import { t as tr } from '../../lib/i18n'

// The match at the stadium, as a script everyone plays the same: from the
// shared clock and the event alone (the goal minutes come from the server,
// game/stadium.go), it says where each of the 60 people on the pitch wants to
// be, what they are doing, and where the ball is. The drawing (stadiumLive.tsx)
// walks them there at a human pace, so nothing ever jumps.
//
// The day of a match, in minutes from the kick-off:
//   -40 → -12  the warm-up: a lap, passing in pairs, sprints, stretching
//   -12 → -9.6 back to the dressing room
//   -9.6 → 0   the ceremony: the flag, the teams walking out with the escort
//              kids under the fireworks and the confetti, the anthem, the
//              handshakes, the team photos, the coin toss, the huddles
//     0 → 45   the first half (a cooling break at 30', stoppage time)
//    45 → 60   half-time in the dressing room
//    60 → 105  the second half (a cooling break at 75', two substitutions)
//   105 → 114  the final whistle, the winners dancing, the lap of honour
//
// The play is a chain of moves, each 12 to 28 seconds: a restart (kick-off,
// throw-in, goal kick, the keeper's throw, corner, free kick), passes along
// the team pushing up, and an ending: a shot saved, wide or over, a cross
// put out for a corner, a tackle, the ball out for a throw-in, a foul, or a
// goal when the server says one falls.

export const HALF = 45
export const SECOND = 60
export const FULL = 105
export const PARTY = 1.2 // minutes of celebrating a goal
const COOL = [30, 90] // the cooling breaks (minutes on the clock: 30' and 75')
const COOL_LEN = 1.5

// The cast: two teams of eleven, the officials, the staff, the escort kids, the flag bearers.
export const REF = 22
export const AR1 = 23 // the assistant on the near side
export const AR2 = 24 // the assistant on the far side
export const FOURTH = 25
export const COACH = [26, 27] as const
export const SUB = [28, 29] as const
export const MEDIC = [30, 31] as const
export const KID = 32 // 22 escort kids, one per player
export const BEARER = 54 // 6 flag bearers, then the photographers
export const NF = 60

export const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}
export const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
const lerp = (a: number, b: number, u: number) => a + (b - a) * u
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export type Pose =
  | 'stand' | 'kick' | 'header' | 'throwin' | 'gkReady' | 'gkDive' | 'gkHold' | 'gkThrow' | 'party' | 'slide' | 'knees' | 'down'
  | 'protest' | 'heart' | 'wave' | 'shake' | 'photoBack' | 'photoFront' | 'huddle' | 'toss' | 'drink' | 'clap' | 'sit' | 'point'
  | 'card' | 'whistle' | 'flag' | 'board' | 'shout' | 'despair' | 'jump' | 'carry' | 'camera' | 'kid' | 'tactics' | 'hips'
  | 'stretch' | 'kneesUp' | 'bench' | 'wall' | 'treat'

/** Where someone wants to be and what they're doing; p is the pose's progress or variant; run their top speed (m/s). */
export type Target = { x: number; z: number; face: number | null; pose: Pose; p: number; hidden: boolean; run: number }
export type Frame = {
  figs: Target[]
  ball: { x: number; y: number; z: number; hidden: boolean }
  /** The warm-up balls, in pairs' feet. */
  warm: { x: number; y: number; z: number }[]
  /** The big flag carried out before the match (its centre), or null. */
  flag: { x: number; z: number; y: number } | null
  coin: { x: number; y: number; z: number } | null
  card: 'yellow' | 'red' | null
  board: string | null
  confetti: number
  pyro: number
  tunnel: boolean
  /** How the crowd feels apart from goals: the walk-out, the anthem. */
  hype: number
  /** Which figure plays in each team slot (the substitutes take over). */
  slot: number[]
}

// ——— The teams ———

/** The 4-4-2 in a team's own frame: u along the pitch towards the goal it attacks, v across. */
const SLOTS: [number, number][] = [[-49, 0], [-33, -24], [-35, -8], [-35, 8], [-33, 24], [-14, -25], [-16, -8], [-16, 8], [-14, 25], [-2, -7], [-2, 7]]
const PUSH = [0, 12, 10, 10, 12, 16, 15, 15, 16, 22, 22] // how far each line steps up when the team has the ball
const DROP = [0, -2, -3, -3, -2, -6, -6, -6, -6, -4, -4] // and back when it hasn't
export const NUMBERS = [1, 3, 4, 5, 2, 7, 6, 8, 11, 9, 10]
export const CAPTAIN = 6 // the slot wearing the armband (number 6)
const SUB_SLOT = [9, 20] // who comes off at 75'
export const SUB_NUMBERS = [14, 17]

const SURNAMES = [tr('KONÉ'), tr('TRAORÉ'), 'KOUASSI', 'YAO', tr('KOUAMÉ'), 'BAMBA', 'DIALLO', 'COULIBALY', tr('TOURÉ'), "N'GUESSAN", 'KOFFI', 'AKA', 'GNAGNE', tr('SÉRI'), 'ZADI', 'DOUMBIA', 'SANOGO', 'FOFANA', 'KAMARA', tr('DIOMANDÉ'), tr('TIÉ'), 'BROU', 'ASSI', 'ANOH', tr('DJÉ'), 'LOBA', 'AMANI', 'KACOU', 'ESSIS', 'BOLI', 'GOHI', 'SIAKA', 'ZORO', 'OBOU']
const clubSeed = (club: string) => [...club].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 9973
/** The name on a player's back: drawn from the club's name, so every screen has the same squad. */
export function playerName(club: string, n: number) {
  return SURNAMES[Math.floor(hash(clubSeed(club) + n * 3.7) * SURNAMES.length)]
}

/** A team frame to the pitch: team -1 (home) or 1, half 1 or -1 (ends change at half-time). */
const toX = (team: number, h: number, u: number) => u * team * h
const fromX = toX

// ——— The moves ———

type Restart = 'kickoff' | 'throw' | 'goalkick' | 'keeper' | 'corner' | 'free' | 'play'
type End = 'saved' | 'wide' | 'over' | 'corner' | 'tackle' | 'out' | 'foul' | 'goal' | 'continue' | 'break' | 'half'
type V = [number, number]
type Pass = { t0: number; t1: number; from: number; to: number; a: V; b: V; loft: number }
type Move = {
  team: -1 | 1
  h: 1 | -1
  t0: number // when the setting-up starts (seconds from the kick-off)
  play: number // the restart is taken
  restart: Restart
  at: V
  passes: Pass[]
  endT0: number // the last touch
  t1: number // the ending lands
  stop: number // play starts again
  end: End
  from: V
  to: V
  toY: number
  shooter: number
  card: 0 | 1 | 2
  injury: boolean
  fouler: number
  side: number
}

const SETUP: Record<Restart, number> = { kickoff: 4, throw: 4, goalkick: 6, keeper: 3, corner: 8, free: 9, play: 0 }
const SHOTS: End[] = ['saved', 'wide', 'over', 'goal']

/** The moves of one half: kick-off to whistle, in order. */
function buildHalf(e: StadiumEvent, h: 1 | -1, goals: { s: number; team: -1 | 1 }[]): Move[] {
  const H0 = h === 1 ? 0 : SECOND * 60
  const H1 = h === 1 ? HALF * 60 : FULL * 60
  const first: -1 | 1 = hash(e.start * 3.1) > 0.5 ? 1 : -1
  let team: -1 | 1 = h === 1 ? first : (-first as -1 | 1)
  let restart: Restart = 'kickoff'
  let at: V = [0, 0]
  let c = H0
  const out: Move[] = []
  for (let n = 1; c < H1 - 4 && n < 500; n++) {
    const R = (i: number) => hash(e.start * 0.37 + h * 101.3 + n * 7.7 + i * 1.31)
    const play = c + SETUP[restart]
    let len = 12 + R(1) * 16
    let end: End | null = null
    const g = goals.find((x) => x.s > play + 2 && x.s < H1)
    const cool = COOL.map((m) => m * 60).find((b) => b > c && b < H1)
    if (g && g.s - play < len + 14) {
      if (g.team !== team && g.s - play > 16) {
        // The other side wins it back first.
        len = Math.max(3, g.s - play - 14)
        end = 'tackle'
      } else {
        team = g.team
        len = Math.max(2, g.s - play - 0.9)
        end = 'goal'
      }
    }
    if (!end && cool && play + len + 6 > cool) {
      len = Math.max(2, cool - play - 3)
      end = 'break'
    }
    if (!end && play + len + 3 > H1) {
      len = Math.max(1, H1 - play - 1)
      end = 'half'
    }
    if (!end) {
      const r = R(2)
      if (restart === 'corner') end = r < 0.45 ? 'saved' : r < 0.8 ? 'over' : 'wide'
      else if (restart === 'free' && at[0] > 16) end = r < 0.4 ? 'saved' : r < 0.75 ? 'over' : 'wide'
      else end = r < 0.2 ? 'saved' : r < 0.32 ? 'wide' : r < 0.38 ? 'over' : r < 0.52 ? 'corner' : r < 0.72 ? 'tackle' : r < 0.86 ? 'out' : r < 0.95 ? 'foul' : 'continue'
    }

    // The passes: the ball goes up the pitch from one player to the next.
    const passes: Pass[] = []
    const side = at[1] >= 0 ? 1 : -1
    let hold = restart === 'kickoff' ? 9 : restart === 'goalkick' || restart === 'keeper' ? 0 : restart === 'throw' ? (side < 0 ? (at[0] < 0 ? 1 : 5) : at[0] < 0 ? 4 : 8) : restart === 'corner' ? (side < 0 ? 5 : 8) : nearestSlot(at, -1, 1)
    let pt: V = [...at]
    let t = play
    const direct = (restart === 'free' && at[0] > 16 && end !== 'tackle') || (end === 'goal' && restart === 'free' && at[0] > 16)
    const attackU = SHOTS.includes(end) ? 24 + R(3) * 10 : end === 'corner' ? 40 : end === 'out' ? at[0] + 12 : at[0] + 15 + R(4) * 15
    const count = restart === 'corner' || direct ? (restart === 'corner' ? 1 : 0) : clamp(Math.round(len / 3.6), 1, 7)
    for (let i = 0; i < count; i++) {
      const setPiece = restart !== 'play' && i === 0
      if (!setPiece) {
        // He runs with it a little first.
        const d = 0.8 + R(10 + i) * 1.6
        t += d
        pt = [pt[0] + 2 + R(20 + i) * 5, clamp(pt[1] + (R(30 + i) - 0.5) * 6, -31, 31)]
      }
      let to: number
      let b: V
      if (restart === 'corner') {
        to = R(40) > 0.5 ? 9 : 10
        b = [45 + R(41) * 2, (R(42) - 0.5) * 6]
      } else if (restart === 'kickoff' && i === 0) {
        to = R(40) > 0.5 ? 6 : 7
        b = [SLOTS[to][0] + 2, SLOTS[to][1]]
      } else if (restart === 'keeper' && i === 0) {
        to = R(40) > 0.5 ? 2 : 3
        b = [SLOTS[to][0] + 4, SLOTS[to][1] * 1.4]
      } else {
        const goal = lerp(at[0], attackU, (i + 1) / count)
        const choices = [...Array(10)].map((_, k) => k + 1).filter((k) => k !== hold)
        to = choices.reduce((best, k) => {
          const score = Math.abs(SLOTS[k][0] + PUSH[k] - goal) + Math.abs(SLOTS[k][1] - pt[1]) * 0.35 + R(50 + i * 11 + k) * 14
          const bs = Math.abs(SLOTS[best][0] + PUSH[best] - goal) + Math.abs(SLOTS[best][1] - pt[1]) * 0.35 + R(50 + i * 11 + best) * 14
          return score < bs ? k : best
        }, choices[0])
        b = [clamp(SLOTS[to][0] + PUSH[to] + (R(60 + i) - 0.5) * 8, -40, 44), clamp(SLOTS[to][1] * 1.08 + (R(70 + i) - 0.5) * 8, -31, 31)]
        if (end === 'out' && i === count - 1) b = [pt[0] + 6, (pt[1] >= 0 ? 1 : -1) * 37] // overhit, into touch
      }
      const dist = Math.hypot(b[0] - pt[0], b[1] - pt[1])
      const travel = clamp(dist / 17, 0.45, 1.8)
      const loft = restart === 'corner' || restart === 'goalkick' || dist > 28 ? 2.4 + dist * 0.06 : dist > 15 ? 0.6 : 0.15
      passes.push({ t0: t, t1: t + travel, from: hold, to, a: pt, b, loft })
      t += travel
      pt = b
      hold = to
    }
    if (end !== 'out' && end !== 'tackle' && end !== 'foul') t += 0.6 // a touch to set it up

    // Fit the move to its length (or to the goal's second), keeping its rhythm.
    const flight = SHOTS.includes(end) ? 0.9 : end === 'corner' ? 0.7 : 0
    const want = end === 'goal' && g ? g.s - flight : play + Math.max(len, 1.5)
    const k = t > play ? (want - play) / (t - play) : 1
    for (const p of passes) {
      p.t0 = play + (p.t0 - play) * k
      p.t1 = play + (p.t1 - play) * k
    }
    const endT0 = want
    const t1 = endT0 + flight
    const shooter = hold
    let to: V = pt
    let toY = 0.25
    const r = R(80)
    if (end === 'saved') [to, toY] = [[51.3, (r - 0.5) * 4], 1.2]
    if (end === 'wide') [to, toY] = [[56, (r > 0.5 ? 1 : -1) * (4.8 + R(81) * 3)], 0.8]
    if (end === 'over') [to, toY] = [[56, (r - 0.5) * 5], 4.6]
    if (end === 'goal') [to, toY] = [[54, (r - 0.5) * 3.6], 1.1]
    if (end === 'corner') [to, toY] = [[55.5, (pt[1] >= 0 ? 1 : -1) * (9 + R(81) * 8)], 0.6]
    // Yellow cards only: a sending-off would leave a side with ten, which the moves don't play.
    const card: 0 | 1 | 2 = end === 'foul' && R(82) < 0.4 ? 1 : 0
    const injury = end === 'foul' && R(83) < 0.3
    const fouler = end === 'foul' ? nearestSlot([-pt[0], pt[1]], -1, 1) : -1
    const stopFor: Record<End, number> = { saved: 4, wide: 5, over: 5, corner: 4, out: 3, foul: injury ? 32 : 14, tackle: 0, continue: 0, goal: PARTY * 60 + 18, break: COOL_LEN * 60 + 12, half: 0 }
    const m: Move = { team, h, t0: c, play, restart, at, passes, endT0, t1, stop: t1 + stopFor[end], end, from: pt, to, toY, shooter, card, injury, fouler, side }
    if (end === 'break' && cool) m.stop = cool + COOL_LEN * 60 + 12
    out.push(m)

    // What comes next.
    c = m.stop
    const flip = (): -1 | 1 => (team === 1 ? -1 : 1)
    if (end === 'saved') [team, restart, at] = [flip(), 'keeper', [-to[0], to[1]]] // he throws it out from where he caught it
    else if (end === 'wide' || end === 'over') [team, restart, at] = [flip(), 'goalkick', [-46.5, to[1] >= 0 ? -6 : 6]]
    else if (end === 'corner') [restart, at] = ['corner', [52.3, to[1] >= 0 ? 33.8 : -33.8]]
    else if (end === 'out') [team, restart, at] = [flip(), 'throw', [clamp(-to[0], -50, 50), to[1] >= 0 ? 34.3 : -34.3]]
    else if (end === 'foul') [restart, at] = ['free', [...pt]]
    else if (end === 'tackle') [team, restart, at] = [flip(), 'play', [-pt[0], pt[1]]]
    else if (end === 'continue') [restart, at] = ['play', [...pt]]
    else if (end === 'goal') [team, restart, at] = [flip(), 'kickoff', [0, 0]]
    else if (end === 'break') [team, restart, at] = [flip(), 'throw', [clamp(-pt[0], -50, 50), pt[1] >= 0 ? 34.3 : -34.3]]
    else break
  }
  return out
}

/** The outfield slot of a side (1 attacking, -1 defending) standing nearest a point of the attackers' frame. */
function nearestSlot(p: V, sideSign: number, from: number) {
  let best = from
  let bd = Infinity
  for (let j = from; j < 11; j++) {
    const u = sideSign > 0 ? SLOTS[j][0] + PUSH[j] : -(SLOTS[j][0] + DROP[j])
    const d = Math.hypot(u - p[0], SLOTS[j][1] - p[1])
    if (d < bd) [bd, best] = [d, j]
  }
  return best
}

const plans = new Map<number, { goals: { s: number; team: -1 | 1; at: number }[]; halves: Move[][] }>()
export function planOf(e: StadiumEvent) {
  let p = plans.get(e.start)
  if (!p) {
    const goals = [...(e.homeGoals ?? []).map((at) => ({ at, team: -1 as const })), ...(e.awayGoals ?? []).map((at) => ({ at, team: 1 as const }))]
      .sort((a, b) => a.at - b.at)
      .map((g) => ({ ...g, s: g.at * 60 }))
    p = { goals, halves: [buildHalf(e, 1, goals), buildHalf(e, -1, goals)] }
    if (plans.size > 8) plans.clear()
    plans.set(e.start, p)
  }
  return p
}

/** Who scores each goal: the name on the back of the one who shot. */
export function scorerName(e: StadiumEvent, at: number) {
  const p = planOf(e)
  for (const half of p.halves) {
    const m = half.find((x) => x.end === 'goal' && Math.abs(x.t1 - at * 60) < 2)
    if (m) return playerName(m.team === -1 ? e.home ?? '' : e.away ?? '', NUMBERS[m.shooter])
  }
  return null
}

// ——— The frame ———

const T = (): Target => ({ x: 0, z: 0, face: null, pose: 'stand', p: 0, hidden: false, run: 7 })
const faceTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z)
const TUNNEL: V = [0, -42.5]

/** Everything on the pitch at k minutes from the kick-off. */
export function matchFrame(e: StadiumEvent, k: number, out?: Frame): Frame {
  const f: Frame = out ?? { figs: [...Array(NF)].map(T), ball: { x: 0, y: 0.25, z: 0, hidden: true }, warm: [], flag: null, coin: null, card: null, board: null, confetti: 0, pyro: 0, tunnel: false, hype: 0, slot: [] }
  const s = k * 60
  for (const g of f.figs) Object.assign(g, { face: null, pose: 'stand', p: 0, hidden: false, run: 7 })
  Object.assign(f, { flag: null, coin: null, card: null, board: null, confetti: 0, pyro: 0, tunnel: false, hype: 0 })
  f.ball.hidden = true
  f.warm.length = 0
  f.slot = [...Array(22)].map((_, i) => i)
  if (k >= COOL[1] + COOL_LEN - 0.3 && k < 120) {
    f.slot[SUB_SLOT[0]] = SUB[0]
    f.slot[SUB_SLOT[1]] = SUB[1]
  }
  const plan = planOf(e)
  const fig = (i: number) => f.figs[i]
  const set = (i: number, x: number, z: number, pose: Pose = 'stand', p = 0, face: number | null = null, run = 7) => Object.assign(fig(i), { x, z, pose, p, face, run, hidden: false })
  const hide = (i: number) => Object.assign(fig(i), { hidden: true, x: TUNNEL[0], z: TUNNEL[1] - 3 })
  const ballAt = (x: number, y: number, z: number) => Object.assign(f.ball, { x, y, z, hidden: false })

  // The staff on the touchline, most of the time.
  const benches = (calm = true) => {
    for (const [n, c] of COACH.entries()) {
      const sx = n === 0 ? -1 : 1
      const shouting = calm && hash(Math.floor(s / 5) + n * 17) > 0.55
      set(c, sx * 11 + Math.sin(s * 0.23 + n * 2) * 3, -36.6, shouting ? 'shout' : 'hips', s, shouting ? 0 : null, 2)
    }
    set(FOURTH, 0, -36.8, 'stand', 0, 0, 2)
    for (const [n, m] of MEDIC.entries()) set(m, (n === 0 ? -1 : 1) * 19, -38.2, 'stand', 0, 0, 3)
  }

  for (let i = KID; i < KID + 22; i++) hide(i)
  for (let i = BEARER; i < BEARER + 6; i++) hide(i)

  // ——— Before the match ———
  if (k < 0) {
    if (k < -40) {
      for (let i = 0; i < NF; i++) hide(i)
      return f
    }
    benches(false)
    f.tunnel = k >= -9.8
    // The substitutes on the bench.
    SUB.forEach((sub, n) => set(sub, (n === 0 ? -1 : 1) * (11 + 2.4), -39.6, 'bench', 0, 0))
    if (k < -12) warmUp(f, e, k, s, set)
    else if (k < -9.6) {
      // Back to the dressing room; out of sight once through.
      for (let i = 0; i < 25; i++) {
        const gone = k > -11.2 + (i % 11) * 0.05
        if (gone) hide(i)
        else set(i, TUNNEL[0] + ((i % 3) - 1) * 0.8, TUNNEL[1] + 0.5, 'stand', 0, null, 4)
      }
    } else ceremony(f, e, k, s, set, hide)
    return f
  }

  // ——— Half-time ———
  if (k >= HALF && k < SECOND) {
    benches(false)
    f.tunnel = true
    const off = k < HALF + 0.9
    const back = k >= SECOND - 0.9
    for (let i = 0; i < 25; i++) {
      if (off || back) {
        if (off) set(i, TUNNEL[0] + ((i % 3) - 1) * 0.8, TUNNEL[1] + 0.4, 'stand', 0, null, 3.5)
        else {
          // Out again for the second half, to the kick-off.
          const kickTeam: -1 | 1 = hash(e.start * 3.1) > 0.5 ? -1 : 1
          const p = kickoffSpot(i, kickTeam, -1)
          const out = k >= SECOND - 0.9 + (i % 11) * 0.03
          if (out) set(i, p[0], p[1], 'stand', 0, null, 5)
          else hide(i)
        }
        if (off && k > HALF + 0.55 + (i % 11) * 0.03) hide(i)
      } else hide(i)
    }
    SUB.forEach((sub, n) => set(sub, (n === 0 ? -1 : 1) * (11 + 2.4), -39.6, 'bench', 0, 0))
    if (back) ballAt(0, 0.25, 0)
    return f
  }

  // ——— After the final whistle ———
  if (k >= FULL) {
    afterMatch(f, e, k, s, set, hide, plan.goals)
    return f
  }

  // ——— The play ———
  benches()
  const h: 1 | -1 = k < HALF ? 1 : -1
  const moves = plan.halves[h === 1 ? 0 : 1]
  const m = moves.find((x) => s >= x.t0 && s < x.stop) ?? moves[moves.length - 1]
  if (!m) return f
  playMove(f, e, m, s, set, plan.goals)
  officials(f, m, s, set)

  // The substitutes: on the bench, warming up along the track in the second half, on at 75'.
  SUB.forEach((sub, n) => {
    if (f.slot[SUB_SLOT[n]] === sub) return
    const sx = n === 0 ? -1 : 1
    if (k >= 70 && k < COOL[1] + COOL_LEN - 0.3) set(sub, sx * (36 + Math.sin(s * 0.4 + n) * 6), -38.5, 'stand', 0, null, 3.5)
    else set(sub, sx * (11 + 2.4), -39.6, 'bench', 0, 0)
  })
  // The players who came off: a handshake on the line, then the bench.
  if (k >= COOL[1] + COOL_LEN - 0.3) {
    SUB_SLOT.forEach((slot, n) => set(slot, (n === 0 ? -1 : 1) * (11 - 2.6), -39.6, k < COOL[1] + COOL_LEN ? 'shake' : 'bench', 0, 0, 3))
  }
  // Stoppage time: the board goes up at the end of each half.
  if ((k >= 44.0 && k < 44.6) || (k >= 104.0 && k < 104.6)) {
    f.board = k < HALF ? '+2' : '+4'
    set(FOURTH, 0, -35.6, 'board', 0, 0, 2)
  }
  if (k >= COOL[1] + COOL_LEN - 0.9 && k < COOL[1] + COOL_LEN - 0.3) {
    f.board = `${NUMBERS[SUB_SLOT[0] % 11]} ⇄ ${SUB_NUMBERS[0]}`
    set(FOURTH, 0, -35.6, 'board', 0, 0, 2)
  }
  return f
}

/** Where a figure lines up for a kick-off: everyone in his own half, the kicking side's strikers on the spot. */
function kickoffSpot(i: number, kickTeam: -1 | 1, h: number): V {
  if (i === REF) return [-6, 6]
  if (i === AR1) return [-20, -34.8]
  if (i === AR2) return [20, 34.8]
  const team = i < 11 ? -1 : 1
  const j = i % 11
  let [u, v] = SLOTS[j]
  if (team === kickTeam && (j === 9 || j === 10)) [u, v] = [-0.6, j === 9 ? 0.4 : 3]
  else if (team !== kickTeam && Math.abs(v) < 10) u = Math.min(u, -10)
  return [toX(team, h, u), v]
}

function warmUp(f: Frame, _e: StadiumEvent, k: number, s: number, set: (i: number, x: number, z: number, pose?: Pose, p?: number, face?: number | null, run?: number) => void) {
  for (let i = 0; i < 22; i++) {
    const team = i < 11 ? -1 : 1
    const j = i % 11
    const X = (u: number) => toX(team, 1, u)
    if (j === 0) {
      // The keeper: diving one side then the other, the shots coming in.
      const cyc = (s / 2.6 + team) % 2
      const dir = Math.floor(cyc) === 0 ? 1 : -1
      const pp = cyc % 1
      set(i, X(-50), dir * (pp < 0.4 ? 0 : 2.2), pp < 0.4 ? 'gkReady' : 'gkDive', pp < 0.4 ? 0 : (pp - 0.4) / 0.6 * dir, X(0) > X(-50) ? Math.PI / 2 : -Math.PI / 2, 5)
      continue
    }
    if (k < -34) {
      // A slow lap of their half.
      const a = s * 0.18 + j * 0.6
      set(i, X(-25 + Math.cos(a) * 14), Math.sin(a) * 18, 'stand', 0, null, 3.2)
    } else if (k < -24) {
      // Passing in pairs, ten metres apart.
      const pair = Math.floor((j - 1) / 2)
      const left = (j - 1) % 2 === 0
      const u = -38 + pair * 6
      const z = left ? -6 : 6
      const cyc = (s / 2.4 + pair * 0.37) % 2
      const mine = left ? cyc < 1 : cyc >= 1
      const pp = cyc % 1
      set(i, X(u), z, mine && pp < 0.25 ? 'kick' : 'stand', pp / 0.25, left ? 0 : Math.PI, 3)
      if (left) {
        const from = cyc < 1 ? -6 : 6
        const to = -from
        const w = clamp((pp - 0.1) / 0.6, 0, 1)
        f.warm.push({ x: X(u) + (team === -1 ? 0.4 : -0.4), y: 0.25, z: from + (to - from) * w * 0.9 + (from < 0 ? 0.6 : -0.6) })
      }
    } else if (k < -16) {
      // Sprints: out to the halfway line and back.
      const go = Math.floor((s + j * 0.7) / 6) % 2 === 0
      set(i, X(go ? -6 : -36), -22 + j * 4, 'stand', 0, null, go ? 8 : 3)
    } else {
      // Stretching in a circle.
      const a = (j / 10) * Math.PI * 2
      const cx = X(-24)
      set(i, cx + Math.cos(a) * 6, Math.sin(a) * 6, j % 3 === 0 ? 'kneesUp' : 'stretch', Math.floor((s / 8 + j) % 3), faceTo(cx + Math.cos(a) * 6, Math.sin(a) * 6, cx, 0), 2)
    }
  }
  // The referees warm up along the halfway line.
  for (const [n, i] of [REF, AR1, AR2].entries()) set(i, Math.sin(s * 0.2 + n) * 3, -20 + n * 3 + Math.cos(s * 0.2) * 12, 'stand', 0, null, 3)
}

function ceremony(f: Frame, e: StadiumEvent, k: number, s: number, set: (i: number, x: number, z: number, pose?: Pose, p?: number, face?: number | null, run?: number) => void, hide: (i: number) => void) {
  const STAND = 0 // facing the far stand, the cameras behind them
  const lineX = (i: number) => (i < 11 ? -1 : 1) * (3 + (i % 11) * 1.5)
  f.hype = k < -8 ? 1 : k < -6.6 ? 0.2 : 0.5
  // The big flag: carried out first, waved in the centre circle during the anthem, then away.
  if (k < -6) {
    const out = ease((k + 9.6) / 1.0)
    const z = k < -8.6 ? lerp(-40, -6, out) : k < -6.6 ? -6 : lerp(-6, -40, ease((k + 6.6) / 0.6))
    f.flag = { x: 0, z, y: 1.9 }
    for (let n = 0; n < 6; n++) {
      const bx = (n % 3 - 1) * 5
      const bz = z + (n < 3 ? -3.2 : 3.2)
      if (k > -6.1 && n > 1) hide(BEARER + n)
      else set(BEARER + n, bx, bz, 'carry', s, n < 3 ? 0 : Math.PI, 3)
    }
  }
  if (k >= -9.4 && k < -7.6) f.confetti = 1 - ease((k + 8.2) / 0.6)
  if (k >= -9.2 && k < -8.4) f.pyro = 1
  // The officials lead the teams out, then line up in the middle.
  const walkOut = (k + 9.0) / 0.75 // 0 → 1: the front of the columns from the tunnel to the line
  for (const [n, i] of [REF, AR1, AR2, FOURTH].entries()) {
    if (k < -9.05) {
      hide(i)
      continue
    }
    if (k < -6.0) {
      const front = lerp(-42, -31, ease(walkOut))
      set(i, (n - 1.5) * 1.2, k < -8.25 ? front + 1.5 : -31, k >= -8.0 && k < -6.6 ? 'heart' : 'stand', 0, k >= -8.25 ? STAND : null, 1.8)
    } else if (i === REF && k >= -3.6 && k < -2.8) set(i, 0, 0, k >= -3.3 && k < -3.15 ? 'toss' : 'stand', 0, 0, 3)
    else if (i === FOURTH) set(i, 0, -36.8, 'stand', 0, 0, 2)
    else set(i, ...(kickoffSpot(i, 1, 1) as [number, number]), 'stand', 0, null, 3)
  }
  for (let i = 0; i < 22; i++) {
    const team = i < 11 ? -1 : 1
    const j = i % 11
    const kidI = KID + i
    if (k < -6.0) {
      // Out of the tunnel two by two, each with his escort kid, then along the line.
      const front = lerp(-42, -31, ease(walkOut))
      const zCol = front - j * 1.4
      if (zCol < -41.6 || k < -9.05) {
        fig(f, i).hidden = true
        fig(f, kidI).hidden = true
        Object.assign(fig(f, i), { x: team * 1.3, z: -43 })
        Object.assign(fig(f, kidI), { x: team * 2.0, z: -43 })
        continue
      }
      const lined = k >= -8.25
      const x = lined ? lineX(i) : team * 1.3
      const z = lined ? -31 : zCol
      const anthem = k >= -8.0 && k < -6.6
      set(i, x, z, anthem ? 'heart' : lined && k >= -6.6 ? 'wave' : 'stand', s, lined ? STAND : null, lined ? 1.6 : 1.5)
      // The kid at his side on the way out, in front of him for the anthem, then back to the tunnel.
      if (k < -6.6) set(kidI, lined ? x : x + team * 0.75, lined ? z + 0.9 : z, anthem ? 'heart' : 'kid', 0, lined ? STAND : null, 1.6)
      else if (k < -6.1) set(kidI, 0, -42, 'stand', 0, null, 3)
      else hide(kidI)
    } else if (k < -4.8) {
      // The handshakes: the away side files along the home line, then everyone shakes the referees' hands.
      const w = (k + 6.0) / 1.2
      if (team === -1) {
        const near = Math.abs(lineX(i) - (3 + 0 * 1.5 - w * 34) - 0) < 34 && [...Array(11)].some((_, q) => Math.abs(3 + q * 1.5 - w * 34 - lineX(i)) < 0.8)
        set(i, lineX(i), -31, near ? 'shake' : 'stand', 0, STAND, 1.5)
      } else {
        const x = 3 + j * 1.5 - w * 34
        const near = [...Array(11)].some((_, q) => Math.abs(lineX(q) - x) < 0.8)
        set(i, x, -29.8, near ? 'shake' : 'stand', 0, x < -22 ? null : -Math.PI / 2 + 0.6, 1.6)
      }
    } else if (k < -3.6) {
      // The team photo, in their own half: six standing, five crouching, the photographers in front.
      const cx = toX(team, 1, -18)
      const back = j < 6
      const pos = back ? j : j - 6
      const x = cx + (pos - (back ? 2.5 : 2)) * 0.95
      set(i, x, back ? -21 : -22.1, back ? 'photoBack' : 'photoFront', 0, Math.PI, 3)
    } else if (k < -2.8) {
      // The captains at the coin toss; the others loosen up in their half.
      if (j === CAPTAIN) set(i, team * 1.4, 0, k >= -3.15 ? 'shake' : 'stand', 0, team < 0 ? Math.PI / 2 : -Math.PI / 2, 3)
      else set(i, toX(team, 1, -14 + (j % 4) * 3), -9 + Math.floor(j / 4) * 6, 'kneesUp', 0, null, 3)
    } else if (k < -1.9) {
      // The huddle: arms round each other, heads in, a last word.
      const a = (j / 11) * Math.PI * 2
      const cx = toX(team, 1, -16)
      const x = cx + Math.cos(a) * 2.1
      const z = Math.sin(a) * 2.1
      set(i, x, z, 'huddle', s, faceTo(x, z, cx, 0), 3.5)
    } else {
      const kickTeam: -1 | 1 = hash(e.start * 3.1) > 0.5 ? 1 : -1
      const [x, z] = kickoffSpot(i, kickTeam, 1)
      set(i, x, z, 'stand', 0, null, 5)
    }
  }
  // The photographers.
  if (k >= -4.8 && k < -3.6) {
    for (let n = 0; n < 6; n++) {
      const team = n < 3 ? -1 : 1
      set(BEARER + n, toX(team, 1, -18) + ((n % 3) - 1) * 2.2, -28, 'camera', s + n, 0, 4)
    }
  }
  if (k >= -3.3 && k < -3.0) {
    const u = (k + 3.3) / 0.3
    f.coin = { x: 0.3, y: 2.2 + Math.sin(u * Math.PI) * 2.5, z: 0.2 }
  }
  if (k >= -1.9) Object.assign(f.ball, { x: 0, y: 0.25, z: 0, hidden: false })
}

function fig(f: Frame, i: number) {
  return f.figs[i]
}

function afterMatch(f: Frame, _e: StadiumEvent, k: number, s: number, set: (i: number, x: number, z: number, pose?: Pose, p?: number, face?: number | null, run?: number) => void, hide: (i: number) => void, goals: { team: number }[]) {
  const hs = goals.filter((g) => g.team === -1).length
  const as = goals.length - hs
  const won = hs === as ? 0 : hs > as ? -1 : 1
  f.tunnel = k >= 110
  for (const [n, c] of COACH.entries()) {
    const side = n === 0 ? -1 : 1
    set(c, side * 9, -36.4, won === side ? 'jump' : won === 0 ? 'clap' : 'despair', s, 0, 2)
  }
  set(FOURTH, 0, -36.8, 'stand', 0, 0, 2)
  MEDIC.forEach((m, n) => set(m, (n === 0 ? -1 : 1) * 19, -38.2, 'stand', 0, 0, 3))
  for (let i = 0; i < 25; i++) {
    if (i >= 22) {
      if (k < 111) set(i, (i - 23) * 3, -2, k < FULL + 0.15 && i === REF ? 'whistle' : 'stand', 0, null, 2)
      else if (k < 113) set(i, TUNNEL[0], TUNNEL[1] + 0.5, 'stand', 0, null, 3)
      else hide(i)
      continue
    }
    const team = i < 11 ? -1 : 1
    const fi = i === SUB_SLOT[0] ? SUB[0] : i === SUB_SLOT[1] ? SUB[1] : i
    if (fi !== i) hide(i)
    if (k < 108.5) {
      if (team === won) {
        const a = i * 2.4
        set(fi, Math.sin(a) * 5, Math.cos(a) * 5, 'party', i % 3, null, 6)
      } else if (won === 0) set(fi, toX(team, -1, -10 - (i % 11)), (i % 11) * 3 - 15, 'clap', s, null, 2)
      else set(fi, toX(team, -1, -6 - (i % 11) * 2.5), (i % 5) * 6 - 12, 'sit', 0, null, 3)
    } else if (k < 111.5) {
      // The lap of honour along the touchlines, waving at the stands.
      const a = (s - 108.5 * 60) * 0.035 + (i / 22) * 1.4
      const x = Math.cos(a) * 46
      const z = Math.sin(a) * 30 - 2
      set(fi, x, z, 'wave', s + i, null, 2.2)
    } else if (k < 113.5) set(fi, TUNNEL[0] + ((i % 3) - 1) * 0.8, TUNNEL[1] + 0.5, 'stand', 0, null, 3)
    else hide(fi)
  }
  SUB.forEach((sub) => {
    if (k >= 113.5) hide(sub)
  })
}

/** The ball, and who has it, at second s of move m. */
function ballOf(m: Move, s: number) {
  const W = (v: V): [number, number] => [toX(m.team, m.h, v[0]), v[1]]
  if (s < m.play) {
    const [x, z] = W(m.at)
    const y = m.restart === 'throw' ? 2.75 : m.restart === 'keeper' ? 1.4 : 0.25
    return { x, y, z, holder: m.restart === 'kickoff' ? 9 : -1, pass: null as Pass | null, phase: 'setup' as const }
  }
  for (const p of m.passes) {
    if (s < p.t0) {
      // Running with it from where the last pass landed.
      const prev = m.passes[m.passes.indexOf(p) - 1]
      const from = prev ? prev.b : m.at
      const span = p.t0 - (prev ? prev.t1 : m.play)
      const u = span > 0 ? clamp((s - (prev ? prev.t1 : m.play)) / span, 0, 1) : 1
      const [x, z] = W([lerp(from[0], p.a[0], u), lerp(from[1], p.a[1], u)])
      return { x, y: 0.25, z, holder: p.from, pass: null, phase: 'dribble' as const }
    }
    if (s < p.t1) {
      const u = (s - p.t0) / (p.t1 - p.t0)
      const [x, z] = W([lerp(p.a[0], p.b[0], u), lerp(p.a[1], p.b[1], u)])
      return { x, y: 0.25 + Math.sin(u * Math.PI) * p.loft, z, holder: -1, pass: p, phase: 'pass' as const }
    }
  }
  const last = m.passes[m.passes.length - 1]
  if (s < m.endT0) {
    const from = last ? last.b : m.at
    const span = m.endT0 - (last ? last.t1 : m.play)
    const u = span > 0 ? clamp((s - (last ? last.t1 : m.play)) / span, 0, 1) : 1
    const [x, z] = W([lerp(from[0], m.from[0], u), lerp(from[1], m.from[1], u)])
    return { x, y: 0.25, z, holder: m.shooter, pass: null, phase: 'dribble' as const }
  }
  if (s < m.t1) {
    const u = (s - m.endT0) / (m.t1 - m.endT0)
    const [x, z] = W([lerp(m.from[0], m.to[0], u), lerp(m.from[1], m.to[1], u)])
    const y = lerp(m.restart === 'corner' && !m.passes.length ? 0.25 : m.restart === 'corner' ? 2.2 : 0.25, m.toY, u) + Math.sin(u * Math.PI) * (m.end === 'over' ? 2.5 : 0.8)
    return { x, y, z, holder: -1, pass: null, phase: 'end' as const }
  }
  const [x, z] = W(m.to)
  return { x, y: m.end === 'saved' ? 1.4 : m.end === 'goal' ? 1.1 : 0.25, z, holder: -1, pass: null, phase: 'dead' as const }
}

function playMove(f: Frame, e: StadiumEvent, m: Move, s: number, set: (i: number, x: number, z: number, pose?: Pose, p?: number, face?: number | null, run?: number) => void, goals: { s: number; team: number }[]) {
  const h = m.h
  const b = ballOf(m, s)
  Object.assign(f.ball, { x: b.x, y: b.y, z: b.z, hidden: false })
  const att = m.team
  const def = -att as -1 | 1
  const bu = fromX(att, h, b.x) // the ball in the attackers' frame
  const bv = b.z
  const W = (team: number, u: number, v: number): [number, number] => [toX(team, h, u), v]
  const figOf = (team: number, j: number) => f.slot[(team === -1 ? 0 : 11) + j]
  const dead = s >= m.t1
  const since = s - m.t1
  const kick = (team: number, j: number, p: number) => {
    const g = f.figs[figOf(team, j)]
    g.pose = 'kick'
    g.p = p
  }

  // The defenders: compact, sliding with the ball; the two nearest go to press.
  const press = [...Array(10)].map((_, q) => q + 1).sort((a, c) => {
    const pa = Math.hypot(-(SLOTS[a][0] + DROP[a]) - bu, SLOTS[a][1] - bv)
    const pc = Math.hypot(-(SLOTS[c][0] + DROP[c]) - bu, SLOTS[c][1] - bv)
    return pa - pc
  })
  for (let j = 0; j < 11; j++) {
    const i = figOf(def, j)
    const du = -bu
    let u: number
    let v: number
    if (j === 0) {
      u = -49 + clamp((du + 52) * 0.05, 0, 4)
      v = clamp(bv * 0.12, -3, 3)
    } else {
      u = SLOTS[j][0] + DROP[j]
      v = SLOTS[j][1] * 0.82
      u += (du - u) * 0.32
      v += (bv - v) * 0.33
      if (j === press[0]) [u, v] = [du - 2.2, bv]
      else if (j === press[1]) [u, v] = [du - 7, bv * 0.7]
      u = clamp(u, -50, 48)
      v = clamp(v, -33, 33)
    }
    const [x, z] = W(def, u, v)
    set(i, x, z, j === 0 && Math.abs(du + 49) < 30 ? 'gkReady' : 'stand', 0, faceTo(x, z, b.x, b.z), j === press[0] ? 7.5 : 6.5)
  }
  // The attackers: pushed up and spread out, the receiver running to meet the pass.
  for (let j = 0; j < 11; j++) {
    const i = figOf(att, j)
    let u: number
    let v: number
    if (j === 0) {
      u = -48 + clamp((bu + 52) * 0.08, 0, 8)
      v = clamp(bv * 0.08, -3, 3)
    } else {
      u = SLOTS[j][0] + PUSH[j]
      v = SLOTS[j][1] * 1.1
      u += (bu - u) * 0.22 + Math.sin(s * 0.31 + j) * 2.5
      v += (bv - v) * 0.15 + Math.cos(s * 0.27 + j) * 2
    }
    let run = 6.5
    // Stay on the pitch, short of the keeper's line.
    let [x, z] = W(att, j === 0 ? u : clamp(u, -50, 47), clamp(v, -33, 33))
    if (b.pass && b.pass.to === j) {
      ;[x, z] = W(att, b.pass.b[0], b.pass.b[1])
      run = 8.5
    }
    if (b.holder === j && b.phase !== 'setup') {
      // On the ball: just behind it, carrying it forward.
      const [hx, hz] = W(att, bu - 0.6, bv)
      ;[x, z] = [hx, hz]
      run = 9
    }
    set(i, x, z, 'stand', 0, faceTo(x, z, b.x, b.z), run)
  }
  // The passer's kick, the header at the end of a long ball.
  for (const p of m.passes) {
    if (s >= p.t0 - 0.25 && s < p.t0 + 0.2) kick(att, p.from, (s - p.t0 + 0.25) / 0.45)
    if (p.loft > 2 && s >= p.t1 - 0.35 && s < p.t1 + 0.25) {
      const g = f.figs[figOf(att, p.to)]
      g.pose = 'header'
      g.p = (s - p.t1 + 0.35) / 0.6
    }
  }

  // The restarts: everyone in place before it is taken.
  // Corners and free kicks at goal keep their shape until the header or the shot.
  const held = m.restart === 'corner' || (m.restart === 'free' && m.at[0] > 16) ? m.t1 + 0.8 : m.play + 0.4
  if (s < held) setPiece(f, m, s, set, figOf, W)

  // The ending.
  const shooter = figOf(att, m.shooter)
  const keeper = figOf(def, 0)
  if (SHOTS.includes(m.end) && s >= m.endT0 - 0.3 && s < m.endT0 + 0.3) {
    const g = f.figs[shooter]
    g.pose = m.restart === 'corner' ? 'header' : 'kick'
    g.p = (s - m.endT0 + 0.3) / 0.6
  }
  if (SHOTS.includes(m.end) && s >= m.endT0 && s < m.t1 + 1.2) {
    // The keeper goes across: to the ball when he saves it, too late when it goes in.
    const g = f.figs[keeper]
    const [kx] = W(def, -50.5, 0)
    const reach = m.end === 'goal' || m.end === 'saved' ? m.to[1] : m.to[1] * 0.5
    g.x = kx
    g.z = clamp(reach, -3.6, 3.6)
    g.run = 9
    if (m.end === 'saved' && s >= m.t1) Object.assign(g, { pose: 'gkHold', p: 0 })
    else Object.assign(g, { pose: 'gkDive', p: clamp((s - m.endT0) / (m.t1 - m.endT0 + 0.4), 0, 1) * (reach >= 0 ? 1 : -1) })
  }
  if (dead) {
    if (m.end === 'saved') {
      // The ball in his arms where he caught it.
      const [x, z] = W(att, m.to[0] - 0.35, m.to[1])
      Object.assign(f.figs[keeper], { x, z, pose: 'gkHold', p: 0 })
    }
    if ((m.end === 'wide' || m.end === 'over') && since < 3) {
      Object.assign(f.figs[keeper], { pose: 'point', p: 0 })
      Object.assign(f.figs[shooter], { pose: 'despair', p: 0 })
    }
    if (m.end === 'foul') foul(f, m, s, set, figOf, W)
    if (m.end === 'goal') celebrate(f, e, m, s, set, figOf, W, goals)
    if (m.end === 'break') coolingBreak(f, m, s, set)
  }
}

function setPiece(f: Frame, m: Move, s: number, _set: (i: number, x: number, z: number, pose?: Pose, p?: number, face?: number | null, run?: number) => void, figOf: (team: number, j: number) => number, W: (team: number, u: number, v: number) => [number, number]) {
  const att = m.team
  const def = -att as -1 | 1
  const [ax, az] = W(att, m.at[0], m.at[1])
  const u = (s - m.play + 0.6) / 0.6 // the taker's swing
  const taker = (j: number, pose: Pose, back = 0.7) => {
    const g = f.figs[figOf(att, j)]
    const dir = Math.sign(toX(att, m.h, 1))
    Object.assign(g, { x: ax - dir * back, z: az, pose, p: pose === 'throwin' ? (s < m.play ? -1 : u) : u, face: faceTo(ax - dir * back, az, ax + dir * 10, 0), run: 4 })
  }
  if (m.restart === 'kickoff') {
    for (let i = 0; i < 25; i++) {
      if (i >= 22) continue
      const team = i < 11 ? -1 : 1
      const j = i % 11
      const g = f.figs[figOf(team, j)]
      const [x, z] = kickoffSpot(i, att, m.h)
      Object.assign(g, { x, z, run: 5 })
    }
    if (s >= m.play - 0.3) taker(9, 'kick', 0.5)
  } else if (m.restart === 'throw') {
    const j = m.passes[0]?.from ?? 1
    const g = f.figs[figOf(att, j)]
    Object.assign(g, { x: ax, z: az + Math.sign(az) * 0.3, pose: 'throwin', p: s < m.play ? -1 : clamp((s - m.play + 0.4) / 0.6, 0, 1), face: Math.sign(az) > 0 ? Math.PI : 0, run: 5 })
  } else if (m.restart === 'goalkick' || m.restart === 'keeper') {
    const g = f.figs[figOf(att, 0)]
    Object.assign(g, { x: ax, z: az, pose: m.restart === 'keeper' ? (s < m.play - 0.4 ? 'gkHold' : 'gkThrow') : s < m.play - 0.3 ? 'stand' : 'kick', p: m.restart === 'keeper' ? clamp((s - m.play + 0.4) / 0.6, 0, 1) : u, face: faceTo(ax, az, 0, 0), run: 4 })
  } else if (m.restart === 'corner') {
    taker(m.at[1] < 0 ? 5 : 8, s < m.play - 0.3 ? 'stand' : 'kick', 0.6)
    // Attackers into the box, defenders marking them, the keeper on his line.
    ;[2, 3, 6, 7, 9, 10].forEach((j, n) => {
      const g = f.figs[figOf(att, j)]
      const [x, z] = W(att, 44 + (n % 3) * 2, -5 + n * 2)
      Object.assign(g, { x, z, run: 6 })
      const d = f.figs[figOf(def, [2, 3, 6, 7, 1, 4][n])]
      const [dx, dz] = W(att, 45.5 + (n % 3) * 2, -5 + n * 2 + 0.8)
      Object.assign(d, { x: dx, z: dz, run: 6 })
    })
  } else if (m.restart === 'free') {
    taker(m.passes[0]?.from ?? m.shooter, s < m.play - 0.3 ? 'stand' : 'kick', 0.8)
    if (m.at[0] > 16) {
      // The wall, 9.15 m off, hands down in front.
      const gx = 52.5
      const du = gx - m.at[0]
      const dv = -m.at[1]
      const d = Math.hypot(du, dv) || 1
      const [cu, cv] = [m.at[0] + (du / d) * 9.15, m.at[1] + (dv / d) * 9.15]
      ;[2, 3, 6, 7].forEach((j, n) => {
        const g = f.figs[figOf(def, j)]
        const off = (n - 1.5) * 0.7
        const [x, z] = W(att, cu + (-dv / d) * off, cv + (du / d) * off)
        Object.assign(g, { x, z, pose: 'wall', face: faceTo(x, z, ax, az), run: 5 })
      })
    }
  }
}

function foul(f: Frame, m: Move, s: number, _set: (i: number, x: number, z: number, pose?: Pose, p?: number, face?: number | null, run?: number) => void, figOf: (team: number, j: number) => number, W: (team: number, u: number, v: number) => [number, number]) {
  const since = s - m.t1
  const len = m.stop - m.t1
  const victim = figOf(m.team, m.shooter)
  const fouler = figOf(-m.team, m.fouler)
  const [x, z] = W(m.team, m.from[0], m.from[1])
  const up = since > len - 5
  Object.assign(f.figs[victim], { x, z, pose: up ? 'stand' : 'down', p: since, run: 2 })
  if (since < 7) Object.assign(f.figs[fouler], { x: x + 1.6, z: z + 1, pose: 'protest', p: since, face: faceTo(x + 1.6, z + 1, x - 4, z + 3), run: 3 })
  // The referee comes over; the card, if there is one.
  const r = f.figs[REF]
  Object.assign(r, { x: x - 2.5, z: z + 2.5, face: faceTo(x - 2.5, z + 2.5, x + 1.6, z + 1), run: 6 })
  if (since < 2) r.pose = 'whistle'
  else if (m.card && since > 3 && since < 9) {
    r.pose = 'card'
    f.card = m.card === 2 ? 'red' : 'yellow'
  }
  // Hurt: the medics run on.
  if (m.injury && since > 4 && since < len - 6) MEDIC.forEach((md, n) => Object.assign(f.figs[md], { x: x + (n ? 0.9 : -0.9), z: z + 0.6, pose: 'treat', p: since, face: faceTo(x + (n ? 0.9 : -0.9), z + 0.6, x, z), run: 6 }))
}

function celebrate(f: Frame, _e: StadiumEvent, m: Move, s: number, set: (i: number, x: number, z: number, pose?: Pose, p?: number, face?: number | null, run?: number) => void, figOf: (team: number, j: number) => number, W: (team: number, u: number, v: number) => [number, number], _goals: { s: number; team: number }[]) {
  const since = s - m.t1
  const party = PARTY * 60
  const att = m.team
  const def = -att as -1 | 1
  const corner = W(att, 50.5, (m.to[1] >= 0 ? 1 : -1) * 30.5)
  const back = since > party // walking back for the kick-off
  for (let j = 0; j < 11; j++) {
    const i = figOf(att, j)
    if (j === 0) {
      // The keeper celebrates at his end.
      const [x, z] = W(att, -46, 0)
      set(i, x, z, back ? 'stand' : 'jump', s, null, 4)
      continue
    }
    if (back) continue
    const a = j * 2.1
    const x = corner[0] + Math.sin(a) * 2.4
    const z = corner[1] + Math.cos(a) * 2.4 * -Math.sign(corner[1])
    const scorer = j === m.shooter
    set(i, scorer ? corner[0] : x, scorer ? corner[1] : z, scorer && since < 7 ? 'slide' : 'party', scorer ? 0 : j % 4, null, 8.5)
  }
  for (let j = 0; j < 11; j++) {
    const i = figOf(def, j)
    if (back) continue
    if (j === 0) {
      const g = f.figs[i]
      g.pose = since < 12 ? 'down' : since < 35 ? 'knees' : 'stand'
      g.p = (m.to[1] >= 0 ? 1 : -1) * 10
      continue
    }
    const [x, z] = W(def, SLOTS[j][0] * 0.5 - 4, SLOTS[j][1] * 0.7)
    set(i, x, z, 'hips', 0, null, 1.6)
  }
  if (since < 10) Object.assign(f.figs[REF], { x: W(att, 30, 0)[0], z: 6, pose: 'point', face: faceTo(W(att, 30, 0)[0], 6, 0, 0), run: 4 })
  // The benches.
  COACH.forEach((c, n) => {
    const side = n === 0 ? -1 : 1
    if (!back) Object.assign(f.figs[c], { pose: side === att ? 'jump' : 'despair', p: s })
  })
}

function coolingBreak(f: Frame, m: Move, s: number, set: (i: number, x: number, z: number, pose?: Pose, p?: number, face?: number | null, run?: number) => void) {
  // The pause fraîcheur: each side by its bench, drinking, the coach with his board.
  const end = m.stop - 12
  if (s > end) return
  for (let i = 0; i < 22; i++) {
    const team = i < 11 ? -1 : 1
    const j = i % 11
    const fi = f.slot[i]
    const x = team * 11 + ((j % 6) - 2.5) * 1.4
    const z = -33.2 + Math.floor(j / 6) * 1.5
    set(fi, x, z, (s * 0.3 + j) % 3 < 1.4 ? 'drink' : 'stand', s, faceTo(x, z, team * 11, -36), 3)
  }
  COACH.forEach((c, n) => set(c, (n === 0 ? -1 : 1) * 11, -35.2, 'tactics', s, 0, 2))
  set(REF, -1.2, 0, 'drink', s, null, 2)
  set(AR1, 0.4, -1, 'stand', 0, null, 2)
  set(AR2, 1.6, 0.6, 'drink', s + 2, null, 2)
}

function officials(f: Frame, m: Move, s: number, set: (i: number, x: number, z: number, pose?: Pose, p?: number, face?: number | null, run?: number) => void) {
  const bx = f.ball.x
  const bz = f.ball.z
  // The referee keeps the play in sight from a diagonal, a few strides off.
  const r = f.figs[REF]
  if (r.pose === 'stand' && !(s >= m.t1 && (m.end === 'foul' || m.end === 'goal' || m.end === 'break'))) {
    const x = clamp(bx - 9, -42, 42)
    const z = clamp(bz + 8, -28, 28)
    set(REF, x, z, s >= m.play - 0.6 && s < m.play + 0.4 && m.restart !== 'play' ? 'whistle' : 'stand', 0, faceTo(x, z, bx, bz), 6.5)
  }
  // The assistants run their line, level with the play in their half; the flag goes up when the ball goes out.
  const out = s >= m.t1 && s < m.t1 + 3 && (m.end === 'out' || m.end === 'wide' || m.end === 'over' || m.end === 'corner')
  if (f.figs[AR1].pose === 'stand' || f.figs[AR1].pose === 'flag') set(AR1, clamp(bx, -50, -1), -34.9, out && bx < 0 ? 'flag' : 'stand', 0, 0, 6)
  if (f.figs[AR2].pose === 'stand' || f.figs[AR2].pose === 'flag') set(AR2, clamp(bx, 1, 50), 34.9, out && bx >= 0 ? 'flag' : 'stand', 0, Math.PI, 6)
}

/** What the scoreboard's clock reads. */
export function clockText(k: number) {
  if (k < 0) return tr('Bientôt')
  if (k >= FULL) return tr('Terminé')
  if (k >= HALF && k < SECOND) return 'Mi-temps'
  if (COOL.some((c) => k >= c && k < c + COOL_LEN)) return tr('Pause fraîcheur')
  const min = Math.floor(k < HALF ? k : k - 15) + 1
  if (k >= 44 && k < HALF) return `45' +${Math.floor(k - 44) + 1}`
  if (k >= 104 && k < FULL) return `90' +${Math.floor((k - 104) * 4) + 1}`
  return `${min}'`
}

/** What the stadium announcer says, apart from the goals. */
export function announce(e: StadiumEvent, k: number): string | null {
  if (k >= -9.4 && k < -8.4) return tr('Les équipes entrent sur le terrain !')
  if (k >= -8.0 && k < -7.2) return tr("L'hymne national")
  if (k >= -0.1 && k < 0.15) return tr('Coup d’envoi !')
  if (k >= SECOND - 0.05 && k < SECOND + 0.15) return tr('Coup d’envoi de la seconde période !')
  if (COOL.some((c) => k >= c && k < c + 0.4)) return tr('Pause fraîcheur')
  if (k >= COOL[1] + COOL_LEN - 0.9 && k < COOL[1] + COOL_LEN - 0.3) return tr('Changement : {0} remplace {1}', { 0: playerName(e.home ?? '', SUB_NUMBERS[0]), 1: playerName(e.home ?? '', NUMBERS[SUB_SLOT[0] % 11]) })
  if (k >= 44.0 && k < 44.6) return tr('2 minutes de temps additionnel')
  if (k >= 104.0 && k < 104.6) return tr('4 minutes de temps additionnel')
  if (k >= FULL && k < FULL + 0.5) return tr('Coup de sifflet final !')
  // A card.
  const plan = planOf(e)
  for (const half of plan.halves)
    for (const m of half) {
      if (m.end !== 'foul' || !m.card) continue
      const since = k * 60 - m.t1
      if (since > 3 && since < 9) {
        const team = -m.team
        const club = team === -1 ? e.home ?? '' : e.away ?? ''
        return tr('Carton {0} pour {1}', { 0: m.card === 2 ? 'rouge' : 'jaune', 1: playerName(club, NUMBERS[m.fouler]) })
      }
    }
  return null
}

/** How the crowd feels apart from the goals: up for the walk-out, still for the anthem. */
export function hypeAt(k: number) {
  if (k >= -9.4 && k < -8.0) return 1
  if (k >= -8.0 && k < -6.6) return 0
  if (k >= FULL && k < FULL + 3) return 0.9
  return -1
}
