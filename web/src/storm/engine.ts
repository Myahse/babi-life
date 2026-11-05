import type { Pose } from '../avatar/Human'
import { t } from '../lib/i18n'

// Adjamé Storm 4's rules (the update « combat-arene »), apart from what draws it
// (Scene.tsx) and what plays it (../Combat.tsx): two fighters free on the
// ground of an arena (a vacant lot, a courtyard…), in metres and seconds, x
// and z on the ground, y up. Each fighter runs anywhere, circles the other
// while locked on (facing it), dashes in (a homing rush when far) or steps
// back, jumps. « Attaque » pressed again and again chains four blows, the
// last sending the other flying, tumbling, off a wall; after a rush it's a
// rushing blow, in the air a dive kick, with the guard held a grab (which
// goes through the guard). The guard takes the blows from the front. The
// escape is a dodge-roll; from under a combo it gets the fighter out, then
// waits its cooldown. The special (one per fighter) needs its gauge full:
// fighting fills it, holding the button charges it. Hits freeze the fight
// for an instant (the blow is felt).

export const ROUND_TIME = 60
export const ROUNDS_TO_WIN = 2
const STEP = 1 / 120
const GRAVITY = 24
const STRAFE = 3.6 // locked on, close: circling, facing the other
const RUN = 6.2 // free, or far: running where the stick goes
const NEAR = 4.5 // closer than this and locked on: circling
const ACCEL = 16
const DASH = 11.5
const BACKSTEP = 6.5
const JUMP_V = 8.6
const BODY = 0.66 // the closest two fighters stand, centre to centre
const BUFFER = 0.2 // a press waits this long for the fighter to be free
/** The escape's cooldown (from under a combo). */
export const ESCAPE_CD = 6
const ROLL_CD = 0.55
const CHARGE = 34 // the special's gauge, a second of charging
const AUTO_AIM = 5 // a blow started closer than this turns to the other

/** Where the fight is: its half-size (x, z) and the things standing in it (circles on the ground). */
export type Arena = { w: number; d: number; props: { x: number; z: number; r: number }[] }

export type ArenaId = 'terrain' | 'treichville' | 'cour' | 'plage'
/** The arenas' ground and props (Scene.tsx draws the same props at the same places). */
export const ARENAS: Record<ArenaId, Arena> = {
  // A vacant lot of Adjamé: cinder-block walls, a dead woro-woro, oil drums, a pile of tyres, a mango tree.
  terrain: { w: 11, d: 8, props: [{ x: -6.5, z: -4.2, r: 1.15 }, { x: -4.7, z: -4.6, r: 1.15 }, { x: 6.6, z: 4.4, r: 0.45 }, { x: 7.4, z: 3.6, r: 0.45 }, { x: 5.5, z: -4.6, r: 0.8 }, { x: -7.2, z: 4.6, r: 0.55 }] },
  // A road of Treichville at night, closed off for the fight: the maquis, the cabine, a gbaka parked.
  treichville: { w: 12, d: 6.5, props: [{ x: -8.6, z: -3.6, r: 1.1 }, { x: -6.6, z: -3.6, r: 1.1 }, { x: 7.4, z: 3.8, r: 0.6 }] },
  // A family courtyard of Yopougon: the walls, the well, the bench, the laundry lines.
  cour: { w: 9, d: 7, props: [{ x: 5.6, z: -4.2, r: 0.85 }, { x: -6, z: 4.6, r: 0.5 }, { x: -6.5, z: -4.6, r: 0.6 }] },
  // The beach at Bassam, at sunset: the pirogues pulled up, a parasol.
  plage: { w: 12, d: 7.5, props: [{ x: -7.5, z: -4.6, r: 0.9 }, { x: -5.6, z: -4.8, r: 0.9 }, { x: 6.5, z: 4.2, r: 0.35 }, { x: 8.2, z: -4.4, r: 0.9 }] },
}

export type Level = 'mid' | 'low' | 'high' | 'air' | 'throw' | 'area'
export type MoveId = 'jab' | 'cross' | 'hook' | 'finisher' | 'rush' | 'dive' | 'grab' | 'coupe' | 'tourbillon' | 'envol' | 'marteau'
export type SpecialId = 'coupe' | 'tourbillon' | 'envol' | 'marteau'
export const SPECIALS: SpecialId[] = ['coupe', 'tourbillon', 'envol', 'marteau']
/** What the special is called (the HUD, the select screen). */
export const SPECIAL_NAME: Record<SpecialId, string> = { coupe: t('Coupé-décalé'), tourbillon: t('Le tourbillon'), envol: t('L’envol'), marteau: t('Le marteau') }

type Knock = 'blast' | 'launch' | 'trip' | 'stagger'
type MoveDef = {
  pose: Pose
  startup: number
  active: number
  recovery: number
  dmg: number
  reach: number
  /** How wide in front it reaches (the cosine of the half-angle; -1: all round). */
  arc: number
  level: Level
  stun: number
  block: number
  push: number
  knock?: Knock
  /** The next blow of the chain, « Attaque » pressed again. */
  next?: MoveId
  /** Forward speed while it's thrown (m/s), up to the end of `active`. */
  lunge?: number
  /** A special: invulnerable while it starts. */
  special?: boolean
}

