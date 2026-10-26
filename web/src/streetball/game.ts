import type { Pose } from '../avatar/Human'

// The street match the player plays, as a little physics: a 3 against 3 on a
// half-court under one basket, or a 5 against 5 on a fenced maracana. The
// player runs their own Sim (the stick or the arrows) and has four moves:
// Passe, Tir (near the ring with a run-up: a dunk), Crochet (a crossover, a
// cut that leaves the man in front on the floor) and Défense (going for the
// ball: a steal, a tackle, a slide tackle at full speed). Team-mates and
// opponents play by themselves: the one with the ball drives, passes, shoots
// and beats his man; the others find space, guard their man, press, block,
// go up for the rebounds; the keeper follows the ball and dives.
//
// x across the screen (right +), z towards the camera. Basketball: the ring
// at HOOP, everyone attacks it. Football: team 0 (the player's) attacks +x.
//
// Football also comes as the console's game, « à la FIFA » (Rules): eleven a
// side on a lined pitch (throw-ins, corners, goal kicks) or the five-a-side
// maracana; a referee who gives fouls, free kicks, penalties and cards; the
// player switching to whichever team-mate the play needs, sprinting on a
// stamina bar, playing through balls and lobs, heading crosses, and holding
// Tir to choose the power. The street and the courts keep their own rules.

export type Sport = 'basket' | 'foot'
type V = [number, number]

/** The player's hands: the stick (x right, z down the screen), and the buttons, each a press. */
export type Input = {
  mx: number
  mz: number
  pass: boolean
  shoot: boolean
  skill: boolean
  defend: boolean
  /** Défense held: low in the stance. */
  guard: boolean
  /** Football, held: sprinting (it costs stamina). */
  sprint?: boolean
  /** Football, presses: the through ball, the lob (a cross from the wing), changing player. */
  through?: boolean
  lob?: boolean
  swap?: boolean
  /** Football, Tir held: the shot's power grows until it's let go. Where the hands can hold it (the keys, a pad, the touch button), `shoot` alone is no longer a shot. */
  charge?: boolean
}
export const NO_INPUT: Input = { mx: 0, mz: 0, pass: false, shoot: false, skill: false, defend: false, guard: false }

/** Seconds of play, and of the 3-2-1 before. */
export const LENGTH = 180
export const COUNTDOWN = 3

/* ---------- The ground ---------- */

/** The half-court: the ring's centre, its height, the arc (2 points past it, street rules), the board, the lines, the fence. */
export const HOOP: V = [0, -5.625]
export const RIM_Y = 3.05
export const ARC = 6
export const BOARD_Z = -6.0
export const COURT = { x: 7.5, z0: -7.2, z1: 6.8 }
const COURT_FENCE = { x: 8.6, z0: -8.3, z1: 8.0 }
/**
 * A football ground: half its length and width, the goal's half-mouth and its
 * bar, the penalty box (depth from the goal line, half-width) and the spot,
 * and whether boards run round it (the maracana: the ball comes back off
 * them) or lines (the stadium: out is a throw-in, a corner, a goal kick).
 */
export type Field = { x: number; z: number; mouth: number; bar: number; box: V; spot: number; walls: boolean; /** How far the wall stands at a free kick. */ wall: number }
/** The five-a-side maracana and the stadium's pitch (a real one's proportions, a little smaller so the eleven reach each other). */
export const FIELDS: Record<5 | 11, Field> = {
  5: { x: 18, z: 10.5, mouth: 1.6, bar: 2, box: [6, 5], spot: 6, walls: true, wall: 4 },
  11: { x: 46, z: 30, mouth: 3.4, bar: 2.44, box: [14.5, 17.5], spot: 10, walls: false, wall: 8 },
}
/** The maracana's, as before the stadium (the street, the courts). */
export const PITCH = FIELDS[5]
export const MOUTH = PITCH.mouth
export const BAR = PITCH.bar
const BALL_R = { basket: 0.12, foot: 0.11 }

/* ---------- Who's on it ---------- */

export type Act = 'none' | 'pass' | 'shoot' | 'dunk' | 'layup' | 'cross' | 'steal' | 'block' | 'slide' | 'beaten' | 'kick' | 'dive' | 'hold' | 'celebrate' | 'cheer' | 'head' | 'throw'

export type Player = {
  id: number
  team: 0 | 1
  human: boolean
  keeper: boolean
  name: string
  /** Football: the place in the team (0 keeper, 1 back, 2 and 3 wings, 4 up front); basketball: 0 guard, 1 and 2 wings. */
  role: number
  x: number
  z: number
  vx: number
  vz: number
  /** Which way the body faces, as a Sim's rotation (0: +z). */
  face: number
  want: V
  act: Act
  at: number
  len: number
  /** The dribbling hand (1 right, -1 left); the keeper's dive, which side. */
  side: 1 | -1
  /** Can't take the ball before this runs out (s). */
  cool: number
  /** The next time the AI thinks (s). */
  think: number
  /** Asking for the ball (s left). */
  call: number
  /** A dunk or a layup: from where, to where. */
  from: V
  to: V
  /** A move to make a little later (the kick lands after the leg swings). */
  pending: (() => void) | null
  pendingAt: number
  /** The spot an attacker heads for when he hasn't the ball. */
  spot: number
  pose: Pose
  /** Mirrored body (the keeper diving the other way). */
  flip: boolean
  /** Football: the sprint's breath (0…1), Tir held so far (0…1), the cards, sent off. */
  stamina: number
  charge: number
  cards: number
  out: boolean
  /** This slide tackle has been judged already (a foul or not). */
  judged: boolean
}

/** Something worth cheering, filming and posting. */
export type Moment = { kind: 'dunk' | 'basket' | 'three' | 'goal' | 'block' | 'steal' | 'ankle' | 'save' | 'tackle' | 'post' | 'foul' | 'card'; team: 0 | 1; by: number; t: number }

type Flight = {
  kind: 'pass' | 'bounce' | 'shot'
  from: [number, number, number]
  to: [number, number, number]
  t: number
  len: number
  apex: number
  by: number
  team: 0 | 1
  /** A pass: who it's for. A shot: in or not, and worth how much. */
  target: number
  make: boolean
  points: number
  /** Who already had a go at cutting it out. */
  tried: number[]
}

export type Ball = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  owner: number
  lastTeam: 0 | 1
  lastBy: number
  flight: Flight | null
  /** Football: who a rolling pass is for (runs to it), and who tried to control it already. */
  meant: number
  tried: number[]
  /** The dribble's beat. */
  phase: number
  /** A shot through the ring: no one touches it before it's down. */
  dead: boolean
  /** Football: a lofted ball (a lob, a cross, a goal kick) still in the air: heads go up for it. */
  lofted: boolean
}

export type Stats = { points: number; goals: number; dunks: number; assists: number; steals: number; blocks: number; ankles: number }

export type Game = {
  sport: Sport
  ps: Player[]
  ball: Ball
  score: [number, number]
  /** Seconds since the whistle (negative: the countdown). */
  time: number
  phase: 'count' | 'play' | 'dead' | 'over'
  /** A stop in play (after a basket, a goal): how long, and what then. */
  wait: number
  then: (() => void) | null
  /** The team with the ball, and (basketball) whether it has taken it back past the arc since winning it. */
  poss: 0 | 1
  cleared: boolean
  possT: number
  flash: { text: string; t: number } | null
  moments: Moment[]
  stats: Stats
  lastPass: { by: number; team: 0 | 1; t: number; /** Played by the local hands (the console moves them on to whoever it's for). */ mine: boolean } | null
  /** The ring after a dunk or off the iron: when it was hit, and how hard. */
  rim: { t: number; amp: number }
  /** The net when the ball goes through it. */
  swish: number
  /** Football: the shot on its way, and whether the keeper gets to it. */
  shot: { keeper: number; save: boolean; t: number; z: number; goalX: number } | null
  me: number
  rnd: () => number
  /** The rules (Rules): the length, the other side's strength, the golden goal; in the golden goal now. */
  length: number
  foe: number
  golden: boolean
  extra: boolean
  /** Football: the ground, how many a side, the player taking over the team-mate the play needs, a referee. */
  field: Field
  size: 5 | 11
  switching: boolean
  referee: boolean
  /** A set piece waiting to be taken (a free kick, a penalty, a corner, a throw-in, a goal kick). */
  set: SetPiece | null
  /** The referee, following the play. */
  ref: { x: number; z: number; face: number; whistle: number }
  /** At a penalty against the local team: the side its stick says the keeper dives (null: no say). */
  penStick: -1 | 0 | 1 | null
}

/** A dead ball about to be played: who takes it, from where, since when; the others kept back. */
export type SetPiece = { kind: 'free' | 'pen' | 'corner' | 'throw' | 'goal'; team: 0 | 1; taker: number; at: V; t: number }

/**
 * A match's rules, if not the street's (the console's, at the salle de jeux):
 * how long, how good the other side is (1 as in the street), a draw played on
 * to the golden goal. Football also: eleven a side at the stadium (else the
 * maracana's five), the player switching team-mates (the console: one team in
 * one pair of hands), a referee (fouls, free kicks, penalties, cards), and the
 * teams' names by place in the team (the player's own name goes on `me`).
 */
export type Rules = { length?: number; foe?: number; golden?: boolean; size?: 5 | 11; switching?: boolean; referee?: boolean; names?: [string[], string[]] }

/** When the player last held Défense (the stance reads a crossover). */
let lastGuard = -9

const NAMES = { mates: ['Yao', 'Ibrahim', 'Koffi', 'Moussa'], them: ['Bakary', 'Junior', 'Didier', 'Salif', 'Lass'] }
/** Eleven a side, by place: keeper, the back four, the three in midfield, the wingers and the striker between them. */
const ELEVEN = {
  mates: ['Gbagbo', 'Seri', 'Kanga', 'Diomandé', 'Koné', 'Bamba', 'Yao', 'Ibrahim', 'Koffi', 'Moussa', 'Gervais'],
  them: ['Sangaré', 'Traoré', 'Coulibaly', 'Ouattara', 'Doumbia', 'Fofana', 'Bakary', 'Junior', 'Didier', 'Salif', 'Lass'],
}

/**
 * The eleven's shape (4-3-3) by place in the team, in fractions of the
 * pitch's half length and width, for the team attacking +x: where each one
 * stands at the kick-off and goes back to without the ball.
 */
const SHAPE11: V[] = [
  [-0.96, 0],
  [-0.62, -0.62],
  [-0.7, -0.22],
  [-0.7, 0.22],
  [-0.62, 0.62],
  [-0.45, 0],
  [-0.3, -0.36],
  [-0.3, 0.36],
  [-0.12, -0.72],
  [-0.06, 0],
  [-0.12, 0.72],
]
/** The console's football (a referee, switching, or the stadium's eleven): lobs and headers, its own long balls; the street plays as it always has. */
const fifa = (g: Game) => g.referee || g.switching || g.size === 11
/** Who kicks off and who scores when it isn't clear: the one up front. */
const striker = (g: Game) => (g.size === 11 ? 9 : 4)

function makePlayer(id: number, team: 0 | 1, role: number, name: string, x: number, z: number): Player {
  return { id, team, human: false, keeper: false, name, role, x, z, vx: 0, vz: 0, face: 0, want: [0, 0], act: 'none', at: 0, len: 0, side: 1, cool: 0, think: 0, call: 0, from: [0, 0], to: [0, 0], pending: null, pendingAt: 0, spot: role, pose: 'idle', flip: false, stamina: 1, charge: 0, cards: 0, out: false, judged: false }
}

