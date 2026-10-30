import type { Pose } from '../../../avatar/Human'
import { t } from '../../../lib/i18n'

// The street fight's rules, apart from what draws it (Scene.tsx) and what
// plays it (../Combat.tsx): two fighters on a line along the street, in
// metres and seconds. Each move has its start-up, the moment it can land,
// and its recovery; a hit stuns, a big one knocks down; a blow lands on a
// guard only at the right height (the low ones crouching, the jumping ones
// standing); the throw goes through the guard. Hits freeze the fight for an
// instant (the blow is felt), chains go jab → cross → uppercut, and the
// Super (the coupé-décalé, its gauge filled by fighting) rushes in.

export const STAGE = 5.6 // the street's half-width the fight can use
export const ROUND_TIME = 60
export const ROUNDS_TO_WIN = 2
const STEP = 1 / 120
const GRAVITY = 24
const WALK = 2.1
const BACK = 1.6
const DASH = 6.5
const BACKDASH = 5.5
const JUMP_V = 7.6
const JUMP_X = 2.6
const BODY = 0.62 // the closest two fighters stand, centre to centre
const BUFFER = 0.16 // a press waits this long for the fighter to be free

export type Level = 'mid' | 'low' | 'high' | 'overhead' | 'throw'
export type MoveId = 'jab' | 'cross' | 'uppercut' | 'highkick' | 'lowpunch' | 'sweep' | 'airpunch' | 'airkick' | 'throw' | 'super'
type Knock = 'launch' | 'trip' | 'away'
type MoveDef = {
  pose: Pose
  startup: number
  active: number
  recovery: number
  dmg: number
  reach: number
  level: Level
  stun: number
  block: number
  push: number
  knock?: Knock
  /** The next blow of a chain, punch or kick pressed once this one has landed. */
  next?: { p?: MoveId; k?: MoveId }
  /** Forward speed while it's thrown (m/s). */
  lunge?: number
}

export const MOVES: Record<MoveId, MoveDef> = {
  jab: { pose: 'jab', startup: 0.06, active: 0.06, recovery: 0.13, dmg: 5, reach: 0.98, level: 'mid', stun: 0.32, block: 0.16, push: 0.3, next: { p: 'cross', k: 'highkick' }, lunge: 1.2 },
  cross: { pose: 'cross', startup: 0.08, active: 0.07, recovery: 0.18, dmg: 7, reach: 1.04, level: 'mid', stun: 0.36, block: 0.18, push: 0.4, next: { p: 'uppercut', k: 'highkick' }, lunge: 1.6 },
  uppercut: { pose: 'uppercut', startup: 0.11, active: 0.08, recovery: 0.32, dmg: 10, reach: 0.9, level: 'mid', stun: 0.5, block: 0.22, push: 0.5, knock: 'launch' },
  highkick: { pose: 'highkick', startup: 0.15, active: 0.09, recovery: 0.3, dmg: 11, reach: 1.32, level: 'high', stun: 0.45, block: 0.2, push: 0.8, knock: 'away' },
  lowpunch: { pose: 'lowpunch', startup: 0.06, active: 0.06, recovery: 0.15, dmg: 4, reach: 0.95, level: 'low', stun: 0.3, block: 0.14, push: 0.3, next: { k: 'sweep' } },
  sweep: { pose: 'sweep', startup: 0.13, active: 0.1, recovery: 0.38, dmg: 8, reach: 1.25, level: 'low', stun: 0.5, block: 0.2, push: 0.4, knock: 'trip' },
  airpunch: { pose: 'airpunch', startup: 0.05, active: 0.5, recovery: 0, dmg: 7, reach: 0.95, level: 'overhead', stun: 0.42, block: 0.2, push: 0.35 },
  airkick: { pose: 'airkick', startup: 0.08, active: 0.5, recovery: 0, dmg: 9, reach: 1.18, level: 'overhead', stun: 0.46, block: 0.22, push: 0.5 },
  throw: { pose: 'fgrab', startup: 0.07, active: 0.05, recovery: 0.42, dmg: 12, reach: 0.82, level: 'throw', stun: 0, block: 0, push: 0 },
  super: { pose: 'fsuper', startup: 0.2, active: 0.55, recovery: 0.3, dmg: 26, reach: 0.95, level: 'mid', stun: 0.6, block: 0.3, push: 0.7, knock: 'launch', lunge: 7 },
}