export const MOVES: Record<MoveId, MoveDef> = {
  jab: { pose: 'jab', startup: 0.07, active: 0.07, recovery: 0.16, dmg: 5, reach: 1.05, arc: 0.5, level: 'mid', stun: 0.42, block: 0.16, push: 0.35, next: 'cross', lunge: 2.4 },
  cross: { pose: 'cross', startup: 0.08, active: 0.07, recovery: 0.18, dmg: 6, reach: 1.1, arc: 0.5, level: 'mid', stun: 0.44, block: 0.18, push: 0.4, next: 'hook', lunge: 2.6 },
  hook: { pose: 'fhook', startup: 0.1, active: 0.08, recovery: 0.2, dmg: 7, reach: 1.15, arc: 0.3, level: 'mid', stun: 0.48, block: 0.2, push: 0.45, next: 'finisher', lunge: 2.8 },
  finisher: { pose: 'highkick', startup: 0.16, active: 0.1, recovery: 0.42, dmg: 11, reach: 1.4, arc: 0.4, level: 'high', stun: 0.5, block: 0.26, push: 1.4, knock: 'blast', lunge: 3.2 },
  rush: { pose: 'cross', startup: 0.05, active: 0.14, recovery: 0.3, dmg: 8, reach: 1.15, arc: 0.4, level: 'mid', stun: 0.7, block: 0.22, push: 0.8, knock: 'stagger', lunge: 9, next: 'jab' },
  dive: { pose: 'airkick', startup: 0.08, active: 1, recovery: 0.22, dmg: 8, reach: 1.15, arc: 0.3, level: 'air', stun: 0.5, block: 0.22, push: 0.6, knock: 'trip' },
  grab: { pose: 'fgrab', startup: 0.07, active: 0.06, recovery: 0.45, dmg: 12, reach: 1.0, arc: 0.6, level: 'throw', stun: 0, block: 0, push: 0 },
  // The specials: the coupé-décalé's flurry rushing in; the spinning tourbillon, all round; the flying kick from afar; the leap down onto the ground.
  coupe: { pose: 'fsuper', startup: 0.25, active: 0.6, recovery: 0.35, dmg: 26, reach: 1.15, arc: 0.3, level: 'mid', stun: 0.6, block: 0.35, push: 1.2, knock: 'blast', lunge: 9, special: true },
  tourbillon: { pose: 'fspin', startup: 0.22, active: 0.8, recovery: 0.4, dmg: 24, reach: 1.7, arc: -1, level: 'area', stun: 0.6, block: 0.35, push: 1.4, knock: 'blast', lunge: 4.5, special: true },
  envol: { pose: 'airkick', startup: 0.28, active: 0.55, recovery: 0.35, dmg: 25, reach: 1.3, arc: 0.3, level: 'mid', stun: 0.6, block: 0.35, push: 1.3, knock: 'blast', lunge: 13, special: true },
  marteau: { pose: 'fslam', startup: 0.6, active: 0.12, recovery: 0.5, dmg: 27, reach: 2.8, arc: -1, level: 'area', stun: 0.6, block: 0.4, push: 1.6, knock: 'launch', special: true },
}

export type Act = 'stance' | 'walk' | 'run' | 'jump' | 'dash' | 'backstep' | 'roll' | 'charge' | 'attack' | 'block' | 'hit' | 'air' | 'down' | 'getup' | 'thrown' | 'ko' | 'win'

export type Fighter = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /** Where it faces: the angle from +z towards +x (the avatar's rotation.y). */
  h: number
  hp: number
  meter: number
  act: Act
  /** Seconds in this act. */
  t: number
  move: MoveId | null
  /** The move has landed, on the body or the guard. */
  hit: boolean
  /** Seconds of hit or block stun left. */
  stun: number
  guard: boolean
  /** Hits taken in a row (each one lands a little less). */
  combo: number
  juggle: number
  /** Counts every new act: the pose starts over. */
  take: number
  invuln: number
  dead: boolean
  /** The escape's cooldown left (s); the roll's own little one. */
  esc: number
  roll: number
  /** Its special, how hard it hits and how fast it goes (its style). */
  sp: SpecialId
  pow: number
  spd: number
  /** Sent flying (tumbling) rather than popped up. */
  fly: boolean
  /** Presses waiting for the fighter to be free (seconds left): attack, jump, dash, escape, special. */
  buffer: { a: number; j: number; d: number; e: number; s: number }
  /** A homing rush: still chasing the other. */
  chase: boolean
}

/**
 * A pad as read this step: the stick as a direction on the ground (x, z, at
 * most 1 long: the camera turned it from the screen), the guard held, locked
 * on, the special held (charging); the buttons pressed since the last step.
 */
export type Pad = { x: number; z: number; guard: boolean; lock: boolean; charge: boolean; attack: boolean; jump: boolean; dash: boolean; esc: boolean; sp: boolean }
export const NO_PAD: Pad = { x: 0, z: 0, guard: false, lock: true, charge: false, attack: false, jump: false, dash: false, esc: false, sp: false }