/** A seeded random (the labs replay the same match), or Math.random. */
export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createGame(sport: Sport, name: string, rnd: () => number = Math.random, rules: Rules = {}): Game {
  const ps: Player[] = []
  const size = sport === 'foot' && rules.size === 11 ? 11 : 5
  if (sport === 'basket') {
    // 3 against 3: the player and two mates, three in front.
    for (let i = 0; i < 3; i++) ps.push(makePlayer(i, 0, i, i === 0 ? name : NAMES.mates[i - 1], 0, 0))
    for (let i = 0; i < 3; i++) ps.push(makePlayer(3 + i, 1, i, NAMES.them[i], 0, 0))
  } else if (size === 11) {
    // 11 against 11: the player starts up front (the kick-off is theirs), and takes over whoever the play needs.
    const names = rules.names ?? [ELEVEN.mates, ELEVEN.them]
    for (const team of [0, 1] as const) for (let i = 0; i < 11; i++) ps.push(makePlayer(team * 11 + i, team, i, names[team][i] ?? ELEVEN.mates[i], 0, 0))
    ps[9].name = name
    for (const p of ps) p.keeper = p.role === 0
  } else {
    // 5 against 5: a keeper, a back, two wings, one up front; the player on a wing.
    for (let i = 0; i < 5; i++) ps.push(makePlayer(i, 0, i, i === 2 ? name : (rules.names?.[0][i] ?? NAMES.mates[i < 2 ? i : i - 1]), 0, 0))
    for (let i = 0; i < 5; i++) ps.push(makePlayer(5 + i, 1, i, rules.names?.[1][i] ?? NAMES.them[i], 0, 0))
    for (const p of ps) p.keeper = p.role === 0
  }
  const me = sport === 'basket' ? 0 : size === 11 ? 9 : 2
  ps[me].human = true
  const g: Game = {
    sport,
    ps,
    ball: { x: 0, y: 0.5, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, lastTeam: 0, lastBy: -1, flight: null, meant: -1, tried: [], phase: 0, dead: false, lofted: false },
    score: [0, 0],
    time: -COUNTDOWN,
    phase: 'count',
    wait: 0,
    then: null,
    poss: 0,
    cleared: true,
    possT: 0,
    flash: null,
    moments: [],
    stats: { points: 0, goals: 0, dunks: 0, assists: 0, steals: 0, blocks: 0, ankles: 0 },
    lastPass: null,
    rim: { t: -9, amp: 0 },
    swish: -9,
    shot: null,
    me,
    rnd,
    length: rules.length ?? LENGTH,
    foe: rules.foe ?? 1,
    golden: !!rules.golden,
    extra: false,
    field: FIELDS[size],
    size,
    switching: !!rules.switching,
    referee: !!rules.referee,
    set: null,
    ref: { x: 0, z: -6, face: 0, whistle: -9 },
    penStick: null,
  }
  restart(g, 0)
  return g
}

/* ---------- Little helpers ---------- */

const hyp = Math.hypot
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const fwd = (p: Player): V => [Math.sin(p.face), Math.cos(p.face)]
/** The body's right side (where the dribbling hand is): its +x, turned with it. */
const right = (p: Player): V => [Math.cos(p.face), -Math.sin(p.face)]
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => hyp(a.x - b.x, a.z - b.z)
const speedOf = (p: Player) => hyp(p.vx, p.vz)
/** The others on the pitch (one sent off isn't). */
const mates = (g: Game, p: Player) => g.ps.filter((q) => q.team === p.team && q !== p && !q.out)
const foes = (g: Game, p: Player) => g.ps.filter((q) => q.team !== p.team && !q.out)
export const holder = (g: Game) => (g.ball.owner >= 0 ? g.ps[g.ball.owner] : null)
/** Where a team scores (football: the middle of the goal mouth). */
const goalOf = (g: Game, team: 0 | 1): V => (g.sport === 'basket' ? HOOP : [team === 0 ? g.field.x : -g.field.x, 0])
/** Inside the penalty box a team defends (team's own goal). */
const inBox = (g: Game, team: 0 | 1, x: number, z: number) => Math.abs(x - (team === 0 ? -g.field.x : g.field.x)) < g.field.box[0] && Math.abs(z) < g.field.box[1]
/** Which way a team attacks (football). */
const dirOf = (team: 0 | 1) => (team === 0 ? 1 : -1)
const fromHoop = (x: number, z: number) => hyp(x - HOOP[0], z - HOOP[1])
/** Locked in a move: the stick doesn't steer. */
const locked = (p: Player) => p.act === 'dunk' || p.act === 'layup' || p.act === 'shoot' || p.act === 'slide' || p.act === 'beaten' || p.act === 'dive' || p.act === 'celebrate' || p.act === 'head' || (p.act === 'block' && p.at < 0.6)

function say(g: Game, text: string) {
  g.flash = { text, t: g.time }
}
function moment(g: Game, kind: Moment['kind'], p: Player) {
  g.moments.push({ kind, team: p.team, by: p.id, t: g.time })
  if (g.moments.length > 12) g.moments.shift()
}
function startAct(p: Player, act: Act, len: number) {
  p.act = act
  p.at = 0
  p.len = len
}
/** The nearest of some players to a point, and how far. */
function nearest(list: Player[], x: number, z: number): [Player | null, number] {
  let best: Player | null = null
  let d = Infinity
  for (const q of list) {
    const e = hyp(q.x - x, q.z - z)
    if (e < d) [best, d] = [q, e]
  }
  return [best, d]
}
/** How close the nearest of `list` comes to the segment a → b. */
function laneGap(list: Player[], a: V, b: V) {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
  const l2 = dx * dx + dz * dz || 1
  let gap = Infinity
  for (const q of list) {
    const k = clamp(((q.x - a[0]) * dx + (q.z - a[1]) * dz) / l2, 0, 1)
    gap = Math.min(gap, hyp(q.x - (a[0] + dx * k), q.z - (a[1] + dz * k)))
  }
  return gap
}
/** How free a player is: the distance to the nearest opponent. */
const openness = (g: Game, p: Player) => nearest(foes(g, p), p.x, p.z)[1]

/* ---------- Restarts ---------- */

/** Everyone to their places, the ball to `team`: a check at the top of the arc (basketball), a kick-off (football). */
function restart(g: Game, team: 0 | 1) {
  const b = g.ball
  b.flight = null
  b.vx = b.vy = b.vz = 0
  b.dead = false
  b.tried = []
  b.meant = -1
  g.shot = null
  g.poss = team
  g.cleared = true
  g.possT = 0
  for (const p of g.ps) {
    p.act = 'none'
    p.vx = p.vz = 0
    p.cool = 0
    p.pending = null
    p.flip = false
  }
  if (g.sport === 'basket') {
    const att = g.ps.filter((p) => p.team === team)
    const def = g.ps.filter((p) => p.team !== team)
    // The ball to the player when it's their team's: the game is theirs to play.
    const first = att.find((p) => p.human) ?? att[0]
    const order = [first, ...att.filter((p) => p !== first)]
    const SPOT: V[] = [
      [0, 6.2],
      [-5.2, 1.6],
      [5.2, 1.6],
    ]
    order.forEach((p, i) => {
      ;[p.x, p.z] = SPOT[i]
      p.spot = i
      p.face = Math.PI
    })
    def.forEach((p, i) => {
      const m = order[i]
      const k = 1.4 / (fromHoop(m.x, m.z) || 1)
      p.x = m.x + (HOOP[0] - m.x) * k
      p.z = m.z + (HOOP[1] - m.z) * k
      p.face = Math.atan2(m.x - p.x, m.z - p.z)
    })
    give(g, first)
  } else {
    const F = g.field
    g.set = null
    b.lofted = false
    for (const p of g.ps) {
      const d = dirOf(p.team)
      const own = p.team === team
      let x: number, z: number
      if (g.size === 11) {
        // Each in the shape, in his own half; the kicker on the ball, a team-mate beside him, the others outside the circle.
        const [fx, fz] = SHAPE11[p.role]
        ;[x, z] = [Math.min(-1.5, fx * F.x), fz * F.z * 0.92]
        if (p.role === 9) [x, z] = own ? [-0.4, 0] : [-9.6, 0]
        if (p.role === 6 && own) [x, z] = [-1.2, -5]
      } else {
        const SPOT: V[] = [
          [-F.x + 0.8, 0],
          [-11, 0],
          [-4, -5.5],
          [-4, 5.5],
          own ? [-0.4, 0] : [-4.5, 0],
        ]
        ;[x, z] = SPOT[p.role]
      }
      // Mirrored for the side attacking -x; the eleven's left is the other's right (the maracana's places were always set the same way).
      p.x = x * d
      p.z = g.size === 11 ? z * d : z
      p.face = d > 0 ? Math.PI / 2 : -Math.PI / 2
      if (p.out) offPitch(g, p)
    }
    // The one up front kicks off (another if he's been sent off).
    const kicker = g.ps.find((p) => p.team === team && p.role === striker(g) && !p.out) ?? g.ps.find((p) => p.team === team && !p.keeper && !p.out)!
    give(g, kicker)
  }
}

/** One sent off stands by the touchline, out of the play. */
function offPitch(g: Game, p: Player) {
  p.x = (p.team === 0 ? -6 : 6) - p.role * 0.7
  p.z = g.field.z + 3
  p.vx = p.vz = 0
  p.want = [0, 0]
  p.face = Math.PI
  p.act = 'none'
}

/** The ball into someone's hands (or at their feet). */
function give(g: Game, p: Player) {
  const b = g.ball
  const changed = p.team !== g.poss
  b.owner = p.id
  b.flight = null
  b.lastTeam = p.team
  b.lastBy = p.id
  b.meant = -1
  b.tried = []
  b.dead = false
  b.lofted = false
  p.think = 0.25
  p.call = 0
  if (changed) {
    g.poss = p.team
    g.possT = 0
    // Basketball, street rules: won back under the basket, it must go out past the arc before it can score.
    g.cleared = g.sport === 'basket' ? fromHoop(p.x, p.z) > ARC + 0.2 : true
  }
  if (g.shot && p.keeper) g.shot = null
  // The console: the player plays whoever of the team has the ball; the other side has it, the team-mate nearest it (if the one played is far behind).
  if (g.switching) {
    if (p.team === myTeam(g) && !p.keeper) control(g, p)
    else if (p.team !== myTeam(g)) {
      const near = nearestMate(g, b.x, b.z)
      if (near && dist(near, b) < dist(g.ps[g.me], b) - 6) control(g, near)
    }
  }
}

/** The team the local hands play for. */
const myTeam = (g: Game) => g.ps[g.me].team

/** The console: the local hands go to another of the team (the one before plays by itself again). */
function control(g: Game, p: Player) {
  if (!g.switching || p.id === g.me || p.out || p.team !== myTeam(g)) return
  const was = g.ps[g.me]
  was.human = false
  was.charge = 0
  p.human = true
  p.think = 0
  g.me = p.id
}

/** Of the local team (not the keeper, nor `not`), the one nearest a point. */
function nearestMate(g: Game, x: number, z: number, not?: Player) {
  return nearest(
    g.ps.filter((q) => q.team === myTeam(g) && !q.keeper && !q.out && q !== not),
    x,
    z,
  )[0]
}

/* ---------- The moves ---------- */

/** Passe: to the team-mate the stick points at (or the most open one). Basketball, a bounce pass when a hand is in the way; football, along the ground, into space when it's played forward. */
export function pass(g: Game, p: Player, aim: V | null, kind: 'ground' | 'through' | 'lob' | 'throw' = 'ground') {
  const b = g.ball
  if (b.owner !== p.id || locked(p)) return
  const list = mates(g, p).filter((q) => !q.keeper || g.sport === 'basket' || p.keeper)
  if (!list.length) return
  const F = g.field
  let to = list[0]
  let best = -Infinity
  for (const q of list) {
    const [dx, dz] = [q.x - p.x, q.z - p.z]
    const d = hyp(dx, dz) || 1
    let score: number
    if (aim && hyp(aim[0], aim[1]) > 0.3) score = (dx * aim[0] + dz * aim[1]) / d / hyp(aim[0], aim[1]) - d * 0.012
    else score = Math.min(4, openness(g, q)) * 0.4 - d * (g.size === 11 ? 0.018 : 0.03) + (g.sport === 'foot' ? ((q.x - p.x) * dirOf(p.team)) * 0.05 : 0) + (q.human ? 0.5 : 0)
    // A through ball looks for the run in behind; a lob, for a head in the box.
    if (kind === 'through') score += ((q.x - p.x) * dirOf(p.team)) * 0.06
    if (kind === 'lob' && inBox(g, q.team === 0 ? 1 : 0, q.x, q.z)) score += 1.2
    if (score > best) [best, to] = [score, q]
  }
  const enemies = foes(g, p)
  g.lastPass = { by: p.id, team: p.team, t: g.time, mine: p.id === g.me }
  if (g.set?.taker === p.id) g.set = null
  b.owner = -1
  b.lastBy = p.id
  b.lastTeam = p.team
  b.tried = []
  p.cool = 0.35
  to.call = 0
  if (g.sport === 'basket') {
    const target: V = [to.x + to.vx * 0.35, to.z + to.vz * 0.35]
    const bounce = laneGap(enemies, [p.x, p.z], target) < 1.3
    const d = hyp(target[0] - p.x, target[1] - p.z)
    const [fx, fz] = fwd(p)
    b.flight = { kind: bounce ? 'bounce' : 'pass', from: [p.x + fx * 0.35, 1.15, p.z + fz * 0.35], to: [target[0], 1.1, target[1]], t: 0, len: 0.18 + d / 11, apex: 0.25, by: p.id, team: p.team, target: to.id, make: false, points: 0, tried: [] }
    startAct(p, 'pass', 0.35)
    p.side = bounce ? -1 : 1
    p.face = Math.atan2(target[0] - p.x, target[1] - p.z)
    return
  }
  // Football: to the feet, or into the space in front of him.
  const d0 = hyp(to.x - p.x, to.z - p.z)
  const dir = dirOf(p.team)
  const forward = aim ? aim[0] * dir > 0.5 : false
  const ahead = (to.x - p.x) * dir > 2
  const through = kind === 'through' || (forward && ahead)
  const big = g.size === 11
  const lead = through ? (big ? 6 : 4) + d0 * (big ? 0.12 : 0.1) : 0
  const eta = d0 / 13
  const tx = clamp(to.x + to.vx * eta + dir * lead, -F.x + 1, F.x - 1)
  const tz = clamp(to.z + to.vz * eta, -F.z + 1, F.z - 1)
  const d = hyp(tx - p.x, tz - p.z) || 1
  // Fast enough to get there, rolling to a stop a little past it.
  const v = clamp(Math.sqrt(2 * 1.6 * (d + 3)), 7, big ? 26 : 21)
  // In the air: asked for (a lob, a cross), a throw-in, or too far along the ground.
  const lob = kind === 'lob' || kind === 'throw' || d > (big ? 32 : 16)
  // Up and down so it comes down near him: the higher the further, a throw-in low. The street's long ball as it always was.
  const street = !fifa(g)
  const vy = street ? (lob ? 5.5 : 0) : kind === 'throw' ? 3.4 : lob ? clamp(3.5 + d * 0.14, 4.5, 10) : 0
  const air = (2 * vy) / 9.8
  const vh = street ? v * (lob ? 0.8 : 1) : lob ? Math.min((Math.max(1, d - 1.5) / Math.max(air, 0.3)) * (kind === 'throw' ? 1 : 0.95), 24) : v
  p.face = Math.atan2(tx - p.x, tz - p.z)
  startAct(p, kind === 'throw' ? 'throw' : 'kick', 0.45)
  p.pending = () => {
    b.vx = ((tx - p.x) / d) * vh
    b.vz = ((tz - p.z) / d) * vh
    b.vy = vy
    if (kind === 'throw') b.y = 1.9
    b.lofted = lob && !street
    b.meant = to.id
  }
  p.pendingAt = 0.14
  b.meant = to.id
  // The ball stays at his foot until it's struck.
  b.vx = b.vy = b.vz = 0
  if (through && p.human) say(g, 'Passe en profondeur !')
  else if (kind === 'lob' && p.human && inBox(g, p.team === 0 ? 1 : 0, tx, tz)) say(g, 'Centre !')
  // The console: the hands go with the ball to whoever it's for.
  if (g.switching && to.team === myTeam(g) && !to.keeper) control(g, to)
}