export type Act = 'stance' | 'walk' | 'back' | 'crouch' | 'jump' | 'dash' | 'backdash' | 'attack' | 'block' | 'hit' | 'air' | 'down' | 'getup' | 'thrown' | 'ko' | 'win'

export type Fighter = {
  x: number
  y: number
  vx: number
  vy: number
  face: 1 | -1
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
  /** Down low (crouching, the low guard, hit while low). */
  low: boolean
  guard: boolean
  /** Hits taken in a row (each one lands a little less). */
  combo: number
  juggle: number
  /** Counts every new act: the pose starts over. */
  take: number
  invuln: number
  dead: boolean
  /** Presses waiting for the fighter to be free (seconds left). */
  buffer: { p: number; k: number; s: number }
  /** The last direction tapped and when (two taps: a dash). */
  tap: { dir: number; at: number }
  prevX: number
}

/** A pad as read this step: the direction held (screen left/right), up, down, the guard held; the buttons pressed since the last step. */
export type Pad = { x: number; up: boolean; down: boolean; guard: boolean; punch: boolean; kick: boolean; sup: boolean }
export const NO_PAD: Pad = { x: 0, up: false, down: false, guard: false, punch: false, kick: false, sup: false }

export type FightEvent = { kind: 'hit' | 'counter' | 'block' | 'throw' | 'swing' | 'super' | 'land' | 'ko'; by: 0 | 1; x: number; y: number; dmg?: number; heavy?: boolean }

export type Phase = 'intro' | 'fight' | 'ko' | 'timeup' | 'over'