export type FightEvent = { kind: 'hit' | 'counter' | 'block' | 'throw' | 'swing' | 'super' | 'land' | 'ko' | 'wall' | 'roll' | 'escape' | 'dash' | 'slam'; by: 0 | 1; x: number; y: number; z: number; dmg?: number; heavy?: boolean }

export type Phase = 'intro' | 'fight' | 'ko' | 'timeup' | 'over'

export type Fight = {
  f: [Fighter, Fighter]
  ar: Arena
  phase: Phase
  phaseT: number
  round: number
  wins: [number, number]
  clock: number
  /** The hit-stop: everything holds still for an instant. */
  freeze: number
  /** The K.O. in slow motion. */
  slow: number
  /** A special's flash: the place darkens. */
  flash: number
  events: FightEvent[]
  dealt: [number, number]
  /** Who took the round just ended (-1: a draw). */
  roundWinner: -1 | 0 | 1
  said: string
  saidAt: number
  time: number
  acc: number
}

/** A fighter's style: its special, how hard it hits, how fast it goes. */
export type Style = { sp: SpecialId; pow: number; spd: number }

function fighter(z: number, st: Style, meter = 0): Fighter {
  return {
    x: 0,
    y: 0,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    h: z > 0 ? Math.PI : 0,
    hp: 100,
    meter,
    act: 'stance',
    t: 0,
    move: null,
    hit: false,
    stun: 0,
    guard: false,
    combo: 0,
    juggle: 0,
    take: 0,
    invuln: 0,
    dead: false,
    esc: 0,
    roll: 0,
    sp: st.sp,
    pow: st.pow,
    spd: st.spd,
    fly: false,
    buffer: { a: 0, j: 0, d: 0, e: 0, s: 0 },
    chase: false,
  }
}

const START = 3.2

const PLAIN: Style = { sp: 'coupe', pow: 1, spd: 1 }

export function createFight(arena: ArenaId = 'terrain', styles: [Style, Style] = [PLAIN, PLAIN]): Fight {
  const ar = ARENAS[arena]
  const s = Math.min(START, ar.d * 0.45)
  return {
    f: [fighter(s, styles[0]), fighter(-s, styles[1])],
    ar,
    phase: 'intro',
    phaseT: 0,
    round: 1,
    wins: [0, 0],
    clock: ROUND_TIME,
    freeze: 0,
    slow: 0,
    flash: 0,
    events: [],
    dealt: [0, 0],
    roundWinner: -1,
    said: '',
    saidAt: 0,
    time: 0,
    acc: 0,
  }
}

const say = (F: Fight, s: string) => ((F.said = s), (F.saidAt = F.time))

function setAct(f: Fighter, act: Act) {
  f.act = act
  f.t = 0
  f.take++
}

export const airborne = (f: Fighter) => f.y > 0 || f.vy !== 0
/** Free to move or start a blow. */
const free = (f: Fighter) => !airborne(f) && (f.act === 'stance' || f.act === 'walk' || f.act === 'run' || f.act === 'charge' || (f.act === 'block' && f.stun <= 0))
const hittable = (f: Fighter) => !f.dead && f.invuln <= 0 && f.act !== 'down' && f.act !== 'getup' && f.act !== 'ko' && f.act !== 'thrown' && f.act !== 'win' && f.act !== 'roll' && !(f.act === 'air' && f.juggle >= 4)
const canBlock = (f: Fighter) => f.guard && !airborne(f) && (free(f) || f.act === 'block')
/** The angle from a to b on the ground. */
const angleTo = (a: Fighter, b: { x: number; z: number }) => Math.atan2(b.x - a.x, b.z - a.z)
const dist = (a: Fighter, b: Fighter) => Math.hypot(b.x - a.x, b.z - a.z)
/** The shortest turn from a to b. */
export const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a))

/** The whole fight, `dt` real seconds on (stepped finely inside). */
export function stepFight(F: Fight, dt: number, pads: [Pad, Pad]) {
  // The presses go in the buffers at once, whatever the step.
  pads.forEach((p, i) => {
    const b = F.f[i].buffer
    if (p.attack) b.a = BUFFER
    if (p.jump) b.j = BUFFER
    if (p.dash) b.d = BUFFER
    if (p.esc) b.e = BUFFER
    if (p.sp) b.s = BUFFER
  })
  F.acc += Math.min(dt, 0.1)
  while (F.acc >= STEP) {
    F.acc -= STEP
    tick(F, STEP, pads)
  }
}