/** Tir: a jump shot, a layup close in, a dunk with a run-up at the ring; football, a shot at goal (the stick aims it). */
export function shoot(g: Game, p: Player, aim: V | null, power?: number) {
  const b = g.ball
  if (b.owner !== p.id || locked(p)) return
  if (g.sport === 'foot') return kickAtGoal(g, p, aim, power)
  const d = fromHoop(p.x, p.z)
  const sp = speedOf(p)
  const toward = sp > 0.1 ? ((HOOP[0] - p.x) * p.vx + (HOOP[1] - p.z) * p.vz) / (d * sp || 1) : 0
  const blocker = guardOf(g, p)
  if (d < 3.8 && sp > 2.2 && toward > 0.2) {
    // The dunk: two steps to the ring, up, the ball thrown down through it, hanging there.
    startAct(p, 'dunk', 1.7)
    p.from = [p.x, p.z]
    p.to = [HOOP[0] + ((p.x - HOOP[0]) / (d || 1)) * 0.32, HOOP[1] + ((p.z - HOOP[1]) / (d || 1)) * 0.32]
    p.face = Math.atan2(HOOP[0] - p.x, HOOP[1] - p.z)
    // A hand in the way? The man guarding him, right there, going up too.
    p.pending = () => {
      if (blocker && dist(blocker, p) < 1.5 && tryBlock(g, blocker, 0.16)) return swat(g, blocker, p)
      p.pending = () => dunkThrough(g, p)
      p.pendingAt = 0.55
    }
    p.pendingAt = 0.32
    return
  }
  if (d < 2.6) {
    startAct(p, 'layup', 0.95)
    p.from = [p.x, p.z]
    p.to = [HOOP[0] + ((p.x - HOOP[0]) / (d || 1)) * 0.9, HOOP[1] + ((p.z - HOOP[1]) / (d || 1)) * 0.9]
    p.face = Math.atan2(HOOP[0] - p.x, HOOP[1] - p.z)
    p.pending = () => release(g, p, 0.74, 0.35)
    p.pendingAt = 0.42
    return
  }
  // The jump shot: up, released at the top.
  startAct(p, 'shoot', 0.8)
  p.vx *= 0.2
  p.vz *= 0.2
  p.face = Math.atan2(HOOP[0] - p.x, HOOP[1] - p.z)
  const chance = d < 3.5 ? 0.6 : d <= ARC ? 0.47 : 0.37
  p.pending = () => release(g, p, chance, 0.75 + d * 0.05)
  p.pendingAt = 0.42
}

/** The man guarding a player: the nearest opponent between him and the ring. */
function guardOf(g: Game, p: Player) {
  let best: Player | null = null
  let d = Infinity
  for (const q of foes(g, p)) {
    const e = dist(q, p)
    const inFront = (q.x - p.x) * (HOOP[0] - p.x) + (q.z - p.z) * (HOOP[1] - p.z) > 0
    if (e < d && (inFront || e < 0.9)) [best, d] = [q, e]
  }
  return best
}

/** Does a block come off? The player blocks when they went up in time; the AI by chance. */
function tryBlock(g: Game, q: Player, chance: number) {
  if (q.human) return q.act === 'block' && q.at < 0.45 ? g.rnd() < 0.6 : false
  if (q.act === 'beaten' || q.cool > 0.3) return false
  startAct(q, 'block', 0.85)
  return g.rnd() < chance
}

/** Blocked: the ball swatted away, loose. */
function swat(g: Game, by: Player, shooter: Player) {
  const b = g.ball
  const [dx, dz] = [shooter.x - HOOP[0], shooter.z - HOOP[1]]
  const d = hyp(dx, dz) || 1
  const side = g.rnd() < 0.5 ? -1 : 1
  b.owner = -1
  b.flight = null
  b.x = shooter.x
  b.z = shooter.z
  b.y = 2.6
  b.vx = (dx / d) * 4 + side * (dz / d) * 3
  b.vz = (dz / d) * 4 - side * (dx / d) * 3
  b.vy = 1.5
  b.lastTeam = by.team
  b.lastBy = by.id
  b.tried = []
  shooter.cool = 0.5
  say(g, by.human ? 'Contré ! Quel contre !' : shooter.human ? 'Contré…' : 'Contré !')
  moment(g, 'block', by)
  if (by.id === g.me) g.stats.blocks++
  // A blocked dunk comes down at once.
  if (shooter.act === 'dunk') startAct(shooter, 'layup', 0.6)
}

/** The ball let go towards the ring: in or out is decided now (the man guarding takes some off). */
function release(g: Game, p: Player, chance: number, len: number) {
  const b = g.ball
  const d = fromHoop(p.x, p.z)
  const q = guardOf(g, p)
  let contest = 0
  if (q) {
    const e = dist(q, p)
    if (e < 1.25 && q.act === 'block' && tryBlock(g, q, 0.45)) return swat(g, q, p)
    if (e < 1.7) contest = (1.7 - e) * 0.24
    // The AI goes up at the shot.
    if (!q.human && e < 1.5 && q.act === 'none' && g.rnd() < 0.55) startAct(q, 'block', 0.85)
  }
  const make = g.rnd() < chance - contest
  const points = d > ARC ? 2 : 1
  const [fx, fz] = fwd(p)
  const from: [number, number, number] = [p.x + fx * 0.25, p.act === 'layup' ? 2.45 : 2.5, p.z + fz * 0.25]
  // A miss is aimed at the iron: front, back or a side.
  const a = g.rnd() * Math.PI * 2
  const to: [number, number, number] = make ? [HOOP[0], RIM_Y + 0.05, HOOP[1]] : [HOOP[0] + Math.cos(a) * 0.25, RIM_Y + 0.05, HOOP[1] + Math.sin(a) * 0.25]
  b.owner = -1
  b.flight = { kind: 'shot', from, to, t: 0, len, apex: p.act === 'layup' ? 0.45 : 1.1 + d * 0.11, by: p.id, team: p.team, target: -1, make, points, tried: [] }
  b.lastBy = p.id
  b.lastTeam = p.team
  p.cool = 0.4
}

/** The dunk goes down through the ring: the ring pulled down, the net flying, two hands on the iron. */
function dunkThrough(g: Game, p: Player) {
  const b = g.ball
  b.owner = -1
  b.flight = null
  b.x = HOOP[0]
  b.z = HOOP[1]
  b.y = RIM_Y - 0.05
  b.vx = b.vz = 0
  b.vy = -3.5
  b.dead = true
  g.rim = { t: g.time, amp: 0.16 }
  g.swish = g.time
  scored(g, p, 1, true)
}

/** A basket: the points (if the ball went out past the arc first), the crowd, then the others check it at the top. */
function scored(g: Game, p: Player, points: number, dunk: boolean) {
  const other: 0 | 1 = p.team === 0 ? 1 : 0
  if (!g.cleared) {
    say(g, 'Panier refusé : la balle devait ressortir !')
    g.phase = 'dead'
    g.wait = 1.6
    g.then = () => restart(g, other)
    return
  }
  g.score[p.team] += points
  if (p.id === g.me) {
    g.stats.points += points
    if (dunk) g.stats.dunks++
  } else if (p.team === g.ps[g.me].team && g.lastPass?.mine && g.time - g.lastPass.t < 4) g.stats.assists++
  say(g, dunk ? (p.human ? 'DUNK !!! Le terrain explose !' : 'DUNK !!!') : points === 2 ? 'De loin ! 2 points !' : 'Paniiier !')
  moment(g, dunk ? 'dunk' : points === 2 ? 'three' : 'basket', p)
  g.phase = 'dead'
  g.wait = dunk ? 2.4 : 1.5
  g.then = () => restart(g, other)
  // The others cheer him.
  for (const q of g.ps) if (q.team === p.team && q !== p && !locked(q)) startAct(q, 'cheer', g.wait)
}

/**
 * Football: the shot. Its speed, its lift and how far off the aim it goes;
 * whether the keeper gets there. `power` (0…1) is how long Tir was held: soft
 * and placed, or hard and rising (too hard close in, over the bar). The AI
 * hits it about three quarters.
 */
function kickAtGoal(g: Game, p: Player, aim: V | null, power?: number) {
  const F = g.field
  const goal = goalOf(g, p.team)
  const d = hyp(goal[0] - p.x, goal[1] - p.z)
  const pen = g.set?.kind === 'pen' && g.set.taker === p.id
  // The goal's size against the maracana's (the stadium's is wider).
  const k = F.mouth / 1.6
  let z: number, h: number, speed: number
  if (power === undefined) {
    // The street's shot (the AI's everywhere, a tap where Tir isn't held): aimed with the stick, else a corner.
    const want = (aim && Math.abs(aim[1]) > 0.25 ? Math.sign(aim[1]) * 1.15 : (g.rnd() < 0.5 ? -1 : 1) * (0.5 + g.rnd() * 0.8)) * k
    z = want + (g.rnd() - 0.5) * (0.4 + d * 0.07) * (pen ? 0.6 : 1)
    speed = 19 + g.rnd() * 5
    h = 0.25 + g.rnd() * 1.6 + (d > 20 ? 0.6 : 0)
  } else {
    // Charged: placed with the stick across the goal; the harder, the faster, the less precise, and the higher it can rise.
    const corner = 1.15 * k
    const want = aim && Math.abs(aim[1]) > 0.25 ? Math.sign(aim[1]) * corner * (0.6 + 0.4 * Math.min(1, Math.abs(aim[1]) * 1.4)) : (g.rnd() < 0.5 ? -1 : 1) * corner * (0.45 + g.rnd() * 0.5)
    z = want + (g.rnd() - 0.5) * (0.4 + d * 0.07) * (0.7 + power * 0.6) * (pen ? 0.6 : 1)
    speed = 14 + power * 13
    h = 0.2 + g.rnd() * (0.4 + power * 1.1) + power * power * power * 1.6 + (d > 20 ? 0.5 : 0)
  }
  fire(g, p, goal, z, h, speed, 'kick')
  if (g.set?.taker === p.id) g.set = null
}

