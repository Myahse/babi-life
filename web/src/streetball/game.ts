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
//
// And the street's own football, « le foot de rue » (Rules.street): four
// against four on a little pitch of beaten earth between walls (the ball
// comes back off them), small iron goals, a keeper who comes out (le gardien
// volant), the first to five; and the moves (Geste): the stepover, the
// Marseille turn, the nutmeg, the sombrero, the fake shot, the flick, the
// back-heel, the keepy-ups. Done in front of a man at the right moment, he's
// beaten; too late, he takes it. Each one fills the style gauge, and full, the
// next shot is the « Gbê ».
//
// And the street's basketball, « le basket de rue » (Rules.street with
// basketball): three against three under one iron hoop on the quarter's
// concrete, the fourth of each side waiting behind the wall; 1 point a basket,
// 2 from past the arc, the first to 11 (else 3 minutes, then the next basket
// wins), the side that scores keeps the ball (make it, take it); the moves
// (Geste): the crossover, between the legs, behind the back, the spin, the
// hesitation, the dribble show, the pump fake, the step-back. The man in front
// beaten breaks his ankles (down on his backside), turns round, or stands
// frozen; too late, he steals it. The gauge full, the next shot is the
// basket's Gbê: a flying dunk from far out that bends the iron, or a shot in
// flames; a pass to a team-mate running in by the ring goes up for the
// alley-oop.

export type Sport = 'basket' | 'foot'
type V = [number, number]

/** The street's skill moves (Rules.street): the football's, then le basket de rue's. */
export type Geste = 'passement' | 'roulette' | 'petitpont' | 'sombrero' | 'crochet' | 'aile' | 'talonnade' | 'jongle' | HoopGeste
export type HoopGeste = 'crossover' | 'entrejambe' | 'dos' | 'spin' | 'hesitation' | 'show' | 'pompe' | 'stepback'
// (In this order on the wire: streetball/online.ts.)
export const GESTES: Geste[] = ['passement', 'roulette', 'petitpont', 'sombrero', 'crochet', 'aile', 'talonnade', 'jongle', 'crossover', 'entrejambe', 'dos', 'spin', 'hesitation', 'show', 'pompe', 'stepback']

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
  /** The street: a skill move (a press), and the keepy-ups (held; basketball, the dribble show). */
  geste?: Geste | null
  juggle?: boolean
}
export const NO_INPUT: Input = { mx: 0, mz: 0, pass: false, shoot: false, skill: false, defend: false, guard: false }

/** Le basket de rue: the points that win it. */
export const HOOP_TO = 11
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
/** The street's pitch: about 25 by 14, walls all round, goals of welded iron a little over two metres wide. */
export const STREET: Field = { x: 12.5, z: 7, mouth: 1.15, bar: 1.25, box: [3.6, 3.4], spot: 4, walls: true, wall: 3 }
/** The maracana's, as before the stadium (the street, the courts). */
export const PITCH = FIELDS[5]
export const MOUTH = PITCH.mouth
export const BAR = PITCH.bar
const BALL_R = { basket: 0.12, foot: 0.11 }

/* ---------- Who's on it ---------- */

export type Act = 'none' | 'pass' | 'shoot' | 'dunk' | 'layup' | 'cross' | 'steal' | 'block' | 'slide' | 'beaten' | 'kick' | 'dive' | 'hold' | 'celebrate' | 'cheer' | 'head' | 'throw' | 'geste' | 'juggle'

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
  /** Basketball: a jump shot on the meter (Tir held), how far it has filled (0 to 1; −1: none). */
  meter: number
  /** The street: the move going on, the style gauge (0…1, full: the Gbê), how a beaten man was fooled (basketball: down on his backside, turned round, frozen, up for a pump fake), a count of moves (the pose starts over), the facing when the move began. */
  move: Geste | null
  style: number
  fooled: 'legs' | 'sky' | 'shot' | 'wrong' | 'ankles' | 'turned' | 'frozen' | 'jump' | null
  take: number
  face0: number
  /** The last move and when (the same one twice in a row is read; showing off counts once in a while). */
  last: Geste | null
  lastT: number
  /** A move's run round the man beaten (where to), and how far it turns the body (the back-heel turning back with the ball). */
  way: V | null
  turn: number
  /** Le basket de rue: this dunk is the Gbê (flying in from far out). */
  gbe: boolean
}

/** Something worth cheering, filming and posting. */
export type Moment = { kind: 'dunk' | 'basket' | 'three' | 'goal' | 'block' | 'steal' | 'ankle' | 'save' | 'tackle' | 'post' | 'foul' | 'card' | 'geste' | 'gbe'; team: 0 | 1; by: number; t: number }

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
  /** The console's football: where the ball is from the feet of the one who has it (eased, so it never jumps). */
  rel?: V
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
  /** A draw at the end goes to penalties (the cup); the shoot-out once it's begun. */
  pens: boolean
  shootout: Shootout | null
  /** Le foot de rue (and le basket de rue): its rules and moves; the goals that win it (basketball: the points; 0: none); when the last Gbê was struck. */
  street: boolean
  goals: number
  gbe: number
  /** Le basket de rue, four players who came on one side: whose turn it is to wait behind the wall. */
  rota: [number, number]
}

/** The penalty shoot-out: each side's kicks so far (in or not), whose turn, the one taking it, when it was struck (-1: not yet). */
export type Shootout = { kicks: [boolean[], boolean[]]; turn: 0 | 1; taker: number; t: number }

/** A dead ball about to be played: who takes it, from where, since when; the others kept back. */
export type SetPiece = { kind: 'free' | 'pen' | 'corner' | 'throw' | 'goal'; team: 0 | 1; taker: number; at: V; t: number }

/**
 * A match's rules, if not the street's (the console's, at the salle de jeux):
 * how long, how good the other side is (1 as in the street), a draw played on
 * to the golden goal or to penalties. Football also: eleven a side at the stadium (else the
 * maracana's five), the player switching team-mates (the console: one team in
 * one pair of hands), a referee (fouls, free kicks, penalties, cards), and the
 * teams' names by place in the team (the player's own name goes on `me`).
 */