function tick(F: Fight, h: number, pads: [Pad, Pad]) {
  F.time += h
  F.flash = Math.max(0, F.flash - h)
  for (const f of F.f) {
    const b = f.buffer
    b.a = Math.max(0, b.a - h)
    b.j = Math.max(0, b.j - h)
    b.d = Math.max(0, b.d - h)
    b.e = Math.max(0, b.e - h)
    b.s = Math.max(0, b.s - h)
  }
  if (F.freeze > 0) {
    F.freeze -= h
    return
  }
  // The K.O. in slow motion: the fight goes at a third of its pace.
  if (F.slow > 0) {
    F.slow -= h
    h *= 0.3
  }
  F.phaseT += h
  switch (F.phase) {
    case 'intro':
      if (F.phaseT < h * 1.5) say(F, F.wins[0] === 1 && F.wins[1] === 1 ? t('Dernier round') : t('Round {round}', { round: F.round }))
      if (F.phaseT >= 1.4 && F.said !== 'Combat !') say(F, 'Combat !')
      if (F.phaseT >= 1.9) ((F.phase = 'fight'), (F.phaseT = 0))
      move(F, h, [NO_PAD, NO_PAD])
      return
    case 'fight': {
      F.clock = Math.max(0, F.clock - h)
      move(F, h, pads)
      const [a, b] = F.f
      if (a.dead || b.dead) {
        F.phase = 'ko'
        F.phaseT = 0
        F.slow = 1.1
        F.roundWinner = a.dead && b.dead ? -1 : a.dead ? 1 : 0
        say(F, a.dead && b.dead ? t('Double K.O. !') : t('K.O. !'))
      } else if (F.clock <= 0) {
        F.phase = 'timeup'
        F.phaseT = 0
        F.roundWinner = a.hp === b.hp ? -1 : a.hp > b.hp ? 0 : 1
        say(F, t('Temps écoulé'))
      }
      return
    }
    case 'ko':
    case 'timeup': {
      move(F, h, [NO_PAD, NO_PAD])
      // The winner dances once the other is down.
      const w = F.roundWinner
      if (w !== -1 && F.phaseT > 1.3 && F.f[w].act !== 'win' && !airborne(F.f[w])) setAct(F.f[w], 'win')
      if (F.phaseT >= 3.4) endRound(F)
      return
    }
    case 'over':
      move(F, h, [NO_PAD, NO_PAD])
      return
  }
}

function endRound(F: Fight) {
  if (F.roundWinner === -1) (F.wins[0]++, F.wins[1]++)
  else F.wins[F.roundWinner]++
  if (F.wins[0] >= ROUNDS_TO_WIN || F.wins[1] >= ROUNDS_TO_WIN) {
    F.phase = 'over'
    F.phaseT = 0
    say(F, F.wins[0] > F.wins[1] ? 'Victoire !' : F.wins[0] === F.wins[1] ? t('Match nul') : 'Défaite')
    return
  }
  F.round++
  const [a, b] = F.f
  const s = Math.min(START, F.ar.d * 0.45)
  F.f = [fighter(s, a, a.meter), fighter(-s, b, b.meter)]
  F.clock = ROUND_TIME
  F.phase = 'intro'
  F.phaseT = 0
}

/** One step for both fighters: what they do, where they go, what lands. */
function move(F: Fight, h: number, pads: [Pad, Pad]) {
  F.f.forEach((f, i) => control(F, f, F.f[1 - i], pads[i], h, i as 0 | 1))
  F.f.forEach((f, i) => physics(F, f, h, i as 0 | 1))
  // Bodies don't go through each other (one high in the air passes over).
  const [a, b] = F.f
  let dx = b.x - a.x
  let dz = b.z - a.z
  const d = Math.hypot(dx, dz)
  if (d < BODY && Math.abs(a.y - b.y) < 1.0 && a.act !== 'ko' && b.act !== 'ko' && a.act !== 'down' && b.act !== 'down') {
    if (d < 1e-4) ((dx = 1), (dz = 0))
    const over = (BODY - d) / 2 / Math.max(d, 1e-4)
    a.x -= dx * over
    a.z -= dz * over
    b.x += dx * over
    b.z += dz * over
  }
  for (const [k, f] of F.f.entries()) contain(F, f, k as 0 | 1)
  // Both blows are judged before either lands: two at the same instant trade.
  const sa = strike(F, a, b, 0)
  const sb = strike(F, b, a, 1)
  sa?.()
  sb?.()
}

/** Kept in the arena, out of its props; one sent flying bounces off a wall. */
function contain(F: Fight, f: Fighter, i: 0 | 1) {
  const { w, d, props } = F.ar
  const r = 0.35
  for (const p of props) {
    const dx = f.x - p.x
    const dz = f.z - p.z
    const q = Math.hypot(dx, dz)
    const min = p.r + r
    if (q < min && f.y < 1.6) {
      const k = q > 1e-4 ? min / q : 1
      f.x = p.x + dx * k
      f.z = p.z + dz * k
      if (f.act === 'air' && f.fly) bounce(F, f, i, dx / Math.max(q, 1e-4), dz / Math.max(q, 1e-4))
    }
  }
  if (Math.abs(f.x) > w - r) {
    f.x = Math.sign(f.x) * (w - r)
    if (f.act === 'air' && f.fly) bounce(F, f, i, -Math.sign(f.x), 0)
  }
  if (Math.abs(f.z) > d - r) {
    f.z = Math.sign(f.z) * (d - r)
    if (f.act === 'air' && f.fly) bounce(F, f, i, 0, -Math.sign(f.z))
  }
}