/** A shot leaves the foot (or the head) for (goalX, z) at height h: the keeper's chance worked out now. */
function fire(g: Game, p: Player, goal: V, z: number, h: number, speed: number, act: 'kick' | 'head') {
  const b = g.ball
  const F = g.field
  // The flight time to the goal (as the street's shot always reckoned it), the line to the corner aimed at.
  const d = hyp(goal[0] - p.x, goal[1] - p.z) || 1
  const T = d / speed
  const vy = (h - b.y + 4.9 * T * T) / T
  const [tx, tz] = [goal[0], z]
  const l = hyp(tx - p.x, tz - p.z) || 1
  p.face = Math.atan2(tx - p.x, tz - p.z)
  const pen = g.set?.kind === 'pen' && g.set.taker === p.id
  const launch = () => {
    b.owner = -1
    b.flight = null
    b.vx = ((tx - p.x) / l) * speed
    b.vz = ((tz - p.z) / l) * speed
    b.vy = vy
    b.lofted = false
    b.lastBy = p.id
    b.lastTeam = p.team
    b.meant = -1
    b.tried = [p.id]
    p.cool = 0.4
    const keeper = g.ps.find((q) => q.keeper && q.team !== p.team && !q.out)
    if (!keeper) return
    // The keeper's chance: time to react, how far he has to go, a corner; a penalty, whether he guessed the side.
    const reach = Math.abs(z - keeper.z)
    const onTarget = Math.abs(z) < F.mouth && h < F.bar
    const good = keeper.team === 1 ? 0.7 + 0.3 * g.foe : 1
    let save: boolean
    if (pen) {
      const side = Math.abs(z) < F.mouth * 0.3 ? 0 : Math.sign(z)
      const guess = penGuess(g, keeper)
      save = onTarget && guess === side && g.rnd() < (Math.abs(z) > F.mouth * 0.8 ? 0.35 : 0.75) * good
      keeper.side = guess >= 0 ? 1 : -1
      if (guess !== 0) {
        startAct(keeper, 'dive', 1.3)
        keeper.vz = guess * (save ? 5.5 : 4.5)
        keeper.vx = 0
      }
    } else save = onTarget && g.rnd() < clamp((0.62 + (T - 0.6) * 0.5 - reach * 0.2 * (1.6 / F.mouth) - (Math.abs(z) > 1.1 * (F.mouth / 1.6) ? 0.12 : 0) - (act === 'head' ? 0.08 : 0)) * good, 0.08, 0.88)
    g.shot = { keeper: keeper.id, save, t: g.time + T, z, goalX: goal[0] }
  }
  if (act === 'head') {
    startAct(p, 'head', 0.6)
    launch()
    return
  }
  startAct(p, 'kick', 0.5)
  b.vx = b.vz = b.vy = 0
  p.pending = launch
  p.pendingAt = 0.16
}

/** Which way the keeper goes at a penalty: the local hands' stick if he's theirs, else a guess (sometimes he stays). */
function penGuess(g: Game, k: Player): -1 | 0 | 1 {
  if (k.team === myTeam(g) && g.switching && g.penStick !== null) return g.penStick
  const r = g.rnd()
  return r < 0.42 ? -1 : r < 0.84 ? 1 : 0
}

/** A lofted ball met in the air in the box: headed at goal (an attacker) or away (a defender). */
function header(g: Game, p: Player) {
  const b = g.ball
  const F = g.field
  const attacking = inBox(g, p.team === 0 ? 1 : 0, p.x, p.z)
  b.owner = -1
  b.lofted = false
  b.flight = null
  b.lastBy = p.id
  b.lastTeam = p.team
  b.tried = [p.id]
  b.meant = -1
  if (attacking) {
    const goal = goalOf(g, p.team)
    const z = clamp((g.rnd() - 0.5) * F.mouth * 2.2, -F.mouth * 1.1, F.mouth * 1.1)
    say(g, p.human ? 'Tête !' : `Tête de ${p.name} !`)
    fire(g, p, goal, z, 0.3 + g.rnd() * 1.9, 12 + g.rnd() * 5, 'head')
    return
  }
  // Cleared: up and away towards the other half.
  startAct(p, 'head', 0.5)
  const dir = dirOf(p.team)
  b.vx = dir * (8 + g.rnd() * 4)
  b.vz = (g.rnd() - 0.5) * 9
  b.vy = 4 + g.rnd() * 2
  p.cool = 0.4
  say(g, 'Dégagé de la tête !')
}

/** Crochet: a crossover (basketball) or a sharp cut (football): a burst one way, and the man in front left behind, or on the floor. */
export function skill(g: Game, p: Player, aim: V | null) {
  if (g.ball.owner !== p.id || locked(p) || p.act === 'cross') return
  const foot = g.sport === 'foot'
  startAct(p, 'cross', foot ? 0.42 : 0.48)
  p.side = p.side === 1 ? -1 : 1
  // The burst: where the stick points, else across and forward to the new side.
  const [fx, fz] = fwd(p)
  const [rx, rz] = right(p)
  let [dx, dz] = aim && hyp(aim[0], aim[1]) > 0.3 ? aim : [fx * 0.55 + rx * p.side * 0.85, fz * 0.55 + rz * p.side * 0.85]
  const l = hyp(dx, dz) || 1
  ;[dx, dz] = [dx / l, dz / l]
  p.vx = dx * (foot ? 6.8 : 6)
  p.vz = dz * (foot ? 6.8 : 6)
  for (const q of foes(g, p)) {
    if (q.keeper || dist(q, p) > 2.4 || q.act === 'beaten') continue
    const inFront = ((q.x - p.x) * fx + (q.z - p.z) * fz) / (dist(q, p) || 1) > 0.15
    if (!inFront) continue
    // The player guarding reads it if they're low in their stance.
    const chance = q.human ? (q.act === 'none' && g.time - lastGuard < 0.3 ? 0.3 : 0.55) : 0.7
    if (g.rnd() < chance) {
      const ankles = g.rnd() < 0.28
      startAct(q, 'beaten', ankles ? 1.5 : 0.85)
      q.cool = ankles ? 1.5 : 0.85
      q.vx *= 0.2
      q.vz *= 0.2
      if (ankles) {
        say(g, p.human ? 'Cheville cassée !!' : 'Oh ! Cheville cassée !')
        moment(g, 'ankle', p)
        if (p.id === g.me) g.stats.ankles++
      } else if (p.human) say(g, foot ? 'Crochet ! Il est passé !' : 'Crossover !')
    }
  }
}

/** Défense: go for the ball. Close to the one with it, a steal or a tackle; at full speed (football), a slide tackle. */
export function defend(g: Game, p: Player) {
  const b = g.ball
  if (locked(p) || b.owner === p.id || p.act === 'steal') return
  const h = holder(g)
  const foot = g.sport === 'foot'
  if (foot && speedOf(p) > 3.6 && (!h || h.team !== p.team)) {
    // Feet first along the ground, through the ball.
    startAct(p, 'slide', 1.05)
    p.judged = false
    const sp = speedOf(p) || 1
    p.vx = (p.vx / sp) * 7.5
    p.vz = (p.vz / sp) * 7.5
    p.face = Math.atan2(p.vx, p.vz)
    return
  }
  startAct(p, 'steal', 0.45)
  if (h && h.team !== p.team) p.face = Math.atan2(h.x - p.x, h.z - p.z)
  if (!h || h.team === p.team || dist(h, p) > 1.55 || h.act === 'dunk') return
  // From behind, it's hard; against someone mid-move, easier.
  const [fx, fz] = fwd(h)
  const behind = ((p.x - h.x) * fx + (p.z - h.z) * fz) / (dist(p, h) || 1) < -0.3
  // The console: one sprinting with the ball has it further from his feet.
  const loose = foot && fifa(g) && speedOf(h) > 5.8 ? 0.12 : 0
  const chance = (foot ? 0.5 : 0.36) + (h.act === 'cross' ? 0.12 : 0) - (behind ? 0.25 : 0) + (p.human ? 0.08 : 0) + loose
  if (g.rnd() < chance) {
    give(g, p)
    startAct(h, 'beaten', 0.6)
    h.cool = 0.7
    say(g, foot ? (p.human ? 'Ballon récupéré !' : 'Bien taclé !') : 'Interception !')
    moment(g, foot ? 'tackle' : 'steal', p)
    if (p.id === g.me) g.stats.steals++
  } else {
    p.cool = 0.55
    // Missed, from behind, into the man: the referee sees it now and then.
    if (foot && g.referee && behind && g.rnd() < 0.05) foul(g, p, h, false)
  }
}

/** Without the ball, Tir is a jump: a block on a shot, a rebound off the ring. */
export function jump(g: Game, p: Player) {
  if (g.sport !== 'basket' || locked(p) || g.ball.owner === p.id) return
  startAct(p, 'block', 0.85)
}

/** Without the ball, Passe asks for it. */
export function call(p: Player) {
  p.call = 1.6
}

/* ---------- The referee and the set pieces ---------- */

/** The penalty spot in front of a team's goal. */
const penaltySpot = (g: Game, team: 0 | 1): V => [team === 0 ? -g.field.x + g.field.spot : g.field.x - g.field.spot, 0]

/** A foul by `by` on `on`: the whistle, maybe a card, then a free kick where it happened (a penalty in the box). */
function foul(g: Game, by: Player, on: Player, reckless: boolean) {
  const at: V = [on.x, on.z]
  const b = g.ball
  g.ref.whistle = g.time
  moment(g, 'foul', by)
  let text = reckless ? `Faute de ${by.name} !` : 'Faute !'
  if (reckless && g.rnd() < 0.25) {
    by.cards++
    moment(g, 'card', by)
    text = by.cards >= 2 ? `Deuxième jaune : ${by.name} est expulsé !` : `Carton jaune pour ${by.name} !`
    if (by.cards >= 2) by.out = true
  }
  say(g, text)
  startAct(on, 'beaten', 1.2)
  b.flight = null
  b.vx = b.vy = b.vz = 0
  b.lofted = false
  g.shot = null
  g.phase = 'dead'
  g.wait = 1.8
  const pen = inBox(g, by.team, at[0], at[1])
  g.then = () => setPiece(g, pen ? 'pen' : 'free', on.team, pen ? penaltySpot(g, by.team) : at)
  // Sent off: the hands leave him for a team-mate.
  if (by.out && by.id === g.me) {
    const next = nearestMate(g, by.x, by.z, by)
    if (next) control(g, next)
  }
}

/** The ball out over a line: a throw-in, a corner or a goal kick, after a moment. */
function outOfPlay(g: Game, kind: 'throw' | 'corner' | 'goal', team: 0 | 1, at: V) {
  const b = g.ball
  g.phase = 'dead'
  g.wait = 1.1
  g.shot = null
  b.lofted = false
  say(g, kind === 'throw' ? 'Touche.' : kind === 'corner' ? 'Corner !' : 'Six mètres.')
  g.then = () => setPiece(g, kind, team, at)
}

/** Everyone to their place for a set piece; the ball to the one taking it. */
function setPiece(g: Game, kind: SetPiece['kind'], team: 0 | 1, at0: V) {
  const F = g.field
  const b = g.ball
  const dir = dirOf(team)
  for (const p of g.ps) {
    p.act = 'none'
    p.pending = null
    p.vx = p.vz = 0
    p.cool = 0
    p.charge = 0
    if (p.out) offPitch(g, p)
  }
  // Where the ball goes.
  let at: V
  if (kind === 'corner') at = [Math.sign(at0[0]) * F.x, Math.sign(at0[1] || 1) * F.z]
  else if (kind === 'throw') at = [clamp(at0[0], -F.x + 0.5, F.x - 0.5), Math.sign(at0[1]) * F.z]
  else if (kind === 'goal') at = [-dir * (F.x - 5.5), at0[1] > 0 ? 4 : -4]
  else if (kind === 'pen') at = at0
  else at = [clamp(at0[0], -F.x + 1, F.x - 1), clamp(at0[1], -F.z + 1, F.z - 1)]
  // Who takes it: the keeper a goal kick, the one up front a penalty (or the local hands' player), the nearest otherwise.
  const side = g.ps.filter((p) => p.team === team && !p.out)
  let taker: Player
  if (kind === 'goal') taker = side.find((p) => p.keeper) ?? side[0]
  else if (kind === 'pen') taker = g.switching && team === myTeam(g) && !g.ps[g.me].keeper ? g.ps[g.me] : (side.find((p) => p.role === striker(g)) ?? side[0])
  else taker = nearest(side.filter((p) => !p.keeper), at[0], at[1])[0] ?? side[0]
  // Facing the goal (a free kick, a penalty) or the pitch (from a line); a step behind the ball.
  const goal = goalOf(g, team)
  const look: V = kind === 'free' || kind === 'pen' ? [goal[0] - at[0], goal[1] - at[1]] : [dir * 6 - at[0] * 0.1, -at[1]]
  const ll = hyp(look[0], look[1]) || 1
  taker.x = at[0] - (look[0] / ll) * 0.45
  taker.z = at[1] - (look[1] / ll) * 0.45
  taker.face = Math.atan2(look[0], look[1])
  // The others back: the other side the wall's distance away (out of the box at a penalty), the keeper on his line.
  for (const p of g.ps) {
    if (p === taker || p.out) continue
    if (kind === 'pen') {
      if (p.keeper && p.team !== team) {
        p.x = team === 0 ? F.x - 0.3 : -F.x + 0.3
        p.z = 0
        p.face = team === 0 ? -Math.PI / 2 : Math.PI / 2
        continue
      }
      if (p.keeper) continue
      if (inBox(g, team === 0 ? 1 : 0, p.x, p.z) || hyp(p.x - at[0], p.z - at[1]) < F.wall) {
        p.x = at[0] - dir * (F.wall + 1 + (p.id % 3))
        p.z = clamp(p.z, -F.box[1], F.box[1])
      }
      continue
    }
    if (p.team !== team) {
      const d = hyp(p.x - at[0], p.z - at[1])
      if (d < F.wall) {
        const k = (F.wall + 0.3) / (d || 1)
        p.x = at[0] + (p.x - at[0]) * k
        p.z = at[1] + (p.z - at[1]) * k
      }
    }
  }
  b.flight = null
  b.vx = b.vy = b.vz = 0
  b.x = at[0]
  b.z = at[1]
  g.shot = null
  give(g, taker)
  b.x = at[0]
  b.z = at[1]
  g.set = { kind, team, taker: taker.id, at, t: g.time }
  g.penStick = null
  g.ref.whistle = g.time
  if (kind === 'pen') say(g, 'Penalty !')
  else if (kind === 'free') say(g, 'Coup franc.')
}

