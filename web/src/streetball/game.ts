import type { Pose } from '../avatar/Human'
import { t as tr } from '../lib/i18n'
import { GESTES, NO_INPUT, advanceGait, gaitStep } from './basics'

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
// (The skills' list and the hands at rest are in basics.ts: the match online needs them without the whole game.)
export { GESTES, NO_INPUT, gaitStep, advanceGait }

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

/** Le basket de rue: the points that win it. */
export const HOOP_TO = 11
/** Seconds of play, and of the 3-2-1 before. */
export const LENGTH = 180
export const COUNTDOWN = 3

/* ---------- The ground ---------- */

/** The half-court: the ring's centre, its height, the arc (2 points past it, street rules), the board, the lines, the fence. */
export const HOOP: V = [0, -5.625]
export const RIM_Y = 3.05
/** The street's arc at the real distance (FIBA's 6,75 m, the 3x3's too), straight down to the baseline 6,6 m out in the corners. */
export const ARC = 6.75
export const CORNER = 6.6
export const BOARD_Z = -6.0
/** The ring's inside radius (45,7 cm across) and the board's size (1,83 by 1,07 m, its bottom 2,9 m up). */
export const RING_R = 0.2286
export const BOARD = { w: 1.83, h: 1.07, y: 2.9 }
/**
 * The Palais des Sports' full court (Rules.full), at the real size: 28,65 by 15,24 m along x, the rings
 * 1,6 m in from each baseline, the boards 1,22 m in, the three-point line at 7,24 m (6,71 m in the
 * corners), the free-throw line 4,57 m from the board, the key 4,88 m wide, the restricted arc 1,22 m.
 * Team 0 attacks the ring at +x.
 */
export const PRO = { x: 14.325, z: 7.62, ring: 12.725, board: 13.105, arc: 7.24, corner: 6.71, ft: 4.57, key: 2.44, ra: 1.22 }
/** The official game's shot clock (s), reset to this after an offensive rebound off the iron. */
export const SHOT_CLOCK = 24
const SHOT_CLOCK_OREB = 14
/** The official game's team fouls before every foul is two free throws. */
export const BONUS = 5
export const COURT = { x: 7.5, z0: -7.2, z1: 6.8 }
const COURT_FENCE = { x: 8.6, z0: -8.3, z1: 8.0 }
/**
 * A football ground: half its length and width, the goal's half-mouth and its
 * bar, the penalty box (depth from the goal line, half-width) and the spot,
 * and whether boards run round it (the maracana: the ball comes back off
 * them) or lines (the stadium: out is a throw-in, a corner, a goal kick).
 */
export type Field = { x: number; z: number; mouth: number; bar: number; box: V; spot: number; walls: boolean; /** How far the wall stands at a free kick. */ wall: number }
/**
 * The five-a-side maracana (a fenced 36 by 21, goals 3.2 by 2 as on the
 * quarters' pitches) and the stadium's pitch at the real size: 105 by 68, the
 * goal 7.32 by 2.44, the box 16.5 deep and 40.32 wide, the spot at 11, the
 * wall at 9.15.
 */
export const FIELDS: Record<5 | 11, Field> = {
  5: { x: 18, z: 10.5, mouth: 1.6, bar: 2, box: [6, 5], spot: 6, walls: true, wall: 4 },
  11: { x: 52.5, z: 34, mouth: 3.66, bar: 2.44, box: [16.5, 20.16], spot: 11, walls: false, wall: 9.15 },
}
/** The street's pitch: about 25 by 14, walls all round, goals of welded iron a little over two metres wide. */
export const STREET: Field = { x: 12.5, z: 7, mouth: 1.15, bar: 1.25, box: [3.6, 3.4], spot: 4, walls: true, wall: 3 }
/** The maracana's, as before the stadium (the street, the courts). */
export const PITCH = FIELDS[5]
export const MOUTH = PITCH.mouth
export const BAR = PITCH.bar
const BALL_R = { basket: 0.12, foot: 0.11 }

/* ---------- Who's on it ---------- */

export type Act = 'none' | 'pass' | 'shoot' | 'dunk' | 'layup' | 'cross' | 'steal' | 'block' | 'slide' | 'beaten' | 'kick' | 'dive' | 'hold' | 'celebrate' | 'cheer' | 'head' | 'throw' | 'geste' | 'juggle' | 'control'

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
  /**
   * Basketball: the dribble picked up (after a pump fake once he has dribbled): the ball held in both
   * hands, he can pivot, shoot or pass, never run with it nor dribble again (no travelling, no double
   * dribble); and whether he has dribbled since he got it (a pump fake before that still lets him drive).
   */
  picked: boolean
  dribbled: boolean
  /** Basketball's AI: setting a screen (s left), cutting to the ring after a pass (s left, the give-and-go). */
  screen: number
  cut: number
  /**
   * The run's step phase (radians, a stride of two steps each 2π), carried on by the ground covered
   * (gaitStep): the legs (scene.tsx hands it to the avatar), the football's touches and the basketball's
   * bounces all go by it, so the feet never slide and the ball keeps time with the steps. Where it was last counted from.
   */
  gait: number
  gx: number
  gz: number
  /** Football: the first touch going on (the ball met, cushioned, taken on: controlBall); a header asked for by the hands (Tir: at goal, Passe: to a team-mate) and when. */
  ctrl: Ctrl | null
  nod: { k: 'shot' | 'pass'; t: number } | null
  /** The buttons pressed while they couldn't be played yet (busy, or the ball on its way to him): when, and the stick then (bufferPresses). */
  buf: Buffered
}

/**
 * A first touch: the body part (the pose), where the ball was when it came (from the player, with its
 * height), where it is taken to (the way the stick points, or the run), and whether it's a heavy one
 * (it runs away from him: a ball hit hard, a sprint, a man on him).
 */
export type Ctrl = { kind: 'trap' | 'sole' | 'instep' | 'thigh' | 'chest'; from: [number, number, number]; dir: V; heavy: boolean }

/** A press kept a moment (g.time of the press; -9: none) and where the stick pointed then. */
export type Buffered = { pass: number; shoot: number; through: number; lob: number; skill: number; aim: V | null }

/** Something worth cheering, filming and posting. */
export type Moment = { kind: 'dunk' | 'basket' | 'three' | 'goal' | 'block' | 'steal' | 'ankle' | 'save' | 'tackle' | 'post' | 'foul' | 'card' | 'geste' | 'gbe' | 'miss' | 'alley' | 'ft' | 'rebound' | 'jump' | 'clock'; team: 0 | 1; by: number; t: number }

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
  /** Basketball, a shot: a free throw; the way a make goes in (clean through, off the iron then in, off the board), the ring it's for. */
  ft?: boolean
  via?: 'swish' | 'rim' | 'bank'
  ring?: 0 | 1
  /** The second leg of a shot (off the iron or the board, on into the ring or away). */
  leg?: boolean
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
  /** Football: the side-spin of a curled shot (m/s² across, along z), wearing off as it goes. */
  curl?: number
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
  /** Basketball: the Palais des Sports' full court, five a side (Rules.full); the ring each team attacks (the same one on a half-court). */
  full: boolean
  hoops: [V, V]
  /** The shot clock (s left; -1: none), the team fouls, the side the next held ball goes to (the possession arrow). */
  clock: number
  fouls: [number, number]
  arrow: 0 | 1
  /** Free throws being shot: by whom, how many left, how many in all, when the next one is taken. */
  ft: { by: number; left: number; of: number; t: number } | null
  /** The ball put in play: a check at the top (the half-court) or a throw-in from out of bounds (the full court): by whom, to whom, from where, since when. */
  inb: { by: number; to: number; at: V; t: number; check: boolean } | null
  /** Play held still until then (a check ball, a free throw, the tip-off). */
  hold: number
  /** The last shot up: by whom, worth what, when; the iron (or the board) touched since (the shot clock goes back, it's a rebound). */
  lastShot: { by: number; team: 0 | 1; points: number; t: number; iron: boolean } | null
  /** The ring last hit (the full court has two): its index. */
  ringHit: 0 | 1
  /** The commentator's line and when it was said. */
  comment: { text: string; t: number } | null
  /** The opening tip: the ball tossed up at centre court (s since; -1: done). */
  tip: number
  /** A foul on a shot going on (on whom, by whom): an and-one if it goes in, free throws if not. */
  andOne: { on: number; by: number } | null
  /** When the ball last hit a board (its thud). */
  board: number
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
export type Rules = { length?: number; foe?: number; golden?: boolean; shootout?: boolean; size?: 5 | 11; switching?: boolean; referee?: boolean; names?: [string[], string[]]; /** Le foot de rue: four a side, the moves, the first to five; basketball, le basket de rue: the moves, the first to 11. */ street?: boolean; /** Basketball at the Palais des Sports: five a side on the full court at the real size, 2 and 3 points, the shot clock, the tip-off, throw-ins. */ full?: boolean }

/** When the player last held Défense (the stance reads a crossover). */
let lastGuard = -9

const NAMES = { mates: [tr('Yao'), tr('Ibrahim'), tr('Koffi'), tr('Moussa')], them: [tr('Bakary'), tr('Junior'), tr('Didier'), tr('Salif'), tr('Lass')] }
/** Eleven a side, by place: keeper, the back four, the three in midfield, the wingers and the striker between them. */
const ELEVEN = {
  mates: [tr('Gbagbo'), tr('Seri'), tr('Kanga'), tr('Diomandé'), tr('Koné'), tr('Bamba'), tr('Yao'), tr('Ibrahim'), tr('Koffi'), tr('Moussa'), tr('Gervais')],
  them: [tr('Sangaré'), tr('Traoré'), tr('Coulibaly'), tr('Ouattara'), tr('Doumbia'), tr('Fofana'), tr('Bakary'), tr('Junior'), tr('Didier'), tr('Salif'), tr('Lass')],
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
  return { id, team, human: false, keeper: false, name, role, x, z, vx: 0, vz: 0, face: 0, want: [0, 0], act: 'none', at: 0, len: 0, side: 1, cool: 0, think: 0, call: 0, from: [0, 0], to: [0, 0], pending: null, pendingAt: 0, spot: role, pose: 'idle', flip: false, stamina: 1, charge: 0, cards: 0, out: false, judged: false, meter: -1, move: null, style: 0, fooled: null, take: 0, face0: 0, last: null, lastT: -9, way: null, turn: 0, gbe: false, picked: false, dribbled: false, screen: 0, cut: 0, gait: id * 1.7, gx: x, gz: z, buf: { pass: -9, shoot: -9, through: -9, lob: -9, skill: -9, aim: null }, ctrl: null, nod: null }
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
    if (rules.street && !rules.full) for (const team of [0, 1] as const) ps.push(makePlayer(6 + team, team, 3, team === 0 ? NAMES.mates[2] : NAMES.them[3], 0, 0))
    // The Palais des Sports' five a side: the forward and the centre of each side after the six (the court's places in turn: online.ts, court/lobby.go).
    if (rules.full) for (const team of [0, 1] as const) for (const role of [3, 4]) ps.push(makePlayer(ps.length, team, role, team === 0 ? NAMES.mates[role - 1] : NAMES.them[role], 0, 0))
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
    length: rules.length ?? (sport === 'basket' && rules.full ? 240 : LENGTH),
    foe: rules.foe ?? 1,
    golden: rules.golden ?? (street || (sport === 'basket' && !!rules.full)),
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
    full: sport === 'basket' && !!rules.full,
    hoops: sport === 'basket' && rules.full ? [[PRO.ring, 0], [-PRO.ring, 0]] : [HOOP, HOOP],
    clock: sport === 'basket' && rules.full ? SHOT_CLOCK : -1,
    fouls: [0, 0],
    arrow: 0,
    ft: null,
    inb: null,
    hold: 0,
    lastShot: null,
    ringHit: 0,
    comment: null,
    tip: -1,
    andOne: null,
    board: -9,
  }
  if (g.full) g.street = false
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
const goalOf = (g: Game, team: 0 | 1): V => (g.sport === 'basket' ? g.hoops[team] : [team === 0 ? g.field.x : -g.field.x, 0])
/** Inside the penalty box a team defends (team's own goal). */
const inBox = (g: Game, team: 0 | 1, x: number, z: number) => Math.abs(x - (team === 0 ? -g.field.x : g.field.x)) < g.field.box[0] && Math.abs(z) < g.field.box[1]
/** Which way a team attacks (football). */
const dirOf = (team: 0 | 1) => (team === 0 ? 1 : -1)
const fromHoop = (x: number, z: number) => hyp(x - HOOP[0], z - HOOP[1])
/** Basketball: the ring a team attacks (the full court has one each end), how far a point is from it, and a player from his. */
export const ringOf = (g: Game, team: 0 | 1): V => g.hoops[team]
const toRing = (g: Game, team: 0 | 1, x: number, z: number) => hyp(x - g.hoops[team][0], z - g.hoops[team][1])
const fromRing = (g: Game, p: Player) => toRing(g, p.team, p.x, p.z)
/** Facing the ring a player attacks. */
const faceRing = (g: Game, p: Player) => Math.atan2(g.hoops[p.team][0] - p.x, g.hoops[p.team][1] - p.z)
/**
 * A point in the frame of a team's ring: `u` metres out from the baseline's side towards the middle,
 * `v` across (the half-court's ring looks up +z; the full court's, along x towards centre court).
 */