/** Off a wall (n: the wall's normal, into the arena): a thud, a little more damage, back the other way. */
function bounce(F: Fight, f: Fighter, i: 0 | 1, nx: number, nz: number) {
  const into = f.vx * nx + f.vz * nz
  if (into >= -1) return
  f.vx = (f.vx - 2 * into * nx) * 0.3
  f.vz = (f.vz - 2 * into * nz) * 0.3
  f.vy = Math.max(f.vy, 2.5)
  f.fly = false
  if (!f.dead) {
    f.hp = Math.max(0, f.hp - 3)
    F.dealt[1 - i] += 3
    f.dead = f.hp <= 0
  }
  F.freeze = Math.max(F.freeze, 0.07)
  F.events.push({ kind: 'wall', by: (1 - i) as 0 | 1, x: f.x, y: f.y + 1, z: f.z, dmg: 3, heavy: true })
}

function start(F: Fight, f: Fighter, o: Fighter, id: MoveId, i: 0 | 1) {
  const m = MOVES[id]
  setAct(f, 'attack')
  f.move = id
  f.hit = false
  f.chase = false
  f.buffer.a = 0
  f.buffer.s = 0
  // Close enough: turned to the other at once (locked on or not).
  if (dist(f, o) < (m.special ? 14 : AUTO_AIM)) f.h = angleTo(f, o)
  if (m.special) {
    f.meter = 0
    f.invuln = m.startup + 0.15
    F.flash = 0.7
    F.freeze = 0.25
    F.events.push({ kind: 'super', by: i, x: f.x, y: 1.2, z: f.z })
  }
  if (id === 'dive') {
    f.vy = Math.min(f.vy, -2)
    f.vx = Math.sin(f.h) * 6
    f.vz = Math.cos(f.h) * 6
  }
}