/** The AI takes a set piece (or the local hands' one who's left it too long). */
function takeSetPiece(g: Game, p: Player) {
  const sp = g.set!
  const goal = goalOf(g, p.team)
  const gd = hyp(goal[0] - p.x, goal[1] - p.z)
  const big = g.size === 11
  switch (sp.kind) {
    case 'pen':
      return shoot(g, p, [0, g.rnd() < 0.5 ? -1 : 1], 0.55 + g.rnd() * 0.35)
    case 'free':
      if (gd < (big ? 27 : 12) && g.rnd() < 0.6) return shoot(g, p, [0, (g.rnd() - 0.5) * 2], 0.65 + g.rnd() * 0.3)
      return pass(g, p, null, gd < (big ? 40 : 16) ? 'lob' : 'ground')
    case 'corner':
      return pass(g, p, null, 'lob')
    case 'throw':
      return pass(g, p, null, 'throw')
    case 'goal':
      return pass(g, p, null, 'lob')
  }
}

/* ---------- The players' heads ---------- */

/** Spots for the attackers without the ball (basketball): top, wings, corners, the short corner. */
const SPOTS: V[] = [
  [0, 5.2],
  [-5.3, 1.4],
  [5.3, 1.4],
  [-6.6, -5.4],
  [6.6, -5.4],
  [-2.2, -3.4],
  [2.2, -3.4],
]

function think(g: Game, p: Player, dt: number) {
  p.think -= dt
  const b = g.ball
  const h = holder(g)
  const foot = g.sport === 'foot'
  if (locked(p) || p.out) return
  // Taking a set piece: still, until it's played (takeSetPiece).
  if (g.set && g.set.taker === p.id) {
    p.want = [0, 0]
    return
  }
  // The keeper.
  if (p.keeper) return keeperThink(g, p)
  // A pass in the air: the one it's for meets it, the nearest opponent goes to cut it out.
  if (b.flight && b.flight.kind !== 'shot') {
    const [tx, tz] = [b.flight.to[0], b.flight.to[2]]
    if (b.flight.target === p.id) return runTo(p, tx, tz, 6)
    if (p.team !== b.flight.team && nearest(g.ps.filter((q) => q.team === p.team && !q.keeper && !q.human), tx, tz)[0] === p) return runTo(p, (tx + b.x) / 2, (tz + b.z) / 2, 6)
  }
  // A loose ball: the nearest of each team go for it (where it will land).
  else if (!h && !b.dead) {
    const [lx, lz] = landing(g)
    const order = g.ps.filter((q) => q.team === p.team && !q.keeper && !q.human).sort((a, c) => hyp(a.x - lx, a.z - lz) - hyp(c.x - lx, c.z - lz))
    if (b.meant === p.id || order.indexOf(p) < (foot ? 1 : 2)) {
      runTo(p, lx, lz, 6.2)
      // Up for the rebound when it comes down within reach.
      if (!foot && b.y > 2 && b.y < 3.6 && b.vy < 0 && hyp(b.x - p.x, b.z - p.z) < 1.1 && p.cool <= 0 && p.act === 'none') startAct(p, 'block', 0.75)
      return
    }
  }
  if (foot && b.meant === p.id && !h) return runTo(p, ...landing(g), 6.5)
  const attacking = h ? h.team === p.team : g.poss === p.team
  if (h === p) return foot ? footCarry(g, p) : basketCarry(g, p)
  if (attacking) return foot ? (g.size === 11 ? elevenSupport(g, p) : footSupport(g, p)) : basketSupport(g, p)
  return foot ? (g.size === 11 ? elevenDefend(g, p) : footDefend(g, p)) : basketDefend(g, p)
}

/** Where a loose ball will be when it comes down (or rolls to). */
function landing(g: Game): V {
  const b = g.ball
  if (b.flight) return [b.flight.to[0], b.flight.to[2]]
  // Time to fall to waist height, then a little roll.
  const t = b.vy > 0 || b.y > 1 ? (b.vy + Math.sqrt(Math.max(0, b.vy * b.vy + 2 * 9.8 * Math.max(0, b.y - 1)))) / 9.8 : 0.3
  return [b.x + b.vx * t, b.z + b.vz * t]
}

function runTo(p: Player, x: number, z: number, top: number) {
  const [dx, dz] = [x - p.x, z - p.z]
  const d = hyp(dx, dz)
  const v = d < 0.15 ? 0 : Math.min(top, d * 2.2)
  p.want = d ? [(dx / d) * v, (dz / d) * v] : [0, 0]
}

/* Basketball */

function basketCarry(g: Game, p: Player) {
  const d = fromHoop(p.x, p.z)
  const enemies = foes(g, p)
  const [def, dd] = nearest(enemies, p.x, p.z)
  const inFront = def ? (def.x - p.x) * (HOOP[0] - p.x) + (def.z - p.z) * (HOOP[1] - p.z) > 0 : false
  // Won back under the basket: out past the arc first.
  if (!g.cleared) {
    const k = (ARC + 1.2) / (d || 1)
    runTo(p, HOOP[0] + (p.x - HOOP[0]) * k, clamp(HOOP[1] + (p.z - HOOP[1]) * k, -3, COURT.z1 - 0.5), 4.8)
    return
  }
  const lane = laneGap(enemies, [p.x, p.z], HOOP)
  // Driving: straight at the ring when the lane is open.
  if (lane > 1.3 || d < 3.2) runTo(p, HOOP[0], HOOP[1] + 0.5, 5.6)
  else {
    const s = SPOTS[p.spot % SPOTS.length]
    runTo(p, s[0], s[1] - 1, 3.2)
  }
  if (p.think > 0) return
  p.think = 0.3 + g.rnd() * 0.15
  const human = callerFor(g, p)
  const forced = g.possT > 7
  // The player asked for it: to them, if it can get there.
  if (human.team === p.team && human.call > 0 && laneGap(enemies, [p.x, p.z], [human.x, human.z]) > 0.6 && g.rnd() < 0.85) return pass(g, p, [human.x - p.x, human.z - p.z])
  if (d < 3.2 && (speedOf(p) > 2.2 || d < 2.4)) return shoot(g, p, null)
  if ((d < 7.5 && ((dd > 1.8 && g.rnd() < 0.45) || (dd > 1.1 && g.rnd() < 0.16))) || forced) return shoot(g, p, null)
  if (def && inFront && dd < 1.6 && g.rnd() < 0.45) return skill(g, p, null)
  if (g.rnd() < (human.team === p.team && openness(g, human) > 2 ? 0.45 : 0.3)) return pass(g, p, null)
}

function basketSupport(g: Game, p: Player) {
  // Now and then a cut to the basket; otherwise to a spot, away from the others.
  if (p.think <= 0) {
    p.think = 1.2 + g.rnd() * 1.5
    const taken = mates(g, p).map((q) => q.spot)
    const free = SPOTS.map((_, i) => i).filter((i) => !taken.includes(i))
    p.spot = free[Math.floor(g.rnd() * free.length)] ?? p.spot
  }
  const s = SPOTS[p.spot]
  runTo(p, s[0], s[1], 4.2)
}

function basketDefend(g: Game, p: Player) {
  // Each on his man (the same place in the other team): between him and the ring, closer on the one with the ball.
  const man = g.ps.find((q) => q.team !== p.team && q.role === p.role)!
  const onBall = g.ball.owner === man.id
  const d = fromHoop(man.x, man.z) || 1
  const off = onBall ? 0.95 : Math.min(2.2, 1.2 + d * 0.12)
  runTo(p, man.x + ((HOOP[0] - man.x) / d) * off, man.z + ((HOOP[1] - man.z) / d) * off, onBall ? 4.6 : 4.4)
  if (p.think > 0) return
  p.think = 0.45 + g.rnd() * 0.3
  if (onBall && dist(p, man) < 1.35 && g.rnd() < 0.09 && p.cool <= 0) defend(g, p)
}

/* Football */

function footCarry(g: Game, p: Player) {
  const F = g.field
  const big = g.size === 11
  const dir = dirOf(p.team)
  const goal = goalOf(g, p.team)
  const enemies = foes(g, p).filter((q) => !q.keeper)
  const [def, dd] = nearest(enemies, p.x, p.z)
  const inFront = def ? (def.x - p.x) * dir > -0.3 : false
  const gd = hyp(goal[0] - p.x, goal[1] - p.z)
  // At the feet towards the goal, away from the man in front; nobody near, flat out.
  const dodge = def && inFront && dd < 3 ? Math.sign(p.z - def.z || 1) * 2.5 : 0
  runTo(p, goal[0], clamp(p.z * 0.7 + dodge, -F.z + 1.5, F.z - 1.5), big && dd > 6 ? 6.3 : 5.4)
  if (p.think > 0) return
  p.think = 0.32 + g.rnd() * 0.2
  const human = callerFor(g, p)
  if (human.team === p.team && human.call > 0 && g.rnd() < 0.85) return pass(g, p, [human.x - p.x, human.z - p.z])
  if (gd < (big ? 24 : 15) && Math.abs(p.z) < (big ? 14 : 8) && ((dd > 1.6 || !inFront) ? g.rnd() < (big ? 0.4 : 0.55) : g.rnd() < 0.2)) return shoot(g, p, null)
  // Out wide near the byline: a cross into the box.
  if (big && Math.abs(p.z) > F.z * 0.42 && (goal[0] - p.x) * dir < 18 && g.rnd() < 0.6) return pass(g, p, null, 'lob')
  if (def && inFront && dd < 1.9) return g.rnd() < 0.45 ? skill(g, p, null) : pass(g, p, null)
  if (g.rnd() < (big ? 0.24 : 0.16)) {
    // Forward to someone free, into his run.
    const ahead = mates(g, p).filter((q) => !q.keeper && (q.x - p.x) * dir > 1 && openness(g, q) > 2.2)
    if (ahead.length) return pass(g, p, [dir, 0], big && g.rnd() < 0.4 ? 'through' : 'ground')
    return pass(g, p, null)
  }
}

function footSupport(g: Game, p: Player) {
  const b = g.ball
  const dir = dirOf(p.team)
  // In the shape round the ball: one back, two wide, one up front.
  const SHAPE: V[] = [
    [0, 0],
    [-7, 0],
    [2, -6.5],
    [2, 6.5],
    [7, 0.5],
  ]
  const [sx, sz] = SHAPE[p.role]
  const F = g.field
  const x = clamp(b.x + sx * dir, -F.x + 2, F.x - 2.5)
  const z = clamp(sz + b.z * 0.25 + Math.sin(g.time * 0.6 + p.id) * 1.2, -F.z + 1.2, F.z - 1.2)
  runTo(p, x, z, p.role === 4 ? 5.6 : 5)
}

/**
 * Eleven a side, with the ball: the shape moves up the pitch with it; the
 * front three stretch the play and run in behind, the midfield offers itself,
 * the back four hold a line behind the ball.
 */
function elevenSupport(g: Game, p: Player) {
  const F = g.field
  const b = g.ball
  const dir = dirOf(p.team)
  const [hx, hz] = SHAPE11[p.role]
  const bf = (b.x * dir) / F.x
  const front = p.role >= 8
  const mid = p.role >= 5 && !front
  const push = front ? 0.5 : mid ? 0.38 : 0.3
  let fx = clamp(hx * 0.5 + push + bf * 0.5, -0.92, front ? 0.88 : mid ? 0.7 : 0.4)
  // The back four never get in front of the ball.
  if (!front && !mid) fx = Math.min(fx, bf - 0.08)
  // The striker attacks the box when the ball is out wide near it.
  const box = p.role === 9 && bf > 0.55 && Math.abs(b.z) > F.z * 0.35
  const x = (box ? F.x - 8 : fx * F.x) * dir
  const z = box ? -Math.sign(b.z) * 2 : clamp(hz * F.z * 0.95 + b.z * 0.25 + Math.sin(g.time * 0.5 + p.id) * 1.5, -F.z + 1.5, F.z - 1.5)
  runTo(p, x, z, front ? 6 : 5.2)
}