export function ringFrame(g: Game, team: 0 | 1, u: number, v: number): V {
  const r = g.hoops[team]
  if (!g.full) return [r[0] + v, r[1] + u]
  const d = r[0] > 0 ? -1 : 1
  return [r[0] + d * u, r[1] + v * d]
}
/** Past the line that makes a basket worth more: the full court's three-point line, the half-court's arc (straight down in the corners). */
export function beyond(g: Game, team: 0 | 1, x: number, z: number) {
  const r = g.hoops[team]
  const [arc, corner] = g.full ? [PRO.arc, PRO.corner] : [ARC, CORNER]
  const along = g.full ? (x - r[0]) * (r[0] > 0 ? -1 : 1) : z - r[1]
  const across = g.full ? z - r[1] : x - r[0]
  if (along < Math.sqrt(arc * arc - corner * corner)) return Math.abs(across) > corner
  return hyp(x - r[0], z - r[1]) > arc
}
/** A basket's worth from there: the street's 1 and 2, the full court's 2 and 3. */
export const worth = (g: Game, team: 0 | 1, x: number, z: number) => (beyond(g, team, x, z) ? 1 : 0) + (g.full ? 2 : 1)
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
/** Football: a keeper with the ball in his hands. Nobody may challenge him (no tackle, no steal, no one pressing into him); he lets it go within HOLD_MAX seconds, and only then is the ball live again. */
export const inHands = (g: Game, p: Player | null): p is Player => !!p && g.sport === 'foot' && p.keeper && g.ball.owner === p.id && p.act === 'hold'
/** The six seconds a keeper may keep the ball in his hands. */
export const HOLD_MAX = 6

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
    p.picked = false
  }
  if (g.sport === 'basket') {
    g.ft = null
    g.inb = null
    g.lastShot = null
    if (g.clock >= 0) g.clock = SHOT_CLOCK
    // The full court: the opening tip at centre court (later restarts there are throw-ins: throwIn).
    if (g.full) return tipOff(g)
    // Le basket de rue: who's on, who waits behind the wall.
    if (g.street) {
      lineup(g, g.phase !== 'count')
      for (const p of g.ps) if (p.out) offPitch(g, p)
    }
    const spots = checkSpots(g, team)
    for (const p of g.ps) {
      const s = spots.get(p.id)
      if (!s) continue
      ;[p.x, p.z] = s
      p.face = p.team === team ? Math.PI : Math.atan2(HOOP[0] - p.x, HOOP[1] - p.z) + Math.PI
    }
    // The check at the top: the man guarding hands it to the one with the ball, a bounce pass, and play is on when it's caught.
    const att = g.ps.filter((p) => p.team === team && !p.out)
    const first = att.find((p) => p.human) ?? att[0]
    const def = g.ps.filter((p) => p.team !== team && !p.out)
    const checker = nearest(def, first.x, first.z)[0]
    if (!checker) return give(g, first)
    first.face = Math.atan2(checker.x - first.x, checker.z - first.z)
    g.inb = { by: checker.id, to: first.id, at: [checker.x, checker.z], t: g.time, check: true }
    g.hold = g.time + 0.9
    b.owner = -1
    b.lastTeam = team
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

/**
 * Basketball, the half-court: where each one stands for the check at the top, the side with the ball
 * out past the arc (the first, the player's own when it's theirs, at the top), each of the others a
 * step in front of his man towards the ring.
 */
function checkSpots(g: Game, team: 0 | 1) {
  const out = new Map<number, V>()
  const att = g.ps.filter((p) => p.team === team && !p.out)
  const def = g.ps.filter((p) => p.team !== team && !p.out)
  const first = att.find((p) => p.human) ?? att[0]
  const order = [first, ...att.filter((p) => p !== first)]
  const SPOT: V[] = [
    [0, 6.2],
    [-5.6, 2.2],
    [5.6, 2.2],
  ]
  order.forEach((p, i) => {
    out.set(p.id, SPOT[i % 3])
    p.spot = i
  })
  def.forEach((p, i) => {
    const m = SPOT[i % 3]
    const d = fromHoop(m[0], m[1]) || 1
    const k = (i === 0 ? 1.1 : 1.5) / d
    out.set(p.id, [m[0] + (HOOP[0] - m[0]) * k, m[1] + (HOOP[1] - m[1]) * k])
  })
  return out
}

/**
 * The full court's opening tip: the two centres in the circle at centre court facing each other, the
 * others round it, each on his own side (team 0 defends -x); the ball tossed up, the centres go for it,
 * one taps it to a team-mate.
 */
function tipOff(g: Game) {
  const b = g.ball
  for (const p of g.ps) {
    const d = p.team === 0 ? -1 : 1
    const SPOT: V[] = [
      [3.2, 0],
      [2.6, 3.4],
      [2.6, -3.4],
      [5.5, 1.5],
      [0.55, 0],
    ]
    const [u, v] = SPOT[p.role] ?? [4, 0]
    p.x = d * u
    p.z = v * -d
    p.face = d < 0 ? Math.PI / 2 : -Math.PI / 2
    p.want = [0, 0]
  }
  b.owner = -1
  b.flight = null
  ;[b.x, b.y, b.z] = [0, 1.6, 0]
  b.vx = b.vy = b.vz = 0
  g.tip = 0
  g.hold = Infinity
  g.clock = SHOT_CLOCK
}

/** The tip going on: up, the centres jump at it, the tap to a team-mate of the winner (who loses it gets the possession arrow). */
function tipping(g: Game, dt: number) {
  const b = g.ball
  if (g.phase !== 'play') return
  g.tip += dt
  const t = g.tip
  b.x = b.z = 0
  b.y = 1.6 + 6.2 * t - 4.9 * t * t
  const centres = g.ps.filter((p) => p.role === 4)
  if (t >= 0.32 && t - dt < 0.32) for (const c of centres) startAct(c, 'block', 0.85)
  if (t < 0.68) return
  const w = centres[g.rnd() < 0.5 ? 0 : 1]
  const to = nearest(g.ps.filter((p) => p.team === w.team && p !== w), w.x - (w.team === 0 ? 2 : -2), 0)[0] ?? w
  g.tip = -1
  g.hold = 0
  g.arrow = w.team === 0 ? 1 : 0
  g.poss = w.team
  b.flight = { kind: 'pass', from: [0, b.y, 0], to: [to.x, 1.2, to.z], t: 0, len: 0.55, apex: 0.4, by: w.id, team: w.team, target: to.id, make: false, points: 0, tried: [] }
  b.lastBy = w.id
  b.lastTeam = w.team
  say(g, tr('Entre-deux gagné par {name} !', { name: w.name }))
  moment(g, 'jump', w)
}

/**
 * The full court: the ball out of bounds (a basket, a ball gone out, a foul, the shot clock run out),
 * thrown back in by `team` from `at` (just outside the line): the nearest of the side goes to take it,
 * nobody else is moved; he has five seconds (the AI a moment) to pass it in.
 */
function throwIn(g: Game, team: 0 | 1, at: V) {
  const b = g.ball
  const side = g.ps.filter((p) => p.team === team && !p.out)
  const by = nearest(side, at[0], at[1])[0]!
  const to = nearest(side.filter((p) => p !== by), at[0] * 0.8, at[1] * 0.6)[0] ?? by
  for (const p of g.ps) {
    p.pending = null
    if (p.act !== 'cheer' && p.act !== 'celebrate') p.act = 'none'
    p.picked = false
  }
  ;[by.x, by.z] = at
  by.vx = by.vz = 0
  by.face = Math.atan2(-at[0] * 0.3, -at[1])
  b.owner = -1
  b.flight = null
  b.dead = false
  g.ft = null
  g.poss = team
  g.cleared = true
  g.possT = 0
  g.lastShot = null
  g.clock = SHOT_CLOCK
  g.inb = { by: by.id, to: to.id, at, t: g.time, check: false }
  b.lastTeam = team
}

/** The ball put in play: thrown in (or checked) to the one it's for, or to whoever the hands aim at. */
function putIn(g: Game, aim: V | null) {
  const inb = g.inb!
  const b = g.ball
  const by = g.ps[inb.by]
  const team = inb.check ? g.poss : by.team
  let to = g.ps[inb.to]
  if (!inb.check) {
    // Whoever is open, the player's own when it asks or the hands aim at them.
    const list = g.ps.filter((q) => q.team === team && q !== by && !q.out)
    let best = -Infinity
    for (const q of list) {
      const [dx, dz] = [q.x - by.x, q.z - by.z]
      const d = hyp(dx, dz) || 1
      const score = aim && hyp(aim[0], aim[1]) > 0.3 ? (dx * aim[0] + dz * aim[1]) / d / hyp(aim[0], aim[1]) : Math.min(3, openness(g, q)) * 0.5 - d * 0.08 + (q.call > 0 ? 2 : 0)
      if (score > best) [best, to] = [score, q]
    }
  }
  const d = hyp(to.x - by.x, to.z - by.z)
  b.flight = { kind: inb.check ? 'bounce' : 'pass', from: [by.x, 1.2, by.z], to: [to.x, 1.1, to.z], t: 0, len: 0.2 + d / 11, apex: 0.25, by: inb.check ? to.id : by.id, team, target: to.id, make: false, points: 0, tried: inb.check ? g.ps.map((q) => q.id) : [] }
  startAct(by, 'pass', 0.35)
  by.side = inb.check ? -1 : 1
  by.face = Math.atan2(to.x - by.x, to.z - by.z)
  g.inb = null
  g.hold = 0
  b.lastBy = by.id
  b.lastTeam = team
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
  const from = b.lastTeam
  b.owner = p.id
  b.rel = undefined
  b.curl = 0
  b.flight = null
  b.lastTeam = p.team
  b.lastBy = p.id
  b.meant = -1
  b.tried = []
  b.dead = false
  b.lofted = false
  p.think = 0.25
  p.call = 0
  p.picked = false
  p.dribbled = false
  p.cut = 0
  if (changed) {
    g.poss = p.team
    g.possT = 0
    // Basketball, street rules: won back under the basket, it must go out past the arc before it can score.
    g.cleared = g.sport === 'basket' && !g.full ? beyond(g, p.team, p.x, p.z) : true
    if (g.clock >= 0) g.clock = SHOT_CLOCK
  } else if (g.clock >= 0 && g.lastShot?.iron && g.lastShot.team === p.team) {
    // An offensive rebound off the iron: fourteen seconds.
    g.clock = Math.max(g.clock, SHOT_CLOCK_OREB)
  }
  if (g.sport === 'basket') g.lastShot = null
  if (g.shot && p.keeper) g.shot = null
  // A keeper who gets the ball in his own box takes it in his hands at once (a team-mate's pass back is played with the feet, as in the rules).
  if (g.sport === 'foot' && p.keeper && !p.out && inBox(g, p.team, p.x, p.z) && !(g.lastPass && g.lastPass.team === p.team && g.lastPass.by !== p.id && g.time - g.lastPass.t < 3 && from === p.team)) {
    startAct(p, 'hold', HOLD_MAX + 0.4)
    p.vx *= 0.3
    p.vz *= 0.3
  }
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
    else score = Math.min(4, openness(g, q)) * 0.4 - d * (g.size === 11 ? 0.018 : 0.03) + (g.sport === 'foot' ? ((q.x - p.x) * dirOf(p.team)) * 0.05 : 0) + (q.human ? 0.5 : 0) - (g.sport === 'basket' && laneGap(foes(g, p), [p.x, p.z], [q.x, q.z]) < 0.7 ? 1.2 : 0)
    // The assist: a lane an opponent stands in is a pass he'll cut out (a lob goes over him).
    if (g.sport === 'foot' && kind !== 'lob' && kind !== 'throw' && laneGap(foes(g, p), [p.x, p.z], [q.x, q.z]) < 1.1) score -= aim ? 0.35 : 0.8
    // A through ball looks for the run in behind; a lob, for a head in the box.
    if (kind === 'through') score += ((q.x - p.x) * dirOf(p.team)) * 0.06
    if (kind === 'lob' && inBox(g, q.team === 0 ? 1 : 0, q.x, q.z)) score += 1.2
    // (A cross isn't lifted to a man a few steps away.)
    if (kind === 'lob' && !aim && fifa(g) && hyp(q.x - p.x, q.z - p.z) < (g.size === 11 ? 9 : 6)) score -= 2
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
    b.flight = { kind: bounce ? 'bounce' : 'pass', from: [p.x + fx * 0.35, 1.15, p.z + fz * 0.35], to: [target[0], 1.1, target[1]], t: 0, len: 0.15 + d / 13, apex: 0.25, by: p.id, team: p.team, target: to.id, make: false, points: 0, tried: [] }
    startAct(p, 'pass', 0.35)
    p.side = bounce ? -1 : 1
    p.face = Math.atan2(target[0] - p.x, target[1] - p.z)
    // Pass and cut: the AI goes to the ring for the ball back now and then (the give-and-go).
    if (!p.human && g.rnd() < 0.35 && toRing(g, p.team, p.x, p.z) < 9) p.cut = 1.6
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
  // (A lob is longer on its way: where he'll be when it comes down.)
  const eta = kind === 'lob' && !g.street ? (2 * clamp(3.5 + d0 * 0.14, 4.5, 10)) / 9.8 : d0 / 13
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
  if (through && p.human) say(g, tr('Passe en profondeur !'))
  else if (kind === 'lob' && p.human && inBox(g, p.team === 0 ? 1 : 0, tx, tz)) say(g, tr('Centre !'))
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
  const H = ringOf(g, p.team)
  const b = g.ball
  if (b.owner !== p.id || locked(p)) return
  if (g.sport === 'foot') return kickAtGoal(g, p, aim, power)
  // At the free-throw line: only the shot, from where he stands, once the referee has given him the ball.
  const ft = !!g.ft && g.ft.by === p.id
  if (ft && g.ft!.t > g.time) return
  // Le basket de rue: the gauge full, the Gbê.
  if (g.street && p.style >= 1 && !ft) return hoopGbe(g, p)
  const d = fromRing(g, p)
  const sp = p.picked || ft ? 0 : speedOf(p)
  const toward = sp > 0.1 ? ((H[0] - p.x) * p.vx + (H[1] - p.z) * p.vz) / (d * sp || 1) : 0
  const blocker = guardOf(g, p)
  // A man set right in his way under the ring: no room to go up for the dunk, it's a layup (the player's own on the button: buttons()).
  const walled = !!blocker && dist(blocker, p) < 1.25 && blocker.act !== 'beaten'
  if (d < 3.8 && sp > 2.2 && toward > 0.2 && !walled) {
    // The dunk: two steps to the ring, up, the ball thrown down through it, hanging there.
    startAct(p, 'dunk', 1.7)
    p.from = [p.x, p.z]
    p.to = [H[0] + ((p.x - H[0]) / (d || 1)) * 0.32, H[1] + ((p.z - H[1]) / (d || 1)) * 0.32]
    p.face = Math.atan2(H[0] - p.x, H[1] - p.z)
    // A hand in the way? The man guarding him, right there, going up too.
    p.pending = () => {
      if (blocker && dist(blocker, p) < 1.5 && tryBlock(g, blocker, 0.16)) return swat(g, blocker, p)
      // Late, into his body: a foul, and the basket counts.
      if (blocker && dist(blocker, p) < 1.0 && blocker.act === 'block' && g.rnd() < 0.3) shootingFoul(g, blocker, p)
      p.pending = () => dunkThrough(g, p)
      p.pendingAt = 0.55
    }
    p.pendingAt = 0.32
    return
  }
  if (d < 2.6 && !ft) {
    startAct(p, 'layup', 0.95)
    p.from = [p.x, p.z]
    p.to = [H[0] + ((p.x - H[0]) / (d || 1)) * 0.9, H[1] + ((p.z - H[1]) / (d || 1)) * 0.9]
    p.face = Math.atan2(H[0] - p.x, H[1] - p.z)
    p.pending = () => release(g, p, 0.74, 0.35)
    contestJump(g, blocker, p, 0.2)
    p.pendingAt = 0.42
    return
  }
  // On the move a little further out: the floater, one-handed off the run, high over the hands.
  if (d < 4.4 && sp > 3 && toward > 0.5 && !ft) {
    startAct(p, 'layup', 0.95)
    p.from = [p.x, p.z]
    p.to = [p.x + (p.vx / sp) * 0.9, p.z + (p.vz / sp) * 0.9]
    p.face = Math.atan2(H[0] - p.x, H[1] - p.z)
    p.pending = () => release(g, p, 0.5, 0.75)
    p.pendingAt = 0.36
    return
  }
  if (!ft) contestJump(g, blocker, p, metered ? 0.55 : 0.12)
  // The jump shot: up, released at the top (on the meter: when Tir is let go).
  startAct(p, 'shoot', metered ? 1.3 : 0.8)
  p.vx *= 0.2
  p.vz *= 0.2
  p.face = Math.atan2(H[0] - p.x, H[1] - p.z)
  if (metered) {
    p.meter = 0
    p.pending = null
    return
  }
  const chance = jumpChance(g, p)
  p.pending = () => release(g, p, chance, 0.75 + d * 0.05)
  p.pendingAt = ft ? 0.5 : 0.42
}

/** A jump shot's chance from where he is (before the man guarding takes some off): a free throw, close in, inside the line, past it. */
function jumpChance(g: Game, p: Player) {
  if (g.ft && g.ft.by === p.id) return 0.74
  const d = fromRing(g, p)
  return d < 3.5 ? 0.58 : !beyond(g, p.team, p.x, p.z) ? 0.46 : g.full ? 0.36 : 0.37
}

/** The meter let go (or run over): the shot leaves, its chance from where the meter stood. */
function letGo(g: Game, p: Player) {
  const q = Math.min(1, p.meter)
  p.meter = -1
  const d = fromRing(g, p)
  const base = jumpChance(g, p)
  const [lo, hi] = METER_GOOD
  let chance: number
  if (q >= lo && q <= hi) {
    chance = Math.min(g.ft ? 0.96 : 0.9, base + 0.3)
    if (p.human) say(g, tr('Parfait !'))
  } else {
    // The further off the green, the less it goes in.
    const off = q < lo ? lo - q : q - hi
    chance = base * Math.max(0.25, 1 - off * 2.2)
    if (p.human) say(g, q < lo ? tr('Trop tôt !') : tr('Trop tard !'))
  }
  release(g, p, chance, 0.75 + d * 0.05)
}

/** The man guarding a player: the nearest opponent between him and the ring. */
function guardOf(g: Game, p: Player) {
  const H = ringOf(g, p.team)
  let best: Player | null = null
  let d = Infinity
  for (const q of foes(g, p)) {
    const e = dist(q, p)
    const inFront = (q.x - p.x) * (H[0] - p.x) + (q.z - p.z) * (H[1] - p.z) > 0
    if (e < d && (inFront || e < 0.9)) [best, d] = [q, e]
  }
  return best
}

/** The AI's man guarding a shooter goes up with him, timed to meet the ball as it leaves (after `wait` s), most of the time when he's close and in front. */
function contestJump(g: Game, q: Player | null, p: Player, wait: number) {
  if (!q || q.human || q.act !== 'none' || q.cool > 0.3 || dist(q, p) > 1.6 || g.rnd() > 0.6) return
  q.pending = () => startAct(q, 'block', 0.85)
  q.pendingAt = q.at + wait
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
  const H = ringOf(g, shooter.team)
  const b = g.ball
  const [dx, dz] = [shooter.x - H[0], shooter.z - H[1]]
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
  say(g, by.human ? tr('Contré ! Quel contre !') : shooter.human ? tr('Contré…') : tr('Contré !'))
  moment(g, 'block', by)
  if (by.id === g.me) g.stats.blocks++
  // A blocked dunk comes down at once.
  if (shooter.act === 'dunk') startAct(shooter, 'layup', 0.6)
}

/**
 * The ball let go towards the ring: in or out is decided now (the man guarding takes some off; not off
 * the Gbê's, `sure`), and how: clean through, off the iron and in, off the board (from the side, not too
 * far). A hand going into the shooter (close, going up into him or reaching) is a foul. A miss is aimed
 * at the iron (front, back, a side), now and then off the board first, and comes off it for the rebound.
 */
function release(g: Game, p: Player, chance: number, len: number, sure = false) {
  const H = ringOf(g, p.team)
  const b = g.ball
  const d = fromRing(g, p)
  const ft = !!g.ft && g.ft.by === p.id
  const q = sure || ft ? null : guardOf(g, p)
  let contest = 0
  if (q) {
    const e = dist(q, p)
    if (e < 1.25 && q.act === 'block' && tryBlock(g, q, 0.45)) return swat(g, q, p)
    if (e < 1.7) contest = (1.7 - e) * 0.24
    // Up into him, or a hand on the arm: the whistle (a layup in traffic most of all).
    if (e < 0.9 && (q.act === 'block' || q.act === 'steal') && g.rnd() < (e < 0.6 ? 0.4 : 0.18) + (p.act === 'layup' ? 0.1 : 0)) {
      shootingFoul(g, q, p)
      contest *= 1.4
    }
    // The AI goes up at the shot.
    if (!q.human && e < 1.5 && q.act === 'none' && g.rnd() < 0.55) startAct(q, 'block', 0.85)
  }
  const make = g.rnd() < chance - contest
  const points = ft ? 1 : worth(g, p.team, p.x, p.z)
  const [fx, fz] = fwd(p)
  const from: [number, number, number] = [p.x + fx * 0.25, p.act === 'layup' ? 2.45 : 2.5, p.z + fz * 0.25]
  // From the side and not too far, off the board now and then (a layup from the side, mostly).
  const [ux, uz] = [(p.x - H[0]) / (d || 1), (p.z - H[1]) / (d || 1)]
  const across = g.full ? Math.abs(uz) : Math.abs(ux)
  const bank = !ft && across > 0.45 && across < 0.92 && d < 5.5 && g.rnd() < (p.act === 'layup' ? 0.7 : 0.3)
  const via: 'swish' | 'rim' | 'bank' = bank ? 'bank' : g.rnd() < 0.28 ? 'rim' : 'swish'
  const boardAt = boardPoint(g, p.team, g.full ? uz : ux)
  let to: [number, number, number]
  if (make) to = via === 'bank' ? [boardAt[0], RIM_Y + 0.42, boardAt[1]] : via === 'rim' ? [H[0] + ux * RING_R * 0.95, RIM_Y + 0.1, H[1] + uz * RING_R * 0.95] : [H[0], RIM_Y + 0.05, H[1]]
  else {
    // The front of the iron (short), the back (long), or a side; from the side now and then off the board first.
    const r = g.rnd()
    const k = r < 0.4 ? 1 : r < 0.75 ? -1 : 0
    const side = g.rnd() < 0.5 ? -1 : 1
    const [vx, vz] = k ? [ux * k, uz * k] : [uz * side, -ux * side]
    to = bank || (across > 0.5 && g.rnd() < 0.2) ? [boardAt[0], RIM_Y + 0.5, boardAt[1]] : [H[0] + vx * (RING_R + 0.06), RIM_Y + 0.08, H[1] + vz * (RING_R + 0.06)]
  }
  b.owner = -1
  b.flight = { kind: 'shot', from, to, t: 0, len, apex: p.act === 'layup' ? (len > 0.5 ? 1.0 : 0.45) : 1.1 + d * 0.11, by: p.id, team: p.team, target: -1, make, points, tried: [], ft, via: make ? via : undefined, ring: p.team, leg: false }
  b.lastBy = p.id
  b.lastTeam = p.team
  p.cool = 0.4
  g.lastShot = { by: p.id, team: p.team, points, t: g.time, iron: false }
  // The last free throw: the lane goes for the rebound as it leaves the hand.
  if (ft && g.ft!.left <= 1) g.hold = 0
}

/** The point on the board a bank shot hits, to the side the shot comes from (`side`: -1…1 across). */
function boardPoint(g: Game, team: 0 | 1, side: number): V {
  const H = ringOf(g, team)
  if (g.full) return [Math.sign(H[0]) * (PRO.board - 0.14), H[1] + side * 0.22]
  return [H[0] + side * 0.22, BOARD_Z + 0.14]
}

/** A foul on the shooter: the whistle, the team foul; the basket counts and one free throw, or missed, the free throws (one a point). */
function shootingFoul(g: Game, by: Player, on: Player) {
  if (g.andOne) return
  g.andOne = { on: on.id, by: by.id }
  g.fouls[by.team]++
  g.ref.whistle = g.time
  say(g, tr('Faute sur le tir ! ({name})', { name: by.name }))
  moment(g, 'foul', by)
}

/**
 * Free throws for `p`: the shooter at the line, the others along the lane (the side defending nearest the
 * ring) or out past the arc; nobody moves until the last one leaves the hand.
 */
export function freeThrows(g: Game, p: Player, n: number) {
  const b = g.ball
  const team = p.team
  const other: 0 | 1 = team === 0 ? 1 : 0
  g.ft = { by: p.id, left: n, of: n, t: g.time + 1.6 }
  g.tip = -1
  g.hold = Infinity
  g.andOne = null
  g.inb = null
  b.flight = null
  b.dead = false
  const key = g.full ? PRO.key : 2.45
  const lane: [V, 0 | 1][] = [
    [[1.4, key + 0.5], other],
    [[1.4, -key - 0.5], other],
    [[2.4, key + 0.5], team],
    [[2.4, -key - 0.5], team],
    [[3.4, key + 0.5], other],
    [[3.4, -key - 0.5], other],
  ]
  const used = new Set<number>()
  let rest = 0
  for (const q of g.ps) {
    if (q.out) continue
    q.act = 'none'
    q.pending = null
    q.vx = q.vz = 0
    q.want = [0, 0]
    if (q === p) {
      ;[q.x, q.z] = ringFrame(g, team, 4.22, 0)
      q.face = faceRing(g, q)
      continue
    }
    const k = lane.findIndex(([, t], i) => t === q.team && !used.has(i))
    if (k >= 0) {
      used.add(k)
      ;[q.x, q.z] = ringFrame(g, team, lane[k][0][0], lane[k][0][1])
    } else {
      // Out past the line, behind the shooter.
      rest++
      ;[q.x, q.z] = ringFrame(g, team, g.full ? 8.6 : 7.6, (rest % 2 ? 1 : -1) * (1 + rest))
    }
    q.face = faceRing(g, p)
  }
  give(g, p)
  p.picked = true
  say(g, n > 1 ? tr('{n} lancers francs pour {name}', { n, name: p.name }) : tr('Un lancer franc pour {name}', { name: p.name }))
  moment(g, 'ft', p)
}

/** A free throw in or out: the next one, or after the last, the ball to the others (in) or a live rebound (out). */
function ftDone(g: Game, made: boolean) {
  const ft = g.ft!
  const p = g.ps[ft.by]
  const b = g.ball
  ft.left--
  if (made) {
    g.score[p.team] += 1
    if (p.id === g.me) g.stats.points += 1
    say(g, ft.left ? tr('Dedans ! Encore un.') : tr('Lancer franc réussi !'))
    moment(g, 'basket', p)
  } else if (ft.left) say(g, tr('Raté… encore un.'))
  if (ft.left > 0) {
    // The next one: back in his hands at the line.
    g.phase = 'dead'
    g.wait = 1
    b.dead = true
    g.then = () => {
      give(g, p)
      p.picked = true
      ;[p.x, p.z] = ringFrame(g, p.team, 4.22, 0)
      p.face = faceRing(g, p)
      ft.t = g.time + 1.1
      g.hold = Infinity
    }
    return
  }
  g.ft = null
  g.hold = 0
  if (made) {
    const other: 0 | 1 = p.team === 0 ? 1 : 0
    g.phase = 'dead'
    g.wait = 1.2
    b.dead = true
    g.then = () => (g.full ? throwIn(g, other, baseline(g, p.team)) : restart(g, other))
  }
  // Missed: a live ball off the iron (moveBall), the lane goes for it.
}

/** The full court: where a throw-in after a basket on the ring `team` attacks is taken, just past its baseline, beside the board. */
function baseline(g: Game, team: 0 | 1): V {
  const r = g.hoops[team]
  return [Math.sign(r[0]) * (PRO.x + 0.45), r[1] + (g.rnd() < 0.5 ? -1.8 : 1.8)]
}

/**
 * A foul away from the shot (a reach from behind, a body into the dribbler): the whistle, the team foul;
 * the side fouled keeps the ball (a check, a throw-in from the side), and on the full court past the
 * bonus, two free throws.
 */
function personalFoul(g: Game, by: Player, on: Player) {
  const b = g.ball
  g.fouls[by.team]++
  g.ref.whistle = g.time
  moment(g, 'foul', by)
  say(g, tr('Faute de {name} !', { name: by.name }))
  b.owner = -1
  b.flight = null
  b.vx = b.vy = b.vz = 0
  b.dead = true
  on.pending = null
  by.pending = null
  g.phase = 'dead'
  g.wait = 1.1
  const bonus = g.full && g.fouls[by.team] > BONUS
  g.then = () => (bonus ? freeThrows(g, on, 2) : g.full ? throwIn(g, on.team, sideline(on.x, on.z)) : restart(g, on.team))
}

/** The full court: the nearest point just out over the sideline (never in front of the baskets). */
function sideline(x: number, z: number): V {
  return [clamp(x, -PRO.x + 3.5, PRO.x - 3.5), Math.sign(z || 1) * (PRO.z + 0.45)]
}

/** A held ball (both on it, the dribble picked up): the jump-ball call, the ball to the side the possession arrow says, which turns. */
function heldBall(g: Game, h: Player, by: Player) {
  const b = g.ball
  const team = g.arrow
  g.arrow = team === 0 ? 1 : 0
  g.ref.whistle = g.time
  say(g, tr('Entre-deux ! La flèche donne la balle aux {0}.', { 0: team === h.team ? tr('attaquants') : tr('défenseurs') }))
  moment(g, 'jump', by)
  b.owner = -1
  b.dead = true
  h.pending = null
  g.phase = 'dead'
  g.wait = 1.2
  g.then = () => (g.full ? throwIn(g, team, sideline(h.x, h.z)) : restart(g, team))
}

/** The dunk goes down through the ring: the ring pulled down, the net flying, two hands on the iron (the alley-oop's, the Gbê's: `how`). */
function dunkThrough(g: Game, p: Player, how?: 'alley' | 'gbe') {
  const H = ringOf(g, p.team)
  const b = g.ball
  b.owner = -1
  b.flight = null
  b.x = H[0]
  b.z = H[1]
  b.y = RIM_Y - 0.05
  b.vx = b.vz = 0
  b.vy = -3.5
  b.dead = true
  g.rim = { t: g.time, amp: how === 'gbe' ? 0.32 : 0.16 }
  g.swish = g.time
  g.ringHit = p.team
  g.lastShot = null
  scored(g, p, g.full ? 2 : 1, true, how)
}

/** A basket: the points (if the ball went out past the arc first), the crowd, then the others check it at the top. */
function scored(g: Game, p: Player, points: number, dunk: boolean, how?: 'alley' | 'gbe') {
  const other: 0 | 1 = p.team === 0 ? 1 : 0
  if (!g.cleared) {
    say(g, tr('Panier refusé : la balle devait ressortir !'))
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
  const far = g.full ? points === 3 : points === 2
  say(g, how === 'alley' ? tr('ALLEY-OOP !!!') : how === 'gbe' ? tr('GBÊÊÊ !!! Le cercle a plié !') : dunk ? (p.human ? tr('DUNK !!! Le terrain explose !') : tr('DUNK !!!')) : far ? (g.full ? tr('À trois points !') : tr('De loin ! 2 points !')) : tr('Paniiier !'))
  moment(g, how === 'alley' ? 'alley' : dunk ? 'dunk' : far ? 'three' : 'basket', p)
  g.phase = 'dead'
  g.wait = dunk ? 2.4 : 1.5
  // Fouled on the way: the basket counts, and one free throw.
  const and1 = g.andOne?.on === p.id
  if (and1) say(g, tr('Panier, et la faute ! Un lancer en plus.'))
  // Le basket de rue: make it, take it (the side that scored checks it again); the full court: the others throw it in from under the basket.
  g.then = () => (and1 ? freeThrows(g, p, 1) : g.full ? throwIn(g, other, baseline(g, p.team)) : restart(g, g.street ? p.team : other))
  g.andOne = null
  // The scorer shows it (landed first); the others cheer him.
  if (!locked(p) || p.act === 'shoot') startAct(p, 'celebrate', g.wait)
  for (const q of g.ps) if (q.team === p.team && q !== p && !locked(q)) startAct(q, 'cheer', g.wait)
}

/* ---------- Le basket de rue's flights ---------- */

/** The Gbê's dunk: from this close (m), else the shot in flames. */
export const GBE_REACH = 7.5

/** An alley-oop to `q`: running in near the ring, nobody on him, far enough from the pass (the AI's passer sees it about half the time). */
function alleyFor(g: Game, p: Player, q: Player) {
  const d = toRing(g, q.team, q.x, q.z)
  if (d > 3.4 || d < 0.9 || dist(p, q) < 2.6 || q.act !== 'none' || q.out) return false
  if (nearest(foes(g, q), q.x, q.z)[1] < 0.95) return false
  return p.human || g.rnd() < 0.55
}

/** The alley-oop: lobbed up by the ring, the team-mate going up to meet it, caught at the top and put down through. */
function alley(g: Game, p: Player, q: Player) {
  const H = ringOf(g, p.team)
  const b = g.ball
  const d = toRing(g, q.team, q.x, q.z) || 1
  const [ux, uz] = [(q.x - H[0]) / d, (q.z - H[1]) / d]
  const len = 0.62
  const [fx, fz] = fwd(p)
  // (Lobbed from over the head: over the hands of the man in front.)
  b.flight = { kind: 'pass', from: [p.x + fx * 0.35, 2.3, p.z + fz * 0.35], to: [H[0] + ux * 0.45, 2.85, H[1] + uz * 0.45], t: 0, len, apex: 1.0, by: p.id, team: p.team, target: q.id, make: false, points: 0, tried: [] }
  startAct(p, 'pass', 0.35)
  p.side = 1
  p.face = Math.atan2(H[0] - p.x, H[1] - p.z)
  if (p.human) say(g, tr('Alley-oop !'))
  // Up off the ground as it comes: there at the top, the ball in his hands, down through the ring.
  startAct(q, 'dunk', 1.7)
  q.gbe = false
  q.from = [q.x, q.z]
  q.to = [H[0] + ux * 0.32, H[1] + uz * 0.32]
  q.face = Math.atan2(H[0] - q.x, H[1] - q.z)
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
  const H = ringOf(g, p.team)
  const d = fromRing(g, p)
  p.style = 0
  p.meter = -1
  g.gbe = g.time
  moment(g, 'gbe', p)
  p.face = Math.atan2(H[0] - p.x, H[1] - p.z)
  if (d < GBE_REACH) {
    say(g, p.human ? tr('GBÊÊÊ !!! Il s’envole !') : tr('Le Gbê de {name} !', { name: p.name }))
    startAct(p, 'dunk', 1.9)
    p.gbe = true
    p.from = [p.x, p.z]
    p.to = [H[0] + ((p.x - H[0]) / (d || 1)) * 0.32, H[1] + ((p.z - H[1]) / (d || 1)) * 0.32]
    const blocker = guardOf(g, p)
    p.pending = () => {
      if (blocker && dist(blocker, p) < 1.3 && g.rnd() < 0.07) return swat(g, blocker, p)
      p.pending = () => dunkThrough(g, p, 'gbe')
      p.pendingAt = 0.95
    }
    p.pendingAt = 0.5
    return
  }
  say(g, p.human ? tr('GBÊÊÊ !!! En feu !') : tr('Le Gbê de {name} !', { name: p.name }))
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
    // A soft one (a quick tap of Tir) is the finesse: curled into the far side, placed rather than struck; held long, the power shot.
    const finesse = power < 0.42 && !pen && d > 6
    z = want + (g.rnd() - 0.5) * (0.4 + d * 0.07) * (finesse ? 0.55 : 0.7 + power * 0.6) * (pen ? 0.6 : 1)
    speed = finesse ? 17 + d * 0.1 : 14 + power * 13
    h = finesse ? 0.3 + g.rnd() * 0.9 : 0.2 + g.rnd() * (0.4 + power * 1.1) + power * power * power * 1.6 + (d > 20 ? 0.5 : 0)
    if (g.street) h *= F.bar / 2
    if (finesse) {
      if (p.human) say(g, tr('Tir enroulé…'))
      return fire(g, p, goal, z, h, speed, 'kick', false, 'curl')
    }
    if (power > 0.88 && p.human) say(g, tr('Frappe de mule !'))
    fire(g, p, goal, z, h, speed, 'kick')
    if (g.set?.taker === p.id) g.set = null
    return
  }
  // The street's little goals: lower.
  if (g.street) h *= F.bar / 2
  fire(g, p, goal, z, h, speed, 'kick')
  if (g.set?.taker === p.id) g.set = null
}

/** The chip (Centre near the goal, or the AI seeing the keeper off his line): lifted softly over him, dropping under the bar. */
export function chip(g: Game, p: Player, aim: V | null) {
  const b = g.ball
  if (b.owner !== p.id || locked(p) || g.sport !== 'foot') return
  const F = g.field
  const goal = goalOf(g, p.team)
  const d = hyp(goal[0] - p.x, goal[1] - p.z)
  const want = aim && Math.abs(aim[1]) > 0.25 ? Math.sign(aim[1]) * F.mouth * 0.55 : (g.rnd() - 0.5) * F.mouth
  const z = want + (g.rnd() - 0.5) * (0.3 + d * 0.06)
  if (p.human) say(g, tr('Le piqué !'))
  fire(g, p, goal, z, F.bar * 0.75, clamp(6 + d * 0.32, 7, 13), 'kick', false, 'chip')
  if (g.set?.taker === p.id) g.set = null
}

/** Near enough the goal for a chip. */
export const chipRange = (g: Game, p: Player) => {
  const goal = goalOf(g, p.team)
  const d = hyp(goal[0] - p.x, goal[1] - p.z)
  return g.sport === 'foot' && d > 5 && d < (g.size === 11 ? 28 : g.street ? 11 : 16) && Math.abs(p.z) < g.field.box[1] * 1.2
}

/** A shot leaves the foot (or the head) for (goalX, z) at height h: the keeper's chance worked out now. */
function fire(g: Game, p: Player, goal: V, z: number, h: number, speed: number, act: 'kick' | 'head', /** The Gbê: hardly ever saved. */ sure = false, /** A curled finesse shot, or a chip over the keeper. */ how: 'curl' | 'chip' | null = null) {
  const b = g.ball
  const F = g.field
  // The flight time to the goal (as the street's shot always reckoned it), the line to the corner aimed at.
  const d = hyp(goal[0] - p.x, goal[1] - p.z) || 1
  const T = d / speed
  const vy = (h - b.y + 4.9 * T * T) / T
  // The curl: struck wide of the far side, the spin bending it back in.
  const curl = how === 'curl' ? -Math.sign(z || 1) * (g.size === 11 ? 7 : 5) : 0
  const [tx, tz] = [goal[0], z - 0.5 * curl * T * T]
  const l = hyp(tx - p.x, tz - p.z) || 1
  p.face = Math.atan2(tx - p.x, tz - p.z)
  const pen = g.set?.kind === 'pen' && g.set.taker === p.id
  const launch = () => {
    b.owner = -1
    b.flight = null
    b.vx = ((tx - p.x) / l) * speed
    b.vz = ((tz - p.z) / l) * speed
    b.vy = vy
    b.curl = curl
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
    else if (how === 'chip') {
      // Over a keeper off his line it drops in behind him; one on his line just catches it.
      const off = Math.abs(keeper.x - goal[0])
      save = onTarget && g.rnd() < (off > 3 ? 0.12 : off > 1.6 ? 0.35 : 0.65) * good
    } else if (how === 'curl') save = onTarget && g.rnd() < clamp((0.5 + (T - 0.6) * 0.4 - reach * 0.22 * (1.6 / F.mouth)) * good, 0.08, 0.8)
    else save = onTarget && g.rnd() < clamp((0.62 + (T - 0.6) * 0.5 - reach * 0.2 * (1.6 / F.mouth) - (Math.abs(z) > 1.1 * (F.mouth / 1.6) ? 0.12 : 0) - (act === 'head' ? 0.08 : 0)) * good, 0.08, 0.88)
    g.shot = { keeper: keeper.id, save, t: g.time + T, z, goalX: goal[0] }
  }
  if (act === 'head') {
    if (p.act !== 'head') startAct(p, 'head', 0.6)
    launch()
    return
  }
  startAct(p, 'kick', 0.5)
  b.vx = b.vz = b.vy = 0
  p.pending = launch
  p.pendingAt = 0.16
}

/**
 * The keeper lets the ball go from his hands: rolled or thrown to a team-mate
 * near and free, else punted up the pitch (`long`; the stick aims either).
 * The ball is live again only once it has left his hands.
 */
function keeperRelease(g: Game, p: Player, aim: V | null, long: boolean | null) {
  if (!inHands(g, p)) return
  const near = mates(g, p).filter((q) => !q.keeper && dist(q, p) > 5 && dist(q, p) < (g.size === 11 ? 25 : g.street ? 10 : 14) && openness(g, q) > 3)
  const punt = long ?? (!near.length || (g.size === 11 && g.rnd() < 0.35))
  p.act = 'none'
  p.cool = 0.5
  if (!punt) return pass(g, p, aim ?? [near[0].x - p.x, near[0].z - p.z], g.street ? 'ground' : 'throw')
  // The punt: out of the hands and volleyed long, towards the side the stick says (else the front men).
  const dir = dirOf(p.team)
  const F = g.field
  const ahead = mates(g, p).filter((q) => !q.keeper && (q.x - p.x) * dir > 8)
  const to = aim && hyp(aim[0], aim[1]) > 0.3 ? null : ahead.sort((a, c) => openness(g, c) - openness(g, a))[0]
  const tx = to ? to.x + dir * 2 : p.x + dir * F.x * (g.size === 11 ? 1.1 : 0.9)
  const tz = to ? to.z : aim ? clamp(p.z + aim[1] * F.z, -F.z + 2, F.z - 2) : clamp(p.z + (g.rnd() - 0.5) * F.z, -F.z + 2, F.z - 2)
  const d = hyp(tx - p.x, tz - p.z) || 1
  const vy = g.size === 11 ? 11 : g.street ? 4.2 : 6.5
  const air = (2 * vy) / 9.8
  const vh = Math.min(d / air, g.size === 11 ? 26 : 16)
  const b = g.ball
  p.face = Math.atan2(tx - p.x, tz - p.z)
  startAct(p, 'kick', 0.5)
  g.lastPass = { by: p.id, team: p.team, t: g.time, mine: p.id === g.me }
  p.pending = () => {
    b.owner = -1
    b.flight = null
    b.y = 0.9
    b.vx = ((tx - p.x) / d) * vh
    b.vz = ((tz - p.z) / d) * vh
    b.vy = vy
    b.lofted = fifa(g)
    b.lastBy = p.id
    b.lastTeam = p.team
    b.tried = [p.id]
    b.meant = to ? to.id : -1
  }
  p.pendingAt = 0.18
  if (g.switching && to && to.team === myTeam(g)) control(g, to)
}

/** Which way the keeper goes at a penalty: the local hands' stick if he's theirs, else a guess (sometimes he stays). */
function penGuess(g: Game, k: Player): -1 | 0 | 1 {
  if (k.team === myTeam(g) && g.switching && g.penStick !== null) return g.penStick
  const r = g.rnd()
  return r < 0.42 ? -1 : r < 0.84 ? 1 : 0
}

/** A lofted ball met with the head: at goal (an attacker near it, or one who asked with Tir), away (a defender in his own box), else on to a team-mate (the flick-on, or the headed pass the hands asked for). */
function header(g: Game, p: Player) {
  const b = g.ball
  const F = g.field
  const big = g.size === 11
  const goal = goalOf(g, p.team)
  const nod = p.nod && g.time - p.nod.t < 1.2 ? p.nod.k : p.human && g.time - Math.max(p.buf.shoot, p.buf.pass) < 1.6 ? (p.buf.shoot > p.buf.pass ? 'shot' : 'pass') : null
  p.nod = null
  p.buf.pass = p.buf.shoot = p.buf.through = p.buf.lob = p.buf.skill = -9
  const toGoal = hyp(goal[0] - p.x, goal[1] - p.z)
  // At goal: in the box, or near enough in front of it (the hands asking with Tir: a little further).
  const attacking = nearGoal(g, p) || (nod === 'shot' && toGoal < (big ? 22 : 13))
  const defending = inBox(g, p.team, p.x, p.z) && b.lastTeam !== p.team
  b.owner = -1
  b.lofted = false
  b.flight = null
  b.lastBy = p.id
  b.lastTeam = p.team
  b.tried = [p.id]
  b.meant = -1
  // (Not twice in a row: the ball just headed goes on.)
  p.cool = 0.4
  if (attacking && nod !== 'pass') {
    // Asked for, a little more often on target.
    const wide = nod === 'shot' ? 1.5 : 1.85
    const z = clamp((g.rnd() - 0.5) * F.mouth * wide, -F.mouth * 1.1, F.mouth * 1.1)
    say(g, p.human ? tr('Tête !') : tr('Tête de {name} !', { name: p.name }))
    // (Down into the ground and up, under the bar most of the time.)
    fire(g, p, goal, z, 0.25 + g.rnd() * F.bar * 0.85, 12 + g.rnd() * 5, 'head')
    return
  }
  if (p.act !== 'head') startAct(p, 'head', 0.5)
  const dir = dirOf(p.team)
  // On to a team-mate: the stick's way (the hands) or the one furthest up and free (a flick-on), within a header's reach.
  const aim: V | null = p.human && hyp(p.want[0], p.want[1]) > 0.5 ? p.want : null
  let to: Player | null = null
  let best = -Infinity
  if (!defending || nod === 'pass')
    for (const q of mates(g, p)) {
      if (q.keeper) continue
      const d = dist(q, p)
      if (d < 3 || d > (big ? 24 : 14)) continue
      const score = aim ? ((q.x - p.x) * aim[0] + (q.z - p.z) * aim[1]) / d / hyp(aim[0], aim[1]) : ((q.x - p.x) * dir) / d + Math.min(3, openness(g, q)) * 0.25
      if (score > best && (aim || (q.x - p.x) * dir > -2)) [best, to] = [score, q]
    }
  if (to) {
    const d = dist(to, p)
    const v = clamp(4 + d * 0.55, 6, 13)
    b.vx = ((to.x + to.vx * 0.4 - p.x) / d) * v
    b.vz = ((to.z + to.vz * 0.4 - p.z) / d) * v
    b.vy = 2.2
    b.meant = to.id
    p.face = Math.atan2(b.vx, b.vz)
    say(g, tr('Déviation de la tête !'))
    return
  }
  // Cleared: up and away towards the other half.
  b.vx = dir * (8 + g.rnd() * 4)
  b.vz = (g.rnd() - 0.5) * 9
  b.vy = 4 + g.rnd() * 2
  say(g, tr('Dégagé de la tête !'))
}

/** How high a header's jump has him at a moment of it (the pose's own curve, Human.tsx 'header'): its top 0,42 m at a quarter of a second. */
function jumpY(at: number) {
  return at < 0.12 ? -0.1 + 0.35 * (at / 0.12) : at < 0.24 ? 0.25 + 0.17 * ((at - 0.12) / 0.12) : at < 0.45 ? 0.42 - 0.3 * ((at - 0.24) / 0.21) : Math.max(0, 0.12 - (at - 0.45) * 0.8)
}
/** When a header's jump could meet the ball (s ahead): finely, a fast cross covers a metre in a few hundredths. */
const RISE_T = [0.14, 0.17, 0.2, 0.23, 0.26, 0.29, 0.32]
/** The head's height standing. */
const HEAD_Y = 1.68

/**
 * Up for a lofted ball: whoever will be under it, at head height, in about a quarter of a second
 * (the jump's top) goes up (the act 'head'): the ball then meets his head (touches). One a side.
 */
function rise(g: Game) {
  const b = g.ball
  if (!b.lofted || b.owner >= 0 || b.flight || b.y < 1) return
  // (The one a lofted pass is for takes it down on the chest, unless he's in front of goal or the hands asked for the header.)
  const went = [false, false]
  for (const p of g.ps) if (p.act === 'head' && p.at < 0.5) went[p.team] = true
  for (const p of g.ps) {
    if (p.keeper || p.out || went[p.team] || p.cool > 0 || (p.act !== 'none' && p.act !== 'control')) continue
    if (b.meant === p.id && !wantsHeader(g, p)) continue
    for (const T of RISE_T) {
      const by = b.y + b.vy * T - 4.9 * T * T
      const dx = b.x + b.vx * T - (p.x + p.vx * T * 0.6)
      const dz = b.z + b.vz * T - (p.z + p.vz * T * 0.6)
      // (An attacker in front of goal meeting his own side's cross attacks it from a little further.)
      const att = b.lastTeam === p.team && nearGoal(g, p)
      const r = att ? 1.35 : 0.95
      if (dx * dx + dz * dz < r * r && Math.abs(by - (HEAD_Y + jumpY(T))) < (att ? 0.65 : 0.5)) {
        startAct(p, 'head', 0.6)
        went[p.team] = true
        break
      }
    }
  }
}

/** In front of the other side's goal (a header there goes at it), or the hands asked for a header lately. */
function nearGoal(g: Game, p: Player) {
  const goal = goalOf(g, p.team)
  return inBox(g, p.team === 0 ? 1 : 0, p.x, p.z) || (hyp(goal[0] - p.x, goal[1] - p.z) < (g.size === 11 ? 18 : 11) && Math.abs(p.z) < g.field.box[1])
}
const wantsHeader = (g: Game, p: Player) => nearGoal(g, p) || (!!p.nod && g.time - p.nod.t < 1.2)

/** Where a lofted ball comes down through head height (or lands): the place to attack it from. */
function headPoint(g: Game): V {
  const b = g.ball
  const y = 1.9
  const disc = b.vy * b.vy + 2 * 9.8 * (b.y - y)
  if (disc < 0) return landing(g)
  const t = (b.vy + Math.sqrt(disc)) / 9.8
  return [b.x + b.vx * t, b.z + b.vz * t]
}

/**
 * The football reaching a player (a pass, a loose ball): taken under control, the first touch seen.
 * Along the ground with the inside of the foot (the sole, standing or slow), dropping with the instep,
 * waist-high with the thigh, higher on the chest; then on along the stick (or the run). A ball hit
 * hard, a sprint, or a man right on him: the touch is heavy and it runs away from him. A press made
 * for it before it came (bufferPresses) plays it first time instead: no control.
 */
function receive(g: Game, p: Player) {
  const b = g.ball
  const from: [number, number, number] = [b.x - p.x, b.y, b.z - p.z]
  const v = hyp(b.vx, b.vz)
  const fall = b.vy
  const own = b.lastBy === p.id
  const first = p.human && g.time - Math.max(p.buf.pass, p.buf.shoot, p.buf.through, p.buf.lob, p.buf.skill) < 0.35
  give(g, p)
  if (g.sport !== 'foot' || p.keeper || p.act !== 'none' || first || own || (v < 2.5 && from[1] < 0.3) || g.set) return
  const sp = speedOf(p)
  const y = from[1]
  const kind: Ctrl['kind'] = y > 0.95 ? 'chest' : y > 0.5 ? 'thigh' : y > 0.24 || fall < -1.5 ? 'instep' : sp < 1.2 || v < 5 ? 'sole' : 'trap'
  // Where to: the stick (the hands: their run), else on the way he runs, else up the pitch.
  const w = hyp(p.want[0], p.want[1])
  const dir: V = w > 0.8 ? [p.want[0] / w, p.want[1] / w] : sp > 1 ? [p.vx / sp, p.vz / sp] : [dirOf(p.team), 0]
  const [, near] = nearest(foes(g, p), p.x, p.z)
  const risk = (v > 14 ? 0.22 : v > 10 ? 0.1 : 0) + (sp > 5.6 ? 0.18 : sp > 4.5 ? 0.06 : 0) + (near < 1.4 ? 0.15 : 0) + (y > 0.5 ? 0.05 : 0) - (p.human ? 0.04 : 0)
  p.ctrl = { kind, from, dir, heavy: g.rnd() < risk }
  startAct(p, 'control', kind === 'chest' ? 0.5 : kind === 'thigh' ? 0.42 : kind === 'instep' ? 0.36 : 0.3)
  // (The AI looks up once it's down.)
  if (!p.human) p.think = Math.max(p.think, p.len * 0.85)
}

/** The ball in a first touch: on to the body part (a tenth of a second), then cushioned down and taken on (controlBall's path). */
function controlBall(g: Game, h: Player, R: number) {
  const b = g.ball
  const c = h.ctrl!
  const u = clamp(h.at / h.len, 0, 1)
  const [fx, fz] = fwd(h)
  const [rx, rz] = right(h)
  // Where the body meets it: in front, the right foot's side; higher for the thigh and the chest.
  const [cf, cs, cy] = c.kind === 'chest' ? [0.22, 0, 1.3] : c.kind === 'thigh' ? [0.3, 0.1, 0.78] : c.kind === 'instep' ? [0.42, 0.12, 0.34] : c.kind === 'sole' ? [0.3, 0.1, R + 0.02] : [0.3, 0.14, R]
  const px = h.x + fx * cf + rx * cs
  const pz = h.z + fz * cf + rz * cs
  const push = c.heavy ? 0.9 : c.kind === 'sole' ? 0.28 : 0.45
  const tx = h.x + c.dir[0] * push
  const tz = h.z + c.dir[1] * push
  const meet = 0.28
  if (u < meet) {
    const k = ease01(u / meet)
    b.x = h.x + c.from[0] + (px - h.x - c.from[0]) * k
    b.z = h.z + c.from[2] + (pz - h.z - c.from[2]) * k
    b.y = c.from[1] + (cy - c.from[1]) * k
  } else {
    const k = (u - meet) / (1 - meet)
    const e = ease01(k)
    b.x = px + (tx - px) * e
    b.z = pz + (tz - pz) * e
    // Dropping from the chest or the thigh: falling dead, a little bounce at the feet.
    b.y = cy <= R + 0.05 ? R : k < 0.75 ? cy + (R - cy) * (k / 0.75) ** 2 : R + Math.sin(((k - 0.75) / 0.25) * Math.PI) * cy * 0.12
  }
  b.rel = [b.x - h.x, b.z - h.z]
}

/** The first touch over: a heavy one leaves the ball running on, his to chase. */
function endControl(g: Game, p: Player) {
  const c = p.ctrl
  p.ctrl = null
  const b = g.ball
  if (!c?.heavy || b.owner !== p.id) return
  const v = 3 + g.rnd() * 2.2
  b.owner = -1
  b.rel = undefined
  b.vx = c.dir[0] * v + p.vx * 0.5
  b.vz = c.dir[1] * v + p.vz * 0.5
  b.vy = 0.6
  b.lastBy = p.id
  b.lastTeam = p.team
  b.meant = p.id
  b.tried = []
  p.cool = 0.3
}

/** Crochet: a crossover/** Crochet: a crossover (basketball) or a sharp cut (football): a burst one way, and the man in front left behind, or on the floor. */
export function skill(g: Game, p: Player, aim: V | null) {
  if (g.ball.owner !== p.id || locked(p) || p.act === 'cross' || p.picked || (g.sport === 'basket' && g.ft)) return
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
        say(g, p.human ? tr('Cheville cassée !!') : tr('Oh ! Cheville cassée !'))
        moment(g, 'ankle', p)
        if (p.id === g.me) g.stats.ankles++
      } else if (p.human) say(g, foot ? tr('Crochet ! Il est passé !') : tr('Crossover !'))
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
  passement: { len: 0.62, at: 0.4, chance: 0.8, style: 0.2, name: tr('Passement de jambes !') },
  roulette: { len: 0.74, at: 0.6, chance: 0.76, style: 0.26, name: tr('La roulette !') },
  petitpont: { len: 0.85, at: 0.14, chance: 0.62, style: 0.34, name: tr('PETIT PONT !') },
  sombrero: { len: 1.05, at: 0.3, chance: 0.64, style: 0.34, name: tr('Sombrero !') },
  crochet: { len: 0.58, at: 0.32, chance: 0.78, style: 0.18, name: tr('Feinte de frappe !') },
  aile: { len: 0.45, at: 0.14, chance: 0.82, style: 0.22, name: tr('Aile de pigeon !') },
  talonnade: { len: 0.45, at: 0.14, chance: 0.82, style: 0.2, name: tr('Talonnade !') },
  jongle: { len: 60, at: 0, chance: 0, style: 0, name: tr('Les jongles !') },
  // Le basket de rue's.
  crossover: { len: 0.5, at: 0.24, chance: 0.78, style: 0.2, name: tr('Crossover !') },
  entrejambe: { len: 0.56, at: 0.28, chance: 0.74, style: 0.24, name: tr('Entre les jambes !') },
  dos: { len: 0.6, at: 0.3, chance: 0.72, style: 0.26, name: tr('Dans le dos !') },
  spin: { len: 0.72, at: 0.42, chance: 0.74, style: 0.3, name: tr('Spin move !') },
  hesitation: { len: 0.7, at: 0.42, chance: 0.76, style: 0.22, name: tr('Hésitation !') },
  show: { len: 60, at: 0, chance: 0, style: 0, name: tr('Le show !') },
  pompe: { len: 0.62, at: 0.32, chance: 0.75, style: 0.2, name: tr('Feinte de tir !') },
  stepback: { len: 0.55, at: 0.2, chance: 0.8, style: 0.24, name: tr('Step-back !') },
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
const LOST = [tr('Il a lu ton geste !'), tr('Trop tard, il était sur toi !'), tr('Ballon perdu… trop de gestes !')]

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
  // Basketball: the dribble picked up, only the pump fake again (the rest would be a double dribble).
  if (g.sport === 'basket' && (p.picked || g.ft) && kind !== 'pompe') return
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
  const name = down ? tr('Chevilles cassées !') : m.name
  say(g, p.human ? (down ? tr('{0} : chevilles cassées !!', { 0: m.name.replace(' !', '') }) : name) : q.id === g.me ? tr('{0} de {name}…', { 0: name.replace(' !', ''), name: p.name }) : tr('{0} de {name} !', { 0: name.replace(' !', ''), name: p.name }))
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
  else if (q.human) say(g, tr('Bien lu ! Ballon récupéré !'))
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
    if (p.human) say(g, g.sport === 'basket' ? tr('Hooo ! Le show !') : tr('Hooo ! Les jongles !'))
  }
  for (const q of foes(g, p)) {
    if (q.keeper || q.cool > 0 || q.act === 'beaten' || dist(q, p) > 1.1 || g.rnd() > dt * 1.6) continue
    give(g, q)
    startAct(p, 'beaten', 0.5)
    p.cool = 0.6
    say(g, g.sport === 'basket' ? (p.human ? tr('Il t’a piqué la balle en plein show !') : tr('Interception !')) : p.human ? tr('Il t’a pris le ballon en pleine jongle !') : tr('Ballon récupéré !'))
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
  say(g, p.human ? tr('GBÊÊÊ !!!') : tr('Le Gbê de {name} !', { name: p.name }))
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
      // He goes up for the block; under him and past (if he hasn't dribbled yet: after a dribble the fake picks it up, and it's shoot or pass).
      if (p.dribbled) {
        p.picked = true
        p.vx = p.vz = 0
      } else burst(0.55, 0.7, 6)
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
  // The keeper has it in his hands: nobody goes in on him.
  if (h && h.team !== p.team && inHands(g, h)) return
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
  if (!foot) {
    // Basketball: a ball held in both hands (the dribble picked up, a shot or a layup going up, a pass,
    // a free throw) can't be slapped away: both on it, a held ball; a swipe at a shooter, a foul.
    const gathered = h.picked || h.act === 'shoot' || h.act === 'layup' || h.act === 'pass' || !!g.ft || g.inb !== null || (h.act === 'geste' && h.move === 'pompe')
    if (gathered) {
      p.cool = 0.5
      if ((h.act === 'shoot' || h.act === 'layup') && dist(h, p) < 1 && g.rnd() < 0.3) shootingFoul(g, p, h)
      else if (h.picked && h.act === 'none' && dist(h, p) < 1.1 && g.rnd() < 0.3) heldBall(g, h, p)
      return
    }
    // Nobody's body in the way: no reaching through a man to the ball.
    const b = g.ball
    if (laneGap(g.ps.filter((q) => q !== p && q !== h && !q.out), [p.x, p.z], [b.x, b.z]) < 0.3) {
      p.cool = 0.4
      return
    }
  }
  // From behind, it's hard; against someone mid-move, easier.
  const [fx, fz] = fwd(h)
  const behind = ((p.x - h.x) * fx + (p.z - h.z) * fz) / (dist(p, h) || 1) < -0.3
  // The console: one sprinting with the ball has it further from his feet.
  const loose = foot && fifa(g) && speedOf(h) > 5.8 ? 0.12 : 0
  // Football: the foot has to reach the ball, not the man; from behind the body is in the way (a clean one is rare, the rest goes through the man).
  const reach = !foot || hyp(b.x - p.x, b.z - p.z) < 1.2
  const chance = !reach ? 0 : (foot ? 0.5 : 0.36) + (h.act === 'cross' || h.act === 'juggle' ? 0.12 : 0) + (h.act === 'geste' ? 0.08 : 0) - (behind ? (foot ? 0.38 : 0.25) : 0) + (p.human ? 0.08 : 0) + loose
  if (g.rnd() < chance) {
    give(g, p)
    startAct(h, 'beaten', 0.6)
    h.cool = 0.7
    say(g, foot ? (p.human ? tr('Ballon récupéré !') : tr('Bien taclé !')) : tr('Interception !'))
    moment(g, foot ? 'tackle' : 'steal', p)
    if (p.id === g.me) g.stats.steals++
  } else {
    p.cool = 0.55
    // Missed, from behind, into the man: the referee gives it more often than not; a lunge that misses the ball, now and then.
    if (foot && g.referee && (behind ? g.rnd() < 0.45 : !reach && g.rnd() < 0.12)) foul(g, p, h, false)
    // The street, no referee: through the man from behind, he keeps it and the wall boos.
    else if (foot && g.street && behind) say(g, tr('Par derrière ? Laisse ça !'))
    // Basketball: a reach from behind, or a hand on the dribbler's arm: the whistle.
    if (!foot && g.phase === 'play' && g.rnd() < (behind ? 0.32 : 0.07)) personalFoul(g, p, h)
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
  let text = reckless ? tr('Faute de {name} !', { name: by.name }) : tr('Faute !')
  if (reckless && g.rnd() < 0.25) {
    by.cards++
    moment(g, 'card', by)
    text = by.cards >= 2 ? tr('Deuxième jaune : {name} est expulsé !', { name: by.name }) : tr('Carton jaune pour {name} !', { name: by.name })
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
  say(g, kind === 'throw' ? tr('Touche.') : kind === 'corner' ? tr('Corner !') : tr('Six mètres.'))
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
  // A goal kick is taken off the ground, not from the hands.
  if (taker.act === 'hold') taker.act = 'none'
  b.x = at[0]
  b.z = at[1]
  g.set = { kind, team, taker: taker.id, at, t: g.time }
  g.penStick = null
  g.ref.whistle = g.time
  if (kind === 'pen') say(g, tr('Penalty !'))
  else if (kind === 'free') say(g, tr('Coup franc.'))
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
  say(g, tr('Tirs au but !'))
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
  say(g, team === myTeam(g) && g.switching ? tr('À toi de tirer !') : tr("{name} s'avance…", { name: taker.name }))
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
  if (w !== null) say(g, w === myTeam(g) ? tr('Gagné aux tirs au but !') : tr('Perdu aux tirs au but…'))
  else say(g, scored ? (mine ? tr('Réussi !') : tr('Il marque.')) : mine ? tr('Manqué…') : tr('Raté ! Il ne marque pas !'))
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
  // Basketball: a shot up, the ones round the ring box out (the defenders between their man and the ring, the attackers crash it); the free throws, each holds his place.
  else if (!foot && b.flight?.kind === 'shot' && !g.ft) return boxOut(g, p, b.flight)
  else if (!foot && g.inb && g.inb.by === p.id) {
    p.want = [0, 0]
    return
  }
  // A loose ball: the nearest of each team go for it (where it will land).
  else if (!h && !b.dead) {
    // (A lofted football: where it comes down through head height, two of each side going for it.)
    const air = foot && b.lofted
    const [lx, lz] = air ? headPoint(g) : landing(g)
    const order = g.ps.filter((q) => q.team === p.team && !q.keeper && !q.human).sort((a, c) => hyp(a.x - lx, a.z - lz) - hyp(c.x - lx, c.z - lz))
    if (b.meant === p.id || order.indexOf(p) < (foot && !air ? 1 : 2)) {
      runTo(p, lx, lz, 6.2)
      // Up for the rebound when it comes down within reach.
      if (!foot && b.y > 2 && b.y < 3.6 && b.vy < 0 && hyp(b.x - p.x, b.z - p.z) < 1.1 && p.cool <= 0 && p.act === 'none') startAct(p, 'block', 0.75)
      return
    }
  }
  if (foot && b.meant === p.id && !h) return runTo(p, ...(b.lofted ? headPoint(g) : landing(g)), 6.5)
  const attacking = h ? h.team === p.team : g.poss === p.team
  // The other side's keeper has it in his hands: back out of his box and away from him, nobody presses.
  if (inHands(g, h) && h.team !== p.team) return standOff(g, p, h)
  if (h === p) return foot ? footCarry(g, p) : basketCarry(g, p)
  if (attacking) return foot ? (g.size === 11 ? elevenSupport(g, p) : footSupport(g, p)) : basketSupport(g, p)
  return foot ? (g.size === 11 ? elevenDefend(g, p) : footDefend(g, p)) : basketDefend(g, p)
}

/** Facing a keeper holding the ball: out of his box (the edge, on the same line), else back towards the shape. */
function standOff(g: Game, p: Player, k: Player) {
  const F = g.field
  const kd = dirOf(k.team)
  const gx = k.team === 0 ? -F.x : F.x
  const edge = gx + kd * (F.box[0] + 1.2)
  const zz = clamp(p.z, -F.z + 1, F.z - 1)
  if (inBox(g, k.team, p.x, p.z) || dist(p, k) < 5) return runTo(p, (edge - p.x) * kd > 0 ? edge : p.x + kd * 1.5, zz, 5)
  // Already out: drift back to where he'd defend from, never towards the keeper.
  g.size === 11 ? elevenDefend(g, p) : footDefend(g, p)
  const [nx, nz] = [p.x + p.want[0] * 0.4, p.z + p.want[1] * 0.4]
  if (inBox(g, k.team, nx, nz) || hyp(nx - k.x, nz - k.z) < 5) p.want = [0, 0]
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

/**
 * The full court's spots in a ring's frame (out from the baseline, across): five out (the top, the
 * wings, the corners past the three-point line), the dunker spot by the ring and the elbow. The point
 * guard at the top, the wings on the wings, the forward in the corner, the centre by the ring.
 */
const PRO_SPOTS: V[] = [
  [8.4, 0],
  [6.2, -5.6],
  [6.2, 5.6],
  [0.5, -7.0],
  [0.5, 7.0],
  [0.9, 3.1],
  [4.6, -2.7],
]
const PRO_HOME = [0, 1, 2, 3, 5]

/** Where an attacker's spot is on the ground (the half-court's SPOTS as they were; the full court's in the frame of the ring his side attacks). */
function spotAt(g: Game, p: Player, i = p.spot): V {
  if (!g.full) return SPOTS[i % SPOTS.length]
  const [u, v] = PRO_SPOTS[i % PRO_SPOTS.length]
  return ringFrame(g, p.team, u, v)
}

/** The full court: still in his own half with it (behind half-way from the ring his side attacks). */
const backcourt = (g: Game, p: Player) => g.full && p.x * Math.sign(ringOf(g, p.team)[0]) < 0

/**
 * The one with the ball (the AI): brings it up the floor (the full court), takes it out past the arc
 * when it was won under the basket (the half-court), drives the open lane or comes off a screen, and
 * picks his shot: the dunk or the layup on the move, the open jumper, the three when he's alone, any
 * shot with the shot clock running out; the ball to the player asking for it, to the team-mate cutting
 * to the ring (the give-and-go), to whoever is left open; on the street, a move on his man.
 */
function basketCarry(g: Game, p: Player) {
  const H = ringOf(g, p.team)
  const d = fromRing(g, p)
  const enemies = foes(g, p)
  const [def, dd] = nearest(enemies, p.x, p.z)
  const inFront = def ? (def.x - p.x) * (H[0] - p.x) + (def.z - p.z) * (H[1] - p.z) > 0 : false
  // The dribble picked up: he can't move with it any more; shoot it or give it.
  if (p.picked) {
    p.want = [0, 0]
    if (p.think > 0) return
    p.think = 0.2
    return dd > 1.3 && d < 8 ? shoot(g, p, null) : pass(g, p, null)
  }
  // Won back under the basket: out past the arc first.
  if (!g.cleared) {
    const k = (ARC + 1.2) / (d || 1)
    runTo(p, H[0] + (p.x - H[0]) * k, clamp(H[1] + (p.z - H[1]) * k, -3, COURT.z1 - 0.5), 4.8)
    return
  }
  // Up the floor: to the top of his side's half, quicker in transition with nobody back.
  if (backcourt(g, p)) {
    const [tx, tz] = [ringFrame(g, p.team, 9, 0)[0], p.z * 0.4]
    const back = enemies.filter((q) => toRing(g, p.team, q.x, q.z) < toRing(g, p.team, p.x, p.z)).length
    runTo(p, tx, tz, back < 2 ? 6.4 : 5)
  } else {
    const lane = laneGap(enemies, [p.x, p.z], H)
    // A team-mate screening his man: round the screen to the ring.
    const screen = mates(g, p).find((q) => q.screen > 0 && dist(q, p) < 2.2)
    // Driving: straight at the ring when the lane is open.
    if (lane > 1.3 || d < 3.2 || (screen && def && dist(def, screen) < 1.2)) runTo(p, H[0] + ((p.x - H[0]) / (d || 1)) * 0.5, H[1] + ((p.z - H[1]) / (d || 1)) * 0.5, 5.6)
    else {
      const s = spotAt(g, p)
      const [sx, sz] = [s[0] + (H[0] - s[0]) * 0.1, s[1] + (H[1] - s[1]) * 0.1]
      runTo(p, sx, sz, 3.2)
    }
  }
  if (p.think > 0) return
  p.think = 0.3 + g.rnd() * 0.15
  const human = callerFor(g, p)
  const forced = g.clock >= 0 ? g.clock < 3.2 : g.possT > 7
  // The player asked for it: to them, if it can get there.
  if (human.team === p.team && human.call > 0 && laneGap(enemies, [p.x, p.z], [human.x, human.z]) > 0.6 && g.rnd() < 0.85) return pass(g, p, [human.x - p.x, human.z - p.z])
  if (backcourt(g, p)) {
    // A team-mate already ahead and alone: the outlet pass up the floor.
    const ahead = mates(g, p).find((q) => !backcourt(g, q) && openness(g, q) > 3 && laneGap(enemies, [p.x, p.z], [q.x, q.z]) > 1)
    if (ahead && g.rnd() < 0.35) return pass(g, p, [ahead.x - p.x, ahead.z - p.z])
    return
  }
  if (d < 3.2 && (speedOf(p) > 2.2 || d < 2.4)) return shoot(g, p, null)
  // The give-and-go: the one who just passed to him cutting to the ring, open: back to him.
  const cutter = mates(g, p).find((q) => (q.cut > 0 || (q.human && g.lastPass?.by === q.id && g.time - g.lastPass.t < 2.5)) && toRing(g, q.team, q.x, q.z) < 3.6 && openness(g, q) > 1.3 && laneGap(enemies, [p.x, p.z], [q.x, q.z]) > 0.7)
  if (cutter && g.rnd() < 0.8) return pass(g, p, [cutter.x - p.x, cutter.z - p.z])
  // His shot: open (or the clock running out); the three only with room.
  const three = beyond(g, p.team, p.x, p.z)
  const range = g.full ? 8.2 : 7.6
  if (forced || (d < range && ((dd > (three ? 2.4 : 1.8) && g.rnd() < (three ? 0.38 : 0.45)) || (!three && dd > 1.1 && g.rnd() < 0.14)))) return shoot(g, p, null)
  // (Le basket de rue: a move on the man in front, from a little further; now and then the show, nobody near.)
  if (def && inFront && dd < (g.street ? 2 : 1.6) && g.rnd() < (g.full ? 0.25 : 0.45)) return g.street ? geste(g, p, AI_HOOP[Math.floor(g.rnd() * AI_HOOP.length)], null) : skill(g, p, null)
  if (g.street && dd > 4 && g.possT > 2 && g.rnd() < 0.04) return geste(g, p, 'show', null)
  // Somebody left alone (his man gone to help): find him.
  const open = mates(g, p).filter((q) => openness(g, q) > 2.6 && laneGap(enemies, [p.x, p.z], [q.x, q.z]) > 0.8)
  if (open.length && g.rnd() < 0.5) return pass(g, p, null)
  if (g.rnd() < (human.team === p.team && openness(g, human) > 2 ? 0.4 : 0.22)) return pass(g, p, null)
}

/**
 * The attackers without the ball: to a spot, away from the others (five out on the full court, the
 * centre by the ring); a cut to the ring after a pass (the give-and-go) or behind a man watching the
 * ball (the backdoor); the full court's forward and centre come up to set a screen on the ball's man,
 * then roll to the ring.
 */
function basketSupport(g: Game, p: Player) {
  const h = holder(g)
  const H = ringOf(g, p.team)
  // Rolling (or cutting) to the ring.
  if (p.cut > 0) {
    const side = (g.full ? p.z - H[1] : p.x - H[0]) >= 0 ? 1 : -1
    const [x, z] = g.full ? [ringFrame(g, p.team, 1.4, 0)[0], H[1] + side * 1.2] : [H[0] + side * 1.2, H[1] + 1.4]
    return runTo(p, x, z, 6.2)
  }
  // The screen: beside the ball's man, on the side away from the ring; held still there, then the roll.
  if (p.screen > 0 && h && h.team === p.team) {
    const hd = nearest(foes(g, h), h.x, h.z)[0]
    if (hd) {
      const [dx, dz] = [hd.x - h.x, hd.z - h.z]
      const l = hyp(dx, dz) || 1
      const [x, z] = [hd.x + (-dz / l) * 0.55 * p.side, hd.z + (dx / l) * 0.55 * p.side]
      runTo(p, x, z, 5.6)
      if (hyp(x - p.x, z - p.z) < 0.4) p.want = [0, 0]
      if (p.screen < 0.12) p.cut = 1.6
      return
    }
  }
  if (p.think <= 0) {
    p.think = 1.2 + g.rnd() * 1.5
    const taken = mates(g, p).map((q) => q.spot)
    const list = g.full ? PRO_SPOTS : SPOTS
    const free = list.map((_, i) => i).filter((i) => !taken.includes(i))
    // The full court keeps its shape: each back to his own spot most of the time.
    const home = PRO_HOME[p.role] ?? p.role
    p.spot = g.full && !taken.includes(home) && g.rnd() < 0.7 ? home : (free[Math.floor(g.rnd() * free.length)] ?? p.spot)
    // The big men set a screen for the ball in the half-court (the pick-and-roll); anyone cuts behind a man watching the ball.
    const mine = g.ps.find((q) => q.team !== p.team && dist(q, p) < 4 && nearest(foes(g, p), p.x, p.z)[0] === q)
    if (g.full && h && h.team === p.team && p.role >= 3 && !backcourt(g, h) && fromRing(g, h) > 6 && g.rnd() < 0.35) {
      p.screen = 2.2
      p.side = g.rnd() < 0.5 ? -1 : 1
    } else if (h && h.team === p.team && fromRing(g, p) < 8 && (!mine || hyp(mine.x - p.x, mine.z - p.z) > 2.2) && g.rnd() < 0.2) p.cut = 1.5
  }
  const s = spotAt(g, p)
  runTo(p, s[0], s[1], g.full && h && backcourt(g, h) ? 6 : 4.2)
}

/**
 * The defenders: each on his man (the same place in the other team), between him and the ring, closer
 * on the one with the ball, sagging off towards the ball away from it; a man beaten off the dribble,
 * the nearest other one steps across into the lane to help.
 */
function basketDefend(g: Game, p: Player) {
  const man = g.street ? manOf(g, p) : (g.ps.find((q) => q.team !== p.team && q.role === p.role && !q.out) ?? manOf(g, p))
  const H = ringOf(g, man.team)
  const b = g.ball
  const h = holder(g)
  const onBall = b.owner === man.id
  const d = toRing(g, man.team, man.x, man.z) || 1
  // Help: the one with the ball by the ring, his own man behind him: the nearest of the others goes across.
  if (h && h.team !== p.team && h !== man && toRing(g, h.team, h.x, h.z) < 4.6) {
    const hisMan = g.ps.find((q) => q.team === p.team && !q.out && (g.street ? manOf(g, q) : (g.ps.find((r) => r.team !== q.team && r.role === q.role) ?? manOf(g, q))) === h)
    const beat = !hisMan || toRing(g, h.team, hisMan.x, hisMan.z) > toRing(g, h.team, h.x, h.z) + 0.3
    const helper = nearest(g.ps.filter((q) => q.team === p.team && !q.out && q !== hisMan && !q.human), h.x, h.z)[0]
    if (beat && helper === p) {
      const dh = toRing(g, h.team, h.x, h.z) || 1
      return runTo(p, h.x + ((H[0] - h.x) / dh) * 1.1, h.z + ((H[1] - h.z) / dh) * 1.1, 5.8)
    }
  }
  // Away from the ball: off his man towards the ring and a little towards the ball (to help).
  const off = onBall ? 0.95 : Math.min(2.4, 1.2 + d * 0.12)
  let [x, z] = [man.x + ((H[0] - man.x) / d) * off, man.z + ((H[1] - man.z) / d) * off]
  if (!onBall) {
    x += (b.x - x) * 0.18
    z += (b.z - z) * 0.18
  }
  // Back in transition: the full court's man running up, the defender sprints back.
  const far = hyp(x - p.x, z - p.z) > 5
  runTo(p, x, z, onBall ? 4.6 : far ? 6.2 : 4.4)
  if (p.think > 0) return
  p.think = 0.45 + g.rnd() * 0.3
  if (onBall && dist(p, man) < 1.35 && g.rnd() < 0.09 && p.cool <= 0) defend(g, p)
}

/**
 * A shot up: the defenders turn and put their body on their man between him and the ring (boxing out),
 * the attackers go to the ring for the offensive rebound; the full court's guards get back.
 */
function boxOut(g: Game, p: Player, f: Flight) {
  const ring = (f.ring ?? 0) as 0 | 1
  const H = g.hoops[ring]
  const attacking = p.team === f.team
  if (attacking) {
    if (p.id === f.by) return runTo(p, p.x, p.z, 0)
    if (g.full && p.role <= 1) {
      const [x, z] = [ringFrame(g, p.team, 12, 0)[0], p.z * 0.5]
      return runTo(p, x, z, 5.5)
    }
    const dr = toRing(g, p.team, p.x, p.z) || 1
    const k = Math.max(0, dr - 1.9) / dr
    return runTo(p, p.x + (H[0] - p.x) * k, p.z + (H[1] - p.z) * k, 5.5)
  }
  const man = g.street ? manOf(g, p) : (g.ps.find((q) => q.team !== p.team && q.role === p.role && !q.out) ?? manOf(g, p))
  const dm = hyp(man.x - H[0], man.z - H[1]) || 1
  const k = Math.min(dm, Math.max(1.6, dm - 0.75)) / dm
  runTo(p, H[0] + (man.x - H[0]) * k, H[1] + (man.z - H[1]) * k, 5.5)
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
  // The keeper off his line: lift it over him.
  const keeper = g.ps.find((q) => q.keeper && q.team !== p.team && !q.out)
  if (fifa(g) && keeper && Math.abs(keeper.x - goal[0]) > 3.2 && chipRange(g, p) && g.rnd() < 0.5) return chip(g, p, null)
  if (gd < (big ? 24 : 15) && Math.abs(p.z) < (big ? 14 : 8) && ((dd > 1.6 || !inFront) ? g.rnd() < (big ? 0.4 : 0.55) : g.rnd() < 0.2)) return shoot(g, p, null)
  // Out wide near the byline: a cross into the box (the console's five too, with someone in it).
  const inside = mates(g, p).some((q) => !q.keeper && nearGoal(g, q))
  if (big && Math.abs(p.z) > F.z * 0.4 && (goal[0] - p.x) * dir < 18 && g.rnd() < 0.6) return pass(g, p, null, 'lob')
  if (big && Math.abs(p.z) > F.z * 0.35 && (goal[0] - p.x) * dir < 32 && inside && g.rnd() < 0.3) return pass(g, p, null, 'lob')
  if (!big && fifa(g) && Math.abs(p.z) > F.z * 0.3 && (goal[0] - p.x) * dir < 14 && inside && g.rnd() < 0.65) return pass(g, p, null, 'lob')
  // The street: a move on the man in front, timed (the AI too likes to show off), now and then the keepy-ups with nobody near.
  if (g.street && def && inFront && dd > 1 && dd < 2.3 && g.rnd() < 0.42) return geste(g, p, AI_MOVES[Math.floor(g.rnd() * AI_MOVES.length)], null)
  if (g.street && dd > 5.5 && g.possT > 2 && g.rnd() < 0.05) return geste(g, p, 'jongle', null)
  if (def && inFront && dd < 1.9) return g.rnd() < 0.45 && !g.street ? skill(g, p, null) : pass(g, p, null)
  // A team-mate making a run in behind, free: the ball into his run.
  const runner = mates(g, p).find((q) => q.cut > 0.3 && (q.x - p.x) * dir > 2 && openness(g, q) > 1.6)
  if (runner && g.rnd() < (big ? 0.5 : 0.4)) return pass(g, p, [runner.x - p.x, runner.z - p.z], 'through')
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
  // (Never on top of his own keeper: the one at the back stays out of the box when the ball is in it.)
  const x = clamp(b.x + sx * dir, -F.x + 2, F.x - 2.5)
  const lo = -dir * (F.x - F.box[0] - 1)
  const xx = dir > 0 ? Math.max(x, lo) : Math.min(x, lo)
  const z = clamp(sz + b.z * 0.25 + Math.sin(g.time * 0.6 + p.id) * 1.2, -F.z + 1.2, F.z - 1.2)
  // The ball out wide near their goal (the console): the one up front attacks the near post, the other wide one the far post, for the cross.
  const h = holder(g)
  if (h && fifa(g) && !g.street && h !== p && h.team === p.team && Math.abs(h.z) > F.z * 0.3 && (goalOf(g, p.team)[0] - h.x) * dir < 14 && (p.role === 4 || (p.role >= 2 && Math.sign(h.z) !== Math.sign(SHAPE[p.role][1])))) {
    const gx = goalOf(g, p.team)[0]
    const far = p.role !== 4
    return runTo(p, gx - dir * (far ? 4.5 : 3.5), -Math.sign(h.z) * (far ? 2.2 : -0.6), 5.8)
  }
  // The wide ones and the one up front make runs in behind now and then; everyone keeps his distance from the others.
  if (supportRun(g, p, p.role >= 2)) return
  const [sx2, sz2] = spaced(g, p, xx, z, 3.6)
  runTo(p, sx2, sz2, p.role === 4 ? 5.6 : 5)
}

/**
 * Football's runs off the ball: a forward (or a winger) breaks in behind into the space beyond the ball
 * (a couple of seconds flat out, along his channel, not past the last man), so the one on the ball has a
 * pass into his run (footCarry, and the hands' through ball); the nearest team-mate behind the ball offers
 * himself. True while a run is on (the target in p.to, its time in p.cut).
 */
function supportRun(g: Game, p: Player, forward: boolean) {
  const h = holder(g)
  if (!h || h.team !== p.team || h === p) return false
  const F = g.field
  const big = g.size === 11
  const dir = dirOf(p.team)
  if (p.cut > 0) {
    runTo(p, p.to[0], p.to[1], big ? 7 : 6.2)
    return true
  }
  if (p.think > 0) return false
  p.think = 0.5 + g.rnd() * 0.5
  // Only from in front of the ball's half-way, not deep in his own half, and not two running at once.
  if (!forward || (h.x - -dir * F.x) * dir < F.x * 0.6 || mates(g, p).some((q) => q.cut > 0) || g.rnd() > (big ? 0.3 : 0.24)) return false
  // Not past the last man (bar the keeper): level with him, so the ball can find him in behind.
  const last = foes(g, p)
    .filter((q) => !q.keeper)
    .reduce((m, q) => Math.max(m, q.x * dir), -F.x)
  const x = clamp(Math.min(h.x * dir + (big ? 18 : 8), last + 0.5), -F.x + 2, F.x - (big ? 6 : 2.5)) * dir
  const z = clamp(p.z * 0.75 + (g.rnd() - 0.5) * (big ? 10 : 4), -F.z + 1.5, F.z - 1.5)
  if ((x - p.x) * dir < 2.5) return false
  p.to = [x, z]
  p.cut = big ? 2.4 : 1.7
  runTo(p, x, z, big ? 7 : 6.2)
  return true
}

/** A place to stand nudged away from team-mates closer than `r` (a team in a bunch is no team to pass to). */
function spaced(g: Game, p: Player, x: number, z: number, r: number): V {
  let nx = x
  let nz = z
  for (const q of g.ps) {
    if (q === p || q.team !== p.team || q.keeper || q.out) continue
    const dx = x - q.x
    const dz = z - q.z
    const d2 = dx * dx + dz * dz
    if (d2 < r * r && d2 > 1e-4) {
      const d = Math.sqrt(d2)
      nx += (dx / d) * (r - d) * 0.7
      nz += (dz / d) * (r - d) * 0.7
    }
  }
  // (One place, reused: it runs for every player every step.)
  SPACED[0] = clamp(nx, -g.field.x + 1, g.field.x - 1)
  SPACED[1] = clamp(nz, -g.field.z + 1, g.field.z - 1)
  return SPACED
}
const SPACED: V = [0, 0]

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
  const wide = bf > 0.55 && Math.abs(b.z) > F.z * 0.35
  const far = wide && (p.role === 8 || p.role === 10) && Math.sign(hz) !== Math.sign(b.z)
  const box = (p.role === 9 && wide) || far
  const x = (box ? F.x - (far ? 7 : 8) : fx * F.x) * dir
  const z = far ? -Math.sign(b.z) * 5.5 : box ? -Math.sign(b.z) * 2 : clamp(hz * F.z * 0.95 + b.z * 0.25 + Math.sin(g.time * 0.5 + p.id) * 1.5, -F.z + 1.5, F.z - 1.5)
  // The front three and the midfield's wide ones run in behind now and then; nobody bunched.
  if (!box && supportRun(g, p, front || p.role === 6 || p.role === 7)) return
  const [sx, sz] = box ? [x, z] : spaced(g, p, x, z, 7)
  runTo(p, sx, sz, front ? 6 : 5.2)
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
    // (Not through the man from behind: alongside first.)
    const [hx, hz] = h ? fwd(h) : [0, 0]
    if (h && ((p.x - h.x) * hx + (p.z - h.z) * hz) / (dist(p, h) || 1) < -0.3) return
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
  // A good defender doesn't go through the man from behind: he keeps running alongside until he's goal side.
  const [hx, hz] = fwd(h)
  if (((p.x - h.x) * hx + (p.z - h.z) * hz) / (d || 1) < -0.3) return
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
    // In his hands: a look up, then a throw or a punt, well inside the six seconds.
    if (p.act === 'hold') {
      if (p.at > (g.street ? 0.7 : 1.4)) keeperRelease(g, p, null, null)
      return
    }
    // At his feet (a pass back, a goal kick taken short): played on quickly.
    if (p.act === 'none' && p.think <= 0) {
      p.think = 0.3
      pass(g, p, null)
    }
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
 * Basketball's referee, every step of play: the ball put in (the AI's after a moment, the one on the
 * hands' after a while if they don't), the free throw taken (the AI's when the referee gives it), the
 * match's clock stopped while the ball is dead (a free throw, a check, the tip), and the full court's
 * shot clock: running while a side has the ball, not while a shot is up or a ball off the iron is
 * still nobody's; at zero, the ball to the others.
 */
function hoopRules(g: Game, dt: number, input: Input) {
  const b = g.ball
  if (g.ft || g.tip >= 0 || g.inb?.check) g.length += dt
  const inb = g.inb
  if (inb && !b.flight) {
    const by = g.ps[inb.by]
    const wait = g.time - inb.t
    if (inb.check ? wait > 0.55 : wait > (by.human ? 4.5 : 1.1)) putIn(g, null)
  }
  const ft = g.ft
  if (ft && b.owner === ft.by && g.time >= ft.t) {
    const s = g.ps[ft.by]
    if (s.act === 'none' && s.meter < 0 && (!s.human || g.time > ft.t + 8)) shoot(g, s, null)
  }
  if (g.clock < 0 || g.inb || g.ft || g.tip >= 0) return
  const up = b.flight?.kind === 'shot' || (b.owner < 0 && !!g.lastShot?.iron)
  if (up || b.dead) return
  g.clock = Math.max(0, g.clock - dt)
  if (g.clock > 0) return
  const other: 0 | 1 = g.poss === 0 ? 1 : 0
  const h = holder(g)
  say(g, tr('24 secondes ! La balle change de camp.'))
  moment(g, 'clock', h ?? g.ps[Math.max(0, b.lastBy)])
  if (h) h.pending = null
  b.owner = -1
  b.flight = null
  b.dead = true
  g.ref.whistle = g.time
  g.phase = 'dead'
  g.wait = 1
  g.then = () => throwIn(g, other, sideline(b.x, b.z))
  g.clock = SHOT_CLOCK
  void input
}

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
        say(g, g.sport === 'basket' ? tr('Panier en or : le prochain panier gagne !') : tr('But en or : le premier qui marque gagne !'))
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
    say(g, tr('Fin du match !'))
  }
  // The final whistle: the winners jump about.
  const won = g.phase === 'over' ? leader(g) : null
  if (won !== null) for (const p of g.ps) if (p.team === won && p.act === 'none' && !p.keeper) startAct(p, 'cheer', 60)
  const playing = g.phase === 'play'
  g.possT += dt
  // Taken back out past the arc: the team can score again.
  const h = holder(g)
  if (g.sport === 'basket' && !g.cleared && h && h.team === g.poss && beyond(g, h.team, h.x, h.z)) {
    g.cleared = true
    g.possT = 0
  }
  if (g.sport === 'basket' && playing) hoopRules(g, dt, input)
  // Play held still (a check, the free throws, the tip): only the free-throw shooter's and the one putting the ball in's hands count.
  const held = g.sport === 'basket' && g.hold > g.time
  // A penalty against the local team: its stick says where the keeper dives.
  if (g.set?.kind === 'pen' && g.set.team !== myTeam(g) && Math.abs(input.mz) > 0.4) g.penStick = input.mz > 0 ? 1 : -1
  // The players' hands: the local one's, and the others' at a court match.
  for (const p of g.ps) if (p.human && !p.out) hands(g, p, p.id === g.me ? input : (others?.get(p.id) ?? NO_INPUT), playing, dt)
  if (playing && g.switching) autoSwitch(g, input, dt)
  for (const p of g.ps) {
    if (p.out) {
      offPitch(g, p)
      continue
    }
    p.cool = Math.max(0, p.cool - dt)
    p.call = Math.max(0, p.call - dt)
    p.screen = Math.max(0, p.screen - dt)
    p.cut = Math.max(0, p.cut - dt)
    // The other side thinks quicker or slower by its strength.
    if (held) p.want = [0, 0]
    else if (!p.human && playing) think(g, p, p.team === 1 ? dt * g.foe : dt)
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
      // A screen holds its ground: the man running into it is the one who goes round.
      const sa = a.screen > 0 && a.team !== c.team ? 0 : c.screen > 0 && a.team !== c.team ? 2 : 1
      // Past a man beaten by a move: round him, not into him.
      if ((a.act === 'geste' && c.act === 'beaten') || (c.act === 'geste' && a.act === 'beaten')) continue
      // A set piece's taker isn't pushed off the ball.
      if (g.set && (g.set.taker === a.id || g.set.taker === c.id)) continue
      const [dx, dz] = [c.x - a.x, c.z - a.z]
      const d = hyp(dx, dz)
      if (d > 0 && d < 0.62) {
        const k = (0.62 - d) / d / 2
        a.x -= dx * k * sa
        a.z -= dz * k * sa
        c.x += dx * k * (2 - sa)
        c.z += dz * k * (2 - sa)
      }
    }
  for (const p of g.ps) {
    keepIn(g, p)
    advanceGait(p)
  }
  if (playing && g.sport === 'foot') rise(g)
  moveBall(g, dt)
  if (playing) touches(g)
  for (const p of g.ps) poseOf(g, p)
  if (g.flash && g.time - g.flash.t > 2.2) g.flash = null
}

/** The console: how long the local stick has been left alone, and when the hands last went to another team-mate by themselves. */
let idleFor = 0
let lastAuto = -9
/**
 * The console's football defending: the hands go by themselves to the team-mate nearest the ball when
 * the one played is well behind it and the stick is left alone (or he is far out of it), as on a
 * console; never while the ball is on its way to him, nor twice within a second.
 */
function autoSwitch(g: Game, input: Input, dt: number) {
  idleFor = hyp(input.mx, input.mz) < 0.15 ? idleFor + dt : 0
  const me = g.ps[g.me]
  const h = holder(g)
  if ((h && h.team === me.team) || ballComing(g, me) || g.set || g.shootout || g.time - lastAuto < 1 || me.act !== 'none') return
  const [lx, lz] = landing(g)
  const next = nearestMate(g, lx, lz, me)
  if (!next) return
  const gap = hyp(me.x - lx, me.z - lz) - hyp(next.x - lx, next.z - lz)
  if ((idleFor > 0.45 && gap > (g.size === 11 ? 6 : 4)) || gap > (g.size === 11 ? 18 : 10)) {
    lastAuto = g.time
    control(g, next)
  }
}

/** A pass on its way to him (in the air, or rolling along the ground for him). */
const ballComing = (g: Game, p: Player) => g.ball.owner < 0 && (g.ball.flight ? g.ball.flight.kind !== 'shot' && g.ball.flight.target === p.id : g.ball.meant === p.id)

const PRESSES = ['pass', 'shoot', 'through', 'lob', 'skill'] as const
/** The hands as played this step: the presses kept (bufferPresses) put back in. One object, reused. */
const PLAYED: Input = { ...NO_INPUT }

/**
 * A press made a moment too soon is played as soon as it can be, not lost: while the player is busy
 * (a move, a kick, the end of a dribble move) it waits a quarter of a second; with a pass on its way to
 * him, until the ball gets there (the first-time pass, the one-two, the shot on the catch).
 */
function bufferPresses(g: Game, me: Player, input: Input, playing: boolean): Input {
  const B = me.buf
  const now = g.time
  if (input.pass) B.pass = now
  if (input.shoot) B.shoot = now
  if (input.through) B.through = now
  if (input.lob) B.lob = now
  if (input.skill) B.skill = now
  const coming = playing && ballComing(g, me)
  const busy = !playing || locked(me) || me.meter >= 0
  // (Every field, the optional ones too: a key left out must not keep the last player's.)
  PLAYED.mx = input.mx
  PLAYED.mz = input.mz
  PLAYED.defend = input.defend
  PLAYED.guard = input.guard
  PLAYED.sprint = input.sprint
  PLAYED.swap = input.swap
  PLAYED.charge = input.charge
  PLAYED.geste = input.geste
  PLAYED.juggle = input.juggle
  if (coming && !busy) {
    // Waiting for the ball: nothing played yet; the newest press kept fresh until it gets there (a newer one replaces it).
    const last = Math.max(B.pass, B.shoot, B.through, B.lob, B.skill)
    for (const k of PRESSES) B[k] = B[k] === last && now - last < 1.6 ? now : -9
    PLAYED.pass = PLAYED.shoot = PLAYED.through = PLAYED.lob = PLAYED.skill = false
    return PLAYED
  }
  PLAYED.pass = now - B.pass <= 0.28
  PLAYED.shoot = now - B.shoot <= 0.28
  PLAYED.through = now - B.through <= 0.28
  PLAYED.lob = now - B.lob <= 0.28
  PLAYED.skill = now - B.skill <= 0.28
  // Played now (free, the ball his or none coming): gone from the buffer.
  if (!busy) B.pass = B.shoot = B.through = B.lob = B.skill = -9
  return PLAYED
}

/** A human's stick and buttons, on its player. */
function hands(g: Game, me: Player, raw: Input, playing: boolean, dt: number) {
  const input = bufferPresses(g, me, raw, playing)
  // Tir pressed (and Tir held, where the hands can hold it) for a pass on its way: the shot on the catch, a first-time strike.
  const coming = playing && ballComing(g, me)
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
  // (The stadium's real-size pitch: a run of about 5.5 m/s, a sprint near 8, a little less with the ball.)
  const big = g.size === 11
  let top = input.guard && !has ? 3.6 : has ? (foot ? (big ? 5.2 : 5.6) : 5.2) : big ? 5.6 : 6
  // Football: the sprint, for as long as the breath lasts; out of breath, slower.
  if (foot) {
    const sprinting = !!input.sprint && m > 0.3 && me.stamina > 0.04 && !input.guard
    if (sprinting) {
      top *= has ? (big ? 1.38 : 1.12) : big ? 1.43 : 1.27
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
    // Putting the ball in: standing, Passe throws it to where the stick points (or whoever is open).
    if (g.inb && g.inb.by === me.id) {
      me.want = [0, 0]
      if (aim) me.face = Math.atan2(aim[0], aim[1])
      if (input.pass && !g.inb.check) putIn(g, aim)
      return
    }
    // The dribble picked up (and at the free-throw line): no running with it; the stick pivots him.
    if (has && (me.picked || g.ft)) {
      me.want = [0, 0]
      if (aim && !g.ft) me.face = Math.atan2(aim[0], aim[1])
    }
    // Le basket de rue: the moves (Feinte is the pump fake); the dribble show goes on while held.
    if (g.street && has) {
      if (me.act === 'juggle' && !input.juggle) dropJuggle(g, me)
      if (input.geste) return geste(g, me, input.geste, aim)
      if (input.skill) return geste(g, me, 'pompe', aim)
      if (input.juggle && me.act === 'none') return geste(g, me, 'show', aim)
    }
    if (input.pass) has ? pass(g, me, aim) : call(me)
    // Tir held where the hands can hold it: the jump shot on the meter.
    // (Pressed before the catch and already let go: the quick shot on the catch, off the meter.)
    if (input.shoot) has ? shoot(g, me, aim, undefined, input.charge !== undefined && (raw.shoot || input.charge)) : jump(g, me)
    if (input.skill && has) skill(g, me, aim)
    if (input.defend && !has) defend(g, me)
    return
  }
  // Football. Tir held where the hands can hold it: the power fills, the shot goes when it's let go.
  const holds = input.charge !== undefined
  // A keeper's hands (a player keeping goal online): Passe throws it out, Tir punts it; six seconds and it goes by itself.
  if (has && inHands(g, me)) {
    me.want = [0, 0]
    if (input.pass || input.through) keeperRelease(g, me, aim, false)
    else if (input.shoot || input.lob || (holds && !input.charge && me.charge > 0)) keeperRelease(g, me, aim, true)
    else if (me.at >= HOLD_MAX) keeperRelease(g, me, aim, null)
    me.charge = holds && input.charge ? Math.min(1, me.charge + dt * 1.15) : 0
    return
  }
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
    // Centre near the goal and central, the stick not pointing back: the chip over the keeper.
    else if (input.lob && !set && fifa(g) && chipRange(g, me) && !(aim && aim[0] * dirOf(me.team) < -0.3)) chip(g, me, aim)
    else if (input.lob) pass(g, me, aim, line === 'throw' ? 'throw' : 'lob')
    else if (input.skill && !set) skill(g, me, aim)
    return
  }
  // A lofted ball coming down near him: Tir heads it at goal, Passe to a team-mate (header).
  const b0 = g.ball
  if (foot && b0.lofted && b0.owner < 0 && !b0.flight && b0.y > 0.8 && hyp(b0.x - me.x, b0.z - me.z) < 3.5 && (input.pass || input.shoot || raw.pass || raw.shoot)) {
    me.nod = { k: input.shoot || raw.shoot ? 'shot' : 'pass', t: g.time }
    return
  }
  // A pass on its way and Tir held: the power fills for the strike on the catch (let go before, it goes on the first touch).
  if (coming && input.charge !== undefined && (input.charge || me.charge > 0)) {
    if (input.charge) me.charge = Math.min(1, me.charge + dt * 1.15)
  } else me.charge = 0
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
      if (g.rnd() < (behind ? 0.6 : ballFirst ? 0.03 : 0.35)) {
        foul(g, p, on, behind)
        return
      }
    }
    // Late: the ball has gone (a pass, a shot) and the slide takes the man who played it.
    const late = g.ps[b.lastBy]
    if (g.referee && !p.judged && !on && late && late.team !== p.team && b.owner !== late.id && g.time - (g.lastPass?.by === late.id ? g.lastPass.t : -9) < 0.8 && p.at > 0.1 && p.at < 0.75 && hyp(late.x - px, late.z - pz) < 0.8) {
      p.judged = true
      if (g.rnd() < 0.7) {
        foul(g, p, late, true)
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
        say(g, p.human ? tr('Tacle glissé ! Propre !') : tr('Tacle glissé !'))
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
  } else if (p.act === 'head') {
    // Up off the run: it carries him on into the ball.
    p.vx *= Math.exp(-2.5 * dt)
    p.vz *= Math.exp(-2.5 * dt)
    p.x += p.vx * dt
    p.z += p.vz * dt
  } else if (p.act === 'shoot' || (p.act === 'block' && p.at < 0.6) || p.act === 'hold' || p.act === 'throw') {
    p.vx *= Math.exp(-8 * dt)
    p.vz *= Math.exp(-8 * dt)
    p.x += p.vx * dt
    p.z += p.vz * dt
  } else if (p.act === 'celebrate' && g.sport === 'basket') {
    // Basketball: a little jog back, showing it (the pose: poseOf).
    p.vx *= Math.exp(-3 * dt)
    p.vz *= Math.exp(-3 * dt)
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
    // Running: towards the speed wanted with a body's limits (locomote); a crossover's burst keeps going a moment; the other side a little faster or slower by its strength.
    const pace = p.team === 1 && !p.human ? clamp(0.8 + 0.2 * g.foe, 0.88, 1.03) : 1
    // (Taking the ball down: half pace.)
    const slow = p.act === 'control' ? 0.5 : 1
    const [wx, wz] = p.act === 'cheer' ? [0, 0] : [p.want[0] * pace * slow, p.want[1] * pace * slow]
    if (p.act === 'cross') {
      p.vx += (wx - p.vx) * k
      p.vz += (wz - p.vz) * k
    } else locomote(g, p, wx, wz, dt)
    p.x += p.vx * dt
    p.z += p.vz * dt
  }
  // Facing: where he runs; standing, the ball (or the ring).
  if (p.act === 'none' || p.act === 'cross' || p.act === 'celebrate' || p.act === 'juggle') {
    const sp = speedOf(p)
    const b = g.ball
    // The console's football, the ball at his feet: he turns only by running (looking at the ball at his own feet would spin him round it).
    const own = g.sport === 'foot' && b.owner === p.id && fifa(g)
    const want = own ? (sp > 0.3 ? Math.atan2(p.vx, p.vz) : p.face) : sp > 0.6 ? Math.atan2(p.vx, p.vz) : g.sport === 'basket' && b.owner === p.id ? (p.picked && p.human ? p.face : faceRing(g, p)) : Math.atan2(b.x - p.x, b.z - p.z)
    let d = want - p.face
    d = Math.atan2(Math.sin(d), Math.cos(d))
    // (A body turns at most so fast: a half-turn on the spot takes about a quarter of a second.)
    p.face += clamp(d * (1 - Math.exp(-12 * dt)), -13 * dt, 13 * dt)
  }
  // The first touch: facing the ball as it comes, then the way it's taken.
  if (p.act === 'control' && p.ctrl) {
    const b = g.ball
    const want = p.at < p.len * 0.3 && b.owner === p.id ? Math.atan2(b.x - p.x, b.z - p.z) : Math.atan2(p.ctrl.dir[0], p.ctrl.dir[1])
    let d = want - p.face
    d = Math.atan2(Math.sin(d), Math.cos(d))
    p.face += clamp(d * (1 - Math.exp(-10 * dt)), -11 * dt, 11 * dt)
  }
  if (p.act !== 'none' && p.at >= p.len) {
    if (p.act === 'juggle') return dropJuggle(g, p)
    if (p.act === 'control') endControl(g, p)
    p.act = 'none'
    p.flip = false
    p.fooled = null
    p.move = null
    p.gbe = false
  }
  // Juggling: the style fills, the crowd loves it after a moment; a man close in can take it.
  if (p.act === 'juggle') juggling(g, p, dt)
}

/**
 * A body's way of changing speed: it eases to the speed wanted, but gets going at most so hard (ACC),
 * slows down harder (BRAKE, harder still planting a foot to turn back), and bends its run at most so
 * hard across (TURN: the faster, the wider the turn; with the ball at the feet, wider). So a reversal
 * at full speed is a stop and a push off (about half a second), a 90° cut carries him on a step or two,
 * and nobody spins round at once. Football and basketball alike, the AI as the hands.
 */
const ACC = 8.5
const BRAKE = 15
const PLANT = 28
const TURN = 21
function locomote(g: Game, p: Player, wx: number, wz: number, dt: number) {
  const has = g.ball.owner === p.id
  const foot = g.sport === 'foot'
  // With the ball: a little slower to get going, wider in the turns (the football at the feet more than the basketball in the hand).
  const acc = has ? ACC * 0.85 : ACC
  const turn = has ? TURN * (foot ? 0.72 : 0.85) : TURN
  // Eased (the last of it smoothly), then held to what legs can do.
  const e = 1 - Math.exp(-11 * dt)
  let dx = (wx - p.vx) * e
  let dz = (wz - p.vz) * e
  const sp = Math.sqrt(p.vx * p.vx + p.vz * p.vz)
  if (sp < 0.6) {
    // From a standstill (or nearly): a push any way.
    const l = Math.sqrt(dx * dx + dz * dz)
    const most = acc * 1.25 * dt
    if (l > most) {
      dx *= most / l
      dz *= most / l
    }
  } else {
    // Along the run and across it.
    const [ux, uz] = [p.vx / sp, p.vz / sp]
    let along = dx * ux + dz * uz
    let across = dz * ux - dx * uz
    const back = wx * ux + wz * uz < -0.3 * sp
    along = clamp(along, -(back ? PLANT : BRAKE) * dt, acc * dt)
    across = clamp(across, -turn * dt, turn * dt)
    dx = ux * along - uz * across
    dz = uz * along + ux * across
  }
  p.vx += dx
  p.vz += dz
}

/** Inside the fence (and off the keeper's line for the others, a little). */
function keepIn(g: Game, p: Player) {
  if (p.out) return
  if (g.sport === 'basket' && g.full) {
    // The full court: off the floor a step or two (a throw-in); with the ball, never over a line (the hands are helped: no stepping out).
    const has = g.ball.owner === p.id
    const inb = g.inb?.by === p.id
    const [mx, mz] = has && !inb ? [PRO.x - 0.25, PRO.z - 0.25] : [PRO.x + 1.4, PRO.z + 1.2]
    p.x = clamp(p.x, -mx, mx)
    p.z = clamp(p.z, -mz, mz)
  } else if (g.sport === 'basket') {
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
  // Basketball: the tip-off's toss, a ball held to be thrown in or checked (in the hands of the one putting it in).
  if (g.sport === 'basket' && g.tip >= 0) return tipping(g, dt)
  if (g.sport === 'basket' && g.inb && !b.flight) {
    const by = g.ps[g.inb.by]
    const [fx, fz] = fwd(by)
    b.x = by.x + fx * 0.3
    b.z = by.z + fz * 0.3
    b.y = 1.15
    b.vx = b.vy = b.vz = 0
    return
  }
  if (h) {
    const [fx, fz] = fwd(h)
    const [rx, rz] = right(h)
    const sp = speedOf(h)
    if (g.sport === 'basket') {
      // The bounce's beat: standing, its own (about two a second); on the move, one bounce a stride,
      // on the steps (the ball hits the floor as a foot comes down: h.gait), eased from one to the other.
      const w = clamp((sp - 0.8) / 1.6, 0, 1)
      b.phase += dt * (7 * (1 - w) + w * (sp / gaitStep(sp)) * Math.PI * 0.5)
      if (w > 0) {
        const off = h.gait * 0.5 + Math.PI * 0.5 - b.phase
        b.phase += (off - Math.PI * Math.round(off / Math.PI)) * w * Math.min(1, 5 * dt)
      }
    } else b.phase += dt * (1.2 + sp * 0.32)
    if (g.sport === 'basket') {
      if (h.act === 'dunk' || h.act === 'layup' || h.act === 'shoot' || h.act === 'pass' || (h.picked && h.act === 'none')) {
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
        // Moving with it is dribbling: a pump fake after that picks it up.
        if (sp > 0.8) h.dribbled = true
      }
    } else if (g.set && g.set.taker === h.id) {
      // A dead ball: still on its spot (a throw-in over the head).
      b.x = g.set.at[0]
      b.z = g.set.at[1]
      b.y = g.set.kind === 'throw' ? 2.05 : R
      b.rel = undefined
    } else if (g.street && (h.act === 'geste' || h.act === 'juggle') && h.move) {
      gesteBall(g, h, R)
      // (Back at the feet from where the move leaves it.)
      b.rel = undefined
    } else if (h.act === 'control' && h.ctrl) {
      controlBall(g, h, R)
    } else if (h.act === 'hold') {
      b.x = h.x + fx * 0.3
      b.z = h.z + fz * 0.3
      b.y = 1.05
      b.rel = undefined
    } else if (fifa(g)) {
      // The console: little touches, the ball knocked on quickly and caught up slowly (no
      // snapping back), bigger the faster he runs; it eases to where it should be at his feet,
      // so a pass taken while moving, or a turn, never makes it jump about.
      const amp = 0.38 * clamp((sp - 0.7) / 3, 0, 1)
      const f = touchBeat(h, sp)
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
      // Little touches: the ball pushed ahead on a step, the player catching it up (eased like the console's: it never jumps back to the feet).
      const f = touchBeat(h, sp)
      const push = sp > 0.7 ? 0.3 + 0.38 * clamp((sp - 0.7) / 3, 0, 1) * (f < 0.2 ? f / 0.2 : (1 - f) / 0.8) : 0.32
      const rel = b.rel ?? [b.x - h.x, b.z - h.z]
      const k = 1 - Math.exp(-14 * dt)
      rel[0] += (fx * push - rel[0]) * k
      rel[1] += (fz * push - rel[1]) * k
      b.rel = rel
      b.x = h.x + rel[0]
      b.z = h.z + rel[1]
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
          // (Basketball: a hand in the lane of a crisp pass gets it now and then, more when he went for it.)
          const chance = g.sport === 'basket' ? (f.kind === 'bounce' ? 0.07 : 0.13) + (q.act === 'steal' ? 0.22 : 0) + (q.act === 'block' ? 0.15 : 0) : (f.kind === 'bounce' ? 0.12 : 0.26) + (q.act === 'steal' ? 0.25 : 0) + (q.act === 'block' ? 0.2 : 0)
          if (g.rnd() < chance) {
            give(g, q)
            say(g, tr('Interception !'))
            moment(g, 'steal', q)
            if (q.id === g.me) g.stats.steals++
            return
          }
        }
      }
    }
    if (k < 1) return
    b.flight = null
    if (f.kind === 'shot') return shotArrives(g, f)
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
  // Free: gravity, the side-spin bending it (less once it has bounced), the bounces, the roll.
  if (b.curl) {
    b.vz += b.curl * dt
    b.curl *= Math.exp(-0.8 * dt)
  }
  b.vy -= 9.8 * dt
  b.x += b.vx * dt
  b.y += b.vy * dt
  b.z += b.vz * dt
  if (b.y < R) {
    b.y = R
    // Down: no head can get to it now; the spin mostly gone.
    b.lofted = false
    if (b.curl) b.curl *= 0.3
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
    hoopBounce(g, dt)
    // The full court: lines, not a fence; out of bounds, the other side throws it in.
    if (g.full) return outOfBounds(g)
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

/** Where the football is in its touch (0: knocked on, then caught up): one touch a stride on the steps, every other stride at a sprint (longer knocks). */
function touchBeat(h: Player, sp: number) {
  const per = sp > 6.4 ? Math.PI * 4 : Math.PI * 2
  return (((h.gait + Math.PI * 0.3) % per) + per) % per / per
}

/* ---------- Basketball: the ball on the iron ---------- */

/** The board hit: the thud, and the iron shakes a little. */
function boardHit(g: Game) {
  g.board = g.time
  if (g.lastShot) g.lastShot.iron = true
}

/**
 * A shot gets there. Going in off the iron or the board: that touch, then on through the ring. Clean
 * through: the net, the points (a free throw, the next one). Missed: off the iron (or the board) for the
 * rebound, longer off a long shot; a shooter fouled gets his free throws.
 */
function shotArrives(g: Game, f: Flight) {
  const b = g.ball
  const ring = f.ring ?? 0
  const H = g.hoops[ring]
  g.ringHit = ring
  if (f.make && f.via !== 'swish' && !f.leg) {
    if (f.via === 'rim') g.rim = { t: g.time, amp: 0.04 }
    else boardHit(g)
    if (g.lastShot) g.lastShot.iron = true
    b.flight = { ...f, from: [b.x, b.y, b.z], to: [H[0], RIM_Y - 0.02, H[1]], t: 0, len: f.via === 'rim' ? 0.36 : 0.24, apex: f.via === 'rim' ? 0.22 : 0.04, leg: true, via: 'swish', tried: [] }
    return
  }
  if (f.make) {
    // Through the net.
    b.x = H[0]
    b.z = H[1]
    b.y = RIM_Y - 0.05
    b.vx = b.vz = 0
    b.vy = -2.6
    b.dead = true
    g.swish = g.time
    if (f.ft) return ftDone(g, true)
    g.lastShot = null
    return scored(g, g.ps[f.by], f.points, false)
  }
  // Missed: off the iron (or the board first), out for the rebound.
  const shooter = g.ps[f.by]
  const far = hyp(f.from[0] - H[0], f.from[2] - H[1])
  const [ix, iz] = [(f.to[0] - f.from[0]) / f.len, (f.to[2] - f.from[2]) / f.len]
  if (f.to[1] > RIM_Y + 0.3) {
    // Off the board: back down towards the ring, onto the iron or past it.
    boardHit(g)
    const [dx, dz] = [H[0] - b.x, H[1] - b.z]
    const l = hyp(dx, dz) || 1
    b.vx = (dx / l) * (1.2 + g.rnd() * 0.8)
    b.vz = (dz / l) * (1.2 + g.rnd() * 0.8)
    b.vy = -0.4
  } else {
    g.rim = { t: g.time, amp: 0.06 }
    const [ox, oz] = [b.x - H[0], b.z - H[1]]
    const l = hyp(ox, oz) || 1
    const v = 1.3 + far * 0.2 + g.rnd() * 1.1
    b.vx = (ox / l) * v + ix * 0.12 + (g.rnd() - 0.5) * 0.8
    b.vz = (oz / l) * v + iz * 0.12 + (g.rnd() - 0.5) * 0.8
    b.vy = 1.3 + g.rnd() * 1.7
    // Nudged off the ring's edge so it doesn't sit on it.
    b.x = H[0] + (ox / l) * (RING_R + BALL_R.basket + 0.03)
    b.z = H[1] + (oz / l) * (RING_R + BALL_R.basket + 0.03)
  }
  if (g.lastShot) g.lastShot.iron = true
  if (f.ft) return ftDone(g, false)
  moment(g, 'miss', shooter)
  if (g.rnd() < 0.3) say(g, tr('Sur le cercle !'))
  // Fouled and missed: his free throws, one a point the shot was worth.
  if (g.andOne?.on === shooter.id) {
    b.dead = true
    g.andOne = null
    g.phase = 'dead'
    g.wait = 1.1
    g.then = () => freeThrows(g, shooter, f.points)
  }
}

/**
 * The loose ball and the hoops: the ring's iron (a torus: off it at any angle, rattling round, rolling
 * in), the board's face; and a ball dropping down through the ring is a basket (the last shot's worth,
 * a roll-in; a ball knocked in, the side that touched it last).
 */
function hoopBounce(g: Game, dt: number) {
  const b = g.ball
  const R = BALL_R.basket
  if (b.owner >= 0 || b.flight) return
  for (const ring of g.full ? ([0, 1] as const) : ([0] as const)) {
    const H = g.hoops[ring]
    const [dx, dz] = [b.x - H[0], b.z - H[1]]
    const r = hyp(dx, dz)
    if (r > 1.4 || Math.abs(b.y - RIM_Y) > 1.2) {
      boardBounce(g, ring)
      continue
    }
    // Down through the ring.
    const was = b.y - b.vy * dt
    if (!b.dead && b.vy < 0 && was >= RIM_Y && b.y < RIM_Y && r < RING_R - R * 0.45) {
      b.dead = true
      b.vx *= 0.2
      b.vz *= 0.2
      g.swish = g.time
      g.ringHit = ring
      const ls = g.lastShot
      const by = ls && g.time - ls.t < 5 ? g.ps[ls.by] : g.ps[Math.max(0, b.lastBy)]
      // (The half-court's one ring is everyone's: it counts for the side that put it up.)
      const team: 0 | 1 = g.full ? ring : by.team
      g.lastShot = null
      if (by.team !== team) {
        // Knocked into his own side's ring: it counts for the others, to whoever of them was nearest.
        const them = nearest(g.ps.filter((q) => q.team === team && !q.out), H[0], H[1])[0]
        if (them) scored(g, them, g.full ? 2 : 1, false)
      } else scored(g, by, ls ? ls.points : g.full ? 2 : 1, false)
      if (g.rnd() < 0.5) say(g, tr('Il roule… et il tombe !'))
      return
    }
    // The iron.
    if (r > 1e-4) {
      const [px, pz] = [H[0] + (dx / r) * RING_R, H[1] + (dz / r) * RING_R]
      const [nx, ny, nz] = [b.x - px, b.y - RIM_Y, b.z - pz]
      const d = Math.hypot(nx, ny, nz)
      const reach = R + 0.012
      if (d < reach && d > 1e-5) {
        const [ux, uy, uz] = [nx / d, ny / d, nz / d]
        const vn = b.vx * ux + b.vy * uy + b.vz * uz
        if (vn < 0) {
          const k = 1 + 0.55
          b.vx -= k * vn * ux
          b.vy -= k * vn * uy
          b.vz -= k * vn * uz
          if (-vn > 0.8) {
            g.rim = { t: g.time, amp: Math.min(0.08, 0.02 - vn * 0.01) }
            g.ringHit = ring
          }
          if (g.lastShot) g.lastShot.iron = true
        }
        b.x = px + ux * reach
        b.y = RIM_Y + uy * reach
        b.z = pz + uz * reach
      }
    }
    boardBounce(g, ring)
  }
}

/** Off the board's face (the full court's two, the half-court's one). */
function boardBounce(g: Game, ring: 0 | 1) {
  const b = g.ball
  const R = BALL_R.basket
  const H = g.hoops[ring]
  if (b.y < BOARD.y || b.y > BOARD.y + BOARD.h) return
  if (g.full) {
    const s = Math.sign(H[0])
    if (Math.abs(b.z - H[1]) > BOARD.w / 2 || s * b.x + R < PRO.board || s * b.x > PRO.board + 0.1 || s * b.vx <= 0) return
    b.x = s * (PRO.board - R)
    b.vx = -b.vx * 0.6
  } else {
    if (Math.abs(b.x - H[0]) > BOARD.w / 2 || b.z - R > BOARD_Z || b.z < BOARD_Z - 0.1 || b.vz >= 0) return
    b.z = BOARD_Z + R
    b.vz = -b.vz * 0.6
  }
  if (Math.abs(b.vx) + Math.abs(b.vz) > 1) boardHit(g)
}

/** The full court: a loose ball down past a line is out; the side that didn't touch it last throws it in. */
function outOfBounds(g: Game) {
  const b = g.ball
  if (b.owner >= 0 || b.flight || b.dead || g.phase !== 'play' || g.inb || b.y > 0.6) return
  if (Math.abs(b.x) < PRO.x + 0.1 && Math.abs(b.z) < PRO.z + 0.1) return
  const team: 0 | 1 = b.lastTeam === 0 ? 1 : 0
  const at: V = Math.abs(b.z) >= PRO.z ? sideline(b.x, b.z) : [Math.sign(b.x) * (PRO.x + 0.45), clamp(b.z, -5, 5)]
  b.dead = true
  g.ref.whistle = g.time
  say(g, team === g.ps[g.me].team ? tr('Sortie ! Balle à ton équipe.') : tr('Sortie ! Balle aux adversaires.'))
  g.phase = 'dead'
  g.wait = 0.9
  g.then = () => throwIn(g, team, at)
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
        say(g, tr('Arrêt du gardien ! Il capte.'))
      } else {
        // Pushed away.
        b.vx = -b.vx * 0.35
        b.vz = (g.rnd() - 0.5) * 8
        b.vy = 2.5
        b.lastTeam = k.team
        b.lastBy = k.id
        b.tried = []
        say(g, tr('Arrêt du gardien !'))
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
      say(g, tr('Poteau !'))
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
  say(g, scorer.id === g.me ? tr('BUUUT !!! Tu as marqué !') : team === myTeam(g) ? tr('BUUUT ! {name} !', { name: scorer.name }) : tr('But pour eux…'))
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
  // Basketball: a ball being checked or thrown in, or tossed for the tip, is nobody's to take.
  if (g.sport === 'basket' && (g.inb || g.tip >= 0)) return
  const foot = g.sport === 'foot'
  // A Gbê on its way: nobody stops it but a keeper who's to save it.
  const gbeOn = g.time - g.gbe < 1.2 && hyp(b.vx, b.vz) > 14
  // The nearest to the ball first (it used to be the first in the list: the player's side, always first, won
  // nearly every rebound and every scramble), a hair of chance between two as near.
  const byNear = [...g.ps].sort((a, c) => hyp(a.x - b.x, a.z - b.z) - hyp(c.x - b.x, c.z - b.z) + (g.rnd() - 0.5) * 0.08)
  for (let p of byNear) {
    if (p.out || p.cool > 0 || p.act === 'beaten' || p.act === 'celebrate' || (p.act === 'slide' && p.at < 0.7)) continue
    if (gbeOn && !(p.keeper && g.shot?.save)) continue
    const d = hyp(p.x - b.x, p.z - b.z)
    // A ball in the air at head height: in the box, headed (at goal, or away); elsewhere taken on the chest if it isn't too high.
    if (foot && !p.keeper && b.lofted && b.y > 0.9) {
      // Up for it (rise): the ball meets the head at the jump's height; standing, a ball at head height too.
      const up = p.act === 'head' && p.at > 0.06 && p.at < 0.45
      const hy = HEAD_Y + (up ? jumpY(p.at) : 0)
      const mine = b.meant === p.id && !wantsHeader(g, p)
      if (!mine && d < (up ? 1.0 : 0.85) && Math.abs(b.y - hy) < (up ? 0.6 : 0.4) && (up || p.act === 'none' || p.act === 'control')) {
        // A man of the other side up for it too, as near: the duel, either of them.
        const rival = g.ps.find((q) => q.team !== p.team && !q.keeper && q.act === 'head' && q.at > 0.06 && q.at < 0.45 && hyp(q.x - b.x, q.z - b.z) < 1.2)
        // (The one attacking his own side's cross a little more often: he knows where it's going.)
        if (rival && g.rnd() < (rival.team === b.lastTeam ? 0.6 : 0.4)) p = rival
        // The ball onto the forehead (as near as the jump got).
        const [fx, fz] = fwd(p)
        b.x += (p.x + fx * 0.15 - b.x) * 0.6
        b.z += (p.z + fz * 0.15 - b.z) * 0.6
        b.y = hy + 0.12
        header(g, p)
        return
      }
      if ((b.y < 1.6 || (mine && b.y < 2.1)) && d < 0.9 && !up) {
        receive(g, p)
        return
      }
      continue
    }
    // A lofted ball still climbing goes over the men round the one who struck it.
    if (foot && b.lofted && b.vy > 1 && !p.keeper) continue
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
    if (!foot && jumping) say(g, p.team === g.poss ? tr('Rebond offensif !') : tr('Rebond !'))
    receive(g, p)
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
      pose = 'header'
      break
    case 'control':
      pose = p.ctrl?.kind ?? 'trap'
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
      // Basketball: the scorer shows it, his own way (the arms, the chest, a shout at the crowd).
      if (!foot) {
        pose = (['flex', 'shout', 'dab', 'cheer'] as Pose[])[(p.id + Math.floor(p.take)) % 4]
        break
      }
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
  const wall = g.sport === 'basket' ? guardOf(g, me) : null
  const dunk = g.sport === 'basket' && has && fromRing(g, me) < 3.8 && speedOf(me) > 2.2 && !me.picked && !(wall && dist(wall, me) < 1.25 && wall.act !== 'beaten')
  return { has, dunk }
}

/** The result for the player's team. */
export function outcome(g: Game) {
  // From the local player's side (at a court match it may be the other team); a draw settled on penalties, the shoot-out's.
  const w = leader(g)
  return w === null ? 'draw' : w === g.ps[g.me].team ? 'win' : 'loss'
}