function control(F: Fight, f: Fighter, o: Fighter, pad: Pad, h: number, i: 0 | 1) {
  f.t += h
  f.invuln = Math.max(0, f.invuln - h)
  f.esc = Math.max(0, f.esc - h)
  f.roll = Math.max(0, f.roll - h)
  f.guard = pad.guard
  const stick = Math.hypot(pad.x, pad.z)
  const toO = angleTo(f, o)
  const d = dist(f, o)
  // The escape, from under the other's blows: rolled out sideways, the cooldown starts.
  if (f.buffer.e > 0 && (f.act === 'hit' || (f.act === 'air' && !f.dead) || f.act === 'block') && f.esc <= 0 && !f.dead) {
    f.buffer.e = 0
    f.esc = ESCAPE_CD
    f.combo = 0
    f.juggle = 0
    f.fly = false
    const side = stick > 0.3 ? Math.atan2(pad.x, pad.z) : toO + Math.PI + (Math.random() < 0.5 ? 1 : -1) * 1.2
    rollTo(f, side, 8.5)
    f.invuln = 0.5
    F.events.push({ kind: 'escape', by: i, x: f.x, y: f.y + 1, z: f.z })
    return
  }
  switch (f.act) {
    case 'attack': {
      const m = MOVES[f.move!]
      // The chain: the next blow, « Attaque » pressed again (in time, hit or not).
      if (m.next && f.buffer.a > 0 && f.t >= m.startup + m.active * 0.5 && !airborne(f)) return start(F, f, o, f.hit || f.move !== 'rush' ? m.next : 'jab', i)
      const lunging = f.t < m.startup + m.active
      if (f.move === 'dive') {
        if (!airborne(f) && f.t > 0.02) {
          f.vx = f.vz = 0
          if (f.t >= m.startup + m.active + m.recovery || f.hit) setAct(f, 'stance')
        }
        return
      }
      if (m.lunge && lunging && f.t >= (m.special ? m.startup : 0)) {
        // Lunging in, the special steering a little to the other; stopping short once close.
        if (m.special) f.h += turn(f.h, toO) * Math.min(1, h * 6)
        const close = d < BODY + 0.15 && Math.cos(turn(f.h, toO)) > 0.5
        const sp = close ? 0 : m.lunge * f.spd * (f.move === 'rush' || m.special ? 1 : Math.max(0, 1 - f.t / (m.startup + m.active)))
        f.vx = Math.sin(f.h) * sp
        f.vz = Math.cos(f.h) * sp
      } else if (!airborne(f)) {
        f.vx *= Math.exp(-14 * h)
        f.vz *= Math.exp(-14 * h)
      }
      if (f.move === 'marteau' && f.t < 0.05 && f.vy === 0 && f.y === 0) {
        // The hammer: up, and down on the other.
        f.vy = 9.2
        const gap = Math.max(0, d - 0.4)
        f.vx = Math.sin(toO) * gap / 0.72
        f.vz = Math.cos(toO) * gap / 0.72
      }
      if (f.move === 'envol' && f.t >= m.startup && f.t < m.startup + h * 1.5) f.vy = 3.4
      if (!airborne(f) && f.t >= m.startup + m.active + m.recovery) setAct(f, 'stance')
      return
    }
    case 'hit':
    case 'block':
      f.stun -= h
      f.vx *= Math.exp(-8 * h)
      f.vz *= Math.exp(-8 * h)
      if (f.act === 'hit') {
        if (f.stun <= 0) {
          f.combo = 0
          setAct(f, 'stance')
        }
        return
      }
      if (f.stun > 0) return
      if (!f.guard) setAct(f, 'stance')
      break
    case 'dash': {
      // A rush: on until it's run its time, or (chasing) until it's close.
      const far = f.chase && f.t < 0.85 && d > 1.3
      if (f.chase) {
        f.h += turn(f.h, toO) * Math.min(1, h * 10)
        f.vx = Math.sin(f.h) * DASH * f.spd
        f.vz = Math.cos(f.h) * DASH * f.spd
      }
      if (f.buffer.a > 0 && (f.t > 0.08 || !far)) return start(F, f, o, 'rush', i)
      if (f.buffer.j > 0) break
      if (far || (!f.chase && f.t < 0.3)) return
      f.chase = false
      setAct(f, 'stance')
      break
    }
    case 'backstep':
    case 'roll':
      if (f.t < (f.act === 'roll' ? 0.38 : 0.26)) return
      setAct(f, 'stance')
      break
    case 'down':
      f.vx *= Math.exp(-6 * h)
      f.vz *= Math.exp(-6 * h)
      // A quick get-up when a button is pressed, else lying a moment.
      if (f.t >= (f.buffer.j > 0 || f.buffer.e > 0 || f.buffer.d > 0 ? 0.35 : 0.8)) {
        setAct(f, 'getup')
        f.invuln = 0.6
        f.buffer.j = f.buffer.e = f.buffer.d = 0
      }
      return
    case 'getup':
      if (f.t >= 0.4) setAct(f, 'stance')
      return
    case 'jump':
      // One blow in the air: the dive kick.
      if (f.buffer.a > 0) return start(F, f, o, 'dive', i)
      if (pad.lock) f.h += turn(f.h, toO) * Math.min(1, h * 8)
      // A little steering in the air.
      f.vx += pad.x * 6 * h
      f.vz += pad.z * 6 * h
      return
    case 'air':
    case 'thrown':
    case 'ko':
    case 'win':
      return
  }
  if (!free(f)) return
  f.combo = 0
  f.juggle = 0
  f.fly = false
  // The special: the gauge full, a press sets it off; else, held, it charges.
  if (f.buffer.s > 0 && f.meter >= 100) return start(F, f, o, f.sp, i)
  if (f.buffer.a > 0 && f.guard) return start(F, f, o, 'grab', i)
  if (f.buffer.a > 0) return start(F, f, o, 'jab', i)
  if (f.buffer.e > 0 && f.roll <= 0) {
    f.buffer.e = 0
    // A dodge-roll where the stick goes (sideways, round the other, if it's let go).
    rollTo(f, stick > 0.3 ? Math.atan2(pad.x, pad.z) : toO + Math.PI / 2, 7.5)
    f.invuln = 0.3
    F.events.push({ kind: 'roll', by: i, x: f.x, y: 0, z: f.z })
    return
  }
  if (f.buffer.j > 0) {
    f.buffer.j = 0
    setAct(f, 'jump')
    f.vy = JUMP_V
    const k = stick > 0.2 ? (f.act === 'run' ? RUN : STRAFE) : 0
    f.vx = (pad.x / Math.max(1, stick)) * k
    f.vz = (pad.z / Math.max(1, stick)) * k
    return
  }
  if (f.buffer.d > 0) {
    f.buffer.d = 0
    const dir = stick > 0.3 ? Math.atan2(pad.x, pad.z) : toO
    // Pulled away from the other, locked on: a step back. Otherwise a rush (homing when it goes at the other).
    if (pad.lock && stick > 0.3 && Math.cos(turn(dir, toO)) < -0.5) {
      setAct(f, 'backstep')
      f.h = toO
      f.vx = -Math.sin(toO) * BACKSTEP
      f.vz = -Math.cos(toO) * BACKSTEP
      f.invuln = 0.14
      return
    }
    setAct(f, 'dash')
    f.chase = Math.cos(turn(dir, toO)) > 0.6 && d > 2
    f.h = f.chase ? toO : dir
    f.vx = Math.sin(f.h) * DASH * f.spd
    f.vz = Math.cos(f.h) * DASH * f.spd
    F.events.push({ kind: 'dash', by: i, x: f.x, y: 0, z: f.z })
    return
  }
  if (f.guard) {
    if (f.act !== 'block') setAct(f, 'block')
    f.stun = 0
    if (pad.lock) f.h += turn(f.h, toO) * Math.min(1, h * 12)
    return
  }
  if (pad.charge && stick < 0.2 && f.meter < 100) {
    if (f.act !== 'charge') setAct(f, 'charge')
    f.meter = Math.min(100, f.meter + CHARGE * h)
    return
  }
  // Walking or running: circling the other while locked on and close, else running where the stick goes.
  const circling = pad.lock && d < NEAR
  const want: Act = stick < 0.15 ? 'stance' : circling ? 'walk' : 'run'
  if (f.act !== want) setAct(f, want)
  const sp = (circling ? STRAFE : RUN) * f.spd
  const tx = pad.x * sp
  const tz = pad.z * sp
  const k = 1 - Math.exp(-ACCEL * h)
  f.vx += (tx - f.vx) * k
  f.vz += (tz - f.vz) * k
  const face = circling || stick < 0.15 ? (pad.lock && d < 12 ? toO : f.h) : Math.atan2(pad.x, pad.z)
  f.h += turn(f.h, face) * Math.min(1, h * (circling ? 14 : 12))
}