/**
 * Eleven a side, without the ball: the nearest presses it, the next covers;
 * the rest fall back into the shape, shifted towards the ball; near their own
 * box each one takes the attacker in his zone, goal side.
 */
function elevenDefend(g: Game, p: Player) {
  const F = g.field
  const b = g.ball
  const h = holder(g)
  const dir = dirOf(p.team)
  const own = goalOf(g, p.team === 0 ? 1 : 0)
  const field = g.ps.filter((q) => q.team === p.team && !q.keeper && !q.human && !q.out).sort((a, c) => dist(a, b) - dist(c, b))
  const order = field.indexOf(p)
  const me = g.ps[g.me]
  const humanNearer = me && me.team === p.team && dist(me, b) < dist(p, b) - 1
  if (order === 0 && !humanNearer) {
    // Pressing flat out (they sprint too), goal side of the ball.
    const d = hyp(own[0] - b.x, own[1] - b.z) || 1
    runTo(p, b.x + ((own[0] - b.x) / d) * 0.8, b.z + ((own[1] - b.z) / d) * 0.8, 6.6)
    return engage(g, p, h, 0.5)
  }
  if (order === 1 || (order === 0 && humanNearer)) {
    // Covering: between the ball and the goal, a few metres off; in if the man gets past the first.
    const d = hyp(own[0] - b.x, own[1] - b.z) || 1
    runTo(p, b.x + ((own[0] - b.x) / d) * 4, b.z + ((own[1] - b.z) / d) * 4, 6.4)
    return engage(g, p, h, 0.3)
  }
  const [hx, hz] = SHAPE11[p.role]
  const bf = (b.x * dir) / F.x
  const fx = clamp(hx * 0.75 - 0.12 + bf * 0.45, -0.94, 0.35)
  let [x, z] = [fx * F.x * dir, clamp(hz * F.z * 0.8 + b.z * 0.3, -F.z + 1, F.z - 1)]
  // Near the box: the attacker nearest the zone, marked goal side.
  if (bf < -0.3) {
    const [man, md] = nearest(foes(g, p).filter((q) => !q.keeper && (q.x - own[0]) * -dir < F.x * 0.5), x, z)
    if (man && md < 9) {
      const d = hyp(own[0] - man.x, own[1] - man.z) || 1
      ;[x, z] = [man.x + ((own[0] - man.x) / d) * 1.5, man.z + ((own[1] - man.z) / d) * 1.5]
    }
  }
  runTo(p, x, z, 5.4)
}

function footDefend(g: Game, p: Player) {
  const b = g.ball
  const h = holder(g)
  const own = goalOf(g, p.team === 0 ? 1 : 0)
  // The nearest goes to the ball; the others mark their man, goal side.
  const presser = nearest(g.ps.filter((q) => q.team === p.team && !q.keeper && !q.human), b.x, b.z)[0]
  if (presser === p && (!g.ps[g.me] || g.ps[g.me].team !== p.team || dist(g.ps[g.me], b) > dist(p, b) - 1)) {
    const d = hyp(own[0] - b.x, own[1] - b.z) || 1
    runTo(p, b.x + ((own[0] - b.x) / d) * 0.8, b.z + ((own[1] - b.z) / d) * 0.8, fifa(g) ? 6.4 : 5.6)
    if (fifa(g)) return engage(g, p, h, 0.45)
    if (p.think > 0) return
    p.think = 0.45 + g.rnd() * 0.3
    if (h && dist(h, p) < 1.4 && p.cool <= 0 && g.rnd() < 0.3) defend(g, p)
    else if (h && dist(h, p) < 2.6 && dist(h, p) > 1.2 && speedOf(p) > 3.6 && g.rnd() < (g.referee ? 0.06 : 0.12)) defend(g, p)
    return
  }
  const man = g.ps.find((q) => q.team !== p.team && q.role === (p.role === 1 ? 4 : p.role === 4 ? 1 : p.role === 2 ? 3 : 2))!
  const d = hyp(own[0] - man.x, own[1] - man.z) || 1
  runTo(p, man.x + ((own[0] - man.x) / d) * 1.6, man.z + ((own[1] - man.z) / d) * 1.6, 5)
}

/**
 * The console's defenders on the man with the ball: they think quicker,
 * step in when he's within reach (more often on a harder level), and slide
 * now and then when he runs past.
 */
function engage(g: Game, p: Player, h: Player | null, will: number) {
  if (p.think > 0) return
  p.think = 0.22 + g.rnd() * 0.18
  if (!h || h.team === p.team || p.cool > 0) return
  const d = dist(h, p)
  if (d < 1.45 && g.rnd() < clamp(will * g.foe, 0.1, 0.85)) defend(g, p)
  else if (d < 2.6 && d > 1.2 && speedOf(p) > 3.6 && g.rnd() < 0.06 * g.foe) defend(g, p)
}

function keeperThink(g: Game, p: Player) {
  const b = g.ball
  const F = g.field
  const gx = p.team === 0 ? -F.x : F.x
  const dir = dirOf(p.team)
  // A penalty against him: on his line, in the middle, until it's struck.
  if (g.set?.kind === 'pen' && g.set.team !== p.team) return runTo(p, gx + dir * 0.3, 0, 2)
  // Holding it: a look, then out to someone free.
  if (b.owner === p.id) {
    p.want = [0, 0]
    if (p.act !== 'hold') startAct(p, 'hold', 1.1)
    if (p.at > 1) pass(g, p, null)
    return
  }
  const s = g.shot
  if (s && s.keeper === p.id) {
    // The shot: across to it (or, beaten, not quite there), diving when it's wide of him.
    const left = s.t - g.time
    const z = s.save ? s.z : s.z * 0.45
    if (Math.abs(z - p.z) > 0.55 && left < 0.4 && p.act === 'none') {
      startAct(p, 'dive', 1.3)
      p.side = z > p.z ? 1 : -1
      p.vz = p.side * (s.save ? 5.5 : 3.2)
      p.vx = 0
    } else runTo(p, gx + dir * 0.6, clamp(z, -F.mouth, F.mouth), 6)
    return
  }
  // A loose ball in his box (a cross coming down in it too): out to grab it.
  const [kx, kz] = g.size === 11 ? [8, 10] : [5.5, 5]
  const [lx, lz] = b.lofted ? landing(g) : [b.x, b.z]
  if (!holder(g) && Math.abs(lx - gx) < kx && Math.abs(lz) < kz && (b.y < 2 || b.lofted)) return runTo(p, b.lofted ? lx : b.x, b.lofted ? lz : b.z, 6)
  // On his line, across with the ball, a step out when it comes close.
  const out = clamp((g.size === 11 ? 7 : 5) - Math.abs(b.x - gx) * 0.2, 0.5, g.size === 11 ? 4 : 2.5)
  runTo(p, gx + dir * out, clamp(b.z * 0.25 * (F.mouth / 1.6), -F.mouth + 0.2, F.mouth - 0.2), 4)
}

/** The human the AI listens to on its team: one calling for the ball, else the local player. */
function callerFor(g: Game, p: Player) {
  return g.ps.find((q) => q.human && q.team === p.team && q.call > 0) ?? g.ps[g.me]
}

/* ---------- The step ---------- */

/**
 * One step of the match. `input` is the local player's hands; `others` the
 * other humans' at a court match (streetball/online.ts), by player index:
 * the phone running the match plays them all.
 */
export function step(g: Game, dt: number, input: Input, others?: Map<number, Input>) {
  g.time += dt
  // Time up; a draw with the golden goal plays on until somebody scores.
  const up = () => {
    if (g.time < g.length) return false
    if (g.golden && g.score[0] === g.score[1]) {
      if (!g.extra) {
        g.extra = true
        say(g, 'But en or : le premier qui marque gagne !')
      }
      return false
    }
    return true
  }
  if (g.phase === 'count') {
    if (g.time >= 0) g.phase = 'play'
    for (const p of g.ps) poseOf(g, p)
    moveBall(g, dt)
    return
  }
  if (g.phase === 'dead') {
    g.wait -= dt
    if (g.wait <= 0) {
      if (up()) g.phase = 'over'
      else {
        g.phase = 'play'
        const then = g.then
        g.then = null
        then?.()
      }
    }
  } else if (g.phase === 'play' && !g.ball.flight && !g.shot && up()) {
    g.phase = 'over'
    say(g, 'Fin du match !')
  }
  // The final whistle: the winners jump about.
  if (g.phase === 'over' && g.score[0] !== g.score[1])
    for (const p of g.ps) if (p.team === (g.score[0] > g.score[1] ? 0 : 1) && p.act === 'none' && !p.keeper) startAct(p, 'cheer', 60)
  const playing = g.phase === 'play'
  g.possT += dt
  // Taken back out past the arc: the team can score again.
  const h = holder(g)
  if (g.sport === 'basket' && !g.cleared && h && h.team === g.poss && fromHoop(h.x, h.z) > ARC + 0.2) {
    g.cleared = true
    g.possT = 0
  }
  // A penalty against the local team: its stick says where the keeper dives.
  if (g.set?.kind === 'pen' && g.set.team !== myTeam(g) && Math.abs(input.mz) > 0.4) g.penStick = input.mz > 0 ? 1 : -1
  // The players' hands: the local one's, and the others' at a court match.
  for (const p of g.ps) if (p.human && !p.out) hands(g, p, p.id === g.me ? input : (others?.get(p.id) ?? NO_INPUT), playing, dt)
  for (const p of g.ps) {
    if (p.out) {
      offPitch(g, p)
      continue
    }
    p.cool = Math.max(0, p.cool - dt)
    p.call = Math.max(0, p.call - dt)
    // The other side thinks quicker or slower by its strength.
    if (!p.human && playing) think(g, p, p.team === 1 ? dt * g.foe : dt)
    else if (!p.human) p.want = [0, 0]
    act(g, p, dt)
  }
  // A set piece: the AI takes its own after a moment; one left too long by the hands, too. The other side keeps its distance.
  const sp = g.set
  if (sp && playing) {
    const t = g.ps[sp.taker]
    const waited = g.time - sp.t
    if (t.out || g.ball.owner !== t.id) g.set = null
    else if ((!t.human && waited > (sp.kind === 'pen' ? 1.8 : 1.2)) || waited > 9) takeSetPiece(g, t)
    else
      for (const p of g.ps) {
        if (p.team === sp.team || p.out || (p.keeper && sp.kind === 'pen')) continue
        const d = hyp(p.x - sp.at[0], p.z - sp.at[1])
        const r = sp.kind === 'pen' ? Math.max(g.field.wall, 1) : g.field.wall
        if (d < r) {
          p.x = sp.at[0] + ((p.x - sp.at[0]) / (d || 1)) * r
          p.z = sp.at[1] + ((p.z - sp.at[1]) / (d || 1)) * r
        }
        if (sp.kind === 'pen' && inBox(g, sp.team === 0 ? 1 : 0, p.x, p.z)) p.x = sp.at[0] - dirOf(sp.team) * (g.field.wall + 1)
      }
  }
  // The referee: a little behind the play and to the side, facing the ball.
  if (g.referee && g.sport === 'foot') {
    const b = g.ball
    const side = g.size === 11 ? 9 : 4
    const [tx, tz] = [clamp(b.x * 0.85, -g.field.x + 4, g.field.x - 4), clamp(b.z + (b.z > 0 ? -side : side), -g.field.z + 1, g.field.z - 1)]
    const [dx, dz] = [tx - g.ref.x, tz - g.ref.z]
    const d = hyp(dx, dz)
    const v = Math.min(5.6, d * 1.5) * dt
    if (d > 0.05) {
      g.ref.x += (dx / d) * v
      g.ref.z += (dz / d) * v
    }
    g.ref.face = Math.atan2(b.x - g.ref.x, b.z - g.ref.z)
  }
  // Nobody walks through anybody.
  for (let i = 0; i < g.ps.length; i++)
    for (let j = i + 1; j < g.ps.length; j++) {
      const [a, c] = [g.ps[i], g.ps[j]]
      if (a.act === 'dunk' || c.act === 'dunk' || a.out || c.out) continue
      // A set piece's taker isn't pushed off the ball.
      if (g.set && (g.set.taker === a.id || g.set.taker === c.id)) continue
      const [dx, dz] = [c.x - a.x, c.z - a.z]
      const d = hyp(dx, dz)
      if (d > 0 && d < 0.62) {
        const k = (0.62 - d) / d / 2
        a.x -= dx * k
        a.z -= dz * k
        c.x += dx * k
        c.z += dz * k
      }
    }
  for (const p of g.ps) keepIn(g, p)
  moveBall(g, dt)
  if (playing) touches(g)
  for (const p of g.ps) poseOf(g, p)
  if (g.flash && g.time - g.flash.t > 2.2) g.flash = null
}