export type Rules = { length?: number; foe?: number; golden?: boolean; shootout?: boolean; size?: 5 | 11; switching?: boolean; referee?: boolean; names?: [string[], string[]]; /** Le foot de rue: four a side, the moves, the first to five; basketball, le basket de rue: the moves, the first to 11. */ street?: boolean }

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
  return { id, team, human: false, keeper: false, name, role, x, z, vx: 0, vz: 0, face: 0, want: [0, 0], act: 'none', at: 0, len: 0, side: 1, cool: 0, think: 0, call: 0, from: [0, 0], to: [0, 0], pending: null, pendingAt: 0, spot: role, pose: 'idle', flip: false, stamina: 1, charge: 0, cards: 0, out: false, judged: false, meter: -1, move: null, style: 0, fooled: null, take: 0, face0: 0, last: null, lastT: -9, way: null, turn: 0, gbe: false }
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
    // Le basket de rue: a fourth each side (after the six, so a court's places stay as they were), next in, behind the wall.
    if (rules.street) for (const team of [0, 1] as const) ps.push(makePlayer(6 + team, team, 3, team === 0 ? NAMES.mates[2] : NAMES.them[3], 0, 0))
  } else if (size === 11) {
    // 11 against 11: the player starts up front (the kick-off is theirs), and takes over whoever the play needs.
    const names = rules.names ?? [ELEVEN.mates, ELEVEN.them]
    for (const team of [0, 1] as const) for (let i = 0; i < 11; i++) ps.push(makePlayer(team * 11 + i, team, i, names[team][i] ?? (team === 0 ? ELEVEN.mates : ELEVEN.them)[i], 0, 0))
    ps[9].name = name
    for (const p of ps) p.keeper = p.role === 0
  } else {
    // 5 against 5: a keeper, a back, two wings, one up front; the player on a wing.
    for (let i = 0; i < 5; i++) ps.push(makePlayer(i, 0, i, i === 2 ? name : (rules.names?.[0][i] ?? NAMES.mates[i < 2 ? i : i - 1]), 0, 0))
    for (let i = 0; i < 5; i++) ps.push(makePlayer(5 + i, 1, i, rules.names?.[1][i] ?? NAMES.them[i], 0, 0))
    for (const p of ps) p.keeper = p.role === 0
  }
  // The street: four a side. The fifth (the place 0) waits behind the wall; the one at the back keeps goal, and comes out with it.
  const street = size === 5 && !!rules.street
  if (street && sport === 'foot')
    for (const p of ps) {
      p.out = p.role === 0
      p.keeper = p.role === 1
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
    golden: rules.golden ?? street,
    extra: false,
    field: street && sport === 'foot' ? STREET : FIELDS[size],
    size,
    switching: !!rules.switching,
    referee: !!rules.referee,
    set: null,
    ref: { x: 0, z: -6, face: 0, whistle: -9 },
    penStick: null,
    pens: !!rules.shootout,
    shootout: null,
    street,
    goals: street ? (sport === 'basket' ? HOOP_TO : 5) : 0,
    gbe: -9,
    rota: [0, 0],
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
const locked = (p: Player) => p.act === 'geste' || p.act === 'dunk' || p.act === 'layup' || p.act === 'shoot' || p.act === 'slide' || p.act === 'beaten' || p.act === 'dive' || p.act === 'celebrate' || p.act === 'head' || (p.act === 'block' && p.at < 0.6)

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
    // Le basket de rue: who's on, who waits behind the wall.
    if (g.street) {
      lineup(g, g.phase !== 'count')
      for (const p of g.ps) if (p.out) offPitch(g, p)
    }
    const att = g.ps.filter((p) => p.team === team && !p.out)
    const def = g.ps.filter((p) => p.team !== team && !p.out)
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
        const SPOT: V[] = g.street
          ? [
              [-F.x + 0.8, 0],
              [-F.x + 0.7, 0],
              [-3.4, -3.2],
              [-3.4, 3.2],
              own ? [-0.4, 0] : [-3, 0],
            ]
          : [
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
  // The street's one waiting: behind the far wall with the others watching.
  if (g.street) [p.x, p.z] = [(p.team === 0 ? -3.4 : 3.4) - p.role * 0.7, -g.field.z - 1.7]
  p.vx = p.vz = 0
  p.want = [0, 0]
  p.face = g.street ? 0 : Math.PI
  // Le basket de rue's: behind the side wall by the basket, his side's, with the people leaning on it.
  if (g.sport === 'basket') {
    const s = p.team === 0 ? -1 : 1
    ;[p.x, p.z] = [s * (COURT_FENCE.x + 0.85), -6.9]
    p.face = -s * (Math.PI / 2)
  }
  p.act = 'none'
}

/**
 * Le basket de rue: three a side on the court, the fourth behind the wall.
 * The players who came play before the quarter's (the last of those waits);
 * four who came on one side take turns (the last come first), one sitting out each basket (`turn`:
 * the next one's turn now). Whether anyone changed places.
 */
function lineup(g: Game, turn: boolean) {
  let moved = false
  for (const team of [0, 1] as const) {
    const side = g.ps.filter((p) => p.team === team)
    const humans = side.filter((p) => p.human)
    const sit = humans.length >= side.length ? humans[((turn ? ++g.rota[team] : g.rota[team]) + humans.length - 1) % humans.length] : [...side].reverse().find((p) => !p.human)!
    for (const p of side) {
      if (p.out !== (p === sit)) moved = true
      p.out = p === sit
    }
  }
  return moved
}

/** Le basket de rue, before the whistle: the players who came onto the court (the fourth's place behind the wall). */
export function seat(g: Game) {
  if (g.sport === 'basket' && g.street && g.phase === 'count' && lineup(g, false)) restart(g, 0)
}

/** The ball into someone's hands (or at their feet). */
function give(g: Game, p: Player) {
  const b = g.ball
  const changed = p.team !== g.poss
  b.owner = p.id
  b.rel = undefined
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
    // Le basket de rue: a team-mate running in by the ring with room gets it up over it, the alley-oop.
    if (g.street && alleyFor(g, p, to)) return alley(g, p, to)
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

/**
 * Basketball's shot meter (a player with Tir held: the hands' input.charge): the jump
 * shot goes up as Tir is pressed, the meter fills while it's held, the ball leaves
 * when it's let go; let go in the green (METER_GOOD), « Parfait ! », it goes in far
 * more often; too soon or too late, less. Without the meter (the AI, a phone
 * without it), the shot as it always was.
 */
export const METER_GOOD: [number, number] = [0.72, 0.9]
const METER_FILL = 1.25 // per second: full in 0,8 s
const METER_OVER = 1.05 // held past this: it goes by itself, late

/** Tir: a jump shot, a layup close in, a dunk with a run-up at the ring; football, a shot at goal (the stick aims it). `metered`: basketball's jump shot on the meter. */
export function shoot(g: Game, p: Player, aim: V | null, power?: number, metered = false) {
  const b = g.ball
  if (b.owner !== p.id || locked(p)) return
  if (g.sport === 'foot') return kickAtGoal(g, p, aim, power)
  // Le basket de rue: the gauge full, the Gbê.
  if (g.street && p.style >= 1) return hoopGbe(g, p)
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
  // The jump shot: up, released at the top (on the meter: when Tir is let go).
  startAct(p, 'shoot', metered ? 1.3 : 0.8)
  p.vx *= 0.2
  p.vz *= 0.2
  p.face = Math.atan2(HOOP[0] - p.x, HOOP[1] - p.z)
  if (metered) {
    p.meter = 0
    p.pending = null
    return
  }
  const chance = jumpChance(d)
  p.pending = () => release(g, p, chance, 0.75 + d * 0.05)
  p.pendingAt = 0.42
}

/** A jump shot's chance from so far (before the man guarding takes some off). */
const jumpChance = (d: number) => (d < 3.5 ? 0.6 : d <= ARC ? 0.47 : 0.37)

/** The meter let go (or run over): the shot leaves, its chance from where the meter stood. */
function letGo(g: Game, p: Player) {
  const q = Math.min(1, p.meter)
  p.meter = -1
  const d = fromHoop(p.x, p.z)
  const base = jumpChance(d)
  const [lo, hi] = METER_GOOD
  let chance: number
  if (q >= lo && q <= hi) {
    chance = Math.min(0.9, base + 0.3)
    if (p.human) say(g, 'Parfait !')
  } else {
    // The further off the green, the less it goes in.
    const off = q < lo ? lo - q : q - hi
    chance = base * Math.max(0.25, 1 - off * 2.2)
    if (p.human) say(g, q < lo ? 'Trop tôt !' : 'Trop tard !')
  }
  release(g, p, chance, 0.75 + d * 0.05)
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

/** The ball let go towards the ring: in or out is decided now (the man guarding takes some off; not off the Gbê's, `sure`). */
function release(g: Game, p: Player, chance: number, len: number, sure = false) {
  const b = g.ball
  const d = fromHoop(p.x, p.z)
  const q = sure ? null : guardOf(g, p)
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

/** The dunk goes down through the ring: the ring pulled down, the net flying, two hands on the iron (the alley-oop's, the Gbê's: `how`). */
function dunkThrough(g: Game, p: Player, how?: 'alley' | 'gbe') {
  const b = g.ball
  b.owner = -1
  b.flight = null
  b.x = HOOP[0]
  b.z = HOOP[1]
  b.y = RIM_Y - 0.05
  b.vx = b.vz = 0
  b.vy = -3.5
  b.dead = true
  g.rim = { t: g.time, amp: how === 'gbe' ? 0.32 : 0.16 }
  g.swish = g.time
  scored(g, p, 1, true, how)
}

/** A basket: the points (if the ball went out past the arc first), the crowd, then the others check it at the top. */
function scored(g: Game, p: Player, points: number, dunk: boolean, how?: 'alley' | 'gbe') {
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
  say(g, how === 'alley' ? 'ALLEY-OOP !!!' : how === 'gbe' ? 'GBÊÊÊ !!! Le cercle a plié !' : dunk ? (p.human ? 'DUNK !!! Le terrain explose !' : 'DUNK !!!') : points === 2 ? 'De loin ! 2 points !' : 'Paniiier !')
  moment(g, dunk ? 'dunk' : points === 2 ? 'three' : 'basket', p)
  g.phase = 'dead'
  g.wait = dunk ? 2.4 : 1.5
  // Le basket de rue: make it, take it (the side that scored checks it again).
  g.then = () => restart(g, g.street ? p.team : other)
  // The others cheer him.
  for (const q of g.ps) if (q.team === p.team && q !== p && !locked(q)) startAct(q, 'cheer', g.wait)
}

/* ---------- Le basket de rue's flights ---------- */

/** The Gbê's dunk: from this close (m), else the shot in flames. */
export const GBE_REACH = 7.5

/** An alley-oop to `q`: running in near the ring, nobody on him, far enough from the pass (the AI's passer sees it about half the time). */
function alleyFor(g: Game, p: Player, q: Player) {
  const d = fromHoop(q.x, q.z)
  if (d > 3.4 || d < 0.9 || dist(p, q) < 2.6 || q.act !== 'none' || q.out) return false
  if (nearest(foes(g, q), q.x, q.z)[1] < 0.95) return false
  return p.human || g.rnd() < 0.55
}

/** The alley-oop: lobbed up by the ring, the team-mate going up to meet it, caught at the top and put down through. */
function alley(g: Game, p: Player, q: Player) {
  const b = g.ball
  const d = fromHoop(q.x, q.z) || 1
  const [ux, uz] = [(q.x - HOOP[0]) / d, (q.z - HOOP[1]) / d]
  const len = 0.62
  const [fx, fz] = fwd(p)
  // (Lobbed from over the head: over the hands of the man in front.)
  b.flight = { kind: 'pass', from: [p.x + fx * 0.35, 2.3, p.z + fz * 0.35], to: [HOOP[0] + ux * 0.45, 2.85, HOOP[1] + uz * 0.45], t: 0, len, apex: 1.0, by: p.id, team: p.team, target: q.id, make: false, points: 0, tried: [] }
  startAct(p, 'pass', 0.35)
  p.side = 1
  p.face = Math.atan2(HOOP[0] - p.x, HOOP[1] - p.z)
  if (p.human) say(g, 'Alley-oop !')
  // Up off the ground as it comes: there at the top, the ball in his hands, down through the ring.
  startAct(q, 'dunk', 1.7)
  q.gbe = false
  q.from = [q.x, q.z]
  q.to = [HOOP[0] + ux * 0.32, HOOP[1] + uz * 0.32]
  q.face = Math.atan2(HOOP[0] - q.x, HOOP[1] - q.z)
  q.pending = () => {
    // Cut out on its way, or not there: down again with nothing.
    if (b.owner !== q.id) {
      q.len = Math.min(q.len, q.at + 0.5)
      return
    }
    q.pending = () => dunkThrough(g, q, 'alley')
    q.pendingAt = q.at + 0.14
  }
  q.pendingAt = len + 0.06
}

/**
 * The basket's Gbê: the gauge full, the next shot. Near enough, a run and a
 * flight from far out to the ring, the ball swung round and thrown down, the
 * iron bent (a hand gets to it once in a long while); further, a shot in
 * flames that hardly ever misses.
 */
function hoopGbe(g: Game, p: Player) {
  const d = fromHoop(p.x, p.z)
  p.style = 0
  p.meter = -1
  g.gbe = g.time
  moment(g, 'gbe', p)
  p.face = Math.atan2(HOOP[0] - p.x, HOOP[1] - p.z)
  if (d < GBE_REACH) {
    say(g, p.human ? 'GBÊÊÊ !!! Il s’envole !' : `Le Gbê de ${p.name} !`)
    startAct(p, 'dunk', 1.9)
    p.gbe = true
    p.from = [p.x, p.z]
    p.to = [HOOP[0] + ((p.x - HOOP[0]) / (d || 1)) * 0.32, HOOP[1] + ((p.z - HOOP[1]) / (d || 1)) * 0.32]
    const blocker = guardOf(g, p)
    p.pending = () => {
      if (blocker && dist(blocker, p) < 1.3 && g.rnd() < 0.07) return swat(g, blocker, p)
      p.pending = () => dunkThrough(g, p, 'gbe')
      p.pendingAt = 0.95
    }
    p.pendingAt = 0.5
    return
  }
  say(g, p.human ? 'GBÊÊÊ !!! En feu !' : `Le Gbê de ${p.name} !`)
  startAct(p, 'shoot', 0.8)
  p.vx *= 0.2
  p.vz *= 0.2
  p.pending = () => release(g, p, 0.93, 0.8 + d * 0.04, true)
  p.pendingAt = 0.42
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
  // The street: the gauge full, the Gbê.
  if (g.street && p.style >= 1) return gbe(g, p, aim)
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
  // The street's little goals: lower.
  if (g.street) h *= F.bar / 2
  fire(g, p, goal, z, h, speed, 'kick')
  if (g.set?.taker === p.id) g.set = null
}

/** A shot leaves the foot (or the head) for (goalX, z) at height h: the keeper's chance worked out now. */
function fire(g: Game, p: Player, goal: V, z: number, h: number, speed: number, act: 'kick' | 'head', /** The Gbê: hardly ever saved. */ sure = false) {
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
      // (In a shoot-out a right guess saves it a little less often: most kicks go in.)
      save = onTarget && guess === side && g.rnd() < (Math.abs(z) > F.mouth * 0.8 ? 0.35 : g.shootout ? 0.55 : 0.75) * good
      keeper.side = guess >= 0 ? 1 : -1
      if (guess !== 0) {
        startAct(keeper, 'dive', 1.3)
        keeper.vz = guess * (save ? 5.5 : 4.5)
        keeper.vx = 0
      }
    } else if (sure) save = onTarget && g.rnd() < 0.07
    else save = onTarget && g.rnd() < clamp((0.62 + (T - 0.6) * 0.5 - reach * 0.2 * (1.6 / F.mouth) - (Math.abs(z) > 1.1 * (F.mouth / 1.6) ? 0.12 : 0) - (act === 'head' ? 0.08 : 0)) * good, 0.08, 0.88)
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

/* ---------- The street's moves ---------- */

/**
 * Each move: how long it lasts, when it bites (the man beaten, the ball
 * off), its chance against a man met at the right distance, the style it's
 * worth, what the crowd calls it.
 */
const MOVES: Record<Geste, { len: number; at: number; chance: number; style: number; name: string }> = {
  passement: { len: 0.62, at: 0.4, chance: 0.8, style: 0.2, name: 'Passement de jambes !' },
  roulette: { len: 0.74, at: 0.6, chance: 0.76, style: 0.26, name: 'La roulette !' },
  petitpont: { len: 0.85, at: 0.14, chance: 0.62, style: 0.34, name: 'PETIT PONT !' },
  sombrero: { len: 1.05, at: 0.3, chance: 0.64, style: 0.34, name: 'Sombrero !' },
  crochet: { len: 0.58, at: 0.32, chance: 0.78, style: 0.18, name: 'Feinte de frappe !' },
  aile: { len: 0.45, at: 0.14, chance: 0.82, style: 0.22, name: 'Aile de pigeon !' },
  talonnade: { len: 0.45, at: 0.14, chance: 0.82, style: 0.2, name: 'Talonnade !' },
  jongle: { len: 60, at: 0, chance: 0, style: 0, name: 'Les jongles !' },
  // Le basket de rue's.
  crossover: { len: 0.5, at: 0.24, chance: 0.78, style: 0.2, name: 'Crossover !' },
  entrejambe: { len: 0.56, at: 0.28, chance: 0.74, style: 0.24, name: 'Entre les jambes !' },
  dos: { len: 0.6, at: 0.3, chance: 0.72, style: 0.26, name: 'Dans le dos !' },
  spin: { len: 0.72, at: 0.42, chance: 0.74, style: 0.3, name: 'Spin move !' },
  hesitation: { len: 0.7, at: 0.42, chance: 0.76, style: 0.22, name: 'Hésitation !' },
  show: { len: 60, at: 0, chance: 0, style: 0, name: 'Le show !' },
  pompe: { len: 0.62, at: 0.32, chance: 0.75, style: 0.2, name: 'Feinte de tir !' },
  stepback: { len: 0.55, at: 0.2, chance: 0.8, style: 0.24, name: 'Step-back !' },
}
/** The moves the AI likes (the stepover and the fake shot more). */
const AI_MOVES: Geste[] = ['passement', 'passement', 'roulette', 'petitpont', 'sombrero', 'crochet', 'crochet', 'aile']
const GESTE_POSE: Record<Geste, Pose> = { passement: 'stepover', roulette: 'roulette', petitpont: 'poke', sombrero: 'rainbow', crochet: 'feint', aile: 'flick', talonnade: 'backheel', jongle: 'juggle', crossover: 'crossover', entrejambe: 'between', dos: 'backdribble', spin: 'spinmove', hesitation: 'hesi', show: 'dribbleshow', pompe: 'pumpfake', stepback: 'stepback' }
/** The moves the AI likes on the court (the crossover more). */
const AI_HOOP: Geste[] = ['crossover', 'crossover', 'entrejambe', 'dos', 'spin', 'hesitation', 'pompe', 'stepback']
/** The right moment: the man in front between these (m). Closer, it's late: he's on the ball. */
export const GESTE_WINDOW: V = [0.85, 2.4]
/** The court's (the man guarding plays closer than on the pitch). */
export const HOOP_WINDOW: V = [0.6, 2.1]
/** A keepy-up's beat (s). */
export const JUGGLE_T = 0.48
/** What a beaten defender says on his way down (the player's own moves). */
const LOST = ['Il a lu ton geste !', 'Trop tard, il était sur toi !', 'Ballon perdu… trop de gestes !']

/** The man in front within reach of a move (the keeper too, for a nutmeg or a sombrero), and how far. */
function manInFront(g: Game, p: Player, keepers: boolean): [Player | null, number] {
  const [fx, fz] = fwd(p)
  let best: Player | null = null
  let d = Infinity
  for (const q of foes(g, p)) {
    if (q.keeper && !keepers) continue
    const e = dist(q, p)
    if (e > 3.2 || e >= d) continue
    if (((q.x - p.x) * fx + (q.z - p.z) * fz) / (e || 1) < 0.35) continue
    ;[best, d] = [q, e]
  }
  return [best, d]
}

/**
 * Does a move beat the man? Met at the right distance, mostly (less if he's
 * low in his stance, or saw the same one just before); too close, he takes
 * it more often than not; too far, nothing to beat (showing off).
 */
function judge(g: Game, p: Player, q: Player | null, d: number, kind: Geste): 'beat' | 'lost' | 'none' {
  const [near, far] = g.sport === 'basket' ? HOOP_WINDOW : GESTE_WINDOW
  if (!q || d > far) return 'none'
  const m = MOVES[kind]
  let c = m.chance
  if (d < near) c *= 0.42
  if (kind === 'petitpont' && d > 1.9) c *= 0.65
  if (q.id === g.me && g.time - lastGuard < 0.35) c -= 0.22
  if (p.last === kind && g.time - p.lastT < 4) c -= 0.18
  // Caught going for the ball (a lunge, a jump), he's had.
  if (q.act === 'beaten' || q.act === 'slide' || (g.sport === 'basket' && (q.act === 'steal' || q.act === 'block'))) c = 0.95
  // The other side's strength, on the player's moves.
  if (p.human && !q.human) c -= (g.foe - 1) * 0.1
  return g.rnd() < c ? 'beat' : 'lost'
}

/** A move with the ball (the street). `aim`: the stick, for the side it goes. */
export function geste(g: Game, p: Player, kind: Geste, aim: V | null) {
  const b = g.ball
  if (!g.street || b.owner !== p.id || locked(p) || g.set || p.act === 'juggle') return
  if (g.sport === 'basket') return hoopGeste(g, p, kind, aim)
  const m = MOVES[kind]
  startAct(p, kind === 'jongle' ? 'juggle' : 'geste', kind === 'jongle' ? (p.human ? m.len : 1.6 + g.rnd() * 1.4) : m.len)
  p.move = kind
  p.take++
  p.face0 = p.face
  p.way = null
  p.turn = 0
  p.fooled = null
  if (kind === 'jongle') {
    p.vx *= 0.3
    p.vz *= 0.3
    return
  }
  // Which side: where the stick points across the body, else the other side from last time.
  const [rx, rz] = right(p)
  const lat = aim ? aim[0] * rx + aim[1] * rz : 0
  p.side = Math.abs(lat) > 0.3 ? (lat > 0 ? 1 : -1) : p.side === 1 ? -1 : 1
  p.from = [b.x, b.z]
  p.vx *= 0.45
  p.vz *= 0.45
  const [q, d] = manInFront(g, p, kind === 'petitpont' || kind === 'sombrero')
  const verdict = judge(g, p, q, d, kind)
  p.last = kind
  p.lastT = g.time
  // The flick and the back-heel are passes: the man fooled (or not) as it goes.
  if (kind === 'aile' || kind === 'talonnade') return flick(g, p, kind, q, verdict)
  p.pending = () => land(g, p, q, verdict, kind)
  p.pendingAt = m.at
}

/** The move bites: the man beaten (or the ball lost to him), the ball and the player away. */
function land(g: Game, p: Player, q: Player | null, verdict: 'beat' | 'lost' | 'none', kind: Geste) {
  const b = g.ball
  if (b.owner !== p.id) return
  if (verdict === 'lost' && q && dist(q, p) < 2.6 && !q.out) return lose(g, p, q)
  const beat = verdict === 'beat' && q ? q : null
  const f0: V = [Math.sin(p.face0), Math.cos(p.face0)]
  const r0: V = [Math.cos(p.face0), -Math.sin(p.face0)]
  const s = p.side
  const burst = (fw: number, sd: number, v: number) => {
    const [x, z] = [f0[0] * fw + r0[0] * s * sd, f0[1] * fw + r0[1] * s * sd]
    const l = hyp(x, z) || 1
    p.vx = (x / l) * v
    p.vz = (z / l) * v
  }
  // The ball away from the feet, rolling (or flying) to `to` in about `t` seconds; his to chase.
  const loose = (to: V, t: number, vy: number, y = BALL_R.foot) => {
    const [dx, dz] = [to[0] - b.x, to[1] - b.z]
    const D = hyp(dx, dz) || 1
    const v = vy > 0 ? D / t : D / t + 0.8 * t
    b.owner = -1
    b.rel = undefined
    b.flight = null
    b.y = y
    b.vx = (dx / D) * v
    b.vz = (dz / D) * v
    b.vy = vy
    b.meant = p.id
    b.lastBy = p.id
    b.lastTeam = p.team
    b.tried = []
    b.lofted = false
  }
  switch (kind) {
    case 'passement':
      burst(0.55, 0.85, 7.2)
      if (beat) fool(beat, 'wrong', [-r0[0] * s * 3.2, -r0[1] * s * 3.2], 0.95)
      break
    case 'roulette':
      burst(0.75, 0.6, 6.8)
      if (beat) fool(beat, 'wrong', [r0[0] * s * 2.5 - f0[0], r0[1] * s * 2.5 - f0[1]], 0.9)
      break
    case 'crochet': {
      burst(0.3, 0.95, 7)
      if (beat) fool(beat, 'shot', [0, 0], 1)
      // The keeper near enough falls for it too: down the wrong way.
      const k = g.ps.find((x) => x.keeper && x.team !== p.team && !x.out)
      if (k && dist(k, p) < 7 && k.act === 'none' && (beat || g.rnd() < 0.4)) {
        startAct(k, 'dive', 1.2)
        k.side = g.rnd() < 0.5 ? -1 : 1
        k.vz = k.side * 4
        k.vx = 0
      }
      break
    }
    case 'petitpont':
      if (beat) {
        // Between his legs, to the far side of him; round him to get it back.
        loose([beat.x + f0[0] * 1.7, beat.z + f0[1] * 1.7], 0.55, 0)
        fool(beat, 'legs', [0, 0], 1.15)
        p.way = [beat.x + r0[0] * s * 1.3 + f0[0] * 0.3, beat.z + r0[1] * s * 1.3 + f0[1] * 0.3]
      } else loose([p.x + f0[0] * 2.6, p.z + f0[1] * 2.6], 0.5, 0)
      p.cool = 0.25
      break
    case 'sombrero':
      if (beat) {
        // Up off the heel, over his head, down behind him.
        loose([beat.x + f0[0] * 1.8, beat.z + f0[1] * 1.8], 1.15, 5.4, 0.35)
        fool(beat, 'sky', [0, 0], 1.25)
        p.way = [beat.x + r0[0] * s * 1.25 + f0[0] * 0.4, beat.z + r0[1] * s * 1.25 + f0[1] * 0.4]
      } else loose([p.x + f0[0] * 2.4, p.z + f0[1] * 2.4], 0.95, 4.6, 0.35)
      p.cool = 0.45
      break
  }
  if (beat) beaten(g, p, beat, kind)
  else showOff(p)
}

/** A man fooled: down, or the wrong way, or looking for the ball; out of it a moment. */
function fool(q: Player, how: NonNullable<Player['fooled']>, v: V, len: number) {
  startAct(q, 'beaten', len)
  q.fooled = how
  q.cool = len + 0.15
  q.vx = v[0]
  q.vz = v[1]
  q.pending = null
}

/** A man beaten by a move: the style, the crowd, the ankles counted. */
function beaten(g: Game, p: Player, q: Player, kind: Geste) {
  const m = MOVES[kind]
  p.style = Math.min(1, p.style + m.style)
  // The nutmeg and the sombrero get filmed; on the court, a man left on his backside.
  const down = q.fooled === 'ankles'
  moment(g, kind === 'petitpont' || kind === 'sombrero' || down ? 'ankle' : 'geste', p)
  if (p.id === g.me) g.stats.ankles++
  const name = down ? 'Chevilles cassées !' : m.name
  say(g, p.human ? (down ? `${m.name.replace(' !', '')} : chevilles cassées !!` : name) : q.id === g.me ? `${name.replace(' !', '')} de ${p.name}…` : `${name.replace(' !', '')} de ${p.name} !`)
}

/** A move with nobody to beat: a little style (showing off isn't beating a man). */
function showOff(p: Player) {
  p.style = Math.min(1, p.style + 0.04)
}

/** Read: the man in front takes it, the one who tried stumbles. */
function lose(g: Game, p: Player, q: Player) {
  give(g, q)
  p.pending = null
  p.way = null
  startAct(p, 'beaten', 0.55)
  p.fooled = null
  p.cool = 0.7
  p.style = Math.max(0, p.style - 0.1)
  if (p.human) say(g, LOST[Math.floor(g.rnd() * LOST.length)])
  else if (q.human) say(g, 'Bien lu ! Ballon récupéré !')
  moment(g, g.sport === 'basket' ? 'steal' : 'tackle', q)
  if (q.id === g.me) g.stats.steals++
}

/**
 * The flick (aile de pigeon: the outside of the heel, across behind the
 * standing leg, to a team-mate on that side) and the back-heel (to the one
 * behind). Nobody there: the ball flicked into the space to the side, or
 * dragged back as he turns with it.
 */
function flick(g: Game, p: Player, kind: 'aile' | 'talonnade', q: Player | null, verdict: 'beat' | 'lost' | 'none') {
  const b = g.ball
  if (verdict === 'lost' && q) return lose(g, p, q)
  const [fx, fz] = fwd(p)
  const [rx, rz] = right(p)
  const want: V = kind === 'talonnade' ? [-fx, -fz] : [rx * p.side * 0.85 - fx * 0.2, rz * p.side * 0.85 - fz * 0.2]
  const to = mates(g, p)
    .filter((x) => !x.keeper || kind === 'talonnade')
    .map((x) => ({ x, d: dist(x, p), k: ((x.x - p.x) * want[0] + (x.z - p.z) * want[1]) / (dist(x, p) || 1) }))
    .filter((e) => e.k > 0.35 && e.d < 14)
    .sort((a, c) => c.k - a.k)[0]?.x
  const face = p.face
  if (to) {
    // From the heel: the ball goes from behind him.
    if (kind === 'talonnade') {
      b.x = p.x - fx * 0.12
      b.z = p.z - fz * 0.12
    }
    // (Out of the move a moment, or the pass would wait for it.)
    p.act = 'none'
    pass(g, p, [to.x - p.x, to.z - p.z])
    startAct(p, 'geste', MOVES[kind].len)
    // He doesn't look: the body stays as it was.
    p.face = face
  } else if (kind === 'aile') {
    p.pending = () => {
      if (b.owner !== p.id) return
      b.owner = -1
      b.rel = undefined
      b.vx = want[0] * 5.5 + fx * 1.5
      b.vz = want[1] * 5.5 + fz * 1.5
      b.vy = 0.6
      b.meant = p.id
      b.lastBy = p.id
      b.lastTeam = p.team
      b.tried = []
      p.cool = 0.2
      p.way = [p.x + want[0] * 1.6, p.z + want[1] * 1.6]
    }
    p.pendingAt = MOVES.aile.at
  } else p.turn = p.side * Math.PI
  if (verdict === 'beat' && q) {
    fool(q, 'wrong', [-want[0] * 1.5, -want[1] * 1.5], 0.75)
    beaten(g, p, q, kind)
  } else showOff(p)
}

/** The Marseille turn's ball: dragged by the sole across and a little on, the body spinning round it. */
function roulettePath(p: Player): V {
  const f0: V = [Math.sin(p.face0), Math.cos(p.face0)]
  const r0: V = [Math.cos(p.face0), -Math.sin(p.face0)]
  const e = ease01(clamp(p.at / MOVES.roulette.at, 0, 1))
  return [p.from[0] + (r0[0] * p.side * 1.15 + f0[0] * 0.3) * e, p.from[1] + (r0[1] * p.side * 1.15 + f0[1] * 0.3) * e]
}
const ease01 = (x: number) => x * x * (3 - 2 * x)

/** A move's body: planted for the trick, then away (round the man beaten). */
function gesteRun(g: Game, p: Player, dt: number) {
  const m = MOVES[p.move ?? 'passement']
  const before = p.at < m.at
  if (p.move === 'roulette' && before && g.ball.owner === p.id) {
    // Round the ball: the body turns a full turn about it.
    const [bx, bz] = roulettePath(p)
    p.face = p.face0 + p.side * Math.PI * 2 * ease01(clamp(p.at / m.at, 0, 1))
    const [fx, fz] = fwd(p)
    const [x, z] = [bx - fx * 0.34, bz - fz * 0.34]
    p.vx = (x - p.x) / Math.max(dt, 1e-3)
    p.vz = (z - p.z) / Math.max(dt, 1e-3)
    p.x = x
    p.z = z
    return
  }
  if (p.turn) p.face = p.face0 + p.turn * ease01(clamp(p.at / 0.4, 0, 1))
  if (p.way && !before) {
    // Round the man, flat out; then the stick (or the AI, after the ball) has him again.
    runTo(p, p.way[0], p.way[1], 7.2)
    const k = 1 - Math.exp(-14 * dt)
    p.vx += (p.want[0] - p.vx) * k
    p.vz += (p.want[1] - p.vz) * k
    if (hyp(p.way[0] - p.x, p.way[1] - p.z) < 0.45) p.way = null
    if (speedOf(p) > 0.5) p.face = Math.atan2(p.vx, p.vz)
  } else if (!before && g.ball.owner < 0 && g.ball.meant === p.id && (p.move === 'petitpont' || p.move === 'sombrero')) {
    // Round him: on to the ball, to take it again.
    const [lx, lz] = landing(g)
    runTo(p, lx, lz, 7.2)
    const k = 1 - Math.exp(-14 * dt)
    p.vx += (p.want[0] - p.vx) * k
    p.vz += (p.want[1] - p.vz) * k
    if (speedOf(p) > 0.5) p.face = Math.atan2(p.vx, p.vz)
  } else {
    const drag = Math.exp(-(before ? 7 : 1.2) * dt)
    p.vx *= drag
    p.vz *= drag
  }
  p.x += p.vx * dt
  p.z += p.vz * dt
}

/** The ball during a move or the keepy-ups, about the feet. */
function gesteBall(g: Game, h: Player, R: number) {
  const b = g.ball
  const [fx, fz] = fwd(h)
  const [rx, rz] = right(h)
  const m = MOVES[h.move!]
  const k = clamp(h.at / Math.max(m.at, 0.01), 0, 1)
  let [f, r, y] = [0.34, 0, R]
  switch (h.move) {
    case 'roulette': {
      ;[b.x, b.z] = roulettePath(h)
      b.y = R
      return
    }
    case 'passement':
      // Still in front while the feet go round it, then knocked across.
      f = 0.38
      r = h.at > m.at ? h.side * 0.25 * clamp((h.at - m.at) / 0.12, 0, 1) : 0
      break
    case 'crochet':
      f = 0.42
      r = h.at > m.at ? h.side * 0.28 : 0
      break
    case 'sombrero':
      // Rolled back up onto the heel.
      f = 0.34 - 0.52 * k
      y = R + Math.max(0, k - 0.7) * 0.6
      break
    case 'petitpont':
      f = 0.38
      break
    case 'talonnade':
    case 'aile':
      f = 0.34 - 0.3 * k
      break
    case 'jongle': {
      // Foot to foot: up from one, down onto the other.
      const n = Math.floor(h.at / JUGGLE_T)
      const u = (h.at % JUGGLE_T) / JUGGLE_T
      const side = (i: number) => (i % 2 ? -0.12 : 0.12)
      f = 0.3
      r = side(n) + (side(n + 1) - side(n)) * u
      y = 0.3 + 0.95 * 4 * u * (1 - u)
      break
    }
  }
  b.x = h.x + fx * f + rx * r
  b.z = h.z + fz * f + rz * r
  b.y = y
}

/** The keepy-ups: the style fills, the crowd goes « Hooo ! » after a few; a man close in goes for it. */
function juggling(g: Game, p: Player, dt: number) {
  const b = g.ball
  if (b.owner !== p.id) {
    p.act = 'none'
    p.move = null
    return
  }
  p.style = Math.min(1, p.style + dt * 0.08)
  if (p.at >= 1.9 && p.at - dt < 1.9) {
    moment(g, 'geste', p)
    if (p.human) say(g, g.sport === 'basket' ? 'Hooo ! Le show !' : 'Hooo ! Les jongles !')
  }
  for (const q of foes(g, p)) {
    if (q.keeper || q.cool > 0 || q.act === 'beaten' || dist(q, p) > 1.1 || g.rnd() > dt * 1.6) continue
    give(g, q)
    startAct(p, 'beaten', 0.5)
    p.cool = 0.6
    say(g, g.sport === 'basket' ? (p.human ? 'Il t’a piqué la balle en plein show !' : 'Interception !') : p.human ? 'Il t’a pris le ballon en pleine jongle !' : 'Ballon récupéré !')
    return
  }
}

/** The keepy-ups over: the ball let drop to the feet (his to take again); the dribble show, the ball kept in hand. */
function dropJuggle(g: Game, p: Player) {
  p.act = 'none'
  p.move = null
  if (g.sport === 'basket') return
  const b = g.ball
  if (b.owner !== p.id) return
  b.owner = -1
  b.rel = undefined
  b.vx = p.vx
  b.vz = p.vz
  b.vy = 0
  b.meant = p.id
  b.lastBy = p.id
  b.lastTeam = p.team
  b.tried = []
  p.cool = 0.1
}

/** The Gbê: the gauge full, a shot like a kick of a mule, low and in the corner; hardly anyone saves it. */
function gbe(g: Game, p: Player, aim: V | null) {
  const F = g.field
  const goal = goalOf(g, p.team)
  const side = aim && Math.abs(aim[1]) > 0.25 ? Math.sign(aim[1]) : g.rnd() < 0.5 ? -1 : 1
  p.style = 0
  g.gbe = g.time
  say(g, p.human ? 'GBÊÊÊ !!!' : `Le Gbê de ${p.name} !`)
  moment(g, 'gbe', p)
  fire(g, p, goal, side * F.mouth * (0.45 + g.rnd() * 0.35), F.bar * (0.25 + g.rnd() * 0.45), 30, 'kick', true)
}

/* ---------- Le basket de rue's moves ---------- */

/** A move with the ball on the court (the dribble show held, the others a press). `aim`: the stick, for the side it goes. */
function hoopGeste(g: Game, p: Player, kind: Geste, aim: V | null) {
  const m = MOVES[kind]
  p.take++
  p.move = kind
  p.fooled = null
  p.way = null
  p.turn = 0
  if (kind === 'show') {
    startAct(p, 'juggle', p.human ? m.len : 1.4 + g.rnd() * 1.2)
    p.vx *= 0.3
    p.vz *= 0.3
    return
  }
  startAct(p, 'geste', m.len)
  p.face0 = p.face
  // Which side: where the stick points across the body, else the other hand from last time.
  const [rx, rz] = right(p)
  const lat = aim ? aim[0] * rx + aim[1] * rz : 0
  p.side = Math.abs(lat) > 0.3 ? (lat > 0 ? 1 : -1) : p.side === 1 ? -1 : 1
  p.from = [p.x, p.z]
  p.vx *= 0.5
  p.vz *= 0.5
  const [q, d] = manInFront(g, p, false)
  const verdict = judge(g, p, q, d, kind)
  p.last = kind
  p.lastT = g.time
  p.pending = () => hoopLand(g, p, q, verdict, kind)
  p.pendingAt = m.at
}

/** The move bites: the man in front beaten (or the ball stolen), and away past him. */
function hoopLand(g: Game, p: Player, q: Player | null, verdict: 'beat' | 'lost' | 'none', kind: Geste) {
  if (g.ball.owner !== p.id) return
  if (verdict === 'lost' && q && dist(q, p) < 2.4 && !q.out) return lose(g, p, q)
  const beat = verdict === 'beat' && q ? q : null
  const f0: V = [Math.sin(p.face0), Math.cos(p.face0)]
  const r0: V = [Math.cos(p.face0), -Math.sin(p.face0)]
  const s = p.side
  const burst = (fw: number, sd: number, v: number) => {
    const [x, z] = [f0[0] * fw + r0[0] * s * sd, f0[1] * fw + r0[1] * s * sd]
    const l = hyp(x, z) || 1
    p.vx = (x / l) * v
    p.vz = (z / l) * v
  }
  // Which way he goes: the wrong way, after the ball's first side.
  const wrong: V = [-r0[0] * s * 2.6, -r0[1] * s * 2.6]
  switch (kind) {
    case 'crossover':
      burst(0.6, 0.8, 6.6)
      // Hard enough, and the man goes down.
      if (beat) {
        const down = g.rnd() < 0.38
        fool(beat, down ? 'ankles' : 'wrong', down ? [wrong[0] * 0.3, wrong[1] * 0.3] : wrong, down ? 1.6 : 0.95)
      }
      break
    case 'entrejambe':
      burst(0.75, 0.55, 6.3)
      if (beat) fool(beat, 'frozen', [0, 0], 1.0)
      break
    case 'dos':
      burst(0.65, 0.75, 6.4)
      if (beat) fool(beat, 'turned', [-r0[0] * s * 1.2, -r0[1] * s * 1.2], 1.0)
      break
    case 'spin':
      // Spun off him, out the other side: round him to the ring.
      if (beat) {
        fool(beat, 'turned', [0, 0], 1.05)
        beat.side = s
        p.way = [beat.x + r0[0] * s * 0.95 + f0[0] * 1.0, beat.z + r0[1] * s * 0.95 + f0[1] * 1.0]
      } else burst(0.8, 0.45, 6)
      break
    case 'hesitation':
      // Stopped as for the shot, then gone straight past.
      burst(0.95, 0.2, 7.2)
      if (beat) fool(beat, 'frozen', [0, 0], 0.95)
      break
    case 'pompe':
      // He goes up for the block; under him and past.
      burst(0.55, 0.7, 6)
      if (beat) fool(beat, 'jump', [0, 0], 1.05)
      break
    case 'stepback':
      // A hop back: room for the shot; the man lunging in loses his feet.
      burst(-0.95, 0.25, 5.4)
      if (beat) {
        const down = g.rnd() < 0.5
        fool(beat, down ? 'ankles' : 'wrong', [-f0[0] * 1.6, -f0[1] * 1.6], down ? 1.6 : 0.9)
      }
      break
  }
  if (beat) beaten(g, p, beat, kind)
  else showOff(p)
}

/** A move's body on the court: planted for the trick, then away (round the man spun off). */
function hoopRun(p: Player, dt: number) {
  const m = MOVES[p.move ?? 'crossover']
  const before = p.at < m.at
  // The spin: a full turn on the pivot foot, back to the man, then out.
  if (p.move === 'spin') p.face = p.face0 - p.side * Math.PI * 2 * ease01(clamp(p.at / (m.at + 0.1), 0, 1))
  if (p.way && !before) {
    runTo(p, p.way[0], p.way[1], 7)
    const k = 1 - Math.exp(-14 * dt)
    p.vx += (p.want[0] - p.vx) * k
    p.vz += (p.want[1] - p.vz) * k
    if (hyp(p.way[0] - p.x, p.way[1] - p.z) < 0.45) p.way = null
  } else {
    // Into the move he slows (the hesitation all but stops); out of it the burst carries on.
    const drag = Math.exp(-(before ? (p.move === 'hesitation' ? 9 : 5) : 1.1) * dt)
    p.vx *= drag
    p.vz *= drag
  }
  // Out of it, facing where he runs (the step-back still faces the ring).
  if (!before && p.move !== 'spin' && p.move !== 'stepback' && speedOf(p) > 0.8) {
    let d = Math.atan2(p.vx, p.vz) - p.face
    d = Math.atan2(Math.sin(d), Math.cos(d))
    p.face += d * (1 - Math.exp(-10 * dt))
  }
  p.x += p.vx * dt
  p.z += p.vz * dt
}

/** The ball in a move on the court: hand to hand low, between the legs, round the back, palmed in the spin, up for the pump fake; the show, every way at once. */
function hoopBall(g: Game, h: Player, R: number) {
  const b = g.ball
  const [fx, fz] = fwd(h)
  const [rx, rz] = right(h)
  const m = MOVES[h.move!]
  const u = clamp(h.at / Math.max(m.at * 1.6, 0.01), 0, 1)
  // From the old hand to the new one (side: the new one).
  const hand = -h.side * Math.cos(u * Math.PI)
  let [f, r, y] = [0.22, h.side * 0.32, R + Math.abs(Math.sin(b.phase)) * 0.8]
  switch (h.move) {
    case 'crossover':
      ;[f, r, y] = [0.32, hand * 0.32, R + Math.abs(Math.cos(u * Math.PI)) * 0.45]
      break
    case 'entrejambe':
      // Bounced through, under him.
      ;[f, r, y] = [0.22 - 0.3 * Math.sin(u * Math.PI), hand * 0.3, R + Math.abs(Math.cos(u * Math.PI)) * 0.55]
      break
    case 'dos':
      ;[f, r, y] = [0.18 - 0.55 * Math.sin(u * Math.PI), hand * 0.36, R + 0.1 + Math.abs(Math.cos(u * Math.PI)) * 0.5]
      break
    case 'spin':
      // Held in the hand as he turns, out at the side.
      if (h.at < m.at + 0.1) [f, r, y] = [0.12, h.side * 0.4, 0.95]
      break
    case 'hesitation':
      // A high slow bounce while he stops, as if to pull up.
      if (h.at < m.at) y = R + Math.abs(Math.sin(h.at * 5)) * 0.95
      break
    case 'pompe': {
      // Both hands, up over the head as for the shot, and back down.
      const k = h.at < 0.24 ? ease01(h.at / 0.24) : Math.max(0, 1 - (h.at - 0.24) / 0.18)
      if (h.at < 0.42) [f, r, y] = [0.3, 0, 1.15 + 1.0 * k]
      break
    }
    case 'show':
      // Crossovers and between the legs in a blur, low and quick.
      ;[f, r, y] = [0.2 - 0.18 * Math.max(0, Math.sin(h.at * 3.1)), 0.32 * Math.cos(h.at * 6.2), R + Math.abs(Math.sin(h.at * 12.4)) * 0.45]
      break
  }
  b.x = h.x + fx * f + rx * r
  b.z = h.z + fz * f + rz * r
  b.y = y
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
  const chance = (foot ? 0.5 : 0.36) + (h.act === 'cross' || h.act === 'juggle' ? 0.12 : 0) + (h.act === 'geste' ? 0.08 : 0) - (behind ? 0.25 : 0) + (p.human ? 0.08 : 0) + loose
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
  if (g.shootout) return kickDone(g, false)
  g.phase = 'dead'
  g.wait = 1.1
  g.shot = null
  b.lofted = false
  say(g, kind === 'throw' ? 'Touche.' : kind === 'corner' ? 'Corner !' : 'Six mètres.')
  g.then = () => setPiece(g, kind, team, at)
}

/** Everyone to their place for a set piece; the ball to the one taking it (`who`, or the one whose it is). */
function setPiece(g: Game, kind: SetPiece['kind'], team: 0 | 1, at0: V, who?: Player) {
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
  if (who) taker = who
  else if (kind === 'goal') taker = side.find((p) => p.keeper) ?? side[0]
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

/* ---------- The penalty shoot-out ---------- */

/** Time up on a draw, the cup's way: five penalties each, then one each until one side misses and the other doesn't. */
function startShootout(g: Game) {
  g.shootout = { kicks: [[], []], turn: 0, taker: -1, t: -1 }
  g.set = null
  g.shot = null
  g.ball.flight = null
  g.phase = 'dead'
  g.wait = 2.6
  g.ref.whistle = g.time
  say(g, 'Tirs au but !')
  g.then = () => nextKick(g)
}

/** The order the side's players take their kicks: the one up front first, then from the front back, the keeper last. */
const kickOrder = (g: Game, p: Player) => (p.role === striker(g) ? 0 : p.keeper ? 99 : 20 - p.role)

/** The next kick: its taker on the spot, the keeper on his line, the others in the centre circle. */
function nextKick(g: Game) {
  const so = g.shootout!
  const team = so.turn
  const order = g.ps.filter((p) => p.team === team && !p.out).sort((a, c) => kickOrder(g, a) - kickOrder(g, c))
  const taker = order[so.kicks[team].length % order.length]
  // The local hands take their side's kick; on the other's, they're on the keeper's dive (the stick), not on the keeper himself.
  if (g.switching && team === myTeam(g)) control(g, taker)
  else if (g.switching && g.ps[g.me].keeper) {
    const mate = g.ps.find((p) => p.team === myTeam(g) && !p.keeper && !p.out)
    if (mate) control(g, mate)
  }
  setPiece(g, 'pen', team, penaltySpot(g, team === 0 ? 1 : 0), taker)
  say(g, team === myTeam(g) && g.switching ? 'À toi de tirer !' : `${taker.name} s'avance…`)
  const gx = goalOf(g, team)[0]
  for (const t of [0, 1] as const) {
    const wait = g.ps.filter((p) => p.team === t && p !== taker && !p.out && !(p.keeper && p.team !== team))
    wait.forEach((p, k) => {
      p.x = (t === 0 ? -0.6 : 0.6) * (g.size === 11 ? 2 : 1)
      p.z = (k - (wait.length - 1) / 2) * 0.8
      p.face = Math.atan2(gx - p.x, -p.z * 0.2)
      p.vx = p.vz = 0
      p.want = [0, 0]
    })
  }
  so.taker = taker.id
  so.t = -1
}

/** A kick in or not: counted, the other side's turn; the shoot-out over once one side can't catch the other. */
function kickDone(g: Game, scored: boolean) {
  const so = g.shootout!
  const team = so.turn
  const taker = g.ps[so.taker]
  so.kicks[team].push(scored)
  so.turn = team === 0 ? 1 : 0
  so.taker = -1
  g.ball.dead = true
  g.set = null
  g.shot = null
  g.phase = 'dead'
  g.wait = 2.2
  const w = shootoutWinner(so)
  const mine = team === myTeam(g)
  if (w !== null) say(g, w === myTeam(g) ? 'Gagné aux tirs au but !' : 'Perdu aux tirs au but…')
  else say(g, scored ? (mine ? 'Réussi !' : 'Il marque.') : mine ? 'Manqué…' : 'Raté ! Il ne marque pas !')
  if (scored && taker && !taker.out) startAct(taker, 'cheer', 1.8)
  g.then = () => nextKick(g)
}

/** Who has won the shoot-out (null: not yet). */
function shootoutWinner(so: Shootout): 0 | 1 | null {
  const [a, b] = so.kicks
  const [sa, sb] = [a.filter(Boolean).length, b.filter(Boolean).length]
  // The first five each: over as soon as one side couldn't catch up even scoring all it has left.
  if (a.length <= 5 && b.length <= 5) {
    if (sa > sb + 5 - b.length) return 0
    if (sb > sa + 5 - a.length) return 1
    if (a.length < 5 || b.length < 5) return null
  }
  // Then one each: settled when both have kicked and one scored more.
  return a.length === b.length && sa !== sb ? (sa > sb ? 0 : 1) : null
}

/** The shoot-out's score (goals each), if there was one. */
export const shootoutScore = (g: Game): [number, number] | null => (g.shootout ? [g.shootout.kicks[0].filter(Boolean).length, g.shootout.kicks[1].filter(Boolean).length] : null)

/** The side ahead: on the score, else on the shoot-out (null: level). */
function leader(g: Game): 0 | 1 | null {
  if (g.score[0] !== g.score[1]) return g.score[0] > g.score[1] ? 0 : 1
  return g.shootout ? shootoutWinner(g.shootout) : null
}

/** The AI takes a set piece (or the local hands' one who's left it too long). */
function takeSetPiece(g: Game, p: Player) {
  const sp = g.set!
  const goal = goalOf(g, p.team)
  const gd = hyp(goal[0] - p.x, goal[1] - p.z)
  const big = g.size === 11
  switch (sp.kind) {
    case 'pen':
      // A shoot-out's kick placed more than struck: fewer over the maracana's bar.
      return shoot(g, p, [0, g.rnd() < 0.5 ? -1 : 1], (g.shootout ? 0.45 : 0.55) + g.rnd() * 0.35)
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
  // Taking a set piece: still, until it's played (takeSetPiece). The shoot-out: all but the keeper facing the kick wait in the circle.
  if ((g.set && g.set.taker === p.id) || (g.shootout && !(p.keeper && p.team !== g.shootout.turn))) {
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
  // (Le basket de rue: a move on the man in front, from a little further; now and then the show, nobody near.)
  if (def && inFront && dd < (g.street ? 2 : 1.6) && g.rnd() < 0.45) return g.street ? geste(g, p, AI_HOOP[Math.floor(g.rnd() * AI_HOOP.length)], null) : skill(g, p, null)
  if (g.street && dd > 4 && g.possT > 2 && g.rnd() < 0.04) return geste(g, p, 'show', null)
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
  const man = g.street ? manOf(g, p) : g.ps.find((q) => q.team !== p.team && q.role === p.role)!
  const onBall = g.ball.owner === man.id
  const d = fromHoop(man.x, man.z) || 1
  const off = onBall ? 0.95 : Math.min(2.2, 1.2 + d * 0.12)
  runTo(p, man.x + ((HOOP[0] - man.x) / d) * off, man.z + ((HOOP[1] - man.z) / d) * off, onBall ? 4.6 : 4.4)
  if (p.think > 0) return
  p.think = 0.45 + g.rnd() * 0.3
  if (onBall && dist(p, man) < 1.35 && g.rnd() < 0.09 && p.cool <= 0) defend(g, p)
}

/** Le basket de rue: the man a defender guards, the one in the same place of the three on the court. */
function manOf(g: Game, p: Player) {
  const mine = g.ps.filter((q) => q.team === p.team && !q.out)
  const theirs = g.ps.filter((q) => q.team !== p.team && !q.out)
  return theirs[Math.max(0, mine.indexOf(p))] ?? theirs[0]
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
  // The street: a move on the man in front, timed (the AI too likes to show off), now and then the keepy-ups with nobody near.
  if (g.street && def && inFront && dd > 1 && dd < 2.3 && g.rnd() < 0.42) return geste(g, p, AI_MOVES[Math.floor(g.rnd() * AI_MOVES.length)], null)
  if (g.street && dd > 5.5 && g.possT > 2 && g.rnd() < 0.05) return geste(g, p, 'jongle', null)
  if (def && inFront && dd < 1.9) return g.rnd() < 0.45 && !g.street ? skill(g, p, null) : pass(g, p, null)
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
  const F = g.field
  // (The street's pitch is smaller: the same shape, closer.)
  const [sx, sz] = [SHAPE[p.role][0] * (F.x / 18), SHAPE[p.role][1] * (F.z / 10.5)]
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
  // (The street: the one up front marks theirs; their back keeps goal.)
  const man = g.ps.find((q) => q.team !== p.team && q.role === (p.role === 1 ? 4 : p.role === 4 ? (g.street ? 4 : 1) : p.role === 2 ? 3 : 2))!
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
  // Holding it: a look, then out to someone free (the street's keeper, quicker: it's played on).
  if (b.owner === p.id) {
    p.want = [0, 0]
    if (p.act !== 'hold') startAct(p, 'hold', 1.1)
    if (p.at > (g.street ? 0.55 : 1)) pass(g, p, null)
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
  const [kx, kz] = g.size === 11 ? [8, 10] : g.street ? [3.6, 3.4] : [5.5, 5]
  const [lx, lz] = b.lofted ? landing(g) : [b.x, b.z]
  if (!holder(g) && Math.abs(lx - gx) < kx && Math.abs(lz) < kz && (b.y < 2 || b.lofted)) return runTo(p, b.lofted ? lx : b.x, b.lofted ? lz : b.z, 6)
  // On his line, across with the ball, a step out when it comes close.
  const out = clamp((g.size === 11 ? 7 : 5) - Math.abs(b.x - gx) * 0.2, 0.5, g.size === 11 ? 4 : g.street ? 1.4 : 2.5)
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
  // Time up; a draw with the golden goal plays on until somebody scores; with penalties, to the shoot-out's end.
  const up = () => {
    // The street: the first to five.
    if (g.goals && Math.max(g.score[0], g.score[1]) >= g.goals) return true
    if (g.time < g.length) return false
    if (g.golden && g.score[0] === g.score[1]) {
      if (!g.extra) {
        g.extra = true
        say(g, g.sport === 'basket' ? 'Panier en or : le prochain panier gagne !' : 'But en or : le premier qui marque gagne !')
      }
      return false
    }
    if (g.pens && g.score[0] === g.score[1]) {
      if (!g.shootout) {
        startShootout(g)
        return false
      }
      return shootoutWinner(g.shootout) !== null
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
      // (Unless the shoot-out has just begun, with its own pause.)
      else if (g.wait <= 0) {
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
  const won = g.phase === 'over' ? leader(g) : null
  if (won !== null) for (const p of g.ps) if (p.team === won && p.act === 'none' && !p.keeper) startAct(p, 'cheer', 60)
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
  // The shoot-out: once struck, a kick that's anyone's (the keeper's catch, the taker's rebound) or gone a while is missed; in, goal() counts it.
  const so = g.shootout
  if (so && playing && so.taker >= 0 && !g.set) {
    if (so.t < 0) so.t = g.time
    const o = g.ball.owner
    if ((o >= 0 && (o !== so.taker || g.time - so.t > 0.6)) || (g.time - so.t > 3.2 && !g.shot)) kickDone(g, false)
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
      // Past a man beaten by a move: round him, not into him.
      if ((a.act === 'geste' && c.act === 'beaten') || (c.act === 'geste' && a.act === 'beaten')) continue
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
  // Basketball: a jump shot on the meter fills while Tir is held, and goes when it's let go (or held too long).
  if (!foot && me.meter >= 0) {
    if (me.act !== 'shoot' || g.ball.owner !== me.id || !playing) me.meter = -1
    else {
      me.meter += dt * METER_FILL
      if (!input.charge || me.meter >= METER_OVER) letGo(g, me)
    }
    return
  }
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
  // The shoot-out: only the one taking the kick (the keeper's dive goes on the stick by itself).
  if (g.shootout && !set) {
    me.want = [0, 0]
    me.charge = 0
    return
  }
  const l = hyp(input.mx, input.mz) || 1
  // Juggling, a slow walk.
  if (me.act === 'juggle') top = 1.1
  me.want = set ? [0, 0] : [(input.mx / l) * m * top, (input.mz / l) * m * top]
  if (input.guard && me.id === g.me) lastGuard = g.time
  const aim: V | null = m > 0.3 ? [input.mx, input.mz] : null
  // At a set piece the stick aims: the taker turns to it.
  if (set && aim) me.face = Math.atan2(aim[0], aim[1])
  if (!foot) {
    // Le basket de rue: the moves (Feinte is the pump fake); the dribble show goes on while held.
    if (g.street && has) {
      if (me.act === 'juggle' && !input.juggle) dropJuggle(g, me)
      if (input.geste) return geste(g, me, input.geste, aim)
      if (input.skill) return geste(g, me, 'pompe', aim)
      if (input.juggle && me.act === 'none') return geste(g, me, 'show', aim)
    }
    if (input.pass) has ? pass(g, me, aim) : call(me)
    // Tir held where the hands can hold it: the jump shot on the meter.
    if (input.shoot) has ? shoot(g, me, aim, undefined, input.charge !== undefined) : jump(g, me)
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
    // The street: the moves (Crochet is the fake shot); the keepy-ups go on while held, and drop to the feet when let go.
    if (g.street && !set) {
      if (me.act === 'juggle' && !input.juggle) dropJuggle(g, me)
      if (input.geste) return geste(g, me, input.geste, aim)
      if (input.skill) return geste(g, me, 'crochet', aim)
      if (input.juggle && me.act === 'none') return geste(g, me, 'jongle', aim)
    }
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
  // Tir tackles on the console's pitch (the stadium's eleven online too, each in its own place).
  if (input.defend || (input.shoot && fifa(g))) defend(g, me)
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
    // Up to the ring and hanging there; then down. (The Gbê flies further, for longer.)
    const e = Math.min(1, p.at / (p.gbe ? 0.85 : 0.5))
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
    // Fooled by a move: turning round after the ball (through the legs, over the head), too late.
    if (p.fooled === 'legs' || p.fooled === 'sky') {
      const b = g.ball
      let d = Math.atan2(b.x - p.x, b.z - p.z) - p.face
      d = Math.atan2(Math.sin(d), Math.cos(d))
      if (p.at > 0.35) p.face += d * (1 - Math.exp(-4 * dt))
    }
    // Turned round by a move on the court: spun the wrong way, his back to the play.
    if (p.fooled === 'turned' && p.at < 0.5) p.face += p.side * (Math.PI / 0.5) * dt
  } else if (p.act === 'geste') {
    if (g.sport === 'basket') hoopRun(p, dt)
    else gesteRun(g, p, dt)
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
  if (p.act === 'none' || p.act === 'cross' || p.act === 'celebrate' || p.act === 'juggle') {
    const sp = speedOf(p)
    const b = g.ball
    // The console's football, the ball at his feet: he turns only by running (looking at the ball at his own feet would spin him round it).
    const own = g.sport === 'foot' && b.owner === p.id && fifa(g)
    const want = own ? (sp > 0.3 ? Math.atan2(p.vx, p.vz) : p.face) : sp > 0.6 ? Math.atan2(p.vx, p.vz) : g.sport === 'basket' && b.owner === p.id ? Math.atan2(HOOP[0] - p.x, HOOP[1] - p.z) : Math.atan2(b.x - p.x, b.z - p.z)
    let d = want - p.face
    d = Math.atan2(Math.sin(d), Math.cos(d))
    p.face += d * (1 - Math.exp(-12 * dt))
  }
  if (p.act !== 'none' && p.at >= p.len) {
    if (p.act === 'juggle') return dropJuggle(g, p)
    p.act = 'none'
    p.flip = false
    p.fooled = null
    p.move = null
    p.gbe = false
  }
  // Juggling: the style fills, the crowd loves it after a moment; a man close in can take it.
  if (p.act === 'juggle') juggling(g, p, dt)
}

/** Inside the fence (and off the keeper's line for the others, a little). */
function keepIn(g: Game, p: Player) {
  if (p.out) return
  if (g.sport === 'basket') {
    p.x = clamp(p.x, -COURT_FENCE.x + 0.4, COURT_FENCE.x - 0.4)
    p.z = clamp(p.z, COURT_FENCE.z0 + 0.4, COURT_FENCE.z1 - 0.4)
  } else if (g.street) {
    // The street's walls run along the goal lines.
    p.x = clamp(p.x, -g.field.x - 0.1, g.field.x + 0.1)
    p.z = clamp(p.z, -g.field.z - 0.35, g.field.z + 0.35)
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
        const up = h.act === 'dunk' ? 1.2 + 2.1 * Math.min(1, h.at / (h.gbe ? 0.9 : 0.55)) : h.act === 'pass' ? 1.15 : 1.3 + Math.min(1, h.at / 0.4) * 1.1
        b.x = h.x + fx * 0.3
        b.z = h.z + fz * 0.3
        b.y = up
      } else if (g.street && (h.act === 'geste' || h.act === 'juggle') && h.move) {
        hoopBall(g, h, R)
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
    } else if (g.street && (h.act === 'geste' || h.act === 'juggle') && h.move) {
      gesteBall(g, h, R)
    } else if (h.act === 'hold') {
      b.x = h.x + fx * 0.3
      b.z = h.z + fz * 0.3
      b.y = 1.05
    } else if (fifa(g)) {
      // The console: little touches, the ball knocked on quickly and caught up slowly (no
      // snapping back), bigger the faster he runs; it eases to where it should be at his feet,
      // so a pass taken while moving, or a turn, never makes it jump about.
      const amp = 0.38 * clamp((sp - 0.7) / 3, 0, 1)
      const f = b.phase % 1
      const push = 0.3 + amp * (f < 0.2 ? f / 0.2 : (1 - f) / 0.8)
      const rel = b.rel ?? [b.x - h.x, b.z - h.z]
      const k = 1 - Math.exp(-14 * dt)
      rel[0] += (fx * push - rel[0]) * k
      rel[1] += (fz * push - rel[1]) * k
      b.rel = rel
      b.x = h.x + rel[0]
      b.z = h.z + rel[1]
      b.y = R
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
  if (g.shootout) return kickDone(g, true)
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
  // A Gbê on its way: nobody stops it but a keeper who's to save it.
  const gbeOn = g.time - g.gbe < 1.2 && hyp(b.vx, b.vz) > 14
  for (const p of g.ps) {
    if (p.out || p.cool > 0 || p.act === 'beaten' || p.act === 'celebrate' || (p.act === 'slide' && p.at < 0.7)) continue
    if (gbeOn && !(p.keeper && g.shot?.save)) continue
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
    // A shoot-out's kick he wasn't to save goes past him, his dive or not.
    if (p.keeper && g.shootout && g.shot && g.shot.keeper === p.id && !g.shot.save) continue
    // In the box, a keeper only takes it in his own half.
    if (p.keeper && Math.abs(p.x - (p.team === 0 ? -g.field.x : g.field.x)) > (g.size === 11 || g.street ? g.field.box[0] : 6)) continue
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
      pose = p.gbe ? 'windmill' : 'dunk'
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
      pose = p.fooled === 'legs' ? 'nutmegged' : p.fooled === 'sky' ? 'lookup' : p.fooled === 'shot' ? 'flinch' : p.fooled === 'ankles' ? 'ankles' : p.fooled === 'turned' ? 'turned' : p.fooled === 'frozen' ? 'frozen' : p.fooled === 'jump' ? 'block' : 'stumble'
      break
    case 'geste':
      pose = GESTE_POSE[p.move ?? 'passement']
      break
    case 'juggle':
      pose = g.sport === 'basket' ? 'dribbleshow' : 'juggle'
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
  // From the local player's side (at a court match it may be the other team); a draw settled on penalties, the shoot-out's.
  const w = leader(g)
  return w === null ? 'draw' : w === g.ps[g.me].team ? 'win' : 'loss'
}