function rollTo(f: Fighter, dir: number, speed: number) {
  setAct(f, 'roll')
  f.h = dir
  f.vx = Math.sin(dir) * speed
  f.vz = Math.cos(dir) * speed
  f.roll = ROLL_CD
  f.move = null
}

function physics(F: Fight, f: Fighter, h: number, i: 0 | 1) {
  if (f.act === 'stance' || f.act === 'block' || f.act === 'charge' || f.act === 'getup' || f.act === 'win' || f.act === 'ko') {
    f.vx *= Math.exp(-14 * h)
    f.vz *= Math.exp(-14 * h)
  }
  if (f.act === 'roll' || f.act === 'backstep') {
    const k = Math.exp(-3 * h)
    f.vx *= k
    f.vz *= k
  }
  f.x += f.vx * h
  f.z += f.vz * h
  if (airborne(f)) {
    f.vy -= GRAVITY * (f.move === 'envol' && f.act === 'attack' ? 0.35 : 1) * h
    f.y += f.vy * h
    if (f.y <= 0) {
      f.y = 0
      f.vy = 0
      const heavy = f.act === 'air' || f.act === 'thrown'
      F.events.push({ kind: 'land', by: i, x: f.x, y: 0, z: f.z, heavy })
      if (f.act === 'attack' && f.move === 'marteau') {
        // The hammer comes down: the ground shakes round it.
        F.events.push({ kind: 'slam', by: i, x: f.x, y: 0, z: f.z, heavy: true })
        f.t = MOVES.marteau.startup
        f.vx = f.vz = 0
        return
      }
      if (f.dead) setAct(f, 'ko')
      else if (heavy) {
        setAct(f, 'down')
        // Sliding on along the ground.
        f.vx *= 0.5
        f.vz *= 0.5
      } else if (f.act === 'jump') setAct(f, 'stance')
      else if (f.act === 'attack' && f.move !== 'dive') ((f.vx = 0), (f.vz = 0))
      if (f.act !== 'down') ((f.vx *= f.act === 'attack' ? 1 : 0.2), (f.vz *= f.act === 'attack' ? 1 : 0.2))
    }
  }
}

/** Does f's blow land on o: if so, what landing does (to be run once both blows are judged). */
function strike(F: Fight, f: Fighter, o: Fighter, i: 0 | 1): (() => void) | null {
  if (f.act !== 'attack' || !f.move || f.hit) return null
  const id = f.move
  const m = MOVES[id]
  if (f.t < m.startup) return null
  if (id === 'marteau') {
    // Only as it comes down.
    if (f.t > m.startup + m.active || airborne(f)) return null
  } else if (id !== 'dive' && f.t >= m.startup + m.active) return null
  if (f.t - STEP < m.startup && id !== 'marteau') F.events.push({ kind: 'swing', by: i, x: f.x, y: f.y + 1.2, z: f.z, heavy: m.dmg >= 9 })
  const dx = o.x - f.x
  const dz = o.z - f.z
  const d = Math.hypot(dx, dz)
  if (d > m.reach + 0.2 || !hittable(o)) return null
  // In front of it (the area blows: all round).
  if (m.arc > -1 && d > 0.2 && (Math.sin(f.h) * dx + Math.cos(f.h) * dz) / d < m.arc) return null
  // The heights: a blow on the ground reaches one a little up (a juggle); the dive kick comes down on it.
  const dy = o.y - f.y
  if (m.level === 'air' ? dy > 0.6 || dy < -1.9 : m.level === 'area' ? o.y > 1.2 : dy > (m.level === 'high' ? 1.8 : 1.3)) return null
  if (m.level === 'throw' && (airborne(o) || o.act === 'hit' || o.act === 'air')) return null
  // As things stand now, before the other's blow changes them.
  const counter = o.act === 'attack' && !!o.move && o.t < MOVES[o.move].startup + MOVES[o.move].active
  // The guard takes it from the front.
  const front = d < 0.05 || (Math.sin(o.h) * -dx + Math.cos(o.h) * -dz) / d > 0.2
  const blocks = canBlock(o) && front
  return () => land(F, f, o, i, id, counter, blocks)
}