export type Fight = {
  f: [Fighter, Fighter]
  phase: Phase
  phaseT: number
  round: number
  wins: [number, number]
  clock: number
  /** The hit-stop: everything holds still for an instant. */
  freeze: number
  /** The K.O. in slow motion. */
  slow: number
  /** The Super's flash: the street darkens. */
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

function fighter(x: number, face: 1 | -1, meter = 0): Fighter {
  return {
    x,
    y: 0,
    vx: 0,
    vy: 0,
    face,
    hp: 100,
    meter,
    act: 'stance',
    t: 0,
    move: null,
    hit: false,
    stun: 0,
    low: false,
    guard: false,
    combo: 0,
    juggle: 0,
    take: 0,
    invuln: 0,
    dead: false,
    buffer: { p: 0, k: 0, s: 0 },
    tap: { dir: 0, at: -9 },
    prevX: 0,
  }
}

export function createFight(): Fight {
  const F: Fight = {
    f: [fighter(-1.5, 1), fighter(1.5, -1)],
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
  return F
}

const say = (F: Fight, s: string) => ((F.said = s), (F.saidAt = F.time))

function setAct(f: Fighter, act: Act) {
  f.act = act
  f.t = 0
  f.take++
}

const airborne = (f: Fighter) => f.y > 0 || f.vy !== 0
/** Free to move or start a blow. */
const free = (f: Fighter) => !airborne(f) && (f.act === 'stance' || f.act === 'walk' || f.act === 'back' || f.act === 'crouch' || (f.act === 'block' && f.stun <= 0))
const hittable = (f: Fighter) => !f.dead && f.invuln <= 0 && f.act !== 'down' && f.act !== 'getup' && f.act !== 'ko' && f.act !== 'thrown' && f.act !== 'win' && !(f.act === 'air' && f.juggle >= 2)
const canBlock = (f: Fighter) => f.guard && !airborne(f) && (f.act === 'stance' || f.act === 'walk' || f.act === 'back' || f.act === 'crouch' || f.act === 'block')

/** The whole fight, `dt` real seconds on (stepped finely inside). */
export function stepFight(F: Fight, dt: number, pads: [Pad, Pad]) {
  // The presses go in the buffers at once, whatever the step.
  pads.forEach((p, i) => {
    const b = F.f[i].buffer
    if (p.punch) b.p = BUFFER
    if (p.kick) b.k = BUFFER
    if (p.sup) b.s = BUFFER
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
  for (const f of F.f) for (const k of ['p', 'k', 's'] as const) f.buffer[k] = Math.max(0, f.buffer[k] - h)
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
      if (F.phaseT >= 1.0 && F.said !== 'Combat !') say(F, 'Combat !')
      if (F.phaseT >= 1.5) ((F.phase = 'fight'), (F.phaseT = 0))
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
      if (F.phaseT >= 3.2) endRound(F)
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
  const m = [F.f[0].meter, F.f[1].meter]
  F.f = [fighter(-1.5, 1, m[0]), fighter(1.5, -1, m[1])]
  F.clock = ROUND_TIME
  F.phase = 'intro'
  F.phaseT = 0
}

/** One step for both fighters: what they do, where they go, what lands. */
function move(F: Fight, h: number, pads: [Pad, Pad]) {
  F.f.forEach((f, i) => control(F, f, pads[i], h, i as 0 | 1))
  for (const f of F.f) physics(F, f, h)
  // Facing each other whenever both are on their feet and free.
  F.f.forEach((f, i) => {
    const o = F.f[1 - i]
    if (free(f) || f.act === 'jump') f.face = o.x >= f.x ? 1 : -1
  })
  // Bodies don't go through each other (one high in the air can pass over).
  const [a, b] = F.f
  const dx = b.x - a.x
  if (Math.abs(dx) < BODY && Math.abs(a.y - b.y) < 1.0 && a.act !== 'ko' && b.act !== 'ko') {
    const over = (BODY - Math.abs(dx)) / 2
    const s = dx >= 0 ? 1 : -1
    a.x -= s * over
    b.x += s * over
  }
  for (const f of F.f) f.x = Math.max(-STAGE, Math.min(STAGE, f.x))
  // At the wall, one pushed against it pushes the other back instead.
  for (const [f, o] of [
    [a, b],
    [b, a],
  ] as const)
    if (Math.abs(f.x) >= STAGE && Math.abs(o.x - f.x) < BODY) o.x = f.x - Math.sign(f.x) * BODY
  // Both blows are judged before either lands: two at the same instant trade.
  const sa = strike(F, a, b, 0)
  const sb = strike(F, b, a, 1)
  sa?.()
  sb?.()
}

function start(F: Fight, f: Fighter, id: MoveId, i: 0 | 1) {
  const m = MOVES[id]
  setAct(f, 'attack')
  f.move = id
  f.hit = false
  f.buffer = { p: 0, k: 0, s: 0 }
  if (id === 'super') {
    f.meter = 0
    f.invuln = m.startup + 0.1
    F.flash = 0.6
    F.freeze = 0.3
    F.events.push({ kind: 'super', by: i, x: f.x, y: 1.2 })
  }
}

function control(F: Fight, f: Fighter, pad: Pad, h: number, i: 0 | 1) {
  f.t += h
  f.invuln = Math.max(0, f.invuln - h)
  f.guard = pad.guard
  const fwd = pad.x * f.face
  // Two taps the same way: a dash.
  let dash = 0
  if (pad.x !== 0 && f.prevX !== pad.x) {
    if (f.tap.dir === pad.x && F.time - f.tap.at < 0.28) dash = pad.x
    f.tap = { dir: pad.x, at: F.time }
  }
  f.prevX = pad.x
  switch (f.act) {
    case 'attack': {
      const m = MOVES[f.move!]
      const air = f.move === 'airpunch' || f.move === 'airkick'
      // A chain: the next blow, once this one has landed.
      if (f.hit && m.next && f.t >= m.startup) {
        const n = f.buffer.p > 0 ? m.next.p : f.buffer.k > 0 ? m.next.k : undefined
        if (n) return start(F, f, n, i)
      }
      if (m.lunge && f.t < m.startup + m.active && !(f.move === 'super' && f.hit)) f.x += f.face * m.lunge * h * (f.move === 'super' && f.t < m.startup ? 0 : 1)
      if (!air && f.t >= m.startup + m.active + m.recovery) setAct(f, 'stance')
      return
    }
    case 'hit':
    case 'block':
      f.stun -= h
      if (f.act === 'hit' && f.stun <= 0) {
        f.combo = 0
        setAct(f, 'stance')
      }
      if (f.act === 'block' && f.stun <= 0 && !f.guard) setAct(f, 'stance')
      if (f.act === 'block' && f.stun > 0) return
      if (f.act === 'hit') return
      break
    case 'dash':
    case 'backdash':
      if (f.t >= (f.act === 'dash' ? 0.22 : 0.28)) setAct(f, 'stance')
      else return
      break
    case 'down':
      if (f.t >= 0.75) {
        setAct(f, 'getup')
        f.invuln = 0.55
      }
      return
    case 'getup':
      if (f.t >= 0.4) setAct(f, 'stance')
      return
    case 'jump':
      // One blow in the air.
      if (f.buffer.k > 0 || f.buffer.p > 0) start(F, f, f.buffer.k > 0 ? 'airkick' : 'airpunch', i)
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
  // A blow, if one was pressed.
  if (f.buffer.s > 0 && f.meter >= 100) return start(F, f, 'super', i)
  if (f.buffer.p > 0 && f.guard) return start(F, f, 'throw', i)
  if (f.buffer.p > 0) return start(F, f, pad.down ? 'lowpunch' : 'jab', i)
  if (f.buffer.k > 0) return start(F, f, pad.down ? 'sweep' : 'highkick', i)
  if (pad.up) {
    setAct(f, 'jump')
    f.vy = JUMP_V
    f.vx = pad.x * JUMP_X
    f.low = false
    return
  }
  if (dash) {
    setAct(f, dash * f.face > 0 ? 'dash' : 'backdash')
    if (f.act === 'backdash') f.invuln = 0.14
    f.low = false
    return
  }
  f.low = pad.down
  if (f.guard) {
    if (f.act !== 'block') setAct(f, 'block')
    f.stun = 0
    return
  }
  const want: Act = pad.down ? 'crouch' : fwd > 0 ? 'walk' : fwd < 0 ? 'back' : 'stance'
  if (f.act !== want) setAct(f, want)
}

function physics(F: Fight, f: Fighter, h: number) {
  if (f.act === 'walk') f.x += f.face * WALK * h
  else if (f.act === 'back') f.x -= f.face * BACK * h
  else if (f.act === 'dash') f.x += f.face * DASH * h
  else if (f.act === 'backdash') f.x -= f.face * BACKDASH * h
  if (airborne(f)) {
    f.vy -= GRAVITY * h
    f.y += f.vy * h
    f.x += f.vx * h
    if (f.y <= 0) {
      f.y = 0
      f.vy = 0
      f.vx = 0
      F.events.push({ kind: 'land', by: 0, x: f.x, y: 0, heavy: f.act === 'air' || f.act === 'thrown' })
      if (f.dead) setAct(f, 'ko')
      else if (f.act === 'air' || f.act === 'thrown') setAct(f, 'down')
      else if (f.act === 'jump' || f.act === 'attack') setAct(f, 'stance')
    }
  } else if (f.act === 'down' || f.act === 'hit' || f.act === 'block') {
    // Sliding back from the blow.
    f.x += f.vx * h
    f.vx *= Math.exp(-10 * h)
  }
}

/** Does f's blow land on o: if so, what landing does (to be run once both blows are judged). */
function strike(F: Fight, f: Fighter, o: Fighter, i: 0 | 1): (() => void) | null {
  if (f.act !== 'attack' || !f.move || f.hit) return null
  const id = f.move
  const m = MOVES[id]
  const air = f.move === 'airpunch' || f.move === 'airkick'
  if (f.t < m.startup || (!air && f.t >= m.startup + m.active)) return null
  if (f.t - 1 / 120 < m.startup) F.events.push({ kind: 'swing', by: i, x: f.x, y: 1.3, heavy: m.dmg >= 9 })
  const d = (o.x - f.x) * f.face
  if (d <= 0 || d > m.reach || !hittable(o)) return null
  // The height: a high kick goes over one crouching; a low blow can't reach one in the air.
  if (m.level === 'high' && (o.low || o.y > 1.4)) return null
  if (m.level === 'low' && o.y > 0.2) return null
  if (m.level === 'mid' && o.y > (id === 'uppercut' || id === 'super' ? 1.8 : 1.0)) return null
  if (m.level === 'overhead' && (f.y < 0.15 || Math.abs(f.y - o.y) > 1.3)) return null
  if (m.level === 'throw' && (airborne(o) || o.act === 'hit' || o.act === 'air')) return null
  // As things stand now, before the other's blow changes them.
  const counter = o.act === 'attack' && !!o.move && o.t < MOVES[o.move].startup + MOVES[o.move].active
  const blocks = canBlock(o) && (m.level === 'low' ? o.low : m.level === 'overhead' ? !o.low : true)
  return () => land(F, f, o, i, id, counter, blocks)
}

function land(F: Fight, f: Fighter, o: Fighter, i: 0 | 1, id: MoveId, counter: boolean, blocks: boolean) {
  const m = MOVES[id]
  f.hit = true
  const hy = m.level === 'low' ? 0.35 : m.level === 'high' ? 1.6 : m.level === 'overhead' ? Math.max(1.2, o.y + 1.3) : o.low ? 0.9 : o.y + 1.25
  if (m.level === 'throw') {
    // Over the shoulder and down behind.
    const dmg = m.dmg
    o.hp = Math.max(0, o.hp - dmg)
    F.dealt[i] += dmg
    setAct(o, 'thrown')
    o.vy = 6.4
    o.vx = -f.face * 2.6
    o.low = false
    o.dead = o.hp <= 0
    f.meter = Math.min(100, f.meter + 12)
    o.meter = Math.min(100, o.meter + 6)
    F.freeze = 0.12
    F.events.push({ kind: 'throw', by: i, x: o.x, y: 1.1, dmg, heavy: true })
    return
  }
  if (blocks && !o.dead) {
    // On the guard: a little damage from the big ones, pushed back.
    const chip = id === 'super' ? 8 : m.dmg >= 9 ? 1 : 0
    o.hp = Math.max(1, o.hp - chip)
    if (o.act !== 'block') setAct(o, 'block')
    o.stun = m.block
    o.vx = f.face * m.push * 4
    f.meter = Math.min(100, f.meter + 3)
    o.meter = Math.min(100, o.meter + 3)
    F.freeze = 0.045
    F.events.push({ kind: 'block', by: i, x: o.x - f.face * 0.25, y: hy, heavy: m.dmg >= 9 })
    return
  }
  // Caught starting a blow of its own: a counter, it hurts more.
  const scale = Math.max(0.35, 1 - 0.13 * o.combo)
  const dmg = Math.max(1, Math.round(m.dmg * scale * (counter ? 1.25 : 1)))
  o.hp = Math.max(0, o.hp - dmg)
  o.combo++
  F.dealt[i] += dmg
  f.meter = Math.min(100, f.meter + dmg * 1.4)
  o.meter = Math.min(100, o.meter + dmg * 0.7)
  o.dead = o.hp <= 0
  const up = airborne(o)
  if (o.dead || m.knock === 'launch' || m.knock === 'away' || up) {
    // Up in the air: launched, sent flying, or juggled.
    const away = m.knock === 'away'
    setAct(o, 'air')
    o.vy = o.dead ? 5.2 : up ? 4.2 : away ? 3.8 : 6.2
    o.vx = f.face * (o.dead ? 2.6 : away ? 4 : 1.5)
    o.juggle++
    o.low = false
  } else if (m.knock === 'trip') {
    setAct(o, 'down')
    o.vx = f.face * 1.2
    o.low = false
  } else {
    setAct(o, 'hit')
    o.stun = m.stun + (counter ? 0.1 : 0)
    o.vx = f.face * m.push * 4
  }
  F.freeze = 0.05 + dmg * 0.007 + (id === 'super' ? 0.12 : 0) + (o.dead ? 0.15 : 0)
  F.events.push({ kind: counter ? 'counter' : 'hit', by: i, x: o.x - f.face * 0.2, y: hy, dmg, heavy: dmg >= 9 || o.dead })
  if (o.dead) F.events.push({ kind: 'ko', by: i, x: o.x, y: 1 })
}

/** What the avatar shows: its pose, and when it starts over. */
export function poseOf(f: Fighter): { pose: Pose; take: number } {
  const pose: Pose =
    f.act === 'attack'
      ? MOVES[f.move!].pose
      : f.act === 'walk'
        ? 'fwalk'
        : f.act === 'back' || f.act === 'backdash'
          ? 'fback'
          : f.act === 'dash'
            ? 'fdash'
            : f.act === 'crouch'
              ? 'fcrouch'
              : f.act === 'jump'
                ? 'fjump'
                : f.act === 'block'
                  ? f.low
                    ? 'flowblock'
                    : 'fblock'
                  : f.act === 'hit'
                    ? f.low
                      ? 'fhitlow'
                      : 'fhit'
                    : f.act === 'air'
                      ? 'fair'
                      : f.act === 'thrown'
                        ? 'fthrown'
                        : f.act === 'down'
                          ? 'fdown'
                          : f.act === 'getup'
                            ? 'fgetup'
                            : f.act === 'ko'
                              ? 'fko'
                              : f.act === 'win'
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