/** A human's stick and buttons, on its player. */
function hands(g: Game, me: Player, input: Input, playing: boolean, dt: number) {
  const foot = g.sport === 'foot'
  if (!playing || locked(me)) {
    if (!playing) me.want = [0, 0]
    if (!input.charge) me.charge = 0
    return
  }
  const m = Math.min(1, hyp(input.mx, input.mz))
  const has = g.ball.owner === me.id
  let top = input.guard && !has ? 3.6 : has ? (foot ? 5.6 : 5.2) : 6
  // Football: the sprint, for as long as the breath lasts; out of breath, slower.
  if (foot) {
    const sprinting = !!input.sprint && m > 0.3 && me.stamina > 0.04 && !input.guard
    if (sprinting) {
      top *= has ? 1.12 : 1.27
      me.stamina = Math.max(0, me.stamina - dt * 0.15)
    } else me.stamina = Math.min(1, me.stamina + dt * 0.07)
    if (me.stamina < 0.25) top *= 0.88 + me.stamina * 0.48
  }
  const set = g.set && g.set.taker === me.id ? g.set : null
  const l = hyp(input.mx, input.mz) || 1
  me.want = set ? [0, 0] : [(input.mx / l) * m * top, (input.mz / l) * m * top]
  if (input.guard && me.id === g.me) lastGuard = g.time
  const aim: V | null = m > 0.3 ? [input.mx, input.mz] : null
  // At a set piece the stick aims: the taker turns to it.
  if (set && aim) me.face = Math.atan2(aim[0], aim[1])
  if (!foot) {
    if (input.pass) has ? pass(g, me, aim) : call(me)
    if (input.shoot) has ? shoot(g, me, aim) : jump(g, me)
    if (input.skill && has) skill(g, me, aim)
    if (input.defend && !has) defend(g, me)
    return
  }
  // Football. Tir held where the hands can hold it: the power fills, the shot goes when it's let go.
  const holds = input.charge !== undefined
  if (has) {
    const pen = set?.kind === 'pen'
    const line = set && (set.kind === 'throw' || set.kind === 'corner') ? set.kind : null
    if (holds) {
      if (input.charge && line !== 'throw') me.charge = Math.min(1, me.charge + dt * 1.15)
      else if (me.charge > 0) {
        const power = 0.25 + me.charge * 0.75
        me.charge = 0
        if (line === 'corner') pass(g, me, aim, 'lob')
        else shoot(g, me, aim, power)
        return
      }
    } else if (input.shoot) {
      if (line === 'corner') pass(g, me, aim, 'lob')
      else if (line !== 'throw') shoot(g, me, aim)
    }
    if (pen) return
    if (input.pass) pass(g, me, aim, line === 'throw' ? 'throw' : 'ground')
    else if (input.through) pass(g, me, aim, line === 'throw' ? 'throw' : 'through')
    else if (input.lob) pass(g, me, aim, line === 'throw' ? 'throw' : 'lob')
    else if (input.skill && !set) skill(g, me, aim)
    return
  }
  me.charge = 0
  // Without the ball. The console: Changer (or Passe) to the team-mate nearest the ball; on a court, Passe calls for it.
  const swap = input.swap || (input.pass && g.switching)
  if (swap && g.switching && me.id === g.me) {
    const [lx, lz] = landing(g)
    const next = nearestMate(g, lx, lz, me)
    if (next) control(g, next)
    return
  }
  if (input.pass) call(me)
  if (input.defend || (input.shoot && g.switching)) defend(g, me)
}

/** A player's move going on, and the running. */
function act(g: Game, p: Player, dt: number) {
  p.at += dt
  if (p.pending && p.at >= p.pendingAt) {
    const f = p.pending
    p.pending = null
    f()
  }
  const k = 1 - Math.exp(-(p.act === 'cross' ? 2 : 9) * dt)
  if (p.act === 'dunk') {
    // Up to the ring and hanging there; then down.
    const e = Math.min(1, p.at / 0.5)
    const s = e * e * (3 - 2 * e)
    const [x, z] = [p.from[0] + (p.to[0] - p.from[0]) * s, p.from[1] + (p.to[1] - p.from[1]) * s]
    p.vx = (x - p.x) / Math.max(dt, 1e-3)
    p.vz = (z - p.z) / Math.max(dt, 1e-3)
    p.x = x
    p.z = z
  } else if (p.act === 'layup') {
    const e = Math.min(1, p.at / 0.45)
    p.x = p.from[0] + (p.to[0] - p.from[0]) * e
    p.z = p.from[1] + (p.to[1] - p.from[1]) * e
    p.vx = p.vz = 0
  } else if (p.act === 'slide') {
    // Sliding along the ground, slowing down.
    const drag = Math.exp(-2.6 * dt)
    p.vx *= drag
    p.vz *= drag
    p.x += p.vx * dt
    p.z += p.vz * dt
    // The feet through the ball: knocked away (or taken, at the end of the slide).
    const b = g.ball
    const [fx, fz] = fwd(p)
    const [px, pz] = [p.x + fx * 0.7, p.z + fz * 0.7]
    // The referee: the man taken before the ball, or from behind, is a foul.
    const on = holder(g)
    if (g.referee && !p.judged && on && on.team !== p.team && p.at > 0.1 && p.at < 0.75 && hyp(on.x - px, on.z - pz) < 0.8) {
      p.judged = true
      const ballFirst = hyp(b.x - px, b.z - pz) < 0.75
      const [hx, hz] = fwd(on)
      const behind = ((p.x - on.x) * hx + (p.z - on.z) * hz) / (dist(p, on) || 1) < -0.35
      if (g.rnd() < (behind ? 0.16 : ballFirst ? 0.02 : 0.07)) {
        foul(g, p, on, behind)
        return
      }
    }
    if (p.at > 0.12 && p.at < 0.7 && b.y < 0.5 && hyp(b.x - px, b.z - pz) < 0.75 && b.owner !== p.id) {
      const h = holder(g)
      b.owner = -1
      b.flight = null
      b.vx = fx * 6 + (g.rnd() - 0.5) * 3
      b.vz = fz * 6 + (g.rnd() - 0.5) * 3
      b.vy = 1.2
      b.lastTeam = p.team
      b.lastBy = p.id
      b.tried = [p.id]
      if (h) {
        startAct(h, 'beaten', 0.9)
        h.cool = 0.9
        say(g, p.human ? 'Tacle glissé ! Propre !' : 'Tacle glissé !')
        moment(g, 'tackle', p)
        if (p.id === g.me) g.stats.steals++
      }
    }
  } else if (p.act === 'dive') {
    const drag = Math.exp(-3 * dt)
    p.vz *= drag
    p.x += p.vx * dt
    p.z += p.vz * dt
  } else if (p.act === 'beaten') {
    p.vx *= Math.exp(-6 * dt)
    p.vz *= Math.exp(-6 * dt)
    p.x += p.vx * dt
    p.z += p.vz * dt
  } else if (p.act === 'shoot' || (p.act === 'block' && p.at < 0.6) || p.act === 'hold' || p.act === 'head' || p.act === 'throw') {
    p.vx *= Math.exp(-8 * dt)
    p.vz *= Math.exp(-8 * dt)
    p.x += p.vx * dt
    p.z += p.vz * dt
  } else if (p.act === 'celebrate') {
    // Off to the corner with the arms out.
    runTo(p, dirOf(p.team) * (g.field.x - 3), p.z > 0 ? g.field.z - 1.5 : -g.field.z + 1.5, 5.5)
    p.vx += (p.want[0] - p.vx) * k
    p.vz += (p.want[1] - p.vz) * k
    p.x += p.vx * dt
    p.z += p.vz * dt
  } else {
    // Running: easing to the speed wanted (a crossover's burst keeps going a moment); the other side a little faster or slower by its strength.
    const pace = p.team === 1 && !p.human ? clamp(0.8 + 0.2 * g.foe, 0.88, 1.03) : 1
    const [wx, wz] = p.act === 'cheer' ? [0, 0] : [p.want[0] * pace, p.want[1] * pace]
    p.vx += (wx - p.vx) * k
    p.vz += (wz - p.vz) * k
    p.x += p.vx * dt
    p.z += p.vz * dt
  }
  // Facing: where he runs; standing, the ball (or the ring).
  if (p.act === 'none' || p.act === 'cross' || p.act === 'celebrate') {
    const sp = speedOf(p)
    const b = g.ball
    const want = sp > 0.6 ? Math.atan2(p.vx, p.vz) : g.sport === 'basket' && b.owner === p.id ? Math.atan2(HOOP[0] - p.x, HOOP[1] - p.z) : Math.atan2(b.x - p.x, b.z - p.z)
    let d = want - p.face
    d = Math.atan2(Math.sin(d), Math.cos(d))
    p.face += d * (1 - Math.exp(-12 * dt))
  }
  if (p.act !== 'none' && p.at >= p.len) {
    p.act = 'none'
    p.flip = false
  }
}

/** Inside the fence (and off the keeper's line for the others, a little). */
function keepIn(g: Game, p: Player) {
  if (p.out) return
  if (g.sport === 'basket') {
    p.x = clamp(p.x, -COURT_FENCE.x + 0.4, COURT_FENCE.x - 0.4)
    p.z = clamp(p.z, COURT_FENCE.z0 + 0.4, COURT_FENCE.z1 - 0.4)
  } else if (g.field.walls) {
    p.x = clamp(p.x, -g.field.x - 0.6, g.field.x + 0.6)
    p.z = clamp(p.z, -g.field.z - 0.4, g.field.z + 0.4)
  } else {
    // A lined pitch: a few steps past the lines (a throw-in, a corner), not into the stands.
    p.x = clamp(p.x, -g.field.x - 3, g.field.x + 3)
    p.z = clamp(p.z, -g.field.z - 2.5, g.field.z + 2.5)
  }
}