function land(F: Fight, f: Fighter, o: Fighter, i: 0 | 1, id: MoveId, counter: boolean, blocks: boolean) {
  const m = MOVES[id]
  f.hit = true
  // Pushed along the line from the one hitting (the area blows: out from it).
  const d = Math.max(0.01, Math.hypot(o.x - f.x, o.z - f.z))
  const ux = m.level === 'area' || id === 'dive' ? (o.x - f.x) / d : Math.sin(f.h)
  const uz = m.level === 'area' || id === 'dive' ? (o.z - f.z) / d : Math.cos(f.h)
  const hy = m.level === 'high' ? 1.55 : o.y + 1.15
  const hx = o.x - ux * 0.25
  const hz = o.z - uz * 0.25
  if (m.level === 'throw') {
    // Over the shoulder and down behind.
    const dmg = Math.round(m.dmg * f.pow)
    o.hp = Math.max(0, o.hp - dmg)
    F.dealt[i] += dmg
    setAct(o, 'thrown')
    o.vy = 6.4
    o.vx = -ux * 2.6
    o.vz = -uz * 2.6
    o.h = Math.atan2(-ux, -uz)
    o.dead = o.hp <= 0
    f.meter = Math.min(100, f.meter + 12)
    o.meter = Math.min(100, o.meter + 6)
    F.freeze = 0.12
    F.events.push({ kind: 'throw', by: i, x: o.x, y: 1.1, z: o.z, dmg, heavy: true })
    return
  }
  if (blocks && !o.dead) {
    // On the guard: a little damage from the big ones, pushed back.
    const chip = m.special ? 8 : m.dmg >= 9 ? 1 : 0
    o.hp = Math.max(1, o.hp - chip)
    if (o.act !== 'block') setAct(o, 'block')
    o.stun = m.block
    o.vx = ux * m.push * 4
    o.vz = uz * m.push * 4
    f.meter = Math.min(100, f.meter + 3)
    o.meter = Math.min(100, o.meter + 4)
    F.freeze = m.special ? 0.12 : 0.05
    F.events.push({ kind: 'block', by: i, x: hx, y: hy, z: hz, heavy: m.dmg >= 9 })
    return
  }
  // Caught starting a blow of its own: a counter, it hurts more.
  const scale = Math.max(0.35, 1 - 0.1 * o.combo)
  const dmg = Math.max(1, Math.round(m.dmg * f.pow * scale * (counter ? 1.25 : 1)))
  o.hp = Math.max(0, o.hp - dmg)
  o.combo++
  F.dealt[i] += dmg
  f.meter = Math.min(100, f.meter + dmg * 1.3)
  o.meter = Math.min(100, o.meter + dmg * 0.8)
  o.dead = o.hp <= 0
  // Turned to the one hitting it.
  o.h = Math.atan2(-ux, -uz)
  o.move = null
  const up = airborne(o)
  if (o.dead || m.knock === 'blast' || m.knock === 'launch' || up) {
    // Up in the air: sent flying and tumbling, popped up, or juggled.
    const blast = m.knock === 'blast' || o.dead
    setAct(o, 'air')
    o.fly = blast
    o.vy = blast ? 4.6 : up ? 4.4 : 7.2
    const k = blast ? (m.special ? 11 : 9) : up ? 1.4 : 1.2
    o.vx = ux * k
    o.vz = uz * k
    o.juggle++
  } else if (m.knock === 'trip') {
    setAct(o, 'down')
    o.vx = ux * 2
    o.vz = uz * 2
  } else {
    setAct(o, 'hit')
    o.stun = m.stun + (counter ? 0.1 : 0)
    o.vx = ux * m.push * 4
    o.vz = uz * m.push * 4
  }
  F.freeze = 0.055 + dmg * 0.006 + (m.special ? 0.14 : 0) + (m.knock === 'blast' ? 0.06 : 0) + (o.dead ? 0.15 : 0)
  F.events.push({ kind: counter ? 'counter' : 'hit', by: i, x: hx, y: hy, z: hz, dmg, heavy: dmg >= 9 || o.dead || m.knock === 'blast' })
  if (o.dead) F.events.push({ kind: 'ko', by: i, x: o.x, y: 1, z: o.z })
}

/** What the avatar shows: its pose, and when it starts over. */
export function poseOf(f: Fighter): { pose: Pose; take: number } {
  const a = f.act
  const pose: Pose =
    a === 'attack'
      ? MOVES[f.move!].pose
      : a === 'walk'
        ? 'fwalk'
        : a === 'run'
          ? 'run'
          : a === 'backstep'
            ? 'fback'
            : a === 'dash'
              ? 'fdash'
              : a === 'roll'
                ? 'froll'
                : a === 'charge'
                  ? 'fcharge'
                  : a === 'jump'
                    ? 'fjump'
                    : a === 'block'
                      ? 'fblock'
                      : a === 'hit'
                        ? f.take % 2
                          ? 'fhit'
                          : 'fhitlow'
                        : a === 'air'
                          ? 'fair'
                          : a === 'thrown'
                            ? 'fthrown'
                            : a === 'down'
                              ? 'fdown'
                              : a === 'getup'
                                ? 'fgetup'
                                : a === 'ko'
                                  ? 'fko'
                                  : a === 'win'
                                    ? 'zouglou'
                                    : 'fstance'
  return { pose, take: f.take }
}

/** The match as a score out of 100: a win by the opponent's rank (70, 85, 100 at most), more with no round lost and life left; lost, by what was done. */
export function fightScore(won: number, lost: number, hpLeft: number, dealt: number, rank = 2) {
  const top = [70, 85, 100][rank] ?? 100
  if (won >= ROUNDS_TO_WIN && won > lost) return Math.round(Math.min(top, top - 22 + (lost === 0 ? 10 : 0) + hpLeft / 8))
  return Math.round(won >= 1 ? 30 + Math.min(15, dealt / 14) : Math.min(25, dealt / 8))
}