/** The ball: in the hand bouncing, at the foot, in the air, rolling, off the fence, the board and the ring. */
function moveBall(g: Game, dt: number) {
  const b = g.ball
  const R = BALL_R[g.sport]
  const h = holder(g)
  if (h) {
    const [fx, fz] = fwd(h)
    const [rx, rz] = right(h)
    const sp = speedOf(h)
    b.phase += dt * (g.sport === 'basket' ? 7 + sp * 0.6 : 1.2 + sp * 0.32)
    if (g.sport === 'basket') {
      if (h.act === 'dunk' || h.act === 'layup' || h.act === 'shoot' || h.act === 'pass') {
        // In both hands: at the chest, then over the head.
        const up = h.act === 'dunk' ? 1.2 + 2.1 * Math.min(1, h.at / 0.55) : h.act === 'pass' ? 1.15 : 1.3 + Math.min(1, h.at / 0.4) * 1.1
        b.x = h.x + fx * 0.3
        b.z = h.z + fz * 0.3
        b.y = up
      } else {
        // The crossover takes it across low in front; the dribble is at the side, hand to floor and back.
        const cross = h.act === 'cross' ? Math.cos(Math.min(1, h.at / h.len) * Math.PI) : 1
        const hand = h.act === 'cross' ? -h.side * cross : h.side
        b.x = h.x + rx * hand * 0.32 + fx * 0.22
        b.z = h.z + rz * hand * 0.32 + fz * 0.22
        b.y = R + Math.abs(Math.sin(b.phase)) * (h.act === 'cross' ? 0.45 : 0.82)
      }
    } else if (g.set && g.set.taker === h.id) {
      // A dead ball: still on its spot (a throw-in over the head).
      b.x = g.set.at[0]
      b.z = g.set.at[1]
      b.y = g.set.kind === 'throw' ? 2.05 : R
    } else if (h.act === 'hold') {
      b.x = h.x + fx * 0.3
      b.z = h.z + fz * 0.3
      b.y = 1.05
    } else {
      // Little touches: the ball pushed ahead, the player catching it up.
      const push = sp > 0.7 ? 0.3 + 0.38 * (b.phase % 1) : 0.32
      b.x = h.x + fx * push
      b.z = h.z + fz * push
      b.y = R
    }
    b.vx = h.vx
    b.vz = h.vz
    b.vy = 0
    return
  }
  const f = b.flight
  if (f) {
    f.t += dt
    const k = Math.min(1, f.t / f.len)
    const [x0, y0, z0] = f.from
    const [x1, y1, z1] = f.to
    const px = b.x
    const pz = b.z
    b.x = x0 + (x1 - x0) * k
    b.z = z0 + (z1 - z0) * k
    b.y = f.kind === 'bounce' ? (k < 0.6 ? y0 - (y0 - R) * (k / 0.6) : R + (y1 - R) * ((k - 0.6) / 0.4)) : y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * f.apex
    b.vx = (b.x - px) / Math.max(dt, 1e-3)
    b.vz = (b.z - pz) / Math.max(dt, 1e-3)
    if (f.kind !== 'shot') {
      // Cut out on the way: an opponent close to the ball, below his reach.
      for (const q of g.ps) {
        if (q.team === f.team || f.tried.includes(q.id) || q.cool > 0) continue
        if (hyp(q.x - b.x, q.z - b.z) < 0.75 && b.y < 2.2) {
          f.tried.push(q.id)
          const chance = (f.kind === 'bounce' ? 0.12 : 0.26) + (q.act === 'steal' ? 0.25 : 0) + (q.act === 'block' ? 0.2 : 0)
          if (g.rnd() < chance) {
            give(g, q)
            say(g, 'Interception !')
            moment(g, 'steal', q)
            if (q.id === g.me) g.stats.steals++
            return
          }
        }
      }
    }
    if (k < 1) return
    b.flight = null
    if (f.kind === 'shot') {
      if (f.make) {
        // Through the net.
        b.x = HOOP[0]
        b.z = HOOP[1]
        b.y = RIM_Y - 0.05
        b.vx = b.vz = 0
        b.vy = -2.6
        b.dead = true
        g.swish = g.time
        scored(g, g.ps[f.by], f.points, false)
      } else {
        // Off the iron, out somewhere.
        const a = Math.atan2(b.z - HOOP[1], b.x - HOOP[0]) + (g.rnd() - 0.5) * 1.4
        const v = 2.2 + g.rnd() * 2
        b.vx = Math.cos(a) * v
        b.vz = Math.sin(a) * v
        if (b.vz < -0.5) b.vz = -b.vz * 0.6
        b.vy = 1.8 + g.rnd() * 1.6
        g.rim = { t: g.time, amp: 0.05 }
        if (g.rnd() < 0.4) say(g, 'Sur le cercle !')
      }
      return
    }
    // A pass: caught, or loose where it got to.
    const q = g.ps[f.target]
    if (q && hyp(q.x - b.x, q.z - b.z) < 1.25 && q.act !== 'beaten') give(g, q)
    else {
      b.vx = (x1 - x0) / f.len
      b.vz = (z1 - z0) / f.len
      b.vy = 0.5
    }
    return
  }
  // Free: gravity, the bounces, the roll.
  b.vy -= 9.8 * dt
  b.x += b.vx * dt
  b.y += b.vy * dt
  b.z += b.vz * dt
  if (b.y < R) {
    b.y = R
    // Down: no head can get to it now.
    b.lofted = false
    if (b.vy < -1.2) b.vy = -b.vy * (g.sport === 'basket' ? 0.62 : 0.5)
    else b.vy = 0
    // Rolling slows it.
    const v = hyp(b.vx, b.vz)
    if (v > 0) {
      const nv = Math.max(0, v - (g.sport === 'foot' ? 1.6 : 1.2) * dt)
      b.vx *= nv / v
      b.vz *= nv / v
    }
    if (b.dead && g.sport === 'basket' && b.vy === 0) b.dead = false
  }
  if (g.sport === 'basket') {
    // The board.
    if (b.z < BOARD_Z + R && b.z - b.vz * dt >= BOARD_Z + R && Math.abs(b.x) < 0.9 && b.y > 2.9 && b.y < 3.95) {
      b.z = BOARD_Z + R
      b.vz = -b.vz * 0.6
    }
    if (Math.abs(b.x) > COURT_FENCE.x - R) {
      b.x = Math.sign(b.x) * (COURT_FENCE.x - R)
      b.vx = -b.vx * 0.5
    }
    if (b.z < COURT_FENCE.z0 + R || b.z > COURT_FENCE.z1 - R) {
      b.z = clamp(b.z, COURT_FENCE.z0 + R, COURT_FENCE.z1 - R)
      b.vz = -b.vz * 0.5
    }
    return
  }
  footBall(g)
}

/** Football: the goal, the posts, the keeper, the boards round the pitch. */
function footBall(g: Game) {
  const b = g.ball
  const R = BALL_R.foot
  // The keeper gets to it.
  const s = g.shot
  if (s) {
    const k = g.ps[s.keeper]
    if (s.save && hyp(k.x - b.x, k.z - b.z) < (k.act === 'dive' ? 1.6 : 1.0) && b.y < 2.3 && Math.abs(b.x - k.x) < 0.8) {
      g.shot = null
      if (g.rnd() < 0.45 && b.y > 0.4) {
        give(g, k)
        say(g, 'Arrêt du gardien ! Il capte.')
      } else {
        // Pushed away.
        b.vx = -b.vx * 0.35
        b.vz = (g.rnd() - 0.5) * 8
        b.vy = 2.5
        b.lastTeam = k.team
        b.lastBy = k.id
        b.tried = []
        say(g, 'Arrêt du gardien !')
      }
      moment(g, 'save', k)
      return
    }
    if (g.time > s.t + 0.6) g.shot = null
  }
  const F = g.field
  const ex = F.x
  if (Math.abs(b.x) > ex) {
    const side = Math.sign(b.x)
    if (Math.abs(b.z) < F.mouth - R && b.y < F.bar - R && b.owner < 0) {
      // In: into the net, then the goal.
      if (Math.abs(b.x) > ex + 0.9) {
        b.x = side * (ex + 0.9)
        b.vx = 0
        b.vz *= 0.3
      }
      if (g.phase === 'play' && !b.dead) goal(g, side > 0 ? 0 : 1)
      return
    }
    const post = Math.abs(b.z) < F.mouth + 0.15 && Math.abs(b.z) > F.mouth - R - 0.1 && b.y < F.bar + 0.1
    if (post && !b.dead && g.phase === 'play') {
      say(g, 'Poteau !')
      const p = g.ps[b.lastBy]
      if (p) moment(g, 'post', p)
    }
    if (!b.dead && (F.walls || post)) {
      // Off the boards (the maracana), or off the post.
      b.x = side * ex
      b.vx = -b.vx * 0.55
      g.shot = null
    } else if (!b.dead && g.phase === 'play' && !g.set && Math.abs(b.x) > ex + R) {
      // Over the goal line: a corner if the side defending it touched it last, else a goal kick.
      const defending: 0 | 1 = side > 0 ? 1 : 0
      b.dead = true
      if (b.lastTeam === defending) outOfPlay(g, 'corner', defending === 1 ? 0 : 1, [side * ex, b.z])
      else outOfPlay(g, 'goal', defending, [side * ex, b.z])
    }
  }
  if (Math.abs(b.z) > F.z + (F.walls ? 0.6 : R)) {
    if (F.walls) {
      b.z = Math.sign(b.z) * (F.z + 0.6)
      b.vz = -b.vz * 0.55
    } else if (!b.dead && g.phase === 'play' && !g.set) {
      // Over the touchline: a throw-in to the other side.
      b.dead = true
      outOfPlay(g, 'throw', b.lastTeam === 0 ? 1 : 0, [b.x, b.z])
    }
  }
}

function goal(g: Game, team: 0 | 1) {
  const b = g.ball
  b.dead = true
  g.shot = null
  g.score[team]++
  const by = g.ps[b.lastBy]
  const scorer = by && by.team === team ? by : (g.ps.find((p) => p.team === team && p.role === striker(g) && !p.out) ?? g.ps.find((p) => p.team === team)!)
  if (scorer.id === g.me) g.stats.goals++
  else if (team === g.ps[g.me].team && g.lastPass?.mine && g.lastPass.team === team && g.time - g.lastPass.t < 5) g.stats.assists++
  say(g, scorer.id === g.me ? 'BUUUT !!! Tu as marqué !' : team === myTeam(g) ? `BUUUT ! ${scorer.name} !` : 'But pour eux…')
  g.set = null
  moment(g, 'goal', scorer)
  g.phase = 'dead'
  g.wait = 3.6
  // The scorer off to the corner, arms out; his team after him.
  startAct(scorer, 'celebrate', 3.4)
  for (const p of g.ps) if (p.team === team && p !== scorer && !p.keeper) startAct(p, 'cheer', 3.2)
  g.then = () => restart(g, team === 0 ? 1 : 0)
}

/** Who gets the loose ball: the first close enough (football: the one it was meant for, or anyone who controls it). */
function touches(g: Game) {
  const b = g.ball
  if (b.owner >= 0 || b.flight || b.dead || g.set) return
  const foot = g.sport === 'foot'
  for (const p of g.ps) {
    if (p.out || p.cool > 0 || p.act === 'beaten' || p.act === 'celebrate' || (p.act === 'slide' && p.at < 0.7)) continue
    const d = hyp(p.x - b.x, p.z - b.z)
    // A ball in the air at head height: in the box, headed (at goal, or away); elsewhere taken on the chest if it isn't too high.
    if (foot && !p.keeper && b.lofted && b.y > 0.9 && b.y < 2.5 && d < 0.9) {
      if (inBox(g, p.team === 0 ? 1 : 0, p.x, p.z) || (inBox(g, p.team, p.x, p.z) && b.lastTeam !== p.team)) {
        header(g, p)
        return
      }
      if (b.y < 1.6) {
        give(g, p)
        return
      }
      continue
    }
    const jumping = p.act === 'block' && p.at > 0.12 && p.at < 0.6
    const reach = foot ? (p.keeper ? 0.95 : 0.6) : 0.75
    const high = foot ? (p.keeper ? 2.3 : 0.9) : jumping ? 3.4 : 2.0
    if (d > reach || b.y > high) continue
    // A hard ball isn't always controlled.
    if (foot && !p.keeper && b.lastTeam !== p.team && !b.tried.includes(p.id) && hyp(b.vx, b.vz) > 9) {
      b.tried.push(p.id)
      if (g.rnd() < 0.35) {
        b.vx *= -0.3
        b.vz = (g.rnd() - 0.5) * 6
        continue
      }
    }
    // In the box, a keeper only takes it in his own half.
    if (p.keeper && Math.abs(p.x - (p.team === 0 ? -g.field.x : g.field.x)) > (g.size === 11 ? g.field.box[0] : 6)) continue
    if (!foot && jumping) say(g, p.team === g.poss ? 'Rebond offensif !' : 'Rebond !')
    give(g, p)
    return
  }
}

/** The pose that shows what a player is doing. */
function poseOf(g: Game, p: Player) {
  const foot = g.sport === 'foot'
  const sp = speedOf(p)
  const has = g.ball.owner === p.id
  const h = holder(g)
  let pose: Pose
  switch (p.act) {
    case 'dunk':
      pose = 'dunk'
      break
    case 'layup':
      pose = 'layup'
      break
    case 'shoot':
      pose = 'shoot'
      break
    case 'pass':
      pose = p.side < 0 ? 'bouncepass' : 'pass'
      break
    case 'kick':
      pose = 'kick'
      break
    case 'head':
      pose = 'leap'
      break
    case 'throw':
      pose = 'pass'
      break
    case 'cross':
      pose = 'crossover'
      break
    case 'steal':
      pose = 'steal'
      break
    case 'block':
      pose = 'block'
      break
    case 'slide':
      pose = 'slide'
      break
    case 'beaten':
      pose = 'stumble'
      break
    case 'dive':
      pose = 'dive'
      break
    case 'hold':
      pose = 'keeper'
      break
    case 'celebrate':
      pose = 'airplane'
      break
    case 'cheer':
      pose = 'cheer'
      break
    default:
      if (has) pose = foot ? (sp > 0.7 ? 'touch' : 'idle') : 'dribble'
      else if (p.keeper && foot && Math.abs(g.ball.x - (p.team === 0 ? -g.field.x : g.field.x)) < (g.size === 11 ? 30 : 14)) pose = 'keeper'
      else if (g.set && g.set.taker === p.id && g.set.kind === 'throw') pose = 'pass'
      else if (h && h.team !== p.team && dist(h, p) < (foot ? 2.6 : 2) && sp < 4.2) pose = foot ? 'mark' : 'guard'
      else if (p.human && sp < 4 && g.time - lastGuard < 0.15 && !has) pose = foot ? 'mark' : 'guard'
      else pose = sp > 3.4 ? 'run' : sp > 0.45 ? 'walk' : 'idle'
  }
  p.pose = pose
  // The dive goes to the body's +x: mirrored for the other side.
  if (p.act === 'dive') {
    p.flip = right(p)[1] * p.side < 0
  }
}

/* ---------- For the screen ---------- */

/** What the buttons do now, for their labels. */
export function buttons(g: Game) {
  const me = g.ps[g.me]
  const has = g.ball.owner === me.id
  const dunk = g.sport === 'basket' && has && fromHoop(me.x, me.z) < 3.8 && speedOf(me) > 2.2
  return { has, dunk }
}

/** The result for the player's team. */
export function outcome(g: Game) {
  // From the local player's side: at a court match it may be the other team.
  const [a, b] = g.ps[g.me].team === 0 ? g.score : [g.score[1], g.score[0]]
  return a > b ? 'win' : a < b ? 'loss' : 'draw'
}
